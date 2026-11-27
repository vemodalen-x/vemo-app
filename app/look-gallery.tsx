'use client';

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Aperture,Check,ChevronsLeftRight,Columns2,Image as ImageIcon,Maximize,Minimize,RotateCcw,X} from 'lucide-react';
import type {Recipe} from './film';
import {canvasOf,grade} from './pixels';
import {defaults} from './film';
import { examples, originalAsset, type LookExample } from './luts/examples';
import { lookDescription } from './luts/look-copy';
import './look-gallery.css';
import {measureTone,toneCategories,type ToneId,type ToneMeasurement} from './luts/tones';

export type { LookExample } from './luts/examples';
export function lookExample(id:string){return examples[id];}
export function exampleAsset(id:string,variant:'original'|'graded'|'thumb'|'original-thumb', sample?:LookExample){
 return variant==='original'?originalAsset(id,sample):'/look-examples/'+(sample?.assetId??id)+'/'+variant+'.webp';
}

export function LookGallery({looks, selected, onOpen, tones, samples}: {
  looks: Recipe[];
  selected: string;
  onOpen: (look: Recipe, fullscreen?: boolean, source?: LookExample) => void;
  tones?: Readonly<Record<string, ToneId>>;
  samples?: Readonly<Record<string, LookExample>>;
}) {
  return <div className="look-exhibit">{looks.map((look, index) => {
    const sample = samples?.[look.id] ?? lookExample(look.id);
    const tone = tones?.[look.id];
    const badge = look.id === 'mirror-light' ? '校准' : tone ? toneCategories[tone].name : sample.scene;
    const loading = index < 2 ? 'eager' : 'lazy';
    return <article key={look.id} className="exhibit-card">
      <div className="exhibit-image">
        <button type="button" className="exhibit-open" onClick={() => onOpen(look, false, sample)} aria-label={look.name + '，看原图和滤镜效果'}>
          <img src={exampleAsset(look.id,'original-thumb',sample)} alt="" loading={loading} decoding="async" width="720" height="480"/>
          <img className="exhibit-after" src={exampleAsset(look.id,'thumb',sample)} alt="" loading={loading} decoding="async" width="720" height="480"/>
          <span className="exhibit-divider" aria-hidden="true"/>
          <span className="exhibit-labels" aria-hidden="true"><span>原图</span><span>应用后</span></span>
        </button>
        <button className="exhibit-expand" type="button" aria-label={'全屏查看 ' + look.name} onClick={() => onOpen(look, true, sample)}>
          <Maximize size={17}/>
        </button>
      </div>
      <div className="exhibit-caption">
        <div className="exhibit-caption-top"><h3>{look.name}</h3><span>{badge}{selected===look.id&&<Check size={14} aria-label="当前滤镜"/>}</span></div>
        <p>{lookDescription(look)}</p>
        {sample.credit&&<a className="exhibit-credit" href={sample.credit.url} target="_blank" rel="noreferrer">{sample.credit.author} · Unsplash</a>}
      </div>
    </article>;
  })}</div>;
}

function readTone(image: HTMLCanvasElement) {
 const preview = canvasOf(image,image.width,image.height,256);
 return measureTone(preview.getContext('2d')!.getImageData(0,0,preview.width,preview.height).data);
}

