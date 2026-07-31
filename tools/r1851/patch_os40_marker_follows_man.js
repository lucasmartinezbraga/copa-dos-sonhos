#!/usr/bin/env node
'use strict';
/*
 * OS-40 · O MARCADOR PODE SEGUIR O HOMEM
 * ---------------------------------------
 * O gate `marking` (:17271) reprova metade das partidas desde o inicio desta
 * linhagem e nao se moveu com nenhuma rodada. Censo (16 partidas, R18.66):
 *
 *   threatCoverage      media 0,642  mediana 0,672  min 0,450   (gate >= 0,65)
 *   markerMeanDistance  media 7,30   mediana 7,38   max 9,23    (gate <= 8,5)
 *   aprovadas 8 | so cobertura 6 | so distancia 0 | ambas 2
 *
 * Quem reprova e a COBERTURA, nao a distancia. E a cobertura falha assim
 * (8 partidas, 56.854 amostras de ameaca):
 *
 *   descobertas                          41,6%
 *     ninguem a <= 8,5 m                 51,8% delas
 *     perto mas nao do lado do gol       13,4%
 *     combinacao nao satisfeita          34,7%
 *     JA TINHAM MARCADOR DESIGNADO       80,1%
 *
 * Oitenta por cento das ameacas descobertas ja tem marcador. A designacao
 * funciona; o que falha e para ONDE o marcador e mandado:
 *
 *   distancia do ALVO de marcacao ate o homem marcado   media 14,25 m
 *     > 14 m em 36,8% das amostras
 *   alvo dentro de 8,5 m do homem                       50,5%
 *   marcador a <= 2,5 m do proprio alvo                 27,8%
 *
 * MECANISMO (:20223, camada R18.5). Ela sobrescreve o alvo depois da R13:
 *
 *   DEF:  px = clamp(px, line-2.45, line+2.45)
 *   MID:  px = clamp(px, line-1.8,  line+10.8)   // 15.2 para o presser
 *   depois, se ha _markRef:  px = min(px, ap-1.15)   e   py = markRef.y
 *
 * O `y` acompanha o homem. A PROFUNDIDADE e que esta presa. Um adversario que
 * recebe 20 m a frente da ultima linha tem o zagueiro travado em `line+2.45`
 * (a 17 m dele) e o meia travado em `line+10.8` (a 9 m). Ninguem chega aos
 * 8,5 m goal-side que a cobertura exige.
 *
 * A trava existe por um motivo real — uma linha que persegue todo mundo e
 * rasgada. Mas 10,8 m para um MEIA e apertado demais: no futebol a distancia
 * entre a linha defensiva e a de meio-campo ja e de 10 a 15 m, e o volante que
 * marca o homem entre as linhas sobe ate ele.
 *
 * EDIT 1 · o MEIA segue o homem. Quando tem `_markRef`, o teto deixa de ser
 * fixo e passa a ser o proprio homem, limitado a `line + MIDTETO`:
 *
 *     maxAhead = max(line+10.8, min(ap-1.05, line+${'${MIDTETO}'}))
 *
 * Sem `_markRef` nada muda — o bloco continua com o teto de sempre.
 *
 * EDIT 2 · o ZAGUEIRO sai com cobertura. A trava de 2,45 m continua sendo a
 * regra, e so cede para UM zagueiro por vez: aquele cujo homem e a ameaca mais
 * proxima do gol, e somente se ainda houver outro zagueiro atras dele. Isso e
 * sair na marcacao com cobertura, que e como se defende; nao e a linha inteira
 * perseguindo.
 *
 * Nao ha RNG novo. Nao ha ganho de velocidade: `_integrate` continua com o
 * `maxSpd`/`acc` do atleta. O que muda e o destino.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.66):
 *   - threatCoverage 0,642: SOBE. Partidas aprovadas no gate marking: 8/16 sobe.
 *   - markerMeanDistance 7,30: DESCE.
 *   - alvo->homem 14,25 m: DESCE muito.
 *   - gate `lines` 1/12: RISCO REAL de piorar — e o gate que decide a recusa.
 *   - swarmRate e severeCollapse: RISCO de piorar (marcador mais perto do homem
 *     e mais gente na mesma regiao).
 *   - gols e xG: DESCEM ou ficam (marcar melhor tira chance).
 *   - escanteios 5,80: RISCO de descer. Se cair abaixo de 4,0 eu perco a
 *     conquista da OS-39 e o patch e recusado.
 *
 * ARMADILHA: se os dois edits subirem juntos eu nao sei qual funcionou. Por
 * isso `--mid` e `--def` sao independentes e as tres variantes foram medidas.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.66 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.67 - JOGO DE FUTEBOL.html');
const midTeto = arg('midTeto', '24');
const defTeto = arg('defTeto', '7');
const fazMid = arg('mid', '1') !== '0';
const fazDef = arg('def', '1') !== '0';
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

/* ---- EDIT 1 · o meia sobe ate o homem, com teto -------------------------- */
if (fazMid) {
  edit(
    'os40-mid-follows-man',
    `      const maxAhead=line+(isPresser?15.2:10.8);
      const minDepth=line-1.8;
      px=clamp(px,minDepth,maxAhead);
      if(p._markRef&&!p._markRef.red){
        const ap=ownProg(tm,p._markRef.x);`,
    `      /* OS-40 · com homem designado o teto deixa de ser fixo e passa a ser
         o proprio homem, limitado a line+${midTeto}. Medido: o alvo de marcacao
         ficava a 14,25 m do marcado em media, e 36,8% das vezes acima de 14 m,
         porque este teto de 10,8 m prendia o meia atras da ameaca. Sem
         _markRef nada muda. */
      let maxAhead=line+(isPresser?15.2:10.8);
      if(p._markRef&&!p._markRef.red){
        const _apm=ownProg(tm,p._markRef.x);
        maxAhead=Math.max(maxAhead,Math.min(_apm-1.05,line+${midTeto}));
      }
      const minDepth=line-1.8;
      px=clamp(px,minDepth,maxAhead);
      if(p._markRef&&!p._markRef.red){
        const ap=ownProg(tm,p._markRef.x);`
  );
}

