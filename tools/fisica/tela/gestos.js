#!/usr/bin/env node
'use strict';
/* GESTOS — quais dos 57 estados de animacao desenham algo PROPRIO
   =========================================================================
   A maquina de estados da R14 declara 57 estados. Declarar nao e desenhar: a
   OS-60 descobriu que `block` tinha 100% de cobertura de evento e o desenho
   IDENTICO ao de corrida — o atleta "bloqueava" correndo. Esta sonda procura
   os outros casos, sem depender do meu olho.

   Como: um `Proxy` no `ctx` durante a chamada real de `CDS_F25D.body` grava a
   SEQUENCIA de operacoes de desenho (metodo + argumentos normalizados por `r`).
   Duas poses diferentes produzem sequencias diferentes; duas poses iguais
   produzem a mesma string, byte a byte.

   Para cada estado sai:
     quadros    quantas vezes o estado foi desenhado
     assinat.   quantas silhuetas DISTINTAS ele produziu
     proprio?   alguma dessas silhuetas nao aparece na locomocao comum

   Um estado com `proprio? nao` e um estado que o motor entra e o jogador nao ve.

   Uso: node tools/fisica/tela/gestos.js [build.html] [segundos]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const SEG = Number(process.argv[3] || 90);

/* A LINHA DE BASE E A CORRIDA SIMPLES, e so ela. As transicoes (accelerate,
   decelerate, turn, strafe, backpedal) sao justamente o que se quer TESTAR
   contra ela — po-las na base faz cada uma passar por construcao, e ainda
   absorve na base qualquer outro estado que compartilhe a mesma postura.
   Foi o que aconteceu na primeira leitura: `protect` apareceu "sem gesto
   proprio" so porque `strafe` tinha entrado na base com o mesmo afastamento
   de pes. */
const LOCO = ['idle', 'walk', 'jog', 'run', 'sprint'];

