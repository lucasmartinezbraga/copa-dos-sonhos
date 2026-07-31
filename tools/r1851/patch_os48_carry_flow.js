#!/usr/bin/env node
'use strict';
/*
 * OS-48 · QUEM TEM A BOLA NAO FICA PARADO ESPERANDO
 * --------------------------------------------------
 * Observacao de campo: "os jogadores dominam a bola e param pra pensar".
 *
 * CENSO (8 partidas, 3.385 posses individuais):
 *
 *     tempo medio com a bola      0,45 s   (real ~1,1 a 1,4 s)
 *     distancia media com a bola  1,42 m
 *     fracao do tempo PARADO      27,2%
 *
 *     quanto do dominio e parado
 *       < 15%   63,8%     <- fluido
 *       > 85%   23,2%     <- congela
 *
 * Nao e lentidao geral: e BIMODAL. Quase uma em cada quatro posses o jogador
 * para por completo. E o que separa as duas populacoes e uma coisa so
 * (6 partidas, 569 congeladas contra 1.812 fluidas):
 *
 *     quadros SEM alvo de movimento definido
 *       congelada  96,3%        fluida  0,2%
 *     distancia ate o proprio alvo
 *       congelada  0,02 m       fluida  23,82 m
 *
 * MECANISMO (:7211):
 *
 *     tx = p._tx !== undefined ? p._tx : p.x;
 *     ty = p._ty !== undefined ? p._ty : p.y;
 *
 * Sem `_tx`/`_ty`, o alvo do jogador E ELE MESMO. Enquanto a acao escolhida nao
 * executa, o portador nao recebe destino nenhum e planta o pe no chao. Nao e
 * "pensando": e ausencia de destino.
 *
 * EDIT · uma camada antes do movimento: se o portador da bola esta sem alvo, ele
 * CONDUZ. O destino e um toque curto (${'${PASSO}'} m) na direcao do gol
 * adversario, desviando para o lado contrario ao do marcador mais proximo — que
 * e o que um jogador faz enquanto procura o passe. O alvo e renovado quando ele
 * chega, e apagado no instante em que a bola muda de dono, para nao sobrar
 * destino velho.
 *
 * NAO mexe em decisao, em duelo, em passe nem em RNG. So preenche um destino
 * que estava vazio. Ainda assim as POSICOES mudam, entao a partida diverge por
 * caos e os numeros precisam ser medidos, nao assumidos.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.72):
 *   - posses com mais de 85% do tempo paradas: 23,2% DESCE para menos de 8%.
 *   - fracao de tempo parado 27,2%: DESCE.
 *   - tempo medio com a bola 0,45 s e distancia 1,42 m: SOBEM.
 *   - passes, chutes, gols e escanteios: NAO podem degradar; escanteios nao
 *     podem cair abaixo de 4,0.
 *   - salto por quadro 0,550%: NAO pode subir — isto e locomocao normal, com a
 *     aceleracao do proprio atleta, nao recolocacao.
 *   - RECUSA se o portador passar a atravessar a marcacao sozinho: se os
 *     dribles por partida subirem muito ou as posses ficarem longas demais
 *     (> 1,0 s de media), o passo esta grande demais.
 *
 * ARMADILHA: se o alvo que a camada cria nao for apagado quando a bola troca de
 * dono, o ex-portador continua correndo para um ponto que nao existe mais. A
 * marca `__os48Meu` existe exatamente para isso.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.72 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.73 - JOGO DE FUTEBOL.html');
const PASSO = arg('passo', '2.6');
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

const LAYER = `<script id="cds-os48-carry-flow">
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS48__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS48__',{value:true});}catch(_){P.__CDS_OS48__=true;}
var PASSO=${PASSO};
function FLv(){return Number(root.FL)||105;} function FWv(){return Number(root.FW)||68;}
function cl(v,a,b){return v<a?a:(v>b?b:v);}
var dbg={conduzidos:0,quadros:0};

function limpa(p){
  if(p&&p.__os48Meu){p.__os48Meu=false;try{delete p._tx;delete p._ty;}catch(_){p._tx=undefined;p._ty=undefined;}}
}

var oldMove=P._movePlayers;
if(typeof oldMove==='function'){
  P._movePlayers=function(dt,freeze){
    try{
      var b=this.ball, o=b&&b.owner;
      /* o alvo criado aqui morre junto com a posse */
      if(this.__os48Ant&&this.__os48Ant!==o)limpa(this.__os48Ant);
      this.__os48Ant=o||null;
      if(o&&!o.red&&!o.isGK&&!(Number(this.dead)>0)&&!freeze&&!b.traveling){
        var tem=Number.isFinite(o._tx)&&Number.isFinite(o._ty);
        var dAlvo=tem?Math.hypot(o._tx-o.x,o._ty-o.y):0;
        /* so age no vazio, ou para renovar o toque que ela mesma criou */
        if(!tem||(o.__os48Meu&&dAlvo<0.9)){
          var tm=this.teams[o.team], g=tm&&tm.oppGoal;
          if(g){
            var ax=g.x-o.x, ay=g.y-o.y, L=Math.max(.6,Math.hypot(ax,ay));
            var ux=ax/L, uy=ay/L, px=-uy, py=ux;
            /* sai do lado do marcador mais proximo */
            var adv=this.teams[1-o.team].players, perto=null, nd=1e9, i, q, e;
            for(i=0;i<adv.length;i++){
              q=adv[i]; if(!q||q.red||q.isGK)continue;
              e=Math.hypot(q.x-o.x,q.y-o.y); if(e<nd){nd=e;perto=q;}
            }
            var lado=0;
            if(perto&&nd<7){ lado=(((perto.x-o.x)*px+(perto.y-o.y)*py)>0)?-1:1; }
            o._tx=cl(o.x+ux*PASSO*.78+px*lado*PASSO*.55,1,FLv()-1);
            o._ty=cl(o.y+uy*PASSO*.78+py*lado*PASSO*.55,1,FWv()-1);
            o.__os48Meu=true;
            dbg.conduzidos++;
          }
        }
        if(o.__os48Meu)dbg.quadros++;
      }
    }catch(_){}
    return oldMove.apply(this,arguments);
  };
}

P.getOS48Audit=function(){return {toquesCriados:dbg.conduzidos,quadrosConduzindo:dbg.quadros};};
root.CDS_OS48=Object.freeze({version:'OS-48',feature:'CARRY_FLOW',passo:PASSO});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os48-carry-flow', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| passo=' + PASSO);
console.log(path.basename(output), '| sha256', sha);
