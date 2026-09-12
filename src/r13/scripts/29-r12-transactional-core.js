/* Copa dos Sonhos · V5.9.3-R12.3 · Núcleo autoritativo transacional
   Fluxo único: intenção -> movimento final -> contato/posse -> evento canônico.
   Cada finalização possui transação própria e nunca pode ser sobrescrita. */
(function installR122(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_R122__)return;
const P=M.prototype,VERSION='5.9.3-R12.3',FL=Number(root.FL)||105,FW=Number(root.FW)||68;
Object.defineProperty(P,'__CDS_R122__',{value:true});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const dist=(a,b)=>a&&b?Math.hypot(finite(a.x)-finite(b.x),finite(a.y)-finite(b.y)):999;
const attr=(p,k,d=65)=>{try{return typeof root.getAttr==='function'?finite(root.getAttr(p,k),d):d;}catch(_){return d;}};
const facet=(p,k,d=65)=>{try{return typeof root.facet==='function'?finite(root.facet(p,k),d):d;}catch(_){return d;}};
function mix32(x){x|=0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return(x^(x>>>16))>>>0;}
function sideRand(sim,a,b){
  sim.__r122SideCounter=((sim.__r122SideCounter||0)+1)>>>0;
  const o=sim.ball&&sim.ball.owner;
  let h=0x9e3779b9^(Math.floor(finite(sim.t)*30)|0)^Math.imul(Math.floor(finite(sim.minute)*100)|0,997);
  h^=Math.imul(((o&&Number.isFinite(o.idx)?o.idx:17)+1),0x45d9f3b);
  h^=Math.imul(((o&&Number.isFinite(o.team)?o.team:0)+1),0x27d4eb2d);
  h^=((sim.score&&sim.score[0]||0)<<8)^((sim.score&&sim.score[1]||0)<<16);
  const u=mix32(h^Math.imul(sim.__r122SideCounter,0x9e3779b1))/4294967296;
  return a===undefined?u:b===undefined?u*a:a+u*(b-a);
}
const schance=(sim,p)=>sideRand(sim)<clamp(finite(p),0,1);
function blankTeam(){return{
  shots:0,onTarget:0,offTarget:0,blocked:0,goals:0,xg:0,
  passes:0,passCompleted:0,throughBalls:0,throughCompleted:0,
  crosses:0,crossesCompleted:0,corners:0,cornersConceded:0,
  dribbleAttempts:0,dribblesWon:0,tackleAttempts:0,tacklesWon:0,
  pressures:0,containments:0,interceptions:0,fouls:0,yellow:0,red:0,offsides:0,saves:0,
  openPlayGoals:0,penaltyGoals:0,directFreeKickGoals:0,crossedFreeKickGoals:0,cornerGoals:0
};}
function makeState(){return{
  version:VERSION,team:[blankTeam(),blankTeam()],events:[],shotSeq:0,activeShot:null,shotHistory:[],
  pendingPass:null,pendingCross:null,pendingOrigin:null,
  diagnostics:{movementFrames:0,movementClamps:0,globalMovementClamps:0,overlapCorrections:0,maxRawStep:0,maxFinalStep:0,
    throughDowngraded:0,throughAccepted:0,duelsAvoided:0,pressures:0,shotReconciliations:0,shotSuperseded:0,
    shotTravelBridges:0,administrativePassBridges:0,statIdentityErrors:0,legacyParityErrors:0,transactionErrors:0}
};}
function state(sim){return sim.__r122State||(sim.__r122State=makeState());}
function ensureStats(s){if(!s)return s;for(const k of ['tackleAttempts','tacklesWon','pressures','containments','looseDuels','crossesAir','crossesLow','crossesBlocked','openPlayGoals','penaltyGoals','directFreeKickGoals','crossedFreeKickGoals','cornerGoals','cornersConceded'])if(s[k]==null)s[k]=0;return s;}
function currentOrigin(S,team,now){const q=S.pendingOrigin;return q&&q.team===team&&q.until>=now?q.kind:'open_play';}
function addGoalOrigin(T,k){if(k==='penalty')T.penaltyGoals++;else if(k==='direct_free_kick')T.directFreeKickGoals++;else if(k==='crossed_free_kick')T.crossedFreeKickGoals++;else if(k==='corner')T.cornerGoals++;else T.openPlayGoals++;}
function beginShot(sim,team,xg,source,explicitOrigin){
  if(!(team===0||team===1))return null;const S=state(sim);
  if(S.activeShot)reconcileShot(sim,'superseded');
  const legacy=sim.stats&&sim.stats[team]||{},opp=sim.stats&&sim.stats[1-team]||{};
  const q={id:++S.shotSeq,team,source:source||'shot',origin:explicitOrigin||currentOrigin(S,team,finite(sim.t)),startedT:finite(sim.t),
    travelStarted:false,resolved:false,result:null,legacyOnTarget:finite(legacy.onTarget),legacyGoals:finite(legacy.goals),legacyOppSaves:finite(opp.saves),scoreAt:(sim.score&&sim.score[team])||0};
  S.activeShot=q;S.team[team].shots++;S.team[team].xg+=Math.max(0,finite(xg));return q;
}
function finishShot(sim,result,reason){
  const S=state(sim),q=S.activeShot;if(!q||q.resolved)return false;const T=S.team[q.team];q.resolved=true;q.result=result;q.reason=reason||result;q.endedT=finite(sim.t);
  if(result==='goal'){T.goals++;T.onTarget++;addGoalOrigin(T,q.origin);}else if(result==='save'){T.onTarget++;S.team[1-q.team].saves++;}else if(result==='blocked'){T.blocked++;}else T.offTarget++;
  S.shotHistory.push(q);if(S.shotHistory.length>600)S.shotHistory.splice(0,S.shotHistory.length-600);S.activeShot=null;
  if(S.pendingOrigin&&S.pendingOrigin.team===q.team)S.pendingOrigin=null;return true;
}
function reconcileShot(sim,reason){
  const S=state(sim),q=S.activeShot;if(!q)return false;const legacy=sim.stats&&sim.stats[q.team]||{},opp=sim.stats&&sim.stats[1-q.team]||{};
  const scoreNow=(sim.score&&sim.score[q.team])||0,goalDelta=Math.max(scoreNow-q.scoreAt,finite(legacy.goals)-q.legacyGoals),onDelta=finite(legacy.onTarget)-q.legacyOnTarget,saveDelta=finite(opp.saves)-q.legacyOppSaves;
  let result;if(goalDelta>0)result='goal';else if(saveDelta>0||onDelta>0)result='save';else if(reason==='corner'||(sim.ball&&sim.ball.owner&&sim.ball.owner.team===1-q.team&&!sim.ball.owner.isGK))result='blocked';else result='miss';
  S.diagnostics.shotReconciliations++;return finishShot(sim,result,reason||'reconcile');
}

const oldBlank=P._blankStats;P._blankStats=function(){return ensureStats(oldBlank.apply(this,arguments));};
const oldReset=P.reset;P.reset=function(){this.__r122State=makeState();this.__r122SideCounter=0;this.__r122FinalWhistleAt=null;const r=oldReset.apply(this,arguments);if(this.stats){ensureStats(this.stats[0]);ensureStats(this.stats[1]);}return r;};

/* Movimento: _integrate calcula intenção; _resolveOverlaps e commitMovement escrevem uma vez. */
const oldMovePlayers=P._movePlayers;
P._movePlayers=function(dt,freeze){const ctx={dt:clamp(finite(dt,1/30),1/240,.15),snap:new Map(),planned:new Map(),committed:false};for(const tm of this.teams||[])for(const p of tm.players||[])if(p&&!p.red)ctx.snap.set(p,{x:finite(p.x),y:finite(p.y)});this.__r122MoveFrame=ctx;try{return oldMovePlayers.apply(this,arguments);}finally{if(!ctx.committed)commitMovement(this,ctx);this.__r122MoveFrame=null;}};
P._integrate=function(p,tx,ty,dt,freeze){
  if(p._burst){p._burst.t-=dt;if(p._burst.t<=0)p._burst=null;else p.stamina=Math.max(35,p.stamina-dt*1.1);}if(p._burstCd){p._burstCd-=dt;if(p._burstCd<=0)p._burstCd=0;}if(p._overlapT>0){p._overlapT-=dt;if(p._overlapT<=0){p._overlapT=0;p._overlapping=false;}}
  const sx=finite(p.x),sy=finite(p.y),dx=finite(tx,sx)-sx,dy=finite(ty,sy)-sy,d=Math.hypot(dx,dy)||1e-6,staminaF=.7+finite(p.stamina,75)/100*.3;
  if(p._gaitPh===undefined)p._gaitPh=sideRand(this,0,6.28);const duty=p._breaking||p._burst||p===this.ball.owner||(this.ball.traveling&&this.ball.receiver===p);let effort;
  if(duty||d>16)effort=1;else{const f=clamp((d-3)/13,0,1),b=.5+.5*Math.sin(finite(this.t)*.85+p._gaitPh);effort=clamp(.55+f*.35+b*.14,.5,1);}
  const vmax=finite(p.maxSpd,7)*staminaF*effort*(freeze?.5:1),desired=Math.min(vmax,d*3.2),dvx=dx/d*desired-finite(p.vx),dvy=dy/d*desired-finite(p.vy),cur=Math.atan2(finite(p.vy),finite(p.vx)),want=Math.atan2(dy,dx),turn=Math.abs(Math.atan2(Math.sin(want-cur),Math.cos(want-cur))),tp=1+(finite(p.turn,1)-1)*clamp(turn/Math.PI,0,1),amax=finite(p.acc,20)*tp*dt,dv=Math.hypot(dvx,dvy);
  if(dv>amax){p.vx=finite(p.vx)+dvx/dv*amax;p.vy=finite(p.vy)+dvy/dv*amax;}else{p.vx=finite(p.vx)+dvx;p.vy=finite(p.vy)+dvy;}
  const nx=clamp(sx+p.vx*dt,0,FL),ny=clamp(sy+p.vy*dt,0,FW),ctx=this.__r122MoveFrame;if(ctx)ctx.planned.set(p,{x:nx,y:ny});else{p.x=nx;p.y=ny;}
};
P._resolveOverlaps=function(){const ctx=this.__r122MoveFrame;if(!ctx)return;const all=[];for(const tm of this.teams||[])for(const p of tm.players||[])if(p&&!p.red&&!p.isGK)all.push(p);const corr=new Map();for(const p of all)corr.set(p,{x:0,y:0});const b=this.ball||{x:0,y:0};
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const p=all[i],q=all[j],pp=ctx.planned.get(p)||ctx.snap.get(p),qq=ctx.planned.get(q)||ctx.snap.get(q);let dx=qq.x-pp.x,dy=qq.y-pp.y,dd=Math.hypot(dx,dy);if(dd>=1.7)continue;if(dist(pp,b)<3&&dist(qq,b)<3)continue;if(dd<.05){const a=sideRand(this,0,Math.PI*2);dx=Math.cos(a);dy=Math.sin(a);dd=1;}const push=Math.min(.24,(1.7-dd)/2),nx=dx/dd,ny=dy/dd,cp=corr.get(p),cq=corr.get(q);cp.x-=nx*push;cp.y-=ny*push;cq.x+=nx*push;cq.y+=ny*push;state(this).diagnostics.overlapCorrections++;}
  for(const c of corr.values()){const L=Math.hypot(c.x,c.y);if(L>.30){c.x=c.x/L*.30;c.y=c.y/L*.30;}}commitMovement(this,ctx,corr);
};
function commitMovement(sim,ctx,corr){if(ctx.committed)return;ctx.committed=true;const dg=state(sim).diagnostics;dg.movementFrames++;for(const tm of sim.teams||[])for(const p of tm.players||[]){if(!p||p.red)continue;const s=ctx.snap.get(p)||{x:finite(p.x),y:finite(p.y)},n=ctx.planned.get(p)||s,c=corr&&corr.get(p)||{x:0,y:0};let x=clamp(n.x+c.x,0,FL),y=clamp(n.y+c.y,0,FW),raw=Math.hypot(x-s.x,y-s.y);dg.maxRawStep=Math.max(dg.maxRawStep,raw);const maxStep=Math.max(.20,finite(p.maxSpd,7)*ctx.dt*1.18+.12);if(raw>maxStep){const q=maxStep/raw;x=s.x+(x-s.x)*q;y=s.y+(y-s.y)*q;dg.movementClamps++;}const fs=Math.hypot(x-s.x,y-s.y);dg.maxFinalStep=Math.max(dg.maxFinalStep,fs);p.x=x;p.y=y;if(ctx.dt>0){p.vx=(x-s.x)/ctx.dt;p.vy=(y-s.y)/ctx.dt;}}}

