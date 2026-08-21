#!/usr/bin/env node
'use strict';
/* CATALOGO DE ORACULOS — o que conta como bug, e por que
   =========================================================================
   Um bug so existe se houver um ORACULO: alguma afirmacao sobre o jogo que
   possa ser violada. Sem oraculo nao ha bug, ha opiniao. Este arquivo e o
   catalogo dos oraculos automaticos do Copa dos Sonhos.

   Tres tipos, e a diferenca importa na hora de triar:

     INVARIANTE   nunca pode ser falso, em nenhum quadro de nenhuma partida.
                  Violou = defeito, ponto. (Bola com coordenada NaN.)
     LEI DE JOGO  regra de futebol que o motor promete cumprir. Violou =
                  defeito, mas o conserto e de regra, nao de codigo.
                  (Expulso que continua correndo.)
     PLAUSIBILIDADE  faixa medida, nao lei. Fora da faixa = suspeita, com
                  numero em cima da mesa. (Chute a 300 km/h.)

   Regra de honestidade: limiar de plausibilidade so entra aqui DEPOIS de
   medido no build corrente. Limiar chutado gera alarme falso, alarme falso
   mata a auditoria — e uma auditoria que ninguem le nao encontra nada.

   NADA AQUI ALTERA O JOGO. O observador embrulha `step` e `_emit` para ler
   estado; nao sorteia, nao escreve, nao consome RNG. Uma partida auditada e
   identica, quadro a quadro, a mesma partida sem auditoria — e o proprio
   `auditoria.js --verificar-neutralidade` prova isso.
*/

const FL = 105, FW = 68;

