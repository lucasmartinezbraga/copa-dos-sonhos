#!/usr/bin/env node
'use strict';
/*
 * OS-06 · CENSO DE DEVER DEFENSIVO POR LINHA
 * ------------------------------------------
 * Roda sobre a BUILD PROMOVIDA R18.50, sem nenhum patch.
 *
 * A amostragem e feita DE FORA, no laco do runner, lendo propriedades que as
 * camadas efetivas ja escrevem no jogador: `_r18173Duty` (R18.17.3, build
 * :21227) e `_markRef` (R13, build :16736). Ler propriedade nao consome RNG,
 * nao muda posse e nao muda trajetoria.
 *
 * Os audits `getR13Audit()` e `getR18173Audit()` sao chamados SO depois de
 * `isOver()`, para que nem uma mutacao acidental dentro deles possa alcancar a
 * partida.
 *
 * Mesma varredura deterministica de formacoes/estilos e mesmo incremento de
 * semente (7919) das OS-05A/OS-05B, para pareamento partida a partida.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(item => {
  const [key, value] = item.replace(/^--/, '').split('=');
  return [key, value == null ? true : value];
}));
function noop() {}
function define(name, value) {
  try {
    Object.defineProperty(global, name, { value, writable: true, configurable: true });
  } catch (_) {
    global[name] = value;
  }
}

define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-os06', language: 'pt-BR' });
define('location', { href: 'runner://os06', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0);
define('cancelAnimationFrame', noop);
define('addEventListener', noop);
define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop);
define('confirm', () => true);
define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {});
define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {});
define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop);
define('__cdsDebugWarn', noop);
define('CDS_DEBUG', false);

const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };
const SKIP = new Set([
  'cds-2_5d-gate-a-contracts-v02',
  'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup',
  'cds-mobile-boot-bridge',
  'cds-ux-boot'
]);
if (!argv.build) {
  realConsole.error('ABORTA: informe --build=<html>');
  process.exit(1);
}

const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match, index = 0, scriptsOk = 0, scriptsErro = 0;
const excecoes = [];
while ((match = scriptRe.exec(html))) {
  const id = (match[1].match(/id="([^"]+)"/) || [])[1] || `script-${index}`;
  index++;
  if (SKIP.has(id)) continue;
  try {
    vm.runInThisContext(match[2], { filename: id + '.js' });
    scriptsOk++;
  } catch (error) {
    scriptsErro++;
    excecoes.push({ bloco: id, mensagem: String(error && error.message || error) });
  }
}

const REQUIRED = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','FL','FW','LINE_OF'];
const missing = REQUIRED.filter(name => typeof global[name] === 'undefined');
if (missing.length) {
  realConsole.error('ABORTA: simbolos do motor ausentes -> ' + missing.join(', '));
  process.exit(2);
}
for (const fn of ['getR13Audit','getR18173Audit']) {
  if (typeof MatchSim.prototype[fn] !== 'function') {
    realConsole.error('ABORTA: build sem ' + fn + '()');
    process.exit(3);
  }
}

const db = buildDB(DATA);
const N = Number(argv.matches || 48);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const AMOSTRA = Number(argv.amostra || 0.25);   // s de tempo de jogo entre leituras
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice()
  : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, style, home) => {
  const picked = autoLineup(squad, form, 0);
  return {
    squad, name: squad.c, flag: squad.f,
    color: home ? '#2e9bff' : '#ff3d7f',
    lineup: picked.lineup, bench: picked.bench,
    formKey: form, style
  };
};

const LINHAS = ['DEF','MID','FWD'];
const DEVERES = ['press','cover','shadow','mark','screen','zone','unset'];
const D2 = (ax,ay,bx,by) => Math.hypot(ax-bx, ay-by);
const linhaDe = p => LINE_OF[p.oopPos || p.slotPos] || 'MID';

function censoFresco() {
  const c = { amostras: 0, amostrasDefendendo: 0 };
  for (const L of LINHAS) {
    for (const d of DEVERES) c['duty_' + L + '_' + d] = 0;
    c['comMarca_' + L] = 0;
    c['jogadores_' + L] = 0;
  }
  // ameacas: adversario de linha (nao GK, nao portador) a menos de 45 m do gol defendido
  c.ameacas = 0;              // total de ameacas-amostra
  c.ameacasReferenciadas = 0; // alguem tem _markRef/_screenTgt/_shadowTgt nela
  c.ameacasLivres6 = 0;       // defensor mais proximo a mais de 6 m
  c.ameacasEntreLinhas = 0;   // 25-45 m do gol defendido
  c.ameacasEntreLinhasRef = 0;
  c.ameacasEntreLinhasLivres6 = 0;
  c.ameacasProfundas = 0;     // < 25 m
  c.ameacasProfundasRef = 0;
  /* ESPACAMENTO — deliberadamente NAO centrado na bola. O sampler de enxame do
     R18.17.3 (build :21289) conta defensores por `dist(p,b)`, entao uma coluna
     de jogadores na lateral, longe da bola, nao aparece nos gates `swarmRate` e
     `severeCollapseRate`. Estes contadores existem para cobrir esse buraco. */
  c.amostrasEspaco = 0;       // amostras jogador-time
  c.coladoLt2 = 0;            // vizinho de equipe mais proximo < 2 m
  c.coladoLt3 = 0;            // < 3 m
  c.discoMax = 0;             // maior nº de companheiros num disco de 6 m
  c.coluna3 = 0;              // >=3 companheiros em faixa |dy|<=3 e |dx|<=12
  c.coluna4 = 0;              // >=4 na mesma faixa
  c.colunaLongeDaBola = 0;    // coluna3 com a bola a mais de 15 m do grupo
  c.corredorMax = 0;          // maior ocupacao de um corredor (1/5 da largura)
  c.paresMarca = 0;           // pares marcador->alvo observados
  c.paresMarcaDySoma = 0;     // soma de |marcador.y - alvo.y|
  c.paresMarcaDxSoma = 0;     // soma de |marcador.x - alvo.x|
  return c;
}

