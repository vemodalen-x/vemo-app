import { authoredLooks, baseRecipes, socialRecipes, type Recipe } from '../film';
import { canvasOf, gradePixels } from '../pixels';

const levels = [30, 45, 60, 75, 90];
export const recommendationPreviewEdge = 72;
const bounded = (n: number) => Math.max(0, Math.min(1, n));
const luma = (r: number, g: number, b: number) => (.2126 * r + .7152 * g + .0722 * b) / 255;
const linear = Array.from({ length: 256 }, (_, n) => {
  const x = n / 255;
  return x < .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
});

export type Recommendation = { look: Recipe; strength: number; detail: string };
export const fallbackOptions: Recommendation[] = ['warm','cine','nordic','mono'].map(id => ({
  look: baseRecipes.find(item => item.id === id)!,
  strength: 75,
  detail: '基础滤镜',
}));

function describe(pixels: Uint8ClampedArray, width: number) {
  const hist = new Uint32Array(64);
  const chromaByLight = [0, 0, 0];
  const warmByLight = [0, 0, 0];
  const greenByLight = [0, 0, 0];
  const lightCount = [0, 0, 0];
  const count = pixels.length / 4;
  const height = count / width;
  const light = new Float32Array(count);
  const a = new Float32Array(count);
  const b = new Float32Array(count);
  const warmWeight = new Float32Array(count);
  const colorSupport = new Float64Array(6);
  const colorWeight = new Float64Array(6);
  const colorLight = new Float64Array(6);
  let foliage = 0, blue = 0, warm = 0, vivid = 0, lamps = 0, pale = 0, sky = 0;
  for (let pixel = 0; pixel < count; pixel++) {
    const i = pixel * 4;
    const r = pixels[i], g = pixels[i+1], blueValue = pixels[i+2];
    const y = light[pixel] = luma(r, g, blueValue);
    hist[Math.min(63, (y * 64) | 0)]++;
    const R = linear[r], G = linear[g], B = linear[blueValue];
    const l = Math.cbrt(.4122214708*R + .5363325363*G + .0514459929*B);
    const m = Math.cbrt(.2119034982*R + .6806995451*G + .1073969566*B);
    const s = Math.cbrt(.0883024619*R + .2817188376*G + .6299787005*B);
    const aa = a[pixel] = 1.9779984951*l - 2.4285922050*m + .4505937099*s;
    const bb = b[pixel] = .0259040371*l + .7827717662*m - .8086757660*s;
    const band = y < .25 ? 0 : y < .65 ? 1 : 2;
    const chroma = Math.hypot(aa, bb);
    if (chroma > .034 && y > .11 && y < .94) {
      const hue = (Math.atan2(bb, aa) / (2 * Math.PI) + 1) % 1 * 6;
      const sector = hue | 0;
      const fraction = hue - sector;
      const upper = (sector + 1) % 6;
      colorSupport[sector] += 1 - fraction;
      colorSupport[upper] += fraction;
      colorWeight[sector] += chroma * (1 - fraction);
      colorWeight[upper] += chroma * fraction;
      colorLight[sector] += y * (1 - fraction);
      colorLight[upper] += y * fraction;
    }
    lightCount[band]++;
    chromaByLight[band] += chroma;
    warmByLight[band] += bb;
    greenByLight[band] += aa;
    if (y > .095 && y < .86 && aa < -.016 && bb > .016) foliage++;
    if (y > .18 && bb < -.028 && aa < .048) {
      blue++;
      if (pixel < count * .4) sky++;
    }
    if (chroma > .085 && y > .18) vivid++;
    if (y > .54 && (chroma > .032 || y > .75)) lamps++;
    if (y > .65 && chroma < .047) pale++;
    // Warm midtones cover some skin colors and other warm objects. Favor the
    // center without presuming a face or assigning a skin type.
    if (aa > .015 && bb > .016 && aa < .115 && bb < .135 && y > .19 && y < .83 && aa / bb < 2.4) {
      const x = (pixel % width + .5) / width;
      const row = (Math.floor(pixel / width) + .5) / height;
      warmWeight[pixel] = x > .22 && x < .78 && row > .12 && row < .85 ? 1 : .28;
      warm += warmWeight[pixel];
    }
  }
  const quantiles = [.05, .10, .50, .90, .98].map(q => {
    let mass = 0;
    for (let i = 0; i < hist.length; i++) {
      mass += hist[i];
      if (mass >= count*q) return (i + .5) / hist.length;
    }
    return 1;
  });
  const average = (bins: number[]) => bins.map((sum,i) => sum / Math.max(lightCount[i], 1));
  return { quantiles: [quantiles[1], quantiles[2], quantiles[3]],
    toe: quantiles[0], shoulder: quantiles[4], support: lightCount.map(value => value/count),
    chroma: average(chromaByLight), warmBand: average(warmByLight), greenBand: average(greenByLight),
    light, a, b, warmWeight, foliage: foliage/count, blue: blue/count, warm: warm/count,
    vivid: vivid/count, lamps: lamps/count, pale: pale/count, sky: sky / (count * .4),
    hueSupport: Array.from(colorSupport, value => value/count),
    hueChroma: Array.from(colorWeight, (value,i) => value / Math.max(1,colorSupport[i])),
    hueLight: Array.from(colorLight, (value,i) => value / Math.max(1,colorSupport[i])) };
}

