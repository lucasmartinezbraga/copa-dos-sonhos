/* Copa dos Sonhos — Fase 11 — Conselheiro do Draft — v5.4.0
   O draft passa a avaliar ENCAIXE, não apenas overall: vaga natural aberta,
   arquétipo (derivado dos atributos reais, sem bônus mágicos), redundância
   com o elenco já montado, carências que o candidato resolve (volante de
   marcação, canhoto no lado esquerdo, estatura aérea na defesa) e uma
   explicação em português construída só a partir desses dados. */
(function (root) {
'use strict';
const NODE = typeof module !== 'undefined' && module.exports;
const V = '5.4.0';
if (root.CDS_DRAFT_ADVISOR && root.CDS_DRAFT_ADVISOR.VERSION === V) return;

const LINE = pos => pos === 'GK' ? 'GK' : /B$|CB/.test(pos) ? 'DEF' : /M$/.test(pos) ? 'MID' : 'ATA';
const attr = (p, k) => { try { const v = root.getAttr ? root.getAttr(p, k) : NaN; return Number.isFinite(v) ? v : 60; } catch (_) { return 60; } };
const prof = p => p.profileV3 || {};
const primary = p => prof(p).primaryPosition || p.slot || p.pos || 'CM';

/* Arquétipo por atributos: decide o PAPEL que o jogador realmente cobre. */
function archetype(p) {
  const pos = primary(p);
  if (pos === 'GK') return 'goleiro';
  const ln = LINE(pos);
  if (ln === 'DEF') return /B$/.test(pos) && pos !== 'CB' ? 'lateral' : 'zagueiro';
  const des = attr(p, 'desarme'), pas = attr(p, 'passe'), vis = attr(p, 'visao');
  const fin = attr(p, 'finalizacao'), cru = attr(p, 'cruzamento');
  if (ln === 'MID') {
    if (des >= Math.max(pas, vis) - 4) return 'volante';
    return (pas + vis) / 2 >= fin ? 'armador' : 'meia-ofensivo';
  }
  return cru > fin ? 'ponta' : 'finalizador';
}

/* Encaixe posicional: 3 exata · 2 secundária · 1 mesma linha · 0 nenhum. */
function fits(p, pos) {
  if (primary(p) === pos) return 3;
  const sec = prof(p).secondaryPositions || p.elig || [];
  if (sec.indexOf(pos) !== -1) return 2;
  return LINE(primary(p)) === LINE(pos) ? 1 : 0;
}

function analyzeRoster(draft) {
  const picks = draft.slots.filter(s => s.p);
  const open = draft.slots.filter(s => !s.p).map(s => s.pos);
  const archetypes = {};
  picks.forEach(s => { const a = archetype(s.p); archetypes[a] = (archetypes[a] || 0) + 1; });
  const weaknesses = [];
  const mids = picks.filter(s => LINE(s.pos) === 'MID');
  if (mids.length >= 2 && !mids.some(s => archetype(s.p) === 'volante'))
    weaknesses.push({ code: 'SEM_VOLANTE', msg: 'O meio-campo montado não tem um volante de marcação.' });
  const defs = picks.filter(s => LINE(s.pos) === 'DEF');
  if (defs.length >= 2) {
    const avgH = defs.reduce((t, s) => t + (prof(s.p).heightCmSim || 180), 0) / defs.length;
    if (avgH < 180) weaknesses.push({ code: 'DEFESA_BAIXA', msg: 'A defesa tem estatura média de ' + Math.round(avgH) + ' cm — vulnerável no jogo aéreo.' });
  }
  const left = picks.filter(s => s.pos[0] === 'L');
  if (left.length && !left.some(s => prof(s.p).dominantFoot === 'left'))
    weaknesses.push({ code: 'LADO_ESQUERDO_SEM_CANHOTO', msg: 'O lado esquerdo não tem nenhum canhoto.' });
  return { picks: picks.length, open, archetypes, weaknesses };
}

function evaluateCandidate(p, draft) {
  const roster = analyzeRoster(draft);
  const openFits = draft.slots
    .map((s, i) => ({ i, pos: s.pos, fit: s.p ? 0 : fits(p, s.pos) }))
    .filter(x => x.fit > 0)
    .sort((a, b) => b.fit - a.fit);
  const best = openFits[0] || null;
  const arch = archetype(p), dup = roster.archetypes[arch] || 0, pr = prof(p);
  const resolves = [];
  if (arch === 'volante' && roster.weaknesses.some(w => w.code === 'SEM_VOLANTE')) resolves.push('SEM_VOLANTE');
  if (pr.dominantFoot === 'left' && best && best.pos[0] === 'L' &&
      roster.weaknesses.some(w => w.code === 'LADO_ESQUERDO_SEM_CANHOTO')) resolves.push('LADO_ESQUERDO_SEM_CANHOTO');
  if ((pr.heightCmSim || 180) >= 186 && best && LINE(best.pos) === 'DEF' &&
      roster.weaknesses.some(w => w.code === 'DEFESA_BAIXA')) resolves.push('DEFESA_BAIXA');
  const fitScore = Math.max(0, Math.min(100,
    (best ? best.fit * 25 : 5) + (resolves.length ? 15 : 0) + (dup >= 2 ? -20 : dup === 1 ? -8 : 0)));
  const NAMES = { SEM_VOLANTE: 'a falta de volante de marcação',
    LADO_ESQUERDO_SEM_CANHOTO: 'a falta de canhoto pelo lado esquerdo',
    DEFESA_BAIXA: 'a fragilidade aérea da defesa' };
  let explanation;
  if (!best) {
    explanation = 'Nenhuma vaga aberta combina com a posição natural (' + primary(p) + '). Entraria apenas como reserva.';
  } else {
    explanation = (best.fit === 3 ? 'Encaixe exato na vaga de ' + best.pos
      : best.fit === 2 ? 'Cobre a vaga de ' + best.pos + ' como posição secundária'
      : 'Improvisação de mesma linha na vaga de ' + best.pos) + '.';
    if (resolves.length) explanation += ' Resolve ' + resolves.map(c => NAMES[c]).join(' e ') + '.';
    else if (dup >= 1) {
      const PLURAL = { 'armador': 'armadores', 'volante': 'volantes', 'zagueiro': 'zagueiros',
        'lateral': 'laterais', 'ponta': 'pontas', 'finalizador': 'finalizadores',
        'meia-ofensivo': 'meias-ofensivos', 'goleiro': 'goleiros' };
      explanation += ' Você já tem ' + dup + ' ' + (dup > 1 ? (PLURAL[arch] || arch + 's') : arch) +
        ' — aumenta a qualidade individual, mas não cobre a carência do elenco.';
    }
  }
  return { archetype: arch, bestSlot: best && { pos: best.pos, fit: best.fit }, redundancy: dup,
    resolves, fitScore, explanation, foot: pr.dominantFoot || null, height: pr.heightCmSim || null };
}

/* ------------------------- painel no jogo (DOM) ------------------------- */
if (!NODE && typeof document !== 'undefined') {
  const boot = () => {
    if (document.getElementById('p11btn')) return;
    const css = document.createElement('style');
    css.textContent = '#p11btn{position:fixed;left:12px;bottom:12px;z-index:999999;border:1px solid #6ee7a0;border-radius:999px;background:#0d1f16;color:#6ee7a0;padding:9px 12px;font:700 11px system-ui;display:none}#p11box{position:fixed;inset:0;z-index:1000000;background:#020712dd;display:none;place-items:end center;padding:12px;color:#fff;font-family:system-ui}#p11box.on{display:grid}#p11box>div{width:min(680px,100%);max-height:84vh;overflow:auto;background:#0b1a12;border:1px solid #2b5c42;border-radius:18px;padding:15px}.p11c{border-left:3px solid #6ee7a0;background:#11241a;margin:7px 0;padding:8px;font-size:12px}.p11c b{color:#6ee7a0}.p11w{border-left:3px solid #ff9d4a;background:#2a2018;margin:7px 0;padding:8px;font-size:12px}';
    document.head.appendChild(css);
    const b = document.createElement('button'); b.id = 'p11btn'; b.textContent = 'CONSELHEIRO';
    const x = document.createElement('div'); x.id = 'p11box';
    x.innerHTML = '<div><button id="p11close" style="float:right">×</button><h3>Conselheiro do Draft · Fase 11</h3><main></main></div>';
    document.body.append(b, x);
    const paint = () => {
      const G = root.G, m = x.querySelector('main');
      if (!G || !G.draft || !G.draft.cur) { m.innerHTML = '<p>Sorteie uma seleção primeiro.</p>'; return; }
      const roster = analyzeRoster(G.draft);
      const picked = new Set(); G.draft.slots.forEach(s => s.p && picked.add(s.p.id));
      G.draft.benchPicks.forEach(bp => picked.add(bp.p.id));
      const rows = G.draft.cur.pl.filter(p => !picked.has(p.id))
        .map(p => ({ p, ev: evaluateCandidate(p, G.draft) }))
        .sort((a, b) => b.ev.fitScore - a.ev.fitScore).slice(0, 8);
      m.innerHTML = '<p><b>' + roster.picks + '/11</b> escalados · vagas: ' + (roster.open.join(', ') || '—') + '</p>' +
        roster.weaknesses.map(w => '<div class="p11w">' + w.msg + '</div>').join('') +
        rows.map(r => '<div class="p11c"><b>' + r.ev.fitScore + '</b> · ' + (r.p.n || '?') +
          ' <small>(' + r.ev.archetype + (r.ev.foot ? ' · pé ' + (r.ev.foot === 'left' ? 'esquerdo' : r.ev.foot === 'right' ? 'direito' : r.ev.foot) : '') + ')</small><br>' + r.ev.explanation + '</div>').join('');
    };
    b.onclick = () => { x.classList.add('on'); paint(); };
    x.querySelector('#p11close').onclick = () => x.classList.remove('on');
    setInterval(() => { const G = root.G; b.style.display = G && G.screen === 'draft' ? 'block' : 'none'; }, 900);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
}

const API = { VERSION: V, archetype, fits, analyzeRoster, evaluateCandidate, installed: true };
root.CDS_DRAFT_ADVISOR = API;
if (NODE) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
