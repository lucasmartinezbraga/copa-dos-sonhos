#!/usr/bin/env node
'use strict';
/* VARREDURA DE FLUIDEZ — tudo que quebra continuidade num quadro
   -------------------------------------------------------------------------
   Pedido do dono: "caça tudo que quebra a fluidez".

   Fluidez nao e uma metrica do motor: e propriedade do que vai para a TELA.
   Entao esta sonda mede, quadro a quadro DESENHADO, toda descontinuidade que
   o olho pode captar, e ordena por gravidade em vez de opinar.

   O que vigia:
     1. RITMO DO QUADRO      intervalo entre quadros e quanto ele varia. Um
                             engasgo de 100 ms quebra tudo, por melhor que
                             esteja o resto.
     2. SALTO DO ATLETA      deslocamento desenhado por quadro contra o que a
                             velocidade fisica dele permitia.
     3. TROCA DE GESTO       quantas vezes por segundo cada atleta muda de
                             estado. Gesto que troca oito vezes por segundo nao
                             e animacao, e tremor.
     4. PISCA-PISCA DE POSSE quantas vezes a bola troca de dono em janela curta.
     5. SALTO DA BOLA        posicao e altura desenhadas (ja coberto por
                             OS-239/245, aqui so para o painel ficar completo).

   Uso: node tools/fisica/tela/fluidez.js [bundle.html] [--segundos=N]
*/
const path = require('path');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado; sonda pulada'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');

