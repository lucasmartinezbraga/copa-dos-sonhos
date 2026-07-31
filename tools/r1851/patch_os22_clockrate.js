#!/usr/bin/env node
'use strict';
/*
 * OS-22 · A ESCALA DE TEMPO DA PARTIDA
 * ------------------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * `CAL.timing.clockRate` (:2717) vale 0.24 — "min de jogo por s de simulacao"
 * — e e aplicado em :4779 (`this.minute += dt * clockRate`). Isso comprime o
 * tempo 14,4x: 1 s de fisica vira 14,4 s de relogio.
 *
 * MEDIDO na R18.55: uma partida de 94,8 minutos de relogio roda em 459 s de
 * fisica, com 402 s de bola viva. O futebol real tem 55-60 min de bola em
 * jogo, ou seja ~3300 s — cerca de 8x mais.
 *
 * E por isso que TODA contagem por partida esta baixa ao mesmo tempo:
 * escanteios, faltas, passes e chutes disputam um jogo que dura um oitavo do
 * tempo. Nenhuma probabilidade de evento conserta isso, porque o problema esta
 * no denominador. Passei a sessao inteira ajustando taxas de evento quando o
 * limitador e o tempo disponivel.
 *
 * ESTA CANDIDATA NAO E DE GRACA: mais tempo de jogo multiplica tambem os gols,
 * entao ela EXIGE recalibrar conversao junto. Publicada para medir a direcao,
 * nao para promover isolada.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.55 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.56 - ESCALA.html');
const taxa=arg('clockRate','0.16');
let src=fs.readFileSync(input,'utf8');
const c=src.split('    clockRate: 0.24,').length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace('    clockRate: 0.24,','    clockRate: '+taxa+',');
fs.writeFileSync(output,src,'utf8');
console.log('clockRate 0.24 ->',taxa,'|',path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
