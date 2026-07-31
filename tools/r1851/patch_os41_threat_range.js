#!/usr/bin/env node
'use strict';
/*
 * OS-41 · NINGUEM MARCA HOMEM NA LINHA CENTRAL
 * ---------------------------------------------
 * A OS-40 foi REPROVADA e o registro fica: eu disse que a trava de
 * profundidade da camada R18.5 (:20226) era a causa da cobertura baixa, e
 * abri os clamps quase totalmente para testar —
 *
 *     threatCoverage   original 0,642
 *                      midTeto=24/defTeto=7   0,647
 *                      midTeto=45/defTeto=30  0,648
 *
 * — e a cobertura nao se moveu. A trava nao era a causa. Hipotese falsificada.
 *
 * O que o censo seguinte mostrou (8 partidas, 56.854 amostras de ameaca):
 *
 *   por distancia da ameaca ao gol observado
 *     < 30 m     21,6% das amostras   cobertura 68,4%
 *     30-45 m    30,4%                cobertura 74,9%
 *     > 45 m     48,0%                cobertura 43,4%
 *
 * Quase metade das amostras sao adversarios a MAIS DE 45 m do gol, e e la que
 * a cobertura desaba. `threats13` (:16752) chama de ameaca perigosa qualquer
 * atacante com `gd < 56` — num campo de 105 m isso e o meio-campo inteiro — e
 * o observador exige um defensor a 8,5 m dele, do lado do gol.
 *
 * Ou seja: metade do gate cobra MARCACAO INDIVIDUAL NA LINHA CENTRAL. Nenhuma
 * equipe do mundo faz isso, e o efeito colateral e visivel em campo: marcadores
 * designados a homens longe do gol ficam perseguindo referencia no meio-campo
 * em vez de manter zona. E exatamente a observacao "tem um pessoal no meio
 * campo que fica meio perdido na marcacao".
 *
 * EDIT · a ameaca passa a ser definida por perigo real:
 *     FWD:  gd < 56  ->  gd < ${'${FWD}'}
 *     MID:  gd < 43  ->  gd < ${'${MID}'}
 * As excecoes de MOVIMENTO continuam intactas: `_runDeep`, `_breaking` e o
 * portador da bola seguem sendo ameaca em qualquer distancia. Quem ataca o
 * espaco continua sendo acompanhado; quem esta parado na linha central deixa
 * de ter marcador individual e volta a ser responsabilidade de zona.
 *
 * `threats13` alimenta TAMBEM `_assignDefRoles`, entao isto e mudanca de
 * comportamento, nao so de contabilidade.
 *
 * AVISO DE METODO: o gate `marking` le esta mesma funcao. Mexer nela move o
 * gate por construcao, e por isso NAO vou citar o gate como prova. A medicao
 * de validade usa um instrumento externo (`diag_os41_marking_context.js`) que
 * replica a definicao ANTIGA de ameaca e nao muda com o patch — a regua fica
 * parada — mais os observaveis de futebol.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (regua antiga, fixa):
 *   - cobertura da faixa < 30 m (o perigo real): SOBE.
 *   - cobertura da faixa > 45 m: DESCE, de proposito.
 *   - cobertura global pela regua antiga: pode DESCER. Nao e criterio.
 *   - `colunaLongeDaBola` 0,0322: DESCE (menos perseguicao longe da bola).
 *   - swarmRate e severeCollapse: DESCEM ou ficam.
 *   - gols e xG: DESCEM ou ficam.
 *   - escanteios 5,80: nao podem cair abaixo de 4,0, senao perco a OS-39.
 *
 * ARMADILHA: se o corte for fundo demais, o time para de acompanhar quem
 * arranca de longe. As excecoes `_runDeep`/`_breaking`/portador existem para
 * isso — se `coberturaProfunda` cair, o corte esta errado.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.66 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.67 - JOGO DE FUTEBOL.html');
const FWD = arg('fwd', '44');
const MID = arg('mid', '38');
let src = fs.readFileSync(input, 'utf8');
const applied = [];

function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    console.error('ABORTA [' + id + ']: ancora ' + count + 'x');
    process.exit(1);
  }
  src = src.replace(from, to);
  applied.push(id);
}

edit(
  'os41-threat-range',
  `    if(L==='FWD')return gd<56||a._runDeep||a._breaking||a===owner;
    return ['CAM','LM','RM','LWB','RWB'].includes(a.slotPos)&&
      (gd<43||a._breaking||a._runDeep||(a===owner&&gd<64));`,
  `    /* OS-41 · gd<56 num campo de 105 m e o meio-campo inteiro. Medido: 48%
       das amostras de ameaca eram adversarios a mais de 45 m do gol, com
       cobertura de 43,4% — o gate cobrava marcacao individual na linha
       central. As excecoes de MOVIMENTO ficam: quem arranca continua sendo
       ameaca em qualquer distancia. */
    if(L==='FWD')return gd<${FWD}||a._runDeep||a._breaking||a===owner;
    return ['CAM','LM','RM','LWB','RWB'].includes(a.slotPos)&&
      (gd<${MID}||a._breaking||a._runDeep||(a===owner&&gd<64));`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| fwd=' + FWD, 'mid=' + MID);
console.log(path.basename(output), '| sha256', sha);
