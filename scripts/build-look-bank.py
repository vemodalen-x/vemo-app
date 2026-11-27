"""Build authored Luma looks from tonal probes and existing Luma studies."""
from pathlib import Path
from zipfile import ZipFile
import argparse
import hashlib
import io
import json

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parents[1]
SIZE = 17
LUMA = np.array([.2126, .7152, .0722])
CONTROL = [.0, .10, .27, .50, .73, .89, 1.]
FAMILIES = {
    'impression': ('印象派', '黄绿日照、蓝绿暗部与柔和高光。', 'fresh yellow-green light, cool blue-green shadow and an airy highlight roll-off',
                   [.012,.119,.282,.517,.759,.908,.99], .08, -.020, .029),
    'american': ('美国彩色摄影', '保留中性的底色，突出一两处饱满色块。', 'American color negative tonality, neutral daylight and clear selective color',
                 [.017,.096,.269,.514,.760,.919,.986], .035, -.009, .012),
    'renaissance': ('文艺复兴', '粉蓝、亚麻白和含蓄暖肤，柔化明暗过渡。', 'soft linen whites, powder blue and softly modeled skin in gentle film light',
                    [.039,.150,.304,.522,.733,.861,.968], -.17, -.014, .020),
    'baroque': ('巴洛克', '深棕阴影衬托烧赭与金棕高光。', 'warm sienna midtones, amber light and deep legible umber shadows',
                [.006,.068,.215,.453,.735,.901,.982], -.075, -.006, .040),
    'taiwan': ('台湾新电影', '克制饱和度，保留环境中的红色与暖光。', 'muted documentary color, slate-gray shadows and selective warm detail',
               [.016,.101,.265,.489,.718,.871,.978], -.18, -.019, .016),
    'night': ('夜景', '炭蓝暗部与琥珀高光，保留灯罩纹理。', 'charcoal blue shadows, amber practical light and protected high-luminance color',
              [.012,.087,.241,.471,.713,.883,.981], -.035, -.041, .038),
}
# Order matches the verified manifest, including two aliases and the identity control.
NAMES = """
linen-sun|亚麻晴窗|Linen Sun|renaissance
pine-dusk|松烟入暮|Pine Smoke|taiwan
silver-rain|银灰雨痕|Silver Drizzle|taiwan
ink-and-gold|墨影浮金|Ink and Gold|baroque
island-still|岛屿慢镜|Island Still|taiwan|1
noon-in-color|午后色块|Noon in Color|american|1
brick-teal|砖红与松绿|Brick and Teal|american
sienna-glow|赭石余温|Sienna Glow|baroque
cloud-linen|云间亚麻|Cloud Linen|renaissance
leaflight|叶隙微光|Light Through Leaves|impression|1
amber-grain|琥珀尘光|Amber Dust|baroque
fresh-moss|新苔沐光|New Moss|impression
umber-candle|金棕烛影|Umber by Candlelight|baroque|1
indigo-embers|靛蓝残火|Indigo Embers|night
blue-afterglow|蓝幕余焰|Afterglow in Blue|night|1
harbor-gray|港口灰蓝|Harbor Slate|taiwan
lucid-lake|晴湖倒影|Lucid Lake|impression
ivory-day|象牙晴日|Ivory Day|renaissance
vermilion-bloom|朱砂花期|Vermilion Bloom|impression
mint-haze|薄荷初雾|Mint Haze|renaissance
lemon-grove|柠檬信笺|Lemon Letter|impression
@noon-in-color
@brick-teal
honey-hour|蜂蜜时分|Honey Hour|american
linen-haze|亚麻晨雾|Linen Haze|renaissance|1
rose-parlor|蔷薇午室|Rose Parlor|renaissance
green-corner|街角青荫|Green Corner|american
wet-pavement|雨后绿街|Rainlit Avenue|taiwan
peach-air|桃色晴空|Peach Air|impression
quiet-wheat|麦色低语|Quiet Wheat|american
cobalt-rain|钴蓝静雨|Cobalt Rain|night
espresso-glow|夜半咖啡|Midnight Roast|night
mirror-light|素光原貌|Mirror Light|control
terracotta-face|陶土肖像|Terracotta Portrait|baroque
burnt-sugar|焦糖暗室|Burnt Sugar|baroque
moonlit-cafe|月下空桌|Moonlit Table|night
apricot-light|杏色日记|Apricot Notes|american
porcelain-glaze|素瓷釉光|Porcelain Glaze|renaissance
blue-hour|蓝时回声|Blue Hour Echo|night
""".strip().splitlines()