type Stats = ReturnType<typeof describe>;
export type LookProfile = Omit<Stats, 'light' | 'a' | 'b' | 'warmWeight'>;
export const profilePixels = ({data,width}: RecommendationPixels): LookProfile => {
  const {light, a, b, warmWeight, ...profile} = describe(data,width);
  return profile;
};

function sceneFit(source: Stats, look: Recipe) {
  const [low, mid, high] = source.quantiles;
  const foliage = bounded(source.foliage * 2.6);
  const blue = bounded(source.blue * 1.6);
  const warm = bounded(source.warm * 4.5);
  const vivid = bounded(source.vivid * 2.0);
  const darkness = bounded((.48 - mid) * 4.4) * bounded((source.support[0] - .17) * 2.65);
  const practicals = bounded(source.lamps * 9) * bounded((.47 - source.lamps) * 3.6);
  const focus = bounded((high - low - .18) * 2.0);
  const gray = bounded(1 - vivid - .45 * warm);
  const day = bounded((mid - .20) * 3.2);
  const darkBlueSky = bounded((source.sky - .12) * 2.6) * bounded((.48 - mid) * 4.2);
  const litAccent = bounded((source.shoulder - high - .065) * 5.5)
    * bounded((.47 - mid) * 4.0);

  switch (look.family) {
    case 'impression': return { score: .42 + .46 * foliage + .22 * blue + .14 * day - .30 * darkness * (1 - foliage) - .24 * darkBlueSky,
      reason: foliage >= blue && foliage > .22 ? '植被色占比较高，优先保留黄绿与暗部层次' : '画面有较清晰的日光或冷色层次，优先保留空气感' };
    case 'american': return { score: .49 + .22 * day + .18 * vivid + .20 * source.pale - .18 * warm - .24 * darkness - .17 * foliage - .16 * darkBlueSky,
      reason: vivid > .24 ? '保留已有色块的辨识度，避免亮色过饱和' : '保留日间自然对比和中性表面的颜色' };
    case 'renaissance': return { score: .39 + .49 * warm + .09 * day + .08 * (1 - focus) - .14 * foliage - .17 * darkness * (1 - warm),
      reason: warm > .23 ? '中央暖色中间调较多，优先维持暖色和柔和过渡' : '画面适合柔和的中间调和渐进的明暗过渡' };
    case 'baroque': return { score: .36 + .23 * focus + .21 * warm + .10 * practicals + .04 * darkness - .21 * foliage - .14 * blue - .08 * gray,
      reason: '画面明暗分区明显，预览优先维持深色层次与暖亮部' };
    case 'taiwan': return { score: .44 + .25 * gray + .11 * (1 - day) - .21 * darkness - .13 * foliage - .11 * darkBlueSky,
      reason: '原图色彩较克制，优先维持灰阶和少量冷暖点缀' };
    case 'night': return { score: .26 + .40 * darkness + .20 * darkness * practicals + .26 * darkBlueSky
        + .22 * litAccent - .41 * foliage - .23 * warm - .09 * day,
      reason: practicals > .25 ? '暗部占比较高且有局部亮点，优先保留暗场和光源层次' : '低亮度画面，优先守住暗部层次和现有冷暖关系' };
    default: return { score: .3, reason: '保留原图的明暗和色彩' };
  }
}

