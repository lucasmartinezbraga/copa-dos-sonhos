#!/usr/bin/env node
'use strict';
/* A VOLTA PARA CASA DEPOIS DO GOL, quadro a quadro.
   -------------------------------------------------------------------------
   Relato do dono: "depois que rola o gol o jogo comeca do nada com os
   jogadores espalhados no campo".

   Para cada pontape apos gol: quanto cada atleta tinha de andar ate o posto,
   quanto a janela da OS-214 durou, quantos CHEGARAM, e quanto sobrou.
   Se todos andam a passo cheio e a janela acaba, o gargalo e a janela --
   e nao o cabo-de-guerra tatico que a OS-214 dissolveu.

   Uso: node tools/fisica/tela/volta-para-casa.js [bundle.html] [--segundos=N]
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
const SEGUNDOS = Number(argv.segundos || 600);

(async () => {
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1500);

  await pg.evaluate(() => {
    const S = window.__vc = { saidas: [] };
    const P = window.MatchSim.prototype;
    const casaDe = p => {
      const hx = Number.isFinite(p.dhx) ? p.dhx : p.hx;
      const hy = Number.isFinite(p.dhy) ? p.dhy : p.hy;
      return (Number.isFinite(hx) && Number.isFinite(hy)) ? { x: hx, y: hy } : null;
    };
    let atual = null;
    const oldKick = P._kickoff;
    P._kickoff = function (side, start) {
      const r = oldKick.apply(this, arguments);
      try {
        if (!start && Number(this.t) > 0.5) {
          const ds = [];
          for (const tm of this.teams || []) for (const p of tm.players || []) {
            if (!p || p.red) continue;
            const c = casaDe(p);
            if (c) ds.push(Math.hypot(p.x - c.x, p.y - c.y));
          }
          atual = { t0: Number(this.t), d0: ds.slice(), dead0: Number(this.dead) || 0,
                    quadros: 0, janela: 0, dFim: null, deadTotal: 0,
                    pedida: (Number(this.__os214Ate) || 0) - Number(this.t),
                    ateFim: 0, faltandoFim: -1 };
          S.saidas.push(atual);
        }
      } catch (_) { }
      return r;
    };
    const oldStep = P.step;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        if (atual) {
          if (Number(this.dead) > 0) {
            atual.quadros++;
            atual.deadTotal = Number(this.t) - atual.t0;
            atual.ateFim = (Number(this.__os214Ate) || 0) - Number(this.t);
          } else if (atual.dFim == null) {
            /* a bola rolou: fotografa onde todo mundo ficou */
            const ds = [];
            for (const tm of this.teams || []) for (const p of tm.players || []) {
              if (!p || p.red) continue;
              const c = casaDe(p);
              if (c) ds.push(Math.hypot(p.x - c.x, p.y - c.y));
            }
            atual.dFim = ds;
            atual.janela = Number(this.t) - atual.t0;
            atual = null;
          }
        }
      } catch (_) { }
      return r;
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(SEGUNDOS * 1000);
  const r = await pg.evaluate(() => ({ s: window.__vc.saidas, m: window.GAME._sim().minute }));
  await nav.close();

  const med = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  console.log('\n=== VOLTA PARA CASA APOS GOL ===  minuto', r.m.toFixed(1),
              '| pontapes', r.s.length, '\n');
  console.log('  precisava(med/max)   ficou(med/max)   longe>6m   janela  PEDIDA  quadros');
  const todos = [];
  for (const s of r.s) {
    if (!s.dFim) continue;
    const longe = s.dFim.filter(d => d > 6).length;
    todos.push({ d0: med(s.d0), dm: Math.max(...s.d0), f: med(s.dFim),
                 fm: Math.max(...s.dFim), longe, j: s.janela });
    console.log('  ' + med(s.d0).toFixed(1).padStart(7) + ' /' + Math.max(...s.d0).toFixed(1).padStart(6),
                '   ' + med(s.dFim).toFixed(1).padStart(6) + ' /' + Math.max(...s.dFim).toFixed(1).padStart(6),
                '   ' + String(longe).padStart(6) + '/22',
                '  ' + s.janela.toFixed(2).padStart(6) + 's',
                (s.pedida || 0).toFixed(2).padStart(6) + 's', String(s.quadros).padStart(7));
  }
  if (todos.length) {
    console.log('\n  MEDIA  precisava', med(todos.map(x => x.d0)).toFixed(1),
                'm (pior', Math.max(...todos.map(x => x.dm)).toFixed(1) + ' m)',
                '| ficou', med(todos.map(x => x.f)).toFixed(1),
                'm (pior', Math.max(...todos.map(x => x.fm)).toFixed(1) + ' m)');
    console.log('         fora de casa (>6 m) no pontape:', med(todos.map(x => x.longe)).toFixed(1), 'de 22');
    console.log('         janela de bola morta:', med(todos.map(x => x.j)).toFixed(2), 's');
    const precisaria = Math.max(...todos.map(x => x.dm)) / (7 * 0.92);
    console.log('         a caminhada de 6,44 m/s precisaria de', precisaria.toFixed(1), 's para o pior caso');
  }
  process.exit(0);
})();
