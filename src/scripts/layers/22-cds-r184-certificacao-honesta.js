
/* Copa dos Sonhos · R18.4 · CERTIFICAÇÃO HONESTA + LIFECYCLE DE CONTRATOS
   Correção pós-banca: contratos são reconstruídos após substituição/troca de
   forma, e o status agregado nunca volta a declarar verde quando o observador
   de futebol reprova gates. Não consome RNG nem altera decisão/física. */
(function installR184(root){
  'use strict';
  const M=root&&root.MatchSim;
  if(!M||!M.prototype||M.prototype.__CDS_R184__)return;
  const P=M.prototype;
  P.__CDS_R184__=true;
  const VERSION='5.9.4-R18.4';
  const FL=105,FW=68;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,d=0)=>Number.isFinite(v)?v:d;
  const LINE_OF={GK:'GK',CB:'DEF',LB:'DEF',RB:'DEF',LWB:'DEF',RWB:'DEF',CDM:'MID',DM:'MID',CM:'MID',CAM:'MID',LM:'MID',RM:'MID',LW:'FWD',RW:'FWD',CF:'FWD',ST:'FWD'};
  const ZONE={GK:{rx:9,ry:7},DEF:{rx:11,ry:8.5},MID:{rx:15,ry:12},FWD:{rx:19,ry:15}};
  const WIDE_LEFT=new Set(['LB','LWB','LM','LW']);
  const WIDE_RIGHT=new Set(['RB','RWB','RM','RW']);
  const ADJ={GK:['DEF'],DEF:['MID','GK'],MID:['DEF','FWD'],FWD:['MID']};
  const ownProg=(side,x)=>clamp((side===0?finite(x):FL-finite(x))/FL,0,1);
  function pid(p,side){return `${side}:${p.idx}:${p.ipPos||p.slotPos||'CM'}`;}
  function makeContract(p,side){
    const slot=String(p.ipPos||p.slotPos||(p.ref&&(p.ref.slot||p.ref.pos))||'CM');
    const line=LINE_OF[slot]||'MID',z=ZONE[line]||ZONE.MID;
    const dhx=finite(p.dhx,p.hx),dhy=finite(p.dhy,p.hy),ahx=finite(p.ahx,p.hx),ahy=finite(p.ahy,p.hy);
    return {version:VERSION,id:pid(p,side),idx:p.idx,team:side,slot,line,
      homeZone:{defend:{x:dhx,y:dhy,rx:z.rx,ry:z.ry},attack:{x:ahx,y:ahy,rx:z.rx,ry:z.ry}},
      corridor:null,corridorAttack:null,side:dhy<FW/2-6?-1:dhy>FW/2+6?1:0,
      height:ownProg(side,dhx),heightAttack:ownProg(side,ahx),width:clamp(Math.abs(dhy-FW/2)/(FW/2),0,1),
      onBall:p.ipRole||p.role||null,offBall:p.oopRole||null,focus:p.focus||'bal',
      inTransitionA:line==='DEF'?'hold':line==='MID'?'support':'break',
      inTransitionD:line==='FWD'?'delay':'recover',coverFor:[],coveredBy:[],
      markPriority:line==='DEF'?.85:line==='MID'?.55:line==='FWD'?.2:0,
      minHoldSeconds:line==='DEF'?1.8:line==='MID'?1.4:line==='FWD'?.9:0,
      switchCost:line==='DEF'?4.5:line==='MID'?3:line==='FWD'?1.5:0,
      riskTolerance:line==='DEF'?.25:line==='MID'?.5:line==='FWD'?.75:.1,
      preferredActions:[],forbiddenActions:[]};
  }
  function structure(players){
    const byLine=Object.create(null);
    for(const p of players){if(!p.contract)continue;(byLine[p.contract.line]||(byLine[p.contract.line]=[])).push(p);}
    for(const line of Object.keys(byLine)){
      const row=byLine[line];
      const central=[];
      for(const p of row){const s=p.contract.slot;if(WIDE_LEFT.has(s))p.contract.corridor='L';else if(WIDE_RIGHT.has(s))p.contract.corridor='R';else central.push(p);}
      central.sort((a,b)=>a.contract.homeZone.defend.y-b.contract.homeZone.defend.y);
      central.forEach((p,i)=>{p.contract.corridor=central.length===1?'C':i===0?'CL':i===central.length-1?'CR':'C';});
      for(const p of row){const d=p.contract.homeZone.defend.y,a=p.contract.homeZone.attack.y;p.contract.corridorAttack=Math.abs(a-d)<4?p.contract.corridor:['L','CL','C','CR','R'][clamp(Math.floor(a/FW*5),0,4)];}
      const ordered=row.slice().sort((a,b)=>a.contract.homeZone.defend.y-b.contract.homeZone.defend.y);
      ordered.forEach((p,i)=>{if(i>0){p.contract.coverFor.push(ordered[i-1].contract.id);p.contract.coveredBy.push(ordered[i-1].contract.id);}if(i<ordered.length-1){p.contract.coverFor.push(ordered[i+1].contract.id);p.contract.coveredBy.push(ordered[i+1].contract.id);}});
    }
    for(const p of players){const c=p.contract;if(!c||c.line==='GK'||c.coverFor.length)continue;let best=null,bd=Infinity;for(const ln of ADJ[c.line]||[])for(const q of byLine[ln]||[]){const d=Math.abs(q.contract.homeZone.defend.y-c.homeZone.defend.y);if(d<bd){bd=d;best=q;}}if(best){c.coverFor.push(best.contract.id);c.coveredBy.push(best.contract.id);}}
  }
  function rebuild(tm){
    if(!tm||!Array.isArray(tm.players))return {players:0,contracts:0,stale:0};
    const side=tm.side===1?1:0;
    for(const p of tm.players){const c=makeContract(p,side);try{Object.defineProperty(p,'contract',{value:c,enumerable:false,writable:true,configurable:true});}catch(_){p.contract=c;}}
    structure(tm.players);
    const result={version:VERSION,players:tm.players.length,contracts:tm.players.filter(p=>!!p.contract).length,stale:tm.players.filter(p=>p.contract&&p.contract.slot!==(p.ipPos||p.slotPos)).length};
    try{Object.defineProperty(tm,'__contractAudit',{value:result,enumerable:false,writable:true,configurable:true});}catch(_){tm.__contractAudit=result;}
    return result;
  }
  P.rebuildRoleContracts=function(team){const tm=typeof team==='number'?this.teams&&this.teams[team]:team;return rebuild(tm);};
  const oldSub=P.substitute;
  P.substitute=function(team,outIdx,inPlayer){const ok=oldSub.apply(this,arguments);if(ok)rebuild(this.teams&&this.teams[team]);return ok;};
  const oldShapes=P.setShapes;
  P.setShapes=function(team,defKey,defVar,atkKey,atkVar){const ok=oldShapes.apply(this,arguments);if(ok!==false)rebuild(this.teams&&this.teams[team]);return ok;};
  const oldFull=P.getFullFootballAudit;
  P.getFullFootballAudit=function(){
    const r=oldFull?oldFull.apply(this,arguments):{};
    const observer=r.observedFootball||(this.getR13Audit?this.getR13Audit():null);
    const audits=(this.teams||[]).map(rebuild);
    const contractsPass=audits.length>0&&audits.every(a=>a.players===a.contracts&&a.stale===0);
    const canonicalPass=!r.canonical||r.canonical.status==='CONSISTENT';
    const observerPass=!observer||observer.status==='FOOTBALL_OBSERVER_PASS';
    r.version=VERSION;r.contracts={status:contractsPass?'PASS':'REVIEW',team:audits};
    r.status=canonicalPass&&observerPass&&contractsPass?'CONSISTENT':'REVIEW';
    return r;
  };
  try{root.CDS_BUILD_ID='R18.4';root.CDS_VERSION=VERSION;document.title='Copa dos Sonhos — R18.4';}catch(_){ }
  root.CDS_R184=Object.freeze({version:VERSION,contractLifecycle:true,honestAggregator:true});
})(typeof window!=='undefined'?window:globalThis);