/* Espacamento de um time, independente de onde a bola esta. */
function amostrarEspaco(sim, c, tm) {
  const ps = tm.players.filter(p => p && !p.red && !p.isGK);
  if (ps.length < 2) return;
  const b = sim.ball;
  const corredores = [0, 0, 0, 0, 0];
  for (const p of ps) {
    c.amostrasEspaco++;
    let perto = 1e9, disco = 0, faixa = 0, somaX = 0, somaY = 0;
    for (const q of ps) {
      if (q === p) continue;
      const d = D2(p.x, p.y, q.x, q.y);
      if (d < perto) perto = d;
      if (d <= 6) disco++;
      if (Math.abs(p.y - q.y) <= 3 && Math.abs(p.x - q.x) <= 12) { faixa++; somaX += q.x; somaY += q.y; }
    }
    if (perto < 2) c.coladoLt2++;
    if (perto < 3) c.coladoLt3++;
    if (disco > c.discoMax) c.discoMax = disco;
    const idx = Math.max(0, Math.min(4, Math.floor(p.y / FW * 5)));
    corredores[idx]++;
    if (faixa >= 2) {                       // p + 2 companheiros = coluna de 3
      c.coluna3++;
      if (faixa >= 3) c.coluna4++;
      const cx = (somaX + p.x) / (faixa + 1), cy = (somaY + p.y) / (faixa + 1);
      if (b && D2(cx, cy, b.x, b.y) > 15) c.colunaLongeDaBola++;
    }
  }
  const maxCorr = Math.max.apply(null, corredores);
  if (maxCorr > c.corredorMax) c.corredorMax = maxCorr;
}

