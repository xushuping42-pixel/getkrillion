import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const base = process.cwd();
const flag = process.argv.indexOf('--port');
const port = Number(flag >= 0 ? process.argv[flag + 1] : process.env.PORT || 8788);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' };
http.createServer((req,res)=>{
 try {
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end();}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (pathname==='/answers' || pathname==='/answers/') {res.writeHead(301,{Location:'/archive/'});return res.end();}
  const relative=pathname.replace(/^\/+/, '') || 'index.html';
  const file=path.resolve(base,relative,relative.endsWith('/')?'index.html':'');
  if (!file.startsWith(base+path.sep) || relative.split(/[\\/]/).some(x=>x.startsWith('.')) || !/^(index\.html$|404\.html$|hints\/|archive\/|how-to-play\/|scoring\/|score-calculator\/|why-answer-not-accepted\/|search\/|about\/|privacy\/|answers\/|assets\/guide\/|release\.json$|sitemap\.xml$|robots\.txt$|favicon\.svg$)/.test(relative)) {res.writeHead(404);return res.end('Not found');}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {res.writeHead(301,{Location:pathname+'/'});return res.end();}
  const found=fs.existsSync(file) && fs.statSync(file).isFile();
  const actual=found?file:path.join(base,'404.html');
  const headers={'Content-Type':types[path.extname(actual)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if (pathname.startsWith('/search/')) headers['X-Robots-Tag']='noindex, follow';
  if (pathname.startsWith('/assets/') || pathname==='/release.json') headers['X-Robots-Tag']='noindex';
  res.writeHead(found?200:404,headers);
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(actual).pipe(res);
 }catch{res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
