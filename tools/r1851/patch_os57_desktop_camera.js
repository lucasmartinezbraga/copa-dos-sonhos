#!/usr/bin/env node
'use strict';
/*
 * OS-57 · A CAMERA DE TV PASSA A VALER NO DESKTOP
 * ------------------------------------------------
 * CORRECAO DE UMA AFIRMACAO MINHA. Na revisao da animacao eu escrevi que os
 * atletas eram pequenos demais para a animacao ser legivel e que resolver isso
 * exigiria "camera que segue a bola, uma feature de porte".
 *
 * Errado duas vezes: a camera EXISTE, esta pronta, e e desligada de proposito
 * numa linha (:13602):
 *
 *     const desktopFullField = window.matchMedia('(min-width: 900px)').matches;
 *
 * O bloco de camera do `paintField` acompanha a bola com zoom de 1,35 no
 * paisagem e 1,22 no retrato, interpola ate 1,0 quando o usuario arrasta para
 * baixo (panoramica) e volta sozinho. O proprio comentario do codigo diz:
 * "o jogador NAO ve o campo inteiro; ve a ACAO, como uma transmissao de TV".
 *
 * Eu fotografei em 1400x900 — desktop — que e exatamente o caso que ignora
 * tudo isso. Refotografando em 390x844 (celular), os bonecos aparecem grandes,
 * com nome, numero e corpo legiveis, e a camera acompanha a jogada.
 *
 * EDIT · o desktop passa a usar a mesma camera. Um pouco mais aberta que o
 * paisagem de celular (${'${ZOOM}'} contra 1,35), porque a tela e larga e o
 * contexto tatico importa mais.
 *
 * Isto resolve DE UMA VEZ os dois pontos que ficaram abertos na revisao:
 *   - ESCALA: com zoom ${'${ZOOM}'} o atleta cresce na mesma proporcao, e a
 *     passada, a inclinacao, o giro de 360 e o voo do goleiro passam a ter
 *     pixels para existir.
 *   - SOBREPOSICAO: os 2,05 m de separacao minima do anti-aglomeracao valiam
 *     ~19 px em campo inteiro, quase a largura do boneco. Com a camera fechada
 *     os mesmos 2,05 m valem bem mais, e dois atletas no limite legal deixam de
 *     desenhar colados. Nao foi preciso mexer na separacao.
 *
 * O gesto de PANORAMICA continua: arrastar para baixo sobre o gramado abre o
 * campo inteiro e soltar volta para a acao — o mesmo `camHold` que o celular ja
 * usa, ligado por eventos de ponteiro, que valem para o mouse.
 *
 * PREVISAO: numeros do motor IDENTICOS. Isto e camera, nao simulacao.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.76 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.77 - JOGO DE FUTEBOL.html');
const ZOOM=arg('zoom','1.30');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

edit('os57-desktop-uses-camera',
`  const desktopFullField = window.matchMedia('(min-width: 900px)').matches;`,
`  /* OS-57 · o desktop passa a usar a MESMA camera de TV do celular. A camera
     ja existia pronta e era desligada aqui; com o campo inteiro o atleta fica
     com ~20 px e nenhuma animacao e legivel, e os 2,05 m de separacao minima
     viram ~19 px, quase a largura do boneco. Arrastar para baixo sobre o
     gramado continua abrindo a panoramica. */
  const desktopFullField = false;`);

edit('os57-desktop-zoom',
`function camBaseZoom(){
  if (isPortraitPhone()) return 1.22;    // retrato: ação maior; a interface fica abaixo por rolagem
  return 1.35;                           // paisagem: câmera de TV
}`,
`function camBaseZoom(){
  if (isPortraitPhone()) return 1.22;    // retrato: ação maior; a interface fica abaixo por rolagem
  /* OS-57 · tela larga: um pouco mais aberta que o paisagem de celular, porque
     o contexto tatico cabe e importa. */
  try{ if (window.matchMedia('(min-width: 900px)').matches) return ${ZOOM}; }catch(_){}
  return 1.35;                           // paisagem: câmera de TV
}`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| zoom desktop='+ZOOM);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
