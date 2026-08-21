
/* R18.18 · PROGRESSÃO OFENSIVA E CRIAÇÃO DE CHANCES
   --------------------------------------------------------------------------
   Objetivo: aumentar a quantidade de ataques que chegam a uma finalização boa
   sem reabrir chutes remotos. A camada não altera a física de passe/chute, não
   concede velocidade, xG ou sucesso artificial e não consome RNG adicional na
   escolha. Ela organiza cinco comportamentos contextuais:
   1) condução progressiva quando existe corredor real à frente;
   2) passe-e-movimento com devolução física (tabela);
   3) terceiro homem quando a devolução é fechada;
   4) cutback preferido a cruzamento alto sem alvo;
   5) continuidade organizada após bloqueio, defesa/rebote ou corte.
*/
(function(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;
const P=M.prototype;if(P.__r1818Progression)return;P.__r1818Progression=true;
const V='5.12.4-R18.18',FL=Number(root.FL)||105,FW=Number(root.FW)||68,CY=FW/2;
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>a&&b?Math.hypot(finite(a.x)-finite(b.x),finite(a.y)-finite(b.y)):999;
const attr=(p,k,f=65)=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];const x=root.getAttr&&root.getAttr(q,k);if(Number.isFinite(x))return x;}catch(_){}return f;};
const line=p=>{const s=p&&p.slotPos;if(!p||p.isGK||s==='GK')return'GK';if(['CB','LB','RB','LWB','RWB'].includes(s))return'DEF';if(['CDM','CM','CAM','LM','RM'].includes(s))return'MID';return'FWD';};
const prog=(tm,x)=>tm.attackDir>0?finite(x):FL-finite(x);
const unprog=(tm,x)=>tm.attackDir>0?x:FL-x;
function fresh(){return{version:V,decisionChecks:0,progressiveCarries:0,carryMetersPlanned:0,comboPlans:0,comboFirstReceives:0,comboReturns:0,comboThirdMan:0,comboExpired:0,cutbacksChosen:0,secondPhaseWindows:0,secondPhaseActions:0,finalThirdReceives:0,boxReceives:0,giveGoTargetFrames:0,events:[]};}
function stats(sim){return sim.__r1818||(sim.__r1818=fresh());}
function log(sim,type,data){const s=stats(sim),e=Object.assign({type,time:+finite(sim.t).toFixed(3),minute:+finite(sim.minute).toFixed(2)},data||{});s.events.push(e);if(s.events.length>240)s.events.splice(0,s.events.length-240);}
function nearestOpponent(sim,o){let d=99,p=null;for(const q of sim.teams[1-o.team].players||[]){if(!q||q.red)continue;const z=dist(o,q);if(z<d){d=z;p=q;}}return{p,dist:d};}
function lane(sim,o,len=13,width=4.2){const tm=sim.teams[o.team],dir=tm.attackDir;let blockers=0,closest=99;for(const d of sim.teams[1-o.team].players||[]){if(!d||d.red||d.isGK)continue;const fx=(finite(d.x)-finite(o.x))*dir,fy=Math.abs(finite(d.y)-finite(o.y));if(fx>0&&fx<len&&fy<width+fx*.18){blockers++;closest=Math.min(closest,dist(o,d));}}const quality=clamp(1-blockers*.43+(closest>8?.12:closest>5?.05:0),0,1);return{blockers,closest,quality};}
function passCandidate(sim,o,m,tag){if(!m||m.red||m.isGK||m.team!==o.team)return null;const tm=sim.teams[o.team],dir=tm.attackDir,d=dist(o,m),pm=(finite(m.x)-finite(o.x))*dir;if(d<3.5||d>27)return null;const opps=sim.teams[1-o.team].players.filter(q=>q&&!q.red);if(sim._laneBlocked&&sim._laneBlocked(o,m,opps))return null;let mk=99;for(const q of opps)mk=Math.min(mk,dist(m,q));const risk=clamp(1.55-mk*.11+d*.025,0.25,2.35);return{m,dist:d,progressM:pm,risk,intoBox:dist(m,tm.oppGoal)<24,score:1.55+clamp(pm/14,-.25,.95)+clamp(mk/15,0,.6),soonGain:0,paceEdge:0,lineVuln:0,throughThreat:0,roleSynergy:.35,__r1818Tag:tag,__r1818NoPlan:true};}
function cutbackCandidate(sim,o){const tm=sim.teams[o.team],opps=sim.teams[1-o.team].players.filter(q=>q&&!q.red),op=prog(tm,o.x);if(op<79||Math.abs(finite(o.y)-CY)<15)return null;let best=null,bestScore=-1e9;for(const m of tm.players||[]){if(!m||m===o||m.red||m.isGK)continue;const mp=prog(tm,m.x),d=dist(o,m);if(d<5||d>29||mp<72||mp>94||Math.abs(finite(m.y)-CY)>13)continue;if(sim._laneBlocked&&sim._laneBlocked(o,m,opps))continue;let mk=99;for(const q of opps)mk=Math.min(mk,dist(m,q));const backwards=op-mp;const score=mk*.16-Math.abs(mp-86)*.08-Math.abs(finite(m.y)-CY)*.045-d*.025+(backwards>1&&backwards<14?.65:0)+(line(m)==='MID'?.25:0);if(score>bestScore){bestScore=score;best=passCandidate(sim,o,m,'cutback');}}
if(best){best.intoBox=true;best.risk=clamp(best.risk-.30,.18,1.55);best.score=Math.max(best.score,2.25+bestScore*.12);}return best;}
function clearCombo(tm,reason,sim){const p=tm&&tm._r1818Combo;if(!p)return;if(reason==='expired')stats(sim).comboExpired++;if(p.passer)p.passer._r1818GiveGoUntil=0;tm._r1818Combo=null;}
const oldReset=P.reset;
P.reset=function(){const r=oldReset.apply(this,arguments);this.__r1818=fresh();for(const tm of this.teams||[]){tm._r1818Combo=null;tm._r1818SecondPhaseUntil=0;}return r;};

