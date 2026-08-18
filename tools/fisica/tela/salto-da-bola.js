#!/usr/bin/env node
'use strict';
/* O SALTO DA BOLA — descontinuidade de altura entre quadros
   -------------------------------------------------------------------------
   Relato do dono: "a animacao da bola ainda nao me agrada", "a pingada da bola
   nao me agrada".

   O quique em si esta CERTO: o traco bruto mostra a bola caindo de 5,97 m,
   tocando a 0,09 e subindo a 1,755 m -- exatamente restituicao 0,55 sobre os
   -10,5 m/s de chegada. Nao e a fisica do quique.

   O que a sonda de traco pegou foi outra coisa: a bola a 1,318 m indo a ZERO no
   quadro seguinte, junto com a troca de posse. A altura nao caiu, ela sumiu.
   Um metro e trinta desaparecendo num quadro le como falha de desenho, e e o
   tipo de coisa que se ve varias vezes por partida.

   Esta sonda mede, quadro a quadro, quanto `z` andou contra quanto a GRAVIDADE
   permitiria andar naquele passo. O que passa disso nao e queda: e recolocacao.

   Uso: node tools/fisica/tela/salto-da-bola.js [bundle.html] [--segundos=N]
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
    const S = window.__sb = { n: 0, saltos: [], quiques: [], porCausa: Object.create(null) };
    const P = window.MatchSim.prototype;
    let zAnt = null, vzAnt = 0, donoAnt = null, viaAnt = false, emQuique = false, apice = 0;
    const oldStep = P.step;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        const b = this.ball; if (!b) return r;
        const z = Number(b.z) || 0, vz = Number(b.vz) || 0;
        const h = Math.max(1 / 240, Math.min(0.15, Number(dt) || 1 / 30));
        S.n++;
        if (zAnt != null) {
          /* o quanto a altura PODE ter mudado neste passo, dada a velocidade
             vertical anterior e a gravidade -- com folga de 25% e 4 cm */
          const permitido = Math.abs(vzAnt * h) + 0.5 * 9.81 * h * h;
          const andou = Math.abs(z - zAnt);
          if (andou > permitido * 1.25 + 0.04) {
            const causa = (b.owner && !donoAnt) ? 'ganhou dono'
                        : (!b.owner && donoAnt) ? 'perdeu dono'
                        : (b.traveling && !viaAnt) ? 'comecou a viajar'
                        : (!b.traveling && viaAnt) ? 'terminou a viagem'
                        : 'sem causa aparente';
            S.porCausa[causa] = (S.porCausa[causa] || 0) + 1;
            if (S.saltos.length < 400) S.saltos.push({ de: +zAnt.toFixed(2), para: +z.toFixed(2), causa });
          }
          /* quique de verdade: z desce ate perto do raio e a velocidade
             vertical inverte de sinal */
          if (vzAnt < -0.4 && vz > 0.2 && z < 0.35) { emQuique = true; apice = z; }
          else if (emQuique) {
            if (z > apice) apice = z;
            if (vz < 0 && z < apice * 0.7) { S.quiques.push(+apice.toFixed(3)); emQuique = false; }
          }
        }
        zAnt = z; vzAnt = vz; donoAnt = b.owner || null; viaAnt = !!b.traveling;
      } catch (_) { }
      return r;
    };
  });

  /* ALEM do salto FISICO, o que importa e o salto DESENHADO: e ele que o dono
     ve. `__ballProbe` entrega a altura que foi de fato para a tela. */
  await pg.evaluate(() => {
    const D = window.__sbDes = { fases: [] };
    let atual = null, zAnt = null;
    window.__ballProbe = function (z) {
      if (!atual) return;
      if (zAnt != null) {
        const d = Math.abs(z - zAnt);
        atual.n++; if (d > atual.pico) atual.pico = d;
        if (d > 0.35) atual.grandes++;
      }
      zAnt = z;
    };
    window.__sbFase = function (rot, suave) {
      window.CDS_ZSUAVE = suave;
      atual = { rot: rot, n: 0, pico: 0, grandes: 0 }; zAnt = null;
      D.fases.push(atual);
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  const JAN = Math.max(40, Math.floor(Number(argv.segundos || 360) / 4));
  for (const [rot, sv] of [['sem suavizacao', false], ['com suavizacao', true],
                           ['sem suavizacao (2a)', false], ['com suavizacao (2a)', true]]) {
    await pg.evaluate(a => window.__sbFase(a[0], a[1]), [rot, sv]);
    await pg.waitForTimeout(JAN * 1000);
  }
  await pg.evaluate(() => { window.CDS_ZSUAVE = undefined; window.__ballProbe = null; });
  const r = await pg.evaluate(() => ({ s: window.__sb, m: window.GAME._sim().minute,
                                       d: window.__sbDes.fases }));
  await nav.close();

  const pp = r.m > 0 ? 90 / r.m : 1;
  console.log('\n=== SALTO DE ALTURA DA BOLA ===  minuto', r.m.toFixed(1), '| quadros', r.s.n, '\n');
  const tot = Object.values(r.s.porCausa).reduce((a, b) => a + b, 0);
  console.log('  saltos alem do que a gravidade permite:', tot, '->', (tot * pp).toFixed(0), 'por partida\n');
  for (const k of Object.keys(r.s.porCausa).sort((a, b) => r.s.porCausa[b] - r.s.porCausa[a])) {
    console.log('    ' + k.padEnd(24), String(r.s.porCausa[k]).padStart(4),
                '->' + (r.s.porCausa[k] * pp).toFixed(0).padStart(5) + '/partida');
  }
  const grandes = r.s.saltos.filter(q => Math.abs(q.de - q.para) > 0.5);
  console.log('\n  saltos maiores que 0,5 m:', grandes.length, 'de', r.s.saltos.length, 'registrados');
  for (const q of grandes.slice(0, 12)) console.log('    ' + q.de + ' m -> ' + q.para + ' m   (' + q.causa + ')');

  const qs = r.s.quiques;
  console.log('\n  A PINGADA — apice de cada quique (m):', qs.length, 'quiques');
  if (qs.length) {
    const ord = qs.slice().sort((a, b) => a - b);
    console.log('    mediana', ord[Math.floor(ord.length / 2)].toFixed(2),
                '| p90', ord[Math.floor(ord.length * .9)].toFixed(2),
                '| max', ord[ord.length - 1].toFixed(2),
                '| abaixo de 0,3 m:', (100 * qs.filter(z => z < .3).length / qs.length).toFixed(0) + '%');
  }
  console.log('\n  A ALTURA QUE FOI PARA A TELA (mesma partida, alternado):');
  console.log('    fase                      quadros   pico(m)   saltos>0,35 m');
  for (const f of r.d) {
    console.log('    ' + f.rot.padEnd(24), String(f.n).padStart(7),
                f.pico.toFixed(2).padStart(9), String(f.grandes).padStart(12));
  }
  const sem = r.d.filter(f => /^sem/.test(f.rot)), com = r.d.filter(f => /^com/.test(f.rot));
  const soma = a => a.reduce((x, f) => x + f.grandes, 0);
  const pico = a => Math.max(...a.map(f => f.pico));
  if (sem.length && com.length) {
    console.log('    MEDIA  sem', soma(sem), 'saltos grandes | com', soma(com),
                ' -> queda de', (100 * (1 - soma(com) / Math.max(1, soma(sem)))).toFixed(0) + '%');
    console.log('    PICO   sem', pico(sem).toFixed(2), 'm | com', pico(com).toFixed(2), 'm');
  }
  process.exit(0);
})();
