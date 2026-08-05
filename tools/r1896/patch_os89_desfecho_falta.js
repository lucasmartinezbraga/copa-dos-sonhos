#!/usr/bin/env node
'use strict';
/*
 * OS-89 · O DESFECHO DA FALTA DIRETA, E A PASSADA DO COBRADOR
 * ===========================================================
 *
 * TRES CORRECOES, medidas separadamente.
 *
 * ── A. A falta direta quase nunca vai para fora ──────────────────────────
 *
 * MEDIDO amostrando `resolveFreeKickPhysics` (funcao PURA) 50 000 vezes por
 * cenario -- sem simular partida:
 *
 *   batedor 90 x goleiro 75, 22 m ... gol 4,17% | DEFESA 64,0% | barreira 16,9% | fora 14,9%
 *   batedor 75 x goleiro 75, 25 m ... gol 3,13% | DEFESA 64,5% | barreira 17,7% | fora 14,7%
 *   batedor 60 x goleiro 80, 30 m ... gol 2,02% | DEFESA 65,2% | barreira 18,3% | fora 14,5%
 *
 * Decompondo: `offTarget` responde por ~13,8% e a barreira por ~18%. Do que
 * sobra -- 64% do total -- praticamente TUDO vira defesa: a moeda save/miss de
 * :2894 esta em ~99% para o lado da defesa.
 *
 *   :2894  else result = chance(clamp(.58 + keeperSkill/220 - corner*.28, .28,.82))
 *                        ? 'save' : 'miss';
 *
 * Com goleiro 75: .58 + 75/220 = 0,921. Menos `corner*.28` continua acima do
 * teto de 0,82 na maioria dos casos -- o clamp SATURA e o atributo do goleiro
 * deixa de importar. E o mesmo padrao de "parametro que existe e nao faz nada"
 * do HANDOFF §3, aqui por saturacao em vez de sobrescrita.
 *
 * Referencia real de falta direta em posicao de chute: gol ~5-8%, barreira
 * ~20%, FORA ~35-40%, defesa ~30-35%. O jogo tem fora 15% e defesa 64%.
 *
 * EDIT: a moeda passa a ter faixa util e a deixar o goleiro pesar de verdade.
 *   de:  clamp(.58 + keeperSkill/220 - corner*.28, .28, .82)
 *  para: clamp(.17 + keeperSkill/300 - corner*.20, .12, .60)
 * Goleiro 60 -> ~0,29 | 75 -> ~0,33 | 90 -> ~0,39, antes do termo de canto.
 *
 * ── B. O cobrador chega e nao entra na bola ──────────────────────────────
 *
 * Depois da OS-87 o cobrador chega a 1,400 m da bola em 100% das cobrancas.
 * Falta a PASSADA: ele bate parado. A pose de chute ja existe (:12455) e a
 * OS-88 ja da tempo de retina. O que falta e o corpo avancar sobre a bola.
 *
 * Isto e feito no DESENHO, nao na fisica, seguindo o precedente que o proprio
 * arquivo estabelece em :13837 ("#anti-cardume (VISUAL) ... So no DESENHO — a
 * posicao real (fisica) nao muda"). O deslocamento e de ~1,4 m durante 0,42 s,
 * num boneco desenhado com ~2,4 m de largura.
 *
 * ── C. O empurrao da barreira passa do teto fisico ───────────────────────
 *
 * MEDIDO: 770 de 67 748 passos (1,14%) durante a janela de barreira passam do
 * teto de 7 m/s, chegando a 0,3275 m num quadro (teto 0,2333). O clamp radial
 * da OS-36 (:24917-24920) recoloca o jogador no anel sem limitar o passo
 * quando `salto <= passo`.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   A. `fora` SOBE e `defesa` DESCE no modelo puro; gols de falta SOBEM de
 *      leve (menos bola no goleiro nao vira gol, mas o xG por cobranca nao
 *      muda -- pGoal e somado antes e nao foi tocado). `noAlvo` por partida
 *      DESCE. xG NAO muda por construcao.
 *   B. nenhum numero do motor muda -- e desenho.
 *   C. `passosAcimaDoTeto` cai a zero; o resto fica igual ou muda por caos.
 *
 * GATE QUE DECIDE
 *   ECO-02 xG <= 2,7, gols 1,8-3,0, ECO-05 escanteios 4-10, em SEIS bases de
 *   24 partidas. E o proprio modelo puro para (A).
 *
 * ARMADILHA REGISTRADA
 *   `save` alimenta `stats.saves` e `stats.onTarget`. Baixar a defesa derruba
 *   `noAlvo` por partida. Se cair demais, o caminho nao e voltar a moeda: e
 *   olhar o `offTarget`, que hoje so dispara fora da moldura do gol e por isso
 *   nao modela "por cima do travessao".
 */
