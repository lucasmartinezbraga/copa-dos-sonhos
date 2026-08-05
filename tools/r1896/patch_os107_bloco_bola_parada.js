#!/usr/bin/env node
'use strict';
/*
 * OS-107 · O TIME VAI PARA O LANCE -- E FICA LA ATE A COBRANCA
 * ============================================================
 *
 * ###########################################################################
 * # ESTADO: NA CADEIA. PROMOVIDO -> R18.97.                                 #
 * #                                                                         #
 * # Bateria oficial nova (48 x 6 = 288 partidas): PASSA NOS TRES GATES.     #
 * #   gols 2,0070 (pior base 1,8125)   xG 2,1139   escanteios 4,9305        #
 * #                                                                         #
 * # O PRECO FOI MEDIDO E ACEITO PELO DONO DO PROJETO, com estes numeros:    #
 * #   chutes 19,13 -> 17,59 por partida, NEGATIVO NAS SEIS BASES, em troca  #
 * #   de 0,656 -> 2,233 atacante dentro da area no escanteio e              #
 * #   0,262 -> 4,468 defensor dentro da propria area na falta cruzada.      #
 * #                                                                         #
 * # DUAS COISAS QUE QUEM PEGAR DEPOIS PRECISA SABER                         #
 * #   1. a pior base fica a 0,0125 do piso do gate de gols, e o ruido desse #
 * #      gate e +-0,3 (HANDOFF §3.2b). A proxima rodada trabalha SEM FOLGA. #
 * #   2. -1,13 dos chutes somem no JOGO CORRIDO e o canal nao foi isolado.  #
 * #      E causado pelo pino, nao pela E3: "so o pino", que nao marca papel #
 * #      nenhum, perde 1,21 sozinho. E o primeiro item da fila.             #
 * #                                                                         #
 * # O que JA foi respondido e nao precisa ser refeito:                      #
 * #   - fadiga esta falsificada: `:4859` da return antes do bloco de        #
 * #     stamina, bola morta nao gasta folego nem relogio. Medido: tempo     #
 * #     vivo 748,0 -> 750,6 s, stamina final 45,15 -> 45,35;                #
 * #   - a perda na janela do cruzamento (-1,54) e o efeito PRETENDIDO: a    #
 * #     area passou a ser defendida. Nao e dano;                            #
 * #   - nos 10 s seguintes ao reinicio o patch produz MAIS futebol:         #
 * #     0,715 -> 1,066 chute por minuto vivo;                               #
 * #   - havia um bug, o papel `zone` vazando para o jogo corrido (mediana   #
 * #     4,433 s, max 183,1 s). CORRIGIDO. Valia +0,29 chute -- real, pouco. #
 * ###########################################################################
 *
 * PEDIDO DO DONO (PROXIMA_RODADA.md · PARTE A · A1)
 *   "Quando acontecer o escanteio o time tem que ir pra area, mesma coisa a
 *    falta, isso voce esta pecando, o time nao se move para a direcao do lance
 *    igual em uma partida real."
 *
 * O CENSO QUE VEIO ANTES (diag_os107, 12 partidas, build R18.96 a335bbba)
 *
 *   ESCANTEIO com cerimonia -- 64 lances, 5,33 por partida
 *     posto de area por lance ....................... 2,39
 *     CHEGOU ao posto alguma vez .................... 146 de 146   100%
 *     ainda estava NA AREA no reinicio .............. 42 de 146    28,8%
 *     dist. do posto ao gol no reinicio ............. mediana 19,65 m
 *     atacantes na grande area no reinicio .......... 0,656
 *     defensores na grande area no reinicio ......... 5,078
 *     bloco atacante -> gol que ataca ............... 40,45 m
 *     teleporte no apito ............................ 0 de 1279
 *
 *   FALTA CRUZADA -- 42 lances, 3,50 por partida
 *     postos de area por lance ...................... 3
 *     ARMADOS para caminhar ......................... 0 de 126     0%
 *     teleporte no apito ............................ 247 de 840, max 70,40 m
 *     atacantes na area: apito 3,00 -> reinicio 1,12 -> +1,0 s 0,67
 *     DEFENSORES NA PROPRIA AREA .................... 0,095 no apito
 *                                                     0,262 no reinicio
 *                                                     0,952 em +1,0 s
 *     bloco defensor -> proprio gol no apito ........ 36,15 m
 *
 * O DIAGNOSTICO, COM ARQUIVO:LINHA
 *
 *   D1 · :18287 (camada R15, bola parada sem teleporte)
 *        `p.x = t.x; p.y = t.y; p.__spTarget = null;`
 *        O posto e ABANDONADO NA CHEGADA. A partir dai sobram ~3 s de bola morta
 *        em que a IA tatica normal puxa o jogador de volta. Medido: 100% chegam,
 *        28,8% ainda estao la na hora da cobranca. A coreografia existe, e
 *        desfeita -- e exatamente a armadilha §2.4 do HANDOFF.
 *        A OS-100 ja tinha resolvido isso PARA UM JOGADOR SO (o cobrador do
 *        lateral, "o pino", :21556). Esta rodada generaliza o pino para o time.
 *
 *   D2 · :6951 (`_freeKick`, ramo `crossed`)
 *        `aerial.slice(0,3).forEach(a => { a.x = ...; a.y = ...; })`
 *        A camada R15 envolve `_setCorner`, `_goalKickOrRestart` e `_kickoff`.
 *        NAO envolve `_freeKick`. Os tres alvos da falta cruzada sao escritos
 *        direto: 247 saltos acima de 3 m, maximo 70,40 m. O time nao vai para a
 *        area -- ele aparece la, e um segundo depois ja saiu (armadilha §2.3).
 *
 *   D3 · :6951, mesmo ramo
 *        O time que DEFENDE nao recebe posto nenhum na falta cruzada. Medido:
 *        0,095 defensor dentro da propria area no apito. O escanteio arma quatro
 *        marcadores (:7160); a falta cruzada nao arma ninguem.
 *
 * A CORRECAO -- tres edicoes, um mecanismo so:
 *   *a forma da bola parada e CAMINHADA e SEGURA ate a cobranca, dos dois lados.*
 *
 *   E1 · O PINO COLETIVO. Enquanto a bola esta morta num escanteio ou numa falta
 *        cruzada, quem foi armado com `__spTarget` e chegou continua sendo puxado
 *        para o posto. Usa a maquina de caminhada que ja existe (R15) -- nao
 *        escreve posicao, nao teleporta. O cobrador fica DE FORA: ele tem a
 *        propria maquina em :21556 e brigar com ela reabre o defeito da OS-87.
 *
 *   E2 · A FALTA CRUZADA CAMINHA. Mesmo desenho da R15: fotografa antes, deixa o
 *        nucleo calcular, devolve todo mundo e guarda o destino como alvo. O teto
 *        de `dead` e 5,0 s -- o MESMO que :21556 ja usa para o cobrador do
 *        escanteio chegar a bandeirinha. Nao inventei numero novo.
 *
 *   E3 · A DEFESA VAI PARA A AREA NA FALTA CRUZADA. Cinco defensores recebem
 *        posto entre 5,0 e 11,4 m do proprio gol, abertos ate 11,5 m em y. Cinco,
 *        e nao seis ou nove, porque e o numero que o ESCANTEIO ja poe la
 *        (medido: 5,078 defensores na area) e essa proporcao ja passou pelos
 *        gates. A falta cruzada passa a ter a mesma populacao de area do
 *        escanteio: tres atacantes contra cinco defensores.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   P1. teleporte no apito da falta cruzada: DESCE a zero (247 de 840 -> 0);
 *   P2. defensores dentro da propria area na falta cruzada: SOBE;
 *   P3. postos ainda ocupados no reinicio do escanteio: SOBE (28,8% -> sobe);
 *   P4. atacantes na grande area no reinicio do escanteio: SOBE (0,656 -> sobe);
 *   P5. bloco atacante -> gol no escanteio: DESCE (40,45 m -> desce);
 *   P6. escanteios: SOBE -- mais corpos na area, mais desvio para a linha;
 *   P7. xG: SOBE -- mais primeiro contato dentro da area;
 *   P8. gols: DESCE -- a falta cruzada deixa de ser cobrada contra area vazia.
 *
 *   P8 e o risco desta rodada, e esta escrito antes de medir de proposito.
 *
 * GATE QUE DECIDE
 *   `gols` entre 1,8 e 3,0 nas SEIS bases. E o piso que decide, nao o teto: a
 *   R18.96 tem 1,875 na pior base, 0,075 de folga. ECO-02 (xG <= 2,7) e ECO-05
 *   (escanteios 4-10) como rede.
 *
 * ARMADILHAS REGISTRADAS ANTES
 *   A1. `dead` e tempo de FISICA, nao de relogio (10-base-bundle.js:2662). A
 *       propria R15 mediu que subir o teto para 6 s em TODA bola parada derrubou
 *       gols 14,6%. Por isso o teto de 5,0 s vale so para a falta cruzada, que
 *       sao 3,5 lances por partida, e o escanteio nao e tocado no tempo.
 *   A2. O pino nao pode sobreviver ao reinicio, senao congela o jogador com a
 *       bola rolando. Guarda dupla: so enquanto `dead > 0`, e teto de quadros.
 *   A3. O cobrador tem maquina propria (:21556 `armTaker` + `snapTakerBefore-`
 *       `Restart`). Pina-lo reabre a OS-87 -- 9,162 m entre cobrador e bola.
 *       Ele e excluido por `_setPieceRole === 'taker'`.
 *   A4. `_setPieceRole` sobrevive entre quadros (so `clearCorner13`, :17074, o
 *       limpa), entao da para usa-lo como marca -- mas o pino guarda a
 *       referencia do jogador, nao o papel, para nao depender disso.
 */
