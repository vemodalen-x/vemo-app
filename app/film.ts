import catalog from './luts/catalog.json';
import { professionalRecipes } from './luts/professional-looks';

type ToneCurve = readonly (readonly [input: number, output: number])[];
const toneCurves: Record<string, ToneCurve> = {
  'cream-editorial': [[0, .44], [.35, .60], [.62, .75], [1, .95]],
  'mocha-editorial': [[0, .25], [.35, .43], [.65, .58], [1, .80]],
  'ivory-day': [[0, .06], [.32, .37], [.62, .73], [1, .98]],
  'noon-in-color': [[0, 0], [.30, .28], [.60, .70], [.80, .90], [1, 1]],
};

export type Recipe = {
  id: string; name: string; en: string; description: string; light: string;
  lutIndex?: number; family?: string; familyName?: string; featured?: boolean; source?: string; aliases?: string[];
  collection?: 'social' | 'professional'; highlightRolloff?: number; shadowTeal?: number; toneCurve?: ToneCurve;
  contrast: number; saturation: number; warmth: number; lift: number; split: number;
}
export const baseRecipes: Recipe[] = [
  {id:'warm', name:'暖调胶片', en:'Warm Film', description:'琥珀色高光与柔和的暗部，保留胶片般温润的层次。', light:'amber highlights, gentle filmic roll-off and softly lifted shadows', contrast:0.10,saturation:-0.12,warmth:0.115,lift:0.045,split:0.035},
  {id:'cine', name:'青橙电影', en:'Teal Cinema', description:'冷青色阴影衬托暖色高光，拉开画面的明暗层次。', light:'subtle teal shadows and motivated warm highlights, cinematic separation', contrast:0.16,saturation:-0.08,warmth:0.015,lift:0.01,split:0.17},
  {id:'nordic', name:'北欧冷调', en:'Nordic Blue', description:'以冷蓝色中间调和克制的饱和度，呈现安静清冽的氛围。', light:'cool muted blue daylight, restrained contrast and soft tonal transitions', contrast:-0.04,saturation:-0.28,warmth:-0.13,lift:0.048,split:0.015},
  {id:'mono', name:'经典黑白', en:'Silver Noir', description:'用银盐般的灰阶和饱满的深黑，把视线引向光线与纹理。', light:'silver gelatin monochrome, sculptural light and detailed black-and-white tonal separation',contrast:0.22,saturation:-1,warmth:0,lift:0.005,split:0},
  {id:'airy', name:'日系清透', en:'Soft Air', description:'抬起中间调与暗部，让柔和的颜色和细节透出来。',light:'airy luminous midtones, delicate pastels and soft directional daylight',contrast:-0.15,saturation:-0.25,warmth:0.015,lift:0.11,split:0},
  {id:'forest',name:'森系自然',en:'Forest Tone',description:'略微压暗高光，强化绿色与青色的细微差异。',light:'lush but natural forest tones, gentle directional light and clear greens',contrast:0.085,saturation:0.17,warmth:-0.035,lift:0.012,split:0.045},
  {id:'baroque',name:'巴洛克暗调',en:'Chiaroscuro',description:'金棕色亮部在深色阴影中渐次展开，以明暗塑造主体。',light:'Baroque chiaroscuro, warm sienna highlights, rich umber shadows, motivated directional illumination',contrast:0.34,saturation:-0.16,warmth:0.07,lift:-0.035,split:0.035},
  {id:'neutral',name:'自然通透',en:'True Color',description:'轻柔校正亮度与对比，让原有色彩更清晰。',light:'faithful neutral color, soft shadow recovery and balanced photographic light',contrast:0.07,saturation:0.03,warmth:0,lift:0.027,split:0}
];
export const authoredLooks: Recipe[] = catalog.map(({ index, ...look }) => ({
  ...look, lutIndex: index, toneCurve: toneCurves[look.id], contrast: 0, saturation: 0, warmth: 0, lift: 0, split: 0,
}));
export const socialRecipes: Recipe[] = [
  {id:'direct-flash',name:'闪光留影',en:'Flash Diary',family:'american',familyName:'社媒灵感',collection:'social',
    description:'清凉的闪光高光、清晰的明暗边缘和保留质感的肤色。适合夜间聚会与随拍。',
    light:'crisp existing direct-flash light, slightly cool highlights and readable skin texture',
    contrast:.20,saturation:.025,warmth:-.027,lift:.012,split:-.045,highlightRolloff:.057},
  {id:'cream-editorial',name:'奶油留白',en:'Cream Linen',family:'renaissance',familyName:'社媒灵感',collection:'social',
    description:'柔和的米白、浅灰和微暖高光。适合窗光静物、家居和轻食。',
    light:'soft warm-neutral whites, gentle midtones and pale cream without a heavy color cast',
    contrast:-.15,saturation:-.19,warmth:.037,lift:.084,split:-.014,highlightRolloff:.042,toneCurve:toneCurves['cream-editorial']},
  {id:'mocha-editorial',name:'咖棕街记',en:'Mocha Street',family:'taiwan',familyName:'社媒灵感',collection:'social',
    description:'咖棕色中间调、柔和深灰和克制的暖色，适合阴天穿搭与街角纪实。',
    light:'restrained coffee brown midtones, subdued cool gray shadows and warm editorial color',
    contrast:.045,saturation:-.24,warmth:.071,lift:.046,split:.043,highlightRolloff:.052,toneCurve:toneCurves['mocha-editorial']},
  {id:'neon-diary',name:'霓虹未眠',en:'After Hours',family:'night',familyName:'社媒灵感',collection:'social',
    description:'把雨夜的灰蓝街影推向冷青，保留红橙灯光和湿路反光的层次。适合中性底色的夜街照片。',
    light:'existing deep red neon against cyan-blue reflections, protected lights and readable shadows',
    contrast:.24,saturation:-.035,warmth:-.012,lift:.018,split:.12,shadowTeal:.34,highlightRolloff:.095},
];
export const recipes = [...socialRecipes, ...authoredLooks, ...baseRecipes, ...professionalRecipes];
export const adaptiveRecipe: Recipe = {
  id:'adaptive', name:'自动新影调', en:'Adaptive Look', description:'根据原图的亮度、对比与色彩生成的调色配方。',
  light:'match the supplied graded rendition closely, including its contrast, color balance and highlight roll-off',
  family:'adaptive', familyName:'自动新影调', contrast:0,saturation:0,warmth:0,lift:0,split:0,
};
export type Adjust = { strength:number; exposure:number; temp:number };
export const defaults:Adjust={strength:75,exposure:0,temp:0};
export function editingPrompt(recipe:Recipe,a:Adjust) {
  return 'Edit the FIRST photograph, using the SECOND image only as a reference for the color grade. Create a single photographic image. Style: '+recipe.en+'. Lighting: '+recipe.light+'. Grade strength: '+a.strength+'%. Relative exposure compensation: '+a.exposure+' EV; additional warmth on a -100 to 100 scale: '+a.temp+'. Preserve the original identity, faces, pose, objects, framing, aspect ratio, perspective and existing light direction. Keep natural textures and credible local illumination. Do not invent objects, add text or change the composition.';
}
