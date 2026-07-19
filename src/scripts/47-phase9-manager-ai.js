/* Copa dos Sonhos — Fase 9 — inteligência do treinador adversário — motor 5.2.0 */
(function(root){
'use strict';
const NODE=typeof module!=='undefined'&&module.exports;
const M=root.MatchSim;
if(!M||!M.prototype||M.prototype.__P9__)return;
const VERSION='5.2.1';
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
  st.managerPreMatchPlans=st.managerPreMatchPlans||0;st.managerNoActions=st.managerNoActions||0;
  st.managerRoleChanges=st.managerRoleChanges||0;st.managerDutyChanges=st.managerDutyChanges||0;
  st.managerPressOrientations=st.managerPressOrientations||0;st.managerCrossChanges=st.managerCrossChanges||0;
  st.managerTargetedPlayers=st.managerTargetedPlayers||0;st.managerStateExports=st.managerStateExports||0;st.managerStateImports=st.managerStateImports||0;
  return st;
}
function activePlayers(tm){return tm.players.filter(p=>!p.red);}
function playerName(p){return p&&p.ref&&(p.ref.n||p.ref.name)||'Jogador';}
function playerId(p){return p&&p.ref&&(p.ref.id!=null?p.ref.id:p.ref.n)||p&&p.idx;}
function nearestMateDistance(tm,p){let d=99;for(const q of tm.players){if(q===p||q.red)continue;const dx=(p.x||0)-(q.x||0),dy=(p.y||0)-(q.y||0);d=Math.min(d,Math.hypot(dx,dy));}return d;}
function roleMismatch(p){
  const base=LINE[p.slotPos]||'MID',ip=LINE[p.ipPos||p.slotPos]||base,oop=LINE[p.oopPos||p.slotPos]||base;
  if(base==='DEF'&&ip==='FWD')return 'Defensor projetado como atacante sem cobertura';
  if(base==='FWD'&&oop==='DEF'&&p.oopDuty==='attack')return 'Atacante com dever ofensivo na fase defensiva';
  if(base==='MID'&&ip==='DEF'&&p.ipDuty==='attack')return 'Meio-campista recuado com dever ofensivo incompatível';
  if(p.ipDuty==='attack'&&p.oopDuty==='attack')return 'Dever ofensivo simultâneo com e sem bola';
  return null;
}
function visibleTournamentContext(tm){
  const k=tm.managerAI&&tm.managerAI.knowledge||{};
  return {
    recentResults:Array.isArray(k.recentResults)?k.recentResults.slice(-5):null,
    fatigue:Number.isFinite(k.fatigue)?k.fatigue:null,
    cards:k.cards&&typeof k.cards==='object'?clone(k.cards):null,
    suspensions:Array.isArray(k.suspensions)?k.suspensions.slice():null,
    injuries:Array.isArray(k.injuries)?k.injuries.slice():null
  };
}
function metricSnapshot(sim,t){
  const tm=sim.teams[t],oppTm=sim.teams[1-t],own=sim.stats[t],opp=sim.stats[1-t],ps=activePlayers(tm).filter(p=>!p.isGK),oppPs=activePlayers(oppTm).filter(p=>!p.isGK);
  const ownPoss=own.possTime||0,oppPoss=opp.possTime||0,totalPoss=ownPoss+oppPoss;
  const yellowPlayers=ps.filter(p=>p.yellow>0),oppYellow=oppPs.filter(p=>p.yellow>0);
  const line=tm.instructions&&tm.instructions.outOfPossession?tm.instructions.outOfPossession.defensiveLine:(tm._axes?tm._axes.line:50);
  const press=tm.instructions&&tm.instructions.outOfPossession?tm.instructions.outOfPossession.pressing:(tm._axes?tm._axes.press:50);
  const zones=[0,0,0,0,0];for(const p of ps){const y=C(p.y||0,0,67.999),z=Math.min(4,Math.floor(y/13.6));zones[z]++;}
  const wide=ps.filter(p=>['LW','RW','LM','RM','LWB','RWB'].includes(p.slotPos)||['LW','RW','LM','RM'].includes(p.ipPos));
  let disconnected=null;for(const p of wide){const distance=nearestMateDistance(tm,p);const score=distance+(6.4-(p.rating||6))*3;if(distance>14&&(!disconnected||score>disconnected.score))disconnected={id:playerId(p),name:playerName(p),distance:+distance.toFixed(1),side:(p.y||0)<34?'left':'right',score};}
  let mismatch=null;for(const p of ps){const reason=roleMismatch(p);if(reason){mismatch={id:playerId(p),name:playerName(p),reason,slot:p.slotPos,ipRole:p.ipRole,ipDuty:p.ipDuty,oopRole:p.oopRole,oopDuty:p.oopDuty};break;}}
  let yellowTarget=null;for(const p of yellowPlayers){const side=(p.y||p.dhy||0)<34?'left':'right';const volume=side==='left'?(opp.attacksL||0):(opp.attacksR||0);if(volume>=5&&(!yellowTarget||volume>yellowTarget.volume))yellowTarget={id:playerId(p),name:playerName(p),side,volume};}
  let opponentYellowTarget=null;for(const p of oppYellow){const side=(p.y||p.dhy||0)<34?'left':'right';const volume=side==='left'?(own.attacksL||0):(own.attacksR||0);if(volume>=4&&(!opponentYellowTarget||volume>opponentYellowTarget.volume))opponentYellowTarget={id:playerId(p),name:playerName(p),side,volume};}
  const lowZoneIndex=zones.reduce((best,v,i,a)=>v<a[best]?i:best,0),lowZone=zones[lowZoneIndex]<=1?{index:lowZoneIndex,count:zones[lowZoneIndex],label:['left-wide','left-half','central','right-half','right-wide'][lowZoneIndex]}:null;
  return {
    minute:sim.minute,diff:sim.score[t]-sim.score[1-t],score:sim.score.slice(),
    xgFor:own.xg||0,xgAgainst:opp.xg||0,shotsFor:own.shots||0,shotsAgainst:opp.shots||0,
    onTargetFor:own.onTarget||0,onTargetAgainst:opp.onTarget||0,
    possTimeFor:ownPoss,possTimeAgainst:oppPoss,possession:totalPoss?ownPoss/totalPoss:.5,
    passes:own.passes||0,passOk:own.passOk||0,passAccuracy:own.passes?own.passOk/own.passes:1,
    oppPassAccuracy:opp.passes?opp.passOk/opp.passes:1,
    attacksForL:own.attacksL||0,attacksForR:own.attacksR||0,attacksAgainstL:opp.attacksL||0,attacksAgainstR:opp.attacksR||0,
    crossesAgainst:opp.crosses||0,crossesOkAgainst:opp.crossesOk||0,
    throughAgainst:opp.throughBalls||0,throughOkAgainst:opp.throughOk||0,oneOnOnesAgainst:opp.oneOnOnes||0,
    pressWins:own.pressWins||0,defErrors:own.defErrors||0,gkBadDistribution:own.gkBadDistribution||0,
    stamina:avg(ps,p=>p.stamina,100),yellowCount:yellowPlayers.length,redCount:tm.players.filter(p=>p.red).length,
    lowestStamina:ps.length?Math.min(...ps.map(p=>p.stamina)):100,line,press,
    setPieceThreat:(opp.setPieceShots||0),coherence:tm.coherence?tm.coherence.score:100,
    zones,lowZone,disconnectedWinger:disconnected,roleMismatch:mismatch,yellowTarget,opponentYellowTarget,
    dangerousCrossRate:opp.crosses?(opp.crossesOk||0)/opp.crosses:0
  };
}
function windowDelta(before,after){
  const possFor=after.possTimeFor-before.possTimeFor,possAgainst=after.possTimeAgainst-before.possTimeAgainst,pt=possFor+possAgainst;
  return {xgFor:after.xgFor-before.xgFor,xgAgainst:after.xgAgainst-before.xgAgainst,shotsFor:after.shotsFor-before.shotsFor,shotsAgainst:after.shotsAgainst-before.shotsAgainst,possession:pt?possFor/pt:.5,scoreDelta:after.diff-before.diff};
}
function diagnose(sim,t,m){
  const out=[],add=(code,severity,label,evidence,objective,meta)=>out.push(Object.assign({code,severity:C(severity,0,1),label,evidence,objective,affectedPlayers:[],affectedSectors:[]},meta||{}));
  const oppAttacks=m.attacksAgainstL+m.attacksAgainstR;
  const shotQuality=m.shotsFor?m.xgFor/m.shotsFor:0;
  if(m.redCount>0)add('RED_CARD',.96,'Inferioridade numérica',`${m.redCount} expulsão(ões) alteraram o equilíbrio`,m.diff<0?'attack':'defend',{affectedSectors:['central']});
  if(m.diff<0&&m.minute>=58)add('LOSING_LATE',C(.58+(m.minute-58)/42+Math.min(2,-m.diff)*.1,0,1),'Desvantagem no placar',`Perdendo por ${-m.diff} aos ${Math.floor(m.minute)} minutos`,'attack',{affectedSectors:['attack']});
  if(m.diff>0&&m.minute>=68)add('LEADING_LATE',C(.52+(m.minute-68)/30+m.diff*.08,0,1),'Vantagem a proteger',`Vencendo por ${m.diff} no terço final`,'defend',{affectedSectors:['defence','midfield']});
  if(oppAttacks>=6&&m.attacksAgainstL>m.attacksAgainstR*1.4)add('LEFT_OVERLOAD',C(.5+(m.attacksAgainstL-m.attacksAgainstR)/16,0,1),'Sobrecarga pelo lado esquerdo rival',`${m.attacksAgainstL} ataques contra ${m.attacksAgainstR}`,'defend',{affectedSectors:['left']});
  if(oppAttacks>=6&&m.attacksAgainstR>m.attacksAgainstL*1.4)add('RIGHT_OVERLOAD',C(.5+(m.attacksAgainstR-m.attacksAgainstL)/16,0,1),'Sobrecarga pelo lado direito rival',`${m.attacksAgainstR} ataques contra ${m.attacksAgainstL}`,'defend',{affectedSectors:['right']});
  if(m.line>=64&&(m.oneOnOnesAgainst+m.throughOkAgainst)>=3)add('HIGH_LINE_EXPOSED',C(.55+(m.oneOnOnesAgainst+m.throughOkAgainst)/14,0,1),'Linha alta vulnerável',`${m.oneOnOnesAgainst} um contra um e ${m.throughOkAgainst} bolas em profundidade`,'defend',{affectedSectors:['defensive-line']});
  if(m.minute>=22&&m.possession<.43&&m.xgAgainst>m.xgFor+.25)add('MIDFIELD_INFERIORITY',C(.5+(.43-m.possession)*2+(m.xgAgainst-m.xgFor)*.16,0,1),'Meio-campo em inferioridade',`${Math.round(m.possession*100)}% de posse e desvantagem territorial`,'control',{affectedSectors:['midfield']});
  if(m.minute>=28&&m.shotsFor<=3&&m.xgFor<.48)add('ISOLATED_ATTACK',C(.58+(3-m.shotsFor)*.08,0,1),'Ataque isolado',`${m.shotsFor} finalizações e ${m.xgFor.toFixed(2)} xG`,'attack',{affectedSectors:['attack']});
  if(m.disconnectedWinger&&m.minute>=18)add('WINGER_DISCONNECTED',C(.52+(m.disconnectedWinger.distance-14)/20,0,1),'Ponta desconectado',`${m.disconnectedWinger.name} está a ${m.disconnectedWinger.distance} m do apoio mais próximo`,'attack',{affectedPlayers:[m.disconnectedWinger],affectedSectors:[m.disconnectedWinger.side]});
  if(m.minute>=20&&m.passAccuracy<.72&&(m.gkBadDistribution>=1||m.defErrors>=1))add('BUILDUP_FAIL',C(.55+(.72-m.passAccuracy)*1.8,0,1),'Saída de bola falhando',`${Math.round(m.passAccuracy*100)}% de passe e ${m.gkBadDistribution} erros do goleiro`,'control',{affectedSectors:['build-up']});
  if(m.gkBadDistribution>=2&&m.minute>=18)add('GK_DISTRIBUTION_FAIL',C(.58+m.gkBadDistribution*.05,0,1),'Goleiro errando reposições',`${m.gkBadDistribution} perdas originadas na distribuição`,'control',{affectedSectors:['goalkeeper','build-up']});
  if(m.minute>=26&&m.press>=68&&m.pressWins<3)add('PRESS_INEFFECTIVE',C(.5+(m.press-68)/80,0,1),'Pressão ineficiente',`Pressão ${Math.round(m.press)} com apenas ${m.pressWins} recuperações`,'defend',{affectedSectors:['pressing']});
  if(m.shotsFor>=8&&shotQuality<.085)add('POOR_SHOT_QUALITY',C(.55+(.085-shotQuality)*4,0,1),'Finalizações de baixa qualidade',`${m.shotsFor} chutes para ${m.xgFor.toFixed(2)} xG`,'attack',{affectedSectors:['final-third']});
  if(m.stamina<61)add('FATIGUE',C(.55+(61-m.stamina)/18,0,1),'Fadiga coletiva',`Média física em ${m.stamina.toFixed(1)}%`,'control',{affectedSectors:['all']});
  if(m.yellowTarget)add('YELLOW_TARGETED',C(.54+m.yellowTarget.volume/25,0,1),'Jogador amarelado sob ataque',`${m.yellowTarget.name} está amarelado e recebeu ${m.yellowTarget.volume} ataques pelo setor`,'defend',{affectedPlayers:[m.yellowTarget],affectedSectors:[m.yellowTarget.side]});
  else if(m.yellowCount>=2&&m.minute>=45)add('YELLOW_RISK',C(.48+m.yellowCount*.08,0,1),'Risco disciplinar',`${m.yellowCount} jogadores amarelados`,'defend');
  if(m.opponentYellowTarget)add('EXPLOIT_YELLOW',C(.52+m.opponentYellowTarget.volume/24,0,1),'Adversário amarelado vulnerável',`${m.opponentYellowTarget.name} está amarelado no corredor ${m.opponentYellowTarget.side}`,'attack',{affectedPlayers:[m.opponentYellowTarget],affectedSectors:[m.opponentYellowTarget.side]});
  if(m.crossesAgainst>=7&&m.dangerousCrossRate>.34)add('DANGEROUS_CROSSES',C(.5+m.crossesOkAgainst/12,0,1),'Cruzamentos adversários perigosos',`${m.crossesOkAgainst}/${m.crossesAgainst} cruzamentos encontraram alvo`,'defend',{affectedSectors:['wide','box']});
  if(m.lowZone&&m.minute>=20)add('LOW_ZONE_OCCUPANCY',C(.48+(1-m.lowZone.count)*.12,0,1),'Baixa ocupação de zona',`Zona ${m.lowZone.label} possui ${m.lowZone.count} jogador(es)`,'control',{affectedSectors:[m.lowZone.label]});
  if(m.roleMismatch)add('ROLE_MISMATCH',.62,'Função incompatível',`${m.roleMismatch.name}: ${m.roleMismatch.reason}`,'control',{affectedPlayers:[m.roleMismatch],affectedSectors:['role-structure']});
  if(m.coherence<80)add('TACTICAL_CONFLICT',C(.5+(80-m.coherence)/40,0,1),'Instruções conflitantes',`Coerência tática ${m.coherence}/100`,'control',{affectedSectors:['team-structure']});
  return out.sort((a,b)=>b.severity-a.severity);
}
function snapshotTeamState(tm){return{preset:tm.instructionPreset,instructions:clone(tm.instructions),axes:clone(tm._axes),defForm:tm.defForm,defVar:tm.defVar||0,atkForm:tm.atkForm,atkVar:tm.atkVar||0,sideShift:clone(tm.managerAI&&tm.managerAI.sideShift||null),attackFocus:clone(tm.managerAI&&tm.managerAI.attackFocus||null),pressOrientation:clone(tm.managerAI&&tm.managerAI.pressOrientation||null),roles:tm.players.map(p=>({id:playerId(p),inPossession:{position:p.ipPos,role:p.ipRole,duty:p.ipDuty},outOfPossession:{position:p.oopPos,role:p.oopRole,duty:p.oopDuty}}))};}
function availableForm(key){return !!(root.FORMATIONS&&root.FORMATIONS[key]);}
function actionFor(d,sim,t,profile){
  const m=metricSnapshot(sim,t),bold=profile.riskTolerance>=65,target=d.affectedPlayers&&d.affectedPlayers[0];
  switch(d.code){
    case 'RED_CARD':return{id:'red_compact',label:'Reorganizar após expulsão',objective:m.diff<0?'attack':'defend',preset:m.diff<0?'counter':'lowBlock',shape:{def:'5-3-2',atk:m.diff<0?'3-4-3':'5-3-2'},axes:{press:-12,width:-8,line:m.diff<0?-4:-12,posture:m.diff<0?4:-12},intensity:'high',sectors:['central'],expected:'Reduzir espaços centrais sem abandonar a transição'};
    case 'LOSING_LATE':return{id:bold?'all_out_attack':'structured_chase',label:bold?'Ataque total':'Busca estruturada do empate',objective:'attack',preset:bold?'highPress':'counter',shape:{def:bold?'3-4-3':'4-2-3-1',atk:bold?'4-2-4':'4-2-3-1'},axes:{press:bold?14:8,line:bold?12:7,tempo:bold?12:7,posture:bold?16:9},sub:'attack',intensity:bold?'very-high':'high',sectors:['attack'],expected:'Aumentar xG, presença de área e recuperações altas'};
    case 'LEADING_LATE':return{id:'protect_lead',label:'Proteger a vantagem',objective:'defend',preset:profile.defensivePreference>=65?'lowBlock':'possession',shape:{def:profile.defensivePreference>=65?'5-4-1':'4-5-1',atk:'4-3-3'},axes:{press:-9,line:-12,tempo:-8,posture:-10},sub:'defend',intensity:'high',sectors:['defence','midfield'],expected:'Reduzir xG e finalizações adversárias'};
    case 'LEFT_OVERLOAD':return{id:'reinforce_left',label:'Reforçar corredor esquerdo defensivo',objective:'defend',side:'L',pressOrientation:'left',instructions:{outOfPossession:{preventCross:true,protectBox:true,orientation:'left'}},intensity:'medium',sectors:['left'],expected:'Reduzir progressões e cruzamentos pelo corredor atacado'};
    case 'RIGHT_OVERLOAD':return{id:'reinforce_right',label:'Reforçar corredor direito defensivo',objective:'defend',side:'R',pressOrientation:'right',instructions:{outOfPossession:{preventCross:true,protectBox:true,orientation:'right'}},intensity:'medium',sectors:['right'],expected:'Reduzir progressões e cruzamentos pelo corredor atacado'};
    case 'HIGH_LINE_EXPOSED':return{id:'drop_line',label:'Baixar linha e proteger profundidade',objective:'defend',preset:'balanced',axes:{line:-16,press:-6},shape:{def:'4-1-4-1',atk:sim.teams[t].atkForm||'4-3-3'},intensity:'high',sectors:['defensive-line'],expected:'Reduzir um contra um e bolas nas costas'};
    case 'MIDFIELD_INFERIORITY':return{id:'add_midfield',label:'Adicionar volante e presença no meio',objective:'control',preset:'possession',shape:{def:'4-1-4-1',atk:'4-2-3-1'},axes:{width:-7,tempo:-4,press:4},intensity:'high',sectors:['midfield'],expected:'Recuperar posse e conexões centrais'};
    case 'ISOLATED_ATTACK':return{id:'add_attacker',label:'Adicionar atacante e aproximar o setor',objective:'attack',preset:'wings',shape:{def:'4-2-3-1',atk:'4-2-4'},axes:{posture:8,width:7,tempo:5},sub:'attack',intensity:'high',sectors:['attack'],expected:'Aumentar finalizações e entradas no último terço'};
    case 'WINGER_DISCONNECTED':return{id:'reconnect_winger_'+(target&&target.id),label:'Reconectar ponta ao bloco',objective:'attack',playerRole:target&&{id:target.id,inPossession:{role:'inside_forward',duty:'support'},outOfPossession:{role:'track_wide',duty:'support'}},axes:{width:-5},attackFocus:target&&target.side,intensity:'medium',players:target?[target]:[],sectors:target?[target.side]:['wide'],expected:'Criar apoios curtos e aproximar o ponta da zona de criação'};
    case 'BUILDUP_FAIL':return{id:'bypass_press',label:'Contornar a pressão rival',objective:'control',preset:'counter',instructions:{inPossession:{buildup:{method:'direct'},progression:{passLength:68,verticality:66}},transition:{goalkeeperDistribution:'long'}},intensity:'medium',sectors:['build-up'],expected:'Reduzir perdas na saída e avançar com segurança'};
    case 'GK_DISTRIBUTION_FAIL':return{id:'change_gk_distribution',label:'Alterar distribuição do goleiro',objective:'control',instructions:{transition:{goalkeeperDistribution:'long'},inPossession:{buildup:{useGoalkeeper:false,method:'direct'}}},intensity:'medium',sectors:['goalkeeper','build-up'],expected:'Retirar o goleiro da zona de pressão e reduzir perdas perigosas'};
    case 'PRESS_INEFFECTIVE':return{id:'reset_press',label:'Reorganizar e orientar a pressão',objective:'defend',preset:'balanced',axes:{press:-14,line:-6},pressOrientation:m.attacksAgainstL>m.attacksAgainstR?'left':m.attacksAgainstR>m.attacksAgainstL?'right':'centre',instructions:{transition:{afterLoss:'regroup'},outOfPossession:{orientation:m.attacksAgainstL>m.attacksAgainstR?'left':m.attacksAgainstR>m.attacksAgainstL?'right':'balanced'}},intensity:'medium',sectors:['pressing'],expected:'Reduzir desgaste e recuperar compactação'};
    case 'POOR_SHOT_QUALITY':return{id:'work_ball',label:'Trabalhar melhor as chances',objective:'attack',preset:'possession',crossType:'cutback',instructions:{inPossession:{finalThird:{workBall:true,earlyShots:false,longShots:'balanced',crossType:'cutback'}}},intensity:'medium',sectors:['final-third'],expected:'Aumentar xG por finalização'};
    case 'FATIGUE':return{id:'manage_fatigue',label:'Gerir fadiga e renovar energia',objective:'control',preset:'balanced',axes:{press:-12,tempo:-8},sub:'physical',intensity:'medium',sectors:['all'],expected:'Estabilizar intensidade e substituir jogador exausto'};
    case 'YELLOW_TARGETED':return{id:'protect_targeted_yellow_'+(target&&target.id),label:'Proteger jogador amarelado atacado',objective:'defend',playerRole:target&&{id:target.id,outOfPossession:{duty:'defend'}},pressOrientation:target&&target.side,sub:'disciplinary',intensity:'high',players:target?[target]:[],sectors:target?[target.side]:[],expected:'Reduzir duelos isolados e risco de expulsão'};
    case 'YELLOW_RISK':return{id:'disciplinary_sub',label:'Proteger jogador amarelado',objective:'defend',sub:'disciplinary',intensity:'medium',expected:'Reduzir risco de expulsão'};
    case 'EXPLOIT_YELLOW':return{id:'exploit_yellow_'+(target&&target.id),label:'Explorar adversário amarelado',objective:'attack',attackFocus:target&&target.side,pressOrientation:target&&target.side,instructions:{inPossession:{buildup:{focus:'wide'},progression:{width:76,carryMore:true}},outOfPossession:{orientation:target&&target.side||'balanced'}},intensity:'high',players:target?[target]:[],sectors:target?[target.side]:[],expected:'Forçar duelos e decisões defensivas no setor do adversário amarelado'};
    case 'DANGEROUS_CROSSES':return{id:'stop_dangerous_crosses',label:'Bloquear cruzamentos perigosos',objective:'defend',crossType:'low',pressOrientation:m.attacksAgainstL>=m.attacksAgainstR?'left':'right',instructions:{outOfPossession:{preventCross:true,protectBox:true,marking:'mixed',orientation:m.attacksAgainstL>=m.attacksAgainstR?'left':'right'}},axes:{width:8,line:-5},intensity:'high',sectors:['wide','box'],expected:'Reduzir cruzamentos limpos e duelos aéreos adversários'};
    case 'LOW_ZONE_OCCUPANCY':return{id:'occupy_zone_'+(d.affectedSectors&&d.affectedSectors[0]),label:'Reocupar zona vazia',objective:'control',attackFocus:d.affectedSectors&&d.affectedSectors[0],axes:{width:4},intensity:'medium',sectors:d.affectedSectors||[],expected:'Restaurar cobertura e linha de passe na zona pouco ocupada'};
    case 'ROLE_MISMATCH':return{id:'fix_role_'+(target&&target.id),label:'Corrigir função incompatível',objective:'control',playerRole:target&&{id:target.id,inPossession:{position:target.slot,role:target.ipRole||'support',duty:'support'},outOfPossession:{position:target.slot,role:target.oopRole||'cover',duty:'defend'}},intensity:'medium',players:target?[target]:[],sectors:['role-structure'],expected:'Alinhar função e dever à posição real do jogador'};
    case 'TACTICAL_CONFLICT':return{id:'restore_coherence',label:'Restaurar coerência tática',objective:'control',preset:'balanced',intensity:'medium',sectors:['team-structure'],expected:'Eliminar instruções contraditórias'};
  }
  return null;
}
function applyAxes(sim,t,mods){if(!mods||typeof sim.setAxes!=='function')return false;const tm=sim.teams[t],a=Object.assign({line:50,press:50,width:50,tempo:50,posture:50},tm._axes||{});for(const k of ['line','press','width','tempo','posture'])if(Number.isFinite(mods[k]))a[k]=C((a[k]==null?50:a[k])+mods[k],0,100);return sim.setAxes(t,a);}
function restoreShift(tm,state,key,classes){const cur=state[key];if(cur&&cur.delta){for(const p of tm.players){if(p.isGK||!classes(p))continue;p.dhy-=cur.delta;p.hy-=cur.delta;p.ahy-=cur.delta;}}state[key]=null;}
function shiftSide(tm,state,side){
  restoreShift(tm,state,'sideShift',p=>LINE[p.slotPos]==='DEF'||p.slotPos==='CDM');
  if(!side)return;
  const delta=side==='L'||side==='left'?-2.6:2.6;
  for(const p of tm.players){if(p.isGK)continue;if(LINE[p.slotPos]==='DEF'||p.slotPos==='CDM'){p.dhy=C(p.dhy+delta,2,66);p.hy=C(p.hy+delta,2,66);p.ahy=C(p.ahy+delta,2,66);}}
  state.sideShift={side,delta};
}
function shiftAttackFocus(tm,state,side){
  restoreShift(tm,state,'attackFocus',p=>LINE[p.slotPos]==='FWD'||LINE[p.slotPos]==='MID');
  if(!side||side==='central'||side==='centre')return;
  const left=String(side).includes('left'),right=String(side).includes('right');if(!left&&!right)return;
  const delta=left?-2.2:2.2;
  for(const p of tm.players){if(p.isGK)continue;const ln=LINE[p.slotPos];if(ln==='FWD'||ln==='MID'){p.ahy=C(p.ahy+delta,2,66);p.hy=C(p.hy+delta*.45,2,66);p.dhy=C(p.dhy+delta*.25,2,66);}}
  state.attackFocus={side,delta};
}
function orientPress(tm,state,side){
  restoreShift(tm,state,'pressOrientation',p=>LINE[p.slotPos]==='FWD'||LINE[p.slotPos]==='MID');
  if(!side||side==='balanced'||side==='centre'||side==='central')return;
  const delta=String(side).includes('left')?-1.8:1.8;
  for(const p of tm.players){if(p.isGK)continue;const ln=LINE[p.slotPos];if(ln==='FWD'||ln==='MID'){p.dhy=C(p.dhy+delta,2,66);p.hy=C(p.hy+delta,2,66);}}
  state.pressOrientation={side,delta};
}
function applyPlayerRole(sim,t,change){if(!change||change.id==null||typeof sim.setPlayerPhaseRole!=='function')return null;const tm=sim.teams[t],p=tm.players.find(x=>playerId(x)===change.id||String(playerId(x))===String(change.id));if(!p)return null;const before={id:playerId(p),name:playerName(p),inPossession:{position:p.ipPos||p.slotPos,role:p.ipRole||p.role||'support',duty:p.ipDuty||'support'},outOfPossession:{position:p.oopPos||p.slotPos,role:p.oopRole||'cover',duty:p.oopDuty||'defend'}};if(!p.phaseRole)p.phaseRole=clone({inPossession:before.inPossession,outOfPossession:before.outOfPossession});const payload={};if(change.inPossession)payload.inPossession=Object.assign({},before.inPossession,change.inPossession);if(change.outOfPossession)payload.outOfPossession=Object.assign({},before.outOfPossession,change.outOfPossession);for(const phase of ['inPossession','outOfPossession'])if(payload[phase])for(const k of Object.keys(payload[phase]))if(payload[phase][k]==null)delete payload[phase][k];const after=sim.setPlayerPhaseRole(t,p.idx,payload);return after?{before,after:clone(after)}:null;}
function bestBench(tm,wantedLine){let bi=-1,best=-1;for(let i=0;i<(tm.bench||[]).length;i++){const b=tm.bench[i],ln=LINE[b.slot||b.pos]||'MID';if((b.slot||b.pos)==='GK')continue;const fit=ln===wantedLine?12:wantedLine==='FWD'&&ln==='MID'?4:wantedLine==='DEF'&&ln==='MID'?2:0;const score=(b.r||60)+fit;if(score>best){best=score;bi=i;}}return bi;}
function chooseOut(tm,mode){let idx=-1,score=1e9;for(let i=0;i<tm.players.length;i++){const p=tm.players[i];if(p.red||p.isGK)continue;const ln=LINE[p.slotPos]||'MID';let s=(p.rating||6)*10+p.stamina*.25+(p.ref.r||60)*.15;if(mode==='attack'&&ln==='DEF')s-=16;if(mode==='defend'&&ln==='FWD')s-=14;if(mode==='physical')s=p.stamina+(p.rating||6)*2;if(mode==='disciplinary')s=p.yellow?0+(p.rating||6):100+(p.rating||6);if(s<score){score=s;idx=i;}}return idx;}
function makeSubstitution(sim,t,mode){const tm=sim.teams[t],state=tm.managerAI;if(tm.subsLeft<=0||state.subsMade>=3||!tm.bench||!tm.bench.length)return null;if(sim.minute-state.lastSubMinute<11)return null;const critical=tm.players.some(p=>!p.red&&!p.isGK&&p.stamina<44);if(mode!=='disciplinary'&&!critical&&sim.minute<state.profile.substitutionTiming-6)return null;const outIdx=chooseOut(tm,mode),out=tm.players[outIdx];if(!out)return null;let wanted=LINE[out.slotPos]||'MID';if(mode==='attack')wanted='FWD';else if(mode==='defend')wanted='DEF';const bi=bestBench(tm,wanted);if(bi<0)return null;const incoming=tm.bench[bi],outName=out.ref&&out.ref.n,inName=incoming.n;if(!sim.substitute(t,outIdx,incoming))return null;blankManagerStats(sim.stats[t]).managerSubstitutions++;state.subsMade++;state.lastSubMinute=sim.minute;return{out:outName,in:inName,mode};}
function evaluateChange(sim,t,force){const tm=sim.teams[t],state=tm.managerAI,pending=state.pendingEvaluation;if(!pending)return null;const elapsed=sim.minute-pending.minute;if(!force&&elapsed<state.profile.reviewMinutes)return null;const after=metricSnapshot(sim,t),d=windowDelta(pending.before,after);let score=0;if(pending.objective==='attack')score=d.xgFor*1.35+d.shotsFor*.07-d.xgAgainst*.55;else if(pending.objective==='defend')score=-d.xgAgainst*1.45-d.shotsAgainst*.06+d.xgFor*.25;else score=(d.possession-.5)*1.5+d.xgFor*.55-d.xgAgainst*.7;score=C(score,-1,1);const outcome=score>.06?'positive':score<-.08?'negative':'inconclusive',success=outcome==='positive'?true:outcome==='negative'?false:null;const st=blankManagerStats(sim.stats[t]);st.managerEvaluations++;if(outcome==='positive')st.managerSuccessfulChanges++;else if(outcome==='negative')st.managerFailedChanges++;else st.managerInconclusiveChanges++;
  let decision=outcome==='positive'?'maintain':outcome==='negative'?'adjust':'maintain';
  pending.entry.evaluation={minute:Math.floor(sim.minute),score:+score.toFixed(3),outcome,success,window:d,decision};
  sim._emit('manager_evaluation',{team:t,action:pending.action,label:pending.entry.action.label,outcome,success,score,decision});
  if(!success&&score<-.22&&state.profile.adaptability>=75&&!pending.emergency&&!pending.entry.substitution){
    const prev=pending.previous;let restored=false;
    if(prev.instructions&&typeof sim.setTeamInstructions==='function'){try{sim.setTeamInstructions(t,prev.instructions);restored=true;}catch(_){}}
    if(prev.axes&&typeof sim.setAxes==='function'){try{sim.setAxes(t,prev.axes);restored=true;}catch(_){}}
    if(prev.defForm&&prev.atkForm&&typeof sim.setShapes==='function'){try{sim.setShapes(t,prev.defForm,prev.defVar||0,prev.atkForm,prev.atkVar||0);restored=true;}catch(_){}}
    try{shiftSide(tm,state,prev.sideShift&&prev.sideShift.side||null);shiftAttackFocus(tm,state,prev.attackFocus&&prev.attackFocus.side||null);orientPress(tm,state,prev.pressOrientation&&prev.pressOrientation.side||null);restored=true;}catch(_){}
    if(Array.isArray(prev.roles)&&typeof sim.setPlayerPhaseRole==='function')for(const r of prev.roles){try{const rp=tm.players.find(x=>playerId(x)===r.id||String(playerId(x))===String(r.id));if(rp){sim.setPlayerPhaseRole(t,rp.idx,{inPossession:r.inPossession,outOfPossession:r.outOfPossession});restored=true;}}catch(_){}}
    if(restored){st.managerReversals++;pending.entry.reverted=true;pending.entry.evaluation.decision='revert';decision='revert';sim._emit('manager_reversal',{team:t,action:pending.action,reason:'A mudança não melhorou os indicadores'});}
  }
  pending.entry.afterEvaluationConfig=snapshotTeamState(tm);state.pendingEvaluation=null;return pending.entry.evaluation;
}
function knownFoot(p){const r=p&&p.ref||{};return r.foot||r.preferredFoot||r.peDominante||r.dominantFoot||'unknown';}
function preMatchPlan(sim,t){const tm=sim.teams[t],state=tm.managerAI;if(state.preMatch)return state.preMatch;const opp=sim.teams[1-t],profile=state.profile,forwards=opp.players.filter(p=>LINE[p.slotPos]==='FWD'),pace=avg(forwards,p=>(getAttr(p,'ritmo')+getAttr(p,'aceleracao'))/2,60),air=avg(forwards,p=>(getAttr(p,'cabecalho')+getAttr(p,'impulsao'))/2,60),gk=opp.players.find(p=>p.isGK),gkBuild=gk?avg([gk],p=>(getAttr(p,'passe')+getAttr(p,'decisao')+getAttr(p,'visao'))/3,60):null;
  const keys=opp.players.filter(p=>!p.red).slice().sort((a,b)=>(b.ref&&b.ref.r||0)-(a.ref&&a.ref.r||0)).slice(0,3).map(p=>({id:playerId(p),name:playerName(p),position:p.slotPos,overall:p.ref&&p.ref.r||null,dominantFoot:knownFoot(p),likelyRole:{inPossession:p.ipRole||p.role||null,outOfPossession:p.oopRole||null}}));
  const context=visibleTournamentContext(opp),fatigueVisible=Number.isFinite(context.fatigue)?context.fatigue:+avg(opp.players.filter(p=>!p.red),p=>100-p.stamina,0).toFixed(1),cards=context.cards||{yellow:opp.players.filter(p=>p.yellow).map(p=>playerName(p)),red:opp.players.filter(p=>p.red).map(p=>playerName(p))},suspensions=context.suspensions,injuries=context.injuries||opp.players.filter(p=>p._injured).map(p=>playerName(p));
  let preset='balanced',reason='Plano equilibrado para iniciar a leitura da partida';if(profile.key==='aggressive')preset='highPress',reason='Perfil agressivo: pressionar a primeira construção';else if(profile.key==='possession')preset='possession',reason='Perfil controlador: dominar bola e território';else if(gkBuild!=null&&gkBuild<55&&profile.pressingPreference>=60)preset='highPress',reason='Goleiro adversário limitado com a bola: orientar pressão sobre a saída';else if(pace>=78)preset='counter',reason='Ataque adversário veloz: controlar profundidade e transitar';else if(profile.defensivePreference>=68)preset='lowBlock',reason='Perfil pragmático: proteger zonas centrais';
  if(typeof sim.setTeamInstructions==='function')sim.setTeamInstructions(t,preset);
  if(air>=76&&typeof sim.setTeamInstructions==='function')sim.setTeamInstructions(t,{outOfPossession:{preventCross:true,protectBox:true}});
  if(pace>=78)applyAxes(sim,t,{line:-9,press:-3});if(gkBuild!=null&&gkBuild<55)orientPress(tm,state,'centre');
  state.preMatch={minute:0,preset,reason,opponent:{name:opp.name,form:{inPossession:opp.atkForm||null,outOfPossession:opp.defForm||null},style:opp.styleKey||null,keyPlayers:keys,pace:+pace.toFixed(1),aerial:+air.toFixed(1),goalkeeperBuild:gkBuild==null?null:+gkBuild.toFixed(1),recentResults:context.recentResults,fatigue:fatigueVisible,cards,suspensions:suspensions||'unknown',injuries:injuries||'unknown'}};
  const evidence=[`Velocidade ofensiva rival ${pace.toFixed(1)}`,`Ameaça aérea ${air.toFixed(1)}`,`Jogadores-chave: ${keys.map(k=>k.name).join(', ')||'não identificados'}`,`Goleiro com a bola: ${gkBuild==null?'desconhecido':gkBuild.toFixed(1)}`,`Contexto recente: ${context.recentResults?context.recentResults.join(', '):'desconhecido'}`];
  const entry={minute:0,type:'pre_match',diagnosis:'Plano pré-jogo',evidence,affectedPlayers:keys,affectedSectors:['team-plan'],intensity:'baseline',action:{id:'pre_match_'+preset,label:'Plano '+preset},expected:reason,decision:'maintain'};state.history.push(entry);blankManagerStats(sim.stats[t]).managerPreMatchPlans++;sim._emit('manager_plan',{team:t,profile:profile.label,preset,reason,evidence});return state.preMatch;
}
function applyAction(sim,t,diag,action){const tm=sim.teams[t],state=tm.managerAI,previous=snapshotTeamState(tm);let changed=false,substitution=null,roleChange=null;
  if(action.preset&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,action.preset);changed=true;}
  if(action.instructions&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,action.instructions);changed=true;}
  if(action.crossType&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,{inPossession:{finalThird:{crossType:action.crossType}}});blankManagerStats(sim.stats[t]).managerCrossChanges++;changed=true;}
  if(action.axes){applyAxes(sim,t,action.axes);changed=true;}
  if(action.shape&&typeof sim.setShapes==='function'){const df=availableForm(action.shape.def)?action.shape.def:tm.defForm,af=availableForm(action.shape.atk)?action.shape.atk:tm.atkForm;try{sim.setShapes(t,df||'4-3-3',0,af||'4-3-3',0);changed=true;}catch(_){}}
  if(action.side){shiftSide(tm,state,action.side);changed=true;}
  if(action.attackFocus){shiftAttackFocus(tm,state,action.attackFocus);changed=true;}
  if(action.pressOrientation){orientPress(tm,state,action.pressOrientation);blankManagerStats(sim.stats[t]).managerPressOrientations++;changed=true;}
  if(action.playerRole){roleChange=applyPlayerRole(sim,t,action.playerRole);if(roleChange){const st=blankManagerStats(sim.stats[t]);st.managerRoleChanges++;if(JSON.stringify(roleChange.before.inPossession)!==JSON.stringify(roleChange.after.inPossession)||JSON.stringify(roleChange.before.outOfPossession)!==JSON.stringify(roleChange.after.outOfPossession))st.managerDutyChanges++;changed=true;}}
  if(action.sub&&sim.minute-state.lastSubMinute>=6){substitution=makeSubstitution(sim,t,action.sub);if(substitution)changed=true;}
  if(!changed)return null;
  const now=metricSnapshot(sim,t),entry={minute:Math.floor(sim.minute),type:'change',diagnosis:diag.label,diagnosisCode:diag.code,evidence:[diag.evidence],severity:+diag.severity.toFixed(3),affectedPlayers:clone(action.players||diag.affectedPlayers||[]),affectedSectors:clone(action.sectors||diag.affectedSectors||[]),intensity:action.intensity||'medium',action:{id:action.id,label:action.label},expected:action.expected,substitution,roleChange,beforeConfig:previous,afterConfig:snapshotTeamState(tm),decision:'pending'};
  if(entry.affectedPlayers.length)blankManagerStats(sim.stats[t]).managerTargetedPlayers+=entry.affectedPlayers.length;
  state.history.push(entry);state.lastActionMinute=sim.minute;state.tried[action.id]=sim.minute;state.currentDiagnosis=diag;blankManagerStats(sim.stats[t]).managerChanges++;
  state.pendingEvaluation={minute:sim.minute,action:action.id,objective:action.objective,before:now,previous,entry,emergency:['RED_CARD','LOSING_LATE','LEADING_LATE'].includes(diag.code)};
  sim._emit('manager_change',{team:t,profile:state.profile.label,diagnosis:diag.label,action:action.label,expected:action.expected,substitution,affectedPlayers:entry.affectedPlayers,affectedSectors:entry.affectedSectors,intensity:entry.intensity});return entry;
}
const Q=M.prototype;Q.__P9__=true;
const oldBuild=Q._buildTeam;Q._buildTeam=function(source,side){const tm=oldBuild.call(this,source,side);tm.managerAI={profile:deriveProfile(source,tm),knowledge:clone(source&&((source.managerKnowledge)||(source.tournamentContext)||(source.phase9Context))||{}),preMatch:null,history:[],diagnoses:[],currentDiagnosis:null,pendingEvaluation:null,lastThinkMinute:-99,lastActionMinute:-99,lastSubMinute:-99,lastNoActionMinute:-99,subsMade:0,tried:Object.create(null),sideShift:null,attackFocus:null,pressOrientation:null};return tm;};
const oldBlank=Q._blankStats;Q._blankStats=function(){return blankManagerStats(oldBlank.call(this));};
const oldInteractive=Q.setInteractive;Q.setInteractive=function(team){const out=oldInteractive.call(this,team);if(this._aiTeam===0||this._aiTeam===1)preMatchPlan(this,this._aiTeam);return out;};
Q.setManagerProfile=function(team,profile){const tm=this.teams[team];if(!tm)return false;tm.managerAI=tm.managerAI||{};tm.managerAI.profile=typeof profile==='string'&&PROFILE_TEMPLATES[profile]?clone(PROFILE_TEMPLATES[profile]):Object.assign({},tm.managerAI.profile||PROFILE_TEMPLATES.adaptive,clone(profile||{}));return clone(tm.managerAI.profile);};
Q._phase9Evaluate=function(team,force){return evaluateChange(this,team,!!force);};
function recordNoAction(sim,t,state,diag,reason){if(sim.minute-state.lastNoActionMinute<4)return null;const entry={minute:Math.floor(sim.minute),type:'no_action',diagnosis:diag&&diag.label||'Sem diagnóstico prioritário',diagnosisCode:diag&&diag.code||null,evidence:diag?[diag.evidence]:[],affectedPlayers:clone(diag&&diag.affectedPlayers||[]),affectedSectors:clone(diag&&diag.affectedSectors||[]),intensity:'none',action:{id:'hold',label:'Manter configuração'},expected:reason,decision:'maintain'};state.history.push(entry);state.lastNoActionMinute=sim.minute;blankManagerStats(sim.stats[t]).managerNoActions++;return entry;}
Q._phase9Think=function(team,force){const t=team===1?1:0,tm=this.teams[t],state=tm.managerAI;if(!state)return null;preMatchPlan(this,t);evaluateChange(this,t,false);const interval=C(10-state.profile.adaptability/30,6,9);if(!force&&this.minute-state.lastThinkMinute<interval)return null;state.lastThinkMinute=this.minute;const metrics=metricSnapshot(this,t),diags=diagnose(this,t,metrics);state.diagnoses=diags.slice(0,7);const st=blankManagerStats(this.stats[t]);st.managerAnalyses++;st.managerDiagnoses+=diags.length;if(!diags.length)return recordNoAction(this,t,state,null,'Nenhuma evidência atingiu o limiar de intervenção');
  const emergency=diags[0].severity>=.9;const changeLimit=emergency?6:5;if(st.managerChanges>=changeLimit)return recordNoAction(this,t,state,diags[0],`Limite de ${changeLimit} intervenções autônomas atingido; manter estrutura`);if(state.pendingEvaluation&&!emergency)return recordNoAction(this,t,state,diags[0],'Mudança anterior ainda está em período mínimo de avaliação');
  const cooldown=C(state.profile.persistence-(state.profile.adaptability-50)/12,8,16);if(!force&&!emergency&&this.minute-state.lastActionMinute<cooldown)return recordNoAction(this,t,state,diags[0],'Persistir na mudança anterior antes de novo ajuste');
  let chosen=null;for(const d of diags){const a=actionFor(d,this,t,state.profile);if(!a)continue;const last=state.tried[a.id],repeatWindow=state.profile.persistence+(d.code==='LOSING_LATE'?9:7);if(last!=null&&this.minute-last<repeatWindow)continue;const personality=(a.objective==='attack'?(state.profile.riskTolerance*.7+state.profile.aggression*.3):a.objective==='defend'?state.profile.defensivePreference:state.profile.possessionPreference)/100*.1;const score=d.severity+personality;if(score>=state.profile.evidenceThreshold&&(!chosen||score>chosen.score))chosen={diag:d,action:a,score};}
  if(!chosen)return recordNoAction(this,t,state,diags[0],'Evidência insuficiente ou resposta já utilizada recentemente');return applyAction(this,t,chosen.diag,chosen.action);
};
Q.getManagerData=function(team){const t=team===1?1:0,tm=this.teams[t],s=blankManagerStats(this.stats[t]),state=tm.managerAI;return{version:VERSION,team:t,profile:clone(state.profile),knowledge:clone(state.knowledge),preMatch:clone(state.preMatch),currentDiagnosis:clone(state.currentDiagnosis),diagnoses:clone(state.diagnoses),pendingEvaluation:state.pendingEvaluation?{minute:state.pendingEvaluation.minute,action:state.pendingEvaluation.action,objective:state.pendingEvaluation.objective,entry:clone(state.pendingEvaluation.entry)}:null,history:clone(state.history),metrics:{analyses:s.managerAnalyses,diagnoses:s.managerDiagnoses,changes:s.managerChanges,substitutions:s.managerSubstitutions,evaluations:s.managerEvaluations,successful:s.managerSuccessfulChanges,failed:s.managerFailedChanges,inconclusive:s.managerInconclusiveChanges,reversals:s.managerReversals,preMatchPlans:s.managerPreMatchPlans,noActions:s.managerNoActions,roleChanges:s.managerRoleChanges,dutyChanges:s.managerDutyChanges,pressOrientations:s.managerPressOrientations,crossChanges:s.managerCrossChanges,targetedPlayers:s.managerTargetedPlayers,stateExports:s.managerStateExports,stateImports:s.managerStateImports}};};
Q._aiReact=function(){const t=this._aiTeam;if(t===0||t===1)this._phase9Think(t,false);};
const oldAdvanced=Q.getAdvancedData;Q.getAdvancedData=function(team){const out=oldAdvanced?oldAdvanced.call(this,team):{};out.engineVersion=VERSION;out.phase9=this.getManagerData(team);return out;};
Q.exportManagerState=function(team){const t=team===1?1:0,tm=this.teams[t],state=tm&&tm.managerAI;if(!state)return null;blankManagerStats(this.stats[t]).managerStateExports++;return{version:VERSION,team:t,state:clone(state),teamConfig:snapshotTeamState(tm)};};
Q.importManagerState=function(team,payload){const t=team===1?1:0,tm=this.teams[t];if(!tm||!payload||!payload.state)return false;const incoming=clone(payload.state),cfg=clone(payload.teamConfig||null);incoming.profile=Object.assign({},PROFILE_TEMPLATES.adaptive,incoming.profile||{});incoming.history=Array.isArray(incoming.history)?incoming.history:[];incoming.diagnoses=Array.isArray(incoming.diagnoses)?incoming.diagnoses:[];incoming.tried=incoming.tried||Object.create(null);const savedSide=incoming.sideShift&&incoming.sideShift.side,savedAttack=incoming.attackFocus&&incoming.attackFocus.side,savedPress=incoming.pressOrientation&&incoming.pressOrientation.side;incoming.sideShift=null;incoming.attackFocus=null;incoming.pressOrientation=null;tm.managerAI=Object.assign(tm.managerAI||{},incoming);try{if(cfg){if(cfg.instructions&&typeof this.setTeamInstructions==='function')this.setTeamInstructions(t,cfg.instructions);if(cfg.axes&&typeof this.setAxes==='function')this.setAxes(t,cfg.axes);if(cfg.defForm&&cfg.atkForm&&typeof this.setShapes==='function')this.setShapes(t,cfg.defForm,cfg.defVar||0,cfg.atkForm,cfg.atkVar||0);if(Array.isArray(cfg.roles)&&typeof this.setPlayerPhaseRole==='function')for(const r of cfg.roles){const rp=tm.players.find(x=>playerId(x)===r.id||String(playerId(x))===String(r.id));if(rp)this.setPlayerPhaseRole(t,rp.idx,{inPossession:r.inPossession,outOfPossession:r.outOfPossession});}}shiftSide(tm,tm.managerAI,savedSide||null);shiftAttackFocus(tm,tm.managerAI,savedAttack||null);orientPress(tm,tm.managerAI,savedPress||null);}catch(_){return false;}blankManagerStats(this.stats[t]).managerStateImports++;return true;};
const oldState=Q.getState;Q.getState=function(){const out=oldState.call(this);out.engineVersion=VERSION;out.phase9=this.teams.map((tm,i)=>({version:VERSION,team:i,state:clone(tm.managerAI),teamConfig:snapshotTeamState(tm)}));return out;};
if(!NODE&&typeof document!=='undefined'){
  const Old=root.MatchSim;class Active extends Old{constructor(){super(...arguments);root.__CDS_ACTIVE_SIM=this;}}root.MatchSim=Active;
  const boot=()=>{if(document.getElementById('p9btn'))return;const css=document.createElement('style');css.textContent='#p9btn{position:fixed;left:12px;bottom:12px;z-index:999999;border:1px solid #64d8ff;border-radius:999px;background:#0b1726;color:#a9edff;padding:9px 12px;font:700 11px system-ui}#p9box{position:fixed;inset:0;z-index:1000001;background:#020712dd;display:none;place-items:end center;padding:12px;color:#fff;font-family:system-ui}#p9box.on{display:grid}#p9box>div{width:min(760px,100%);max-height:86vh;overflow:auto;background:#0b1425;border:1px solid #29536d;border-radius:18px;padding:15px}.p9card{background:#101d30;border:1px solid #203c58;border-radius:10px;padding:10px;margin:8px 0}.p9ev{font-size:12px;color:#b8c9d9;margin-top:4px}';document.head.appendChild(css);const b=document.createElement('button');b.id='p9btn';b.textContent='IA DO TREINADOR 5.2.1';const x=document.createElement('div');x.id='p9box';x.innerHTML='<div><button id="p9close" style="float:right">×</button><h3>Leitura do treinador adversário — 5.2.1</h3><main></main></div>';document.body.append(b,x);const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const paint=()=>{const sim=root.__CDS_ACTIVE_SIM,m=x.querySelector('main');if(!sim)return m.innerHTML='<p>Inicie uma partida.</p>';const side=sim._aiTeam===0?0:1,d=sim.getManagerData(side);m.innerHTML='<div class="p9card"><b>'+esc(d.profile.label)+'</b><div class="p9ev">Adaptabilidade '+d.profile.adaptability+' · Risco '+d.profile.riskTolerance+' · Pressão '+d.profile.pressingPreference+'</div></div>'+(d.currentDiagnosis?'<div class="p9card"><b>Diagnóstico atual</b><div>'+esc(d.currentDiagnosis.label)+'</div><div class="p9ev">'+esc(d.currentDiagnosis.evidence)+'</div></div>':'')+'<h4>Decisões</h4>'+d.history.slice(-8).reverse().map(h=>'<div class="p9card"><b>'+h.minute+'’ · '+esc(h.action&&h.action.label||h.diagnosis)+'</b><div>'+esc(h.diagnosis||'')+'</div><div class="p9ev">'+esc(h.expected||'')+(h.evaluation?' · avaliação '+h.evaluation.score:'')+'</div></div>').join('')+'<p>Análises: '+d.metrics.analyses+' · Mudanças: '+d.metrics.changes+' · Subs: '+d.metrics.substitutions+' · Reversões: '+d.metrics.reversals+'</p>';};b.onclick=()=>{x.classList.add('on');paint();};x.querySelector('#p9close').onclick=()=>x.classList.remove('on');};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
}
const API={VERSION,PROFILES:PROFILE_TEMPLATES,deriveProfile,metricSnapshot,diagnose,actionFor,applyAction,preMatchPlan,getManagerData:(sim,team)=>sim.getManagerData(team),installed:true};root.CDS_PHASE9=API;if(NODE)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
