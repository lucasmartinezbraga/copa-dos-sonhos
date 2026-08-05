#!/usr/bin/env node
'use strict';
/*
 * OS-106 · CAMERA LENTA EM TODO CHUTE
 * ====================================
 *
 * PEDIDO DO DONO: "faca o chute ser em camera lenta, mesmo o resto do jogo sendo
 * mais rapido".
 *
 * ESTADO ANTES
 *   :12507  if (e.type === 'shot_taken' && e.xg >= 0.28)
 *             slowmo = { until: performance.now() + 750, f: 0.38 };
 *
 *   So o chute PERIGOSO desacelerava. Com xG medio por chute em torno de 0,10
 *   (2,2 de xG por partida em ~20 chutes), o portao de 0,28 deixa a maioria das
 *   finalizacoes passar em velocidade cheia.
 *   Ha ainda dois gatilhos proprios: cabeceio (:12517) e falta direta (OS-88).
 *
 * A CORRECAO
 *   Todo `shot_taken` entra em camera lenta, com DOIS niveis para que a enfase
 *   continue significando alguma coisa:
 *     - chute perigoso (xg >= 0.28): mais forte e mais longo;
 *     - chute comum: mais curto e mais leve.
 *   Uniformizar os dois transformaria o jogo inteiro em lentidao e o momento
 *   perigoso deixaria de se destacar -- que e o oposto do pedido.
 *
 *   `slowmo` reduz o passo da APRESENTACAO, nao o da simulacao (:12611): os
 *   mesmos `sim.step` acontecem, espalhados no relogio de parede. Nenhum numero
 *   do motor muda.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   1. a fracao de chutes com camera lenta armada SOBE para ~100%;
 *   2. os agregados do motor ficam IDENTICOS, inclusive a impressao jogo a jogo.
 *      Se um numero se mover, vazou para a simulacao.
 *
 * GATE QUE DECIDE
 *   (2). Impressao jogo a jogo identica a build anterior na mesma semente.
 *
 * CUSTO DECLARADO, e ele e real
 *   Com ~20 chutes por partida, cada um segurando ~0,4 s a mais de relogio de
 *   parede, sao ~8 s numa partida de ~384 s no 2X: cerca de +2%. Somado aos
 *   ~10 s da OS-84 (chute para fora) e aos ~3 s da OS-100 (lateral), o
 *   andamento ja devolveu perto de 5% dos 35,7% que a OS-78 comprou.
 *   Se incomodar, o botao e a duracao aqui, nao o `clockRate`.
 */
const fs = require('fs');
const crypto = require('crypto');

const arg = (n, d) => {
  const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '='));
  return h ? h.slice(n.length + 3) : d;
};
const IN = process.argv[2], OUT = process.argv[3];
const MS_COMUM = Number(arg('msComum', '520'));
const F_COMUM = Number(arg('fComum', '0.45'));
const MS_PERIGO = Number(arg('msPerigo', '780'));
const F_PERIGO = Number(arg('fPerigo', '0.32'));
if (!IN || !OUT) { console.error('uso: node patch_os106_camera_lenta_chute.js <entrada> <saida>'); process.exit(1); }
if (!(MS_COMUM >= 150 && MS_COMUM <= 1500) || !(F_COMUM > .1 && F_COMUM <= 1) ||
    !(MS_PERIGO >= 150 && MS_PERIGO <= 2000) || !(F_PERIGO > .1 && F_PERIGO <= 1)) {
  console.error('ABORTA: parametro fora de faixa'); process.exit(1);
}

let src = fs.readFileSync(IN, 'utf8');
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

edit('os106-slowmo-todo-chute',
  "  if (e.type === 'shot_taken' && e.xg >= 0.28) slowmo = { until: performance.now() + 750, f: 0.38 };",

  "  /* §OS-106 · TODO chute entra em camera lenta, nao so o perigoso.\n" +
  "     O portao de xg >= 0.28 deixava a maioria das finalizacoes passar em\n" +
  "     velocidade cheia — o xG medio por chute fica em torno de 0,10.\n" +
  "     Dois niveis, para que a enfase continue significando algo: uniformizar\n" +
  "     transformaria o jogo em lentidao e o momento perigoso deixaria de se\n" +
  "     destacar, que e o oposto do pedido.\n" +
  "     `slowmo` reduz o passo da APRESENTACAO, nao o da simulacao (:12611). */\n" +
  "  if (e.type === 'shot_taken') {\n" +
  "    slowmo = (e.xg >= 0.28)\n" +
  "      ? { until: performance.now() + " + MS_PERIGO + ", f: " + F_PERIGO + " }\n" +
  "      : { until: performance.now() + " + MS_COMUM + ", f: " + F_COMUM + " };\n" +
  "  }");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\ncomum', MS_COMUM + 'ms f' + F_COMUM, '| perigoso', MS_PERIGO + 'ms f' + F_PERIGO);
console.log('escrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
