/* Copa dos Sonhos — Fases 12/13 — Análise pós-jogo VISUAL — v5.6.0
   Explicações táticas derivadas EXCLUSIVAMENTE de eventos e métricas reais
   (Fase 12) + apresentação 2D em SVG (Fase 13): mapa de finalizações no
   campo, linha do tempo de xG e barras comparativas. A posição de cada
   chute é capturada NO MOMENTO do lance via gancho no fluxo de eventos. */
(function (root) {
'use strict';
const NODE = typeof module !== 'undefined' && module.exports;
const V = '5.6.0';
if (root.CDS_POST_MATCH && root.CDS_POST_MATCH.VERSION === V) return;

const N = x => Number.isFinite(x) ? x : 0;
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
const FL = 105, FW = 68;
const SHOT_KIND = { shot_taken: 'jogada', low_cross_shot: 'cruzamento rasteiro',
  header_shot: 'cabeceio', freekick: 'falta', penalty: 'pênalti' };

/* Gancho: no instante do evento de chute, fotografa posição e direção de
   ataque — depois da partida o objeto do jogador já andou pelo campo. */
const M = root.MatchSim;
if (M && !M.prototype.__P13_EMIT__) {
  M.prototype.__P13_EMIT__ = true;
  const oe = M.prototype._emit;
  M.prototype._emit = function (type, data) {
    if (SHOT_KIND[type] && data && data.by && Number.isFinite(data.by.x)) {
      data.sx = data.by.x; data.sy = data.by.y;
      const tm = this.teams && this.teams[data.by.team];
      data.satk = tm ? tm.attackDir : 1;
    }
    return oe.call(this, type, data);
  };
}

function shotMap(sim, team) {
  const shots = [];
  for (const ev of (sim.events || [])) {
    if (SHOT_KIND[ev.type] && ev.by && ev.by.team === team) {
      let x = null, y = null;
      if (Number.isFinite(ev.sx)) { // normaliza: todos atacando para a direita
        x = ev.satk < 0 ? FL - ev.sx : ev.sx;
        y = ev.satk < 0 ? FW - ev.sy : ev.sy;
      }
      shots.push({ minute: ev.minute, xg: +(N(ev.xg)).toFixed(3), kind: SHOT_KIND[ev.type],
        longshot: !!ev.longshot, oneOnOne: !!ev.oneOnOne, volley: !!ev.volley,
        dist: ev.dtg != null ? Math.round(ev.dtg) : null, x, y,
        by: ev.by.ref ? ev.by.ref.n : null, result: 'em jogo' });
    }
    const last = shots[shots.length - 1];
    if (ev.type === 'goal' && ev.by && ev.by.team === team && last) last.result = 'gol';
    if (last && last.result === 'em jogo') {
      if (ev.type === 'save') last.result = ev.kind === 'deflect_corner' ? 'defesa (escanteio)'
        : ev.rebound ? 'defesa (rebote vivo)' : 'defesa';
      else if (ev.type === 'blocked') last.result = 'bloqueado';
      else if (ev.type === 'post') last.result = 'trave';
      else if (ev.type === 'miss') last.result = 'para fora';
    }
  }
  return shots;
}

function headlines(sim, team) {
  const my = sim.stats[team], op = sim.stats[1 - team];
  const H = [];
  const add = (tag, msg) => H.push({ tag, msg });
  if (N(op.throughOk) >= 3)
    add('linha-alta', 'O adversário completou ' + op.throughOk + ' passes nas costas da sua linha' +
      (N(op.oneOnOnes) ? ', gerando ' + op.oneOnOnes + ' cara(s) a cara' : '') + '. Considere baixar a linha ou proteger a profundidade.');
  if (N(my.throughOk) >= 3)
    add('profundidade', 'Seu time encontrou a profundidade ' + my.throughOk + ' vezes' +
      (N(my.oneOnOnes) ? ' e criou ' + my.oneOnOnes + ' cara(s) a cara' : '') + ' — a bola em profundidade está funcionando.');
  const opL = N(op.attacksL), opR = N(op.attacksR);
  if (opL + opR >= 8 && Math.max(opL, opR) >= (opL + opR) * 0.62) {
    const side = opL > opR ? 'esquerdo' : 'direito';
    add('corredor', 'O adversário concentrou ' + Math.max(opL, opR) + ' de ' + (opL + opR) +
      ' ataques no seu corredor ' + side + ' — o lado ficou exposto nas transições.');
  }
  if (N(op.crossesOk) >= 4)
    add('cruzamentos', op.crossesOk + ' cruzamentos adversários encontraram alvo na sua área. Reforce a proteção aérea ou impeça o cruzamento.');
  if (N(my.reboundsConceded) === 0 && N(my.gkParries) >= 2)
    add('goleiro', 'Seu goleiro espalmou ' + my.gkParries + ' vezes sem conceder nenhum rebote vivo — defesas seguras.');
  if (N(my.reboundsConceded) >= 2)
    add('goleiro', 'Seu goleiro concedeu ' + my.reboundsConceded + ' rebotes vivos dentro da área — atenção à segunda bola defensiva.');
  if (N(my.gkSweepsFailed) >= 1)
    add('goleiro', 'Saída(s) errada(s) do goleiro: ' + my.gkSweepsFailed + ' — o gol ficou aberto na sequência.');
  const spTot = N(my.setPieceFirstContactWon) + N(my.setPieceFirstContactLost);
  if (spTot >= 4)
    add('bola-parada', 'Primeiro contato em bola parada ofensiva: ' + my.setPieceFirstContactWon + ' de ' + spTot +
      ' (' + pct(my.setPieceFirstContactWon, spTot) + '%)' + (N(my.setPieceGoals) ? ', com ' + my.setPieceGoals + ' gol(s)' : '') + '.');
  if (N(my.shots) >= 10 && N(my.xg) / my.shots < 0.08)
    add('qualidade', my.shots + ' finalizações com xG médio de apenas ' + (my.xg / my.shots).toFixed(2) +
      ' por chute — volume alto, chances ruins. Trabalhe a bola até a área.');
  if (N(my.pressWins) >= 8)
    add('pressao', 'A pressão alta recuperou a bola ' + my.pressWins + ' vezes no campo ofensivo.');
  if (N(my.defErrors) >= 2)
    add('erros', my.defErrors + ' erros individuais da sua defesa geraram chances adversárias.');
  const adv = sim.getAdvancedData ? sim.getAdvancedData(team) : null;
  const sp = adv && adv.phase47 && adv.phase47.spatial;
  if (sp && sp.corridorOccupancy && sp.samples > 200) {
    const c = sp.corridorOccupancy, tot = c.reduce((a, b) => a + b, 0) || 1;
    const central = (c[1] + c[2] + c[3]) / tot;
    if (central > 0.78) add('largura', 'Ocupação concentrada no miolo (' + Math.round(central * 100) +
      '% nos 3 corredores centrais) — o time jogou estreito; considere abrir a largura.');
  }
  return H;
}

function analyze(sim, team) {
  const my = sim.stats[team], op = sim.stats[1 - team];
  return {
    version: V, team,
    score: [sim.score[0], sim.score[1]],
    keyNumbers: {
      xg: [+N(my.xg).toFixed(2), +N(op.xg).toFixed(2)],
      shots: [N(my.shots), N(op.shots)], onTarget: [N(my.onTarget), N(op.onTarget)],
      passAccuracy: [pct(my.passOk, my.passes), pct(op.passOk, op.passes)],
      corners: [N(my.corners), N(op.corners)],
      setPieceGoals: [N(my.setPieceGoals), N(op.setPieceGoals)],
      gk: { faced: N(my.gkShotsFaced), secure: N(my.gkSecureCatches), parries: N(my.gkParries),
        rebounds: N(my.reboundsConceded), sweeps: N(my.gkSweeps), sweepsFailed: N(my.gkSweepsFailed) }
    },
    shotMap: shotMap(sim, team),
    headlines: headlines(sim, team)
  };
}

/* ------------------------------ SVG (Fase 13) ------------------------------ */
const COLORS = { 'gol': '#ffcb45', 'defesa': '#7ab8ff', 'defesa (escanteio)': '#7ab8ff',
  'defesa (rebote vivo)': '#9ad0ff', 'bloqueado': '#93a6bd', 'trave': '#ff9d4a',
  'para fora': '#5a6b80', 'em jogo': '#5a6b80' };

function fieldSVG(shots) {
  const W = 360, H = 234, X = x => (x / FL * W).toFixed(1), Y = y => (y / FW * H).toFixed(1);
  const L = 'stroke="#e8f5ec55" stroke-width="1.2" fill="none"';
  const dots = shots.filter(s => s.x != null).map(s => {
    const r = (3 + Math.min(s.xg, 0.75) * 15).toFixed(1);
    const c = COLORS[s.result] || '#5a6b80';
    return '<circle cx="' + X(s.x) + '" cy="' + Y(s.y) + '" r="' + r + '" fill="' + c +
      '" fill-opacity=".85" stroke="#04120a" stroke-width="1"><title>' + s.minute + "' " +
      (s.by || '') + ' · ' + s.kind + ' · xG ' + s.xg + ' → ' + s.result + '</title></circle>';
  }).join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:linear-gradient(90deg,#0d3a22,#11532f);border-radius:12px;display:block">' +
    '<rect x="4" y="4" width="' + (W - 8) + '" height="' + (H - 8) + '" ' + L + ' rx="4"/>' +
    '<line x1="' + W / 2 + '" y1="4" x2="' + W / 2 + '" y2="' + (H - 4) + '" ' + L + '/>' +
    '<circle cx="' + W / 2 + '" cy="' + H / 2 + '" r="26" ' + L + '/>' +
    '<rect x="' + (W - 4 - 56) + '" y="' + (H / 2 - 62) + '" width="56" height="124" ' + L + '/>' +
    '<rect x="' + (W - 4 - 20) + '" y="' + (H / 2 - 30) + '" width="20" height="60" ' + L + '/>' +
    '<rect x="4" y="' + (H / 2 - 62) + '" width="56" height="124" ' + L + '/>' +
    '<rect x="4" y="' + (H / 2 - 30) + '" width="20" height="60" ' + L + '/>' +
    dots + '</svg>' +
    '<div style="font-size:10px;color:#9fb6d4;margin:4px 0 10px">Atacando para a direita · tamanho = xG · ' +
    '<span style="color:#ffcb45">●</span> gol <span style="color:#7ab8ff">●</span> defesa ' +
    '<span style="color:#ff9d4a">●</span> trave <span style="color:#93a6bd">●</span> bloqueio ' +
    '<span style="color:#5a6b80">●</span> fora</div>';
}

function xgTimelineSVG(mine, theirs, names) {
  const W = 360, H = 120, PAD = 6, maxT = 95;
  const cum = shots => {
    let acc = 0; const pts = [[0, 0]];
    shots.slice().sort((a, b) => a.minute - b.minute).forEach(s => { acc += s.xg; pts.push([s.minute, acc]); });
    pts.push([maxT, acc]); return pts;
  };
  const A = cum(mine), B = cum(theirs);
  const maxXg = Math.max(A[A.length - 1][1], B[B.length - 1][1], 1);
  const px = t => PAD + t / maxT * (W - 2 * PAD), py = v => H - PAD - v / maxXg * (H - 2 * PAD - 14);
  const line = (pts, color) => {
    let d = '', last = null;
    for (const [t, v] of pts) { const x = px(t).toFixed(1), y = py(v).toFixed(1);
      d += (d ? ' L' : 'M') + x + ' ' + (last == null ? y : last) + ' L' + x + ' ' + y; last = y; }
    return '<path d="' + d + '" stroke="' + color + '" stroke-width="2" fill="none"/>';
  };
  const goals = (shots, color) => shots.filter(s => s.result === 'gol').map(s =>
    '<circle cx="' + px(s.minute).toFixed(1) + '" cy="12" r="4" fill="' + color + '"><title>' +
    s.minute + "' gol</title></circle>").join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:#0b1220;border:1px solid #24344d;border-radius:12px;display:block">' +
    line(A, '#6ee7a0') + line(B, '#ff8a8a') + goals(mine, '#6ee7a0') + goals(theirs, '#ff8a8a') +
    '<text x="' + PAD + '" y="' + (H - 10) + '" fill="#9fb6d4" font-size="9">xG acumulado · <tspan fill="#6ee7a0">' +
    names[0] + '</tspan> × <tspan fill="#ff8a8a">' + names[1] + '</tspan> · ● = gol</text></svg>';
}

function barsHTML(k, names) {
  const row = (label, a, b, fmt) => {
    const tot = (a + b) || 1, wa = Math.round(a / tot * 100);
    return '<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:11px;color:#cfe0f4">' +
      '<b>' + (fmt ? fmt(a) : a) + '</b><span style="color:#9fb6d4">' + label + '</span><b>' + (fmt ? fmt(b) : b) + '</b></div>' +
      '<div style="display:flex;height:7px;border-radius:4px;overflow:hidden;background:#1a2740">' +
      '<div style="width:' + wa + '%;background:#6ee7a0"></div><div style="flex:1;background:#ff8a8a"></div></div></div>';
  };
  return row('xG', k.xg[0], k.xg[1]) + row('Finalizações', k.shots[0], k.shots[1]) +
    row('No alvo', k.onTarget[0], k.onTarget[1]) +
    row('Precisão de passe', k.passAccuracy[0], k.passAccuracy[1], v => v + '%') +
    row('Escanteios', k.corners[0], k.corners[1]);
}

/* ------------------------- painel no jogo (DOM) ------------------------- */
if (!NODE && typeof document !== 'undefined') {
  const boot = () => {
    if (document.getElementById('p12btn')) return;
    const css = document.createElement('style');
    css.textContent = '#p12btn{position:fixed;left:12px;bottom:56px;z-index:999999;border:1px solid #7ab8ff;border-radius:999px;background:#0d1626;color:#7ab8ff;padding:9px 12px;font:700 11px system-ui;display:none}#p12box{position:fixed;inset:0;z-index:1000000;background:#020712dd;display:none;place-items:end center;padding:12px;color:#fff;font-family:system-ui}#p12box.on{display:grid}#p12box>div{width:min(740px,100%);max-height:88vh;overflow:auto;background:#0b1220;border:1px solid #2b4468;border-radius:18px;padding:16px}.p12h{border-left:3px solid #7ab8ff;background:#101c30;margin:7px 0;padding:8px;font-size:12px;border-radius:0 8px 8px 0}.p12h b{color:#7ab8ff}.p12sc{font:800 22px system-ui;text-align:center;margin:2px 0 10px}';
    document.head.appendChild(css);
    const b = document.createElement('button'); b.id = 'p12btn'; b.textContent = 'ANÁLISE PÓS-JOGO';
    const x = document.createElement('div'); x.id = 'p12box';
    x.innerHTML = '<div><button id="p12close" style="float:right;background:none;border:none;color:#7ab8ff;font-size:18px">×</button><h3 style="margin:0 0 8px">Análise Pós-Jogo</h3><main></main></div>';
    document.body.append(b, x);
    const paint = () => {
      const sim = root.__CDS_ACTIVE_SIM, m = x.querySelector('main');
      if (!sim || !sim.isOver || !sim.isOver()) { m.innerHTML = '<p>Disponível após o fim da partida.</p>'; return; }
      const side = sim.interactiveTeam === 1 ? 1 : 0;
      const a = analyze(sim, side), opp = analyze(sim, 1 - side);
      const names = [sim.teams[side].name || 'Você', sim.teams[1 - side].name || 'Adversário'];
      m.innerHTML =
        '<div class="p12sc">' + names[0] + ' <span style="color:#ffcb45">' + a.score[side] + ' × ' +
          a.score[1 - side] + '</span> ' + names[1] + '</div>' +
        barsHTML(a.keyNumbers, names) +
        '<h4 style="margin:14px 0 6px">Mapa de finalizações — ' + names[0] + '</h4>' + fieldSVG(a.shotMap) +
        '<h4 style="margin:10px 0 6px">Domínio da partida</h4>' + xgTimelineSVG(a.shotMap, opp.shotMap, names) +
        (a.headlines.length ? '<h4 style="margin:14px 0 6px">Leitura tática</h4>' +
          a.headlines.map(h => '<div class="p12h"><b>' + h.tag + '</b> · ' + h.msg + '</div>').join('') : '');
    };
    b.onclick = () => { x.classList.add('on'); paint(); };
    x.querySelector('#p12close').onclick = () => x.classList.remove('on');
    setInterval(() => {
      const sim = root.__CDS_ACTIVE_SIM;
      b.style.display = sim && sim.isOver && sim.isOver() ? 'block' : 'none';
    }, 1200);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
}

const API = { VERSION: V, analyze, shotMap, headlines, fieldSVG, xgTimelineSVG, installed: true };
root.CDS_POST_MATCH = API;
if (NODE) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
