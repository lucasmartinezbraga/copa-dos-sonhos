
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS48__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS48__',{value:true});}catch(_){P.__CDS_OS48__=true;}
var PASSO=2.6;
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
