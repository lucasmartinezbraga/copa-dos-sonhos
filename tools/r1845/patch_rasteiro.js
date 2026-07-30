#!/usr/bin/env node
'use strict';
/* ============================================================================
 * R18.45 · O CRUZAMENTO RASTEIRO PASSA A TER POSICAO
 * ----------------------------------------------------------------------------
 * O DEFEITO, medido em tools/r1843/diag_xg.js (R18.44, n=48 x 3 bases):
 * `low_cross_shot` e 44,2% de TODAS as finalizacoes do jogo e nao tem termo
 * posicional nenhum:
 *
 *     const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);
 *
 * O sitio tem `atk.x`/`atk.y` e a bola em escopo e nao usa nenhum dos dois.
 * Medido no instante do evento, pela posicao da BOLA: distancia media ao gol de
 * 25,0 m, com 46% dos casos em 22-30 m e 24% alem de 30 m, todos recebendo pGoal
 * achatado de 0,19-0,22. A tabela CAL vale 0,032 em 22-30 m e 0,015 alem de 30 m.
 * O caminho cobra ~6x o valor posicional.
 *
 * POR QUE TROCAR SO A BASE `.16` NAO RESOLVE, e este e o ponto tecnico da
 * rodada. Os termos de pericia e execucao sao ADITIVOS e valem ate +0,32:
 *     (finish-keeper)/100*.23  ->  ate ~0,08 na faixa tipica
 *     ctx.execution*.09        ->  ate ~0,09
 * A 25 m, trocar .16 por distanceXg(25)*ang*2 = 0,051 daria
 * (0,051+0,08+0,07)*0,82 = 0,165 — praticamente o 0,198 de hoje. A posicao
 * continuaria sendo detalhe e a soma continuaria mandando.
 *
 * O CONSERTO E DE FORMA, NAO DE CONSTANTE. Pericia e execucao passam a MODULAR
 * a base posicional em vez de somar a ela — que e exatamente a forma que o
 * caminho de jogo aberto (`_shoot`) ja usa:
 *     pGoal = base*conversionScale*angMul*(1+skill*skillInfluence)*execution*tipo
 * Assim a posicao volta a ser soberana e o talento aproveita melhor a posicao,
 * em vez de substituir estar bem colocado. E o mesmo principio que o comentario
 * de CAL.shooting ja declara para a finalizacao normal.
 *
 * O BONUS SITUACIONAL E LEGITIMO E FICA. Bola rasteira cruzada encontra defesa e
 * goleiro deslocados, entao vale mais que um chute qualquer da mesma distancia.
 * Mas nao 6x mais. `--bonus` e esse fator, exposto para varredura. Referencia de
 * futebol real: chute de corte rasteiro a 10 m ~0,25-0,35; a 25 m ~0,03-0,05.
 *
 * AVISO REGISTRADO ANTES DE MEDIR. Este patch deve BAIXAR o xG agregado de forma
 * grande (previsao do relatorio da R18.44: -0,65; a conta refeita com a forma
 * multiplicativa da mais perto de -0,9). Se cair muito, ECO-02 (piso 1,8) e
 * ECO-01 (piso 2,4) REPROVAM — e nesse caso o achado da rodada e que os pisos
 * atuais so eram cumpridos porque 44% dos chutes estavam com preco inflado.
 * Isso NAO e motivo para desistir do conserto nem para mexer no piso sem
 * medicao: e motivo para relatar.
 *
 * `_cross` e sobrescrito em cds-r122 (linha ~16263), mas o override so registra
 * a janela de cruzamento e delega com `oldCross.apply`, entao o sitio base esta
 * vivo. Verificado antes de editar, conforme o §6 do handoff R18.40B.
 *
 * USO
 *   node tools/r1845/patch_rasteiro.js --in=ENTRADA.html --out=SAIDA.html \
 *        [--bonus=1.35] [--skill=0.55] [--execMin=0.75] [--execAmp=0.35] \
 *        [--min=0.012] [--max=0.55]
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const BONUS = a('bonus', '1.35');
const SKILL = a('skill', '0.55');
const EXEC_MIN = a('execMin', '0.75');
const EXEC_AMP = a('execAmp', '0.35');
const MIN = a('min', '0.012');
const MAX = a('max', '0.55');

let src = fs.readFileSync(a('in', 'entrada.html'), 'utf8');

const DE = `const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);`;
const n = src.split(DE).length - 1;
if (n !== 1) { console.error('ABORTA: ancora do rasteiro encontrada ' + n + 'x, esperado 1'); process.exit(1); }

/* A base posicional usa a BOLA, que e onde o chute acontece, e o mesmo fator de
   angulo do caminho de jogo aberto (1-|dy|/42, piso .32). `g` e `distanceXg` ja
   estao em escopo neste ponto de `_cross`. */
