#!/usr/bin/env node
'use strict';
/* ============================================================================
 * R18.48 · JANELA DE COMPROMISSO DA CONDUCAO — OS-08 / INT-01 / INT-02
 * ----------------------------------------------------------------------------
 * O DIAGNOSTICO, medido em tools/r1848/diag_conducao.js (R18.44, n=48, s1):
 *
 *   INT-01 conducao          1,182% das acoes do portador   (matriz: 1,18%)
 *   chamadas de _carry       6,563 por partida
 *   metros por conducao      2,301 m
 *   metros conduzidos        15,103 m por partida
 *
 * O INT-01 medido bate EXATAMENTE com o da matriz (1,182 contra 1,18), o que
 * confirma a definicao (chamadas de _carry sobre o total de acoes do portador).
 *
 * E aparece o segundo numero, que e o mecanismo: `_carry` fixa alvo a
 * `reach = 8 + min(6, espaco)*0,6` metros a frente, ou seja 8 a 11,6 m — e o
 * corpo percorre 2,301 m. A conducao NAO e uma acao sustentada. Motivo:
 *
 *     CAL.timing.decisionInterval = 0.28
 *
 * O portador redecide a cada 0,28 s. A 5 m/s isso e ~1,4 m. Entao a conducao
 * dura um ou dois ciclos de decisao e e substituida por outra acao antes de
 * chegar a qualquer lugar. Conduzir, neste motor, e um empurrao de 2,3 m.
 *
 * A MATRIZ JA SABIA. A coluna "Dependencia" de OS-08 diz literalmente
 * "Janela de compromisso". Cheguei ao mesmo mecanismo pela medicao, o que e uma
 * confirmacao independente e nao uma coincidencia: e a unica leitura possivel de
 * 2,3 m medidos contra 8-11,6 m pretendidos.
 *
 * AVISO QUE ESTA NO PROPRIO CODIGO, e precisa ser respeitado. No dispatch de
 * `_decide` ha o comentario:
 *     "(Conducao com proposito foi testada e regrediu: precisa da reacao
 *      defensiva — fundacao futura.)"
 * Ou seja alguem ja tentou isto e piorou. Por isso a janela aqui NAO e uma
 * corrida cega: ela quebra em quatro condicoes, todas verificadas a cada
 * decisao. Se o resultado regredir de novo, a comparacao com aquela tentativa
 * fica registrada em vez de perdida.
 *
 * O CONSERTO. Quando a decisao escolhe conduzir, abre-se uma janela de
 * compromisso. Enquanto ela vale, o portador NAO redecide: mantem o rumo. A
 * janela quebra imediatamente se:
 *   1. um adversario chega a menos de PRESSAO metros (o bote corta o luxo);
 *   2. o portador entra em faixa de chute (dtg <= DTG_MIN) — a conducao existe
 *      para MELHORAR o xG, entao ao chegar ela devolve a decisao ao motor, que
 *      agora avalia o chute de uma posicao melhor;
 *   3. o alvo da conducao foi alcancado (a menos de 1,6 m);
 *   4. a janela expira.
 *
 * Nao mexe em `cone===0` (a condicao que ESCOLHE conduzir), nao mexe no
 * `decisionInterval` global, nao consome RNG e nao teleporta: o corpo continua
 * andando pelo `_integrate` normal, com o maxSpd do proprio atleta. O que muda e
 * so a persistencia da INTENCAO.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR. `metros_por_conducao` deve subir de 2,301
 * para algo entre 4 e 7. `INT-01` deve subir pouco ou nada (a janela nao faz
 * escolher conduzir mais vezes — ela faz cada conducao valer mais), e se subir
 * muito e porque a janela esta impedindo o portador de passar, o que seria uma
 * regressao disfarcada de melhora. A metrica que decide utilidade e a posse no
 * terco final e as situacoes de chute: se os metros subirem e o terco final nao,
 * a conducao esta andando para o lado.
 *
 * USO
 *   node tools/r1848/patch_conducao.js --in=E.html --out=S.html
 *        [--janela=0.9] [--pressao=2.6] [--dtgMin=20]
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const JANELA = a('janela', '0.9');
const PRESSAO = a('pressao', '2.6');
const DTG_MIN = a('dtgMin', '20');
/* 'sobrepor' roda a cadeia de _decide e restaura o alvo depois (nao pula
   contabilidade de ninguem). 'atalho' retorna antes — mais barato e QUEBRA
   COE-01, medido. */
const MODO = a('modo', 'sobrepor');

let src = fs.readFileSync(a('in', 'entrada.html'), 'utf8');
if (src.split('</body></html>').length - 1 !== 1) { console.error('ABORTA: ancora </body></html> nao unica'); process.exit(1); }

