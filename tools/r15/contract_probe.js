#!/usr/bin/env node
/*
 * Sonda do Contrato de Função (§18) — prova que o objeto existe, está completo
 * e continua INERTE.
 *
 * "Inerte" tem prova mecânica aqui: o contrato é definido com
 * `enumerable:false`, então se estivesse vazando para algum snapshot, save ou
 * serialização, apareceria em `Object.keys(p)` ou em `JSON.stringify(p)`. A
 * sonda testa os dois. A prova de que o COMPORTAMENTO não mudou é outra, e é a
 * matriz de 294 partidas (item 0 do critério pré-registrado do §18).
 *
 * Autossuficiente de propósito: `probe_balllock.js` roda a matriz inteira ao
 * ser importado, então não dá para reaproveitá-lo como biblioteca.
 *
 *   node tools/r15/contract_probe.js --build="dist/COPA DOS SONHOS - R17.0.html"
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));
const BUILD = argv.build || 'dist/COPA DOS SONHOS - R17.0.html';
const OUT = argv.out || 'reports/r15/contrato-funcao.json';

function noop() {}
function define(name, value) {
  try { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  catch (_) { global[name] = value; }
}
define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-contract-probe', language: 'pt-BR' });
define('location', { href: 'runner://contract', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0);
define('cancelAnimationFrame', noop);
define('addEventListener', noop);
define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {});
define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {});
define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

/* Mesma seleção por ID de `probe_balllock.js`: nunca por posição. */
const SKIP_IDS = new Set([
  'cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot',
]);
const html = fs.readFileSync(BUILD, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || `script-${i}`;
  if (!SKIP_IDS.has(id)) {
    try { vm.runInThisContext(m[2], { filename: `${String(i).padStart(2, '0')}-${id}.js` }); }
    catch (e) {
      if (!(/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message)))) throw e;
    }
  }
  i++;
}
const sha = crypto.createHash('sha256').update(html).digest('hex');

const OBRIGATORIOS = [
  'version', 'id', 'idx', 'team', 'slot', 'line', 'homeZone', 'corridor',
  'corridorAttack', 'side', 'height', 'heightAttack', 'width', 'onBall',
  'offBall', 'focus', 'inTransitionA', 'inTransitionD', 'coverFor', 'coveredBy',
  'markPriority', 'minHoldSeconds', 'switchCost', 'riskTolerance',
  'leaveZoneWhen', 'returnZoneWhen', 'preferredActions', 'forbiddenActions'
];

const rel = {
  build: BUILD, sha256: sha,
  version: (global.CDS_R18_CONTRACT || {}).version || null,
  formacoes: [], times: 0, jogadores: 0,
  faltando: [], slotsDesconhecidos: [],
  vazamento_object_keys: 0, vazamento_json: 0, semCobertura: 0,
  porLinha: {}, porCorredor: {}, porLado: {}, exemplo: null
};

if (!global.CDS_R18_CONTRACT) { realConsole.error('FALHA: CDS_R18_CONTRACT ausente'); process.exit(1); }
const { MatchSim, autoLineup, FORMATIONS } = global;
if (!MatchSim || !autoLineup) { realConsole.error('FALHA: MatchSim/autoLineup ausentes'); process.exit(1); }

/* Mesma construção de `probe_balllock.js:727`: identificadores nus, para
   resolverem como globais do bundle. `buildDB()` sem argumento explode em
   `DATA.NATIONS`. */
const db = (typeof buildDB === 'function' && typeof DATA !== 'undefined')
  ? buildDB(DATA) : null;
const squads = (db && db.squads) || [];
if (!squads.length) { realConsole.error('FALHA: nenhum elenco disponivel'); process.exit(1); }

function teamFor(squad, formation, variation, color, style) {
  const picked = autoLineup(squad, formation, variation);
  return { squad, name: squad.c, flag: squad.f, color,
           lineup: picked.lineup, bench: picked.bench, formKey: formation, style };
}

/* Varre TODAS as formações: um contrato que só funciona no 4-3-3 não serve. */
for (const formation of Object.keys(FORMATIONS || { '4-3-3': 1 })) {
  let sim;
  try {
    sim = new MatchSim(
      teamFor(squads[0], formation, 0, '#2e9bff', 'balanced'),
      teamFor(squads[1] || squads[0], formation, 0, '#ff3d7f', 'balanced'),
      { neutral: true, labMode: true });
  } catch (e) { rel.faltando.push(`formacao ${formation}: ${e.message}`); continue; }
  rel.formacoes.push(formation);

  for (const tm of sim.teams || []) {
    rel.times++;
    for (const s of ((tm.__contractAudit || {}).slotsUnknown) || []) rel.slotsDesconhecidos.push(s);
    for (const p of tm.players || []) {
      rel.jogadores++;
      const c = p.contract;
      if (!c) { rel.faltando.push(`${tm.side}:${p.idx} sem contrato`); continue; }
      for (const k of OBRIGATORIOS) if (!(k in c)) rel.faltando.push(`${c.id}.${k}`);
      if (Object.keys(p).includes('contract')) rel.vazamento_object_keys++;
      try { if ('contract' in JSON.parse(JSON.stringify(p))) rel.vazamento_json++; } catch (_) {}
      if (!c.coverFor.length && c.line !== 'GK') rel.semCobertura++;
      rel.porLinha[c.line] = (rel.porLinha[c.line] || 0) + 1;
      rel.porCorredor[c.corridor] = (rel.porCorredor[c.corridor] || 0) + 1;
      rel.porLado[c.side] = (rel.porLado[c.side] || 0) + 1;
      if (!rel.exemplo) rel.exemplo = c;
    }
  }
}

const ok = rel.jogadores > 0 && !rel.faltando.length &&
           !rel.vazamento_object_keys && !rel.vazamento_json &&
           !rel.slotsDesconhecidos.length;
rel.veredito = ok ? 'CONTRATO COMPLETO E INERTE' : 'FALHA';

fs.writeFileSync(OUT, JSON.stringify(rel, null, 1), 'utf8');
realConsole.log(`build ${BUILD}`);
realConsole.log(`sha256 ${sha.slice(0, 16)}  contrato ${rel.version}`);
realConsole.log(`formacoes=${rel.formacoes.length} [${rel.formacoes.join(' ')}]`);
realConsole.log(`times=${rel.times} jogadores=${rel.jogadores}`);
realConsole.log(`por linha    ${JSON.stringify(rel.porLinha)}`);
realConsole.log(`por corredor ${JSON.stringify(rel.porCorredor)}`);
realConsole.log(`por lado     ${JSON.stringify(rel.porLado)}`);
realConsole.log(`campos faltando ${rel.faltando.length} · slots desconhecidos ${rel.slotsDesconhecidos.length}`);
realConsole.log(`sem cobertura ${rel.semCobertura}`);
realConsole.log(`VAZAMENTO Object.keys=${rel.vazamento_object_keys} JSON=${rel.vazamento_json}`);
realConsole.log(rel.veredito);
process.exit(ok ? 0 : 1);
