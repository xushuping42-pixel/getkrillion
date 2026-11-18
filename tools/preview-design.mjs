import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.DESIGN_PORT || 8790);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml' };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') { res.writeHead(302, { Location: '/design/phase-one/' }); return res.end(); }
    const relative = pathname === '/' ? 'design/phase-one/index.html' : pathname.replace(/^\/+/, '');
    if (!/^(design\/phase-one\/|index\.html$|answers\/|data\/|css\/|js\/|favicon\.svg$)/.test(relative) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) {
      res.writeHead(404); return res.end('Not found');
    }
    const file = path.resolve(root, relative, relative.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end('Bad request'); }
}).listen(port, '127.0.0.1', () => console.log(`Design preview: http://127.0.0.1:${port}/design/phase-one/`));
