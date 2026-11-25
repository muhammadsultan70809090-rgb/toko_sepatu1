import { Router } from 'express';
import crypto from 'node:crypto';
import {
  all,
  get,
  run,
  transaction,
  productSelect,
  serializeProduct,
  serializeOrder,
  getSettings,
  nowIso,
} from '../db.js';
import { HttpError, integer, optionalText } from '../validation.js';
import { sameOrigin } from '../auth.js';

export const storeRouter = Router();

const publicSettings = () => {
  const settings = getSettings();
  return {
    storeName: settings.store_name || 'SneakerSpace',
    tagline: settings.store_tagline || '',
    whatsapp: settings.whatsapp || '6282122190680',
    whatsappDisplay: settings.whatsapp_display || '0821 2219 0680',
    email: settings.email || '',
    instagram: settings.instagram || '',
    address: settings.address || '',
    hours: settings.hours || '',
    announcement: settings.announcement || '',
    heroEyebrow: settings.hero_eyebrow || '',
    heroTitle: settings.hero_title || '',
    heroSubtitle: settings.hero_subtitle || '',
    heroImage: settings.hero_image || '',
    aboutTitle: settings.about_title || '',
    aboutText: settings.about_text || '',
    bannerImage: settings.banner_image || '',
    logoText: settings.logo_text || '',
    logoImage: settings.logo_image || '',
  };
};

storeRouter.get('/', (req, res) => {
  const categories = all(
    `SELECT c.id, c.name, c.slug, c.tagline, c.icon, c.sort_order AS sortOrder,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') AS productCount
     FROM categories c ORDER BY c.sort_order, c.id`
  );
  const products = all(
    `${productSelect} WHERE p.status = 'active' ORDER BY p.featured DESC, p.created_at DESC, p.id DESC`
  ).map((row) => serializeProduct(row));

  res.json({ settings: publicSettings(), categories, products });
});

storeRouter.get('/products', (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const size = Number(req.query.size);
  const color = String(req.query.color || '').trim().toLowerCase();
  const sort = String(req.query.sort || 'featured');

  let rows = all(
    `${productSelect} WHERE p.status = 'active' ORDER BY p.featured DESC, p.created_at DESC, p.id DESC`
  ).map((row) => serializeProduct(row));

  if (search) {
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.brand.toLowerCase().includes(search) ||
        (p.category || '').toLowerCase().includes(search)
    );
  }
  if (category && category !== 'All') rows = rows.filter((p) => p.category === category);
  if (Number.isFinite(size)) rows = rows.filter((p) => p.sizes.some((s) => s.size === size));
  if (color) rows = rows.filter((p) => p.colors.some((c) => c.name.toLowerCase() === color));

  if (sort === 'low') rows.sort((a, b) => a.price - b.price);
  else if (sort === 'high') rows.sort((a, b) => b.price - a.price);
  else if (sort === 'newest') rows.sort((a, b) => b.id - a.id);
  else if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));

  res.json({ products: rows });
});

storeRouter.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isFinite(id)
    ? get(`${productSelect} WHERE p.id = ? AND p.status = 'active'`, id)
    : null;
  if (!row) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const product = serializeProduct(row);
  const related = all(
    `${productSelect} WHERE p.status = 'active' AND p.category_id = ? AND p.id <> ?
     ORDER BY p.featured DESC, p.id DESC LIMIT 3`,
    row.category_id,
    row.id
  ).map((item) => serializeProduct(item));
  res.json({ product, related, settings: publicSettings() });
});

function generateOrderCode() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `SS-${stamp}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    if (!get('SELECT id FROM orders WHERE code = ?', code)) return code;
  }
  throw new HttpError(500, 'Tidak dapat membuat nomor pesanan.');
}

storeRouter.post('/orders', sameOrigin, (req, res, next) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
    if (!items.length) throw new HttpError(400, 'Keranjang masih kosong.');

    const customerName = optionalText(body.customerName, { max: 120 });
    const customerPhone = optionalText(body.customerPhone, { max: 40 });
    const note = optionalText(body.note, { max: 500 });

    if (customerPhone && !/^[0-9+\-\s()]{6,}$/.test(customerPhone)) {
      throw new HttpError(400, 'Nomor WhatsApp tidak valid.');
    }

    const orderId = transaction(() => {
      let total = 0;
      const prepared = [];
      for (const raw of items) {
        const productId = integer(raw.productId, 'Produk', { min: 1 });
        const size = integer(raw.size, 'Ukuran', { min: 30, max: 50 });
        const qty = integer(raw.qty, 'Jumlah', { min: 1, max: 20 });
        const color = optionalText(raw.color, { max: 40 });

        const product = get(`${productSelect} WHERE p.id = ? AND p.status = 'active'`, productId);
        if (!product) throw new HttpError(400, 'Ada produk yang sudah tidak tersedia.');
        const sizeRow = get(
          'SELECT stock FROM product_sizes WHERE product_id = ? AND size = ?',
          productId,
          size
        );
        if (!sizeRow) {
          throw new HttpError(400, `Ukuran ${size} tidak tersedia untuk ${product.name}.`);
        }
        if (sizeRow.stock < qty) {
          throw new HttpError(
            400,
            `Stok ${product.name} ukuran ${size} tersisa ${sizeRow.stock} pasang.`
          );
        }
        const colors = all('SELECT name FROM product_colors WHERE product_id = ?', productId).map(
          (c) => c.name
        );
        if (colors.length && !colors.some((c) => c.toLowerCase() === color.toLowerCase())) {
          throw new HttpError(400, `Warna ${color || '-'} tidak tersedia untuk ${product.name}.`);
        }

        const subtotal = product.price * qty;
        total += subtotal;
        prepared.push({ product, size, color, qty, subtotal });
      }

      const code = generateOrderCode();
      const inserted = run(
        `INSERT INTO orders (code, customer_name, customer_phone, note, total, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        code,
        customerName,
        customerPhone,
        note,
        total
      );
      const newOrderId = Number(inserted.lastInsertRowid);

      for (const item of prepared) {
        run(
          `INSERT INTO order_items (order_id, product_id, product_name, brand, size, color, qty, price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newOrderId,
          item.product.id,
          item.product.name,
          item.product.brand,
          item.size,
          item.color,
          item.qty,
          item.product.price,
          item.subtotal
        );
        run(
          'UPDATE product_sizes SET stock = stock - ? WHERE product_id = ? AND size = ?',
          item.qty,
          item.product.id,
          item.size
        );
        run(
          `UPDATE products SET stock = COALESCE((SELECT SUM(stock) FROM product_sizes WHERE product_id = ?), 0),
           updated_at = ? WHERE id = ?`,
          item.product.id,
          nowIso(),
          item.product.id
        );
      }
      return newOrderId;
    });

    res.status(201).json({ order: serializeOrder(get('SELECT * FROM orders WHERE id = ?', orderId)) });
  } catch (error) {
    next(error);
  }
});
