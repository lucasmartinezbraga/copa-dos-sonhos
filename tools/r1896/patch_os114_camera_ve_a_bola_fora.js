#!/usr/bin/env node
'use strict';
/*
 * OS-114 · A CAMERA PRECISA OLHAR PARA FORA DA LINHA
 * ==================================================
 *
 * O DONO, depois de testar a R18.98 candidata: "nao resolveu nada",
 * "testei aqui e nao senti mudanca".
 *
 * ELE ESTAVA CERTO, E O ERRO FOI MEU. A OS-112 fez a bola sair de fato -- eu
 * medi 91 quadros fora do campo e ate 3,1 m alem da linha, e parei ali. Nunca
 * abri o jogo para OLHAR. Abri agora, num Chromium, com o gancho de auditoria
 * `__ballProbe` que ja existia no desenho da bola:
 *
 *     bola em y = 70,88 m  ->  desenhada em by = 534,7
 *     espaco logico do palco 2,5D: 500 px de altura
 *
 * A bola sai, e o palco a desenha 35 px ABAIXO da borda inferior do quadro. A
 * linha lateral ja fica na propria borda; tudo que passa dela esta fora da
 * tela. O jogador nunca ve nada.
 *
 * E NAO E CONSERTAVEL POR CAMADA ANEXADA. O culpado e o clamp da camera, no
 * IIFE da interface (:14103):
 *
 *     const cpx = Math.max(vw / 2, Math.min(CW - vw / 2, camX));
 *     const cpy = Math.max(vh / 2, Math.min(CH - vh / 2, camY));
 *
 * `camX`/`camY` sao `let` internos do modulo -- invisiveis de fora, exatamente
 * como `celebration`, `slowmo` e `shotFx` (HANDOFF §3.4). A camera SEGUE a bola
 * para fora e o clamp a impede de sair do retangulo do campo. Por isso este
 * patch edita a linha, em vez de envolver alguma funcao.
 *
 * A CORRECAO
 *   Enquanto a bola estiver fora das linhas, o clamp ganha folga proporcional a
 *   quanto ela saiu -- ate 64 px. A camera passa a mostrar a faixa de fora, que
 *   e onde a bola esta. Quando ela volta, a folga volta a zero sozinha.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR
 *   P1. numa foto de lateral, a bola aparece do lado de fora da linha. Hoje
 *       nao aparece em foto nenhuma;
 *   P2. `impressaoPorJogo` IDENTICA. Isto vive dentro de `paintField`, que nem
 *       sequer roda no Node -- se mudar, algo esta muito errado.
 *
 * GATE QUE DECIDE
 *   **A FOTO.** Nao a bateria. Esta rodada nasceu de eu ter confiado num numero
 *   e nao ter olhado a tela; ela nao termina sem uma imagem do lance.
 *
 * ARMADILHA REGISTRADA
 *   A1. `sim` e o `let` do modulo da interface e pode ser null entre partidas.
 *       Tudo aqui e guardado, e a folga cai para zero em qualquer duvida.
 *   A2. folga demais faz a camera "pular" no instante da saida. Ela e
 *       proporcional a distancia para fora e tem teto.
 */
const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
const flag = (n, p) => { const a = args.find(v => v.startsWith('--' + n + '=')); return a === undefined ? p : Number(a.split('=')[1]); };
const pos = args.filter(a => !a.startsWith('--'));
const IN = pos[0], OUT = pos[1];
if (!IN || !OUT) { console.error('uso: node patch_os114_camera_ve_a_bola_fora.js <entrada> <saida> [--folga=64]'); process.exit(1); }
const FOLGA = flag('folga', 64);
console.log('  OS-114  folga=' + FOLGA + ' px');
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const ANTES = [
  '    const cpx = Math.max(vw / 2, Math.min(CW - vw / 2, camX));',
  '    const cpy = Math.max(vh / 2, Math.min(CH - vh / 2, camY));'
].join('\n');

const DEPOIS = [
  '    /* §OS-114 · a camera precisa olhar para FORA da linha.',
  '       MEDIDO com `__ballProbe` num Chromium: a bola a 70,88 m (2,88 m alem',
  '       da linha lateral) e desenhada em by = 534,7 num palco de 500 px de',
  '       altura -- 35 px abaixo da borda. A OS-112 faz a bola sair de verdade e',
  '       este clamp a mantinha fora da tela, entao o lance nao existia para',
  '       quem joga. Enquanto ela estiver fora, o clamp ganha folga. */',
  '    let _os114 = 0;',
  '    try {',
  '      const _b = sim && sim.ball;',
  '      if (_b) {',
  '        const _fy = _b.y > 68 ? _b.y - 68 : (_b.y < 0 ? -_b.y : 0);',
  '        const _fx = _b.x > 105 ? _b.x - 105 : (_b.x < 0 ? -_b.x : 0);',
  '        const _f = Math.max(_fx, _fy);',
  '        if (_f > 0.05) _os114 = Math.min(' + FOLGA + ', 20 + _f * 18);',
  '      }',
  '    } catch (_) { _os114 = 0; }',
  '    const cpx = Math.max(vw / 2 - _os114, Math.min(CW - vw / 2 + _os114, camX));',
  '    const cpy = Math.max(vh / 2 - _os114, Math.min(CH - vh / 2 + _os114, camY));'
].join('\n');

edit('os114-clamp-da-camera', ANTES, DEPOIS);

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
