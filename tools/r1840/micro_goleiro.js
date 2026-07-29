#!/usr/bin/env node
'use strict';
/* MICROCENARIO OS-01 — o gol por contato falho do goleiro, com 5 sementes
   -------------------------------------------------------------------------
   A regra da rodada e explicita: OS-01 nao pode ser declarada concluida
   enquanto o gol por contato falho seguir acima de 8% dos gols. Uma medicao de
   semente unica nao decide isso — gols tem banda de ruido de 30%.

   Este instrumento roda N sementes num UNICO processo (carregar a build custa
   mais que simular) e reporta:
     - a fracao de gols que sai por 'goal_after_failed_reach', por semente;
     - o total agregado, que e o numero que vale;
     - quantos contatos falharam e quantos foram salvos pela camada R10;
     - a folga entre o que o plano promete e o que o corpo entrega, que e a
       causa do residuo (plano usa 6,2+q*2,8 m/s; o corpo usa p.maxSpd).

   Nada e alterado: envelope de prototipo, so leitura. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-micro', language: 'pt-BR' });
define('location', { href: 'runner://micro', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0, erros = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (e) { erros++; }
}
for (const n of ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand']) {
  if (typeof global[n] === 'undefined') { realConsole.error('ABORTA: falta ' + n); process.exit(2); }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };

const P = MatchSim.prototype;
const SEMENTES = Number(argv.sementes || 5);
const POR = Number(argv.matches || 4);
const DT = 1 / 30;
const FORMS = ['4-3-3', '4-4-2', '3-5-2'];

const porSemente = [];
let TG = 0, TF = 0, TC = 0, TR = 0;
const folgas = [];

for (let s = 0; s < SEMENTES; s++) {
  const base = 1710000 + s * 100003;
  let gols = 0, falhaGol = 0, contatoFalho = 0, salvosPelaR10 = 0;

  const oCont = P._continueTravel;
  const oEmit = P._emit;
  const oPCV = P._physicalContactValid;
  P._emit = function (t, d) { if (t === 'goal') gols++; if (t === 'visual_contact_failed') contatoFalho++; return oEmit.apply(this, arguments); };
  P._continueTravel = function (a, k, cb, meta) { if (meta && meta.outcome === 'goal_after_failed_reach') falhaGol++; return oCont.apply(this, arguments); };
  P._physicalContactValid = function () { const r = oPCV.apply(this, arguments); if (r && r.r10PlanTolerance) salvosPelaR10++; return r; };

  for (const form of FORMS) for (let i = 0; i < POR; i++) {
    srand(base + i * 977);
    const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
    if (s === 0 && folgas.length < 2) {
      for (const tm of sim.teams) for (const p of tm.players) if (p.isGK) {
        const q = Math.max(.30, Math.min(1, (typeof facet === 'function' ? facet(p, 'gk') : 70) / 100));
        folgas.push({ planoPromete: +(6.2 + q * 2.8).toFixed(2), corpoEntrega: +(p.maxSpd || 0).toFixed(2), folga: +((6.2 + q * 2.8) - (p.maxSpd || 0)).toFixed(2) });
      }
    }
    let k = 0; while (!sim.isOver() && k++ < 400000) sim.step(DT);
  }

  P._emit = oEmit; P._continueTravel = oCont; P._physicalContactValid = oPCV;
  porSemente.push({ semente: base, partidas: FORMS.length * POR, gols, golsPorFalha: falhaGol, pct: +(100 * falhaGol / Math.max(1, gols)).toFixed(1), contatoFalho, salvosPelaR10 });
  TG += gols; TF += falhaGol; TC += contatoFalho; TR += salvosPelaR10;
}

const pctTotal = +(100 * TF / Math.max(1, TG)).toFixed(2);
const pcts = porSemente.map(x => x.pct);
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), sha: sha.slice(0, 12), blocosComErro: erros,
  sementes: SEMENTES, partidasTotais: SEMENTES * FORMS.length * POR,
  porSemente,
  AGREGADO: {
    gols: TG, golsPorContatoFalho: TF, pct: pctTotal,
    contatoFalhoTotal: TC, salvosPelaToleranciaR10: TR,
    alvo: '< 8%', veredito: pctTotal < 8 ? 'ATINGE' : 'NAO ATINGE — OS-01 segue PARCIAL',
    amplitudeEntreSementes: { min: Math.min(...pcts), max: Math.max(...pcts) },
  },
  FOLGA_PLANO_CORPO: { amostras: folgas, nota: 'o plano de interceptacao usa 6,2+q*2,8 m/s; o corpo usa p.maxSpd. A folga e a causa do residuo.' },
}, null, 2));
