export const photoFileTypes = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
const supported = new Set(photoFileTypes.split(',').filter(type => type.startsWith('image/')));

export function checkPhotoFile(file: File) {
  const compatible = supported.has(file.type) ||
    ((!file.type || file.type === 'application/octet-stream') && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name));
  if (!compatible || file.size === 0 || file.size > 25 * 1024 * 1024) {
    throw new Error('请选择 25 MB 以内的 JPG、PNG、WebP 或 HEIC 照片。');
  }
}

export function readImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('这张照片无法读取。如果是 HEIC，请转换为 JPG 后重试。'));
    image.src = src;
  });
}