/* Guarda global de frame: captura qualquer escritor administrativo tardio. */
const oldStep=P.step;
P.step=function(dt){const snap=[],beforeHalf=this.half,beforeAdmin=this.dead>0||this.waiting||!!this.pendingRestart;for(const tm of this.teams||[])for(const p of tm.players||[])if(p&&!p.red)snap.push([p,finite(p.x),finite(p.y)]);const r=oldStep.apply(this,arguments),afterAdmin=this.dead>0||this.waiting||!!this.pendingRestart||this.half!==beforeHalf;
  if(!beforeAdmin&&!afterAdmin){const step=clamp(finite(dt,1/30),1/240,.15),dg=state(this).diagnostics;for(const z of snap){const p=z[0],dx=finite(p.x)-z[1],dy=finite(p.y)-z[2],d=Math.hypot(dx,dy),max=Math.max(.30,finite(p.maxSpd,7)*step*1.28+.20);if(d>max){p.x=z[1]+dx/d*max;p.y=z[2]+dy/d*max;p.vx=(p.x-z[1])/step;p.vy=(p.y-z[2])/step;dg.globalMovementClamps++;}dg.maxFinalStep=Math.max(dg.maxFinalStep,Math.hypot(p.x-z[1],p.y-z[2]));}}
  const S=state(this),q=S.activeShot;if(q){const age=finite(this.t)-q.startedT;if(!q.travelStarted&&age>.12)reconcileShot(this,'no_travel');else if(q.travelStarted&&!(this.ball&&this.ball.traveling)&&age>.08)reconcileShot(this,'travel_ended_without_event');else if(age>7)reconcileShot(this,'shot_timeout');}
  return r;
};

