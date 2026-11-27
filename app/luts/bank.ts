import catalog from './catalog.json';

const gridSize = 17;
const channels = 3;
const entriesPerLook = gridSize ** 3 * channels;
let data: Uint16Array | undefined;
let pending: Promise<boolean> | undefined;

export function loadLookBank() {
  if (data) return Promise.resolve(true);
  if (pending) return pending;
  pending = fetch('/luma-luts/bank.bin')
    .then(response => {
      if (!response.ok) throw new Error('LUT bank is unavailable.');
      return response.arrayBuffer();
    })
    .then(buffer => {
      if (buffer.byteLength !== catalog.length * entriesPerLook * 2) throw new Error('Unexpected LUT bank length.');
      const words = new DataView(buffer);
      data = new Uint16Array(buffer.byteLength / 2);
      for (let i = 0; i < data.length; i++) data[i] = words.getUint16(i * 2, true);
      return true;
    })
    .catch(() => false)
    .finally(() => { pending = undefined; });
  return pending;
}

export function lookup(index: number, red: number, green: number, blue: number, out: Float64Array) {
  const values = data;
  if (!values) return false;
  const r = red * 16 / 255;
  const g = green * 16 / 255;
  const b = blue * 16 / 255;
  const ir = Math.min(r | 0, 15);
  const ig = Math.min(g | 0, 15);
  const ib = Math.min(b | 0, 15);
  const fr = r - ir;
  const fg = g - ig;
  const fb = b - ib;
  const base = index * entriesPerLook + (ir + ig * gridSize + ib * gridSize ** 2) * channels;
  const greenStep = gridSize * channels;
  const blueStep = gridSize * greenStep;
  for (let channel = 0; channel < channels; channel++) {
    const p = base + channel;
    const low = values[p] + (values[p + channels] - values[p]) * fr;
    const high = values[p + greenStep] + (values[p + greenStep + channels] - values[p + greenStep]) * fr;
    const a = low + (high - low) * fg;
    const bp = p + blueStep;
    const blueLow = values[bp] + (values[bp + channels] - values[bp]) * fr;
    const blueHigh = values[bp + greenStep] + (values[bp + greenStep + channels] - values[bp + greenStep]) * fr;
    const z = blueLow + (blueHigh - blueLow) * fg;
    out[channel] = (a + (z - a) * fb) / 257;
  }
  return true;
}

export function cubeText(index: number, name: string) {
  if (!data) return null;
  const output = new Float64Array(3);
  const lines = ['TITLE "' + name.replace(/["\r\n]/g, '') + '"', '# sRGB to sRGB. Red index changes fastest.',
    'LUT_3D_SIZE 33', 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
  for (let b = 0; b < 33; b++) {
    for (let g = 0; g < 33; g++) {
      for (let r = 0; r < 33; r++) {
        lookup(index, r * 255 / 32, g * 255 / 32, b * 255 / 32, output);
        lines.push(Array.from(output, value => (value / 255).toFixed(7)).join(' '));
      }
    }
  }
  return lines.join('\n') + '\n';
}
