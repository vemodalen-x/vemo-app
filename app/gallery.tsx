'use client';
import {useState,useEffect,useRef} from 'react';
import {Download,Maximize,SlidersHorizontal,X,BookOpen} from 'lucide-react';
import scenes from './scenes.json';
type Scene=typeof scenes[number];
const imagePath=(s:Scene)=>'/samples/'+s.id+'.jpg';
function selectedHash(){return scenes.find(s=>location.hash==='#samples/'+s.id)||null;}
export function Gallery({onTry}:{onTry:(s:string,name:string)=>void}) {
 const [selected,setSelected]=useState<Scene|null>(null),ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const sync=()=>setSelected(selectedHash());sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 useEffect(()=>{if(selected&&!ref.current?.open)ref.current?.showModal();if(!selected&&ref.current?.open)ref.current.close();},[selected]);
 const open=(s:Scene)=>{location.hash='samples/'+s.id};const close=()=>{location.hash='samples'};
 return <><section className="scene-grid" aria-label="八个场景的教学样片">{scenes.map(s=><button key={s.id} onClick={()=>open(s)} className="scene-card"><div className="scene-image"><img src={'/samples/'+s.id+'-thumb.jpg'} alt={s.alt} loading="lazy"/><span>{s.id.toUpperCase()} · {s.bucket}</span><i><Maximize size={15}/></i></div><div className="scene-caption"><h2>{s.title}</h2><span>{s.recipe}</span></div></button>)}</section>
 <dialog ref={ref} className="scene-dialog" aria-label="样片学习与展示" onCancel={close}>{selected&&<><div className="modal-head"><div><div className="scene-id">{selected.id.toUpperCase()} · {selected.bucket}</div><h2>{selected.title} <em>{selected.en}</em></h2></div><button className="icon-btn" onClick={close} aria-label="关闭样片"><X/></button></div><div className="scene-detail"><div className="art"><img src={imagePath(selected)} alt={selected.alt}/></div><div className="study"><span className="recipe-label"><BookOpen size={15}/>样片配方</span><h3>{selected.recipe}</h3><p>{selected.subject}</p><h4>观察这张照片</h4><ul>{selected.notes.map(note=><li key={note}>{note}</li>)}</ul><h4>动手试一试</h4><p>{selected.exercise}</p><div className="study-actions"><button className="primary" onClick={()=>onTry(imagePath(selected),selected.id.toUpperCase()+'-'+selected.title+'.jpg')}><SlidersHorizontal size={16}/>在工作台试调</button><a className="secondary" href={imagePath(selected)} download={'Luma-'+selected.id+'-'+selected.title+'.jpg'}><Download size={16}/>下载样片 JPG</a></div></div></div><div className="scene-pager"><button onClick={()=>open(scenes[(scenes.indexOf(selected)+scenes.length-1)%scenes.length])}>上一张</button><span>{scenes.indexOf(selected)+1} / {scenes.length}</span><button onClick={()=>open(scenes[(scenes.indexOf(selected)+1)%scenes.length])}>下一张</button></div></>}</dialog></>;
}