/* ---- EDIT 2 · um zagueiro sai, com cobertura ----------------------------- */
if (fazDef) {
  edit(
    'os40-def-steps-out-with-cover',
    `      px=clamp(px,line-2.45,line+2.45);
      if(p._markRef&&!p._markRef.red){
        const ap=ownProg(tm,p._markRef.x);
        px=Math.min(px,ap-1.15); // sempre goal-side`,
    `      /* OS-40 · sair na marcacao COM COBERTURA. A trava de 2,45 m continua
         sendo a regra; cede para UM zagueiro por vez — o que marca a ameaca
         mais proxima do gol — e so se houver outro zagueiro atras dele. Linha
         inteira perseguindo continua proibido. */
      let _o40Teto=line+2.45;
      if(p._markRef&&!p._markRef.red){
        const _defs=tm.players.filter(q=>!q.red&&!q.isGK&&lineOf(q)==='DEF');
        const _marcados=_defs.filter(q=>q._markRef&&!q._markRef.red);
        let _maisFundo=null,_melhor=1e9;
        for(const q of _marcados){
          const gd=Math.hypot(q._markRef.x-tm.goal.x,q._markRef.y-tm.goal.y);
          if(gd<_melhor){_melhor=gd;_maisFundo=q;}
        }
        const _meuProg=ownProg(tm,p.x);
        const _cobertura=_defs.some(q=>q!==p&&ownProg(tm,q.x)<_meuProg-1.2);
        if(p===_maisFundo&&_cobertura)_o40Teto=line+${defTeto};
      }
      px=clamp(px,line-2.45,_o40Teto);
      if(p._markRef&&!p._markRef.red){
        const ap=ownProg(tm,p._markRef.x);
        px=Math.min(px,ap-1.15); // sempre goal-side`
  );
}

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', ') || '(nenhum)', '| midTeto=' + midTeto, 'defTeto=' + defTeto);
console.log(path.basename(output), '| sha256', sha);
