/* Copa dos Sonhos — Fase 10 · Persistência da Copa
   Cada partida deixa consequências explícitas para a próxima:
   condição, fadiga acumulada, lesões, cartões, suspensões, forma recente,
   confiança contextual, adaptação à função, sequência de gols e preparação.
   Não há moral/química como bônus mágico: os efeitos entram somente nos
   mecanismos que representam (fôlego inicial, execução, leitura, bola parada). */
(function (root) {
'use strict';
const C = (typeof module !== 'undefined' && module.exports) ? require('./20-core.js') : root;
const clamp = C.clamp || ((v,a,b)=>Math.max(a,Math.min(b,v)));
const VERSION = '1.0.0';
const ENGINE_VERSION = '5.3.0';
const STATE_VERSION = 1;

const PREPARATIONS = Object.freeze({
  recovery: Object.freeze({
    key:'recovery', label:'Recuperação física', icon:'🫁',
    description:'+12 de condição e −8 de fadiga acumulada para o elenco. Sem bônus técnico.',
    effects:Object.freeze({ recovery:12, fatigueRelief:8 })
  }),
  tactical: Object.freeze({
    key:'tactical', label:'Treino tático', icon:'🧠',
    description:'+6% de familiaridade nas funções atuais e até +1,2% de execução na próxima partida.',
    effects:Object.freeze({ roleLearning:.06, execution:.012 })
  }),
  setpieces: Object.freeze({
    key:'setpieces', label:'Bolas paradas', icon:'🎯',
    description:'+3,5% de execução em faltas, escanteios e pênaltis na próxima partida.',
    effects:Object.freeze({ setPiece:.035 })
  }),
  finishing: Object.freeze({
    key:'finishing', label:'Finalização', icon:'🥅',
    description:'+2,5% de execução dos chutes na próxima partida. Não altera o atributo permanente.',
    effects:Object.freeze({ shot:.025 })
  }),
  defensive: Object.freeze({
    key:'defensive', label:'Preparação defensiva', icon:'🛡️',
    description:'+2,5% de execução em pressão, cobertura e duelos defensivos na próxima partida.',
    effects:Object.freeze({ defend:.025 })
  })
});

function playerKey(p) {
  if (!p) return null;
  return String(p.id != null ? p.id : (p.n || 'unknown') + '#' + (p.slot || p.pos || ''));
}
function roleKey(slot) {
  if (!slot) return 'unknown|unknown|bal';
  const p = slot.p || slot.ref || slot;
  return [slot.pos || p.slot || p.pos || 'CM', slot.role || 'default', slot.focus || 'bal'].join('|');
}
function stateKey(p, sid) { return String(sid == null ? 'GLOBAL' : sid) + '::' + playerKey(p); }
function blankPlayer(p, sid) {
  return {
    key:stateKey(p,sid), id: playerKey(p), sid: sid || null, name: (p && p.n) || '',
    condition:100, cumulativeFatigue:0,
    injuryMatches:0, injuryType:null, suspensionMatches:0, yellowCards:0,
    recentForm:[], confidence:{ finishing:0, defending:0, decision:0 },
    roleFamiliarity:{}, scoringStreak:0,
    appearances:0, starts:0, benchAppearances:0, minutes:0,
    lastMinutes:0, lastStarted:false, lastRating:6, lastGoals:0,
    lastRole:null, lastMatchIndex:0
  };
}
function blankTeam(sid) {
  return {
    sid, matches:0, pendingPreparation:true, activePreparation:null,
    lastPreparation:null, preparationHistory:[], recoveryAppliedFor:-1,
    knockoutPressure:0, lastExtraTime:false, lastUnavailable:[], lastReplacements:[]
  };
}
function ensureCup(cup, db) {
  if (!cup) return null;
  if (!cup.persistence || cup.persistence.version !== STATE_VERSION) {
    const old = cup.persistence || {};
    cup.persistence = {
      version:STATE_VERSION,
      players:old.players || {}, teams:old.teams || {},
      history:old.history || [], createdAtMatch:old.createdAtMatch || 0
    };
  }
  const P = cup.persistence;
  const sids = [];
  if (cup.groups) for (const g of cup.groups) for (const sid of g.teams || []) if (!sids.includes(sid)) sids.push(sid);
  if (cup.playerSid != null && !sids.includes(cup.playerSid)) sids.push(cup.playerSid);
  if (db && db.byId) for (const sid of sids) {
    const sq = db.byId[sid];
    if (sq) registerTeam(cup, sq, sid);
  }
  return P;
}
function ensureTeam(cup, sid) {
  ensureCup(cup);
  const P = cup.persistence;
  if (!P.teams[sid]) P.teams[sid] = blankTeam(sid);
  return P.teams[sid];
}
function ensurePlayer(cup, p, sid) {
  if (!p) return null;
  ensureCup(cup);
  const key = stateKey(p, sid);
  if (!cup.persistence.players[key]) cup.persistence.players[key] = blankPlayer(p, sid);
  const st = cup.persistence.players[key];
  if (!st.sid && sid) st.sid = sid;
  return st;
}
function registerTeam(cup, squad, sid) {
  sid = sid != null ? sid : (squad && squad.sid);
  if (sid == null) return null;
  const ts = ensureTeam(cup, sid);
  for (const p of (squad && squad.pl) || []) ensurePlayer(cup, p, sid);
  return ts;
}
function status(cup, p, sid) {
  let st;
  if (sid != null) st = ensurePlayer(cup,p,sid);
  else {
    const id=playerKey(p); st=Object.values((ensureCup(cup)||{}).players||{}).find(x=>x.id===id) || ensurePlayer(cup,p,'GLOBAL');
  }
  return {
    available:st.injuryMatches <= 0 && st.suspensionMatches <= 0,
    injured:st.injuryMatches > 0, suspended:st.suspensionMatches > 0,
    condition:Math.round(st.condition), fatigue:Math.round(st.cumulativeFatigue),
    injuryMatches:st.injuryMatches, injuryType:st.injuryType,
    suspensionMatches:st.suspensionMatches, yellowCards:st.yellowCards,
    form:recentFormValue(st), scoringStreak:st.scoringStreak,
    confidence:Object.assign({}, st.confidence)
  };
}
function recentFormValue(st) {
  const a = st && st.recentForm || [];
  return a.length ? +(a.reduce((s,v)=>s+v,0)/a.length).toFixed(2) : 6;
}
function allRoster(team) {
  const out=[], seen=new Set();
  const add=p=>{ const k=playerKey(p); if(p && k && !seen.has(k)){seen.add(k);out.push(p);} };
  for (const sl of team.lineup || []) add(sl.p || sl);
  for (const p of team.bench || []) add(p.p || p);
  for (const p of (team.squad && team.squad.pl) || []) add(p);
  return out;
}
function applyBaseRecovery(cup, sid, team) {
  const ts = ensureTeam(cup, sid);
  if (ts.recoveryAppliedFor === ts.matches) return;
  for (const p of allRoster(team)) {
    const st = ensurePlayer(cup, p, sid);
    const base = ts.matches === 0 ? 0 : (st.lastMinutes >= 45 ? 14 : st.lastMinutes > 0 ? 17 : 20);
    st.condition = clamp(st.condition + base, 35, 100);
    st.cumulativeFatigue = clamp(st.cumulativeFatigue - base * .70, 0, 100);
  }
  ts.recoveryAppliedFor = ts.matches;
}
function choosePreparation(cup, sid, choice, lineup, squadOrTeam, meta) {
  const def = PREPARATIONS[choice];
  if (!def) throw new Error('Preparação desconhecida: ' + choice);
  const team = squadOrTeam && squadOrTeam.lineup ? squadOrTeam : {
    squad:squadOrTeam || null, lineup:lineup || [], bench:(squadOrTeam && squadOrTeam.pl) || []
  };
  registerTeam(cup, team.squad || squadOrTeam, sid);
  const ts = ensureTeam(cup, sid);
  applyBaseRecovery(cup, sid, team);
  const eff = Object.assign({}, def.effects);
  if (eff.recovery || eff.fatigueRelief) for (const p of allRoster(team)) {
    const st = ensurePlayer(cup, p, sid);
    st.condition = clamp(st.condition + (eff.recovery || 0), 35, 100);
    st.cumulativeFatigue = clamp(st.cumulativeFatigue - (eff.fatigueRelief || 0), 0, 100);
  }
  if (eff.roleLearning) for (const sl of lineup || team.lineup || []) {
    const p = sl.p || sl, st = ensurePlayer(cup, p, sid), rk = roleKey(sl);
    st.roleFamiliarity[rk] = clamp((st.roleFamiliarity[rk] == null ? .35 : st.roleFamiliarity[rk]) + eff.roleLearning, 0, 1);
  }
  const record = {
    choice, label:def.label, selectedAtMatch:ts.matches,
    forMatch:ts.matches + 1, effects:eff,
    automatic:!!(meta && meta.automatic)
  };
  ts.activePreparation = record;
  ts.lastPreparation = choice;
  ts.pendingPreparation = false;
  ts.preparationHistory.push(record);
  if (ts.preparationHistory.length > 12) ts.preparationHistory.shift();
  cup.persistence.history.push({ type:'preparation', sid, ...record });
  return record;
}
function pressureForStage(stage) {
  return ({groups:.05,r16:.35,qf:.55,sf:.75,third:.35,final:1})[stage] || 0;
}
function autoPreparationChoice(cup, sid, team) {
  const roster=allRoster(team), avg=roster.length?roster.reduce((s,p)=>s+ensurePlayer(cup,p,sid).condition,0)/roster.length:100;
  if (avg < 74) return 'recovery';
  const ts=ensureTeam(cup,sid);
  return ['tactical','defensive','setpieces','finishing'][ts.matches % 4];
}
function scoreReplacement(C0, p, sl) {
  const pos=sl.pos || (sl.p && sl.p.slot) || 'CM';
  let s=(p.r || 60);
  if (C0.canPlay && Array.isArray(p.elig) && C0.canPlay(p,pos)) s+=35;
  if ((C0.LINE_OF && C0.LINE_OF[p.slot]) === (C0.LINE_OF && C0.LINE_OF[pos])) s+=12;
  if (p.slot===pos) s+=15;
  return s;
}
function attachPlayer(cup, sid, p, sl, prep, ts) {
  const st=ensurePlayer(cup,p,sid), rk=roleKey(sl || p);
  const familiarity=st.roleFamiliarity[rk] == null ? .35 : st.roleFamiliarity[rk];
  const conf=st.confidence || {finishing:0,defending:0,decision:0};
  const effects=(prep && prep.effects) || {};
  const persistence={
    condition:st.condition, cumulativeFatigue:st.cumulativeFatigue,
    roleFamiliarity:familiarity,
    executionBonus:clamp((familiarity-.5)*.03 + (effects.execution||0) + (conf.decision||0),-.035,.035),
    shotBonus:clamp((effects.shot||0)+(conf.finishing||0),-.03,.04),
    setPieceBonus:clamp(effects.setPiece||0,0,.04),
    defensiveBonus:clamp((effects.defend||0)+(conf.defending||0),-.03,.04),
    importanceExtra:clamp(ts.knockoutPressure*.025,0,.025),
    injuryRisk:clamp(.85 + st.cumulativeFatigue/100*.55, .80, 1.40),
    scoringStreak:st.scoringStreak
  };
  const cp=Object.assign({},p,{_phase10Sid:sid,_phase10InitialStamina:clamp(st.condition,35,100),_phase10Persistence:persistence});
  return { player:cp, persistence, status:st };
}
function prepareTeam(cup, team, sid, opts) {
  opts=opts||{};
  registerTeam(cup, team.squad, sid);
  const ts=ensureTeam(cup,sid);
  /* A pressão pertence à partida que será jogada, não à fase anterior.
     Assim a estreia no mata-mata já recebe o contexto de oitavas/quartas/etc. */
  if (opts.stage) ts.knockoutPressure=pressureForStage(opts.stage);
  if (ts.pendingPreparation && !ts.activePreparation) {
    const choice=opts.user ? 'recovery' : autoPreparationChoice(cup,sid,team);
    choosePreparation(cup,sid,choice,team.lineup,team,{automatic:true});
  } else applyBaseRecovery(cup,sid,team);
  const prep=ts.activePreparation;
  const lineup=(team.lineup||[]).map(sl=>Object.assign({},sl));
  let bench=(team.bench||[]).slice();
  /* Todo indisponível do elenco precisa cumprir a duração da lesão/suspensão,
     mesmo quando era reserva. Antes apenas titulares bloqueados entravam no
     snapshot e um reserva lesionado podia ficar congelado para sempre. */
  const unavailable=allRoster(team).map(p=>({p,st:ensurePlayer(cup,p,sid)}))
    .filter(x=>x.st.injuryMatches>0||x.st.suspensionMatches>0)
    .map(x=>({id:x.st.key,name:x.p.n,reason:x.st.injuryMatches>0?'injury':'suspension',matches:Math.max(x.st.injuryMatches,x.st.suspensionMatches),starter:false}));
  const replacements=[];
  const used=new Set(lineup.map(sl=>playerKey(sl.p)));
  for(let i=0;i<lineup.length;i++){
    const sl=lineup[i], st=ensurePlayer(cup,sl.p,sid);
    if(st.injuryMatches<=0 && st.suspensionMatches<=0) continue;
    const listed=unavailable.find(x=>x.id===st.key); if(listed) listed.starter=true;
    const candidates=bench.filter(p=>{const ps=ensurePlayer(cup,p,sid);return ps.injuryMatches<=0&&ps.suspensionMatches<=0&&!used.has(playerKey(p));});
    candidates.sort((a,b)=>scoreReplacement(C,b,sl)-scoreReplacement(C,a,sl));
    const rep=candidates[0];
    if(rep){
      replacements.push({out:sl.p.n,in:rep.n,pos:sl.pos});
      used.delete(playerKey(sl.p)); used.add(playerKey(rep));
      bench=bench.filter(p=>playerKey(p)!==playerKey(rep));
      sl.p=rep;
    }
  }
  for(const sl of lineup){
    const a=attachPlayer(cup,sid,sl.p,sl,prep,ts);
    sl.p=a.player; sl.initialStamina=a.player._phase10InitialStamina; sl.persistence=a.persistence;
  }
  bench=bench.filter(p=>{const st=ensurePlayer(cup,p,sid);return st.injuryMatches<=0&&st.suspensionMatches<=0;}).map(p=>attachPlayer(cup,sid,p,p,prep,ts).player);
  ts.lastUnavailable=unavailable; ts.lastReplacements=replacements;
  ts._matchSnapshot={unavailable:unavailable.map(x=>x.id),preparation:prep,originalLineup:(team.lineup||[]).map(sl=>playerKey(sl.p)),stage:opts.stage||null};
  return Object.assign({},team,{lineup,bench,phase10:{sid,preparation:prep,unavailable,replacements}});
}
function captureMatch(sim, side, originalTeam, stage) {
  const total=Math.max(90,Math.min(120,Math.round(sim.minute||90)));
  const participants={};
  const add=(p,started,entry)=>{if(!p)return;const ref=p.ref||p,k=playerKey(ref);if(!participants[k])participants[k]={id:k,ref,started:!!started,entry:entry||0,exit:total,minutes:0,rating:p.rating||6,finalStamina:p.stamina==null?100:p.stamina,goals:0,yellow:0,red:0,injured:false,role:p.role||null,focus:p.focus||'bal',position:p.slotPos||ref.slot};};
  for(const sl of (originalTeam&&originalTeam.lineup)||[]) add({ref:sl.p,role:sl.role,focus:sl.focus,slotPos:sl.pos,stamina:sl.initialStamina||100,rating:6},true,0);
  for(const ev of sim.events||[]){
    if(ev.type==='sub'&&ev.team===side){
      const ko=playerKey(ev.out&&ev.out.ref),ki=playerKey(ev.inP&&ev.inP.ref);
      if(ko&&participants[ko]){const q=participants[ko];q.exit=Math.min(total,ev.minute||0);q.rating=ev.out.rating||6;q.finalStamina=ev.out.stamina==null?q.finalStamina:ev.out.stamina;q.yellow=Math.max(q.yellow,ev.out.yellow||0);q.red=Math.max(q.red,ev.out.red?1:0);q.injured=q.injured||!!ev.out._injured;}
      add(ev.inP,false,ev.minute||0); if(ki&&participants[ki]) participants[ki].entry=ev.minute||0;
    } else if(ev.type==='goal'&&ev.by&&ev.by.team===side){add(ev.by,false,0);participants[playerKey(ev.by.ref)].goals++;}
    else if(ev.type==='yellow'&&ev.p&&ev.p.team===side){add(ev.p,false,0);participants[playerKey(ev.p.ref)].yellow++;}
    else if(ev.type==='red'&&ev.p&&ev.p.team===side){add(ev.p,false,0);participants[playerKey(ev.p.ref)].red++;}
    else if(ev.type==='injury'&&ev.by&&ev.by.team===side){add(ev.by,false,0);participants[playerKey(ev.by.ref)].injured=true;}
  }
  for(const p of (sim.teams[side]&&sim.teams[side].players)||[]){add(p,false,0);const q=participants[playerKey(p.ref)];q.rating=p.rating||q.rating;q.finalStamina=p.stamina==null?q.finalStamina:p.stamina;q.yellow=Math.max(q.yellow,p.yellow||0);q.red=Math.max(q.red,p.red?1:0);q.injured=q.injured||!!p._injured;}
  for(const q of Object.values(participants)) q.minutes=clamp(q.exit-q.entry,0,total);
  return {sid:(originalTeam&&originalTeam.squad&&originalTeam.squad.sid)||null,totalMinutes:total,extraTime:total>95,stage:stage||null,score:[sim.score[side],sim.score[1-side]],players:Object.values(participants)};
}
function injuryDuration(q,teamMatches) {
  let h=2166136261>>>0;const s=String(q.id)+'#'+teamMatches;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return 1+(h%3)+(q.finalStamina<35?1:0);
}
function recordTeamMatch(cup, sid, summary, squad) {
  const ts=ensureTeam(cup,sid), snap=ts._matchSnapshot||{unavailable:[]};
  for(const id of snap.unavailable||[]){const st=cup.persistence.players[id];if(!st)continue;if(st.injuryMatches>0)st.injuryMatches--;if(st.suspensionMatches>0)st.suspensionMatches--;if(st.injuryMatches<=0)st.injuryType=null;}
  const played=new Set();
  for(const q of summary.players||[]){
    const st=ensurePlayer(cup,q.ref,sid);played.add(st.key);
    const extra=Math.max(0,q.minutes-90);
    const load=clamp((q.minutes/90)*18 + Math.max(0,100-q.finalStamina)*.70 + extra*.22,0,65);
    st.cumulativeFatigue=clamp(st.cumulativeFatigue*.45+load,0,100);
    st.condition=clamp(100-st.cumulativeFatigue,35,100);
    st.appearances++;if(q.started)st.starts++;else if(q.minutes>0)st.benchAppearances++;
    st.minutes+=q.minutes;st.lastMinutes=q.minutes;st.lastStarted=!!q.started;st.lastRating=+q.rating.toFixed(2);st.lastGoals=q.goals;st.lastMatchIndex=ts.matches+1;
    st.recentForm.push(st.lastRating);if(st.recentForm.length>5)st.recentForm.shift();
    st.scoringStreak=q.goals>0?st.scoringStreak+1:(q.minutes>=45?0:st.scoringStreak);
    const role=[q.position||'CM',q.role||'default',q.focus||'bal'].join('|');st.lastRole=role;
    st.roleFamiliarity[role]=clamp((st.roleFamiliarity[role]==null?.35:st.roleFamiliarity[role])+q.minutes/90*.045,0,1);
    const line=C.LINE_OF&&C.LINE_OF[q.position||q.ref.slot];
    st.confidence.decision=clamp(st.confidence.decision*.65+(q.rating-6.2)*.007,-.025,.025);
    st.confidence.finishing=clamp(st.confidence.finishing*.65+q.goals*.012-(line==='FWD'&&q.minutes>=60&&q.goals===0?.003:0),-.025,.03);
    st.confidence.defending=clamp(st.confidence.defending*.65+(summary.score[1]===0?.008:-summary.score[1]*.003),-.025,.025);
    if(q.injured){st.injuryMatches=Math.max(st.injuryMatches,injuryDuration(q,ts.matches+1));st.injuryType=q.finalStamina<35?'muscular':'impact';}
    st.yellowCards+=q.yellow||0;
    if(st.yellowCards>=2){st.suspensionMatches=Math.max(st.suspensionMatches,1);st.yellowCards=0;}
    if(q.red)st.suspensionMatches=Math.max(st.suspensionMatches,1);
  }
  for(const p of (squad&&squad.pl)||[]){const st=ensurePlayer(cup,p,sid);if(!played.has(st.key)){st.condition=clamp(st.condition+3,35,100);st.cumulativeFatigue=clamp(st.cumulativeFatigue-3,0,100);st.lastMinutes=0;st.lastStarted=false;}}
  ts.matches++;ts.lastExtraTime=!!summary.extraTime;ts.pendingPreparation=true;ts.activePreparation=null;ts.recoveryAppliedFor=-1;ts._matchSnapshot=null;
  ts.knockoutPressure=pressureForStage(summary.stage);
  cup.persistence.history.push({type:'match',sid,match:ts.matches,stage:summary.stage,score:summary.score,extraTime:summary.extraTime});
  return ts;
}
function recordSimulation(cup, sim, teams, opts) {
  opts=opts||{};
  const out=[];
  for(let side=0;side<2;side++){
    const team=teams[side], sid=team&&team.squad&&team.squad.sid;
    if(sid==null)continue;
    const summary=captureMatch(sim,side,team,opts.stage);
    recordTeamMatch(cup,sid,summary,team.squad);
    out.push(summary);
  }
  return out;
}
function teamOverview(cup, sid, squad) {
  const ts=ensureTeam(cup,sid), players=[];
  for(const p of (squad&&squad.pl)||[]){const st=ensurePlayer(cup,p,sid);players.push({p,state:st,status:status(cup,p,sid)});}
  const avg=players.length?players.reduce((s,x)=>s+x.state.condition,0)/players.length:100;
  return {team:ts,averageCondition:+avg.toFixed(1),players};
}
function needsPreparation(cup,sid){return !!ensureTeam(cup,sid).pendingPreparation;}
function preparationOptions(){return Object.values(PREPARATIONS).map(x=>({key:x.key,label:x.label,icon:x.icon,description:x.description,effects:Object.assign({},x.effects)}));}

const API={VERSION,ENGINE_VERSION,STATE_VERSION,PREPARATIONS,pressureForStage,ensureCup,ensureTeam,ensurePlayer,registerTeam,status,recentFormValue,choosePreparation,autoPreparationChoice,prepareTeam,captureMatch,recordTeamMatch,recordSimulation,teamOverview,needsPreparation,preparationOptions,playerKey,stateKey,roleKey};
root.CDS_PHASE10=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
