#!/usr/bin/env node
'use strict';
/*
 * OS-105 · A BOLA DEIXA DE SER SOLDADA AO JOGADOR
 * ===============================================
 *
 * OBSERVACAO DO DONO: "a forma que o jogador se aproxima pra chutar ficou
 * estranha".
 *
 * MEDIDO nos 0,6 s antes de cada chute (88 chutes na R18.86, 71 na R18.96):
 *
 *                                    R18.86      R18.96
 *   andou ......................... 2,852 m     2,998 m
 *   velocidade no chute ........... 5,635 m/s   5,975 m/s
 *   fracao dos quadros PARADO ..... 0           0
 *   QUADROS COM A BOLA NO PE (19) .. 16          19      <- p25: 12 -> 18
 *
 * Ele NAO ficou parado nem lento: anda mais e mais rapido. O que mudou e que
 * agora ele CARREGA A BOLA durante praticamente toda a janela antes de chutar,
 * porque a OS-98 fez o dominio vincular de verdade.
 *
 * E ai o defeito que estava escondido ficou exposto. `_ballGlue` (:6674):
 *
 *   const ang = Math.atan2(g.y - o.y, g.x - o.x);   // direcao do GOL
 *   b.x = o.x + Math.cos(ang) * 0.55;
 *   b.y = o.y + Math.sin(ang) * 0.55;
 *   b.z = 0; b.vx = o.vx; b.vy = o.vy;
 *
 * A bola fica SOLDADA a exatos 0,55 m do jogador, sempre apontando para o GOL --
 * nao para onde ele corre. Quem se desloca de lado leva a bola flutuando ao
 * lado do corpo. Ela nunca quica, nunca sai do pe, nunca atrasa. Antes isso
 * aparecia por ~0,53 s; agora aparece por ~0,63 s em quase todo lance.
 *
 * A CORRECAO
 *   1. A bola vai a frente da DIRECAO DE CORRIDA, nao do gol. Com o jogador
 *      lento ou parado, cai de volta para a direcao do gol (que e o que ele
 *      encara ao proteger a bola).
 *   2. CADENCIA DE TOQUE: o afastamento oscila entre ~0,42 e ~0,78 m no ritmo da
 *      passada, em vez de ficar cravado em 0,55. A bola sai do pe e ele alcanca
 *      de novo, que e o que uma conducao e.
 *   A fase da oscilacao vem de `p.idx` e do tempo da simulacao -- deterministico,
 *   sem RNG novo.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. o angulo entre "bola-jogador" e a direcao de corrida DESCE muito -- hoje
 *      ele e livre porque a bola aponta para o gol;
 *   2. a distancia bola-jogador deixa de ser constante e passa a variar;
 *   3. a ecologia diverge por CAOS: `_ballGlue` escreve a posicao da bola, que
 *      alimenta checagens de interceptacao e alcance. Nao ha direcao esperada em
 *      gols/xG, mas isto NAO e patch de apresentacao.
 *
 * GATE QUE DECIDE
 *   Ecologia em seis bases: xG <= 2,7, gols 1,8-3,0, escanteios 4-10. E o
 *   proprio (1)+(2).
 *
 * ARMADILHA REGISTRADA
 *   `_ballGlue` roda TODO quadro em que ha dono. Aumentar o afastamento maximo
 *   aproxima a bola de adversarios e pode subir desarmes e interceptacoes. O
 *   teto de 0,78 m foi escolhido para ficar abaixo do raio de coleta de
 *   `_looseRoll` (1,70 m) com folga. Se desarmes dispararem, foi por aqui.
 */
const fs = require('fs');
const crypto = require('crypto');

const arg = (n, d) => {
  const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '='));
  return h ? h.slice(n.length + 3) : d;
};
const IN = process.argv[2], OUT = process.argv[3];
const MIN = Number(arg('min', '0.42'));
const MAX = Number(arg('max', '0.78'));
if (!IN || !OUT) { console.error('uso: node patch_os105_conducao.js <entrada> <saida> [--min= --max=]'); process.exit(1); }
if (!(MIN > 0.2 && MIN < MAX && MAX <= 1.2)) { console.error('ABORTA: faixa invalida'); process.exit(1); }

let src = fs.readFileSync(IN, 'utf8');
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

edit('os105-glue',
  "  _ballGlue() {\n" +
  "    const b = this.ball, o = b.owner;\n" +
  "    if (!o) return;\n" +
  "    // bola colada ao pé do portador na direção do gol (offset reduzido para ficar visualmente no pé)\n" +
  "    const g = this.teams[o.team].oppGoal;\n" +
  "    const ang = Math.atan2(g.y - o.y, g.x - o.x);\n" +
  "    b.x = o.x + Math.cos(ang) * 0.55; b.y = o.y + Math.sin(ang) * 0.55;\n" +
  "    b.z = 0; b.vx = o.vx; b.vy = o.vy;\n" +
  "  }",

  "  _ballGlue() {\n" +
  "    const b = this.ball, o = b.owner;\n" +
  "    if (!o) return;\n" +
  "    /* §OS-105 · a bola era SOLDADA a exatos 0,55 m do jogador, sempre na\n" +
  "       direcao do GOL — nao da corrida. Quem se deslocava de lado levava a bola\n" +
  "       flutuando ao lado do corpo, e ela nunca saia do pe. Medido: depois que a\n" +
  "       OS-98 fez o dominio vincular, o finalizador passou a carregar a bola em\n" +
  "       19 dos 19 quadros antes do chute (era 16, com p25 de 12), e o defeito\n" +
  "       que estava escondido ficou exposto.\n" +
  "       Agora a bola vai a frente da DIRECAO DE CORRIDA, e o afastamento oscila\n" +
  "       na cadencia da passada: ela sai do pe e ele alcanca de novo, que e o que\n" +
  "       uma conducao e. Com o jogador lento, volta a encarar o gol.\n" +
  "       A fase vem de `o.idx` e de `this.t` — deterministico, sem RNG novo. */\n" +
  "    const g = this.teams[o.team].oppGoal;\n" +
  "    const vel = Math.hypot(o.vx || 0, o.vy || 0);\n" +
  "    const angGol = Math.atan2(g.y - o.y, g.x - o.x);\n" +
  "    const angCorrida = vel > 0.6 ? Math.atan2(o.vy, o.vx) : angGol;\n" +
  "    /* mistura: parado encara o gol, correndo leva a bola a frente do corpo */\n" +
  "    const w = Math.max(0, Math.min(1, (vel - 0.6) / 2.2));\n" +
  "    let dx = Math.cos(angGol) * (1 - w) + Math.cos(angCorrida) * w;\n" +
  "    let dy = Math.sin(angGol) * (1 - w) + Math.sin(angCorrida) * w;\n" +
  "    const L = Math.max(1e-6, Math.hypot(dx, dy)); dx /= L; dy /= L;\n" +
  "    const MING = " + MIN + ", MAXG = " + MAX + ";\n" +
  "    const passo = Math.sin((this.t || 0) * 7.4 + (o.idx || 0) * 1.9);\n" +
  "    const dist = MING + (MAXG - MING) * (0.5 + 0.5 * passo) * Math.min(1, vel / 3.2);\n" +
  "    b.x = o.x + dx * dist; b.y = o.y + dy * dist;\n" +
  "    b.z = 0; b.vx = o.vx; b.vy = o.vy;\n" +
  "  }");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nfaixa de conducao', MIN, 'a', MAX, 'm');
console.log('escrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
