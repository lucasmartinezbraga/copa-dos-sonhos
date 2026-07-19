/* ═══════════ tactics.js ═══════════ */
/* =========================================================================
   COPA DOS SONHOS — tactics.js
   §4 da spec: personalidade tática por seleção histórica.
   §5 da spec: tendências individuais derivadas de atributos + traits.
   Arquitetura: TacticalEngine puro (sem DOM). O MatchSim consome o perfil
   via team.fx estendido; as tendências via p.ref._tend (cache).
   ========================================================================= */
(function () {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const C = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root;

/* ------------------- PERFIS CURADOS (seleções icônicas) ------------------ */
/* style = base STYLE_FX; knobs multiplicativos: ritmo (velocidade de decisão),
   drible, cross, shoot (chute de fora), largura. 1 = neutro.                */
const ICONIC = {
  'Brasil|1970':      { style: 'tiki',    ritmo: 1.05, drible: 1.5,  cross: 0.9,  shoot: 1.2 },
  'Brasil|1982':      { style: 'tiki',    ritmo: 1.0,  drible: 1.4,  cross: 0.85, shoot: 1.25 },
  'Brasil|2002':      { style: 'counter', ritmo: 1.05, drible: 1.45, cross: 1.0,  shoot: 1.1 },
  'Espanha|2010':     { style: 'tiki',    ritmo: 0.88, drible: 0.9,  cross: 0.7,  shoot: 0.8 },
  'Alemanha|2014':    { style: 'press',   ritmo: 1.1,  drible: 0.9,  cross: 1.0,  shoot: 1.0 },
  'Alemanha|1974':    { style: 'direct',  ritmo: 1.05, drible: 0.9,  cross: 1.1,  shoot: 1.1 },
  'Itália|2006':      { style: 'counter', ritmo: 0.92, drible: 0.85, cross: 0.95, shoot: 1.0 },
  'Itália|1982':      { style: 'counter', ritmo: 0.9,  drible: 0.9,  cross: 0.95, shoot: 1.05 },
  'Holanda|1974':     { style: 'press',   ritmo: 1.12, drible: 1.15, cross: 0.9,  shoot: 1.1 },
  'França|1998':      { style: 'tiki',    ritmo: 0.98, drible: 1.2,  cross: 0.9,  shoot: 1.0 },
  'Argentina|1986':   { style: 'counter', ritmo: 1.0,  drible: 1.6,  cross: 0.85, shoot: 1.1 },
  'Argentina|2022':   { style: 'tiki',    ritmo: 0.95, drible: 1.3,  cross: 0.85, shoot: 1.0 },
  'Inglaterra|1966':  { style: 'direct',  ritmo: 1.0,  drible: 0.85, cross: 1.35, shoot: 1.05 },
  'Espanha|2026':     { style: 'tiki',    ritmo: 0.92, drible: 1.1,  cross: 0.8,  shoot: 0.95 },
  'Hungria|1954':     { style: 'tiki',    ritmo: 1.08, drible: 1.2,  cross: 0.9,  shoot: 1.3 },
  'Uruguai|1950':     { style: 'counter', ritmo: 0.95, drible: 1.0,  cross: 1.0,  shoot: 1.05 },
  'Portugal|2016':    { style: 'counter', ritmo: 0.92, drible: 1.15, cross: 1.05, shoot: 1.1 },
  'Croácia|2018':     { style: 'tiki',    ritmo: 0.95, drible: 1.05, cross: 0.95, shoot: 1.1 },
  'Bélgica|2018':     { style: 'counter', ritmo: 1.05, drible: 1.2,  cross: 1.0,  shoot: 1.15 },
};

/* -------------------- HEURÍSTICA para as demais seleções ----------------- */
// Deriva o perfil das forças do elenco: técnica média do ataque → drible;
// pontas fortes → cruzamento; meio criativo → posse; físico defensivo → pressão.
function heuristicProfile(squad) {
  const byLine = { DEF: [], MID: [], FWD: [] };
  for (const p of squad.pl) {
    const ln = C.LINE_OF[p.slot];
    if (byLine[ln]) byLine[ln].push(p);
  }
  const avg = (arr, f) => arr.length ? arr.reduce((s, p) => s + f(p), 0) / arr.length : 60;
  const tecAtk = avg(byLine.FWD, p => C.getAttr(p, 'drible'));
  const criMid = avg(byLine.MID, p => (C.getAttr(p, 'passe') + C.getAttr(p, 'visao')) / 2);
  const fisDef = avg(byLine.DEF, p => (C.getAttr(p, 'forca') + C.getAttr(p, 'resistencia')) / 2);
  const wingCross = avg(squad.pl.filter(p => ['LW','RW','LM','RM'].includes(p.slot)), p => C.getAttr(p, 'cruzamento'));

  // cada estilo pontua pelo DESVIO do seu atributo-chave em relação à base típica,
  // pra que a maior FORÇA RELATIVA do time defina a identidade (não a escala bruta).
  const cand = [
    ['tiki',    (criMid - 70) * 1.3],                 // meio técnico acima da média
    ['press',   (fisDef - 68) * 1.2],                 // defesa física acima da média
    ['wings',   (wingCross - 68) * 1.3],              // pontas cruzadoras
    ['direct',  (fisDef - 68) * 0.6 + (wingCross - 68) * 0.7 + 1],
    ['counter', (squad.r < 78 ? 5 : 0) + (tecAtk - 72) * 0.4],
    ['balanced', 1.5],                                // âncora baixa: só quando nada domina
  ].sort((a, b) => b[1] - a[1]);
  return {
    style: cand[0][0],
    ritmo: C.clamp(0.9 + (tecAtk - 72) / 160, 0.85, 1.12),
    drible: C.clamp(0.75 + (tecAtk - 60) / 55, 0.75, 1.5),
    cross: C.clamp(0.75 + (wingCross - 60) / 60, 0.75, 1.4),
    shoot: C.clamp(0.85 + (avg(byLine.MID, p => C.getAttr(p, 'chute_longe')) - 65) / 90, 0.85, 1.3),
  };
}

function getProfile(squad) {
  if (squad._prof) return squad._prof;
  const key = squad.c + '|' + squad.y;
  const base = ICONIC[key] || heuristicProfile(squad);
  squad._prof = base;
  return base;
}

/* --------------------- TENDÊNCIAS INDIVIDUAIS (§5) ----------------------- */
// Derivadas de atributos granulares + traits. Cache em p._tend.
function tendencies(p) {
  if (p._tend) return p._tend;
  const a = k => C.getAttr(p, k);
  const tr = new Set(p.traits || []);
  const t = {
    driblador:  a('drible') >= 84 || tr.has('DRIBBLER'),
    lancador:   (a('passe') >= 82 && a('visao') >= 84) || tr.has('PLAYMAKER'),
    organizador:(a('decisao') >= 82 && a('passe') >= 80) && C.LINE_OF[p.slot] === 'MID',
    finalizador:a('finalizacao') >= 84 || tr.has('FINISHER'),
    velocista:  a('ritmo') >= 88 || tr.has('SPEEDSTER'),
    cabeceador: a('cabeceio') >= 84 || tr.has('AERIAL_THREAT'),
    marcador:   a('desarme') >= 83 || tr.has('BALL_WINNER'),
  };
  p._tend = t;
  return t;
}

const API = { getProfile, tendencies, ICONIC };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.TACTICS = API;
})();


