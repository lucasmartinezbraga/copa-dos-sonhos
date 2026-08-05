#!/usr/bin/env node
'use strict';
/*
 * OS-101 · O GOL DE FALTA DIRETA
 * ===============================
 *
 * MEDIDO (funcao pura `resolveFreeKickPhysics`, 50 000 amostras por cenario,
 * na R18.94 promovida):
 *
 *   batedor 90 x goleiro 75, 22 m ... gol 4,17%
 *   batedor 75 x goleiro 75, 25 m ... gol 3,13%
 *   batedor 60 x goleiro 80, 30 m ... gol 2,02%
 *
 * REFERENCIA REAL de falta direta em posicao de chute (18-30 m):
 *   conversao geral .......... ~5 a 6%
 *   especialista de elite .... ~8 a 10%
 *   mediano .................. ~3 a 5%
 *
 * Dois problemas, e o segundo e o que importa:
 *   (a) o patamar esta baixo — o elite converte 4,17% onde deveria estar em 7-8%;
 *   (b) a SEPARACAO entre elite e mediano e de apenas 2,06x (4,17 / 2,02).
 *       No futebol a diferenca entre um especialista de falta e um jogador comum
 *       e muito maior que isso. Hoje o atributo quase nao decide.
 *
 * MECANISMO, com arquivo:linha (R18.94)
 *
 *   :2888  const baseGoal = clamp(.032 * (1 + (takerSkill - keeperSkill)/100 * 1.35), .010, .090);
 *   :2889  const pGoal    = clamp(baseGoal * (.52 + execution*.82 + corner*.28 + curveQ*.14), .010, .140);
 *
 *   Com batedor 90 e goleiro 75: `.032 * 1,2025 = 0,0385`. O multiplicador de
 *   execucao/canto/curva fica em ~1,276, entao pGoal ~0,049 e a taxa realizada
 *   ~4,17% (o gol e sorteado DEPOIS de offTarget e barreira, entao a realizada
 *   e ~84% do pGoal).
 *
 * NOTA SOBRE O COMENTARIO EXISTENTE (:2884-2887)
 *   Ele afirma que "batedor 90 contra goleiro 75 sobe de ~6,1% para ~6,4% de
 *   base". A conta da linha nao produz isso com nenhum fator: 1,2 daria 3,58%,
 *   1,35 da 3,85%, 1,5 daria 3,92%. **O comentario esta defasado em relacao ao
 *   codigo.** Nao confie nele; confie na amostragem da funcao pura.
 *
 * EDIT
 *   de:   .032 * (1 + (t-k)/100 * 1.35),  teto .090
 *   para: .048 * (1 + (t-k)/100 * 2.20),  teto .130
 *
 *   Sobe o patamar e ABRE a separacao por atributo, que e o alvo principal.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. a taxa de gol de falta direta SOBE, e a separacao elite/mediano SOBE;
 *   2. xG por partida SOBE de leve — `pGoal` alimenta `stats.xg` diretamente
 *      (`this.stats[team].xg += pGoal`), entao isto NAO e neutro no gate ECO-02;
 *   3. gols por partida SOBEM de leve;
 *   4. defesa / barreira / fora mudam pouco: o sorteio de gol vem ANTES da moeda
 *      defesa/fora, entao tirar do "nao-gol" redistribui pouco.
 *
 * GATE QUE DECIDE
 *   ECO-02 xG <= 2,7 nas SEIS bases — este e o gate em risco, porque o patch
 *   mexe direto no xG. Mais gols 1,8-3,0 e escanteios 4-10.
 *   Gate proprio: taxa de gol do batedor de elite na faixa 5-8%.
 *
 * ARMADILHA REGISTRADA
 *   `pGoal` entra em `stats.xg` ANTES do sorteio. Subir o patamar sobe o xG de
 *   toda partida com falta, mesmo quando nenhuma entra. Com ~3,6 cobrancas
 *   diretas por partida, cada ponto percentual de pGoal custa ~0,036 de xG.
 *   Se o ECO-02 apertar, o caminho nao e reduzir o patamar de volta: e olhar o
 *   `wallRisk` (17-18% contra ~20-25% reais), que tira cobrancas do sorteio de
 *   gol sem mexer no xG por cobranca.
 */
const fs = require('fs');
const crypto = require('crypto');

const arg = (n, d) => {
  const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '='));
  return h ? h.slice(n.length + 3) : d;
};
const IN = process.argv[2], OUT = process.argv[3];
const BASE = Number(arg('base', '0.048'));
const FATOR = Number(arg('fator', '2.20'));
const TETO = Number(arg('teto', '0.130'));
if (!IN || !OUT) { console.error('uso: node patch_os101_gol_de_falta.js <entrada> <saida> [--base= --fator= --teto=]'); process.exit(1); }
if (!(BASE > 0 && BASE < .2) || !(FATOR >= 0 && FATOR <= 5) || !(TETO > 0 && TETO <= .3)) {
  console.error('ABORTA: parametro fora de faixa'); process.exit(1);
}

let src = fs.readFileSync(IN, 'utf8');
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

edit('os101-basegoal',
  "  const baseGoal = clamp(.032 * (1 + (takerSkill - keeperSkill)/100 * 1.35), .010, .090);",

  "  /* §OS-101 · o gol de falta direta.\n" +
  "     Medido amostrando esta funcao 50 000 vezes por cenario: batedor 90 x\n" +
  "     goleiro 75 convertia 4,17%, mediano 3,13%, fraco 2,02%. A referencia real\n" +
  "     e ~8-10% para especialista, ~5-6% no geral e ~3-5% para o mediano — e,\n" +
  "     pior que o patamar, a SEPARACAO por atributo era de apenas 2,06x, ou\n" +
  "     seja o atributo quase nao decidia quem faz gol de falta.\n" +
  "     O comentario acima esta defasado: ele fala em ~6,1% de base, e a conta\n" +
  "     antiga dava 3,85% com batedor 90 contra goleiro 75. Confie na amostragem\n" +
  "     da funcao pura, nao no comentario.\n" +
  "     ARMADILHA: `pGoal` entra em `stats.xg` ANTES do sorteio, entao isto NAO e\n" +
  "     neutro no ECO-02 — cada ponto percentual custa ~0,036 de xG por partida. */\n" +
  "  const baseGoal = clamp(" + BASE + " * (1 + (takerSkill - keeperSkill)/100 * " + FATOR + "), .012, " + TETO + ");");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nbase', BASE, '| fator', FATOR, '| teto', TETO);
console.log('escrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
