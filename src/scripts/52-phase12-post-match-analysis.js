/* Copa dos Sonhos — Fase 12 — Análise pós-jogo — v5.5.0
   Explicações táticas derivadas EXCLUSIVAMENTE de eventos e métricas reais
   da partida (regra do plano mestre: nada de texto genérico desconectado da
   simulação). Cada manchete só é emitida quando o padrão realmente ocorreu,
   e sempre carrega os números que a sustentam. */
(function (root) {
'use strict';
const NODE = typeof module !== 'undefined' && module.exports;
const V = '5.5.0';
if (root.CDS_POST_MATCH && root.CDS_POST_MATCH.VERSION === V) return;

const N = x => Number.isFinite(x) ? x : 0;
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;

/* Mapa de finalizações a partir dos eventos reais retidos pelo motor. */
function shotMap(sim, team) {
  const shots = [];
  const KIND = { shot_taken: 'jogada', low_cross_shot: 'cruzamento rasteiro',
    header_shot: 'cabeceio', freekick: 'falta', penalty: 'pênalti' };
  for (const ev of (sim.events || [])) {
    if (KIND[ev.type] && ev.by && ev.by.team === team)
      shots.push({ minute: ev.minute, xg: +(N(ev.xg)).toFixed(3), kind: KIND[ev.type],
        longshot: !!ev.longshot, oneOnOne: !!ev.oneOnOne, volley: !!ev.volley,
        dist: ev.dtg != null ? Math.round(ev.dtg) : null,
        by: ev.by.ref ? ev.by.ref.n : null, result: 'em jogo' });
    if ((ev.type === 'goal') && ev.by && ev.by.team === team && shots.length) shots[shots.length - 1].result = 'gol';
    if (ev.type === 'save' && shots.length && shots[shots.length - 1].result === 'em jogo') {
      const last = shots[shots.length - 1];
      last.result = ev.kind === 'deflect_corner' ? 'defesa (escanteio)'
        : ev.rebound ? 'defesa (rebote vivo)' : 'defesa';
    }
    if (ev.type === 'blocked' && shots.length && shots[shots.length - 1].result === 'em jogo') shots[shots.length - 1].result = 'bloqueado';
    if (ev.type === 'post' && shots.length && shots[shots.length - 1].result === 'em jogo') shots[shots.length - 1].result = 'trave';
    if (ev.type === 'miss' && shots.length && shots[shots.length - 1].result === 'em jogo') shots[shots.length - 1].result = 'para fora';
  }
  return shots;
}

/* Manchetes táticas: cada uma nasce de um padrão numérico real. */
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

/* ------------------------- painel no jogo (DOM) ------------------------- */
if (!NODE && typeof document !== 'undefined') {
  const boot = () => {
    if (document.getElementById('p12btn')) return;
    const css = document.createElement('style');
    css.textContent = '#p12btn{position:fixed;left:12px;bottom:56px;z-index:999999;border:1px solid #7ab8ff;border-radius:999px;background:#0d1626;color:#7ab8ff;padding:9px 12px;font:700 11px system-ui;display:none}#p12box{position:fixed;inset:0;z-index:1000000;background:#020712dd;display:none;place-items:end center;padding:12px;color:#fff;font-family:system-ui}#p12box.on{display:grid}#p12box>div{width:min(720px,100%);max-height:86vh;overflow:auto;background:#0b1220;border:1px solid #2b4468;border-radius:18px;padding:15px}.p12h{border-left:3px solid #7ab8ff;background:#101c30;margin:7px 0;padding:8px;font-size:12px}.p12h b{color:#7ab8ff}.p12s{font-size:11px;color:#9fb6d4;margin:3px 0}';
    document.head.appendChild(css);
    const b = document.createElement('button'); b.id = 'p12btn'; b.textContent = 'ANÁLISE PÓS-JOGO';
    const x = document.createElement('div'); x.id = 'p12box';
    x.innerHTML = '<div><button id="p12close" style="float:right">×</button><h3>Análise Pós-Jogo · Fase 12</h3><main></main></div>';
    document.body.append(b, x);
    const paint = () => {
      const sim = root.__CDS_ACTIVE_SIM, m = x.querySelector('main');
      if (!sim || !sim.isOver || !sim.isOver()) { m.innerHTML = '<p>Disponível após o fim da partida.</p>'; return; }
      const side = sim.interactiveTeam === 1 ? 1 : 0;
      const a = analyze(sim, side), k = a.keyNumbers;
      m.innerHTML = '<p><b>' + a.score[side] + ' × ' + a.score[1 - side] + '</b> · xG ' + k.xg[0] + ' × ' + k.xg[1] +
        ' · chutes ' + k.shots[0] + ' × ' + k.shots[1] + ' · passes ' + k.passAccuracy[0] + '% × ' + k.passAccuracy[1] + '%</p>' +
        (a.headlines.length ? a.headlines.map(h => '<div class="p12h"><b>' + h.tag + '</b> · ' + h.msg + '</div>').join('')
          : '<p>Partida equilibrada, sem padrões táticos dominantes.</p>') +
        '<h4>Finalizações (' + a.shotMap.length + ')</h4>' +
        a.shotMap.map(s => '<div class="p12s">' + s.minute + "' " + (s.by || '?') + ' — xG ' + s.xg +
          (s.oneOnOne ? ' · cara a cara' : s.longshot ? ' · de longe' : '') + ' → ' + s.result + '</div>').join('');
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

const API = { VERSION: V, analyze, shotMap, headlines, installed: true };
root.CDS_POST_MATCH = API;
if (NODE) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
