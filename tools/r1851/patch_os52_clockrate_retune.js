#!/usr/bin/env node
'use strict';
/*
 * OS-52 · O TEMPO DE JOGO, NAO A CONVERSAO
 * -----------------------------------------
 * Divida aberta desde a OS-42: os gols cairam de 3,27 para 1,85 contra ~2,7 do
 * futebol real, e eu disse tres vezes que nao ia compensar com multiplicador.
 * Antes de mexer em conversao, medi de onde vem o buraco.
 *
 *     17,10 chutes  ->  1,85 gols  =  10,8% de aproveitamento
 *
 * O aproveitamento real do futebol e 10 a 11%. **A conversao esta certa.** O
 * que falta e VOLUME:
 *
 *     chutes         17,10   contra ~25 reais (dois times somados)
 *     posses        123,70   contra ~200 a 260
 *     cadeias por chute 8,2  <- ja dentro da faixa real de 8 a 10
 *
 * A razao construcao/finalizacao esta certa desde a OS-45. O que limita tudo e
 * o TEMPO: com `clockRate` em 0,16 (min de jogo por segundo de simulacao), os
 * 90 minutos cabem em ~562 s de acao. Todo evento por partida e a taxa por
 * segundo multiplicada por esse tempo — e por segundo de acao o jogo ja produz
 * MAIS que o futebol real. Mexer em conversao seria consertar o numerador de
 * uma fracao cujo denominador e o problema, que e exatamente o erro que a
 * OS-22 registrou e eu quase repeti.
 *
 * EDIT · `clockRate` 0,16 -> ${'${TAXA}'}.
 *
 * CUSTO EXPLICITO: a partida fica mais longa de assistir. A 0,16 os 90 minutos
 * levam ~9,4 min de relogio real na velocidade 1x; a 0,13 passam a ~11,5 min.
 * E o preco de ter volume de futebol de verdade.
 *
 * MEDIDO ANTES DE ESCOLHER (24 partidas por ponto):
 *
 *              0,16     0,13     0,115
 *     goals    1,85     2,71     2,38
 *     xg       2,01     2,62     2,90   <- 0,115 estoura o ECO-02 (<= 2,7)
 *     shots   17,10    22,67    24,13
 *     corners  4,75     5,92     6,92
 *     passes 368,13   465,63   521,29
 *
 * 0,13 poe os gols em 2,71 — a media real — com o xG dentro do gate e os
 * escanteios na faixa. 0,115 da mais volume e estoura o xG.
 *
 * PREVISAO REGISTRADA ANTES DA BATERIA DE 40:
 *   - gols proximos de 2,7; xG abaixo de 2,7; escanteios entre 4 e 10.
 *   - as RAZOES nao podem mudar: cadeias por chute segue em 8 a 10, passes por
 *     cadeia em 2,7 a 3,2, aproveitamento perto de 11%. Se mudarem, nao foi
 *     escala e sim efeito colateral.
 *
 * ARMADILHA: `clockRate` multiplica TUDO, inclusive faltas e escanteios. Se
 * algum deles sair da faixa, a escala nao pode ser promovida sozinha.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.74 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.75 - JOGO DE FUTEBOL.html');
const TAXA = arg('clockRate', '0.13');
let src = fs.readFileSync(input, 'utf8');

const ANC = '    clockRate: 0.16,';
const c = src.split(ANC).length - 1;
if (c !== 1) { console.error('ABORTA: ancora ' + c + 'x'); process.exit(1); }
src = src.replace(ANC, '    clockRate: ' + TAXA + ',');

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('clockRate 0.16 ->', TAXA, '|', path.basename(output), '| sha256', sha);
