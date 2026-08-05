#!/usr/bin/env node
'use strict';
/*
 * OS-113 · O AVISO SAI DE CIMA DO CHUTE, E A FALTA PASSA A SER LEGIVEL
 * ====================================================================
 *
 * DUAS OBSERVACOES DO DONO
 *   "As vezes sobe um balao de fora, trave, que tampa o chute, deveria ser
 *    melhor posicionado."
 *   "Eu nao entendi as faltas e os cartoes ate agora, queria resolver isso."
 *
 * O QUE O CODIGO DIZ
 *
 *   E1 · o balao e o HUD de bola parada da OS-20 (`#cds-sp`, :24652):
 *        `position:fixed; left:50%; top:14%` -- fixo a 14% do topo da JANELA,
 *        centralizado. No campo 2,5D o alto do quadro e o fundo do campo, que e
 *        exatamente para onde a falta e cobrada. Ele nasce escrevendo
 *        "Falta -- Cobranca direta / NOME / 22 m do gol" e termina escrevendo o
 *        desfecho ("NA TRAVE", :24749) -- em cima do chute que ele anuncia.
 *
 *   E2 · a falta e o cartao existem, e nao explicam nada:
 *        `NARR.foul` (:11013) diz **"Falta em <vitima>."** -- nao diz quem
 *        cometeu, nao diz de que time, nao diz o que acontece agora.
 *        `NARR.yellow` diz "Amarelo para <X>" -- nao diz por que.
 *        `_awardFoul` (:6877) sabe tudo isso e nao passa adiante: quem, em
 *        quem, se foi dura (`hard`), se e segundo amarelo, se e vermelho
 *        direto (:6884-6890).
 *        No campo a falta e um `❌` de 22 px e o cartao um retangulo de
 *        12x17 px (:14390 e :14400) -- some no meio do lance.
 *        E `foul` nao entra na lista de lances importantes (:12676), entao
 *        nao aparece em "LANCES DO JOGO".
 *
 * AS DUAS EDICOES -- as duas sao APRESENTACAO PURA
 *
 *   E1 · o HUD sai do caminho: desce para a base da tela, junto do resto dos
 *        avisos do jogo (`.pm-toast` ja mora em `bottom:16px`, :1661).
 *
 *   E2 · falta e cartao passam a dizer o que sao:
 *        - narracao da falta: quem cometeu, em quem, de que time, a que
 *          distancia do gol e para quem fica a bola;
 *        - narracao do cartao: o motivo (falta dura, segundo amarelo, vermelho
 *          direto) e quantos cartoes o jogador ja tem;
 *        - um aviso na tela, legivel, com o cartao desenhado em tamanho de
 *          gente, o nome, o time e o motivo.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   P1. `impressaoPorJogo` IDENTICA a da build de entrada. Esta camada so le
 *       `_emit` e escreve DOM; nao toca em posicao, posse, RNG nem estatistica.
 *       Se a impressao mudar, alguma coisa aqui esta errada e o patch cai.
 *
 * GATE QUE DECIDE
 *   A impressao (HANDOFF §3.1). Nao ha gate de ecologia a discutir: se a
 *   impressao bate, a simulacao nao foi tocada.
 *
 * ARMADILHA REGISTRADA
 *   A1. `NARR` e um `const` no escopo lexical global. Da para MUTAR o objeto,
 *       nao para reatribuir. E ele pode nao existir em builds futuras -- por
 *       isso tudo aqui e guardado e o patch degrada em silencio.
 *   A2. o cartao e emitido DEPOIS da falta, no mesmo `_awardFoul`. O motivo so
 *       existe se a falta anterior for lembrada -- `_emit('yellow')` sozinho
 *       nao carrega nem quem sofreu.
 */
