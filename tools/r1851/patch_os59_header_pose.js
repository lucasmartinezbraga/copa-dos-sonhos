#!/usr/bin/env node
'use strict';
/*
 * OS-59 · O CABECEIO PARA DE SER ATROPELADO PELO CHUTE
 * -----------------------------------------------------
 * A revisao da animacao deixou "cabeceio em 50% de cobertura" em aberto, e eu
 * disse que nao resolveria por palpite porque havia duas causas possiveis
 * opostas: fiacao faltando ou pose sobrescrita. O censo separou as duas
 * (3 partidas):
 *
 *     header_clear   12 eventos ->  100,0% com pose de cabeceio
 *     header_shot    12 eventos ->    0,0%
 *       estado visto no lugar: shot_prepare em 12 de 12
 *
 * Nao era fiacao. Era SOBRESCRITA, e o autor sou eu: na OS-46 pus
 *
 *     if(kind==='shot' && o && ...) pede(this,o,'shot_prepare');
 *
 * em `_startTravel`, para o chute sempre ter pose. Um cabeceio E um voo de
 * chute — entao o pedido de `shot_prepare` chega logo depois do `header` e
 * atropela a pose que tinha acabado de ser pedida.
 *
 * EDIT · quem acabou de receber `header` fica marcado, e o pedido de
 * `shot_prepare` respeita essa marca por ${'${JANELA}'} s. Nenhuma outra
 * mudanca: chute de pe continua pedindo a pose de sempre.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - `header_shot` com pose de cabeceio: 0% -> perto de 100%.
 *   - `header_clear`: continua em 100%.
 *   - chute: continua em 100% (a marca so vale para quem cabeceou).
 *   - numeros do motor: IDENTICOS.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.78 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.79 - JOGO DE FUTEBOL.html');
const JANELA=arg('janela','0.6');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

edit('os59-mark-header',
`      else if((type==='header_shot'||type==='header_clear')&&data.by){ pede(this,data.by,'header'); }`,
`      else if((type==='header_shot'||type==='header_clear')&&data.by){
        pede(this,data.by,'header');
        /* OS-59 · marca quem cabeceou: o voo de chute que vem logo a seguir
           pediria shot_prepare e atropelaria esta pose. Medido: header_shot
           ficava em 0% de cobertura, com shot_prepare no lugar em 12 de 12. */
        try{ data.by.__os59Head=(Number(this.t)||0)+${JANELA}; }catch(_){}
      }`);

edit('os59-respect-header',
`      if(kind==='shot'&&o&&!(meta&&meta.actor===o)){ pede(this,o,'shot_prepare'); }`,
`      if(kind==='shot'&&o&&!(meta&&meta.actor===o)
         && !(o.__os59Head && (Number(this.t)||0) < o.__os59Head)){ pede(this,o,'shot_prepare'); }`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| janela='+JANELA);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
