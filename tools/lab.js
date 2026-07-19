#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { Worker } = require('worker_threads');
const { fork } = require('child_process');
const { performance } = require('perf_hooks');
const { createRuntime } = require('./lab_runtime.js');

const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.length ? rest.join('=') : true];
}));
const MODE = String(args.mode || 'full');
const COUNT = Number(args.matches || (MODE === 'smoke' ? 48 : MODE === 'quick' ? 600 : 3200));
const WORKERS = Math.max(1, Math.min(Number(args.workers || 4), os.cpus().length - 1, COUNT));
const BATCH_SIZE = Math.max(1, Number(args.batchSize || 15));
// dt oficial do laboratório = 1/30, o MESMO passo que simQuick() usa na Copa.
// O motor ainda não é invariante ao dt (descoberta da tentativa GPT da Fase 3),
// então medir com outro passo mediria um jogo que não existe.
const DT = Number(args.dt || (1 / 30));
const LABEL = String(args.label || 'current');
const OUTPUT = path.resolve(args.output || path.join(ROOT, 'reports/phase3', `${LABEL}-${MODE}-${COUNT}.json`));
const TARGETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'calibration/targets.json'), 'utf8'));

function loadMeta() {
  const context = { console, performance, CanvasRenderingContext2D: undefined };
  context.window = context; context.globalThis = context;
  context.__cdsDebugWarn = () => {}; context.__cdsDebugLog = () => {};
  vm.createContext(context);
  for (const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context, { filename: rel });
  }
  const db = context.buildDB(context.DATA);
  return {
    squads: db.squads.map((s, index) => ({ index, sid:s.sid, name:s.c, year:s.y, rating:s.r })),
    styles: Array.from(context.STYLE_KEYS),
    forms: Array.from(context.FORMATION_KEYS),
    variations: Object.fromEntries(context.FORMATION_KEYS.map(k => [k, context.FORMATIONS[k].variations.length])),
    calibrationVersion: context.ENGINE_CALIBRATION.version
  };
}
const meta = loadMeta();

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rand = rng(Number(args.seed || 0xC0A2026));
const pick = arr => arr[Math.floor(rand() * arr.length)];
const top = meta.squads.filter(s => s.rating >= 87);
const middle = meta.squads.filter(s => s.rating >= 78 && s.rating <= 84);
const low = meta.squads.filter(s => s.rating <= 75);
const iconic = meta.squads.filter(s => ['Brasil','Argentina','Alemanha','Espanha','França','Itália','Holanda','Uruguai'].includes(s.name) && s.rating >= 84);
const styles = meta.styles;
const forms = meta.forms;

function spec(squad, style, form, variation) {
  return { squadIndex:squad.index, style, form, variation:variation == null ? 0 : variation };
}
function mirroredJob(id, suite, squad, style, form, seed, metaExtra={}) {
  const vCount = meta.variations[form] || 1;
  const v = Math.floor(rand() * vCount);
  return { id, suite, group:`${suite}:${style}:${form}`, seed, dt:DT, a:spec(squad,style,form,v), b:spec(squad,style,form,v), meta:metaExtra };
}

function allocate(total, weights) {
  const entries = Object.entries(weights);
  const out = {};
  let used = 0;
  entries.forEach(([k,w],i) => {
    const n = i === entries.length - 1 ? total - used : Math.floor(total * w);
    out[k]=n; used+=n;
  });
  return out;
}