const fs = require('fs');
const crypto = require('crypto');

/* As tres edicoes sao separaveis, para que a bateria consiga atribuir o efeito a
   cada uma em vez de julgar o pacote inteiro:
     --pino=0|1      E1 · o posto e mantido enquanto a bola esta morta   (1)
     --falta=0|1     E2 · a falta cruzada caminha em vez de teleportar   (1)
     --defesa=N      E3 · N defensores recebem posto na area na falta    (5)
     --teto=S        teto de `dead` da falta cruzada, em segundos      (5.0) */
const args = process.argv.slice(2);
const flag = (nome, pad) => {
  const a = args.find(v => v.startsWith('--' + nome + '='));
  return a === undefined ? pad : Number(a.split('=')[1]);
};
const posicionais = args.filter(a => !a.startsWith('--'));
const IN = posicionais[0], OUT = posicionais[1];
if (!IN || !OUT) { console.error('uso: node patch_os107_bloco_bola_parada.js <entrada> <saida> [--pino=1] [--falta=1] [--defesa=5] [--teto=5.0]'); process.exit(1); }
const PINO = flag('pino', 1) ? 1 : 0;
const FALTA = flag('falta', 1) ? 1 : 0;
const DEFESA = Math.max(0, Math.min(9, flag('defesa', 5)));
const TETO = flag('teto', 5.0);
const SOLTA = flag('solta', 0.4);   // OS-111b: a contencao solta nos ultimos N s
console.log('  OS-107  pino=' + PINO + '  falta=' + FALTA + '  defesa=' + DEFESA + '  teto=' + TETO + '  solta=' + SOLTA);
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

