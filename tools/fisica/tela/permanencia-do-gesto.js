#!/usr/bin/env node
'use strict';
/* PERMANENCIA DO GESTO — o tremor de estado, medido em janelas pareadas
   -------------------------------------------------------------------------
   Medido aqui, com a maquina de estados viva: 9,03 trocas de gesto por atleta
   por segundo, mediana de 83 ms, 87% delas durando menos de 0,12 s. Isso anula
   a mistura de pose da OS-235, que leva 0,11 s: o estado troca antes de a
   silhueta chegar.

   ATENCAO — a primeira leitura desta familia de sondas foi de 75 trocas, e era
   falsa: a maquina de estados estava estourando a cada quadro (OS-247). Por
   isso a primeira linha do relatorio e "desenhos sem estado publicado". Se
   passar de 20%, os numeros abaixo dela nao valem nada.

   Esta sonda mede o efeito da permanencia minima (OS-246) alternando
   `CDS_DWELL` DENTRO DA MESMA PARTIDA, em janelas curtas, e somando cada
   janela no seu balde. Duas razoes:

     · a licao da OS-244: janelas pareadas discordaram mais entre si do que
       os tratamentos discordavam. Comparar duas EXECUCOES e comparar ruido;
     · o build e o mesmo, a partida e a mesma, a semente e a mesma.

   E mede uma guarda, nao so o ganho: se a permanencia reduzisse o tremor
   ENGOLINDO gesto de acao (chute, desarme, cabeceio), o numero melhoraria e o
   jogo pioraria. Entao conta separado quantos gestos de ACAO (tier >= 3)
   entraram em cada balde. Esse numero tem de ficar igual.

   Uso: node tools/fisica/tela/permanencia-do-gesto.js [bundle.html]
          [--knob=CDS_DWELL] [--a=0] [--b=150] [--janela=15] [--ciclos=8]

   Os dois remedios da OS-246 sao pesados separado, um por execucao:
     --knob=CDS_DWELL     --a=0 --b=150    permanencia minima (ms de parede)
     --knob=CDS_HISTERESE --a=0 --b=1      banda morta dos limiares
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
/* o interruptor sob teste e generico: serve para `CDS_DWELL` (permanencia) e
   para `CDS_HISTERESE` (banda morta dos limiares), que sao os dois remedios da
   OS-246 e precisam ser pesados separado */
