/**
 * Local / Node-host runner.
 * The Express app itself lives in /app.js (also detected by Vercel).
 */
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(process.cwd(), '.env');
if (!process.env.VERCEL && fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFile);
  } catch (error) {
    console.warn('[server] .env tidak dapat dibaca:', error.message);
  }
}

const { default: app } = await import('../app.js');
const { db } = await import('./db.js');

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`SneakerSpace berjalan di http://0.0.0.0:${port}`);
});

function shutdown(signal) {
  console.log(`[server] ${signal} diterima, menutup koneksi…`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
