#!/usr/bin/env node
'use strict';
/* FOLHA DE POSES — todos os estados de animacao numa imagem so
   -------------------------------------------------------------------------
   Consertar gesto a gesto e caro e nao diz o que FALTA. Esta folha desenha
   cada estado declarado em `CDS_ANIM.STATES` em tres fases (inicio, pico,
   fim), no desenhista de verdade, e empilha tudo numa grade legivel.

   Serve para duas coisas:
     · achar estado que desenha IGUAL a corrida (gesto mudo);
     · julgar de uma vez se o conjunto ficou coerente depois de mexer no
       boneco, em vez de descobrir um gesto quebrado por acaso, meses depois.

   Uso: node tools/fisica/tela/folha-de-poses.js [bundle.html] [--r=34]
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
const RAIO = Number(argv.r || 34);
const GK = argv.gk === '1';
const FILTRO = argv.filtro ? String(argv.filtro) : null;
const SAIDA = path.resolve('reports/imagens');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 900 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(2500);

  const r = await pg.evaluate(async (cfg) => {
    const R = cfg.raio, FASES = cfg.filtro ? [0.05, 0.25, 0.5, 0.75, 0.95] : [0.05, 0.5, 0.92];
    const CEL_W = Math.round(R * 2.4), CEL_H = Math.round(R * 4.0);
    const A = window.CDS_ANIM;
    if (!A || !A.STATES) return null;
    let estados = Object.keys(A.STATES);
    estados = estados.filter(e => cfg.gk ? /^gk_/.test(e) : !/^gk_/.test(e));
    if (cfg.filtro) { const re = new RegExp(cfg.filtro); estados = estados.filter(e => re.test(e)); }
    estados.sort();

    const COLS = Math.min(8, Math.max(1, estados.length));
    const GW = CEL_W * FASES.length + 10;              // largura de um grupo
    const linhas = Math.ceil(estados.length / COLS);
    const cv = document.createElement('canvas');
    cv.width = GW * COLS; cv.height = (CEL_H + 20) * linhas + 30;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0a1a10'; ctx.fillRect(0, 0, cv.width, cv.height);

    const assinaturas = Object.create(null);
    for (let i = 0; i < estados.length; i++) {
      const st = estados[i];
      const gx = (i % COLS) * GW, gy = Math.floor(i / COLS) * (CEL_H + 20) + 22;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(gx + 2, gy - 2, GW - 8, CEL_H + 4);
      ctx.restore();
      for (let f = 0; f < FASES.length; f++) {
        const chave = 'folha:' + st + ':' + f;
        window.__CDS_ANIM_BY_KEY = window.__CDS_ANIM_BY_KEY || Object.create(null);
        window.__CDS_ANIM_BY_KEY[chave] = { state: st, phase: FASES[f], tier: 3 };
        const cx0 = gx + f * CEL_W + CEL_W / 2, cy0 = gy + CEL_H * 0.52;
        ctx.save();
        ctx.beginPath(); ctx.rect(gx + f * CEL_W, gy, CEL_W, CEL_H); ctx.clip();
        window.CDS_F25D.body(ctx, {
          x: cx0, y: cy0, r: R, pc: cfg.gk ? '#ffd166' : '#3ea1ff', gkC: '#ffd166',
          isGK: cfg.gk, divePose: null, hasBall: false, key: chave,
          act: '', pose: '', wave: 0, ballX: cx0 + 200
        });
        ctx.restore();
        /* assinatura grosseira do desenho, para achar gesto mudo */
        const d = ctx.getImageData(gx + f * CEL_W, gy, CEL_W, CEL_H).data;
        let som = 0;
        for (let q = 0; q < d.length; q += 40) som += d[q] * 3 + d[q + 1] * 5 + d[q + 2] * 7;
        (assinaturas[st] || (assinaturas[st] = [])).push(som);
        await new Promise(res => setTimeout(res, 26));
      }
      ctx.fillStyle = '#cfe6d6'; ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(st.slice(0, 22), gx + 6, gy + CEL_H + 13);
    }
    ctx.fillStyle = '#dfe9e2'; ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillText('FOLHA DE POSES — ' + estados.length + ' estados, 3 fases cada (inicio · pico · fim)', 10, 16);
    return { url: cv.toDataURL('image/png'), estados: estados.length, ass: assinaturas };
  }, { raio: RAIO, gk: GK, filtro: FILTRO });

  await nav.close();
  if (!r) { console.error('CDS_ANIM ausente'); process.exit(2); }
  const arq = path.join(SAIDA, 'folha-poses' + (GK ? '-gk' : '') + (FILTRO ? '-' + FILTRO.replace(/[^a-z0-9]+/gi,'_') : '') + '.png');
  fs.writeFileSync(arq, Buffer.from(r.url.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('folha escrita:', arq, '|', r.estados, 'estados');

  /* gesto MUDO: as tres fases desenham praticamente a mesma coisa */
  const mudos = [];
  for (const st of Object.keys(r.ass)) {
    const a = r.ass[st];
    if (a.length < 3) continue;
    const amp = Math.max(...a) - Math.min(...a), base = Math.max(1, Math.max(...a));
    if (amp / base < 0.004) mudos.push(st + '  (variacao ' + (100 * amp / base).toFixed(2) + '%)');
  }
  console.log('\ngestos que quase nao mudam entre as fases:', mudos.length);
  for (const m of mudos) console.log('   ', m);
  if (erros.length) { console.log('ERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