function ToneHistogram({original,graded}:{original:ToneMeasurement;graded:ToneMeasurement}) {
 const maximum = Math.max(...original.histogram,...graded.histogram);
 const points = (histogram:number[]) => histogram.map((value,index) => `${index * 10 + 5},${56 - 50 * value / maximum}`).join(' ');
 const percentage = (value:number) => Math.round(value * 100) + '%';
 return <div className="tone-histogram">
   <div className="tone-histogram-heading"><strong>亮度直方图</strong><div className="tone-chart-legend"><span>原图</span><span>LUT 应用后</span></div></div>
   <svg viewBox="0 0 320 56" preserveAspectRatio="none" role="img" aria-label={`LUT 亮度中位数 ${percentage(graded.median)}，明暗跨度 ${percentage(graded.span)}`}>
     <path d="M 112 0 V 56 M 208 0 V 56" stroke="currentColor" opacity=".15"/>
     <polyline points={points(original.histogram)} fill="none" stroke="#a4adbc" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
     <polyline points={points(graded.histogram)} fill="none" stroke="#b1c7ff" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
   </svg>
   <div className="tone-chart-axis"><span>暗部</span><span>中间调</span><span>亮部</span></div>
   <div className="tone-metrics">
     <span>亮度中位数 <b>{percentage(original.median)} → {percentage(graded.median)}</b></span>
     <span title="第 95 与第 5 百分位之间的亮度差">明暗跨度 P5–P95 <b>{percentage(original.span)} → {percentage(graded.span)}</b></span>
   </div>
 </div>;
}

type Display = 'compare' | 'original' | 'graded' | 'both';

