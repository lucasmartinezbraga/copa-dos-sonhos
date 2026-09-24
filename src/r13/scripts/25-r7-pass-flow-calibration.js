
(function(root){'use strict';
 const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype;
 if(P.__CDS_R7_PASS_FLOW__)return;Object.defineProperty(P,'__CDS_R7_PASS_FLOW__',{value:true});
 const D=(a,b,c,d)=>Math.hypot((a||0)-(c||0),(b||0)-(d||0));
 const oldSelect=P._selectPresser;
 if(typeof oldSelect==='function')P._selectPresser=function(tm,b){
   // Toda bola realmente solta cria uma corrida clara. O receptor pretendido
   // continua a jogada se ainda estiver perto; caso contrário, vai o atleta
   // fisicamente mais próximo, sem pontuação abstrata entregar a posse.
   if(b&&!b.owner&&!b.traveling){
     const pending=b.__p04PendingReceiver;
     if(pending&&!pending.red&&pending.team===tm.side&&D(pending.x,pending.y,b.x,b.y)<=8.5){tm._presser=pending;return pending;}
     let nearest=null,nd=Infinity;
     for(const p of tm.players||[]){if(!p||p.red||p.isGK)continue;const d=D(p.x,p.y,b.x,b.y);if(d<nd){nd=d;nearest=p;}}
     if(nearest&&nd<=16){tm._presser=nearest;return nearest;}
   }
   return oldSelect.apply(this,arguments);
 };
 // Contato também é verificado depois que os jogadores se moveram no frame.
 // Isso remove a espera visual de um quadro e, principalmente, captura o atleta
 // que chegou a uma bola já parada sem criar snap.
 const oldStep=P.step;
 if(typeof oldStep==='function')P.step=function(dt){
   const r=oldStep.apply(this,arguments),b=this.ball;
   if(b&&!b.owner&&!b.traveling&&!this.pendingRestart&&this.dead<=0&&typeof this._contestLoose==='function'){
     let near=Infinity;for(const tm of this.teams||[])for(const p of tm.players||[]){if(!p||p.red)continue;near=Math.min(near,D(p.x,p.y,b.x,b.y));}
     if(near<=1.12)this._contestLoose();
   }
   return r;
 };
 root.CDS_R7_PASS_FLOW=Object.freeze({version:'5.8.7-R9',shortPassBaseSpeed:18,throughBaseSpeed:22,launchSpeed:24,footContactRadius:.90,looseFriction:.92});
})(typeof window!=='undefined'?window:globalThis);
