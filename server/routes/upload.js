import { Router } from 'express';
import multer from 'multer';
import { requireAuth, sameOrigin } from '../auth.js';
import { storageProvider, storeImage, uploadDir } from '../storage.js';
import { HttpError } from '../validation.js';

export { uploadDir };

const allowed = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

// Satu permintaan bisa berisi beberapa file, tetapi klien mengunggah satu per
// satu agar progres terlihat dan tetap di bawah batas body Vercel (4,5 MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new HttpError(400, 'Format gambar harus JPG, PNG, atau WEBP.'));
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
    upload.array('files', 12)(req, res, (error) => {
      if (error) return next(error);
      next();
    });
  },
  async (req, res, next) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) throw new HttpError(400, 'Tidak ada file yang diunggah.');

      const rawProductId = String(req.body?.productId ?? '');
      const productId = /^\d+$/.test(rawProductId) ? Number(rawProductId) : 'draft';
      const urls = [];
      for (const file of files) {
        urls.push(
          await storeImage({
            buffer: file.buffer,
            mimetype: file.mimetype,
            originalname: file.originalname,
            productId,
            width: 1600,
          })
        );
      }
      res.status(201).json({ urls, provider: storageProvider });
    } catch (error) {
      next(error);
    }
  }
);