/* Primeiro passe da tabela. O plano só nasce em zona útil, com distância curta
   e inteligência coletiva suficiente. A execução do passe permanece original. */
const oldPass=P._pass;
P._pass=function(o,best){
  try{
    if(o&&best&&best.m&&!best.__r1818NoPlan&&!best.__r1818Tag&&!o.isGK&&this.ball&&this.ball.owner===o){
      const tm=this.teams[o.team],now=finite(this.t),op=prog(tm,o.x),d=finite(best.dist,dist(o,best.m));
      const iq=attr(o,'decisao')*.38+attr(o,'trabalho_equipe')*.31+attr(o,'primeiro_toque')*.18+attr(o,'visao')*.13;
      const near=nearestOpponent(this,o).dist;
      const active=tm._r1818Combo&&tm._r1818Combo.until>now;
      if(!active&&now>=finite(o._r1818ComboCdUntil)&&op>43&&op<88&&d>=5&&d<=20&&finite(best.progressM)>-.5&&finite(best.progressM)<13&&!best.intoBox&&iq>=69&&near>2.7){
        tm._r1818Combo={passer:o,receiver:best.m,third:tm._thirdMan||null,until:now+3.35,state:'flight',startProg:op,side:finite(o.y)<CY?-1:1};
        o._r1818GiveGoUntil=now+3.35;o._r1818ComboCdUntil=now+6.0;o._burst={t:3.0,kind:'tabela'};
        stats(this).comboPlans++;log(this,'combo_plan',{by:o.idx,to:best.m.idx,iq:+iq.toFixed(1),progress:+finite(best.progressM).toFixed(2)});
      }
    }
  }catch(_){}
  return oldPass.apply(this,arguments);
};

const oldReceive=P._receive;
P._receive=function(m){const r=oldReceive.apply(this,arguments);try{const tm=m&&this.teams[m.team],pl=tm&&tm._r1818Combo;if(pl&&pl.until>finite(this.t)&&pl.receiver===m&&this.ball&&this.ball.owner===m){pl.state='received';stats(this).comboFirstReceives++;log(this,'combo_receive',{receiver:m.idx,passer:pl.passer&&pl.passer.idx});}if(m&&this.ball&&this.ball.owner===m){const mp=prog(this.teams[m.team],m.x);if(mp>=FL*.62)stats(this).finalThirdReceives++;if(dist(m,this.teams[m.team].oppGoal)<24)stats(this).boxReceives++;}}catch(_){}return r;};