function generateJobs(count) {
  const jobs=[];
  const mix = MODE === 'smoke'
    ? allocate(count,{parity:.25,random:.25,strongWeak:.20,styles:.15,formations:.15})
    : allocate(count,{parity:.15,random:.34,strongWeak:.17,styles:.18,formations:.16});
  let id=0;
  for(let i=0;i<mix.parity;i++){
    const squad=pick(iconic.length?iconic:middle), style=pick(styles), form=pick(forms);
    jobs.push(mirroredJob(`P${id++}`,'parity',squad,style,form,100000+id,{equal:true}));
  }
  for(let i=0;i<mix.random;i++){
    const a=pick(meta.squads), b=pick(meta.squads.filter(x=>x.index!==a.index));
    const fa=pick(forms), fb=pick(forms), sa=pick(styles), sb=pick(styles);
    jobs.push({id:`R${id++}`,suite:'random',group:'random',seed:200000+id,dt:DT,
      a:spec(a,sa,fa,Math.floor(rand()*(meta.variations[fa]||1))),
      b:spec(b,sb,fb,Math.floor(rand()*(meta.variations[fb]||1))),meta:{ratingGap:a.rating-b.rating}});
  }
  for(let i=0;i<mix.strongWeak;i++){
    const strong=pick(top), weak=pick(low);
    const strongFirst=i%2===0;
    const formA=pick(forms), formB=pick(forms), styleA=pick(styles), styleB=pick(styles);
    const a=strongFirst?strong:weak,b=strongFirst?weak:strong;
    jobs.push({id:`S${id++}`,suite:'strongWeak',group:'strongWeak',seed:300000+id,dt:DT,
      a:spec(a,styleA,formA,Math.floor(rand()*(meta.variations[formA]||1))),
      b:spec(b,styleB,formB,Math.floor(rand()*(meta.variations[formB]||1))),
      meta:{favoriteSide:strongFirst?0:1,ratingGap:strong.rating-weak.rating}});
  }
  for(let i=0;i<mix.styles;i++){
    const style=styles[i%styles.length], squad=pick(iconic.length?iconic:middle), form=pick(['4-3-3','4-2-3-1','3-4-2-1','5-4-1']);
    const styleFirst=i%2===0;
    const aStyle=styleFirst?style:'balanced', bStyle=styleFirst?'balanced':style;
    jobs.push({id:`T${id++}`,suite:'styles',group:`style:${style}`,seed:400000+id,dt:DT,
      a:spec(squad,aStyle,form,0),b:spec(squad,bStyle,form,0),meta:{testedStyle:style,testedSide:styleFirst?0:1}});
  }
  for(let i=0;i<mix.formations;i++){
    const form=forms[i%forms.length], squad=pick(iconic.length?iconic:middle), style=pick(['balanced','tiki','counter','press']);
    const testedFirst=i%2===0;
    const aForm=testedFirst?form:'4-3-3', bForm=testedFirst?'4-3-3':form;
    jobs.push({id:`F${id++}`,suite:'formations',group:`formation:${form}`,seed:500000+id,dt:DT,
      a:spec(squad,style,aForm,Math.floor(rand()*(meta.variations[aForm]||1))),
      b:spec(squad,style,bForm,Math.floor(rand()*(meta.variations[bForm]||1))),meta:{testedFormation:form,testedSide:testedFirst?0:1}});
  }
  return jobs;
}

function sum(arr, fn=x=>x){ return arr.reduce((a,x)=>a+fn(x),0); }
function mean(arr, fn=x=>x){ return arr.length?sum(arr,fn)/arr.length:0; }
function percentile(values,p){ if(!values.length)return 0; const a=values.slice().sort((x,y)=>x-y); const idx=(a.length-1)*p,lo=Math.floor(idx),hi=Math.ceil(idx); return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(idx-lo); }