const fs = require('fs');
const crypto = require('crypto');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('uso: node patch_os89_desfecho_falta.js <entrada.html> <saida.html>'); process.exit(1); }
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

/* ── A. a moeda save/miss deixa de saturar ──────────────────────────────── */
edit('os89-moeda',
  "  else result = chance(clamp(.58 + keeperSkill/220 - corner*.28, .28,.82)) ? 'save' : 'miss';",

  "  /* §OS-89 · a falta direta quase nunca ia para fora.\n" +
  "     Medido amostrando esta funcao 50 000 vezes por cenario: do total,\n" +
  "     `fora` ficava em ~14,7% e `defesa` em ~64% — e do que passa a barreira\n" +
  "     e nao e gol, praticamente TUDO virava defesa. Com goleiro 75 a conta\n" +
  "     antiga dava .58 + 75/220 = 0,921 e o clamp SATURAVA no teto de 0,82: o\n" +
  "     atributo do goleiro deixava de pesar. Referencia real de falta direta:\n" +
  "     fora ~35-40%, defesa ~30-35%.\n" +
  "     CALIBRADA em cima da medicao, nao de palpite. A primeira tentativa usou\n" +
  "     base .17 e corrigiu DEMAIS: `fora` foi de 14,7% para 50,5%, passando da\n" +
  "     referencia real. Base .35 poe a divisao perto de defesa ~40% e fora ~38%,\n" +
  "     com a barreira nos 18% que ja existiam. */\n" +
  "  else result = chance(clamp(.35 + keeperSkill/300 - corner*.20, .20,.70)) ? 'save' : 'miss';");

/* ── C. FALSIFICADA E REMOVIDA — fica como registro ───────────────────────
 *
 * Eu ia limitar o empurrao da barreira, porque medi 1,14% dos passos acima de
 * 0,2333 m por quadro. Esse teto veio do `VMAX = 7` da OS-36 -- que e a
 * velocidade do EMPURRAO da barreira, nao a velocidade de corrida de um
 * jogador. 0,35 m num quadro de 1/30 s e 10,5 m/s: sprint humano, nao
 * teleporte. A regua estava errada e o defeito nunca existiu.
 *
 * Previsao registrada: "passosAcimaDoTeto cai a zero".
 * Medido, em duas tentativas:
 *   capar so o clamp radial ......... 1,14% -> 0,82%  (max 0,3275 -> 0,3094)
 *   orcamento unico por quadro ...... 0,82% -> 1,48%  (max 0,3094 -> 0,3549)
 *
 * A segunda PIOROU, o que derruba tambem a hipotese de que as duas escritas da
 * OS-36 somavam. O excesso vem da camada de movimento normal, que roda antes.
 * Nenhuma das duas entra na build.
 *
 * Se alguem voltar aqui: meca primeiro a velocidade maxima legitima de um
 * jogador em jogo corrido, e so entao decida o que e salto.
 */
