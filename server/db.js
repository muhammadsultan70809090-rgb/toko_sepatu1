import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vercel Functions only allow writes in /tmp, so serverless deployments keep the
// database there (it is re-seeded on cold starts; see README for persistence).
const isServerless = Boolean(process.env.VERCEL);
const dataDir = isServerless ? '/tmp/sneakerspace' : path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbFile = process.env.DB_FILE || path.join(dataDir, 'sneakerspace.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'fa-shoe-prints',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft')),
  badge TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, size)
);

CREATE TABLE IF NOT EXISTS product_colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hex TEXT NOT NULL DEFAULT '#cccccc'
);

CREATE TABLE IF NOT EXISTS spin_frames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','shipped','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL,
  subtotal INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`);

export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export const nowIso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export function recomputeStock(productId) {
  run(
    `UPDATE products SET stock = COALESCE((SELECT SUM(stock) FROM product_sizes WHERE product_id = ?), 0),
     updated_at = ? WHERE id = ?`,
    productId,
    nowIso(),
    productId
  );
  return get('SELECT stock FROM products WHERE id = ?', productId)?.stock ?? 0;
}

export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function saveSetting(key, value) {
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    String(value ?? '')
  );
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function serializeProduct(row, { withDetails = true } = {}) {
  if (!row) return null;
  const product = {
    id: row.id,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    category: row.category_name || null,
    price: row.price,
    image: row.image,
    description: row.description,
    material: row.material,
    stock: row.stock,
    status: row.status,
    badge: row.badge,
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (!withDetails) return product;
  product.sizes = all(
    'SELECT size, stock FROM product_sizes WHERE product_id = ? ORDER BY size',
    row.id
  );
  product.colors = all(
    'SELECT name, hex FROM product_colors WHERE product_id = ? ORDER BY id',
    row.id
  );
  product.spinFrames = all(
    'SELECT url FROM spin_frames WHERE product_id = ? ORDER BY position, id',
    row.id
  ).map((r) => r.url);
  return product;
}

export const productSelect = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

export function serializeOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    note: row.note,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: all(
      `SELECT id, product_id AS productId, product_name AS productName, brand, size, color,
              qty, price, subtotal
       FROM order_items WHERE order_id = ? ORDER BY id`,
      row.id
    ).map((item) => ({
      ...item,
      image: item.productId
        ? get('SELECT image FROM products WHERE id = ?', item.productId)?.image || ''
        : '',
    })),
  };
}
