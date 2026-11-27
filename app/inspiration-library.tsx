'use client';

import {useRef,useState,type ChangeEvent,type FormEvent} from 'react';
import {FolderOpen, ImagePlus, Link2, Plus, Trash2} from 'lucide-react';
import type {InspirationBoard,InspirationPhoto} from './luts/inspiration';
import {deleteBoard, prepareInspiration, saveBoard} from './luts/inspiration-store';
import {photoFileTypes} from './photo-file';

type Props = {
  personal: InspirationBoard[];
  defaults: InspirationBoard[];
  onSave: (board: InspirationBoard) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
};

export function InspirationLibrary({personal,defaults,onSave,onDelete,onSelect}: Props) {
  const [view,setView] = useState<'personal'|'default'>('personal');
  const [editing,setEditing] = useState(false);
  const [id,setId] = useState('');
  const [name,setName] = useState('');
  const [source,setSource] = useState('');
  const [photos,setPhotos] = useState<InspirationPhoto[]>([]);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState('');
  const [remove,setRemove] = useState('');
  const input = useRef<HTMLInputElement>(null);

  function edit(board?: InspirationBoard) {
    setId(board?.id ?? crypto.randomUUID());
    setName(board?.name ?? '');
    setSource(board?.sourceUrl ?? '');
    setPhotos(board?.photos ?? []);
    setError('');
    setEditing(true);
  }

  async function addFiles(inputs: File[]) {
    if (!inputs.length || pending) return;
    setPending(true);
    setError('');
    const next: InspirationPhoto[] = [];
    let skipped = 0;
    for (const file of inputs.slice(0,Math.max(0,30-photos.length))) {
      try { next.push(await prepareInspiration(file)); }
      catch { skipped++; }
    }
    setPhotos(current=>[...current,...next]);
    setError(skipped ? `${skipped} 张无法读取。请尝试 25 MB 内的 JPG、PNG 或 WebP。` :
      inputs.length > 30 - photos.length ? '每组最多 30 张，已导入剩余可用张数。' : '');
    setPending(false);
  }

  function addImages(event: ChangeEvent<HTMLInputElement>) {
    const inputs = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addFiles(inputs);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!name.trim() || !photos.length) { setError('请填写组名并添加至少一张参考照片。'); return; }
    let sourceUrl: string | undefined;
    if (source.trim()) {
      try {
        const url = new URL(source.trim());
        if (!['https:','http:'].includes(url.protocol)) throw Error();
        sourceUrl = url.href;
      } catch { setError('请填写有效的网页链接。');return; }
    }
    const board = {id,name:name.trim(),photos,sourceUrl};
    setPending(true);
    setError('');
    try {
      await saveBoard(board);
      onSave(board);
      setEditing(false);
    } catch { setError('灵感组无法保存，请检查浏览器存储空间。'); }
    finally { setPending(false); }
  }

  async function erase(id: string) {
    try { await deleteBoard(id);onDelete(id);setRemove('');setError(''); }
    catch { setError('删除失败，请重试。'); }
  }

  return <div className="inspiration-dialog">
    <p>把摄影作品或从小红书、Instagram 收藏的照片放进同一组。可批量上传或粘贴图片，参考图保存在当前浏览器。</p>
    <div className="inspiration-controls" aria-label="灵感库分类">
      <button type="button" aria-pressed={view==='personal'} disabled={pending} onClick={()=>{setView('personal');setEditing(false);setError('');}}>我的灵感</button>
      <button type="button" aria-pressed={view==='default'} disabled={pending} onClick={()=>{setView('default');setEditing(false);setError('');}}>默认灵感</button>
      {view==='personal'&&!editing&&<button type="button" onClick={()=>edit()}><Plus size={16}/>新建灵感组</button>}
    </div>
    {editing ? <form className="inspiration-form" onSubmit={submit} onPaste={event=>{
      const files=Array.from(event.clipboardData.files).filter(file=>file.type.startsWith('image/'));
      if(files.length){event.preventDefault();void addFiles(files);}
    }}>
      <label>组名<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="例如 暖窗人像" required/></label>
      <label>作品页或帖子链接（选填）<input type="url" value={source} maxLength={2048} onChange={e=>setSource(e.target.value)} placeholder="https://…"/></label>
      <div className="inspiration-controls"><button type="button" disabled={pending||photos.length>=30} onClick={()=>input.current?.click()}><ImagePlus size={16}/>添加参考照片</button><span>{photos.length} / 30 张</span></div>
      <input ref={input} hidden type="file" multiple accept={photoFileTypes} onChange={addImages}/>
      {photos.length>0&&<div className="inspiration-edit-grid">{photos.map(photo=><figure key={photo.id}>
        <img src={photo.thumbnail} alt={photo.name}/><button type="button" aria-label={'移除 '+photo.name} disabled={pending} onClick={()=>setPhotos(current=>current.filter(entry=>entry.id!==photo.id))}>移除</button>
      </figure>)}</div>}
      <div className="inspiration-controls">
        <button className="primary" type="submit" disabled={pending}>{pending?'处理中…':'保存灵感组'}</button>
        <button type="button" disabled={pending} onClick={()=>{setEditing(false);setError('');}}>取消</button>
      </div>
    </form> : <>
      {!personal.length&&view==='personal'&&<div className="inspiration-empty"><FolderOpen size={24}/><p>这里还没有灵感组。新建后，自动推荐会优先检索你的照片。</p></div>}
      <div className="inspiration-boards">
        {(view==='personal'?personal:defaults).map(board=><article className="inspiration-board" key={board.id}>
          <div className="inspiration-board-photos">{board.photos.slice(0,3).map(photo=>
            <img key={photo.id} src={photo.thumbnail} loading="lazy" alt={photo.name}/>)}</div>
          <div className="inspiration-board-title"><h3>{board.name}</h3><span>{board.photos.length} 张</span></div>
          <div className="inspiration-controls">
            <button type="button" onClick={()=>onSelect(board.id)}>用这组追色</button>
            {view==='personal'&&<button type="button" onClick={()=>edit(board)}>编辑</button>}
            {view==='personal'&&<button type="button" onClick={()=>setRemove(board.id)} aria-label={'删除 '+board.name}><Trash2 size={16}/></button>}
            {board.sourceUrl&&<a href={board.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={15}/>来源</a>}
          </div>
          {remove===board.id&&<div className="inspiration-controls"><span>删除此组？</span><button type="button" onClick={()=>erase(board.id)}>确认删除</button><button type="button" onClick={()=>setRemove('')}>取消</button></div>}
        </article>)}
      </div>
    </>}
    {error&&<p className="inspiration-error" role="alert">{error}</p>}
  </div>;
}