/* Passes e enfiadas: decisão executada é a fonte da tentativa canônica. */
const oldPass=P._pass;
P._pass=function(o,best){let use=best;if(o&&best&&best.m){const tm=this.teams[o.team],style=tm.styleKey||'balanced',potential=finite(best.progressM)>13&&(best.m._runDeep||best.m._breaking||finite(best.paceEdge)>.28)&&(finite(best.lineVuln)>.20||best.intoBox)&&finite(best.risk)<3.2;if(potential){const direct=style==='counter'||style==='direct',conservative=style==='tiki'||style==='park',runner=!!(best.m._runDeep||best.m._breaking||best.intoBox),context=.28+clamp((finite(best.progressM)-13)/22,0,.30)+clamp(finite(best.lineVuln)*.38,0,.25)+clamp(finite(best.paceEdge)*.18,0,.12)+(best.intoBox?.12:0)+(direct?.08:conservative?-.10:0),cool=direct?.72:conservative?1.45:1.02,last=finite(tm.__r122LastThrough,-99),allow=runner&&(this.t-last)>=cool&&schance(this,clamp(context,.20,.80));if(allow){tm.__r122LastThrough=this.t;state(this).diagnostics.throughAccepted++;}else{use=Object.assign({},best,{progressM:Math.min(12.9,finite(best.progressM))});state(this).diagnostics.throughDowngraded++;}}
  const through=finite(use.progressM)>13&&(use.m._runDeep||use.m._breaking||finite(use.paceEdge)>.28)&&(finite(use.lineVuln)>.20||use.intoBox)&&finite(use.risk)<3.2,S=state(this);S.team[o.team].passes++;if(through)S.team[o.team].throughBalls++;S.pendingPass={team:o.team,t:finite(this.t),through};}
  return oldPass.call(this,o,use);
};

