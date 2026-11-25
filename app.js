/**
 * Vercel entry point.
 *
 * Vercel's Express detection looks for app.js / index.js / server.js at the
 * project root, so the whole Express application is created here and exported
 * as the default export. `server/index.js` imports this same app for local
 * development and any Node host with a persistent disk.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { ensureAdminAccount, currentAdmin } from './server/auth.js';
import { seedDatabase } from './server/seed.js';
import { storeRouter } from './server/routes/store.js';
import { authRouter } from './server/routes/auth.js';
import { adminRouter } from './server/routes/admin.js';
import { uploadRouter, uploadDir } from './server/routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const publicFile = (name) => path.join(publicDir, name);

seedDatabase();
ensureAdminAccount();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

/* ------------------------------ uploaded files ----------------------------- */

// Vercel Functions cannot use express.static() for deployed assets, and writable
// storage lives in /tmp. Serve uploads through an explicit route so the same
// code works locally and on Vercel.
app.get('/uploads/:file', (req, res, next) => {
  const name = path.basename(req.params.file);
  if (name !== req.params.file) return next();
  const filePath = path.join(uploadDir, name);
  fs.access(filePath, fs.constants.R_OK, (error) => {
    if (error) return next();
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(filePath);
  });
});

/* ---------------------------------- API ----------------------------------- */

app.use('/api/store', storeRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api', uploadRouter);
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'sneakerspace' }));

/* --------------------------------- pages ---------------------------------- */

app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => {
  if (!currentAdmin(req)) return res.redirect('/admin/login');
  res.sendFile(publicFile('admin/index.html'), (error) => {
    if (error && !res.headersSent) res.redirect('/admin/index.html');
  });
});

app.get(['/admin/login', '/admin/login.html'], (req, res) => {
  if (currentAdmin(req)) return res.redirect('/admin');
  res.sendFile(publicFile('admin/login.html'), (error) => {
    if (error && !res.headersSent) res.redirect('/admin/login.html');
  });
});

app.get(['/produk/:id', '/produk/:id/'], (req, res) => {
  res.sendFile(publicFile('product.html'), (error) => {
    if (error && !res.headersSent) res.redirect('/product.html');
  });
});

app.get('/', (req, res) => {
  res.sendFile(publicFile('index.html'), (error) => {
    if (error && !res.headersSent) res.redirect('/index.html');
  });
});

// Local development / Node hosts: serve the public folder from Express.
// On Vercel this middleware is ignored and public/** is served from the CDN.
app.use(
  express.static(publicDir, {
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  res.status(404).sendFile(publicFile('404.html'), (error) => {
    if (error && !res.headersSent) res.status(404).type('text').send('Halaman tidak ditemukan.');
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran gambar maksimal 6MB per file.'
        : 'Gagal mengunggah gambar. Periksa ukuran dan format file.';
    return res.status(400).json({ error: message });
  }
  const status = error.status || 500;
  if (status >= 500) console.error('[server error]', error);
  res.status(status).json({ error: error.message || 'Terjadi kesalahan pada server.' });
});

export default app;
