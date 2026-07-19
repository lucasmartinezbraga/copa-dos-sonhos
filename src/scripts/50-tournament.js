/* ═══════════ tournament.js ═══════════ */
/* =========================================================================
   COPA DOS SONHOS — tournament.js
   Estrutura e simulação da Copa de 32 seleções (grupos → mata-mata).
   Puro (sem DOM). Node (module.exports) + browser (window).
   ========================================================================= */
(function () {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const C = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root;
const M = (typeof module !== 'undefined' && module.exports) ? require('./match.js') : root;
const { R, Ri, chance, pick, shuffle, clamp, facet, autoLineup, FORMATION_KEYS } = C;

const GROUP_NAMES = ['A','B','C','D','E','F','G','H'];

/* ------------------------- SORTEIO DO TORNEIO --------------------------- */
// 32 seleções, 1 por nação, sempre inclui a do jogador. Mistura eras.
function drawField(db, playerSid) {
  const player = db.byId[playerSid];
  const byNation = {};
  for (const s of db.squads) if (s.sid !== playerSid) (byNation[s.nid] = byNation[s.nid] || []).push(s);
  const nations = Object.keys(byNation).map(Number).filter(n => n !== player.nid);
  shuffle(nations);
  const field = [player];
  for (const nid of nations) {
    if (field.length >= 32) break;
    // sorteia uma era da nação, com leve viés para squads mais fortes
    const squads = byNation[nid].slice().sort((a, b) => b.r - a.r);
    const ix = Math.min(squads.length - 1, Math.floor(Math.pow(R(), 1.6) * squads.length));
    field.push(squads[ix]);
  }
  return field; // [0] é o jogador
}

// distribui em 8 grupos de 4 por potes de força (cabeças de chave)
function drawGroups(field) {
  const seeded = field.slice().sort((a, b) => b.r - a.r);
  const pots = [seeded.slice(0, 8), seeded.slice(8, 16), seeded.slice(16, 24), seeded.slice(24, 32)];
  for (const pot of pots) shuffle(pot);
  const groups = GROUP_NAMES.map((name, gi) => ({
    name,
    teams: [pots[0][gi], pots[1][gi], pots[2][gi], pots[3][gi]],
  }));
  return groups;
}

// rodadas clássicas de grupo (3 rodadas, 2 jogos por rodada)
function groupFixtures(group) {
  const [a, b, c, d] = group.teams.map(t => t.sid);
  return [
    [{ h: a, a: b }, { h: c, a: d }],
    [{ h: a, a: c }, { h: b, a: d }],
    [{ h: a, a: d }, { h: b, a: c }],
  ];
}

/* ---------------------------- CLASSIFICAÇÃO ----------------------------- */
function blankRow(sid) { return { sid, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }; }

function tableOf(group, results) {
  const rows = {};
  for (const t of group.teams) rows[t.sid] = blankRow(t.sid);
  for (const r of results) {
    if (r.g == null) continue;
    const H = rows[r.h], A = rows[r.a];
    H.j++; A.j++; H.gp += r.g[0]; H.gc += r.g[1]; A.gp += r.g[1]; A.gc += r.g[0];
    if (r.g[0] > r.g[1]) { H.v++; A.d++; H.pts += 3; }
    else if (r.g[0] < r.g[1]) { A.v++; H.d++; A.pts += 3; }
    else { H.e++; A.e++; H.pts++; A.pts++; }
  }
  const list = Object.values(rows);
  // desempate: pontos, saldo, gols pró, confronto direto, sorteio estável
  list.sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const sx = x.gp - x.gc, sy = y.gp - y.gc;
    if (sy !== sx) return sy - sx;
    if (y.gp !== x.gp) return y.gp - x.gp;
    const h2h = results.find(r => (r.h === x.sid && r.a === y.sid) || (r.h === y.sid && r.a === x.sid));
    if (h2h && h2h.g && h2h.g[0] !== h2h.g[1]) {
      const winner = h2h.g[0] > h2h.g[1] ? h2h.h : h2h.a;
      return winner === x.sid ? -1 : 1;
    }
    return x.sid - y.sid;
  });
  return list;
}

