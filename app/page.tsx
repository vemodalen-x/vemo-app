'use client';
import {useState,useEffect,useRef,useCallback,useMemo,type ChangeEvent,type ReactNode} from 'react';
import {Aperture,PanelsTopLeft,Layers3,CircleHelp,Upload,Maximize,Minimize,Columns2,SlidersHorizontal,Check,Sparkles,Download,RotateCcw,Activity,X,ChevronsLeftRight,Film,Camera,ImagePlus,FolderOpen,Focus,Scan,ChevronRight} from 'lucide-react';
import {Gallery} from './gallery';
import {exampleAsset,lookExample,LookGallery,LookStudy,type LookExample} from './look-gallery';
import {lookDescription} from './luts/look-copy';
import {realExamples} from './luts/examples';
import {CameraPreview,type CameraLook} from './camera-preview';
import {authoredLooks,baseRecipes,socialRecipes,recipes,defaults,editingPrompt,type Recipe,type Adjust} from './film';
import {canvasOf,currentCube,grade,inspect} from './pixels';
import {loadLookBank} from './luts/bank';
import {fallbackOptions,readRecommendationPixels,type Recommendation} from './luts/recommend';
import {resolveRecommendations,type RecommendationRequest} from './luts/resolve-recommendations';
import type {InspirationMatch,InspirationBoard} from './luts/inspiration';
import {checkPhotoFile,photoFileTypes,readImage} from './photo-file';
import defaultInspiration from './luts/inspiration-defaults.json';
import {listBoards} from './luts/inspiration-store';
import {InspirationLibrary} from './inspiration-library';
import {RecommendationNotes} from './luts/recommendation-notes';
import {sampleToneIndex,ToneLibrary,type ToneSelection} from './tone-library';
import {isToneId} from './luts/tones';
import {defaultGenerationPreset,generationPresets,generationSize,maxGenerationInputBytes,type GenerationPreset} from './generation-settings';
type DemoSelection={look:Recipe;sample:LookExample};
type Photo={canvas:HTMLCanvasElement;small:HTMLCanvasElement;file:string;width:number;height:number;sample:boolean;sourceOnly:boolean;demo?:DemoSelection};
type Dialog='help'|'generation'|'inspiration'|'look-study'|'camera'|null;
type Pair='original-lut'|'original-ai'|'lut-ai';
type ReferencePhoto={canvas:HTMLCanvasElement;thumbnail:string;name:string};
type AIResult={url:string;width:number;height:number;requestedSize?:string;modelLabel?:string};
const familyFilters = [
  {id:'all',name:'全部收录'},
  {id:'real',name:'实拍样片'},
  {id:'social',name:'社媒灵感'},
  {id:'professional',name:'专业影调'},
  ...authoredLooks.filter(look=>look.featured).map(look=>({id:look.family!,name:look.familyName!})),
  {id:'control',name:'校准'},
  {id:'classic',name:'基础滤镜'},
];
const picture='alpine-source.jpg';
const featuredExamples=['neon-diary','cream-editorial','noon-in-color','mono'];
function saveBlob(blob:Blob,name:string){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
function jpeg(src:HTMLCanvasElement,quality=.94){return new Promise<Blob>((ok,fail)=>src.toBlob(blob=>blob?ok(blob):fail(Error('图像导出失败。')),'image/jpeg',quality));}
async function generationJpeg(canvas:HTMLCanvasElement){
 const blob=await jpeg(canvas,.93);
 return blob.size<=maxGenerationInputBytes?blob:jpeg(canvas,.84);
}
function Modal({name,close,children,wide=false}:{name:string;close:()=>void;children:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current;el?.showModal();return()=>el?.close()},[]);
 return <dialog ref={ref} className={wide?"wide-modal":undefined} aria-label={name} onCancel={close} onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)close();}}}><div className="modal-head"><h2>{name}</h2><button className="icon-btn" onClick={close} aria-label="关闭"><X/></button></div>{children}</dialog>;
}
function Slider({label,value,min,max,step=1,formatted,change}:{label:string;value:number;min:number;max:number;step?:number;formatted:string;change:(value:number)=>void}){
 return <label className="slider"><span>{label}<output>{formatted}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>change(+e.target.value)} style={{'--progress':(value-min)/(max-min)*100+'%'} as React.CSSProperties}/></label>;
}
export default function Studio(){
 const [tab,setTab]=useState<'studio'|'library'|'samples'>('studio'),[photo,setPhoto]=useState<Photo|null>(null),[baseUrl,setBaseUrl]=useState('/'+picture),[recipe,setRecipe]=useState<Recipe>(baseRecipes[0]),[ranked,setRanked]=useState<{options:Recommendation[];close:boolean}>({options:fallbackOptions,close:false});
 const [bankReady,setBankReady]=useState<boolean|null>(null);
 const [ranking,setRanking]=useState(false);
 const [lookupReady,setLookupReady]=useState(false);
 const [reference,setReference]=useState<ReferencePhoto|null>(null),[readingReference,setReadingReference]=useState(false);
 const [personal,setPersonal]=useState<InspirationBoard[]|null>(null);
 const [mode,setMode]=useState<'auto'|'source'>('auto'),[pinned,setPinned]=useState<string|null>(null);
 const [match,setMatch]=useState<InspirationMatch|null>(null),[adaptive,setAdaptive]=useState(false);
 const [pair,setPair]=useState<Pair>('original-lut');
 const [recommendationThumbs,setRecommendationThumbs]=useState<Record<string,string>>({});
 const [libraryFamily,setLibraryFamily]=useState('all');
 const [libraryTone,setLibraryTone]=useState<ToneSelection|null>(null);
 const [studyLook,setStudyLook]=useState<Recipe|null>(null);
 const [studyFullscreen,setStudyFullscreen]=useState(false);
 const [studySample,setStudySample]=useState<LookExample|null>(null);
 const [studioOpened,setStudioOpened]=useState(false);
 const manualLook=useRef(false);
 const initialStudioLoad=useRef(false);
 const initialDemo=useRef<DemoSelection|undefined>(undefined);
 const referenceInput=useRef<HTMLInputElement>(null),referenceRevision=useRef(0);
 const [analysis,setAnalysis]=useState<ReturnType<typeof inspect>|null>(null),[adj,setAdj]=useState<Adjust>(defaults),[compare,setCompare]=useState(false),[split,setSplit]=useState(50),[wide,setWide]=useState(false),[drag,setDrag]=useState(false);
 const [dialog,setDialog]=useState<Dialog>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState<boolean|null>(null),[output,setOutput]=useState<AIResult|null>(null),[notice,setNotice]=useState(''),[jobError,setJobError]=useState(''),[loading,setLoading]=useState(false);
 const [generationPreset,setGenerationPreset]=useState<GenerationPreset>(defaultGenerationPreset);
 const input=useRef<HTMLInputElement>(null),preview=useRef<HTMLCanvasElement>(null),stage=useRef<HTMLElement>(null),version=useRef(0),jobLock=useRef(false),gradeVersion=useRef(0),dragDepth=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const selected=recipe.id,preset=!!photo?.sample&&selected==='warm'&&adj.strength===75&&adj.temp===0&&adj.exposure===0;
 const comparisonLut=useMemo(()=>{
   if(!photo||dialog!=='generation')return '';
   const target=document.createElement('canvas');
   grade(photo.small,target,recipe,adj);
   return target.toDataURL('image/jpeg',.92);
 },[photo,dialog,recipe,adj]);
 const say=useCallback((message:string)=>{setNotice(message);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setNotice(''),4600);},[]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 const load=useCallback(async(file?:File,startOriginal=false,demo?:DemoSelection,cameraLook?:CameraLook)=>{
  const v=++version.current;gradeVersion.current++;setLoading(true);
  let url=demo?exampleAsset(demo.look.id,'original',demo.sample):'/'+picture;
  try{
   if(file){checkPhotoFile(file);url=URL.createObjectURL(file);}
   const img=await readImage(url);if(v!==version.current)return;
   const previewEdge=window.matchMedia('(max-width: 760px)').matches?840:1280;
   const canvas=canvasOf(img,img.naturalWidth,img.naturalHeight,3072);
   const small=canvasOf(canvas,canvas.width,canvas.height,previewEdge);
   const m=inspect(small);
   manualLook.current=!!cameraLook;
   if(cameraLook){setRecipe(cameraLook.recipe);setAdj(cameraLook.adjustment);}
   setBaseUrl(file?small.toDataURL('image/jpeg',.94):url);
   setPhoto({canvas,small,width:img.naturalWidth,height:img.naturalHeight,file:file?.name??(demo?demo.look.id+'.webp':'ALPINE_001.JPG'),sample:!file&&!demo,sourceOnly:startOriginal,demo});
   setAnalysis(m);setCompare(false);setSplit(50);setOutput(null);setJobError('');
   if(file||demo){
     setStudioOpened(true);
     setTab('studio');
     location.hash='studio';
     window.scrollTo(0,0);
   }

  }catch(e){if(v===version.current)say((e as Error).message);}
  finally{if(file&&url.startsWith('blob:'))URL.revokeObjectURL(url);if(v===version.current)setLoading(false);}
 },[say]);
 useEffect(()=>{
   const sync=()=>{
     const hash=location.hash;
     const pro=hash==='#library/pro'||hash.startsWith('#library/pro/');
     const real=hash==='#library/real';
     const next=hash.startsWith('#samples')?'samples':hash==='#library'||pro||real?'library':'studio';
     setTab(next);
     if(next==='studio')setStudioOpened(true);
     if(pro){
       const id=hash.slice('#library/pro/'.length);
       setLibraryTone(isToneId(id)?id:'overview');
     }else if(hash==='#library'||real){
       setLibraryTone(null);
       if(real)setLibraryFamily('real');
       else setLibraryFamily(value=>value==='real'?'all':value);
     }
   };
   sync();
   window.addEventListener('hashchange',sync);
   return()=>window.removeEventListener('hashchange',sync);
 },[]);
 const selectTone=(tone:ToneSelection|null)=>{
   setLibraryTone(tone);
   location.hash=tone===null?(libraryFamily==='real'?'library/real':'library'):tone==='overview'?'library/pro':'library/pro/'+tone;
 };
 const go=(target:'studio'|'library'|'samples')=>{
   if(target!==tab)window.scrollTo(0,0);
   if(target==='studio')setStudioOpened(true);
   setTab(target);
   if(target==='library')selectTone(libraryTone);
   else location.hash=target;
 };
 const tryScene=async(path:string,name:string)=>{try{const r=await fetch(path);if(!r.ok)throw Error();const blob=await r.blob();await load(new File([blob],name,{type:'image/jpeg'}),true);}catch{say('样片暂时无法读取，请重试。')}};
 useEffect(()=>{
   if(tab==='samples'||bankReady!==null)return;
   let active=true;
   loadLookBank().then(value=>{if(active)setBankReady(value)});
   return ()=>{active=false};
 },[tab,bankReady]);
 useEffect(()=>{
   if(!studioOpened)return;
   if(!initialStudioLoad.current){
     initialStudioLoad.current=true;
     if(!photo)void load();
   }
 },[studioOpened,load,photo]);
 useEffect(()=>{
   if(studioOpened)listBoards().then(setPersonal).catch(()=>setPersonal([]));
 },[studioOpened]);
 useEffect(()=>{
   if(dialog!=='generation'||ready!==null)return;
   let active=true;
   fetch('/api/status').then(async response=>{
     if(!response.ok)return false;
     const status=await response.json() as {ready?:boolean};
     return status.ready===true;
   })
     .then(value=>{if(active)setReady(value)}).catch(()=>{if(active)setReady(false)});
   return ()=>{active=false};
 },[dialog,ready]);
 useEffect(()=>{
   if(!photo || !studioOpened || bankReady===null || personal===null)return;
   const boards=pinned?[...personal,...defaultInspiration]:personal.length?personal:defaultInspiration;
   const request: RecommendationRequest = {
     source: readRecommendationPixels(photo.small),
     reference: reference ? readRecommendationPixels(reference.canvas) : null,
     boards: mode==='auto' ? boards : null,
     pinned,
   };
   let worker: Worker | undefined;
   let active=true;

   const apply = (result: ReturnType<typeof resolveRecommendations>) => {
     if(!active)return;
     const mini=canvasOf(photo.small,photo.small.width,photo.small.height,208);
     const target=document.createElement('canvas'), images:Record<string,string>={};
     for(const option of result.options){
       grade(mini,target,option.look,{...defaults,strength:option.strength});
       images[option.look.id]=target.toDataURL('image/jpeg',.87);
     }
     setMatch(result.match);setAdaptive(result.adaptive);
     setRanked(result);setRecommendationThumbs(images);setRanking(false);setLookupReady(true);
     const demo=photo.demo!==initialDemo.current?photo.demo:undefined;
     initialDemo.current=photo.demo;
     if(manualLook.current)return;
     const top=result.options[0];
     gradeVersion.current++;
     setRecipe(demo?.look??top.look);
     setAdj({...defaults,strength:demo?.sample.strength??(photo.sourceOnly&&!reference&&!pinned?0:top.strength)});
     setOutput(null);setJobError('');
   };

   setRanking(true);
   if(bankReady){
     try{
       worker=new Worker(new URL('./luts/recommendation.worker.ts',import.meta.url),{type:'module'});
       worker.onmessage=event=>{
         worker?.terminate();
         apply(event.data ?? resolveRecommendations(request,true));
       };
       worker.onerror=()=>{
         worker?.terminate();
         if(active)apply(resolveRecommendations(request,true));
       };
       worker.postMessage(request);
     }catch{
       worker?.terminate();
       apply(resolveRecommendations(request,true));
     }
   }else{
     apply(resolveRecommendations(request,false));
   }
   return ()=>{active=false;worker?.terminate()};
 },[photo,reference,bankReady,personal,mode,pinned,studioOpened]);
 useEffect(()=>{if(!photo||tab!=='studio')return;const frame=requestAnimationFrame(()=>{if(preview.current)grade(photo.small,preview.current,recipe,adj)});return()=>cancelAnimationFrame(frame)},[photo,recipe,adj,tab,wide]);
 useEffect(()=>{if(!wide)return;const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setWide(false)};window.addEventListener('keydown',handler);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{window.removeEventListener('keydown',handler);document.body.style.overflow=old}},[wide]);
 const change=(patch:Partial<Adjust>)=>{manualLook.current=true;gradeVersion.current++;setAdj(a=>({...a,...patch}));setOutput(null);setJobError('');};
 const pick=(r:Recipe,strength=defaults.strength)=>{
   manualLook.current=true;gradeVersion.current++;
   setRecipe(r);setAdj({...defaults,strength});setOutput(null);setJobError('');
   go('studio');
   if(window.matchMedia('(max-width: 800px)').matches)window.scrollTo(0,0);
 };
 const exportPhoto=async()=>{if(!photo)return;try{const c=document.createElement('canvas');grade(photo.canvas,c,recipe,adj);saveBlob(await jpeg(c),'Luma-'+photo.file.replace(/\.[^.]+$/,'')+'-'+recipe.en.replaceAll(' ','-')+'.jpg');say('滤镜照片已导出');}catch{say('导出失败，请重试。')}};
 const inputChanged=(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];e.target.value='';if(f)load(f);};
 const changeReference=async (event:ChangeEvent<HTMLInputElement>)=>{
   const file=event.target.files?.[0];
   event.target.value='';
   if(!file)return;
   const revision=++referenceRevision.current;
   setReadingReference(true);
   let url='';
   try{
     checkPhotoFile(file);
     url=URL.createObjectURL(file);
     const image=await readImage(url);
     if(revision!==referenceRevision.current)return;
     const canvas=canvasOf(image,image.naturalWidth,image.naturalHeight,320);
     manualLook.current=false;
     setReference({canvas,thumbnail:canvas.toDataURL('image/jpeg',.82),name:file.name});
   }catch(error){if(revision===referenceRevision.current)say((error as Error).message);}
   finally{
     if(url)URL.revokeObjectURL(url);
     if(revision===referenceRevision.current)setReadingReference(false);
   }
 };
 const removeReference=()=>{
   referenceRevision.current++;
   setReadingReference(false);
   setReference(null);
 };
 const exportLook=()=>{
   const text=currentCube(recipe,adj);
   saveBlob(new Blob([text],{type:'text/plain;charset=utf-8'}),recipe.name+'-'+adj.strength+'.cube');
   say('已导出 33³ sRGB LUT');
 };
 const visibleLibrary=(bankReady?recipes:[...socialRecipes,...baseRecipes]).filter(look=>{
   if(libraryFamily==='all')return true;
   if(libraryFamily==='real')return Object.hasOwn(realExamples,look.id);
   if(libraryFamily==='social')return look.collection==='social';
   if(libraryFamily==='professional')return look.collection==='professional';
   if(libraryFamily==='classic')return look.lutIndex===undefined&&!look.collection;
   return look.family===libraryFamily;
 });
 if(libraryFamily==='all'){
   const order=(look:Recipe)=>{const rank=featuredExamples.indexOf(look.id);return rank===-1?featuredExamples.length:rank};
   visibleLibrary.sort((a,b)=>order(a)-order(b));
 }
 const showStudy=(look:Recipe,fullscreen=false,sample=lookExample(look.id))=>{
   setStudyLook(look);setStudySample(sample);setStudyFullscreen(fullscreen);setDialog('look-study');
 };
 const useExample=(look:Recipe,example:LookExample,strength:number)=>{
   const sample={...example,strength};
   setDialog(null);
   void load(undefined,false,{look,sample});
 };
 const chooseBoard=(id:string)=>{
   manualLook.current=false;
   removeReference();
   setPinned(id);setMode('auto');setDialog(null);go('studio');
 };
 const automatic=()=>{
   manualLook.current=false;
   removeReference();
   setPinned(null);setMode('auto');
 };
 const sourceOnly=()=>{
   manualLook.current=false;
   removeReference();
   setPinned(null);setMode('source');
 };
 const openAI=()=>{if(ready===false)setReady(null);setJobError('');setPair(output?'lut-ai':'original-lut');setDialog('generation');};
 const generate=async()=>{
  if(!photo||!ready||jobLock.current)return;
  jobLock.current=true;setBusy(true);setJobError('');
  const rev=gradeVersion.current;
  const settings=generationPresets[generationPreset];
  try{
    const src=canvasOf(photo.canvas,photo.canvas.width,photo.canvas.height,settings.inputEdge);
    const reference=document.createElement('canvas');
    grade(src,reference,recipe,adj);
    const [originalJpeg,referenceJpeg]=await Promise.all([generationJpeg(src),generationJpeg(reference)]);
    if(rev!==gradeVersion.current)return;
    const body=new FormData();
    body.append('original',originalJpeg,'original.jpg');body.append('reference',referenceJpeg,'reference.jpg');
    body.append('recipe',recipe.id);body.append('adjust',JSON.stringify(adj));body.append('preset',generationPreset);
    body.append('width',String(photo.width));body.append('height',String(photo.height));
    const resp=await fetch('/api/generate',{method:'POST',body});
    const obj=await resp.json().catch(()=>null) as {image?:string;requestedSize?:string;error?:string}|null;
    if(!resp.ok||!obj?.image)throw Error(obj?.error||'生成连接中断，请检查网络后重试。');
    const image=await readImage(obj.image);
    if(rev===gradeVersion.current){
      setOutput({url:obj.image,width:image.naturalWidth,height:image.naturalHeight,requestedSize:obj.requestedSize,modelLabel:settings.modelLabel});
      setPair('lut-ai');
    }else say('影调已更改，请按当前设置重新生成。');
  }catch(e){
    if(rev===gradeVersion.current)setJobError(e instanceof TypeError?'生成连接中断，请检查网络后重试。':(e as Error).message||'生成失败，请重试。');
  }finally{setBusy(false);jobLock.current=false;}
 };
 const showAISample=async()=>{
   const rev=gradeVersion.current;
   try{
     const url='/alpine-edited.jpg';
     const image=await readImage(url);
     if(rev!==gradeVersion.current||jobLock.current)return;
     setOutput({url,width:image.naturalWidth,height:image.naturalHeight});setPair('lut-ai');
   }catch{say('样片加载失败，请重试。');}
 };
 const actualSize=output&&`${output.width} × ${output.height}`;
 const resizedOutput=output?.requestedSize&&output.requestedSize!==`${output.width}x${output.height}`;
 const plannedSize=photo?generationSize(photo.width,photo.height,generationPreset).replace('x',' × '):'';
 const label=photo?.demo?.sample.title??(photo?.sample!==false?'Alpine Reverie':photo.file.replace(/\.[^.]+$/,''));
 const filterCard=(option:Recommendation,idx:number)=>{
   const r=option.look;
   return <button key={r.id} className={'filter-card '+(selected===r.id?'active':'')} aria-pressed={selected===r.id}
     onClick={()=>pick(r,option.strength)} title={r.source?[r.source,...(r.aliases??[])].join(' · '):undefined}>
     <div className="thumb">
       <img src={recommendationThumbs[r.id]||'/'+picture} alt="" loading="eager"/>
       {selected===r.id&&<span className="checked"><Check size={12} strokeWidth={3}/></span>}
       {idx===0&&<span className="best"><Sparkles size={11}/>首选</span>}
     </div>
     <div className="filter-caption">
       <b>{r.name}</b><em>{r.en}</em>
       <small className="look-family-caption">{option.detail} · {option.strength}%</small>
     </div>
   </button>;
 };
 const compareBtn=<button className={'compare-btn '+(compare?'on':'')} aria-pressed={compare} onClick={()=>setCompare(!compare)}><Columns2 size={15}/>前后对比</button>;
 return <>
  <header className="top"><div className="top-inner"><a className="brand" href="#studio" onClick={()=>go('studio')} aria-label="Luma Studio 工作台"><img src="/favicon.svg" alt=""/><strong>Luma<span>Studio</span></strong></a>
  <nav aria-label="主导航"><button aria-current={tab==='studio'?'page':undefined} className={tab==='studio'?'nav-active':''} onClick={()=>go('studio')}><PanelsTopLeft/>工作台</button><button aria-current={tab==='library'?'page':undefined} className={tab==='library'?'nav-active':''} onClick={()=>go('library')}><Layers3/>滤镜库</button><button aria-current={tab==='samples'?'page':undefined} className={tab==='samples'?'nav-active':''} onClick={()=>go('samples')}><Film/>场景样片</button><a href="/studies"><Columns2/>风格对照</a></nav><button className="help" aria-label="使用指南" onClick={()=>setDialog('help')}><CircleHelp size={17}/><span>使用指南</span></button></div></header>
  <main id="studio" className={tab==='library'?'look-library-page':undefined}><div className="page-heading"><div><h1>{tab==='studio'?'影调工作台':tab==='samples'?'场景样片':'滤镜库'}<em>{tab==='studio'?'Film Lab':tab==='samples'?'Field Notes':'Film Library'}</em></h1><p>{tab==='studio'?'根据画面的光线与色彩，找到适合这张照片的影调。':tab==='samples'?'八张 AI 创作样片。打开照片，观察光线、颜色与影调配方。':'同一张照片，左边是原图，右边是调色后。点开可全屏比较。'}</p></div>{tab==='samples'?<a className="upload" href="/samples/Luma_Scene_Studies.zip" download><Download size={17}/>下载整套样片</a>:<div className="page-photo-actions"><button className="upload" onClick={()=>input.current?.click()} disabled={loading}><Upload size={17}/>{loading?'读取中…':'上传照片'}</button>{tab==='studio'&&<button className="secondary open-camera" onClick={()=>setDialog('camera')} disabled={loading}><Camera size={17}/>相机取景</button>}</div>}<input ref={input} hidden type="file" accept={photoFileTypes} onChange={inputChanged}/></div>
  {tab==='studio'?<div className="workspace">
  <section ref={stage} className={'viewer '+(wide?'expanded ':'')+(drag?'dragging':'')} aria-label="照片预览" onDragOver={e=>e.preventDefault()} onDragEnter={e=>{e.preventDefault();dragDepth.current++;setDrag(true)}} onDragLeave={()=>{if(--dragDepth.current<=0)setDrag(false)}} onDrop={e=>{e.preventDefault();dragDepth.current=0;setDrag(false);const f=e.dataTransfer.files[0];if(f)load(f)}}>
  <div className="photo-stage" style={photo?{'--photo-ratio':photo.width/photo.height} as React.CSSProperties:undefined}><img className="original-photo" src={baseUrl} alt={photo?.demo?.sample.title??(photo?.sample===false?'上传的原始照片':'金色晨光照亮山峰，山下的针叶林倒映在湖面上')}/><canvas ref={preview} className="graded-photo" aria-label="当前影调预览" style={{clipPath:compare?'inset(0 0 0 '+split+'%)':undefined,opacity:photo?1:0}}/>
  <div className="frame-shade"/><div className="viewer-label"><span className="status-dot"/>{compare?'前后对比':'影调预览'}</div><button className="expand-btn" aria-label={wide?'退出大图':'放大预览'} onClick={()=>setWide(!wide)}>{wide?<Minimize/>:<Maximize/>}</button>
  {compare?<><div className="split-line" style={{left:split+'%'}}><i><ChevronsLeftRight size={17}/></i></div><input className="wipe" type="range" min="0" max="100" value={split} aria-label="拖动对比原图与滤镜" onChange={e=>setSplit(+e.target.value)}/><div className="compare-labels"><b>原图</b><b>{recipe.name}</b></div></>:<div className="photo-caption"><div><i/>{photo?.demo?'滤镜样片':photo?.sample===false?'当前照片':'演示样片'}</div><strong>{label}</strong></div>}
  {drag&&<div className="drop-cover"><Upload/>松开以导入照片</div>}</div>
  <div className="viewer-shortcuts"><a href="#adjustments" onClick={e=>{e.preventDefault();document.getElementById('adjustments')?.scrollIntoView({block:'start'})}}><SlidersHorizontal size={16}/>调色</a><a href="#recommended-looks" onClick={e=>{e.preventDefault();document.getElementById('recommended-looks')?.scrollIntoView({block:'start'})}}><Layers3 size={16}/>推荐滤镜</a></div>
  <div className="viewer-foot"><div className="file-meta"><Focus size={17}/><span>{photo?.file||'ALPINE_001.JPG'}</span><i/> <span>{photo?.width||1536} × {photo?.height||820}</span></div>{compareBtn}</div></section>
  <aside className="panel" id="adjustments"><div className="panel-head"><h2><SlidersHorizontal size={19}/>调色面板</h2><button className="icon-btn" title="重置调节" aria-label="重置调节" onClick={()=>{change(defaults);say('已恢复当前配方的默认参数')}}><RotateCcw size={16}/></button></div>
  <div className="panel-content"><div className="recipe-box"><div className="recipe-label"><Film size={14}/>{recipe.familyName??"当前影调"}</div><h3>{recipe.name}</h3><em>{recipe.en}</em><div className="film-mark" aria-hidden="true"><Aperture strokeWidth={.9}/></div></div>
  <div className="sliders"><Slider label="滤镜强度" value={adj.strength} min={0} max={100} formatted={adj.strength+'%'} change={v=>change({strength:v})}/><Slider label="曝光补偿" value={adj.exposure} min={-1} max={1} step={.1} formatted={(adj.exposure>0?'+':'')+adj.exposure.toFixed(1)+' EV'} change={v=>change({exposure:v})}/><Slider label="色温偏移" value={adj.temp} min={-100} max={100} formatted={(adj.temp>0?'+':'')+adj.temp} change={v=>change({temp:v})}/></div>
  <p className="recipe-description">{lookDescription(recipe)}{lookExample(recipe.id)&&<button className="recipe-example-link" onClick={()=>showStudy(recipe)}>查看配套样片</button>}</p>
  <div className="analysis"><div className="analysis-title"><h3><Activity size={16}/>画面分析</h3><span>RGB</span></div><svg className="histogram" aria-label="原图的红绿蓝亮度直方图" viewBox="0 0 252 64" preserveAspectRatio="none"><g stroke="#393b36" strokeWidth=".6">{[42,84,126,168,210].map(x=><path key={x} d={'M'+x+' 0V64'}/>)}{[21,42,63].map(y=><path key={y} d={'M0 '+y+'H252'}/>)}</g>{analysis?.curves.map((d,i)=><path key={i} d={d} fill={['#db9258','#72a78c','#769ba9'][i]} fillOpacity=".27" stroke={['#d6a074','#76a48c','#7f9da8'][i]} strokeOpacity=".85" strokeWidth="1.1"/>)}</svg>
  <div className="analysis-info"><div className="tags">{analysis?.tags.slice(0,2).map(t=><span key={t}>{t}</span>)}</div><div className="swatches" aria-label="主要色彩">{analysis?.palette.map(c=><i key={c} style={{background:c}} title={c}/>)}</div></div></div>
  <div className="actions"><button className="primary" onClick={openAI} disabled={!photo}><Sparkles size={17}/>对比 LUT / AI</button><button className="secondary" onClick={exportPhoto} disabled={!photo}><Download size={16}/>导出滤镜照片</button>{photo&&<button className="secondary" onClick={exportLook}><Download size={16}/>下载当前 33³ LUT</button>}</div></div></aside>
  <section className="rec-section" id="recommended-looks" aria-labelledby="recommendation-title">
    <div className="section-title"><h2 id="recommendation-title"><Layers3 size={19}/>推荐滤镜</h2>
      <button className="text-btn" onClick={()=>go('library')}>全部滤镜<ChevronRight size={15}/></button></div>
    <div className="inspiration-entry">
      <div className="inspiration-entry-head">
        <div className="inspiration-identity"><FolderOpen size={20}/><div>
          <strong>{reference?'单图追色':pinned?'指定灵感组':mode==='source'?'按原图推荐':'灵感库追色'}</strong>
          <p>{reference?reference.name:match?match.board.name:adaptive?'未找到合适参考，已生成新影调':mode==='source'?'从原图光线和颜色推荐':'自动检索和当前照片相近的参考'}</p>
        </div></div>
        <button type="button" className="reference-upload" onClick={()=>setDialog('inspiration')}><FolderOpen size={16}/>灵感库</button>
      </div>
      <div className="inspiration-controls" aria-label="推荐方式">
        <button type="button" aria-pressed={mode==='auto'&&!reference&&!pinned} onClick={automatic}>自动追色</button>
        <button type="button" aria-pressed={mode==='source'&&!reference} onClick={sourceOnly}>按原图</button>
        <button type="button" aria-pressed={!!reference} disabled={!bankReady||readingReference} onClick={()=>referenceInput.current?.click()}><ImagePlus size={15}/>{readingReference?'读取中…':reference?'更换单图':'添加单图'}</button>
        {(reference||pinned)&&<button type="button" onClick={automatic}>返回自动</button>}
        <input ref={referenceInput} hidden type="file" accept={photoFileTypes} onChange={changeReference}/>
      </div>
      {(reference||match)&&<div className="inspiration-evidence" aria-live="polite">
        <div className="inspiration-evidence-photos">
          {reference?<img src={reference.thumbnail} alt="单图参考"/>:match?.photos.map(photo=><img key={photo.id} src={photo.thumbnail} alt={photo.name} title={photo.name}/>)}
        </div>
        <div><strong>{reference?'当前参考':match?.board.scene?'默认灵感':'我的灵感'}</strong>
          <p>{reference?'依据参考图色彩重排':match?.photos.map(photo=>match.board.scene?photo.name:photo.name.replace(/\.[^.]+$/,'')).join(' · ')}</p>
        </div>
        {!reference&&match?.board.sourceUrl&&<a href={match.board.sourceUrl} target="_blank" rel="noreferrer">来源</a>}
      </div>}
    </div>
    {bankReady===false&&<p className="ranking-note" role="status">LUT 库暂未加载，当前显示基础滤镜。</p>}
    {ranked.close&&bankReady&&<p className="ranking-note" role="status">前两个滤镜的得分接近，可以点选比较效果。</p>}
    {ranking&&<p className="ranking-note" role="status">正在分析照片并匹配滤镜…</p>}
    <div className="filter-grid" aria-busy={ranking}>{lookupReady&&ranked.options.map(filterCard)}</div>
    <RecommendationNotes/>
  </section></div>:tab==='samples'?<Gallery onTry={tryScene}/>:<section aria-label="滤镜库">
    <div className="library-mode-row">
      <div className="inspiration-controls segmented" aria-label="滤镜库模式">
        <button type="button" aria-pressed={libraryTone===null} onClick={()=>selectTone(null)}>按风格</button>
        <button type="button" aria-pressed={libraryTone!==null} onClick={()=>selectTone('overview')}><SlidersHorizontal size={15}/>专业模式</button>
      </div>
    </div>
    {libraryTone!==null ? (
      bankReady===null ? <p className="tone-load-status" role="status">正在载入滤镜库…</p>
        : bankReady===false ? <p className="tone-load-status" role="status">滤镜数据暂未载入。请刷新页面，或切换至按风格浏览基础滤镜。</p>
        : <ToneLibrary looks={recipes} selection={libraryTone} selected={selected} onSelect={selectTone} onOpen={showStudy}/>
    ) : <>
    <div className="look-toolbar" aria-label="按风格筛选">
      {(bankReady?familyFilters:familyFilters.filter(group=>['all','real','classic','social'].includes(group.id))).map(group=>
        <button key={group.id} type="button" aria-pressed={libraryFamily===group.id} onClick={()=>{
          setLibraryFamily(group.id);
          if(group.id==='real')location.hash='library/real';
          else if(location.hash==='#library/real')location.hash='library';
        }}>{group.name}</button>
      )}
      <span>{visibleLibrary.length} 款</span>
    </div>
    <LookGallery looks={visibleLibrary} selected={selected} onOpen={showStudy} samples={libraryFamily==='real'?realExamples:undefined}/>
    </>}
  </section>}
  </main>
  {dialog==='help'&&<Modal name="使用指南" close={()=>setDialog(null)}><div className="guide"><h3><Upload/>导入照片</h3><p>点击「上传照片」，或将一张 JPG、PNG、WebP 照片拖到预览区。单张上限 25 MB。HEIC 能否导入取决于浏览器，无法打开时请转为 JPG。</p><h3><SlidersHorizontal/>确定影调</h3><p>自动追色先查找个人灵感组，空库时使用默认样片。找不到合适参考时会根据原图生成新配方。也可以上传单张参考图，或切换为按原图推荐。</p><h3><Sparkles/>生成或导出</h3><p>本地滤镜可直接导出 JPG，最长边为 3072 像素。AI 光影会保留画面构图，按选定影调调整光线。确认生成后会把原图和 LUT 应用图发送至 Pikso。</p></div><button className="primary" onClick={()=>setDialog(null)}>返回工作台</button></Modal>}
  {dialog==='camera'&&<Modal name="相机取景" close={()=>setDialog(null)} wide>
    <CameraPreview initial={{recipe,adjustment:adj}} choices={bankReady?recipes:[...baseRecipes,...socialRecipes]}
      onCapture={(file,look)=>{setDialog(null);void load(file,false,undefined,look);}}/>
  </Modal>}
  {dialog==='look-study'&&studyLook&&studySample&&<LookStudy key={studyLook.id} look={studyLook} sample={studySample} canApply={!!photo} close={()=>setDialog(null)} startFullscreen={studyFullscreen}
      tone={tab==='library'&&libraryTone!==null?sampleToneIndex[studyLook.id]:undefined}
      onApply={strength=>{pick(studyLook,strength);setDialog(null);}}
      onUseExample={strength=>useExample(studyLook,studySample,strength)}/>}
  {dialog==='inspiration'&&<Modal name="灵感库" close={()=>setDialog(null)} wide>
    <InspirationLibrary personal={personal??[]} defaults={defaultInspiration}
      onSave={board=>{setPersonal(previous=>[...(previous??[]).filter(item=>item.id!==board.id),board]);automatic();}}
      onDelete={id=>{setPersonal(previous=>(previous??[]).filter(item=>item.id!==id));if(pinned===id)setPinned(null);}}
      onSelect={chooseBoard}/>
  </Modal>}
  {dialog==='generation'&&<Modal name="LUT 与 AI 成片" close={()=>setDialog(null)} wide><div className="generation">
    <p className="modal-sub">{recipe.name} · {adj.strength}% · {photo?.file}</p>
    <div className="inspiration-controls" aria-label="对比方式">
      <button type="button" aria-pressed={pair==='original-lut'} onClick={()=>setPair('original-lut')}>原图 / LUT</button>
      <button type="button" aria-pressed={pair==='original-ai'} disabled={!output} onClick={()=>setPair('original-ai')}>原图 / AI</button>
      <button type="button" aria-pressed={pair==='lut-ai'} disabled={!output} onClick={()=>setPair('lut-ai')}>LUT / AI</button>
    </div>
    <div className="generation-pair">
      {pair!=='lut-ai'&&<figure><img src={baseUrl} alt="原图"/><figcaption>原图</figcaption></figure>}
      {pair!=='original-ai'&&<figure><img src={comparisonLut} alt="LUT 应用图"/><figcaption>LUT 应用图</figcaption></figure>}
      {pair!=='original-lut'&&output&&<figure><img src={output.url} alt="AI 成片"/><figcaption>{output.modelLabel?'请求 '+output.modelLabel:'AI 样片'} · {actualSize} px</figcaption></figure>}
    </div>
    <div className="dual"><button className="secondary" onClick={exportPhoto}><Download size={16}/>下载 LUT 应用图</button>
      <button className="secondary" onClick={exportLook}><Download size={16}/>下载 33³ LUT</button>
      {output&&<button className="secondary" onClick={async()=>{try{const r=await fetch(output.url);if(!r.ok)throw Error();const image=await r.blob();const extension=image.type==='image/png'?'png':image.type==='image/webp'?'webp':'jpg';saveBlob(image,'Luma-AI-'+recipe.id+'-'+output.width+'x'+output.height+'.'+extension);say('AI 成片已导出')}catch{say('下载失败，请重试。')}}}><Download size={16}/>下载 AI 成片</button>}
    </div>
    {resizedOutput&&<p className="service-info">Pikso 返回 {actualSize} px，目标尺寸为 {output.requestedSize?.replace('x',' × ')} px。</p>}
    {!output&&preset&&<button className="text-btn" disabled={busy} onClick={showAISample}>查看这套配方的 AI 样片</button>}
    {ready===null?<p role="status">正在检查 AI 生成服务…</p>:ready?<>
      <fieldset className="generation-quality" disabled={busy}>
        <legend>AI 成片规格</legend>
        <div className="generation-options">
          {(Object.keys(generationPresets) as GenerationPreset[]).map(id=>{
            const option=generationPresets[id];
            return <label key={id} className="generation-option">
              <input type="radio" name="generation-preset" value={id} checked={generationPreset===id} onChange={()=>{setGenerationPreset(id);setJobError('');}}/>
              <span><strong>{option.label}</strong><small>{option.modelLabel}</small></span>
            </label>;
          })}
        </div>
        <p className="generation-dimensions">目标尺寸 {plannedSize} px，实际尺寸以 Pikso 返回为准。</p>
      </fieldset>
      <p>确认后，原图和 LUT 应用图将发送至 Pikso。本次生成由工作台的 Pikso 账户结算。</p>
      <button className="primary" disabled={busy||!photo} onClick={generate}><Sparkles className={busy?'working-icon':undefined} size={16}/>{busy?'正在生成光影…':output?'按当前规格重新生成':'确认并生成 AI 成片'}</button>
      {busy&&<p role="status" className="generation-progress">Pikso 正在处理照片。高清成片可能需要几分钟，请保持页面开启。</p>}
    </>:<p className="service-info">AI 生成暂不可用。你仍可预览和下载 LUT 应用图。</p>}
    <details><summary>查看光影指令</summary><p className="prompt">{editingPrompt(recipe,adj)}</p></details>
    {jobError&&<p role="alert" className="error">{jobError}</p>}
  </div></Modal>}
  {notice&&<div className="toast" role="status">{notice}<button aria-label="关闭提示" onClick={()=>setNotice('')}><X size={14}/></button></div>}
 </>;
}
