#!/usr/bin/env node
'use strict';
/*
 * OS-20 · VISUALIZACAO DE BOLA PARADA (SEM MINI GAME)
 * ---------------------------------------------------
 * Os minigames de falta e penalti ja estavam DESATIVADOS no motor:
 * `_requestSetPiece` (:4721) tem `return false` incondicional, e as cobrancas
 * resolvem com voo real e goleiro convergindo. O que faltava era o lance
 * APARECER — com a OS-10 sao ~7 cobrancas por partida resolvendo em silencio.
 *
 * Esta camada e SO DE APRESENTACAO:
 *   - envolve `_emit` para escutar `freekick_routine`, `penalty`, `foul`,
 *     `goal` e `save`;
 *   - desenha um cartao sobre o campo com tipo de cobranca, cobrador e
 *     distancia, e uma barra de tempo ate a batida;
 *   - marca o resultado (GOL, DEFENDEU, PRA FORA, NA BARREIRA) no mesmo
 *     cartao, e some sozinha.
 *
 * NAO consome RNG, NAO muda posse, trajetoria, estatistica ou decisao. O
 * envelope de `_emit` chama o original SEMPRE e ignora qualquer erro proprio,
 * entao nenhuma falha de interface pode derrubar a partida.
 *
 * Roda so no navegador: sem `document`, a camada nao instala e o motor segue
 * identico — as baterias em Node nao veem diferenca nenhuma.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.53 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.54 - JOGO DE FUTEBOL.html');
let src = fs.readFileSync(input, 'utf8');
const applied = [];

function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    console.error('ABORTA [' + id + ']: ancora ' + count + 'x');
    process.exit(1);
  }
  src = src.replace(from, to);
  applied.push(id);
}

const LAYER = `<style id="cds-os20-style">
#cds-sp{position:fixed;left:50%;top:14%;transform:translateX(-50%) translateY(-8px);
 z-index:9999;pointer-events:none;opacity:0;transition:opacity .18s ease,transform .18s ease;
 font-family:Arial,Helvetica,sans-serif;min-width:264px;max-width:82vw}
#cds-sp.on{opacity:1;transform:translateX(-50%) translateY(0)}
#cds-sp .cd{background:linear-gradient(180deg,rgba(10,22,16,.96),rgba(6,14,10,.96));
 border:1px solid rgba(255,203,69,.55);border-radius:12px;padding:11px 15px 9px;
 box-shadow:0 10px 30px rgba(0,0,0,.5)}
#cds-sp .kd{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.14em;
 text-transform:uppercase;color:#ffcb45;font-weight:700}
#cds-sp .kd i{width:7px;height:7px;border-radius:50%;background:#ffcb45;display:inline-block;
 animation:cdsPulse 1s ease-in-out infinite}
@keyframes cdsPulse{0%,100%{opacity:1}50%{opacity:.25}}
#cds-sp .nm{color:#fff;font-size:19px;font-weight:800;margin-top:3px;line-height:1.15}
#cds-sp .sb{color:#9fb3a6;font-size:12px;margin-top:2px}
#cds-sp .br{height:3px;border-radius:3px;background:rgba(255,255,255,.14);margin-top:9px;overflow:hidden}
#cds-sp .br i{display:block;height:100%;width:100%;background:#ffcb45;transform-origin:left center;
 animation:cdsRun 2.1s linear forwards}
@keyframes cdsRun{from{transform:scaleX(1)}to{transform:scaleX(0)}}
#cds-sp .rs{margin-top:7px;font-size:15px;font-weight:800;letter-spacing:.04em}
#cds-sp.ok .cd{border-color:rgba(80,220,130,.7)} #cds-sp.ok .rs{color:#50dc82}
#cds-sp.no .cd{border-color:rgba(255,110,110,.6)} #cds-sp.no .rs{color:#ff8a8a}
@media (max-width:520px){#cds-sp{top:11%;min-width:0;width:88vw}#cds-sp .nm{font-size:17px}}
</style>
<script id="cds-os20-setpiece-hud">
(function(root){
'use strict';
if(typeof document==='undefined')return;
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS20__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS20__',{value:true});}catch(_){P.__CDS_OS20__=true;}

var el=null,hideT=0,liveKind=null,liveTeam=null,liveUntil=0;
function node(){
  if(el&&el.isConnected)return el;
  el=document.getElementById('cds-sp');
  if(!el){el=document.createElement('div');el.id='cds-sp';document.body.appendChild(el);}
  return el;
}
function nome(p){
  try{
    var n=(p&&p.ref&&p.ref.n)||'';
    if(!n)return 'Cobrador';
    if(typeof root.lastWord==='function')return root.lastWord(n,16);
    var q=String(n).trim().split(' ');return q[q.length-1].toUpperCase();
  }catch(_){return 'Cobrador';}
}
var ROT={direct:'Cobrança direta',crossed:'Na área',short:'Jogada ensaiada'};
function mostrar(kind,titulo,jogador,sub,dur){
  try{
    var d=node();
    d.className='on';
    d.innerHTML='<div class="cd"><div class="kd"><i></i>'+titulo+'</div>'+
      '<div class="nm">'+jogador+'</div>'+
      (sub?'<div class="sb">'+sub+'</div>':'')+
      '<div class="br"><i style="animation-duration:'+(dur/1000).toFixed(2)+'s"></i></div>'+
      '<div class="rs"></div></div>';
    liveKind=kind;liveUntil=Date.now()+dur+2600;
    clearTimeout(hideT);hideT=setTimeout(esconder,dur+2600);
  }catch(_){}
}
function desfecho(txt,bom){
  try{
    if(!liveKind||Date.now()>liveUntil)return;
    var d=node(),r=d.querySelector('.rs');if(!r)return;
    r.textContent=txt;d.className='on '+(bom?'ok':'no');
    liveKind=null;
    clearTimeout(hideT);hideT=setTimeout(esconder,1500);
  }catch(_){}
}
function esconder(){try{if(el)el.className='';liveKind=null;}catch(_){}}

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(type==='freekick_routine'&&data){
      var dist=Number(data.dist);
      mostrar('fk','⚽ Falta — '+(ROT[data.routine]||'cobrança'),nome(data.by),
        (isFinite(dist)?Math.round(dist)+' m do gol':'')+
        (data.routine==='direct'?' · barreira armada':''),2100);
      liveTeam=data.team;
    } else if(type==='penalty'&&data){
      var t=(data.team!=null?data.team:(data.by&&data.by.team));
      mostrar('pk','🎯 Pênalti',nome(data.by||data.taker),'Marca da cal · 11 m',2600);
      liveTeam=t;
    } else if(type==='goal'){
      if(liveKind)desfecho(liveKind==='pk'?'GOL — PÊNALTI CONVERTIDO':'GOL — DE FALTA!',true);
    } else if(type==='save'){
      if(liveKind)desfecho('O GOLEIRO DEFENDEU',false);
    } else if(type==='post'){
      if(liveKind)desfecho('NA TRAVE',false);
    } else if(type==='blocked'){
      if(liveKind==='fk')desfecho('NA BARREIRA',false);
    } else if(type==='miss'){
      if(liveKind)desfecho('PRA FORA',false);
    } else if(type==='kickoff'||type==='half_time'){ esconder(); }
  }catch(_){}
  return r;
};
root.CDS_OS20=Object.freeze({version:'OS-20',feature:'SET_PIECE_HUD',presentationOnly:true,
  rngConsumption:false,engineMutation:false});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os20-setpiece-hud', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
