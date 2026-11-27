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

const reading: Partial<Record<ToneId, { name: string; url: string; tip: string }>> = {
  'high-short': { name: '苏德克《我的工作室的窗》', url: 'https://www.getty.edu/art/collection/object/1042KV', tip: '看窗光如何让相近的浅色也有细节。' },
  'mid-short': { name: '索尔·雷特《雪》', url: 'https://www.nga.gov/artworks/134760-snow', tip: '留意雾窗怎样把街景的明暗压近，让轮廓靠一点色彩浮出来。' },
  'low-medium': { name: '索尔·雷特《雪》', url: 'https://www.nga.gov/artworks/134760-snow', tip: '看暖光如何在雾窗后留下一小块颜色，把视线带向人物。' },
  'low-long': { name: '安塞尔·亚当斯《月升》', url: 'https://www.moma.org/collection/works/53904', tip: '看深色天空如何衬出月亮和地面的局部亮点。' },
  'full-long': { name: '何藩《阴影》', url: 'https://www.mplus.org.hk/sc/collection/objects/approaching-shadow-2015446/', tip: '看大片光和影怎样先划出形状，再把视线带到人物。' },
};

export function ToneLibrary({ looks, selection, selected, onSelect, onOpen }: {
  looks: Recipe[];
  selection: ToneSelection;
  selected: string;
  onSelect: (selection: ToneSelection) => void;
  onOpen: (look: Recipe, fullscreen?: boolean) => void;
}) {
  const overview = selection === 'overview';
  const category = overview ? null : toneCategories[selection];
  const reference = overview ? undefined : reading[selection];
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
        {reference&&<p>{reference.tip}</p>}
        <div className="tone-reading">
          {reference&&<a href={reference.url} target="_blank" rel="noreferrer">{reference.name}</a>}
          <a href="https://wilsonjinlong.tuchong.com/t/23584570/" target="_blank" rel="noreferrer">影调入门</a>
        </div>
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
