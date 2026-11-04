import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Server-side secret key & credentials (never sent to frontend)
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'guru_aqua').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AquaGuru2026!';

function createAdminToken(username: string): string {
  const payload = JSON.stringify({
    username,
    role: 'teacher_admin',
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  });
  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

function verifyAdminToken(token: string): { valid: boolean; username?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };
    const [base64Payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64Payload)
      .digest('base64url');
    if (signature !== expectedSig) return { valid: false };
    const decoded = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
    if (decoded.exp < Date.now()) return { valid: false };
    return { valid: true, username: decoded.username };
  } catch {
    return { valid: false };
  }
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ ok: false, message: 'Username dan password wajib diisi.' });
    return;
  }

  const normalizedUser = String(username).trim().toLowerCase();
  const expectedUser = ADMIN_USERNAME.toLowerCase();

  // Timing-safe comparison for password
  const passBuf = Buffer.from(String(password));
  const expectedBuf = Buffer.from(ADMIN_PASSWORD);
  const passwordMatch =
    passBuf.length === expectedBuf.length && crypto.timingSafeEqual(passBuf, expectedBuf);

  if (normalizedUser === expectedUser && passwordMatch) {
    const token = createAdminToken(ADMIN_USERNAME);
    res.json({
      ok: true,
      token,
      teacherName: 'Ibu/Bapak Guru Kelas 2',
      username: ADMIN_USERNAME,
    });
  } else {
    res.status(401).json({
      ok: false,
      message: 'Username atau password guru tidak valid.',
    });
  }
});

app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const result = verifyAdminToken(token);
  if (!result.valid) {
    res.status(401).json({ ok: false });
    return;
  }
  res.json({ ok: true, username: result.username, teacherName: 'Ibu/Bapak Guru Kelas 2' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aqua Math Adventure Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
