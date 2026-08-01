#!/usr/bin/env node
'use strict';
/*
 * OS-71 · NAO SE LARGA A BOLA POR TRES METROS
 * --------------------------------------------
 * Fim da caca do dominio da bola. Quatro hipoteses caidas antes desta, e a
 * ultima delas caiu porque eu li a arquitetura errado.
 *
 * CORRECAO DE UMA AFIRMACAO MINHA (OS-69): eu disse que o `_decide` do nucleo
 * (:5068) estava morto e que a camada P47 (:8211) nao encadeava. **Estava
 * errado.** A P47 escolhe um candidato, ajusta `tm.fx` em ~6% conforme a
 * escolha e termina em `return od.call(this,p)` — ela e camada de VIES, nao de
 * despacho. O nucleo esta vivo e e ele quem chama `_pass`, `_carry`, `_shoot`.
 *
 * O que estava errado no meu edit da OS-69 nao era a camada, era a LINHA. O
 * `_decide` do nucleo e uma cascata de saidas antecipadas:
 *
 *     :5140  if (shotDecision.approach)               { _carry; return; }
 *     :5183  if (best.progressM > progGate && ...)     { _pass;  return; }
 *     :5185  if (safe)                                 { _pass;  return; }
 *     :5189  if (best.progressM > 3 && best.score>.6)  { _pass;  return; }   <-- esta
 *     :5209  portao de conducao (o que eu tentei abrir na OS-69)
 *     :5215  _carry
 *
 * A linha :5189 dispara ANTES do portao de conducao. Ela solta a bola assim que
 * existir um passe que ganhe mais de **tres metros** com nota acima de 0,6. Tres
 * metros. Por isso abrir o portao de :5209 nao mudou um unico numero: ele quase
 * nunca e alcancado.
 *
 * E e isso que produz o quadro medido (OS-66/OS-70):
 *
 *     bola em voo   57,1%   (504 passes por partida, 17,6 m, 0,90 s cada)
 *     bola no pe    28,0%
 *     dominio       0,45 s (mediana 0,37)
 *
 * O jogo toca 504 passes em ~750 s de bola rolando — 0,67 por segundo, contra
 * ~0,27 do futebol. Nao e a bola que voa rapido demais (17,6 m em 0,90 s da
 * 19,6 m/s, que e um passe firme normal): e que ela e tocada cedo demais.
 *
 * EDIT · o limiar de progressao deixa de ser fixo em 3 m e passa a crescer com o
 * ESPACO que o portador tem:
 *
 *     limiar = 3 + clamp(nd - ${'${D0}'}, 0, ${'${TETO}'}) * ${'${GANHO}'}
 *
 * Com um adversario em cima (nd <= ${'${D0}'} m) o limiar continua sendo 3 e o
 * jogo nao muda: sob pressao voce toca. Com espaco, o passe precisa valer a
 * pena — senao o portador segue com a bola e cai no portao de conducao logo
 * abaixo, que ja existe e ja e ponderado por drible e aceleracao.
 *
 * Nao inventa acao nova, nao mexe em fisica, em posicao nem em RNG.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base: R18.82 + OS-70):
 *   - conducoes por partida (40,9): SOBE.
 *   - dominio medio (0,45 s) e mediana (0,37): SOBEM. **Este e o teste. Se nao
 *     subirem, a hipotese cai como as quatro anteriores.**
 *   - bola no pe (28,0%): SOBE. bola em voo (57,1%): DESCE.
 *   - passes por partida (464,9): DESCE. Esperado, nao e degradacao.
 *   - gols (2,13), chutes (22,0), escanteios (6,50): nao podem degradar.
 *     Escanteios entre 4 e 10, xG <= 2,7.
 *   - marcacao: `threatCoverage` nao pode cair de 0,637.
 *   - RECUSA se os gols dispararem, se os escanteios sairem da faixa, ou se o
 *     xG passar de 2,7.
 *
 * ARMADILHA: segurar a bola com espaco significa segura-la ate a pressao
 * chegar. Se o limiar subir demais, o portador vira alvo parado e perde a bola
 * em campo proprio — o custo apareceria como GOLS SOFRIDOS, e por isso os gols
 * sao gate aqui e nao informacao.
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
const D0    = arg('d0',    '4');
const TETO  = arg('teto',  '8');
const GANHO = arg('ganho', '1.5');

let src = fs.readFileSync(input, 'utf8');
const applied = [];
function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) { console.error('ABORTA [' + id + ']: ancora ' + count + 'x'); process.exit(1); }
  src = src.replace(from, to);
  applied.push(id);
}

edit('os71-progression-gate',
`    if (best && best.progressM > 3 && best.score > 0.6) { this._pass(o, best); return; }`,
`    /* OS-71 · o limiar era 3 m FIXO: o portador soltava a bola assim que
       existisse um passe que ganhasse tres metros, e por isso o portao de
       conducao logo abaixo (:5209) quase nunca era alcancado — a bola ficava
       57,1% do tempo no ar contra ~28% do futebol. Agora o limiar cresce com o
       espaco: sob pressao continua 3 m e nada muda; com campo pela frente o
       passe precisa valer a pena. */
    const _os71Gate = 3 + clamp((nd || 0) - ${D0}, 0, ${TETO}) * ${GANHO};
    if (best && best.progressM > _os71Gate && best.score > 0.6) { this._pass(o, best); return; }`);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '),
            '| limiar 3 m -> 3 + clamp(nd-' + D0 + ',0,' + TETO + ')*' + GANHO);
console.log(path.basename(output), '| sha256', sha);
