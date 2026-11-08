import express from 'express';
import { createBackendApp } from './backend/app';
export { createBackendApp } from './backend/app';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function startServer() {
  const app = createBackendApp();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Aqua Math Adventure Server running on http://0.0.0.0:${PORT}`);
    });
    return;
  }

  // Start Vite initialization immediately and bind port 3000 without blocking cold-start probes
  let viteMiddleware: any = null;
  const viteReady = (async () => {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    viteMiddleware = vite.middlewares;
    return viteMiddleware;
  })();

  app.use(async (req, res, next) => {
    try {
      const mw = viteMiddleware || (await viteReady);
      mw(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aqua Math Adventure Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) startServer();