function amostrar(sim, c) {
  const b = sim.ball;
  const dono = b && b.owner;
  c.amostras++;
  // espacamento vale para os DOIS times e nao depende de haver portador
  for (const tm of sim.teams) if (tm) amostrarEspaco(sim, c, tm);
  if (!dono || dono.team == null) return;
  const ladoDef = 1 - dono.team;
  const tmDef = sim.teams[ladoDef], tmAtk = sim.teams[dono.team];
  if (!tmDef || !tmAtk) return;
  c.amostrasDefendendo++;

  const defensores = tmDef.players.filter(p => p && !p.red && !p.isGK);
  for (const p of defensores) {
    const L = linhaDe(p);
    const duty = DEVERES.includes(p._r18173Duty) ? p._r18173Duty : 'unset';
    c['duty_' + L + '_' + duty]++;
    c['jogadores_' + L]++;
    if (p._markRef && !p._markRef.red) {
      c['comMarca_' + L]++;
      /* O alvo de marca do R13 (build :16768) poe o marcador em
         lerp(alvo.y, FW/2, .035) — 96,5% da faixa do alvo. Aqui medimos o
         afastamento realizado, que e o que empilha par sobre par. */
      c.paresMarca++;
      c.paresMarcaDySoma += Math.abs(p.y - p._markRef.y);
      c.paresMarcaDxSoma += Math.abs(p.x - p._markRef.x);
    }
  }

  const gol = tmDef.goal;
  if (!gol) return;
  const refs = new Set();
  for (const p of defensores) {
    if (p._markRef) refs.add(p._markRef);
    if (p._r18173ScreenTgt) refs.add(p._r18173ScreenTgt);
  }
  if (tmDef._shadowTgt) refs.add(tmDef._shadowTgt);

  for (const a of tmAtk.players) {
    if (!a || a.red || a.isGK || a === dono) continue;
    const dGol = D2(a.x, a.y, gol.x, gol.y);
    if (dGol > 45) continue;
    let perto = 1e9;
    for (const p of defensores) perto = Math.min(perto, D2(a.x, a.y, p.x, p.y));
    const referenciada = refs.has(a);
    c.ameacas++;
    if (referenciada) c.ameacasReferenciadas++;
    if (perto > 6) c.ameacasLivres6++;
    if (dGol >= 25) {
      c.ameacasEntreLinhas++;
      if (referenciada) c.ameacasEntreLinhasRef++;
      if (perto > 6) c.ameacasEntreLinhasLivres6++;
    } else {
      c.ameacasProfundas++;
      if (referenciada) c.ameacasProfundasRef++;
    }
  }
}

const AUDIT_R13 = ['threatCoverage','goalSideCoverage','markerClose','markerGoalSide','markerMeanDistance','defensiveLineMeanRange','disconnectedLineRate','spatialOverloadCoverage'];
const AUDIT_R18173 = ['unreachableMarksConverted','screensAssigned','ownerMarkersConverted','ownerMarkersSuppressed','redundantCoversReleased','markCorrections','zoneCorrections','coverCorrections','shadowCorrections','laneCorrections'];

const totais = censoFresco();
const auditSoma = {};
const gatesFalhos = { marking: 0, lines: 0, swarmRate: 0, severeCollapseRate: 0 };
const controle = { goals:0, xg:0, shots:0, onTarget:0, corners:0 };
const perMatch = [];

for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * 7919;
  const homeForm = FORMS[i % FORMS.length];
  const awayForm = FORMS[(i * 3 + 1) % FORMS.length];
  const homeStyle = STYLES[i % STYLES.length];
  const awayStyle = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(
    mk(homeForm, homeStyle, true),
    mk(awayForm, awayStyle, false),
    { neutral: true, labMode: true }
  );
  sim.teams[0].formKey = homeForm;
  sim.teams[1].formKey = awayForm;

  const c = censoFresco();
  let steps = 0, acc = 0;
  while (!sim.isOver() && steps++ < 500000) {
    sim.step(DT);
    acc += DT;
    if (acc >= AMOSTRA) { acc = 0; amostrar(sim, c); }
  }

  // audits so DEPOIS do fim: nada que eles facam pode alcancar a partida
  const a13 = sim.getR13Audit() || {};
  const a173 = sim.getR18173Audit() || {};
  const r13 = a13.rates || {};
  const linha = { censo: c, r13: {}, r18173: {} };
  for (const k of AUDIT_R13) { const v = Number(r13[k]) || 0; linha.r13[k] = v; auditSoma['r13_'+k] = (auditSoma['r13_'+k]||0) + v; }
  for (const k of AUDIT_R18173) { const v = Number(a173[k]) || 0; linha.r18173[k] = v; auditSoma['r18173_'+k] = (auditSoma['r18173_'+k]||0) + v; }
  for (const k of ['swarm3Within6','severe4Within9']) { const v = Number((a173.rates||{})[k]) || 0; linha.r18173[k] = v; auditSoma['r18173_'+k] = (auditSoma['r18173_'+k]||0) + v; }
  if (a13.gates && a13.gates.marking === false) gatesFalhos.marking++;
  if (a13.gates && a13.gates.lines === false) gatesFalhos.lines++;
  if (a173.gates && a173.gates.swarmRate === false) gatesFalhos.swarmRate++;
  if (a173.gates && a173.gates.severeCollapseRate === false) gatesFalhos.severeCollapseRate++;

  // discoMax e corredorMax sao maximos: somar seria sem sentido
  const MAXIMOS = new Set(['discoMax', 'corredorMax']);
  for (const k of Object.keys(c)) {
    if (MAXIMOS.has(k)) totais[k] = Math.max(totais[k], c[k]);
    else totais[k] += c[k];
  }
  const game = {};
  for (const k of Object.keys(controle)) {
    game[k] = (Number(sim.stats[0][k]) || 0) + (Number(sim.stats[1][k]) || 0);
    controle[k] += game[k];
  }
  if (argv.detalhe) perMatch.push({ seed, formacoes:[homeForm,awayForm], estilos:[homeStyle,awayStyle], placar:sim.score.slice(), ...linha, controle:game });
}

