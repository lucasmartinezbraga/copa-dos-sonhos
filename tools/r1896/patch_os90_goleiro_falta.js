#!/usr/bin/env node
'use strict';
/*
 * OS-90 · O GOLEIRO SE POSICIONA PARA A FALTA
 * ===========================================
 *
 * MEDIDO na R18.90, 58 cobrancas diretas em 12 partidas com elencos diferentes,
 * lendo a posicao do goleiro no instante do chute:
 *
 *   do lado da BARREIRA (errado) ......  53 de 58  ·  91,4%
 *   do lado LONGO (correto) ..........    1 de 58  ·   1,7%
 *   no meio ..........................    4 de 58
 *   profundidade (distancia a linha) ..  mediana 6,88 m | p90 7,04 | max 11,88
 *
 * O DEFEITO
 *   No futebol, a barreira cobre o lado CURTO -- a OS-36 arma exatamente assim,
 *   sobre a linha bola -> poste mais proximo (:24842) -- e o goleiro cobre o
 *   resto do gol, do lado LONGO. Aqui ele fica ATRAS DA PROPRIA BARREIRA, em
 *   91,4% das cobrancas, cobrindo o angulo que ja estava coberto e deixando o
 *   lado longo inteiro aberto.
 *
 *   E fica a 6,88 m da linha. Numa falta, o goleiro real fica a 1,5-3 m.
 *
 * MECANISMO, com arquivo:linha
 *   `_goalkeeperTarget` (:7190) e escrito para JOGO CORRIDO. Em :7197 e :7226
 *   ele desloca o goleiro na direcao da bola:
 *
 *     :7197  let ty=clamp(FW/2+(b.y-FW/2)*(.22+pos/290),18,FW-18);
 *     :7226  const _bis=goal.y+_dy/_L*depth;   // bissetriz bola->gol
 *
 *   Em jogo corrido isso e certo: cobrir o poste mais proximo de quem chuta.
 *   Numa falta com barreira, e exatamente o contrario do que se deve fazer,
 *   porque a barreira ja tomou esse lado. A profundidade tambem vem de
 *   :7196 (`depth=3.8+quality*1.8`), calibrada para bola em jogo.
 *
 * CORRECAO
 *   `__os36Guard` marca a janela exata da cobranca com barreira armada
 *   (:24880). So dentro dela, e so enquanto a bola AINDA NAO VOOU, o alvo do
 *   goleiro vira postura de falta: 2,2 m da linha e do lado LONGO, a meio
 *   caminho entre o centro do gol e o poste distante.
 *
 *   No quadro em que a bola parte, o ramo de :7236 assume e leva o goleiro ao
 *   ponto de interceptacao -- essa logica NAO e tocada.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. a fracao "do lado longo" SOBE de 1,7% para perto de 100%;
 *   2. a profundidade DESCE de 6,88 m para a ordem de 2,2 m;
 *   3. o desfecho realizado pode mudar: com o goleiro mais longe da trajetoria,
 *      `_gkInterceptTarget` (:6960) pode devolver null e :6961 converte `save`
 *      em `miss`. Entao `defesa` pode DESCER abaixo dos 42,3% que a OS-89
 *      calibrou. Se cair muito, a calibragem da moeda tem de ser revista --
 *      e a moeda que se ajusta ao goleiro, nao o goleiro a moeda;
 *   4. xG NAO muda: `pGoal` e somado antes e nao foi tocado.
 *
 * GATE QUE DECIDE
 *   (1) e (2) sao o gate proprio. A ecologia entra como rede em SEIS bases de
 *   24 partidas: ECO-02 xG <= 2,7, gols 1,8-3,0, ECO-05 escanteios 4-10.
 *
 * ARMADILHA REGISTRADA
 *   Se o override valer tambem DEPOIS de a bola partir, o goleiro fica parado
 *   na postura e nunca mergulha -- o contato falha por ausencia e vira gol
 *   automatico, que e exatamente o defeito que a R18.40 corrigiu em :7230.
 *   Por isso a condicao exige `!b.traveling`.
 */
const fs = require('fs');
const crypto = require('crypto');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('uso: node patch_os90_goleiro_falta.js <entrada.html> <saida.html>'); process.exit(1); }
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const CAMADA = [
'<script id="cds-os90-gk-freekick-stance">',
'(function(root){',
"'use strict';",
'/* §OS-90 · o goleiro se posiciona para a falta.',
'',
'   Medido na R18.90, 58 cobrancas diretas: em 53 delas (91,4%) o goleiro ficava',
'   do MESMO lado da barreira, cobrindo o angulo que ela ja cobria e deixando o',
'   lado longo aberto. Do lado correto: 1 em 58. E a 6,88 m da linha, quando numa',
'   falta o goleiro real fica a 1,5-3 m.',
'',
'   A causa nao e bug: `_goalkeeperTarget` (:7190) e escrito para JOGO CORRIDO,',
'   onde deslocar-se na direcao da bola (:7197, :7226) e o certo -- cobre o poste',
'   mais proximo de quem chuta. Numa falta COM BARREIRA isso se inverte, porque a',
'   barreira ja tomou esse lado (a OS-36 a arma sobre a linha bola -> poste mais',
'   proximo, :24842).',
'',
'   Aqui o alvo so e sobrescrito dentro da janela marcada por `__os36Guard` e',
'   ENQUANTO A BOLA NAO VOOU. No quadro em que ela parte, o ramo de :7236 assume',
'   e leva o goleiro ao ponto de interceptacao -- se este override sobrevivesse a',
'   esse instante, o goleiro ficaria parado na postura e o contato falharia por',
'   ausencia, que e o defeito que a R18.40 corrigiu. */',
'const M = root && root.MatchSim;',
'if (!M || !M.prototype || M.prototype.__OS90__) return;',
'const P = M.prototype; P.__OS90__ = true;',
'const POSTE = 3.66;',
'const PROF = 2.2;      // metros da linha de gol',
'const ABERTURA = 1.8;  // meio caminho entre o centro do gol e o poste distante',
'',
'const oGkT = P._goalkeeperTarget;',
'if (typeof oGkT !== "function") return;',
'P._goalkeeperTarget = function (tm, p, b, dt) {',
'  try {',
'    const g = this.__os36Guard;',
'    if (g && p && p.isGK && tm && tm.side === (1 - g.team) && b && !b.traveling) {',
'      const goal = tm.goal;',
'      if (goal && Number.isFinite(goal.x) && Number.isFinite(goal.y)) {',
'        /* lado CURTO = o poste mais proximo da bola, que a barreira cobre.',
'           O goleiro fica no oposto. */',
'        const curto = g.y < goal.y ? -1 : 1;',
'        const ty = goal.y - curto * ABERTURA;',
'        const tx = goal.x + (tm.attackDir || (goal.x > 52.5 ? -1 : 1)) * PROF;',
'        if (Number.isFinite(tx) && Number.isFinite(ty)) {',
'          p._gkAI = { x: tx, y: ty, wait: 0.08 };',
'          return [tx, ty];',
'        }',
'      }',
'    }',
'  } catch (_) {}',
'  return oGkT.apply(this, arguments);',
'};',
'root.CDS_OS90 = Object.freeze({ version: "OS-90", feature: "GK_FREEKICK_STANCE",',
'                                profundidade: PROF, abertura: ABERTURA });',
'})(typeof window!==\'undefined\'?window:globalThis);',
'</script>',
''
].join('\n');

edit('os90-camada',
  '<script id="cds-r1886-build-meta">',
  CAMADA + '<script id="cds-r1886-build-meta">');

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
