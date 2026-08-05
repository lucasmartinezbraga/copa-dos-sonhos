#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-108 · ONDE FORAM OS 1,56 CHUTES DA OS-107
 * =================================================
 * A OS-107 poe o time na area (medido) e custa 1,5556 chute por partida,
 * NEGATIVO NAS SEIS BASES -- o unico efeito que sobreviveu a 288 partidas.
 * Esta e a pergunta que destrava a rodada, e ela nao foi respondida.
 *
 * O QUE JA SE SABE, E QUE ELIMINA A SUSPEITA MAIS OBVIA
 *   `:4859` -- o ramo de bola morta de `step` faz `return` ANTES do bloco de
 *   stamina (`:4912`) e antes do relogio. Logo a bola morta nao gasta folego
 *   nem minuto: alongar `dead` e pinar jogador **nao** cansa ninguem. A
 *   hipotese de fadiga esta morta antes de custar uma rodada.
 *
 * AS TRES HIPOTESES QUE SOBRAM, registradas antes de medir
 *   H1  o chute some NA BOLA PARADA -- a area lotada converte menos primeiro
 *       contato em finalizacao;
 *   H2  o chute some LOGO DEPOIS do reinicio -- o time que ataca fica com 2-3
 *       jogadores dentro da area e perde a bola / nao sustenta a pressao;
 *   H3  o chute some NO JOGO CORRIDO inteiro -- entao a causa nao e o lance, e
 *       sim alguma coisa global que a OS-107 mexeu sem querer.
 *
 * H1 e H2 sao consertaveis dentro da rodada. H3 mata o patch.
 *
 * COMO ELE MEDE
 *   O relogio so anda com `dead <= 0` (`:4859`), entao TEMPO VIVO e a unica
 *   base de comparacao honesta. Todo chute e atribuido a uma fase:
 *     bola_parada     ... ate 2,5 s de tempo vivo apos o reinicio de escanteio
 *                         ou falta cruzada (a janela do cruzamento)
 *     pos_reiniciо    ... de 2,5 s a 12 s apos o mesmo reinicio
 *     jogo_corrido    ... todo o resto
 *   E mede retencao de posse em +2, +5 e +10 s de tempo vivo apos o reinicio.
 *
 * Nao patcha nada, nao consome RNG.
 *
 * Uso: node diag_os108_onde_foram_os_chutes.js --build=<html> [--matches=24]
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(i => {
  const [k, v] = i.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const noop = () => {};
const D = (n, v) => { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } };
D('window', global); D('self', global);
D('navigator', { userAgent: 'cds', language: 'pt-BR' });
D('location', { href: 'runner://os108', search: '', hash: '' });
D('performance', { now: () => 0 }); D('crypto', crypto.webcrypto);
D('requestAnimationFrame', () => 0); D('cancelAnimationFrame', noop);
D('addEventListener', noop); D('removeEventListener', noop);
D('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
D('alert', noop); D('confirm', () => true); D('prompt', () => null);
D('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
D('sessionStorage', global.localStorage); D('CanvasRenderingContext2D', undefined);
D('HTMLElement', function () {}); D('HTMLCanvasElement', function () {});
D('Image', function () {}); D('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
D('__showBootError', noop); D('__cdsDebugWarn', noop); D('CDS_DEBUG', false);
const real = console;
global.console = { log: noop, warn: noop, error: noop };
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
                      'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
if (!argv.build) { real.error('ABORTA: informe --build=<html>'); process.exit(1); }
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('script-' + idx); idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(m[2], { filename: id + '.js' }); } catch (_) {}
}

const P = MatchSim.prototype;
const DT = 1 / 30;
const JANELA_CRUZAMENTO = 2.5;   // s de tempo vivo: a bola do escanteio ainda esta no ar
const JANELA_POS = 12.0;         // s de tempo vivo: a posse que nasce do lance

const acc = {
  partidas: 0, tempoVivo: 0,
  chutes: { bola_parada: 0, pos_reinicio: 0, jogo_corrido: 0 },
  tempo:  { bola_parada: 0, pos_reinicio: 0, jogo_corrido: 0 },
  reinicios: 0, reiniciosEscanteio: 0, reiniciosFalta: 0,
  posse: { t2: [0, 0], t5: [0, 0], t10: [0, 0] },   // [manteve, total]
  distanciaPorJogador: [], staminaFinal: []
};

let pend = null;      // tipo de bola parada armada, esperando o reinicio
let lance = null;     // { time, vivoNoReinicio }
let vivo = 0;         // tempo vivo acumulado da partida
let chutesAntes = 0;
let posAnterior = null;
let distancia = null;

function somaChutes(sim) {
  const s = sim.stats || [];
  return ((s[0] && s[0].shots) | 0) + ((s[1] && s[1].shots) | 0);
}

const oCorner = P._setCorner;
P._setCorner = function (team) {
  const r = oCorner.apply(this, arguments);
  if (team === 0 || team === 1) pend = { tipo: 'escanteio', team };
  return r;
};
const oFK = P._freeKick;
P._freeKick = function (team, x, y, input) {
  const s = this.stats && this.stats[team];
  const antes = s ? (s.freeKickCrossed | 0) : null;
  const r = oFK.apply(this, arguments);
  if (s && antes !== null && (s.freeKickCrossed | 0) > antes) pend = { tipo: 'falta_cruzada', team };
  return r;
};

const oStep = P.step;
P.step = function (dt) {
  const morta = (Number(this.dead) || 0) > 0;
  const r = oStep.apply(this, arguments);
  const d = Number(dt) || DT;

  /* o reinicio aconteceu neste quadro: estava morta, ficou viva */
  if (morta && !((Number(this.dead) || 0) > 0) && pend) {
    lance = { tipo: pend.tipo, team: pend.team, vivo0: vivo };
    acc.reinicios++;
    if (pend.tipo === 'escanteio') acc.reiniciosEscanteio++; else acc.reiniciosFalta++;
    pend = null;
  }

  if (!((Number(this.dead) || 0) > 0)) {
    vivo += d;
    /* distancia percorrida, so no tempo vivo */
    if (distancia) {
      for (const tm of this.teams) for (const p of tm.players) {
        if (!p || p.red || p.isGK) continue;
        const z = distancia.get(p);
        if (z) { z.d += Math.hypot(p.x - z.x, p.y - z.y); }
        distancia.set(p, { x: p.x, y: p.y, d: z ? z.d : 0 });
      }
    }
    let fase = 'jogo_corrido';
    if (lance) {
      const dv = vivo - lance.vivo0;
      if (dv <= JANELA_CRUZAMENTO) fase = 'bola_parada';
      else if (dv <= JANELA_POS) fase = 'pos_reinicio';
      else lance = null;
      /* retencao de posse */
      if (lance) {
        const dono = this.ball && this.ball.owner;
        for (const [rot, lim] of [['t2', 2], ['t5', 5], ['t10', 10]]) {
          if (!lance['fez_' + rot] && dv >= lim) {
            lance['fez_' + rot] = true;
            acc.posse[rot][1]++;
            if (dono && dono.team === lance.team) acc.posse[rot][0]++;
          }
        }
      }
    }
    acc.tempo[fase] += d;
    const agora = somaChutes(this);
    if (agora > chutesAntes) acc.chutes[fase] += (agora - chutesAntes);
    chutesAntes = agora;
  }
  return r;
};

/* ------------------------------ a corrida ------------------------------- */
const db = buildDB(DATA);
const N = Number(argv.matches || 24);
const BASE = Number(argv.semente || 4200000);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(BASE + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  vivo = 0; chutesAntes = 0; lance = null; pend = null;
  distancia = new Map();
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(DT);
  acc.partidas++;
  acc.tempoVivo += vivo;
  let somaD = 0, nD = 0, somaS = 0, nS = 0;
  for (const [, z] of distancia) { somaD += z.d; nD++; }
  for (const tm of sim.teams) for (const p of tm.players) {
    if (p && !p.red && !p.isGK && Number.isFinite(p.stamina)) { somaS += p.stamina; nS++; }
  }
  if (nD) acc.distanciaPorJogador.push(somaD / nD);
  if (nS) acc.staminaFinal.push(somaS / nS);
}

const med = a => a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) : null;
const porPartida = v => +(v / acc.partidas).toFixed(4);
const porMinutoVivo = (c, t) => t > 0 ? +(c / (t / 60)).toFixed(4) : null;

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  sha256: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
  partidas: acc.partidas,
  tempo_vivo_por_partida_s: porPartida(acc.tempoVivo),
  chutes_por_partida_total: porPartida(acc.chutes.bola_parada + acc.chutes.pos_reinicio + acc.chutes.jogo_corrido),
  reinicios_por_partida: { total: porPartida(acc.reinicios), escanteio: porPartida(acc.reiniciosEscanteio), falta_cruzada: porPartida(acc.reiniciosFalta) },
  POR_FASE: ['bola_parada', 'pos_reinicio', 'jogo_corrido'].reduce((o, f) => {
    o[f] = {
      chutes_por_partida: porPartida(acc.chutes[f]),
      tempo_vivo_por_partida_s: porPartida(acc.tempo[f]),
      CHUTES_POR_MINUTO_VIVO: porMinutoVivo(acc.chutes[f], acc.tempo[f])
    };
    return o;
  }, {}),
  RETENCAO_DE_POSSE_apos_o_reinicio: {
    em_2s: acc.posse.t2[1] ? (100 * acc.posse.t2[0] / acc.posse.t2[1]).toFixed(1) + '% de ' + acc.posse.t2[1] : null,
    em_5s: acc.posse.t5[1] ? (100 * acc.posse.t5[0] / acc.posse.t5[1]).toFixed(1) + '% de ' + acc.posse.t5[1] : null,
    em_10s: acc.posse.t10[1] ? (100 * acc.posse.t10[0] / acc.posse.t10[1]).toFixed(1) + '% de ' + acc.posse.t10[1] : null
  },
  distancia_por_jogador_por_partida_m: med(acc.distanciaPorJogador),
  stamina_media_no_fim: med(acc.staminaFinal)
}, null, 1));
