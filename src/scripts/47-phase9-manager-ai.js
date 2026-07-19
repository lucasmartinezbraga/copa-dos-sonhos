/* Copa dos Sonhos — Fase 9 — inteligência do treinador adversário — motor 5.2.0 */
(function(root){
'use strict';
const NODE=typeof module!=='undefined'&&module.exports;
const M=root.MatchSim;
if(!M||!M.prototype||M.prototype.__P9__)return;
const VERSION='5.2.0';
const C=root.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const LINE=root.LINE_OF||{};
const getAttr=(p,k,f=60)=>{try{const fn=root.getAttr,v=fn&&fn(p&&p.ref?p.ref:p,k);return Number.isFinite(v)?v:f;}catch(_){return f;}};
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const sum=(xs,fn)=>xs.reduce((a,x)=>a+fn(x),0);
const avg=(xs,fn,f=0)=>xs.length?sum(xs,fn)/xs.length:f;
const hash=s=>{let h=2166136261>>>0;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const PROFILE_TEMPLATES=Object.freeze({
  pragmatic:{key:'pragmatic',label:'Pragmático',aggression:46,riskTolerance:42,adaptability:72,pressingPreference:42,possessionPreference:50,defensivePreference:72,substitutionTiming:58,evidenceThreshold:.54,persistence:12,reviewMinutes:8},
  aggressive:{key:'aggressive',label:'Agressivo',aggression:82,riskTolerance:78,adaptability:66,pressingPreference:86,possessionPreference:44,defensivePreference:35,substitutionTiming:66,evidenceThreshold:.48,persistence:9,reviewMinutes:7},
  possession:{key:'possession',label:'Controlador',aggression:54,riskTolerance:48,adaptability:74,pressingPreference:68,possessionPreference:88,defensivePreference:48,substitutionTiming:55,evidenceThreshold:.52,persistence:11,reviewMinutes:8},
  adaptive:{key:'adaptive',label:'Adaptável',aggression:60,riskTolerance:58,adaptability:90,pressingPreference:64,possessionPreference:64,defensivePreference:60,substitutionTiming:62,evidenceThreshold:.44,persistence:8,reviewMinutes:6}
});
function deriveProfile(source,tm){
  const explicit=source&&source.managerProfile;
  if(explicit&&typeof explicit==='object')return Object.assign({},PROFILE_TEMPLATES.adaptive,clone(explicit));
  if(typeof explicit==='string'&&PROFILE_TEMPLATES[explicit])return clone(PROFILE_TEMPLATES[explicit]);
  const style=(source&&source.style)||tm.styleKey||'balanced';
  const styleMap={press:'aggressive',tiki:'possession',park:'pragmatic',counter:'pragmatic',direct:'aggressive'};
  const keys=['pragmatic','aggressive','possession','adaptive'];
  const key=styleMap[style]||keys[hash((tm.name||'')+'|'+style)%keys.length];
  const p=clone(PROFILE_TEMPLATES[key]);
  const n=hash((tm.name||'')+'|profile');
  const jitter=(shift)=>((n>>>shift)%11)-5;
  p.aggression=C(p.aggression+jitter(0),20,95);
  p.riskTolerance=C(p.riskTolerance+jitter(4),20,95);
  p.adaptability=C(p.adaptability+jitter(8),30,98);
  p.substitutionTiming=C(p.substitutionTiming+jitter(12),40,82);
  return p;
}
function blankManagerStats(st){
  st.managerAnalyses=st.managerAnalyses||0;st.managerDiagnoses=st.managerDiagnoses||0;
  st.managerChanges=st.managerChanges||0;st.managerSubstitutions=st.managerSubstitutions||0;
  st.managerEvaluations=st.managerEvaluations||0;st.managerSuccessfulChanges=st.managerSuccessfulChanges||0;
  st.managerFailedChanges=st.managerFailedChanges||0;st.managerInconclusiveChanges=st.managerInconclusiveChanges||0;st.managerReversals=st.managerReversals||0;
  st.managerPreMatchPlans=st.managerPreMatchPlans||0;return st;
}
function activePlayers(tm){return tm.players.filter(p=>!p.red);}
function metricSnapshot(sim,t){
  const tm=sim.teams[t],own=sim.stats[t],opp=sim.stats[1-t],ps=activePlayers(tm).filter(p=>!p.isGK);
  const ownPoss=own.possTime||0,oppPoss=opp.possTime||0,totalPoss=ownPoss+oppPoss;
  const yellowPlayers=ps.filter(p=>p.yellow>0);
  const line=tm.instructions&&tm.instructions.outOfPossession?tm.instructions.outOfPossession.defensiveLine:(tm._axes?tm._axes.line:50);
  const press=tm.instructions&&tm.instructions.outOfPossession?tm.instructions.outOfPossession.pressing:(tm._axes?tm._axes.press:50);
  return {
    minute:sim.minute,diff:sim.score[t]-sim.score[1-t],score:sim.score.slice(),
    xgFor:own.xg||0,xgAgainst:opp.xg||0,shotsFor:own.shots||0,shotsAgainst:opp.shots||0,
    onTargetFor:own.onTarget||0,onTargetAgainst:opp.onTarget||0,
    possTimeFor:ownPoss,possTimeAgainst:oppPoss,possession:totalPoss?ownPoss/totalPoss:.5,
    passes:own.passes||0,passOk:own.passOk||0,passAccuracy:own.passes?own.passOk/own.passes:1,
    oppPassAccuracy:opp.passes?opp.passOk/opp.passes:1,
    attacksAgainstL:opp.attacksL||0,attacksAgainstR:opp.attacksR||0,
    crossesAgainst:opp.crosses||0,crossesOkAgainst:opp.crossesOk||0,
    throughAgainst:opp.throughBalls||0,throughOkAgainst:opp.throughOk||0,oneOnOnesAgainst:opp.oneOnOnes||0,
    pressWins:own.pressWins||0,defErrors:own.defErrors||0,gkBadDistribution:own.gkBadDistribution||0,
    stamina:avg(ps,p=>p.stamina,100),yellowCount:yellowPlayers.length,redCount:tm.players.filter(p=>p.red).length,
    lowestStamina:ps.length?Math.min(...ps.map(p=>p.stamina)):100,line,press,
    setPieceThreat:(opp.setPieceShots||0),coherence:tm.coherence?tm.coherence.score:100
  };
}
function windowDelta(before,after){
  const possFor=after.possTimeFor-before.possTimeFor,possAgainst=after.possTimeAgainst-before.possTimeAgainst,pt=possFor+possAgainst;
  return {xgFor:after.xgFor-before.xgFor,xgAgainst:after.xgAgainst-before.xgAgainst,shotsFor:after.shotsFor-before.shotsFor,shotsAgainst:after.shotsAgainst-before.shotsAgainst,possession:pt?possFor/pt:.5,scoreDelta:after.diff-before.diff};
}
function diagnose(sim,t,m){
  const out=[],add=(code,severity,label,evidence,objective)=>out.push({code,severity:C(severity,0,1),label,evidence,objective});
  const oppAttacks=m.attacksAgainstL+m.attacksAgainstR;
  const shotQuality=m.shotsFor?m.xgFor/m.shotsFor:0;
  if(m.redCount>0)add('RED_CARD',.96,'Inferioridade numérica',`${m.redCount} expulsão(ões) alteraram o equilíbrio`,m.diff<0?'attack':'defend');
  if(m.diff<0&&m.minute>=58)add('LOSING_LATE',C(.58+(m.minute-58)/42+Math.min(2,-m.diff)*.1,0,1),'Desvantagem no placar',`Perdendo por ${-m.diff} aos ${Math.floor(m.minute)} minutos`,'attack');
  if(m.diff>0&&m.minute>=68)add('LEADING_LATE',C(.52+(m.minute-68)/30+m.diff*.08,0,1),'Vantagem a proteger',`Vencendo por ${m.diff} no terço final`,'defend');
  if(oppAttacks>=6&&m.attacksAgainstL>m.attacksAgainstR*1.4)add('LEFT_OVERLOAD',C(.5+(m.attacksAgainstL-m.attacksAgainstR)/16,0,1),'Sobrecarga pelo lado esquerdo rival',`${m.attacksAgainstL} ataques contra ${m.attacksAgainstR}`,'defend');
  if(oppAttacks>=6&&m.attacksAgainstR>m.attacksAgainstL*1.4)add('RIGHT_OVERLOAD',C(.5+(m.attacksAgainstR-m.attacksAgainstL)/16,0,1),'Sobrecarga pelo lado direito rival',`${m.attacksAgainstR} ataques contra ${m.attacksAgainstL}`,'defend');
  if(m.line>=64&&(m.oneOnOnesAgainst+m.throughOkAgainst)>=3)add('HIGH_LINE_EXPOSED',C(.55+(m.oneOnOnesAgainst+m.throughOkAgainst)/14,0,1),'Linha alta vulnerável',`${m.oneOnOnesAgainst} um contra um e ${m.throughOkAgainst} bolas em profundidade`,'defend');
  if(m.minute>=22&&m.possession<.43&&m.xgAgainst>m.xgFor+.25)add('MIDFIELD_INFERIORITY',C(.5+(.43-m.possession)*2+(m.xgAgainst-m.xgFor)*.16,0,1),'Meio-campo em inferioridade',`${Math.round(m.possession*100)}% de posse e desvantagem territorial`,'control');
  if(m.minute>=28&&m.shotsFor<=3&&m.xgFor<.48)add('ISOLATED_ATTACK',C(.58+(3-m.shotsFor)*.08,0,1),'Ataque isolado',`${m.shotsFor} finalizações e ${m.xgFor.toFixed(2)} xG`,'attack');
  if(m.minute>=20&&m.passAccuracy<.72&&(m.gkBadDistribution>=1||m.defErrors>=1))add('BUILDUP_FAIL',C(.55+(.72-m.passAccuracy)*1.8,0,1),'Saída de bola falhando',`${Math.round(m.passAccuracy*100)}% de passe e ${m.gkBadDistribution} erros do goleiro`,'control');
  if(m.minute>=26&&m.press>=68&&m.pressWins<3)add('PRESS_INEFFECTIVE',C(.5+(m.press-68)/80,0,1),'Pressão ineficiente',`Pressão ${Math.round(m.press)} com apenas ${m.pressWins} recuperações`,'defend');
  if(m.shotsFor>=8&&shotQuality<.085)add('POOR_SHOT_QUALITY',C(.55+(.085-shotQuality)*4,0,1),'Finalizações de baixa qualidade',`${m.shotsFor} chutes para ${m.xgFor.toFixed(2)} xG`,'attack');
  if(m.stamina<61)add('FATIGUE',C(.55+(61-m.stamina)/18,0,1),'Fadiga coletiva',`Média física em ${m.stamina.toFixed(1)}%`,'control');
  if(m.yellowCount>=2&&m.minute>=45)add('YELLOW_RISK',C(.48+m.yellowCount*.08,0,1),'Risco disciplinar',`${m.yellowCount} jogadores amarelados`,'defend');
  if(m.crossesAgainst>=7&&m.crossesOkAgainst/Math.max(1,m.crossesAgainst)>.34)add('AERIAL_THREAT',C(.5+m.crossesOkAgainst/12,0,1),'Ameaça aérea adversária',`${m.crossesOkAgainst}/${m.crossesAgainst} cruzamentos encontraram alvo`,'defend');
  if(m.coherence<80)add('TACTICAL_CONFLICT',C(.5+(80-m.coherence)/40,0,1),'Instruções conflitantes',`Coerência tática ${m.coherence}/100`,'control');
  return out.sort((a,b)=>b.severity-a.severity);
}
function snapshotTeamState(tm){return{preset:tm.instructionPreset,instructions:clone(tm.instructions),axes:clone(tm._axes),defForm:tm.defForm,defVar:tm.defVar||0,atkForm:tm.atkForm,atkVar:tm.atkVar||0,sideShift:tm.managerAI&&tm.managerAI.sideShift||null};}
function availableForm(key){return !!(root.FORMATIONS&&root.FORMATIONS[key]);}
function actionFor(d,sim,t,profile){
  const m=metricSnapshot(sim,t),bold=profile.riskTolerance>=65;
  switch(d.code){
    case 'RED_CARD':return{id:'red_compact',label:'Reorganizar após expulsão',objective:m.diff<0?'attack':'defend',preset:m.diff<0?'counter':'lowBlock',shape:{def:'5-3-2',atk:m.diff<0?'3-4-3':'5-3-2'},axes:{press:-12,width:-8,line:m.diff<0?-4:-12,posture:m.diff<0?4:-12},expected:'Reduzir espaços centrais sem abandonar a transição'};
    case 'LOSING_LATE':return{id:bold?'all_out_attack':'structured_chase',label:bold?'Ataque total':'Busca estruturada do empate',objective:'attack',preset:bold?'highPress':'counter',shape:{def:bold?'3-4-3':'4-2-3-1',atk:bold?'4-2-4':'4-2-3-1'},axes:{press:bold?14:8,line:bold?12:7,tempo:bold?12:7,posture:bold?16:9},sub:'attack',expected:'Aumentar xG, presença de área e recuperações altas'};
    case 'LEADING_LATE':return{id:'protect_lead',label:'Proteger a vantagem',objective:'defend',preset:profile.defensivePreference>=65?'lowBlock':'possession',shape:{def:profile.defensivePreference>=65?'5-4-1':'4-5-1',atk:'4-3-3'},axes:{press:-9,line:-12,tempo:-8,posture:-10},sub:'defend',expected:'Reduzir xG e finalizações adversárias'};
    case 'LEFT_OVERLOAD':return{id:'reinforce_left',label:'Reforçar corredor esquerdo defensivo',objective:'defend',side:'L',instructions:{outOfPossession:{preventCross:true,protectBox:true}},expected:'Reduzir progressões e cruzamentos pelo corredor atacado'};
    case 'RIGHT_OVERLOAD':return{id:'reinforce_right',label:'Reforçar corredor direito defensivo',objective:'defend',side:'R',instructions:{outOfPossession:{preventCross:true,protectBox:true}},expected:'Reduzir progressões e cruzamentos pelo corredor atacado'};
    case 'HIGH_LINE_EXPOSED':return{id:'drop_line',label:'Baixar linha e proteger profundidade',objective:'defend',preset:'balanced',axes:{line:-16,press:-6},shape:{def:'4-1-4-1',atk:sim.teams[t].atkForm||'4-3-3'},expected:'Reduzir um contra um e bolas nas costas'};
    case 'MIDFIELD_INFERIORITY':return{id:'add_midfield',label:'Adicionar presença no meio',objective:'control',preset:'possession',shape:{def:'4-5-1',atk:'4-2-3-1'},axes:{width:-7,tempo:-4,press:4},expected:'Recuperar posse e conexões centrais'};
    case 'ISOLATED_ATTACK':return{id:'connect_attack',label:'Aproximar o ataque',objective:'attack',preset:'wings',shape:{def:'4-2-3-1',atk:'4-2-3-1'},axes:{posture:8,width:7,tempo:5},expected:'Aumentar finalizações e entradas no último terço'};
    case 'BUILDUP_FAIL':return{id:'bypass_press',label:'Contornar a pressão rival',objective:'control',preset:'counter',instructions:{inPossession:{buildup:{method:'direct'},progression:{passLength:68,verticality:66}},transition:{goalkeeperDistribution:'long'}},expected:'Reduzir perdas na saída e avançar com segurança'};
    case 'PRESS_INEFFECTIVE':return{id:'reset_press',label:'Reorganizar a pressão',objective:'defend',preset:'balanced',axes:{press:-14,line:-6},instructions:{transition:{afterLoss:'regroup'}},expected:'Reduzir desgaste e recuperar compactação'};
    case 'POOR_SHOT_QUALITY':return{id:'work_ball',label:'Trabalhar melhor as chances',objective:'attack',preset:'possession',instructions:{inPossession:{finalThird:{workBall:true,earlyShots:false,longShots:'balanced'}}},expected:'Aumentar xG por finalização'};
    case 'FATIGUE':return{id:'manage_fatigue',label:'Gerir fadiga e renovar energia',objective:'control',preset:'balanced',axes:{press:-12,tempo:-8},sub:'physical',expected:'Estabilizar intensidade e substituir jogador exausto'};
    case 'YELLOW_RISK':return{id:'disciplinary_sub',label:'Proteger jogador amarelado',objective:'defend',sub:'disciplinary',expected:'Reduzir risco de expulsão'};
    case 'AERIAL_THREAT':return{id:'stop_crosses',label:'Bloquear cruzamentos',objective:'defend',instructions:{outOfPossession:{preventCross:true,protectBox:true,marking:'mixed'}},axes:{width:8,line:-5},expected:'Reduzir cruzamentos limpos e duelos aéreos adversários'};
    case 'TACTICAL_CONFLICT':return{id:'restore_coherence',label:'Restaurar coerência tática',objective:'control',preset:'balanced',expected:'Eliminar instruções contraditórias'};
  }
  return null;
}
function applyAxes(sim,t,mods){if(!mods||typeof sim.setAxes!=='function')return false;const tm=sim.teams[t],a=Object.assign({line:50,press:50,width:50,tempo:50,posture:50},tm._axes||{});for(const k of ['line','press','width','tempo','posture'])if(Number.isFinite(mods[k]))a[k]=C((a[k]==null?50:a[k])+mods[k],0,100);return sim.setAxes(t,a);}
function shiftSide(tm,state,side){
  if(state.sideShift&&state.sideShift.delta){for(const p of tm.players){if(p.isGK)continue;if(LINE[p.slotPos]==='DEF'||p.slotPos==='CDM'){p.dhy-=state.sideShift.delta;p.hy-=state.sideShift.delta;p.ahy-=state.sideShift.delta;}}}
  if(!side){state.sideShift=null;return;}
  const delta=side==='L'?-2.6:2.6;
  for(const p of tm.players){if(p.isGK)continue;if(LINE[p.slotPos]==='DEF'||p.slotPos==='CDM'){p.dhy=C(p.dhy+delta,2,66);p.hy=C(p.hy+delta,2,66);p.ahy=C(p.ahy+delta,2,66);}}
  state.sideShift={side,delta};
}
function bestBench(tm,wantedLine){let bi=-1,best=-1;for(let i=0;i<(tm.bench||[]).length;i++){const b=tm.bench[i],ln=LINE[b.slot||b.pos]||'MID';if((b.slot||b.pos)==='GK')continue;const fit=ln===wantedLine?12:wantedLine==='FWD'&&ln==='MID'?4:wantedLine==='DEF'&&ln==='MID'?2:0;const score=(b.r||60)+fit;if(score>best){best=score;bi=i;}}return bi;}
function chooseOut(tm,mode){let idx=-1,score=1e9;for(let i=0;i<tm.players.length;i++){const p=tm.players[i];if(p.red||p.isGK)continue;const ln=LINE[p.slotPos]||'MID';let s=(p.rating||6)*10+p.stamina*.25+(p.ref.r||60)*.15;if(mode==='attack'&&ln==='DEF')s-=16;if(mode==='defend'&&ln==='FWD')s-=14;if(mode==='physical')s=p.stamina+(p.rating||6)*2;if(mode==='disciplinary')s=p.yellow?0+(p.rating||6):100+(p.rating||6);if(s<score){score=s;idx=i;}}return idx;}
function makeSubstitution(sim,t,mode){const tm=sim.teams[t],state=tm.managerAI;if(tm.subsLeft<=0||state.subsMade>=3||!tm.bench||!tm.bench.length)return null;if(sim.minute-state.lastSubMinute<11)return null;const critical=tm.players.some(p=>!p.red&&!p.isGK&&p.stamina<44);if(mode!=='disciplinary'&&!critical&&sim.minute<state.profile.substitutionTiming-6)return null;const outIdx=chooseOut(tm,mode),out=tm.players[outIdx];if(!out)return null;let wanted=LINE[out.slotPos]||'MID';if(mode==='attack')wanted='FWD';else if(mode==='defend')wanted='DEF';const bi=bestBench(tm,wanted);if(bi<0)return null;const incoming=tm.bench[bi],outName=out.ref&&out.ref.n,inName=incoming.n;if(!sim.substitute(t,outIdx,incoming))return null;blankManagerStats(sim.stats[t]).managerSubstitutions++;state.subsMade++;state.lastSubMinute=sim.minute;return{out:outName,in:inName,mode};}
function evaluateChange(sim,t,force){const tm=sim.teams[t],state=tm.managerAI,pending=state.pendingEvaluation;if(!pending)return null;const elapsed=sim.minute-pending.minute;if(!force&&elapsed<state.profile.reviewMinutes)return null;const after=metricSnapshot(sim,t),d=windowDelta(pending.before,after);let score=0;if(pending.objective==='attack')score=d.xgFor*1.35+d.shotsFor*.07-d.xgAgainst*.55;else if(pending.objective==='defend')score=-d.xgAgainst*1.45-d.shotsAgainst*.06+d.xgFor*.25;else score=(d.possession-.5)*1.5+d.xgFor*.55-d.xgAgainst*.7;score=C(score,-1,1);const outcome=score>.06?'positive':score<-.08?'negative':'inconclusive',success=outcome==='positive'?true:outcome==='negative'?false:null;const st=blankManagerStats(sim.stats[t]);st.managerEvaluations++;if(outcome==='positive')st.managerSuccessfulChanges++;else if(outcome==='negative')st.managerFailedChanges++;else st.managerInconclusiveChanges++;
  pending.entry.evaluation={minute:Math.floor(sim.minute),score:+score.toFixed(3),outcome,success,window:d};
  sim._emit('manager_evaluation',{team:t,action:pending.action,label:pending.entry.action.label,outcome,success,score});
  if(!success&&score<-.22&&state.profile.adaptability>=75&&!pending.emergency&&!pending.entry.substitution){
    const prev=pending.previous;
    try{if(prev.instructions&&typeof sim.setTeamInstructions==='function')sim.setTeamInstructions(t,prev.instructions);if(prev.axes&&typeof sim.setAxes==='function')sim.setAxes(t,prev.axes);if(prev.defForm&&prev.atkForm&&typeof sim.setShapes==='function')sim.setShapes(t,prev.defForm,prev.defVar||0,prev.atkForm,prev.atkVar||0);shiftSide(tm,state,prev.sideShift&&prev.sideShift.side||null);st.managerReversals++;pending.entry.reverted=true;sim._emit('manager_reversal',{team:t,action:pending.action,reason:'A mudança não melhorou os indicadores'});}catch(_){}}
  state.pendingEvaluation=null;return pending.entry.evaluation;
}
function preMatchPlan(sim,t){const tm=sim.teams[t],state=tm.managerAI;if(state.preMatch)return state.preMatch;const opp=sim.teams[1-t],profile=state.profile,forwards=opp.players.filter(p=>LINE[p.slotPos]==='FWD'),pace=avg(forwards,p=>(getAttr(p,'ritmo')+getAttr(p,'aceleracao'))/2,60),air=avg(forwards,p=>(getAttr(p,'cabecalho')+getAttr(p,'impulsao'))/2,60);let preset='balanced',reason='Plano equilibrado para iniciar a leitura da partida';if(profile.key==='aggressive')preset='highPress',reason='Perfil agressivo: pressionar a primeira construção';else if(profile.key==='possession')preset='possession',reason='Perfil controlador: dominar bola e território';else if(profile.pressingPreference>=78)preset='highPress',reason='Preferência do treinador: pressionar a saída adversária';else if(pace>=78)preset='counter',reason='Ataque adversário veloz: controlar profundidade e transitar';else if(profile.defensivePreference>=68)preset='lowBlock',reason='Perfil pragmático: proteger zonas centrais';
  if(typeof sim.setTeamInstructions==='function')sim.setTeamInstructions(t,preset);
  if(air>=76&&typeof sim.setTeamInstructions==='function')sim.setTeamInstructions(t,{outOfPossession:{preventCross:true,protectBox:true}});
  if(pace>=78)applyAxes(sim,t,{line:-9,press:-3});
  state.preMatch={minute:0,preset,reason,opponent:{name:opp.name,form:opp.atkForm||opp.defForm||null,style:opp.styleKey||null,pace:+pace.toFixed(1),aerial:+air.toFixed(1)}};
  const entry={minute:0,type:'pre_match',diagnosis:'Plano pré-jogo',evidence:[`Velocidade ofensiva rival ${pace.toFixed(1)}`,`Ameaça aérea ${air.toFixed(1)}`],action:{id:'pre_match_'+preset,label:'Plano '+preset},expected:reason};state.history.push(entry);blankManagerStats(sim.stats[t]).managerPreMatchPlans++;sim._emit('manager_plan',{team:t,profile:profile.label,preset,reason});return state.preMatch;
}
function applyAction(sim,t,diag,action){const tm=sim.teams[t],state=tm.managerAI,previous=snapshotTeamState(tm);let changed=false,substitution=null;
  if(action.preset&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,action.preset);changed=true;}
  if(action.instructions&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,action.instructions);changed=true;}
  if(action.axes){applyAxes(sim,t,action.axes);changed=true;}
  if(action.shape&&typeof sim.setShapes==='function'){const df=availableForm(action.shape.def)?action.shape.def:tm.defForm,af=availableForm(action.shape.atk)?action.shape.atk:tm.atkForm;try{sim.setShapes(t,df||'4-3-3',0,af||'4-3-3',0);changed=true;}catch(_){}}
  if(action.side){shiftSide(tm,state,action.side);changed=true;}
  if(action.sub&&sim.minute-state.lastSubMinute>=6){substitution=makeSubstitution(sim,t,action.sub);if(substitution)changed=true;}
  if(!changed)return null;
  const now=metricSnapshot(sim,t),entry={minute:Math.floor(sim.minute),type:'change',diagnosis:diag.label,diagnosisCode:diag.code,evidence:[diag.evidence],severity:+diag.severity.toFixed(3),action:{id:action.id,label:action.label},expected:action.expected,substitution};
  state.history.push(entry);state.lastActionMinute=sim.minute;state.tried[action.id]=sim.minute;state.currentDiagnosis=diag;blankManagerStats(sim.stats[t]).managerChanges++;
  state.pendingEvaluation={minute:sim.minute,action:action.id,objective:action.objective,before:now,previous,entry,emergency:['RED_CARD','LOSING_LATE','LEADING_LATE'].includes(diag.code)};
  sim._emit('manager_change',{team:t,profile:state.profile.label,diagnosis:diag.label,action:action.label,expected:action.expected,substitution});return entry;
}
const Q=M.prototype;Q.__P9__=true;
const oldBuild=Q._buildTeam;Q._buildTeam=function(source,side){const tm=oldBuild.call(this,source,side);tm.managerAI={profile:deriveProfile(source,tm),preMatch:null,history:[],diagnoses:[],currentDiagnosis:null,pendingEvaluation:null,lastThinkMinute:-99,lastActionMinute:-99,lastSubMinute:-99,subsMade:0,tried:Object.create(null),sideShift:null};return tm;};
const oldBlank=Q._blankStats;Q._blankStats=function(){return blankManagerStats(oldBlank.call(this));};
const oldInteractive=Q.setInteractive;Q.setInteractive=function(team){const out=oldInteractive.call(this,team);if(this._aiTeam===0||this._aiTeam===1)preMatchPlan(this,this._aiTeam);return out;};
Q.setManagerProfile=function(team,profile){const tm=this.teams[team];if(!tm)return false;tm.managerAI=tm.managerAI||{};tm.managerAI.profile=typeof profile==='string'&&PROFILE_TEMPLATES[profile]?clone(PROFILE_TEMPLATES[profile]):Object.assign({},tm.managerAI.profile||PROFILE_TEMPLATES.adaptive,clone(profile||{}));return clone(tm.managerAI.profile);};
Q._phase9Evaluate=function(team,force){return evaluateChange(this,team,!!force);};
Q._phase9Think=function(team,force){const t=team===1?1:0,tm=this.teams[t],state=tm.managerAI;if(!state)return null;preMatchPlan(this,t);evaluateChange(this,t,false);const interval=C(8-state.profile.adaptability/25,4,7);if(!force&&this.minute-state.lastThinkMinute<interval)return null;state.lastThinkMinute=this.minute;const metrics=metricSnapshot(this,t),diags=diagnose(this,t,metrics);state.diagnoses=diags.slice(0,5);const st=blankManagerStats(this.stats[t]);st.managerAnalyses++;st.managerDiagnoses+=diags.length;if(!diags.length)return null;
  const emergency=diags[0].severity>=.88;if(state.pendingEvaluation&&!emergency)return null;
  const cooldown=C(state.profile.persistence-(state.profile.adaptability-50)/12,6,14);if(!force&&!emergency&&this.minute-state.lastActionMinute<cooldown)return null;
  let chosen=null;for(const d of diags){const a=actionFor(d,this,t,state.profile);if(!a)continue;const last=state.tried[a.id],repeatWindow=state.profile.persistence+(d.code==='LOSING_LATE'?7:5);if(last!=null&&this.minute-last<repeatWindow)continue;const personality=(a.objective==='attack'?(state.profile.riskTolerance*.7+state.profile.aggression*.3):a.objective==='defend'?state.profile.defensivePreference:state.profile.possessionPreference)/100*.12;const score=d.severity+personality;if(score>=state.profile.evidenceThreshold&&(!chosen||score>chosen.score))chosen={diag:d,action:a,score};}
  if(!chosen)return null;return applyAction(this,t,chosen.diag,chosen.action);
};
Q.getManagerData=function(team){const t=team===1?1:0,tm=this.teams[t],s=blankManagerStats(this.stats[t]),state=tm.managerAI;return{version:VERSION,team:t,profile:clone(state.profile),preMatch:clone(state.preMatch),currentDiagnosis:clone(state.currentDiagnosis),diagnoses:clone(state.diagnoses),pendingEvaluation:state.pendingEvaluation?{minute:state.pendingEvaluation.minute,action:state.pendingEvaluation.action,objective:state.pendingEvaluation.objective}:null,history:clone(state.history),metrics:{analyses:s.managerAnalyses,diagnoses:s.managerDiagnoses,changes:s.managerChanges,substitutions:s.managerSubstitutions,evaluations:s.managerEvaluations,successful:s.managerSuccessfulChanges,failed:s.managerFailedChanges,inconclusive:s.managerInconclusiveChanges,reversals:s.managerReversals,preMatchPlans:s.managerPreMatchPlans}};};
Q._aiReact=function(){const t=this._aiTeam;if(t===0||t===1)this._phase9Think(t,false);};
const oldAdvanced=Q.getAdvancedData;Q.getAdvancedData=function(team){const out=oldAdvanced?oldAdvanced.call(this,team):{};out.engineVersion=VERSION;out.phase9=this.getManagerData(team);return out;};
const oldState=Q.getState;Q.getState=function(){const out=oldState.call(this);out.engineVersion=VERSION;out.phase9=this.teams.map((_,i)=>{const d=this.getManagerData(i);return{profile:d.profile,currentDiagnosis:d.currentDiagnosis,pendingEvaluation:d.pendingEvaluation,metrics:d.metrics};});return out;};
if(!NODE&&typeof document!=='undefined'){
  const Old=root.MatchSim;class Active extends Old{constructor(){super(...arguments);root.__CDS_ACTIVE_SIM=this;}}root.MatchSim=Active;
  const boot=()=>{if(document.getElementById('p9btn'))return;const css=document.createElement('style');css.textContent='#p9btn{position:fixed;left:12px;bottom:12px;z-index:999999;border:1px solid #64d8ff;border-radius:999px;background:#0b1726;color:#a9edff;padding:9px 12px;font:700 11px system-ui}#p9box{position:fixed;inset:0;z-index:1000001;background:#020712dd;display:none;place-items:end center;padding:12px;color:#fff;font-family:system-ui}#p9box.on{display:grid}#p9box>div{width:min(760px,100%);max-height:86vh;overflow:auto;background:#0b1425;border:1px solid #29536d;border-radius:18px;padding:15px}.p9card{background:#101d30;border:1px solid #203c58;border-radius:10px;padding:10px;margin:8px 0}.p9ev{font-size:12px;color:#b8c9d9;margin-top:4px}';document.head.appendChild(css);const b=document.createElement('button');b.id='p9btn';b.textContent='IA DO TREINADOR 5.2';const x=document.createElement('div');x.id='p9box';x.innerHTML='<div><button id="p9close" style="float:right">×</button><h3>Leitura do treinador adversário</h3><main></main></div>';document.body.append(b,x);const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const paint=()=>{const sim=root.__CDS_ACTIVE_SIM,m=x.querySelector('main');if(!sim)return m.innerHTML='<p>Inicie uma partida.</p>';const side=sim._aiTeam===0?0:1,d=sim.getManagerData(side);m.innerHTML='<div class="p9card"><b>'+esc(d.profile.label)+'</b><div class="p9ev">Adaptabilidade '+d.profile.adaptability+' · Risco '+d.profile.riskTolerance+' · Pressão '+d.profile.pressingPreference+'</div></div>'+(d.currentDiagnosis?'<div class="p9card"><b>Diagnóstico atual</b><div>'+esc(d.currentDiagnosis.label)+'</div><div class="p9ev">'+esc(d.currentDiagnosis.evidence)+'</div></div>':'')+'<h4>Decisões</h4>'+d.history.slice(-8).reverse().map(h=>'<div class="p9card"><b>'+h.minute+'’ · '+esc(h.action&&h.action.label||h.diagnosis)+'</b><div>'+esc(h.diagnosis||'')+'</div><div class="p9ev">'+esc(h.expected||'')+(h.evaluation?' · avaliação '+h.evaluation.score:'')+'</div></div>').join('')+'<p>Análises: '+d.metrics.analyses+' · Mudanças: '+d.metrics.changes+' · Subs: '+d.metrics.substitutions+' · Reversões: '+d.metrics.reversals+'</p>';};b.onclick=()=>{x.classList.add('on');paint();};x.querySelector('#p9close').onclick=()=>x.classList.remove('on');};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
}
const API={VERSION,PROFILES:PROFILE_TEMPLATES,deriveProfile,getManagerData:(sim,team)=>sim.getManagerData(team),installed:true};root.CDS_PHASE9=API;if(NODE)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
