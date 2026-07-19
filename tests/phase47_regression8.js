#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');global.window=global;global.performance=performance;global.CanvasRenderingContext2D=undefined;
window.__cdsDebugWarn=()=>{};window.__cdsDebugLog=()=>{};
for(const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js','src/scripts/30-tactics.js','src/scripts/40-match-engine-and-manager-ai.js','src/scripts/45-phases-4-to-7.js']) vm.runInThisContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),{filename:rel});
const db=buildDB(DATA), forms=Object.keys(FORMATIONS), styles=['balanced','tiki','counter','press','direct','wings','park'], presets=['balanced','possession','counter','highPress','lowBlock','wings'];
const deep=x=>JSON.parse(JSON.stringify(x));
function team(s,form,varIdx,style,preset){const r=autoLineup(s,form,varIdx);return {squad:s,name:s.c,flag:'',color:'#fff',lineup:r.lineup.map(x=>Object.assign({},x,{p:deep(x.p)})),bench:r.bench.map(deep),style,instructions:preset,instructionPreset:preset,axes:Object.assign({},STYLE_AXES[style]||STYLE_AXES.balanced)};}
const rows=[];let invalid=0;
for(let g=0;g<8;g++){
 srand(5000+g*9973);
 const ia=(g*17+19)%db.squads.length, ib=(g*31+53)%db.squads.length;
 const fa=forms[g%forms.length], fb=forms[(g*3+5)%forms.length];
 const va=g%FORMATIONS[fa].variations.length, vb=(g+1)%FORMATIONS[fb].variations.length;
 const sa=styles[g%styles.length], sb=styles[(g+3)%styles.length], pa=presets[g%presets.length], pb=presets[(g+2)%presets.length];
 const sim=new MatchSim(team(db.squads[ia],fa,va,sa,pa),team(db.squads[ib],fb,vb,sb,pb),{});
 sim.setTeamInstructions(0,pa);sim.setTeamInstructions(1,pb);
 let steps=0;while(!sim.isOver()&&steps<40000){sim.step(1/60);steps++;}
 const all=sim.teams.flatMap(t=>t.players);const finite=all.every(p=>[p.x,p.y,p.stamina,p.rating].every(Number.isFinite))&&Number.isFinite(sim.ball.x)&&Number.isFinite(sim.ball.y);
 if(!finite||!sim.isOver())invalid++;
 const a=sim.getAdvancedData(0).phase47,b=sim.getAdvancedData(1).phase47;
 rows.push({game:g+1,seed:5000+g*9973,score:sim.score,steps,teams:[db.squads[ia].c,db.squads[ib].c],styles:[sa,sb],presets:[pa,pb],forms:[fa,fb],stats:sim.stats.map(s=>({shots:s.shots,onTarget:s.onTarget,xg:s.xg,passes:s.passes,passOk:s.passOk,corners:s.corners,fouls:s.fouls,yellow:s.yellow,red:s.red,decisions:s.decisionQuality.count,clumpCorrections:s.clumpCorrections,spatialSamples:s.spatialSamples,corridors:s.corridorOccupancy})),coherence:[a.coherence,b.coherence],finite});
}
const sum=(fn)=>rows.reduce((s,r)=>s+fn(r),0), games=rows.length;
const summary={games,engineVersion:CDS_PHASES_4_7.VERSION,fixedStep:1/60,invalidStates:invalid,goalsPerMatch:sum(r=>r.score[0]+r.score[1])/games,shotsPerMatch:sum(r=>r.stats[0].shots+r.stats[1].shots)/games,xgPerMatch:sum(r=>r.stats[0].xg+r.stats[1].xg)/games,passCompletion:sum(r=>r.stats[0].passOk+r.stats[1].passOk)/Math.max(1,sum(r=>r.stats[0].passes+r.stats[1].passes)),cornersPerMatch:sum(r=>r.stats[0].corners+r.stats[1].corners)/games,foulsPerMatch:sum(r=>r.stats[0].fouls+r.stats[1].fouls)/games,yellowsPerMatch:sum(r=>r.stats[0].yellow+r.stats[1].yellow)/games,redsPerMatch:sum(r=>r.stats[0].red+r.stats[1].red)/games,decisionsPerMatch:sum(r=>r.stats[0].decisions+r.stats[1].decisions)/games,clumpCorrectionsPerMatch:sum(r=>r.stats[0].clumpCorrections+r.stats[1].clumpCorrections)/games,spatialSamplesPerMatch:sum(r=>r.stats[0].spatialSamples+r.stats[1].spatialSamples)/games,coherenceMin:Math.min(...rows.flatMap(r=>r.coherence.map(c=>c.score)))};
const out={summary,matches:rows};const dir=path.join(ROOT,'reports/phase47');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'regression8-v500.json'),JSON.stringify(out,null,2));
const md=`# Regressão funcional Fases 4–7 — v5.0.0 (8 partidas)\n\n- Partidas: **${games}**\n- Passo: **1/60 s**\n- Estados inválidos: **${invalid}**\n- Gols/jogo: **${summary.goalsPerMatch.toFixed(2)}**\n- Chutes/jogo: **${summary.shotsPerMatch.toFixed(2)}**\n- xG/jogo: **${summary.xgPerMatch.toFixed(2)}**\n- Precisão de passe: **${(summary.passCompletion*100).toFixed(1)}%**\n- Escanteios/jogo: **${summary.cornersPerMatch.toFixed(2)}**\n- Faltas/jogo: **${summary.foulsPerMatch.toFixed(2)}**\n- Amarelos/jogo: **${summary.yellowsPerMatch.toFixed(2)}**\n- Vermelhos/jogo: **${summary.redsPerMatch.toFixed(2)}**\n- Decisões contextuais/jogo: **${summary.decisionsPerMatch.toFixed(1)}**\n- Correções antiamontoamento/jogo: **${summary.clumpCorrectionsPerMatch.toFixed(1)}**\n- Amostras espaciais/jogo: **${summary.spatialSamplesPerMatch.toFixed(1)}**\n- Menor coerência tática: **${summary.coherenceMin}/100**\n`;
fs.writeFileSync(path.join(dir,'regression8-v500.md'),md);console.log(JSON.stringify(summary,null,2));