/* O passador ataca o espaço depois de soltar. Não recebe velocidade extra: só
   muda seu alvo tático e continua usando o integrador físico normal. */
const oldAttackTarget=P._attackTarget;
P._attackTarget=function(tm,p,b){const base=oldAttackTarget.apply(this,arguments);try{const pl=tm&&tm._r1818Combo,now=finite(this.t);if(pl&&pl.until>now&&pl.passer===p&&b&&b.owner===pl.receiver&&!p.red){const pp=prog(tm,p.x),bp=prog(tm,b.x),off=typeof this._offsideLine==='function'?finite(this._offsideLine(tm.side),FL-2):FL-2;let targetP=clamp(Math.max(pp+6.2,bp+5.0),pp,Math.min(FL-3,off-.35));const laneY=clamp(finite(pl.receiver.y)+pl.side*7.5,5,FW-5);stats(this).giveGoTargetFrames++;return[unprog(tm,targetP),laneY];}}catch(_){}return base;};

/* Eventos que deixam a bola viva no terço ofensivo criam uma janela curta de
   segunda fase. Ela não entrega posse: apenas impede que o ataque volte para a
   circulação passiva quando recuperar fisicamente a sobra. */
const oldEmit=P._emit;
P._emit=function(type,data){try{let atk=-1;if(type==='blocked'||type==='header_clear'){const by=data&&data.by;if(by&&Number.isFinite(by.team))atk=1-by.team;}else if(type==='save'){const gk=data&&(data.gk||data.by);if(gk&&Number.isFinite(gk.team))atk=1-gk.team;}else if(type==='post'){const by=data&&data.by;if(by&&Number.isFinite(by.team))atk=by.team;}if(atk===0||atk===1){const tm=this.teams[atk];tm._r1818SecondPhaseUntil=finite(this.t)+2.65;stats(this).secondPhaseWindows++;log(this,'second_phase',{team:atk,source:type});}if(['goal','offside','foul','penalty','kickoff'].includes(type)){for(const tm of this.teams||[])clearCombo(tm,'terminal',this);}}catch(_){}return oldEmit.apply(this,arguments);};

