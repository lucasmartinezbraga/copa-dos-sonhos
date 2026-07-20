#!/usr/bin/env node
'use strict';
const assert=require('assert');
const P10=require('../src/scripts/49-phase10-cup-persistence.js');
function player(id,slot,r=75){return{id,n:'P'+id,slot,r,traits:[],a8:[75,75,75,75,75,75,75,75]};}
const roster=[player('gk','GK',80),player('cb1','CB'),player('cb2','CB'),player('lb','LB'),player('rb','RB'),player('cm1','CM'),player('cm2','CM'),player('am','CAM'),player('lw','LW'),player('rw','RW'),player('st','ST',84),player('b1','CB',72),player('b2','CM',74),player('b3','ST',78),player('b4','GK',70)];
const slots=['GK','CB','CB','LB','RB','CM','CM','CAM','LW','RW','ST'].map((pos,i)=>({p:roster[i],pos,x:.1+i*.07,y:.5,role:pos==='ST'?'st_complete':'default',focus:'bal'}));
const team={squad:{sid:'ME',pl:roster},lineup:slots,bench:roster.slice(11)};
const cup={playerSid:'ME',phase:'groups',round:0,groups:[{name:'A',teams:['ME','X','Y','Z']}],results:{A:[]}};
P10.ensureCup(cup,{byId:{ME:team.squad}});
assert(P10.needsPreparation(cup,'ME'));
const prep=P10.choosePreparation(cup,'ME','finishing',team.lineup,team);
assert.equal(prep.effects.shot,.025);assert(!P10.needsPreparation(cup,'ME'));
let ready=P10.prepareTeam(cup,team,'ME',{user:true,stage:'groups'});
assert.equal(ready.lineup.length,11);assert(ready.lineup.every(x=>x.initialStamina===100));
assert(ready.lineup.find(x=>x.pos==='ST').p._phase10Persistence.shotBonus>=.025);
const knockoutReady=P10.prepareTeam(cup,team,'ME',{user:true,stage:'qf'});assert(knockoutReady.lineup[0].p._phase10Persistence.importanceExtra>0,'pressão de mata-mata não aplicada antes da partida');
const summary={stage:'groups',score:[2,1],totalMinutes:90,extraTime:false,players:ready.lineup.map((sl,i)=>({id:P10.playerKey(sl.p),ref:sl.p,started:true,minutes:90,rating:i===10?8.1:6.4,finalStamina:i===10?54:62,goals:i===10?2:0,yellow:i===1?1:0,red:0,injured:i===2,role:sl.role,focus:sl.focus,position:sl.pos}))};
P10.recordTeamMatch(cup,'ME',summary,team.squad);
const striker=P10.status(cup,roster[10],'ME');
assert(striker.condition<80);assert.equal(striker.scoringStreak,1);assert(striker.form>7);
const injured=P10.status(cup,roster[2],'ME');assert(injured.injured&&injured.injuryMatches>=1);
assert(P10.needsPreparation(cup,'ME'));
P10.choosePreparation(cup,'ME','tactical',team.lineup,team);
const before=P10.ensurePlayer(cup,roster[10],'ME').roleFamiliarity[P10.roleKey(team.lineup[10])];assert(before>.35);
ready=P10.prepareTeam(cup,team,'ME',{user:true,stage:'groups'});
assert(!ready.lineup.some(x=>P10.playerKey(x.p)==='cb2'),'lesionado não pode iniciar');
assert(ready.phase10.replacements.length>=1,'reposição automática ausente');
const recoveryBefore=P10.ensurePlayer(cup,roster[10],'ME').condition;
P10.recordTeamMatch(cup,'ME',{stage:'groups',score:[0,0],totalMinutes:90,extraTime:false,players:[]},team.squad);
P10.choosePreparation(cup,'ME','recovery',team.lineup,team);
assert(P10.ensurePlayer(cup,roster[10],'ME').condition>recoveryBefore,'recuperação não elevou condição');

// Indisponibilidade de reserva também precisa consumir partidas.
const reserveState=P10.ensurePlayer(cup,roster[13],'ME');
reserveState.suspensionMatches=2;
P10.prepareTeam(cup,team,'ME',{user:true,stage:'groups'});
P10.recordTeamMatch(cup,'ME',{stage:'groups',score:[1,0],totalMinutes:90,extraTime:false,players:[]},team.squad);
assert.equal(reserveState.suspensionMatches,1,'suspensão de reserva não descontou a primeira partida');
P10.choosePreparation(cup,'ME','defensive',team.lineup,team);
P10.prepareTeam(cup,team,'ME',{user:true,stage:'groups'});
P10.recordTeamMatch(cup,'ME',{stage:'groups',score:[0,0],totalMinutes:90,extraTime:false,players:[]},team.squad);
assert.equal(reserveState.suspensionMatches,0,'suspensão de reserva não terminou');

console.log(JSON.stringify({ok:true,version:P10.VERSION,condition:striker.condition,form:striker.form,streak:striker.scoringStreak,injury:injured.injuryMatches,replacements:ready.phase10.replacements,history:cup.persistence.history.length},null,2));