const oldStartTravel=P._startTravel;
P._startTravel=function(actor,target,kind,onArrive,receiver,travelKind,meta){const S=state(this),team=actor&&(actor.team===0||actor.team===1)?actor.team:null;let bridge=false;if(kind==='pass'&&team!=null&&this.stats&&this.stats[team]){const missing=Math.max(0,finite(this.stats[team].passes)-finite(S.team[team].passes));if(missing>0){S.team[team].passes+=missing;S.pendingPass={team,t:finite(this.t),through:false,administrative:true};S.diagnostics.administrativePassBridges+=missing;bridge=true;}}
  let cb=onArrive;if(bridge&&typeof onArrive==='function'){const sim=this,orig=onArrive;cb=function(){const r=orig.apply(this,arguments),ok=finite(sim.stats&&sim.stats[team]&&sim.stats[team].passOk),miss=Math.max(0,ok-finite(S.team[team].passCompleted));if(miss>0)S.team[team].passCompleted+=miss;S.pendingPass=null;return r;};}
  const r=oldStartTravel.call(this,actor,target,kind,cb,receiver,travelKind,meta);if(kind==='shot'){let q=S.activeShot;if(!q&&team!=null)q=beginShot(this,team,0,'synthetic_travel');if(q){q.travelStarted=true;q.travelId=(q.travelId||0)+1;if(this.ball){this.ball.__r122ShotId=q.id;this.ball.meta=Object.assign({},this.ball.meta||{}, {r122ShotId:q.id});}}}return r;
};
const oldContinue=P._continueTravel;
P._continueTravel=function(target,kind,onArrive,meta,speed){const r=oldContinue.apply(this,arguments),q=state(this).activeShot;if(kind==='shot'&&q&&this.ball){q.travelStarted=true;q.travelId=(q.travelId||0)+1;this.ball.__r122ShotId=q.id;this.ball.meta=Object.assign({},this.ball.meta||{}, {r122ShotId:q.id});}return r;};
const oldBallTravel=P._ballTravel;
P._ballTravel=function(dt){const S=state(this),q=S.activeShot,b=this.ball,was=!!(q&&b&&b.traveling&&b.kind==='shot'),qid=q&&q.id;const r=oldBallTravel.apply(this,arguments);if(was&&S.activeShot&&S.activeShot.id===qid&&b&&!b.traveling){const o=b.owner;if(o&&o.team===1-q.team&&o.isGK)finishShot(this,'save','physical_claim');else if(o&&o.team===1-q.team)finishShot(this,'blocked','physical_block');else reconcileShot(this,'travel_stopped');S.diagnostics.shotTravelBridges++;}return r;};
const oldGoalKick=P._goalKickOrRestart;P._goalKickOrRestart=function(team){if(state(this).activeShot)finishShot(this,'miss','goal_kick');return oldGoalKick.apply(this,arguments);};
const oldSetCorner=P._setCorner;P._setCorner=function(team){if(state(this).activeShot)finishShot(this,'blocked','corner');return oldSetCorner.apply(this,arguments);};
const oldIsOver=P.isOver;P.isOver=function(){const over=oldIsOver.apply(this,arguments);if(!over){this.__r122FinalWhistleAt=null;return false;}const S=state(this),active=!!(this.ball&&this.ball.traveling)||!!S.activeShot;if(!active){this.__r122FinalWhistleAt=null;return true;}if(this.__r122FinalWhistleAt==null)this.__r122FinalWhistleAt=finite(this.t);if(finite(this.t)-this.__r122FinalWhistleAt<7)return false;if(S.activeShot)reconcileShot(this,'final_whistle_timeout');return true;};

