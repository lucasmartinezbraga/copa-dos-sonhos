
/* Copa dos Sonhos · R18.7 · ATRIBUTOS VIVOS — PERCEPÇÃO E MARCAÇÃO
   Primeira reconstrução transversal: atributos deixam de atuar somente no
   resultado do duelo e passam a influenciar quem percebe, escolhe, acompanha
   e transfere uma ameaça. Mantém a estrutura coletiva validada da R18.5. */
(function installR187(root){
  'use strict';
  const M=root&&root.MatchSim;
  if(!M||!M.prototype||M.prototype.__CDS_R187__)return;
  const P=M.prototype;
  P.__CDS_R187__=true;
  const VERSION='5.9.4-R18.7';
  const CFG=Object.assign({assignment:true,reaction:false,recovery:false,perception:true},root.CDS_R187_CONFIG||{});
  const FL=105,FW=68;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const finite=(v,d=0)=>Number.isFinite(v)?v:d;
  const dist=(a,b)=>a&&b?Math.hypot(finite(a.x)-finite(b.x),finite(a.y)-finite(b.y)):999;
  const attr=(p,k)=>{
    try{
      const q=p&&p.ref?p.ref:p;
      if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];
      return finite(root.getAttr(q,k),50);
    }catch(_){return 50;}
  };
  function lineOf(p){
    const pos=p&&(p.oopPos||p.slotPos);
    if(!p||p.isGK||pos==='GK')return'GK';
    if(['CB','LB','RB','LWB','RWB'].includes(pos))return'DEF';
    if(['CDM','DM','CM','CAM','LM','RM'].includes(pos))return'MID';
    return'FWD';
  }
  function ownProg(tm,x){return tm&&tm.goal&&tm.goal.x<FL/2?finite(x):FL-finite(x);}
  function fromProg(tm,x){return tm&&tm.goal&&tm.goal.x<FL/2?x:FL-x;}
  function markerIQ(p){
    return attr(p,'marcacao')*.29+attr(p,'posicionamento')*.22+attr(p,'antecipacao')*.18+
      attr(p,'decisao')*.12+attr(p,'trabalho_equipe')*.09+attr(p,'concentracao')*.06+
      ((attr(p,'ritmo')+attr(p,'aceleracao'))*.5)*.04;
  }
  function passIQ(p){
    return attr(p,'visao')*.42+attr(p,'decisao')*.27+attr(p,'passe')*.17+
      attr(p,'compostura')*.08+attr(p,'trabalho_equipe')*.06;
  }
  function norm(v){return clamp((v-48)/47,0,1);}
  function droot(sim){
    if(sim.__r187)return sim.__r187;
    const mk=()=>({roleCycles:0,assignments:0,attributeReassignments:0,switches:0,delayedReads:0,markSamples:0,markDistance:0,
      markerIQ:0,passReads:0,complexReads:0,perceptionFallbacks:0,progressiveReads:0});
    sim.__r187={version:VERSION,teams:[mk(),mk()]};
    return sim.__r187;
  }
  function threatValue(tm,a,b){
    const depth=ownProg(tm,a.x);
    const central=1-clamp(Math.abs(a.y-FW/2)/(FW/2),0,1);
    return Math.max(0,48-depth)*.18+(a===b.owner?3.2:0)+(a._breaking?4.8:0)+(a._runDeep?3.5:0)+central*1.2+
      attr(a,'movimentacao')/100*.8;
  }
  function markCost(tm,p,a,previous,dangerSet){
    const iq=markerIQ(p),q=norm(iq),L=lineOf(p);
    const d=dist(p,a);
    const homeY=finite(p.dhy,finite(p.hy,p.y));
    const lane=Math.abs(homeY-a.y)*.10;
    const depth=ownProg(tm,a.x);
    const linePenalty=L==='DEF'?Math.max(0,depth-39)*.13:Math.max(0,31-depth)*.16;
    const atkPace=(attr(a,'ritmo')+attr(a,'aceleracao'))*.5;
    const defPace=(attr(p,'ritmo')+attr(p,'aceleracao'))*.5;
    const recovery=Math.max(0,atkPace-defPace)*.055;
    const aerial=Math.max(0,(attr(a,'impulsao')+attr(a,'cabeceio'))*.5-(attr(p,'impulsao')+attr(p,'forca'))*.5)*.025;
    const quality=(72-iq)*.095; // 90 vale ~1,7 m a mais que 72; 60 custa ~1,1 m
    let continuity=0;
    if(previous===a) continuity-=1.15+attr(p,'concentracao')*.018+attr(p,'trabalho_equipe')*.010;
    else if(previous&&dangerSet.has(previous)) continuity+=lerp(2.3,.65,norm(attr(p,'decisao')*.6+attr(p,'trabalho_equipe')*.4));
    return d*.72+lane+linePenalty+recovery+aerial+quality+continuity;
  }

  /* Atribuição de referência orientada por capacidade. Distância continua
     importante, mas deixa de ser a única verdade: leitura, marcação, cobertura,
     compatibilidade de corredor e recuperação passam a decidir o pareamento. */
  const oldAssign=P._assignDefRoles;
  P._assignDefRoles=function(tm,b,presser){
    const previous=new Map();
    if(tm&&tm.players)for(const p of tm.players)previous.set(p,p._markRef||null);
    const r=oldAssign.apply(this,arguments);
    if(!tm||!this.teams||!tm.players)return r;
    const dg=droot(this).teams[tm.side];dg.roleCycles++;
    if(!CFG.assignment)return r;
    /* O motor-base continua decidindo QUANTAS ameaças merecem referência e
       quais estão no raio correto. Atributos entram apenas no desempate entre
       zagueiros que já são opções plausíveis, evitando perseguições novas. */
    const cbs=tm.players.filter(p=>!p.red&&!p.isGK&&p!==presser&&lineOf(p)==='DEF'&&
      (p.oopPos||p.slotPos)==='CB');
    const basePairs=[];
    for(const p of cbs)if(p._markRef&&!p._markRef.red)basePairs.push({p,a:p._markRef});
    const targets=[];
    for(const x of basePairs)if(!targets.includes(x.a))targets.push(x.a);
    if(!targets.length||cbs.length<targets.length)return r;
    const baseFor=new Map();
    for(const x of basePairs)if(!baseFor.has(x.a))baseFor.set(x.a,x.p);
    const pairCost=(p,a)=>{
      const base=baseFor.get(a),baseD=base?dist(base,a):999,dd=dist(p,a);
      if(dd>15.25||dd>baseD+.10)return Infinity;
      const iq=markerIQ(p);
      if(base&&p!==base&&iq<markerIQ(base)+12)return Infinity;
      const lane=Math.abs(finite(p.dhy,finite(p.hy,p.y))-a.y)*.055;
      const atkP=(attr(a,'ritmo')+attr(a,'aceleracao'))*.5;
      const defP=(attr(p,'ritmo')+attr(p,'aceleracao'))*.5;
      const pace=Math.max(0,atkP-defP)*.035;
      const aerial=Math.max(0,(attr(a,'impulsao')+attr(a,'cabeceio'))*.5-(attr(p,'impulsao')+attr(p,'forca'))*.5)*.018;
      const quality=(74-iq)*.075;
      const change=p===base?0:.15;
      return dd*.82+lane+pace+aerial+quality+change;
    };
    const baseCost=targets.reduce((sum,a)=>sum+pairCost(baseFor.get(a),a),0);
    const baseDistance=targets.reduce((sum,a)=>sum+dist(baseFor.get(a),a),0);
    let bestCost=baseCost,bestMap=null;
    const used=new Set(),cur=new Map();
    const walk=i=>{
      if(i>=targets.length){
        let total=0,totalDistance=0;for(const a of targets){total+=pairCost(cur.get(a),a);totalDistance+=dist(cur.get(a),a);}
        if(totalDistance<=baseDistance+.12&&total<bestCost){bestCost=total;bestMap=new Map(cur);}return;
      }
      const a=targets[i];
      for(const p of cbs){if(used.has(p))continue;const c=pairCost(p,a);if(!Number.isFinite(c))continue;
        used.add(p);cur.set(a,p);walk(i+1);cur.delete(a);used.delete(p);
      }
    };
    walk(0);
    if(bestMap&&baseCost-bestCost>.24){
      for(const p of cbs)if(targets.includes(p._markRef))p._markRef=null;
      for(const a of targets){
        const p=bestMap.get(a);if(!p)continue;p._markRef=a;p._r187MarkClass='attribute_tiebreak';p._r187AssignedAt=this.t;
        dg.assignments++;dg.markerIQ+=markerIQ(p);
        if(p!==baseFor.get(a))dg.attributeReassignments++;
        if(previous.get(p)&&previous.get(p)!==a)dg.switches++;
      }
    }else{
      for(const a of targets){const p=baseFor.get(a);if(p){dg.assignments++;dg.markerIQ+=markerIQ(p);}}
    }
    return r;
  };

  /* Leitura e distância individual. Um marcador fraco não vira inútil: ele
     continua obedecendo ao bloco, mas reconhece trocas mais tarde, mantém gap
     maior e apresenta pequeno erro de orientação. O elite fecha cedo e goal-side. */
  const oldDef=P._defendTarget;
  P._defendTarget=function(tm,p,b,presser){
    if(!CFG.reaction||!p||!tm)return oldDef.apply(this,arguments);
    const ref=p._markRef&&!p._markRef.red?p._markRef:null;
    const key=ref?`${ref.team}:${ref.idx}`:'';
    const iq=markerIQ(p),q=norm(iq);
    if(p._r187BaseReact==null)p._r187BaseReact=finite(p._react,finite(p.react,.16));
    p._react=ref?lerp(.285,.070,q):p._r187BaseReact;
    if(key!==String(p._r187MarkKey||'')){
      p._r187MarkKey=key;
      p._r187ReactUntil=ref?this.t+lerp(.18,.035,q):0;
      if(ref)droot(this).teams[p.team].delayedReads++;
    }
    const delayed=!!ref&&this.t<finite(p._r187ReactUntil,0);
    let out;
    if(delayed){
      const save=p._markRef;p._markRef=null;
      try{out=oldDef.apply(this,arguments);}finally{p._markRef=save;}
    }else out=oldDef.apply(this,arguments);
    if(!out||!ref||delayed)return out;
    const L=lineOf(p);if(L!=='DEF'&&L!=='MID')return out;
    const line=finite(tm._r13LineDepth,ownProg(tm,p.x));
    const ap=ownProg(tm,ref.x);
    const gap=lerp(1.55,.82,q);
    let tp=ap-gap;
    tp=L==='DEF'?clamp(tp,line-2.45,line+2.45):clamp(tp,line-1.8,line+(p===presser?15.2:10.8));
    const tick=Math.floor((this.t||0)/1.35);
    const readError=Math.sin(tick*1.71+p.idx*1.93+ref.idx*.77)*(1-q)*.65;
    const insideShade=(FW/2-ref.y)*(.025+.055*q);
    const ty=clamp(ref.y+insideShade+readError,2,FW-2);
    const sampleKey=Math.floor((this.t||0)*2);
    if(p._r187SampleKey!==sampleKey){
      p._r187SampleKey=sampleKey;
      const dg=droot(this).teams[p.team];dg.markSamples++;dg.markDistance+=dist(p,ref);
    }
    return[fromProg(tm,clamp(tp,1,FL-1)),ty];
  };

  /* A R18.5 ativava sprint de cobertura a 2,55 m para qualquer atleta. Aqui o
     limiar passa a ser cognitivo: o elite reconhece cedo; o fraco demora até o
     perigo ficar mais evidente. A velocidade máxima continua sendo a real. */
  const oldIntegrate=P._integrate;
  P._integrate=function(p,tx,ty,dt,freeze){
    if(!CFG.recovery)return oldIntegrate.apply(this,arguments);
    const ref=p&&p._markRef&&!p._markRef.red?p._markRef:null;
    if(!ref)return oldIntegrate.apply(this,arguments);
    const q=norm(markerIQ(p));
    const sprintAt=lerp(3.25,2.35,q);
    if(dist(p,ref)<=sprintAt){
      const save=p._markRef;p._markRef=null;
      try{return oldIntegrate.apply(this,arguments);}finally{p._markRef=save;}
    }
    return oldIntegrate.apply(this,arguments);
  };

  /* Percepção de passe como camada anterior à execução. O _bestPass original
     continua calculando o melhor passe real; esta camada determina se o atleta
     conseguiu enxergar uma opção complexa. A falha vira passe seguro, não erro
     artificial de direção. */
  function passPerceptionModel(o,best,phase){
    const iq=passIQ(o),q=norm(iq);
    const crossField=Math.abs(finite(best&&best.m&&best.m.y,o&&o.y)-finite(o&&o.y))>23?1:0;
    const complexity=clamp((finite(best&&best.dist,0)/58)*.30+(finite(best&&best.risk,0)/4.5)*.30+
      finite(best&&best.throughThreat,0)*.24+crossField*.09+(best&&best.intoBox?.08:0),0,1.35);
    const capacity=lerp(.66,1.08,q);
    const deficit=Math.max(0,complexity-capacity);
    const miss=complexity>.72?clamp(deficit*.38,0,.14):0;
    const ph=phase==null?(Math.sin(0)+1)/2:clamp(phase,0,1);
    return {iq,quality:q,complexity,capacity,miss,perceived:ph>=miss};
  }

  const oldBest=P._bestPass;
  P._bestPass=function(o){
    const best=oldBest.apply(this,arguments);
    if(!best||!o||!CFG.perception)return best;
    const dg=droot(this).teams[o.team];dg.passReads++;
    const phase=(Math.sin((this.simT||0)*1.57+o.idx*2.11+(best.m?best.m.idx:0)*.73)+1)/2;
    const model=passPerceptionModel(o,best,phase);
    if(model.complexity>.72)dg.complexReads++;
    if(finite(best.progressM,0)>8)dg.progressiveReads++;
    if(!model.perceived&&typeof this._safePass==='function'){
      const opps=this.teams[1-o.team].players.filter(p=>!p.red);
      const safe=this._safePass(o,opps);
      if(safe&&safe.m&&safe.m!==best.m&&finite(safe.risk,0)<=finite(best.risk,0)+.15){
        dg.perceptionFallbacks++;
        safe._r187PerceptionFallback=true;
        safe._r187Missed=best.m;
        return safe;
      }
    }
    best._r187Perceived=true;
    return best;
  };

  P.getAttributeInfluenceProfile=function(p,candidate,phase){
    const mi=markerIQ(p),pi=passIQ(p);
    return {version:VERSION,active:{assignment:!!CFG.assignment,reaction:!!CFG.reaction,recovery:!!CFG.recovery,perception:!!CFG.perception},
      markerIQ:mi,passIQ:pi,markerQuality:norm(mi),passQuality:norm(pi),
      experimentalInactive:{reactionDelaySeconds:lerp(.18,.035,norm(mi)),markingGapMeters:lerp(1.55,.82,norm(mi)),
        recoverySprintThresholdMeters:lerp(3.25,2.35,norm(mi))},
      passPerception:candidate?passPerceptionModel(p,candidate,phase):null};
  };

  P.getAttributeInfluenceAudit=function(){
    const d=droot(this);
    return {version:VERSION,teams:d.teams.map((x,i)=>({team:i,
      roleCycles:x.roleCycles,assignments:x.assignments,attributeReassignments:x.attributeReassignments,switches:x.switches,
      switchRate:x.assignments?x.switches/x.assignments:0,
      meanAssignedMarkerIQ:x.assignments?x.markerIQ/x.assignments:0,
      delayedReads:x.delayedReads,
      meanMarkDistance:x.markSamples?x.markDistance/x.markSamples:0,
      passReads:x.passReads,complexReads:x.complexReads,
      perceptionFallbacks:x.perceptionFallbacks,
      fallbackRate:x.passReads?x.perceptionFallbacks/x.passReads:0,
      progressiveReads:x.progressiveReads
    }))};
  };
  const oldFull=P.getFullFootballAudit;
  P.getFullFootballAudit=function(){
    const r=oldFull?oldFull.apply(this,arguments):{};
    r.version=VERSION;r.attributeInfluence=this.getAttributeInfluenceAudit();return r;
  };
  try{root.CDS_BUILD_ID='R18.7';root.CDS_VERSION=VERSION;document.title='Copa dos Sonhos — R18.7';}catch(_){ }
  root.CDS_R187=Object.freeze({version:VERSION,attributeDrivenAssignment:!!CFG.assignment,individualMarkingReaction:!!CFG.reaction,attributeRecovery:!!CFG.recovery,passPerception:!!CFG.perception,config:CFG,markerIQ,passIQ,passPerceptionModel});
})(typeof window!=='undefined'?window:globalThis);

