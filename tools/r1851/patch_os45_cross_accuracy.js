#!/usr/bin/env node
'use strict';
/*
 * OS-45 · O CRUZAMENTO PODE SER RUIM
 * -----------------------------------
 * Depois da OS-42/43/44 o cruzamento virou jogada disputada, mas o censo mostra
 * que as categorias saturam (R18.69, 10 partidas):
 *
 *     cruzamentos                17,90
 *       finalizacao   8,0   44,7%   (real ~25%)
 *       corte         6,8   38,0%   (real ~50%)
 *       defesa do GK  3,9   22%
 *
 * Somando, praticamente todo cruzamento ENCONTRA alguem. E o motivo esta na
 * entrega: o ramo aereo (:5411) mira
 *
 *     this._startTravel(o,{x:atk.x,y:atk.y},'pass',...)
 *
 * — a cabeca do atacante, exatamente, sempre. A precisao do cruzamento e 100%,
 * independente de quem cruza, de que distancia e sob que pressao. No futebol
 * real 25 a 30% dos cruzamentos nao acham ninguem: passam longe do segundo pau,
 * morrem na primeira trave ou vao direto para o goleiro.
 *
 * EDIT · antes do duelo, uma rolagem de PRECISAO:
 *
 *     pOk = clamp(${'${BASE}'} + crossSkill/${'${DIV}'} + (nearByline?+.08:0)
 *                 + (setPiece?+.14:0), ${'${MIN}'}, ${'${MAX}'})
 *
 * Falhando, a bola vai para um ponto ERRADO — alem do segundo pau ou curta
 * demais — e segue viva como bola solta, exatamente como o ramo de cruzamento
 * livre (R18.31) ja faz. Quem estiver por perto disputa; ninguem por perto,
 * ela sai pela linha e o reinicio nasce de `_ballOut`, que deriva escanteio ou
 * tiro de meta do ultimo toque real. Nada de desfecho decretado.
 *
 * Bola parada leva bonus de precisao: cobrador com tempo e sem marcacao acerta
 * mais do que quem cruza em movimento.
 *
 * Nenhum atributo novo. `crossSkill` ja existia e ja era usado na escolha entre
 * rasteiro e aereo (:5320); faltava governar a PRECISAO, nao so a escolha.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.69, 40 partidas):
 *   - `cruzamento -> chute` 44,7%: DESCE para a casa de 25 a 35%.
 *   - `header_shot` 4,4: DESCE.
 *   - chutes 20,07: DESCEM.
 *   - gols 2,42: DESCEM — e o risco desta rodada, ja voltaram do fundo uma vez.
 *   - escanteios 6,40: DESCEM um pouco; nao podem cair abaixo de 4,0.
 *   - xG 2,45: DESCE.
 *   - RECUSA se os gols cairem abaixo de 1,8 ou os escanteios abaixo de 4,0.
 *
 * ARMADILHA: se o ponto errado cair sempre para o mesmo lado, o jogo cria um
 * padrao visivel de bola morrendo no mesmo canto. O desvio sorteia lado e
 * profundidade, e o alvo errado continua dentro do campo — quem decide se sai
 * e a fisica, nao este patch.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.69 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.70 - JOGO DE FUTEBOL.html');
const BASE = arg('base', '0.34');
const DIV = arg('div', '260');
const MIN = arg('min', '0.40');
const MAX = arg('max', '0.82');
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

edit(
  'os45-cross-accuracy',
  `    const def=defs.slice().sort((a,b)=>D(a.x,a.y,atk.x,atk.y)-D(b.x,b.y,atk.x,atk.y))[0];
    this._startTravel(o,{x:atk.x,y:atk.y},'pass',()=>{`,
  `    /* OS-45 · a entrega aerea mirava a cabeca do atacante EXATAMENTE, sempre.
       Medido: praticamente todo cruzamento encontrava alguem (44,7% chute +
       38,0% corte + 22% defesa), contra 25 a 30% que no futebol real nao acham
       ninguem. A precisao passa a depender de quem cruza. */
    {
      const _o45ok=clamp(${BASE}+crossSkill/${DIV}+(nearByline?.08:0)+(setPiece?.14:0),${MIN},${MAX});
      if(!chance(_o45ok)){
        this.stats[o.team].crossesBad=(this.stats[o.team].crossesBad||0)+1;
        const _lado=chance(.5)?1:-1;
        const _mx=clamp(g.x-tm.attackDir*R(-1.5,6.5),2,FL-2);
        const _my=clamp(g.y+_lado*R(9,15.5),2,FW-2);
        this._emit('cross_ruim',{by:o,x:_mx,y:_my});
        this._startTravel(o,{x:_mx,y:_my},'pass',()=>{
          /* mesma saida do cruzamento livre (R18.31): a bola SEGUE viva. */
          const _b=this.ball;
          _b.owner=null;_b.traveling=false;_b.meta=null;_b.receiver=null;_b.onArrive=null;
          let _vx=Number.isFinite(_b.vx)?_b.vx:0,_vy=Number.isFinite(_b.vy)?_b.vy:0;
          if(!(Math.hypot(_vx,_vy)>7)){
            const _dx=_mx-o.x,_dy=_my-o.y,_L=Math.max(.001,Math.hypot(_dx,_dy));
            _vx=_dx/_L*7;_vy=_dy/_L*7;
          }
          _b.vx=_vx;_b.vy=_vy;_b.vz=Math.min(0,Number.isFinite(_b.vz)?_b.vz:0);
          _b._looseT=0;_b.__p04Live=true;
        },null,'launch');
        return;
      }
    }
    const def=defs.slice().sort((a,b)=>D(a.x,a.y,atk.x,atk.y)-D(b.x,b.y,atk.x,atk.y))[0];
    this._startTravel(o,{x:atk.x,y:atk.y},'pass',()=>{`
);

/* ---- EDIT 2 · o rasteiro tambem pode ser ruim ---------------------------- */
edit(
  'os45-low-cross-failure',
  `      if(!lowCrossWon&&!physicalCrossBlock)lowCrossWon=true;`,
  `      /* OS-45 · o defensor venceu o duelo e nao alcanca fisicamente. Isso nao
         e vitoria do atacante — e entrega ERRADA. A linha antiga convertia toda
         derrota defensiva sem contato em sucesso do cruzamento, o que fazia o
         rasteiro quase nunca falhar. */
      if(!lowCrossWon&&!physicalCrossBlock){
        this.stats[o.team].crossesBad=(this.stats[o.team].crossesBad||0)+1;
        this._emit('cross_ruim',{by:o,kind:'low'});
        const _o45y=clamp(target.y+(chance(.5)?1:-1)*R(5,10),2,FW-2);
        this._startTravel(o,{x:clamp(target.x-tm.attackDir*R(0,3.5),2,FL-2),y:_o45y},'pass',()=>{
          const _b=this.ball;
          _b.owner=null;_b.traveling=false;_b.meta=null;_b.receiver=null;_b.onArrive=null;
          _b._looseT=0;_b.__p04Live=true;
        },null,'through');
        return;
      }`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| base=' + BASE, 'div=' + DIV, 'min=' + MIN, 'max=' + MAX);
console.log(path.basename(output), '| sha256', sha);