const CAMADA = `<script id="cds-r1848-carry-commitment">
/* R18.48 · Janela de compromisso da conducao (OS-08).
   _carry fixa alvo a 8-11,6 m e o corpo percorre 2,3 m, porque o portador
   redecide a cada 0,28 s (CAL.timing.decisionInterval). A conducao vira um
   empurrao. Esta camada faz a INTENCAO persistir, com quatro quebras. */
(function(root){
  'use strict';
  var P = root.MatchSim && root.MatchSim.prototype;
  if(!P || typeof P._decide !== 'function') return;
  var VERSION='5.35.0-R18.48';
  var JANELA=${JANELA}, PRESSAO=${PRESSAO}, DTG_MIN=${DTG_MIN}, MODO='${MODO}';
  var A={abertas:0,mantidas:0,quebraPressao:0,quebraFaixaChute:0,quebraChegou:0,quebraExpirou:0,quebraOutraAcao:0};
  function fin(v,d){ return (typeof v==='number'&&isFinite(v))?v:d; }

  var oldDecide=P._decide;
  P._decide=function(o){
    try{
      if(o && !o.isGK && this.ball && this.ball.owner===o && !this.ball.traveling && this.teams){
        var c=o.__r1848Carry;
        if(c){
          var tm=this.teams[o.team], g=tm&&tm.oppGoal;
          var t=fin(this.t,0);
          if(t>=c.until){ o.__r1848Carry=null; A.quebraExpirou++; }
          else if(g){
            var dtg=Math.hypot(fin(o.x,0)-fin(g.x,0), fin(o.y,0)-fin(g.y,0));
            var nd=99;
            try{ var n=this._nearestOpponent(o); if(n) nd=fin(n.dist,99); }catch(_){}
            var chegou=Math.hypot(fin(o.x,0)-c.tx, fin(o.y,0)-c.ty)<1.6;
            if(nd<=PRESSAO){ o.__r1848Carry=null; A.quebraPressao++; }
            else if(dtg<=DTG_MIN){ o.__r1848Carry=null; A.quebraFaixaChute++; }
            else if(chegou){ o.__r1848Carry=null; A.quebraChegou++; }
            else if(MODO==='atalho'){
              /* Mantem o rumo SEM redecidir. Mais barato, mas pula a cadeia de
                 _decide inteira — e as camadas posteriores fazem contabilidade
                 de chute ali. Medido: quebra COE-01 (gols/xG 1,01 -> 1,29). */
              o._act='carry'; o._tx=c.tx; o._ty=c.ty;
              A.mantidas++;
              return;
            } else {
              /* MODO 'sobrepor': deixa a cadeia inteira de _decide rodar, com
                 todos os efeitos colaterais, e SO DEPOIS restaura o alvo da
                 conducao. Mais caro e nao pula contabilidade de ninguem. */
              var rr=oldDecide.apply(this,arguments);
              try{
                if(this.ball && this.ball.owner===o && o._act!=='shoot' && o._act!=='pass'){
                  o._act='carry'; o._tx=c.tx; o._ty=c.ty; A.mantidas++;
                } else { o.__r1848Carry=null; A.quebraOutraAcao++; }
              }catch(_){}
              return rr;
            }
          }
        }
      }
    }catch(_){}
    var r=oldDecide.apply(this,arguments);
    try{
      /* Se a decisao escolheu conduzir, abre a janela sobre o alvo que o
         proprio _carry acabou de calcular. */
      if(o && o._act==='carry' && typeof o._tx==='number' && typeof o._ty==='number'){
        o.__r1848Carry={tx:o._tx, ty:o._ty, until:fin(this.t,0)+JANELA};
        A.abertas++;
      }
    }catch(_){}
    return r;
  };

  P.getCarryCommitmentAudit=function(){
    return {version:VERSION, janela:JANELA, pressao:PRESSAO, dtgMin:DTG_MIN,
      abertas:A.abertas, mantidas:A.mantidas,
      quadrosMantidosPorJanela: A.abertas? A.mantidas/A.abertas : 0,
      quebraPressao:A.quebraPressao, quebraFaixaChute:A.quebraFaixaChute,
      quebraChegou:A.quebraChegou, quebraExpirou:A.quebraExpirou,
      quebraOutraAcao:A.quebraOutraAcao, modo:MODO};
  };
  try{
    root.CDS_R1848_CONDUCAO=Object.freeze({version:VERSION,
      label:'JANELA DE COMPROMISSO DA CONDUCAO',
      janela:JANELA, pressao:PRESSAO, dtgMin:DTG_MIN, modo:MODO,
      note:'_carry fixa alvo a reach=8+min(6,espaco)*0,6 metros (8 a 11,6 m) e o corpo percorre 2,301 m medidos, porque CAL.timing.decisionInterval e 0,28 s e a conducao e substituida antes de chegar. INT-01 medido 1,182% bate exatamente com o 1,18% da matriz. A coluna Dependencia de OS-08 na matriz diz Janela de compromisso; este e ele. Quebra por pressao, por entrada em faixa de chute, por alvo alcancado e por expiracao. Nao mexe em cone===0 nem no decisionInterval global.',
      coneTocado:false, decisionIntervalTocado:false, rngUsed:false, teleport:false});
    root.CDS_BUILD_ID='R18.48'; root.CDS_VERSION=VERSION;
    if(root.document) root.document.title='Copa dos Sonhos — R18.48';
  }catch(_){}
})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;

src = src.replace('</body></html>', CAMADA);
const dest = a('out', 'r1848.html');
fs.writeFileSync(dest, src, 'utf8');
console.log(path.basename(dest), '| modo', MODO, '| janela', JANELA, 's | pressao', PRESSAO, 'm | dtgMin', DTG_MIN, '|',
  crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').slice(0, 12));
