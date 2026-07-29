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

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home?'#2e9bff':'#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const N = Number(argv.matches||4), DT=1/30;
const FORMS = String(argv.formacoes||'4-3-3,4-4-2,3-5-2').split(',');
const G = {chamadas:0, semViagem:0, timeErrado:0, longeDoGol:0, latch:0, decidiu:0, saiu:0,
           distNoCommit:[], deslocamento:[], velMax:[]};
for (const form of FORMS) for (let i=0;i<N;i++){
  srand(1710000+i*977);
  const sim = new MatchSim(mk(form,true), mk(form,false), {neutral:true, labMode:true});
  const proto = Object.getPrototypeOf(sim);
  const orig = proto._gkCrossCommit;
  if (typeof orig !== 'function') { realConsole.log(JSON.stringify({erro:'_gkCrossCommit ausente nesta build'})); process.exit(1); }
  sim._gkCrossCommit = function(tm,p,b){
    G.chamadas++;
    if(!b||!b.traveling||b.kind!=='pass'||!b.target||!b.lastTouch) G.semViagem++;
    else if(b.lastTouch.team===tm.side) G.timeErrado++;
    else if(D(b.target.x,b.target.y,tm.goal.x,tm.goal.y)>16.5) G.longeDoGol++;
    else if(p._gkFor===b.target){ G.latch++;
      if(p.__gkStart){ const dd=D(p.x,p.y,p.__gkStart.x,p.__gkStart.y); p.__gkMoved=Math.max(p.__gkMoved||0,dd);
                       const v=Math.hypot(p.vx||0,p.vy||0); p.__gkV=Math.max(p.__gkV||0,v); } }
    else { G.decidiu++; }
    const antes = p._gkFor;
    const r = orig.apply(this,arguments);
    if (antes !== b.target && p._gkFor === b.target) {
      if (r) { G.saiu++; G.distNoCommit.push(D(p.x,p.y,b.target.x,b.target.y));
               p.__gkStart={x:p.x,y:p.y}; p.__gkMoved=0; p.__gkV=0; }
    }
    if (p.__gkStart && (!b.traveling || p._gkFor!==b.target)) {
      if (p.__gkMoved!=null){ G.deslocamento.push(p.__gkMoved); G.velMax.push(p.__gkV||0); }
      p.__gkStart=null; p.__gkMoved=null; p.__gkV=null;
    }
    return r;
  };
  let s=0; while(!sim.isOver() && s++<500000) sim.step(DT);
}
const nPart=N*FORMS.length;
const st=a=>{ if(!a.length) return null; const b=a.slice().sort((x,y)=>x-y);
  return {n:a.length, media:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2), mediana:+b[Math.floor(b.length/2)].toFixed(2), p90:+b[Math.floor(b.length*.9)].toFixed(2)}; };
realConsole.log(JSON.stringify({
  build:String(argv.build).split(/[\/]/).pop(), partidas:nPart,
  chamadasDoCommit:G.chamadas, porPartida:+(G.chamadas/nPart).toFixed(1),
  rejeicoes:{semViagemOuPasse:G.semViagem, bolaDoProprioTime:G.timeErrado, alvoLongeDoGol:G.longeDoGol, jaDecidido:G.latch},
  decisoesNovas:G.decidiu, decidiuSAIR:G.saiu,
  taxaDeSaida_pct:+(100*G.saiu/Math.max(1,G.decidiu)).toFixed(1),
  saidasPorPartida:+(G.saiu/nPart).toFixed(2),
  distanciaAoAlvoNoMomentoDaDecisao_m: st(G.distNoCommit),
  deslocamentoRealDoGoleiro_m: st(G.deslocamento),
  velocidadeMaximaAtingida_ms: st(G.velMax),
},null,2));
