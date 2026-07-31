#!/usr/bin/env node
'use strict';
/*
 * OS-34 · VOLUME DE PASSE: intervalo de decisao e tempo de preparo
 * O censo da OS-33 fechou: 385 passes executados/partida contra ~900 real, com
 * acerto de 86% (correto). O deficit e de VOLUME, e o volume e limitado pelo
 * ciclo de cada acao:
 *   decisionInterval 0,28 s (:2719)
 *   PHASES.pass.prep [0,10 - 0,19] s + follow 0,10 + recover 0,12 (:17350)
 * Soma ~0,60-0,69 s por passe. Cortar os dois aumenta a densidade sem tocar em
 * precisao, decisao ou fisica.
 * GATE: ECO-02 <= 2,7 xG/partida. Mais passe perto da area empurra xG.
 *
 * ====================================================================
 * REPROVADA. NAO ENTRA NA CADEIA. Medido, 16 partidas, R18.63 -> R18.64:
 *   passes       385  -> 397    (+12, praticamente nada)
 *   xG          2,26  -> 2,95   ESTOURA O GATE
 *   gols        2,44  -> 3,50   contra ~2,7 real
 *   escanteios  2,38  -> 1,81
 *
 * Cortei intervalo de decisao e preparo em ~30% e ganhei 12 passes, inflando
 * gol e xG. O ciclo de acao NAO e o gargalo do volume de passe.
 *
 * E ha um problema anterior a este patch: eu nunca verifiquei que ~900 passes
 * e alvo valido para o modelo de posse DESTE motor. Peguei o numero do futebol
 * real e tratei como meta. Isso e perseguir alvo, nao buscar realismo — e as
 * duas candidatas que nasceram assim nesta sessao (esta e o clockRate da
 * OS-30) foram justamente as que inflaram gol sem melhorar o jogo.
 *
 * O que melhorou o jogo veio de "isso nao e futebol", nao de "esse numero
 * esta longe": goleiro fora do poste, cruzamento sem alvo na area, botoes em
 * codigo morto, falta cerimoniosa no meio-campo.
 * ====================================================================
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.63 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.64 - JOGO DE FUTEBOL.html');
const di=arg('decisao','0.20'), p0=arg('prep0','0.07'), p1=arg('prep1','0.13'), fo=arg('follow','0.07'), re=arg('recover','0.08');
let src=fs.readFileSync(input,'utf8');const ap=[];
function edit(id,from,to){const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);ap.push(id);}
edit('os34-decision-interval',`    decisionInterval: 0.28,`,`    decisionInterval: ${di},`);
edit('os34-pass-phase',`    pass:  { prep: [0.10, 0.19], follow: 0.10, recover: 0.12 },`,
  `    pass:  { prep: [${p0}, ${p1}], follow: ${fo}, recover: ${re} },`);
fs.writeFileSync(output,src,'utf8');
console.log('decisao',di,'prep',p0+'-'+p1,'follow',fo,'recover',re);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
