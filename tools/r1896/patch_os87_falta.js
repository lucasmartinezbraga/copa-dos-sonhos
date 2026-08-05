#!/usr/bin/env node
'use strict';
/*
 * OS-87 · A FALTA PASSA A SER COBRADA POR QUEM A COBRA
 * ====================================================
 *
 * OBSERVACAO DO DONO
 *   "Preciso que melhore completamente a parte das faltas, se possivel recrie
 *    completamente a batida de falta."
 *
 * MEDIDO ANTES (R18.87, 8 partidas, 28 cobrancas diretas)
 *
 *   faltas por partida ....................... 12,00
 *   viram cerimonia de cobranca .............. 6,50
 *   rotinas .................................. 28 direta, 24 cruzada, 0 curta
 *   cena dedicada `fk_scene` emitida ......... 0
 *
 *   COBRADOR -> BOLA no instante do chute
 *     mediana 9,162 m | p90 17,729 m | max 22,385 m | min 0
 *
 *   espera do apito ate o chute
 *     min 1,7 | mediana 1,7 | max 1,7    <- constante, sem variacao nenhuma
 *
 *   barreira 3 a 4 | adversario mais proximo 9,04 a 9,51 m (regra cumprida)
 *   bola sai do ponto: 0,00 m em todas   (isto esta certo)
 *   quadros de invasao contida: 5753 em 52 faltas = 111 por falta
 *   desfechos: 15 defesa, 6 barreira, 5 fora, 2 gol
 *
 * O DEFEITO, com arquivo:linha
 *   A metade das cobrancas e chutada por NINGUEM: a bola sai do ponto enquanto
 *   o cobrador esta a 9 m dela. E o padrao do HANDOFF §4 -- o desfecho existe
 *   na estatistica e nao tem consequencia fisica.
 *
 *   A causa nao e a falta de maquina: a camada R18.35 (:21555-21574) JA faz o
 *   cobrador caminhar ate a bola, com `armTaker`, e funciona no lateral e no
 *   escanteio. O que ela faz de errado e IDENTIFICAR o cobrador:
 *
 *     :21565  // batedor = jogador do time agora mais proximo do ponto
 *             //          (o nucleo o pos la)
 *     :21567  for (...) { var dd = dist(p.x,p.y,spotX,spotY); if (dd<cd) {...} }
 *
 *   A premissa "o nucleo o pos la" so vale para o ramo `crossed`, que teleporta
 *   (`:6922  taker.x=clamp(x,...); taker.y=clamp(y,...)`). O ramo `direct` NAO
 *   teleporta ninguem. Entao no chute direto a camada elege o jogador mais
 *   proximo do ponto -- quase sempre a VITIMA da falta -- e faz ELE andar ate a
 *   bola, enquanto `_os36Bater` (:6946) chuta usando `taker`, o especialista de
 *   bola parada escolhido em :6894, que nunca saiu do lugar.
 *
 *   Ou seja: um jogador caminha ate a bola e outro a chuta de longe.
 *
 * CORRECAO
 *   O escanteio ja resolve isso do jeito certo: o nucleo marca o cobrador com
 *   `_setPieceRole='taker'` (:7107) e a camada de caminhada procura essa marca
 *   (:21584). A falta direta passa a usar a mesma convencao.
 *
 *   1. o ramo `direct` marca o cobrador escolhido com `_setPieceRole='taker'`;
 *   2. a camada de caminhada PREFERE essa marca a "o mais proximo do ponto";
 *   3. o cobrador caminha para um ponto de aproximacao 1,4 m ATRAS da bola, na
 *      linha bola->gol, e nao para cima dela: quem bate falta chega por tras.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. `cobrador -> bola no instante do chute`: DESCE, e a mediana vai para a
 *      ordem do proprio ponto de aproximacao (~1,4 m), nao para 9;
 *   2. a variacao da espera apito->chute SOBE (deixa de ser 1,7 s constante),
 *      porque a espera passa a depender da distancia que o cobrador percorre;
 *   3. gols, xG, chutes, escanteios: SEM direcao esperada. Isto move corpos
 *      durante a bola morta, entao a simulacao DIVERGE por caos -- nao e patch
 *      de apresentacao e nao vai dar impressao identica.
 *
 * GATE QUE DECIDE
 *   O gate proprio e (1): p90 do cobrador ate a bola abaixo de 2,5 m. A
 *   ecologia entra como rede, em SEIS bases de 24 partidas: ECO-02 xG <= 2,7,
 *   gols 1,8-3,0, ECO-05 escanteios 4-10. Seis, e nao tres, porque a propria
 *   R18.86 promovida reprova o piso de gols na base 6300000.
 *
 * ARMADILHA REGISTRADA
 *   `armTaker` (:21457) empurra `sim.dead` para `basePause + d/WALK` com teto
 *   `maxWait`. Se o cobrador escolhido estiver longe, a bola morta cresce e o
 *   tempo morto por partida sobe -- que e exatamente o que a OS-78 tentou
 *   reduzir. Meca a fracao de quadros com `dead>0` antes e depois. Se subir
 *   muito, o caminho nao e teleportar: e escolher um cobrador mais perto, ou
 *   baixar o teto.
 */
const fs = require('fs');
const crypto = require('crypto');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('uso: node patch_os87_falta.js <entrada.html> <saida.html>'); process.exit(1); }
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