const KNOB = String(argv.knob || 'CDS_DWELL');
const VAL_A = Number(argv.a != null ? argv.a : 0);
const VAL_B = Number(argv.b != null ? argv.b : (argv.dwell != null ? argv.dwell : 150));
const JANELA = Number(argv.janela || 15);
const CICLOS = Number(argv.ciclos || 8);

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
    const S = window.__pg = {
      balde: 'x', assentando: true,
      B: { x: novo(), a: novo(), b: novo() },
      desenhos: 0, semEstado: 0, atletas: Object.create(null),
    };
    function novo() {
      return { trocas: 0, piso: 0, acao: 0, curtos: 0, duracoes: [], quadros: 0, ms: 0 };
    }
    const est = Object.create(null);
    const F = Object.assign({}, window.CDS_F25D);
    const orig = F.body;
    F.body = function (ctx, o) {
      try {
        const k = o && o.key;
        if (k) {
          S.desenhos++;
          const A = window.__CDS_ANIM_BY_KEY && window.__CDS_ANIM_BY_KEY[k];
          if (!A || !A.state) S.semEstado++;
          else {
            S.atletas[k] = 1;
            const g = est[k] || (est[k] = { st: null, desde: performance.now() });
            if (g.st !== A.state) {
              const agora = performance.now(), dur = agora - g.desde;
              const B = S.B[S.balde];
              if (g.st && !S.assentando) {
                B.trocas++;
                if (dur < 120) B.curtos++;
                if (B.duracoes.length < 40000) B.duracoes.push(+dur.toFixed(1));
                if ((A.tier || 0) >= 3) B.acao++; else B.piso++;
              }
              g.st = A.state; g.desde = agora;
            }
          }
        }
      } catch (_) { }
      return orig.apply(this, arguments);
    };
    window.CDS_F25D = F;
    /* quadros por balde, para normalizar por TEMPO DE TELA e nao por relogio */
    let tAnt = 0;
    const tick = () => {
      const t = performance.now();
      if (tAnt && !S.assentando) { const B = S.B[S.balde]; B.quadros++; B.ms += (t - tAnt); }
      tAnt = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(2500);

  /* ASSENTAMENTO de 1,2 s apos cada troca: a permanencia so vale depois que os
     22 controladores passaram pelo menos uma vez pelo regime novo. */
  for (let c = 0; c < CICLOS; c++) {
    for (const lado of ['a', 'b']) {
      await pg.evaluate(cfg => {
        window[cfg.knob] = cfg.v;
        window.__pg.balde = cfg.lado; window.__pg.assentando = true;
      }, { knob: KNOB, v: lado === 'a' ? VAL_A : VAL_B, lado: lado });
      await pg.waitForTimeout(1200);
      await pg.evaluate(() => { window.__pg.assentando = false; });
      await pg.waitForTimeout(JANELA * 1000);
    }
  }

  const r = await pg.evaluate(() => {
    const S = window.__pg;
    return { B: S.B, desenhos: S.desenhos, semEstado: S.semEstado,
             atletas: Object.keys(S.atletas).length,
             minuto: window.GAME._sim().minute };
  });
  await nav.close();

  const cego = 100 * r.semEstado / Math.max(1, r.desenhos);
  console.log('\n=== PERMANENCIA DO GESTO ===  minuto', r.minuto.toFixed(1),
              '|', r.atletas, 'atletas |', CICLOS, 'ciclos de', JANELA, 's |', KNOB, VAL_A, 'vs', VAL_B);
  console.log('desenhos sem estado publicado:', cego.toFixed(1) + '%',
              cego > 20 ? '  <<< SONDA CEGA: a maquina de estados nao esta publicando' : '(ok)');

  const linha = (rot, B) => {
    const s = Math.max(0.001, B.ms / 1000);
    const d = B.duracoes.slice().sort((x, y) => x - y);
    const med = d.length ? d[Math.floor(d.length / 2)] : 0;
    console.log('  ' + rot.padEnd(26),
                'trocas', String(B.trocas).padStart(6),
                '->', (B.trocas / s / Math.max(1, r.atletas)).toFixed(2), '/atleta/s |',
                'curtos', ((100 * B.curtos / Math.max(1, B.trocas)).toFixed(1) + '%').padStart(6),
                '| mediana', String(Math.round(med)).padStart(5), 'ms',
                '| acao', String(B.acao).padStart(5),
                '| piso', String(B.piso).padStart(6),
                '|', s.toFixed(0) + 's');
    return { taxa: B.trocas / s / Math.max(1, r.atletas), curtos: 100 * B.curtos / Math.max(1, B.trocas),
             acao: B.acao / s, med: med };
  };
  console.log('');
  const A = linha(KNOB + ' = ' + VAL_A, r.B.a);
  const Bq = linha(KNOB + ' = ' + VAL_B, r.B.b);

  console.log('\n  taxa de troca      ', A.taxa.toFixed(2), '->', Bq.taxa.toFixed(2),
              '(' + (100 * (Bq.taxa - A.taxa) / Math.max(0.001, A.taxa)).toFixed(0) + '%)');
  console.log('  gestos curtos      ', A.curtos.toFixed(1) + '%', '->', Bq.curtos.toFixed(1) + '%');
  console.log('  duracao mediana    ', Math.round(A.med), 'ms ->', Math.round(Bq.med), 'ms');
  console.log('  GUARDA: acao/s     ', A.acao.toFixed(2), '->', Bq.acao.toFixed(2),
              Math.abs(Bq.acao - A.acao) / Math.max(0.001, A.acao) > 0.15
                ? '  <<< gesto de acao mudou mais de 15%: a permanencia esta engolindo lance'
                : '  (gesto de acao preservado)');
  if (erros.length) { console.log('\nERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