/* --------------------------- SIMULAÇÃO RÁPIDA --------------------------- */
// IA: escolhe a MELHOR formação para o elenco (maior média do XI + menos improvisos)
function bestFormationFor(squad) {
  let best = null, bestVar = 0, bestScore = -1e9;
  for (const fk of FORMATION_KEYS) {
    const nVars = (C.FORMATIONS[fk] && C.FORMATIONS[fk].variations.length) || 1;
    for (let vi = 0; vi < nVars; vi++) {
      const { lineup } = autoLineup(squad, fk, vi);
      const filled = lineup.filter(l => l.p);
      if (filled.length < 11) continue;
      const avg = filled.reduce((s, l) => s + l.p.r, 0) / filled.length;
      let outOfPos = 0;
      for (const l of filled) if (l.p.slotPos !== l.pos && !(l.p.elig || []).includes(l.pos)) outOfPos++;
      const score = avg - outOfPos * 2.5;
      if (score > bestScore) { bestScore = score; best = fk; bestVar = vi; }
    }
  }
  return { fk: best || '4-3-3', varIdx: bestVar };
}

// IA: parte da IDENTIDADE histórica da seleção (perfil curado/heurístico) e só
// desvia quando o confronto pede (muito mais fraco → recua; muito mais forte → aperta).
function pickStyleFor(squad, oppSquad) {
  const prof = (C.TACTICS && C.TACTICS.getProfile) ? C.TACTICS.getProfile(squad) :
               (root.TACTICS ? root.TACTICS.getProfile(squad) : null);
  let baseStyle = (prof && prof.style) || 'balanced';
  const myR = squad.r, oppR = oppSquad ? oppSquad.r : myR;
  const edge = myR - oppR;   // + mais forte, - mais fraco

  // ajuste pelo confronto (probabilístico, mantém identidade na maioria das vezes)
  if (edge <= -10 && chance(0.6)) return chance(0.5) ? 'park' : 'counter';   // bem mais fraco
  if (edge <= -5  && chance(0.4)) return 'counter';                          // mais fraco
  if (edge >= 10  && chance(0.5)) return baseStyle === 'tiki' ? 'tiki' : 'press'; // bem mais forte aperta
  if (edge >= 6   && chance(0.3) && baseStyle === 'balanced') return 'press';

  // identidade preservada, com pequena chance de variar pra não ser 100% previsível
  if (chance(0.15)) {
    const alts = { tiki:['tiki','press'], counter:['counter','park'], press:['press','direct'],
                   direct:['direct','wings'], wings:['wings','direct'], balanced:['balanced','press','counter'],
                   park:['park','counter'] }[baseStyle] || [baseStyle];
    return pick(alts);
  }
  return baseStyle;
}

function teamFor(db, sid, oppSid) {
  const squad = db.byId[sid];
  const { fk, varIdx } = bestFormationFor(squad);
  const { lineup, bench } = autoLineup(squad, fk, varIdx);
  const oppSquad = oppSid ? db.byId[oppSid] : null;
  const style = pickStyleFor(squad, oppSquad);
  return { squad, name: squad.c, flag: squad.f, color: '#2e9bff', lineup, bench, formKey: fk, style };
}

// registra o time montado no draft como uma "seleção" jogável (sid 'ME')
function registerPlayerTeam(db, picks, benchPicks) {
  const pl = picks.map(x => ({ ...x.p, starter: true, origin: x.from }))
    .concat(benchPicks.map(x => ({ ...x.p, starter: false, origin: x.from })));
  const r = Math.round(picks.reduce((s, x) => s + x.p.r, 0) / Math.max(1, picks.length));
  const squad = { sid: 'ME', nid: -1, y: 2026, c: 'Seleção dos Sonhos', f: '⭐', r, pl, key: 'Seleção dos Sonhos' };
  // TÓPICO 1 · o elenco montado no draft é saneado ao entrar no banco:
  // duas cartas do mesmo atleta (anos diferentes, grafias diferentes)
  // nunca coexistem na Seleção dos Sonhos.
  squad.pl = dedupeRoster(squad.pl, 'Seleção dos Sonhos');
  db.byId.ME = squad;
  return squad;
}

// disputa de pênaltis (5 + alternadas)
function shootout(simOrTeams) {
  const T = simOrTeams.teams ? simOrTeams.teams.map(t => t.players.filter(p => !p.red)) :
    simOrTeams.map(t => t.lineup.map(l => ({ ref: l.p, isGK: l.pos === 'GK' })));
  const gks = T.map(ps => ps.find(p => p.isGK) || ps[0]);
  const kickers = T.map(ps => {
    const k = ps.filter(p => !p.isGK).sort((a, b) => facet(b.ref || b, 'pen') - facet(a.ref || a, 'pen'));
    return k.length ? k : ps; // se não tiver ninguém que não seja GK, usa todos
  });
  const score = [0, 0]; const log = [];
  function take(t, i) {
    const k = kickers[t][i % kickers[t].length];
    const g = gks[1 - t];
    if (!k || !g) return false;
    const p = clamp(0.76 + (facet(k.ref || k, 'pen') - facet(g.ref || g, 'pen_gk')) / 100 * 0.5, 0.5, 0.94);
    const ok = chance(p);
    if (ok) score[t]++;
    log.push({ team: t, p: k, ok });
    return ok;
  }
  for (let i = 0; i < 5; i++) {
    for (const t of [0, 1]) {
      take(t, i);
      const rem0 = 5 - i - 1;
      const rem1 = 5 - i - (t === 1 ? 1 : 0);
      if (score[0] > score[1] + rem1 || score[1] > score[0] + rem0) return { score, log };
    }
  }
  let i = 5;
  while (score[0] === score[1] && i < 100) {
    take(0, i);
    if (take(1, i)) {} // toma a segunda do par
    i++;
  }
  return { score, log };
}