const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
const flag = (n, p) => { const a = args.find(v => v.startsWith('--' + n + '=')); return a === undefined ? p : Number(a.split('=')[1]); };
const pos = args.filter(a => !a.startsWith('--'));
const IN = pos[0], OUT = pos[1];
if (!IN || !OUT) { console.error('uso: node patch_os113_falta_cartao_e_hud.js <entrada> <saida> [--hud=1] [--faltas=1]'); process.exit(1); }
const HUD = flag('hud', 1) ? 1 : 0;
const FALTAS = flag('faltas', 1) ? 1 : 0;
console.log('  OS-113  hud=' + HUD + '  faltas=' + FALTAS);
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const CAMADA = [
'<style id="cds-os113-style">',
/* E1 · o HUD de bola parada desce para a base. O `!important` e proposital:
   a regra original (:24652) e mais especifica do que parece por causa das
   sobrescritas da OS-50, e nao adianta competir com ela por peso. */
(HUD ? [
'#cds-sp{top:auto !important;bottom:16px !important;',
' transform:translateX(-50%) translateY(8px) !important}',
'#cds-sp.on{transform:translateX(-50%) translateY(0) !important}',
'@media (max-width:520px){#cds-sp{top:auto !important;bottom:12px !important;width:auto !important;max-width:92vw}}'
].join('\n') : ''),
'#cds-fc{position:fixed;left:50%;bottom:64px;transform:translateX(-50%) translateY(10px);',
' z-index:10000;pointer-events:none;opacity:0;transition:opacity .16s ease,transform .16s ease;',
' font-family:Arial,Helvetica,sans-serif;max-width:92vw}',
'#cds-fc.on{opacity:1;transform:translateX(-50%) translateY(0)}',
'#cds-fc .bx{display:flex;align-items:center;gap:11px;padding:9px 14px;border-radius:14px;',
' background:rgba(8,13,20,.92);box-shadow:0 6px 20px rgba(0,0,0,.45);',
' border:1px solid rgba(255,255,255,.14);white-space:nowrap}',
'#cds-fc .cart{width:22px;height:30px;border-radius:3px;flex:0 0 auto;',
' box-shadow:0 2px 6px rgba(0,0,0,.5);transform:rotate(-8deg)}',
'#cds-fc.am .cart{background:#f5c518} #cds-fc.vm .cart{background:#e23a3a}',
'#cds-fc.am .bx{border-color:rgba(245,197,24,.55)} #cds-fc.vm .bx{border-color:rgba(226,58,58,.6)}',
'#cds-fc .tx{display:flex;flex-direction:column;gap:2px;min-width:0}',
'#cds-fc .t1{font-size:13px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis}',
'#cds-fc .t2{font-size:11px;color:#9fb3c8}',
'#cds-fc .ic{font-size:20px;flex:0 0 auto}',
'</style>',
'<script id="cds-os113-falta-cartao">',
'(function(root){',
"'use strict';",
'if(typeof document===\'undefined\')return;',
'var M=root&&root.MatchSim;if(!M||!M.prototype||M.prototype.__OS113__)return;',
'var P=M.prototype;try{Object.defineProperty(P,"__OS113__",{value:true});}catch(_){P.__OS113__=true;}',
'',
'var FALTAS_LIGADAS=' + (FALTAS ? 'true' : 'false') + ';',
'var el=null,hideT=0,ultimaFalta=null;',
'',
'function node(){',
'  if(el&&el.isConnected)return el;',
'  el=document.getElementById("cds-fc");',
'  if(!el){el=document.createElement("div");el.id="cds-fc";document.body.appendChild(el);}',
'  return el;',
'}',
'function nome(p){',
'  try{var n=(p&&p.ref&&p.ref.n)||"";if(!n)return "Jogador";',
'    return String(n).trim();}catch(_){return "Jogador";}',
'}',
'function timeDe(sim,p){',
'  try{var t=sim&&sim.teams&&sim.teams[p.team];',
'    return (t&&(t.name||(t.squad&&t.squad.c)))||"";}catch(_){return "";}',
'}',
'/* a que distancia do gol que a vitima ataca -- e o que decide se a falta',
'   interessa ou nao */',
'function distGol(sim,v){',
'  try{var g=sim.teams[v.team].oppGoal;',
'    return Math.hypot(Number(v.x)-Number(g.x),Number(v.y)-Number(g.y));}catch(_){return NaN;}',
'}',
'function mostrar(classe,icone,t1,t2,ms){',
'  try{',
'    var d=node();',
'    d.className="on "+(classe||"");',
'    d.innerHTML=(classe==="am"||classe==="vm"?\'<div class="cart"></div>\':\'<div class="ic">\'+icone+\'</div>\')+',
'      \'<div class="tx"><div class="t1">\'+t1+\'</div><div class="t2">\'+t2+\'</div></div>\';',
'    d.innerHTML=\'<div class="bx">\'+d.innerHTML+\'</div>\';',
'    clearTimeout(hideT);hideT=setTimeout(function(){try{d.className="";}catch(_){}} ,ms||2600);',
'  }catch(_){}',
'}',
'',
'/* ---- narracao do feed: dizer quem, em quem, e o que acontece agora ------ */',
'try{',
'  if(FALTAS_LIGADAS&&typeof NARR!=="undefined"&&NARR){',
'    NARR.foul=function(e){',
'      var sim=root.__CDS_ACTIVE_SIM;',
'      var quem=nome(e.by),vit=nome(e.on);',
'      var t=sim?timeDe(sim,e.on):"";',
'      var d=sim?distGol(sim,e.on):NaN;',
'      var onde=isFinite(d)?(d<=30?" a "+Math.round(d)+" m do gol":""):"";',
'      return "Falta de <b>"+quem+"</b> em <b>"+vit+"</b>"+onde+',
'             (t?" — bola com "+t:"")+".";',
'    };',
'    NARR.yellow=function(e){',
'      var n=nome(e.p),q=(e.p&&e.p.yellow)||1;',
'      var vit=(ultimaFalta&&ultimaFalta.on===e.p)?null:(ultimaFalta&&ultimaFalta.on);',
'      return "🟨 Amarelo para <b>"+n+"</b> — falta dura"+',
'             (vit?" em "+nome(vit):"")+(q>=2?" (2º cartão)":"")+".";',
'    };',
'    NARR.red=function(e){',
'      var n=nome(e.p);',
'      return e.second',
'        ? "🟥 <b>"+n+"</b> EXPULSO — segundo amarelo. O time fica com um a menos."',
'        : "🟥 VERMELHO DIRETO para <b>"+n+"</b> — falta violenta. O time fica com um a menos.";',
'    };',
'  }',
'}catch(_){}',
'',
'/* ---- o aviso na tela ---------------------------------------------------- */',
'var oldEmit=P._emit;',
'P._emit=function(type,data){',
'  var r=oldEmit.apply(this,arguments);',
'  if(!FALTAS_LIGADAS)return r;',
'  try{',
'    if(type==="foul"&&data&&data.by&&data.on){',
'      ultimaFalta={by:data.by,on:data.on,at:Date.now()};',
'      var d=distGol(this,data.on);',
'      /* falta longe do gol acontece 14,7 vezes por partida: avisar todas',
'         viraria ruido. So aparece na tela a que muda alguma coisa. */',
'      if(isFinite(d)&&d<=32){',
'        mostrar("","🟡","Falta de "+nome(data.by),',
'          "em "+nome(data.on)+" · "+Math.round(d)+" m do gol · bola com "+timeDe(this,data.on),1900);',
'      }',
'    } else if(type==="yellow"&&data&&data.p){',
'      var vy=(ultimaFalta&&Date.now()-ultimaFalta.at<1500)?ultimaFalta.on:null;',
'      mostrar("am","","Amarelo — "+nome(data.p),',
'        timeDe(this,data.p)+" · falta dura"+(vy?" em "+nome(vy):"")+',
'        ((data.p.yellow||1)>=2?" · 2º cartão":""),2800);',
'    } else if(type==="red"&&data&&data.p){',
'      var vr=(ultimaFalta&&Date.now()-ultimaFalta.at<1500)?ultimaFalta.on:null;',
'      mostrar("vm","",(data.second?"Expulso — 2º amarelo":"Vermelho direto")+" — "+nome(data.p),',
'        timeDe(this,data.p)+(vr?" · falta em "+nome(vr):"")+" · time com um a menos",3400);',
'    } else if(type==="penalty"&&data){',
'      var pv=data.by||data.taker;',
'      mostrar("","🔴","PÊNALTI",',
'        (pv?nome(pv)+" · ":"")+"falta dentro da área",2600);',
'    }',
'  }catch(_){}',
'  return r;',
'};',
'root.CDS_OS113=Object.freeze({version:"OS-113",feature:"FOUL_CARD_LEGIBILITY_AND_HUD_PLACEMENT",',
'  presentationOnly:true,rngConsumption:false,engineMutation:false});',
'})(typeof window!==\'undefined\'?window:globalThis);',
'</script>',
''
].join('\n');

edit('os113-camada',
  '<script id="cds-r1886-build-meta">',
  CAMADA + '<script id="cds-r1886-build-meta">');

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
