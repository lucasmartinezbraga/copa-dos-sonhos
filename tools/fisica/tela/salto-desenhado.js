#!/usr/bin/env node
'use strict';
/* SALTO DO ATLETA DESENHADO — em pixel POR MILISSEGUNDO, não por chamada
   =========================================================================
   Item aberto: "salto do atleta desenhado, pico de 776 px numa varredura e
   143 px em outra". Os dois números vieram da varredura de fluidez, e a
   OS-253 acabou de mostrar que aquela sonda infla o engasgo de 4 a 7 vezes.

   AQUI O VIÉS É PIOR DO QUE NO ENGASGO, e por um motivo que não é óbvio:
   salto medido POR CHAMADA DE DESENHO cresce quando a sonda derruba quadros.
   Se dois desenhos consecutivos ficam 50 ms distantes em vez de 16,7, o
   atleta andou três vezes mais entre eles -- e o "salto" triplica sem nada
   ter piorado no jogo. A varredura de fluidez, que envolve 23 desenhos por
   quadro e guarda histórico, faz exatamente isso.

   A correção é medir em **pixel por milissegundo** e reportar normalizado a
   um quadro de 60 fps (16,7 ms). Assim quadro perdido não vira salto.

   E separa o que é ADMINISTRATIVO do que é JOGO: o Árbitro já mostrou
   recolocação de 1328 m/s num quadro (troca de lado, formação, reinício). Isso
   é o motor reposicionando, não animação quebrada -- e some com a bola morta.
   Os dois viram linhas diferentes.

   Duas passadas limpas antes de qualquer conclusão, como na OS-253.

   Uso: node tools/fisica/tela/salto-desenhado.js [bundle.html] [--segundos=75]
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
const SEGUNDOS = Number(argv.segundos || 75);

async function passada(nav) {
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);

  await pg.evaluate(() => {
    const S = window.__sd = { vivo: [], morto: [], n: 0, semDt: 0, grandes: [], gols: [], fita: [] };
    const ult = Object.create(null);
    /* o unico gancho: uma leitura de relogio e uma subtracao por atleta.
       Nada de historico, nada de pares, nada de assinatura de imagem. */
    const F = Object.assign({}, window.CDS_F25D);
    const orig = F.body;
    F.body = function (ctx, o) {
      try {
        const k = o && o.key;
        if (k) {
          const t = performance.now(), a = ult[k];
          if (a) {
            const dt = t - a.t;
            if (dt > 0.5) {
              const d = Math.hypot(o.x - a.x, o.y - a.y);
              /* px por quadro de 60 fps, e nao px por chamada */
              const norm = d / dt * 16.7;
              const sim = window.GAME && window.GAME._sim && window.GAME._sim();
              const morta = sim && (Number(sim.dead) || 0) > 0;
              (morta ? S.morto : S.vivo).push(+norm.toFixed(1));
              S.n++;
              /* §O TESTE QUE SEPARA ATLETA DE CAMERA. Se muitos atletas saltam
                 no MESMO quadro, ninguem se moveu: o que se mexeu foi o
                 enquadramento (corte, replay de gol, troca de lado). Um atleta
                 com animacao quebrada salta SOZINHO. */
              if (norm > 60 && !morta) {
                S.grandes.push({ t: +t.toFixed(0), k: k, px: +norm.toFixed(0),
                                 min: sim ? +(Number(sim.minute) || 0).toFixed(1) : -1 });
              }
            } else S.semDt++;
          }
          ult[k] = { x: o.x, y: o.y, t: t };
        }
      } catch (_) { }
      return orig.apply(this, arguments);
    };
    window.CDS_F25D = F;

    /* §A HIPOTESE DO REPLAY. O laco de render toca `advanceTimelineReplay` na
       comemoracao de gol e avanca `replay.idx += 36 * dt` -- quadros gravados a
       36/s desenhados a 60/s. Ali o atleta salta de proposito: e reprise, nao
       animacao quebrada. Se os saltos coincidirem com gol, o item fecha. */
    const P = window.MatchSim.prototype, oldEmit = P._emit;
    P._emit = function (t, d) {
      try {
        const S = window.__sd;
        if (t === 'goal') S.gols.push(+(Number(this.minute) || 0).toFixed(1));
        /* fita rolante dos ultimos eventos: quando o episodio de salto
           aparecer, e ela que diz o que o motor estava fazendo */
        S.fita.push({ t: +performance.now().toFixed(0), tipo: t,
                      min: +(Number(this.minute) || 0).toFixed(1) });
        if (S.fita.length > 400) S.fita.shift();
      } catch (_) { }
      return oldEmit.apply(this, arguments);
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); process.exit(2); }
  await pg.waitForTimeout(SEGUNDOS * 1000);
  const r = await pg.evaluate(() => {
    const S = window.__sd;
    const stat = a => {
      if (!a.length) return { n: 0 };
      const o = a.slice().sort((x, y) => x - y);
      const q = p => o[Math.min(o.length - 1, Math.floor(p * o.length))];
      return { n: a.length, mediana: q(.5), p99: q(.99), pico: o[o.length - 1],
               acima18: a.filter(v => v > 18).length, acima60: a.filter(v => v > 60).length };
    };
    /* agrupa os saltos grandes por quadro (16 ms de tolerancia) */
    const porQuadro = new Map();
    for (const g of S.grandes) {
      const bal = Math.round(g.t / 16);
      if (!porQuadro.has(bal)) porQuadro.set(bal, []);
      porQuadro.get(bal).push(g);
    }
    const grupos = [...porQuadro.values()].map(v => ({ atletas: v.length, min: v[0].min,
                                                       px: Math.max(...v.map(x => x.px)) }));
    /* o que o motor emitiu nos 2 s em volta do primeiro salto grande */
    let volta = [];
    if (S.grandes.length) {
      const t0 = S.grandes[0].t;
      volta = S.fita.filter(e => Math.abs(e.t - t0) < 2000).map(e => e.tipo + '@' + e.min);
    }
    return { vivo: stat(S.vivo), morto: stat(S.morto), semDt: S.semDt, volta: volta,
             gols: S.gols, grandes: S.grandes.length, grupos: grupos.sort((a, b) => b.atletas - a.atletas).slice(0, 8) };
  });
  await pg.close();
  return { r, erros };
}

