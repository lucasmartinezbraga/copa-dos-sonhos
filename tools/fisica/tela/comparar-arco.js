#!/usr/bin/env node
'use strict';
/* COMPARADOR VISUAL DO ARCO DA BOLA — a MESMA trajetoria, dois mapeamentos
   -------------------------------------------------------------------------
   Relato do dono: "a curva da bola na hora do lancamento ta estranha".

   A fisica do lancamento esta certa (apice 6,97 m em 34,8 m, medido). O que
   estava errado era a conversao de ALTURA em PIXEL: `alturaVisual` desenhava
   1:1 so ate 2,6 m e comprimia acima disso, entao a metade de cima do voo --
   onde o lancamento vive -- era achatada, e a derivada no apice caia para 0,19.
   Parabola desenhada assim vira cupula.

   Esta ferramenta nao mede: ela MOSTRA. Desenha a mesma parabola sintetica com
   as constantes antigas e com as novas, uma sobre a outra, no desenhista de
   verdade do jogo (`CDS_F25D.ball`), com a mesma camera e a mesma projecao.
   O que muda entre as duas metades da imagem e exclusivamente o mapeamento.

   Saida: reports/imagens/arco-<nome>.png

   Uso: node tools/fisica/tela/comparar-arco.js [bundle.html]
*/
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado; ferramenta pulada'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const SAIDA = path.resolve('reports/imagens');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(4000);

  const dataUrl = await pg.evaluate(() => {
    const cvReal = document.getElementById('fieldcv');
    const W = cvReal ? cvReal.width : 1024, H = cvReal ? cvReal.height : 500;
    const proj = window.CDS_F25D.project;

    /* `project` recebe PIXEL do canvas, nao metro de campo. A trajetoria
       sintetica atravessa o campo numa faixa de profundidade constante; a
       ALTURA e que vem em metro, que e o que esta em teste. */
    function trajetoria(n, apice) {
      const x0 = W * 0.10, x1 = W * 0.90, y0 = H * 0.74, y1 = H * 0.46;
      const p = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        p.push({ fx: x0 + (x1 - x0) * t, fy: y0 + (y1 - y0) * t,
                 z: 4 * apice * t * (1 - t) });
      }
      return p;
    }

    function pintar(ctx, zf, zg, rotulo, cor, apice) {
      const antesF = window.CDS_ZFIEL, antesG = window.CDS_ZFOLGA;
      window.CDS_ZFIEL = zf; window.CDS_ZFOLGA = zg;
      const pts = trajetoria(24, apice), centros = [];
      for (const q of pts) {
        window.__ballProbe = (z, by) => { centros.push(by); };
        window.CDS_F25D.ball(ctx, { gx: q.fx, gy: q.fy, z: q.z, tv: null });
        window.__ballProbe = null;
      }
      window.CDS_ZFIEL = antesF; window.CDS_ZFOLGA = antesG;
      ctx.save();
      ctx.strokeStyle = cor; ctx.lineWidth = 2.2; ctx.globalAlpha = .95;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = proj(pts[i].fx, pts[i].fy).x, py = centros[i];
        if (py == null) continue;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = cor; ctx.font = "700 19px system-ui, sans-serif";
      ctx.fillText(rotulo, 18, 30);
      ctx.restore();
      let alto = 1e9, chao = 0;
      for (const y of centros) { if (y < alto) alto = y; if (y > chao) chao = y; }
      return { alto, chao };
    }

    function fundo(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#164a24'); g.addColorStop(1, '#0d2c16');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    const APICE = 6.97;
    const c1 = document.createElement('canvas'); c1.width = W; c1.height = H;
    const x1 = c1.getContext('2d'); fundo(x1);
    const m1 = pintar(x1, 2.6, 3.4, 'ANTES  ·  altura fiel so ate 2,6 m  ·  o topo achata', '#ff9d9d', APICE);

    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    const x2 = c2.getContext('2d'); fundo(x2);
    const m2 = pintar(x2, 9.0, 8.0, 'DEPOIS  ·  altura fiel ate 9,0 m  ·  parabola de verdade', '#9dffb8', APICE);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H * 2 + 34;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#07130b'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(c1, 0, 0);
    ctx.drawImage(c2, 0, H + 10);
    ctx.fillStyle = '#dfe9e2'; ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText('mesma parabola (apice 6,97 m — o medido em partida) · mesma camera · muda so a conversao altura -> pixel',
                 18, H * 2 + 28);
    return { url: cv.toDataURL('image/png'),
             sub1: m1.chao - m1.alto, sub2: m2.chao - m2.alto };
  });

  await nav.close();
  const b64 = dataUrl.url.replace(/^data:image\/png;base64,/, '');
  const arq = path.join(SAIDA, 'arco-lancamento.png');
  fs.writeFileSync(arq, Buffer.from(b64, 'base64'));
  console.log('imagem escrita:', arq, '(' + (fs.statSync(arq).size / 1024).toFixed(0) + ' KB)');
  console.log('subida de tela no apice:  antes', dataUrl.sub1.toFixed(0), 'px  ·  depois',
              dataUrl.sub2.toFixed(0), 'px  ->  ganho de',
              (100 * (dataUrl.sub2 / Math.max(1, dataUrl.sub1) - 1)).toFixed(0) + '%');
  process.exit(0);
})();
