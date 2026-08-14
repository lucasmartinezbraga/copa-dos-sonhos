#!/usr/bin/env node
'use strict';
/* A PASSADA, MEDIDA NA PERNA DESENHADA
   =========================================================================
   Primeira versao desta sonda reimplementava a formula da cadencia para
   depois "verificar" a formula — e claro que o numero nao mudou quando a
   formula mudou. Erro meu, e do tipo que se repete: **uma sonda que refaz a
   conta do alvo nao mede o alvo, mede a si mesma.**

   Esta versao nao sabe formula nenhuma. Ela poe um Proxy no `ctx` durante a
   chamada real de `CDS_F25D.body` e le os DOIS RETANGULOS DE PERNA que o
   desenho pinta. Do par sai a tesoura:

       llY = r*.40 - max(0, sw)*r*.30       (perna esquerda)
       rlY = r*.40 - max(0,-sw)*r*.30       (perna direita)
       =>  sw = (rlY - llY) / (r*.30)        em -1..1

   `sw = sin(fase)*amp`. Contando as trocas de sinal de `sw` sai a CADENCIA em
   passos por segundo (um passo por cruzamento do zero), e o pico de |sw| da a
   AMPLITUDE de abertura. Nenhum dos dois passa por hipotese minha.

   Uso: node tools/fisica/tela/passada.js [build.html] [velocidades...]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const vv = process.argv.slice(3).map(Number).filter(v => v > 0);
const VEL = vv.length ? vv : [1, 3];
const SEGUNDOS = 8;

const ARMAR = () => {
  const real = window.CDS_F25D;
  if (!real) return false;
  if (window.__psd) return true;
  const sim = window.__CDS_ACTIVE_SIM;
  const mapa = Object.create(null);
  for (const tm of sim.teams) for (const p of tm.players) {
    if (p) mapa[(p.ref && p.ref.n) || p.n || ('#' + (p.num || 0))] = p;
  }
  window.__psd = { am: [], ligado: false };

  const enc = Object.create(null);
  for (const k of Object.keys(real)) enc[k] = real[k];
  enc.body = function (ctx, o) {
    const S = window.__psd;
    if (!S.ligado) return real.body(ctx, o);
    const rec = [];
    const espiao = new Proxy(ctx, {
      get(t, k) {
        const v = t[k];
        if (typeof v !== 'function') return v;
        if (k === 'fillRect') return function (x, y, w, h) { rec.push([x, y, w, h]); return v.apply(t, arguments); };
        return v.bind(t);
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    const saida = real.body(espiao, o);
    const p = mapa[o.key], r = o.r;
    if (p && !p.red && r > 0) {
      /* as duas coxas da corrida: mesma largura .26r, mesma altura .46r */
      const pernas = rec.filter(q => Math.abs(q[2] - r * .26) < r * .02 &&
                                     Math.abs(q[3] - r * .46) < r * .02);
      if (pernas.length >= 2) {
        const sw = (pernas[1][1] - pernas[0][1]) / (r * .30);
        if (Math.abs(sw) <= 1.2) {
          S.am.push({ k: o.key, t: performance.now(), sw: sw, r: r,
                      mx: +p.x, my: +p.y });
        }
      }
    }
    return saida;
  };
  window.CDS_F25D = enc;
  return true;
};

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => window.__quickMatch(40, 120));
  await pg.waitForTimeout(1500);
  if (!await pg.evaluate(ARMAR)) { console.error('nao consegui armar o encaminhador'); process.exit(1); }

  console.log(`perna lida do proprio desenho · ${SEGUNDOS}s por velocidade\n`);
  console.log('vel   v jogador    passos/s   amplitude   alvo bio   excesso');
  console.log('---   ---------    --------   ---------   --------   -------');

  for (const v of VEL) {
    await pg.evaluate(vel => {
      window.G.speed = vel;
      window.__psd.am.length = 0; window.__psd.ligado = true;
    }, v);
    await pg.waitForTimeout(SEGUNDOS * 1000);
    const am = await pg.evaluate(() => { window.__psd.ligado = false; return window.__psd.am; });
    if (!am.length) { console.log(`${String(v).padStart(3)}   (sem amostra)`); continue; }

    const porJog = new Map();
    for (const a of am) { if (!porJog.has(a.k)) porJog.set(a.k, []); porJog.get(a.k).push(a); }

    const cadencias = [], amplitudes = [], velocidades = [];
    for (const [, seq] of porJog) {
      seq.sort((a, b) => a.t - b.t);
      /* velocidade fisica do jogador: metros de campo por segundo de JOGO */
      let dm = 0, dtr = 0;
      for (let i = 1; i < seq.length; i++) {
        const dt = (seq[i].t - seq[i - 1].t) / 1000;
        if (!(dt > 0.004 && dt < 0.2)) continue;
        dm += Math.hypot(seq[i].mx - seq[i - 1].mx, seq[i].my - seq[i - 1].my);
        dtr += dt;
      }
      if (dtr < 1) continue;
      const vJog = dm / (dtr * v);
      if (vJog < 1.2) continue;                       // parado nao tem cadencia
      /* cruzamentos do zero de sw = passos */
      let cruz = 0, pico = 0, ant = null;
      for (const a of seq) {
        if (Math.abs(a.sw) > pico) pico = Math.abs(a.sw);
        if (ant !== null && ((ant < 0 && a.sw >= 0) || (ant > 0 && a.sw <= 0))) cruz++;
        ant = a.sw;
      }
      const dur = (seq[seq.length - 1].t - seq[0].t) / 1000;
      if (dur < 1) continue;
      cadencias.push(cruz / dur);
      amplitudes.push(pico);
      velocidades.push(vJog);
    }
    if (!cadencias.length) { console.log(`${String(v).padStart(3)}   (ninguem correndo)`); continue; }
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const vJ = med(velocidades), cad = med(cadencias), ampl = med(amplitudes);
    const passoReal = 0.60 + 0.16 * vJ, alvoC = vJ / passoReal;
    console.log(`${String(v).padStart(3)}   ${vJ.toFixed(2).padStart(6)} m/s   ` +
      `${cad.toFixed(2).padStart(8)}   ${ampl.toFixed(2).padStart(9)}   ` +
      `${alvoC.toFixed(2).padStart(8)}   ${(cad / alvoC).toFixed(2)}x`);
  }
  console.log('\ncorredor real: 2,6 passos/s trotando ate ~4,6 no maximo.');
  console.log('amplitude 1,00 = perna aberta por inteiro; 0,30 = miudando.');
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
