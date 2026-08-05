#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-107 · O TIME VAI PARA O LANCE NO ESCANTEIO E NA FALTA?
 * ==============================================================
 * PROXIMA_RODADA.md · PARTE A · A1. Pedido do dono, com todas as letras:
 *
 *   "Quando acontecer o escanteio o time tem que ir pra area, mesma coisa a
 *    falta, isso voce esta pecando, o time nao se move para a direcao do lance
 *    igual em uma partida real."
 *
 * NADA foi medido nesta frente. Este e o CENSO, nao o patch. Ele nao escreve
 * posicao, nao consome RNG e nao muda desfecho.
 *
 * O que ele mede, ancorado no GOL e nao no alvo do jogador (HANDOFF §2.4):
 *
 *   1. SALTO NO APITO -- quanto cada jogador se desloca DENTRO da chamada de
 *      `_setCorner` / `_freeKick`. Se for grande, o time nao "vai" para a area:
 *      ele aparece la (HANDOFF §2.3). No escanteio a camada R15 (:18218) deveria
 *      zerar isso convertendo escrita em alvo caminhado; na falta cruzada
 *      (:6951) NAO existe camada equivalente.
 *   2. QUANTOS ENTRAM NA GRANDE AREA, dos dois times, no apito e no instante do
 *      reinicio.
 *   3. DISTANCIA DO BLOCO AO GOL do lance, dos dois times, no apito e no
 *      reinicio.
 *   4. QUANTO CADA UM ANDOU entre o apito e a cobranca.
 *   5. Quantos foram ARMADOS com `__spTarget` e quantos CHEGARAM.
 *
 * As tres hipoteses possiveis, registradas antes de medir:
 *   H1  a coreografia nao existe para o lance          -> ninguem recebe posto
 *   H2  existe e e desfeita pela IA tatica normal      -> armados, nao chegam
 *   H3  existe, chega, mas e pequena demais            -> chegam, area vazia
 *
 * Uso: node diag_os107_bloco_bola_parada.js --build=<html> [--matches=8]
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
D('location', { href: 'runner://os107', search: '', hash: '' });
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
const FLv = 105, FWv = 68;
const DT = 1 / 30;
const dd = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/* grande area: 16,5 m de profundidade a partir da linha de fundo, 40,32 m de
   largura centrada no gol. `g` e o gol de referencia do lance. */