/* ── 1. o ramo direto marca o cobrador, como o escanteio ja faz ─────────── */
edit('os87-marca-cobrador',
  "    /* OS-36 · a direta passa a resolver no reinicio. Antes ela resolvia no",

  "    /* §OS-87 · O COBRADOR PRECISA SER IDENTIFICAVEL.\n" +
  "       Medido na R18.87: no instante do chute o cobrador estava a 9,162 m da\n" +
  "       bola (mediana), 22,385 m no pior caso — metade das cobrancas era\n" +
  "       chutada por ninguem. A camada de caminhada (:21555) elege o batedor\n" +
  "       como \"o jogador mais proximo do ponto, porque o nucleo o pos la\", e\n" +
  "       essa premissa so vale para o ramo `crossed`, que teleporta em :6922.\n" +
  "       O ramo direto nao teleporta ninguem, entao ela fazia a VITIMA da falta\n" +
  "       andar ate a bola enquanto o especialista chutava de longe.\n" +
  "       O escanteio ja resolve isso marcando o cobrador (:7107). A direta passa\n" +
  "       a usar a mesma convencao. */\n" +
  "    taker._setPieceRole = 'taker';\n" +
  "    taker.__os87Spot = { x: x, y: y };\n" +
  "\n" +
  "    /* OS-36 · a direta passa a resolver no reinicio. Antes ela resolvia no");

/* ── 2. a camada de caminhada procura a marca antes da proximidade ──────── */
edit('os87-caminhada',
  "      var taker = null, cd = 1e9, list = this.teams[team].players;\n" +
  "      for (var k = 0; k < list.length; k++) { var p = list[k]; if (p.red || p.isGK) continue; var dd = dist(p.x, p.y, spotX, spotY); if (dd < cd) { cd = dd; taker = p; } }",

  "      /* §OS-87 · a MARCA manda; a proximidade e so o desempate.\n" +
  "         Eleger \"o mais proximo do ponto\" so funciona quando o nucleo\n" +
  "         teleportou o batedor para la, o que ele faz no ramo `crossed` e NAO\n" +
  "         faz no `direct`. Sem esta preferencia, quem caminhava ate a bola era\n" +
  "         a vitima da falta e quem chutava era outro, a 9,162 m de distancia\n" +
  "         (mediana medida em 28 cobrancas). Mesma convencao do escanteio. */\n" +
  "      var taker = null, cd = 1e9, list = this.teams[team].players;\n" +
  "      for (var k0 = 0; k0 < list.length; k0++) {\n" +
  "        var pm = list[k0];\n" +
  "        if (pm && !pm.red && !pm.isGK && pm._setPieceRole === 'taker') { taker = pm; break; }\n" +
  "      }\n" +
  "      if (!taker) for (var k = 0; k < list.length; k++) { var p = list[k]; if (p.red || p.isGK) continue; var dd = dist(p.x, p.y, spotX, spotY); if (dd < cd) { cd = dd; taker = p; } }",

  1);

/* ── 3. ele chega POR TRAS da bola, na linha bola->gol ──────────────────── */
edit('os87-aproximacao',
  "        var old = snap.get(taker);\n" +
  "        if (old) { taker.x = old[0]; taker.y = old[1]; }   // devolve à origem → ANDA até a bola\n" +
  "        armTaker(this, taker, spotX, spotY, 0.8, 4.0, true);\n" +
  "        snapTakerBeforeRestart(this, taker, spotX, spotY);",

  "        var old = snap.get(taker);\n" +
  "        if (old) { taker.x = old[0]; taker.y = old[1]; }   // devolve à origem → ANDA até a bola\n" +
  "        /* §OS-87 · ponto de APROXIMACAO, 1,4 m atras da bola na linha\n" +
  "           bola->gol. Quem bate falta chega por tras dela, olhando para a\n" +
  "           meta; parar em cima do ponto fazia o corpo cobrir a propria bola.\n" +
  "           A bola continua sendo colocada no ponto exato pelo `armTaker`. */\n" +
  "        var _o87g = this.teams[team] && this.teams[team].oppGoal;\n" +
  "        var _o87x = spotX, _o87y = spotY;\n" +
  "        if (_o87g) {\n" +
  "          var _vx = _o87g.x - spotX, _vy = _o87g.y - spotY;\n" +
  "          var _vl = Math.max(0.6, Math.hypot(_vx, _vy));\n" +
  "          _o87x = clamp(spotX - _vx / _vl * 1.4, 1, FL - 1);\n" +
  "          _o87y = clamp(spotY - _vy / _vl * 1.4, 1, FW - 1);\n" +
  "        }\n" +
  "        armTaker(this, taker, spotX, spotY, 0.8, 4.0, true);\n" +
  "        taker.__spTarget = { x: _o87x, y: _o87y };\n" +
  "        if (this.__cdsTakerWait) { this.__cdsTakerWait.x = _o87x; this.__cdsTakerWait.y = _o87y; }\n" +
  "        snapTakerBeforeRestart(this, taker, _o87x, _o87y);");

/* ── 4. a marca nao pode sobreviver ao lance ────────────────────────────── */
edit('os87-limpa-marca',
  "    this.dead = Math.max(Number(this.dead) || 0, .9);\n" +
  "    this.pendingRestart = _os36Bater;",

  "    this.dead = Math.max(Number(this.dead) || 0, .9);\n" +
  "    /* §OS-87 · a marca do cobrador morre com o lance: se sobrevivesse, a\n" +
  "       camada de caminhada elegeria o mesmo jogador na proxima bola parada. */\n" +
  "    const _os87Bater = () => { try { taker._setPieceRole = null; taker.__os87Spot = null; } catch (_) {} return _os36Bater(); };\n" +
  "    this.pendingRestart = _os87Bater;");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
