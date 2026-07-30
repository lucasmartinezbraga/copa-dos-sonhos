#!/usr/bin/env node
'use strict';
/* ============================================================================
 * R18.43 · PISO DE PROFUNDIDADE DO BLOCO  (OS-07 — cardume e campo vazio)
 * ----------------------------------------------------------------------------
 * A CACADA, e o patch que NAO foi escrito. O primeiro candidato obvio era o
 * escalonamento de bascula do bundle base, em `_defendTarget`:
 *
 *     const shiftScale = pLine === 'DEF' ? 0.25 : pLine === 'MID' ? 0.34 : 0.43;
 *
 * Ele esta invertido em relacao ao futebol (o atacante recua MAIS que o zagueiro,
 * 0,43 contra 0,25, logo o bloco encurta sozinho quando a bola desce). Corrigir
 * ali seria inerte, e por pouco eu nao escrevi esse patch: o bloco
 * `cds-r13-football-observer` sobrescreve `_defendTarget` e trata DEF, MID,
 * marcacao, cobertura, sombra e dropper com `return` proprio, caindo em
 * `oldDefend13.apply` SOMENTE para FWD sem papel. Para DEF e MID aquele
 * `shiftScale` e codigo morto. E o mesmo erro do handoff §6 (patch na copia
 * sombreada), evitado desta vez procurando `P.<nome>=function` antes de editar.
 *
 * A CADEIA VIVA de `_defendTarget`, em ordem de execucao:
 *   base(7471) <- r13-observer <- R18.5 <- orientacao <- r18173 <- antecipacao
 * Todos os elos delegam, entao todos contam. O elo que fixa a geometria e o
 * R18.5:
 *     if(L==='DEF') px = clamp(px, line-2.45, line+2.45);
 *     else if(L==='MID') px = clamp(px, line-1.8, line+10.8);
 * ...e nao existe ramo para FWD. Zaga e meio sao ancorados em `_r13LineDepth`
 * com trilho apertado; o ataque nao e ancorado em nada coletivo.
 *
 * O MECANISMO, medido em tools/r1843/diag_espaco.js (R18.40A, n=12, s=4200000):
 *   DEF->MID  11,9 m defendendo / 12,9 m atacando   <- saudavel, no clamp
 *   DEF->FWD  25,0 m defendendo / 26,4 m atacando   <- alvo ESP-03 e > 30 m
 * O deficit esta inteiro na linha de FRENTE, e nas DUAS fases. Porque nas duas
 * o atacante e ancorado NA BOLA, nunca na propria zaga:
 *   atacando   (`_attackTarget`): tProg = clamp(max(homeProg-4, ballProg+9), ...)
 *   defendendo (`_defendTarget` base): tx = p.hx + (b.x-FL/2)*0.43
 * Com a bola recuando, o atacante recua junto nos dois casos, e nada no motor
 * garante uma profundidade minima de bloco. Isso e o cardume: 20 corpos que
 * seguem a bola porque ninguem tem ordem de NAO seguir.
 *
 * O CONSERTO. Um piso coletivo: o atacante nao pode ficar a menos de X metros
 * a frente do centroide da PROPRIA zaga. E a mesma ideia que o R18.5 ja aplica
 * a DEF e MID (trilho relativo a linha), estendida a linha que ficou de fora —
 * nao um numero novo inventado, mas a regra existente completada.
 *
 * POR QUE UMA CAMADA NOVA NO FIM, e nao uma edicao no R18.5. Porque depois do
 * R18.5 ainda correm dois elos (`r18173` de zona/duty e a antecipacao de
 * pressao) que reescrevem `tx` para varios papeis. Um piso posto no meio da
 * cadeia seria desfeito por eles. Esta camada entra por ultimo e vence — e por
 * ser aditiva, nao muda nenhum caminho de codigo existente quando o piso ja
 * esta satisfeito.
 *
 * IMPEDIMENTO. Na fase ofensiva o piso e cortado por `_offsideLine(tm.side)`,
 * entao ele nunca cria posicao irregular. O handoff §6 registra que uma rodada
 * anterior subiu impedimentos em 56% sem perceber; aqui o teto e explicito e o
 * gate de impedimento e medido na bateria.
 *
 * USO
 *   node tools/r1843/patch_espaco.js --in=ENTRADA.html --out=SAIDA.html \
 *        [--pisoDef=30] [--pisoAtk=32] [--suave=0.55]
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const PISO_DEF = a('pisoDef', '30');
const PISO_ATK = a('pisoAtk', '32');
const SUAVE    = a('suave', '0.55');

let src = fs.readFileSync(a('in', 'entrada.html'), 'utf8');

const ANCORA = '</body></html>';
if (src.split(ANCORA).length - 1 !== 1) {
  console.error('ABORTA: ancora ' + ANCORA + ' nao encontrada exatamente 1x'); process.exit(1);
}

const CAMADA = `<script id="cds-r1843-block-depth">
/* R18.43 · PISO DE PROFUNDIDADE DO BLOCO — OS-07.
   Zaga e meio já andam num trilho relativo a _r13LineDepth (camada R18.5). A
   linha de frente nunca teve trilho: é ancorada na bola nas duas fases, então o
   bloco encurta sozinho quando a bola desce. Esta camada dá à frente o mesmo
   tipo de referência coletiva: uma distância MÍNIMA à frente da própria zaga.
   Aditiva — quando o piso já está satisfeito, não altera nada. */
