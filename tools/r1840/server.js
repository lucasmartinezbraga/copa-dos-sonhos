/* Servidor estatico da raiz do repositorio, para abrir as builds de dist/ no
   navegador. A camada da Copa (bestFormationFor, teamFor, CUP) nao carrega no
   harness de Node — o bloco principal lanca "document is not defined" e tudo
   depois do ponto do erro deixa de existir. No navegador ela carrega inteira,
   que e onde a Ordem de Servico tambem mediu a Copa. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8795);
const TIPO = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/') {
    const arquivos = fs.readdirSync(path.join(ROOT, 'dist')).filter(f => f.endsWith('.html')).sort();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<meta charset="utf-8"><h1>dist</h1><ul>' + arquivos.map(f => `<li><a href="/dist/${encodeURIComponent(f)}">${f}</a></li>`).join('') + '</ul>');
  }
  const file = path.join(ROOT, p.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TIPO[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('servindo ' + ROOT + ' em http://localhost:' + PORT));
