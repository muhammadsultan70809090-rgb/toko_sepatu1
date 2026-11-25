import crypto from 'node:crypto';
import { all, get, run } from './db.js';

const SESSION_COOKIE = 'ss_admin';
const SESSION_HOURS = 8;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  try {
    const candidate = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, 'hex');
    return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
  } catch {
    return false;
  }
}

export function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index > -1) {
      const key = part.slice(0, index).trim();
      if (key) acc[key] = decodeURIComponent(part.slice(index + 1).trim());
    }
    return acc;
  }, {});
}

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(res, adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  run(
    'INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)',
    tokenHash(token),
    adminId,
    expires.toISOString()
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_HOURS * 3600 * 1000,
    secure: Boolean(process.env.VERCEL) || process.env.COOKIE_SECURE === '1',
  });
  run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  return token;
}

export function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', tokenHash(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function currentAdmin(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const row = get(
    `SELECT a.id, a.username, s.expires_at
     FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ?`,
    tokenHash(token)
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE token_hash = ?', tokenHash(token));
    return null;
  }
  return { id: row.id, username: row.username };
}

export function requireAuth(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Sesi berakhir. Silakan login kembali.' });
  req.admin = admin;
  next();
}

const attempts = new Map();

export function loginRateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.resetAt > now && record.count >= 8) {
    const wait = Math.ceil((record.resetAt - now) / 60000);
    return res
      .status(429)
      .json({ error: `Terlalu banyak percobaan login. Coba lagi dalam ${wait} menit.` });
  }
  if (!record || record.resetAt <= now) attempts.set(key, { count: 0, resetAt: now + 10 * 60000 });
  attempts.get(key).count += 1;
  next();
}

export function sameOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch {
    /* ignore malformed origin */
  }
  return res.status(403).json({ error: 'Permintaan ditolak: origin tidak dikenali.' });
}

export function ensureAdminAccount() {
  const existing = get('SELECT COUNT(*) AS total FROM admins').total;
  if (existing > 0) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const { salt, hash } = hashPassword(password);
  run(
    'INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)',
    username,
    hash,
    salt
  );
  if (!process.env.ADMIN_PASSWORD) {
    console.log('[auth] Akun admin demo dibuat (admin / admin).');
    console.log('[auth] Untuk produksi set ADMIN_USERNAME dan ADMIN_PASSWORD sebelum seed pertama.');
  }
}
