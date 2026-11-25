import { Router } from 'express';
import {
  all,
  db,
  get,
  getSettings,
  run,
  saveSetting,
  serializeOrder,
  serializeProduct,
  transaction,
} from '../db.js';
import { requireAuth, sameOrigin } from '../auth.js';
import {
  createCategory,
  createProduct,
  deleteCategory,
  listProducts,
  MAX_SPIN_FRAMES,
  parseProductPayload,
  parseSpinFrames,
  updateCategory,
  updateProduct,
} from '../catalog.js';
import { HttpError, integer } from '../validation.js';

export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(sameOrigin);

/* ---------------------------------- stats --------------------------------- */

adminRouter.get('/dashboard', (req, res) => {
  const totalProducts = get("SELECT COUNT(*) AS total FROM products WHERE status = 'active'").total;
  const totalDraft = get("SELECT COUNT(*) AS total FROM products WHERE status = 'draft'").total;
  const totalCategories = get('SELECT COUNT(*) AS total FROM categories').total;
  const totalStock = get('SELECT COALESCE(SUM(stock), 0) AS total FROM products').total;
  const totalOrders = get('SELECT COUNT(*) AS total FROM orders').total;
  const pendingOrders = get("SELECT COUNT(*) AS total FROM orders WHERE status = 'pending'").total;
  const revenue = get(
    "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status <> 'cancelled'"
  ).total;

  const lowStock = all(
    `SELECT p.id, p.name, p.brand, p.stock, p.image
     FROM products p WHERE p.stock > 0 AND p.stock <= 5 ORDER BY p.stock LIMIT 6`
  );
  const outOfStock = get('SELECT COUNT(*) AS total FROM products WHERE stock = 0').total;

  const topProducts = all(
    `SELECT oi.product_name AS name, oi.brand, SUM(oi.qty) AS sold, SUM(oi.subtotal) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status <> 'cancelled'
     GROUP BY oi.product_name, oi.brand ORDER BY sold DESC LIMIT 5`
  );

  const recentOrders = all('SELECT * FROM orders ORDER BY id DESC LIMIT 6').map((row) => ({
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
  }));

  const statusRows = all('SELECT status, COUNT(*) AS total FROM orders GROUP BY status');
  const statusBreakdown = Object.fromEntries(statusRows.map((r) => [r.status, r.total]));

  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const found = all(
      "SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders WHERE date(created_at) = date(?) AND status <> 'cancelled'",
      key
    )[0] || { orders: 0, revenue: 0 };
    days.push({
      date: key,
      label: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      orders: found.orders,
      revenue: found.revenue,
    });
  }

  res.json({
    stats: {
      totalProducts,
      totalDraft,
      totalCategories,
      totalStock,
      totalOrders,
      pendingOrders,
      revenue,
      outOfStock,
    },
    lowStock,
    topProducts,
    recentOrders,
    statusBreakdown,
    salesByDay: days,
  });
});

/* --------------------------------- products -------------------------------- */

adminRouter.get('/products', (req, res) => {
  res.json({ products: listProducts({ includeDraft: true }) });
});