/* Opções contextuais de chute/cruzamento sem atropelar passe claro. */
const oldCanCross=P._canCross;P._canCross=function(o){if(!o||!this.teams)return oldCanCross.apply(this,arguments);const tm=this.teams[o.team],adv=tm.attackDir>0?o.x:FL-o.x,wide=o.y<27||o.y>FW-27;return oldCanCross.apply(this,arguments)||(adv>57&&wide);};
const oldDecide=P._decide;P._decide=function(o){if(o&&!o.isGK&&this.ball&&this.ball.owner===o&&this.teams&&!(o._setPieceDeliveryUntil>this.t)){const tm=this.teams[o.team],now=finite(this.t),g=tm.oppGoal,dtg=Math.hypot(finite(o.x)-finite(g.x),finite(o.y)-finite(g.y)),near=typeof this._nearestOpponent==='function'?this._nearestOpponent(o):{dist:5},best=typeof this._bestPass==='function'?this._bestPass(o):null,superior=best&&best.intoBox&&finite(best.risk)<1.75&&finite(best.score)>1.45;if(!superior&&dtg>=10&&dtg<=27&&now-finite(tm.__r122LastContextShot,-99)>1.15){const fin=attr(o,'finalizacao'),lng=attr(o,'chute_longe'),central=clamp(1-Math.abs(finite(o.y)-finite(g.y))/31,.35,1),pressure=clamp((3.5-finite(near.dist,5))/3.5,0,1);let p=dtg<=16?.40:dtg<=20?.285:dtg<=24?.17:.072;p*=central*(1-pressure*.58)*clamp((fin*.66+lng*.34)/72,.72,1.24);if(schance(this,p)){tm.__r122LastContextShot=now;this._shoot(o,dtg,dtg>21,o.settle>0&&o.settle<.45);return;}}
  if(typeof this._canCross==='function'&&this._canCross(o)){const targets=tm.players.filter(p=>!p.red&&!p.isGK&&p!==o&&Math.abs(p.x-tm.oppGoal.x)<24);if(targets.length&&now-finite(tm.__r122LastCross,-99)>1.65&&!superior){const q=clamp((attr(o,'cruzamento')-50)/50,0,1),p=clamp(.17+q*.12+Math.min(3,targets.length)*.04+(finite(near.dist)>3?.035:0),.17,.40);if(schance(this,p)){tm.__r122LastCross=now;this._cross(o);return;}}}}
  return oldDecide.apply(this,arguments);
};

