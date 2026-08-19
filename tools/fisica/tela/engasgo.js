#!/usr/bin/env node
'use strict';
/* ENGASGO DE QUADRO — quanto, e de quem é a culpa
   =========================================================================
   Item aberto desde a varredura de fluidez: 0,40 a 0,49 engasgos por segundo,
   pior caso de 240 a 509 ms. Nunca foi atacado, e é o defeito que quebra a
   sensação a cada segundo de jogo.

   DUAS COISAS QUE ESTA SONDA FAZ E AS ANTERIORES NÃO FIZERAM

   1. MEDE O PRÓPRIO RUÍDO ANTES DE ACUSAR. A varredura de fluidez envolve os
      22 desenhos de corpo e a bola a cada quadro e guarda histórico; o número
      dela é TETO, não medida. Aqui a primeira passada é LIMPA -- só o relógio
      do rAF, zero gancho -- e ela roda DUAS VEZES para que a diferença entre
      as duas diga o piso de ruído da medição. Sem isso, "0,40 por segundo"
      não se distingue de 0,25 nem de 0,55.

   2. ATRIBUI A CULPA. A segunda passada cronometra separadamente as duas
      metades do quadro:
         · `sim.step`   — o motor
         · `paintField` — o desenho
      e, para todo quadro acima do limite, guarda a repartição. Assim a
      resposta não é "tem engasgo", é "o engasgo é do motor" ou "é do desenho"
      -- que pedem consertos completamente diferentes.

   O laço real é `70-game-runtime-and-rendering.js:2022`, um rAF que chama
   `sim.step` e depois `paintField` dentro de um try/catch.

   Uso: node tools/fisica/tela/engasgo.js [bundle.html] [--segundos=90]
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
const SEGUNDOS = Number(argv.segundos || 90);
const LIMITE = Number(argv.limite || 34);      // ms: o dobro do quadro de 60 fps

async function medir(pg, comGanchos) {
  await pg.evaluate((cfg) => {
    const S = window.__eng = { dts: [], step: [], paint: [], gordos: [], t0: performance.now() };
    let tAnt = 0;
    const rel = () => {
      const t = performance.now();
      if (tAnt) S.dts.push(+(t - tAnt).toFixed(2));
      tAnt = t;
      S.raf = requestAnimationFrame(rel);
    };
    S.raf = requestAnimationFrame(rel);

    if (!cfg.ganchos) return;
    /* cronometra as duas metades. O custo disto e' de duas leituras de relogio
       por quadro -- ordens de grandeza abaixo dos ganchos por desenho que a
       varredura de fluidez usava. */
    const P = window.MatchSim && window.MatchSim.prototype;
    if (P) {
      const oldStep = P.step;
      P.step = function (dt) {
        const a = performance.now();
        const r = oldStep.apply(this, arguments);
        S.step.push(+(performance.now() - a).toFixed(2));
        return r;
      };
    }
    if (typeof window.paintField === 'function') {
      const oldPaint = window.paintField;
      window.paintField = function () {
        const a = performance.now();
        const r = oldPaint.apply(this, arguments);
        S.paint.push(+(performance.now() - a).toFixed(2));
        return r;
      };
      S.temPaint = true;
    } else S.temPaint = false;
  }, { ganchos: !!comGanchos });

  await pg.waitForTimeout(SEGUNDOS * 1000);

  return await pg.evaluate((lim) => {
    const S = window.__eng;
    cancelAnimationFrame(S.raf);
    const seg = S.dts.reduce((a, b) => a + b, 0) / 1000;
    const ord = S.dts.slice().sort((a, b) => a - b);
    const q = p => ord.length ? ord[Math.min(ord.length - 1, Math.floor(p * ord.length))] : 0;
    const gordos = S.dts.filter(d => d > lim);
    const soma = a => a.reduce((x, y) => x + y, 0);
    return {
      quadros: S.dts.length, segundos: seg,
      mediana: q(.5), p90: q(.9), p99: q(.99), pior: ord.length ? ord[ord.length - 1] : 0,
      engasgos: gordos.length, porSegundo: gordos.length / Math.max(0.001, seg),
      somaEngasgo: soma(gordos),
      temPaint: S.temPaint,
      stepN: S.step.length, stepSoma: soma(S.step), stepPior: S.step.length ? Math.max(...S.step) : 0,
      paintN: S.paint.length, paintSoma: soma(S.paint), paintPior: S.paint.length ? Math.max(...S.paint) : 0,
    };
  }, LIMITE);
}

