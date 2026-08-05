#!/usr/bin/env node
'use strict';
/*
 * OS-88 · O MOMENTO DA FALTA
 * ==========================
 *
 * Complemento de APRESENTACAO da OS-87. Depois que o cobrador passou a chegar
 * na bola (9,162 m -> 1,400 m de mediana), sobrou o outro lado da queixa: a
 * cobranca sai com a mesma cadencia de um passe qualquer. Nao ha momento.
 *
 * O QUE JA EXISTE E NAO PRECISA SER REFEITO -- verificado, nao suposto:
 *   - circulo de 9,15 m tracejado, barreira com marca ao pe e anel do cobrador:
 *     camada OS-20/OS-50, canvas proprio `#cds-os21-cv` (:24730-24771);
 *   - pose de chute do cobrador: `motionAt(e.by,'kick',0.46)` em :12455;
 *   - desfecho da bola: a OS-84 ja cobre, porque a direta emite `miss` no ramo
 *     de fora e chama `_goal` no de gol;
 *   - barreira fisica a 9,15 m: OS-36, medida em 9,04 a 9,51 m.
 *
 * O QUE FALTA
 *   Tempo de retina no contato. Medido: a cobranca resolve e a bola voa em
 *   0,217 s de simulacao -- no 2X isso e 0,12 s de relogio de parede, o mesmo
 *   numero que tornava o chute para fora ilegivel antes da OS-84.
 *
 * MECANISMO
 *   A mesma alavanca de :12507, que o jogo ja usa em chute perigoso e em
 *   cabeceio: `slowmo` reduz o passo da APRESENTACAO, nao o da simulacao. Os
 *   mesmos `sim.step` acontecem, so que espalhados no relogio de parede.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   1. o tempo de tela do contato e do voo da falta SOBE;
 *   2. os agregados do motor ficam IDENTICOS, inclusive a impressao jogo a
 *      jogo -- e patch de apresentacao, e se um numero se mover, vazou.
 *
 * GATE QUE DECIDE
 *   (2). Impressao jogo a jogo identica a R18.88 na mesma semente.
 *
 * ARMADILHA REGISTRADA
 *   `slowmo` clampa a velocidade para `min(G.speed,1)*f`. Com f muito baixo a
 *   cobranca vira lentidao e o jogo parece travado; com a janela muito longa,
 *   ela vaza para o lance seguinte. 700 ms a 0,35 cobre contato + voo (a bola
 *   leva ~0,6 s para chegar ao gol a 25 m) e termina antes do rebote.
 *   So a DIRETA entra: cruzada e curta sao jogadas normais e nao merecem freio.
 */
const fs = require('fs');
const crypto = require('crypto');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('uso: node patch_os88_momento_falta.js <entrada.html> <saida.html>'); process.exit(1); }
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

edit('os88-momento',
  "  if (e.type === 'freekick' && e.by) motionAt(e.by, 'kick', 0.46);   // pose de cobrança de falta no 2.5D",

  "  /* §OS-88 · O MOMENTO DA FALTA.\n" +
  "     A cobrança resolve e a bola voa em 0,217 s de simulação — 0,12 s de\n" +
  "     relógio de parede no 2X, o mesmo número que tornava o chute para fora\n" +
  "     ilegível antes da OS-84. A pose de chute já existia e ninguém a via.\n" +
  "     Mesma alavanca de :12507: reduz o passo da APRESENTAÇÃO, não o da\n" +
  "     simulação — os mesmos sim.step acontecem, espalhados no relógio.\n" +
  "     Só a DIRETA entra: cruzada e curta são jogadas normais. */\n" +
  "  if (e.type === 'freekick' && e.by) {\n" +
  "    motionAt(e.by, 'kick', 0.46);   // pose de cobrança de falta no 2.5D\n" +
  "    if (e.direct) slowmo = { until: performance.now() + 700, f: 0.35 };\n" +
  "  }");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
