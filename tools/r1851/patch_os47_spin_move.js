#!/usr/bin/env node
'use strict';
/*
 * OS-47 · O GIRO DE 360 EXISTE, E O CORPO GIRA
 * ---------------------------------------------
 * O jogo tem seis dribles nomeados em `_pickMove` (:5829) — arrancada,
 * elastico, caneta, drible da vaca, meia-lua, corta pra dentro — e um estado de
 * animacao `turn_dribble` no catalogo. A meia-lua e exatamente a roleta de 360.
 * Nenhum deles aparece em campo.
 *
 * MEDIDO (6 partidas): 36,7 dribles por partida, 8,8 com efeito (24,1%), e o
 * campo `move` do evento vem SEMPRE vazio. O payload real e
 * `{by, on, ok, flair}` — sem `move`.
 *
 * CAUSA. `P._dribble` e SUBSTITUIDO por inteiro pela camada R12.2 (:16382), que
 * nao encadeia com o nucleo. O `_dribble` original (:5840) e o `_pickMove` que
 * ele chama sao CODIGO MORTO. E a mesma armadilha estrutural ja documentada
 * nesta linhagem para `_assignDefRoles` (OS-06) e `_defendTarget` (OS-40).
 *
 * E mesmo que o nome chegasse, nao haveria giro: `CDS_F25D.body` (:19517) so
 * rotaciona o corpo no mergulho do goleiro (`divePose`). Nao existe pose de
 * giro desenhada.
 *
 * TRES EDITS
 *
 * 1) O DRIBLE VOLTA A TER NOME. No emit vivo da R12.2, `move` passa a ser
 *    escolhido pelos ATRIBUTOS do atleta, sem RNG:
 *      velocidade >= 88            -> arrancada
 *      tecnica    >= 88            -> drible da vaca
 *      drible >= 88 e tecnica >= 84-> elastico
 *      drible >= 86                -> meia-lua
 *      senao                       -> corta pra dentro
 *    Havendo mais de um elegivel, alterna por `t` e numero da camisa. Sem
 *    sorteio nenhum: o motor nao consome uma rolagem a mais, entao os numeros
 *    da partida ficam IDENTICOS — e isso e o gate desta rodada.
 *    De quebra o drible vira caracteristica do jogador, nao sorteio: quem tem
 *    tecnica faz vaca, quem tem drible faz meia-lua, quem tem perna faz
 *    arrancada.
 *
 * 2) O CORPO GIRA. Em `body()`, os estados `turn_dribble` e `protect_turn`
 *    ganham giro real. Em vista 2,5D o giro se le pelo ESTREITAMENTO: o corpo
 *    afina ate ficar de perfil, passa para o outro lado (de costas) e volta —
 *    `ctx.scale(cos(theta), 1)` com theta indo de 0 a 2*pi ao longo da fase.
 *    E o jeito classico de girar um boneco 2D, e casa com a passada e a
 *    inclinacao que ja existem. Ha uma elevacao pequena no meio do giro, para
 *    nao ficar chapado.
 *
 * 3) A FIACAO. `meia-lua` e `drible da vaca` passam a pedir `turn_dribble` (as
 *    duas sao giros; a meia-lua e a roleta). Isso entra no mapa da OS-46.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - `move` deixa de vir vazio: os seis nomes passam a aparecer.
 *   - `turn_dribble` 0%: passa a aparecer, na casa de 2 a 4 giros por partida.
 *   - numeros do motor: IDENTICOS. Nenhuma rolagem nova. Se mudarem, vazou.
 *
 * ARMADILHA: `ctx.scale(0,1)` colapsa a matriz e o desenho some (ou o canvas
 * reclama de matriz nao inversivel). O fator e limitado longe de zero.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.71 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.72 - JOGO DE FUTEBOL.html');
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

/* 1 ── o drible volta a ter nome, sem consumir RNG --------------------------- */
edit(
  'os47-dribble-move-name',
  `'dribble',{by:o,on:d,ok:true,flair:elite&&schance(this,.26)}`,
  `'dribble',{by:o,on:d,ok:true,flair:elite&&schance(this,.26),move:(function(_p,_t){` +
  `try{var _a=(_p&&_p.ref&&_p.ref.a8)||[70,70,70,70,70,70,70,70];` +
  `var _dri=_a[2],_vel=_a[3],_tec=_a[7],_m=[];` +
  `if(_vel>=88)_m.push('arrancada');` +
  `if(_tec>=88)_m.push('drible da vaca');` +
  `if(_dri>=88&&_tec>=84)_m.push('elástico');` +
  `if(_dri>=86)_m.push('meia-lua');` +
  `if(!_m.length)_m.push('corta pra dentro');` +
  `return _m[(Math.floor((Number(_t)||0)*3)+(Number(_p&&_p.num)||0))%_m.length];` +
  `}catch(_){return 'corta pra dentro';}})(o,this.t)}`
);

/* 2 ── o corpo gira de verdade ---------------------------------------------- */
edit(
  'os47-body-spin',
  `    ctx.save();
    ctx.translate(x, y - bob);
    if (o.divePose) ctx.rotate(Math.PI / 2);`,
  `    /* OS-47 · GIRO DE 360. Em vista 2,5D o giro se le pelo estreitamento: o
       corpo afina ate o perfil, passa de costas e volta. cos(theta) faz isso em
       uma linha, e casa com a passada e a inclinacao que ja existem. O fator e
       mantido longe de zero porque ctx.scale(0,1) colapsa a matriz. */
    const spinning = A && (st === 'turn_dribble' || st === 'protect_turn');
    const spinTh = spinning ? Math.max(0, Math.min(1, A.phase || 0)) * Math.PI * 2 : 0;
    ctx.save();
    ctx.translate(x, y - bob - (spinning ? r * .16 * Math.sin(spinTh / 2) : 0));
    if (o.divePose) ctx.rotate(Math.PI / 2);
    else if (spinning) {
      const _c = Math.cos(spinTh);
      ctx.scale(Math.abs(_c) < .16 ? (_c < 0 ? -.16 : .16) : _c, 1);
    }`
);

/* 3 ── a fiacao: meia-lua e vaca pedem o giro -------------------------------- */
edit(
  'os47-wire-spin',
  `  'drible da vaca':'turn_dribble',
  'meia-lua':'outside_cut',`,
  `  'drible da vaca':'turn_dribble',
  'meia-lua':'turn_dribble',      /* OS-47 · a meia-lua E a roleta de 360 */`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
