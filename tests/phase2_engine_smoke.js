#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');global.window=global;global.performance=performance;global.CanvasRenderingContext2D=undefined;
window.__cdsDebugWarn=()=>{};window.__cdsDebugLog=()=>{};
/* ESTE TESTE MUDOU DE PREMISSA EM 2026-08-12, e o motivo importa.
   ---------------------------------------------------------------
   Ele carregava SO os modulos do core e rodava uma partida. Ao rodar a suite
   inteira depois do D03, morreu:

       TypeError: this._os200ResolverChute is not a function
       TypeError: this._physicalContactValid is not a function

   Nao e regressao: e o D03 funcionando. Ate ali `_shoot` chamava o resolvedor
   atras de `if(this._os200ResolverChute)` e, sem a camada, o motor caia num
   caminho antigo e nao medido. O D03 removeu os quatro guardas de proposito —
   a ausencia da camada de fisica virou ERRO VISIVEL em vez de silencio.

   O que isso revela e maior que o teste: **o core sozinho deixou de ser uma
   configuracao que roda.** Duas dependencias apareceram so de dar dois passos;
   nao ha razao para crer que sejam as ultimas.

   Nao stubei os metodos que faltavam — chute resolvido por stub nao testa
   chute nenhum, e em silencio. Nao fui acrescentando camada por camada
   tambem: isso seria descobrir a lista por tentativa e erro e ela envelheceria
   no proximo defeito. Carrego a pilha inteira, na ordem do manifesto, que e a
   mesma ordem que o `tools/build.py` usa.

   O que o teste continua provando, e nenhum outro prova sem DOM: perfis V3
   presentes em todo jogador, exatamente um goleiro por time, e estado numerico
   finito depois de 2.500 quadros. */
const CORE=['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js','src/scripts/30-tactics.js','src/scripts/40-match-engine-and-manager-ai.js'];
const MANIFESTO=JSON.parse(fs.readFileSync(path.join(ROOT,'manifests/build-manifest.json'),'utf8'));
const CAMADAS=MANIFESTO.blocks.map(b=>b.file).filter(f=>f&&f.startsWith('src/scripts/layers/')&&f.endsWith('.js'));
/* as mesmas que as sondas pulam: dependem de DOM/rede e nao do motor */
const PULAR=new Set(['00-inline.js']);
let carregadas=0;
for(const rel of CORE.concat(CAMADAS.filter(f=>!PULAR.has(path.basename(f))))){
 try{vm.runInThisContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),{filename:rel});carregadas++;}
 catch(e){if(CORE.includes(rel))throw e;/* camada que precisa de DOM: a sonda tambem as pula */}
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
