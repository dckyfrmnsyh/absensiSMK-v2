import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Unique version identifier based on server process start time
  const SERVER_VERSION = new Date().getTime().toString();

  // API status check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API version check for auto-update
  app.get('/api/version', (req, res) => {
    res.json({ version: SERVER_VERSION });
  });

  if (process.env.NODE_ENV !== 'production') {
    // Development Mode using Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode serving build files
    const distPath = path.join(process.cwd(), 'dist');
    
    // 1. Service hashed assets with aggressive immutable caching (1 year)
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '365d',
      immutable: true
    }));

    // 2. Serve general static files (PWA manifest, images, logos) with a shorter cache
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour for standard assets
        }
      }
    }));

    // 3. SPA fallback serving index.html with absolute NO caching
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Gagal menjalankan server:', err);
});
