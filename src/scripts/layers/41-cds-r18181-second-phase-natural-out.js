/* R18.18.1 · SEGUNDA FASE + ECOLOGIA NATURAL DA BOLA FORA
   --------------------------------------------------------------------------
   1) conecta bloqueio/defesa/trave/corte à RECUPERAÇÃO física da sobra;
   2) classifica a primeira ação real após essa recuperação;
   3) permite que deflexões e bolas soltas geometricamente orientadas à linha
      atravessem o limite, em vez de serem presas pelo clamp em x/y = 1;
   4) preserva último toque: a própria _ballOut decide lateral, escanteio ou
      tiro de meta. Não existe sorteio de reinício, posse ou chance de gol. */
(function(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;
const P=M.prototype;if(P.__r18181SecondPhaseNaturalOut)return;
P.__r18181SecondPhaseNaturalOut=true;
const V='5.12.5-R18.18.1',FL=Number(root.FL)||105,FW=Number(root.FW)||68;
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>a&&b?Math.hypot(finite(a.x)-finite(b.x),finite(a.y)-finite(b.y)):999;
const prog=(tm,x)=>tm.attackDir>0?finite(x):FL-finite(x);
function fresh(){return{
 version:V,windows:0,recoveries:0,actions:0,passes:0,carries:0,shots:0,
 terminalOutcomes:0,foulsWon:0,restartsWon:0,expired:0,ignoredRestarts:0,naturalOutDeflections:0,naturalOutLooseBalls:0,
 naturalThrowIns:0,naturalCorners:0,naturalGoalKicks:0,
 source:{blocked:0,save:0,post:0,header_clear:0,cross_block:0},events:[]
};}
function st(sim){return sim.__r18181||(sim.__r18181=fresh());}
function log(sim,type,data){const s=st(sim);s.events.push(Object.assign({type,time:+finite(sim.t).toFixed(3),minute:+finite(sim.minute).toFixed(2)},data||{}));if(s.events.length>300)s.events.splice(0,s.events.length-300);}
function teamOf(x){return x&&(x.team===0||x.team===1)?x.team:null;}
function clear(sim,reason){const q=sim.__r18181Window;if(!q)return;if(reason==='expired')st(sim).expired++;sim.__r18181Window=null;}
function arm(sim,team,source,data){
 if(team!==0&&team!==1)return;
 if(finite(sim.dead)>.05||sim.pendingRestart||sim.waiting){st(sim).ignoredRestarts++;return;}
 const now=finite(sim.t),b=sim.ball||{};
 sim.__r18181Window={team,source,start:now,until:now+4.15,x:finite(b.x),y:finite(b.y),recovered:false,actor:null};
 st(sim).windows++;if(st(sim).source[source]!=null)st(sim).source[source]++;
 log(sim,'window',{team,source,x:+finite(b.x).toFixed(2),y:+finite(b.y).toFixed(2)});
}
function markRecovery(sim,p,via){
 const q=sim.__r18181Window,now=finite(sim.t);
 if(!q)return false;
 if(now>q.until){clear(sim,'expired');return false;}
 if(!p||p.red||teamOf(p)!==q.team||finite(sim.dead)>.05||sim.pendingRestart||sim.waiting)return false;
 const tm=sim.teams&&sim.teams[p.team];if(!tm||prog(tm,p.x)<57)return false;
 if(q.recovered)return q.actor===p;
 q.recovered=true;q.actor=p;q.actionUntil=now+2.65;p._r18181SecondPhaseUntil=q.actionUntil;
 st(sim).recoveries++;log(sim,'recovery',{team:p.team,by:p.idx,via,source:q.source,progress:+prog(tm,p.x).toFixed(2),distanceFromEvent:+Math.hypot(finite(p.x)-q.x,finite(p.y)-q.y).toFixed(2)});
 return true;
}
function consumeAction(sim,p,kind){
 const q=sim.__r18181Window,now=finite(sim.t);
 if(!q||!q.recovered||q.actor!==p||now>finite(q.actionUntil))return false;
 const s=st(sim);s.actions++;if(kind==='pass')s.passes++;else if(kind==='carry')s.carries++;else if(kind==='shot')s.shots++;
 log(sim,'action',{team:p.team,by:p.idx,kind,source:q.source,delay:+(now-q.start).toFixed(3)});
 p._r18181SecondPhaseUntil=0;sim.__r18181Window=null;return true;
}
function attackingTeamFromEvent(sim,type,data){
 data=data||{};
 if(type==='post')return teamOf(data.by||data.p);
 if(type==='save'){const g=teamOf(data.gk||data.by);return g==null?null:1-g;}
 if(type==='blocked'||type==='header_clear'){
   const d=teamOf(data.by||data.gk||data.p);if(d!=null)return 1-d;
 }
 const lt=teamOf(sim.ball&&sim.ball.lastTouch);return lt;
}
const oldReset=P.reset;
P.reset=function(){const r=oldReset.apply(this,arguments);this.__r18181=fresh();this.__r18181Window=null;return r;};

const oldEmit=P._emit;
P._emit=function(type,data){
 try{
   if(type==='blocked'||type==='save'||type==='post'||type==='header_clear'){
     /* Defesa encaixada/double catch encerra a jogada; somente spill/parry com
        rebound=true pode abrir segunda fase. */
     const liveSave=type!=='save'||!!(data&&data.rebound);
     if(liveSave){
       const team=attackingTeamFromEvent(this,type,data);
       const source=type==='blocked'&&data&&data.kind==='cross'?'cross_block':type;
       arm(this,team,source,data);
     }
   }
   if(['goal','offside','foul','penalty','freekick','corner','throw_in','goal_kick','kickoff'].includes(type)){
     const q=this.__r18181Window,now=finite(this.t);
     if(q&&q.recovered&&now<=finite(q.actionUntil)){
       let favorable=false,detail=null;
       if(type==='foul'&&data&&teamOf(data.on)===q.team){favorable=true;detail='foul_won';st(this).foulsWon++;}
       else if((type==='corner'||type==='throw_in')&&data&&data.team===q.team){favorable=true;detail=type+'_won';st(this).restartsWon++;}
       if(favorable){st(this).terminalOutcomes++;log(this,'terminal_outcome',{team:q.team,by:q.actor&&q.actor.idx,outcome:detail,source:q.source,delay:+(now-q.start).toFixed(3)});}
     }
     clear(this,'terminal');
   }
 }catch(_){}
 return oldEmit.apply(this,arguments);
};

const oldReceive=P._receive;
P._receive=function(p){const r=oldReceive.apply(this,arguments);try{if(p&&this.ball&&this.ball.owner===p)markRecovery(this,p,'receive');}catch(_){}return r;};
const oldTurn=P._turnover;
P._turnover=function(p){const r=oldTurn.apply(this,arguments);try{const o=this.ball&&this.ball.owner;if(o)markRecovery(this,o,'turnover');}catch(_){}return r;};
const oldContest=P._contestLoose;
if(typeof oldContest==='function')P._contestLoose=function(){const r=oldContest.apply(this,arguments);try{const o=this.ball&&this.ball.owner;if(o)markRecovery(this,o,'contest');}catch(_){}return r;};
/* Toda posse física e administrativa converge em _giveBall. A camada apenas
   observa o resultado DEPOIS do núcleo transacional; não concede posse, não
   cria contato e não altera o retorno. Reinícios continuam rejeitados por
   markRecovery quando dead/pendingRestart/waiting estão ativos. */
const oldGive=P._giveBall;
if(typeof oldGive==='function')P._giveBall=function(p){const r=oldGive.apply(this,arguments);try{if(p&&this.ball&&this.ball.owner===p)markRecovery(this,p,'authoritative_give');}catch(_){}return r;};

const oldPass=P._pass;
P._pass=function(o,best){try{consumeAction(this,o,'pass');}catch(_){}return oldPass.apply(this,arguments);};
const oldCarry=P._carry;
P._carry=function(o,target){try{consumeAction(this,o,'carry');}catch(_){}return oldCarry.apply(this,arguments);};
const oldShoot=P._shoot;
P._shoot=function(o){try{consumeAction(this,o,'shot');}catch(_){}return oldShoot.apply(this,arguments);};

/* Recuperação da sobra: não força sucesso. Apenas evita que o portador volte à
   circulação passiva no primeiro instante. Ele usa os mesmos _bestPass,
   _laneBlocked, _pass, _carry e _shoot do motor. */
const oldDecide=P._decide;
P._decide=function(o){
 try{
   const q=this.__r18181Window,now=finite(this.t);
   if(q&&now>q.until)clear(this,'expired');
   if(q&&q.recovered&&q.actor===o&&now<=finite(q.actionUntil)&&this.ball&&this.ball.owner===o&&finite(this.dead)<=.05&&!this.pendingRestart&&!this.waiting){
     const tm=this.teams[o.team],g=tm.oppGoal,dtg=dist(o,g),foes=this.teams[1-o.team].players.filter(p=>p&&!p.red);
     let near=99;for(const p of foes)near=Math.min(near,dist(o,p));
     let best=null;try{best=this._bestPass&&this._bestPass(o);}catch(_){}
     if(best&&((best.intoBox&&finite(best.risk)<2.05)||(finite(best.progressM)>3&&finite(best.risk)<1.72))){this._pass(o,best);return;}
     let blocked=false;try{blocked=!!(this._laneBlocked&&this._laneBlocked(o,g,foes));}catch(_){}
     if(dtg>=10&&dtg<=22.5&&near>2.15&&!blocked){this._shoot(o,dtg,dtg>20,false);return;}
     if(dtg>13&&near>3.25&&!blocked){this._carry(o,g);return;}
   }
 }catch(_){}
 return oldDecide.apply(this,arguments);
};

function naturalTarget(sim,x,y,kind){
 const b=sim.ball||{},bx=finite(b.x),by=finite(b.y),tx=finite(x,bx),ty=finite(y,by);
 let nx=tx,ny=ty,edge=null;
 const dx=tx-bx,dy=ty-by,inside=bx>=0&&bx<=FL&&by>=0&&by<=FW;
 /* Muitos duelos já calculavam um alvo em 1/FW-1 ou 1/FL-1 e o clamp impedia
    a saída. Só atravessamos quando a bola ainda está DENTRO, perto da linha e
    o vetor aponta inequivocamente para fora. Vetor neutro/interior permanece
    intacto, evitando fabricar reinícios. */
 if(inside&&by<=8.2&&ty<=1.15&&dy<-.05){ny=-.85;edge='touchline_top';}
 else if(inside&&by>=FW-8.2&&ty>=FW-1.15&&dy>.05){ny=FW+.85;edge='touchline_bottom';}
 if(!edge&&inside&&bx<=13.5&&tx<=1.15&&dx<-.05){nx=-.85;edge='endline_left';}
 else if(!edge&&inside&&bx>=FL-13.5&&tx>=FL-1.15&&dx>.05){nx=FL+.85;edge='endline_right';}
 if(edge){
   b.__r18181NaturalOut={edge,kind,lastTeam:teamOf(b.lastTouch),at:finite(sim.t)};
   if(kind==='deflect')st(sim).naturalOutDeflections++;else st(sim).naturalOutLooseBalls++;
   log(sim,'natural_out_armed',{edge,kind,fromX:+bx.toFixed(2),fromY:+by.toFixed(2),toX:+nx.toFixed(2),toY:+ny.toFixed(2),lastTeam:teamOf(b.lastTouch)});
 }
 return[nx,ny];
}
const oldDeflect=P._deflectTo;
P._deflectTo=function(x,y,spd){const q=naturalTarget(this,x,y,'deflect');return oldDeflect.call(this,q[0],q[1],spd);};
const oldLoose=P._looseBall;
P._looseBall=function(x,y){const q=naturalTarget(this,x,y,'loose');return oldLoose.call(this,q[0],q[1]);};

const oldBallOut=P._ballOut;
P._ballOut=function(){
 const b=this.ball||{},tag=b.__r18181NaturalOut||null;
 if(tag){
   const last=teamOf(b.lastTouch),isEnd=finite(b.x)<=0||finite(b.x)>=FL;
   if(!isEnd)st(this).naturalThrowIns++;
   else{
     const lineX=finite(b.x)>=FL?FL:0;
     const att=this.teams[0].oppGoal.x===lineX?0:1;
     if(last!==att)st(this).naturalCorners++;else st(this).naturalGoalKicks++;
   }
   log(this,'natural_out_resolved',{edge:tag.edge,lastTeam:last,x:+finite(b.x).toFixed(2),y:+finite(b.y).toFixed(2)});
 }
 const r=oldBallOut.apply(this,arguments);if(this.ball)this.ball.__r18181NaturalOut=null;return r;
};

const oldStep=P.step;
P.step=function(dt){const r=oldStep.apply(this,arguments);try{const q=this.__r18181Window;if(q&&finite(this.t)>q.until)clear(this,'expired');const o=this.ball&&this.ball.owner;if(o)markRecovery(this,o,'step');}catch(_){}return r;};

P.getR18181Audit=function(){
 const s=st(this),r13=this.getR13Audit?this.getR13Audit():null,totalThrow=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.throwIns),0),totalCorners=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.corners),0),goalKicks=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.goalKicks),0);
 return Object.assign({},s,{rates:{recoveryRate:s.windows?s.recoveries/s.windows:0,actionRate:s.recoveries?s.actions/s.recoveries:0,continuationRate:s.recoveries?(s.actions+s.terminalOutcomes)/s.recoveries:0,naturalOutShare:(totalThrow+totalCorners+goalKicks)?(s.naturalThrowIns+s.naturalCorners+s.naturalGoalKicks)/(totalThrow+totalCorners+goalKicks):0},match:{throwIns:totalThrow,corners:totalCorners,goalKicks},structural:this.getR12Audit?this.getR12Audit().status:null,observer:r13&&r13.status,gates:r13&&r13.gates});
};
const oldFull=P.getFullFootballAudit;
P.getFullFootballAudit=function(){const r=oldFull?oldFull.apply(this,arguments):{};r.secondPhaseNaturalOut=this.getR18181Audit();return r;};
root.CDS_R18181=Object.freeze({version:V,baseline:'R18.18',secondPhaseRecovery:true,naturalBoundaryCrossing:true,restartLottery:false,lastTouchAuthoritative:true,rngConsumption:false,xgBonus:false,speedBonus:false});
try{root.CDS_BUILD_ID='R18.18.1';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.18.1';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);