adminRouter.get('/products/:id', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID produk', { min: 1 });
    const row = get(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      id
    );
    if (!row) throw new HttpError(404, 'Produk tidak ditemukan.');
    res.json({ product: serializeProduct(row) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/products', (req, res, next) => {
  try {
    const payload = parseProductPayload(req.body);
    const id = createProduct(payload);
    const row = get(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      id
    );
    res.status(201).json({ product: serializeProduct(row), message: 'Produk berhasil ditambahkan.' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/products/:id', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID produk', { min: 1 });
    if (!get('SELECT id FROM products WHERE id = ?', id)) {
      throw new HttpError(404, 'Produk tidak ditemukan.');
    }
    const payload = parseProductPayload(req.body);
    updateProduct(id, payload);
    const row = get(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      id
    );
    res.json({ product: serializeProduct(row), message: 'Produk berhasil diperbarui.' });
  } catch (error) {
    next(error);
  }
});

/* ---------------------------- 360° spin frames ---------------------------- */

adminRouter.put('/products/:id/frames', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID produk', { min: 1 });
    if (!get('SELECT id FROM products WHERE id = ?', id)) {
      throw new HttpError(404, 'Produk tidak ditemukan.');
    }
    const frames = parseSpinFrames(req.body?.frames);
    if (!frames) throw new HttpError(400, 'Daftar frame wajib dikirim.');

    transaction(() => {
      run('DELETE FROM spin_frames WHERE product_id = ?', id);
      frames.forEach((url, index) => {
        run(
          'INSERT INTO spin_frames (product_id, url, position) VALUES (?, ?, ?)',
          id,
          url,
          index
        );
      });
    });

    res.json({
      frames,
      maxFrames: MAX_SPIN_FRAMES,
      message: `${frames.length} foto 360° disimpan.`,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/products/:id', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID produk', { min: 1 });
    if (!get('SELECT id FROM products WHERE id = ?', id)) {
      throw new HttpError(404, 'Produk tidak ditemukan.');
    }
    run('DELETE FROM products WHERE id = ?', id);
    res.json({ message: 'Produk berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------- categories ------------------------------- */

adminRouter.get('/categories', (req, res) => {
  const categories = all(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS productCount
     FROM categories c ORDER BY c.sort_order, c.id`
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    icon: row.icon,
    sortOrder: row.sort_order,
    productCount: row.productCount,
  }));
  res.json({ categories });
});

adminRouter.post('/categories', (req, res, next) => {
  try {
    const id = createCategory(req.body);
    res.status(201).json({ id, message: 'Kategori berhasil ditambahkan.' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/categories/:id', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID kategori', { min: 1 });
    updateCategory(id, req.body);
    res.json({ message: 'Kategori berhasil diperbarui.' });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/categories/:id', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID kategori', { min: 1 });
    deleteCategory(id);
    res.json({ message: 'Kategori berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------- inventory -------------------------------- */

adminRouter.get('/inventory', (req, res) => {
  const products = all(
    `SELECT p.id, p.name, p.brand, p.image, p.stock,
            (SELECT name FROM categories c WHERE c.id = p.category_id) AS category
     FROM products p ORDER BY p.stock ASC, p.name ASC`
  );
  const rows = products.map((product) => ({
    ...product,
    sizes: all(
      'SELECT size, stock FROM product_sizes WHERE product_id = ? ORDER BY size',
      product.id
    ),
    colors: all('SELECT name, hex FROM product_colors WHERE product_id = ? ORDER BY id', product.id),
  }));
  res.json({ inventory: rows });
});

adminRouter.put('/inventory/:productId', (req, res, next) => {
  try {
    const productId = integer(req.params.productId, 'ID produk', { min: 1 });
    if (!get('SELECT id FROM products WHERE id = ?', productId)) {
      throw new HttpError(404, 'Produk tidak ditemukan.');
    }
    const updates = Array.isArray(req.body?.sizes) ? req.body.sizes : [];
    if (!updates.length) throw new HttpError(400, 'Tidak ada perubahan stok.');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const entry of updates) {
        const size = integer(entry.size, 'Ukuran', { min: 30, max: 50 });
        const stock = integer(entry.stock, 'Stok', { min: 0, max: 10000 });
        const exist = get('SELECT id FROM product_sizes WHERE product_id = ? AND size = ?', productId, size);
        if (!exist) throw new HttpError(400, `Ukuran ${size} tidak terdaftar pada produk ini.`);
        run('UPDATE product_sizes SET stock = ? WHERE product_id = ? AND size = ?', stock, productId, size);
      }
      run(
        `UPDATE products SET stock = COALESCE((SELECT SUM(stock) FROM product_sizes WHERE product_id = ?), 0),
         updated_at = datetime('now') WHERE id = ?`,
        productId,
        productId
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const total = get('SELECT stock FROM products WHERE id = ?', productId).stock;
    res.json({ message: 'Stok berhasil diperbarui.', stock: total });
  } catch (error) {
    next(error);
  }
});

/* ---------------------------------- orders --------------------------------- */

adminRouter.get('/orders', (req, res) => {
  const status = String(req.query.status || '');
  const rows = status
    ? all('SELECT * FROM orders WHERE status = ? ORDER BY id DESC', status)
    : all('SELECT * FROM orders ORDER BY id DESC');
  res.json({
    orders: rows.map((row) => ({
      id: row.id,
      code: row.code,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      note: row.note,
      total: row.total,
      status: row.status,
      createdAt: row.created_at,
      itemCount: get('SELECT COALESCE(SUM(qty),0) AS total FROM order_items WHERE order_id = ?', row.id).total,
    })),
  });
});

adminRouter.get('/orders/:id', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID pesanan', { min: 1 });
    const row = get('SELECT * FROM orders WHERE id = ?', id);
    if (!row) throw new HttpError(404, 'Pesanan tidak ditemukan.');
    res.json({ order: serializeOrder(row) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/orders/:id/status', (req, res, next) => {
  try {
    const id = integer(req.params.id, 'ID pesanan', { min: 1 });
    const nextStatus = String(req.body?.status || '');
    const order = get('SELECT * FROM orders WHERE id = ?', id);
    if (!order) throw new HttpError(404, 'Pesanan tidak ditemukan.');
    const allowed = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
    if (!allowed.includes(nextStatus)) throw new HttpError(400, 'Status pesanan tidak dikenal.');
    if (nextStatus === order.status) {
      return res.json({ message: 'Status pesanan tidak berubah.' });
    }

    const items = all('SELECT * FROM order_items WHERE order_id = ?', id);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (nextStatus === 'cancelled' && order.status !== 'cancelled') {
        for (const item of items) {
          if (!item.product_id) continue;
          run(
            `UPDATE product_sizes SET stock = stock + ?
             WHERE product_id = ? AND size = ?`,
            item.qty,
            item.product_id,
            item.size
          );
          run(
            `UPDATE products SET stock = COALESCE((SELECT SUM(stock) FROM product_sizes WHERE product_id = ?), 0),
             updated_at = datetime('now') WHERE id = ?`,
            item.product_id,
            item.product_id
          );
        }
      } else if (order.status === 'cancelled' && nextStatus !== 'cancelled') {
        for (const item of items) {
          if (!item.product_id) continue;
          const stockRow = get(
            'SELECT stock FROM product_sizes WHERE product_id = ? AND size = ?',
            item.product_id,
            item.size
          );
          if (!stockRow || stockRow.stock < item.qty) {
            throw new HttpError(
              409,
              `Stok ukuran ${item.size} tidak cukup untuk mengaktifkan kembali pesanan ini.`
            );
          }
        }
        for (const item of items) {
          if (!item.product_id) continue;
          run(
            'UPDATE product_sizes SET stock = stock - ? WHERE product_id = ? AND size = ?',
            item.qty,
            item.product_id,
            item.size
          );
          run(
            `UPDATE products SET stock = COALESCE((SELECT SUM(stock) FROM product_sizes WHERE product_id = ?), 0),
             updated_at = datetime('now') WHERE id = ?`,
            item.product_id,
            item.product_id
          );
        }
      }
      run(
        "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
        nextStatus,
        id
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    res.json({ message: 'Status pesanan diperbarui.', status: nextStatus });
  } catch (error) {
    next(error);
  }
});

/* --------------------------------- settings -------------------------------- */

const SETTING_FIELDS = {
  storeName: 'store_name',
  tagline: 'store_tagline',
  logoText: 'logo_text',
  logoImage: 'logo_image',
  whatsapp: 'whatsapp',
  whatsappDisplay: 'whatsapp_display',
  email: 'email',
  instagram: 'instagram',
  address: 'address',
  hours: 'hours',
  announcement: 'announcement',
  heroEyebrow: 'hero_eyebrow',
  heroTitle: 'hero_title',
  heroSubtitle: 'hero_subtitle',
  heroImage: 'hero_image',
  bannerImage: 'banner_image',
  aboutTitle: 'about_title',
  aboutText: 'about_text',
};

adminRouter.get('/settings', (req, res) => {
  const raw = getSettings();
  const settings = {};
  for (const [key, column] of Object.entries(SETTING_FIELDS)) settings[key] = raw[column] || '';
  res.json({ settings });
});

adminRouter.put('/settings', (req, res, next) => {
  try {
    const body = req.body || {};
    let whatsapp = String(body.whatsapp ?? '').replace(/[^0-9]/g, '');
    if (whatsapp.startsWith('0')) whatsapp = `62${whatsapp.slice(1)}`;
    if (!/^62[0-9]{8,14}$/.test(whatsapp)) {
      throw new HttpError(400, 'Nomor WhatsApp harus diawali 62 dan berisi 10–16 digit.');
    }
    for (const [key, column] of Object.entries(SETTING_FIELDS)) {
      if (key === 'whatsapp') {
        saveSetting(column, whatsapp);
        continue;
      }
      saveSetting(column, String(body[key] ?? '').trim().slice(0, 4000));
    }
    res.json({ message: 'Pengaturan toko berhasil disimpan.' });
  } catch (error) {
    next(error);
  }
});
