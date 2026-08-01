#!/usr/bin/env node
'use strict';
/*
 * OS-72 · A CADENCIA DE TOQUE SO MANDA QUANDO HA PRESSAO
 * -------------------------------------------------------
 * Fim da caca. Cinco hipoteses caidas antes desta, e as duas ultimas cairam
 * porque eu estava lendo a arquitetura de decisao errado. O que resolveu foi
 * parar de deduzir e instrumentar: um gancho em `_pass`, `_carry`, `_dribble`,
 * `_shoot` e `_cross` capturando a PILHA de quem chama.
 *
 *     40,5%  _pass    <- P.step (r14-engine:169)      execucao diferida da R14
 *     11,9%  _pass    <- P._decide (r13-observer-cadence:710)
 *     11,0%  _pass    <- P._decide (r13-observer-cadence:691)
 *      4,2%  _pass    <- P._decide (r13-observer-cadence:714)
 *      3,7%  _pass    <- P._decide (r13-observer-cadence:703)
 *      4,9%  _dribble <- MatchSim._decide (nucleo)
 *      4,2%  _carry   <- MatchSim._decide (nucleo)
 *
 * A maioria das DECISOES de passe sai da camada `cds-r13-football-observer-
 * cadence`, nao do nucleo. O nucleo responde por ~10%. Foi por isso que a
 * OS-69 (portao de conducao, :5209) e a OS-71 (limiar de progressao, :5189)
 * deram resultado IDENTICO byte a byte a base: aquelas linhas quase nunca sao
 * alcancadas.
 *
 * CORRECAO DE DUAS AFIRMACOES MINHAS:
 *   - OS-69: eu disse que o `_decide` do nucleo estava morto e que a P47 nao
 *     encadeava. **Errado.** A P47 escolhe um candidato, ajusta `tm.fx` em ~6%
 *     e termina em `return od.call(this,p)` — e camada de VIES. O nucleo esta
 *     vivo, so que a montante dele existe a R13.
 *   - OS-71: eu disse que :5189 era "a linha que domina". Nao e; ela e
 *     alcancada em ~1% das acoes.
 *
 * O QUE A R13 FAZ. Quatro saidas de passe, uma por fase:
 *
 *     transition_attack   passa se houver saida e a corrente < 1 ou 2
 *     build_up            passa se houver opcao e a corrente < 5
 *     progression         passa se o candidato for "limpo"
 *     progression         passa na saida curta, corrente < 2
 *
 * **Nenhuma delas olha o espaco do portador.** Ela passa porque existe passe
 * disponivel — com um marcador em cima ou com quinze metros de campo livre pela
 * frente, o mesmo. A camada foi escrita para impor correntes de passe ("a
 * corrente de cinco passes curtos da posse apoiada"), e ela impoe.
 *
 * Resultado medido (OS-66/OS-70), 504 passes por partida de 17,6 m em ~750 s de
 * bola rolando — 0,67 passes por segundo contra ~0,27 do futebol:
 *
 *     bola em voo   57,1%      real ~28%
 *     bola no pe    28,0%      real ~60%
 *     dominio       0,45 s     real 1,1 a 1,4 s
 *
 * Nao e a bola que voa rapido demais: 17,6 m em 0,90 s da 19,6 m/s, que e um
 * passe firme normal. E que ela e tocada cedo demais.
 *
 * EDIT · uma linha, no topo do despacho por fase: se o adversario mais proximo
 * esta a mais de ${'${ESPACO}'} m, a R13 CEDE e devolve a decisao para a cadeia
 * abaixo — que ja tem portao de conducao, de drible e de passe, todos ja
 * ponderados por atributo.
 *
 * Com marcacao em cima nada muda: sob pressao a corrente de toque continua
 * mandando, que e o certo. O que deixa de acontecer e largar a bola com o campo
 * aberto na frente.
 *
 * Nao inventa acao, nao mexe em fisica, em posicao nem em RNG.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.82+OS-70: dominio 0,45 s /
 * mediana 0,37 · voo 55,0% · pe 26,0% · passes 464,9 · carry 40,9 · gols 2,13 ·
 * xg 2,46 · escanteios 6,50 · threatCoverage 0,637):
 *   - dominio medio e mediana: SOBEM. **Este e o teste que decide. Se nao
 *     subirem, a hipotese cai como as cinco anteriores e eu volto a
 *     instrumentar em vez de patchar.**
 *   - conducoes por partida: SOBE.
 *   - bola no pe: SOBE. bola em voo: DESCE.
 *   - passes por partida: DESCE. Esperado, nao e degradacao.
 *   - gols, chutes, escanteios: nao podem degradar. Escanteios 4 a 10,
 *     xG <= 2,7, `threatCoverage` nao pode cair de 0,637.
 *   - RECUSA se os gols dispararem, se os escanteios sairem da faixa ou se o
 *     xG passar de 2,7.
 *
 * ARMADILHA: ceder para a cadeia abaixo com espaco significa que o portador vai
 * conduzir ate a pressao chegar. Se o limiar for baixo demais, o jogo vira
 * conducao individual e a corrente de passe da construcao desaparece — o custo
 * apareceria como passes despencando e dribles disparando.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input   = arg('in',  'dist/COPA DOS SONHOS - R18.82 - JOGO DE FUTEBOL.html');
const output  = arg('out', 'dist/COPA DOS SONHOS - R18.83 - JOGO DE FUTEBOL.html');
const ESPACO  = arg('espaco', '7');

let src = fs.readFileSync(input, 'utf8');
const applied = [];
function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) { console.error('ABORTA [' + id + ']: ancora ' + count + 'x'); process.exit(1); }
  src = src.replace(from, to);
  applied.push(id);
}

edit('os72-cadence-needs-pressure',
`    const tm=this.teams[o.team],phase=state13(this).phaseByTeam[o.team];
    if(phase==='transition_attack'){`,
`    const tm=this.teams[o.team],phase=state13(this).phaseByTeam[o.team];
    /* OS-72 · esta camada tinha quatro saidas de passe e NENHUMA olhava o
       espaco do portador: ela passava porque existia passe, com um marcador em
       cima ou com quinze metros livres pela frente. Medido, ela responde pela
       maioria das decisoes de passe do jogo, e o resultado era a bola 57,1% do
       tempo no ar contra ~28% do futebol. Com espaco de verdade ela agora CEDE
       para a cadeia abaixo, que ja tem portao de conducao e de drible. Sob
       pressao nada muda. */
    {
      let _os72nd=1e9;
      const _os72op=this.teams[1-o.team].players;
      for(let _i=0;_i<_os72op.length;_i++){
        const _d=_os72op[_i];
        if(!_d||_d.red)continue;
        const _dd=Math.hypot(finite13(_d.x)-finite13(o.x),finite13(_d.y)-finite13(o.y));
        if(_dd<_os72nd)_os72nd=_dd;
      }
      if(_os72nd>${ESPACO})return oldDecide13.apply(this,arguments);
    }
    if(phase==='transition_attack'){`);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| espaco=' + ESPACO + ' m');
console.log(path.basename(output), '| sha256', sha);