const ARMAR = () => {
  const real = window.CDS_F25D;
  if (!real) return false;
  if (window.__gst) return true;
  window.__gst = { est: Object.create(null) };

  const enc = Object.create(null);
  for (const k of Object.keys(real)) enc[k] = real[k];
  enc.body = function (ctx, o) {
    const ops = [];
    /* QUANTIZACAO GROSSA, de proposito. Com duas casas decimais cada quadro de
       corrida vira uma assinatura unica (a fase da passada e continua), e o
       teste de "duas poses iguais" nunca dispara — a coluna vira enfeite.
       Arredondar a 1/8 de raio junta a nuvem da corrida num punhado de
       silhuetas e deixa uma pose de verdade cair fora dela. */
    const Q = 8;
    const num = (v, r) => (typeof v === 'number' ? String(Math.round(v / r * Q)) : String(v));
    const r = o.r || 1;
    const espiao = new Proxy(ctx, {
      get(t, k) {
        const v = t[k];
        if (typeof v !== 'function') return v;
        /* so o que muda a SILHUETA; translate/save/restore nao mudam a pose */
        /* `roundRect`/`rect` entram: o tronco e os DOIS BRACOS sao desenhados
           por `rr()`, que chama `ctx.roundRect`. Sem eles a assinatura ignorava
           metade do corpo — e a modulacao de braco ficava invisivel para a
           propria sonda que deveria medi-la. */
        if (k === 'fillRect' || k === 'arc' || k === 'ellipse' ||
            k === 'rotate' || k === 'scale' || k === 'moveTo' ||
            k === 'lineTo' || k === 'quadraticCurveTo' ||
            k === 'roundRect' || k === 'rect') {
          return function () {
            const a = [];
            for (let i = 0; i < arguments.length; i++) {
              /* rotate/scale sao adimensionais: nao dividir por r */
              a.push((k === 'rotate' || k === 'scale')
                ? (typeof arguments[i] === 'number' ? String(Math.round(arguments[i] * 6)) : '')
                : num(arguments[i], r));
            }
            ops.push(k[0] + a.join(','));
            return v.apply(t, arguments);
          };
        }
        return v.bind(t);
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    const saida = real.body(espiao, o);

    const A = window.__CDS_ANIM_BY_KEY && window.__CDS_ANIM_BY_KEY[o.key];
    const st = (A && A.state) || (o.divePose ? '(divePose)' : '(sem-estado)');
    const S = window.__gst.est;
    if (!S[st]) S[st] = { n: 0, sig: Object.create(null) };
    S[st].n++;
    const s = ops.join('|');
    S[st].sig[s] = (S[st].sig[s] || 0) + 1;
    return saida;
  };
  window.CDS_F25D = enc;
  return true;
};

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 6; });
  await pg.waitForTimeout(1200);
  if (!await pg.evaluate(ARMAR)) { console.error('nao consegui armar'); process.exit(1); }

  const declarados = await pg.evaluate(() =>
    (window.CDS_ANIM && window.CDS_ANIM.STATES) ? Object.keys(window.CDS_ANIM.STATES) : []);

  process.stdout.write(`amostrando ${SEG}s a 6X`);
  for (let i = 0; i < SEG / 5; i++) { await pg.waitForTimeout(5000); process.stdout.write('.'); }
  console.log('\n');

  const est = await pg.evaluate(() => window.__gst.est);
  const audit = await pg.evaluate(() => {
    const s = window.__CDS_ACTIVE_SIM;
    return (s && s.getOS46Audit) ? s.getOS46Audit() : null;
  });
  await nav.close();

  /* conjunto de silhuetas da locomocao comum */
  const baseSet = new Set();
  for (const s of LOCO) if (est[s]) for (const k of Object.keys(est[s].sig)) baseSet.add(k);

  const linhas = Object.keys(est).map(st => {
    const sigs = Object.keys(est[st].sig);
    const proprias = sigs.filter(s => !baseSet.has(s));
    /* peso: quantos quadros caem numa silhueta que a locomocao tambem produz */
    let iguais = 0;
    for (const s of sigs) if (baseSet.has(s)) iguais += est[st].sig[s];
    return { st, n: est[st].n, sigs: sigs.length, prop: proprias.length, iguais };
  }).sort((a, b) => b.n - a.n);

  console.log('estado                 quadros  silhuetas  proprias  % igual a corrida');
  console.log('--------------------   -------  ---------  --------  -----------------');
  for (const l of linhas) {
    const loco = LOCO.includes(l.st);
    const pc = l.n ? (100 * l.iguais / l.n) : 0;
    console.log(`${l.st.padEnd(20)}   ${String(l.n).padStart(7)}  ${String(l.sigs).padStart(9)}` +
      `  ${String(l.prop).padStart(8)}  ${pc.toFixed(0).padStart(5)}%` +
      (loco ? '   (locomocao)' : (l.prop === 0 ? '   <== SEM GESTO PROPRIO' : '')));
  }

  const vistos = new Set(Object.keys(est));
  const nunca = declarados.filter(s => !vistos.has(s));
  if (nunca.length) {
    /* "nao desenhado" nao e a mesma coisa que "inalcancavel". A defesa acontece
       ~2x por partida: numa amostra curta o sorteador de quadros simplesmente
       nao pega o gesto. O AUDITOR conta os PEDIDOS, entao separa o que nunca
       foi pedido (defeito de estrutura) do que foi pedido e nao caiu na
       amostra (raridade). Sem esta coluna eu ja estava a um passo de relatar
       raridade como defeito. */
    const pedidos = (audit && audit.porEstado) || {};
    const estrut = nunca.filter(s => !pedidos[s]);
    const raros = nunca.filter(s => pedidos[s]);
    console.log(`\nNAO DESENHADOS (${nunca.length} de ${declarados.length} declarados):`);
    console.log(`  nunca PEDIDOS por ninguem (${estrut.length}) — defeito de estrutura:`);
    console.log('    ' + (estrut.join(', ') || '(nenhum)'));
    if (raros.length) {
      console.log(`  pedidos mas fora da amostra (${raros.length}) — raridade, nao defeito:`);
      console.log('    ' + raros.map(s => `${s} (${pedidos[s]}x)`).join(', '));
    }
  }
  const mudos = linhas.filter(l => !LOCO.includes(l.st) && l.prop === 0);
  console.log(`\n${mudos.length} estado(s) entram e desenham exatamente a corrida.`);
})().catch(e => { console.error(e); process.exit(1); });