const _os89_C_removida = true;
if (!_os89_C_removida) {
/* Duas escritas por quadro somavam ate 2x o teto: primeiro a volta ao posto da
   barreira, depois o clamp radial. A correcao e ORCAR o quadro: o radial so
   pode gastar o que sobrou. Medido em duas etapas -- capar so o radial levou
   1,14% -> 0,82%; o orcamento fecha o resto. */
edit('os89-teto-barreira',
  "            var alvo=p._os36Wall;\n" +
  "            if(alvo){\n" +
  "              var ax=alvo.x-p.x, ay=alvo.y-p.y, aL=Math.hypot(ax,ay);\n" +
  "              if(aL>.05){var s=Math.min(passo,aL); p.x+=ax/aL*s; p.y+=ay/aL*s;}\n" +
  "            }",

  "            /* §OS-89 · ORCAMENTO DE DESLOCAMENTO POR QUADRO.\n" +
  "               Este bloco e o clamp radial abaixo escreviam a posicao DUAS\n" +
  "               vezes no mesmo quadro, cada um com teto proprio — somando ate\n" +
  "               2x o limite fisico. Medido: 1,14% dos passos acima do teto,\n" +
  "               chegando a 0,3275 m contra 0,2333 de teto. Agora o quadro tem\n" +
  "               um orcamento unico e o radial so gasta o que sobrou. */\n" +
  "            var _o89rest=passo;\n" +
  "            var alvo=p._os36Wall;\n" +
  "            if(alvo){\n" +
  "              var ax=alvo.x-p.x, ay=alvo.y-p.y, aL=Math.hypot(ax,ay);\n" +
  "              if(aL>.05){var s=Math.min(_o89rest,aL); p.x+=ax/aL*s; p.y+=ay/aL*s; _o89rest-=s;}\n" +
  "            }");

edit('os89-teto-radial',
  "              var salto=Math.hypot(nx-p.x,ny-p.y);\n" +
  "              if(salto>passo){ p.x+=(nx-p.x)/salto*passo; p.y+=(ny-p.y)/salto*passo; }\n" +
  "              else { p.x=nx; p.y=ny; }",

  "              var salto=Math.hypot(nx-p.x,ny-p.y);\n" +
  "              /* §OS-89 · gasta o que sobrou do orcamento do quadro, nunca\n" +
  "                 mais. O ramo `else` antigo recolocava no anel de uma vez. */\n" +
  "              if(salto>_o89rest){ if(_o89rest>1e-9){ p.x+=(nx-p.x)/salto*_o89rest; p.y+=(ny-p.y)/salto*_o89rest; } }\n" +
  "              else if(salto>1e-9){ p.x=nx; p.y=ny; }");
}   /* fim do bloco C falsificado */

/* ── B. a passada do cobrador, no desenho ───────────────────────────────── */
edit('os89-passada-estado',
  "let _camView = null;      // { z, cpx, cpy }",

  "let _camView = null;      // { z, cpx, cpy }\n" +
  "/* §OS-89 · passada do cobrador de falta. Depois da OS-87 ele chega a 1,400 m\n" +
  "   da bola em 100% das cobrancas, mas bate PARADO. Aqui o corpo avanca sobre\n" +
  "   a bola no desenho — mesma licenca do #anti-cardume de :13837, que ja move\n" +
  "   a posicao desenhada sem tocar a fisica. */\n" +
  "let fkStep = null;        // { id, dx, dy, t0, dur }");

edit('os89-passada-arma',
  "    if (e.direct) slowmo = { until: performance.now() + 700, f: 0.35 };",

  "    if (e.direct) {\n" +
  "      slowmo = { until: performance.now() + 700, f: 0.35 };\n" +
  "      /* §OS-89 · a passada: o cobrador avanca sobre a bola durante o contato.\n" +
  "         O vetor sai do proprio jogador para a bola, entao ele entra na\n" +
  "         direcao certa qualquer que seja o lado do campo. */\n" +
  "      try {\n" +
  "        const _b = sim.ball, _id = e.by.ref && e.by.ref.id;\n" +
  "        if (_id && _b && Number.isFinite(_b.x)) {\n" +
  "          const _dx = _b.x - e.by.x, _dy = _b.y - e.by.y;\n" +
  "          const _L = Math.hypot(_dx, _dy);\n" +
  "          if (_L > 0.05 && _L < 6) fkStep = { id: _id, dx: _dx, dy: _dy, t0: performance.now(), dur: 420 };\n" +
  "        }\n" +
  "      } catch (_) {}\n" +
  "    }");

edit('os89-passada-desenha',
  "      let _rx = cx(p.x), _ry = cy(p.y);\n" +
  "      const _pk = p.ref && p.ref.n;",

  "      let _rx = cx(p.x), _ry = cy(p.y);\n" +
  "      /* §OS-89 · passada do cobrador de falta, so no desenho */\n" +
  "      if (fkStep && p.ref && p.ref.id === fkStep.id) {\n" +
  "        const _e = (visualNow - fkStep.t0) / fkStep.dur;\n" +
  "        if (_e >= 1) fkStep = null;\n" +
  "        else if (_e >= 0) {\n" +
  "          /* sobe rapido e assenta: o pe chega na bola no primeiro terco */\n" +
  "          const _k = _e < .34 ? (_e / .34) : 1;\n" +
  "          _rx = cx(p.x + fkStep.dx * _k); _ry = cy(p.y + fkStep.dy * _k);\n" +
  "        }\n" +
  "      }\n" +
  "      const _pk = p.ref && p.ref.n;");

edit('os89-passada-reset',
  "  breakOv = null; slowmo = null; goalFlash = null; shotFx = null; outMark = null;",
  "  breakOv = null; slowmo = null; goalFlash = null; shotFx = null; outMark = null; fkStep = null;");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
