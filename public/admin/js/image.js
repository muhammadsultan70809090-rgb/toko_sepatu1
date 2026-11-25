export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImage(file) {
  if (!file) throw new Error('File gambar tidak ditemukan.');
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Format foto harus JPG, PNG, atau WEBP.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ukuran foto maksimal 4MB.');
  }
}

/**
 * Perkecil dan konversi foto ke WEBP sebelum diunggah. Foto kamera 4–8MB
 * biasanya turun ke ratusan KB tanpa kehilangan detail yang terlihat.
 */
export async function prepareImage(file) {
  validateImage(file);

  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}
