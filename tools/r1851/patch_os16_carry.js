#!/usr/bin/env node
'use strict';
/*
 * OS-16 · A CONDUCAO
 * ------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * A OS-15 mediu: 250,8 passes, 12,3 cruzamentos e 7,3 conducoes por partida.
 * O motor cruza quase duas vezes mais do que conduz, e ninguem entra na area.
 * Isso e a raiz comum do penalti travado (OS-14), da posse de ~1,75 s na area
 * (OS-13) e do cruzamento com area vazia (OS-12).
 *
 * O portao da conducao esta em `_decide`, build :5199:
 *
 *   const _cnTeto = ((_cnDri + _cnAcc) / 2 >= 999) ? 0 : 0;
 *   if (cone <= _cnTeto && dtg > 6) { this._carry(o, g); return; }
 *
 * Os DOIS ramos do ternario devolvem zero. O sentinela 999 nunca dispara —
 * drible e aceleracao vao ate 99. Alguem escreveu um teto por habilidade e o
 * neutralizou. Na pratica a conducao exige `cone <= 0`, isto e, NENHUM
 * adversario no cone a frente.
 *
 * Este patch faz o teto valer o que ele evidentemente ia valer: o conduor de
 * elite tolera UM adversario no cone; o mediano continua exigindo cone limpo.
 * O limiar 78 e a media de (drible + aceleracao), na mesma escala que o motor
 * ja usa em `eliteDare` (:5186: 88 e 82).
 *
 * NAO ha RNG novo — o ramo e deterministico. NAO ha bonus de xG, velocidade ou
 * fisica: so a decisao de conduzir passa a existir para quem tem a habilidade.
 *
 * GATE QUE APERTA: ECO-02 <= 2,7 xG/partida. Mais conducao dentro da area
 * empurra xG para cima. Se estourar, a rota e ajustar conversao antes de
 * decisao.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS16 CONDUCAO.html');
const limiar = Number(arg('limiar', '78'));
const teto = Number(arg('teto', '1'));
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
  'os16-carry-cone-ceiling',
  `const _cnTeto = ((_cnDri + _cnAcc) / 2 >= 999) ? 0 : 0;`,
  `const _cnTeto = ((_cnDri + _cnAcc) / 2 >= ${limiar}) ? ${teto} : 0;`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| limiar=' + limiar, 'teto=' + teto);
console.log(path.basename(output), '| sha256', sha);
