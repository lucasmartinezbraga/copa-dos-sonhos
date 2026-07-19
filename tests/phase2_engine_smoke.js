#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');global.window=global;global.performance=performance;global.CanvasRenderingContext2D=undefined;
window.__cdsDebugWarn=()=>{};window.__cdsDebugLog=()=>{};
for(const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js','src/scripts/30-tactics.js','src/scripts/40-match-engine-and-manager-ai.js']){
 vm.runInThisContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),{filename:rel});
}
const db=buildDB(DATA);
const pick=s=>{const r=autoLineup(s,'4-3-3',0);return {squad:s,name:s.c,flag:'',color:'#ffffff',lineup:r.lineup,bench:r.bench,style:'balanced',axes:Object.assign({},STYLE_AXES.balanced)};};
const a=db.squads.find(s=>s.sid===19)||db.squads[0],b=db.squads.find(s=>s.sid===353)||db.squads[1];
const sim=new MatchSim(pick(a),pick(b),{});
for(let i=0;i<2500;i++) sim.step(.08);
const state=sim.getState();
const all=sim.teams.flatMap(t=>t.players);
const bad=all.filter(p=>![p.x,p.y,p.stamina,p.rating].every(Number.isFinite));
if(bad.length) throw new Error('Estado numérico inválido: '+bad.map(p=>p.ref?.n).join(','));
if(all.some(p=>!p.ref.attributesV3||!p.ref.positionsV3)) throw new Error('Jogador sem perfil V3 dentro do motor');
if(sim.teams.some(t=>t.players.filter(p=>p.isGK).length!==1)) throw new Error('Time sem exatamente um goleiro');
if(!Number.isFinite(state.ball.x)||!Number.isFinite(state.ball.y)) throw new Error('Bola inválida');
console.log(JSON.stringify({ok:true,minute:sim.minute,score:sim.score,events:sim.events.length,players:all.length,schema:CDS_DATA_SCHEMA_VERSION,stats:sim.stats.map(s=>({shots:s.shots,xg:+s.xg.toFixed(2),passes:s.passes}))},null,2));
