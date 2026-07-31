#!/usr/bin/env node
'use strict';
/*
 * OS-38 · O BLOQUEIO PASSA A DEPENDER DO DEFENSOR, NAO DE UMA MOEDA
 * -----------------------------------------------------------------
 * Esta e a terceira tentativa contra a OS-05 (escanteios). As duas anteriores
 * foram REPROVADAS por medicao e estao registradas: supressao geometrica
 * (OS-05B) e orcamento de raio (OS-23). O censo do funil desta rodada
 * (`diag_os38_corner_funnel.js`, 12 partidas na R18.65) mostra onde o buraco
 * esta de fato:
 *
 *   escanteios 4,50/partida
 *     causa clearance  2,667      causa save  1,000
 *     causa block      0,333      duelo area  0,167
 *
 * No futebol real o chute bloqueado e a MAIOR fonte de escanteio. Aqui ele
 * responde por 7% deles, e o evento `blocked` sai em 0,33 por partida contra
 * 17,7 chutes — 1,9%. A referencia real fica perto de 25%.
 *
 * MECANISMO (:6194). O desfecho do chute sai de uma unica rolagem `r2`
 * particionada em fatias:
 *
 *     saveCut  = savedShare + ...
 *     blockCut = saveCut + CAL.shooting.blockedShare   // :2766, 0.18
 *     postCut  = blockCut + postShare
 *
 * Ou seja: 18% dos chutes sao NOMEADOS bloqueio por sorteio. So depois disso o
 * codigo procura um defensor na linha; se nao houver nenhum a 2,2 m, o lance
 * vira `miss` com `reason:'no_physical_block'`.
 *
 * E medi a geometria (`10 partidas, 177 chutes`):
 *
 *     defensor mais proximo A LINHA do chute
 *       <1 m  14,7%   1-2 m  8,5%   2-3 m  4,0%   3-4 m  4,5%
 *       sem defensor no segmento              28,8%
 *       <= 2,2 m (a porta do bloqueio)        23,2%
 *
 * O defensor esta na linha em quase um quarto dos chutes. A moeda de 18%
 * descarta 82% desses casos ANTES de olhar para o campo. A ordem esta
 * invertida: quem decide se um chute e bloqueado e o defensor estar no
 * caminho; o acaso pertence a se ele alcanca a bola, nao a se ele existe.
 *
 * EDIT · antes da particao, procura o defensor mais proximo da linha do chute
 * (mesmo `_projT`, mesma janela t de 0,12 a 0,88 do codigo original) e sorteia
 * o bloqueio pela DISTANCIA dele a linha:
 *
 *     pBlock = clamp(0.90 - ld*0.28, 0.08, 0.90)
 *       ld = 0,0 m -> 0,90     ld = 1,0 m -> 0,62
 *       ld = 2,0 m -> 0,34     ld = 2,8 m -> 0,12
 *
 * Sem defensor no segmento, nada muda — o chute segue para a particao de
 * sempre. A execucao do bloqueio e a MESMA ja existente: divisao com falta
 * (OS-14 via `_foulProb`), `_startTravel` ate o ponto de contato,
 * `_physicalContactValid`, e desfecho por `CAL.restarts.shotBlockCorner`. O
 * escanteio nasce de bloqueio fisico provado, entao passa pelas camadas
 * R18.18.2/18.3 em vez de cair em `unprovenCornerCalls`.
 *
 * A particao NAO e mexida: quem sobrevive ao bloqueio geometrico continua
 * sorteando save/block/post/gol exatamente como hoje. Isso significa que a
 * populacao que chega la encolhe — e por isso os gols DEVEM cair.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - evento `blocked`: SOBE de 0,33 para a casa de 2 a 3 por partida.
 *   - escanteios: SOBEM. E a unica previsao que decide esta rodada.
 *   - gols: DESCEM (menos chutes chegam a particao). 3,2 e alto para futebol.
 *   - xG: DESCE ou fica igual; ECO-02 (<= 2,7) nao pode ser estourado.
 *   - `blocked` nao pode virar a maioria dos chutes: se passar de ~30% o
 *      alcance esta largo demais e o patch e recusado.
 *
 * ARMADILHA: `_shoot` e envolvido por camadas posteriores. Este edit e no
 * NUCLEO, entao roda para todo chute que chega a particao — inclusive os
 * vindos de cabeceio e de bola parada. Se o bloqueio comecar a aparecer em
 * cobranca de falta direta (que tem barreira propria desde a OS-36), houve
 * contaminacao e o patch precisa de guarda.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.65 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.66 - JOGO DE FUTEBOL.html');
const alcance = arg('alcance', '2.8');
const base = arg('base', '0.90');
const queda = arg('queda', '0.28');
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

edit(
  'os38-geometric-block-first',
  `      const saveCut=saveReachable?clamp(CAL.shooting.savedShare+gkQual*CAL.shooting.keeperSaveInfluence+(oneOnOne?.04:0)+finishPlan.saveBias,.04,.72):0;`,
  `      /* OS-38 · o bloqueio decide ANTES da particao, e quem decide e o
         defensor estar na linha do chute. Medido: ha defensor a 2,2 m da linha
         em 23,2% dos chutes, e a moeda de blockedShare (0.18) descartava 82%
         desses casos sem olhar para o campo — o evento blocked saia em 1,9% dos
         chutes contra ~25% no futebol real. Sem defensor no segmento, nada
         muda. */
      {
        const _o38Def=this.teams[1-o.team].players.filter(p=>!p.red&&!p.isGK);
        let _o38B=null,_o38L=99,_o38T=null;
        for(const d of _o38Def){
          const t=clamp(this._projT(o.x,o.y,g.x,g.y,d.x,d.y),0,1);
          if(t<.12||t>.88)continue;
          const px=lerp(o.x,g.x,t),py=lerp(o.y,g.y,t),ld=D(d.x,d.y,px,py);
          if(ld<_o38L){_o38L=ld;_o38B=d;_o38T={x:px,y:py};}
        }
        if(_o38B&&_o38L<=${alcance}&&chance(clamp(${base}-_o38L*${queda},.08,${base}))){
          /* mesma divisao com falta da OS-14: defensor em cima do finalizador
             nem sempre e bloqueio limpo. */
          if(chance(this._foulProb(_o38B))){this._awardFoul(_o38B,o);return;}
          this._startTravel(o,_o38T,'shot',()=>{
            const _cv=this._physicalContactValid(_o38B,2.05,this.ball.z);
            if(!_cv.ok){
              if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
              this._emit('visual_contact_failed',{kind:'block',by:_o38B,distance:_cv.horizontal});
              this._continueTravel({x:g.x+tm.attackDir*3,y:g.y+(chance(.5)?1:-1)*R(3.8,7.0)},'shot',()=>{
                this._emit('miss',{by:o,reason:'blocker_did_not_reach'});
                this._goalKickOrRestart(1-o.team);
              },{outcome:'miss'},Math.max(24,this.ball.speed*.72));
              return;
            }
            this._recordVisualContact('block',_o38B,this.ball.x,this.ball.y,{distance:_cv.horizontal,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface});
            this._emit('blocked',{by:_o38B,contact:{x:this.ball.x,y:this.ball.y,distance:_cv.horizontal}});
            if(chance(CAL.restarts.shotBlockCorner))this._setCorner(o.team);
            else this._looseBall(this.ball.x,this.ball.y);
          },null,'shot',{outcome:'block',actor:_o38B,contactRadius:2.05});
          o._throughReceiverUntil=0;
          return;
        }
      }
      const saveCut=saveReachable?clamp(CAL.shooting.savedShare+gkQual*CAL.shooting.keeperSaveInfluence+(oneOnOne?.04:0)+finishPlan.saveBias,.04,.72):0;`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| alcance=' + alcance, 'base=' + base, 'queda=' + queda);
console.log(path.basename(output), '| sha256', sha);