def cube(data):
    lines = data.decode('ascii').splitlines()
    dim = int(next(row.split()[1] for row in lines if row.startswith('LUT_3D_SIZE ')))
    values = np.loadtxt(io.StringIO('\n'.join(row for row in lines if row and row[0] in '0123456789.-')), dtype=np.float32)
    if values.shape != (dim**3, 3) or not np.isfinite(values).all():
        raise ValueError('Invalid LUT')
    return values.reshape(dim, dim, dim, 3)


def rgb_grid(size):
    b, g, r = np.meshgrid(*[np.linspace(0, 1, size)]*3, indexing='ij')
    return np.stack([r, g, b], axis=-1)


def evaluate(table, points):
    coord = np.moveaxis(np.clip(points[..., ::-1], 0, 1) * (len(table)-1), -1, 0)
    return np.stack([map_coordinates(table[..., c], coord, order=1, mode='nearest') for c in range(3)], axis=-1)


def characterize(table):
    neutrals = np.repeat(np.linspace(.08, .92, 9)[:, None], 3, axis=1)
    gray = evaluate(table, neutrals)
    grid = rgb_grid(9)
    transformed = evaluate(table, grid)
    span = np.ptp(transformed, axis=-1).mean() - np.ptp(grid, axis=-1).mean()
    light = gray @ LUMA
    return {
        'shadow': float(light[1] - neutrals[1, 0]),
        'midtone': float(light[4] - .5),
        'contrast': float(light[7] - light[1] - (neutrals[7, 0]-neutrals[1, 0])),
        'warm': float(gray[5:8, 0].mean()-gray[5:8, 2].mean()),
        'cool': float(gray[:3, 0].mean()-gray[:3, 2].mean()),
        'saturation': float(span),
    }


def source_pixels(scene, max_size=220):
    with Image.open(ROOT/'public'/'samples'/f's{scene}.jpg') as img:
        img.thumbnail((max_size, max_size),Image.Resampling.LANCZOS)
        return np.asarray(img.convert('RGB'), np.float32).reshape(-1,3)/255


GRID = rgb_grid(SIZE)
Y = GRID @ LUMA


def style_anchors(family):
    """Fuse only regions with actual scene samples near the lattice point."""
    estimates, weights = [], []
    for scene in range(1, 9):
        pixels = source_pixels(scene)
        lattice = np.round(pixels*(SIZE-1)).astype(int)
        histogram = np.zeros((SIZE,)*3)
        np.add.at(histogram, tuple(lattice[:, ::-1].T), 1)
        density = gaussian_filter(histogram, 1.10)
        weights.append(np.minimum(density / 2.6, 1))
        fitted = cube((ROOT/'public'/'study-assets'/f's{scene}'/family/'LUT.cube').read_bytes())
        estimates.append(evaluate(fitted, GRID))
    return np.asarray(estimates), np.asarray(weights)


def fused(anchors, weights, drop=None):
    if drop is not None:
        weights = weights.copy()
        weights[drop] = 0
    sums = weights.sum(axis=0)
    # A weak observation can guide color without dominating the authored spline.
    average = (anchors * weights[..., None]).sum(axis=0) / np.maximum(sums[..., None], 1e-5)
    gain = .53 * (1 - np.exp(-sums * 1.1))
    return average, gain[..., None]


def protect_gamut(luma, chroma):
    pos = np.where(chroma > 1e-5, (1-luma[...,None])/np.maximum(chroma,1e-5), np.inf)
    neg = np.where(chroma < -1e-5, luma[...,None]/np.maximum(-chroma,1e-5), np.inf)
    scale = np.minimum(1, np.minimum(pos,neg).min(axis=-1))
    return np.clip(luma[...,None]+chroma*scale[...,None],0,1)