function gradeQuality(source: Stats, candidate: Stats, input: Uint8ClampedArray, output: Uint8ClampedArray, width: number) {
  let clips = 0, crush = 0, neutral = 0, warmth = 0, effect = 0, edgeLoss = 0, edges = 0;
  const count = source.light.length;
  let warmSupport = 0;
  for (let p = 0; p < count; p++) {
    const i = p * 4;
    const oldY = source.light[p], newY = candidate.light[p];
    const da = candidate.a[p] - source.a[p], db = candidate.b[p] - source.b[p];
    const colorShift = Math.hypot(da, db);
    effect += Math.hypot((newY-oldY) * .64, da, db);
    const oldMax = Math.max(input[i], input[i+1], input[i+2]);
    const newMax = Math.max(output[i], output[i+1], output[i+2]);
    if (oldMax < 249 && newMax > 250) clips += (newMax - 250) / 5;
    if (oldY > .045 && newY < .04) crush += bounded((oldY - newY) * 12);
    if (oldY > .21 && oldY < .93 && Math.hypot(source.a[p], source.b[p]) < .024) {
      neutral += Math.max(0, colorShift - .014);
    }
    if (source.warmWeight[p]) {
      warmSupport += source.warmWeight[p];
      warmth += source.warmWeight[p] * Math.max(0, colorShift - .014);
    }
    // Sample both axes and compare local luminance differences in readable shadows.
    const vertical = p % 2 === 0;
    const q = p + (vertical ? width : 1);
    if (q >= count || (!vertical && q % width === 0) || oldY > .43) continue;
    const oldEdge = Math.abs(oldY - source.light[q]);
    if (oldEdge < .023 || oldEdge > .25) continue;
    edges++;
    const newEdge = Math.abs(newY - candidate.light[q]);
    edgeLoss += Math.max(0, .75 - newEdge / oldEdge);
  }
  const exposureShift = candidate.quantiles[1] - source.quantiles[1];
  const darkBudget = source.toe < .055 && source.quantiles[1] < .35 ? .019 : .045;
  const penalty = (clips * 2.8 + crush * 2.5 + neutral * 1.05) / count
    + warmth * .8 / Math.max(count * .13, warmSupport)
    + edgeLoss * .15 / Math.max(count * .043, edges)
    + Math.max(0, -exposureShift - darkBudget) * .63
    + Math.max(0, exposureShift - .095) * .42
    + Math.max(0, candidate.shoulder - Math.max(.90, source.shoulder) - .018) * .3;
  return { penalty, effect: effect / count };
}

export function referenceDistance(candidate: LookProfile, reference: LookProfile, source: LookProfile) {
  const tones = candidate.quantiles;
  const want = reference.quantiles;
  // A large exposure gap usually indicates different scene content. Keep the
  // relative range, and lower the weight on matching absolute brightness.
  const exposureWeight = Math.abs(source.quantiles[1] - want[1]) > .24 ? .12 : .43;
  let cost = exposureWeight * Math.abs(tones[1] - want[1]);
  cost += .33 * Math.abs((tones[2] - tones[0]) - (want[2] - want[0]));
  let support = 0, color = 0;
  for (let band = 0; band < 3; band++) {
    const weight = Math.sqrt(candidate.support[band] * reference.support[band]);
    support += weight;
    color += weight * (
      Math.abs(candidate.chroma[band] - reference.chroma[band]) +
      .88 * Math.abs(candidate.warmBand[band] - reference.warmBand[band]) +
      .75 * Math.abs(candidate.greenBand[band] - reference.greenBand[band])
    );
  }
  let hues = 0, hueSupport = 0;
  for (let hue = 0; hue < 6; hue++) {
    const weight = Math.sqrt(candidate.hueSupport[hue] * reference.hueSupport[hue]);
    hues += weight * (Math.abs(candidate.hueChroma[hue] - reference.hueChroma[hue])
      + .16 * Math.abs(candidate.hueLight[hue] - reference.hueLight[hue]));
    hueSupport += weight;
  }
  return cost + .85 * color / Math.max(.35, support) + .46 * hues / Math.max(.25, hueSupport);
}

