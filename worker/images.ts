import { adaptiveRecipe, recipes, editingPrompt, type Adjust } from '../app/film';

const PIKSO_EDIT_URL = 'https://service.pikso.art/v1/images/edits';
const PIKSO_MODEL = 'gpt-image-2';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 2 * MAX_FILE_BYTES + 64 * 1024;
const PIKSO_TIMEOUT_MS = 150_000;
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function isPhoto(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.type === 'image/jpeg' && value.size > 0 && value.size <= MAX_FILE_BYTES;
}

function validAdjustment(value: Adjust | null): value is Adjust {
  return !!value
    && Number.isFinite(value.strength) && value.strength >= 0 && value.strength <= 100
    && Number.isFinite(value.temp) && Math.abs(value.temp) <= 100
    && Number.isFinite(value.exposure) && Math.abs(value.exposure) <= 1;
}

function outputSize(form: FormData) {
  const width = Number(form.get('width'));
  const height = Number(form.get('height'));
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) return '1536x1024';

  // GPT Image 2 accepts multiples of 16 and aspect ratios from 1:3 to 3:1.
  // A long edge of 1536 also provides enough pixels for the widest ratio.
  const long = 1536;
  const short = Math.max(512, Math.round(long * Math.min(width, height) / Math.max(width, height) / 16) * 16);
  return width >= height ? long + 'x' + short : short + 'x' + long;
}

function imageDataUrl(encoded: unknown) {
  if (typeof encoded !== 'string') return null;
  const mime = encoded.startsWith('/9j/') ? 'image/jpeg'
    : encoded.startsWith('iVBORw0KGgo') ? 'image/png'
    : encoded.startsWith('UklGR') ? 'image/webp'
    : null;
  return mime ? 'data:' + mime + ';base64,' + encoded : null;
}

function providerError(status: number) {
  if (status === 401 || status === 403) return 'Pikso 账户授权失败，请联系工作台管理员。';
  if (status === 402) return 'Pikso 账户可用额度不足，请联系工作台管理员。';
  if (status === 429) return '生成服务繁忙或已达到使用额度，请稍后重试。';
  if (status === 400 || status === 422) return 'Pikso 无法处理这张照片，请更换照片后重试。';
  return 'Pikso 暂时无法完成生成，请稍后重试。';
}

export async function images(request: Request, key: string | undefined) {
  const url = new URL(request.url);

  if (url.pathname === '/api/status') return reply({ ready: Boolean(key), requiresSignIn: false });
  if (request.method !== 'POST') return reply({ error: '请从工作台提交生成请求。' }, 405);
  if (request.headers.get('Origin') !== url.origin) return reply({ error: '请从工作台提交生成请求。' }, 403);
  if (!key) return reply({ error: '站内生成服务尚未连接。' }, 503);

  const contentType = request.headers.get('content-type');
  if (!contentType?.startsWith('multipart/form-data')) return reply({ error: '无效的图像格式。' }, 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return reply({ error: '照片过大。' }, 413);

  let form: FormData;
  let adjustment: Adjust | null;
  try {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_BODY_BYTES) return reply({ error: '照片过大。' }, 413);
    form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
    adjustment = JSON.parse(String(form.get('adjust'))) as Adjust | null;
  } catch {
    return reply({ error: '无法读取请求中的照片或参数。' }, 400);
  }

  const original = form.get('original');
  const reference = form.get('reference');
  const recipeId = form.get('recipe');
  const recipe = recipeId === adaptiveRecipe.id ? adaptiveRecipe : recipes.find(item => item.id === recipeId);
  if (!recipe || !isPhoto(original) || !isPhoto(reference)) return reply({ error: '请重新选择照片和影调。' }, 400);
  if (!validAdjustment(adjustment)) return reply({ error: '影调参数超出范围。' }, 400);

  const body = new FormData();
  body.set('model', PIKSO_MODEL);
  body.set('n', '1');
  body.set('size', outputSize(form));
  body.set('output_format', 'jpeg');
  body.set('quality', 'medium');
  body.set('prompt', editingPrompt(recipe, adjustment));
  body.append('image[]', original, 'original.jpg');
  body.append('image[]', reference, 'reference.jpg');

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), PIKSO_TIMEOUT_MS);
  try {
    const response = await fetch(PIKSO_EDIT_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body,
      signal: abort.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return reply({ error: providerError(response.status) }, 502);
    }
    const payload = await response.json() as { data?: { b64_json?: string }[] };
    const image = imageDataUrl(payload.data?.[0]?.b64_json);
    if (!image) return reply({ error: 'Pikso 没有返回可显示的成片。' }, 502);
    return reply({ image });
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error('Pikso request failed', failure.name, failure.message.replaceAll(key, '[redacted]'));
    if (abort.signal.aborted) {
      return reply({ error: 'Pikso 生成超时，请稍后重试。' }, 504);
    }
    return reply({ error: 'Pikso 连接中断，请稍后重试。' }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
