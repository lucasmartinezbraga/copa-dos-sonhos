#!/usr/bin/env node
'use strict';
process.env.CDS_LAB_PHASE10='1';
const assert=require('assert');
const path=require('path');
const {createRuntime}=require('../tools/lab_runtime.js');
function run(seed){
  const rt=createRuntime(path.resolve(__dirname,'..')),sb=rt.sandbox,db=rt.db,P=sb.CDS_PHASE10;
  const sa=structuredClone(db.squads[312]),sbq=structuredClone(db.squads[288]);
  const la=sb.autoLineup(sa,'4-3-3',0),lb=sb.autoLineup(sbq,'4-3-3',0);
  const cup={playerSid:sa.sid,phase:'groups',round:0,groups:[{name:'A',teams:[sa.sid,sbq.sid]}],results:{A:[]}};
  P.ensureCup(cup,{byId:{[sa.sid]:sa,[sbq.sid]:sbq}});
  const rawA={squad:sa,name:sa.c,flag:'',color:'#fff',lineup:la.lineup,bench:la.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced)};
  const rawB={squad:sbq,name:sbq.c,flag:'',color:'#fff',lineup:lb.lineup,bench:lb.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced)};
  P.choosePreparation(cup,sa.sid,'finishing',rawA.lineup,rawA);
  const A=P.prepareTeam(cup,rawA,sa.sid,{user:true,stage:'groups'}),B=P.prepareTeam(cup,rawB,sbq.sid,{user:false,stage:'groups'});
  assert(A.lineup.some(x=>x.persistence&&x.persistence.shotBonus>=.025));
  sb.srand(seed>>>0);const sim=new sb.MatchSim(A,B,{neutral:true,knockout:false});sim.setInteractive(-1);
  let steps=0;while(!sim.isOver()&&steps++<500000)sim.step(1/60);assert(sim.isOver(),'partida não terminou');
  P.recordSimulation(cup,sim,[A,B],{stage:'groups'});
  const ta=P.ensureTeam(cup,sa.sid),tb=P.ensureTeam(cup,sbq.sid);
  assert.equal(ta.matches,1);assert.equal(tb.matches,1);assert(ta.pendingPreparation&&tb.pendingPreparation);
  const ov=P.teamOverview(cup,sa.sid,sa);assert(ov.players.some(x=>x.state.appearances>0));assert(ov.averageCondition<100);
  const before=ov.averageCondition;P.choosePreparation(cup,sa.sid,'recovery',rawA.lineup,rawA);const after=P.teamOverview(cup,sa.sid,sa).averageCondition;assert(after>before,'recuperação não funcionou');
  return {score:sim.score,persistence:cup.persistence,conditionBefore:before,conditionAfter:after,steps};
}
const a=run(531001),b=run(531001);
assert.deepEqual(a.score,b.score);assert.deepEqual(a.persistence,b.persistence,'persistência não determinística');
console.log(JSON.stringify({ok:true,version:a.persistence.version,score:a.score,conditionBefore:a.conditionBefore,conditionAfter:a.conditionAfter,steps:a.steps,history:a.persistence.history.length},null,2));