export function LookStudy({look, canApply, onApply, onUseExample, tone, close, sample, startFullscreen=false}: {
  look: Recipe;
  canApply: boolean;
  onApply: (strength: number) => void;
  onUseExample: (strength: number) => void;
  tone?: ToneId;
  close: () => void;
  sample: LookExample;
  startFullscreen?: boolean;
}) {
  const originalUrl = exampleAsset(look.id, 'original', sample);
  const gradedUrl = exampleAsset(look.id, 'graded', sample);
  const [display, setDisplay] = useState<Display>('compare');
  const [fullscreen, setFullscreen] = useState(startFullscreen);
  const [strength, setStrength] = useState(sample.strength);
  const [split, setSplit] = useState(50);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [originalTone, setOriginalTone] = useState<ToneMeasurement | null>(null);
  const [gradedTone, setGradedTone] = useState<ToneMeasurement | null>(null);
  const [failure, setFailure] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const toggleFullscreen = () => {
    setFullscreen(value => !value);
    dialog.current?.scrollTo({top: 0});
  };

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const image = new Image();
    let live = true;
    image.onload = () => {
      if (!live) return;
      const previewEdge = window.matchMedia('(max-width: 760px)').matches ? 1600 : 2400;
      const loaded = canvasOf(image, image.naturalWidth, image.naturalHeight, previewEdge);
      setSource(loaded);
      if (tone) setOriginalTone(readTone(loaded));
    };
    image.onerror = () => { if (live) setFailure(true); };
    image.src = originalUrl;
    return () => { live = false; image.onload = null; image.onerror = null; };
  }, [originalUrl, tone]);

  useEffect(() => {
    if (!source) return;
    const frame = requestAnimationFrame(() => {
      if (!canvas.current) return;
      grade(source, canvas.current, look, {...defaults, strength});
      if (tone) setGradedTone(readTone(canvas.current));
    });
    return () => cancelAnimationFrame(frame);
  }, [look, source, strength, tone]);

  const stageStyle = source
    ? {'--look-ratio': source.width / source.height} as CSSProperties
    : undefined;

  return <dialog ref={dialog} className={'look-viewer' + (fullscreen ? ' look-fullscreen' : '')}
    aria-label={look.name + ' · 滤镜样片'} onCancel={event => {
      event.preventDefault();
      if (fullscreen) toggleFullscreen();
      else close();
    }} onClick={event => {
      if (event.target !== event.currentTarget || fullscreen) return;
      const {left, right, top, bottom} = event.currentTarget.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) close();
    }}>
    <header className="look-viewer-header">
      <div><h2>{look.name}</h2><p>{tone ? toneCategories[tone].name + ' · ' : ''}{sample.title}</p></div>
      <div className="look-viewer-actions">
        <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏' : '全屏查看'}>
          {fullscreen ? <Minimize size={18}/> : <Maximize size={18}/>}<span>{fullscreen ? '退出全屏' : '全屏'}</span>
        </button>
        <button type="button" onClick={close} aria-label="关闭样片"><X size={21}/></button>
      </div>
    </header>

    <div className="look-viewer-toolbar" role="group" aria-label="样片对比方式">
      <button type="button" aria-pressed={display==='compare'} onClick={() => setDisplay('compare')}><ChevronsLeftRight size={16}/>滑块</button>
      <button type="button" aria-pressed={display==='both'} onClick={() => setDisplay('both')}><Columns2 size={16}/>并排</button>
      <button type="button" aria-pressed={display==='original'} onClick={() => setDisplay('original')}>原图</button>
      <button type="button" aria-pressed={display==='graded'} onClick={() => setDisplay('graded')}>应用后</button>
    </div>

    <div className={'look-viewer-stage' + (display === 'both' ? ' look-viewer-pair' : '')} style={stageStyle}>
      {display==='both'&&<figure key="original" className="look-visual-frame">
        <img src={originalUrl} alt={sample.title + ' · 原图'}/><figcaption className="look-frame-tag">原图</figcaption>
      </figure>}
      <figure key="comparison" className="look-visual-frame">
        {display!=='both'&&<img src={originalUrl} alt={sample.title + ' · 原图'}/>}
        {(!source || strength===sample.strength) && display!=='original' && <img className="look-grade-placeholder" src={gradedUrl} alt={sample.title + ' · LUT 应用后'} style={{clipPath:display==='compare'?'inset(0 0 0 '+split+'%)':undefined}}/>}
        <canvas ref={canvas} role="img" aria-hidden={display==='original'||!source} aria-label={sample.title + ' · LUT 应用后 ' + strength + '%'}
          style={{visibility:source&&display!=='original'&&strength!==sample.strength?'visible':'hidden',clipPath: display==='compare'?'inset(0 0 0 '+split+'%)':undefined}}/>
        {display==='compare' ? <>
          <div className="look-frame-divider" style={{left:split+'%'}} aria-hidden="true"><span><ChevronsLeftRight size={19}/></span></div>
          <input className="study-wipe" type="range" min="0" max="100" value={split} aria-label="拖动对比原图与滤镜" onChange={event => setSplit(+event.target.value)}/>
          <div className="exhibit-labels look-frame-labels" aria-hidden="true"><span>原图</span><span>应用后</span></div>
        </> : <figcaption className="look-frame-tag">{display==='original' ? '原图' : '应用后'}</figcaption>}
      </figure>
    </div>

    <div className="look-viewer-footer">
      <label className="look-strength"><span>滤镜强度 <output>{strength}%</output></span>
        <input type="range" min="0" max="100" value={strength} disabled={!source}
          aria-label="滤镜强度" aria-valuetext={strength+'%'} onChange={event => setStrength(+event.target.value)}/>
      </label>
      <button type="button" className="look-reset" onClick={() => setStrength(sample.strength)} disabled={strength===sample.strength}
        aria-label={'恢复推荐强度 ' + sample.strength + '%'}><RotateCcw size={16}/>恢复推荐</button>
    </div>

    {failure&&<p className="look-viewer-notes" role="status">原图载入失败。请关闭样片后重试。</p>}
    {!fullscreen&&<div className="look-viewer-notes">
      <p>{lookDescription(look)}</p>
      <p><strong>看哪里</strong> {sample.note}</p>
      {sample.credit&&<p><a className="exhibit-credit" href={sample.credit.url} target="_blank" rel="noreferrer">实拍原片 · {sample.credit.author} / Unsplash</a></p>}
      {tone&&originalTone&&gradedTone&&<ToneHistogram original={originalTone} graded={gradedTone}/>}
      <div className="example-study-actions">
        <button className="secondary" type="button" onClick={() => onUseExample(strength)}><Aperture size={17}/>用样片试调</button>
        {canApply&&<button className="primary" type="button" onClick={() => onApply(strength)}><ImageIcon size={17}/>应用到我的照片</button>}
      </div>
    </div>}
  </dialog>;
}
