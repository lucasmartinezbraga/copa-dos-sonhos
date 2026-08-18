#!/usr/bin/env node
'use strict';
/* O VOO DA BOLA, POR TIPO DE LANCE — e como ele chega na TELA
   -------------------------------------------------------------------------
   Relato do dono: "a curva da bola na hora do lancamento ta estranha", "a
   pingada da bola nao me agrada", "quando rola uma falta a animacao nao me
   agrada nada".

   Sao quatro queixas sobre a mesma coisa, entao a sonda mede a mesma coisa em
   dois lugares, porque o defeito pode estar em qualquer um dos dois:

     FISICA   apice, alcance, tempo de voo, angulo de saida e de chegada,
              e a sequencia de quiques (altura de cada um)
     TELA     quantos PIXELS de altura cada metro de z vira, e quantos quadros
              o voo tem. Um arco fisicamente certo desenhado com escala errada
              parece errado do mesmo jeito -- e um voo de 3 quadros nao e arco
              nenhum, e um risco.

   Uso: node tools/fisica/tela/voo-da-bola.js [bundle.html] [--segundos=N]
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
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);

  await pg.evaluate(() => {
    const S = window.__vb = { voos: [], quiques: [], desenho: [] };
    const P = window.MatchSim.prototype;
    let atual = null;

    const oldST = P._startTravel;
    P._startTravel = function (o, target, kind, cb, receiver, style, meta) {
      try {
        if (atual && atual.amostras.length > 2) S.voos.push(atual);
        const b = this.ball;
        atual = {
          tipo: String(style || kind || '?'),
          kind: String(kind || '?'),
          x0: Number(b.x) || 0, y0: Number(b.y) || 0,
          t0: Number(this.t) || 0,
          amostras: [], quiques: [], apice: 0, quadros: 0
        };
      } catch (_) { }
      return oldST.apply(this, arguments);
    };

    const oldStep = P.step;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        const b = this.ball;
        if (atual && b) {
          const z = Number(b.z) || 0;
          const prev = atual.amostras[atual.amostras.length - 1];
          atual.amostras.push({ t: Number(this.t), x: b.x, y: b.y, z: z,
                                v: Math.hypot(b.vx || 0, b.vy || 0), vz: b.vz || 0 });
          if (z > atual.apice) atual.apice = z;
          /* quique: z chega a ~0 vindo de cima e volta a subir */
          if (prev && prev.z > 0.02 && z <= 0.02 && (b.vz || 0) >= 0) {
            atual.quiques.push(+prev.z.toFixed(3));
          }
          if (atual.amostras.length > 900) { S.voos.push(atual); atual = null; }
        }
      } catch (_) { }
      return r;
    };

    /* A TELA: quantos pixels de altura cada metro de z vira, medido no
       desenhista de verdade, nao deduzido do codigo. */
    try {
      const F = Object.assign({}, window.CDS_F25D);
      const orig = F.ball;
      F.ball = function (ctx, o) {
        try {
          if (o && typeof o.z === 'number' && typeof o.y === 'number')
            S.desenho.push({ z: o.z, y: o.y, r: o.r });
          if (S.desenho.length > 4000) S.desenho.splice(0, 2000);
        } catch (_) { }
        return orig.apply(this, arguments);
      };
      window.CDS_F25D = F;
    } catch (_) { }
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(Number(argv.segundos || 420) * 1000);
  const r = await pg.evaluate(() => ({ v: window.__vb.voos, d: window.__vb.desenho,
                                       m: window.GAME._sim().minute }));
  await nav.close();

  const med = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  console.log('\n=== O VOO DA BOLA ===  minuto', r.m.toFixed(1), '| lances', r.v.length, '\n');

  const porTipo = {};
  for (const v of r.v) {
    if (!v.amostras || v.amostras.length < 3) continue;
    const a0 = v.amostras[0], aN = v.amostras[v.amostras.length - 1];
    const alc = Math.hypot(aN.x - v.x0, aN.y - v.y0);
    const dur = aN.t - a0.t;
    if (alc < 3) continue;
    /* angulo de saida pelas duas primeiras amostras */
    const a1 = v.amostras[1];
    const dh = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1e-6;
    const ang = Math.atan2(Math.max(0, a1.z - a0.z), dh) * 180 / Math.PI;
    (porTipo[v.tipo] || (porTipo[v.tipo] = [])).push({
      apice: v.apice, alc, dur, ang, quadros: v.amostras.length,
      quiques: v.quiques.slice(0, 6)
    });
  }

  console.log('  tipo            n   apice    alcance   tempo   angulo  quadros');
  for (const k of Object.keys(porTipo).sort((a, b) => porTipo[b].length - porTipo[a].length)) {
    const g = porTipo[k];
    console.log('  ' + k.padEnd(14), String(g.length).padStart(3),
      med(g.map(x => x.apice)).toFixed(2).padStart(7) + ' m',
      med(g.map(x => x.alc)).toFixed(1).padStart(7) + ' m',
      med(g.map(x => x.dur)).toFixed(2).padStart(6) + ' s',
      med(g.map(x => x.ang)).toFixed(1).padStart(6) + '°',
      med(g.map(x => x.quadros)).toFixed(0).padStart(6));
  }

  console.log('\n  A PINGADA — sequencia de quiques (altura de cada um, em m):');
  const comQuique = r.v.filter(v => v.quiques && v.quiques.length >= 2).slice(0, 10);
  for (const v of comQuique) console.log('    ' + v.tipo.padEnd(12), JSON.stringify(v.quiques));
  const todas = r.v.flatMap(v => v.quiques || []);
  if (todas.length) {
    const razoes = [];
    for (const v of r.v) for (let i = 1; i < (v.quiques || []).length; i++)
      if (v.quiques[i - 1] > 0.05) razoes.push(v.quiques[i] / v.quiques[i - 1]);
    console.log('    quiques totais:', todas.length,
                '| razao media entre quiques consecutivos:', med(razoes).toFixed(3),
                '(RESTITUICAO^2 = 0,3025)');
    console.log('    alturas: mediana', todas.slice().sort((a, b) => a - b)[Math.floor(todas.length / 2)].toFixed(2),
                'm | max', Math.max(...todas).toFixed(2), 'm',
                '| abaixo de 0,30 m:', (100 * todas.filter(z => z < .3).length / todas.length).toFixed(0) + '%');
  }

  console.log('\n  A TELA — pixels de altura por metro de z:');
  if (r.d.length > 30) {
    const comZ = r.d.filter(q => q.z > 0.3);
    if (comZ.length > 10) {
      console.log('    amostras de desenho com z > 0,3 m:', comZ.length, 'de', r.d.length,
                  '(' + (100 * comZ.length / r.d.length).toFixed(1) + '%)');
      console.log('    z medio desenhado:', med(comZ.map(q => q.z)).toFixed(2), 'm | z max:',
                  Math.max(...comZ.map(q => q.z)).toFixed(2), 'm');
      console.log('    raio medio do desenho:', med(r.d.map(q => q.r || 0)).toFixed(2), 'px');
    } else console.log('    quase nenhum quadro com a bola no alto:', comZ.length, 'de', r.d.length);
  } else console.log('    sem amostras de desenho (o desenhista pode estar congelado)');
  process.exit(0);
})();
