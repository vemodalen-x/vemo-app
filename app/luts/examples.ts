import baseExamples from './look-examples.json';
import { professionalLooks } from './professional-looks';

export type LookExample = {
  title: string;
  scene: string;
  note: string;
  strength: number;
  study?: string;
  originalFile?: string;
  sourceLook?: string;
  assetId?: string;
  credit?: { author: string; url: string };
};

const originals: Record<string, LookExample> = baseExamples;
const professionalExamples = Object.fromEntries(professionalLooks.map(look => {
  if (look.id === 'ink-on-paper') return [look.id, {
    title: '骑车人经过光影天桥', scene: '建筑街拍', originalFile: 'original-bridge-shadow.webp',
    note: '看桥下阴影、白墙和车轮。黑白两块更分明，车轮的轮廓还看得见。', strength: look.strength,
  }];
  const { title, scene } = originals[look.sourceLook];
  return [look.id, { title, scene, sourceLook: look.sourceLook, note: look.note, strength: look.strength }];
}));

export const examples: Record<string, LookExample> = { ...originals, ...professionalExamples };

export const realExamples: Readonly<Record<string, LookExample>> = {
  'neon-diary': {
    assetId: 'unsplash-night-alley', title: '雨夜街巷', scene: '夜景街拍', strength: 85,
    note: '先看路面的红色倒影，再看远处的灯和旁边的墙。冷色更深时，暖色灯光仍看得清。',
    credit: { author: 'masahiro miyagi', url: 'https://unsplash.com/photos/uZA3P4sA3tM' },
  },
  'lucid-lake': {
    assetId: 'unsplash-foggy-lake', title: '云雾下的多洛米蒂山湖', scene: '自然风景', strength: 90,
    note: '看湖水怎样变蓝，再对照岸边的树和山顶的雾。云层的纹理仍有层次。',
    credit: { author: 'Thomas Dorgler', url: 'https://unsplash.com/photos/uh27RcEHi3g' },
  },
  'ink-on-paper': {
    assetId: 'unsplash-tallinn-stairs', title: '塔林的日照台阶', scene: '建筑街拍', strength: 90,
    note: '看楼梯边缘、墙面和直射阳光的分界。强反差会让材料的颜色退下去，形状更显眼。',
    credit: { author: 'Margo Evardson', url: 'https://unsplash.com/photos/7Uix7lJGuNk' },
  },
  'cream-editorial': {
    assetId: 'unsplash-chapel-flowers', title: '礼拜堂窗边的白花', scene: '窗边静物', strength: 85,
    note: '看白花和窗边明亮的部分，再看盆底的影子。暗面变浅，画面也比原图暖一点。',
    credit: { author: 'Noah Näf', url: 'https://unsplash.com/photos/fqQr1AFWwnc' },
  },
};

export function originalAsset(id: string, example = examples[id]) {
  const sourceId = example?.sourceLook ?? example?.assetId ?? id;
  const file = (example?.sourceLook ? examples[sourceId]?.originalFile : example?.originalFile) ?? 'original.webp';
  return `/look-examples/${sourceId}/${file}`;
}
