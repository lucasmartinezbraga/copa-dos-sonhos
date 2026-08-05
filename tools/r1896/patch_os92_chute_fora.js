#!/usr/bin/env node
'use strict';
/*
 * OS-92 · O CHUTE PARA FORA SAI PELO LADO DE FORA DO POSTE
 * ========================================================
 *
 * O DEFEITO, medido na R18.86 e ainda presente na R18.91:
 *   27 de 63 chutes "para fora" (42,9%) cruzam a linha de fundo ENTRE as traves
 *   e por baixo do travessao, penetrando ate 3,39 m dentro do gol. Zero passam
 *   por cima. O jogo narra "manda pra fora" e a bola entra.
 *
 * TRES TENTATIVAS ANTERIORES, TODAS FALSIFICADAS
 *   v1  camada externa ANTES da original ...... alterou alvos que ja estavam bons
 *   v2  dentro do NUCLEO de _startTravel ...... calculou 30 correcoes e a bateria
 *                                               saiu byte a byte igual a base
 *   v3  camada externa DEPOIS da original ..... corrigiu ball.target 30 vezes e a
 *                                               bola foi ao alvo ANTIGO
 *   Prova da v3: alvo corrigido de 38,045 para 39,569, bola terminou em 38,05.
 *
 * POR QUE AS TRES FALHARAM — respondido por MEDICAO, nao por deducao
 *   Setter em `ball.x`/`ball.y` (HANDOFF §2A), 4 partidas, 4585 escritas durante
 *   voos de chute:
 *
 *     99,8%  P._ballTravel @cds-physics-timeline-581.js:89
 *              <- p04BallTravel @cds-p04-physical-reception-584-r6.js:533
 *              <- P._ballTravel @cds-r12-transactional-core-r123.js:146
 *
 *   E `ball.target` NAO e reescrito em voo (so 18 vezes por _deflectTo e 6 por
 *   _looseBall, ambas deflexoes legitimas).
 *
 *   Lendo :15035, a camada physics-timeline chama a original e entao constroi um
 *   SEGMENTO PROPRIO a partir do argumento `target` que recebeu:
 *
 *     b._physicsPlan = { segment: seg, elapsed: 0, actorPlan: ap };
 *
 *   e :15042 voa esse segmento:
 *
 *     const pt = segmentPoint(seg, plan.elapsed);
 *     b.x = pt.x; b.y = pt.y; b.z = pt.z;
 *
 *   IGNORANDO `b.target` e `b.vx/b.vy`. Corrigir qualquer um dos dois nao muda
 *   nada, porque o voo ja foi fotografado. Foi exatamente o que aconteceu.
 *
 * E TEM UMA SEGUNDA CAMADA
 *   :19710 (R18.3) reescreve as amostras com CURVA:
 *     bend = 4*q*(1-q) * fp.amp * fp.sign
 *   O voo nao e reto. Nenhuma correcao analitica de reta funcionaria, mesmo no
 *   lugar certo -- o ponto de cruzamento depende da curva.
 *
 * A CORRECAO
 *   Nao calcular: MEDIR. Esta camada envolve `_planPhysicalSegment`, que e o
 *   gargalo unico de `_startTravel`, `_continueTravel` e `_deflectTo`. Ela deixa
 *   o plano ser construido, LE as amostras realmente voadas, acha onde a
 *   trajetoria cruza x = g.x, e se esse ponto cair entre os postes num chute
 *   cujo alvo e de "fora", desloca o alvo e RE-PLANEJA. Duas iteracoes, porque
 *   re-planejar muda a curva.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. a fracao de chutes "para fora" que cruzam entre os postes CAI a zero;
 *   2. nenhum chute que ja cruza por fora e puxado para dentro (idempotencia);
 *   3. gols/xG/escanteios SEM direcao esperada -- muda a trajetoria de lances ja
 *      resolvidos, entao a simulacao diverge por caos;
 *   4. `visualIntegrity.teleports` NAO sobe: o re-planejamento acontece antes do
 *      primeiro quadro de voo, entao nao ha salto.
 *
 * GATE QUE DECIDE
 *   (1) com (2). Ecologia como rede em SEIS bases: xG <= 2,7, gols 1,8-3,0,
 *   escanteios 4-10.
 *
 * ARMADILHA REGISTRADA
 *   `_planPhysicalSegment` tambem serve passes, cruzamentos e deflexoes. Se a
 *   condicao nao exigir `kind === 'shot'` E alvo alem da linha E |dy| > 3,36,
 *   esta camada deforma passe. E o ramo da TRAVE (:6369) usa |dy| = 3,66 exato
 *   com alvo NA linha -- `alem > 0.05` o protege.
 */
