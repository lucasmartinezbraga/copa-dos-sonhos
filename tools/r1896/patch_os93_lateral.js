#!/usr/bin/env node
'use strict';
/*
 * OS-93 · O LATERAL PASSA A SER COBRADO POR ALGUEM QUE ANDOU ATE A BOLA
 * =====================================================================
 *
 * OBSERVACAO DO DONO
 *   "Aconteceu tambem do Neymar ir bater o lateral e sair driblando."
 *
 * MEDIDO na R18.92, 8 partidas, 66 laterais:
 *
 *   laterais por partida ................... 8,25
 *   SALTO do cobrador no quadro do reinicio  mediana 4,475 m | p90 8,196 | max 12,465
 *   saltos acima de 1 m .................... 39 de 66  ·  59%
 *   cobrador -> bola no reinicio ........... 0,459 m   (isto ja estava certo)
 *   bola andou do ponto de saida ........... 1,946 m
 *   espera ate o reinicio .................. 2,533 s   (isto ja existia)
 *
 * Um salto de 4,475 m num quadro de 1/30 s e 134 m/s. E teleporte.
 *
 * MECANISMO, com arquivo:linha (:7180 `_ballOut`, ramo lateral)
 *
 *   this.pendingRestart = () => {
 *     const y = clamp(b.y, 1, FW-1);
 *     const cand = this.teams[to].players.filter(...).sort(por |a.y - y|)[0];
 *     if (cand){ cand.x = clamp(b.x,1,FL-1); cand.y = y; this._giveBall(cand); ... }
 *   };
 *
 *   O jogador e escolhido NO INSTANTE DO REINICIO, por proximidade em y apenas,
 *   e entao CRAVADO no ponto da bola. Ninguem caminha. Para quem assiste, um
 *   jogador se materializa na linha com a bola no pe e sai jogando -- que e
 *   exatamente a cena descrita.
 *
 *   E a mesma classe de defeito da OS-87 na falta direta: a maquina de bola
 *   parada existe e funciona (a bola E colocada no ponto, a espera EXISTE), mas
 *   o corpo do cobrador nao participa.
 *
 * CORRECAO
 *   Reaproveita a maquinaria de bola parada que ja esta no arquivo, em vez de
 *   inventar outra: `__spTarget` (a camada de bola parada anda por passo ate
 *   ele) e `__cdsTakerWait` (o passo da R18.35 segura o reinicio ate a chegada
 *   ou ate o teto). O cobrador e escolhido NA SAIDA, nao no reinicio, e caminha.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. o salto do cobrador no quadro do reinicio DESCE, e a contagem de saltos
 *      acima de 1 m cai para perto de zero;
 *   2. `cobrador -> bola` continua baixo (ja estava em 0,459 m) -- se subir, a
 *      espera esta curta demais e ele nao chega;
 *   3. a espera SOBE, porque agora depende da distancia percorrida. Isso e tempo
 *      morto, com 8,25 laterais por partida -- e o custo a declarar;
 *   4. agregados do motor divergem por CAOS: isto move corpos.
 *
 * GATE QUE DECIDE
 *   (1) com (2). Ecologia como rede em SEIS bases: xG <= 2,7, gols 1,8-3,0,
 *   escanteios 4-10.
 *
 * ARMADILHA REGISTRADA
 *   O teto de espera. Com 8,25 laterais por partida, cada segundo a mais custa
 *   8 s de bola morta por jogo -- contra os 35,7% de andamento que a OS-78
 *   comprou. Por isso o teto e 2,6 s e o cobrador escolhido e o MAIS PROXIMO do
 *   ponto de saida (nao o mais proximo em y, como era), o que encurta o
 *   caminho. Meca a fracao de quadros com `dead > 0` antes e depois.
 */
