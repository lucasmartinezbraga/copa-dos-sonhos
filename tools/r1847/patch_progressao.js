#!/usr/bin/env node
'use strict';
/* ============================================================================
 * R18.47 · PROGRESSAO CENTRAL — o cruzamento volta a exigir posicao de cruzamento
 * ----------------------------------------------------------------------------
 * O DIAGNOSTICO, medido em tools/r1847/diag_progressao.js (R18.44, n=48, s1).
 * A R18.46 mostrou que o volume de finalizacao e limitado por OPORTUNIDADE
 * (8,42 avaliacoes de chute por partida contra 14,75 cruzamentos), e nao por
 * limiar de decisao. Faltava saber POR QUE a oportunidade nao aparece. Duas
 * hipoteses concorrentes:
 *   (a) o ataque e ROTEADO para o lado e nunca chega ao centro;
 *   (b) o ataque chega, mas o cruzamento tem saida barata e aborta a jogada.
 *
 * A MEDICAO FALSIFICOU (a):
 *     posse do portador no terco final:  87,8% CENTRAL, 12,2% lateral
 *     adv medio do chute:                89,24
 *     chutes vindos do corredor lateral: 2,87%
 * Quando o portador chega ao terco final, ele chega pelo CENTRO e chuta. O
 * ataque nao e roteado para o lado.
 *
 * E APONTOU (b), com um numero que nao fecha por si:
 *     adv medio do CRUZAMENTO: 76,46
 * O cruzamento sai de 76,46 — ANTES da linha de 78 que `_canCross` exige. Isso
 * so pode acontecer se a condicao tiver sido afrouxada em algum lugar, e foi:
 *
 *     // bloco cds-r122, ~linha 16242
 *     const oldCanCross=P._canCross;
 *     P._canCross=function(o){
 *       const adv=..., wide=o.y<27||o.y>FW-27;
 *       return oldCanCross.apply(this,arguments) || (adv>57 && wide);
 *     };
 *
 * O base pedia `adv>78 && (y<20||y>FW-20)`. O override adiciona `adv>57` com
 * faixa de 27 m. Com FW=68, "central" passa a ser apenas y de 27 a 41: o
 * cruzamento fica disponivel a partir de 48 m do gol, em 79% da largura do
 * campo. Um cruzamento de 48 m do gol nao e cruzamento, e bola longa — e ele
 * encerra a posse antes que ela chegue ao centro do terco final, que e
 * exatamente de onde os chutes saem (adv 89,24).
 *
 * Existe ainda um SEGUNDO sitio de cruzamento no override de `_decide` do mesmo
 * bloco (p entre .17 e .40, com espera de 1,65 s), tambem condicionado a
 * `_canCross`. Consertar `_canCross` fecha os dois de uma vez, o que e a razao
 * de patchar aqui e nao em cada sitio.
 *
 * O CONSERTO. A condicao ADICIONADA pelo override volta a descrever posicao de
 * cruzamento de verdade: `adv > ADV` e faixa lateral de `LARG` metros. O termo
 * do bundle base (`adv>78 && faixa 20`) e preservado intacto, entao a intencao
 * original do override — dar opcao contextual de cruzamento um pouco antes da
 * linha de fundo — continua existindo, apenas numa distancia em que cruzar e
 * uma decisao de futebol.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR, para poder ser derrubada. Menos
 * cruzamentos de longe => mais posses que sobrevivem ate o terco final central
 * => mais avaliacoes de chute. Espero `situacoes_de_chute` subir de 8,42 e
 * `low_cross_shot` cair de 6,75. O efeito no TOTAL de finalizacoes e incerto:
 * o rasteiro de 25 m era uma finalizacao contada, e trocar 2 finalizacoes falsas
 * por 1 verdadeira pode BAIXAR ECO-03. Se isso acontecer, o achado e que o
 * volume de chutes do jogo era em boa parte contabilidade, e o alvo de 17-27 da
 * faixa nova exige progressao de verdade, nao so realocacao.
 *
 * USO
 *   node tools/r1847/patch_progressao.js --in=ENTRADA.html --out=SAIDA.html
 *        [--adv=74] [--larg=21]
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const ADV = a('adv', '74');
const LARG = a('larg', '21');

let src = fs.readFileSync(a('in', 'entrada.html'), 'utf8');

const DE = `const oldCanCross=P._canCross;P._canCross=function(o){if(!o||!this.teams)return oldCanCross.apply(this,arguments);const tm=this.teams[o.team],adv=tm.attackDir>0?o.x:FL-o.x,wide=o.y<27||o.y>FW-27;return oldCanCross.apply(this,arguments)||(adv>57&&wide);};`;
const n = src.split(DE).length - 1;
if (n !== 1) { console.error('ABORTA: ancora do _canCross encontrada ' + n + 'x, esperado 1'); process.exit(1); }

const PARA = `const oldCanCross=P._canCross;P._canCross=function(o){if(!o||!this.teams)return oldCanCross.apply(this,arguments);const tm=this.teams[o.team],adv=tm.attackDir>0?o.x:FL-o.x,wide=o.y<${LARG}||o.y>FW-${LARG};return oldCanCross.apply(this,arguments)||(adv>${ADV}&&wide);};`;
src = src.split(DE).join(PARA);

const META = `<script id="cds-r1847-central-progression">
/* R18.47 · Progressao central: o cruzamento volta a exigir posicao de cruzamento. */
(function(root){try{
  root.CDS_R1847_PROGRESSAO=Object.freeze({version:'5.34.0-R18.47',
    label:'PROGRESSAO CENTRAL',
    advMin:${ADV}, faixaLateral:${LARG},
    antes:'adv>57 e faixa 27 m (79% da largura, desde 48 m do gol)',
    note:'O override de _canCross do bloco cds-r122 adicionava (adv>57 && y<27||y>FW-27) ao termo do bundle base (adv>78 && faixa 20). Com FW=68 isso deixava apenas y 27..41 como central e liberava cruzamento a partir de 48 m do gol. Medido: adv medio do cruzamento 76,46, contra adv medio do chute 89,24, com 87,8% da posse no terco final sendo CENTRAL e apenas 2,87% dos chutes vindos do corredor lateral — ou seja o ataque nao era roteado para o lado, era abortado por cruzamento antes de chegar. O termo do bundle base fica intacto.',
    rngUsed:false, teleport:false, sitiosAfetados:'dispatch base (crossP .69-.92) e override de _decide (p .17-.40), ambos condicionados a _canCross'});
  root.CDS_BUILD_ID='R18.47'; root.CDS_VERSION='5.34.0-R18.47';
  if(root.document) root.document.title='Copa dos Sonhos — R18.47';
}catch(_){}})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;
if (src.split('</body></html>').length - 1 !== 1) { console.error('ABORTA: ancora </body></html> nao unica'); process.exit(1); }
src = src.replace('</body></html>', META);

const dest = a('out', 'r1847.html');
fs.writeFileSync(dest, src, 'utf8');
console.log(path.basename(dest), '| adv >', ADV, '| faixa lateral', LARG, 'm |',
  crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').slice(0, 12));