(function(root){
  'use strict';
  var P = root.MatchSim && root.MatchSim.prototype;
  if(!P || typeof P._defendTarget !== 'function' || typeof P._attackTarget !== 'function') return;
  var VERSION = '5.31.0-R18.43';
  var PISO_DEF = ${PISO_DEF}, PISO_ATK = ${PISO_ATK}, SUAVE = ${SUAVE};
  var _FL = (typeof FL === 'number' && FL > 0) ? FL : 105;
  var _FW = (typeof FW === 'number' && FW > 0) ? FW : 68;
  function fin(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function cl(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }
  /* Progresso do PRÓPRIO time: 0 no gol que defende, _FL no gol que ataca.
     Mesma convenção de ownProg/fromProg da camada R18.5. */
  function ownProg(tm, x){ return (tm && tm.goal && tm.goal.x < _FL/2) ? x : _FL - x; }
  function fromProg(tm, x){ return (tm && tm.goal && tm.goal.x < _FL/2) ? x : _FL - x; }
  function lineOf(p){
    var pos = p && (p.oopPos || p.slotPos);
    if(!p || p.isGK || pos === 'GK') return 'GK';
    if(pos==='CB'||pos==='LB'||pos==='RB'||pos==='LWB'||pos==='RWB') return 'DEF';
    if(pos==='CDM'||pos==='DM'||pos==='CM'||pos==='CAM'||pos==='LM'||pos==='RM') return 'MID';
    return 'FWD';
  }
  /* Centroide da própria zaga, em progresso. É a referência coletiva: o bloco
     mede a si mesmo, não a bola. */
  function defLine(tm){
    if(!tm || !tm.players) return null;
    var s = 0, n = 0;
    for(var i=0;i<tm.players.length;i++){
      var q = tm.players[i];
      if(!q || q.red || q.isGK) continue;
      if(lineOf(q) === 'DEF'){ s += ownProg(tm, fin(q.x, 0)); n++; }
    }
    return n ? (s/n) : null;
  }
  var A = { defCalls:0, defElevados:0, atkCalls:0, atkElevados:0,
            cortadoPorImpedimento:0, ganhoSoma:0, ganhoN:0 };
  function aplica(sim, tm, p, out, piso, teto){
    var dl = defLine(tm);
    if(dl === null) return out;
    var px = ownProg(tm, fin(out[0], p.x));
    var alvo = dl + piso;
    if(px >= alvo) return out;
    /* Sobe apenas uma fração do que falta: o piso é uma referência, não um
       teletransporte. O corpo continua andando pelo _integrate normal, com o
       maxSpd do próprio atleta. */
    var novo = px + (alvo - px) * SUAVE;
    if(typeof teto === 'number') { if(novo > teto){ novo = teto; A.cortadoPorImpedimento++; } }
    novo = cl(novo, 1, _FL - 3.5);
    if(novo <= px) return out;
    A.ganhoSoma += (novo - px); A.ganhoN++;
    return [ fromProg(tm, novo), out[1] ];
  }

  var oldDef = P._defendTarget;
  P._defendTarget = function(tm, p, b, presser){
    var out = oldDef.apply(this, arguments);
    try{
      if(!out || !tm || !p || p.red || p.isGK || p === presser) return out;
      if(p === tm._cover || p === tm._shadow) return out;      // dever de bola manda
      if(lineOf(p) !== 'FWD') return out;
      A.defCalls++;
      var r = aplica(this, tm, p, out, PISO_DEF, undefined);
      if(r !== out) A.defElevados++;
      return r;
    }catch(_){ return out; }
  };

  var oldAtk = P._attackTarget;
  P._attackTarget = function(tm, p, b){
    var out = oldAtk.apply(this, arguments);
    try{
      if(!out || !tm || !p || p.red || p.isGK) return out;
      if(lineOf(p) !== 'FWD') return out;
      if(p._breaking || (p._burst && p._burst.kind === 'tabela')) return out; // corrida própria
      A.atkCalls++;
      /* Teto de impedimento: o piso nunca coloca ninguém em posição irregular. */
      var teto = _FL - 3.5;
      if(typeof this._offsideLine === 'function'){
        try{ teto = Math.min(teto, fin(this._offsideLine(tm.side), _FL - 3.5) - 0.35); }catch(_){}
      }
      var r = aplica(this, tm, p, out, PISO_ATK, teto);
      if(r !== out) A.atkElevados++;
      return r;
    }catch(_){ return out; }
  };

  P.getBlockDepthAudit = function(){
    return { version: VERSION, pisoDef: PISO_DEF, pisoAtk: PISO_ATK, suave: SUAVE,
      chamadasDef: A.defCalls, elevadosDef: A.defElevados,
      chamadasAtk: A.atkCalls, elevadosAtk: A.atkElevados,
      cortadoPorImpedimento: A.cortadoPorImpedimento,
      ganhoMedio_m: A.ganhoN ? A.ganhoSoma / A.ganhoN : 0 };
  };
  try{
    root.CDS_R1843_ESPACO = Object.freeze({ version: VERSION,
      label: 'PISO DE PROFUNDIDADE DO BLOCO',
      pisoDef: PISO_DEF, pisoAtk: PISO_ATK, suave: SUAVE,
      note: 'DEF e MID ja tinham trilho relativo a _r13LineDepth (camada R18.5); FWD nao tinha nenhum e era ancorado na bola nas duas fases (tProg=ballProg+9 atacando, p.hx+(b.x-FL/2)*0.43 defendendo). Sem piso coletivo o bloco encurtava junto com a bola. Medido antes: DEF->FWD 25,0 m defendendo e 26,4 m atacando, contra alvo ESP-03 de 30 m. Piso cortado por _offsideLine na fase ofensiva.',
      rngUsed: false, teleport: false });
    root.CDS_BUILD_ID = 'R18.43'; root.CDS_VERSION = VERSION;
    if(root.document) root.document.title = 'Copa dos Sonhos — R18.43';
  }catch(_){}
})(typeof window !== 'undefined' ? window : globalThis);
</script>
</body></html>`;

src = src.replace(ANCORA, CAMADA);
const dest = a('out', 'r1843.html');
fs.writeFileSync(dest, src, 'utf8');
console.log(path.basename(dest), '| pisoDef', PISO_DEF, '| pisoAtk', PISO_ATK, '| suave', SUAVE,
  '|', crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').slice(0, 12));
