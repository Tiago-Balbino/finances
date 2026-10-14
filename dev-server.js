import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = { '/': ['index.html','text/html; charset=utf-8'], '/app.js': ['app.js','text/javascript; charset=utf-8'], '/style.css': ['style.css','text/css; charset=utf-8'], '/theme.css': ['theme.css','text/css; charset=utf-8'] };
const target = new URL(process.env.API_URL || 'http://127.0.0.1:3000');
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/api/') || pathname === '/health') {
    const upstream = http.request(new URL(req.url, target), { method: req.method, headers: { ...req.headers, host: req.headers.host } }, response => {
      res.writeHead(response.statusCode, response.headers); response.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end('API indisponível'); });
    req.pipe(upstream); return;
  }
  if (req.method !== 'GET' || !files[pathname]) { res.writeHead(404); res.end(); return; }
  const [name, type] = files[pathname];
  try { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(await readFile(path.join(root, name))); }
  catch { res.writeHead(500); res.end(); }
}).listen(Number(process.env.PORT || 5173), process.env.HOST || '127.0.0.1', () => console.log('Frontend em http://127.0.0.1:5173'));