function aggregate(rows, name='all') {
  const games=rows.length;
  const goals=sum(rows,r=>r.goals), shots=sum(rows,r=>r.shots), onTarget=sum(rows,r=>r.onTarget), passes=sum(rows,r=>r.passes), passOk=sum(rows,r=>r.passOk);
  const lateGoals=sum(rows,r=>r.goalMinutes.filter(m=>m>=75).length), setPieceGoals=sum(rows,r=>r.setPieceGoals);
  const scoreFreq={}; for(const r of rows){const k=r.score.join('-');scoreFreq[k]=(scoreFreq[k]||0)+1;}
  return {
    name,games,
    goalsPerMatch:mean(rows,r=>r.goals), shotsPerMatch:mean(rows,r=>r.shots), xgPerMatch:mean(rows,r=>r.xg),
    onTargetRate:shots?onTarget/shots:0, passCompletion:passes?passOk/passes:0,
    foulsPerMatch:mean(rows,r=>r.fouls), yellowsPerMatch:mean(rows,r=>r.yellow), redsPerMatch:mean(rows,r=>r.red), cornersPerMatch:mean(rows,r=>r.corners),
    tacklesPerMatch:mean(rows,r=>r.tackles), interceptionsPerMatch:mean(rows,r=>r.interceptions),
    drawRate:mean(rows,r=>r.score[0]===r.score[1]?1:0), zeroZeroRate:mean(rows,r=>r.goals===0?1:0), blowoutRate:mean(rows,r=>Math.abs(r.score[0]-r.score[1])>=4?1:0),
    lateGoalShare:goals?lateGoals/goals:0, setPieceGoalShare:goals?setPieceGoals/goals:0,
    averageEndingStamina:mean(rows,r=>(r.stamina[0]+r.stamina[1])/2),
    averagePossessionA:mean(rows,r=>r.possession[0]),
    goalP50:percentile(rows.map(r=>r.goals),.5), goalP90:percentile(rows.map(r=>r.goals),.9), shotP90:percentile(rows.map(r=>r.shots),.9),
    maxGoals:Math.max(0,...rows.map(r=>r.goals)), scoreFrequency:Object.fromEntries(Object.entries(scoreFreq).sort((a,b)=>b[1]-a[1]).slice(0,16))
  };
}

function featureAggregates(rows) {
  const out={};
  for(const suite of [...new Set(rows.map(r=>r.suite))]) out[suite]=aggregate(rows.filter(r=>r.suite===suite),suite);
  const parity=rows.filter(r=>r.suite==='parity');
  if(parity.length){
    const decisive=parity.filter(r=>r.score[0]!==r.score[1]);
    out.parity.paritySideAWinShare=decisive.length?mean(decisive,r=>r.score[0]>r.score[1]?1:0):.5;
  }
  const sw=rows.filter(r=>r.suite==='strongWeak');
  if(sw.length) out.strongWeak.favoriteWinRate=mean(sw,r=>r.score[r.meta.favoriteSide]>r.score[1-r.meta.favoriteSide]?1:0);
  const groups={};
  for(const group of [...new Set(rows.map(r=>r.group))]) groups[group]=aggregate(rows.filter(r=>r.group===group),group);
  const stylesOut={};
  for(const style of meta.styles){
    const sr=rows.filter(r=>r.suite==='styles'&&r.meta.testedStyle===style);
    if(!sr.length)continue;
    const tested=(r)=>r.teamStats[r.meta.testedSide], base=(r)=>r.teamStats[1-r.meta.testedSide];
    stylesOut[style]={games:sr.length,goalDelta:mean(sr,r=>tested(r).goals-base(r).goals),
      possessionDelta:mean(sr,r=>tested(r).poss-base(r).poss),
      passCompletionDelta:mean(sr,r=>(tested(r).passOk/Math.max(1,tested(r).passes))-(base(r).passOk/Math.max(1,base(r).passes))),
      crossDelta:mean(sr,r=>tested(r).crosses-base(r).crosses),
      throughBallDelta:mean(sr,r=>tested(r).throughBalls-base(r).throughBalls),
      pressWinsDelta:mean(sr,r=>tested(r).pressWins-base(r).pressWins),
      staminaDelta:mean(sr,r=>tested(r).stamina-base(r).stamina),
      shotsForDelta:mean(sr,r=>tested(r).shots-base(r).shots),
      shotsAllowedDelta:mean(sr,r=>base(r).shots-tested(r).shots)};
  }
  return {suites:out,groups,styles:stylesOut};
}