/* Defesa outcome-first: contenção é resultado válido, não sinônimo de bote. */
P._dribble=function(o,d,g){if(!o||!d||!g)return;const tm=this.teams[o.team],stO=ensureStats(this.stats[o.team]),stD=ensureStats(this.stats[d.team]),adv=tm.attackDir>0?o.x:FL-o.x,finalThird=adv>68,wing=o.y<22||o.y>FW-22,dri=attr(o,'drible'),elite=dri>=86||(o.ref&&o.ref.traits&&o.ref.traits.includes('DRIBBLER')),best=typeof this._bestPass==='function'?this._bestPass(o):null,support=best&&best.m&&finite(best.risk)<2.35&&finite(best.score)>.55,attemptP=clamp(.45+(finalThird?.20:0)+(wing?.08:0)+(elite?.17:(dri-65)/320)-(support?.10:0),.32,elite?.88:.76);
  if(!schance(this,attemptP)){state(this).diagnostics.duelsAvoided++;if(support&&schance(this,.62)){this._pass(o,best);return;}const a=Math.atan2(g.y-o.y,g.x-o.x),side=schance(this,.5)?1:-1;o._tx=clamp(o.x+Math.cos(a)*1.8-Math.sin(a)*3.2*side,1,FL-1);o._ty=clamp(o.y+Math.sin(a)*1.8+Math.cos(a)*3.2*side,1,FW-1);o.settle=Math.max(finite(o.settle),.18);stO.containments++;this._emit('containment',{by:d,on:o,source:'dribble_declined'});return;}
  o._act='dribble';stO.dribblesAttempted++;stD.tackleAttempts++;const S=state(this);S.team[o.team].dribbleAttempts++;S.team[d.team].tackleAttempts++;const ctx=this._actionContext?this._actionContext(o,dist(o,d),'dribble'):{execution:1},dctx=this._actionContext?this._actionContext(d,dist(o,d),'defend'):{execution:1},pa=facet(o,'drб_atk')*finite(ctx.execution,1)+(wing&&finalThird?4:0)+(o._onFire?5:0)+(elite?4+Math.max(0,dri-86)*.38:0),pd=facet(d,'drб_def')*finite(dctx.execution,1)+2.5,raw=typeof root.duelProb==='function'?root.duelProb(pa+.5,pd):.5,p=clamp(raw,.20,elite?.84:.72);
  if(schance(this,p)){stO.dribblesCompleted++;S.team[o.team].dribblesWon++;const side=schance(this,.5)?1:-1,a=Math.atan2(g.y-o.y,g.x-o.x);o._tx=clamp(o.x+Math.cos(a)*7-Math.sin(a)*3.5*side,1,FL-1);o._ty=clamp(o.y+Math.sin(a)*7+Math.cos(a)*3.5*side,1,FW-1);o.rating+=.12;d.rating-=.05;this._emit('dribble',{by:o,ok:true,flair:elite&&schance(this,.26)});return;}
  const ownBox=(this.teams[d.team].attackDir>0?d.x<16.5:d.x>FL-16.5)&&Math.abs(d.y-FW/2)<20,foulP=clamp((this._foulProb?this._foulProb(d):.08)*(ownBox?.55:1.30),.022,ownBox?.095:.35);if(schance(this,foulP)){this._awardFoul(d,o);return;}const winP=clamp(.48+(pd-pa)/180+(attr(d,'desarme')-70)/260,.34,.72);if(schance(this,winP)){stD.tackles++;stD.tacklesWon++;S.team[d.team].tacklesWon++;if(this._turnover(d)!==false){this._emit('tackle',{by:d,on:o,source:'dribble'});d.rating+=.10;return;}}
  if(schance(this,.38)&&this._deflectTo){const a=Math.atan2(g.y-o.y,g.x-o.x)+(schance(this,.5)?1:-1)*sideRand(this,.45,.85);this.ball.lastTouch=schance(this,.55)?d:o;this._deflectTo(clamp(o.x+Math.cos(a)*4.2,1,FL-1),clamp(o.y+Math.sin(a)*4.2,1,FW-1),6.4);stO.looseDuels++;stD.looseDuels++;this._emit('loose_duel',{by:d,on:o});return;}const back=tm.attackDir>0?-1:1;o._tx=clamp(o.x+back*2.8,1,FL-1);o._ty=clamp(o.y+(schance(this,.5)?1:-1)*2.8,1,FW-1);o.settle=Math.max(finite(o.settle),.28);stO.containments++;this._emit('containment',{by:d,on:o,source:'failed_dribble'});
};
P._pressAndTackle=function(dt){const o=this.ball&&this.ball.owner;if(!o||!this.teams||!this.stats)return;const defTm=this.teams[1-o.team],near=this._selectPresser?this._selectPresser(defTm,this.ball):null;if(!near)return;const now=finite(this.t),step=clamp(finite(dt,1/30),1/240,.15),nd=dist(o,near),style=defTm.styleKey||'balanced',S=state(this),st=ensureStats(this.stats[near.team]);
  if(nd<4.9&&finite(near.__r122PressureAt,-99)+.78<=now){near.__r122PressureAt=now;st.pressures++;S.team[near.team].pressures++;S.diagnostics.pressures++;this._emit('pressure',{by:near,on:o,distance:nd});}
  const radius=clamp(2.42+(attr(near,'aceleracao')-60)/210+(attr(near,'desarme')-65)/230,2.20,2.90);if(nd<=radius&&(!near._tackleCd||near._tackleCd<=0)){const rate=style==='press'?8.1:style==='direct'?7.0:style==='counter'?6.2:style==='park'?5.2:style==='tiki'?5.0:6.5,pTry=1-Math.exp(-rate*step);if(schance(this,pTry)){st.tackleAttempts++;S.team[near.team].tackleAttempts++;near._tackleCd=clamp(.92-(attr(near,'ritmo')-65)/210,.68,1.05);this._emit('tackle_attempt',{by:near,on:o,distance:nd});const defQ=facet(near,'tackle')*.72+facet(near,'press')*.18+attr(near,'antecipacao')*.10,atkQ=facet(o,'carry')*.78+attr(o,'controle')*.14+attr(o,'compostura')*.08,success=clamp(.78+(defQ-atkQ)/205,.65,.93),ownBox=(defTm.attackDir>0?near.x<16.5:near.x>FL-16.5)&&Math.abs(near.y-FW/2)<20,foul=clamp((this._foulProb?this._foulProb(near):.08)*(ownBox?.58:1.52),.020,ownBox?.10:.38);if(schance(this,foul)){this._awardFoul(near,o);}else if(schance(this,success)){st.tackles++;st.tacklesWon++;S.team[near.team].tacklesWon++;if(nd<=1.98&&this._turnover(near)!==false)this._emit('tackle',{by:near,on:o,source:'press_contact'});else{const dir=defTm.attackDir||1,side=schance(this,.5)?1:-1;this.ball.owner=null;this.ball.lastTouch=near;if(this._deflectTo)this._deflectTo(clamp(near.x+dir*2.7,1,FL-1),clamp(near.y+side*1.5,1,FW-1),7.2);this._emit('tackle',{by:near,on:o,source:'press_poke'});}}else{near._beatenUntil=now+.48;const dir=this.teams[o.team].attackDir||1;o._tx=clamp(o.x+dir*1.6,1,FL-1);o._ty=clamp(o.y+(schance(this,.5)?1:-1)*1.2,1,FW-1);o.settle=Math.max(finite(o.settle),.10);this._emit('tackle_missed',{by:near,on:o,distance:nd});}}else if(nd<3.05&&finite(near.__r122ContainAt,-99)+.9<=now){near.__r122ContainAt=now;st.containments++;S.team[near.team].containments++;this._emit('containment',{by:near,on:o,source:'press'});}}
  for(const p of defTm.players||[])if(p._tackleCd>0)p._tackleCd=Math.max(0,p._tackleCd-step);
};

