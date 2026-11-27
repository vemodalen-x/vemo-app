'use client';

import type { Recipe } from './film';
import { LookGallery } from './look-gallery';
import { toneCategories, type ToneId } from './luts/tones';
import sampleTones from './luts/sample-tones.json';

export type ToneSelection = 'overview' | ToneId;
export const sampleToneIndex: Readonly<Record<string, ToneId>> = sampleTones as Record<string, ToneId>;
const groups = [
  { name: '高调', ids: ['high-short', 'high-medium', 'high-long'] },
  { name: '中调', ids: ['mid-short', 'mid-medium', 'mid-long'] },
  { name: '低调', ids: ['low-short', 'low-medium', 'low-long'] },
] as const;

export function ToneLibrary({ looks, selection, selected, onSelect, onOpen }: {
  looks: Recipe[];
  selection: ToneSelection;
  selected: string;
  onSelect: (selection: ToneSelection) => void;
  onOpen: (look: Recipe) => void;
}) {
  const overview = selection === 'overview';
  const category = overview ? null : toneCategories[selection];
  const representatives = Object.values(toneCategories).flatMap(({ representative }) =>
    looks.filter(look => look.id === representative));
  const visible = overview ? representatives : looks.filter(look => sampleToneIndex[look.id] === selection);
  const sorted = category
    ? [...visible.filter(look => look.id === category.representative), ...visible.filter(look => look.id !== category.representative)]
    : visible;
  const counts = new Map<ToneId, number>();
  for (const look of looks) {
    const id = sampleToneIndex[look.id];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const categoryButton = (id: ToneId) => (
    <button key={id} type="button" aria-pressed={selection === id} onClick={() => onSelect(id)}>
      <strong>{toneCategories[id].name}</strong><span>{counts.get(id) ?? 0} 款</span>
    </button>
  );

  return <section className="tone-library" aria-label="专业影调分类">
    <div className="tone-controls">
      <div className="tone-matrix" role="group" aria-label="十种摄影影调">
        <div className="tone-matrix-row tone-matrix-labels" aria-hidden="true">
          <span>主亮度</span><span>短跨度</span><span>中跨度</span><span>长跨度</span>
        </div>
        {groups.map(group => <div className="tone-matrix-row" key={group.name}>
          <span className="tone-axis">{group.name}</span>
          {group.ids.map(categoryButton)}
        </div>)}
        <div className="tone-matrix-row tone-matrix-end">
          <span className="tone-axis">两端</span>
          {categoryButton('full-long')}
        </div>
      </div>
      <div className="tone-explanation">
        <h2>{category?.name ?? '十种摄影影调'}</h2>
        <p>{category?.lead ?? '先看画面主要偏亮、居中还是偏暗，再看从暗到亮跨了多远。全长调的亮度主要集中在黑白两端。'}</p>
        <p>{category?.note ?? '分类基于各滤镜在配套样片上的效果。换一张照片，影调会随原图光线、曝光和滤镜强度变化。'}</p>
        <a href="https://wilsonjinlong.tuchong.com/t/23584570/" target="_blank" rel="noreferrer">阅读影调原理 ↗</a>
      </div>
    </div>
    <div className="tone-results-heading">
      <h2>{overview ? '代表样片' : category?.name + '滤镜'}</h2>
      {overview ? <span>{sorted.length} 类 · {looks.length} 款</span>
        : <button className="text-btn" type="button" onClick={() => onSelect('overview')}>查看十类总览</button>}
    </div>
    <LookGallery looks={sorted} selected={selected} onOpen={onOpen} tones={sampleToneIndex}/>
  </section>;
}