function metricPenalty(value, spec){
  if(value>=spec.min&&value<=spec.max){const span=Math.max(spec.target-spec.min,spec.max-spec.target,1e-9);return Math.abs(value-spec.target)/span*.25;}
  const edge=value<spec.min?spec.min:spec.max; const span=Math.max(spec.max-spec.min,1e-9); return .25+Math.abs(value-edge)/span;
}
function scoreReport(overall, features){
  const values=Object.assign({},overall,{favoriteWinRate:features.suites.strongWeak&&features.suites.strongWeak.favoriteWinRate,paritySideAWinShare:features.suites.parity&&features.suites.parity.paritySideAWinShare});
  let weighted=0,totalW=0;const checks={};
  for(const [key,spec] of Object.entries(TARGETS.metrics)){
    const value=values[key]; if(!Number.isFinite(value))continue;
    const penalty=metricPenalty(value,spec); const score=Math.max(0,100-penalty*100);
    checks[key]={value,min:spec.min,target:spec.target,max:spec.max,score,status:value<spec.min?'low':value>spec.max?'high':'ok'};
    weighted+=score*spec.weight; totalW+=spec.weight;
  }
  return {score:totalW?weighted/totalW:0,checks};
}

async function runProcesses(jobs){
  const batches=[];for(let i=0;i<jobs.length;i+=BATCH_SIZE)batches.push(jobs.slice(i,i+BATCH_SIZE));
  const childFile=path.join(ROOT,'tools/lab_chunk.js');
  const results=[],errors=[],timings=[];let next=0,active=0,finished=0;
  return new Promise((resolve,reject)=>{
    const launch=()=>{
      while(active<WORKERS&&next<batches.length){
        const batchId=next,chunk=batches[next++];active++;
        const child=fork(childFile,[],{stdio:['ignore','ignore','inherit','ipc']});let payload=null,failed=false;
        child.on('message',m=>{if(m&&m.type==='done')payload=m;});
        child.on('error',e=>{failed=true;reject(e);});
        child.on('exit',code=>{active--;if(failed)return;if(code!==0||!payload){reject(new Error(`Processo ${batchId} encerrou sem resultado (code ${code})`));return;}
          results.push(...payload.results);errors.push(...payload.errors);timings.push(...payload.timings);finished+=chunk.length;
          if(args.progress==='true')console.error(`[LAB] concluídas ${finished}/${jobs.length}`);
          if(finished>=jobs.length&&active===0)resolve({results,errors,timings});else launch();});
        child.send({type:'run',batchId,jobs:chunk});
      }
    };launch();
  });
}

async function runInProcess(jobs){
  const runtime=createRuntime(ROOT),results=[],errors=[],timings=[];
  const started=performance.now();
  for(let i=0;i<jobs.length;i++){
    const t=performance.now();
    try{results.push(runtime.runJob(jobs[i]));}
    catch(error){errors.push({id:jobs[i].id,error:String(error&&error.stack||error)});}
    const jobMs=performance.now()-t;timings.push(jobMs);
    if(global.gc) global.gc();
    if(args.progress==='true')console.error(`[LAB] ${i+1}/${jobs.length} ${jobs[i].id} ${(jobMs/1000).toFixed(2)}s`);
  }
  return {results,errors,timings,totalMs:performance.now()-started};
}