(async () => {
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const linha = (rot, s) => {
    if (!s.n) { console.log('   ' + rot.padEnd(22) + 'sem amostra'); return; }
    console.log('   ' + rot.padEnd(22) +
      'mediana ' + s.mediana.toFixed(1).padStart(6) + ' px' +
      ' | p99 ' + s.p99.toFixed(1).padStart(7) +
      ' | pico ' + s.pico.toFixed(0).padStart(6) +
      ' | >18px ' + String(s.acima18).padStart(6) +
      ' | >60px ' + String(s.acima60).padStart(5) +
      '   (' + s.n + ' amostras)');
  };

  console.log('\n=== SALTO DO ATLETA DESENHADO ===  ' + SEGUNDOS + ' s por passada');
  console.log('    normalizado a um quadro de 60 fps (px por 16,7 ms)\n');

  const a = await passada(nav), b = await passada(nav);
  console.log('  PASSADA #1');
  linha('bola VIVA', a.r.vivo); linha('bola morta', a.r.morto);
  console.log('  PASSADA #2');
  linha('bola VIVA', b.r.vivo); linha('bola morta', b.r.morto);

  for (const [rot, r] of [['#1', a.r], ['#2', b.r]]) {
    if (!r.grupos || !r.grupos.length) { console.log('  ' + rot + ': nenhum salto > 60 px com bola viva'); continue; }
    console.log('  ' + rot + ': ' + r.grandes + ' saltos > 60 px | gols em ' +
                (r.gols && r.gols.length ? r.gols.join(', ') : 'nenhum'));
    if (r.volta && r.volta.length) {
      console.log('       eventos do motor nos 2 s em volta do 1o salto:');
      console.log('         ' + [...new Set(r.volta)].join('  '));
    } else console.log('       NENHUM evento do motor nos 2 s em volta -- o motor estava PARADO');
    for (const g of r.grupos) {
      console.log('       ' + String(g.atletas).padStart(3) + ' atletas no mesmo quadro' +
                  ' | minuto ' + String(g.min).padStart(5) + ' | pior ' + g.px + ' px' +
                  (g.atletas >= 8 ? '   <<< CAMERA: ninguem se moveu, o enquadramento mudou'
                   : (r.gols || []).some(m => Math.abs(m - g.min) < 0.8)
                     ? '   <<< REPLAY DE GOL: quadros gravados a 36/s desenhados a 60/s' : ''));
    }
  }
  const piso = Math.abs(a.r.vivo.pico - b.r.vivo.pico);
  console.log('\n  PISO DE RUIDO no pico com bola viva: ' + piso.toFixed(0) + ' px' +
              ' — qualquer conclusao precisa superar isso.');
  console.log('\n  LEITURA: salto com bola MORTA e recolocacao administrativa do motor');
  console.log('  (troca de lado, formacao, reinicio) e nao animacao quebrada. O que');
  console.log('  incomoda no jogo e o salto com a bola VIVA.');
  await nav.close();
  const erros = [...new Set([...a.erros, ...b.erros])];
  if (erros.length) { console.log('\nERROS:'); erros.slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