const pct = (a, b) => b ? +(a / b).toFixed(4) : null;
const porLinha = {};
for (const L of LINHAS) {
  const n = totais['jogadores_' + L] || 0;
  const frac = {};
  for (const d of DEVERES) frac[d] = pct(totais['duty_' + L + '_' + d], n);
  porLinha[L] = { amostrasJogador: n, fracaoDever: frac, fracaoComMarca: pct(totais['comMarca_' + L], n) };
}
const ameaca = {
  cobertura: pct(totais.ameacasReferenciadas, totais.ameacas),
  livres6: pct(totais.ameacasLivres6, totais.ameacas),
  entreLinhas_cobertura: pct(totais.ameacasEntreLinhasRef, totais.ameacasEntreLinhas),
  entreLinhas_livres6: pct(totais.ameacasEntreLinhasLivres6, totais.ameacasEntreLinhas),
  profundas_cobertura: pct(totais.ameacasProfundasRef, totais.ameacasProfundas)
};
const espaco = {
  amostrasJogador: totais.amostrasEspaco,
  fracaoColadoLt2: pct(totais.coladoLt2, totais.amostrasEspaco),
  fracaoColadoLt3: pct(totais.coladoLt3, totais.amostrasEspaco),
  fracaoColuna3: pct(totais.coluna3, totais.amostrasEspaco),
  fracaoColuna4: pct(totais.coluna4, totais.amostrasEspaco),
  fracaoColunaLongeDaBola: pct(totais.colunaLongeDaBola, totais.amostrasEspaco),
  discoMax6m: totais.discoMax,
  corredorMax: totais.corredorMax,
  marcaDyMedio: totais.paresMarca ? +(totais.paresMarcaDySoma / totais.paresMarca).toFixed(3) : null,
  marcaDxMedio: totais.paresMarca ? +(totais.paresMarcaDxSoma / totais.paresMarca).toFixed(3) : null
};
const auditMedio = Object.fromEntries(Object.entries(auditSoma).map(([k, v]) => [k, +(v / N).toFixed(4)]));
const controlePorPartida = Object.fromEntries(Object.entries(controle).map(([k, v]) => [k, +(v / N).toFixed(3)]));

/* O gate que decide: o meio-campo fica em zona pura enquanto a ameaca entre
   linhas nao e referenciada por ninguem? */
const decisao = {
  midEmZona: porLinha.MID.fracaoDever.zone,
  midComMarca: porLinha.MID.fracaoComMarca,
  defComMarca: porLinha.DEF.fracaoComMarca,
  coberturaEntreLinhas: ameaca.entreLinhas_cobertura,
  coberturaProfunda: ameaca.profundas_cobertura,
  colunaLongeDaBola: espaco.fracaoColunaLongeDaBola,
  marcaDyMedio: espaco.marcaDyMedio,
  gateMarkingReprovado: gatesFalhos.marking,
  gateLinesReprovado: gatesFalhos.lines,
  partidas: N
};

const output = {
  rodada: 'OS-06',
  observational: true,
  promovivel: false,
  build: String(argv.build).split(/[\\/]/).pop(),
  sha256: sha,
  patchesAplicados: 0,
  scriptsCarregados: scriptsOk,
  scriptsComErro: scriptsErro,
  excecoes,
  partidas: N,
  sementeBase: SEMENTE,
  incremento: 7919,
  intervaloAmostraS: AMOSTRA,
  censoTotal: totais,
  porLinha,
  ameaca,
  espaco,
  auditPorPartida: auditMedio,
  gatesReprovadosPorPartida: gatesFalhos,
  agregadosDeControlePorPartida: controlePorPartida,
  decisao,
  porPartida: argv.detalhe ? perMatch : undefined
};
realConsole.log(JSON.stringify({
  rodada: output.rodada, build: output.build, sha: sha.slice(0, 12),
  partidas: N, sementeBase: SEMENTE,
  porLinha, ameaca, espaco, auditPorPartida: auditMedio,
  gatesReprovadosPorPartida: gatesFalhos,
  agregadosDeControlePorPartida: controlePorPartida,
  decisao
}, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(output, null, 2));
