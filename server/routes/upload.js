import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth, sameOrigin } from '../auth.js';
import { HttpError } from '../validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uploadDir =
  process.env.UPLOAD_DIR ||
  (process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = allowed.get(file.mimetype) || path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024, files: 40 },
  fileFilter: (req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new HttpError(400, 'Format gambar harus JPG, PNG, WEBP, AVIF atau GIF.'));
    }
    cb(null, true);
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  '/upload',
  requireAuth,
  sameOrigin,
  (req, res, next) => {
    upload.array('files', 40)(req, res, (error) => {
      if (error) return next(error);
      next();
    });
  },
  (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
    res.status(201).json({ urls: files.map((file) => `/uploads/${file.filename}`) });
  }
);
