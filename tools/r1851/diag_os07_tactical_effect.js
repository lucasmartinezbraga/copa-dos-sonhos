#!/usr/bin/env node
'use strict';
/*
 * OS-07 · CENSO DE EFEITO TATICO
 * ------------------------------
 * Roda sobre a BUILD PROMOVIDA R18.50, sem nenhum patch.
 *
 * Responde duas perguntas separadas, que costumam ser confundidas:
 *
 *   A) ALCANCE — o campo de instrucao chega ao motor? Cada folha de
 *      DEFAULT_INSTRUCTIONS e perturbada e o `tm.fx` resultante e comparado.
 *      Um campo que nao muda `fx` e nao e lido no escore de decisao e
 *      DECORATIVO: existe na interface e nao existe no jogo.
 *
 *   B) EFEITO — o campo que chega ao motor muda o futebol apresentado?
 *      Mesma semente, extremo baixo contra extremo alto, observaveis pareados.
 *
 *   C) FUNCAO — trocar a funcao de um jogador muda algo? Mesmo par de
 *      sementes, um unico jogador trocado de papel.
 *
 * A parte A e instantanea e exaustiva; nao simula partida nenhuma.
 *
 * ATENCAO ao ler B e C: mudar instrucao muda `fx`, que muda o caminho de
 * consumo de RNG. Duas configuracoes diferentes na MESMA semente divergem por
 * caos, nao por efeito. Por isso "fingerprint diferente" NAO e evidencia de
 * efeito — so o contrario vale: fingerprint IDENTICO prova inercia. O efeito
 * precisa aparecer como direcao consistente sobre muitas sementes.
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
define('navigator', { userAgent: 'cds-os07', language: 'pt-BR' });
define('location', { href: 'runner://os07', search: '', hash: '' });
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

const REQUIRED = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','FL','FW','CDS_PHASES_4_7'];
const missing = REQUIRED.filter(name => typeof global[name] === 'undefined');
if (missing.length) {
  realConsole.error('ABORTA: simbolos do motor ausentes -> ' + missing.join(', '));
  process.exit(2);
}
for (const fn of ['setTeamInstructions','setPlayerPhaseRole','getTacticalCoherence']) {
  if (typeof MatchSim.prototype[fn] !== 'function') {
    realConsole.error('ABORTA: build sem ' + fn + '()');
    process.exit(3);
  }
}

const P47 = CDS_PHASES_4_7;
const db = buildDB(DATA);
const N = Number(argv.matches || 24);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, style, home) => {
  const picked = autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: picked.lineup, bench: picked.bench, formKey: form, style };
};
const novoSim = (seed, form) => {
  srand(seed);
  const s = new MatchSim(mk(form, 'balanced', true), mk(form, 'balanced', false), { neutral: true, labMode: true });
  s.teams[0].formKey = form; s.teams[1].formKey = form;
  return s;
};

/* ===================== PARTE A · ALCANCE ESTATICO ====================== */

// texto da funcao de escore de decisao, para detectar leitura fora do fx
const ctxSrc = (html.match(/function context\(sim,p\)\{[\s\S]{0,4000}?\n?\}/) || [''])[0];

/* `fx` nao e o unico caminho. `finalThird.overlap`, por exemplo, nao muda `fx`
   nenhum: ele vira a flag `_overlapping` em :8087 e SO ENTAO e lido no escore
   de passe em :5652. Um teste que olhasse apenas `fx` chamaria esse campo de
   decorativo e estaria errado.
   Por isso contamos ocorrencias do nome da folha FORA do bloco Fase 4-7 — que
   e onde moram a declaracao, o normalize, o detector de conflitos e a IA de
   treinador. Ocorrencia fora dali e leitor candidato, e o campo vira
   'verificar' em vez de 'decorativo'. O erro fica do lado seguro. */
const linhas = html.split('\n');
const iniP47 = linhas.findIndex(l => l.indexOf('CDS_PHASES_4_7') >= 0 || l.indexOf('__P47__') >= 0);
const fimP47 = linhas.findIndex((l, i) => i > Math.max(0, iniP47) && l.indexOf('CDS_PHASES_4_7') >= 0 && l.indexOf('root.CDS_PHASES_4_7=API') >= 0);
function ocorrenciasFora(nomeFolha) {
  const alvos = [];
  for (let i = 0; i < linhas.length; i++) {
    if (iniP47 >= 0 && i >= iniP47 - 40 && (fimP47 < 0 || i <= fimP47 + 5)) continue;
    if (linhas[i].indexOf(nomeFolha) >= 0) alvos.push(i + 1);
  }
  return alvos;
}