/* Contexto de cruzamento e desvios para escanteio. */
const oldCross=P._cross;P._cross=function(o){if(o)this.__r122CrossWindow={team:o.team,t:finite(this.t)};return oldCross.apply(this,arguments);};
const originalGoalKick=oldGoalKick;P._goalKickOrRestart=function(team){const q=this.__r122CrossWindow,now=finite(this.t);if(q&&now-finite(q.t,-99)<4.2&&team===1-q.team){this.__r122CrossWindow=null;if(schance(this,.42)){if(state(this).activeShot)finishShot(this,'blocked','corner_from_cross');return oldSetCorner.call(this,q.team);}}this.__r122CrossWindow=null;if(state(this).activeShot)finishShot(this,'miss','goal_kick');return originalGoalKick.apply(this,arguments);};
const oldTurnover=P._turnover;P._turnover=function(p){const q=this.__r122Deflection,now=finite(this.t);if(q&&now-finite(q.t,-99)<.18&&(q.attTeam===0||q.attTeam===1)){this.__r122Deflection=null;const goal=this.teams&&this.teams[1-q.attTeam]&&this.teams[1-q.attTeam].goal,nearEnd=goal&&Math.abs(finite(this.ball&&this.ball.x)-finite(goal.x))<25,prob=q.kind==='cross'?.72:.48;if(nearEnd&&schance(this,prob)){if(state(this).activeShot)finishShot(this,'blocked','deflection_corner');oldSetCorner.call(this,q.attTeam);return true;}}this.__r122Deflection=null;return oldTurnover.apply(this,arguments);};

/* Evento canônico e transações de chute. */
const oldEmit=P._emit;
P._emit=function(type,data){data=data||{};const S=state(this),now=finite(this.t),by=data.by||data.p||data.gk,team=by&&(by.team===0||by.team===1)?by.team:(data.team===0||data.team===1?data.team:null);let shotId=null;
  if(type==='shot_taken'||type==='header_shot'||type==='low_cross_shot'){const q=beginShot(this,team,finite(data.xg),type);shotId=q&&q.id;}
  else if(type==='penalty'&&team!=null){const legacyXg=finite(this.stats&&this.stats[team]&&this.stats[team].xg),cur=S.team[team].xg,q=beginShot(this,team,Math.max(0,legacyXg-cur),'penalty','penalty');shotId=q&&q.id;S.pendingOrigin={team,kind:'penalty',until:now+7};}
  else if(type==='freekick'&&team!=null&&data.direct){const q=beginShot(this,team,finite(data.pGoal),'freekick','direct_free_kick');shotId=q&&q.id;S.pendingOrigin={team,kind:'direct_free_kick',until:now+9};}
  if(type==='goal')finishShot(this,'goal','event_goal');else if(type==='save')finishShot(this,'save','event_save');else if(type==='pen_miss')finishShot(this,data.saved?'save':'miss','event_pen_miss');else if(type==='miss'||type==='post')finishShot(this,'miss','event_'+type);else if(type==='blocked'&&data.kind!=='cross')finishShot(this,'blocked','event_blocked');
  if(type==='pass'&&team!=null){S.team[team].passCompleted++;if(S.pendingPass&&S.pendingPass.team===team&&S.pendingPass.through)S.team[team].throughCompleted++;S.pendingPass=null;}
  if(type==='bad_pass'||type==='intercept'||type==='offside')S.pendingPass=null;
  if(type==='cross'&&team!=null){S.team[team].crosses++;S.pendingCross={team,t:now};}
  if(type==='blocked'&&data.kind==='cross'&&S.pendingCross)this.__r122Deflection={t:now,attTeam:S.pendingCross.team,kind:'cross'};
  if(type==='blocked'&&data.kind!=='cross'){const q=S.activeShot||S.shotHistory[S.shotHistory.length-1];if(q)this.__r122Deflection={t:now,attTeam:q.team,kind:'shot'};}
  if((type==='header_shot'||type==='low_cross_shot')&&S.pendingCross&&team===S.pendingCross.team&&now-S.pendingCross.t<5){S.team[team].crossesCompleted++;S.pendingCross=null;}
  if(type==='corner'&&data.team!=null){S.team[data.team].corners++;S.team[1-data.team].cornersConceded++;S.pendingOrigin={team:data.team,kind:'corner',until:now+12};}
  if(type==='freekick'&&team!=null&&!data.direct)S.pendingOrigin={team,kind:'crossed_free_kick',until:now+9};
  if(type==='intercept'&&team!=null)S.team[team].interceptions++;
  if(type==='foul'&&team!=null)S.team[team].fouls++;
  if(type==='yellow'&&team!=null)S.team[team].yellow++;
  if(type==='red'&&team!=null){S.team[team].red++;if(data.second)S.team[team].yellow++;}
  if(type==='offside'&&team!=null)S.team[team].offsides++;
  S.events.push({type,t:now,minute:finite(this.minute),team,shotId});if(S.events.length>1000)S.events.splice(0,S.events.length-1000);
  return oldEmit.apply(this,arguments);
};

