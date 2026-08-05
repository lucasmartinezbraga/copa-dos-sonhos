#!/usr/bin/env node
'use strict';
/*
 * OS-112 · O LATERAL: A BOLA SAI DE FATO, E ALGUEM SE OFERECE
 * ===========================================================
 *
 * DUAS OBSERVACOES DO DONO, jogando a R18.97
 *   "Mostre a bola realmente saindo pra fora no lateral."
 *   "Os jogadores nao se aproximam pra receber o lateral, falta isso tambem."
 *
 * O CENSO (diag_os112, 8 partidas, 68 laterais, build R18.97)
 *
 *   A BOLA SAI?
 *     quanto ela passa da linha no apito ......... mediana 0,92 m, max 1,35 m
 *     QUADROS COM A BOLA FORA DO CAMPO .......... **0** -- min, mediana e max
 *     laterais em que ela passou de 0,5 m ....... 67 de 68
 *     do cruzamento ao ponto de reinicio ........ mediana 1,98 m
 *
 *   Ou seja: ela cruza a linha e no MESMO quadro ja esta de volta. O jogador
 *   nunca ve a bola sair. `:17145` e `:16691` chamam `_ballOut` no instante
 *   exato em que `b.y < 0 || b.y > FW`, e `_ballOut` (:7197) congela a bola;
 *   o reinicio a recoloca em `clamp(b.y,1,FW-1)`, um metro DENTRO do campo.
 *
 *   ALGUEM SE OFERECE?
 *     companheiros a menos de  8 m do ponto ..... **0,088**
 *     companheiros a menos de 12 m .............. 0,162
 *     companheiros a menos de 18 m .............. 0,647
 *     adversarios  a menos de  8 m .............. 0,838
 *
 *   Em ~91% dos laterais NAO HA UM UNICO companheiro a menos de 8 m, e ha mais
 *   adversario perto do que companheiro. O cobrador nao tem para quem jogar.
 *   Nao existe coreografia de lateral em lugar nenhum: a OS-100 (:21556) trata
 *   o COBRADOR e mais ninguem.
 *
 * AS DUAS EDICOES
 *
 *   E1 · A BOLA SAI (`--saida`) · APRESENTACAO PURA, por construcao.
 *        Guarda o ponto em que ela cruzou, deixa a bola seguir para fora
 *        durante a bola morta -- desacelerando, ate um teto de 2,2 m alem da
 *        linha -- e a DEVOLVE ao ponto guardado no quadro em que o reinicio vai
 *        acontecer, antes do nucleo rodar. Tudo que le a posicao da bola no
 *        reinicio ve exatamente o que via antes.
 *        **O teste e a `impressaoPorJogo`**: se ela nao mudar, esta camada
 *        provadamente nao tocou a simulacao (HANDOFF §3.1).
 *
 *   E2 · ALGUEM SE OFERECE (`--apoio`) · muda a simulacao, e a bateria decide.
 *        Tres companheiros recebem posto perto do ponto -- um curto a frente,
 *        um de apoio atras, um em profundidade pela linha -- e dois adversarios
 *        recebem posto marcando os dois primeiros. Ninguem e teleportado: os
 *        postos viram `__spTarget` e a caminhada e a mesma maquina da R15
 *        (:18270), segurada pelo pino da OS-107.
 *        Os marcadores nao sao enfeite: sem eles o lateral vira passe livre e a
 *        posse do jogo inteiro muda de patamar.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   P1. quadros com a bola fora do campo: SOBE de zero;
 *   P2. `impressaoPorJogo` com `--apoio=0`: IDENTICA a da R18.97;
 *   P3. companheiros a menos de 8 m do ponto: SOBE;
 *   P4. passes: SOBE -- o cobrador passa a ter opcao;
 *   P5. gols e xG: sem direcao registrada. Eu NAO sei para onde vao, e dizer
 *       que sei seria inventar. A bateria decide.
 *
 * GATE QUE DECIDE
 *   Para a E1, a impressao. Para a E2, os tres gates nas seis bases, 48
 *   partidas -- e com atencao redobrada: a R18.97 esta a 0,0125 do piso de gols.
 *
 * ARMADILHAS REGISTRADAS ANTES
 *   A1. o ponto do lateral e lido de `b.x/b.y` DENTRO do `pendingRestart`
 *       (:7213), nao no instante da saida. Mover a bola sem devolve-la mudaria
 *       o ponto de cobranca -- por isso a devolucao acontece no quadro do
 *       reinicio, antes do nucleo.
 *   A2. a OS-100 (:21556) guarda o ponto no instante da saida e pina o cobrador
 *       nele. Nao mexer no cobrador: ele ja funciona, e brigar com essa maquina
 *       reabre o defeito que a OS-100 consertou.
 *   A3. alongar `dead` no lateral e caro: sao ~8,5 laterais por partida. O teto
 *       aqui e 3,0 s, e so sobe se alguem precisar andar.
 */