function naArea(x, y, g) {
  const linha = g.x < FLv / 2 ? 0 : FLv;
  return Math.abs(x - linha) <= 16.5 && Math.abs(y - g.y) <= 20.16;
}
function foto(sim) {
  const f = [];
  for (const tm of sim.teams) for (const p of tm.players) {
    if (p && !p.red) f.push({ p, x: +p.x, y: +p.y });
  }
  return f;
}
function retrato(sim, lance) {
  const g = lance.gol;
  const r = { atkArea: 0, defArea: 0, atkDist: [], defDist: [], atkPerto25: 0, defPerto25: 0 };
  for (const tm of sim.teams) for (const p of tm.players) {
    if (!p || p.red || p.isGK) continue;
    const d = dd(p.x, p.y, g.x, g.y);
    const dentro = naArea(p.x, p.y, g);
    if (p.team === lance.team) { r.atkDist.push(d); if (dentro) r.atkArea++; if (d <= 25) r.atkPerto25++; }
    else { r.defDist.push(d); if (dentro) r.defArea++; if (d <= 25) r.defPerto25++; }
  }
  r.atkDistMedia = media(r.atkDist); r.defDistMedia = media(r.defDist);
  delete r.atkDist; delete r.defDist;
  return r;
}
const media = a => a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) : null;
const ord = a => a.slice().sort((x, y) => x - y);
const pc = (a, q) => a.length ? +ord(a)[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(3) : null;
const res = a => a.length ? { min: pc(a, 0), p25: pc(a, .25), mediana: pc(a, .5), p75: pc(a, .75), max: pc(a, .999), media: media(a) } : 'sem amostra';

const lances = [];
let atual = null;

/* os postos que a coreografia cria dentro da area, por nome */
const POSTO_AREA = new Set(['target_primary', 'target_secondary', 'target_far', 'second_ball']);

let descartados = 0;
function iniciar(sim, tipo, team, antes) {
  /* Um lance novo antes do anterior fechar: se o anterior ja reiniciou, fecha
     com o que tem; se ainda estava na bola morta, foi substituido -- conta. */
  if (atual) { if (atual.fim) fechar(atual); else { descartados++; atual = null; } }
  const gol = sim.teams[team].oppGoal;
  const lance = { tipo, team, gol: { x: gol.x, y: gol.y }, quadros: 0, depoisDoReinicio: 0 };
  /* salto no apito: o que a propria chamada escreveu, antes de qualquer quadro */
  const saltos = [];
  const depois = new Map();
  for (const tm of sim.teams) for (const p of tm.players) if (p && !p.red) depois.set(p, [+p.x, +p.y]);
  for (const a of antes) {
    const d2 = depois.get(a.p); if (!d2) continue;
    saltos.push({ team: a.p.team, isGK: !!a.p.isGK, d: dd(a.x, a.y, d2[0], d2[1]) });
  }
  lance.saltos = saltos;
  lance.dead0 = +sim.dead || 0;

  /* Os alvos da area: quem recebeu posto de ataque dentro da grande area, e
     qual e o posto. O alvo e `__spTarget` quando a R15 adiou a escrita, e a
     propria posicao quando a camada escreveu direto (falta cruzada). */
  lance.postos = [];
  for (const p of sim.teams[team].players) {
    if (!p || p.red || p.isGK || !POSTO_AREA.has(p._setPieceRole)) continue;
    const alvo = p.__spTarget ? { x: p.__spTarget.x, y: p.__spTarget.y } : { x: +p.x, y: +p.y };
    lance.postos.push({
      p, papel: p._setPieceRole, alvo,
      alvoNaArea: naArea(alvo.x, alvo.y, lance.gol),
      alvoDistGol: dd(alvo.x, alvo.y, lance.gol.x, lance.gol.y),
      armado: !!p.__spTarget,
      dMin: dd(p.x, p.y, alvo.x, alvo.y),   // menor distancia ao posto ja atingida
      chegouAlgumaVez: false,
      naAreaAlgumaVez: false,
      spPerdidoAntesDeChegar: null
    });
  }
  lance.armados = 0;
  for (const tm of sim.teams) for (const p of tm.players) if (p && p.__spTarget) lance.armados++;
  lance.inicio = retrato(sim, lance);
  lance.pos0 = new Map();
  for (const tm of sim.teams) for (const p of tm.players) if (p && !p.red) lance.pos0.set(p, [+p.x, +p.y]);
  atual = lance;
}

/* Acompanha os postos quadro a quadro: ele chega? ele fica? */
function acompanhar(lance) {
  for (const q of lance.postos) {
    const p = q.p;
    const d = dd(p.x, p.y, q.alvo.x, q.alvo.y);
    if (d < q.dMin) q.dMin = d;
    if (d <= 1.5) q.chegouAlgumaVez = true;
    if (naArea(p.x, p.y, lance.gol)) q.naAreaAlgumaVez = true;
    if (q.armado && !q.chegouAlgumaVez && q.spPerdidoAntesDeChegar === null && !p.__spTarget) {
      q.spPerdidoAntesDeChegar = +d.toFixed(3);
    }
  }
}

/* ---- os wrappers ficam por FORA de todas as camadas do HTML ------------- */
const oCorner = P._setCorner;
P._setCorner = function (team) {
  const antes = foto(this);
  const r = oCorner.apply(this, arguments);
  if (team === 0 || team === 1) iniciar(this, 'escanteio', team, antes);
  return r;
};

const oFK = P._freeKick;
P._freeKick = function (team, x, y, input) {
  const s = this.stats && this.stats[team];
  const a = s ? [s.freeKickCrossed | 0, s.freeKickShort | 0, s.freeKickDirect | 0] : null;
  const antes = foto(this);
  const r = oFK.apply(this, arguments);
  if (s && a && (team === 0 || team === 1)) {
    const tipo = (s.freeKickCrossed | 0) > a[0] ? 'falta_cruzada'
               : (s.freeKickShort   | 0) > a[1] ? 'falta_curta'
               : (s.freeKickDirect  | 0) > a[2] ? 'falta_direta' : null;
    if (tipo) iniciar(this, tipo, team, antes);
  }
  return r;
};

const oStep = P.step;
P.step = function (dt) {
  const r = oStep.apply(this, arguments);
  if (atual) {
    const vivo = (+this.dead || 0) > 0;
    if (atual.fim) {
      /* JA REINICIOU. O lance nao acontece no apito: a bola cruzada leva ~1 s
         para chegar. HANDOFF §2.4 -- medir no instante do LANCE. */
      acompanhar(atual);
      atual.depoisDoReinicio++;
      const s = +(atual.depoisDoReinicio * DT).toFixed(3);
      if (!atual.em05 && s >= 0.5) atual.em05 = retrato(this, atual);
      if (!atual.em10 && s >= 1.0) atual.em10 = retrato(this, atual);
      if (!atual.em15 && s >= 1.5) { atual.em15 = retrato(this, atual); fechar(atual); }
      return r;
    }
    atual.quadros++;
    acompanhar(atual);
    if (!vivo || atual.quadros > 400) {
      atual.fim = retrato(this, atual);
      const andou = [];
      for (const tm of this.teams) for (const p of tm.players) {
        if (!p || p.red || p.isGK) continue;
        const z = atual.pos0.get(p); if (!z) continue;
        andou.push({ team: p.team, d: dd(z[0], z[1], p.x, p.y) });
      }
      atual.andou = andou;
      atual.janela_s = +(atual.quadros * DT).toFixed(3);
      for (const q of atual.postos) {
        q.naAreaNoReinicio = naArea(q.p.x, q.p.y, atual.gol);
        q.distGolNoReinicio = +dd(q.p.x, q.p.y, atual.gol.x, atual.gol.y).toFixed(2);
      }
      delete atual.pos0;
    }
  }
  return r;
};

function fechar(l) {
  l.postosResumo = l.postos.map(q => ({
    papel: q.papel, armado: q.armado, alvoNaArea: q.alvoNaArea,
    alvoDistGol: +q.alvoDistGol.toFixed(2), dMin: +q.dMin.toFixed(3),
    chegou: q.chegouAlgumaVez, esteveNaArea: q.naAreaAlgumaVez,
    spPerdidoAntesDeChegar: q.spPerdidoAntesDeChegar,
    naAreaNoReinicio: !!q.naAreaNoReinicio,
    distGolNoReinicio: q.distGolNoReinicio == null ? null : q.distGolNoReinicio,
    naAreaEm1_5s: naArea(q.p.x, q.p.y, l.gol),
    distGolEm1_5s: +dd(q.p.x, q.p.y, l.gol.x, l.gol.y).toFixed(2)
  }));
  delete l.postos;
  lances.push(l); atual = null;
}

/* ------------------------------ a corrida ------------------------------- */
const db = buildDB(DATA);
const N = Number(argv.matches || 8);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(DT);
}

