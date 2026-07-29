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

/* O que acontece com a bola depois de uma falta? Mede quantas viram penalti,
   cobranca direta, ou o ramo comum — e, no comum, QUANTO a bola anda entre o
   local da falta e onde o jogo recomeca. */
const db=buildDB(DATA);
const squad=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(squad,f,0);return{squad,name:squad.c,flag:squad.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'};};
const N=Number(argv.matches||4), DT=1/30;
const T={cobradas:0,faltas:0,penaltis:0,cobrancaDireta:0,comum:0,saltoDaBola:[],dead:[]};
for(const form of ['4-3-3','4-4-2','3-5-2']) for(let i=0;i<N;i++){
  srand(1710000+i*977);
  const sim=new MatchSim(mk(form,true),mk(form,false),{neutral:true,labMode:true});
  const proto=Object.getPrototypeOf(sim);
  const oEmitF=proto._emit; sim._emit=function(t,d){ if(t==='falta_cobrada')T.cobradas++; return oEmitF.apply(this,arguments); };
  const oAward=proto._awardFoul, oPen=proto._penalty, oFK=proto._freeKick;
  let pendente=null;
  sim._penalty=function(){ if(pendente)pendente.tipo='penalti'; return oPen.apply(this,arguments); };
  sim._freeKick=function(){ if(pendente)pendente.tipo='direta'; return oFK.apply(this,arguments); };
  sim._awardFoul=function(fouler,victim){
    T.faltas++;
    pendente={tipo:'comum', x:victim.x, y:victim.y};
    const r=oAward.apply(this,arguments);
    if(pendente.tipo==='penalti')T.penaltis++;
    else if(pendente.tipo==='direta')T.cobrancaDireta++;
    else{
      T.comum++;
      T.dead.push(this.dead||0);
      /* onde a bola ESTARA quando o jogo voltar: executa o pendingRestart num
         clone logico nao da; entao medimos a distancia do companheiro escolhido
         ao ponto da falta, que e onde a bola vai reaparecer. */
      const mate=this._nearestFieldMate?this._nearestFieldMate(victim):null;
      if(mate)T.saltoDaBola.push(Math.hypot(mate.x-pendente.x,mate.y-pendente.y));
    }
    pendente=null;
    return r;
  };
  let s=0; while(!sim.isOver()&&s++<400000) sim.step(DT);
}
const nPart=N*3;
const st=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);
  return{media:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1),p10:+b[Math.floor(b.length*.1)].toFixed(1),mediana:+b[Math.floor(b.length/2)].toFixed(1),p90:+b[Math.floor(b.length*.9)].toFixed(1),max:+b[b.length-1].toFixed(1)};};
realConsole.log(JSON.stringify({partidas:nPart, cobradas:T.cobradas||0,
  faltasPorPartida:+(T.faltas/nPart).toFixed(2),
  destino:{penalti:T.penaltis, cobrancaDireta:T.cobrancaDireta, ramoComum:T.comum,
           pctRamoComum:+(100*T.comum/Math.max(1,T.faltas)).toFixed(1)},
  RAMO_COMUM:{
    nota:'a bola nao e colocada no local da falta: e entregue ao companheiro mais proximo, onde ele estiver',
    distanciaDoLocalDaFalta_m: st(T.saltoDaBola),
    pausa_dead_s: st(T.dead)},
},null,2));
