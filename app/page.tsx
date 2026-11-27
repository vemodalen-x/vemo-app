'use client';
import {useState,useEffect,useRef,useCallback,useMemo,type ChangeEvent,type ReactNode} from 'react';
import {Aperture,PanelsTopLeft,Layers3,CircleHelp,Upload,Maximize,Minimize,Columns2,SlidersHorizontal,Check,Sparkles,Download,RotateCcw,Activity,X,ChevronsLeftRight,Film,ImagePlus,FolderOpen,Focus,Scan,ChevronRight} from 'lucide-react';
import {Gallery} from './gallery';
import {exampleAsset,lookExample,LookGallery,LookStudy,type LookExample} from './look-gallery';
import {authoredLooks,baseRecipes,socialRecipes,recipes,defaults,editingPrompt,type Recipe,type Adjust} from './film';
import {canvasOf,currentCube,grade,inspect} from './pixels';
import {loadLookBank} from './luts/bank';
import {fallbackOptions,rankPixelData,readRecommendationPixels,type Recommendation} from './luts/recommend';
import {rankFromInspiration,type InspirationMatch,type InspirationBoard} from './luts/inspiration';
import defaultInspiration from './luts/inspiration-defaults.json';
import {listBoards} from './luts/inspiration-store';
import {InspirationLibrary} from './inspiration-library';
import {RecommendationNotes} from './luts/recommendation-notes';
import {sampleToneIndex,ToneLibrary,type ToneSelection} from './tone-library';
import {isToneId} from './luts/tones';
type DemoSelection={look:Recipe;sample:LookExample};
type Photo={canvas:HTMLCanvasElement;small:HTMLCanvasElement;file:string;width:number;height:number;sample:boolean;sourceOnly:boolean;demo?:DemoSelection};
type Dialog='help'|'generation'|'inspiration'|'look-study'|null;
type Pair='original-lut'|'original-ai'|'lut-ai';
type ReferencePhoto={canvas:HTMLCanvasElement;thumbnail:string;name:string};
const familyFilters = [
  {id:'all',name:'全部收录'},
  {id:'social',name:'社媒灵感'},
  ...authoredLooks.filter(look=>look.featured).map(look=>({id:look.family!,name:look.familyName!})),
  {id:'control',name:'校准'},
  {id:'classic',name:'基础滤镜'},
];
const picture='alpine-source.jpg';
function saveBlob(blob:Blob,name:string){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);}
function jpeg(src:HTMLCanvasElement){return new Promise<Blob>((ok,fail)=>src.toBlob(blob=>blob?ok(blob):fail(Error('图像导出失败。')),'image/jpeg',.94));}
function readImage(src:string){return new Promise<HTMLImageElement>((ok,fail)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=()=>fail(Error('这张照片无法解码，请选择 JPG、PNG 或 WebP。'));img.src=src;});}
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
 const [reference,setReference]=useState<ReferencePhoto|null>(null),[readingReference,setReadingReference]=useState(false);
 const [personal,setPersonal]=useState<InspirationBoard[]|null>(null);
 const [mode,setMode]=useState<'auto'|'source'>('auto'),[pinned,setPinned]=useState<string|null>(null);
 const [match,setMatch]=useState<InspirationMatch|null>(null),[adaptive,setAdaptive]=useState(false);
 const [pair,setPair]=useState<Pair>('original-lut');
 const [recommendationThumbs,setRecommendationThumbs]=useState<Record<string,string>>({});
 const [libraryFamily,setLibraryFamily]=useState('all');
 const [libraryTone,setLibraryTone]=useState<ToneSelection|null>(null);
 const [studyLook,setStudyLook]=useState<Recipe|null>(null);
 const initialDemo=useRef<DemoSelection|undefined>(undefined);
 const referenceInput=useRef<HTMLInputElement>(null),referenceRevision=useRef(0);
 const [analysis,setAnalysis]=useState<ReturnType<typeof inspect>|null>(null),[adj,setAdj]=useState<Adjust>(defaults),[compare,setCompare]=useState(false),[split,setSplit]=useState(50),[wide,setWide]=useState(false),[drag,setDrag]=useState(false);
 const [dialog,setDialog]=useState<Dialog>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[output,setOutput]=useState(''),[notice,setNotice]=useState(''),[jobError,setJobError]=useState(''),[loading,setLoading]=useState(false);
 const input=useRef<HTMLInputElement>(null),preview=useRef<HTMLCanvasElement>(null),stage=useRef<HTMLElement>(null),version=useRef(0),jobLock=useRef(false),gradeVersion=useRef(0),dragDepth=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const selected=recipe.id,preset=!!photo?.sample&&selected==='warm'&&adj.strength===75&&adj.temp===0&&adj.exposure===0;
 const comparisonLut=useMemo(()=>{
   if(!photo||dialog!=='generation')return '';
   const target=document.createElement('canvas');
   grade(photo.small,target,recipe,adj);
   return target.toDataURL('image/jpeg',.92);
 },[photo,dialog,recipe,adj]);
 const say=(message:string)=>{setNotice(message);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setNotice(''),3800);};
 const load=useCallback(async(file?:File,startOriginal=false,demo?:DemoSelection)=>{
  const v=++version.current;gradeVersion.current++;setLoading(true);
  let url=demo?exampleAsset(demo.look.id,'original'):'/'+picture;
  try{
   if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>25*1024*1024)throw Error('请选择 25 MB 以内的 JPG、PNG 或 WebP 照片。');url=URL.createObjectURL(file);}
   const img=await readImage(url);if(v!==version.current)return;
   const canvas=canvasOf(img,img.naturalWidth,img.naturalHeight,3072),small=canvasOf(canvas,canvas.width,canvas.height,1280),m=inspect(canvas);
   setBaseUrl(file?small.toDataURL('image/jpeg',.94):url);
   setPhoto({canvas,small,width:img.naturalWidth,height:img.naturalHeight,file:file?.name??(demo?demo.look.id+'.webp':'ALPINE_001.JPG'),sample:!file&&!demo,sourceOnly:startOriginal,demo});
   setAnalysis(m);setCompare(false);setSplit(50);setOutput('');setJobError('');
   if(file||demo){setTab('studio');location.hash='studio';}

  }catch(e){if(v===version.current){setNotice((e as Error).message);}}
  finally{if(file&&url.startsWith('blob:'))URL.revokeObjectURL(url);if(v===version.current)setLoading(false);}
 },[]);
 useEffect(()=>{
   const sync=()=>{
     const hash=location.hash;
     const pro=hash==='#library/pro'||hash.startsWith('#library/pro/');
     setTab(hash.startsWith('#samples')?'samples':hash==='#library'||pro?'library':'studio');
     if(pro){
       const id=hash.slice('#library/pro/'.length);
       setLibraryTone(isToneId(id)?id:'overview');
     }else if(hash==='#library'){
       setLibraryTone(null);
     }
   };
   sync();
   window.addEventListener('hashchange',sync);
   return()=>window.removeEventListener('hashchange',sync);
 },[]);
 const selectTone=(tone:ToneSelection|null)=>{
   setLibraryTone(tone);
   location.hash=tone===null?'library':tone==='overview'?'library/pro':'library/pro/'+tone;
 };
 const go=(target:'studio'|'library'|'samples')=>{
   setTab(target);
   if(target==='library')selectTone(libraryTone);
   else location.hash=target;
 };
 const tryScene=async(path:string,name:string)=>{try{const r=await fetch(path);if(!r.ok)throw Error();const blob=await r.blob();await load(new File([blob],name,{type:'image/jpeg'}),true);}catch{say('样片暂时无法读取，请重试。')}};
 useEffect(()=>{
   load();
   loadLookBank().then(setBankReady);
   listBoards().then(setPersonal).catch(()=>setPersonal([]));
   fetch('/api/status').then(r=>r.json()).then(data=>{const status=data as {ready?:boolean};setReady(status.ready===true);}).catch(()=>setReady(false));
 },[load]);
 useEffect(()=>{
   if(!photo || bankReady===null || personal===null)return;
   const input=readRecommendationPixels(photo.canvas);
   const direct=reference ? readRecommendationPixels(reference.canvas) : null;
   const useInspiration=bankReady && mode==='auto' && !direct;
   const boards=pinned?[...personal,...defaultInspiration]:personal.length?personal:defaultInspiration;
   const found=useInspiration?rankFromInspiration(input,boards,pinned):null;
   const ranked=found??(bankReady?rankPixelData(input,direct):{options:fallbackOptions,close:false});
   const mini=canvasOf(photo.small,photo.small.width,photo.small.height,208);
   const target=document.createElement('canvas'), images:Record<string,string>={};
   for (const option of ranked.options){
     grade(mini,target,option.look,{...defaults,strength:option.strength});
     images[option.look.id]=target.toDataURL('image/jpeg',.87);
   }
   const top=ranked.options[0];
   const demo=photo.demo!==initialDemo.current?photo.demo:undefined;
   initialDemo.current=photo.demo;
   gradeVersion.current++;
   setMatch(found?.match??null);setAdaptive(found?.adaptive??false);
   setRanked(ranked);setRecommendationThumbs(images);
   setRecipe(demo?.look??top.look);
   setAdj({...defaults,strength:demo?.sample.strength??(photo.sourceOnly&&!reference&&!pinned?0:top.strength)});
   setOutput('');setJobError('');
 },[photo,reference,bankReady,personal,mode,pinned]);
 useEffect(()=>{if(!photo||tab!=='studio')return;const frame=requestAnimationFrame(()=>{if(preview.current)grade(photo.small,preview.current,recipe,adj)});return()=>cancelAnimationFrame(frame)},[photo,recipe,adj,tab,wide]);
 useEffect(()=>{if(!wide)return;const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setWide(false)};window.addEventListener('keydown',handler);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{window.removeEventListener('keydown',handler);document.body.style.overflow=old}},[wide]);
 const change=(patch:Partial<Adjust>)=>{gradeVersion.current++;setAdj(a=>({...a,...patch}));setOutput('');setJobError('');};
 const pick=(r:Recipe,strength=defaults.strength)=>{gradeVersion.current++;setRecipe(r);setAdj({...defaults,strength});setOutput('');setJobError('');go('studio');};
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
     if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>25*1024*1024)throw Error('请选择 25 MB 以内的 JPG、PNG 或 WebP 参考图。');
     url=URL.createObjectURL(file);
     const image=await readImage(url);
     if(revision!==referenceRevision.current)return;
     const canvas=canvasOf(image,image.naturalWidth,image.naturalHeight,320);
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
   if(libraryFamily==='social')return look.collection==='social';
   if(libraryFamily==='classic')return look.lutIndex===undefined&&!look.collection;
   return look.family===libraryFamily;
 });
 const showStudy=(look:Recipe)=>{setStudyLook(look);setDialog('look-study');};
 const useExample=(look:Recipe,strength:number)=>{
   const sample={...lookExample(look.id),strength};
   setDialog(null);
   void load(undefined,false,{look,sample});
 };
 const chooseBoard=(id:string)=>{
   removeReference();
   setPinned(id);setMode('auto');setDialog(null);go('studio');
 };
 const automatic=()=>{
   removeReference();
   setPinned(null);setMode('auto');
 };
 const sourceOnly=()=>{
   removeReference();
   setPinned(null);setMode('source');
 };
 const openAI=()=>{setJobError('');setPair(output?'lut-ai':'original-lut');setDialog('generation');};
 const generate=async()=>{if(!photo||!ready||jobLock.current)return;jobLock.current=true;setBusy(true);setJobError('');const rev=gradeVersion.current;
  try{const src=canvasOf(photo.canvas,photo.canvas.width,photo.canvas.height,1536),reference=document.createElement('canvas');grade(src,reference,recipe,adj);
    const body=new FormData();body.append('original',await jpeg(src),'original.jpg');body.append('reference',await jpeg(reference),'reference.jpg');body.append('recipe',recipe.id);body.append('adjust',JSON.stringify(adj));
    body.append('width',String(src.width));body.append('height',String(src.height));
    const resp=await fetch('/api/generate',{method:'POST',body});const obj=await resp.json() as {image?:string;error?:string};if(!resp.ok||!obj.image)throw Error(obj.error||'生成服务没有返回图像。');
    if(rev===gradeVersion.current){setOutput(obj.image);setPair('lut-ai');}else say('影调已更改，请按当前设置重新生成。');
  }catch(e){if(rev===gradeVersion.current)setJobError((e as Error).message||'生成失败，请重试。')}finally{setBusy(false);jobLock.current=false;}
 };
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
  <nav aria-label="主导航"><button className={tab==='studio'?'nav-active':''} onClick={()=>go('studio')}><PanelsTopLeft/>工作台</button><button className={tab==='library'?'nav-active':''} onClick={()=>go('library')}><Layers3/>滤镜库</button><button className={tab==='samples'?'nav-active':''} onClick={()=>go('samples')}><Film/>场景样片</button><a href="/studies"><Columns2/>风格对照</a></nav><button className="help" onClick={()=>setDialog('help')}><CircleHelp size={17}/><span>使用指南</span></button></div></header>
  <main id="studio"><div className="page-heading"><div><h1>{tab==='studio'?'影调工作台':tab==='samples'?'场景样片':'滤镜库'}<em>{tab==='studio'?'Film Lab':tab==='samples'?'Field Notes':'Film Library'}</em></h1><p>{tab==='studio'?'根据画面的光线与色彩，找到适合这张照片的影调。':tab==='samples'?'八张 AI 创作样片。打开照片，观察光线、颜色与影调配方。':'每款滤镜配有专属场景，可查看原图与应用效果。'}</p></div>{tab==='samples'?<a className="upload" href="/samples/Luma_Scene_Studies.zip" download><Download size={17}/>下载整套样片</a>:<button className="upload" onClick={()=>input.current?.click()} disabled={loading}><Upload size={17}/>{loading?'读取中…':'上传照片'}</button>}<input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={inputChanged}/></div>
  {tab==='studio'?<div className="workspace"><div className="left">
  <section ref={stage} className={'viewer '+(wide?'expanded ':'')+(drag?'dragging':'')} aria-label="照片预览" onDragOver={e=>e.preventDefault()} onDragEnter={e=>{e.preventDefault();dragDepth.current++;setDrag(true)}} onDragLeave={()=>{if(--dragDepth.current<=0)setDrag(false)}} onDrop={e=>{e.preventDefault();dragDepth.current=0;setDrag(false);const f=e.dataTransfer.files[0];if(f)load(f)}}>
  <div className="photo-stage"><img className="original-photo" src={baseUrl} alt={photo?.demo?.sample.title??(photo?.sample===false?'上传的原始照片':'金色晨光照亮山峰，山下的针叶林倒映在湖面上')}/><canvas ref={preview} className="graded-photo" aria-label="当前影调预览" style={{clipPath:compare?'inset(0 0 0 '+split+'%)':undefined,opacity:photo?1:0}}/>
  <div className="frame-shade"/><div className="viewer-label"><span className="status-dot"/>{compare?'前后对比':'影调预览'}</div><button className="expand-btn" aria-label={wide?'退出大图':'放大预览'} onClick={()=>setWide(!wide)}>{wide?<Minimize/>:<Maximize/>}</button>
  {compare?<><div className="split-line" style={{left:split+'%'}}><i><ChevronsLeftRight size={17}/></i></div><input className="wipe" type="range" min="0" max="100" value={split} aria-label="拖动对比原图与滤镜" onChange={e=>setSplit(+e.target.value)}/><div className="compare-labels"><b>原图</b><b>{recipe.name}</b></div></>:<div className="photo-caption"><div><i/>{photo?.demo?'滤镜样片':photo?.sample===false?'当前照片':'演示样片'}</div><strong>{label}</strong></div>}
  {drag&&<div className="drop-cover"><Upload/>松开以导入照片</div>}</div>
  <div className="viewer-foot"><div className="file-meta"><Focus size={17}/><span>{photo?.file||'ALPINE_001.JPG'}</span><i/> <span>{photo?.width||1536} × {photo?.height||820}</span></div>{compareBtn}</div></section>
  <section className="rec-section" aria-labelledby="recommendation-title">
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
        <input ref={referenceInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={changeReference}/>
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
    <div className="filter-grid">{ranked.options.map(filterCard)}</div>
    <RecommendationNotes/>
  </section></div>
  <aside className="panel"><div className="panel-head"><h2><SlidersHorizontal size={19}/>调色面板</h2><button className="icon-btn" title="重置调节" aria-label="重置调节" onClick={()=>{change(defaults);say('已恢复当前配方的默认参数')}}><RotateCcw size={16}/></button></div>
  <div className="panel-content"><div className="recipe-box"><div className="recipe-label"><Film size={14}/>{recipe.familyName??"当前影调"}</div><h3>{recipe.name}</h3><em>{recipe.en}</em><div className="film-mark" aria-hidden="true"><Aperture strokeWidth={.9}/></div></div>
  <p className="recipe-description">{recipe.description}{lookExample(recipe.id)&&<button className="recipe-example-link" onClick={()=>showStudy(recipe)}>查看配套样片</button>}</p>
  <div className="sliders"><Slider label="滤镜强度" value={adj.strength} min={0} max={100} formatted={adj.strength+'%'} change={v=>change({strength:v})}/><Slider label="曝光补偿" value={adj.exposure} min={-1} max={1} step={.1} formatted={(adj.exposure>0?'+':'')+adj.exposure.toFixed(1)+' EV'} change={v=>change({exposure:v})}/><Slider label="色温偏移" value={adj.temp} min={-100} max={100} formatted={(adj.temp>0?'+':'')+adj.temp} change={v=>change({temp:v})}/></div>
  <div className="analysis"><div className="analysis-title"><h3><Activity size={16}/>画面分析</h3><span>RGB</span></div><svg className="histogram" aria-label="原图的红绿蓝亮度直方图" viewBox="0 0 252 64" preserveAspectRatio="none"><g stroke="#393b36" strokeWidth=".6">{[42,84,126,168,210].map(x=><path key={x} d={'M'+x+' 0V64'}/>)}{[21,42,63].map(y=><path key={y} d={'M0 '+y+'H252'}/>)}</g>{analysis?.curves.map((d,i)=><path key={i} d={d} fill={['#db9258','#72a78c','#769ba9'][i]} fillOpacity=".27" stroke={['#d6a074','#76a48c','#7f9da8'][i]} strokeOpacity=".85" strokeWidth="1.1"/>)}</svg>
  <div className="analysis-info"><div className="tags">{analysis?.tags.slice(0,2).map(t=><span key={t}>{t}</span>)}</div><div className="swatches" aria-label="主要色彩">{analysis?.palette.map(c=><i key={c} style={{background:c}} title={c}/>)}</div></div></div>
  <div className="actions"><button className="primary" onClick={openAI} disabled={!photo}><Sparkles size={17}/>对比 LUT / AI</button><button className="secondary" onClick={exportPhoto} disabled={!photo}><Download size={16}/>导出滤镜照片</button>{photo&&<button className="secondary" onClick={exportLook}><Download size={16}/>下载当前 33³ LUT</button>}</div></div></aside></div>:tab==='samples'?<Gallery onTry={tryScene}/>:<section aria-label="滤镜库">
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
      {(bankReady?familyFilters:familyFilters.filter(group=>['all','classic','social'].includes(group.id))).map(group=>
        <button key={group.id} type="button" aria-pressed={libraryFamily===group.id} onClick={()=>setLibraryFamily(group.id)}>{group.name}</button>
      )}
      <span>{visibleLibrary.length} 款</span>
    </div>
    <LookGallery looks={visibleLibrary} selected={selected} onOpen={showStudy}/>
    </>}
  </section>}
  </main>
  {dialog==='help'&&<Modal name="使用指南" close={()=>setDialog(null)}><div className="guide"><h3><Upload/>导入照片</h3><p>点击「上传照片」，或将一张 JPG、PNG、WebP 照片拖到预览区。单张上限 25 MB。</p><h3><SlidersHorizontal/>确定影调</h3><p>自动追色先查找个人灵感组，空库时使用默认样片。找不到合适参考时会根据原图生成新配方。也可以上传单张参考图，或切换为按原图推荐。</p><h3><Sparkles/>生成或导出</h3><p>本地滤镜可直接导出 JPG，最长边为 3072 像素。AI 光影会保留画面构图，按选定影调调整光线。确认生成后会把原图和 LUT 应用图发送至 Pikso。</p></div><button className="primary" onClick={()=>setDialog(null)}>返回工作台</button></Modal>}
  {dialog==='look-study'&&studyLook&&<Modal name={studyLook.name+' · 滤镜样片'} close={()=>setDialog(null)} wide>
    <LookStudy key={studyLook.id} look={studyLook} canApply={!!photo}
      tone={tab==='library'&&libraryTone!==null?sampleToneIndex[studyLook.id]:undefined}
      onApply={strength=>{pick(studyLook,strength);setDialog(null);}}
      onUseExample={strength=>useExample(studyLook,strength)}/>
  </Modal>}
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
      {pair!=='original-lut'&&output&&<figure><img src={output} alt="AI Image Gen 成片"/><figcaption>AI Image Gen 成片</figcaption></figure>}
    </div>
    <div className="dual"><button className="secondary" onClick={exportPhoto}><Download size={16}/>下载 LUT 应用图</button>
      <button className="secondary" onClick={exportLook}><Download size={16}/>下载 33³ LUT</button>
      {output&&<button className="secondary" onClick={async()=>{try{const r=await fetch(output);if(!r.ok)throw Error();const image=await r.blob();const extension=image.type==='image/png'?'png':image.type==='image/webp'?'webp':'jpg';saveBlob(image,'Luma-AI-'+recipe.id+'.'+extension);say('AI 成片已导出')}catch{say('下载失败，请重试。')}}}><Download size={16}/>下载 AI 成片</button>}
    </div>
    {!output&&<>
      {preset&&<button className="text-btn" onClick={()=>{setOutput('/alpine-edited.jpg');setPair('lut-ai');}}>查看这套配方的 AI 样片</button>}
      {ready?<><p>确认后，原图和 LUT 应用图将发送至 Pikso 生成 AI 成片。本次生成由工作台的 Pikso 账户结算。</p><button className="primary" disabled={busy} onClick={generate}><Sparkles className={busy?'working-icon':undefined} size={16}/>{busy?'正在生成光影…':'确认并生成 AI 成片'}</button>{busy&&<p role="status" className="generation-progress">正在创作，通常需要约 30 秒。请保持页面开启。</p>}</>:
      <p className="service-info">AI 生成暂不可用。你仍可预览和下载 LUT 应用图。</p>}
    </>}
    <details><summary>查看光影指令</summary><p className="prompt">{editingPrompt(recipe,adj)}</p></details>
    {jobError&&<p role="alert" className="error">{jobError}</p>}
  </div></Modal>}
  {notice&&<div className="toast" role="status">{notice}<button aria-label="关闭提示" onClick={()=>setNotice('')}><X size={14}/></button></div>}
 </>;
}
