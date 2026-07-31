#!/usr/bin/env node
'use strict';
/*
 * OS-10 · O FUNIL DA FALTA
 * ------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * Medido na build promovida (8 partidas, base 4200000): 7,13 faltas por
 * partida e 0,63 cobrancas. Aplicado este patch, nas mesmas 8 sementes:
 * 8,63 faltas e 8,25 cobrancas.
 *
 * A causa:
 *
 * `_awardFoul` (:6709) so transforma falta em cobranca com `dtg < 28`. As
 *    faltas a 28 m ou mais — 4,38 por partida, 61% do total — caem no ramo de
 *    baixo, que NAO e bola parada: e `this.dead=0.82` com a bola entregue ao
 *    companheiro mais proximo. E redundante alem de nocivo: `_freeKick`
 *    (:6718) ja escolhe a rotina por distancia sozinho — `direct` ate 25 m,
 *    `crossed` ate 40 m, `short` acima disso. O corte impede o motor de usar
 *    codigo que ele ja tem.
 *
 * A supressao de falta dentro da area (:16258) foi separada para a OS-13:
 * medida, ela NAO produz penalti, porque o gargalo e outro. Ver RODADA_OS13.md.
 *
 * O que este patch NAO faz: nao cria falta nova, nao mexe em `_foulProb`, nao
 * altera conversao de bola parada, nao consome RNG novo. Os dois gates sao de
 * DESTINO da falta, nao de geracao — o total de faltas nao deve mudar.
 *
 * O 0.92 do primeiro edit deixa espaco para lei da vantagem. A resposta
 * futebolistica exata seria 1.0: falta E bola parada.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS10 FUNIL DA FALTA.html');
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
  'os10-foul-becomes-set-piece',
  `    if (dtg < 28 && chance(0.42)) { this._freeKick(victim.team, victim.x, victim.y); return; }`,
  `    /* OS-10 · sem corte de distancia: _freeKick (:6718) ja escolhe direct/
       crossed/short pela propria distancia. O 0.92 deixa espaco para vantagem. */
    if (chance(0.92)) { this._freeKick(victim.team, victim.x, victim.y); return; }`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
