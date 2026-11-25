import { Router } from 'express';
import { get } from '../db.js';
import {
  currentAdmin,
  destroySession,
  createSession,
  loginRateLimit,
  requireAuth,
  sameOrigin,
  verifyPassword,
} from '../auth.js';
import { HttpError, requiredText } from '../validation.js';

export const authRouter = Router();

authRouter.post('/login', sameOrigin, loginRateLimit, (req, res, next) => {
  try {
    const username = requiredText(req.body?.username, 'Username', { max: 60 });
    const password = String(req.body?.password ?? '');
    if (password.length < 1) throw new HttpError(400, 'Password wajib diisi.');

    const admin = get('SELECT * FROM admins WHERE lower(username) = lower(?)', username);
    const valid = admin && verifyPassword(password, admin.salt, admin.password_hash);
    if (!valid) {
      throw new HttpError(401, 'Username atau password salah. Periksa kembali kredensial Anda.');
    }
    createSession(res, admin.id);
    res.json({ admin: { id: admin.id, username: admin.username } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', sameOrigin, (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ admin: null });
  res.json({ admin });
});

authRouter.get('/session-check', requireAuth, (req, res) => res.json({ ok: true, admin: req.admin }));