export type RecommendationPixels = { data: Uint8ClampedArray; width: number };

export type ReferenceTarget = {profile: LookProfile; weight: number; family?: string}[];
export type RankedLooks = {options: Recommendation[]; close: boolean; distance: number; penalty: number; improvement: number};

function toOptions(scored: {look: Recipe; reason: string; score: number; strength: number; distance: number; penalty: number}[],
  target: ReferenceTarget, ungraded: number): RankedLooks {
  const families = new Set<string>();
  const top = [];
  for (const item of scored.sort((a,b) => b.score - a.score)) {
    const family = item.look.family ?? item.look.id;
    if (families.has(family)) continue;
    families.add(family);
    top.push(item);
    if (top.length === 4) break;
  }
  const options = top.map(({look,strength,reason}, index) => ({
    look, strength,
    detail: target.length ? (index === 0 ? '综合色彩接近程度与画质保留后首选' : '参考影调备选') : reason,
  }));
  return {options, close: top.length > 1 && top[0].score - top[1].score < .022,
    distance: top[0].distance, penalty: top[0].penalty, improvement: ungraded - top[0].distance};
}

// Render each LUT and strength once, then score it against every shortlisted target.
export function rankAgainstTargets(source: RecommendationPixels, targets: ReferenceTarget[], looks = [...authoredLooks.filter(item => item.family !== 'control'), ...socialRecipes]) {
  const {data: input, width} = source;
  const sourceStats = describe(input, width);
  const output = new Uint8ClampedArray(input.length);
  const distances = (candidate: LookProfile, target: ReferenceTarget) => {
    let total = 0, weights = 0;
    for (const {profile,weight} of target) {
      total += weight * referenceDistance(candidate, profile, sourceStats);
      weights += weight;
    }
    return total / (weights || 1);
  };
  const neutral = targets.map(target => distances(sourceStats, target));
  const scored = targets.map(() => [] as Parameters<typeof toOptions>[0]);
  for (const look of looks) {
    const prior = sceneFit(sourceStats, look);
    const best = targets.map(() => ({score: -Infinity, strength: 60, distance: 0, penalty: 0}));
    for (const strength of levels) {
      output.set(input);
      gradePixels(output, look, {strength, exposure: 0, temp: 0});
      const stats = describe(output, width);
      const {penalty, effect} = gradeQuality(sourceStats, stats, input, output, width);
      const targetEffect = sourceStats.quantiles[1] < .27 ? .032 : .044;
      targets.forEach((target,index) => {
        const distance = distances(stats,target);
        const score = target.length
          ? -3.0 * distance + .21 * prior.score - penalty - Math.abs(strength - 60) * .0003
            + (target.some(reference => reference.family === look.family && reference.family) ? .063 : 0)
          : .47 * prior.score + (look.featured ? .007 : 0) - penalty
            - Math.abs(effect - targetEffect) * .78 - Math.abs(strength - 60) * .00028;
        if (score > best[index].score) best[index] = {score,strength,distance,penalty};
      });
    }
    best.forEach((item,index) => scored[index].push({look,reason:prior.reason,...item}));
  }
  return scored.map((group,index) => toOptions(group,targets[index],neutral[index]));
}

export function rankPixelData(source: RecommendationPixels, reference: RecommendationPixels | null) {
  return rankAgainstTargets(source, [reference ? [{profile: profilePixels(reference), weight: 1}] : []])[0];
}

export function readRecommendationPixels(canvas: HTMLCanvasElement, edge = recommendationPreviewEdge) {
  const mini = canvasOf(canvas, canvas.width, canvas.height, edge);
  return mini.getContext('2d')!.getImageData(0,0,mini.width,mini.height);
}
