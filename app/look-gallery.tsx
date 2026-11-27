'use client';

import {useEffect,useRef,useState} from 'react';
import {Aperture,Check,Columns2,Image as ImageIcon,RotateCcw} from 'lucide-react';
import type {Recipe} from './film';
import {canvasOf,grade} from './pixels';
import {defaults} from './film';
import manifest from './luts/look-examples.json';
import {measureTone,toneCategories,type ToneId,type ToneMeasurement} from './luts/tones';

export type LookExample={title:string;scene:string;note:string;strength:number;study?:string;originalFile?:string};
const examples:Record<string,LookExample>=manifest;
export function lookExample(id:string){return examples[id];}
export function exampleAsset(id:string,variant:'original'|'graded'|'thumb'|'original-thumb'){
 return '/look-examples/'+id+'/'+(variant==='original'?examples[id]?.originalFile??'original.webp':variant+'.webp');
}

export function LookGallery({looks,selected,onOpen,tones}:{
 looks:Recipe[]; selected:string; onOpen:(look:Recipe)=>void; tones?:Readonly<Record<string,ToneId>>;
}){
 return <div className="library-grid sample-library-grid">{looks.map((look,index)=>{
  const sample=lookExample(look.id);
  const tone=tones?.[look.id];
  return <button key={look.id} type="button" className={'filter-card '+(selected===look.id?'active':'')}
   onClick={()=>onOpen(look)} aria-label={look.name+' · '+sample.title+'，查看样片'}>
   <div className="thumb example-pair-preview">
    <img src={exampleAsset(look.id,'original-thumb')} alt="" loading={index<4?'eager':'lazy'} width={480} height={320} decoding="async"/>
    <img className="preview-graded" src={exampleAsset(look.id,'thumb')} alt="" loading={index<4?'eager':'lazy'} width={480} height={320} decoding="async"/>
    <span className="preview-divider" aria-hidden="true"/>
    <span className="preview-legend" aria-hidden="true"><span>原图</span><span>LUT {sample.strength}%</span></span>
    <span className="example-scene">{tone?toneCategories[tone].name:sample.scene}</span>{selected===look.id&&<span className="checked"><Check size={12} strokeWidth={3}/></span>}</div>
   <div className="filter-caption"><span className="example-look-name"><b>{look.name}</b><em>{look.en}</em></span><span className="example-photo-title">{sample.title}</span></div>
  </button>;
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

export function LookStudy({look,canApply,onApply,onUseExample,tone}:{
 look:Recipe;canApply:boolean;onApply:(strength:number)=>void;onUseExample:(strength:number)=>void;tone?:ToneId;
}){
 const sample=lookExample(look.id);
 const [display,setDisplay]=useState<'compare'|'original'|'graded'|'both'>('compare');
 const [strength,setStrength]=useState(sample.strength);
 const [split,setSplit]=useState(50);
 const [source,setSource]=useState<HTMLCanvasElement|null>(null);
 const [originalTone,setOriginalTone]=useState<ToneMeasurement|null>(null);
 const [gradedTone,setGradedTone]=useState<ToneMeasurement|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const image=new Image();let live=true;
  image.onload=()=>{
   if(!live)return;
   const loaded=canvasOf(image,image.naturalWidth,image.naturalHeight,1536);
   setSource(loaded);
   if(tone)setOriginalTone(readTone(loaded));
  };
  image.src=exampleAsset(look.id,'original');
  return()=>{live=false;image.onload=null;};
 },[look.id,tone]);
 useEffect(()=>{
  if(!source)return;
  const frame=requestAnimationFrame(()=>{
   if(!canvas.current)return;
   grade(source,canvas.current,look,{...defaults,strength});
   if(tone)setGradedTone(readTone(canvas.current));
  });
  return()=>cancelAnimationFrame(frame);
 },[look,source,strength,tone]);
 return <div className="look-study">
  <p className="example-description">{look.description}</p>
  {tone&&<p className="tone-study-note"><strong>{toneCategories[tone].name}</strong> {toneCategories[tone].lead}</p>}
  <div className="example-study-tools"><div className="inspiration-controls segmented" aria-label="样片对比方式">
    <button type="button" aria-pressed={display==='compare'} onClick={()=>setDisplay('compare')}>拖动对比</button>
    <button type="button" aria-pressed={display==='graded'} onClick={()=>setDisplay('graded')}>应用后</button>
    <button type="button" aria-pressed={display==='original'} onClick={()=>setDisplay('original')}>原图</button>
    <button type="button" aria-pressed={display==='both'} onClick={()=>setDisplay('both')}><Columns2 size={16}/>并排</button>
   </div><span>{sample.scene} · {sample.title}</span></div>
  <div className={'example-study-photos'+(display==='both'?' both':'')}>
   {display==='both'&&<figure><img src={exampleAsset(look.id,'original')} alt={sample.title+' · 演示原图'} /><figcaption>演示原图</figcaption></figure>}
   <figure className="study-comparison-frame"><div className="study-media">
    <img src={exampleAsset(look.id,'original')} alt={sample.title+' · 原图'} />
    <canvas ref={canvas} role="img" aria-label={sample.title+' · 当前强度 '+strength+'% 的 LUT 应用图'}
      style={{clipPath:display==='compare'?'inset(0 0 0 '+split+'%)':display==='original'?'inset(0 0 0 100%)':undefined}}/>
    {display==='compare'&&<><div className="study-split-line" style={{left:split+'%'}} aria-hidden="true"><span>↔</span></div>
      <input className="study-wipe" type="range" min="0" max="100" value={split} aria-label="拖动对比原图与滤镜" onChange={e=>setSplit(+e.target.value)}/>
      <div className="study-end-labels"><b>原图</b><b>LUT · {strength}%</b></div></>}
   </div><figcaption>{display==='original'?'演示原图':display==='graded'?'当前 LUT 效果':display==='both'?'当前 LUT 效果':'左右拖动，比较同一位置'}</figcaption></figure>
  </div>
  <div className="study-intensity"><label htmlFor="look-strength">滤镜强度 <strong>{strength}%</strong></label>
   <input id="look-strength" type="range" min="0" max="100" value={strength} aria-label="样片强度" aria-valuetext={strength+'%'}
     onChange={e=>setStrength(+e.target.value)} style={{'--progress':strength+'%'} as React.CSSProperties}/>
   <button type="button" onClick={()=>setStrength(sample.strength)} disabled={strength===sample.strength}><RotateCcw size={14}/>推荐强度 {sample.strength}%</button></div>
  <p className="example-observation"><strong>看点</strong><span>{sample.note}</span></p>
  {tone&&originalTone&&gradedTone&&<ToneHistogram original={originalTone} graded={gradedTone}/>}
  <div className="example-study-actions"><button className="primary" type="button" onClick={()=>onUseExample(strength)}><Aperture size={17}/>用样片试滤镜</button>
   {canApply&&<button className="secondary" type="button" onClick={()=>onApply(strength)}><ImageIcon size={17}/>应用到当前照片</button>}</div>
 </div>;
}