const fs = require('fs');
const crypto = require('crypto');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('uso: node patch_os93_lateral.js <entrada.html> <saida.html>'); process.exit(1); }
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const CAMADA = [
'<script id="cds-os93-throwin-taker-walks">',
'(function(root){',
"'use strict';",
'/* §OS-93 · o lateral passa a ser cobrado por alguem que andou ate a bola.',
'',
'   Medido na R18.92, 66 laterais: o cobrador SALTAVA 4,475 m (mediana) no quadro',
'   do reinicio, com maximo de 12,465 m — 59% dos laterais com salto acima de 1 m.',
'   Um salto de 4,475 m em 1/30 s e 134 m/s. Para quem assiste, um jogador se',
'   materializa na linha com a bola no pe e sai jogando.',
'',
'   A causa esta em :7180 (_ballOut, ramo lateral): o jogador e escolhido NO',
'   INSTANTE DO REINICIO, por proximidade em y apenas, e entao cravado no ponto',
'   com `cand.x = clamp(b.x,...); cand.y = y`. Ninguem caminha.',
'',
'   Mesma classe da OS-87 na falta: a maquina existe e funciona (a bola E posta no',
'   ponto, a espera EXISTE), mas o corpo do cobrador nao participa. Aqui ela e',
'   reaproveitada em vez de reinventada: `__spTarget` faz a camada de bola parada',
'   andar por passo, e `__cdsTakerWait` faz o passo da R18.35 segurar o reinicio',
'   ate a chegada. */',
'const M = root && root.MatchSim;',
'if (!M || !M.prototype || M.prototype.__OS93__) return;',
'const P = M.prototype; P.__OS93__ = true;',
'const FLv = Number(root.FL) || 105, FWv = Number(root.FW) || 68;',
'const WALK = 4.2;        // m/s, ir buscar a bola sem correr',
'const TETO = 2.6;        // s — teto de espera; ver armadilha no cabecalho',
'const PAUSA = 0.45;      // s — pausa minima mesmo com o cobrador ja no ponto',
'function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }',
'function dd(a, b, c, d) { return Math.hypot(a - c, b - d); }',
'',
'const oldOut = P._ballOut;',
'if (typeof oldOut !== "function") return;',
'P._ballOut = function () {',
'  const b = this.ball;',
'  const ehLateral = !(b.x <= 0 || b.x >= FLv);',
'  const sx = cl(Number(b.x), 1, FLv - 1), sy = cl(Number(b.y), 1, FWv - 1);',
'  const ultimo = b.lastTouch ? b.lastTouch.team : this.poss;',
'  const r = oldOut.apply(this, arguments);',
'  try {',
'    if (!ehLateral || !this.pendingRestart) return r;',
'    const para = 1 - ultimo;',
'    const tm = this.teams[para]; if (!tm) return r;',
'    /* MAIS PROXIMO DO PONTO, nao mais proximo em y: encurta o caminho e com',
'       isso o tempo morto. */',
'    let cand = null, melhor = Infinity;',
'    for (const p of tm.players) {',
'      if (!p || p.red || p.isGK) continue;',
'      const d = dd(p.x, p.y, sx, sy);',
'      if (d < melhor) { melhor = d; cand = p; }',
'    }',
'    if (!cand) return r;',
'    cand._setPieceRole = "taker";',
'    cand.__spTarget = { x: sx, y: sy };',
'    const espera = Math.min(TETO, PAUSA + melhor / WALK);',
'    this.dead = Math.max(Number(this.dead) || 0, espera);',
'    this.__cdsTakerWait = { taker: cand, x: sx, y: sy, until: Number(this.t) + espera };',
'    /* a bola fica NO PONTO enquanto ele vem */',
'    b.owner = null; b.traveling = false;',
'    b.x = sx; b.y = sy; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;',
'    const sim = this;',
'    this.pendingRestart = function () {',
'      try { cand._setPieceRole = null; cand.__spTarget = null; } catch (_) {}',
'      sim._giveBall(cand);',
'      if (sim.ball.owner) sim.ball.owner.settle = 0.5;',
'    };',
'  } catch (_) {}',
'  return r;',
'};',
'root.CDS_OS93 = Object.freeze({ version: "OS-93", feature: "THROWIN_TAKER_WALKS",',
'                                walk: WALK, teto: TETO });',
'})(typeof window!==\'undefined\'?window:globalThis);',
'</script>',
''
].join('\n');

edit('os93-camada',
  '<script id="cds-r1886-build-meta">',
  CAMADA + '<script id="cds-r1886-build-meta">');

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
