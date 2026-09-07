import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import connectDB from './backend/config/db.js';
import app from './backend/app.js';

const PORT = 3000;
const rootDir = process.cwd();

async function startServer() {
  // Connect to database (with fallback to in-memory MongoDB and auto-seeding)
  try {
    await connectDB();
  } catch (err: any) {
    console.warn(`[Database] Initialization warning: ${err?.message || err}`);
  }

  // Friendly route redirects for ease of navigation
  app.get('/login', (req, res) => res.redirect('/login.html'));
  app.get('/admin', (req, res) => res.redirect('/admin-dashboard.html'));
  app.get('/distributor', (req, res) => res.redirect('/distributor-dashboard.html'));
  app.get('/beneficiary', (req, res) => res.redirect('/beneficiary-dashboard.html'));

  // Vite middleware for development; static file serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.resolve(rootDir, 'frontend/vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