// roda uma partida headless (IA×IA). ko=true permite prorrogação+pênaltis.
function simQuick(db, hSid, aSid, ko) {
  const A = teamFor(db, hSid, aSid), B = teamFor(db, aSid, hSid);
  const scorers = [];
  const sim = new M.MatchSim(A, B, { onEvent: e => {
    if (e.type === 'goal' && e.by) scorers.push({ sid: e.by.team === 0 ? hSid : aSid, p: e.by.ref, min: e.minute || 0 });
  }});
  const dt = 1 / 30;
  let guard = 0;
  while (!sim.isOver() && guard++ < 500000) sim.step(dt);
  let pens = null;
  if (ko && sim.score[0] === sim.score[1]) {
    sim.beginExtraTime();
    guard = 0;
    while (!sim.isOver() && guard++ < 200000) sim.step(dt);
    if (sim.score[0] === sim.score[1]) pens = shootout(sim).score;
  }
  return { g: [sim.score[0], sim.score[1]], pens, scorers, stats: sim.stats };
}

/* ------------------------------ A COPA ---------------------------------- */
function createCup(db, playerSid, seed) {
  if (seed != null) C.srand(seed);
  const field = drawField(db, playerSid);
  const groups = drawGroups(field);
  const cup = {
    playerSid, phase: 'groups', round: 0,           // rodadas 0..2 de grupos
    groups: groups.map(g => ({ name: g.name, teams: g.teams.map(t => t.sid) })),
    results: {},                                     // results[gname] = [{h,a,g,round}]
    ko: null,                                        // bracket
    scorers: {},                                     // sid_do_jogador → {p, gols, nação}
    champion: null, runnerUp: null, third: null,
  };
  for (const g of cup.groups) {
    cup.results[g.name] = [];
    const fx = groupFixtures({ teams: g.teams.map(sid => ({ sid })) });
    fx.forEach((round, ri) => round.forEach(m => cup.results[g.name].push({ h: m.h, a: m.a, g: null, round: ri })));
  }
  return cup;
}

function addScorers(cup, db, res) {
  for (const s of res.scorers) {
    if (!s.p) continue;
    const key = s.sid + ':' + s.p.n;
    (cup.scorers[key] = cup.scorers[key] || { n: s.p.n, sid: s.sid, gols: 0 }).gols++;
  }
}

function groupOf(cup, sid) { return cup.groups.find(g => g.teams.indexOf(sid) !== -1); }

// simula os jogos de IA da rodada atual dos grupos (pula o jogo do jogador)
function playGroupRound(cup, db, skipPlayerMatch) {
  const round = cup.round;
  const played = [];
  for (const g of cup.groups) {
    for (const m of cup.results[g.name]) {
      if (m.round !== round || m.g) continue;
      const isPlayers = (m.h === cup.playerSid || m.a === cup.playerSid);
      if (isPlayers && skipPlayerMatch) continue;
      const res = simQuick(db, m.h, m.a, false);
      m.g = res.g; addScorers(cup, db, res);
      played.push({ ...m, group: g.name });
    }
  }
  return played;
}

// registra o resultado do jogo do jogador (vem da tela de partida)
function recordPlayerMatch(cup, m, g, pens) {
  m.g = g; if (pens) m.pens = pens;
}

function playerMatchOfRound(cup) {
  if (cup.phase === 'groups') {
    const g = groupOf(cup, cup.playerSid);
    return cup.results[g.name].find(m => m.round === cup.round && (m.h === cup.playerSid || m.a === cup.playerSid));
  }
  if (!cup.ko) return null;
  const stage = cup.ko[cup.phase];
  return stage ? stage.find(m => !m.g && (m.h === cup.playerSid || m.a === cup.playerSid)) : null;
}

function advanceGroupRound(cup) { cup.round++; if (cup.round >= 3) buildKnockout(cup); }

