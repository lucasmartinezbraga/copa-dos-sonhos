#!/usr/bin/env node
'use strict';
/*
 * OS-46 · A ANIMACAO PASSA A RECEBER OS EVENTOS QUE JA EXISTEM
 * -------------------------------------------------------------
 * CENSO NO NAVEGADOR, 3 partidas completas, 231.814 amostras jogador-quadro
 * (`anim3.py`, estados lidos de `sim.animOf(p)`):
 *
 *     run 42,69% | jog 31,82% | walk 11,24% | gk_ready 9,00%
 *     idle 2,06% | sprint 1,12%
 *     carry 0,61%
 *     pass_*  1,22% somados
 *     shot_*  0,02% somados
 *     dribble_prepare, body_feint, inside_cut, outside_cut, turn_dribble,
 *       burst_touch, dribble_success, dribble_failure      0%   NUNCA
 *     gk_low_dive, gk_high_dive, gk_parry, gk_smother,
 *       gk_foot_save                                       0%   NUNCA
 *     header, block, intercept, slide_tackle, jockey       0%   NUNCA
 *
 * 98% do tempo e locomocao. O desenhista (`CDS_F25D.body`, :19517) SABE desenhar
 * voo de goleiro, finta, corte para dentro, cabeceio e bloqueio — o catalogo de
 * estados (`CDS_ANIM`, :19809) tem 60 entradas. Ninguem nunca PEDE a maioria
 * delas.
 *
 * MECANISMO (:20101, ponte R14). O unico mapa de eventos para estado e:
 *
 *     const map = { gk_save:'gk_parry', gk_claim:'gk_catch',
 *                   gk_punch:'gk_punch', gk_claim_miss:'gk_ground_recover' };
 *
 * O motor NAO emite `gk_save`. Ele emite **`save`** (:6418, :6426, :6433), com
 * `{gk, big, kind}`. A chave nunca bate, entao `gk_parry` nunca e pedido — e
 * como `gk_low_dive`/`gk_high_dive` nao estao no mapa, **o goleiro nunca voa**.
 * Passa 99% da partida em `gk_ready`.
 *
 * O mesmo vale para o resto: `dribble` (32/partida, com o campo `move` dizendo
 * qual drible foi), `header_shot`, `header_clear`, `blocked`, `intercept`,
 * `gk_sweep`, `tackle_missed`, `bad_pass` — todos existem no motor e nenhum
 * chega na animacao.
 *
 * EDIT · uma camada que envolve `_emit`, roda DEPOIS do original (para o
 * controlador ja existir) e pede o estado correspondente:
 *
 *     save        -> gk_high_dive / gk_low_dive / gk_foot_save / gk_parry /
 *                    gk_catch, escolhido pela GEOMETRIA da defesa (altura da
 *                    bola e afastamento lateral do goleiro), nao por sorteio
 *     gk_sweep    -> gk_smother
 *     dribble     -> body_feint / inside_cut / outside_cut / turn_dribble /
 *                    burst_touch conforme o campo `move` que o motor ja
 *                    escolheu em `_pickMove` (:5829); sem drible de efeito,
 *                    `dribble_prepare`
 *     header_shot / header_clear -> header
 *     blocked     -> block
 *     intercept   -> intercept
 *     tackle_missed -> slide_tackle
 *     bad_pass    -> lose_control
 *     miscontrol_out -> heavy_touch
 *
 * NADA de desenho novo: cada estado ja tem pose desenhada em `body()`. NADA de
 * fisica, de RNG ou de decisao — a camada so LE eventos e pede animacao. Sem
 * `CDS_ANIM` (ambiente sem a camada), ela nao instala e o jogo segue igual.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (censo de estados, 3 partidas):
 *   - `gk_ready` 99% do goleiro: DESCE; voo de goleiro passa a existir.
 *   - `dribble_*` 0%: passam a aparecer.
 *   - `header`, `block`, `intercept`, `slide_tackle` 0%: passam a aparecer.
 *   - locomocao (run+jog+walk+idle+sprint) 89%: DESCE alguns pontos.
 *   - os numeros do MOTOR (gols, chutes, escanteios, xG) tem de ficar
 *     IDENTICOS — esta camada nao toca em nada do jogo. Se mudarem, ha
 *     vazamento e o patch e recusado.
 *
 * ARMADILHA: pedir estado com `force:true` em evento muito frequente empurra o
 * atleta para uma pose que nunca sai, e o jogador vira estatua animada. Por
 * isso so eventos PONTUAIS entram, e nenhum deles e ciclico.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.70 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.71 - JOGO DE FUTEBOL.html');
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

const LAYER = `<script id="cds-os46-anim-wiring">
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS46__)return;
var A=root.CDS_ANIM;if(!A||typeof A.create!=='function')return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS46__',{value:true});}catch(_){P.__CDS_OS46__=true;}

/* mesma identidade da ponte R14 (:20077): time + referencia */
function idOf(p){return p?((p.team!=null?p.team:'?')+':'+((p.ref&&(p.ref.id||p.ref.n))||p.id||p.idx)):null;}

