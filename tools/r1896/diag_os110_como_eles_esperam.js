#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-110 · COMO OS JOGADORES ESPERAM O ESCANTEIO E A FALTA
 * =============================================================
 * OBSERVACAO DO DONO, jogando a R18.97:
 *   "Um problema que eu achei foi a maneira que os jogadores ficam esperando o
 *    escanteio e a falta."
 *
 * A OS-107 poe o time na area e o SEGURA la com o pino: a cada quadro de bola
 * morta, quem se afasta mais de RAIO=0,45 m do posto tem `__spTarget` re-armado.
 * Quem re-arma o alvo e a camada R15 (:18270), e ela caminha a
 * `maxSpd * 0,92` -- ~6 m/s, que e velocidade de CORRIDA -- e escreve
 * `p.vx/p.vy` com esse modulo.
 *
 * Ou seja, a suspeita e que o jogador que espera o escanteio esteja num ciclo
 * de: a IA tatica o puxa alguns centimetros -> o pino re-arma -> ele volta
 * correndo -> chega, zera a velocidade -> a IA o puxa de novo. Visualmente isso
 * e tremor, ou corrida no lugar, e nao um jogador esperando a bola.
 *
 * O QUE ELE MEDE, por jogador e por lance, durante a bola morta:
 *   - CAMINHO percorrido contra DESLOCAMENTO LIQUIDO (razao alta = vaivem);
 *   - quantas vezes o alvo foi RE-ARMADO (cada re-arme e um repuxao);
 *   - fracao de quadros com velocidade acima de 2 m/s (o motor chama isso de
 *     `moving`, :4910) e acima de 4 m/s;
 *   - velocidade mediana e maxima de quem ja chegou ao posto.
 *
 * Compare R18.96 (sem pino) com R18.97 (com pino). Nao patcha nada.
 *
 * Uso: node diag_os110_como_eles_esperam.js --build=<html> [--matches=8]
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
D('location', { href: 'runner://os110', search: '', hash: '' });
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
const dd = (a, b, c, d) => Math.hypot(a - c, b - d);

const lances = [];
let atual = null;
let pend = null;

function comecar(sim, tipo) {
  const est = new Map();
  for (const tm of sim.teams) for (const p of tm.players) {
    if (!p || p.red || p.isGK) continue;
    est.set(p, {
      x0: +p.x, y0: +p.y, x: +p.x, y: +p.y,
      caminho: 0, rearmes: 0, tinhaAlvo: !!p.__spTarget,
      quadros: 0, quadrosMove: 0, quadrosCorre: 0,
      vels: [], chegou: false, quadrosDepoisDeChegar: 0, moveDepoisDeChegar: 0
    });
  }
  atual = { tipo, est, quadros: 0 };
}

const oCorner = P._setCorner;
P._setCorner = function (team) {
  const r = oCorner.apply(this, arguments);
  if (team === 0 || team === 1) comecar(this, 'escanteio');
  return r;
};
const oFK = P._freeKick;
P._freeKick = function (team, x, y, input) {
  const s = this.stats && this.stats[team];
  const a = s ? (s.freeKickCrossed | 0) : null;
  const r = oFK.apply(this, arguments);
  if (s && a !== null && (s.freeKickCrossed | 0) > a) comecar(this, 'falta_cruzada');
  return r;
};

const oStep = P.step;
P.step = function (dt) {
  const r = oStep.apply(this, arguments);
  if (!atual) return r;
  const morta = (Number(this.dead) || 0) > 0;
  atual.quadros++;
  for (const tm of this.teams) for (const p of tm.players) {
    if (!p || p.red || p.isGK) continue;
    const z = atual.est.get(p); if (!z) continue;
    const passo = dd(z.x, z.y, p.x, p.y);
    z.caminho += passo;
    z.x = +p.x; z.y = +p.y;
    z.quadros++;
    const v = Math.hypot(Number(p.vx) || 0, Number(p.vy) || 0);
    z.vels.push(v);
    if (v > 2) z.quadrosMove++;
    if (v > 4) z.quadrosCorre++;
    const temAlvo = !!p.__spTarget;
    if (temAlvo && !z.tinhaAlvo) z.rearmes++;
    if (!temAlvo && z.tinhaAlvo) z.chegou = true;
    z.tinhaAlvo = temAlvo;
    if (z.chegou) { z.quadrosDepoisDeChegar++; if (v > 2) z.moveDepoisDeChegar++; }
  }
  if (!morta || atual.quadros > 400) {
    for (const [, z] of atual.est) {
      z.liquido = dd(z.x0, z.y0, z.x, z.y);
      z.razao = z.liquido > 0.5 ? z.caminho / z.liquido : (z.caminho > 0.5 ? 99 : 1);
    }
    lances.push(atual); atual = null;
  }
  return r;
};

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
  atual = null;
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(DT);
}

const ord = a => a.slice().sort((x, y) => x - y);
const pc = (a, q) => a.length ? +ord(a)[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(3) : null;
const res = a => a.length ? { p50: pc(a, .5), p90: pc(a, .9), max: pc(a, .999) } : 'sem amostra';
const media = a => a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(4) : null;

function resumo(tipo) {
  const L = lances.filter(l => l.tipo === tipo && l.quadros > 15);
  if (!L.length) return null;
  const caminho = [], liquido = [], razao = [], rearmes = [];
  let qTot = 0, qMove = 0, qCorre = 0, qDep = 0, qDepMove = 0;
  const velsChegou = [];
  for (const l of L) for (const [, z] of l.est) {
    if (z.caminho < 0.3 && z.rearmes === 0) continue;   // quem nem participou
    caminho.push(z.caminho); liquido.push(z.liquido); razao.push(z.razao); rearmes.push(z.rearmes);
    qTot += z.quadros; qMove += z.quadrosMove; qCorre += z.quadrosCorre;
    qDep += z.quadrosDepoisDeChegar; qDepMove += z.moveDepoisDeChegar;
    if (z.chegou) for (const v of z.vels) velsChegou.push(v);
  }
  return {
    lances: L.length,
    jogadores_que_se_mexeram: caminho.length,
    CAMINHO_percorrido_m: res(caminho),
    deslocamento_LIQUIDO_m: res(liquido),
    RAZAO_caminho_sobre_liquido: res(razao),
    RE_ARMES_do_alvo_por_jogador: { media: media(rearmes), p90: pc(rearmes, .9), max: pc(rearmes, .999) },
    quadros_acima_de_2m_s: (100 * qMove / Math.max(1, qTot)).toFixed(1) + '%',
    quadros_acima_de_4m_s: (100 * qCorre / Math.max(1, qTot)).toFixed(1) + '%',
    DEPOIS_DE_CHEGAR_quadros_acima_de_2m_s: qDep ? (100 * qDepMove / qDep).toFixed(1) + '%' : 'sem amostra',
    velocidade_de_quem_ja_chegou_m_s: res(velsChegou)
  };
}

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  sha256: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
  partidas: N,
  escanteio: resumo('escanteio'),
  falta_cruzada: resumo('falta_cruzada')
}, null, 1));
