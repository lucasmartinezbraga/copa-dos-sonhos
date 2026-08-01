#!/usr/bin/env node
'use strict';
/*
 * OS-54 · QUEM TEM DRIBLE DRIBLA MAIS
 * ------------------------------------
 * Observacao de campo: "os jogadores com mais drible deveriam driblar de fato
 * na animacao tambem".
 *
 * MECANISMO (:16384, camada R12.2 — a que esta viva):
 *
 *     const dri = attr(o,'drible');
 *     const elite = dri >= 86 || traits.includes('DRIBBLER');
 *     ... flair: elite && schance(this,.26)
 *
 * O drible de assinatura e uma PORTA BINARIA seguida de moeda fixa: abaixo de
 * 86 de drible ninguem faz nada nunca, e de 86 para cima todo mundo faz na
 * mesma taxa de 26%, do craque de 99 ao de 86. O atributo entra uma vez, para
 * abrir a porta, e depois desaparece.
 *
 * EDIT · a propensao passa a ser CONTINUA no atributo:
 *
 *     p = clamp((dri - 72) / 72 + (trait DRIBBLER ? .06 : 0), .02, .46)
 *       dri 75 -> 0,042     dri 86 -> 0,194
 *       dri 92 -> 0,278     dri 99 -> 0,375
 *
 * A primeira calibragem usava (dri-70)/58 e foi MEDIDA: com o Brasil de 70 nos
 * dois lados, metade dos dribles vencidos virava drible de assinatura (49,5%).
 * Muito. Esta curva poe o mesmo elenco perto de 35%.
 *
 * O trait `DRIBBLER` continua valendo, somando 0,06. Quem tem pouco drible
 * ainda arrisca de vez em quando — como no futebol — e o craque arrisca o dobro
 * de quem so encosta no limiar.
 *
 * `flair` alimenta a escolha do drible nomeado (OS-47) e a pose (OS-46), entao
 * isto aparece direto na animacao. Consome a mesma rolagem `schance` de sempre,
 * no mesmo ponto, entao nao ha rolagem nova — muda o limiar dela.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - dribles COM efeito: SOBEM com elenco de craques, DESCEM com elenco fraco.
 *   - dribles totais: praticamente iguais (a porta e so do efeito).
 *   - gols e chutes: praticamente iguais.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.75 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.76 - JOGO DE FUTEBOL.html');
let src=fs.readFileSync(input,'utf8');
const from=`flair:elite&&schance(this,.26)`;
const to=`flair:schance(this,Math.max(.02,Math.min(.46,(dri-72)/72+(elite?.06:0))))`;
const c=src.split(from).length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace(from,to);
fs.writeFileSync(output,src,'utf8');
console.log('os54-dribble-propensity |',path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
