#!/usr/bin/env node
'use strict';
/* TELETRANSPORTE DA BOLA NO PLANO DO CAMPO — e o que acontece no PASSE
   -------------------------------------------------------------------------
   Relato do dono: "não é sobre mais detalhes, mas sim sobre SENTIR A FLUIDEZ
   DO FUTEBOL, sem teletransporte da bola, sem bug na hora do passe, sem o jogo
   estar quebrado".

   A OS-239 corrigiu a ALTURA da bola pulando de 1,3 m para zero num quadro.
   Mas altura era so metade: ninguem tinha medido o salto no PLANO -- x e y --,
   que e o que o dono chama de teletransporte.

   O criterio e o mesmo da altura, e nao um limiar inventado: quanto a bola
   PODE ter andado neste passo, dada a velocidade dela no quadro anterior. O
   que passa disso nao e deslocamento, e recolocacao.

   Mede tambem o quadro do PASSE em separado, porque o dono citou o passe por
   nome: no instante em que a bola parte, ela sai do PE de quem passou ou
   aparece adiante?

   Uso: node tools/fisica/tela/teleporte-da-bola.js [bundle.html] [--segundos=N]
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
    const S = window.__tb = {
      n: 0, saltos: [], porCausa: Object.create(null),
      passes: 0, passeSalto: [], passePe: [], maiores: []
    };
    const P = window.MatchSim.prototype;
    let xA = null, yA = null, vxA = 0, vyA = 0, donoA = null, viaA = false, mortaA = false;
    let marcaPasse = null;

    /* o instante do passe: `_startTravel` e a porta de saida de toda bola que
       viaja. Guarda-se quem bateu e onde ele estava. */
    const oldST = P._startTravel;
    P._startTravel = function (o, target, kind, cb, receiver, style, meta) {
      try {
        if (o && this.ball) {
          marcaPasse = { px: Number(o.x), py: Number(o.y),
                         bx: Number(this.ball.x), by: Number(this.ball.y),
                         kind: String(style || kind || '?') };
        }
      } catch (_) { }
      return oldST.apply(this, arguments);
    };

    const oldStep = P.step;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        const b = this.ball; if (!b) return r;
        const x = Number(b.x) || 0, y = Number(b.y) || 0;
        const h = Math.max(1 / 240, Math.min(0.15, Number(dt) || 1 / 30));
        S.n++;
        const morta = Number(this.dead) > 0;

        if (marcaPasse) {
          /* no quadro em que a bola parte: ela esta no pe de quem bateu? */
          S.passes++;
          const dPe = Math.hypot(x - marcaPasse.px, y - marcaPasse.py);
          const dSalto = Math.hypot(x - marcaPasse.bx, y - marcaPasse.by);
          S.passePe.push(+dPe.toFixed(2));
          S.passeSalto.push(+dSalto.toFixed(2));
          marcaPasse = null;
        }

        if (xA != null && !morta && !mortaA) {
          /* teto do passo: a velocidade anterior mais uma folga de 60% e 0,5 m,
             porque a bola acelera ao ser chutada dentro do proprio quadro */
          const permitido = Math.hypot(vxA, vyA) * h * 1.6 + 0.5;
          const andou = Math.hypot(x - xA, y - yA);
          if (andou > permitido) {
            const causa = (b.owner && !donoA) ? 'ganhou dono'
                        : (!b.owner && donoA) ? 'perdeu dono'
                        : (b.traveling && !viaA) ? 'comecou a viajar'
                        : (!b.traveling && viaA) ? 'terminou a viagem'
                        : 'sem causa aparente';
            S.porCausa[causa] = (S.porCausa[causa] || 0) + 1;
            if (S.maiores.length < 300) S.maiores.push({ d: +andou.toFixed(1), causa });
          }
        }
        xA = x; yA = y; vxA = Number(b.vx) || 0; vyA = Number(b.vy) || 0;
        donoA = b.owner || null; viaA = !!b.traveling; mortaA = morta;
      } catch (_) { }
      return r;
    };
  });

  /* O QUE FOI PARA A TELA. O motor pode recolocar a bola -- e precisa --, mas
     o desenho nao pode piscar. A interpolacao da OS-227 tem um portao:
     `if (deslocamento < 12 m)`. Acima disso ela e PULADA, que e exatamente o
     caso da bola recolocada para escanteio ou lateral: o desenho recebe o
     salto inteiro num quadro. Ao contrario do corpo do atleta, que ganhou teto
     de passo na OS-208, a bola nunca teve teto no PLANO -- so na altura. */
  await pg.evaluate(() => {
    const D = window.__td = { fases: [] };
    let atualD = null;
    window.__tdFase = function (rot, suave) {
      window.CDS_XYSUAVE = suave;
      atualD = { rot: rot, n: 0, pico: 0, m1: 0, m3: 0, m10: 0,
                 vivoN: 0, vivo18: 0, vivo60: 0, vivoPico: 0,
                 mortaN: 0, morta18: 0, morta60: 0, mortaPico: 0,
                 reinN: 0, rein18: 0, rein60: 0, reinPico: 0 };
      D.fases.push(atualD); ax = null; ay = null;
    };
    const F = Object.assign({}, window.CDS_F25D);
    const orig = F.ball;
    let ax = null, ay = null;
    F.ball = function (ctx, o) {
      try {
        if (o && typeof o.gx === 'number' && atualD) {
          if (ax != null) {
            const d = Math.hypot(o.gx - ax, o.gy - ay);
            atualD.n++;
            if (d > atualD.pico) atualD.pico = d;
            if (d > 6) atualD.m1++;
            if (d > 18) atualD.m3++;
            if (d > 60) atualD.m10++;
            /* VIVO ou MORTO: se o salto so acontece na recolocacao de bola
               parada, o corte e administrativo e honesto -- nao ha defeito.
               Se acontece com a bola rolando, ai sim e teleporte. */
            /* §3 buckets, e nao 2. O quadro em que `dead` chega a ZERO E o
               quadro da recolocacao: classifica-lo como "vivo" faz a sonda
               acusar teleporte em jogo aberto que na verdade e reinicio. Foi
               essa confusao que pos a sonda de desenho em contradicao com a
               fisica, que nao ve salto nenhum acima de 2 m com a bola rolando. */
            let morta = false, t = 0;
            try { const sm = window.GAME._sim(); morta = Number(sm.dead) > 0; t = Number(sm.t) || 0; } catch (_) { }
            if (morta) window.__ultMorta = t;
            const desdeMorta = t - (window.__ultMorta || -99);
            if (morta) { atualD.mortaN++; if (d > 18) atualD.morta18++; if (d > 60) atualD.morta60++;
                         if (d > atualD.mortaPico) atualD.mortaPico = d; }
            else if (desdeMorta < 0.6) {
              atualD.reinN++; if (d > 18) atualD.rein18++; if (d > 60) atualD.rein60++;
              if (d > atualD.reinPico) atualD.reinPico = d;
            } else { atualD.vivoN++; if (d > 18) atualD.vivo18++; if (d > 60) atualD.vivo60++;
                     if (d > atualD.vivoPico) atualD.vivoPico = d; }
          }
          ax = o.gx; ay = o.gy;
        }
      } catch (_) { }
      return orig.apply(this, arguments);
    };
    window.CDS_F25D = F;
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  const JAN = Math.max(45, Math.floor(Number(argv.segundos || 300) / 4));
  for (const [rot, sv] of [['sem teto', false], ['com teto', true],
                           ['sem teto (2a)', false], ['com teto (2a)', true]]) {
    await pg.evaluate(a => window.__tdFase(a[0], a[1]), [rot, sv]);
    await pg.waitForTimeout(JAN * 1000);
  }
  await pg.evaluate(() => { window.CDS_XYSUAVE = undefined; });
  const r = await pg.evaluate(() => ({ s: window.__tb, m: window.GAME._sim().minute, d: window.__td }));
  await nav.close();

  const pp = r.m > 0 ? 90 / r.m : 1;
  const med = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const pct = (a, p) => { const o = a.slice().sort((x, y) => x - y); return o.length ? o[Math.min(o.length - 1, Math.floor(p * o.length))] : 0; };

  console.log('\n=== TELETRANSPORTE DA BOLA NO PLANO ===  minuto', r.m.toFixed(1), '| quadros', r.s.n, '\n');
  const tot = Object.values(r.s.porCausa).reduce((a, b) => a + b, 0);
  console.log('  saltos alem do que a velocidade permitia:', tot, '->', (tot * pp).toFixed(0), 'por partida\n');
  for (const k of Object.keys(r.s.porCausa).sort((a, b) => r.s.porCausa[b] - r.s.porCausa[a])) {
    console.log('    ' + k.padEnd(24), String(r.s.porCausa[k]).padStart(4),
                '->' + (r.s.porCausa[k] * pp).toFixed(0).padStart(5) + '/partida');
  }
  const gr = r.s.maiores.filter(q => q.d > 2);
  console.log('\n  saltos maiores que 2 m:', gr.length, 'de', r.s.maiores.length, 'registrados');
  for (const q of gr.slice(0, 10)) console.log('    ' + q.d + ' m   (' + q.causa + ')');

  console.log('\n=== O QUADRO DO PASSE ===  ' + r.s.passes, 'passes\n');
  console.log('  distancia da bola ao PE de quem bateu, no quadro em que ela parte:');
  console.log('    mediana', pct(r.s.passePe, .5).toFixed(2), 'm | p90', pct(r.s.passePe, .9).toFixed(2),
              '| max', pct(r.s.passePe, 1).toFixed(2), 'm');
  console.log('    acima de 2,0 m (o pe nao alcanca):',
              (100 * r.s.passePe.filter(d => d > 2).length / Math.max(1, r.s.passePe.length)).toFixed(1) + '%');
  console.log('\n  salto da BOLA no quadro em que o passe sai:');
  console.log('    mediana', pct(r.s.passeSalto, .5).toFixed(2), 'm | p90', pct(r.s.passeSalto, .9).toFixed(2),
              '| max', pct(r.s.passeSalto, 1).toFixed(2), 'm');
  console.log('\n=== O SALTO DESENHADO DA BOLA (pixel de canvas por quadro) ===\n');
  if (r.d && r.d.fases && r.d.fases.length) {
    console.log('  fase              quadros    >6px   >18px   >60px    pico');
    for (const f of r.d.fases) console.log('  ' + f.rot.padEnd(16), String(f.n).padStart(8),
      String(f.m1).padStart(7), String(f.m3).padStart(7), String(f.m10).padStart(7),
      f.pico.toFixed(0).padStart(7));
    console.log('\n  ONDE ESTAO OS SALTOS — bola rolando contra bola morta:');
    console.log('  fase             JOGO ABERTO>18 >60 pico | REINICIO>18 >60 pico | MORTA>18 >60 pico');
    for (const f of r.d.fases) console.log('  ' + f.rot.padEnd(15),
      String(f.vivo18).padStart(9), String(f.vivo60).padStart(5), f.vivoPico.toFixed(0).padStart(6),
      ' |', String(f.rein18).padStart(9), String(f.rein60).padStart(4), f.reinPico.toFixed(0).padStart(6),
      ' |', String(f.morta18).padStart(7), String(f.morta60).padStart(4), f.mortaPico.toFixed(0).padStart(6));
    const sem = r.d.fases.filter(f => /^sem/.test(f.rot)), com = r.d.fases.filter(f => /^com/.test(f.rot));
    const so = (a, k) => a.reduce((s, f) => s + f[k], 0);
    console.log('\n  TOTAL  >18px  sem teto', so(sem, 'm3'), '| com teto', so(com, 'm3'),
                ' -> queda de', (100 * (1 - so(com, 'm3') / Math.max(1, so(sem, 'm3')))).toFixed(0) + '%');
    console.log('         >60px  sem teto', so(sem, 'm10'), '| com teto', so(com, 'm10'),
                ' -> queda de', (100 * (1 - so(com, 'm10') / Math.max(1, so(sem, 'm10')))).toFixed(0) + '%');
    console.log('         pico   sem teto', Math.max(...sem.map(f => f.pico)).toFixed(0),
                '| com teto', Math.max(...com.map(f => f.pico)).toFixed(0), 'px');
  } else console.log('  sem amostras de desenho');
  process.exit(0);
})();