(async () => {
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

  await pg.evaluate(() => {
    const S = window.__fl = {
      quadros: 0, dts: [], engasgos: 0, engasgoPior: 0,
      corpo: { n: 0, p6: 0, p18: 0, p60: 0, pico: 0 },
      gesto: { trocas: 0, atletas: 0, flap: 0, porAtleta: Object.create(null),
               desenhos: 0, semEstado: 0, pares: Object.create(null), duracoes: [] },
      posse: { trocas: 0, janelas: 0, pingue: 0 },
      bola: { n: 0, p18: 0, p60: 0, pico: 0, zPico: 0, zGrandes: 0 },
    };

    /* ---- 1. ritmo do quadro, medido no relogio de parede do desenho ---- */
    let tAnt = 0;
    const ritmo = () => {
      const t = performance.now();
      if (tAnt) {
        const dt = t - tAnt;
        S.quadros++;
        if (S.dts.length < 40000) S.dts.push(+dt.toFixed(2));
        /* engasgo: mais que o dobro do quadro nominal de 60 fps */
        if (dt > 34) { S.engasgos++; if (dt > S.engasgoPior) S.engasgoPior = dt; }
      }
      tAnt = t;
      requestAnimationFrame(ritmo);
    };
    requestAnimationFrame(ritmo);

    /* ---- 2 e 5. o que o desenhista recebe, por atleta e para a bola ---- */
    const F = Object.assign({}, window.CDS_F25D);
    const origBody = F.body, origBall = F.ball;
    const ult = Object.create(null);
    F.body = function (ctx, o) {
      try {
        const k = o && o.key;
        if (k) {
          const a = ult[k];
          if (a) {
            const d = Math.hypot(o.x - a.x, o.y - a.y);
            S.corpo.n++;
            if (d > S.corpo.pico) S.corpo.pico = d;
            if (d > 6) S.corpo.p6++;
            if (d > 18) S.corpo.p18++;
            if (d > 60) S.corpo.p60++;
          }
          ult[k] = { x: o.x, y: o.y };
          /* troca de gesto */
          S.gesto.desenhos++;
          const A = window.__CDS_ANIM_BY_KEY && window.__CDS_ANIM_BY_KEY[k];
          const st = A && A.state;
          if (!st) S.gesto.semEstado++;
          if (st) {
            const g = S.gesto.porAtleta[k] || (S.gesto.porAtleta[k] = { st: null, n: 0, t0: performance.now(), curto: 0, desde: 0, vistas: 0 });
            g.vistas++;
            if (g.st !== st) {
              const dur = performance.now() - g.desde;
              if (g.st) {
                if (dur < 120) S.gesto.flap++;   // gesto que nao durou 0,12 s
                if (S.gesto.duracoes.length < 60000) S.gesto.duracoes.push(+dur.toFixed(1));
                const par = g.st + ' -> ' + st;
                S.gesto.pares[par] = (S.gesto.pares[par] || 0) + 1;
              }
              g.st = st; g.n++; g.desde = performance.now();
              S.gesto.trocas++;
            }
          }
        }
      } catch (_) { }
      return origBody.apply(this, arguments);
    };
    let bx = null, by = null, bz = null;
    F.ball = function (ctx, o) {
      try {
        if (o && typeof o.gx === 'number') {
          if (bx != null) {
            const d = Math.hypot(o.gx - bx, o.gy - by);
            S.bola.n++;
            if (d > S.bola.pico) S.bola.pico = d;
            if (d > 18) S.bola.p18++;
            if (d > 60) S.bola.p60++;
            const dz = Math.abs((o.z || 0) - bz);
            if (dz > S.bola.zPico) S.bola.zPico = dz;
            if (dz > 0.35) S.bola.zGrandes++;
          }
          bx = o.gx; by = o.gy; bz = o.z || 0;
        }
      } catch (_) { }
      return origBall.apply(this, arguments);
    };
    window.CDS_F25D = F;

    /* ---- 4. pisca-pisca de posse, no passo do motor ---- */
    const P = window.MatchSim.prototype, oldStep = P.step;
    let donoAnt = null, jan = -1, tr = 0;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        const b = this.ball, t = Number(this.t) || 0;
        if (b && b.owner && b.owner !== donoAnt) { if (donoAnt) tr++; donoAnt = b.owner; }
        if (jan < 0) jan = t;
        else if (t - jan >= 3) {
          S.posse.janelas++; S.posse.trocas += tr;
          if (tr >= 6) S.posse.pingue++;
          tr = 0; jan = t;
        }
      } catch (_) { }
      return r;
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  if (argv.dwell != null) await pg.evaluate(v => { window.CDS_DWELL = v; }, Number(argv.dwell));
  await pg.waitForTimeout(Number(argv.segundos || 300) * 1000);
  const r = await pg.evaluate(() => {
    const S = window.__fl;
    const at = Object.keys(S.gesto.porAtleta).length;
    return { s: S, atletas: at, m: window.GAME._sim().minute,
             segundos: (S.dts.reduce((a, b) => a + b, 0)) / 1000 };
  });
  await nav.close();

  const S = r.s, seg = Math.max(1, r.segundos);
  const ord = S.dts.slice().sort((a, b) => a - b);
  const q = p => ord.length ? ord[Math.min(ord.length - 1, Math.floor(p * ord.length))] : 0;

  console.log('\n=== VARREDURA DE FLUIDEZ ===  minuto', r.m.toFixed(1),
              '| quadros', S.quadros, '|', seg.toFixed(0), 's de tela\n');

  console.log('  1. RITMO DO QUADRO   (limite SUPERIOR: a propria sonda pesa)');
  console.log('     — ela envolve os 22 desenhos de corpo e a bola por quadro e');
  console.log('       guarda historico; engasgo aqui e teto, nao valor do jogo limpo.');
  console.log('     mediana', q(.5).toFixed(1), 'ms  | p90', q(.9).toFixed(1),
              ' | p99', q(.99).toFixed(1), ' | pior', ord.length ? ord[ord.length - 1].toFixed(0) : 0, 'ms');
  console.log('     engasgos (>34 ms):', S.engasgos, '->', (S.engasgos / seg).toFixed(2), 'por segundo | pior',
              S.engasgoPior.toFixed(0), 'ms');
  const fps = 1000 / Math.max(0.1, q(.5));
  console.log('     ritmo mediano equivale a', fps.toFixed(0), 'fps');

  console.log('\n  2. SALTO DO ATLETA DESENHADO (px de canvas por quadro)');
  console.log('     amostras', S.corpo.n, '| pico', S.corpo.pico.toFixed(0), 'px');
  console.log('     > 6 px:', S.corpo.p6, ' >18 px:', S.corpo.p18, ' >60 px:', S.corpo.p60,
              ' ->', (S.corpo.p18 / seg).toFixed(2), 'saltos medios por segundo');

  console.log('\n  3. TROCA DE GESTO');
  const cego = 100 * S.gesto.semEstado / Math.max(1, S.gesto.desenhos);
  if (cego > 20) {
    /* §OS-247 · ZERO OBSERVACAO NAO E ZERO DEFEITO. Esta secao ja reportou
       "75 trocas" contra 48417 da passada anterior, e o motivo era que a
       maquina de estados estava ESTOURANDO a cada quadro -- nao que o jogo
       tivesse ficado calmo. A sonda agora se recusa a dar nota quando nao
       esta enxergando. */
    console.log('     >>> SONDA CEGA: ' + cego.toFixed(1) + '% dos desenhos nao tem estado publicado.');
    console.log('     >>> Os numeros abaixo NAO valem. Rode tools/fisica/tela/arbitro.js');
    console.log('     >>> e olhe a secao 0, e window.__CDS_ANIM_ERRO no navegador.');
  }
  console.log('     atletas vistos:', r.atletas, '| desenhos de corpo', S.gesto.desenhos,
              '| sem estado publicado:', S.gesto.semEstado, '(' + cego.toFixed(1) + '%)');
  console.log('     desenhos por atleta por segundo:',
              (S.gesto.desenhos / seg / Math.max(1, r.atletas)).toFixed(1),
              '(tem de bater com o ritmo do quadro; se nao bater, a sonda esta cega)');
  console.log('     trocas', S.gesto.trocas,
              '->', (S.gesto.trocas / seg / Math.max(1, r.atletas)).toFixed(2), 'por atleta por segundo');
  console.log('     gestos que duraram menos de 0,12 s:', S.gesto.flap,
              '(' + (100 * S.gesto.flap / Math.max(1, S.gesto.trocas)).toFixed(1) + '% das trocas)');
  const dur = S.gesto.duracoes.slice().sort((a, b) => a - b);
  const qd = p => dur.length ? dur[Math.min(dur.length - 1, Math.floor(p * dur.length))] : 0;
  console.log('     duracao do gesto: mediana', qd(.5).toFixed(0), 'ms | p10', qd(.1).toFixed(0),
              '| p90', qd(.9).toFixed(0), '| amostras', dur.length);
  const pares = Object.entries(S.gesto.pares).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (pares.length) {
    console.log('     pares que mais alternam:');
    for (const [p, n] of pares) console.log('       ', String(n).padStart(6), p);
  }

  console.log('\n  4. PISCA-PISCA DE POSSE');
  console.log('     janelas de 3 s:', S.posse.janelas, '| trocas de dono', S.posse.trocas,
              '| janelas com 6+ trocas:', S.posse.pingue);

  console.log('\n  5. SALTO DA BOLA DESENHADA');
  console.log('     plano  >18 px:', S.bola.p18, ' >60 px:', S.bola.p60, ' pico', S.bola.pico.toFixed(0), 'px');
  console.log('     altura >0,35 m:', S.bola.zGrandes, ' pico', S.bola.zPico.toFixed(2), 'm');

  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); [...new Set(erros)].slice(0, 5).forEach(e => console.log('  ', e.slice(0, 160))); }
  else console.log('nenhum erro de pagina.');
  process.exit(0);
})();
