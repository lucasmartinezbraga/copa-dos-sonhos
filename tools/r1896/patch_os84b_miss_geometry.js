#!/usr/bin/env node
'use strict';
/*
 * OS-84B · O CHUTE "PARA FORA" PASSA A SAIR DE FATO
 * =================================================
 *
 * ISTO NAO E APRESENTACAO. E geometria do motor, e foi achado por acidente ao
 * instrumentar a OS-84.
 *
 * MEDIDO na R18.86 intocada, 8 partidas, 63 chutes para fora, retro-projetando
 * a bola real (posicao e velocidade no quadro da emissao) ate x = g.x:
 *
 *   cruzaram a linha ENTRE OS POSTES ......  27 de 63  (42,9%)
 *   passaram por cima do travessao ........   0
 *   penetracao maxima dentro do gol .......   3,39 m  (meia largura do gol: 3,66)
 *   folga ao poste, mediana ...............   0,48 m
 *   folga ao poste, p10 ................... - 1,02 m
 *
 * Quase metade dos chutes que o jogo narra como "manda pra fora" ENTRAM no gol:
 * cruzam a linha de fundo entre as traves e por baixo do travessao, e so ficam
 * "fora" porque o ponto de PARADA esta 2 a 3 m atras da linha.
 *
 * MECANISMO, com arquivo:linha (R18.86)
 *   O alvo do desfecho "miss" e posto ALEM da linha, com desvio lateral
 *   sorteado em torno do CENTRO do gol -- :5413, :5524, :5526, :6314, :6338,
 *   :6355, :6386, :6982, :6989, :6991, :7065. A bola viaja em LINHA RETA do pe
 *   ate esse alvo. Como o alvo esta 2 a 3 m atras da linha, o segmento cruza a
 *   linha ANTES, num ponto lateralmente mais para DENTRO -- tanto mais quanto
 *   mais fechado o angulo. O desvio foi sorteado para o ponto de PARADA; quem
 *   decide o que o olho ve e o ponto de CRUZAMENTO.
 *
 * DUAS TENTATIVAS FALHARAM ANTES DESTA. Valem mais que o patch.
 *
 *   v1 -- camada nova no fim do arquivo, envolvendo `_startTravel` e agindo
 *   ANTES de chamar a original. Medicao antes/depois: alterou o alvo de TODO
 *   chute, inclusive os que ja saiam bem por fora (folga 2,18 -> 1,51;
 *   2,52 -> 0,84; 3,09 -> 0,97) e chegou a empurrar um chute bom para DENTRO
 *   (1,14 -> -0,29). Causa: existem QUATORZE sitios envolvendo `_startTravel`
 *   neste arquivo (:14672, :14789, :15253, :16286, :16534, :16734, :19247,
 *   :21424, :22195, :23123, :23471, :24650, :24762, :24878). Uma camada nova no
 *   fim e a MAIS EXTERNA, portanto roda PRIMEIRO, e as demais reescrevem o alvo
 *   depois dela.
 *
 *   v2 -- correcao dentro do NUCLEO de `_startTravel`, achando que o nucleo,
 *   por rodar por ultimo na cadeia de chamadas, teria a palavra final. Medicao:
 *   o nucleo E alcancado (49 chamadas para 49 chutes) e calculou correcao para
 *   30 chutes em 8 partidas -- e mesmo assim a bateria saiu BYTE A BYTE igual a
 *   base. Ou seja: o valor era descartado. Camadas externas reescrevem
 *   `ball.target` e o vetor DEPOIS que o nucleo retorna.
 *
 *   v3 (esta) -- o ponto autoritativo nao e antes nem no meio: e DEPOIS de toda
 *   a cadeia retornar. A camada envolve `_startTravel` e `_continueTravel`,
 *   chama a original primeiro, e so entao corrige `ball.target` e re-deriva
 *   `ball.vx/vy` preservando o modulo da velocidade. Essa e a ultima escrita.
 *
 * HIPOTESE (direcao, nunca porcentagem -- HANDOFF §5)
 *   1. a fracao de chutes "para fora" que cruzam entre os postes CAI a zero;
 *   2. nenhum chute que ja saia por fora e puxado para dentro -- a guarda de
 *      idempotencia e o teste, e foi o defeito que derrubou a v1;
 *   3. gols, xG, chutes e escanteios NAO tem direcao esperada: o desfecho de
 *      cada lance ja estava decidido antes desta camada. O que muda e a posicao
 *      dos corpos durante a bola morta, e dai o futuro, por caos.
 *
 * GATE QUE DECIDE
 *   O gate proprio e (1) com (2). A ecologia entra como rede: ECO-02 xG <= 2,7,
 *   gols 1,8-3,0 e ECO-05 escanteios 4-10, em SEIS bases de 24 partidas -- nao
 *   tres, porque a propria R18.86 promovida reprova o piso de gols na base
 *   6300000 (1,667) e as tres bases publicadas eram um recorte favoravel.
 *
 * ARMADILHA REGISTRADA
 *   O ramo da TRAVE (:6369) usa alvo com |dy| = 3,66 exato e x = g.x
 *   (alem = 0). Se a condicao de entrada fosse so pelo desvio lateral, esta
 *   camada moveria a bola da trave e mataria o evento `post`. Por isso a
 *   condicao exige `alem > 0.05`. Confira o contador de traves na bateria.
 */
