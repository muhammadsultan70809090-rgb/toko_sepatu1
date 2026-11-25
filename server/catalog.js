import { get, all, run, recomputeStock, transaction, productSelect, serializeProduct } from './db.js';
import { HttpError, integer, optionalText, requiredText, safeUrl, slugify, orderStatus } from './validation.js';

export function parseProductPayload(body = {}) {
  const name = requiredText(body.name, 'Nama produk', { max: 120 });
  const brand = requiredText(body.brand, 'Merek', { max: 80 });
  const categoryId = integer(body.categoryId, 'Kategori', { min: 1 });
  const price = integer(body.price, 'Harga', { min: 0, max: 500000000 });
  const material = optionalText(body.material, { max: 160 });
  const description = optionalText(body.description, { max: 2000 });
  const image = safeUrl(body.image);
  const badge = optionalText(body.badge, { max: 30 });
  const status = body.status === 'draft' ? 'draft' : 'active';
  const featured = body.featured ? 1 : 0;

  if (!get('SELECT id FROM categories WHERE id = ?', categoryId)) {
    throw new HttpError(400, 'Kategori tidak ditemukan.');
  }

  const sizes = [];
  if (Array.isArray(body.sizes)) {
    for (const entry of body.sizes) {
      if (entry == null) continue;
      const size = integer(entry.size, 'Ukuran', { min: 30, max: 50 });
      const stock = integer(entry.stock, 'Stok ukuran', { min: 0, max: 10000 });
      if (!sizes.some((s) => s.size === size)) sizes.push({ size, stock });
    }
  }
  sizes.sort((a, b) => a.size - b.size);
  if (!sizes.length) throw new HttpError(400, 'Tambahkan minimal satu ukuran EU.');

  const colors = [];
  if (Array.isArray(body.colors)) {
    for (const entry of body.colors) {
      const colorName = String(entry?.name ?? '').trim();
      if (!colorName) continue;
      const hex = /^#[0-9a-f]{3,8}$/i.test(String(entry?.hex ?? ''))
        ? String(entry.hex)
        : '#cccccc';
      if (!colors.some((c) => c.name.toLowerCase() === colorName.toLowerCase())) {
        colors.push({ name: colorName.slice(0, 40), hex });
      }
    }
  }
  if (!colors.length) throw new HttpError(400, 'Tambahkan minimal satu warna.');

  // undefined = jangan sentuh frame yang sudah ada (dikelola 360° Image Manager).
  const spinFrames = parseSpinFrames(body.spinFrames);

  return {
    name,
    brand,
    categoryId,
    price,
    material,
    description,
    image,
    badge,
    status,
    featured,
    sizes,
    colors,
    spinFrames,
    stock: sizes.reduce((sum, item) => sum + item.stock, 0),
  };
}

function writeRelations(productId, payload) {
  run('DELETE FROM product_sizes WHERE product_id = ?', productId);
  for (const size of payload.sizes) {
    run(
      'INSERT INTO product_sizes (product_id, size, stock) VALUES (?, ?, ?)',
      productId,
      size.size,
      size.stock
    );
  }
  run('DELETE FROM product_colors WHERE product_id = ?', productId);
  for (const color of payload.colors) {
    run('INSERT INTO product_colors (product_id, name, hex) VALUES (?, ?, ?)', productId, color.name, color.hex);
  }
  if (payload.spinFrames) {
    run('DELETE FROM spin_frames WHERE product_id = ?', productId);
    payload.spinFrames.forEach((url, index) => {
      run('INSERT INTO spin_frames (product_id, url, position) VALUES (?, ?, ?)', productId, url, index);
    });
  }
}

export const MAX_SPIN_FRAMES = 36;

