#!/usr/bin/env node
'use strict';
/* OCUPAÇÃO DA ÁREA NO MOMENTO DO CRUZAMENTO
   -------------------------------------------------------------------------
   Funil medido: 19,12 cruzamentos por partida, mas só 1,20 cabeceios ao gol e
   0,88 cortes de cabeça. Uns cinco cruzamentos aéreos somem sem virar disputa.

   Hipótese: a área está VAZIA quando a bola chega. O motor exige alvo aéreo
   dentro de 24 m do gol (`inBox`, linha 5304); sem ninguém lá, o cruzamento
   cai no ramo de falha de entrega e vira bola perdida.

   Mede, no instante exato de cada `_cross`: quantos companheiros estão dentro
   dos 24 m, quantos dentro dos 16 m (área de verdade), e como isso se
   distribui. Só observação. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-area', language: 'pt-BR' });
define('location', { href: 'runner://area', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); }
  catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message || e))) continue; throw e; }
}

/* De que distancia se chuta? Real: ~10-15% dos chutes alem de 30 m; alem de
   35 m e raro. Mede TODA rota que emite finalizacao, e de onde saem os gols. */
const db=buildDB(DATA);
const squad=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(squad,f,0);return{squad,name:squad.c,flag:squad.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'};};
const N=Number(argv.matches||4), DT=1/30;
const D2=(a,b,c,d)=>Math.hypot(a-c,b-d);
const porRota={}, todos=[], gols=[];
function reg(rota,d){ (porRota[rota]=porRota[rota]||[]).push(d); todos.push(d); }
for(const form of ['4-3-3','4-4-2','3-5-2']) for(let i=0;i<N;i++){
  srand(1710000+i*977);
  const sim=new MatchSim(mk(form,true),mk(form,false),{neutral:true,labMode:true});
  const oE=Object.getPrototypeOf(sim)._emit;
  sim._emit=function(t,d){
    try{
      if(d&&d.by&&Number.isFinite(d.by.x)){
        const tm=this.teams[d.by.team], g=tm&&tm.oppGoal;
        if(g){
          const dist=D2(d.by.x,d.by.y,g.x,g.y);
          if(t==='shot_taken')reg('shot_taken',dist);
          else if(t==='low_cross_shot')reg('low_cross_shot',dist);
          else if(t==='header_shot')reg('header_shot',dist);
          else if(t==='goal')gols.push(dist);
        }
      }
    }catch(_){}
    return oE.apply(this,arguments);
  };
  let s=0; while(!sim.isOver()&&s++<400000) sim.step(DT);
}
const nPart=N*3;
function perfil(a){
  if(!a.length)return null; const b=a.slice().sort((x,y)=>x-y);
  const q=p=>+b[Math.min(b.length-1,Math.floor(b.length*p))].toFixed(1);
  const pc=f=>+(100*a.filter(f).length/a.length).toFixed(1);
  return {n:a.length, porPartida:+(a.length/nPart).toFixed(2), media:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1),
    mediana:q(.5), p90:q(.9), max:+b[b.length-1].toFixed(1),
    pct_alem_25m:pc(x=>x>25), pct_alem_30m:pc(x=>x>30), pct_alem_35m:pc(x=>x>35), pct_alem_40m:pc(x=>x>40)};
}
realConsole.log(JSON.stringify({build:String(argv.build).split(/[\/]/).pop(), partidas:nPart,
  TODAS_AS_FINALIZACOES: perfil(todos),
  porRota: Object.fromEntries(Object.entries(porRota).map(([k,v])=>[k,perfil(v)])),
  GOLS_de_que_distancia: perfil(gols),
  referenciaReal:'~10-15% dos chutes alem de 30 m; alem de 35 m e raro',
},null,2));