function folhas(obj, prefixo) {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k], caminho = prefixo ? prefixo + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...folhas(v, caminho));
    else out.push({ caminho, valor: v, tipo: typeof v });
  }
  return out;
}
function setIn(obj, caminho, valor) {
  const partes = caminho.split('.'), o = JSON.parse(JSON.stringify(obj));
  let cur = o;
  for (let i = 0; i < partes.length - 1; i++) cur = cur[partes[i]];
  cur[partes[partes.length - 1]] = valor;
  return o;
}
function getIn(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// vocabulario de cada folha: valores observados em todos os presets
const vocab = new Map();
for (const nome of Object.keys(P47.PRESETS)) {
  for (const f of folhas(P47.PRESETS[nome], '')) {
    if (!vocab.has(f.caminho)) vocab.set(f.caminho, new Set());
    vocab.get(f.caminho).add(JSON.stringify(f.valor));
  }
}

const base = P47.DEFAULT_INSTRUCTIONS;

/* `apply(tm)` (build :8079) COMPOE sobre `tm.baseFx`: fx.ritmo, fx.drible,
   fx.shoot, fx.cross, fx.far e fx.drain sao multiplicados sobre o valor
   anterior e o resultado vira o novo baseFx. Chamar setTeamInstructions duas
   vezes no MESMO sim faz o fx derivar sozinho, independentemente do campo
   alterado. Por isso cada medicao usa um sim NOVO. */
const fxDe = instr => {
  const s = novoSim(SEMENTE, FORMS[0]);
  s.setTeamInstructions(0, instr);
  return { fx: JSON.parse(JSON.stringify(s.teams[0].fx)), coerencia: s.teams[0].coherence.score };
};

/* Os presets nao exercitam todo o vocabulario. Estes valores vem do proprio
   codigo da build: `orientation==='outside'` em :8067 (conflicts) e as escritas
   da IA de treinador em :8295 (`marking:'mixed'`, orientation left/right). */
const VOCAB_EXTRA = {
  'outOfPossession.orientation': ['balanced', 'left', 'right', 'outside', 'inside'],
  'outOfPossession.marking': ['zonal', 'man', 'mixed'],
  'outOfPossession.block': ['high', 'mid', 'low'],
  'transition.goalkeeperDistribution': ['short', 'long', 'mixed', 'quick']
};

const alcance = [];
for (const f of folhas(base, '')) {
  let valores;
  if (f.tipo === 'number') valores = [0, 50, 100];
  else if (f.tipo === 'boolean') valores = [false, true];
  else {
    const doPreset = [...(vocab.get(f.caminho) || new Set())].map(x => JSON.parse(x));
    valores = [...new Set([].concat(doPreset, VOCAB_EXTRA[f.caminho] || [], [f.valor]))];
  }
  const fxVistos = new Set(), coVistos = new Set();
  for (const v of valores) {
    const r = fxDe(setIn(base, f.caminho, v));
    fxVistos.add(JSON.stringify(r.fx));
    coVistos.add(r.coerencia);
  }
  const folhaNome = f.caminho.split('.').pop();
  const lidoNaDecisao = new RegExp('\\.' + folhaNome + '\\b').test(ctxSrc);
  const mudaFx = fxVistos.size > 1;
  const fora = ocorrenciasFora(folhaNome);
  alcance.push({
    caminho: f.caminho,
    tipo: f.tipo,
    valoresTestados: valores.map(v => String(v)),
    fxDistintos: fxVistos.size,
    coerenciaDistintas: coVistos.size,
    mudaFx,
    mudaCoerencia: coVistos.size > 1,
    lidoNaDecisao,
    linhasForaDoP47: fora,
    veredito: mudaFx || lidoNaDecisao ? 'vivo' : (fora.length ? 'verificar' : 'decorativo'),
    decorativo: !mudaFx && !lidoNaDecisao && fora.length === 0
  });
}
const decorativos = alcance.filter(a => a.decorativo).map(a => a.caminho);
const vivos = alcance.filter(a => !a.decorativo).map(a => a.caminho);

/* ===================== PARTE B · EFEITO MEDIDO ======================== */

const STAT_KEYS = ['goals','xg','shots','onTarget','corners','passes','passesOk','tackles','crosses','dribbles','fouls','possession'];
function observaveis(sim, lado) {
  const s = sim.stats[lado] || {}, o = {};
  for (const k of STAT_KEYS) if (Number.isFinite(Number(s[k]))) o[k] = Number(s[k]);
  const dec = s.decisions || {};
  for (const k of Object.keys(dec)) o['dec_' + k] = Number(dec[k]) || 0;
  const co = s.corridorOccupancy || [];
  const tot = co.reduce((a, b) => a + b, 0) || 1;
  co.forEach((v, i) => { o['corr' + i] = +(v / tot).toFixed(5); });
  o['corrSpread'] = +(Math.max.apply(null, co.length ? co : [0]) / tot).toFixed(5);
  return o;
}
const impressao = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);