(async () => {
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const erros = [];
  const linha = (rot, r) => {
    console.log('   ' + rot.padEnd(26) +
      'mediana ' + r.mediana.toFixed(1) + ' ms' +
      ' | p99 ' + String(r.p99.toFixed(0)).padStart(4) +
      ' | pior ' + String(r.pior.toFixed(0)).padStart(5) +
      ' | engasgos ' + String(r.engasgos).padStart(4) +
      ' -> ' + r.porSegundo.toFixed(2) + '/s');
  };

  const passada = async (comGanchos) => {
    const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    pg.on('pageerror', e => erros.push(String(e)));
    await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
    await pg.waitForTimeout(1200);
    const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
    if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); process.exit(2); }
    const r = await medir(pg, comGanchos);
    await pg.close();
    return r;
  };

  console.log('\n=== ENGASGO DE QUADRO ===  ' + SEGUNDOS + ' s por passada | limite ' + LIMITE + ' ms\n');

  console.log('  0. O PISO DE RUIDO DA PROPRIA SONDA');
  console.log('     duas passadas LIMPAS do mesmo build. A diferenca entre elas e o');
  console.log('     minimo que qualquer conclusao precisa superar para valer.');
  const limpa1 = await passada(false);
  const limpa2 = await passada(false);
  linha('limpa #1', limpa1);
  linha('limpa #2', limpa2);
  const piso = Math.abs(limpa1.porSegundo - limpa2.porSegundo);
  console.log('     PISO DE RUIDO: ' + piso.toFixed(2) + ' engasgo/s entre duas medidas identicas');

  console.log('\n  1. COM CRONOMETRO NAS DUAS METADES DO QUADRO');
  const comG = await passada(true);
  linha('com ganchos', comG);
  const custo = comG.porSegundo - (limpa1.porSegundo + limpa2.porSegundo) / 2;
  console.log('     custo dos ganchos: ' + (custo >= 0 ? '+' : '') + custo.toFixed(2) + ' engasgo/s' +
              (Math.abs(custo) <= piso ? '  (dentro do piso de ruido)' : '  (ACIMA do piso: leia com desconto)'));

  console.log('\n  2. DE QUEM E A CULPA');
  if (!comG.temPaint) {
    console.log('     paintField nao esta em `window`: a metade do desenho nao foi medida.');
    console.log('     (o laco a chama por escopo de modulo -- ver 70-game-runtime:2020)');
  }
  const totalMs = comG.segundos * 1000;
  console.log('     tempo total de tela      ' + totalMs.toFixed(0) + ' ms');
  console.log('     dentro de sim.step       ' + comG.stepSoma.toFixed(0) + ' ms  (' +
              (100 * comG.stepSoma / Math.max(1, totalMs)).toFixed(1) + '%)  | pior passo ' +
              comG.stepPior.toFixed(0) + ' ms | ' + comG.stepN + ' passos');
  if (comG.temPaint) {
    console.log('     dentro de paintField     ' + comG.paintSoma.toFixed(0) + ' ms  (' +
                (100 * comG.paintSoma / Math.max(1, totalMs)).toFixed(1) + '%)  | pior pintura ' +
                comG.paintPior.toFixed(0) + ' ms | ' + comG.paintN + ' pinturas');
  }
  console.log('     soma dos engasgos        ' + comG.somaEngasgo.toFixed(0) + ' ms  (' +
              (100 * comG.somaEngasgo / Math.max(1, totalMs)).toFixed(1) + '% do tempo de tela)');

  await nav.close();
  if (erros.length) { console.log('\nERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  console.log('\n  LEITURA: se o pior passo do motor e o pior quadro batem, o engasgo e');
  console.log('  do motor e o conserto e la. Se nao batem, sobra desenho, coleta de lixo');
  console.log('  ou o proprio navegador -- e cada um pede conserto diferente.');
  process.exit(0);
})();
