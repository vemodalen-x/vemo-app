'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Check, ChevronsLeftRight, Code2, Columns2, Copy, Download, Link2, Rows3, ScanLine,
} from 'lucide-react';
import studyData from './studies.json';

const { scenes, styles, cases } = studyData;
const studies: Record<string, { size: number[]; prompt: string }> = cases;
const styleReferences: Record<string, string[]> = {
  impression: ['印象派.jpg'],
  american: ['美国彩色摄影.jpg'],
  renaissance: ['文艺复兴(1).PNG'],
  baroque: ['巴洛克(1).jpg'],
  taiwan: ['台湾新电影.jpg'],
  night: ['夜景.jpg', '夜景人物.jpg'],
};

function findScene(id: string | null) {
  return scenes.find(scene => scene.id === id) ?? scenes[0];
}

function findStyle(id: string | null) {
  return styles.find(style => style.id === id) ?? styles[0];
}

const imageLabels = {
  original: '原图',
  imagegen: 'Image Gen',
  lut: 'LUT 套用图',
} as const;
type ImageKind = keyof typeof imageLabels;
const imagePairs = [
  { id: 'original-imagegen', left: 'original', right: 'imagegen' },
  { id: 'original-lut', left: 'original', right: 'lut' },
  { id: 'lut-imagegen', left: 'lut', right: 'imagegen' },
] as const;

function findPair(id: string | null) {
  return imagePairs.find(pair => pair.id === id) ?? imagePairs[0];
}

function studyUrl(scene: string, style: string, pair: string) {
  return '/studies?' + new URLSearchParams({ scene, style, pair }).toString();
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Selection-based copy also works in browsers that deny Clipboard access.
  }
  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.readOnly = true;
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  const focus = document.activeElement;
  document.body.appendChild(fallback);
  fallback.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    fallback.remove();
    if (focus instanceof HTMLElement) focus.focus({ preventScroll: true });
  }
}

type StudyImage = { kind: ImageKind; preview: string; file: string; name: string; alt: string };

function Photo({
  image, width, height, wide = false,
}: {
  image: StudyImage; width: number; height: number; wide?: boolean;
}) {
  const shortWidth = Math.round(width * Math.min(1, 960 / Math.max(width, height)));
  return (
    <img
      src={image.preview}
      srcSet={image.preview === image.file ? undefined : `${image.preview} ${shortWidth}w, ${image.file} ${width}w`}
      sizes={wide ? "(max-width: 900px) 94vw, 66vw" : "(max-width: 900px) 48vw, 34vw"}
      width={width}
      height={height}
      alt={image.alt}
      decoding="async"
    />
  );
}

function ImageLabel({ kind }: { kind: ImageKind }) {
  return <span className="studies-image-label" data-kind={kind}>{imageLabels[kind]}</span>;
}

function ImageCaption({ image, side }: { image: StudyImage; side: 'A' | 'B' }) {
  return (
    <figcaption className="studies-photo-label" data-kind={image.kind}>
      <span className="studies-photo-name">
        <span className="studies-side" aria-hidden="true">{side}</span>
        <ImageLabel kind={image.kind} />
      </span>
      <a href={image.file} download={image.name} aria-label={'下载 ' + imageLabels[image.kind] + ' JPG'}>
        <Download size={15} aria-hidden="true" /><span>JPG</span>
      </a>
    </figcaption>
  );
}

