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

const db=buildDB(DATA);
const squad=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(squad,f,0);return{squad,name:squad.c,flag:squad.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'};};
const N=Number(argv.matches||3),DT=1/30, A=[];
for(const form of ['4-3-3','4-4-2','3-5-2']) for(let i=0;i<N;i++){
  srand(1710000+i*977);
  const sim=new MatchSim(mk(form,true),mk(form,false),{neutral:true,labMode:true});
  const oE=Object.getPrototypeOf(sim)._emit;
  sim._emit=function(t,d){ if(t==='diag_def'&&d)A.push(d); return oE.apply(this,arguments); };
  let s=0; while(!sim.isOver()&&s++<400000) sim.step(DT);
}
const avg=k=>A.length?+(A.reduce((s,x)=>s+(x[k]||0),0)/A.length).toFixed(2):0;
const st=k=>{const a=A.map(x=>x[k]).filter(v=>Number.isFinite(v)&&v>=0).sort((x,y)=>x-y);
  if(!a.length)return null;return{media:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1),p10:+a[Math.floor(a.length*.1)].toFixed(1),mediana:+a[Math.floor(a.length/2)].toFixed(1)};};
realConsole.log(JSON.stringify({build:String(argv.build).split(/[\/]/).pop(), lances:A.length,
  LINHA_DEF_no_instante_do_cruzamento:{
    progressoMedio_m: st('defProgMedio'),
    zagueiroMaisAdiantado_m: st('defProgMin'),
    quantosDentroDaGrandeArea: avg('defDentroDaArea'),
    quantosAte20m: avg('defAte20m'),
    meioCampo_progressoMedio_m: st('midProgMedio'),
    linhaR13_variavel: st('linhaR13'),
    ameacaDeCruzamentoAtiva: avg('ameacaCruz'),
    bolaProgresso_m: st('bolaProg'),
  }},null,2));