const CAMADA = [
'<script id="cds-os107-bloco-bola-parada">',
'(function(root){',
"'use strict';",
'/* §OS-107 · o time vai para o lance -- e fica la ate a cobranca.',
'',
'   MEDIDO (diag_os107, 12 partidas, R18.96):',
'     escanteio ... 100% dos postos sao ALCANCADOS, 28,8% ainda estao ocupados',
'                   no reinicio. A coreografia existe e e desfeita pela IA',
'                   tatica normal nos ~3 s que sobram de bola morta, porque',
'                   :18287 limpa `__spTarget` no snap de chegada.',
'     falta cruzada . os tres alvos sao TELEPORTADOS (247 saltos acima de 3 m,',
'                   maximo 70,40 m): a R15 envolve _setCorner mas nao _freeKick.',
'                   E o time que defende nao recebe posto nenhum -- 0,095',
'                   defensor dentro da propria area no apito.',
'',
'   Esta camada nao escreve posicao durante o jogo: ela transforma escrita em',
'   alvo caminhado (mesmo desenho da R15, :18190) e mantem o alvo ativo enquanto',
'   a bola esta morta (mesmo desenho do pino da OS-100, :21556). */',
'const M = root && root.MatchSim;',
'if (!M || !M.prototype || M.prototype.__OS107__) return;',
'const P = M.prototype; P.__OS107__ = true;',
'const FLv = Number(root.FL) || 105, FWv = Number(root.FW) || 68;',
'',
'const WALK = 0.92;        // mesma fracao de maxSpd da R15',
'const VEL  = 6.5;         // mesma referencia de velocidade da R15',
'const TETO_FALTA = ' + TETO.toFixed(2) + ';   // mesmo teto que :21556 ja usa no escanteio',
'const MIN_MOVE = 3.0;     // mesmo limiar da R15: abaixo disso nao importa',
/* §OS-111 · como o jogador ESPERA. Medido (diag_os110): com o pino da primeira
   versao, o alvo era RE-ARMADO 5,385 vezes por jogador por escanteio (p90 14,
   maximo 24) e os quadros em velocidade de corrida subiam de 26,1% para 34,8%.
   Um repuxao a cada 0,2 s: quem espera o escanteio corria no lugar.
   A causa: re-armar `__spTarget` delega a volta a R15 (:18270), que caminha a
   `maxSpd * 0,92` -- ~6 m/s, velocidade de corrida -- para cobrir 45 cm.
   A correcao troca CORRIDA por CONTENCAO: perto do posto o jogador nao corre de
   volta, ele so nao consegue escapar da folga, e a velocidade exibida fica
   abaixo do limiar de `moving` (2 m/s, :4910) para ele ler como parado. */
'const FOLGA = 0.9;        // raio em que ele pode se mexer a vontade',
'const SOLTO = 3.0;        // alem disto foi deslocado de verdade: volta andando',
'const VEL_ESPERA = 1.2;   // m/s -- abaixo do limiar de `moving` (:4910)',
/* §OS-111b · SOLTAR ANTES DA COBRANCA. A primeira versao da contencao segurava
   o jogador ate o ultimo quadro da bola morta, e a bateria cobrou caro: gols
   1,8750 de media com TRES bases abaixo do piso, negativo em 5 das 6 bases.
   O canal e a velocidade: limitar `vx/vy` a 1,2 m/s a cada quadro faz o jogador
   entrar no lance parado, e ele chega atrasado no cruzamento.
   O nucleo ja trata `dead > 0.4` como espera (:4850 passa `waiting` ao
   `_movePlayers`). A contencao passa a valer so nessa janela: os ultimos 0,4 s
   sao livres, que e quando o cobrador se aproxima da bola e o time comeca a
   atacar o espaco -- futebol de verdade, e momento para entrar no lance. */
'const SOLTA_EM = ' + SOLTA.toFixed(2) + ';   // s de `dead` em que a contencao SOLTA',
'const QUADROS_MAX = 600;  // guarda A2',
'const DEFENSORES_NA_AREA = ' + DEFESA + ';',
'',
'function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : (d || 0); }',
'function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }',
'function dd(a, b, c, d) { return Math.hypot(a - c, b - d); }',
'',
'function foto(sim) {',
'  const m = new Map(), teams = sim.teams || [];',
'  for (let i = 0; i < teams.length; i++) {',
'    const pl = teams[i].players || [];',
'    for (let j = 0; j < pl.length; j++) {',
'      const p = pl[j];',
'      if (p && !p.red) m.set(p, [num(p.x), num(p.y)]);',
'    }',
'  }',
'  return m;',
'}',
'',
'/* E2 · converte escrita direta de posicao em alvo a ser percorrido, e alonga',
'   `dead` na medida de quem ficou mais longe. Copia deliberada de :18190 -- a',
'   R15 faz isto para o escanteio e nunca foi estendida a falta. */',
'function adiar(sim, snap, teto) {',
'  let longe = 0;',
'  snap.forEach(function (xy, p) {',
'    if (!p || p.red) return;',
'    const tx = num(p.x), ty = num(p.y);',
'    const d = dd(tx, ty, xy[0], xy[1]);',
'    if (d <= MIN_MOVE) return;',
'    p.__spTarget = { x: tx, y: ty };',
'    p.x = xy[0]; p.y = xy[1];',
'    p.vx = 0; p.vy = 0;',
'    if (d > longe) longe = d;',
'  });',
'  if (longe > 0) {',
'    const preciso = 0.6 + longe / (VEL * WALK);',
'    sim.dead = Math.max(num(sim.dead), Math.min(teto, preciso));',
'  }',
'  return longe;',
'}',
'',
'/* E1 · registra os postos vivos para o pino. O cobrador fica de fora',
'   (armadilha A3): ele tem a propria maquina em :21556. */',
'function fixar(sim) {',
'  const postos = [], teams = sim.teams || [];',
'  for (let i = 0; i < teams.length; i++) {',
'    const pl = teams[i].players || [];',
'    for (let j = 0; j < pl.length; j++) {',
'      const p = pl[j];',
'      if (!p || p.red || !p.__spTarget) continue;',
'      if (p._setPieceRole === "taker") continue;',
'      postos.push({ p: p, x: num(p.__spTarget.x), y: num(p.__spTarget.y) });',
'    }',
'  }',
'  sim.__os107 = postos.length ? { postos: postos, quadros: 0 } : null;',
'}',
'',
'/* E3 · a defesa vai para a area na falta cruzada. Cinco postos entre 5,0 e',
'   11,4 m do proprio gol, abertos ate 11,5 m em y -- todos dentro da grande',
'   area. Cinco e o numero que o escanteio ja poe la (medido: 5,078), entao a',
'   falta cruzada passa a ter a MESMA populacao de area de um lance que ja',
'   passou pelos gates. Escreve posicao de proposito: `adiar` roda logo depois',
'   e transforma tudo isto em caminhada. */',
'function montarDefesa(sim, timeQueAtaca) {',
'  if (DEFENSORES_NA_AREA <= 0) return;',
'  const dt = sim.teams && sim.teams[1 - timeQueAtaca];',
'  if (!dt || !dt.players) return;',
'  const g = dt.goal;',
'  if (!g || !isFinite(num(g.x, NaN))) return;',
'  const dir = num(dt.attackDir, 1) >= 0 ? 1 : -1;',
'  const livres = dt.players.filter(function (p) {',
'    return p && !p.red && !p.isGK && !p._setPieceRole;',
'  }).sort(function (a, b) {',
'    return dd(a.x, a.y, g.x, g.y) - dd(b.x, b.y, g.x, g.y);',
'  });',
'  const n = Math.min(DEFENSORES_NA_AREA, livres.length);',
'  const marcados = [];',
'  for (let i = 0; i < n; i++) {',
'    const p = livres[i];',
'    const lado = (i % 2) ? 1 : -1;',
'    const faixa = 2.5 + Math.floor(i / 2) * 4.5;',
'    p.x = cl(num(g.x) + dir * (5.0 + i * 1.6), 2, FLv - 2);',
'    p.y = cl(num(g.y) + lado * faixa, 3, FWv - 3);',
'    p.vx = 0; p.vy = 0;',
'    p._setPieceRole = "zone";',
'    marcados.push(p);',
'  }',
'  /* O papel PRECISA ser devolvido no reinicio. Medido (diag_os109): sem isto',
'     ele sobrevive 4,433 s de mediana e ate 183,1 s de tempo vivo, porque',
'     `clearCorner13` (:17074) so roda em gol/erro/trave, tiro de meta e na',
'     expiracao da CADEIA DE ESCANTEIO -- e falta cruzada nao abre cadeia',
'     nenhuma. Enquanto ele fica pendurado, :21841 e :21867 pulam esses cinco',
'     jogadores, que somem das camadas de movimento e ataque no jogo corrido.',
'     O nucleo nao marca ninguem na falta cruzada; devolver no reinicio e o',
'     comportamento mais proximo da base. */',
'  sim.__os107Zona = marcados;',
'}',
'',
'/* ---------------------------------------------------------------- escanteio */',
'const oldCorner = P._setCorner;',
'if (typeof oldCorner === "function") {',
'  P._setCorner = function () {',
'    const r = oldCorner.apply(this, arguments);',
'    try { fixar(this); } catch (_) {}',
'    return r;',
'  };',
'}',
'',
'/* ------------------------------------------------------------ falta cruzada */',
'const oldFK = P._freeKick;',
'if (' + (FALTA ? 'true' : 'false') + ' && typeof oldFK === "function") {',
'  P._freeKick = function (team, x, y, input) {',
'    const s = this.stats && this.stats[team];',
'    const antes = s ? (s.freeKickCrossed | 0) : null;',
'    const snap = (team === 0 || team === 1) ? foto(this) : null;',
'    const r = oldFK.apply(this, arguments);',
'    try {',
'      if (snap && s && antes !== null && (s.freeKickCrossed | 0) > antes) {',
'        montarDefesa(this, team);      // E3',
'        adiar(this, snap, TETO_FALTA); // E2',
'        fixar(this);                   // E1',
'      }',
'    } catch (_) {}',
'    return r;',
'  };',
'}',
'',
'/* ------------------------------------------------------------------- o pino */',
'/* Roda no fim do passo, depois da caminhada da R15 (:18270) e depois do',
'   movimento tatico: enquanto a bola estiver morta, quem foi armado continua',
'   sendo puxado para o posto. Sem isto ele chega e vai embora -- medido, 100%',
'   chegam e 28,8% ainda estao la na cobranca. */',
'const oldStep = P.step;',
'const PINO_LIGADO = ' + (PINO ? 'true' : 'false') + ';',
'P.step = function (dt) {',
'  const r = oldStep.apply(this, arguments);',
'  try {',
'    /* devolve o papel de zona no instante em que a bola volta a rolar */',
'    if (this.__os107Zona && !(num(this.dead) > 0)) {',
'      const z = this.__os107Zona;',
'      for (let i = 0; i < z.length; i++) {',
'        if (z[i] && z[i]._setPieceRole === "zone") z[i]._setPieceRole = null;',
'      }',
'      this.__os107Zona = null;',
'    }',
'    const st = PINO_LIGADO ? this.__os107 : null;',
'    if (st) {',
'      st.quadros++;',
'      if (!(num(this.dead) > 0) || st.quadros > QUADROS_MAX) {',
'        this.__os107 = null;',
'      } else {',
'        for (let i = 0; i < st.postos.length; i++) {',
'          const q = st.postos[i], p = q.p;',
'          if (!p || p.red) continue;',
'          const d = dd(p.x, p.y, q.x, q.y);',
'          /* §OS-111b · nos ultimos SOLTA_EM segundos ninguem e contido: o time',
'             entra no lance com velocidade de verdade. */',
'          if (num(this.dead) <= SOLTA_EM) continue;',
'          if (d > SOLTO) {',
'            /* deslocado de verdade: volta caminhando, com a maquina da R15 */',
'            if (!p.__spTarget) p.__spTarget = { x: q.x, y: q.y };',
'            continue;',
'          }',
'          /* §OS-111 · ele esta NO posto, entao ele ESPERA. Nada de correr de',
'             volta a 6 m/s por causa de 45 cm -- isso e o tremor que o dono viu.',
'             Aqui ele so nao consegue escapar da folga, e a velocidade exibida',
'             fica abaixo do limiar de `moving` para ele ler como parado. */',
'          if (d > FOLGA) {',
'            const k = FOLGA / d;',
'            p.x = q.x + (p.x - q.x) * k;',
'            p.y = q.y + (p.y - q.y) * k;',
'          }',
'          const v = Math.hypot(num(p.vx), num(p.vy));',
'          if (v > VEL_ESPERA) {',
'            p.vx = num(p.vx) / v * VEL_ESPERA;',
'            p.vy = num(p.vy) / v * VEL_ESPERA;',
'          }',
'        }',
'      }',
'    }',
'  } catch (_) {}',
'  return r;',
'};',
'',
'root.CDS_OS107 = Object.freeze({ version: "OS-107", feature: "SET_PIECE_BLOCK_WALKS_AND_HOLDS" });',
'})(typeof window!==\'undefined\'?window:globalThis);',
'</script>',
''
].join('\n');

edit('os107-camada',
  '<script id="cds-r1886-build-meta">',
  CAMADA + '<script id="cds-r1886-build-meta">');

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nescrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
