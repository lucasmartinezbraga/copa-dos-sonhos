/* Gera rc1-debug.html = build intocada + shim de rAF (o painel de navegador
   renderiza a página com visibilityState 'hidden' e o rAF nativo nunca dispara).
   O shim é ferramenta de laboratório: NÃO entra na build entregue. */
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const src = fs.readFileSync(path.join(ROOT, process.argv[2] || 'rc1.html'), 'utf8');
const out = process.argv[3] || 'rc1-debug.html';

const SHIM = `<script id="cds-lab-raf-shim">
(function(){
  var map = Object.create(null), id = 0;
  window.requestAnimationFrame = function(cb){
    var i = ++id;
    map[i] = setTimeout(function(){ delete map[i]; try{ cb(performance.now()); }catch(e){ (window.__labErrors=window.__labErrors||[]).push(String(e && e.stack || e)); } }, 16);
    return i;
  };
  window.cancelAnimationFrame = function(i){ if(map[i]){ clearTimeout(map[i]); delete map[i]; } };
  window.__CDS_LAB__ = { raf: 'setTimeout', errors: [] };
  window.addEventListener('error', function(e){ (window.__labErrors=window.__labErrors||[]).push(String(e.message + ' @ ' + e.filename + ':' + e.lineno)); });
})();
</script>`;

const anchor = '<html lang="pt-BR"><head>';
if (src.indexOf(anchor) < 0) throw new Error('âncora do <head> não encontrada');
let html = src.replace(anchor, anchor + '\n' + SHIM + '\n');

/* Sonda de LEITURA do escopo do módulo da interface (celebration/replay são
   `let` dentro do IIFE e invisíveis de fora). Só expõe getters. */
const probeAnchor = "let replay = null;        // { frames, idx, until } durante a reprodução";
if (html.indexOf(probeAnchor) < 0) throw new Error('âncora da sonda não encontrada');
const PROBE = `
try{window.__DBG_UI=Object.defineProperties({},{
  celebration:{get:function(){return celebration?{start:celebration.start,replayUntil:celebration.replayUntil,until:celebration.until,pendingTimelineId:celebration.pendingTimelineId,source:celebration.source,scorer:celebration.scorer,confetti:celebration.confetti?celebration.confetti.length:0}:null;}},
  replay:{get:function(){return replay?{source:replay.source,idx:replay.idx,elapsed:replay.elapsed,duration:replay.duration,frames:replay.frames.length,timelineId:replay.timelineId}:null;}},
  replayFrame:{get:function(){if(!replay||!replay.frames)return null;var f=replay.frames[Math.min(Math.floor(replay.idx),replay.frames.length-1)];return f?{ball:f.ball,np:(f.p||[]).length}:null;}},
  replayBufLen:{get:function(){return replayBuf.length;}},
  hasSim:{get:function(){try{return !!sim;}catch(_){return 'TDZ';}}},
  finished:{get:function(){try{return !!finished;}catch(_){return 'TDZ';}}},
  paused:{get:function(){try{return !!paused;}catch(_){return 'TDZ';}}},
  scene:{get:function(){try{var n=performance.now();return {fk:!!(fkScene&&n<fkScene.until),pen:!!(penScene&&n<penScene.until),brk:!!(breakOv&&n<breakOv.until)};}catch(_){return 'TDZ';}}},
  rframeActive:{get:function(){try{var vn=performance.now();return !!(replay&&celebration&&vn>=(celebration.start||0)&&vn<celebration.replayUntil);}catch(_){return 'TDZ';}}},
  now:{get:function(){return performance.now();}}
});}catch(_){}`;
html = html.replace(probeAnchor, probeAnchor + PROBE);

fs.writeFileSync(path.join(ROOT, out), html, 'utf8');
console.log('ok ->', out, fs.statSync(path.join(ROOT, out)).size, 'bytes');
