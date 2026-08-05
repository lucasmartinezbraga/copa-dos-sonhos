#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-109 · O PAPEL DE BOLA PARADA VAZA PARA O JOGO CORRIDO?
 * ==============================================================
 * A OS-108 decomps os 1,56 chutes perdidos pela OS-107:
 *     bola parada   -1,542   (intencional: a area passa a ser defendida)
 *     pos-reinicio  +0,375   (ganho: o time esta na area e sustenta)
 *     jogo corrido  -1,333   (NAO explicado -- e o que esta sendo investigado)
 *
 * SUSPEITA, com arquivo:linha. Duas camadas ignoram quem tem `_setPieceRole`:
 *     :21841  if(...||actor._setPieceRole) return r;
 *     :21867  if(...||p._setPieceRole||finite(this.dead)>.04) return base;
 * e `_setPieceRole` so e limpo por `clearCorner13` (:17074), que roda em
 * `goal|miss|post` (:17098), `goal_kick` (:17328) e na expiracao da CADEIA DE
 * ESCANTEIO (:17848) -- esta ultima so existe se houve escanteio.
 *
 * A edicao E3 da OS-107 marca cinco defensores com `_setPieceRole='zone'` numa
 * FALTA CRUZADA, onde o nucleo nao marcava ninguem. Se nada limpar, esses cinco
 * ficam invisiveis para as duas camadas acima por um trecho de jogo corrido.
 *
 * Se a suspeita valer, o -1,333 e um BUG MEU, nao um preco do mecanismo.
 *
 * Ele mede, amostrando so em tempo vivo (`dead <= 0`):
 *   - quantos jogadores carregam `_setPieceRole` por quadro;
 *   - por quanto tempo vivo um papel sobrevive depois de ser posto;
 *   - quantos quadros vivos tem pelo menos um papel pendurado.
 *
 * Uso: node diag_os109_papel_vazado.js --build=<html> [--matches=12]
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
D('location', { href: 'runner://os109', search: '', hash: '' });
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
let vivo = 0, quadrosVivos = 0, quadrosComPapel = 0, somaPapeis = 0, maxPapeis = 0;
const duracoes = [];
const porPapel = {};
let marcado = null;   // Map<player, {papel, vivo0}>

const oStep = P.step;
P.step = function (dt) {
  const r = oStep.apply(this, arguments);
  if ((Number(this.dead) || 0) > 0) return r;
  vivo += Number(dt) || DT;
  quadrosVivos++;
  let n = 0;
  for (const tm of this.teams) for (const p of tm.players) {
    if (!p || p.red) continue;
    const papel = p._setPieceRole;
    if (papel) {
      n++;
      if (!marcado.has(p)) marcado.set(p, { papel, vivo0: vivo });
      porPapel[papel] = (porPapel[papel] || 0) + 1;
    } else if (marcado.has(p)) {
      const z = marcado.get(p);
      duracoes.push({ papel: z.papel, s: vivo - z.vivo0 });
      marcado.delete(p);
    }
  }
  somaPapeis += n;
  if (n > 0) quadrosComPapel++;
  if (n > maxPapeis) maxPapeis = n;
  return r;
};

const db = buildDB(DATA);
const N = Number(argv.matches || 12);
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
  vivo = 0; marcado = new Map();
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(DT);
}

const ord = a => a.slice().sort((x, y) => x - y);
const pc = (a, q) => a.length ? +ord(a)[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(3) : null;
const ss = duracoes.map(z => z.s);
const porPapelS = {};
for (const z of duracoes) (porPapelS[z.papel] = porPapelS[z.papel] || []).push(z.s);

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  sha256: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
  partidas: N,
  quadros_vivos: quadrosVivos,
  PAPEIS_PENDURADOS_por_quadro_vivo: +(somaPapeis / Math.max(1, quadrosVivos)).toFixed(4),
  maximo_simultaneo: maxPapeis,
  quadros_vivos_com_ao_menos_um: (100 * quadrosComPapel / Math.max(1, quadrosVivos)).toFixed(2) + '%',
  SOBREVIDA_do_papel_em_tempo_vivo_s: ss.length
    ? { n: ss.length, mediana: pc(ss, .5), p90: pc(ss, .9), max: pc(ss, .999) } : 'sem amostra',
  sobrevida_por_papel_s: Object.fromEntries(Object.entries(porPapelS)
    .map(([k, v]) => [k, { n: v.length, mediana: pc(v, .5), max: pc(v, .999) }])
    .sort((a, b) => b[1].n - a[1].n))
}, null, 1));
