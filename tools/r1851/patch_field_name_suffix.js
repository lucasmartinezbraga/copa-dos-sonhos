#!/usr/bin/env node
'use strict';
/*
 * NOME DE CAMPO · SUFIXO GERACIONAL
 * ---------------------------------
 * O rotulo do jogador em campo vem de `lastWord(name, max)`, que devolve a
 * ULTIMA palavra do nome de registro em maiusculas. Para nome terminado em
 * sufixo geracional isso produz um rotulo que nao e nome de ninguem: os quatro
 * "JUNIOR" da selecao de 2018 dividiam o mesmo rotulo em campo.
 *
 * Nomes de uma palavra so ("Junior", "Filho", "Sobrinho") sao o nome de
 * registro do jogador e ficam como estao.
 *
 * A troca e feita SO na camada de exibicao. O nome de dados continua intacto
 * porque ele e semente em `hash32(p.n + '#' + key)` (build R18.50:2807 e
 * :2817), que gera o jitter dos atributos. Reescrever o dado mudaria os
 * atributos do jogador e, com eles, o resultado das partidas — quebrando o
 * pareamento deterministico das baterias.
 *
 * Nao ha RNG, nao ha mudanca de posse, trajetoria ou estatistica. O unico
 * efeito e o texto do rotulo.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - NOME DE CAMPO.html');
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
  'field-name-override-lastword',
  `function lastWord(name, max) {
  if (!name) return '';
  const p = name.trim().split(' ');`,
  `const FIELD_NAME = {
  'Neymar Santos Júnior': 'Neymar',
  'Marcelo da Silva Júnior': 'Marcelo',
  'Oscar Emboaba Júnior': 'Oscar',
  'João Miranda de Souza Filho': 'Miranda',
  'Roque Júnior': 'Roque',
  'José Paulo Maciel Júnior': 'Maciel'
};
function lastWord(name, max) {
  if (!name) return '';
  const p = (FIELD_NAME[name.trim()] || name).trim().split(' ');`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
