/**
 * Penyimpanan gambar produk.
 *
 * - Cloudinary dipakai bila CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY dan
 *   CLOUDINARY_API_SECRET tersedia. URL publiknya permanen dan dioptimasi
 *   otomatis (format + kualitas + lebar).
 * - Tanpa kredensial, gambar disimpan di disk (UPLOAD_DIR) agar pengembangan
 *   lokal tetap berjalan. Di host tanpa disk persisten gambar ini sementara.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from './validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uploadDir =
  process.env.UPLOAD_DIR ||
  (process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

export const storageProvider = cloudName && apiKey && apiSecret ? 'cloudinary' : 'local';

const apiBase = String(process.env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com').replace(
  /\/$/,
  ''
);

const EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const safeSegment = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40) || 'draft';

/** Sisipkan transformasi delivery Cloudinary agar gambar ringan & format modern. */
export function optimizeImageUrl(url, width = 1600) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return url;
  const transformation = `f_auto,q_auto,c_limit,w_${width}`;
  if (url.includes(`/upload/${transformation}/`)) return url;
  return url.replace('/upload/', `/upload/${transformation}/`);
}

async function uploadToCloudinary({ buffer, mimetype, originalname, productId, width }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `sneakerspace/products/${safeSegment(productId)}`;
  // Cloudinary menandatangani parameter yang diurutkan alfabetis.
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const form = new FormData();
  const ext = EXTENSIONS.get(mimetype) || '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  form.append('file', new Blob([buffer], { type: mimetype }), originalname || filename);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  let response;
  try {
    response = await fetch(
      `${apiBase}/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      { method: 'POST', body: form }
    );
  } catch (error) {
    console.error('[storage] Cloudinary tidak dapat dihubungi', error);
    throw new HttpError(502, 'Penyimpanan cloud tidak dapat dihubungi. Coba lagi.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.secure_url) {
    console.error('[storage] Cloudinary menolak unggahan', response.status, data?.error?.message);
    throw new HttpError(
      502,
      data?.error?.message || 'Penyimpanan cloud menolak gambar. Periksa konfigurasi Cloudinary.'
    );
  }
  return optimizeImageUrl(data.secure_url, width || 1600);
}

async function uploadToLocal({ buffer, mimetype, productId }) {
  const ext = EXTENSIONS.get(mimetype) || '.jpg';
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  // Foto tetap dikelompokkan per produk agar mudah ditelusuri.
  const folder = path.join(uploadDir, safeSegment(productId));
  await fsp.mkdir(folder, { recursive: true });
  await fsp.writeFile(path.join(folder, name), buffer);
  return `/uploads/${safeSegment(productId)}/${name}`;
}

export async function storeImage({ buffer, mimetype, originalname, productId = 'draft', width }) {
  if (!buffer?.length) throw new HttpError(400, 'File gambar kosong.');
  if (storageProvider === 'cloudinary') {
    return uploadToCloudinary({ buffer, mimetype, originalname, productId, width });
  }
  return uploadToLocal({ buffer, mimetype, productId });
}

export const storageInfo = () => ({
  provider: storageProvider,
  persistent: storageProvider === 'cloudinary',
});