// chaveamento clássico da Copa: 1A×2B, 1C×2D, 1E×2F, 1G×2H | 1B×2A, 1D×2C, 1F×2E, 1H×2G
function buildKnockout(cup) {
  const P = {};
  for (const g of cup.groups) {
    const t = tableOf({ teams: g.teams.map(sid => ({ sid })) }, cup.results[g.name]);
    P['1' + g.name] = t[0].sid; P['2' + g.name] = t[1].sid;
  }
  cup.ko = {
    r16: [
      { h: P['1A'], a: P['2B'] }, { h: P['1C'], a: P['2D'] },
      { h: P['1E'], a: P['2F'] }, { h: P['1G'], a: P['2H'] },
      { h: P['1B'], a: P['2A'] }, { h: P['1D'], a: P['2C'] },
      { h: P['1F'], a: P['2E'] }, { h: P['1H'], a: P['2G'] },
    ],
    qf: [], sf: [], third: [], final: [],
  };
  cup.phase = 'r16';
}

const KO_ORDER = ['r16', 'qf', 'sf', 'third', 'final'];

function winnerOf(m) {
  if (m.g[0] !== m.g[1]) return m.g[0] > m.g[1] ? m.h : m.a;
  return m.pens[0] > m.pens[1] ? m.h : m.a;
}
function loserOf(m) { const w = winnerOf(m); return w === m.h ? m.a : m.h; }

// joga os confrontos de IA da fase atual e monta a próxima quando completa
function playKnockoutStage(cup, db, skipPlayerMatch) {
  const stage = cup.ko[cup.phase];
  const played = [];
  for (const m of stage) {
    if (m.g) continue;
    const isPlayers = (m.h === cup.playerSid || m.a === cup.playerSid);
    if (isPlayers && skipPlayerMatch) continue;
    const res = simQuick(db, m.h, m.a, true);
    m.g = res.g; m.pens = res.pens; addScorers(cup, db, res);
    played.push(m);
  }
  return played;
}

function stageComplete(cup) { return cup.ko[cup.phase].every(m => m.g); }

function advanceKnockout(cup) {
  const ph = cup.phase, ko = cup.ko;
  if (ph === 'r16') {
    ko.qf = [0, 1, 2, 3].map(i => ({ h: winnerOf(ko.r16[i * 2]), a: winnerOf(ko.r16[i * 2 + 1]) }));
    cup.phase = 'qf';
  } else if (ph === 'qf') {
    ko.sf = [0, 1].map(i => ({ h: winnerOf(ko.qf[i * 2]), a: winnerOf(ko.qf[i * 2 + 1]) }));
    cup.phase = 'sf';
  } else if (ph === 'sf') {
    ko.third = [{ h: loserOf(ko.sf[0]), a: loserOf(ko.sf[1]) }];
    ko.final = [{ h: winnerOf(ko.sf[0]), a: winnerOf(ko.sf[1]) }];
    cup.phase = 'third';
  } else if (ph === 'third') {
    cup.third = winnerOf(ko.third[0]);
    cup.phase = 'final';
  } else if (ph === 'final') {
    cup.champion = winnerOf(ko.final[0]);
    cup.runnerUp = loserOf(ko.final[0]);
    cup.phase = 'done';
  }
}

// jogador foi eliminado? (fora dos 2 primeiros do grupo ou perdeu no mata-mata)
function playerAlive(cup) {
  if (cup.phase === 'groups') return true;
  if (cup.phase === 'done') return cup.champion === cup.playerSid;
  if (cup.phase === 'third' || cup.phase === 'final') {
    return cup.ko.final[0].h === cup.playerSid || cup.ko.final[0].a === cup.playerSid ||
           cup.ko.third[0].h === cup.playerSid || cup.ko.third[0].a === cup.playerSid;
  }
  return cup.ko[cup.phase].some(m => m.h === cup.playerSid || m.a === cup.playerSid);
}

function topScorers(cup, db, n) {
  return Object.values(cup.scorers).sort((a, b) => b.gols - a.gols).slice(0, n || 10)
    .map(s => ({ ...s, team: db.byId[s.sid] }));
}

const API = {
  drawField, drawGroups, groupFixtures, tableOf, createCup, simQuick, shootout,
  playGroupRound, advanceGroupRound, buildKnockout, playKnockoutStage, stageComplete,
  advanceKnockout, playerMatchOfRound, recordPlayerMatch, winnerOf, loserOf,
  playerAlive, topScorers, groupOf, teamFor, registerPlayerTeam, KO_ORDER, GROUP_NAMES,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.CUP = API;
})();

