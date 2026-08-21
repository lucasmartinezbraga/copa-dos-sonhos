
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
    var usados=[], _r99longe=0;
    if(nw>0){
      var ord=adv.slice().sort(function(a,b){
        return Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy);});
      nw=Math.min(nw,Math.max(0,ord.length-2));   // nunca esvazia a defesa
      for(var i=0;i<nw;i++){
        var d=ord[i], off=(i-(nw-1)/2)*LARG;
        /* §R18.99 · A BARREIRA CAMINHA. Escrever d.x/d.y aqui era teleporte:
           medido 101 saltos em 6 partidas, media 12,12 m e maximo 25,50 m --
           a maior fonte de teleporte de JOGADOR da build. O posto ja e
           perseguido quadro a quadro em :25029, com passo limitado a
           VMAX*dt e comentario dizendo "nunca teleporte por quadro"; o que
           faltava era nao teleportar na MONTAGEM. So se marca o posto. */
        var _wx=cl(cx+px*off,1,FLv()-1), _wy=cl(cy+py*off,1,FWv()-1);
        d._os36Wall={x:_wx,y:_wy};
        /* §R18.99b · quem LEVA o jogador ate o posto e a maquina da R15
           (:18288), nao o puxao desta camada (:25041). Dois motivos medidos:
           (1) o puxao daqui anda 0,233 m por quadro e roda DENTRO de
               _movePlayers, entao o movimento tatico (ate 0,395 m) o desfaz
               no mesmo quadro -- cabo de guerra. No instante do chute so 1 dos
               3 da barreira estava no posto.
           (2) o puxao daqui escreve x/y e NAO escreve vx/vy: o motor le
               moving por (vx^2+vy^2) > 4 (:4909) e a apresentacao desenha o
               jogador PARADO enquanto ele desliza. Medidos 3.215 quadros assim
               em 6 partidas, ate 14 jogadores ao mesmo tempo.
           A R15 roda DEPOIS do movimento tatico e escreve velocidade. O
           _os36Wall continua valendo como ancora depois da chegada. */
        d.__spTarget={x:_wx,y:_wy};
        var _wd=Math.hypot(_wx-d.x,_wy-d.y); if(_wd>_r99longe)_r99longe=_wd;
        usados.push(d);
      }
    }
    /* quem sobrou dentro do circulo sai radialmente para a borda — tambem
       caminhando: o clamp de entrada por quadro (:25031) ja o expulsa com
       passo limitado. Aqui so se mede a distancia, para dimensionar a pausa. */
    for(var k=0;k<adv.length;k++){
      var p=adv[k]; if(usados.indexOf(p)>=0)continue;
      var dx=p.x-x, dy=p.y-y, L=Math.hypot(dx,dy);
      if(L>=RAIO)continue;
      var _ed=(RAIO+FOLGA)-L; if(_ed>_r99longe)_r99longe=_ed;
    }
    /* a falta espera a barreira se formar — e o que o arbitro faz. A conta usa
       a velocidade de CAMINHADA da R15 (maxSpd*0,92 ≈ 6,44 m/s), que e quem
       leva o jogador, e nao o VMAX=7 do puxao desta camada. */
    if(_r99longe>0)sim.dead=Math.max(num(sim.dead),Math.min(3.0,.6+_r99longe/5.98));
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