const oldDecide=P._decide;
P._decide=function(o){
  if(!o||o.isGK||!this.ball||this.ball.owner!==o||finite(this.dead)>.04||this.pendingRestart||this.waiting)return oldDecide.apply(this,arguments);
  const tm=this.teams[o.team],now=finite(this.t),s=stats(this),g=tm.oppGoal,op=prog(tm,o.x),dtg=dist(o,g),near=nearestOpponent(this,o),ln=lane(this,o,14,4.2);s.decisionChecks++;
  if(tm._r1818Combo&&tm._r1818Combo.until<=now)clearCombo(tm,'expired',this);

  /* Devolução da tabela ou terceiro homem. Um único passe é forçado somente se
     a linha está limpa e a opção realmente progride; caso contrário o motor
     normal decide. */
  const pl=tm._r1818Combo;
  if(pl&&pl.state==='received'&&pl.receiver===o){
    const ret=passCandidate(this,o,pl.passer,'one_two_return');
    if(ret&&ret.progressM>2&&ret.risk<1.85){s.comboReturns++;log(this,'combo_return',{by:o.idx,to:pl.passer.idx,progress:+ret.progressM.toFixed(2)});clearCombo(tm,'completed',this);this._pass(o,ret);return;}
    const third=passCandidate(this,o,(pl.third&&!pl.third.red?pl.third:tm._thirdMan),'third_man');
    if(third&&third.progressM>3.5&&third.risk<1.95){s.comboThirdMan++;log(this,'third_man',{by:o.idx,to:third.m.idx,progress:+third.progressM.toFixed(2)});clearCombo(tm,'third_man',this);this._pass(o,third);return;}
  }

  /* Na linha de fundo, passe rasteiro para trás ganha do cruzamento alto quando
     existe receptor central livre. */
  if(op>79&&Math.abs(finite(o.y)-CY)>15&&near.dist>2.2){const cb=cutbackCandidate(this,o);if(cb){s.cutbacksChosen++;log(this,'cutback',{by:o.idx,to:cb.m.idx,risk:+cb.risk.toFixed(2)});this._pass(o,cb);return;}}

  let best=null;try{best=this._bestPass&&this._bestPass(o);}catch(_){}
  const strongPass=best&&((best.intoBox&&finite(best.risk)<2.0)||(finite(best.progressM)>8&&finite(best.score)>1.55));

  /* Segunda fase: recuperar uma sobra no terço final deve gerar nova ação de
     ataque, não reset automático de posse. */
  if(finite(tm._r1818SecondPhaseUntil)>now&&op>61&&near.dist>2.45){
    if(best&&finite(best.progressM)>2&&finite(best.risk)<2.15){s.secondPhaseActions++;tm._r1818SecondPhaseUntil=0;this._pass(o,best);return;}
    if(ln.blockers===0&&dtg>12){s.secondPhaseActions++;tm._r1818SecondPhaseUntil=0;o._r1818CarryCdUntil=now+1.0;this._carry(o,g);return;}
  }

  /* Condução progressiva comum: o atleta avança quando há corredor físico e a
     melhor opção de passe não cria vantagem equivalente. Isso é separado da
     R18.17.2, que conduz apenas para melhorar um chute distante. */
  const roleOK=!['CB','GK'].includes(o.slotPos)&&(o.slotPos!=='CDM'||op>53);
  const carryIQ=(attr(o,'drible')*.32+attr(o,'aceleracao')*.23+attr(o,'decisao')*.25+attr(o,'tecnica',attr(o,'conducao'))*.20);
  const passWeak=!strongPass&&(!best||finite(best.progressM)<6.5||finite(best.score)<1.35);
  const zoneOK=op>41&&op<88&&dtg>14&&dtg<49;
  if(roleOK&&zoneOK&&passWeak&&near.dist>4.0&&ln.blockers===0&&ln.quality>=.70&&carryIQ>=64&&now>=finite(o._r1818CarryCdUntil)){
    const meters=clamp(4.6+ln.quality*3.2+(carryIQ-65)*.045,4.8,9.0);
    o._r1818CarryCdUntil=now+1.15;s.progressiveCarries++;s.carryMetersPlanned+=meters;
    log(this,'progressive_carry',{by:o.idx,prog:+op.toFixed(2),dtg:+dtg.toFixed(2),meters:+meters.toFixed(2),iq:+carryIQ.toFixed(1)});
    this._carry(o,g);return;
  }
  return oldDecide.apply(this,arguments);
};

P.getR1818Audit=function(){const s=stats(this),base=this.getR13Audit?this.getR13Audit():null,totalShots=(this.stats||[]).reduce((a,x)=>a+finite(x&&x.shots),0),totalXg=(this.stats||[]).reduce((a,x)=>a+finite(x&&x.xg),0),totalKey=(this.stats||[]).reduce((a,x)=>a+finite(x&&x.keyPasses),0);return Object.assign({},s,{rates:{comboCompletion:s.comboPlans?s.comboReturns/s.comboPlans:0,comboCreation:s.comboPlans?s.comboFirstReceives/s.comboPlans:0,thirdManShare:s.comboPlans?s.comboThirdMan/s.comboPlans:0,averageCarryMeters:s.progressiveCarries?s.carryMetersPlanned/s.progressiveCarries:0},match:{shots:totalShots,xg:totalXg,keyPasses:totalKey},structural:this.getR12Audit?this.getR12Audit().status:null,observer:base&&base.status,gates:base&&base.gates});};
const oldFull=P.getFullFootballAudit;
P.getFullFootballAudit=function(){const r=oldFull?oldFull.apply(this,arguments):{};r.offensiveProgression=this.getR1818Audit();return r;};
root.CDS_R1818=Object.freeze({version:V,baseline:'R18.17.3.2',feature:'OFFENSIVE_PROGRESSION_AND_CHANCE_CREATION',progressiveCarry:true,oneTwo:true,thirdMan:true,cutback:true,secondPhase:true,rngConsumption:false,physicsOverride:false,xgBonus:false,speedBonus:false});
try{root.CDS_BUILD_ID='R18.18';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.18';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