export function parseSpinFrames(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new HttpError(400, 'Daftar foto 360° tidak valid.');
  const frames = [];
  for (const entry of value) {
    const url = safeUrl(entry);
    if (url) frames.push(url);
  }
  if (frames.length > MAX_SPIN_FRAMES) {
    throw new HttpError(400, `Maksimal ${MAX_SPIN_FRAMES} foto 360° per produk.`);
  }
  return frames;
}

export function createProduct(payload) {
  return transaction(() => {
    const result = run(
      `INSERT INTO products (name, brand, category_id, price, image, description, material, stock, status, badge, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.name,
      payload.brand,
      payload.categoryId,
      payload.price,
      payload.image,
      payload.description,
      payload.material,
      payload.stock,
      payload.status,
      payload.badge,
      payload.featured
    );
    const id = Number(result.lastInsertRowid);
    writeRelations(id, payload);
    return id;
  });
}

export function updateProduct(id, payload) {
  return transaction(() => {
    run(
      `UPDATE products SET name = ?, brand = ?, category_id = ?, price = ?, image = ?, description = ?,
         material = ?, stock = ?, status = ?, badge = ?, featured = ?, updated_at = datetime('now')
       WHERE id = ?`,
      payload.name,
      payload.brand,
      payload.categoryId,
      payload.price,
      payload.image,
      payload.description,
      payload.material,
      payload.stock,
      payload.status,
      payload.badge,
      payload.featured,
      id
    );
    writeRelations(id, payload);
    recomputeStock(id);
    return id;
  });
}

export function categoryPayload(body = {}) {
  const name = requiredText(body.name, 'Nama kategori', { max: 60 });
  const tagline = optionalText(body.tagline, { max: 120 });
  const icon = optionalText(body.icon, { max: 60 }) || 'fa-shoe-prints';
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  let slug = slugify(name);
  if (!slug) throw new HttpError(400, 'Nama kategori tidak valid.');
  return { name, tagline, icon, slug, sortOrder };
}

function ensureUniqueCategory(slug, name, exceptId = 0) {
  const clash = get(
    'SELECT id FROM categories WHERE (slug = ? OR lower(name) = lower(?)) AND id <> ?',
    slug,
    name,
    exceptId
  );
  if (clash) throw new HttpError(409, 'Kategori dengan nama tersebut sudah ada.');
}

export function createCategory(body) {
  const payload = categoryPayload(body);
  ensureUniqueCategory(payload.slug, payload.name);
  const result = run(
    'INSERT INTO categories (name, slug, tagline, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
    payload.name,
    payload.slug,
    payload.tagline,
    payload.icon,
    payload.sortOrder
  );
  return Number(result.lastInsertRowid);
}

export function updateCategory(id, body) {
  const existing = get('SELECT * FROM categories WHERE id = ?', id);
  if (!existing) throw new HttpError(404, 'Kategori tidak ditemukan.');
  const payload = categoryPayload(body);
  ensureUniqueCategory(payload.slug, payload.name, id);
  run(
    'UPDATE categories SET name = ?, slug = ?, tagline = ?, icon = ?, sort_order = ? WHERE id = ?',
    payload.name,
    payload.slug,
    payload.tagline,
    payload.icon,
    payload.sortOrder,
    id
  );
  return id;
}

export function deleteCategory(id) {
  const existing = get('SELECT * FROM categories WHERE id = ?', id);
  if (!existing) throw new HttpError(404, 'Kategori tidak ditemukan.');
  const used = get('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', id).total;
  if (used > 0) {
    throw new HttpError(409, `Kategori masih dipakai oleh ${used} produk. Pindahkan produknya terlebih dahulu.`);
  }
  run('DELETE FROM categories WHERE id = ?', id);
}

export function listProducts({ includeDraft = false } = {}) {
  const rows = all(
    `${productSelect} ${includeDraft ? '' : "WHERE p.status = 'active'"} ORDER BY p.featured DESC, p.created_at DESC, p.id DESC`
  );
  return rows.map((row) => serializeProduct(row));
}

export { orderStatus };
