#!/usr/bin/env node
'use strict';
/* COMPARADOR VISUAL DO BONECO — membros de bloco contra membros com juncao
   -------------------------------------------------------------------------
   Autorizacao do dono: "se voce achar melhor mude os bonecos, reconstrua a
   parte grafica".

   O teto de qualidade da animacao nao era a maquina de estados: cada perna e
   cada braco eram um `fillRect` ALINHADO AOS EIXOS, e retangulo alinhado nao
   gira -- so translada. A OS-237 da a cada membro dois segmentos e uma juncao.

   Esta ferramenta desenha o mesmo ciclo de passada com `CDS_ARTIC` desligado e
   ligado, do MESMO build, e monta as duas tiras uma sobre a outra.

   Uso: node tools/fisica/tela/comparar-boneco.js [bundle.html] [--gesto=run]
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
const GESTO = String(argv.gesto || 'run');
const RAIO = Number(argv.r || 46);
const ZOOM = Number(argv.zoom || 1);
const SAIDA = path.resolve('reports/imagens');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (args) => {
    const GESTO = args.gesto, R = args.raio, Z = args.zoom;
    const N = 12, TW = Math.round(R * 3.2 * Z), TH = Math.round(R * 5.2 * Z), DT = 40;

    async function tira(artic, rotulo, cor) {
      window.CDS_ARTIC = artic; window.CDS_PROP = artic;
      const cv = document.createElement('canvas');
      cv.width = TW * N; cv.height = TH;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, '#1b3d26'); g.addColorStop(1, '#0b2113');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      const chave = 'bon:' + (artic ? 1 : 0);
      for (let i = 0; i < N; i++) {
        window.__CDS_ANIM_BY_KEY = window.__CDS_ANIM_BY_KEY || Object.create(null);
        window.__CDS_ANIM_BY_KEY[chave] = { state: GESTO, phase: i / N, tier: 0 };
        ctx.save();
        ctx.beginPath(); ctx.rect(i * TW, 0, TW, TH); ctx.clip();
        ctx.translate(i * TW + TW / 2, TH * 0.52); ctx.scale(Z, Z); ctx.translate(-(i * TW + TW / 2), -(TH * 0.52));
        window.CDS_F25D.body(ctx, {
          x: i * TW + TW / 2, y: TH * 0.52, r: R,
          pc: '#3ea1ff', gkC: '#ffd166', isGK: false, divePose: null,
          hasBall: false, key: chave, act: '', pose: '', wave: 0,
          ballX: i * TW + TW / 2 + 400
        });
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath(); ctx.moveTo(i * TW, 0); ctx.lineTo(i * TW, TH); ctx.stroke();
        ctx.restore();
        await new Promise(res => setTimeout(res, DT));
      }
      ctx.fillStyle = cor; ctx.font = "700 17px system-ui, sans-serif";
      ctx.fillText(rotulo, 10, 24);
      return cv;
    }

    const t1 = await tira(false, 'ANTES  ·  membros em bloco + torso enorme (perna = 30% da altura)', '#ff9d9d');
    const t2 = await tira(true, 'DEPOIS (OS-237/238)  ·  membros com juncao + proporcao humana (perna = 39%)', '#9dffb8');
    window.CDS_ARTIC = undefined; window.CDS_PROP = undefined;

    const cv = document.createElement('canvas');
    cv.width = t1.width; cv.height = t1.height * 2 + 36;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#07130b'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(t1, 0, 0); ctx.drawImage(t2, 0, t1.height + 8);
    ctx.fillStyle = '#dfe9e2'; ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText('mesmo estado (' + GESTO + '), mesmo ciclo de fase, mesmo build · muda so o desenho do atleta',
                 10, cv.height - 12);
    return cv.toDataURL('image/png');
  }, { gesto: GESTO, raio: RAIO, zoom: ZOOM });

  await nav.close();
  const arq = path.join(SAIDA, 'boneco-' + GESTO + '-r' + RAIO + '.png');
  fs.writeFileSync(arq, Buffer.from(r.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('imagem escrita:', arq);
  if (erros.length) { console.log('ERROS DE PAGINA:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