P.getR12Audit=function(){const live=state(this);if(live.activeShot&&oldIsOver.call(this))reconcileShot(this,'audit_final');const S=JSON.parse(JSON.stringify(state(this))),pairs=[['goals','goals'],['shots','shots'],['onTarget','onTarget'],['passes','passes'],['passCompleted','passOk'],['throughBalls','throughBalls'],['throughCompleted','throughOk'],['crosses','crosses'],['crossesCompleted','crossesOk'],['corners','corners'],['dribbleAttempts','dribblesAttempted'],['dribblesWon','dribblesCompleted'],['tackleAttempts','tackleAttempts'],['tacklesWon','tackles'],['interceptions','interceptions'],['fouls','fouls'],['yellow','yellow'],['red','red'],['offsides','offsides'],['saves','saves']];
  for(let i=0;i<2;i++){const t=S.team[i],legacy=this.stats&&this.stats[i]||{};t.passAccuracy=t.passes?t.passCompleted/t.passes:0;t.throughAccuracy=t.throughBalls?t.throughCompleted/t.throughBalls:0;t.crossAccuracy=t.crosses?t.crossesCompleted/t.crosses:0;t.dribbleSuccess=t.dribbleAttempts?t.dribblesWon/t.dribbleAttempts:0;t.tackleSuccess=t.tackleAttempts?t.tacklesWon/t.tackleAttempts:0;const goals=t.openPlayGoals+t.penaltyGoals+t.directFreeKickGoals+t.crossedFreeKickGoals+t.cornerGoals,finished=t.onTarget+t.offTarget+t.blocked;if(goals!==t.goals||finished!==t.shots)S.diagnostics.statIdentityErrors++;if(t.passCompleted>t.passes||t.throughCompleted>t.throughBalls||t.crossesCompleted>t.crosses||t.dribblesWon>t.dribbleAttempts||t.tacklesWon>t.tackleAttempts)S.diagnostics.statIdentityErrors++;for(const [ck,lk] of pairs)if(finite(t[ck])!==finite(legacy[lk]))S.diagnostics.legacyParityErrors++;}
  if(S.activeShot)S.diagnostics.transactionErrors++;for(const q of S.shotHistory)if(!q.resolved||!q.result)S.diagnostics.transactionErrors++;
  S.status=S.diagnostics.statIdentityErrors===0&&S.diagnostics.legacyParityErrors===0&&S.diagnostics.transactionErrors===0&&S.diagnostics.maxFinalStep<=.75?'CONSISTENT':'REVIEW';return S;
};
P.getFullFootballAudit=function(){const stats=this.stats||[],sum=k=>stats.reduce((a,s)=>a+finite(s&&s[k]),0),total={};for(const k of ['goals','shots','onTarget','xg','passes','passOk','corners','fouls','yellow','red','tackles','tackleAttempts','interceptions','dribblesAttempted','dribblesCompleted','crosses','crossesOk','throughBalls','throughOk','offsides','saves','setPieceShots','setPieceGoals'])total[k]=sum(k);total.passAccuracy=total.passes?total.passOk/total.passes:0;total.crossAccuracy=total.crosses?total.crossesOk/total.crosses:0;total.dribbleSuccess=total.dribblesAttempted?total.dribblesCompleted/total.dribblesAttempted:0;total.throughAccuracy=total.throughBalls?total.throughOk/total.throughBalls:0;return{version:VERSION,status:this.getR12Audit().status,total,team:stats,canonical:this.getR12Audit(),physical:this.getR10Report?this.getR10Report():null};};
try{const old=root.CDS_PRE25D_BUILD||{};root.CDS_PRE25D_BUILD=Object.freeze(Object.assign({},old,{version:VERSION,baseExpected:'5.8.2',p06Executed:false,consolidatedCore:true,legacyR11LayersRemoved:true,transactionalShots:true}));}catch(_){ }
root.CDS_R12=Object.freeze({version:VERSION,status:'TRANSACTIONAL_CANDIDATE',architecture:Object.freeze({movementWriter:'R12_COMMIT_ONCE_PLUS_FRAME_GUARD',possessionWriter:'R10_CONTACT_CONTRACT',auditWriter:'R12_TRANSACTION_LEDGER',auxRng:'ISOLATED'}),targets:Object.freeze({goals:[1.8,3.0],shots:[14,22],passes:[170,235],passAccuracy:[.78,.88],throughBalls:[8,17],throughAccuracy:[.48,.80],crosses:[9,21],crossAccuracy:[.16,.40],corners:[4,10],fouls:[7,17],tackleAttempts:[18,40],tackles:[8,22],interceptions:[6,18],dribblesAttempted:[8,22],dribbleSuccess:[.38,.68],offsides:[.5,4]})});
try{document.title='Copa dos Sonhos — Núcleo Autoritativo Transacional R12.3';}catch(_){ }
})(typeof window!=='undefined'?window:globalThis);
