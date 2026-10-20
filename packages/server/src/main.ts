/**
 * Local static host for the built app. The app itself is fully client-side (sql.js + IndexedDB),
 * so this server only serves packages/app/dist and a health endpoint. GitHub Pages serves the same build.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..', '..', '..');
const APP_DIST = join(ROOT, 'packages', 'app', 'dist');
const PORT = Number(process.env.PORT ?? 8787);

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, built: existsSync(APP_DIST) }));
    return;
  }
  if (!existsSync(APP_DIST)) {
    res.statusCode = 503;
    res.end('App not built. Run `npm run build` first (or `npm run dev` for the Vite dev server).');
    return;
  }
  let p = resolve(APP_DIST, '.' + decodeURIComponent(url.pathname));
  if (!p.startsWith(APP_DIST)) { res.statusCode = 403; res.end('Forbidden'); return; }
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(APP_DIST, 'index.html');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
}).listen(PORT, () => console.log(`FOM simulator on http://localhost:${PORT}`));