/* ---------------------------------------------------------------- catalogo */
const CATALOGO = [
  /* ===== N2-A · integridade numerica ===================================== */
  { id: 'A1', classe: 'numerica', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Coordenada da bola nao finita',
    porque: 'NaN/Infinity em x,y,z,vx,vy,vz contamina tudo que le a bola no mesmo quadro.' },
  { id: 'A2', classe: 'numerica', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Coordenada de atleta nao finita',
    porque: 'Um atleta NaN some do desenho e envenena distancias, marcacao e escolha de passe.' },
  { id: 'A3', classe: 'numerica', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Estado da partida nao finito',
    porque: 'minute/dead/stoppage/score nao finitos travam o fim de jogo e o placar.' },
  { id: 'A4', classe: 'numerica', tipo: 'invariante', gravidade: 'S2',
    titulo: 'Stamina fora de 0..100',
    porque: 'A fadiga alimenta execucao, velocidade e substituicao; fora da faixa, todas mentem.' },
  { id: 'A5', classe: 'numerica', tipo: 'invariante', gravidade: 'S3',
    titulo: 'Nota do atleta fora de 0..10',
    porque: 'Nota e superficie visivel: aparece na ficha do jogador.' },

  /* ===== N2-B · geometria =============================================== */
  { id: 'B1', classe: 'geometria', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Bola fora do mundo',
    porque: 'Alem de 15 m da linha nao existe reinicio nenhum que justifique: e fuga.' },
  { id: 'B2', classe: 'geometria', tipo: 'invariante', gravidade: 'S2',
    titulo: 'Bola abaixo do gramado (z < 0)',
    porque: 'Altura negativa e integracao vazando; some no desenho e quebra o quique.' },
  { id: 'B3', classe: 'geometria', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Bola acima de 40 m',
    porque: 'Chutao de verdade nao passa de ~30 m de apice.' },
  { id: 'B4', classe: 'geometria', tipo: 'invariante', gravidade: 'S2',
    titulo: 'Atleta fora do campo com folga',
    porque: 'Lateral e tiro de meta explicam ate ~8 m; alem disso o atleta saiu do estadio.' },
  { id: 'B6', classe: 'geometria', tipo: 'lei', gravidade: 'S2',
    titulo: 'Teleporte de atleta',
    porque: 'R18.99 fixou o orcamento de passo em 2,5 m por quadro. Acima disso alguem foi POSTO no lugar em vez de ANDAR ate ele.' },
  { id: 'B7', classe: 'geometria', tipo: 'lei', gravidade: 'S2',
    titulo: 'Teleporte de bola com jogo rolando',
    porque: 'Com a bola viva, salto de posicao sem voo e recolocacao administrativa indevida.' },

  /* ===== N2-C · leis do futebol ========================================= */
  { id: 'C1', classe: 'regra', tipo: 'lei', gravidade: 'S1',
    titulo: 'Placar diverge dos eventos de gol',
    porque: 'Placar e a unica coisa que o jogador leva da partida.' },
  { id: 'C2', classe: 'regra', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Placar regride' },
  { id: 'C3', classe: 'regra', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Relogio regride dentro do mesmo tempo' },
  { id: 'C4', classe: 'regra', tipo: 'lei', gravidade: 'S2',
    titulo: 'Expulso continua em jogo',
    porque: 'Cartao vermelho que nao tira o atleta e vantagem gratis para quem foi punido.' },
  { id: 'C4b', classe: 'regra', tipo: 'lei', gravidade: 'S4',
    titulo: 'Expulso reposicionado na troca de lados',
    porque: '`_switchSides` espelha todos os atletas, inclusive os expulsos, enquanto `_resetPositions` os pula. Ninguem ve, mas as duas rotinas discordam sobre quem esta em campo.' },
  { id: 'C5', classe: 'regra', tipo: 'lei', gravidade: 'S1',
    titulo: 'Mais de 11 em campo' },
  { id: 'C6', classe: 'regra', tipo: 'lei', gravidade: 'S2',
    titulo: 'Substituicoes acima do permitido' },
  { id: 'C7', classe: 'regra', tipo: 'lei', gravidade: 'S2',
    titulo: 'Segundo amarelo sem vermelho' },
  { id: 'C8', classe: 'regra', tipo: 'lei', gravidade: 'S2',
    titulo: 'Dono da bola longe da bola',
    porque: 'Se o dono esta a metros da bola sem voo, a posse e ficticia: a marcacao persegue um fantasma.' },
  { id: 'C9', classe: 'regra', tipo: 'lei', gravidade: 'S2',
    titulo: 'Dono da bola expulso' },
  { id: 'C10', classe: 'regra', tipo: 'lei', gravidade: 'S2',
    titulo: 'Reinicio fora do lugar legal',
    porque: 'Escanteio sai da quina, lateral da linha lateral, tiro de meta de dentro da area, penalti da marca. Reinicio no lugar errado e a regra de futebol mais visivel que existe.' },
  { id: 'C11', classe: 'regra', tipo: 'lei', gravidade: 'S2',
    titulo: 'Bola fora das linhas com o jogo rolando',
    porque: 'A bola inteira passou a linha e ninguem apitou. Segue jogo fora do campo.' },
  { id: 'C13', classe: 'regra', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Corpos sobrepostos',
    porque: 'Dois atletas ocupando o mesmo ponto por mais de um segundo: na tela um entra dentro do outro.' },
  { id: 'C16', classe: 'regra', tipo: 'lei', gravidade: 'S1',
    titulo: 'Gol sem a bola na baliza',
    porque: 'Gol validado com a bola longe da linha ou fora das traves e placar inventado.' },

  /* ===== N2-D · vivacidade (o jogo trava?) ============================== */
  { id: 'D1', classe: 'vivacidade', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Bola morta que nao reinicia',
    porque: 'E o travamento classico deste motor: `dead` alto e `pendingRestart` que nunca dispara. Para quem joga, o jogo congelou.' },
  { id: 'D2', classe: 'vivacidade', tipo: 'plausibilidade', gravidade: 'S2',
    titulo: 'Partida muda por tempo demais',
    porque: 'Sem nenhum evento por minutos de simulacao, ou o jogo travou ou virou passe lateral eterno.' },
  { id: 'D3', classe: 'vivacidade', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Relogio parado com a bola viva' },
  { id: 'D5', classe: 'vivacidade', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Posse congelada no mesmo atleta' },
  { id: 'D6', classe: 'vivacidade', tipo: 'plausibilidade', gravidade: 'S2',
    titulo: 'Bola parada no gramado sem dono e sem reinicio' },
  { id: 'D7', classe: 'vivacidade', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Partida nao termina no orcamento de passos' },
  { id: 'D8', classe: 'vivacidade', tipo: 'lei', gravidade: 'S1',
    titulo: 'Bola morta com o jogo andando',
    porque: 'Tres subsistemas discordam do que `dead > 0` significa. O nucleo retorna cedo (sem fisica nem decisao) para QUALQUER dead > 0; o congelamento tatico so entra em dead > 0,4; e o laco de render adianta 3,5x sempre que dead > 0 (10,5x no botao 3X). Na faixa 0 < dead <= 0,4 o resultado e: a bola continua colada no portador por uma camada, os 22 continuam se movendo, o relogio da partida PARA e a tela ACELERA. E o defeito de sensacao mais caro do jogo.' },

  /* ===== N2-E · fisica ================================================== */
  { id: 'B8', classe: 'geometria', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Recolocacao longa da bola no reinicio',
    porque: 'No quadro do reinicio a bola muda de lugar de graca. Ate uns metros isso e o arbitro acertando o ponto; dezenas de metros e o lance recomecando noutro lugar, e o olho ve a bola piscar.' },
  { id: 'E1', classe: 'fisica', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Bola acima de 60 m/s (216 km/h)',
    porque: 'O chute mais forte ja medido no futebol fica perto de 51 m/s.' },
  { id: 'E2', classe: 'fisica', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Bola acelera no ar sem contato',
    porque: 'Bola em voo so perde energia. Ganhar velocidade sem ninguem tocar nela e a integracao numerica vazando ou uma recolocacao disfarcada de fisica.' },
  { id: 'E4', classe: 'fisica', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Voo de bola longo demais',
    porque: 'Acima de 12 s no ar, a bola nao esta voando: esta esquecida num estado de viagem.' },

  /* ===== N3-F · contadores ============================================== */
  { id: 'F1', classe: 'contador', tipo: 'invariante', gravidade: 'S2',
    titulo: 'Estatistica cumulativa regride' },
  { id: 'F2', classe: 'contador', tipo: 'invariante', gravidade: 'S2',
    titulo: 'Sub-contador maior que o total',
    porque: 'passOk>passes, onTarget>shots, goals>onTarget e afins sao aritmetica, nao gosto.' },
  { id: 'F4', classe: 'contador', tipo: 'lei', gravidade: 'S2',
    titulo: 'O motor acusa a si mesmo (visualIntegrity)',
    porque: 'Teleporte, falta de viagem, falha vertical e falha de apresentacao sao defeito em qualquer quantidade. Contato reprovado pela fisicalidade NAO e: e o sistema de integridade fazendo o trabalho dele — o lance deixa de acontecer e a bola fica viva. So vira achado quando passa de 3% dos contatos, que e quando deixa de ser excecao.' },

  /* ===== N4-G · agregado (so faz sentido sobre a amostra inteira) ======= */
  { id: 'G1', classe: 'agregado', tipo: 'lei', gravidade: 'S3',
    titulo: 'Funcionalidade morta',
    porque: 'Evento que o codigo sabe emitir e que nao aparece em centenas de partidas e caminho morto: ou a condicao ficou impossivel, ou uma camada matou o ramo.' },
  { id: 'G2', classe: 'agregado', tipo: 'plausibilidade', gravidade: 'S3',
    titulo: 'Alvo de calibracao fora da faixa',
    porque: 'calibration/targets.json e o contrato de design do proprio projeto.' },
  { id: 'G3', classe: 'agregado', tipo: 'plausibilidade', gravidade: 'S2',
    titulo: 'Vies de lado com elencos iguais',
    porque: 'Em campo neutro e com o mesmo elenco dos dois lados, mandante e visitante tem de empatar na media.' },
  { id: 'H1', classe: 'determinismo', tipo: 'invariante', gravidade: 'S1',
    titulo: 'Mesma semente, resultado diferente',
    porque: 'Sem determinismo nao ha reproducao, e sem reproducao nao ha conserto.' },
];

const PORID = Object.create(null);
for (const c of CATALOGO) PORID[c.id] = c;

/* ------------------------------------------------------------- limiares
   Todos com unidade explicita. Os de plausibilidade trazem a origem. */
const LIM = {
  campoFolgaBola: 15,       // m alem da linha
  campoFolgaAtleta: 8,      // m alem da linha (lateral e tiro de meta cabem)
  alturaMax: 40,            // m
  saltoAtleta: 2.5,         // m/quadro — SALTO_ADMIN da R18.99
  saltoBola: 4.0,           // m/quadro com a bola viva e sem voo
  velBola: 60,              // m/s
  vooMax: 12,               // s
  deadMax: 30,              // s de simulacao com a bola morta
  semEventoMax: 150,        // s de simulacao
  relogioParadoMax: 90,     // s de simulacao com a bola viva
  recolocacaoMax: 25,       // m — acima disto o reinicio nao e onde o lance parou
  reinicioFolga: 2.0,       // m de tolerancia no ponto legal do reinicio
  foraDeJogoMax: 1.0,       // s de simulacao com a bola alem da linha e o jogo rolando
  sobreposicao: 0.45,       // m — abaixo disto os corpos se cruzam
  sobreposicaoMax: 1.0,     // s de simulacao
  deadVivo: 0.4,            // degrau do congelamento tatico no nucleo
  deadVivoMin: 0.5,         // s de episodio ate virar achado
  posseMax: 45,             // s de simulacao com o mesmo dono
  bolaLargadaMax: 12,       // s de simulacao
  donoLonge: 3.5,           // m
  passosMax: 500000,        // orcamento de passos por partida
};

/* Rotulos de reinicio, em ordem de prioridade: uma pausa que teve gol E
   cartao e uma pausa de GOL. */
const PRIORIDADE = ['goal', 'penalty', 'red', 'injury', 'yellow', 'foul', 'freekick',
  'offside', 'corner', 'throw_in', 'goal_kick', 'halftime', 'extratime', 'kickoff'];

function pct(v, q) {
  if (!v.length) return null;
  const s = v.slice().sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)));
  return +s[i].toFixed(3);
}

/* ============================================================ OBSERVADOR ===
   Embrulha uma instancia de MatchSim. So le. */
function criarObservador(sim, meta, opts) {
  opts = opts || {};
  const maxPorRegra = opts.maxPorRegra || 3;
  const violacoes = [];
  const contagem = Object.create(null);
  const eventos = Object.create(null);
  const pausas = [];              // { tipo, dead0, duracaoSim, eventos:[] }
  const golsSeq = [];
  let quadro = 0;

  function ctx() {
    return { partida: meta.i, semente: meta.semente, tempo: sim.half,
      minuto: +(Number(sim.minute) || 0).toFixed(2), t: +(Number(sim.t) || 0).toFixed(2), quadro };
  }
  function registrar(id, detalhe) {
    contagem[id] = (contagem[id] || 0) + 1;
    if (contagem[id] > maxPorRegra) return;
    violacoes.push(Object.assign({ id: id, gravidade: (PORID[id] || {}).gravidade || 'S3',
      classe: (PORID[id] || {}).classe || '?' }, ctx(), { detalhe: detalhe }));
  }

  /* --------------------------------------------------------- eventos */
  const emitOriginal = sim._emit;
  sim._emit = function (t, d) {
    try {
      eventos[t] = (eventos[t] || 0) + 1;
      ultimoEventoT = Number(sim.t) || 0;
      if (pausaAberta) pausaAberta.eventos.push(t);
      else eventosRecentes.push({ t: t, quando: Number(sim.t) || 0 });
      if (eventosRecentes.length > 12) eventosRecentes.shift();
      if (t === 'goal' && d && d.by) golsSeq.push({ time: d.by.team, minuto: Math.floor(sim.minute) });
      if (t === 'goal') {
        golT = Number(sim.t) || 0;
        /* A conferencia e no CRUZAMENTO da linha, nao no quadro do evento —
           depois de entrar, a bola segue para dentro da rede e sai de tras das
           traves, e ler a posicao no `_emit` reprova gols legitimos.
           E ela e ADIADA um quadro de proposito: o `_emit` acontece DENTRO do
           `step`, e a contabilidade do cruzamento roda depois dele. Conferir
           agora reprovaria justamente o gol cujo cruzamento e deste quadro —
           que foi o segundo alarme falso deste oraculo. */
        golPendente = { t: Number(sim.t) || 0 };
      }
      if (t === 'foul' && d) abrirFalta(d);
      if (faltaAberta && (t === 'freekick' || t === 'penalty' || t === 'yellow' || t === 'red' ||
          t === 'falta_atras_cobrada' || t === 'falta_cobrada' || t === 'freekick_routine')) {
        faltaAberta.eventosDoLance.push(t);
      }
    } catch (_) {}
    return emitOriginal.apply(this, arguments);
  };

  /* ------------------------------------------------------ estado anterior */
  let bAnt = null, pAnt = null, minAnt = 0, halfAnt = 1, halfAntC4 = 1;
  let placarAnt = [0, 0], statsAnt = null;
  let ultimoEventoT = 0, relogioMudouT = 0, donoAtual = null, donoDesde = 0;
  let bolaLargadaDesde = null, vooDesde = null, vooAnt = false;
  let pausaAberta = null, eventosRecentes = [];
  /* SONDA DE LANCE DE FALTA — nao e violacao, e medicao. Existe porque as
     tres queixas do dono sobre falta ("acontece do nada", "a hora e nada a
     ver", "o jogador sai andando em vez de bater") sao afirmacoes sobre o
     LANCE, e lance nao aparece em nenhum contador do motor. */
  const faltas = [];
  let faltaAberta = null;
  const recolocacoes = [];
  const reinicios = [];                 // { tipo, erro }
  let piscadas = 0;                     // janelas de dead sem reinicio nenhum
  let foraDesde = null, golT = -99;
  /* D8 — a faixa cinzenta do `dead`. */
  const cinza = { quadros: 0, segundos: 0, episodios: 0, metrosDeBola: 0, maiorEpisodio: 0 };
  let cinzaDesde = null, cinzaMetros = 0;
  /* deslocamento da bola NESTE quadro, capturado antes de `bAnt` virar o
     quadro atual. Ler `bAnt` depois disso mede sempre zero — foi assim que a
     primeira versao de D8 nao achou nada que ela mesma tinha visto. */
  let andouNoQuadro = 0;
  let ultimoCruzamento = null;     // { y, z, t } — onde a bola passou a linha de gol
  let golPendente = null;          // gol a conferir no proximo quadro
  let velAnt = 0;                  // m/s do quadro anterior, para E2
  let prAnt = false;               // havia reinicio pendente no quadro anterior?
  const sobrepostos = new Map();        // "a:b" -> t de inicio
  let subsPorTime = [0, 0];
  const maxRestartFolga = 0.35;   // s de simulacao depois do reinicio em que salto ainda e legitimo
  let fimDeadT = -99;

  const passoOriginal = sim.step.bind(sim);
  sim.step = function (dt) {
    const r = passoOriginal(dt);
    quadro++;
    try { inspecionar(dt); } catch (e) {
      registrar('A3', { erroDoObservador: String((e && e.message) || e) });
    }
    return r;
  };

  function inspecionar(dt) {
    const b = sim.ball;
    const t = Number(sim.t) || 0;
    const dead = Number(sim.dead) || 0;
    const minuto = Number(sim.minute);

    acompanharFalta(t, dead);
    andouNoQuadro = 0;   /* o bloco da bola, logo abaixo, preenche este quadro */
    /* O reinicio ACONTECE no quadro em que o motor consome `pendingRestart`.
       Medir legalidade quando `dead` chega a zero pega tambem as piscadas da
       faixa cinzenta, em que reinicio nenhum ocorreu. */
    const _prAgora = !!sim.pendingRestart;
    if (prAnt && !_prAgora) conferirReinicio(pausaAberta ? rotular(pausaAberta.eventos) : rotular(eventosRecentes.map(e => e.t)));
    prAnt = _prAgora;

    /* ---- A3 estado ---- */
    if (!Number.isFinite(minuto) || !Number.isFinite(dead) ||
        !Number.isFinite(Number(sim.stoppage)) ||
        !Number.isFinite(sim.score[0]) || !Number.isFinite(sim.score[1])) {
      registrar('A3', { minute: sim.minute, dead: sim.dead, stoppage: sim.stoppage, score: sim.score.slice() });
    }

    /* ---- C2/C3 monotonia ---- */
    if (sim.score[0] < placarAnt[0] || sim.score[1] < placarAnt[1]) {
      registrar('C2', { antes: placarAnt.slice(), agora: sim.score.slice() });
    }
    placarAnt = sim.score.slice();
    if (sim.half === halfAnt && Number.isFinite(minuto) && minuto < minAnt - 1e-9) {
      registrar('C3', { antes: +minAnt.toFixed(3), agora: +minuto.toFixed(3) });
    }
    if (Math.abs(minuto - minAnt) > 1e-9) relogioMudouT = t;
    halfAntC4 = halfAnt; halfAnt = sim.half; minAnt = minuto;

    /* ---- D3 relogio parado com a bola viva ---- */
    if (dead <= 0 && t - relogioMudouT > LIM.relogioParadoMax) {
      registrar('D3', { paradoHa: +(t - relogioMudouT).toFixed(1) + ' s', minuto: minuto });
      relogioMudouT = t;
    }

    /* ---- D2 silencio ---- */
    if (t - ultimoEventoT > LIM.semEventoMax) {
      registrar('D2', { silencioDe: +(t - ultimoEventoT).toFixed(1) + ' s', dead: +dead.toFixed(2),
        temReinicio: !!sim.pendingRestart });
      ultimoEventoT = t;
    }

    /* ---- pausas de bola parada (SONDA, nao violacao) ---- */
    if (dead > 0 && !pausaAberta) {
      const rec = eventosRecentes.filter(e => t - e.quando <= 0.8).map(e => e.t);
      pausaAberta = { inicio: t, eventos: rec.slice(), minuto: minuto, tempo: sim.half,
        teveRestart: !!sim.pendingRestart };
    } else if (dead <= 0 && pausaAberta) {
      const dur = t - pausaAberta.inicio;
      pausaAberta.duracaoSim = +dur.toFixed(3);
      pausaAberta.tipo = rotular(pausaAberta.eventos);
      /* Uma janela de `dead` que nunca teve reinicio pendente NAO e uma pausa:
         e a piscada da faixa cinzenta (D8). Contar as duas juntas inflava as
         pausas por partida e inventava "reinicios ilegais" que nunca
         aconteceram. */
      if (pausaAberta.teveRestart) pausas.push(pausaAberta);
      else piscadas++;
      pausaAberta = null;
      fimDeadT = t;
    }
    if (pausaAberta && sim.pendingRestart) pausaAberta.teveRestart = true;
    /* ---- D1 bola morta eterna ---- */
    if (pausaAberta && t - pausaAberta.inicio > LIM.deadMax) {
      registrar('D1', { paradaHa: +(t - pausaAberta.inicio).toFixed(1) + ' s',
        rotulo: rotular(pausaAberta.eventos), dead: +dead.toFixed(2),
        temReinicio: !!sim.pendingRestart, waiting: !!sim.waiting });
      pausaAberta.inicio = t;   // nao repete a cada quadro
    }

    /* ---- bola ---- */
    if (b) {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z) ||
          !Number.isFinite(b.vx) || !Number.isFinite(b.vy) || !Number.isFinite(b.vz)) {
        registrar('A1', { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, kind: b.kind });
      } else {
        if (b.x < -LIM.campoFolgaBola || b.x > FL + LIM.campoFolgaBola ||
            b.y < -LIM.campoFolgaBola || b.y > FW + LIM.campoFolgaBola) {
          registrar('B1', { x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2),
            traveling: !!b.traveling, kind: b.kind });
        }
        if (b.z < -0.05) registrar('B2', { z: +b.z.toFixed(3), kind: b.kind });
        if (b.z > LIM.alturaMax) registrar('B3', { z: +b.z.toFixed(2), kind: b.kind });

        if (bAnt) {
          const d = Math.hypot(b.x - bAnt.x, b.y - bAnt.y);
          andouNoQuadro = d;
          const vel = dt > 0 ? d / dt : 0;
          const janelaAdmin = dead > 0 || bAnt.dead > 0 || (t - fimDeadT) < maxRestartFolga;
          /* cruzamento das linhas de gol, interpolado no quadro.
             `<= 0` e nao `< 0`: a bola passa exatamente por x = 0 com
             frequencia suficiente para o teste estrito perder o cruzamento. */
          for (const gx of [0, FL]) {
            if (bAnt.x !== b.x && (bAnt.x - gx) * (b.x - gx) <= 0) {
              const f = (gx - bAnt.x) / (b.x - bAnt.x);
              ultimoCruzamento = { y: bAnt.y + (b.y - bAnt.y) * f,
                z: (bAnt.z || 0) + ((b.z || 0) - (bAnt.z || 0)) * f, t: t };
            }
          }
          /* E2 — a bola ganha velocidade no ar sem ninguem tocar nela */
          if (b.traveling && (b.z || 0) > 0.15 && velAnt > 1 &&
              vel > velAnt * 1.6 + 2 && (t - ultimoEventoT) > 0.08) {
            registrar('E2', { de: +velAnt.toFixed(1) + ' m/s', para: +vel.toFixed(1) + ' m/s',
              z: +(b.z || 0).toFixed(2), kind: b.kind });
          }
          velAnt = vel;
          if (b.traveling && vel > LIM.velBola && !janelaAdmin) {
            registrar('E1', { velocidade: +vel.toFixed(1) + ' m/s', kind: b.kind,
              de: [+bAnt.x.toFixed(1), +bAnt.y.toFixed(1)], para: [+b.x.toFixed(1), +b.y.toFixed(1)] });
          }
          if (janelaAdmin && d > 1.0) {
            /* RECOLOCACAO ADMINISTRATIVA: no quadro do reinicio a bola muda de
               lugar de graca. E legitimo (alguem a pegou e a levou ate o
               ponto), mas o olho nao ve nada disso: ela pisca de um lugar para
               o outro. Aqui fica MEDIDO — e acima do teto vira achado. */
            recolocacoes.push(+d.toFixed(2));
            if (d > LIM.recolocacaoMax) {
              registrar('B8', { salto: +d.toFixed(1) + ' m', kind: b.kind,
                de: [+bAnt.x.toFixed(1), +bAnt.y.toFixed(1)], para: [+b.x.toFixed(1), +b.y.toFixed(1)],
                rotulo: pausaAberta ? rotular(pausaAberta.eventos) : 'fora de pausa' });
            }
          }
          if (!b.traveling && !janelaAdmin && d > LIM.saltoBola) {
            registrar('B7', { salto: +d.toFixed(2) + ' m', kind: b.kind, dono: !!b.owner,
              de: [+bAnt.x.toFixed(1), +bAnt.y.toFixed(1)], para: [+b.x.toFixed(1), +b.y.toFixed(1)] });
          }
        }
        /* ---- E4 voo sem fim ---- */
        if (b.traveling && !vooAnt) vooDesde = t;
        if (b.traveling && vooDesde != null && t - vooDesde > LIM.vooMax) {
          registrar('E4', { voando: +(t - vooDesde).toFixed(1) + ' s', kind: b.kind,
            z: +b.z.toFixed(2) });
          vooDesde = t;
        }
        vooAnt = !!b.traveling;

        /* ---- C8/C9 dono ---- */
        const dono = b.owner;
        if (dono) {
          if (dono.red) registrar('C9', { atleta: nomeDe(dono), time: dono.team });
          if (!b.traveling && Number.isFinite(dono.x)) {
            const dd = Math.hypot(dono.x - b.x, dono.y - b.y);
            if (dd > LIM.donoLonge && dead <= 0) {
              registrar('C8', { distancia: +dd.toFixed(2) + ' m', atleta: nomeDe(dono), kind: b.kind });
            }
          }
          if (dono !== donoAtual) { donoAtual = dono; donoDesde = t; }
          else if (t - donoDesde > LIM.posseMax) {
            registrar('D5', { comOMesmo: +(t - donoDesde).toFixed(1) + ' s', atleta: nomeDe(dono) });
            donoDesde = t;
          }
          bolaLargadaDesde = null;
        } else {
          donoAtual = null;
          const parada = Math.hypot(b.vx || 0, b.vy || 0) < 0.15 && !b.traveling;
          if (parada && dead <= 0) {
            if (bolaLargadaDesde == null) bolaLargadaDesde = t;
            else if (t - bolaLargadaDesde > LIM.bolaLargadaMax) {
              registrar('D6', { largadaHa: +(t - bolaLargadaDesde).toFixed(1) + ' s',
                x: +b.x.toFixed(1), y: +b.y.toFixed(1) });
              bolaLargadaDesde = t;
            }
          } else bolaLargadaDesde = null;
        }
        bAnt = { x: b.x, y: b.y, z: b.z, dead: dead };
      }
    }

    /* ---- C16 o gol do quadro anterior, agora com o cruzamento contabilizado ---- */
    if (golPendente) {
      const c = ultimoCruzamento;
      if (c && Math.abs(c.t - golPendente.t) <= 1.0) {
        if (Math.abs(c.y - FW / 2) > 3.66 + 0.3 || c.z > 2.44 + 0.3) {
          registrar('C16', { motivo: 'cruzou fora da baliza',
            yNoCruzamento: +c.y.toFixed(2), zNoCruzamento: +c.z.toFixed(2),
            postes: [30.34, 37.66], travessao: 2.44,
            /* o tipo do lance e o que separa "gol invalido" de "gol resolvido
               fora da geometria" — sem isto o achado nao diz onde consertar */
            lance: eventosRecentes.filter(e => t - e.quando <= 3).map(e => e.t).slice(-8) });
        }
        golPendente = null;
      } else if (t - golPendente.t > 0.4) {
        registrar('C16', { motivo: 'gol sem cruzamento de linha' });
        golPendente = null;
      }
    }

    /* ---- D8 bola morta com o jogo andando ----
       O nucleo ja desistiu do lance (retorna antes da fisica e da decisao),
       mas alguem continua movendo a bola e o relogio esta parado. */
    if (b && Number.isFinite(b.x)) {
      const andou = andouNoQuadro;
      const naFaixa = dead > 0 && dead <= LIM.deadVivo && andou > 0.05 && !b.traveling;
      if (naFaixa) {
        cinza.quadros++; cinza.segundos += dt; cinza.metrosDeBola += andou;
        if (cinzaDesde == null) { cinzaDesde = t; cinzaMetros = 0; }
        cinzaMetros += andou;
      } else if (cinzaDesde != null) {
        const dur = t - cinzaDesde;
        cinza.episodios++;
        if (dur > cinza.maiorEpisodio) cinza.maiorEpisodio = dur;
        if (dur >= LIM.deadVivoMin) {
          registrar('D8', { duracao: +dur.toFixed(2) + ' s', bolaAndou: +cinzaMetros.toFixed(1) + ' m',
            relogioParadoEm: +(Number(sim.minute) || 0).toFixed(2),
            adiantoDeTela: '3,5x sobre o botao' });
        }
        cinzaDesde = null;
      }
    }

    /* ---- C11 bola fora das linhas com o jogo rolando ---- */
    if (b && Number.isFinite(b.x)) {
      const fora = b.x < -0.2 || b.x > FL + 0.2 || b.y < -0.2 || b.y > FW + 0.2;
      if (fora && dead <= 0 && (t - golT) > 2) {
        if (foraDesde == null) foraDesde = t;
        else if (t - foraDesde > LIM.foraDeJogoMax) {
          registrar('C11', { foraHa: +(t - foraDesde).toFixed(1) + ' s',
            x: +b.x.toFixed(2), y: +b.y.toFixed(2), traveling: !!b.traveling,
            dono: b.owner ? nomeDe(b.owner) : null });
          foraDesde = t;
        }
      } else foraDesde = null;
    }

    /* ---- C13 corpos sobrepostos (a cada 6 quadros: 0,2 s) ---- */
    if (quadro % 6 === 0) {
      const todos = [];
      for (let s2 = 0; s2 < 2; s2++) {
        for (const p of sim.teams[s2].players) {
          if (p && !p.red && Number.isFinite(p.x)) todos.push(p);
        }
      }
      const vistos = new Set();
      for (let a = 0; a < todos.length; a++) {
        for (let b2 = a + 1; b2 < todos.length; b2++) {
          const pa = todos[a], pb = todos[b2];
          if (Math.abs(pa.x - pb.x) > LIM.sobreposicao) continue;
          if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > LIM.sobreposicao) continue;
          const k = pa.team + ':' + pa.idx + '|' + pb.team + ':' + pb.idx;
          vistos.add(k);
          const desde = sobrepostos.get(k);
          if (desde == null) sobrepostos.set(k, t);
          else if (t - desde > LIM.sobreposicaoMax) {
            registrar('C13', { a: nomeDe(pa), b: nomeDe(pb),
              juntosHa: +(t - desde).toFixed(1) + ' s',
              distancia: +Math.hypot(pa.x - pb.x, pa.y - pb.y).toFixed(2) + ' m',
              mesmoTime: pa.team === pb.team });
            sobrepostos.set(k, t);
          }
        }
      }
      for (const k of Array.from(sobrepostos.keys())) if (!vistos.has(k)) sobrepostos.delete(k);
    }

    /* ---- atletas ---- */
    const janelaAdminAtleta = dead > 0 || (t - fimDeadT) < maxRestartFolga;
    let novoPAnt = pAnt ? pAnt : new Map();
    if (!pAnt) pAnt = novoPAnt;
    for (let s = 0; s < 2; s++) {
      const tm = sim.teams[s];
      let emCampo = 0;
      for (const p of tm.players) {
        if (!p) continue;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) ||
            !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) {
          registrar('A2', { atleta: nomeDe(p), x: p.x, y: p.y, vx: p.vx, vy: p.vy });
          continue;
        }
        if (!p.red) emCampo++;
        const st = Number(p.stamina);
        if (!Number.isFinite(st) || st < -0.01 || st > 100.01) {
          registrar('A4', { atleta: nomeDe(p), stamina: p.stamina });
        }
        const rt = Number(p.rating);
        if (Number.isFinite(rt) && (rt < 0 || rt > 10)) {
          registrar('A5', { atleta: nomeDe(p), rating: p.rating });
        }
        if (!p.red && (p.x < -LIM.campoFolgaAtleta || p.x > FL + LIM.campoFolgaAtleta ||
            p.y < -LIM.campoFolgaAtleta || p.y > FW + LIM.campoFolgaAtleta)) {
          registrar('B4', { atleta: nomeDe(p), x: +p.x.toFixed(1), y: +p.y.toFixed(1) });
        }
        if (p.yellow >= 2 && !p.red) registrar('C7', { atleta: nomeDe(p), amarelos: p.yellow });

        const ant = pAnt.get(p);
        if (ant) {
          const d = Math.hypot(p.x - ant.x, p.y - ant.y);
          if (p.red && d > 0.05) {
            /* A troca de lados do intervalo espelha TODOS os atletas
               (`_switchSides`), inclusive os expulsos — enquanto
               `_resetPositions` pula os expulsos. E inconsistencia real, mas
               nao e "o expulso voltou a jogar": vira C4b, gravidade menor. */
            if (sim.half !== halfAntC4) registrar('C4b', { atleta: nomeDe(p), andou: +d.toFixed(2) + ' m', onde: 'troca de lados' });
            else registrar('C4', { atleta: nomeDe(p), andou: +d.toFixed(2) + ' m no quadro' });
          }
          if (!p.red && !janelaAdminAtleta && d > LIM.saltoAtleta) {
            registrar('B6', { atleta: nomeDe(p), salto: +d.toFixed(2) + ' m',
              de: [+ant.x.toFixed(1), +ant.y.toFixed(1)], para: [+p.x.toFixed(1), +p.y.toFixed(1)],
              dead: +dead.toFixed(2) });
          }
        }
        pAnt.set(p, { x: p.x, y: p.y });
      }
      if (emCampo > 11) registrar('C5', { time: s, emCampo: emCampo });
    }

    /* ---- F1 contadores (1x por segundo de simulacao) ---- */
    if (quadro % 30 === 0) {
      if (statsAnt) {
        for (let s = 0; s < 2; s++) {
          const a = statsAnt[s], b2 = sim.stats[s];
          for (const k of Object.keys(b2)) {
            const v = b2[k], w = a[k];
            if (typeof v === 'number' && typeof w === 'number' && v < w - 1e-9) {
              registrar('F1', { time: s, chave: k, antes: w, agora: v });
            }
          }
        }
      }
      statsAnt = [copiaNumerica(sim.stats[0]), copiaNumerica(sim.stats[1])];
    }
  }

  /* CONTATO = houve um desafio VISIVEL nos 0,6 s antes do apito.
     A lista e a dos eventos que produzem gesto na tela. Falta sem nenhum
     deles e falta que, para quem assiste, saiu do nada. */
  const EVENTOS_DE_CONTATO = ['tackle_attempt', 'tackle', 'tackle_missed', 'dribble',
    'loose_duel', 'touchline_duel', 'containment', 'pressure', 'action_contact',
    'visual_contact', 'aerial_duel'];

  function abrirFalta(d) {
    const t = Number(sim.t) || 0;
    const by = d.by, on = d.on;
    const recentes = eventosRecentes.filter(e => t - e.quando <= 0.6).map(e => e.t);
    const contato = recentes.filter(e => EVENTOS_DE_CONTATO.indexOf(e) !== -1);
    const dist = (by && on && Number.isFinite(by.x) && Number.isFinite(on.x))
      ? Math.hypot(by.x - on.x, by.y - on.y) : null;
    const b = sim.ball;
    faltaAberta = {
      t: t, minuto: +(Number(sim.minute) || 0).toFixed(2), tempo: sim.half,
      infrator: by ? nomeDe(by) : null, vitima: on ? nomeDe(on) : null,
      distanciaNoApito: dist == null ? null : +dist.toFixed(2),
      contatoVisivel: contato.length > 0, eventosAntes: recentes.slice(-4),
      ponto: on && Number.isFinite(on.x) ? [+on.x.toFixed(1), +on.y.toFixed(1)] : null,
      bolaNoApito: b ? [+b.x.toFixed(1), +b.y.toFixed(1)] : null,
      eventosDoLance: [], fase: 'apito',
      esperaSim: null, saidaEm: null, desfecho: null,
      bolaNoPonto: null, cobradorNoPonto: null,
    };
    faltas.push(faltaAberta);
    if (faltas.length > 400) faltas.shift();
  }

  /* Depois do apito o lance tem duas perguntas, e as duas sao medidas aqui:
       1. quanto tempo o jogo ficou parado ate a bola voltar a andar;
       2. a bola voltou BATIDA (voo) ou CARREGADA (o cobrador saiu andando)? */
  function acompanharFalta(t, dead) {
    const f = faltaAberta;
    if (!f) return;
    const b = sim.ball;
    if (f.fase === 'apito') {
      if (dead <= 0) {
        f.esperaSim = +(t - f.t).toFixed(2);
        f.fase = 'reiniciado';
        f.reinicioEm = t;
        f.donoNoReinicio = b && b.owner ? nomeDe(b.owner) : null;
        f.posDonoNoReinicio = b && b.owner ? [b.owner.x, b.owner.y] : null;
        if (b && f.ponto) f.bolaNoPonto = +Math.hypot(b.x - f.ponto[0], b.y - f.ponto[1]).toFixed(2);
        if (b && b.owner && f.ponto) {
          f.cobradorNoPonto = +Math.hypot(b.owner.x - f.ponto[0], b.owner.y - f.ponto[1]).toFixed(2);
        }
      } else if (t - f.t > 25) { f.fase = 'perdida'; faltaAberta = null; }
      return;
    }
    if (f.fase === 'reiniciado') {
      if (b && b.traveling) {
        f.desfecho = 'batida';
        f.saidaEm = +(t - f.reinicioEm).toFixed(2);
        f.fase = 'fim'; faltaAberta = null; return;
      }
      if (b && b.owner && f.posDonoNoReinicio) {
        const andou = Math.hypot(b.owner.x - f.posDonoNoReinicio[0], b.owner.y - f.posDonoNoReinicio[1]);
        if (andou > 3.0) {
          f.desfecho = 'carregou';
          f.saidaEm = +(t - f.reinicioEm).toFixed(2);
          f.andouCom = +andou.toFixed(1);
          f.fase = 'fim'; faltaAberta = null; return;
        }
      }
      if (t - f.reinicioEm > 6) {
        f.desfecho = 'nem_bateu_nem_andou';
        f.fase = 'fim'; faltaAberta = null;
      }
    }
  }

  /* O PONTO LEGAL DE CADA REINICIO. Medido no quadro em que a bola volta a
     rolar — nao antes, porque ate ali ela ainda esta sendo colocada. */
  const QUINAS = [[0, 0], [0, FW], [FL, 0], [FL, FW]];
  const MARCAS = [[11, FW / 2], [FL - 11, FW / 2]];
  function conferirReinicio(tipo) {
    const b = sim.ball;
    if (!b || !Number.isFinite(b.x)) return;
    let erro = null, ondeDeveria = null;
    if (tipo === 'corner') {
      erro = Math.min.apply(null, QUINAS.map(q => Math.hypot(b.x - q[0], b.y - q[1])));
      ondeDeveria = 'quina do campo';
    } else if (tipo === 'throw_in') {
      erro = Math.min(Math.abs(b.y - 0), Math.abs(b.y - FW));
      ondeDeveria = 'linha lateral';
    } else if (tipo === 'goal_kick') {
      const dentroX = Math.min(Math.max(0, b.x - 16.5), Math.max(0, (FL - 16.5) - b.x));
      const dentroY = Math.max(0, Math.abs(b.y - FW / 2) - 20.15);
      erro = Math.hypot(dentroX, dentroY);
      ondeDeveria = 'grande area';
    } else if (tipo === 'penalty') {
      erro = Math.min.apply(null, MARCAS.map(q => Math.hypot(b.x - q[0], b.y - q[1])));
      ondeDeveria = 'marca do penalti';
    } else return;
    /* O PONTAPE DE SAIDA FICA DE FORA, DE PROPOSITO.
       Medi-lo daria 10 a 20 m de erro — e o numero seria mentira: entre a
       cerimonia do gol (OS-263), a volta para casa (OS-214) e o proprio
       pontape, o instante do reinicio deixa de ser identificavel por
       `pendingRestart`. Ate existir uma marca explicita de "a bola voltou a
       rolar no circulo", este oraculo nao tem como julgar. Buraco conhecido e
       melhor que numero inventado. */
    reinicios.push({ tipo, erro: +erro.toFixed(2) });
    if (erro > LIM.reinicioFolga) {
      registrar('C10', { reinicio: tipo, deveriaSairDe: ondeDeveria,
        erro: +erro.toFixed(1) + ' m', bola: [+b.x.toFixed(1), +b.y.toFixed(1)] });
    }
  }

  function rotular(evs) {
    for (const p of PRIORIDADE) if (evs.indexOf(p) !== -1) return p;
    return evs.length ? evs[evs.length - 1] : 'sem_evento';
  }

  /* ------------------------------------------------------------ fim de jogo */
  function finalizar(passos, terminou) {
    if (!terminou) {
      registrar('D7', { passos: passos, minuto: +(Number(sim.minute) || 0).toFixed(1),
        dead: +(Number(sim.dead) || 0).toFixed(2), temReinicio: !!sim.pendingRestart });
    }
    /* C1 placar x eventos */
    const golsA = golsSeq.filter(g => g.time === 0).length;
    const golsB = golsSeq.filter(g => g.time === 1).length;
    if (golsA !== sim.score[0] || golsB !== sim.score[1]) {
      registrar('C1', { placar: sim.score.slice(), eventosDeGol: [golsA, golsB] });
    }
    /* C6 substituicoes */
    subsPorTime = [0, 0];
    for (let s = 0; s < 2; s++) {
      const tm = sim.teams[s];
      if (Number.isFinite(tm.subsLeft) && tm.subsLeft < 0) {
        registrar('C6', { time: s, subsLeft: tm.subsLeft });
      }
    }
    /* F2 aritmetica dos contadores */
    const PARES = [['passOk', 'passes'], ['onTarget', 'shots'], ['goals', 'onTarget'],
      ['crossesOk', 'crosses'], ['throughOk', 'throughBalls'], ['lowCrossesOk', 'lowCrosses'],
      ['dribblesCompleted', 'dribblesAttempted'], ['setPieceGoals', 'setPieceShots'],
      ['gkClaimsWon', 'gkClaimsAttempted'], ['penaltiesScored', 'penaltiesTaken']];
    for (let s = 0; s < 2; s++) {
      const st = sim.stats[s];
      for (const [a, b2] of PARES) {
        if (typeof st[a] === 'number' && typeof st[b2] === 'number' && st[a] > st[b2] + 1e-9) {
          registrar('F2', { time: s, regra: `${a} <= ${b2}`, valores: [st[a], st[b2]] });
        }
      }
      if (typeof st.xg === 'number' && st.xg > st.shots + 1e-6) {
        registrar('F2', { time: s, regra: 'xg <= shots', valores: [+st.xg.toFixed(2), st.shots] });
      }
      if (typeof st.xg === 'number' && st.xg < -1e-9) {
        registrar('F2', { time: s, regra: 'xg >= 0', valores: [st.xg] });
      }
    }
    /* F4 o motor acusando a si mesmo.
       Separado por natureza: o que e defeito em qualquer quantidade, e o que
       so e defeito em excesso. Misturar os dois fazia toda partida acusar. */
    const vi = sim.visualIntegrity || {};
    const acusacoes = {};
    for (const k of ['teleports', 'travelFaults', 'verticalFailures', 'presentationFaults', 'frameFaults', 'timelineFaults']) {
      if (Number(vi[k]) > 0) acusacoes[k] = Number(vi[k]);
    }
    const _cont = Number(vi.contacts) || 0, _falhos = Number(vi.failedContacts) || 0;
    if (_cont > 50 && _falhos / _cont > 0.03) {
      acusacoes.failedContacts = _falhos;
      acusacoes.fracaoDeContatosReprovados = +(_falhos / _cont).toFixed(4);
    }
    if (Object.keys(acusacoes).length) registrar('F4', acusacoes);

    /* --------- sondas agregadas da partida --------- */
    const porTipo = Object.create(null);
    let deadTotal = 0;
    for (const p of pausas) {
      deadTotal += p.duracaoSim || 0;
      const k = p.tipo || 'sem_evento';
      (porTipo[k] = porTipo[k] || []).push(p.duracaoSim || 0);
    }
    const cerimonia = {};
    for (const k of Object.keys(porTipo).sort()) {
      const v = porTipo[k];
      cerimonia[k] = { n: v.length, somaSim: +v.reduce((a, b2) => a + b2, 0).toFixed(2),
        p50: pct(v, 0.5), p90: pct(v, 0.9), max: +Math.max.apply(null, v).toFixed(3) };
    }
    return {
      violacoes, contagem, eventos, golsSeq,
      sondas: {
        piscadasDeDead: piscadas,
        deadComJogoAndando: {
          segundos: +cinza.segundos.toFixed(1),
          quadros: cinza.quadros,
          episodios: cinza.episodios,
          metrosDeBola: +cinza.metrosDeBola.toFixed(1),
          maiorEpisodio: +cinza.maiorEpisodio.toFixed(2),
        },
        legalidadeDoReinicio: (function () {
          const porTipo = Object.create(null);
          for (const r of reinicios) (porTipo[r.tipo] = porTipo[r.tipo] || []).push(r.erro);
          const out = {};
          for (const k of Object.keys(porTipo).sort()) {
            const v = porTipo[k];
            out[k] = { n: v.length, p50: pct(v, .5), p90: pct(v, .9),
              max: +Math.max.apply(null, v).toFixed(2), bruto: v };
          }
          return out;
        })(),
        recolocacaoDaBola: recolocacoes.length ? {
          n: recolocacoes.length, p50: pct(recolocacoes, .5), p90: pct(recolocacoes, .9),
          max: +Math.max.apply(null, recolocacoes).toFixed(2),
          bruto: recolocacoes,
        } : { n: 0 },
        falta: resumoDeFaltas(faltas),
        faltasDetalhe: faltas.slice(0, 40),
        pausas: pausas.length,
        segundosMortos: +deadTotal.toFixed(1),
        cerimonia,
        visualIntegrity: Object.assign({}, vi),
      }
    };
  }

  return { finalizar };
}

