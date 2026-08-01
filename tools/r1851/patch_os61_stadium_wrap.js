#!/usr/bin/env node
'use strict';
/*
 * OS-61 · O ESTADIO FECHA NOS QUATRO LADOS
 * -----------------------------------------
 * Consequencia direta da OS-57, e por isso ela e minha para consertar: ao ligar
 * a camera de TV no desktop, o quadro deixou de mostrar o campo inteiro e passou
 * a mostrar TAMBEM o que ha em volta. E em volta nao ha nada.
 *
 * `buildStage()` (:19344) monta o cenario num canvas de CW x CH com esta ordem:
 *   1. ceu (gradiente escuro) no canvas inteiro;
 *   2. ARQUIBANCADA — so na faixa de cima (`standBot = G.topY + 8`);
 *   3. placas de publicidade na linha de fundo distante;
 *   4. avental de gramado de 26 px em volta do campo;
 *   5. gramado listrado, luz, vinheta e marcacoes.
 *
 * Ou seja: torcida so atras do fundo distante. Nas laterais e embaixo fica o
 * ceu, que na pratica e um VAZIO ESCURO colado no gramado. Com o campo inteiro
 * em quadro isso nunca aparecia; com a camera fechada, aparece em cheio.
 *
 * EDIT · a arquibancada passa a envolver o canvas inteiro: o mesmo gradiente e a
 * mesma torcida pontilhada preenchem tudo o que nao e gramado, e o avental
 * cresce para nao deixar costura entre o gramado e a arquibancada. Nada muda no
 * campo em si — a ordem de desenho garante que gramado, marcacoes e luz sao
 * pintados por cima, exatamente como antes.
 *
 * A torcida das laterais e desenhada com a MESMA semente e a mesma regra do
 * topo, entao o estadio e coerente e continua deterministico.
 *
 * PREVISAO: numeros do motor IDENTICOS. O gate e a captura: nao pode sobrar
 * vazio escuro nem faixa verde chapada em nenhuma borda.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.79 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.80 - JOGO DE FUTEBOL.html');
const AVENTAL=arg('avental','64');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

edit('os61-stands-wrap',
`    // arquibancada: anel de arquibancada atrás do gramado (faixas + torcida pontilhada)
    const standTop = 0, standBot = G.topY + 8;
    const st = g.createLinearGradient(0, standTop, 0, standBot);
    st.addColorStop(0, '#0b1524'); st.addColorStop(1, '#13233a');
    g.fillStyle = st; g.fillRect(0, standTop, CW, standBot - standTop);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 5; row++) {
      const y = 8 + row * ((standBot - 14) / 5);
      for (let x = 6; x < CW - 6; x += 5) {
        if (rnd() < 0.72) {
          const c = rnd();
          g.fillStyle = c < .06 ? 'rgba(255,203,69,.5)' : c < .12 ? 'rgba(56,189,248,.45)' : \`rgba(\${170 + (c * 60) | 0},\${175 + (c * 50) | 0},\${190 + (c * 40) | 0},.30)\`;
          g.fillRect(x + rnd() * 2, y + rnd() * 3, 2, 2);
        }
      }
    }`,
`    /* OS-61 · a arquibancada existia SO na faixa de cima; nas laterais e
       embaixo sobrava o ceu, que colado no gramado vira vazio escuro. Com o
       campo inteiro em quadro isso nunca aparecia — com a camera de TV da
       OS-57, aparece em cheio. Agora ela envolve o canvas todo. */
    const standTop = 0, standBot = G.topY + 8;
    const st = g.createLinearGradient(0, standTop, 0, standBot);
    st.addColorStop(0, '#0b1524'); st.addColorStop(1, '#13233a');
    g.fillStyle = st; g.fillRect(0, standTop, CW, standBot - standTop);
    /* anel completo: tudo o que nao for gramado recebe arquibancada */
    const stAll = g.createLinearGradient(0, standBot, 0, CH);
    stAll.addColorStop(0, '#13233a'); stAll.addColorStop(1, '#0a1524');
    g.fillStyle = stAll; g.fillRect(0, standBot, CW, CH - standBot);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 5; row++) {
      const y = 8 + row * ((standBot - 14) / 5);
      for (let x = 6; x < CW - 6; x += 5) {
        if (rnd() < 0.72) {
          const c = rnd();
          g.fillStyle = c < .06 ? 'rgba(255,203,69,.5)' : c < .12 ? 'rgba(56,189,248,.45)' : \`rgba(\${170 + (c * 60) | 0},\${175 + (c * 50) | 0},\${190 + (c * 40) | 0},.30)\`;
          g.fillRect(x + rnd() * 2, y + rnd() * 3, 2, 2);
        }
      }
    }
    /* torcida das laterais e do fundo proximo, mesma regra e mesma semente */
    for (let y = standBot + 4; y < CH - 4; y += 6) {
      for (let x = 4; x < CW - 4; x += 5) {
        if (rnd() < 0.55) {
          const c = rnd();
          g.fillStyle = c < .06 ? 'rgba(255,203,69,.40)' : c < .12 ? 'rgba(56,189,248,.35)' : \`rgba(\${160 + (c * 60) | 0},\${168 + (c * 50) | 0},\${185 + (c * 40) | 0},.22)\`;
          g.fillRect(x + rnd() * 2, y + rnd() * 3, 2, 2);
        }
      }
    }`);

edit('os61-apron',
`    // avental de gramado ao redor do campo (mundo estendido além das linhas)
    const ap = 26;`,
`    /* OS-61 · avental maior: com a arquibancada fechando o anel, o gramado
       precisa avancar o suficiente para nao deixar costura visivel entre a
       linha lateral e a torcida. */
    const ap = ${AVENTAL};`);

/* 3 ── a moldura do letterbox deixa de ser verde chapado --------------------- */
edit('os61-letterbox',
`canvas#fieldcv { display: block; width: 100%; height: auto; }`,
`canvas#fieldcv { display: block; width: 100%; height: auto; }
/* OS-61 · MEDIDO: o canvas usa object-fit:contain e a caixa e mais alta que a
   proporcao dele (973x475 interno contra 986x672 de caixa), entao sobram faixas
   em cima e embaixo mostrando o FUNDO DO ELEMENTO — que era verde de gramado e
   parecia campo morto. Vira moldura de estadio. */
canvas#fieldcv { background: linear-gradient(180deg,#081120 0%,#0b1524 45%,#081120 100%) !important; }
#app:has(#fieldcv) .field-wrap, .field-wrap:has(#fieldcv) { background:#081120; }`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| avental='+AVENTAL);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
