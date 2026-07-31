#!/usr/bin/env node
'use strict';
/*
 * OS-36 · A COBRANCA DE FALTA ACONTECE DE VERDADE
 * -----------------------------------------------
 * Duas falhas do mesmo lance, medidas antes de mexer (diag_os35, 8 partidas):
 *
 *   A) DISTANCIA. Nao existe barreira. A menor distancia de um adversario ate
 *      a bola na hora da cobranca tem mediana de 0,46 m e media de 0,67 m; em
 *      100% das faltas ha adversario dentro dos 9,15 m, e o numero deles SOBE
 *      durante a espera (2,96 -> 3,52). Ninguem e afastado em lugar nenhum do
 *      motor. O circulo tracejado que a OS-21 desenha era so desenho.
 *
 *   B) A DIRETA NAO EXISTE. `armTaker` (:20931) devolve a bola ao ponto e poe
 *      `traveling=false` para o cobrador ANDAR ate ela. `crossed` e `short`
 *      sobrevivem porque re-executam dentro de `pendingRestart`. A direta
 *      resolve TUDO na hora do apito e nao tem `pendingRestart`: o voo que o
 *      nucleo comecou e cancelado e nunca refeito. Medido: `ball.traveling`
 *      false em 100% das cobrancas apos a cadeia, e 12 de 21 diretas terminam
 *      sem gol, defesa, trave ou barreira. A estatistica ja tinha somado
 *      `shots++`, `setPieceShots++` e `xg += pGoal` de um chute que nao houve.
 *
 * EDIT 1 (nucleo) · a direta vira `pendingRestart`, como as outras duas
 * rotinas. O bloco inteiro de resolucao passa a ser um thunk executado quando
 * a bola morta termina — depois de o cobrador chegar. Nada de dentro do bloco
 * muda: mesma fisica, mesmo `resolveFreeKickPhysics`, mesmas estatisticas. Só
 * deixa de rodar num instante em que o resultado seria descartado.
 *
 * EDIT 2 (camada) · distancia regulamentar de verdade:
 *   - no apito, com o jogo parado, os adversarios dentro de 9,15 m sao postos
 *     na BARREIRA (2 a 4, conforme a distancia) sobre a linha bola->poste mais
 *     proximo, ou empurrados radialmente para fora do circulo;
 *   - enquanto a bola nao sai, um clamp por quadro impede que voltem a entrar.
 *     E clamp de ENTRADA, nao empurrao repetido: quem esta fora nao e tocado,
 *     e quem tenta entrar para na borda. O deslocamento por quadro fica menor
 *     que o passo normal do jogador, entao isso NAO cria travadinha (o mesmo
 *     erro que a OS-26 cometeu em :8087).
 *
 * A barreira e montada com `this.dead > 0` e a partida parada — que e o que
 * acontece no futebol de verdade e na televisao. Nao ha RNG novo: a escolha da
 * barreira e por distancia, deterministica. A ORDEM de consumo de RNG muda
 * (a fisica da direta agora e sorteada no reinicio), entao a comparacao com a
 * base diverge por caos e so vale por direcao sobre muitas sementes.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - menor distancia de adversario: SOBE para >= 9,15 m (por construcao);
 *     o gate real e que ela NAO caia durante a espera.
 *   - cobrancas com invasor: DESCE de 100% para ~0%.
 *   - diretas que terminam em nada: DESCE para ~0.
 *   - gols de falta: SOBEM de ~0.
 *   - escanteios: SOBEM um pouco (defesa e rebote de barreira passam a existir).
 *   - xG: NAO sobe por causa disso — ja estava sendo contado sem acontecer.
 *   - quadros acima de 12 m/s: NAO pode subir.
 *
 * ARMADILHA: se o clamp por quadro for aplicado tambem ao cobrador ou ao
 * goleiro, ele quebra a cobranca. So adversarios de linha entram no clamp.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.63 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.65 - JOGO DE FUTEBOL.html');
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

/* ------------------------------------------------------------------ EDIT 1 */
edit(
  'os36-direct-freekick-becomes-restart',
  `    this.stats[team].freeKickDirect++;
    this.stats[team].shots++;`,
  `    /* OS-36 · a direta passa a resolver no reinicio. Antes ela resolvia no
       apito e a camada :20931 cancelava o voo ao devolver a bola ao ponto para
       o cobrador andar — 12 de 21 diretas terminavam em nada, ja contadas em
       shots e xG. */
    const _os36Bater = () => {
    this.stats[team].freeKickDirect++;
    this.stats[team].shots++;`
);

edit(
  'os36-direct-freekick-close-thunk',
  `    else this._startTravel(taker,{x:tmA.oppGoal.x+tmA.attackDir*2,y:tmA.oppGoal.y+R(5,10)*(chance(.5)?1:-1)},'shot',()=>{this._emit('miss',{by:taker});this._goalKickOrRestart(1-team);},null,'shot',{outcome:'miss'});
  }`,
  `    else this._startTravel(taker,{x:tmA.oppGoal.x+tmA.attackDir*2,y:tmA.oppGoal.y+R(5,10)*(chance(.5)?1:-1)},'shot',()=>{this._emit('miss',{by:taker});this._goalKickOrRestart(1-team);},null,'shot',{outcome:'miss'});
    };
    this.dead = Math.max(Number(this.dead) || 0, .9);
    this.pendingRestart = _os36Bater;
  }`
);