/* O resumo por partida. A agregacao entre partidas fica no runner. */
function resumoDeFaltas(faltas) {
  const n = faltas.length;
  if (!n) return { n: 0 };
  const semContato = faltas.filter(f => !f.contatoVisivel).length;
  const dists = faltas.map(f => f.distanciaNoApito).filter(v => v != null);
  const esperas = faltas.map(f => f.esperaSim).filter(v => v != null);
  const saidas = faltas.map(f => f.saidaEm).filter(v => v != null);
  const noPonto = faltas.map(f => f.bolaNoPonto).filter(v => v != null);
  const desfechos = {};
  for (const f of faltas) { const k = f.desfecho || f.fase; desfechos[k] = (desfechos[k] || 0) + 1; }
  return {
    n,
    semContatoVisivel: semContato,
    fracaoSemContato: +(semContato / n).toFixed(3),
    distanciaNoApito: { p50: pct(dists, 0.5), p90: pct(dists, 0.9), max: dists.length ? +Math.max.apply(null, dists).toFixed(2) : null },
    esperaSim: { p50: pct(esperas, 0.5), p90: pct(esperas, 0.9), max: esperas.length ? +Math.max.apply(null, esperas).toFixed(2) : null },
    saidaAposReinicioSim: { p50: pct(saidas, 0.5), p90: pct(saidas, 0.9) },
    bolaNoPontoM: { p50: pct(noPonto, 0.5), p90: pct(noPonto, 0.9), max: noPonto.length ? +Math.max.apply(null, noPonto).toFixed(2) : null },
    desfechos,
    /* cru, para o runner juntar as partidas antes de tirar percentil:
       percentil de percentil mente. */
    bruto: { dists, esperas, saidas, noPonto },
  };
}

function copiaNumerica(o) {
  const r = {};
  for (const k of Object.keys(o)) if (typeof o[k] === 'number') r[k] = o[k];
  return r;
}
function nomeDe(p) {
  try { return (p.ref && p.ref.n) ? `${p.ref.n} (${p.slotPos})` : `#${p.idx} ${p.slotPos}`; }
  catch (_) { return '?'; }
}

module.exports = { CATALOGO, PORID, LIM, criarObservador, pct };