const PARA = `const _lcD=D(this.ball.x,this.ball.y,g.x,g.y);`
  + `const _lcA=clamp(1-Math.abs(this.ball.y-g.y)/42,.32,1);`
  + `const _lcPos=distanceXg(_lcD)*_lcA;`
  /* Pericia e execucao MODULAM a base em vez de somar a ela — mesma forma de _shoot. */
  + `const pGoal=clamp(_lcPos*${BONUS}*(1+(finish-keeper)/100*${SKILL})*(${EXEC_MIN}+ctx.execution*${EXEC_AMP}),${MIN},${MAX});`
  /* Guardado para o instrumento poder ler distancia e base sem recalcular. */
  + `this.__r1845Last={d:_lcD,pos:_lcPos,pGoal};`;

src = src.split(DE).join(PARA);

/* O evento passa a publicar distancia e base posicional, para diag_xg medir o
   rasteiro com a mesma riqueza do jogo aberto em vez de inferir. */
const DE2 = `this._emit('low_cross_shot',{by:atk,from:o,xg:pGoal});`;
if (src.split(DE2).length - 1 === 1) {
  src = src.split(DE2).join(
    `this._emit('low_cross_shot',{by:atk,from:o,xg:pGoal,pGoal,dtg:_lcD,baseXg:_lcPos});`);
} else {
  console.error('AVISO: ancora do emit do rasteiro nao encontrada 1x; evento segue sem dtg');
}

const META = `<script id="cds-r1845-cross-position">
/* R18.45 · O cruzamento rasteiro passa a ter posicao. Registro de metadados. */
(function(root){try{
  root.CDS_R1845_RASTEIRO=Object.freeze({version:'5.32.0-R18.45',
    label:'CRUZAMENTO RASTEIRO COM TERMO POSICIONAL',
    bonus:${BONUS}, skill:${SKILL}, execMin:${EXEC_MIN}, execAmp:${EXEC_AMP}, min:${MIN}, max:${MAX},
    note:'low_cross_shot era 44,2% das finalizacoes com pGoal achatado .06-.40 e base fixa .16, sem termo posicional, a 25,0 m de distancia media medida pela bola (46% em 22-30 m, 24% alem de 30 m) — cerca de 6x o valor da tabela CAL naquelas bandas. Pericia e execucao eram ADITIVAS (ate +0,32), entao trocar so a base nao resolveria: passaram a MODULAR a base posicional, mesma forma de _shoot.',
    rngUsed:false, teleport:false});
  root.CDS_BUILD_ID='R18.45'; root.CDS_VERSION='5.32.0-R18.45';
  if(root.document) root.document.title='Copa dos Sonhos — R18.45';
}catch(_){}})(typeof window!=='undefined'?window:globalThis);
</script>
</body></html>`;
if (src.split('</body></html>').length - 1 !== 1) { console.error('ABORTA: ancora </body></html> nao unica'); process.exit(1); }
src = src.replace('</body></html>', META);

const dest = a('out', 'r1845.html');
fs.writeFileSync(dest, src, 'utf8');
console.log(path.basename(dest), '| bonus', BONUS, '| skill', SKILL, '| exec', EXEC_MIN + '+' + EXEC_AMP,
  '| clamp', MIN + '..' + MAX, '|', crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').slice(0, 12));