def build_tone(family, traits):
    _, _, _, points, saturation, cool, warm = FAMILIES[family]
    mid = np.clip(traits['midtone'], -.18, .18)*.18
    lift = np.clip(traits['shadow'], -.10, .14)*.17
    contrast = np.clip(traits['contrast'], -.22, .22)*.13
    q = np.asarray(CONTROL)
    tone = np.asarray(points)+mid*np.sin(q*np.pi)+lift*(1-q)**2+contrast*(q-.5)*np.sin(q*np.pi)
    tone[0] = np.clip(tone[0],.004,.06)
    tone = np.maximum.accumulate(tone)
    luma = PchipInterpolator(q,tone)(Y)
    scale = 1 + saturation + .19*np.clip(traits['saturation'], -.35,.22)
    rgb = (GRID-Y[...,None])*scale
    shadow=(1-Y)**2
    warm_mass=4*Y*(1-Y)*np.clip((Y-.20)*1.8,0,1)
    tint = shadow*(cool+.13*np.clip(traits['cool'],-.15,.15)) + warm_mass*(warm+.19*np.clip(traits['warm'],-.12,.14))
    rgb += tint[...,None]*np.array([1,.08,-1.25])
    # Subtract the tint's luma so the requested tone curve stays invariant.
    rgb -= (rgb @ LUMA)[...,None]
    return protect_gamut(luma,rgb)


def finish(base, target, gain):
    difference=(target-base)*gain
    # Smooth residuals where the images inform the table; preserve unmapped regions.
    residual=gaussian_filter(difference, (.62,.62,.62,0))
    result=np.clip(base+residual,0,1)
    ix=np.arange(SIZE)
    neutral=result[ix,ix,ix]
    axis=neutral @ LUMA
    result[ix,ix,ix] += (np.maximum.accumulate(axis)-axis)[:,None]
    return np.clip(result,0,1)


def evaluate_holdout(family, traits, anchors, weights):
    base=build_tone(family,traits)
    before,after=[],[]
    for scene in range(1,9):
        target,gain=fused(anchors,weights,drop=scene-1)
        current=finish(base,target,gain)
        rgb=source_pixels(scene,170)
        gt=evaluate(anchors[scene-1],rgb)
        before.append(float(np.abs(evaluate(base,rgb)-gt).mean()*255))
        after.append(float(np.abs(evaluate(current,rgb)-gt).mean()*255))
    return dict(base=round(float(np.mean(before)),2), calibrated=round(float(np.mean(after)),2))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('source_zip', type=Path)
    args=parser.parse_args()
    profile={family:style_anchors(family) for family in FAMILIES}
    targets={key:fused(*arrays) for key,arrays in profile.items()}
    catalog, tables, review, measured = [], [], [], {}
    used={}
    with ZipFile(args.source_zip) as bundle:
        manifest=json.loads(bundle.read('LUTSPACE/manifest.json'))
        assert len(manifest)==len(NAMES)==39
        for meta, info in zip(manifest,NAMES):
            source=meta['cube'].split('/')[-1]
            if info.startswith('@'):
                main_name, digest=used[info[1:]]
                assert digest==meta['cube_sha256']
                assert hashlib.sha256(bundle.read('LUTSPACE/'+meta['cube'])).hexdigest()==digest
                main_name['aliases'].append(source)
                review.append({'source':source,'id':main_name['id'],'name':main_name['name'],'kind':'alias'})
                continue
            id, name, en, family, *flag=info.split('|')
            original=bundle.read('LUTSPACE/'+meta['cube'])
            assert hashlib.sha256(original).hexdigest()==meta['cube_sha256']
            src=cube(original)
            assert len(src)==meta['dimension']
            traits=characterize(src)
            if family=='control':
                assert np.max(np.abs(evaluate(src,GRID)-GRID))<5e-6
                color=GRID
                display='校准'
                description='保留输入颜色，作为对照与校准基准。'
                light='faithful neutral color'
            else:
                display,description,light,*_=FAMILIES[family]
                base=build_tone(family,traits)
                color=finish(base,*targets[family])
                if flag:
                    measured[family]=evaluate_holdout(family,traits,*profile[family])
            index=len(tables)
            tables.append((color*65535).round().astype('<u2'))
            look=dict(id=id,name=name,en=en,family=family,familyName=display,description=description,
                      light=light,index=index,featured=bool(flag),source=source,aliases=[])
            catalog.append(look)
            used[id]=(look,meta['cube_sha256'])
            review.append({'source':source,'id':id,'name':name,'kind':'control' if family=='control' else 'preset'})
    assert len(catalog)==len(tables)==37
    with (ROOT/'public'/'luma-luts'/'bank.bin').open('wb') as f:
        for table in tables:f.write(table.tobytes())
    (ROOT/'app'/'luts'/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(presets=len(catalog)-1,controls=1,aliases=2,holdout=measured),ensure_ascii=False))
    print('Source exports mapped:',len(review))

if __name__=='__main__':
    main()
