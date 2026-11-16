import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const base = process.cwd(), port = Number(process.env.PORT || 8788);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(base, relative, relative.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(base + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.')) ||
        !/^(index\.html|answers\/|css\/|js\/|data\/|sitemap\.xml$|robots\.txt$)/.test(relative)) {
      res.writeHead(404); return res.end('Not found');
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end('Bad request'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
