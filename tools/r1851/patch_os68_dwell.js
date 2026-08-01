#!/usr/bin/env node
'use strict';
/*
 * OS-68 · O TEMPO DE BOLA NO PE
 * ------------------------------
 * Observacao de campo: "a bola tambem tinha ficado esquisita... a cadencia".
 *
 * CENSO OS-66 (3 partidas): a bola fica 57,1% do tempo NO AR e 28,0% no pe de
 * alguem — o futebol e o inverso (~28% no ar, ~60% no pe). O dominio individual
 * medio e 0,45 s (mediana 0,37, p90 0,62) contra 1,1 a 1,4 s reais.
 *
 * A OS-67 tentou o caminho errado e FOI FALSIFICADA, duas vezes:
 *
 *   1. Acoplar `decisionInterval` e `clockRate` (um vezes k, o outro dividido
 *      por k) para manter o volume: com k=1,6 os passes foram de 451 para 758 e
 *      os gols de 1,81 para 4,38. O produto NAO e constante.
 *   2. Mexer so em `decisionInterval`, de 0,28 para 0,90 e 1,60 — 5,7 vezes:
 *      o dominio ficou EXATAMENTE onde estava, 0,45 s, mediana 0,37, p90 0,62
 *      nos tres pontos.
 *
 * O (2) explica o (1). `decisionInterval` e DECORATIVO: quatro sitios
 * posteriores rebaixam `decideT` logo depois de ele ser escrito.
 *
 *     :6726   this.decideT = Math.min(this.decideT, .10);        <- na recepcao
 *     :5076   if (_pn < 2.4) ... Math.min(this.decideT, 0.20);   <- sob pressao
 *     :17289  transition_attack -> 0.20
 *     :17290  final_third       -> 0.31
 *     :17291  build_up          -> 0.44
 *
 * O de :6726 e o que manda: quem RECEBE a bola decide 0,10 s depois, qualquer
 * que seja o intervalo nominal. E o mesmo padrao estrutural que esta rodada ja
 * encontrou tres vezes — um valor existe na calibracao e esta morto porque uma
 * camada posterior o sobrescreve sem encadear.
 *
 * Medido: 93,0% das trocas de dono coincidem com `action_contact`, e `_decide`
 * roda 0,76 vezes por segundo — ~1,2 chamada por posse. O portador decide UMA
 * vez e a bola sai.
 *
 * EDIT · os cinco tetos sobem pelo fator ${'${M}'}, e o `clockRate` desce pelo
 * mesmo fator.
 *
 * Por que o `clockRate` desta vez compensa e na OS-67 nao compensou: ali eu
 * esticava o tempo sem esticar o CICLO DE POSSE, entao cabiam mais ciclos e
 * tudo multiplicava. Aqui o ciclo estica junto — o dominio e a metade dele que
 * estava curta — entao o numero de posses por partida fica onde esta e os
 * totais devem acompanhar.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.82):
 *   - dominio medio 0,45 s: SOBE.
 *   - bola em voo 57,1%: DESCE.  bola no pe 28,0%: SOBE.
 *   - posses por partida (529): aproximadamente CONSTANTE — e o teste de que a
 *     compensacao esta certa desta vez.
 *   - passes (451), chutes (21,8), gols (1,81), escanteios (5,88), faltas
 *     (13,1): aproximadamente CONSTANTES.
 *   - tempo real de partida: SOBE por ${'${M}'}.
 *   - RECUSA se as posses por partida andarem muito, se os escanteios sairem
 *     de 4 a 10, se o xG passar de 2,7 ou se a marcacao degradar.
 *
 * ARMADILHA: o teto de :5076 existe para o jogador PRESSIONADO nao ficar
 * enrolando e perder a bola. Multiplica-lo tambem, e nao deixa-lo fixo, e
 * deliberado: sob pressao ele continua decidindo mais rapido que os outros, so
 * que na nova escala. Se as perdas de bola dispararem, foi por aqui.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input  = arg('in',  'dist/COPA DOS SONHOS - R18.82 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.83 - JOGO DE FUTEBOL.html');
const M = Number(arg('m', '2'));
if (!(M >= 1 && M <= 5)) { console.error('ABORTA: m fora de faixa'); process.exit(1); }
const CLOCK = Number((0.13 / M).toFixed(5));
const s2 = x => Number((x * M).toFixed(3));

let src = fs.readFileSync(input, 'utf8');
const applied = [];
function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) { console.error('ABORTA [' + id + ']: ancora ' + count + 'x'); process.exit(1); }
  src = src.replace(from, to);
  applied.push(id);
}

/* 1 ── o teto da recepcao, que e o que manda -------------------------------- */
edit('os68-reception',
`    this.decideT=Math.min(this.decideT,.10);`,
`    /* OS-68 · era .10: quem recebia a bola decidia 0,10 s depois de domina-la,
       o que fazia \`decisionInterval\` nao valer nada e punha o dominio medio em
       0,45 s contra 1,1 a 1,4 s do futebol. */
    this.decideT=Math.min(this.decideT,${s2(0.10)});`);

/* 2 ── o teto sob pressao ---------------------------------------------------- */
edit('os68-pressure',
`    if (_pn < 2.4) this.decideT = Math.min(this.decideT, 0.20);`,
`    if (_pn < 2.4) this.decideT = Math.min(this.decideT, ${s2(0.20)});  /* OS-68 · era 0.20 */`);

/* 3 ── os tetos por fase da R13 --------------------------------------------- */
edit('os68-phases',
`    if(attacking==='transition_attack')sim.decideT=Math.min(finite13(sim.decideT,.2),.20);
    else if(attacking==='final_third')sim.decideT=Math.min(finite13(sim.decideT,.3),.31);
    else if(attacking==='build_up')sim.decideT=Math.min(finite13(sim.decideT,.25),.44);`,
`    /* OS-68 · mesma escala dos outros tetos. */
    if(attacking==='transition_attack')sim.decideT=Math.min(finite13(sim.decideT,${s2(0.2)}),${s2(0.20)});
    else if(attacking==='final_third')sim.decideT=Math.min(finite13(sim.decideT,${s2(0.3)}),${s2(0.31)});
    else if(attacking==='build_up')sim.decideT=Math.min(finite13(sim.decideT,${s2(0.25)}),${s2(0.44)});`);

/* 4 ── o relogio acompanha, para o volume por partida nao andar -------------- */
edit('os68-clock',
`    clockRate: 0.13,`,
`    /* OS-68 · o ciclo de posse esticou por ${M}; o tempo de acao estica junto
       para o numero de posses por partida — e com ele os totais — ficar onde
       esta. Na OS-67 eu estiquei o tempo SEM esticar o ciclo e tudo multiplicou. */
    clockRate: ${CLOCK},`);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| m=' + M, 'clockRate=' + CLOCK,
            'recepcao=' + s2(0.10), 'pressao=' + s2(0.20));
console.log(path.basename(output), '| sha256', sha);
