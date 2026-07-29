const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const SHOTS = path.join(ROOT, 'shots');
const PORT = 8791;
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/save') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const name = (u.searchParams.get('name') || 'f').replace(/[^a-z0-9_.-]/gi, '');
      const m = /^data:image\/(\w+);base64,(.*)$/.exec(body);
      if (!m) { res.writeHead(400); return res.end('bad'); }
      fs.writeFileSync(path.join(SHOTS, name + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1])), Buffer.from(m[2], 'base64'));
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
      res.end('ok');
    });
    return;
  }
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/rc1.html';
  const file = path.join(ROOT, p.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : ext === '.json' ? 'application/json; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT + '/'));