export function StudyGallery({
  initialScene, initialStyle, initialPair,
}: {
  initialScene: string | null;
  initialStyle: string | null;
  initialPair: string | null;
}) {
  const [selection, setSelection] = useState(() => ({
    scene: findScene(initialScene),
    style: findStyle(initialStyle),
    pair: findPair(initialPair),
  }));
  const [comparison, setComparison] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [split, setSplit] = useState(50);
  useEffect(() => {
    if (window.matchMedia('(max-width: 640px)').matches) setComparison('slider');
  }, []);
  const [notice, setNotice] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'prompt' | 'link'>('idle');
  const request = useRef(0);
  const prompt = useRef<HTMLDivElement>(null);
  const { scene, style, pair } = selection;
  const id = scene.id + '-' + style.id;
  const study = studies[id];
  const [width, height] = study.size;
  const assets = '/study-assets/' + scene.id + '/' + style.id;
  const originalFile = '/samples/' + scene.id + '.jpg';
  const images: Record<ImageKind, StudyImage> = {
    original: {
      kind: 'original', preview: originalFile, file: originalFile,
      name: scene.id + '-Original.jpg', alt: scene.title + ' · 原图',
    },
    imagegen: {
      kind: 'imagegen', preview: assets + '/ImageGen.webp', file: assets + '/ImageGen.jpg',
      name: id + '-ImageGen.jpg', alt: scene.title + ' · ' + style.name + ' · Image Gen',
    },
    lut: {
      kind: 'lut', preview: assets + '/LUT-on-original.webp', file: assets + '/LUT-on-original.jpg',
      name: id + '-LUT-on-original.jpg', alt: scene.title + ' · ' + style.name + ' · LUT 套用图',
    },
  };
  const left = images[pair.left];
  const right = images[pair.right];

  function clearCopyStatus() {
    request.current++;
    setNotice('');
    setCopyState('idle');
  }

  function select(nextScene: typeof scene, nextStyle: typeof style, nextPair = pair) {
    if (nextScene === scene && nextStyle === style && nextPair === pair) return;
    clearCopyStatus();
    setSelection({ scene: nextScene, style: nextStyle, pair: nextPair });
    setSplit(50);
    window.history.pushState(null, '', studyUrl(nextScene.id, nextStyle.id, nextPair.id));
  }

  useEffect(() => {
    function restoreSelection() {
      const query = new URLSearchParams(window.location.search);
      setSelection({
        scene: findScene(query.get('scene')),
        style: findStyle(query.get('style')),
        pair: findPair(query.get('pair')),
      });
      clearCopyStatus();
      setSplit(50);
    }
    window.addEventListener('popstate', restoreSelection);
    return () => window.removeEventListener('popstate', restoreSelection);
  }, []);

  useEffect(() => {
    prompt.current?.scrollTo({ top: 0 });
  }, [id]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function copy(kind: 'prompt' | 'link') {
    const token = ++request.current;
    const value = kind === 'prompt' ? study.prompt : new URL(studyUrl(scene.id, style.id, pair.id), window.location.origin).href;
    const copied = await copyText(value);
    if (request.current !== token) return;
    setCopyState(copied ? kind : 'idle');
    if (copied) {
      setNotice(kind === 'prompt' ? '已复制完整提示词' : '已复制当前组合的链接');
    } else {
      if (kind === 'prompt' && prompt.current) window.getSelection()?.selectAllChildren(prompt.current);
      setNotice(kind === 'prompt' ? '可选中提示词，使用系统的复制功能。' : '可从地址栏复制当前组合的链接。');
    }
  }

  const selectedName = scene.name + ' · ' + style.name;
  const layoutStyle = {
    '--study-ratio': width + ' / ' + height,
    '--study-split': split + '%',
    '--study-max-width': 'min(' + (59 * width / height) + 'vh, ' + (616 * width / height) + 'px)',
  } as CSSProperties;

  return (
    <main className="studies-main">
      <div className="studies-heading">
        <div>
          <h1>风格对照 <em>Style Studies</em></h1>
          <p>比较原图、Image Gen 成片和 LUT 套用图，并查看实际使用的提示词。</p>
        </div>
        <span className="studies-count">8 个场景 <b>×</b> 6 种滤镜</span>
      </div>

      <section className="studies-scenes" aria-label="选择场景">
        {scenes.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={scene.id === item.id}
            onClick={() => select(item, style)}
          >
            <span className="studies-scene-image">
              <img src={'/study-assets/' + item.id + '.webp'} width="320" height="186" alt="" decoding="async" />
              {scene.id === item.id && <Check size={16} className="studies-selected" aria-hidden="true" />}
            </span>
            <span className="studies-scene-name">{item.name}</span>
          </button>
        ))}
      </section>

      <section className="studies-stylebar" aria-label="选择滤镜">
        <div className="studies-styles">
          {styles.map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={style.id === item.id}
              onClick={() => select(scene, item)}
            >{item.name}</button>
          ))}
        </div>
        <p><span className="studies-style-dot" />{style.character}</p>
      </section>

      <div className="studies-workspace">
        <section className="studies-viewer" aria-labelledby="study-selected-title" style={layoutStyle}>
          <div className="studies-panel-header">
            <div>
              <h2 id="study-selected-title">{selectedName}</h2>
              <p>{scene.id.toUpperCase()} · {scene.title}</p>
            </div>
            <div className="studies-switch" aria-label="显示方式" role="group">
              <button type="button" aria-pressed={comparison === 'side-by-side'} onClick={() => setComparison('side-by-side')}>
                <Columns2 size={16} />并排
              </button>
              <button type="button" aria-pressed={comparison === 'slider'} onClick={() => setComparison('slider')}>
                <ScanLine size={16} />滑块
              </button>
            </div>
          </div>

          <div className="studies-pair-picker" role="group" aria-label="比较对象">
            {imagePairs.map(option => (
              <button
                type="button"
                key={option.id}
                aria-pressed={pair.id === option.id}
                aria-label={imageLabels[option.left] + '与' + imageLabels[option.right]}
                onClick={() => select(scene, style, option)}
              >
                <ImageLabel kind={option.left} />
                <span className="studies-versus" aria-hidden="true">vs</span>
                <ImageLabel kind={option.right} />
              </button>
            ))}
          </div>

          {comparison === 'side-by-side' ? (
            <div className="studies-pair">
              {[left, right].map((photo, index) => (
                <figure key={photo.kind} className="studies-photo">
                  <ImageCaption image={photo} side={index === 0 ? 'A' : 'B'} />
                  <div className="studies-photo-body"><Photo image={photo} width={width} height={height} /></div>
                </figure>
              ))}
            </div>
          ) : (
            <figure className="studies-slider">
              <div className="studies-pair">
                <div className="studies-slider-label" data-kind={left.kind}>
                  <span className="studies-side" aria-hidden="true">A</span><ImageLabel kind={left.kind} />
                </div>
                <div className="studies-slider-label" data-kind={right.kind}>
                  <span className="studies-side" aria-hidden="true">B</span><ImageLabel kind={right.kind} />
                </div>
              </div>
              <div className="studies-slider-photo">
                <Photo image={left} width={width} height={height} wide />
                <div className="studies-slider-overlay"><Photo image={right} width={width} height={height} wide /></div>
                <div className="studies-divider" aria-hidden="true" />
                <div className="studies-slider-grip" aria-hidden="true"><ChevronsLeftRight size={20} /></div>
                <input
                  type="range"
                  min="0" max="100" value={split}
                  aria-label={'调整' + imageLabels[left.kind] + '与' + imageLabels[right.kind] + '的分界位置'}
                  aria-valuetext={'左侧 ' + imageLabels[left.kind] + ' ' + split + '%，右侧 ' + imageLabels[right.kind] + ' ' + (100 - split) + '%'}
                  onChange={event => setSplit(Number(event.target.value))}
                />
              </div>
              <figcaption className="studies-slider-downloads">
                {[left, right].map(photo => (
                  <a key={photo.kind} href={photo.file} download={photo.name}>
                    <Download size={15} aria-hidden="true" />下载 {imageLabels[photo.kind]}
                  </a>
                ))}
              </figcaption>
            </figure>
          )}

          <div className="studies-files">
            <a className="studies-control studies-prompt-jump" href="#study-prompt-heading"><Code2 size={16} />看提示词</a>
            <a className="studies-lut" href={assets + '/LUT.cube'} download={id + '-33.cube'}>
              <Download size={16} />下载 33³ LUT
            </a>
            <a className="studies-control" href={originalFile} download={images.original.name}>
              下载原图
            </a>
            <button type="button" className="studies-share" onClick={() => copy('link')}>
              {copyState === 'link' ? <Check size={16} /> : <Link2 size={16} />}
              {copyState === 'link' ? '链接已复制' : '复制链接'}
            </button>
          </div>
        </section>

        <aside className="studies-prompt" aria-labelledby="study-prompt-heading">
          <div className="studies-prompt-title">
            <h2 id="study-prompt-heading"><Code2 size={18} />生成提示词</h2>
            <button className="studies-control" type="button" onClick={() => copy('prompt')}>
              {copyState === 'prompt' ? <Check size={16} /> : <Copy size={16} />}
              {copyState === 'prompt' ? '已复制' : '复制'}
            </button>
          </div>
          <div className="studies-prompt-content">
            <div className="studies-input-title"><Rows3 size={15} /><h3>图片输入顺序</h3></div>
            <ol className="studies-inputs">
              <li><span>待编辑原图</span><strong>{scene.title}</strong></li>
              {styleReferences[style.id].map(name => <li key={name}><span>风格参考</span><strong>{name}</strong></li>)}
            </ol>
            <div className="studies-english-label"><h3>原始提示词</h3><span>EN</span></div>
            <div className="studies-prompt-text" tabIndex={0} lang="en" ref={prompt} aria-label="Original Image Gen prompt">
              {study.prompt}
            </div>
          </div>
        </aside>
      </div>
      <div className="studies-notice" role="status" aria-live="polite">
        {notice && <span>{notice}</span>}
      </div>
    </main>
  );
}
