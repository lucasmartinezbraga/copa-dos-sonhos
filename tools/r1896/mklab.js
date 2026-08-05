'use strict';
/* Gera a copia de LABORATORIO da build: build intocada + shim de rAF + sonda de
   leitura do IIFE da interface. O shim e ferramenta; NAO entra na entrega. */
const fs = require('fs'), path = require('path');

const src = fs.readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];

const SHIM = `<script id="cds-lab-raf-shim">
(function(){
  var map = Object.create(null), id = 0;
  window.requestAnimationFrame = function(cb){
    var i = ++id;
    map[i] = setTimeout(function(){ delete map[i]; try{ cb(performance.now()); }catch(e){ (window.__labErrors=window.__labErrors||[]).push(String(e && e.stack || e)); } }, 16);
    return i;
  };
  window.cancelAnimationFrame = function(i){ if(map[i]){ clearTimeout(map[i]); delete map[i]; } };
  window.__CDS_LAB__ = { raf: 'setTimeout' };
  window.addEventListener('error', function(e){ (window.__labErrors=window.__labErrors||[]).push(String(e.message + ' @ ' + e.filename + ':' + e.lineno)); });
})();
</script>`;

const anchor = '<html lang="pt-BR"><head>';
if (src.indexOf(anchor) < 0) throw new Error('ABORTA: ancora do <head> nao encontrada');
let html = src.replace(anchor, anchor + '\n' + SHIM + '\n');

/* Sonda de LEITURA do escopo do modulo da interface. cx/cy sao as funcoes de
   projecao logica (metros -> canvas 1024x500) e nao existem fora do IIFE. */
const probeAnchor = 'let replay = null;        // { frames, idx, until } durante a reprodução';
if (html.indexOf(probeAnchor) < 0) throw new Error('ABORTA: ancora da sonda nao encontrada');
const PROBE = `
try{window.__DBG_UI=Object.defineProperties({},{
  celebration:{get:function(){return celebration?{start:celebration.start,until:celebration.until,replayUntil:celebration.replayUntil,scorer:celebration.scorer}:null;}},
  rframeActive:{get:function(){try{var vn=performance.now();return !!(replay&&celebration&&vn>=(celebration.start||0)&&vn<celebration.replayUntil);}catch(_){return 'TDZ';}}},
  vfx:{get:function(){try{return vfx.map(function(v){return {t:v.type,x:v.x,y:v.y,ttl:v.ttl};});}catch(_){return 'TDZ';}}},
  paused:{get:function(){try{return !!paused;}catch(_){return 'TDZ';}}},
  cam:{get:function(){try{return {x:camX,y:camY,hold:camHold,z:camOverviewT};}catch(_){return 'TDZ';}}},
  shotFx:{get:function(){try{return shotFx?{k:shotFx.kind,x:+shotFx.x.toFixed(2),y:+shotFx.y.toFixed(2),z:+shotFx.z.toFixed(2),parked:shotFx.parked,t:+shotFx.t.toFixed(3),ripple:+shotFx.ripple.toFixed(2),cy:+shotFx.cy.toFixed(2),atRight:shotFx.atRight}:null;}catch(_){return 'TDZ';}}},
  outMark:{get:function(){try{return outMark?{k:outMark.kind,y:+outMark.y.toFixed(2),z:+outMark.z.toFixed(2),folga:+outMark.folga.toFixed(2),alto:outMark.alto,resta:Math.round(outMark.until-performance.now())}:null;}catch(_){return 'TDZ';}}},
  slowmo:{get:function(){try{return slowmo?{f:slowmo.f,resta:Math.round(slowmo.until-performance.now())}:null;}catch(_){return 'TDZ';}}},
  fkStep:{get:function(){try{return fkStep?{id:fkStep.id,dx:+fkStep.dx.toFixed(2),dy:+fkStep.dy.toFixed(2),idade:Math.round(performance.now()-fkStep.t0)}:null;}catch(_){return 'TDZ';}}},
  now:{get:function(){return performance.now();}}
});
window.__DBG_PROJ=function(mx,my){try{var p={x:cx(mx),y:cy(my)};if(window.CDS_F25D){var q=window.CDS_F25D.project(p.x,p.y);return {lx:p.x,ly:p.y,sx:q.x,sy:q.y,s:q.s};}return {lx:p.x,ly:p.y};}catch(e){return String(e);}};
}catch(_){}`;
html = html.replace(probeAnchor, probeAnchor + PROBE);

fs.writeFileSync(out, html, 'utf8');
console.log('ok ->', path.basename(out), fs.statSync(out).size, 'bytes');
