const darkLimit = .35;
const brightLimit = .65;

export const toneCategories = {
  'high-short': {
    name: '高短调',
    lead: '高亮集中，明暗跨度小。',
    note: '留意白瓷和浅布料之间的微小亮度差。适合漫射窗光、浅色静物和雾景。',
    representative: 'cream-editorial',
  },
  'high-medium': {
    name: '高中调',
    lead: '亮部主导，保留中灰作为衬托。',
    note: '观察亮墙、受光皮肤和背光一侧的层次。适合浅背景人像和柔光雪景。',
    representative: 'ivory-day',
  },
  'high-long': {
    name: '高长调',
    lead: '亮部主导，同时保留较深的阴影。',
    note: '先看受光墙面，再看檐下阴影。适合日照街景、浅色建筑和带深色前景的雪景。',
    representative: 'noon-in-color',
  },
  'mid-short': {
    name: '中短调',
    lead: '大部分亮度聚在中灰附近。',
    note: '看外套、墙面和路面如何在接近的明度里分开。适合阴天穿搭或柔光纪实。',
    representative: 'mocha-editorial',
  },
  'mid-medium': {
    name: '中中调',
    lead: '中灰为主，向亮、暗两侧适度展开。',
    note: '对比糕点亮面和桌面柔影，观察两端如何保留质感。适合日常静物和柔光人像。',
    representative: 'apricot-light',
  },
  'mid-long': {
    name: '中长调',
    lead: '中间调占主导，暗处和亮处仍有明显层次。',
    note: '沿树荫、岸石、水面到天空看亮度逐段展开。适合斑驳日光和层次丰富的风景。',
    representative: 'leaflight',
  },
  'low-short': {
    name: '低短调',
    lead: '大部分亮度集中在暗部，明暗跨度小。',
    note: '观察暗背景、湿地和微弱反光之间的差别。适合低照度纪实，尤其要保留暗部纹理。',
    representative: 'indigo-embers',
  },
  'low-medium': {
    name: '低中调',
    lead: '暗部主导，少量中灰撑起空间。',
    note: '看街影、湿路和灯下墙面的过渡。适合雨夜、蓝调街景和弱光室内。',
    representative: 'neon-diary',
  },
  'low-long': {
    name: '低长调',
    lead: '深影占据大部分画面，亮部与暗部拉得很开。',
    note: '比较地铁出口的深暗空间与局部受光面。适合有明确主光的夜景和侧光人像。',
    representative: 'cine',
  },
  'full-long': {
    name: '全长调',
    lead: '深黑与亮白都占明显面积，中间过渡少。',
    note: '对照扶梯人物剪影和亮墙，观察直方图两端的堆积。适合极简黑白和逆光剪影。',
    representative: 'mono',
  },
} as const;

export type ToneId = keyof typeof toneCategories;
export type ToneMeasurement = ReturnType<typeof measureTone>;

export function isToneId(value: string): value is ToneId {
  return Object.hasOwn(toneCategories, value);
}

export function measureTone(pixels: ArrayLike<number>) {
  const counts = new Uint32Array(256);
  for (let i = 0; i < pixels.length; i += 4) {
    counts[Math.round(.2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2])]++;
  }

  const total = pixels.length / 4;
  const quantile = (fraction: number) => {
    let cumulative = 0;
    for (let i = 0; i < counts.length; i++) {
      cumulative += counts[i];
      if (cumulative >= total * fraction) return i / 255;
    }
    return 1;
  };
  const p05 = quantile(.05), median = quantile(.5), p95 = quantile(.95);
  const span = p95 - p05;
  let dark = 0, bright = 0;
  const histogram = new Array<number>(32).fill(0);
  for (let i = 0; i < counts.length; i++) {
    if (i / 255 < darkLimit) dark += counts[i];
    if (i / 255 >= brightLimit) bright += counts[i];
    histogram[i >> 3] += counts[i] / total;
  }

  const key = median < darkLimit ? 'low' : median >= brightLimit ? 'high' : 'mid';
  const range = span <= .39 ? 'short' : span >= .60 ? 'long' : 'medium';
  const twoPeaks = p05 <= .12 && p95 >= .88 && dark / total >= .24 && bright / total >= .24
    && (total - dark - bright) / total <= .15;
  const id: ToneId = twoPeaks ? 'full-long' : `${key}-${range}`;
  return { id, median, span, histogram };
}
