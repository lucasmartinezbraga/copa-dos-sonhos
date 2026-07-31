#!/usr/bin/env node
'use strict';
/*
 * OS-44 · O DUELO AEREO PASSA A DEPENDER DE QUEM ESTA LA
 * -------------------------------------------------------
 * CORRECAO DE UM ERRO MEU, PRIMEIRO. No relatorio da OS-42/43 escrevi que "o
 * cruzamento aereo nao sobe", baseado em ver `_startTravel(o,__alvo,'pass',...)`
 * e nao ter lido o fim da chamada. Ela termina em `},null,'launch')`. O
 * cruzamento SOBE: `z=0.3`, `vz=7`, velocidade 24,3 — um arco com pico de
 * ~1,5 m. A afirmacao estava errada e fica corrigida aqui e no relatorio.
 *
 * Lendo o trecho inteiro apareceu o mecanismo de verdade. O cruzamento tem DOIS
 * ramos, e o que gera `header_shot` e o de `:5411`, que entrega direto na
 * cabeca do atacante e resolve um duelo:
 *
 *     const def = defs.slice().sort((a,b)=>D(a,atk)-D(b,atk))[0];
 *     const pWin = duelProb(facet(atk,'head_atk')+setBoost+swing,
 *                           (def?facet(def,'head_def'):40)+5);
 *
 * O duelo existe. O que nao existe e a DISTANCIA. `def` e simplesmente o
 * defensor mais proximo do atacante, sem nenhum limite: um zagueiro a 15 m
 * entra na conta como se estivesse marcando, e o atacante disputa contra o
 * atributo dele. Do outro lado, um zagueiro colado nao ganha nada por estar
 * colado. O resultado medido:
 *
 *     cruzamento -> chute   68,6% na R18.67   (real ~25%)
 *
 * EDIT · o duelo ganha um termo de proximidade, somado ao lado do DEFENSOR:
 *
 *     prox = clamp((${'${CORTE}'} - dDef) * ${'${GANHO}'}, -${'${TETO}'}, ${'${TETO}'})
 *       dDef = 0,0 m  ->  defensor +${'${TETO}'}
 *       dDef = ${'${CORTE}'} m  ->  neutro
 *       dDef >= ${'${CORTE}'}+${'${TETO}'}/${'${GANHO}'} m  ->  defensor -${'${TETO}'} (atacante livre)
 *
 * Nao ha atributo novo, nem RNG novo: `duelProb`, `head_atk` e `head_def` sao
 * os mesmos. O que entra e a pergunta que faltava — o defensor esta la?
 *
 * Isto se soma a OS-42, que poe os dois defensores mais proximos no ponto de
 * queda. Sem a OS-42 o termo quase nunca seria positivo; sem a OS-44 estar la
 * nao mudava o desfecho. As duas juntas e que fazem a jogada existir.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.68, que ja tem OS-42 e OS-43):
 *   - `cruzamento -> chute` 52,7%: DESCE para a casa de 30 a 45%.
 *   - `header_shot` 5,9: DESCE.
 *   - chutes 20,15: DESCEM pouco.
 *   - gols 1,90: pode DESCER mais — e o risco desta rodada, ja estavam baixos.
 *   - escanteios 5,47: nao podem cair abaixo de 4,0.
 *   - RECUSA se os gols cairem abaixo de 1,5 ou se `cruzamento -> chute` cair
 *     abaixo de 20%.
 *
 * ARMADILHA: a OS-43 ja adiciona um duelo na chegada para entregas vindas de
 * fora. Este ramo tambem passa por la, entao ha DOIS filtros defensivos em
 * serie. Se o resultado afundar, a OS-43 e a que sai — ela e a camada externa,
 * a OS-44 e o mecanismo proprio do lance.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.68 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.69 - JOGO DE FUTEBOL.html');
const CORTE = arg('corte', '3.2');
const GANHO = arg('ganho', '9');
const TETO = arg('teto', '22');
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
  'os44-aerial-duel-distance',
  `      const pWin=duelProb(facet(atk,'head_atk')+setBoost+(sw==='in'?2.5:0),(def?facet(def,'head_def'):40)+5);`,
  `      /* OS-44 · o duelo aereo ignorava a distancia: \`def\` era o defensor mais
         proximo do atacante SEM LIMITE, entao um zagueiro a 15 m disputava com
         o atributo dele e um zagueiro colado nao ganhava nada por estar colado.
         Medido: 68,6% dos cruzamentos viravam finalizacao contra ~25% reais. */
      const _o44d=def?D(def.x,def.y,atk.x,atk.y):99;
      const _o44prox=clamp((${CORTE}-_o44d)*${GANHO},-${TETO},${TETO});
      const pWin=duelProb(facet(atk,'head_atk')+setBoost+(sw==='in'?2.5:0),(def?facet(def,'head_def'):40)+5+_o44prox);`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| corte=' + CORTE, 'ganho=' + GANHO, 'teto=' + TETO);
console.log(path.basename(output), '| sha256', sha);