const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
const flag = (nome, pad) => {
  const a = args.find(v => v.startsWith('--' + nome + '='));
  return a === undefined ? pad : Number(a.split('=')[1]);
};
const pos = args.filter(a => !a.startsWith('--'));
const IN = pos[0], OUT = pos[1];
if (!IN || !OUT) { console.error('uso: node patch_os112_lateral_saida_e_apoio.js <entrada> <saida> [--saida=1] [--apoio=1] [--marcadores=2]'); process.exit(1); }
const SAIDA = flag('saida', 1) ? 1 : 0;
const APOIO = flag('apoio', 1) ? 1 : 0;
const MARCADORES = Math.max(0, Math.min(4, flag('marcadores', 2)));
console.log('  OS-112  saida=' + SAIDA + '  apoio=' + APOIO + '  marcadores=' + MARCADORES);
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const CAMADA = [
'<script id="cds-os112-lateral-saida-e-apoio">',
'(function(root){',
"'use strict';",
'/* §OS-112 · o lateral: a bola sai de fato, e alguem se oferece.',
'',
'   MEDIDO (diag_os112, 68 laterais na R18.97):',
'     quadros com a bola FORA do campo ......... 0 (min, mediana e max)',
'     companheiros a menos de 8 m do ponto ..... 0,088',
'     adversarios a menos de 8 m do ponto ...... 0,838',
'',
'   A bola cruza a linha e no mesmo quadro ja esta de volta, porque :17145',
'   chama `_ballOut` no instante exato do cruzamento e o reinicio a recoloca',
'   um metro dentro do campo. E nao existe coreografia de lateral: a OS-100',
'   trata o cobrador e mais ninguem. */',
'const M = root && root.MatchSim;',
'if (!M || !M.prototype || M.prototype.__OS112__) return;',
'const P = M.prototype; P.__OS112__ = true;',
'const FLv = Number(root.FL) || 105, FWv = Number(root.FW) || 68;',
'',
'const SAIDA_LIGADA = ' + (SAIDA ? 'true' : 'false') + ';',
'const APOIO_LIGADO = ' + (APOIO ? 'true' : 'false') + ';',
'const N_MARCADORES = ' + MARCADORES + ';',
'const FORA_MAX = 2.2;     // m alem da linha -- o quanto a bola chega a sair',
'const FORA_FREIO = 0.86;  // por quadro: ela sai desacelerando, nao em linha',
'const TETO_DEAD = 3.0;    // s -- armadilha A3: sao ~8,5 laterais por partida',
'const WALK = 0.92, VEL = 6.5;',
'',
'function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : (d || 0); }',
'function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }',
'function dd(a, b, c, d) { return Math.hypot(a - c, b - d); }',
'',
'/* ---------------------------------------------- E2 · alguem se oferece ---- */',
'function armarApoio(sim, sx, sy, cobrador) {',
'  if (!APOIO_LIGADO || !cobrador) return 0;',
'  const tm = sim.teams[cobrador.team], adv = sim.teams[1 - cobrador.team];',
'  if (!tm || !adv) return 0;',
'  const dir = num(tm.attackDir, 1) >= 0 ? 1 : -1;',
'  const dentro = sy < FWv / 2 ? 1 : -1;   // para onde fica o campo',
'  const posto = (dx, dy) => ({ x: cl(sx + dir * dx, 1.5, FLv - 1.5),',
'                               y: cl(sy + dentro * dy, 1.5, FWv - 1.5) });',
'  /* curto a frente, apoio atras, profundidade pela linha -- o desenho basico',
'     de um lateral de verdade. */',
'  const postos = [posto(4.0, 5.5), posto(-5.0, 7.0), posto(11.0, 3.0)];',
'  const livres = (tm.players || []).filter(function (p) {',
'    return p && !p.red && !p.isGK && p !== cobrador && !p.__spTarget;',
'  });',
'  let longe = 0;',
'  const escolhidos = [];',
'  for (let i = 0; i < postos.length; i++) {',
'    let melhor = null, md = Infinity;',
'    for (let j = 0; j < livres.length; j++) {',
'      const p = livres[j];',
'      if (escolhidos.indexOf(p) >= 0) continue;',
'      const d = dd(p.x, p.y, postos[i].x, postos[i].y);',
'      if (d < md) { md = d; melhor = p; }',
'    }',
'    if (!melhor) break;',
'    escolhidos.push(melhor);',
'    melhor.__spTarget = { x: postos[i].x, y: postos[i].y };',
'    if (md > longe) longe = md;',
'  }',
'  /* Os marcadores. Sem eles o lateral vira passe livre. */',
'  const marcaveis = (adv.players || []).filter(function (p) {',
'    return p && !p.red && !p.isGK && !p.__spTarget && !p._setPieceRole;',
'  });',
'  const marcados = [];',
'  for (let i = 0; i < Math.min(N_MARCADORES, escolhidos.length); i++) {',
'    const alvo = escolhidos[i];',
'    let melhor = null, md = Infinity;',
'    for (let j = 0; j < marcaveis.length; j++) {',
'      const p = marcaveis[j];',
'      if (marcados.indexOf(p) >= 0) continue;',
'      const d = dd(p.x, p.y, alvo.__spTarget.x, alvo.__spTarget.y);',
'      if (d < md) { md = d; melhor = p; }',
'    }',
'    if (!melhor) break;',
'    marcados.push(melhor);',
'    melhor.__spTarget = {',
'      x: cl(alvo.__spTarget.x - dir * 1.3, 1.5, FLv - 1.5),',
'      y: cl(alvo.__spTarget.y - dentro * 0.9, 1.5, FWv - 1.5)',
'    };',
'    if (md > longe) longe = md;',
'  }',
'  if (longe > 0) {',
'    const preciso = 0.5 + longe / (VEL * WALK);',
'    sim.dead = Math.max(num(sim.dead), Math.min(TETO_DEAD, preciso));',
'  }',
'  /* entrega os postos ao pino da OS-107, se ele existir nesta build */',
'  const todos = escolhidos.concat(marcados).map(function (p) {',
'    return { p: p, x: p.__spTarget.x, y: p.__spTarget.y };',
'  });',
'  if (todos.length) {',
'    const st = sim.__os107;',
'    if (st && st.postos) { st.postos = st.postos.concat(todos); }',
'    else sim.__os107 = { postos: todos, quadros: 0 };',
'  }',
'  return todos.length;',
'}',
'',
'/* -------------------------------------------------------- os ganchos ----- */',
'const oldOut = P._ballOut;',
'if (typeof oldOut === "function") {',
'  P._ballOut = function () {',
'    const b = this.ball;',
'    const ehLateral = !(num(b.x) <= 0 || num(b.x) >= FLv);',
'    const x0 = num(b.x), y0 = num(b.y);',
'    const vx0 = num(b.vx), vy0 = num(b.vy);',
'    const r = oldOut.apply(this, arguments);',
'    try {',
'      if (!ehLateral) return r;',
'      /* Quem a maquina de bola parada elegeu para cobrar (OS-100/:21556).',
'         Armadilha A2: nao mexer nele, so ler. */',
'      let cobrador = null, melhor = Infinity;',
'      for (const tm of this.teams) for (const p of tm.players) {',
'        if (!p || p.red || !p.__spTarget) continue;',
'        const d = dd(p.__spTarget.x, p.__spTarget.y, x0, y0);',
'        if (d < melhor) { melhor = d; cobrador = p; }',
'      }',
'      if (melhor > 3.5) cobrador = null;',
'      armarApoio(this, x0, y0, cobrador);',
'      /* §OS-115 · so arma o passeio se a bola FICOU morta. Se o reinicio ja',
'         aconteceu, devolver a bola no quadro seguinte a arranca de onde o',
'         jogo ja a colocou -- e isso e teleporte de bola no meio da partida. */',
'      if (SAIDA_LIGADA && num(this.dead) > 0.03) {',
'        /* direcao de saida: a velocidade que ela trazia, ou para fora do campo */',
'        let ux = vx0, uy = vy0;',
'        const L = Math.hypot(ux, uy);',
'        if (L < 0.5) { ux = 0; uy = (y0 < FWv / 2) ? -1 : 1; }',
'        else { ux /= L; uy /= L; }',
'        /* O ESTADO QUE A SIMULACAO ESPERA. Medido: na base, `quadros com a',
'           bola fora` e ZERO -- alguma camada ja a traz para dentro dentro do',
'           proprio `_ballOut`. Devolver a bola ao ponto do CRUZAMENTO seria',
'           deixa-la fora, que e um estado que o motor nunca ve. O que se',
'           devolve a cada quadro e o estado logo APOS a chamada; o ponto do',
'           cruzamento serve so como origem do passeio visual. */',
'        const bb = this.ball;',
'        this.__os112 = {',
'          cx: x0, cy: y0, ux: ux, uy: uy,',
'          passo: Math.min(0.55, Math.max(0.12, L / 30)), andou: 0,',
'          est: { x: num(bb.x), y: num(bb.y), z: num(bb.z),',
'                 vx: num(bb.vx), vy: num(bb.vy), vz: num(bb.vz),',
'                 traveling: !!bb.traveling, owner: bb.owner || null }',
'        };',
'      }',
'    } catch (_) {}',
'    return r;',
'  };',
'}',
'',
'const oldStep = P.step;',
'P.step = function (dt) {',
'  /* ARMADILHA A1, e ela e maior do que eu tinha escrito. Eu previ que levar a',
'     bola para fora seria apresentacao pura e MEDI QUE NAO ERA: a impressao por',
'     jogo mudou. O motivo e que `_movePlayers` roda durante a bola morta',
'     (:4850) e le a posicao da bola -- entao a bola passeando para fora movia',
'     os jogadores, e o reinicio acontecia com o time em outro lugar.',
'',
'     A correcao e devolver a bola ao ponto de saida no INICIO de todo quadro,',
'     antes do nucleo, e so escreve-la para fora DEPOIS que o nucleo terminou.',
'     Assim ninguem dentro da simulacao ve a bola deslocada -- so o render, que',
'     acontece fora do `step`. E o que torna esta edicao verificavel pela',
'     impressao (HANDOFF §3.1). */',
'  const s0 = this.__os112;',
'  if (s0) {',
'    const b = this.ball, e = s0.est;',
'    b.x = e.x; b.y = e.y; b.z = e.z;',
'    b.vx = e.vx; b.vy = e.vy; b.vz = e.vz;',
'    b.traveling = e.traveling; b.owner = e.owner;',
'  }',
'  const r = oldStep.apply(this, arguments);',
'  try {',
'    const s = this.__os112;',
'    if (s) {',
'      if (!(num(this.dead) > 0)) {',
'        /* reiniciou neste quadro: o nucleo ja colocou a bola onde ela deve',
'           ficar, e nao se toca mais nela */',
'        this.__os112 = null;',
'      } else {',
'        /* ela sai desacelerando, e para no teto. Isto e posicao de EXIBICAO:',
'           o proximo quadro a devolve antes de qualquer coisa ler. */',
'        s.andou = Math.min(FORA_MAX, s.andou + s.passo);',
'        s.passo *= FORA_FREIO;',
'        const b = this.ball;',
'        b.x = s.cx + s.ux * s.andou;',
'        b.y = s.cy + s.uy * s.andou;',
'        b.traveling = false; b.owner = null;',
'      }',
'    }',
'  } catch (_) {}',
'  return r;',
'};',
'',
'root.CDS_OS112 = Object.freeze({ version: "OS-112", feature: "THROWIN_BALL_GOES_OUT_AND_SUPPORT" });',
'})(typeof window!==\'undefined\'?window:globalThis);',
'</script>',
''
].join('\n');

edit('os112-camada',
  '<script id="cds-r1886-build-meta">',
  CAMADA + '<script id="cds-r1886-build-meta">');

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
