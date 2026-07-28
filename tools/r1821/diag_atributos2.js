#!/usr/bin/env node
'use strict';
/* IMPACTO DOS ATRIBUTOS — INSTRUMENTO V2
   -------------------------------------------------------------------------
   Corrige os dois defeitos da v1:
     · ALTERNÂNCIA DE LADOS: cada caso roda duas vezes com os mesmos seeds,
       invertendo quem é casa. A vantagem de casa (que na v1 sozinha separava
       0,45 gol entre times IDÊNTICOS) cancela.
     · MÉTRICAS CERTAS: `passOk` (não passesOk) e `onTarget` existem de fato.
       E finalização é medida por CONVERSÃO (gols/xG), que é o que o atributo
       deveria mover — aproveitar melhor a MESMA chance — e é muito menos
       ruidoso que gol bruto.

   Cada caso: dois times neutros (45 atributos em 82), com um atributo em 95 de
   um lado e 55 do outro. O controle mede o piso de ruído. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-attr2', language: 'pt-BR' });
define('location', { href: 'runner://attr2', search: '', hash: '' });
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
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); }
  catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message || e))) continue; throw e; }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const ATTR_KEYS = (global.CDSDataV3 && Array.isArray(global.CDSDataV3.attributes)) ? global.CDSDataV3.attributes : [];
if (!ATTR_KEYS.length) { realConsole.error('CDSDataV3.attributes indisponivel'); process.exit(3); }

const N = Number(argv.matches || 24), DT = 1 / 30;
const ALTO = Number(argv.alto || 95), BAIXO = Number(argv.baixo || 55), NEUTRO = 82;

function side(home, overrides) {
  const picked = autoLineup(squad, '4-3-3', 0);
  const lineup = picked.lineup.map((slot, i) => {
    const pos = slot.pos || 'CM';
    const attributesV3 = Object.fromEntries(ATTR_KEYS.map(k => [k, NEUTRO]));
    for (const k of Object.keys(overrides || {})) if (k in attributesV3) attributesV3[k] = overrides[k];
    return { ...slot, p: {
      id: `ATTR_${pos}_${i}`, n: `Atleta ${i + 1}`, slot: pos, pos, r: NEUTRO, starter: 1,
      traits: [], behaviorTraits: [], naturalRoles: [],
      a8: new Array(8).fill(NEUTRO), attributesV3,
      profileV3: { dominantFoot: 'R', weakFoot: 4, heightCmSim: pos === 'GK' ? 190 : 182, bodyType: 'average', primaryPosition: pos },
      _a: {}
    } };
  });
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup, bench: [], formKey: '4-3-3', style: 'balanced' };
}

const zero = () => ({ gols: 0, chutes: 0, alvo: 0, xg: 0, desarmes: 0, tentativas: 0,
                      passes: 0, passOk: 0, dribles: 0, faltas: 0, n: 0 });
function soma(acc, st, gols) {
  acc.gols += gols;
  acc.chutes += +st.shots || 0; acc.alvo += +st.onTarget || 0; acc.xg += +st.xg || 0;
  acc.desarmes += +st.tackles || 0; acc.passes += +st.passes || 0; acc.passOk += +st.passOk || 0;
  acc.faltas += +st.fouls || 0;
  acc.n++;
}
function medias(a) {
  const m = Math.max(1, a.n);
  return {
    gols: +(a.gols / m).toFixed(3),
    chutes: +(a.chutes / m).toFixed(2),
    noAlvo: +(a.alvo / m).toFixed(2),
    xg: +(a.xg / m).toFixed(3),
    /* NÃO usar gols/xG como conversão: o xG é acumulado do próprio pGoal que
       decide o gol, então a razão dá ~1,0 por construção e esconde o atributo.
       Fica registrada só para comparação; a métrica válida é gol por CHUTE. */
    conversao: +(a.gols / Math.max(0.001, a.xg)).toFixed(3),
    golsPorChute: +(a.gols / Math.max(1, a.chutes)).toFixed(4),
    taxaNoAlvo: +(100 * a.alvo / Math.max(1, a.chutes)).toFixed(1),
    desarmes: +(a.desarmes / m).toFixed(2),
    precisaoPasse: +(100 * a.passOk / Math.max(1, a.passes)).toFixed(2),
    faltas: +(a.faltas / m).toFixed(2),
  };
}

/* Roda N partidas com override X em casa e Y fora, e outras N invertendo.
   Acumula sempre no bucket do LADO QUE TEM O OVERRIDE, não do lado do campo. */
