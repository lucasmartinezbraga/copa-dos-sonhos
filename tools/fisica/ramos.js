#!/usr/bin/env node
/* SONDA DE RAMOS — mede de uma vez os ramos dos defeitos formulados por leitura.
   -------------------------------------------------------------------------
   O Volume VIII-A da investigacao registrou que quatro premissas cairam porque
   as sondas originais mediram o CODIGO DO MOTOR, e com 362 sobrescritas em 60
   camadas o que roda e o TOPO DA PILHA. Sete defeitos ainda dependem de leitura:
   D08, D11, D12, D13, D14, D15, D16 e D26.

   Esta sonda conta o ramo de cada um numa unica execucao, no topo da pilha,
   usando os auditores que as proprias camadas publicam quando existem e
   contadores proprios quando nao existem.

   Uso: node tools/fisica/ramos.js <build.html> [partidas] */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
function noop() {}
function def(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
def('window', global); def('self', global); def('navigator', { userAgent: 'x', language: 'pt-BR' });
def('location', { href: '', search: '', hash: '' }); def('performance', { now: () => 0 }); def('crypto', crypto.webcrypto);
def('requestAnimationFrame', () => 0); def('cancelAnimationFrame', noop); def('addEventListener', noop); def('removeEventListener', noop);
def('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop })); def('alert', noop);
def('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop }); def('sessionStorage', global.localStorage);
def('CanvasRenderingContext2D', undefined); def('HTMLElement', function () {}); def('HTMLCanvasElement', function () {});
def('Image', function () {}); def('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
def('__showBootError', noop); def('__cdsDebugWarn', noop); def('CDS_DEBUG', false);
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04', 'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const html = fs.readFileSync(process.argv[2] || 'dist/index.html', 'utf8');
{ const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(html))) { const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('s' + i); i++;
    if (SKIP.has(id)) continue; try { vm.runInThisContext(m[2], { filename: id }); } catch (_) {} } }

const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS)) ? STYLE_KEYS : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0); return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };
const N = Number(process.argv[3] || 12);

const C = {};
const inc = (k, n = 1) => C[k] = (C[k] || 0) + n;

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const sim = new MatchSim(mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true),
                           mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false),
                           { neutral: true, labMode: true });
  const P = Object.getPrototypeOf(sim);

  /* D12 · a r13 manda a bola solta para FORA de proposito (edge<5,5 e 64%).
     Conta quantas chamadas de _looseBall SAEM com alvo fora do campo. */
  const topoLoose = P._looseBall;
  sim._looseBall = function (x, y) {
    inc('D12_looseBall_chamado');
    if (y < 0 || y > FW || x < 0 || x > FL) inc('D12_alvo_JA_fora_no_topo');
    const antes = { x: this.ball.x, y: this.ball.y };
    const r = topoLoose.call(this, x, y);
    const b = this.ball;
    if (b.x < 0 || b.x > FL || b.y < 0 || b.y > FW) inc('D12_bola_POUSOU_fora');
    if (b.owner) inc('D12_terminou_com_dono'); else inc('D12_ficou_solta');
    void antes;
    return r;
  };

  /* D26 · decideT e escrito em tres lugares no motor e reescrito pela r13.
     Conta as escritas por origem, observando o valor a cada quadro. */
  let ultimoDecideT = null;
  const topoStep = P.step;
  sim.step = function (dt) {
    const r = topoStep.call(this, dt);
    const v = this.decideT;
    if (v !== ultimoDecideT) {
      inc('D26_mudancas_de_decideT');
      if (Math.abs(v - 0.28) < 1e-9) inc('D26_valor_exato_0_28');
      ultimoDecideT = v;
    }
    return r;
  };

  /* D16 · as camadas falsificam _breaking durante _integrate.
     Conta quantas vezes o campo entra falso e sai restaurado. */
  const topoInt = P._integrate;
  sim._integrate = function (p, tx, ty, dt, freeze) {
    const antes = p && p._breaking;
    inc('D16_integrate_chamado');
    const r = topoInt.call(this, p, tx, ty, dt, freeze);
    if (p && p._breaking !== antes) inc('D16_breaking_saiu_diferente');
    return r;
  };

  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(1 / 30);

  /* auditores que as proprias camadas publicam */
  const puxa = (nome, chave, campos) => {
    if (typeof sim[nome] !== 'function') { inc(chave + '_SEM_AUDITOR'); return; }
    let a; try { a = sim[nome](); } catch (_) { return; }
    for (const c of campos) if (typeof a?.[c] === 'number') inc(`${chave}_${c}`, a[c]);
  };
  puxa('getR183Report', 'D11', ['decisionChecks', 'smartShotVetoes', 'touchlineErrorsPrevented',
                                'touchlineErrorsAllowed', 'invalidTargetsRecovered']);
  puxa('getShotPlausibilityAudit', 'D13', ['chutesVistos', 'chutesForaComprimidos',
       'amplitudeMediaAntes_m', 'amplitudeMediaDepois_m', 'amplitudeMaximaAntes_m']);
  puxa('getR12Audit', 'D14r12', ['speedClamps', 'teleportBlocks', 'corrections']);
  puxa('getR1899Audit', 'D15', ['bloqueios', 'teleportes']);
  puxa('getR1905', 'D14r1905', ['papeisMortos', 'limpezas']);
  puxa('getR1904', 'D14r1904', ['cortes', 'saidas']);
}

const pp = v => +(v / N).toFixed(2);
const saida = { partidas: N, porPartida: {} };
for (const k of Object.keys(C).sort()) saida.porPartida[k] = pp(C[k]);
console.log(JSON.stringify(saida, null, 1));
