import {type Recipe,type Adjust} from './film';
import {lookup} from './luts/bank';
export function canvasOf(image:CanvasImageSource,w:number,h:number,max:number) {
  const scale=Math.min(1,max/Math.max(w,h)), c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*scale)); c.height=Math.max(1,Math.round(h*scale));
  const ctx=c.getContext('2d',{willReadFrequently:true})!;
  ctx.fillStyle='#151615';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);
  return c;
}
const clamp=(v:number)=>Math.min(255,Math.max(0,v));
function toneOffsets(curve: Recipe['toneCurve']) {
  if (!curve) return null;
  let segment = 1;
  return Float64Array.from({length: 256}, (_, level) => {
    const y = level / 255;
    while (y > curve[segment][0] && segment < curve.length - 1) segment++;
    const [x0, y0] = curve[segment - 1];
    const [x1, y1] = curve[segment];
    return 255 * (y0 + (y1 - y0) * (y - x0) / (x1 - x0) - y);
  });
}

function gradeTransform(r: Recipe, adj: Adjust) {
  const a=adj.strength/100, exp=Math.pow(2,adj.exposure), wt=adj.temp*.18;
  const offsets = toneOffsets(r.toneCurve);
  const offset = (red: number, green: number, blue: number) => {
    if (!offsets) return 0;
    const level = clamp(.2126 * red + .7152 * green + .0722 * blue);
    const low = Math.floor(level);
    return offsets[low] + (offsets[Math.min(low + 1, 255)] - offsets[low]) * (level - low);
  };
  return (R: number,G: number,B: number,mapped: Float64Array) => {
    if (r.lutIndex !== undefined && lookup(r.lutIndex,R,G,B,mapped)) {
      const tone = offset(mapped[0], mapped[1], mapped[2]);
      mapped[0]=clamp((R+a*(mapped[0]+tone-R)+wt)*exp);
      mapped[1]=clamp((G+a*(mapped[1]+tone-G))*exp);
      mapped[2]=clamp((B+a*(mapped[2]+tone-B)-wt)*exp);
      return;
    }
    const lum=.2126*R+.7152*G+.0722*B,y=lum/255;
    const lift=r.lift*255*(1-y)*(1-y);
    const rolloff=(r.highlightRolloff??0)*255*Math.max(0,(y-.63)/.37)**2;
    const shift=(lum-117)*r.contrast+lift-rolloff;
    const warmth=255*(r.warmth*(.35+.65*y)+r.split*(y-.43));
    // Protect existing amber and red practical lights while tinting the
    // gray-blue shadows and midtones. The same transform also exports .cube.
    const shadow=Math.max(0,Math.min(1,(.76-y)/.61));
    const warmLight=Math.max(0,Math.min(1,(R-Math.max(G,B)*.85)/75));
    const teal=255*(r.shadowTeal??0)*shadow*shadow*(1-.86*warmLight);
    const red = (R-lum)*r.saturation+shift+warmth-teal*.28;
    const green = (G-lum)*r.saturation+shift+warmth*.075+teal*.22;
    const blue = (B-lum)*r.saturation+shift-warmth+teal*.48;
    const tone = offset(R+red,G+green,B+blue);
    mapped[0]=clamp((R+a*(red+tone)+wt)*exp);
    mapped[1]=clamp((G+a*(green+tone))*exp);
    mapped[2]=clamp((B+a*(blue+tone)-wt)*exp);
  };
}
export function gradePixels(d: Uint8ClampedArray, r: Recipe, adj: Adjust) {
  const render=gradeTransform(r,adj), mapped=new Float64Array(3);
  for(let i=0;i<d.length;i+=4) {
    render(d[i],d[i+1],d[i+2],mapped);
    d[i]=mapped[0];d[i+1]=mapped[1];d[i+2]=mapped[2];
  }
}
export function currentCube(recipe: Recipe, adjustment: Adjust) {
  const render=gradeTransform(recipe,adjustment), mapped=new Float64Array(3);
  const title=recipe.en.replace(/["\r\n]/g,'');
  const lines=['TITLE "'+title+' '+adjustment.strength+'%"',
    '# sRGB to sRGB. Active strength, exposure and temperature are baked in.',
    'LUT_3D_SIZE 33','DOMAIN_MIN 0.0 0.0 0.0','DOMAIN_MAX 1.0 1.0 1.0'];
  for(let b=0;b<33;b++){
    for(let g=0;g<33;g++){
      for(let r=0;r<33;r++){
        render(r*255/32,g*255/32,b*255/32,mapped);
        lines.push(Array.from(mapped,value=>(value/255).toFixed(7)).join(' '));
      }
    }
  }
  return lines.join('\n')+'\n';
}
export function grade(src:HTMLCanvasElement,dest:HTMLCanvasElement,r:Recipe,adj:Adjust) {
  if(dest.width!==src.width)dest.width=src.width;if(dest.height!==src.height)dest.height=src.height;
  const ctx=dest.getContext('2d',{willReadFrequently:true})!;
  const data=src.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,src.width,src.height);
  gradePixels(data.data,r,adj);
  ctx.putImageData(data,0,0);
}
export function inspect(src:HTMLCanvasElement){
  const small=canvasOf(src,src.width,src.height,180),d=small.getContext('2d')!.getImageData(0,0,small.width,small.height).data;
  const hist=Array.from({length:3},()=>new Array(64).fill(0)), colors=new Map<number,number>();
  let sum=0,squared=0,temperature=0,saturation=0;const n=d.length/4;
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2],y=(.2126*r+.7152*g+.0722*b)/255;
    sum+=y;squared+=y*y;temperature+=(r-b)/255;saturation+=(Math.max(r,g,b)-Math.min(r,g,b))/255;
    hist[0][r>>2]++;hist[1][g>>2]++;hist[2][b>>2]++;
    const k=((r>>5)<<6)|((g>>5)<<3)|(b>>5);colors.set(k,(colors.get(k)||0)+1);
  }
  const rgb=(k:number)=>[((k>>6)&7)*32+16,((k>>3)&7)*32+16,(k&7)*32+16];
  const ranked=[...colors.keys()].sort((a,b)=>colors.get(b)!-colors.get(a)!);
  const palette:number[][]=[];
  for(const k of ranked){const p=rgb(k);if(palette.every(q=>p.reduce((s,v,i)=>s+(v-q[i])**2,0)>2200))palette.push(p);if(palette.length===5)break;}
  const l=sum/n,contrast=Math.sqrt(Math.max(0,squared/n-l*l)),warmth=temperature/n;
  const max=Math.max(...hist.flat());
  return {l,contrast,warmth,s:saturation/n,palette:palette.sort((a,b)=>a.reduce((s,v)=>s+v,0)-b.reduce((s,v)=>s+v,0)).map(p=>'#'+p.map(x=>x.toString(16).padStart(2,'0')).join('')),
    curves:hist.map(h=>'M 0 64 '+h.map((v,i)=>'L '+(i*4)+' '+(63-60*Math.sqrt((v+.55*(h[i-1]??v)+.55*(h[i+1]??v))/(2.1*max)))).join(' ')+' L 252 64 Z'),
    tags:[l<.32?'低调光线':l>.62?'明亮画面':'均衡曝光',contrast>.23?'高对比':'柔和对比',warmth>.045?'暖色倾向':warmth<-.035?'冷色倾向':'中性色调']};
}