/* ------------------------------------------------------------------ EDIT 2 */
const LAYER = `<script id="cds-os36-freekick-distance">
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS36__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS36__',{value:true});}catch(_){P.__CDS_OS36__=true;}
var RAIO=9.15, FOLGA=.35, LARG=.86, VMAX=7;

function num(v,d){return Number.isFinite(v)?v:(d||0);}
function cl(v,a,b){return v<a?a:(v>b?b:v);}
function FLv(){return num(root.FL,105);} function FWv(){return num(root.FW,68);}

/* Monta a barreira e afasta o resto. Roda com o jogo parado (dead>0). */
function armarBarreira(sim,team,x,y){
  try{
    var tm=sim.teams[team], vg=tm&&tm.oppGoal; if(!vg)return null;
    var adv=sim.teams[1-team].players.filter(function(p){return p&&!p.red&&!p.isGK;});
    if(!adv.length)return null;
    var dtg=Math.hypot(vg.x-x,vg.y-y);
    /* centro da barreira: sobre a linha bola -> POSTE MAIS PROXIMO, que e como
       barreira se arma no futebol (cobrir o lado curto e deixar o angulo
       fechado para o goleiro). */
    var poste=vg.y+(y<vg.y?-3.66:3.66);
    var ax=vg.x-x, ay=poste-y, aL=Math.max(.6,Math.hypot(ax,ay));
    var ux=ax/aL, uy=ay/aL, px=-uy, py=ux;
    var cx=x+ux*(RAIO+FOLGA), cy=y+uy*(RAIO+FOLGA);
    var nw = dtg<=20?4 : dtg<=27?4 : dtg<=33?3 : dtg<=40?2 : 0;
    var usados=[];
    if(nw>0){
      var ord=adv.slice().sort(function(a,b){
        return Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy);});
      nw=Math.min(nw,Math.max(0,ord.length-2));   // nunca esvazia a defesa
      for(var i=0;i<nw;i++){
        var d=ord[i], off=(i-(nw-1)/2)*LARG;
        d.x=cl(cx+px*off,1,FLv()-1); d.y=cl(cy+py*off,1,FWv()-1);
        d._os36Wall={x:d.x,y:d.y};
        usados.push(d);
      }
    }
    /* quem sobrou dentro do circulo sai radialmente para a borda */
    for(var k=0;k<adv.length;k++){
      var p=adv[k]; if(usados.indexOf(p)>=0)continue;
      var dx=p.x-x, dy=p.y-y, L=Math.hypot(dx,dy);
      if(L>=RAIO)continue;
      if(L<.2){dx=-ux;dy=-uy;L=1;}
      p.x=cl(x+dx/L*(RAIO+FOLGA),1,FLv()-1);
      p.y=cl(y+dy/L*(RAIO+FOLGA),1,FWv()-1);
    }
    return {team:team,x:x,y:y,until:num(sim.t)+9,wall:usados};
  }catch(_){return null;}
}

var oldFK=P._freeKick;
if(typeof oldFK==='function'){
  P._freeKick=function(team,x,y,input){
    var r=oldFK.apply(this,arguments);
    try{
      if(typeof team==='number'){
        var sx=cl(num(x),1,FLv()-1), sy=cl(num(y),1,FWv()-1);
        var g=armarBarreira(this,team,sx,sy);
        if(g){ this.__os36Guard=g; this.__os36Audit=this.__os36Audit||{faltas:0,invasoes:0,barreiras:0};
               this.__os36Audit.faltas++; if(g.wall.length)this.__os36Audit.barreiras++; }
      }
    }catch(_){}
    return r;
  };
}

/* Clamp de ENTRADA por quadro: quem esta fora nao e tocado. */
var oldMove=P._movePlayers;
if(typeof oldMove==='function'){
  P._movePlayers=function(dt){
    var out=oldMove.apply(this,arguments);
    try{
      var g=this.__os36Guard;
      if(g){
        var b=this.ball;
        var saiu = !b || b.traveling || Math.hypot(b.x-g.x,b.y-g.y)>2.2 ||
                   num(this.t)>g.until;
        if(saiu){
          if(g.wall)for(var w=0;w<g.wall.length;w++)g.wall[w]._os36Wall=null;
          this.__os36Guard=null;
        }else{
          var passo=VMAX*cl(num(dt,1/60),1/240,.12);
          var adv=this.teams[1-g.team].players;
          for(var i=0;i<adv.length;i++){
            var p=adv[i]; if(!p||p.red||p.isGK)continue;
            /* quem esta na barreira e puxado de volta ao posto, com passo
               limitado — nunca teleporte por quadro. */
            var alvo=p._os36Wall;
            if(alvo){
              var ax=alvo.x-p.x, ay=alvo.y-p.y, aL=Math.hypot(ax,ay);
              if(aL>.05){var s=Math.min(passo,aL); p.x+=ax/aL*s; p.y+=ay/aL*s;}
            }
            var dx=p.x-g.x, dy=p.y-g.y, L=Math.hypot(dx,dy);
            if(L<RAIO){
              if(L<.2){dx=1;dy=0;L=1;}
              var nx=cl(g.x+dx/L*(RAIO+.05),1,FLv()-1), ny=cl(g.y+dy/L*(RAIO+.05),1,FWv()-1);
              var salto=Math.hypot(nx-p.x,ny-p.y);
              if(salto>passo){ p.x+=(nx-p.x)/salto*passo; p.y+=(ny-p.y)/salto*passo; }
              else { p.x=nx; p.y=ny; }
              if(this.__os36Audit)this.__os36Audit.invasoes++;
            }
          }
        }
      }
    }catch(_){}
    return out;
  };
}

P.getOS36Audit=function(){
  var a=this.__os36Audit||{faltas:0,invasoes:0,barreiras:0};
  return {faltas:a.faltas,barreirasArmadas:a.barreiras,quadrosDeInvasaoContida:a.invasoes};
};
root.CDS_OS36=Object.freeze({version:'OS-36',feature:'FREEKICK_LEGAL_DISTANCE',raio:RAIO});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os36-wall-layer', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
