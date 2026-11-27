import type { Recipe } from '../film';
import type { ToneId } from './tones';

type ProfessionalLook = Pick<Recipe, 'id' | 'name' | 'en' | 'description' | 'light' | 'toneCurve' | 'saturation' | 'warmth' | 'split'> & {
  tone: ToneId;
  sourceLook: string;
  strength: number;
  note: string;
};

export const professionalLooks: readonly ProfessionalLook[] = [
  {
    id: 'window-veil', name: '晴纱微光', en: 'Window Veil', tone: 'high-short', sourceLook: 'airy', strength: 95,
    description: '抬高窗边暗面，保留窗纱的白与陶杯的微暖差异。适合浅色家居和漫射窗光。',
    light: 'bright, narrow-range window light, soft neutral whites, and intact curtain texture',
    note: '比较陶杯底部、窗台和窗帘褶皱。暗面被抬起后，亮色物件仍能分开。',
    toneCurve: [[0, .44], [.30, .63], [.65, .78], [1, .96]], saturation: -.23, warmth: .018, split: -.012,
  },
  {
    id: 'white-petals', name: '白瓣晨露', en: 'White Petals', tone: 'high-short', sourceLook: 'mint-haze', strength: 95,
    description: '用浅绿衬托偏冷的花瓣白，保持柔和的高亮层次。适合白花和植物静物。',
    light: 'delicate cool whites, pale botanical greens, and closely spaced light tones',
    note: '看花心和花瓣重叠处的细小灰阶。用浅绿隔开叶片和包花纸。',
    toneCurve: [[0, .47], [.32, .66], [.68, .81], [1, .96]], saturation: -.28, warmth: -.019, split: .012,
  },
  {
    id: 'coastal-mist', name: '海雾浅蓝', en: 'Coastal Mist', tone: 'high-short', sourceLook: 'cloud-linen', strength: 95,
    description: '收窄阴天人像的明暗，留下浅蓝海天和低饱和肤色。适合海边散射光。',
    light: 'pale coastal blue, diffused overcast light, and subtle dimensionality in skin',
    note: '暗发变柔和，海天靠近浅蓝灰。观察肤色在偏冷环境里是否仍有暖意。',
    toneCurve: [[0, .44], [.31, .59], [.66, .80], [1, .98]], saturation: -.22, warmth: -.020, split: .022,
  },
  {
    id: 'linen-daybreak', name: '晨白亚麻', en: 'Linen Daybreak', tone: 'high-short', sourceLook: 'linen-sun', strength: 100,
    description: '将晨光人像收进柔和的浅灰与亚麻白。适合浅衣、雾面背景和窗边肖像。',
    light: 'lifted linen whites and a softly compressed range with nuanced fabric and warm-neutral skin',
    note: '看白衣、脸侧与窗边的浅灰过渡。留意亮区边缘和衣料褶皱。',
    toneCurve: [[0, .49], [.30, .62], [.64, .79], [1, .96]], saturation: -.30, warmth: .022, split: .014,
  },
  {
    id: 'fjord-pale-light', name: '雪湾浅晴', en: 'Fjord Pale Light', tone: 'high-medium', sourceLook: 'nordic', strength: 100,
    description: '提亮雪岸和雾天，保留蓝灰水面与湿石的中间调。适合雪景和冬季海岸。',
    light: 'clean bright snow, cold slate water, and measured contrast in rocks and cloud',
    note: '从积雪看到海水和岸石。中灰留得够多，雪面仍是画面最亮的区域。',
    toneCurve: [[0, .20], [.21, .40], [.49, .70], [.77, .87], [1, 1]], saturation: -.22, warmth: -.035, split: .022,
  },
  {
    id: 'peach-horizon', name: '桃霞浮岸', en: 'Peach Horizon', tone: 'high-medium', sourceLook: 'peach-air', strength: 100,
    description: '提亮桃色霞光与浅色海岸，蓝灰水面和近处树枝留有体积。适合海边晚霞。',
    light: 'soft peach light on the horizon, open pale midtones, and retained bluish shadows',
    note: '比较桃色天空、海面和前景暗枝。少量中灰让浅色晚霞有空间感。',
    toneCurve: [[0, .21], [.21, .37], [.49, .71], [.76, .89], [1, .99]], saturation: -.15, warmth: .032, split: .055,
  },
  {
    id: 'apricot-tea', name: '杏蜜早茶', en: 'Apricot Tea', tone: 'high-medium', sourceLook: 'apricot-light', strength: 100,
    description: '增强餐盘和杏橙亮面，保留桌布阴影和烘焙纹理。适合早餐与甜点。',
    light: 'warm golden apricot highlights, readable neutral plates, and soft fabric shade',
    note: '看糕点的金色表面和桌布灰影。高亮提高后，烘焙纹理仍清楚。',
    toneCurve: [[0, .13], [.22, .39], [.46, .69], [.78, .92], [1, 1]], saturation: .02, warmth: .032, split: .024,
  },
  {
    id: 'sunlit-whiskers', name: '日晒绒须', en: 'Sunlit Whiskers', tone: 'high-medium', sourceLook: 'neutral', strength: 100,
    description: '打开窗光下的中亮区，保留橘毛、深色花纹和白色毛尖。适合浅背景宠物照。',
    light: 'airy window light, bright detailed white fur, and structured darker markings',
    note: '比较白色前爪、杏橘脸颊和深色斑纹。眼睛周围留有清晰的中灰过渡。',
    toneCurve: [[0, .23], [.24, .49], [.41, .69], [.74, .88], [1, 1]], saturation: -.08, warmth: .017, split: .005,
  },
  {
    id: 'shutters-and-sun', name: '白墙树影', en: 'Shutters and Sun', tone: 'high-long', sourceLook: 'green-corner', strength: 100,
    description: '扩大日晒白墙与树荫的亮度距离，保留枝叶和百叶窗的深色轮廓。',
    light: 'bright sunlit masonry with deep architectural shadows and authentic foliage',
    note: '先看门前白墙，再看百叶窗和树荫。受光面积占主导，深暗轮廓依旧清楚。',
    toneCurve: [[0, 0], [.16, .10], [.31, .36], [.43, .75], [.75, .94], [1, 1]], saturation: -.02, warmth: .012, split: .036,
  },
  {
    id: 'rose-window', name: '蔷薇窗影', en: 'Rose Window', tone: 'high-long', sourceLook: 'rose-parlor', strength: 95,
    description: '提亮窗光和玫瑰色衣料，用深发色保留肖像的明暗跨度。适合柔光人像。',
    light: 'high-key window light, full deep hair values, and muted rose colors with realistic skin',
    note: '看窗帘高光、粉色衣料和深发。柔光人像也可以同时拥有较亮的基调和宽灰阶。',
    toneCurve: [[0, .01], [.22, .16], [.48, .53], [.65, .81], [1, 1]], saturation: -.11, warmth: .021, split: .024,
  },
  {
    id: 'lemon-noontide', name: '柠光午后', en: 'Lemon Noontide', tone: 'high-long', sourceLook: 'lemon-grove', strength: 100,
    description: '拉开受光柠檬与叶下阴影。金黄明亮，冷绿和石墙深色仍有层次。',
    light: 'luminous citrus yellow and bright masonry supported by deep leafy shadows',
    note: '观察阳光直射的柠檬、浅色石墙和背光枝叶，亮部与暗部都保留纹理。',
    toneCurve: [[0, 0], [.18, .11], [.35, .34], [.48, .71], [.78, .95], [1, 1]], saturation: .04, warmth: .018, split: .047,
  },
  {
    id: 'island-whites', name: '海岛炙白', en: 'Island Whites', tone: 'high-long', sourceLook: 'island-still', strength: 100,
    description: '提亮海岛巷口的石灰墙，用车底和檐下深灰建立空间。适合正午建筑和旅行街景。',
    light: 'clean bright island walls, soft blue accents, and deep shadows under ledges and vehicles',
    note: '比较受光折角、浅蓝车身和檐底阴影。浅色面积大，画面里仍保留深暗端。',
    toneCurve: [[0, 0], [.17, .08], [.35, .36], [.49, .73], [.78, .94], [1, 1]], saturation: -.14, warmth: -.004, split: .031,
  },
  {
    id: 'harbor-fog', name: '雾泊青灰', en: 'Harbor Fog', tone: 'mid-short', sourceLook: 'harbor-gray', strength: 100,
    description: '将阴天海港收到青灰中间调。水面、船身和天空靠近，却仍有清楚的轮廓。',
    light: 'quiet blue-gray midtones, softly compressed contrast, and clear boat silhouettes',
    note: '看码头和海水的暗面抬起后，船身还能否从灰蓝背景中分开。',
    toneCurve: [[0, .28], [.32, .40], [.67, .58], [1, .72]], saturation: -.31, warmth: -.023, split: .012,
  },
  {
    id: 'wheat-hush', name: '麦影轻声', en: 'Wheat Hush', tone: 'mid-short', sourceLook: 'quiet-wheat', strength: 95,
    description: '收敛晴天田野的亮暗，让麦穗、篱栅和树影落在柔和暖灰内。',
    light: 'gently compressed earthy wheat tones, soft beige highlights, and visible timber detail',
    note: '从麦秆高光看到木篱灰影，细节主要依靠细小的明暗渐变分离。',
    toneCurve: [[0, .28], [.30, .39], [.68, .55], [1, .72]], saturation: -.22, warmth: .036, split: .025,
  },
  {
    id: 'muted-lotus', name: '荷色轻染', en: 'Muted Lotus', tone: 'mid-short', sourceLook: 'vermilion-bloom', strength: 95,
    description: '让粉荷与叶绿停留在相近的中间调，花朵仍由色彩和形状突出。',
    light: 'compressed middle values with muted pink petals, calm green foliage, and delicate local detail',
    note: '比较花瓣亮面与背景叶片，明暗收窄后留意粉绿之间的色彩分离。',
    toneCurve: [[0, .28], [.30, .39], [.68, .57], [1, .71]], saturation: -.12, warmth: .005, split: -.004,
  },
  {
    id: 'matte-vessels', name: '灰釉器物', en: 'Matte Vessels', tone: 'mid-short', sourceLook: 'mirror-light', strength: 100,
    description: '压低白台和深蓝釉之间的反差，保留器物的红、黄、蓝辨识度。',
    light: 'restrained matte middle tones, clear primary ceramic colors, and soft contact shadows',
    note: '比较底座与三个器物的接触阴影。在较窄的亮度范围内观察釉色差异。',
    toneCurve: [[0, .29], [.33, .42], [.68, .60], [1, .74]], saturation: -.10, warmth: -.009, split: .006,
  },
  {
    id: 'flash-bichrome', name: '银闪双极', en: 'Flash Bichrome', tone: 'full-long', sourceLook: 'direct-flash', strength: 100,
    description: '将直闪聚会照片推向亮白与深黑两端，突出白衣和面部受光轮廓。',
    light: 'graphic monochrome direct flash, distinctly separate black and white masses with little middle gray',
    note: '白衣与闪光肤色汇向亮端，夜色背景和黑衣落在暗端。观察两端各自的占比。',
    toneCurve: [[0, .012], [.23, .06], [.34, .14], [.41, .88], [.60, .97], [1, .99]], saturation: -1, warmth: 0, split: 0,
  },
  {
    id: 'noir-platform', name: '站台剪影', en: 'Noir Platform', tone: 'full-long', sourceLook: 'cine', strength: 100,
    description: '让地铁出口的直射日光与暗影形成近黑近白的剪影。适合几何线条鲜明的街头。',
    light: 'mostly black and white graphic masses, deep transit shadows and strong daylight edges',
    note: '看斜向日光如何把画面切成两块，人物细节由亮暗边界留下。',
    toneCurve: [[0, .01], [.15, .055], [.23, .12], [.30, .89], [.57, .97], [1, .995]], saturation: -1, warmth: 0, split: 0,
  },
  {
    id: 'sienna-print', name: '赤陶暗印', en: 'Sienna Print', tone: 'full-long', sourceLook: 'terracotta-face', strength: 100,
    description: '把侧光肖像处理成偏暖的深黑和亮象牙两端，保留陶土色的微弱暖意。',
    light: 'very wide split between near-black shadows and ivory highlights with restrained sienna color',
    note: '看鼻梁、受光颧骨和暗侧发际。中间灰阶少，但原有侧光方向仍然可见。',
    toneCurve: [[0, .015], [.21, .05], [.29, .12], [.36, .89], [.64, .96], [1, .99]], saturation: -.83, warmth: .040, split: .028,
  },
  {
    id: 'ink-on-paper', name: '石街墨印', en: 'Ink on Paper', tone: 'full-long', sourceLook: 'brick-teal', strength: 100,
    description: '用偏冷的墨黑和纸白突出街角的建筑轮廓与骑行剪影。',
    light: 'graphic ink-black shadows and cool paper-white light, preserving the street geometry',
    note: '观察地面受光与窗洞深影，直方图中间让出空间，亮暗形状成了主要信息。',
    toneCurve: [[0, .016], [.22, .05], [.30, .105], [.39, .90], [.65, .963], [1, .99]], saturation: -.92, warmth: -.024, split: .004,
  },
];

export const professionalRecipes: Recipe[] = professionalLooks.map(
  ({ id, name, en, description, light, toneCurve, saturation, warmth, split }) => ({
    id, name, en, description, light, toneCurve, saturation, warmth, split,
    family: 'professional', familyName: '专业影调', collection: 'professional', contrast: 0, lift: 0,
  }),
);