/* ----------------------------- o relatorio ------------------------------ */
function resumo(tipo, filtro) {
  const L = lances.filter(l => l.tipo === tipo && l.fim && (!filtro || filtro(l)));
  if (!L.length) return null;
  const saltoAtk = [], saltoDef = [];
  let saltouMais3 = 0, jogadoresContados = 0;
  for (const l of L) for (const s of l.saltos) {
    if (s.isGK) continue;
    jogadoresContados++;
    if (s.d > 3) saltouMais3++;
    (s.team === l.team ? saltoAtk : saltoDef).push(s.d);
  }
  const andouAtk = [], andouDef = [];
  for (const l of L) for (const a of l.andou) (a.team === l.team ? andouAtk : andouDef).push(a.d);
  const g = (f) => res(L.map(f).filter(Number.isFinite));
  const linha = (campo) => ({
    no_apito: g(l => l.inicio[campo]),
    no_reinicio: g(l => l.fim[campo]),
    em_0_5s: g(l => l.em05 && l.em05[campo]),
    em_1_0s: g(l => l.em10 && l.em10[campo]),
    em_1_5s: g(l => l.em15 && l.em15[campo])
  });
  /* os postos da area, um por um */
  const postos = [];
  for (const l of L) for (const q of (l.postosResumo || [])) postos.push(q);
  const comAlvoNaArea = postos.filter(q => q.alvoNaArea);
  const cont = (arr, f) => arr.length ? (arr.filter(f).length + ' de ' + arr.length +
      ' (' + (100 * arr.filter(f).length / arr.length).toFixed(1) + '%)') : 'sem amostra';
  return {
    lances: L.length,
    janela_de_bola_morta_s: g(l => l.janela_s),
    dead_logo_apos_a_chamada_s: g(l => l.dead0),
    SALTO_NO_APITO_m: {
      atacantes: res(saltoAtk), defensores: res(saltoDef),
      jogadores_que_saltaram_mais_de_3m: saltouMais3 + ' de ' + jogadoresContados
    },
    ARMADOS_com_spTarget: g(l => l.armados),
    POSTOS_DE_AREA: {
      total: postos.length,
      por_lance: L.length ? +(postos.length / L.length).toFixed(2) : 0,
      com_alvo_DENTRO_da_area: cont(postos, q => q.alvoNaArea),
      armados_para_caminhar: cont(postos, q => q.armado),
      CHEGOU_ao_posto_alguma_vez: cont(comAlvoNaArea, q => q.chegou),
      esteve_na_area_alguma_vez: cont(comAlvoNaArea, q => q.esteveNaArea),
      ESTAVA_NA_AREA_no_reinicio: cont(comAlvoNaArea, q => q.naAreaNoReinicio),
      ESTAVA_NA_AREA_1_5s_depois: cont(comAlvoNaArea, q => q.naAreaEm1_5s),
      dist_ao_posto_MINIMA_atingida_m: res(comAlvoNaArea.map(q => q.dMin)),
      dist_ao_gol_no_reinicio_m: res(comAlvoNaArea.map(q => q.distGolNoReinicio).filter(Number.isFinite)),
      dist_ao_gol_1_5s_depois_m: res(comAlvoNaArea.map(q => q.distGolEm1_5s))
    },
    NA_GRANDE_AREA_atacantes: linha('atkArea'),
    NA_GRANDE_AREA_defensores: linha('defArea'),
    a_menos_de_25m_do_gol_atacantes: linha('atkPerto25'),
    a_menos_de_25m_do_gol_defensores: linha('defPerto25'),
    DIST_MEDIA_AO_GOL_atacantes_m: linha('atkDistMedia'),
    DIST_MEDIA_AO_GOL_defensores_m: linha('defDistMedia'),
    ANDOU_entre_apito_e_cobranca_m: { atacantes: res(andouAtk), defensores: res(andouDef) }
  };
}

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  sha256: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
  partidas: N,
  total_de_lances: lances.length,
  lances_substituidos_antes_do_reinicio: descartados,
  por_partida: +(lances.length / N).toFixed(2),
  /* Metade das chamadas de `_setCorner` e administrativa: as camadas R18.18.2/3
     (:22581, :22869) devolvem cedo, convertendo o escanteio em trajetoria
     fisica ou suprimindo-o, e a cerimonia nunca roda. Misturar as duas
     populacoes dilui o numero -- por isso a separacao. */
  escanteio_COM_coreografia: resumo('escanteio', l => l.postosResumo && l.postosResumo.length > 0),
  escanteio_sem_coreografia_chamada_administrativa: resumo('escanteio', l => !l.postosResumo || !l.postosResumo.length),
  falta_cruzada: resumo('falta_cruzada'),
  falta_direta: resumo('falta_direta'),
  falta_curta: resumo('falta_curta')
}, null, 1));