async function runWorkers(jobs){
  const batches=[];
  for(let i=0;i<jobs.length;i+=BATCH_SIZE)batches.push(jobs.slice(i,i+BATCH_SIZE));
  const workerFile=path.join(ROOT,'tools/lab_worker.js');
  const results=[],errors=[],timings=[];
  let next=0,active=0,finished=0;
  return new Promise((resolve,reject)=>{
    const launch=()=>{
      while(active<WORKERS&&next<batches.length){
        const batchId=next,chunk=batches[next++];active++;
        const w=new Worker(workerFile,{workerData:{root:ROOT,dt:DT,progress:args.progress==='true'}});
        let payload=null,failed=false;
        w.on('message',m=>{
          if(m.type==='progress'){console.error(`[LAB] lote ${batchId}: ${m.index}/${m.total} ${m.id}`);return;}
          if(m.type==='done')payload=m;
        });
        w.on('error',e=>{failed=true;reject(e);});
        w.on('exit',code=>{
          active--;
          if(failed)return;
          if(code!==0||!payload){reject(new Error(`Worker ${batchId} encerrou sem resultado (code ${code})`));return;}
          results.push(...payload.results);errors.push(...payload.errors);timings.push(payload.ms);finished+=chunk.length;
          if(args.progress==='true')console.error(`[LAB] concluídas ${finished}/${jobs.length}`);
          if(finished>=jobs.length&&active===0)resolve({results,errors,timings});else launch();
        });
        w.postMessage({type:'run',batchId,jobs:chunk});
      }
    };
    launch();
  });
}
function markdown(report){
  const c=report.calibration.checks;
  const rows=Object.entries(c).map(([k,v])=>`| ${k} | ${v.value.toFixed(4)} | ${v.min}–${v.max} | ${v.status==='ok'?'OK':v.status==='high'?'ALTO':'BAIXO'} |`).join('\n');
  return `# Laboratório estatístico — ${report.label}\n\n- Partidas: **${report.matches}**\n- Motor: **${report.engineVersion}**\n- Passo: **${report.dt}s**\n- Workers: **${report.workers}**\n- Tempo: **${(report.elapsedMs/1000).toFixed(1)}s**\n- Nota de calibração: **${report.calibration.score.toFixed(1)}/100**\n\n## Métricas gerais\n\n| Métrica | Valor | Faixa | Situação |\n|---|---:|---:|---|\n${rows}\n\n## Suites\n\n\`\`\`json\n${JSON.stringify(report.features.suites,null,2)}\n\`\`\`\n\n## Estilos\n\n\`\`\`json\n${JSON.stringify(report.features.styles,null,2)}\n\`\`\`\n`;
}

(async()=>{
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  const jobs=args.jobsFile ? JSON.parse(fs.readFileSync(path.resolve(String(args.jobsFile)),'utf8')) : generateJobs(COUNT);
  if(args.dumpJobs) fs.writeFileSync(path.resolve(String(args.dumpJobs)),JSON.stringify(jobs,null,2));
  if(args.generateOnly==='true') { console.log(JSON.stringify({jobs:jobs.length,file:args.dumpJobs||null},null,2)); process.exit(0); }
  const started=performance.now();
  let run;
  if(args.mergeDir){
    const dir=path.resolve(String(args.mergeDir));
    const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
    const merged=[];
    for(const f of files){const r=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));if(Array.isArray(r.raw))merged.push(...r.raw);}
    run={results:merged,errors:[],timings:[]};
    console.error(`[LAB] mesclando ${files.length} relatórios / ${merged.length} partidas`);
  }else{
    console.error(`[LAB] ${jobs.length} partidas, ${WORKERS} workers, dt=${DT}`);
    run=args.inProcess==='true'?await runInProcess(jobs):(args.workerMode==='true'?await runWorkers(jobs):await runProcesses(jobs));
  }
  const elapsed=performance.now()-started;
  if(run.errors.length){console.error(run.errors.slice(0,5));throw new Error(`${run.errors.length} partidas falharam`);}
  const overall=aggregate(run.results,'overall');const features=featureAggregates(run.results);const calibration=scoreReport(overall,features);
  const report={schema:'cds-lab-v1',label:LABEL,mode:MODE,createdAt:new Date().toISOString(),engineVersion:meta.calibrationVersion,targetsVersion:TARGETS.version,matches:run.results.length,executionMode:args.mergeDir?'merge':(args.inProcess==='true'?'in-process':(args.workerMode==='true'?'workers':'process-pool')),workers:args.mergeDir?0:(args.inProcess==='true'?1:WORKERS),batchSize:args.mergeDir?0:(args.inProcess==='true'?jobs.length:BATCH_SIZE),dt:DT,elapsedMs:elapsed,workerMs:run.timings,overall,features,calibration,raw:args.raw==='true'?run.results:undefined};
  fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2));
  fs.writeFileSync(OUTPUT.replace(/\.json$/i,'.md'),markdown(report));
  console.log(JSON.stringify({output:OUTPUT,matches:report.matches,seconds:+(elapsed/1000).toFixed(1),score:+calibration.score.toFixed(2),overall,critical:Object.fromEntries(Object.entries(calibration.checks).filter(([,v])=>v.status!=='ok'))},null,2));
  process.exit(0);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
