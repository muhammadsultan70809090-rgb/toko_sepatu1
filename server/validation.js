export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function requiredText(value, label, { max = 400 } = {}) {
  const text = String(value ?? '').trim();
  if (!text) throw new HttpError(400, `${label} wajib diisi.`);
  if (text.length > max) throw new HttpError(400, `${label} terlalu panjang (maks ${max} karakter).`);
  return text;
}

export function optionalText(value, { max = 4000 } = {}) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new HttpError(400, `Teks terlalu panjang (maks ${max} karakter).`);
  return text;
}

export function integer(value, label, { min = 0, max = 100000000 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    throw new HttpError(400, `${label} harus berupa angka bulat.`);
  }
  if (number < min || number > max) {
    throw new HttpError(400, `${label} harus di antara ${min} dan ${max}.`);
  }
  return number;
}

export function safeUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^(https?:\/\/|\/uploads\/|\/assets\/|data:image\/)/i.test(text)) return text.slice(0, 2000);
  throw new HttpError(400, 'URL gambar tidak valid.');
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

export function orderStatus(value) {
  if (!ORDER_STATUSES.includes(value)) throw new HttpError(400, 'Status pesanan tidak dikenal.');
  return value;
}