var MOVE={
  'arrancada':'burst_touch',
  'elástico':'body_feint',
  'elastico':'body_feint',
  'caneta':'body_feint',
  'drible da vaca':'turn_dribble',
  'meia-lua':'outside_cut',
  'corta pra dentro':'inside_cut'
};

var dbg={pedidos:0,porEstado:Object.create(null)};

function pede(sim,p,estado){
  try{
    if(!p||!estado)return;
    if(!sim.__anim)sim.__anim=A.create();
    var c=sim.__anim.of(idOf(p));
    if(!c||typeof c.request!=='function')return;
    c.request(estado,Number(sim.t)||0,{force:true});
    dbg.pedidos++;dbg.porEstado[estado]=(dbg.porEstado[estado]||0)+1;
  }catch(_){}
}

/* A DEFESA e escolhida pela geometria, nao por sorteio: quanto o goleiro teve
   de se deslocar em y e a que altura a bola estava. */
function defesa(sim,gk,data){
  try{
    var b=sim.ball;
    var z=Number(b&&b.z)||0;
    var dy=Math.abs((Number(gk.y)||0)-(Number(b&&b.y)||0));
    var k=(data&&data.kind)||'';
    if(k==='catch'||k==='double_catch'){ return dy>1.9?(z>1.25?'gk_high_dive':'gk_low_dive'):'gk_catch'; }
    if(dy>1.9) return z>1.25?'gk_high_dive':'gk_low_dive';
    if(z<0.45) return 'gk_foot_save';
    return 'gk_parry';
  }catch(_){return 'gk_parry';}
}

/* O VOO tem de ser pedido quando o chute COMECA a viajar. No instante em que
   o evento save e emitido, o goleiro ja foi levado ao ponto de interceptacao,
   entao o afastamento lateral e zero e nenhum mergulho e escolhido — medido:
   com o gatilho no evento save, gk_low_dive e gk_high_dive ficaram em 0%. O
   voo sai agora de _startTravel com meta.outcome==='save', que carrega o alvo
   de interceptacao e acontece com o goleiro ainda parado. */
var oldST=P._startTravel;
if(typeof oldST==='function'){
  P._startTravel=function(o,target,kind,cb,receiver,style,meta){
    try{
      if(meta&&target){
        var ator=meta.actor;
        if(meta.outcome==='save'&&ator&&ator.isGK){
          var dy=Math.abs((Number(ator.y)||0)-(Number(target.y)||0));
          var tz=Number(target.z);if(!isFinite(tz))tz=Number(this.ball&&this.ball.z)||0;
          /* MEDIDO: com o corte em 1,1 m o voo saiu em 0,01% — o goleiro da
             OS-19 fica bem posicionado e quase nunca precisa de mais de 1 m.
             Defesa com QUALQUER componente lateral e voo; palma seca fica so
             para bola em cima dele. */
          var est = dy>0.55 ? (tz>1.15?'gk_high_dive':'gk_low_dive')
                  : (tz<0.5?'gk_foot_save':'gk_parry');
          pede(this,ator,est);
        } else if(meta.outcome==='block'&&ator){ pede(this,ator,'block'); }
      }
      /* CHUTE: o contrato de acao da R14 cobre pouco (shot_ em 0,02% do
         tempo contra 18 chutes por partida). Todo voo de chute pede a pose. */
      if(kind==='shot'&&o&&!(meta&&meta.actor===o)){ pede(this,o,'shot_prepare'); }
    }catch(_){}
    return oldST.apply(this,arguments);
  };
}

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(data){
      if(type==='save'&&data.gk){ pede(this,data.gk,defesa(this,data.gk,data)); }
      else if(type==='gk_sweep'&&data.gk){ pede(this,data.gk,'gk_smother'); }
      else if(type==='dribble'&&data.by){
        pede(this,data.by,(data.move&&MOVE[String(data.move).toLowerCase()])||'dribble_prepare');
      }
      else if((type==='header_shot'||type==='header_clear')&&data.by){ pede(this,data.by,'header'); }
      else if(type==='blocked'&&data.by){ pede(this,data.by,'block'); }
      else if(type==='intercept'&&data.by){ pede(this,data.by,'intercept'); }
      else if(type==='tackle_missed'&&data.by){ pede(this,data.by,'slide_tackle'); }
      else if(type==='bad_pass'&&data.by){ pede(this,data.by,'lose_control'); }
      else if(type==='miscontrol_out'&&data.by){ pede(this,data.by,'heavy_touch'); }
    }
  }catch(_){}
  return r;
};

P.getOS46Audit=function(){
  return {pedidos:dbg.pedidos,porEstado:JSON.parse(JSON.stringify(dbg.porEstado))};
};
root.CDS_OS46=Object.freeze({version:'OS-46',feature:'ANIM_EVENT_WIRING',
  presentationOnly:true,engineMutation:false,rngConsumption:false});
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

edit('os46-anim-wiring', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
