#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-87 · CENSO COMPLETO DA FALTA
 * ====================================
 * Antes de recriar a batida de falta, medir o que ela e hoje. Nada e patchado.
 *
 * Responde:
 *   A) quantas faltas por partida, e quantas viram cerimonia de cobranca?
 *   B) qual a divisao de rotina (direta / cruzada / curta)?
 *   C) na DIRETA: o cobrador chega fisicamente a bola? quanto tempo passa entre
 *      o apito e o chute? qual a barreira e a que distancia ela fica?
 *   D) qual o desfecho das diretas?
 *   E) a cena dedicada de falta (`fk_scene`) chega a ser emitida?
 *   F) a bola fica no ponto da falta, ou anda?
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
D('navigator', { userAgent: 'cds-os87', language: 'pt-BR' });
D('location', { href: 'runner://os87', search: '', hash: '' });
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
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

const ev = {};            // contagem por tipo de evento relevante
const rotinas = {};
const diretas = [];       // uma entrada por cobranca direta
let faltas = 0, cerimonias = 0, reinicioRapido = 0, penaltis = 0;

/* A) e B) — contagem de eventos */
const oEmit = P._emit;
P._emit = function (type, e) {
  if (type === 'foul' || type === 'fk_scene' || type === 'freekick' ||
      type === 'freekick_routine' || type === 'penalty') {
    ev[type] = (ev[type] || 0) + 1;
  }
  if (type === 'freekick_routine' && e) rotinas[e.routine] = (rotinas[e.routine] || 0) + 1;
  return oEmit.apply(this, arguments);
};

/* C) e F) — a cerimonia da direta, quadro a quadro */
const oAward = P._awardFoul;
P._awardFoul = function (fouler, victim) {
  faltas++;
  this.__os87 = { t0: this.t, x: victim.x, y: victim.y, team: victim.team };
  return oAward.apply(this, arguments);
};
const oFK = P._freeKick;
P._freeKick = function (team, x, y, input) {
  cerimonias++;
  const r = oFK.apply(this, arguments);
  try {
    const tm = this.teams[team];
    const taker = tm.players.filter(p => !p.red && !p.isGK)
      .sort((a, b) => facet(b, 'setpiece') - facet(a, 'setpiece'))[0];
    this.__os87fk = { t0: this.t, x: x, y: y, team: team, taker: taker,
                      dtg: dist(x, y, tm.oppGoal.x, tm.oppGoal.y),
                      medidoNoChute: false };
  } catch (_) {}
  return r;
};

/* o instante do chute: o evento `freekick` sai dentro de _os36Bater */
const oEmit2 = P._emit;
P._emit = function (type, e) {
  if (type === 'freekick' && this.__os87fk && !this.__os87fk.medidoNoChute) {
    const f = this.__os87fk; f.medidoNoChute = true;
    const b = this.ball, tm = this.teams[f.team];
    const adv = this.teams[1 - f.team].players.filter(p => p && !p.red && !p.isGK);
    let nearestAdv = 1e9, barreira = 0;
    for (const p of adv) {
      const d = dist(p.x, p.y, f.x, f.y);
      if (d < nearestAdv) nearestAdv = d;
      if (p._os36Wall) barreira++;
    }
    diretas.push({
      dtg: f.dtg,
      esperaS: this.t - f.t0,                                  // apito -> chute
      cobradorAteBola: f.taker ? dist(f.taker.x, f.taker.y, f.x, f.y) : null,
      bolaAndou: dist(b.x, b.y, f.x, f.y),                     // saiu do ponto?
      adversarioMaisProximo: nearestAdv,
      barreira: barreira,
      resultado: e && e.result
    });
  }
  return oEmit2.apply(this, arguments);
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
let audit = null;
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
  if (typeof sim.getOS36Audit === 'function') {
    const a = sim.getOS36Audit();
    if (!audit) audit = { faltas: 0, barreirasArmadas: 0, quadrosDeInvasaoContida: 0 };
    audit.faltas += a.faltas; audit.barreirasArmadas += a.barreirasArmadas;
    audit.quadrosDeInvasaoContida += a.quadrosDeInvasaoContida;
  }
}

const ord = a => a.slice().sort((x, y) => x - y);
const pc = (a, p) => a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(3) : null;
const col = k => ord(diretas.map(d => d[k]).filter(v => Number.isFinite(v)));
const resumo = k => { const a = col(k); return { min: pc(a, 0), p10: pc(a, .1), mediana: pc(a, .5), p90: pc(a, .9), max: pc(a, .999) }; };
const desfechos = {};
for (const d of diretas) desfechos[d.resultado || '?'] = (desfechos[d.resultado || '?'] || 0) + 1;

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  A_faltas_por_partida: +(faltas / N).toFixed(2),
  A_viraram_cerimonia: +(cerimonias / N).toFixed(2),
  A_reinicio_rapido_por_partida: +((faltas - cerimonias - (ev.penalty || 0)) / N).toFixed(2),
  B_rotinas: rotinas,
  E_cena_dedicada_fk_scene_emitida: ev.fk_scene || 0,
  C_diretas_medidas: diretas.length,
  C_espera_apito_ate_chute_s: resumo('esperaS'),
  C_cobrador_ate_a_bola_m: resumo('cobradorAteBola'),
  C_bola_saiu_do_ponto_m: resumo('bolaAndou'),
  C_adversario_mais_proximo_m: resumo('adversarioMaisProximo'),
  C_tamanho_da_barreira: resumo('barreira'),
  C_distancia_ao_gol_m: resumo('dtg'),
  D_desfechos: desfechos,
  OS36_audit_total: audit
}, null, 1));