const fs = require('fs');
const crypto = require('crypto');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('uso: node patch_os84b_miss_geometry.js <entrada.html> <saida.html>'); process.exit(1); }
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const CAMADA = [
'<script id="cds-os84b-miss-geometry">',
'(function(root){',
"'use strict';",
'/* §OS-84B · o chute para fora passa a CRUZAR a linha por fora do poste.',
'',
'   Medido na R18.86: 27 de 63 chutes para fora (42,9%) cruzavam a linha de',
'   fundo ENTRE as traves e por baixo do travessao, penetrando ate 3,39 m dentro',
'   do gol, e so ficavam "fora" porque o ponto de PARADA estava 2 a 3 m atras da',
'   linha. O desvio lateral era sorteado para o ponto de parada; quem decide o',
'   que o olho ve e o ponto de cruzamento.',
'',
'   ESTA CAMADA AGE DEPOIS DE CHAMAR A ORIGINAL, e isso e a parte que importa.',
'   Existem quatorze sitios envolvendo _startTravel neste arquivo. Agir ANTES',
'   (v1) deixa as camadas seguintes reescreverem o alvo; corrigir dentro do',
'   NUCLEO (v2) tambem nao vale, porque camadas externas reescrevem ball.target',
'   depois que ele retorna -- medido: o nucleo calculou correcao para 30 chutes',
'   e a bateria saiu byte a byte igual a base. A ultima escrita e aqui.',
'',
'   Nao sorteia nada e nao muda desfecho nenhum: o lance ja foi resolvido como',
'   miss antes de chegar aqui. So endireita a reta. */',
'const M = root && root.MatchSim;',
'if (!M || !M.prototype || M.prototype.__OS84B__) return;',
'const P = M.prototype; P.__OS84B__ = true;',
'const FW = Number(root.FW) || 68;',
'const POSTE = 3.66;       // meia largura do gol',
'const LIVRE_MIN = 0.30;   // folga minima visivel por fora do poste',
'const LIVRE_MAX = 1.80;   // teto: manter o lance perto do gol, sem exagerar',
'',
'/* Devolve o novo y do alvo, ou o mesmo y quando nao ha nada a corrigir. */',
'function foraDoPoste(sim, o, sx, sy, tx, ty) {',
'  const tm = o && sim.teams && sim.teams[o.team], g = tm && tm.oppGoal;',
'  if (!g || !Number.isFinite(tx) || !Number.isFinite(ty)) return ty;',
'  const dir = tm.attackDir || (g.x > 52.5 ? 1 : -1);',
'  if ((tx - g.x) * dir <= 0.05) return ty;      // o alvo nem passa da linha',
'  const dAlvo = ty - g.y;',
'  /* O motor codifica GOL com |dy| <= 3,35 em todos os sitios e FORA com',
'     |dy| >= 3,4. A trave (:6369) usa |dy| = 3,66 mas com alvo NA linha, e por',
'     isso ja saiu pela condicao acima. */',
'  if (Math.abs(dAlvo) <= 3.36) return ty;',
'  const den = tx - sx;',
'  if (Math.abs(den) < 1e-6) return ty;',
'  const u = (g.x - sx) / den;                   // fracao do trajeto ate a linha',
'  if (!(u > 0.05 && u <= 1)) return ty;',
'  const s = dAlvo >= 0 ? 1 : -1;',
'  const cruz = sy + u * (ty - sy);',
'  /* IDEMPOTENCIA: quem ja cruza por fora nao e tocado. Sem esta guarda a',
'     camada puxa chutes bons para dentro -- foi o defeito medido na v1. */',
'  if ((cruz - g.y) * s >= POSTE + LIVRE_MIN) return ty;',
'  const livre = Math.max(LIVRE_MIN, Math.min(Math.abs(dAlvo) - POSTE, LIVRE_MAX));',
'  const ny = sy + ((g.y + s * (POSTE + livre)) - sy) / u;',
'  if (!Number.isFinite(ny)) return ty;',
'  return Math.max(-24, Math.min(FW + 24, ny));',
'}',
'',
'/* Reescreve alvo e vetor DEPOIS que toda a cadeia falou. O modulo da',
'   velocidade e preservado: so a direcao muda. */',
'P.__os84bCorrigeVoo = function (o) {',
'  const b = this.ball;',
'  if (!b || !b.traveling || !b.target) return;',
'  const sx = Number.isFinite(b.x) ? b.x : (b.from && b.from.x);',
'  const sy = Number.isFinite(b.y) ? b.y : (b.from && b.from.y);',
'  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;',
'  const ny = foraDoPoste(this, o, sx, sy, b.target.x, b.target.y);',
'  if (!(Math.abs(ny - b.target.y) > 1e-9)) return;',
'  b.target = { x: b.target.x, y: ny };',
'  const dx = b.target.x - sx, dy = ny - sy;',
'  const d = Math.max(1e-6, Math.hypot(dx, dy));',
'  const v = Math.max(1, Math.hypot(b.vx || 0, b.vy || 0) || b.speed || 40);',
'  b.vx = dx / d * v; b.vy = dy / d * v;',
'  b._timeout = d / v + 0.35;',
'  if (this.stats && o && this.stats[o.team]) {',
'    this.stats[o.team].__os84bFixed = (this.stats[o.team].__os84bFixed || 0) + 1;',
'  }',
'};',
'',
'const oST = P._startTravel;',
'P._startTravel = function (o, target, kind, onArrive, receiver, passKind, meta) {',
'  const r = oST.apply(this, arguments);',
'  try { if (kind === "shot") this.__os84bCorrigeVoo(o); } catch (_) {}',
'  return r;',
'};',
'/* Tres sitios criam alvo de "fora" por _continueTravel e nao por _startTravel:',
'   :5516 (cabeceio sem bloqueador), :6356 (bloqueador que nao alcancou) e',
'   :6982 (barreira que nao alcancou). O dono do chute e `lastTouch`. */',
'const oCT = P._continueTravel;',
'if (typeof oCT === "function") {',
'  P._continueTravel = function (target, kind, onArrive, meta, speed) {',
'    const r = oCT.apply(this, arguments);',
'    try {',
'      const dono = this.ball && this.ball.lastTouch;',
'      if (kind === "shot" && dono) this.__os84bCorrigeVoo(dono);',
'    } catch (_) {}',
'    return r;',
'  };',
'}',
'})(typeof window!==\'undefined\'?window:globalThis);',
'</script>',
''
].join('\n');

edit('os84b-camada',
  '<script id="cds-r1886-build-meta">',
  CAMADA + '<script id="cds-r1886-build-meta">');

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