function roda(overAlto, overBaixo) {
  const alto = zero(), baixo = zero();
  for (let orient = 0; orient < 2; orient++) {
    for (let i = 0; i < N; i++) {
      srand(1710000 + i * 977);
      const casaAlto = orient === 0;
      const sim = new MatchSim(
        side(true, casaAlto ? overAlto : overBaixo),
        side(false, casaAlto ? overBaixo : overAlto),
        { neutral: true, labMode: true }
      );
      let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
      const iAlto = casaAlto ? 0 : 1, iBaixo = casaAlto ? 1 : 0;
      soma(alto, sim.stats[iAlto], sim.score[iAlto]);
      soma(baixo, sim.stats[iBaixo], sim.score[iBaixo]);
    }
  }
  return { alto: medias(alto), baixo: medias(baixo) };
}

const todos = v => Object.fromEntries(ATTR_KEYS.map(k => [k, v]));
/* Chaves de goleiro. O `facet('gk')` = reflexos*.43 + defesa*.27 +
   posicionamento*.20 + dominio_area*.10; o `gk_one_on_one` usa saida_gol.
   O goleiro entra DUAS vezes no desfecho: dentro do pGoal (linha 6085,
   `skill=(atk-gkF)/100`) e na fatia de defesa (linha 6131). Medir o efeito
   TOTAL em gols sofridos, que é o que o jogador sente. */
const GK_KEYS = ['reflexos', 'defesa', 'posicionamento', 'dominio_area', 'saida_gol',
                 'seguranca', 'jogo_aereo', 'um_contra_um', 'agilidade', 'reposicao'];
const soGk = v => Object.fromEntries(GK_KEYS.filter(k => ATTR_KEYS.includes(k)).map(k => [k, v]));

const CASOS = [
  { nome: 'CONTROLE (identicos)', a: {}, b: {}, foco: ['gols', 'conversao', 'desarmes', 'precisaoPasse', 'chutes'] },
  { nome: 'finalizacao', a: { finalizacao: ALTO }, b: { finalizacao: BAIXO }, foco: ['conversao', 'gols', 'taxaNoAlvo'] },
  { nome: 'passe', a: { passe: ALTO }, b: { passe: BAIXO }, foco: ['precisaoPasse', 'chutes'] },
  { nome: 'desarme', a: { desarme: ALTO }, b: { desarme: BAIXO }, foco: ['desarmes', 'faltas'] },
  { nome: 'ritmo+aceleracao', a: { ritmo: ALTO, aceleracao: ALTO }, b: { ritmo: BAIXO, aceleracao: BAIXO }, foco: ['chutes', 'gols'] },
  { nome: 'cabeceio', a: { cabeceio: ALTO }, b: { cabeceio: BAIXO }, foco: ['gols', 'chutes'] },
  { nome: 'drible', a: { drible: ALTO }, b: { drible: BAIXO }, foco: ['chutes', 'gols'] },
  { nome: 'TUDO', a: todos(ALTO), b: todos(BAIXO), foco: ['gols', 'conversao', 'chutes', 'precisaoPasse'] },
  /* GOLEIRO invertido de propósito: o time "alto" tem o goleiro BOM, então o
     que interessa é ele SOFRER menos. Leio pelo lado do adversário. */
  { nome: 'GOLEIRO', a: soGk(ALTO), b: soGk(BAIXO), foco: ['golsPorChute', 'gols', 'chutes'] },
];

/* --so=nome roda apenas os casos cujo nome contem o texto (mais o controle). */
const filtro = String(argv.so || '').toLowerCase();
const CASOS_ATIVOS = filtro
  ? CASOS.filter(c => c.nome.toLowerCase().indexOf(filtro) >= 0 || /CONTROLE/.test(c.nome))
  : CASOS;

const out = { build: String(argv.build).split(/[\\/]/).pop(), partidasPorOrientacao: N,
              totalPorCaso: N * 2, alto: ALTO, baixo: BAIXO, atributos: ATTR_KEYS.length, casos: [] };
for (const c of CASOS_ATIVOS) {
  const r = roda(c.a, c.b);
  const resumo = {};
  for (const f of c.foco) resumo[f] = { alto: r.alto[f], baixo: r.baixo[f], separacao: +(r.alto[f] - r.baixo[f]).toFixed(3) };
  out.casos.push({ atributo: c.nome, foco: resumo, completoAlto: r.alto, completoBaixo: r.baixo });
  realConsole.error(`  ${c.nome}: ` + c.foco.map(f => `${f} ${r.alto[f]}/${r.baixo[f]}`).join('  '));
}
realConsole.log(JSON.stringify(out, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
