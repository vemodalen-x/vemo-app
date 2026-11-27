'use client';

import {useEffect, useRef, useState} from 'react';
import {Camera, ImagePlus, RefreshCw} from 'lucide-react';
import {defaults, type Adjust, type Recipe} from './film';
import {canvasOf, grade} from './pixels';
import {photoFileTypes} from './photo-file';
import './camera-preview.css';

export type CameraLook = {recipe: Recipe; adjustment: Adjust};
type CameraStatus = 'idle' | 'starting' | 'live';
type Facing = 'environment' | 'user';

function cameraMessage(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError': return '相机访问被拒绝。可在浏览器网站设置中允许相机，再重试。';
      case 'NotFoundError': return '没有找到可用相机。可以用系统相机拍照或从相册选图。';
      case 'NotReadableError': return '相机可能被其他应用占用。关闭占用相机的应用后重试。';
    }
  }
  return '相机暂时无法打开，请重试或用系统相机拍照。';
}

export function CameraPreview({initial, choices, onCapture}: {
  initial: CameraLook;
  choices: Recipe[];
  onCapture: (file: File, look?: CameraLook) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef(0);
  const capturePending = useRef(false);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [facing, setFacing] = useState<Facing>('environment');
  const [mirrored, setMirrored] = useState(false);
  const [look, setLook] = useState(initial);
  const [original, setOriginal] = useState(false);
  const [ratio, setRatio] = useState(4 / 3);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);

  function releaseCamera() {
    request.current++;
    const active = stream.current;
    stream.current = null;
    active?.getTracks().forEach(track => track.stop());
    if (video.current) video.current.srcObject = null;
  }

  useEffect(() => {
    const suspend = () => {
      if (!document.hidden) return;
      releaseCamera();
      capturePending.current = false;
      setCapturing(false);
      setStatus('idle');
    };
    document.addEventListener('visibilitychange', suspend);
    return () => {
      document.removeEventListener('visibilitychange', suspend);
      releaseCamera();
    };
  }, []);

  async function start(next: Facing, switching = false) {
    if (!video.current || !navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器无法打开实时相机，可以用系统相机或相册继续。');
      return;
    }
    releaseCamera();
    const token = request.current;
    setStatus('starting');
    setError('');
    setFacing(next);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: switching ? {exact: next} : {ideal: next}, width: {ideal: 1920}, height: {ideal: 1080}},
        audio: false,
      });
      if (token !== request.current || !video.current) {
        nextStream.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = nextStream;
      const track = nextStream.getVideoTracks()[0];
      const side = track?.getSettings().facingMode;
      setMirrored((side ?? next) === 'user');
      if (side === 'user' || side === 'environment') setFacing(side);
      track?.addEventListener('ended', () => {
        if (stream.current !== nextStream) return;
        releaseCamera();
        setStatus('idle');
        setError('相机已断开，可重新开启。');
      }, {once: true});
      video.current.srcObject = nextStream;
      await video.current.play();
      if (request.current === token) setStatus('live');
    } catch (reason) {
      if (token !== request.current) return;
      if (switching && reason instanceof DOMException && ['OverconstrainedError', 'NotFoundError'].includes(reason.name)) {
        await start(next === 'user' ? 'environment' : 'user');
        return;
      }
      releaseCamera();
      setStatus('idle');
      setError(cameraMessage(reason));
    }
  }

  useEffect(() => {
    if (status !== 'live') return;
    const display = preview.current;
    const camera = video.current;
    if (!display || !camera) return;
    const ctx = display.getContext('2d', {willReadFrequently: true});
    if (!ctx) return;

    // The preview is intentionally smaller than the saved frame.
    let last = -100, lastVideoTime = -1, frame = 0;
    const draw = (now: number) => {
      if (camera.videoWidth && camera.readyState >= 2 && now - last >= 66 && camera.currentTime !== lastVideoTime) {
        const scale = Math.min(1, 480 / Math.max(camera.videoWidth, camera.videoHeight));
        const width = Math.round(camera.videoWidth * scale), height = Math.round(camera.videoHeight * scale);
        if (display.width !== width || display.height !== height) {
          display.width = width;
          display.height = height;
          setRatio(camera.videoWidth / camera.videoHeight);
        }
        ctx.drawImage(camera, 0, 0, width, height);
        if (!original) grade(display, display, look.recipe, look.adjustment);
        last = now;
        lastVideoTime = camera.currentTime;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [look, original, status]);

  async function takePhoto() {
    const camera = video.current;
    if (!camera?.videoWidth || camera.readyState < 2 || !stream.current || capturePending.current) return;
    capturePending.current = true;
    const token = request.current;
    setCapturing(true);
    setError('');
    try {
      const canvas = canvasOf(camera, camera.videoWidth, camera.videoHeight, 3072);
      if (mirrored) {
        const ctx = canvas.getContext('2d')!;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);
      }
      const jpeg = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('照片编码失败')), 'image/jpeg', .95);
      });
      if (request.current !== token) return;
      const captured = new File([jpeg], 'Luma-相机-' + Date.now() + '.jpg', {type: 'image/jpeg'});
      onCapture(captured, original ? {...look, adjustment: {...defaults, strength: 0}} : look);
    } catch {
      if (token === request.current) setError('这张照片未能保存，请再拍一次。');
    } finally {
      if (token === request.current) {
        capturePending.current = false;
        setCapturing(false);
      }
    }
  }

  const looks = choices.some(item => item.id === initial.recipe.id) ? choices : [initial.recipe, ...choices];
  return <div className="camera-preview">
    <video ref={video} className="camera-input-video" autoPlay playsInline muted aria-hidden="true"/>
    <div className="camera-screen" style={{'--camera-ratio': ratio} as React.CSSProperties}>
      <canvas ref={preview} className={mirrored?'camera-mirrored':undefined} aria-label="相机实时滤镜预览" hidden={status!=='live'}/>
      {status!=='live'&&<div className="camera-start">
        <Camera size={32}/>
        <p>{status==='starting'?'等待相机连接…':'打开相机，实时查看滤镜效果'}</p>
        <button type="button" className="primary" disabled={status==='starting'} onClick={() => void start(facing)}>开启实时相机</button>
      </div>}
    </div>
    {error&&<p className="camera-error" role="alert">{error}</p>}
    {status==='live'&&<>
      <div className="camera-adjust">
        <label>滤镜<select value={look.recipe.id} onChange={event => {
          const selected = looks.find(item => item.id===event.target.value);
          if (selected) {setLook(selected.id===initial.recipe.id ? initial : {recipe: selected, adjustment: defaults});setOriginal(false);}
        }}>{looks.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>强度 <output>{look.adjustment.strength}%</output>
          <input type="range" min={0} max={100} value={look.adjustment.strength} disabled={original}
            onChange={event => setLook({...look, adjustment: {...look.adjustment, strength: +event.target.value}})}/>
        </label>
      </div>
      <div className="camera-controls">
        <button type="button" className="secondary" aria-pressed={original} onClick={() => setOriginal(value => !value)}>{original?'看滤镜':'看原图'}</button>
        <button type="button" className="camera-shutter" aria-label="拍照" disabled={capturing} onClick={() => void takePhoto()}><Camera size={25}/></button>
        <button type="button" className="secondary" disabled={capturing} onClick={() => void start(facing==='user'?'environment':'user', true)}><RefreshCw size={15}/>翻转</button>
      </div>
      <p className="camera-caption">拍下的是原图，可在工作台继续调整。相机预览在本机处理。</p>
    </>}
    <button type="button" className="text-btn camera-fallback" onClick={() => fileInput.current?.click()}><ImagePlus size={16}/>系统相机或相册</button>
    <input ref={fileInput} type="file" hidden accept={photoFileTypes} capture="environment" onChange={event=>{
      const file=event.target.files?.[0];
      if (file) onCapture(file);
    }}/>
  </div>;
}
