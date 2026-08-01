#!/usr/bin/env node
'use strict';
/*
 * OS-51 · QUEM E DRIBLADO FICA DESEQUILIBRADO
 * --------------------------------------------
 * Observacao de campo: "nao ta rolando dribles".
 *
 * Os dribles ACONTECEM — 46,7 por partida, 10,8 com efeito — e a pose dura
 * ~0,7 s. O que nao acontece e a CONSEQUENCIA. Censo de 277 dribles vencidos
 * (6 partidas), medindo a separacao 1 s depois:
 *
 *     distancia ao marcador   antes 1,46 m  ->  depois 3,43 m
 *     deixou o marcador para tras (goal-side)      62,1%
 *     MARCADOR CONTINUOU COLADO (ganhou < 0,5 m)   27,8%
 *
 * Quase um terco dos dribles vencidos nao produz separacao nenhuma: o atacante
 * ganha o duelo e o defensor segue grudado como se nada tivesse acontecido. No
 * futebol quem e driblado fica desequilibrado por um instante — e por isso que
 * o drible vale alguma coisa.
 *
 * E o mesmo padrao que esta rodada inteira encontrou em outros lugares: o
 * desfecho existe na estatistica e nao tem consequencia fisica. Foi assim com o
 * bloqueio (OS-39), com a barreira (OS-36) e com o duelo aereo (OS-43).
 *
 * EDIT · ao perder o drible, o defensor entra em RECUPERACAO por
 * ${'${JANELA}'} s: enquanto durar, o passo dele em direcao ao alvo e reduzido a
 * ${'${FATOR}'}. Nao e teletransporte nem penalidade de atributo — e o tempo de
 * reequilibrar o corpo. Passada a janela, ele volta ao normal sozinho.
 *
 * O corte e aplicado em `_integrate`, que e por onde todo movimento passa, e so
 * ao alvo: a fisica, a velocidade maxima e a aceleracao do atleta continuam
 * sendo dele.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.73):
 *   - "marcador continuou colado" 27,8%: DESCE bastante.
 *   - separacao 1 s depois 3,43 m: SOBE.
 *   - "deixou para tras" 62,1%: SOBE.
 *   - dribles por partida: podem SUBIR um pouco (o defensor volta mais devagar).
 *   - gols, chutes e escanteios: NAO podem degradar; escanteios nao podem cair
 *     abaixo de 4,0.
 *   - RECUSA se os gols subirem muito (defesa furada) ou se os dribles
 *     dispararem acima de ~70 por partida.
 *
 * ARMADILHA: se a janela pegar o goleiro ou o defensor que NAO participou do
 * duelo, a defesa vira queijo. So `data.on` — o marcador daquele duelo — entra.
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
const JANELA = arg('janela', '0.62');
const FATOR = arg('fator', '0.46');
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

const LAYER = `<script id="cds-os51-beaten-defender">
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS51__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS51__',{value:true});}catch(_){P.__CDS_OS51__=true;}
var JANELA=${JANELA}, FATOR=${FATOR};
var dbg={driblados:0,quadros:0};

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(type==='dribble'&&data&&data.ok&&data.on&&!data.on.isGK&&!data.on.red){
      data.on.__os51Ate=(Number(this.t)||0)+JANELA;
      dbg.driblados++;
    }
  }catch(_){}
  return r;
};

var oldInt=P._integrate;
if(typeof oldInt==='function'){
  P._integrate=function(p,tx,ty,dt,freeze){
    try{
      if(p&&!p.isGK&&p.__os51Ate&&(Number(this.t)||0)<p.__os51Ate){
        /* recuperacao: o alvo e puxado para perto do corpo, entao ele anda
           menos neste quadro. Velocidade maxima e aceleracao continuam dele. */
        var _x=Number(tx),_y=Number(ty);
        if(isFinite(_x)&&isFinite(_y)){
          dbg.quadros++;
          tx=p.x+(_x-p.x)*FATOR;
          ty=p.y+(_y-p.y)*FATOR;
          return oldInt.call(this,p,tx,ty,dt,freeze);
        }
      }
    }catch(_){}
    return oldInt.apply(this,arguments);
  };
}

P.getOS51Audit=function(){return {driblados:dbg.driblados,quadrosEmRecuperacao:dbg.quadros};};
root.CDS_OS51=Object.freeze({version:'OS-51',feature:'BEATEN_DEFENDER',janela:JANELA,fator:FATOR});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os51-beaten-defender', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| janela=' + JANELA, 'fator=' + FATOR);
console.log(path.basename(output), '| sha256', sha);