function rodar(seed, form, cfgTime0, papel) {
  const sim = novoSim(seed, form);
  if (cfgTime0) sim.setTeamInstructions(0, cfgTime0);
  if (papel) {
    const alvo = sim.teams[0].players.find(p => !p.isGK && (LINE_OF[p.oopPos || p.slotPos] === 'MID'));
    if (alvo) sim.setPlayerPhaseRole(0, sim.teams[0].players.indexOf(alvo), papel);
  }
  let steps = 0;
  while (!sim.isOver() && steps++ < 500000) sim.step(DT);
  const o = observaveis(sim, 0);
  return { obs: o, fp: impressao(o) };
}

function comparar(rotulo, cfgA, cfgB, papelA, papelB) {
  let identicos = 0;
  const somaA = {}, somaB = {};
  for (let i = 0; i < N; i++) {
    const seed = SEMENTE + i * 7919, form = FORMS[i % FORMS.length];
    const a = rodar(seed, form, cfgA, papelA);
    const b = rodar(seed, form, cfgB, papelB);
    if (a.fp === b.fp) identicos++;
    for (const k of Object.keys(a.obs)) somaA[k] = (somaA[k] || 0) + a.obs[k];
    for (const k of Object.keys(b.obs)) somaB[k] = (somaB[k] || 0) + b.obs[k];
  }
  const delta = {};
  for (const k of Object.keys(somaA)) {
    const mA = somaA[k] / N, mB = (somaB[k] || 0) / N;
    delta[k] = { baixo: +mA.toFixed(4), alto: +mB.toFixed(4), delta: +(mB - mA).toFixed(4) };
  }
  return { rotulo, partidasPorLado: N, impressoesIdenticas: identicos, inerte: identicos === N, medias: delta };
}

const EIXOS = [
  ['progression.tempo',        'inPossession.progression.tempo',        0, 100],
  ['progression.passLength',   'inPossession.progression.passLength',   0, 100],
  ['progression.verticality',  'inPossession.progression.verticality',  0, 100],
  ['progression.width',        'inPossession.progression.width',        0, 100],
  ['outOfPossession.pressing', 'outOfPossession.pressing',              0, 100],
  ['outOfPossession.defensiveLine','outOfPossession.defensiveLine',     0, 100],
  ['finalThird.crossType',     'inPossession.finalThird.crossType',     'cutback', 'high'],
  ['finalThird.earlyShots',    'inPossession.finalThird.earlyShots',    false, true]
];

const efeito = [];
if (!argv.somenteAlcance) {
  for (const [rotulo, caminho, lo, hi] of EIXOS) {
    if (getIn(base, caminho) === undefined) continue;
    efeito.push(comparar(rotulo, setIn(base, caminho, lo), setIn(base, caminho, hi)));
  }
}

/* ===================== PARTE C · FUNCAO DO JOGADOR ==================== */

const papeis = [];
if (!argv.somenteAlcance) {
  papeis.push(comparar('oopRole: zone -> track_wide', null, null,
    { outOfPossession: { role: 'zone' } }, { outOfPossession: { role: 'track_wide' } }));
  papeis.push(comparar('ipDuty: support -> attack', null, null,
    { inPossession: { duty: 'support' } }, { inPossession: { duty: 'attack' } }));
}

const output = {
  rodada: 'OS-07',
  observational: true,
  promovivel: false,
  build: String(argv.build).split(/[\\/]/).pop(),
  sha256: sha,
  patchesAplicados: 0,
  scriptsCarregados: scriptsOk,
  scriptsComErro: scriptsErro,
  excecoes,
  partidasPorLado: N,
  sementeBase: SEMENTE,
  incremento: 7919,
  alcance: {
    folhas: alcance.length,
    vivos: vivos.length,
    decorativos: decorativos.length,
    listaDecorativos: decorativos,
    detalhe: alcance
  },
  efeito,
  papeis
};
realConsole.log(JSON.stringify({
  rodada: output.rodada, build: output.build, sha: sha.slice(0, 12),
  alcance: { folhas: alcance.length, vivos: vivos.length, decorativos: decorativos.length, listaDecorativos: decorativos },
  efeito: efeito.map(e => ({ eixo: e.rotulo, inerte: e.inerte, impressoesIdenticas: e.impressoesIdenticas + '/' + e.partidasPorLado })),
  papeis: papeis.map(e => ({ troca: e.rotulo, inerte: e.inerte, impressoesIdenticas: e.impressoesIdenticas + '/' + e.partidasPorLado }))
}, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(output, null, 2));
