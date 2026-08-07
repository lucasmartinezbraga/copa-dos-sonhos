
/* R18.9 — inteligência sem bola conservadora: desempate do corredor de transição. */
(function(root){'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype,V='5.9.6-R18.9';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const attr=(p,k,f=65)=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];const x=root.getAttr&&root.getAttr(q,k);if(Number.isFinite(x))return x;}catch(_){}return f;};
const offBallIQ=p=>attr(p,'posicionamento')*.28+attr(p,'antecipacao')*.22+attr(p,'decisao')*.18+attr(p,'trabalho_equipe')*.12+attr(p,'aceleracao')*.10+attr(p,'ritmo')*.06+attr(p,'resistencia')*.04;
const pace=p=>attr(p,'ritmo',p&&p.ref&&p.ref.a8?Number(p.ref.a8[3])||70:70);
const line=p=>{const s=p&&p.slotPos;if(!p||p.isGK||s==='GK')return'GK';if(['CB','LB','RB','LWB','RWB'].includes(s))return'DEF';if(['CDM','CM','CAM','LM','RM'].includes(s))return'MID';return'FWD';};
const stats=sim=>sim.__r189Stats||(sim.__r189Stats={runnerChecks:0,runnerEligible:0,runnerSwitches:0});
const oldMove=P._movePlayers;
if(oldMove)P._movePlayers=function(){
  const out=oldMove.apply(this,arguments);
  for(const tm of this.teams||[]){
    const base=tm&&tm._r13Runner;if(!base||base.red||base.isGK)continue;
    const s=stats(this);s.runnerChecks++;
    const basePace=pace(base),baseIQ=offBallIQ(base);
    let best=base,bestIQ=baseIQ,bestPace=basePace;
    for(const p of tm.players||[]){
      if(!p||p===base||p.red||p.isGK||!(line(p)==='FWD'||p.slotPos==='CAM'))continue;
      const pp=pace(p),iq=offBallIQ(p);
      if(pp<basePace-.75||iq<baseIQ+14)continue;
      s.runnerEligible++;
      if(iq>bestIQ+.01||(Math.abs(iq-bestIQ)<.01&&pp>bestPace)){best=p;bestIQ=iq;bestPace=pp;}
    }
    if(best!==base){
      tm._r13Runner=best;s.runnerSwitches++;
      tm._r189RunnerMeta={from:base.idx,to:best.idx,basePace,candidatePace:bestPace,baseIQ,candidateIQ:bestIQ,paceGap:bestPace-basePace,iqGain:bestIQ-baseIQ,time:Number(this.t)||0};
    }
  }
  return out;
};
P.getOffBallIntelligenceProfile=function(p){const iq=offBallIQ(p);return{version:V,offBallIQ:iq,pace:pace(p),quality:clamp((iq-50)/45,0,1),formula:{posicionamento:.28,antecipacao:.22,decisao:.18,trabalho_equipe:.12,aceleracao:.10,ritmo:.06,resistencia:.04},transitionRunnerTiebreak:{maxPaceDeficit:.75,minIQAdvantage:14}};};
const oldAudit=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldAudit?oldAudit.apply(this,arguments):{},s=stats(this);r.version=V;r.offBallIntelligence={version:V,stats:Object.assign({},s),rates:{eligible:s.runnerChecks?s.runnerEligible/s.runnerChecks:0,switches:s.runnerChecks?s.runnerSwitches/s.runnerChecks:0},transitionRunnerTiebreak:{maxPaceDeficit:.75,minIQAdvantage:14},formula:{posicionamento:.28,antecipacao:.22,decisao:.18,trabalho_equipe:.12,aceleracao:.10,ritmo:.06,resistencia:.04}};return r;};
root.CDS_R189=Object.freeze({version:V,offBallIQ,pace,transitionRunnerTiebreak:true,maxPaceDeficit:.75,minIQAdvantage:14});
try{root.CDS_BUILD_ID='R18.9';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.9';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
