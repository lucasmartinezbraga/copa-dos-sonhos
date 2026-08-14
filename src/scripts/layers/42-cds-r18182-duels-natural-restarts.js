/* R18.18.2 · DISPUTAS E SAÍDAS NATURAIS
   --------------------------------------------------------------------------
   A bola só sai quando um contato, corte ou domínio produz trajetória física
   para uma linha. Bloqueios deixam de receber escanteio por uma rolagem
   paralela: contato + vetor + último toque resolvem o reinício. */
(function(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;
const P=M.prototype;if(P.__r18182DuelsNaturalRestarts)return;
P.__r18182DuelsNaturalRestarts=true;
const V='5.12.7-R18.18.2',FL=Number(root.FL)||105,FW=Number(root.FW)||68;
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>a&&b?Math.hypot(finite(a.x)-finite(b.x),finite(a.y)-finite(b.y)):999;
const teamOf=p=>p&&(p.team===0||p.team===1)?p.team:null;
const attr=(p,k,d=65)=>{try{return finite(root.getAttr?root.getAttr(p,k):p&&p.ref&&p.ref[k],d);}catch(_){return d;}};
function fresh(){return{
 version:V,duelContexts:0,duelWins:0,duelWinsNearLine:0,tackleEventsSeen:0,tackleEventsNearLine:0,tackleEventOuts:0,duelOuts:0,closeDuelOuts:0,tackleOuts:0,dribbleOuts:0,
 physicalBlockDecisions:0,blockCorners:0,blockThrowIns:0,blockLoose:0,clearSeen:0,clearCandidates:0,clearMatches:0,
 deliberateClearances:0,clearanceThrowIns:0,clearancePassCandidates:0,clearancePassOuts:0,poorTouchOuts:0,
 executionErrorsSeen:0,executionErrorsOutward:0,executionErrorNear12:0,executionErrorResidual9:0,executionErrorCandidates:0,executionErrorOuts:0,executionErrorOutsByTeam:[0,0],gkErrorOuts:0,
 randomCornerPathsSuppressed:0,naturalThrowIns:0,naturalCorners:0,naturalGoalKicks:0,
 throwInShapes:0,throwInPressureAssignments:0,throwInCoverAssignments:0,
 preventedUnsafe:0,events:[]
};}
function st(sim){return sim.__r18182||(sim.__r18182=fresh());}
function log(sim,type,data){const s=st(sim);s.events.push(Object.assign({type,time:+finite(sim.t).toFixed(3),minute:+finite(sim.minute).toFixed(2)},data||{}));if(s.events.length>360)s.events.splice(0,s.events.length-360);}
function inside(b){return b&&finite(b.x)>=0&&finite(b.x)<=FL&&finite(b.y)>=0&&finite(b.y)<=FW;}
function edgeInfo(x,y){const a=[{edge:'endline_left',d:x},{edge:'endline_right',d:FL-x},{edge:'touchline_top',d:y},{edge:'touchline_bottom',d:FW-y}];a.sort((q,r)=>q.d-r.d);return a[0];}
function outPoint(edge,x,y,pad=.92){
 if(edge==='touchline_top')return{x:clamp(x,1,FL-1),y:-pad};
 if(edge==='touchline_bottom')return{x:clamp(x,1,FL-1),y:FW+pad};
 if(edge==='endline_left')return{x:-pad,y:clamp(y,1,FW-1)};
 return{x:FL+pad,y:clamp(y,1,FW-1)};
}
function rayBoundary(x,y,vx,vy){
 const c=[];if(vx<-.04)c.push({edge:'endline_left',t:(0-x)/vx});if(vx>.04)c.push({edge:'endline_right',t:(FL-x)/vx});
 if(vy<-.04)c.push({edge:'touchline_top',t:(0-y)/vy});if(vy>.04)c.push({edge:'touchline_bottom',t:(FW-y)/vy});
 const valid=c.filter(q=>q.t>0).map(q=>{const ix=x+vx*q.t,iy=y+vy*q.t;return Object.assign(q,{x:ix,y:iy,d:Math.hypot(ix-x,iy-y)});}).filter(q=>q.x>=-.02&&q.x<=FL+.02&&q.y>=-.02&&q.y<=FW+.02);
 valid.sort((a,b)=>a.t-b.t);return valid[0]||null;
}
function armOut(sim,source,edge,last,from,to){
 const b=sim.ball;if(!b)return;
 b.__r18182NaturalOut={source,edge,lastTeam:teamOf(last)||teamOf(b.lastTouch),at:finite(sim.t)};
 log(sim,'out_armed',{source,edge,lastTeam:b.__r18182NaturalOut.lastTeam,fromX:+finite(from.x).toFixed(2),fromY:+finite(from.y).toFixed(2),toX:+finite(to.x).toFixed(2),toY:+finite(to.y).toFixed(2)});
}
function extendDuelTarget(sim,x,y,source){
 const b=sim.ball;if(!inside(b))return{x,y,changed:false};
 const bx=finite(b.x),by=finite(b.y),dx=finite(x,bx)-bx,dy=finite(y,by)-by,ctx=sim.__r18182ContactCtx;
 let edge=null;
 const top=by,bottom=FW-by,left=bx,right=FL-bx;
 const duel=ctx&&(ctx.kind==='tackle'||ctx.kind==='dribble');
 /* Bloqueios reais chegam aqui pelo evento `blocked` imediatamente anterior
    à deflexão. O alvo-base já escolheu o vetor; apenas permitimos que ele
    complete a travessia quando termina próximo da linha de fundo. */
 const block=(typeof source==='string'&&source.indexOf('blocked_')===0)||(ctx&&ctx.kind==='block');
 const touchLimit=duel?10.2:block?10.4:6.4;
 const endLimit=block?22.5:duel?7.2:8.6;
 /* Em um duelo de faixa, o contato possui um lado observável. Se o defensor
    chega pelo lado INTERIOR do campo, o poke empurra a bola para a linha. */
 if(duel&&ctx.attacker&&ctx.defender){const ae=Math.min(finite(ctx.attacker.y),FW-finite(ctx.attacker.y)),de=Math.min(finite(ctx.defender.y),FW-finite(ctx.defender.y));if(ae<=9.6&&de>=ae+.22)edge=finite(ctx.attacker.y)<FW/2?'touchline_top':'touchline_bottom';}
 if(!edge&&top<=touchLimit&&dy<-.12&&finite(y)>=-2&&finite(y)<by-.28)edge='touchline_top';
 else if(!edge&&bottom<=touchLimit&&dy>.12&&finite(y)<=FW+2&&finite(y)>by+.28)edge='touchline_bottom';
 else if(left<=endLimit&&dx<-.14&&finite(x)>=-2&&finite(x)<bx-.35)edge='endline_left';
 else if(right<=endLimit&&dx>.14&&finite(x)<=FL+2&&finite(x)>bx+.35)edge='endline_right';
 if(!edge)return{x,y,changed:false};
 const p=outPoint(edge,finite(x,bx),finite(y,by));armOut(sim,source,edge,b.lastTouch,{x:bx,y:by},p);
 return{x:p.x,y:p.y,changed:true,edge};
}
function blockRay(sim,q,maxEnd=13,maxTouch=8){
 const b=sim.ball;if(!b||!q)return null;let vx=finite(q.vx),vy=finite(q.vy);
 if(Math.hypot(vx,vy)<.15){const atk=sim.teams&&sim.teams[q.attTeam];vx=atk?finite(atk.attackDir,1):1;vy=0;}
 const L=Math.max(.001,Math.hypot(vx,vy));vx/=L;vy/=L;
 const hit=rayBoundary(finite(b.x),finite(b.y),vx,vy);if(!hit)return null;
 const isEnd=hit.edge.indexOf('endline')===0,limit=isEnd?maxEnd:maxTouch;if(hit.d>limit)return null;
 return Object.assign(hit,outPoint(hit.edge,hit.x,hit.y));
}
function nearestOpponent(sim,p){let best=99;const tm=sim.teams&&sim.teams[1-p.team];if(!tm)return best;for(const q of tm.players||[])if(q&&!q.red)best=Math.min(best,dist(p,q));return best;}
function ownGoalDistance(sim,p){const tm=sim.teams&&sim.teams[p.team];return tm&&tm.goal?dist(p,tm.goal):99;}
function deliberateClearance(sim,def,q){
 if(!def||def.red||def.isGK||finite(sim.dead)>.05||sim.pendingRestart||sim.waiting)return false;
 const danger=ownGoalDistance(sim,def),pressure=nearestOpponent(sim,def),control=(attr(def,'controle')+attr(def,'compostura'))/2;
 const edge=Math.min(finite(sim.ball.y),FW-finite(sim.ball.y));
 const must=edge<34&&(danger<22||(danger<38&&pressure<6.25&&(control<88||pressure<4.20)));
 if(!must)return false;
 const tm=sim.teams[def.team],side=finite(sim.ball.y)<FW/2?'touchline_top':'touchline_bottom';
 const forward=finite(tm&&tm.attackDir,1)*(6.5+clamp((78-control)/9,0,3.2));
 const p=outPoint(side,finite(sim.ball.x)+forward,finite(sim.ball.y));
 sim.ball.owner=null;sim.ball.lastTouch=def;armOut(sim,'deliberate_clearance',side,def,{x:finite(sim.ball.x),y:finite(sim.ball.y)},p);
 st(sim).deliberateClearances++;st(sim).clearanceThrowIns++;
 log(sim,'deliberate_clearance',{by:def.idx,team:def.team,danger:+danger.toFixed(2),pressure:+pressure.toFixed(2),control:+control.toFixed(1)});
 sim._deflectTo(p.x,p.y,10.6);return true;
}
const oldReset=P.reset;P.reset=function(){const r=oldReset.apply(this,arguments);this.__r18182=fresh();this.__r18182ContactCtx=null;this.__r18182RecentBlock=null;this.__r18182RecentClear=null;return r;};

const oldClearBall=P._clearBall;
if(typeof oldClearBall==='function')P._clearBall=function(o){if(o&&!o.red&&!o.isGK&&finite(this.dead)<=.05&&!this.pendingRestart&&!this.waiting){const danger=ownGoalDistance(this,o),pressure=nearestOpponent(this,o),edge=Math.min(finite(o.y),FW-finite(o.y));if(danger<31.5&&pressure<5.85&&edge<33.5&&deliberateClearance(this,o,{source:'clear_ball'}))return;}return oldClearBall.apply(this,arguments);};

const oldPress=P._pressAndTackle;
P._pressAndTackle=function(dt){const o=this.ball&&this.ball.owner;let d=null;try{if(o&&this.teams)d=this._selectPresser&&this._selectPresser(this.teams[1-o.team],this.ball);}catch(_){}
 const edge=o?Math.min(finite(o.y),FW-finite(o.y)):99,active=o&&d&&edge<11.5&&dist(o,d)<3.5;
 if(active){this.__r18182ContactCtx={kind:'tackle',attacker:o,defender:d,start:finite(this.t)};st(this).duelContexts++;}
 try{return oldPress.apply(this,arguments);}finally{if(active)this.__r18182ContactCtx=null;}
};
const oldDribble=P._dribble;
P._dribble=function(o,d,g){const edge=o?Math.min(finite(o.y),FW-finite(o.y)):99,active=o&&d&&edge<12.5;
 if(active){this.__r18182ContactCtx={kind:'dribble',attacker:o,defender:d,start:finite(this.t)};st(this).duelContexts++;}
 try{return oldDribble.apply(this,arguments);}finally{if(active)this.__r18182ContactCtx=null;}
};

const oldEmit=P._emit;
P._emit=function(type,data){const r=oldEmit.apply(this,arguments);try{data=data||{};const b=this.ball||{};
 if(type==='blocked'){const fx=b.from&&finite(b.from.x),fy=b.from&&finite(b.from.y),rvx=finite(b.vx),rvy=finite(b.vy),dvx=Number.isFinite(fx)?finite(b.x)-fx:0,dvy=Number.isFinite(fy)?finite(b.y)-fy:0;this.__r18182RecentBlock={at:finite(this.t),kind:data.kind||'shot',by:data.by||null,attTeam:teamOf(data.by)==null?teamOf(b.lastTouch):1-teamOf(data.by),x:finite(b.x),y:finite(b.y),vx:Math.hypot(rvx,rvy)>.18?rvx:dvx,vy:Math.hypot(rvx,rvy)>.18?rvy:dvy};}
 else if(type==='header_clear'){st(this).clearSeen++;this.__r18182RecentClear={at:finite(this.t),by:data.by||null,x:finite(b.x),y:finite(b.y),vx:finite(b.vx),vy:finite(b.vy)};log(this,'clear_seen',{by:data.by&&data.by.idx,x:+finite(b.x).toFixed(2),y:+finite(b.y).toFixed(2)});}
 else if(type==='tackle'){const by=data.by,on=data.on,s=st(this);s.tackleEventsSeen++;if(by&&on&&teamOf(by)!==teamOf(on)){const ae=Math.min(finite(on.y),FW-finite(on.y)),de=Math.min(finite(by.y),FW-finite(by.y)),dd=dist(by,on),outward=finite(on.y)<FW/2?finite(on.vy)<-.12:finite(on.vy)>.12,insideApproach=de>=ae-.75;if(ae<=12)s.tackleEventsNearLine++;if(ae<=10.8&&dd<=3.35&&(insideApproach||outward||ae<=4.2)&&this.ball&&this.ball.owner===by&&!this.ball.traveling&&finite(this.dead)<=.05&&!this.pendingRestart&&finite(this.t)-finite(this.__r18182LastTackleEventOut,-99)>=4.8){const edge=finite(on.y)<FW/2?'touchline_top':'touchline_bottom',last=insideApproach?by:on,p=outPoint(edge,finite(on.x)+finite(on.vx)*.35,finite(on.y));this.__r18182LastTackleEventOut=finite(this.t);this.ball.owner=null;this.ball.lastTouch=last;armOut(this,'tackle_event',edge,last,{x:finite(this.ball.x),y:finite(this.ball.y)},p);s.tackleEventOuts++;s.duelOuts++;s.tackleOuts++;log(this,'tackle_event_out',{by:by.idx,on:on.idx,last:last.idx,ae:+ae.toFixed(2),de:+de.toFixed(2),distance:+dd.toFixed(2),outward,insideApproach});this._deflectTo(p.x,p.y,7.5);}}}
 else if(['goal','offside','foul','penalty','freekick','corner','throw_in','goal_kick','kickoff'].includes(type)){this.__r18182RecentBlock=null;this.__r18182RecentClear=null;}
 }catch(_){}return r;};

const oldDeflect=P._deflectTo;
P._deflectTo=function(x,y,spd){
 /* Alvos que já cruzaram a linha foram resolvidos pelo ramo causal que os
    produziu. Não os estendemos de novo: evita dupla telemetria sem alterar
    a trajetória ou o último toque. */
 if(Number.isFinite(x)&&Number.isFinite(y)&&(x<0||x>FL||y<0||y>FW))return oldDeflect.call(this,x,y,spd);
 let source='deflection';const c=this.__r18182ContactCtx,r=this.__r18182RecentBlock;
 if(c)source=c.kind+'_duel';else if(r&&finite(this.t)-finite(r.at)<.22)source='blocked_'+r.kind;
 const q=extendDuelTarget(this,x,y,source);if(q.changed){const s=st(this);if(source.indexOf('blocked_')===0){if(q.edge&&q.edge.indexOf('endline')===0)s.blockCorners++;else s.blockThrowIns++;}else{s.duelOuts++;if(c&&c.kind==='tackle')s.tackleOuts++;else if(c&&c.kind==='dribble')s.dribbleOuts++;}}
 return oldDeflect.call(this,q.x,q.y,spd);
};
const oldLoose=P._looseBall;
P._looseBall=function(x,y){const b=this.ball||{},q=extendDuelTarget(this,x,y,'loose_contact'),ox=finite(q.x),oy=finite(q.y);
 /* _looseBall original chama _contestLoose imediatamente. Fora do campo isso
    permitia que um jogador recebesse a bola antes de _ballOut. Cruzou a linha:
    resolve o reinício no mesmo contato, sem disputa administrativa externa. */
 if(ox<0||ox>FL||oy<0||oy>FW){b.owner=null;b.traveling=false;b.onArrive=null;b.target=null;b.vx=b.vy=b.vz=0;b.z=0;b.x=ox;b.y=oy;return this._ballOut();}
 return oldLoose.call(this,ox,oy);};

/* Bloqueios: substitui a escolha binária escanteio/posse por uma deflexão
   geométrica. Se o vetor não chega a uma linha próxima, a bola permanece viva
   ou o defensor domina — nunca recebe escanteio por sorteio separado. */
const oldSetCorner=P._setCorner;
P._setCorner=function(team){const q=this.__r18182RecentBlock,now=finite(this.t);
 if(q&&now-finite(q.at)<.24&&q.attTeam===team){st(this).physicalBlockDecisions++;const hit=blockRay(this,q,30,8.8),def=q.by;this.__r18182RecentBlock=null;this.__r122Deflection=null;
   if(hit&&hit.edge.indexOf('endline')===0){const p=outPoint(hit.edge,hit.x,hit.y);if(def)this.ball.lastTouch=def;armOut(this,'physical_block',hit.edge,def,{x:finite(this.ball.x),y:finite(this.ball.y)},p);st(this).blockCorners++;this._deflectTo(p.x,p.y,9.8);return;}
   st(this).randomCornerPathsSuppressed++;if(def){this._turnover(def);return;}st(this).blockLoose++;return this._looseBall(finite(this.ball.x),finite(this.ball.y));
 }
 return oldSetCorner.apply(this,arguments);
};
const oldTurn=P._turnover;
P._turnover=function(p){const now=finite(this.t),bq=this.__r18182RecentBlock,cq=this.__r18182RecentClear,dc=this.__r18182ContactCtx,prev=this.ball&&this.ball.owner;
 if(dc&&p&&p===dc.defender&&dc.attacker){const ae=Math.min(finite(dc.attacker.y),FW-finite(dc.attacker.y)),de=Math.min(finite(dc.defender.y),FW-finite(dc.defender.y)),dd=dist(dc.attacker,dc.defender);st(this).duelWins++;if(ae<=13)st(this).duelWinsNearLine++;log(this,'duel_win_geometry',{kind:dc.kind,attacker:dc.attacker.idx,defender:dc.defender.idx,ae:+ae.toFixed(2),de:+de.toFixed(2),distance:+dd.toFixed(2),attackerVy:+finite(dc.attacker.vy).toFixed(2),defenderVy:+finite(dc.defender.vy).toFixed(2)});}
 /* Duelo corpo a corpo junto à linha. A troca de posse já foi decidida pelo
    núcleo; esta camada apenas resolve para onde a bola física escapou. */
 if(prev&&p&&prev!==p&&!prev.isGK&&!p.isGK&&teamOf(prev)!==teamOf(p)&&dist(prev,p)<=2.92&&now-finite(this.__r18182LastDuelOut,-99)>=4.15){const tm=this.teams&&this.teams[p.team],ownX=tm&&tm.goal?finite(tm.goal.x):null,touch=Math.min(finite(prev.y),FW-finite(prev.y)),end=ownX==null?99:Math.abs(finite(prev.x)-ownX),pe=Math.min(finite(p.y),FW-finite(p.y));let edge=null;if(end<=9.2&&touch<=22.5)edge=ownX<FL/2?'endline_left':'endline_right';else if(touch<=10.4&&pe>=touch-.55)edge=finite(prev.y)<FW/2?'touchline_top':'touchline_bottom';if(edge){const pt=outPoint(edge,finite(prev.x)+(tm&&tm.attackDir||1)*1.45,finite(prev.y));this.__r18182LastDuelOut=now;this.ball.owner=null;this.ball.lastTouch=p;armOut(this,'close_duel',edge,p,{x:finite(this.ball.x),y:finite(this.ball.y)},pt);st(this).duelOuts++;st(this).closeDuelOuts++;if(edge.indexOf('endline')===0)st(this).blockCorners++;else st(this).tackleOuts++;this._deflectTo(pt.x,pt.y,7.8);return true;}}
 /* Desarme vencedor na faixa: se o defensor chega do lado de dentro, o
    contato empurra a bola para a lateral em vez de produzir posse colada. */
 if(dc&&p&&p===dc.defender&&(dc.kind==='tackle'||dc.kind==='dribble')&&dc.attacker){const ae=Math.min(finite(dc.attacker.y),FW-finite(dc.attacker.y)),de=Math.min(finite(dc.defender.y),FW-finite(dc.defender.y)),last=finite(this.__r18182LastDuelOut,-99);if(ae<=10.8&&de>=ae-.45&&now-last>=4.55){const edge=finite(dc.attacker.y)<FW/2?'touchline_top':'touchline_bottom',pt=outPoint(edge,finite(dc.attacker.x)+(this.teams[p.team].attackDir||1)*1.6,finite(dc.attacker.y));this.__r18182LastDuelOut=now;this.ball.owner=null;this.ball.lastTouch=p;armOut(this,dc.kind+'_winning_tackle',edge,p,{x:finite(this.ball.x),y:finite(this.ball.y)},pt);st(this).duelOuts++;if(dc.kind==='tackle')st(this).tackleOuts++;else st(this).dribbleOuts++;this._deflectTo(pt.x,pt.y,7.7);return true;}}
 if(bq&&now-finite(bq.at)<.24&&p&&p===bq.by){st(this).physicalBlockDecisions++;const hit=blockRay(this,bq,18.5,9.2);this.__r18182RecentBlock=null;this.__r122Deflection=null;
   if(hit){const pnt=outPoint(hit.edge,hit.x,hit.y);this.ball.owner=null;this.ball.lastTouch=p;armOut(this,'physical_block',hit.edge,p,{x:finite(this.ball.x),y:finite(this.ball.y)},pnt);if(hit.edge.indexOf('endline')===0)st(this).blockCorners++;else st(this).blockThrowIns++;this._deflectTo(pnt.x,pnt.y,9.4);return true;}
   st(this).blockLoose++;return oldTurn.apply(this,arguments);
 }
 if(cq&&now-finite(cq.at)<.35){st(this).clearCandidates++;const match=!!(p&&p===cq.by);if(match)st(this).clearMatches++;const danger=p?ownGoalDistance(this,p):999,pressure=p?nearestOpponent(this,p):999,control=p?(attr(p,'controle')+attr(p,'compostura'))/2:0,edge=Math.min(finite(this.ball&&this.ball.y),FW-finite(this.ball&&this.ball.y));log(this,'clear_evaluation',{match,by:cq.by&&cq.by.idx,p:p&&p.idx,danger:+danger.toFixed(2),pressure:+pressure.toFixed(2),control:+control.toFixed(1),edge:+edge.toFixed(2)});if(match){this.__r18182RecentClear=null;if(deliberateClearance(this,p,cq))return true;}}
 return oldTurn.apply(this,arguments);
};

/* Passe já ERRADO e já orientado para fora: o motor-base decidiu o erro.
   Aqui não há nova rolagem; apenas conservamos o vetor e o momento residual
   quando o alvo artificialmente preso terminaria a poucos metros da linha. */
const oldStartTravel18182=P._startTravel;
P._startTravel=function(actor,target,kind,onArrive,receiver,travelKind,meta){
 const pk=travelKind||kind,m=Object.assign({},meta||{}),t={x:finite(target&&target.x,actor&&actor.x),y:finite(target&&target.y,actor&&actor.y)};
 if(target&&Number.isFinite(target.z))t.z=target.z;
 if(actor&&kind==='pass'&&pk!=='throw'&&(m.executionError||m.gkBadDistribution||m.clearance)){
   const s=st(this);if(m.executionError)s.executionErrorsSeen++;
   const ax=finite(actor.x),ay=finite(actor.y),dx=t.x-ax,dy=t.y-ay,L=Math.hypot(dx,dy),actorEdge=Math.min(ay,FW-ay),targetEdge=Math.min(t.y,FW-t.y),recvEdge=receiver?Math.min(finite(receiver.y),FW-finite(receiver.y)):99;
   const towardTop=dy<-.15&&t.y<ay-.35,towardBottom=dy>.15&&t.y>ay+.35,outward=towardTop||towardBottom;
   const hit=L>.01?rayBoundary(ax,ay,dx/L,dy/L):null,residual=hit?hit.d-L:999,pressure=nearestOpponent(this,actor),trueEdge=Math.min(actorEdge,targetEdge,recvEdge);
   if(m.executionError&&outward&&hit&&hit.edge.indexOf('touchline')===0){s.executionErrorsOutward++;if(trueEdge<=12)s.executionErrorNear12++;if(residual>=-.15&&residual<=9)s.executionErrorResidual9++;}
   const passCandidate=!!m.executionError&&outward&&hit&&hit.edge.indexOf('touchline')===0&&L>=6.2&&trueEdge<=11.5&&targetEdge<=actorEdge-.35&&residual>=-.15&&residual<=13.5;
   const gkCandidate=!!m.gkBadDistribution&&outward&&hit&&hit.edge.indexOf('touchline')===0&&L>=12&&trueEdge<=10.2&&residual>=-.15&&residual<=5.1;
   const danger=ownGoalDistance(this,actor),clearCandidate=!!m.clearance&&outward&&hit&&hit.edge.indexOf('touchline')===0&&L>=14&&targetEdge<=17&&targetEdge<=actorEdge-2&&residual>=-.15&&residual<=18&&danger<39&&pressure<6.6;
   if(clearCandidate)s.clearancePassCandidates++;
   if(passCandidate||gkCandidate||clearCandidate){
     s.executionErrorCandidates++;const team=teamOf(actor),last=finite(this.__r18182LastErrorOut&&this.__r18182LastErrorOut[team],-99);
     this.__r18182ErrorOutCount=this.__r18182ErrorOutCount||[0,0];this.__r18182ClearOutCount=this.__r18182ClearOutCount||[0,0];
     const errorAllowed=(passCandidate||gkCandidate)&&finite(this.t)-last>=6.8&&finite(this.__r18182ErrorOutCount[team])<2;
     const clearAllowed=clearCandidate&&finite(this.__r18182ClearOutCount[team])<1;
     if(errorAllowed||clearAllowed){
       if(clearAllowed)this.__r18182ClearOutCount[team]++;else{this.__r18182LastErrorOut=this.__r18182LastErrorOut||[-99,-99];this.__r18182LastErrorOut[team]=finite(this.t);this.__r18182ErrorOutCount[team]++;}
       const p=outPoint(hit.edge,hit.x,hit.y);t.x=p.x;t.y=p.y;m.r18182NaturalOut=true;m.executionError=false;m.gkBadDistribution=false;
       const source=clearAllowed?'clearance_pass':passCandidate?'execution_error_pass':'gk_distribution_error';armOut(this,source,hit.edge,actor,{x:ax,y:ay},p);
       if(clearAllowed)s.clearancePassOuts++;else if(passCandidate){s.executionErrorOuts++;s.executionErrorOutsByTeam[team]=(s.executionErrorOutsByTeam[team]||0)+1;}else s.gkErrorOuts++;
       log(this,clearAllowed?'clearance_pass_out':'execution_error_out',{source:clearAllowed?'clearance':passCandidate?'pass':'gk',by:actor.idx,team,residual:+residual.toFixed(2),length:+L.toFixed(2),pressure:+pressure.toFixed(2),danger:+danger.toFixed(2),edge:+trueEdge.toFixed(2)});
     }
   }
 }
 let arrive=onArrive,physicalReceiver=receiver;
 if(m.r18182NaturalOut){
   physicalReceiver=null;
   arrive=()=>{const b=this.ball||{};if(finite(b.x)<0||finite(b.x)>FL||finite(b.y)<0||finite(b.y)>FW)return this._ballOut();if(typeof onArrive==='function')return onArrive();};
 }
 return oldStartTravel18182.call(this,actor,t,kind,arrive,physicalReceiver,travelKind,m);
};

/* Domínio difícil junto à linha: só sai quando a recepção já chega orientada
   para fora e o toque ruim está ativo. */
const oldReceive=P._receive;
P._receive=function(m){const b=this.ball||{},snap={vx:finite(b.vx),vy:finite(b.vy),speed:finite(b.speed),passKind:b.passKind,kind:b.kind};const r=oldReceive.apply(this,arguments);try{
 if(m&&this.ball&&this.ball.owner===m&&finite(this.dead)<=.05&&!this.pendingRestart&&!this.waiting){const edge=Math.min(finite(m.y),FW-finite(m.y)),poor=(finite(m._poorTouchUntil)>finite(this.t))||finite(m.settle)>.72;const outward=m.y<FW/2?snap.vy<-.65:snap.vy>.65;const hard=snap.speed>17.5||snap.passKind==='launch'||snap.passKind==='through';const control=(attr(m,'controle')+attr(m,'tecnica'))/2;
   if(edge<4.35&&poor&&outward&&hard&&control<88){const side=m.y<FW/2?'touchline_top':'touchline_bottom',p=outPoint(side,finite(m.x)+(this.teams[m.team].attackDir||1)*1.3,finite(m.y));this.ball.owner=null;this.ball.lastTouch=m;armOut(this,'poor_touch',side,m,{x:finite(m.x),y:finite(m.y)},p);st(this).poorTouchOuts++;log(this,'poor_touch_out',{by:m.idx,team:m.team,edge:+edge.toFixed(2),speed:+snap.speed.toFixed(2),control:+control.toFixed(1)});this._deflectTo(p.x,p.y,6.9);}
 }
 }catch(_){}return r;};

/* Remove os dois atalhos antigos de escanteio aleatório. A partir daqui,
   failed cross sem toque defensivo é tiro de meta; desvio defensivo passa por
   _setCorner/_turnover acima e precisa cruzar fisicamente uma linha. */
const oldGoalKick=P._goalKickOrRestart;
P._goalKickOrRestart=function(team){if(this.__r122CrossWindow){this.__r122CrossWindow=null;st(this).randomCornerPathsSuppressed++;}return oldGoalKick.apply(this,arguments);};

/* Reposição defensiva do lateral. A maior frequência de laterais expôs um
   vazio antigo: o receptor podia receber antes de existir um pressionador e
   um cobridor definidos. Organizamos somente essas duas responsabilidades;
   os demais preservam a linha e continuam sob a R18.17.3. */
function organizeThrowDefense(sim,attTeam,x,boundary){
 const atk=sim.teams&&sim.teams[attTeam],def=sim.teams&&sim.teams[1-attTeam];if(!atk||!def)return null;
 const point={x:clamp(finite(x),1,FL-1),y:boundary<=FW/2?0:FW},field=t=>t.players.filter(p=>p&&!p.red&&!p.isGK);
 const ap=field(atk),dp=field(def);if(ap.length<2||dp.length<2)return null;
 const taker=ap.slice().sort((a,b)=>{const ad=(a._breaking&&a._breaking.throwInDuty)?-6:0,bd=(b._breaking&&b._breaking.throwInDuty)?-6:0;return dist(a,point)+ad-(dist(b,point)+bd);})[0];
 const receiver=ap.filter(p=>p!==taker).slice().sort((a,b)=>{const da=dist(a,point),db=dist(b,point),pa=da<3.5?5:da>20?(da-20)*1.4:0,pb=db<3.5?5:db>20?(db-20)*1.4:0;return da+pa-(db+pb);})[0];
 if(!receiver)return null;
 const presser=dp.slice().sort((a,b)=>dist(a,receiver)-dist(b,receiver))[0];
 const gx=Math.sign(finite(def.goal&&def.goal.x,def.attackDir>0?0:FL)-finite(receiver.x))||(-finite(def.attackDir,1));
 const coverPoint={x:clamp(finite(receiver.x)+gx*5.2,1,FL-1),y:clamp(finite(receiver.y)+(boundary===0?1:-1)*1.5,1,FW-1)};
 const cover=dp.filter(p=>p!==presser).slice().sort((a,b)=>dist(a,coverPoint)-dist(b,coverPoint))[0];
 const pressPoint={x:clamp(finite(receiver.x)+gx*1.9,1,FL-1),y:clamp(finite(receiver.y)+(boundary===0?1:-1)*.55,1,FW-1)};
 presser._tx=pressPoint.x;presser._ty=pressPoint.y;presser._react=Math.min(finite(presser._react,presser.react||.16),.055);
 if(cover){cover._tx=coverPoint.x;cover._ty=coverPoint.y;cover._react=Math.min(finite(cover._react,cover.react||.16),.065);}
 const q={attTeam,defTeam:1-attTeam,taker,receiver,presser,cover,created:finite(sim.t),liveUntil:0};sim.__r18182ThrowShape=q;const s=st(sim);s.throwInShapes++;s.throwInPressureAssignments++;if(cover)s.throwInCoverAssignments++;
 log(sim,'throw_in_shape',{attTeam,receiver:receiver.idx,presser:presser.idx,cover:cover&&cover.idx,x:+point.x.toFixed(2),boundary});return q;
}
const oldSelectPresser182=P._selectPresser;
P._selectPresser=function(tm,b){const q=this.__r18182ThrowShape,now=finite(this.t);if(q&&q.liveUntil>now&&this.teams&&tm===this.teams[q.defTeam]&&b&&b.owner===q.receiver&&q.presser&&!q.presser.red){tm._presser=q.presser;return q.presser;}return oldSelectPresser182.apply(this,arguments);};
const oldAssignRoles182=P._assignDefRoles;
P._assignDefRoles=function(tm,b,presser){const r=oldAssignRoles182.apply(this,arguments),q=this.__r18182ThrowShape,now=finite(this.t);if(q&&q.liveUntil>now&&this.teams&&tm===this.teams[q.defTeam]&&b&&b.owner===q.receiver){if(q.presser&&!q.presser.red){tm._presser=q.presser;q.presser._r18173Duty='press';q.presser._markRef=null;}if(q.cover&&!q.cover.red){tm._cover=q.cover;q.cover._r18173Duty='cover';q.cover._markRef=null;}}return r;};

const oldBallOut=P._ballOut;
P._ballOut=function(){const b=this.ball||{},tag=b.__r18182NaturalOut||null,last=teamOf(b.lastTouch),x=finite(b.x),isEnd=x<=0||x>=FL;
 if(tag){if(!isEnd)st(this).naturalThrowIns++;else{const lineX=x>=FL?FL:0,att=this.teams&&this.teams[0]&&this.teams[0].oppGoal&&this.teams[0].oppGoal.x===lineX?0:1;if(last!==att)st(this).naturalCorners++;else st(this).naturalGoalKicks++;}log(this,'out_resolved',{source:tag.source,edge:tag.edge,lastTeam:last,x:+x.toFixed(2),y:+finite(b.y).toFixed(2)});}
 const r=oldBallOut.apply(this,arguments);
 if(!isEnd&&this.pendingRestart&&(this.poss===0||this.poss===1)){const q=organizeThrowDefense(this,this.poss,clamp(x,1,FL-1),finite(b.y)<FW/2?0:FW),pr=this.pendingRestart;if(q){this.pendingRestart=()=>{const rr=pr();q.liveUntil=finite(this.t)+3.2;return rr;};}}
 if(this.ball)this.ball.__r18182NaturalOut=null;return r;};

const oldStep18182=P.step;
P.step=function(){const r=oldStep18182.apply(this,arguments),b=this.ball||{},tag=b.__r18182NaturalOut;if(tag&&((b.owner&&inside(b))||finite(this.t)-finite(tag.at)>5.25)){log(this,'out_marker_cancelled',{source:tag.source,reason:b.owner?'controlled':'expired',age:+(finite(this.t)-finite(tag.at)).toFixed(2)});b.__r18182NaturalOut=null;st(this).preventedUnsafe++;}const q=this.__r18182ThrowShape;if(q&&q.liveUntil>0&&finite(this.t)>q.liveUntil)this.__r18182ThrowShape=null;return r;};

P.getR18182Audit=function(){const s=st(this),r13=this.getR13Audit?this.getR13Audit():null,throwIns=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.throwIns),0),corners=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.corners),0),goalKicks=(this.stats||[]).reduce((n,x)=>n+finite(x&&x.goalKicks),0);
 return Object.assign({},s,{match:{throwIns,corners,goalKicks},rates:{naturalRestartShare:(throwIns+corners+goalKicks)?(s.naturalThrowIns+s.naturalCorners+s.naturalGoalKicks)/(throwIns+corners+goalKicks):0,duelOutRate:s.duelContexts?s.duelOuts/s.duelContexts:0},structural:this.getR12Audit?this.getR12Audit().status:null,observer:r13&&r13.status,gates:r13&&r13.gates});};
const oldFull=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldFull?oldFull.apply(this,arguments):{};r.duelsNaturalRestarts=this.getR18182Audit();return r;};
root.CDS_R18182=Object.freeze({version:V,baseline:'R18.18.1',feature:'DUELS_AND_NATURAL_RESTARTS',restartLottery:false,lastTouchAuthoritative:true,physicalBlockDeflections:true,deliberateClearances:true,poorTouchOuts:true,rngConsumption:false,xgBonus:false,speedBonus:false});
try{root.CDS_BUILD_ID='R18.18.2';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.18.2';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);