const fs = require('fs');
const crypto = require('crypto');

const arg = (n, d) => {
  const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '='));
  return h ? h.slice(n.length + 3) : d;
};
const IN = process.argv[2], OUT = process.argv[3];
/* §OS-104 · desvio lateral abaixo deste limiar vira chute por cima; ALTO_Z e a
   altura do alvo alto, com o travessao a 2,44 m. */
const ALTO_ON = arg('porCima', '0') === '1';   /* OS-104: desligada por padrao */
const ALTO_LIMIAR = Number(arg('altoLimiar', '4.35'));
const ALTO_Z = Number(arg('altoZ', '3.55'));
if (!IN || !OUT) { console.error('uso: node patch_os92_chute_fora.js <entrada.html> <saida.html> [--altoLimiar= --altoZ=]'); process.exit(1); }
if (!(ALTO_LIMIAR >= 3.4 && ALTO_LIMIAR <= 8) || !(ALTO_Z >= 2.6 && ALTO_Z <= 6)) {
  console.error('ABORTA: parametro OS-104 fora de faixa'); process.exit(1);
}
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const CAMADA = [
'<script id="cds-os92-shot-out-geometry">',
'(function(root){',
"'use strict';",
'/* §OS-92 · o chute para fora sai por fora do poste.',
'',
'   Medido: 27 de 63 chutes "para fora" (42,9%) cruzavam a linha de fundo ENTRE',
'   as traves e por baixo do travessao, penetrando ate 3,39 m. O jogo narrava',
'   "manda pra fora" e a bola entrava.',
'',
'   Tres tentativas anteriores falharam. O setter em ball.x/ball.y respondeu por',
'   que: 99,8% das escritas durante um voo de chute vem do _ballTravel da camada',
'   cds-physics-timeline-581 (:15042), que voa um SEGMENTO fotografado em',
'   :15035 e ignora ball.target e ball.vx/vy. Corrigir o alvo depois do voo',
'   comecar nao muda nada. E :19710 ainda encurva a trajetoria, entao nem uma',
'   conta de reta no lugar certo bastaria.',
'',
'   Aqui a correcao nao calcula: ela LE as amostras realmente voadas, acha o',
'   cruzamento com a linha de fundo e re-planeja se ele cair dentro. */',
'const M = root && root.MatchSim;',
'if (!M || !M.prototype || M.prototype.__OS92__) return;',
'const P = M.prototype; P.__OS92__ = true;',
'/* NOTA MEDIDA: subir LIVRE_MAX de 1,80 para 4,50 nao muda NADA — a folga sai',
'   identica (min 0,13 | mediana 0,87 | max 2,57). O teto nunca vincula, porque a',
'   folga natural do alvo do motor ja fica abaixo dele. A compressao da dispersao',
'   e do motor, nao deste teto. Mantido em 1,80. */',
'const POSTE = 3.66, LIVRE_MIN = 0.32, LIVRE_MAX = 1.80, FWv = Number(root.FW) || 68;',
'/* §OS-104 · limiar de desvio lateral abaixo do qual o erro vira chute por cima,',
'   e a altura do alvo alto. Travessao a 2,44 m. */',
'/* §OS-104 MEDIDA E NAO PROMOVIDA. Ela funciona: `passaramPorCimaDoTravessao`',
'   sobe de 0 para 15 em 51 chutes (29,4%), na faixa real, e a garantia da OS-92',
'   sobrevive (zero cruzando entre as traves). MAS a bateria de seis bases',
'   reprovou o piso de gols: a base 2100000 deu 1,4583 contra o minimo de 1,8, e',
'   a media caiu para 1,8646. Fica desligada por padrao, com o numero que a',
'   derrubou. Para religar: --porCima=1. Antes de promover, descubra POR QUE o',
'   erro alto custa gol -- nenhum lance muda de desfecho, entao deveria ser caos,',
'   e 1,4583 e forte demais para caos. */',
'const ALTO_ON = ' + (ALTO_ON ? 'true' : 'false') + ';',
'const ALTO_LIMIAR = ' + ALTO_LIMIAR + ', ALTO_Z = ' + ALTO_Z + ';',
'',
'/* onde a trajetoria cruza x = gx, lido das amostras. null se nunca cruza. */',
'function cruzamento(samples, gx, dir) {',
'  if (!samples || samples.length < 2) return null;',
'  for (let i = 1; i < samples.length; i++) {',
'    const a = samples[i - 1], b = samples[i];',
'    const da = (a.x - gx) * dir, db = (b.x - gx) * dir;',
'    if (da < 0 && db >= 0) {',
'      const t = (db - da) !== 0 ? (0 - da) / (db - da) : 0;',
'      return { y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };',
'    }',
'  }',
'  return null;',
'}',
'',
'/* §OS-104 · O TETO QUE IMPEDIA O CHUTE POR CIMA.',
'   Medido: passar `z = 3,55` ao planejador devolvia `seg.target.z = 2,35`. Em',
'   `:19691` a camada R18.3 trava QUALQUER altura de alvo em 2,35 m, e um chute',
'   sem z explicito e travado em 1,74 m (`:19697`). O travessao esta a 2,44 m.',
'   O motor era fisicamente incapaz de mandar por cima do gol — duas vezes.',
'   A excecao abaixo e cirurgica: vale so enquanto a flag esta ligada, ou seja',
'   so no planejamento do erro alto. Todo o resto continua com o teto.',
'   NAO REMOVA O TETO GERAL: ele e o que impede passe e cruzamento de virarem',
'   bola aerea absurda. */',
'const oldZ = P._physicalTargetZ;',
'if (typeof oldZ === "function") {',
'  P._physicalTargetZ = function (actor, target, kind, passKind, meta) {',
'    if (this.__os104Bypass && kind === "shot" && target && Number.isFinite(target.z)) {',
'      return Math.max(0, Math.min(target.z, 6));',
'    }',
'    return oldZ.apply(this, arguments);',
'  };',
'}',
'const oldPlan = P._planPhysicalSegment;',
'if (typeof oldPlan !== "function") return;',
'P._planPhysicalSegment = function (origin, target, kind, passKind, speed, meta) {',
'  let seg = oldPlan.apply(this, arguments);',
'  try {',
'    if (kind !== "shot" || !target || !meta || !meta.actor) return seg;',
'    const tm = this.teams && this.teams[meta.actor.team], g = tm && tm.oppGoal;',
'    if (!g) return seg;',
'    const dir = tm.attackDir || (g.x > 52.5 ? 1 : -1);',
'    /* so o ramo de FORA: alvo alem da linha e lateralmente fora do alvo de gol.',
'       O motor codifica GOL com |dy| <= 3,35 e FORA com |dy| >= 3,4. A trave',
'       (:6369) usa |dy| = 3,66 mas com alvo NA linha, e sai por `alem`. */',
'    if ((target.x - g.x) * dir <= 0.05) return seg;',
'    const dAlvo = target.y - g.y;',
'    if (Math.abs(dAlvo) <= 3.36) return seg;',
'    const s = dAlvo >= 0 ? 1 : -1;',
'    /* §OS-104 · PARTE DOS ERROS VAI POR CIMA DO TRAVESSAO.',
'       Medido em TODAS as builds deste projeto: `passaramPorCimaDoTravessao` = 0.',
'       Nenhum chute do jogo inteiro passava por cima do gol — todo erro era',
'       lateral, com a folga ao poste comprimida entre 0,13 e 2,57 m (mediana',
'       0,87). E a imagem mais reconhecivel de chute ruim que existe, e ela nao',
'       existia. Os alvos de erro do motor sao puramente laterais e nenhum carrega',
'       `z`, entao a parabola nunca sobe o bastante.',
'       Criterio DETERMINISTICO, sem RNG novo -- o que mantem a bateria',
'       comparavel: erros que o motor JA sorteou como "quase acertou" (desvio',
'       lateral pequeno) viram "mandou por cima"; os de desvio grande seguem',
'       saindo pelo lado.',
'       ARMADILHA: se o alvo alto ficasse com y fora dos postes, a bola sairia',
'       alta E larga, que nao e "por cima do gol" — e so mais um erro lateral. O y',
'       e puxado para dentro da largura da meta. */',
'    if (ALTO_ON && Math.abs(dAlvo) < ALTO_LIMIAR) {',
'      const alto = { x: target.x, y: g.y + s * Math.min(Math.abs(dAlvo), 2.6), z: ALTO_Z };',
'      let segAlto;',
'      this.__os104Bypass = true;',
'      try { segAlto = oldPlan.call(this, origin, alto, kind, passKind, speed, meta); }',
'      finally { this.__os104Bypass = false; }',
'      const cA = cruzamento(segAlto.samples, g.x, dir);',
'      if (cA && cA.z > 2.44) {',
'        const bA = this.ball;',
'        if (bA && bA.target) bA.target = { x: alto.x, y: alto.y, z: ALTO_Z };',
'        if (this.stats && this.stats[meta.actor.team]) {',
'          const stA = this.stats[meta.actor.team];',
'          stA.__os104Alto = (stA.__os104Alto || 0) + 1;',
'        }',
'        return segAlto;',
'      }',
'    }',
'    const livre = Math.max(LIVRE_MIN, Math.min(Math.abs(dAlvo) - POSTE, LIVRE_MAX));',
'    const querY = g.y + s * (POSTE + livre);',
'    let alvo = target;',
'    /* duas iteracoes: re-planejar muda a curva, entao a primeira correcao erra',
'       um pouco e a segunda assenta. */',
'    for (let it = 0; it < 2; it++) {',
'      const c = cruzamento(seg.samples, g.x, dir);',
'      if (!c) break;',
'      if ((c.y - g.y) * s >= POSTE + LIVRE_MIN) break;   // ja sai por fora',
'      const ajuste = querY - c.y;',
'      if (!Number.isFinite(ajuste) || Math.abs(ajuste) < 1e-3) break;',
'      alvo = { x: alvo.x, y: Math.max(-24, Math.min(FWv + 24, alvo.y + ajuste)) };',
'      if (Number.isFinite(target.z)) alvo.z = target.z;',
'      seg = oldPlan.call(this, origin, alvo, kind, passKind, speed, meta);',
'      if (this.stats && this.stats[meta.actor.team]) {',
'        const st = this.stats[meta.actor.team];',
'        if (it === 0) st.__os92Fixed = (st.__os92Fixed || 0) + 1;',
'      }',
'    }',
'    /* mantem ball.target coerente com o voo real: a linha de trajetoria do',
'       render e o alvo de interceptacao do goleiro leem dali. */',
'    const b = this.ball;',
'    if (b && b.target && seg && seg.target && Math.abs(b.target.y - seg.target.y) > 1e-9) {',
'      b.target = { x: seg.target.x, y: seg.target.y, z: b.target.z };',
'    }',
'  } catch (_) {}',
'  return seg;',
'};',
'root.CDS_OS92 = Object.freeze({ version: "OS-92", feature: "SHOT_OUT_CROSSES_OUTSIDE_POST" });',
'})(typeof window!==\'undefined\'?window:globalThis);',
'</script>',
''
].join('\n');

edit('os92-camada',
  '<script id="cds-r1886-build-meta">',
  CAMADA + '<script id="cds-r1886-build-meta">');

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
