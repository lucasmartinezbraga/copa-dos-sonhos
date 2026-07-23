/* ═══════════ match.js ═══════════ */
/* ============================================================================
   MATCH — motor de partida contínuo. "O campo É o cálculo" (§5).
   Coordenadas métricas internas: X∈[0,105], Y∈[0,68]. Sem DOM.
   Depende de core.js (getAttr, facet, duelProb, duelShotProb, helpers).
   ========================================================================== */
(function (root) {
'use strict';
const C = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root;
const { R, Ri, chance, pick, clamp, lerp, D, duelProb, duelShotProb, shortName, STYLE_FX, STYLE_NEUTRO, STYLE_AXES } = C;
const CAL = C.ENGINE_CALIBRATION;
/* ═══════════════════════════════════════════════════════════════════════
   MOTOR 4.0 · CAMADA AVANÇADA INSPIRADA NO RELATÓRIO FM
   A calibração abaixo não cria resultados pré-determinados. Ela acrescenta
   contexto, gatilhos, interações de função, fadiga tardia e leitura espacial
   às mesmas disputas de atributos usadas pelo motor original. */
const ADV4 = Object.freeze({
  version: '4.0.1',
  context: Object.freeze({
    pressureRadius: 5.4,
    lateMinute: 74,
    knockoutImportance: 0.08,
    fatigueExecution: 0.16,
    pressureExecution: 0.18,
  }),
  pressing: Object.freeze({
    counterPressWindow: 6.0,
    triggerRadiusBoost: 2.15,
    poorTouchBoost: 0.34,
    backPassBoost: 0.23,
    keeperBoost: 0.20,
  }),
  through: Object.freeze({
    paceEdgeScale: 28,
    highLineBonus: 0.95,
    offBallBonus: 0.72,
    maxDecisionBonus: 0.18,
  }),
  crossing: Object.freeze({
    lowCrossBase: 0.24,
    lowCrossMax: 0.78,
    aerialSetPieceBoost: 0.12,
  }),
  defending: Object.freeze({
    errorCheckEvery: 24,
    baseError: 0.00045,
    fatigueError: 0.006,
    highLineError: 0.0035,
  }),
  analytics: Object.freeze({ cols: 12, rows: 8, sample: 0.55 }),
});
function deriveOopRole(pos, role, focus){
  const line = C.LINE_OF[pos] || 'MID';
  if (pos === 'GK') return role === 'gk_libero' ? 'sweeper' : 'line_keeper';
  if (line === 'DEF') return /libero|saida/.test(role || '') ? 'cover' : 'hold';
  if (pos === 'CDM') return /contencao/.test(role || '') ? 'screen' : 'anchor';
  if (line === 'FWD') return focus === 'atk' ? 'screen_pass' : 'press_front';
  if (['LW','RW','LM','RM','LWB','RWB'].includes(pos)) return focus === 'def' ? 'track_wide' : 'press_wide';
  return focus === 'def' ? 'screen' : 'press_mid';
}

const TACT = (typeof module !== 'undefined' && module.exports) ? require('./tactics.js') : (root.TACTICS || null);
// wrappers: aceitam sim-player (tem .ref) OU jogador real
function getAttr(sp, key){ return C.getAttr(sp && sp.ref ? sp.ref : sp, key); }
function facet(sp, which){ return C.facet(sp && sp.ref ? sp.ref : sp, which); }
function dtgSafe(p, g){ return Math.hypot(p.x - g.x, p.y - g.y); }
// a8 vive em p.ref.a8 (player do motor NÃO tem a8 direto). Acessor da verdade:
function A8(q){ return (q && (q.a8 || (q.ref && q.ref.a8))) || null; }

// STYLE_AXES vem do core.js (escopo compartilhado). deriveAxes usa a global.
function deriveAxes(explicit, styleKey, baseFx) {
  const base = STYLE_AXES[styleKey] || STYLE_AXES.balanced;
  const a = Object.assign({}, base, explicit || {});
  for (const k of ['line', 'press', 'width', 'tempo', 'posture'])
    a[k] = clamp(a[k] == null ? 50 : a[k], 0, 100);
  return a;
}

const FL = 105, FW = 68;               // dimensões do campo (m)
const GOAL_A = { x: FL, y: FW / 2 };   // gol que o time A ataca
const GOAL_B = { x: 0,  y: FW / 2 };

function distanceXg(distance) {
  for (const [limit, value] of CAL.shooting.distanceXg) if (distance < limit) return value;
  return CAL.shooting.distanceXg[CAL.shooting.distanceXg.length - 1][1];
}

function speedOf(p){
  const pace = getAttr(p,'ritmo'), agi = getAttr(p,'agilidade');
  return 4.45 + (pace - 50) / 50 * 3.65 + (agi - 50) / 50 * 0.55;
}
function accelOf(p){
  const acc = getAttr(p,'aceleracao'), agi = getAttr(p,'agilidade');
  return 19 + (acc - 50) / 50 * 16 + (agi - 50) / 50 * 8;
}
function turnOf(p){ return clamp(0.52 + getAttr(p,'agilidade') / 100 * 0.78, 0.65, 1.30); }

class MatchSim {
  /* teamA/teamB: { squad, name, flag, color, lineup:[{p, x, y}...11], bench:[p...] }
     x,y das lineups em 0..1 (frame de ataque).
     opts: {neutral, knockout, onEvent, onSetPiece}. */
  constructor(teamA, teamB, opts = {}) {
    this.opts = opts;
    this.teams = [this._buildTeam(teamA, 0), this._buildTeam(teamB, 1)];
    this.onEvent = opts.onEvent || function(){};
    this.reset();
  }

  _buildTeam(t, side) {
    const attackDir = side === 0 ? +1 : -1;        // A ataca +x, B ataca -x
    const prof = (!t.style && TACT && t.squad) ? TACT.getProfile(t.squad) : null;
    const styleKey = t.style || (prof && prof.style) || null;
    const baseFx = STYLE_FX[styleKey] || STYLE_NEUTRO;
    const fx = Object.assign({ ritmo: 1, drible: 1, shoot: 1 }, baseFx,
      prof ? { ritmo: prof.ritmo, drible: prof.drible, shoot: prof.shoot, cross: baseFx.cross * prof.cross } : {});

    /* ===== EIXOS TÁTICOS: uma única tradução para jogador e IA ============
       Preset e ajuste manual percorrem a mesma fórmula. Antes, o mesmo estilo
       tinha dois comportamentos: um para times com t.axes e outro para a IA. */
    const AX = deriveAxes(t.axes, styleKey, baseFx);
    t._axes = AX;
    fx.line = lerp(-0.100, 0.055, AX.line / 100);
    fx.tackle = lerp(0.80, 1.42, AX.press / 100);
    fx.pressReach = lerp(-0.5, 1.4, AX.press / 100);
    fx.drain = (baseFx.drain || 1) * lerp(0.92, 1.14, AX.press / 100);
    fx.width = AX.width / 100;
    fx.direct = AX.tempo / 100;
    fx.posture = AX.posture / 100;
    fx.far = lerp(baseFx.far * 0.85, baseFx.far * 1.15, AX.tempo / 100);
    // #7 — QUÍMICA: quantos jogadores partilham a MESMA seleção de origem. Um
    // núcleo nacional entrosado decide mais rápido (bônus modesto no ritmo). Só o
    // time montado no draft carrega sl.from; times reais (IA) não entram aqui
    // (from ausente → _chem 0 → sem bônus), então a calibração dos gates não muda.
    let _chem = 0;
    if (t.lineup) {
      const _byNat = {};
      for (const sl of t.lineup) { const c = sl.from && sl.from.c; if (c) _byNat[c] = (_byNat[c] || 0) + 1; }
      const _vals = Object.values(_byNat);
      _chem = _vals.length ? Math.max.apply(null, _vals) : 0;
    }
    if (_chem >= 3) { fx.ritmo *= (1 + Math.min(0.08, (_chem - 2) * 0.025)); t._chem = _chem; }
    /* ═══════════════════════════════════════════════════════════════════
       TÓPICO 3 · FIM DA "MENTE DE COLMEIA" — sensibilidade tática por posição
       ═══════════════════════════════════════════════════════════════════
       ANTES: fx.line deslocava TODOS os onze pelo mesmo número de metros e
       a postura/largura tratava o time como um bloco único. É exatamente o
       sintoma descrito: mudou a tática global, o time inteiro age igual.
       AGORA a equação de cada boneco é
           alvo = BASE DA POSIÇÃO  +  eixo global × PESO DA POSIÇÃO
       com a POSIÇÃO como valor sagrado (cláusulas rígidas no fim):
         · AXW.line — quanto cada função obedece a "Linha Defensiva": o ST
           sobe 1.25× o eixo, o CB apenas 0.50×, o GK quase nada. Linha
           altíssima NUNCA transforma zagueiro em atacante.
         · AXW.sink — retranca (Postura < neutro): o CDM afunda ~2× mais
           que o resto e encosta na zaga (o "3º zagueiro" do documento); o
           CAM recua o bloco mas tem PISO em 30% do campo — ele não vira
           lateral-esquerdo da própria área, poupa fôlego como manda a
           essência da posição.
         · AXW.push — postura ofensiva: frente projeta (ST/pontas/CAM),
           zaga quase não sai do lugar.
         · CORREDOR DO CB — independentemente da Largura, o zagueiro
           central vive num corredor de ±9,5 m do eixo do campo; "Aberto"
           esgarça laterais e pontas (openTo já cola na linha), jamais o
           miolo da zaga. CDM idem, com folga maior (±14 m).
       Os pesos vivem numa tabela única por classe de slot (SLOT_CLASS),
       barata de avaliar: nada de árvore de decisão por frame — é a mesma
       aritmética de antes com três multiplicadores a mais. */
    const AXW = {
      //          line   sink   push
      GK:  { line: .12, sink: .02, push: .01 },
      CB:  { line: .50, sink: .05, push: .02 },
      FB:  { line: .85, sink: .10, push: .05 },
      WB:  { line: 1.0, sink: .10, push: .07 },
      CDM: { line: .80, sink: .21, push: .04 },
      CM:  { line: 1.0, sink: .11, push: .08 },
      WM:  { line: 1.05, sink: .08, push: .09 },
      CAM: { line: 1.15, sink: .05, push: .12 },
      WG:  { line: 1.20, sink: .06, push: .10 },
      ST:  { line: 1.25, sink: .05, push: .10 },
    };
    const postAxis = (fx.posture == null ? 0.5 : fx.posture) - 0.5;   // -0.5 retranca .. +0.5 all-in
    const mkHomes = (sl, pos, rfx) => {   // PAPÉIS: rfx = deltas de função+foco
      // shape DEFENSIVO: bloco compacto na própria metade
      const isGK = pos === 'GK';
      // TÓPICO 3 · eixos globais escalados pelo peso da POSIÇÃO (AXW):
      const cls = SLOT_CLASS[pos] || 'CM';
      const W = AXW[cls] || AXW.CM;
      const lineFx = fx.line * FL * W.line;                       // linha por função
      const postFx = postAxis < 0 ? postAxis * FL * W.sink * 2    // retranca afunda…
                                  : postAxis * FL * W.push * 2;   // …ofensiva projeta
      /* PAPÉIS · o empuxo da função entra AQUI, somado aos eixos globais e
         antes das cláusulas sagradas: um "Ala de apoio" nasce mais alto, um
         "Volante de contenção" mais fundo, sem jamais furar os tetos/corredores
         que o Tópico 3 garante logo abaixo. */
      const rp = (rfx && rfx.push) || 0;
      let dProg = isGK ? 4 : (6 + sl.x * 46) + lineFx + postFx + rp * 0.6;
      // shape OFENSIVO: bloco alto empurrado pro campo rival
      let aProg = isGK ? 9 : (30 + sl.x * 66) + lineFx + Math.max(0, postFx) + rp;
      // CLÁUSULAS SAGRADAS DA POSIÇÃO (o teto/piso que a tática não anula):
      if (cls === 'CAM') dProg = Math.max(dProg, FL * 0.30);      // CAM não vira zagueiro
      if (cls === 'CDM' && postAxis < -0.28) dProg = Math.min(dProg, FL * 0.17); // retranca: quase 3º zagueiro
      if (cls === 'CB') dProg = Math.min(dProg, FL * 0.34);       // zaga nunca "sobe de linha" p/ meio
      const wide = ['LW','RW','LM','RM','LWB','RWB','LB','RB'].indexOf(pos) !== -1;
      const baseY = side === 0 ? sl.y * FW : (1 - sl.y) * FW;
      const openTo = baseY < FW / 2 ? 2.5 : FW - 2.5;
      // LARGURA (fx.width 0..1): compacto junta o bloco; aberto espalha.
      const wf = fx.width;
      const compact = lerp(0.34, 0.0, wf);
      const dhy = lerp(baseY, FW / 2, 0.08 + compact);
      /* PAPÉIS · abertura da função: "Ponta aberta"/"Ala" cola mais na linha;
         "Ponta invertida"/"Lateral por dentro" fecha para o miolo. */
      const rw = (rfx && rfx.wide) || 0;
      let ahy = wide ? lerp(baseY, openTo, clamp(lerp(0.10, 0.52, wf) + rw, 0.04, 0.95))
                     : lerp(baseY, FW / 2, compact * 0.5);
      if (rw < 0 && wide) ahy = lerp(ahy, FW / 2, Math.min(0.6, -rw * 2.4)); // invertido puxa pro meio
      const P = v => side === 0 ? v : FL - v;
      // TÓPICO 3 · corredor sagrado do miolo: CB (±9,5 m) e CDM (±14 m)
      // ficam presos ao eixo central em QUALQUER largura — "Aberto" abre
      // ala e ponta, nunca o coração da zaga (Exemplo 2 do documento).
      let fdhy = dhy, fahy = ahy;
      if (cls === 'CB')  { fdhy = clamp(dhy, FW/2 - 9.5, FW/2 + 9.5); fahy = clamp(ahy, FW/2 - 9.5, FW/2 + 9.5); }
      if (cls === 'CDM') { fdhy = clamp(dhy, FW/2 - 14,  FW/2 + 14 ); fahy = clamp(ahy, FW/2 - 14,  FW/2 + 14 ); }
      return { dhx: P(clamp(dProg, 2, FL-2)), dhy: fdhy, ahx: P(clamp(aProg, 2, FL-2)), ahy: fahy };
    };
    const players = t.lineup.map((sl, i) => {
      const p = sl.p;
      const pos = sl.pos || p.slot;
      /* PAPÉIS · resolução por jogador: usa o papel/foco definido na escalação
         (sl.role/sl.focus, vindos da futura UI) ou o padrão da posição. O
         resultado modula a posição-base no mkHomes. */
      const _role = sl.role || defaultRoleFor(pos);
      const _focus = sl.focus || 'bal';
      const _rfx = roleFx(_role, _focus);
      const H = mkHomes(sl, pos, _rfx);
      const hx = H.dhx, hy = H.dhy;
      return {
        ref: p, team: side, slotPos: pos, ipPos: pos, oopPos: pos, idx: i,
        role: _role, ipRole: _role, focus: _focus, roleFx: _rfx,   // PAPÉIS: guardados no jogador
        dhx: H.dhx, dhy: H.dhy, ahx: H.ahx, ahy: H.ahy,
        x: hx, y: hy, vx: 0, vy: 0, hx, hy,
        maxSpd: speedOf(p), acc: accelOf(p), turn: turnOf(p),
        oopRole: deriveOopRole(pos, _role, _focus),
        heatmap: new Float32Array(ADV4.analytics.cols * ADV4.analytics.rows),
        passLinks: Object.create(null),
        // Leitura espacial afeta o tempo de reação ao desenho coletivo. Antes,
        // esse atraso era quase todo aleatório: um jogador inteligente podia se
        // mover pior que um jogador comum sem qualquer relação com atributos.
        react: clamp(lerp(0.255, 0.075,
          (getAttr(p,'posicionamento') * 0.45 + getAttr(p,'antecipacao') * 0.35 +
           getAttr(p,'trabalho_equipe') * 0.20) / 100) + R(-0.018, 0.018), 0.065, 0.27),
        stamina: 100, rating: 6.0, settle: 0,
        yellow: 0, red: false, isGK: (sl.pos || p.slot) === 'GK',
        runT: R(0, 2)
      };
    });
    return {
      side, attackDir, fx: Object.assign({}, fx), baseFx: Object.assign({}, fx), styleKey, phase: 0,
      mood: { line: 0, risk: 1, far: 1, tackle: 1 },
      adaptive: {
        key: 'balance', label: 'Equilíbrio', reason: 'Contexto sem urgência', intensity: 0,
        line: 0, risk: 0, far: 0, tackle: 0, pressReach: 0, ritmo: 0,
        direct: 0, width: 0, posture: 0, drain: 0, focusSide: null
      },
      squad: t.squad, name: t.name, flag: t.flag,
      color: t.color, players, bench: (t.bench || []).slice(),
      goal: side === 0 ? GOAL_B : GOAL_A,       // gol que o time DEFENDE
      oppGoal: side === 0 ? GOAL_A : GOAL_B,     // gol que o time ATACA
      subsLeft: 5
    };
  }

  reset() {
    this.t = 0;                    // tempo de simulação (s)
    this.minute = 0;               // minuto de jogo (0..90+)
    this.half = 1;
    this.stoppage = 0;
    this.score = [0, 0];
    this.momentum = 0;             // -1 (B) .. +1 (A)
    this.decideT = 0;
    this.beat = 0;                 // câmera lenta restante (s de tempo real) — só visual
    this.dead = 0;                 // bola parada: tempo até reinício
    this.pendingRestart = null;
    this.events = [];
    this.stats = [this._blankStats(), this._blankStats()];
    this._lastMoodMinute = -2;
    this._analyticsT = 0;
    this._insightMinute = -10;
    this._resetPositions();
    this.waiting = true;
    this.dead = 1.2;
    // bola-padrão (centro) antes do kickoff, pra getState() ser válido no 1º render
    this.ball = { x: FL/2, y: FW/2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, traveling: false, travelT: 0, target: null, kind: null, lastTouch: null };
    this.pendingRestart = () => { this.waiting = false; this._kickoff(Ri(0, 1), true); };
  }
  getAdvancedData(team){
    const side = team === 1 ? 1 : 0;
    const tm = this.teams[side];
    const st = this.stats[side];
    const insights=[];
    const passAccuracy = st.passes ? Math.round(st.passOk/st.passes*100) : 0;
    const throughAccuracy = st.throughBalls ? Math.round(st.throughOk/st.throughBalls*100) : 0;
    if(st.passes>70 && st.xg<.7) insights.push('Posse pouco penetrante: aumente ritmo, largura ou corridas de ruptura.');
    if(st.throughBalls>=10 && throughAccuracy<38) insights.push('Bolas em profundidade forçadas: reduza o risco ou procure corredores com vantagem de velocidade.');
    if(st.gkBadDistribution>=3) insights.push('Saída do goleiro vulnerável sob pressão.');
    if(st.defErrors>=2) insights.push('A defesa perdeu referências; linha, concentração e fadiga estão pesando.');
    if(st.pressWins>=8) insights.push('A contrapressão está recuperando bolas rapidamente.');
    return {
      version:ADV4.version,
      team:side,
      score:this.score.slice(),
      phase:{inPossession:tm.atkForm||null,outOfPossession:tm.defForm||null,style:tm.styleKey||null},
      summary:{passAccuracy,throughAccuracy,xg:st.xg,shots:st.shots,pressWins:st.pressWins,defErrors:st.defErrors},
      roles:tm.players.map(p=>({id:p.ref&&p.ref.id,name:p.ref&&p.ref.n,position:p.slotPos,inPossessionPosition:p.ipPos||p.slotPos,outOfPossessionPosition:p.oopPos||p.slotPos,inPossession:p.ipRole||p.role,outOfPossession:p.oopRole,focus:p.focus,stamina:Math.round(p.stamina),rating:+(p.rating||6).toFixed(2)})),
      heatmaps:tm.players.map(p=>({id:p.ref&&p.ref.id,name:p.ref&&p.ref.n,cols:ADV4.analytics.cols,rows:ADV4.analytics.rows,values:p.heatmap?Array.from(p.heatmap):[]})),
      passingMap:Object.entries(st.passingMap||{}).map(([link,count])=>({link,count})),
      insights
    };
  }

  _blankStats(){ return {
    shots:0, onTarget:0, goals:0, xg:0, corners:0, fouls:0, yellow:0, red:0,
    poss:0, passes:0, passOk:0, saves:0, offsides:0, tackles:0,
    interceptions:0, dribblesAttempted:0, dribblesCompleted:0,
    keyPasses:0, crosses:0, crossesOk:0, attacksL:0, attacksR:0,
    throughBalls:0, throughOk:0, lowCrosses:0, lowCrossesOk:0,
    oneOnOnes:0, setPieceShots:0, setPieceGoals:0,
    pressWins:0, defErrors:0, gkSweeps:0, gkBadDistribution:0,
    passingMap:Object.create(null), heatSamples:0
  }; }

  _resetPositions() {
    for (const tm of this.teams) for (const p of tm.players) {
      if (p.red) continue;
      p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0; p.settle = 0;
    }
  }

  /* O lado do usuário define apenas qual adversário recebe decisões da IA.
     Toda finalização e bola parada é resolvida pela mesma fórmula do motor. */
  setInteractive(team) { this.interactiveTeam = team; if (team === 0 || team === 1) this._aiTeam = 1 - team; }

  /* Suspende somente o relógio/física enquanto o jogador prepara a cobrança.
     O callback resolve uma única vez e devolve o controle ao motor. */
  _requestSetPiece(kind, data, execute) {
    if (!this.opts.onSetPiece || data.team !== this.interactiveTeam) return false;
    this.waiting = true;
    this.dead = 9999;
    let resolved = false;
    const request = Object.assign({ kind }, data, {
      resolve: input => {
        if (resolved) return;
        resolved = true;
        this.dead = 0;
        this.waiting = false;
        execute(input || {});
      }
    });
    try { this.opts.onSetPiece(request); }
    catch (_) { request.resolve({ aimX:.5, aimY:.48, power:.72, curve:0, assisted:true }); }
    return true;
  }

  _switchSides() {
    for (const tm of this.teams) {
      tm.attackDir *= -1;
      const g = tm.goal; tm.goal = tm.oppGoal; tm.oppGoal = g;
      for (const p of tm.players) {
        p.hx = FL - p.hx;  p.hy = FW - p.hy;
        p.dhx = FL - p.dhx; p.dhy = FW - p.dhy;
        p.ahx = FL - p.ahx; p.ahy = FW - p.ahy;
        p.x = FL - p.x;    p.y = FW - p.y;
        p.vx = 0; p.vy = 0;
      }
    }
  }

  _kickoff(side, start) {
    this._resetPositions();
    const tm = this.teams[side];
    const mid = tm.players.filter(p => !p.red && !p.isGK).sort((a,b)=> Math.abs(a.hx-FL/2)-Math.abs(b.hx-FL/2))[0] || tm.players.find(p => !p.red);
    this.ball = { x: FL/2, y: FW/2, z: 0, vx: 0, vy: 0, vz: 0, owner: mid, traveling: false, travelT: 0, target: null, kind: null, lastTouch: mid };
    if (mid) { mid.x = FL/2; mid.y = FW/2; mid.settle = 0.2; }
    this.poss = side;
    if (start) this._emit('kickoff', { team: side });
  }

  /* ------------------------------- STEP -------------------------------- */
  step(dt) {
    this.t += dt;
    this._stepDt = dt;
    // beat (slow-mo) apenas escala a física visual; a lógica de tempo de jogo não
    const slow = this.beat > 0 ? 0.4 : 1;
    if (this.beat > 0) this.beat = Math.max(0, this.beat - dt);
    const pdt = dt * slow;

    // relógio de jogo (condensado): pausa durante bola morta longa
    const clockRate = CAL.timing.clockRate;              // min de jogo por s de simulação
    if (this.dead <= 0) this.minute += dt * clockRate;
    // IA contextual: placar+tempo mudam a postura (§21/22)
    this.simT = (this.simT || 0) + dt;
    // O controlador contextual reavalia por relógio de jogo, com janela mínima
    // de dois minutos: estável em qualquer velocidade e sem oscilar por quadro.
    if (this.minute - (this._lastMoodMinute == null ? -2 : this._lastMoodMinute) >= 2) {
      this._lastMoodMinute = this.minute;
      this._updateMoods();
    }
    // MOMENTUM (§6): posse no último terço acumula pressão; decai sozinho
    if (!this.mom) this.mom = [0, 0];
    const bo = this.ball.owner;
    if (bo) {
      const tm2 = this.teams[bo.team];
      const inFinal = tm2.attackDir > 0 ? bo.x > FL * 0.62 : bo.x < FL * 0.38;
      if (inFinal) this.mom[bo.team] = clamp(this.mom[bo.team] + dt * 0.05, 0, 1);
      this.mom[1 - bo.team] = clamp(this.mom[1 - bo.team] - dt * 0.05, 0, 1);
    }
    this.mom[0] = clamp(this.mom[0] - dt * 0.008, 0, 1);
    this.mom[1] = clamp(this.mom[1] - dt * 0.008, 0, 1);
    // fases: com posse o bloco vira o shape ofensivo; sem posse, o defensivo (§4/6)
    for (const t of [0, 1]) {
      const tm = this.teams[t];
      const target = this.poss === t ? 1 : 0;
      /* TÓPICO 3 · TRANSIÇÃO COM/SEM BOLA assimétrica (Exemplo 3): perder a
         posse liga o comportamento DEFENSIVO da posição imediatamente
         (ganho 3.4 ≈ 0,3 s para fechar o bloco); recuperar a bola expande o
         shape ofensivo com a cadência anterior (1.4), porque atacar é
         construção, defender é reflexo. */
      const gain = target < tm.phase ? 3.4 : 1.4;
      tm.phase += (target - tm.phase) * Math.min(1, dt * gain);
      for (const p of tm.players) {
        p.hx = lerp(p.dhx, p.ahx, tm.phase);
        p.hy = lerp(p.dhy, p.ahy, tm.phase);
      }
    }

    // decaimento de momentum para 0
    this.momentum += (0 - this.momentum) * dt * 0.25;

    // bola morta (comemoração/reposição) — segura o jogo brevemente
    if (this.dead > 0) {
      this.dead -= dt;
      this._movePlayers(pdt, this.waiting || this.dead > 0.4);
      if (this.dead <= 0 && this.pendingRestart) {
        // Limpa ANTES de executar. Alguns reinícios são encadeados (bola sai,
        // prepara tiro de meta e só então entrega ao goleiro). Antes, o callback
        // novo era criado e imediatamente apagado pela linha seguinte, deixando
        // a bola fora do campo num ciclo silencioso de reposições.
        const restart = this.pendingRestart;
        this.pendingRestart = null;
        restart();
      }
      return;
    }

    // física da bola
    if (this.ball.traveling) this._ballTravel(pdt);
    else if (this.ball.owner) this._ballGlue();
    else this._looseRoll(pdt);

    // decisão do portador (intervalo definido na calibração canônica)
    this.decideT -= dt;
    if (!this.ball.traveling && this.ball.owner && this.ball.owner.settle <= 0 && this.decideT <= 0) {
      {
      const ow = this.ball.owner;
      const rit = ow ? clamp(this.teams[ow.team].fx.ritmo + 0.06, 0.95, 1.12) : 1;
      const fat = ow ? 1 + (100 - ow.stamina) / 100 * 0.14 : 1;   // cansado decide mais devagar (§13)
      // REAÇÃO POR QI (§craque): o craque LÊ a jogada antes e decide mais rápido —
      // REAÇÃO POR QI (§craque): a referência é o jogador COMUM, que decide na
      // velocidade padrão (1.0). O craque de leitura (INT alto) é o único que ganha
      // bônus — pensa MAIS rápido ainda. Ninguém fica mais lento que o normal: o
      // jogo mantém o ritmo, e o craque se destaca por cima. Xavi/Pirlo/Iniesta
      // reagem antes; o mediano joga no tempo normal (não desacelera o jogo).
      const iq = ow && ow.ref && ow.ref.a8 ? ow.ref.a8[5] : 70;
      const iqReact = iq >= 80 ? clamp(1 - (iq - 80) / 100 * 1.1, 0.79, 1) : 1;
      this.decideT = CAL.timing.decisionInterval * fat * iqReact / rit;
    }
      this._decide(this.ball.owner);
    }
    // MOMENTO DE LENDA (§dinâmica): aos 75'+, com o jogo empatado ou perdendo
    // por 1, a lenda CLUTCH "chama a responsabilidade" — buff até o fim.
    if (this.minute >= 75 && !this._legendFired) {
      for (const tm of this.teams) {
        const diff = this.score[tm.side] - this.score[1 - tm.side];
        if (diff > 0 || diff < -1) continue;
        const hero = tm.players.find(p => !p.red && p.ref && p.ref.legend &&
          (p.ref.traits || []).includes('CLUTCH_PLAYER') && !p.isGK);
        if (hero) {
          hero._onFire = true;
          hero.maxSpd *= 1.05;
          this._legendFired = true;
          this._emit('legend', { by: hero });
          break;
        }
      }
    }

    // relógio da fase de posse
    if (this.ball.owner) this.possT = (this.possT || 0) + dt; else this.possT = 0;
    // posse por TEMPO (reflete estilo): conta segundos de bola de cada time
    if (this.ball.owner) { this.stats[this.ball.owner.team].possTime = (this.stats[this.ball.owner.team].possTime || 0) + dt; }
    // settle e stamina
    for (const tm of this.teams) for (const p of tm.players) {
      if (p.settle > 0) p.settle -= dt;
      const moving = (p.vx*p.vx + p.vy*p.vy) > 4;
      const lateDrain = this.minute >= ADV4.context.lateMinute ? 1 + (this.minute-ADV4.context.lateMinute)/40 : 1;
      const pressDuty = (p===this.teams[p.team]._presser || (this.teams[p.team]._counterPressUntil||0)>this.t) ? 1.12 : 1;
      p.stamina = clamp(p.stamina - (moving ? 0.055 : 0.012) * dt * (2 - getAttr(p,'resistencia')/100) * this.teams[p.team].fx.drain * lateDrain * pressDuty, 32, 100);
    }
    // desarme/bote passivo? NÃO. Só duelos (§5.5). Mas o presser tenta bote quando encosta.
    if (!this.ball.traveling && this.ball.owner) this._pressAndTackle(dt);

    this._movePlayers(pdt, false);
    this._trackAnalytics(dt);

    // fim de tempo
    if (this.half === 1 && this.minute >= 45 + this.stoppage) {
      this.half = 2; this.minute = 45; this.stoppage = 0;
      this._switchSides();
      this._emit('halftime', {});
      this.waiting = true; this.dead = 1.2;
      this.pendingRestart = () => { this.waiting = false; this._kickoff(this.poss === 0 ? 1 : 0, false); };
    } else if (this.half === 3 && this.minute >= 105) {
      this.half = 4;
      this._switchSides();
      this._emit('et_halftime', {});
      this.waiting = true; this.dead = 1.2;
      this.pendingRestart = () => { this.waiting = false; this._kickoff(this.poss === 0 ? 1 : 0, false); };
    }
  }

  // prorrogação (mata-mata empatado)
  beginExtraTime() {
    this.half = 3; this.minute = 90; this.stoppage = 0;
    this._switchSides();
    this._emit('extratime', {});
    this.waiting = true; this.dead = 1.2;
    this.pendingRestart = () => { this.waiting = false; this._kickoff(this.poss === 0 ? 1 : 0, false); };
  }

  isOver(){
    if (this.half <= 2) return this.half === 2 && this.minute >= 90 + this.stoppage;
    return this.half === 4 && this.minute >= 120;
  }

  /* ----------------------- MOTOR 4.0 · CONTEXTO ---------------------- */
  _nearestOpponent(p){
    let near=null, nd=1e9;
    for(const d of this.teams[1-p.team].players){ if(d.red) continue; const dd=D(p.x,p.y,d.x,d.y); if(dd<nd){nd=dd;near=d;} }
    return { near, dist:nd };
  }

  _actionContext(p, nearestDist, action){
    const pressure = clamp((ADV4.context.pressureRadius - nearestDist) / ADV4.context.pressureRadius, 0, 1);
    const fatigue = clamp((78 - p.stamina) / 43, 0, 1);
    const importance = (this.opts.knockout ? ADV4.context.knockoutImportance : 0)
      + (this.minute >= 80 ? 0.05 : 0)
      + (Math.abs(this.score[p.team] - this.score[1-p.team]) <= 1 && this.minute >= 72 ? 0.035 : 0);
    const comp = getAttr(p,'compostura') / 100;
    let execution = 1 - pressure * ADV4.context.pressureExecution * (1.08 - comp * .48)
      - fatigue * ADV4.context.fatigueExecution
      - importance * (1 - comp) * .55;
    if (action === 'press') execution *= 0.88 + getAttr(p,'resistencia')/100 * .18;
    if (action === 'shot' && p.ref && p.ref.traits && p.ref.traits.includes('CLUTCH_PLAYER') && this.minute >= 75) execution += .055;
    return { pressure, fatigue, importance, execution:clamp(execution,.62,1.10) };
  }

  _pressTriggerScore(owner, defendingTeam){
    if(!owner) return 0;
    const defTm=this.teams[defendingTeam], ownTm=this.teams[owner.team];
    const ownerProg = ownTm.attackDir>0 ? owner.x : FL-owner.x;
    let s=0;
    if(owner._poorTouchUntil && owner._poorTouchUntil>this.t) s += ADV4.pressing.poorTouchBoost;
    if(owner._backwardReceiveUntil && owner._backwardReceiveUntil>this.t) s += ADV4.pressing.backPassBoost;
    if(owner.isGK) s += ADV4.pressing.keeperBoost;
    if(ownerProg < FL*.32) s += .16;
    if(defTm._counterPressUntil && defTm._counterPressUntil>this.t) s += .34;
    if((defTm.styleKey||'')==='press') s += .22;
    if(owner.vx * ownTm.attackDir < -0.7) s += .10;
    return clamp(s,0,1);
  }

  _roleSynergy(o,m){
    const r1=o.role||'', r2=m.role||'';
    let s=0;
    if(/armador|construtor|falso/.test(r1) && /artilheiro|sombra|atacante|ofensivo/.test(r2)) s+=.34;
    if(/alvo/.test(r1) && /sombra|b2b|atacante/.test(r2)) s+=.22;
    if(/invertid/.test(r1) && /ofensivo|aberta/.test(r2)) s+=.19;
    if(o._overlapping || m._overlapping) s+=.17;
    if(o.focus==='atk' && m.focus==='atk') s-=.08;
    if(o.focus==='def' && m.focus==='def') s-=.10;
    return s;
  }

  _lineVulnerability(attackingTeam){
    const opp=this.teams[1-attackingTeam];
    const defs=opp.players.filter(p=>!p.red && (C.LINE_OF[p.oopPos||p.slotPos]==='DEF' || (p.oopPos||p.slotPos)==='CDM'));
    if(!defs.length) return .5;
    // Linha alta = defensores mais distantes do próprio gol, independentemente
    // do lado em que o time ataca. A versão anterior invertia essa leitura.
    const avgDepth=defs.reduce((sum,p)=>sum+Math.abs(p.x-opp.goal.x),0)/defs.length;
    const avgIq=defs.reduce((sum,p)=>sum+facet(p,'def_position'),0)/defs.length;
    const lineHigh=clamp((avgDepth-18)/(FL*.28),0,1);
    return clamp(lineHigh*(1.18-avgIq/180),0,1);
  }

  _paceEdge(receiver){
    const defs=this.teams[1-receiver.team].players.filter(p=>!p.red && !p.isGK);
    defs.sort((a,b)=>D(a.x,a.y,receiver.x,receiver.y)-D(b.x,b.y,receiver.x,receiver.y));
    const ref=defs.slice(0,2);
    const defP=ref.length?ref.reduce((s,p)=>s+(getAttr(p,'ritmo')+getAttr(p,'aceleracao'))/2,0)/ref.length:65;
    const atkP=(getAttr(receiver,'ritmo')+getAttr(receiver,'aceleracao'))/2;
    return clamp((atkP-defP)/ADV4.through.paceEdgeScale,-1,1);
  }

  _trackAnalytics(dt){
    if (this.opts && this.opts.labMode) return;
    this._analyticsT += dt;
    if(this._analyticsT < ADV4.analytics.sample) return;
    this._analyticsT=0;
    for(const tm of this.teams){
      this.stats[tm.side].heatSamples++;
      for(const p of tm.players){
        if(p.red || !p.heatmap) continue;
        const c=clamp(Math.floor(p.x/FL*ADV4.analytics.cols),0,ADV4.analytics.cols-1);
        const r=clamp(Math.floor(p.y/FW*ADV4.analytics.rows),0,ADV4.analytics.rows-1);
        p.heatmap[r*ADV4.analytics.cols+c] += 1;
      }
    }
  }

  _goalkeeperDistribute(o){
    const tm=this.teams[o.team], opps=this.teams[1-o.team].players.filter(p=>!p.red);
    const nearest=this._nearestOpponent(o).dist;
    const skill=facet(o,'distribution');
    const direct = tm.fx.direct == null ? 0.5 : tm.fx.direct;
    let best=this._bestPass(o);
    if(best && direct<.55 && best.dist>30){
      const short=this._safePass(o,opps); if(short) best=short;
    }
    if(!best){ this._clearBall(o); return; }
    const ctx=this._actionContext(o,nearest,'pass');
    const bad=clamp(.18-(skill-55)/250 + ctx.pressure*.12 + ctx.fatigue*.05, .025,.28);
    if(chance(bad)){
      this.stats[o.team].gkBadDistribution++;
      this._emit('gk_bad_distribution',{by:o});
      const tx=clamp(o.x+tm.attackDir*R(12,28),2,FL-2), ty=clamp(o.y+R(-18,18),2,FW-2);
      this._startTravel(o,{x:tx,y:ty},'pass',()=>this._looseBall(tx,ty),null,direct>.6?'launch':'short');
      return;
    }
    this._pass(o,best);
  }

  /* ---------------------------- DECISÃO (§5.4) ------------------------- */
  _decide(o) {
    const tm = this.teams[o.team];
    const g = tm.oppGoal;
    if (o.isGK) { this._goalkeeperDistribute(o); return; }
    const dir = tm.attackDir;
    const dtg = D(o.x, o.y, g.x, g.y);
    // sob pressão, o próximo ciclo de decisão vem mais rápido (livra a bola a tempo)
    let _pn = 1e9; for (const _d of this.teams[1-o.team].players){ if(_d.red)continue; const _dd=D(o.x,o.y,_d.x,_d.y); if(_dd<_pn)_pn=_dd; }
    if (_pn < 2.4) this.decideT = Math.min(this.decideT, 0.20);
    const T = TACT ? TACT.tendencies(o.ref) : {};   // tendências individuais (§5)
    const opps = this.teams[1 - o.team].players.filter(p => !p.red);
    let near = null, nd = 1e9;
    for (const d of opps){ const dd = D(o.x,o.y,d.x,d.y); if (dd < nd){ nd = dd; near = d; } }
    const pressured = nd < 3.0;

    // ============ FASE DE CONSTRUÇÃO (anti pingue-pongue) ============
    // possT = há quanto tempo o time tem a bola. Recém-recuperada → circula.
    // Contra-ataque (espaço + estilo counter) ignora o reset e acelera.
    const possT = this.possT || 0;
    const sk = tm.styleKey || '';
    const counterStyle = sk === 'counter';
    const spaceAhead = this._openLaneAhead(o, g, dir);
    // DIRETIVIDADE (fx.direct 0..1): quanto mais direto, mais o time verticaliza
    // na transição e menos circula.
    const direct = tm.fx.direct;
    const breakStyle = counterStyle || sk === 'park';
    const breakWin = lerp(0.7, 4.2, direct) * (breakStyle ? 1.25 : 1);
    const fastBreak = spaceAhead && possT < breakWin;
    const patience = lerp(6.2, 0.8, direct);
    const building = possT < patience && !fastBreak;

    // ═══ MÁQUINA DE ESTADO DE POSSE (§Fase2) ═══════════════════════════════
    // O que faltava (5 tentativas provaram): não é posição nem preço isolado — é
    // MEMÓRIA COLETIVA. Time estabelecido no campo adversário sem espaço → COMPROMETE
    // com circular ("estou construindo"), rompe só quando um gatilho real aparece.
    // Fase calculada com sinais PRÉ-best (não circular); o _bestPass lê _circulate.
    if (!tm._poss) tm._poss = { phase: 'transition', passes: 0 };
    const ps = tm._poss;
    // construção começa cedo (posse estabelecida ~1.2s) e em qualquer setor — o time
    // que segurou a bola e não tem espaço óbvio à frente entra em modo circular.
    const established = possT > 1.2 && !spaceAhead && !fastBreak;
    if (established) {
      if (ps.phase !== 'build') { ps.phase = 'build'; ps.passes = 0; }
    } else if (spaceAhead || fastBreak) {
      ps.phase = 'attack';
    }
    this._circulate = ps.phase === 'build'
      ? clamp(0.25 + ps.passes * 0.12, 0, 0.95) * (tm.styleKey === 'direct' ? 0.25 : 1)
      : 0;
    // ════════════════════════════════════════════════════════════════════════

    /* ===== CAMPO ÚNICO DE VALOR (§evolução): passe e chute agora competem na
       mesma decisão. Antes, três sorteios de finalização eram executados ANTES
       de o portador avaliar seus companheiros; por isso a ação podia mudar mesmo
       com campo, pressão e opções idênticos. O desfecho continua probabilístico,
       mas a ESCOLHA nasce de distância, ângulo, pressão, habilidade, fadiga,
       contexto do placar e qualidade da melhor assistência disponível. */
    const best = this._bestPass(o);
    // Um passe limpo para alguém já dentro da área tem prioridade sobre um chute
    // de média/longa distância. Antes a ordem era inversa: o meia encerrava a
    // jogada antes de servir o atacante livre, inflando chutes ruins e secando gols.
    if (best && best.intoBox && best.risk < 2.4 && dtg > 16) { this._pass(o, best); return; }
    const shotDecision = this._evaluateShotDecision(o, dtg, pressured, nd, best, T);
    if (shotDecision.take) { 
      const volley = o.settle > 0 && o.settle < 0.45;
      this._shoot(o, dtg, shotDecision.longshot, volley); return; 
    }
    // bola matadora na área — quase sempre tenta
    if (best && best.intoBox && best.risk < 2.4) { this._pass(o, best); return; }
    // PAUSA-E-SOLTA derivada: esperar só quando esperar comprovadamente vence
    // agir; o bote (pressured) corta o luxo; o gain se dissolve quando a corrida
    // chega (o proj vira score) — solta no pico, sozinho. (Condução com propósito
    // foi testada e regrediu: precisa da reação defensiva — fundação futura.)
    if (best && best.soonGain > 0.55 && !pressured && possT < 2.2) return;

    // CRUZAMENTO da linha de fundo (grande fonte de finalizações)
    // LARGURA da defesa adversária: compacto abre as ALAS → cruza mais; aberto fecha.
    const dW = this.teams[1 - o.team].fx.width;
    const crossMul = dW == null ? 1 : (0.78 + (1 - dW) * 0.5);   // compacto→~1.28, aberto→~0.78
    // o cruzamento LÊ O CAMPO: passe claramente melhor disponível → cruza menos
    const passQ = best ? clamp(best.score, -0.5, 3) : 0;
    const crossP = clamp(0.69 * this.teams[o.team].fx.cross * crossMul * clamp(1.25 - passQ * 0.38, 0.30, 1.25), 0, 0.92);
    if (this._canCross(o) && chance(crossP)) { this._cross(o); return; }

    const inAtt = dir > 0 ? o.x > 62 : o.x < 43;

    // CONSTRUÇÃO: sem pressa, prioriza passe seguro (mesmo lateral/recuado) e
    // circulação. Só progride se a opção pra frente é claramente boa.
    // CB em construção JAMAIS dribla: com pressão e sem passe seguro, chutão (função da posição)
    if (o.slotPos === 'CB' && building) {
      const safe0 = this._safePass(o, opps);
      if (safe0) { this._pass(o, safe0); return; }
      if (nd < 2.2) { this._clearBall(o); return; }   // chutão só com o adversário em cima
    }

    if (building && !pressured && !inAtt) {
      const safe = this._safePass(o, opps);
      // limiar de progressão sobe com a paciência do estilo (tiki segura mais a bola)
      const progGate = tm.styleKey === 'tiki' ? 12 : tm.styleKey === 'direct' ? 4 : 8;
      const scoreGate = tm.styleKey === 'tiki' ? 2.0 : 1.4;
      if (best && best.progressM > progGate && best.score > scoreGate) { this._pass(o, best); return; }
      if (safe) { this._pass(o, safe); return; }
      this._carry(o, g); return;
    }

    // PROGRESSÃO: tenta o passe pra frente (contestado por interceptação/skill)
    if (best && best.progressM > 3 && best.score > 0.6) { this._pass(o, best); return; }

    // pressionado → encara ou toca seguro
    if (pressured && near) {
      // REPERTÓRIO DA LENDA (§item3): o driblador de elite ARRISCA o improvável —
      // encara em vez de tocar, mesmo sob pressão, quando o mediano jogaria seguro.
      const dri = getAttr(o, 'drible');
      const eliteDare = dri >= 88 ? 0.9 : dri >= 82 ? 0.45 : 0;
      const dareBias = (T.driblador ? 0.35 : 0) + (tm.fx.drible - 1) * 0.3 + eliteDare;
      // CIRCULAÇÃO SOB PRESSÃO (§Fase2 — o que faltava): em construção, o time perde
      // a bola 6x mais no DESARME que na interceptação. A causa: pressionado, o dono
      // conduzia (arriscando o bote) em vez de soltar a saída segura. Circulando, o
      // limiar de aceitar a saída DESABA — solta rápido, a posse sobrevive e vira cadeia.
      const circ = this._circulate || 0;
      const passThresh = 1.4 + dareBias - circ * 1.15;
      if (best && best.score > passThresh && !this._blocksPath(o, near, g)) { this._pass(o, best); return; }
      this._dribble(o, near, g); return;
    }
    // espaço à frente → conduz (mais no terço final)
    let cone = 0; for (const d of opps) if (this._inForwardCone(o, d, g, inAtt ? 4.5 : 5.5, 9)) cone++;
    if (cone === 0 && dtg > 6) { this._carry(o, g); return; }
    // no terço final sem passe/condução clara → encara pra criar chance
    if (inAtt && near && nd < 7) { this._dribble(o, near, g); return; }
    // segura com passe possível
    if (best && best.score > -0.6) { this._pass(o, best); return; }
    if (near) { this._dribble(o, near, g); return; }
    this._carry(o, g);
  }

  /* Avalia a intenção de finalizar sem lançar um dado para escolher a ação.
     Por que existe: o RNG deve decidir a execução do chute, não se o jogador
     reconhece uma oportunidade evidente. A utilidade usa somente estado vivo
     da partida e atributos já empregados pelo motor; portanto não cria buffs
     artificiais nem altera a física da bola. */
  _evaluateShotDecision(o, dtg, pressured, nearestDist, best, T) {
    const tm = this.teams[o.team];
    const g = tm.oppGoal;
    const longAttr = getAttr(o, 'chute_longe');
    const technique = o.ref && o.ref.a8 ? o.ref.a8[7] : getAttr(o,'conducao');
    const eliteLong = longAttr >= 82 && technique >= 80;
    const maxRange = eliteLong ? (longAttr >= 92 ? 38 : longAttr >= 87 ? 35 : 32)
      : longAttr >= 76 ? 28 : longAttr >= 66 ? 25 : 22;
    if (dtg > maxRange) return { take:false, longshot:false, oneOnOne:false };

    const nearestDef = this._nearestOpponent(o).dist;
    const oneOnOne = dtg < 19 && (nearestDef > 5.4 || (o._throughReceiverUntil||0) > this.t);
    const base = distanceXg(dtg);
    const longshot = !oneOnOne && (dtg > 21 || (dtg > 18 && eliteLong));
    const skill = facet(o, oneOnOne ? 'one_on_one' : (longshot ? 'shot_far' : 'shot')) / 100;
    const angle = clamp(1 - Math.abs(o.y - g.y) / 42, 0.30, 1);
    const ctx = this._actionContext(o, nearestDist, 'shot');
    const composure = getAttr(o, 'compostura') / 100;
    const scoreDiff = this.score[o.team] - this.score[1-o.team];
    const urgency = this.minute > 72 && scoreDiff < 0 ? .038 : 0;
    const restraint = this.minute > 72 && scoreDiff > 0 ? .022 : 0;
    const traitIntent = T && T.finalizador ? .028 : 0;
    const styleIntent = (tm.fx.shoot || 1) * (tm.mood.far || 1);
    const oneBoost = oneOnOne ? .13 + composure*.06 : 0;
    const longBoost = longshot && longAttr>=84 && technique>=84 ? .024 : 0;
    const shotUtility = base * angle * (.70 + skill*.72) * ctx.execution * styleIntent
      + composure*.033 + urgency + traitIntent + oneBoost + longBoost - restraint;
    const passUtility = best
      ? clamp(.055 + best.score*.045 + (best.intoBox?.17:0) - best.risk*.022, .025,.44)
      : .035;
    const minimum = oneOnOne?.05:dtg<10?.045:dtg<16?.052:dtg<23?.058:.078;
    const longPermission = !longshot || (!pressured && longAttr>=66 && technique>=68);
    const choiceRatio = oneOnOne?.22:longshot?.60:.36;
    return { take:longPermission && shotUtility>=minimum && shotUtility>=passUtility*choiceRatio, longshot, oneOnOne };
  }

  /* ----------------------------- CRUZAMENTO --------------------------- */
  _cross(o) {
    const tm = this.teams[o.team];
    const g = tm.oppGoal;
    const gk = this.teams[1-o.team].players.find(p=>p.isGK&&!p.red);
    const setPiece = (o._setPieceDeliveryUntil||0) > this.t;
    this.stats[o.team].crosses++;
    const inBox = tm.players.filter(p=>p!==o&&!p.red&&!p.isGK&&D(p.x,p.y,g.x,g.y)<24);
    const lowPool = tm.players.filter(p=>p!==o&&!p.red&&!p.isGK&&D(p.x,p.y,g.x,g.y)<44 && (C.LINE_OF[p.slotPos]==='FWD' || C.SLOT_CLASS[p.slotPos]==='AM' || p._breaking || p._runDeep || D(p.x,p.y,g.x,g.y)<27));
    const defs = this.teams[1-o.team].players.filter(p=>!p.isGK&&!p.red);
    const nearByline = Math.abs(o.x-g.x)<18 && Math.abs(o.y-FW/2)>11;
    const crossSkill = setPiece ? facet(o,'setpiece') : facet(o,'low_cross');
    const lowTargets = lowPool.slice().sort((a,b)=>
      (facet(b,'offball')*.34+facet(b,'one_on_one')*.38+getAttr(b,'ritmo')*.28)
      -(facet(a,'offball')*.34+facet(a,'one_on_one')*.38+getAttr(a,'ritmo')*.28));
    const aerialTargets = inBox.slice().sort((a,b)=>facet(b,'head_atk')-facet(a,'head_atk'));
    const bestLow = lowTargets[0], bestAir = aerialTargets[0];
    const aerialAdv = bestAir ? facet(bestAir,'head_atk') - (bestLow?facet(bestLow,'one_on_one'):60) : -20;
    const lowP = clamp(ADV4.crossing.lowCrossBase + crossSkill/260 + (nearByline?.17:0) - Math.max(0,aerialAdv)/280 + (setPiece?-.22:0), .30, .82);
    const delivery = !setPiece && bestLow && chance(lowP) ? 'low' : 'air';
    this._emit('cross',{by:o,delivery,setPiece});

    if(delivery==='low'){
      this.stats[o.team].lowCrosses++;
      const atk=bestLow;
      const nearPostY = o.y<FW/2 ? g.y-2.8 : g.y+2.8;
      const target={x:g.x-tm.attackDir*5.2,y:clamp(lerp(atk.y,nearPostY,.72),g.y-7,g.y+7)};
      const def=defs.slice().sort((a,b)=>D(a.x,a.y,target.x,target.y)-D(b.x,b.y,target.x,target.y))[0];
      this._startTravel(o,target,'pass',()=>{
        const atkScore=facet(atk,'offball')*.38+facet(atk,'one_on_one')*.34+getAttr(atk,'ritmo')*.18+crossSkill*.10;
        const defScore=def ? facet(def,'def_position')*.48+facet(def,'intercept')*.32+getAttr(def,'ritmo')*.20 : 45;
        const win=duelProb(atkScore+6,defScore);
        if(!chance(win)){
          this._emit('blocked',{by:def});
          if(chance(.42)) this._setCorner(o.team); else this._turnover(def||gk);
          return;
        }
        this.stats[o.team].crossesOk++; this.stats[o.team].lowCrossesOk++;
        this.stats[o.team].shots++; this.stats[o.team].keyPasses++;
        const ctx=this._actionContext(atk,def?D(atk.x,atk.y,def.x,def.y):8,'shot');
        const finish=facet(atk,'one_on_one'), keeper=gk?facet(gk,'gk_one_on_one'):45;
        const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);
        this.stats[o.team].xg+=pGoal;
        this._emit('low_cross_shot',{by:atk,from:o,xg:pGoal});
        if(setPiece){ this.stats[o.team].setPieceShots++; atk._setPieceShotUntil=this.t+1; }
        if(chance(pGoal)) this._goal(atk,false);
        else if(chance(.48+(gk?facet(gk,'gk')/300:0))){
          this.stats[o.team].onTarget++; if(gk){this.stats[1-o.team].saves++;gk.rating+=.2;}
          this._emit('save',{gk,big:pGoal>.30}); if(chance(.34))this._setCorner(o.team);else this._turnover(gk);
        } else { this._emit('miss',{by:atk}); this._goalKickOrRestart(1-o.team); }
      },atk,'through');
      return;
    }

    const atk=bestAir;
    const deliveryFail = clamp(.34-(crossSkill-55)/210-(setPiece?.08:0),.10,.43);
    if(!atk || chance(deliveryFail)){
      this._startTravel(o,{x:g.x,y:FW/2+R(-8,8)},'pass',()=>{if(chance(.52))this._setCorner(o.team);else this._goalKickOrRestart(1-o.team);},null,'launch');
      return;
    }
    const def=defs.slice().sort((a,b)=>D(a.x,a.y,atk.x,atk.y)-D(b.x,b.y,atk.x,atk.y))[0];
    this._startTravel(o,{x:atk.x,y:atk.y},'pass',()=>{
      const setBoost=setPiece?ADV4.crossing.aerialSetPieceBoost*100:0;
      const pWin=duelProb(facet(atk,'head_atk')+setBoost,(def?facet(def,'head_def'):40)+5);
      if(chance(pWin)){
        this.stats[o.team].crossesOk++; this.stats[o.team].shots++; this.beat=.5;
        const pGoal=clamp(.105*(1+(facet(atk,'head_atk')-(gk?facet(gk,'gk'):40))/100*.9)*(setPiece?1.18:1),.025,.28);
        this.stats[o.team].xg+=pGoal;
        if(setPiece){this.stats[o.team].setPieceShots++;atk._setPieceShotUntil=this.t+1;}
        this._emit('header_shot',{by:atk,xg:pGoal,setPiece});
        if(chance(pGoal))this._goal(atk,false);
        else{
          const hr=R(),saveShare=.27+(gk?facet(gk,'gk')/100:.4)*.12;
          if(hr<saveShare){this.stats[o.team].onTarget++;if(gk){gk.rating+=.2;this.stats[1-o.team].saves++;}this._emit('save',{gk,big:false});if(chance(.38))this._setCorner(o.team);else this._goalKickOrRestart(1-o.team);}
          else if(hr<saveShare+.18){this._emit('blocked',{by:def});if(chance(.45))this._setCorner(o.team);else this._looseBall(atk.x,atk.y);}
          else{this._emit('miss',{by:atk});this._goalKickOrRestart(1-o.team);}
        }
      }else{if(def){def.rating+=.08;this._emit('header_clear',{by:def});this._turnover(def);}else this._goalKickOrRestart(1-o.team);}
    },atk,'launch');
  }

  _blocksPath(o, d, g) {
    // d está aproximadamente na linha o->g e à frente de o
    const ang1 = Math.atan2(g.y - o.y, g.x - o.x);
    const ang2 = Math.atan2(d.y - o.y, d.x - o.x);
    let da = Math.abs(ang1 - ang2); if (da > Math.PI) da = 2*Math.PI - da;
    const forward = ((d.x - o.x) * (g.x - o.x)) > 0;
    return forward && da < 0.5;
  }
  _inForwardCone(o, d, g, radius, len) {
    const dirx = Math.sign(g.x - o.x);
    const fx = (d.x - o.x) * dirx;
    return fx > 0 && fx < len && Math.abs(d.y - o.y) < radius;
  }

  // Há corredor aberto à frente do portador? (define contra-ataque legítimo)
  _openLaneAhead(o, g, dir) {
    const opps = this.teams[1 - o.team].players;
    // conta defensores à frente num cone largo até o gol
    let ahead = 0, mate = false;
    for (const d of opps) {
      if (d.red || d.isGK) continue;
      const dForward = dir > 0 ? d.x > o.x + 1 : d.x < o.x - 1;
      if (dForward && Math.abs(d.y - o.y) < 20 && D(d.x,d.y,o.x,o.y) < 38) ahead++;
    }
    // companheiro avançado livre pra receber em profundidade?
    for (const m of this.teams[o.team].players) {
      if (m === o || m.red || m.isGK) continue;
      const fwd = dir > 0 ? m.x > o.x + 8 : m.x < o.x - 8;
      if (fwd) { let mk=1e9; for(const d of opps){if(d.red)continue;const dd=D(m.x,m.y,d.x,d.y);if(dd<mk)mk=dd;} if(mk>6) mate=true; }
    }
    const prog = dir > 0 ? o.x : FL - o.x;
    // contra-ataque REAL: no máximo 1 defensor no caminho E alvo avançado livre
    return ahead <= 1 && mate && prog > FL * 0.25;
  }

  // Passe seguro para circulação: companheiro livre, sem risco, mesmo lateral/recuado.
  // Prioriza manter posse — a base da construção.
  _safePass(o, opps) {
    const tm = this.teams[o.team];
    const dir = tm.attackDir;
    let best = null, bestScore = -1e9;
    for (const m of tm.players) {
      if (m === o || m.red) continue;
      const dist = D(o.x, o.y, m.x, m.y);
      if (dist < 4 || dist > 40) continue;
      // liberdade do alvo
      let mk = 1e9; for (const d of opps){ if (d.red) continue; const dd = D(m.x,m.y,d.x,d.y); if (dd<mk) mk=dd; }
      if (mk < 4.5) continue;                          // precisa estar bem livre
      if (this._laneBlocked(o, m, opps)) continue;     // linha de passe limpa
      const prog = dir > 0 ? (m.x - o.x) : (o.x - m.x);
      // pontua: liberdade + leve preferência por manter/avançar sem arriscar
      // GK e zaga são opções válidas de recomposição (prog negativo não penaliza muito)
      const score = mk * 1.0 + clamp(prog, -6, 12) * 0.15 - dist * 0.03
        + (m.isGK ? -1.5 : 0);                          // GK só se for a única saída
      if (score > bestScore) { bestScore = score; best = { m, dist, intoBox: false, risk: 0.3, progressM: prog }; }
    }
    return best;
  }

  _laneBlocked(o, m, opps) {
    for (const d of opps) {
      if (d.isGK) continue;
      const vx = m.x - o.x, vy = m.y - o.y, len2 = (vx*vx + vy*vy) || 1;
      const t = clamp(((d.x - o.x) * vx + (d.y - o.y) * vy) / len2, 0, 1);
      const px = o.x + vx * t, py = o.y + vy * t;
      if (D(d.x, d.y, px, py) < 1.6) return true;
    }
    return false;
  }

  // chutão de zagueiro: alívio pra frente/lateral (função da posição)
  _clearBall(o) {
    const tm = this.teams[o.team];
    const dir = tm.attackDir;
    const tx = clamp(o.x + dir * (26 + R(0, 14)), 2, FL - 2);
    const ty = clamp(o.y + (R() < 0.5 ? -1 : 1) * (12 + R(0, 14)), 2, FW - 2);
    this._startTravel(o, { x: tx, y: ty }, 'pass', () => this._contestLoose());
    this.ball.passKind = 'launch';
    this._emit('header_clear', { by: o });
  }

  _bestPass(o) {
    const tm = this.teams[o.team];
    const g = tm.oppGoal;
    const dir = tm.attackDir;
    const mates = tm.players.filter(p => p !== o && !p.red && !p.isGK);
    const opps = this.teams[1 - o.team].players.filter(p => !p.red);
    const cands = [];
    const vis = getAttr(o, 'visao');
    for (const m of mates) {
      const dist = D(o.x, o.y, m.x, m.y);
      if (dist < 3.5 || dist > 62) continue;
      // PERCEPÇÃO (§3): opções distantes só existem para quem enxerga o jogo
      // Percepção previsível: visão define o alcance reconhecido; a incerteza fica
      // na execução do passe, não no desaparecimento aleatório de uma mesma opção.
      if (dist > 30 && vis < clamp(54 + (dist - 30) * 1.15, 54, 90)) continue;
      const progressM = dir > 0 ? (m.x - o.x) : (o.x - m.x);
      const progN = progressM / FL;
      let mk = 1e9; for (const d of opps){ const dd = D(m.x,m.y,d.x,d.y); if (dd<mk) mk=dd; }
      const space = clamp(mk / 11, 0, 1);
      let risk = this._laneRisk(o, m, opps);
      // LARGURA da defesa adversária (fx.width): compacto ENTOPE o meio (passe central
      // mais arriscado); aberto cede o meio (mais fácil por dentro) mas fecha as alas.
      // Baseado na compactação real do adversário. Sem eixo → sem alteração.
      const oppW = this.teams[1 - o.team].fx.width;
      if (oppW != null) {
        const central = 1 - clamp(Math.abs(m.y - FW / 2) / (FW / 2), 0, 1);   // 1 = bem central
        risk += ((1 - oppW) - 0.5) * central * 1.7;   // compacto +risco central; aberto -risco central
      }
      const dtgM = D(m.x, m.y, g.x, g.y);
      const intoBox = dtgM < 22;
      const inThird = dir > 0 ? m.x > 68 : m.x < 37;
      // bônus de área ponderado pela LIBERDADE do alvo (espalha finalizações §variedade)
      const boxBonus = intoBox ? (1.3 + space * 1.1) : inThird ? 0.7 : 0;
      const circ = this._circulate || 0;
      const backPen = progressM < -4 ? (1.1 * (1 - Math.min(0.9, circ))) : 0;
      // variedade: evita devolver pra quem acabou de dar o passe (anti ping-pong)
      // tabela (§9): devolver pra quem ARRANCOU após o passe é um um-dois clássico
      const advanced = m === this.lastPasser && m._passX !== undefined &&
        ((dir > 0 && m.x - m._passX > 4) || (dir < 0 && m._passX - m.x > 4));
      const pingPen = (m === this.lastPasser) ? (advanced ? -0.8 : 0.8) : 0;
      const farPen = Math.max(0, dist - 22) * 0.058 * (1.5 - facet(o,'pass')/100);
      // fome de bola: quem não toca há tempo vira opção melhor
      const hunger = clamp((this.minute - (m.lastTouchMin || 0)) / 12, 0, 0.55);
      // tendências do passador (§5): lançador busca profundidade; organizador prefere segurança
      const Tp = TACT ? TACT.tendencies(o.ref) : {};
      const tendB = (Tp.lancador && progressM > 14 ? 0.6 : 0) + (Tp.organizador ? -Math.max(0, risk - 0.8) * 0.5 : 0)
        + (m._runDeep && space > 0.5 && progressM > 8 ? 0.9 : 0)   // premia a bola nas costas (§9 lançamento)
        + (m._breaking && progressM > 6 ? 2.4 : 0);   // RUPTURA: o corredor infiltrando é a bola de perigo
      // enviesado para PROGRESSÃO (risco contestado depois por interceptação/skill)
      const mood = tm.mood || { risk: 1 };
      const legendPull = (m.ref && m.ref.legend) ? 0.38 : 0;   // a bola gravita pro craque
      // RITMO/DIRETIVIDADE: direto pesa a progressão; paciente valoriza segurança.
      const dk = tm.fx.direct - 0.5;
      const progW = 2.7 * (1 + dk * 1.05);
      // CIRCULAÇÃO (§Fase2): na fase BUILD da máquina de posse, o puxão pra frente
      // é ATENUADO e a saída lateral/segura ganha valor — é o que faz a bola
      // circular e a jogada NASCER em vez de forçar sempre o vertical. Some quando
      // um gatilho rompe (aí progW volta cheio e o time verticaliza).
      const progWc = progW * (1 - Math.min(0.85, circ * 0.72));
      // CIRCULAÇÃO LATERAL (§fluidez): premia o passe horizontal, e MAIS ainda a
      // troca de flanco ampla (que muda o ponto de ataque). É o que tira a monotonia:
      // em vez de sempre tentar a vertical, o time roda a bola de um lado ao outro
      // procurando o espaço — como o futebol de posse de verdade.
      const crossAmp = Math.abs(m.y - o.y);   // quão lateral é o passe
      const lateralBonus = circ > 0
        ? ((1 - Math.abs(progN) * 5) * circ * 1.0 + Math.min(crossAmp, 30) / 30 * circ * 0.8)
        : 0;
      // INVERSÃO DE JOGO (§lendas): o maestro com VISÃO alta enxerga o flanco oposto
      // livre e troca o jogo numa diagonal longa (Pirlo/Xabi Alonso). Só nasce se:
      // a bola está num lado carregado, o alvo está no lado oposto com espaço, e o
      // passador tem visão pra executar. Assinatura que só os craques de leitura fazem.
      let switchBonus = 0;
      const ballSide = o.y < FW / 2 ? -1 : 1;      // lado do campo onde a bola está
      const mateSide = m.y < FW / 2 ? -1 : 1;
      const crossField = Math.abs(m.y - o.y);
      if (ballSide !== mateSide && crossField > 24 && vis >= 82 && space > 0.5) {
        // conta a lotação do lado da bola (rivais perto do portador)
        let congest = 0; for (const d of opps) { if (D(o.x, o.y, d.x, d.y) < 14) congest++; }
        if (congest >= 2) switchBonus = clamp((vis - 78) / 100, 0, 0.22) * (1 + congest * 0.25) * space * 3.2;
      }
      const spaceW = Math.max(0.22, 0.65 - dk * 0.5);
      const riskTol = Math.max(0.55, (1.85 - mood.risk * 0.65) - dk * 0.75);
      // INTELIGÊNCIA individual: jogador inteligente ENXERGA a melhor opção
      // (ruído de decisão cai com INT); o limitado erra a leitura mais vezes.
      const inte = getAttr(o, 'decisao');
      const noiseAmp = 0.9 * clamp(1.28 - inte / 100, 0.35, 1.0);
      // Oscilação pequena e determinística: preserva variedade sem permitir que o
      // acaso supere a leitura espacial. Jogadores inteligentes oscilam menos.
      const decisionNoise = Math.sin((this.simT || 0) * 1.73 + o.idx * 0.91 + m.idx * 1.37) * noiseAmp * 0.18;
      // DEVOLUÇÃO da tabela: quem arrancou pras costas é opção quente; e o lateral
      // em ultrapassagem livre na ponta é a saída clássica do jogo apoiado.
      const comboB = (m._burst && m._burst.kind === 'tabela' && progressM > 3 ? 1.9 : 0)
        + (m._overlapping && space > 0.4 && progressM > 3 ? 1.2 : 0);
      // #CONSTRUÇÃO INTELIGENTE: o passe que acha o HOMEM LIVRE numa posição de
      // PROGRESSÃO (rompe linha pra um companheiro em espaço, adiante) é a saída
      // inteligente — e vale MESMO durante a circulação (não é atenuado pela posse),
      // então o time PROCURA essa jogada em vez de reciclar no seguro.
      const smartPass = (space > 0.5 && progressM > 8) ? clamp((space - 0.4) * 2, 0, 1) * clamp(progN, 0, 1) * 0.6 : 0;
      // O papel coletivo só vira útil se o portador reconhece o movimento. O
      // terceiro homem ganha valor quando aparece à frente e livre; os apoios
      // lateral/atrás ganham valor principalmente durante construção/pressão.
      const paceEdge = this._paceEdge(m);
      const lineVuln = this._lineVulnerability(o.team);
      const offball = facet(m,'offball')/100;
      const throughThreat = clamp((Math.max(0,progressM-5)/24)*.42 + Math.max(0,paceEdge)*.34 + lineVuln*.32 + offball*.22 + (m._breaking?.25:0),0,1.35);
      const roleSynergy = this._roleSynergy(o,m);
      const roleBonus = m === tm._thirdMan && progressM > 4
        ? 0.72 * space
        : m === tm._supportSide ? 0.24 * Math.max(0.25, circ)
        : m === tm._supportBack && risk > 0.8 ? 0.30 : 0;
      const rid = m.role || '';
      const roleChoice = (/armador|construtor|falso/.test(rid) ? 0.18 * space * Math.max(.35, circ) : 0)
        + (/artilheiro|sombra|atacante/.test(rid) && progressM > 4 ? 0.24 * space : 0)
        + (rid === 'fc_alvo' && progressM > 0 ? 0.13 * clamp(getAttr(m,'fisico')/80, .65, 1.2) : 0);
      const score = progN * progWc * mood.risk + space * spaceW - risk * riskTol + boxBonus - backPen * (2 - mood.risk) - pingPen - farPen + hunger + tendB + legendPull + comboB + lateralBonus + switchBonus + smartPass + roleBonus + roleChoice
        + facet(o,'pass')/100 * 0.3 + decisionNoise + throughThreat * ADV4.through.maxDecisionBonus + roleSynergy;
      // DIMENSÃO TEMPORAL do campo: corredor em movimento tem valor SUBINDO —
      // projeta 0.65s à frente pela velocidade real e mede o ganho de espaço+progresso.
      let proj = score;
      if ((m._burst || m._overlapping || m._runDeep) && (m.vx*m.vx + m.vy*m.vy) > 3) {
        const mx2 = m.x + m.vx * 0.65, my2 = m.y + m.vy * 0.65;
        let mk2 = 1e9; for (const d of opps){ const dd = D(mx2,my2,d.x,d.y); if (dd<mk2) mk2=dd; }
        const space2 = clamp(mk2 / 11, 0, 1);
        const prog2 = ((dir > 0 ? mx2 - o.x : o.x - mx2)) / FL;
        proj = score + (prog2 - progN) * progW * mood.risk + (space2 - space) * spaceW * 1.6;
      }
      cands.push({ m, score, proj, dist, progressM, risk, intoBox, throughThreat, paceEdge, lineVuln, roleSynergy });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score);
    // A melhor leitura vence. Quando duas opções são praticamente equivalentes,
    // uma fase estável do agente permite preferência humana sem roleta global.
    let pick = cands[0];
    const decisionSkill = getAttr(o, 'decisao');
    const margin = 0.06 + (100 - decisionSkill) / 100 * 0.16;
    if (cands[1] && cands[0].score - cands[1].score < margin) {
      const phase = Math.sin((this.simT || 0) * 2.31 + o.idx * 1.77 + cands[1].m.idx * 0.53);
      if (phase > decisionSkill / 100 * 0.75) pick = cands[1];
    }
    // quanto a melhor opção DAQUI A UMA BATIDA supera a escolhida de AGORA
    if (pick) {
      let soon = 0, soonM = null;
      for (let k = 0; k < Math.min(6, cands.length); k++) {
        const g2 = cands[k].proj - pick.score;
        if (g2 > soon) { soon = g2; soonM = cands[k].m; }
      }
      pick.soonGain = soon; pick.soonM = soonM;
    }
    return pick;
  }

  // jogador em posição de cruzamento (largo e adiantado, perto da linha de fundo)
  _canCross(o) {
    const tm = this.teams[o.team];
    const dir = tm.attackDir;
    const adv = dir > 0 ? o.x : FL - o.x;
    const wideY = o.y < 20 || o.y > FW - 20;
    return adv > 78 && wideY;
  }
  _laneRisk(o, m, opps) {
    let risk = 0;
    for (const d of opps) {
      const t = this._projT(o.x,o.y,m.x,m.y,d.x,d.y);
      if (t < 0.05 || t > 0.98) continue;
      const px = lerp(o.x, m.x, t), py = lerp(o.y, m.y, t);
      const dd = D(px, py, d.x, d.y);
      if (dd < 6) risk += (6 - dd) / 6 * (1 + facet(d,'intercept')/120);
    }
    return risk;
  }
  _projT(ax,ay,bx,by,px,py){ const dx=bx-ax,dy=by-ay; const L=dx*dx+dy*dy||1; return ((px-ax)*dx+(py-ay)*dy)/L; }

  /* ------------------------------ AÇÕES -------------------------------- */
  _carry(o, g) {
    o._act = 'carry';
    const dir = Math.atan2(g.y - o.y, g.x - o.x);
    o._tx = o.x + Math.cos(dir) * 11;
    o._ty = o.y + Math.sin(dir) * 11;
  }
  // REPERTÓRIO DA LENDA (§lendas): escolhe o drible de ASSINATURA pelo perfil do
  // jogador — velocista arranca, driblador puro faz elástico/caneta, técnico o
  // drible da vaca. É o que dá identidade visual: o olho reconhece "aquele jogador".
  _pickMove(o) {
    const a = (o.ref && o.ref.a8) || [70,70,70,70,70,70,70,70];
    const dri = a[2], vel = a[3], tec = a[7];
    const moves = [];
    if (vel >= 88) moves.push('arrancada');
    if (dri >= 88 && tec >= 84) { moves.push('elástico'); moves.push('caneta'); }
    if (tec >= 88) moves.push('drible da vaca');
    if (dri >= 86) moves.push('meia-lua');
    if (!moves.length) moves.push('corta pra dentro');
    return moves[(R() * moves.length) | 0];
  }
  _dribble(o, d, g) {
    // duelo de drible (§5.2) — ponta no terço ofensivo tem confiança extra (função);
    // lenda "em chamas" fica quase imparável
    const tmO = this.teams[o.team];
    const wing1v1 = ((o.slotPos==='LW'||o.slotPos==='RW') &&
      (tmO.attackDir>0 ? o.x>FL*0.62 : o.x<FL*0.38)) ? 6 : 0;
    // REPERTÓRIO DA LENDA (§lendas): o driblador de elite (DRI/TEC alto ou trait
    // DRIBBLER) tem vantagem real no 1x1 — e executa dribles de ASSINATURA (elástico,
    // caneta, drible da vaca) que o mediano não tenta. Não é só número: é um repertório
    // que o olho reconhece como "aquele jogador".
    const driSkill = getAttr(o, 'drible');
    const tec = o.ref && o.ref.a8 ? o.ref.a8[7] : 65;
    const isDribbler = driSkill >= 86 || (o.ref && o.ref.traits && o.ref.traits.includes('DRIBBLER'));
    const legendEdge = isDribbler ? 6 + Math.max(0, driSkill - 86) * 0.6 : 0;
    const ctx=this._actionContext(o,D(o.x,o.y,d.x,d.y),'dribble');
    const pa = facet(o, 'drб_atk') * ctx.execution + wing1v1 + (o._onFire ? 7 : 0) + legendEdge;
    const pd = facet(d, 'drб_def') * this._actionContext(d,D(o.x,o.y,d.x,d.y),'defend').execution;
    const p = duelProb(pa + 4, pd);       // leve vantagem do atacante em 1x1
    o._act = 'dribble';
    this.stats[o.team].dribblesAttempted++;
    if (chance(p)) {
      this.stats[o.team].dribblesCompleted++;
      // supera: avança contornando o marcador
      const side = chance(0.5) ? 1 : -1;
      const dir = Math.atan2(g.y - o.y, g.x - o.x);
      o._tx = o.x + Math.cos(dir) * 7 - Math.sin(dir) * 3.5 * side;
      o._ty = o.y + Math.sin(dir) * 7 + Math.cos(dir) * 3.5 * side;
      o.rating += 0.12; d.rating -= 0.05;
      // drible de assinatura: craque com técnica alta humilha o marcador (evento especial)
      const flair = isDribbler && tec >= 84 && chance(0.35);
      this._emit('dribble', { by: o, ok: true, flair, move: flair ? this._pickMove(o) : null });
      if (flair) { o.rating += 0.06; d.rating -= 0.04; }
    } else {
      // marcador ganha o bote → possível falta se chegou atrasado
      if (chance(this._foulProb(d))) { this._awardFoul(d, o); }
      else {
        this.stats[d.team].tackles++;
        this._turnover(d); this._emit('tackle', { by: d, on: o }); d.rating += 0.12;
      }
    }
  }
  _pass(o, best) {
    const m = best.m;
    // conta os passes da fase de posse (a paciência que faz a bola circular)
    const _tm = this.teams[o.team];
    if (_tm._poss && _tm._poss.phase === 'build') _tm._poss.passes++;
    // TABELINHA (§realismo): quem toca em zona ofensiva, com QI+ritmo, ARRANCA
    // pras costas da marcação pedindo a devolução — a jogada emerge se o passador
    // devolver (bônus no _bestPass) e a defesa não acompanhar. Cooldown evita spam.
    const oProg = this.teams[o.team].attackDir > 0 ? o.x : FL - o.x;
    if (!o.isGK && !o._burstCd && oProg > FL * 0.45 && best.progressM > 1) {
      const inte = getAttr(o, 'decisao'), pace = getAttr(o, 'ritmo');
      if (chance(clamp((inte + pace) / 2 - 52, 0, 38) / 75)) {
        o._burst = { t: 3.0, kind: 'tabela' };
        o._burstCd = 11;
        this._emit('run_burst', { by: o, kind: 'tabela' });
      }
    }
    // interceptação na linha (duelo)
    const opps = this.teams[1 - o.team].players.filter(p => !p.red);
    let inter = null, ib = 0;
    for (const d of opps) {
      const t = this._projT(o.x,o.y,m.x,m.y,d.x,d.y);
      if (t < 0.1 || t > 0.9) continue;
      const px = lerp(o.x,m.x,t), py = lerp(o.y,m.y,t);
      const passLen = D(o.x,o.y,m.x,m.y);
      // raio de interceptação: estreito para passe curto (linha rasteira difícil de cortar),
      // largo só para passe longo/aéreo. Isso viabiliza a circulação de posse.
      const reach = clamp(2.4 + passLen * 0.045, 2.4, 3.9);
      if (D(px,py,d.x,d.y) < reach) {
        const tired = (100 - o.stamina) * 0.09;
        const farPen = Math.max(0, passLen - 24) * 0.10;   // passe longo é mais arriscado
        // vantagem do passador: passe é mais fácil de completar do que de cortar
        // estilo de posse dá leve segurança extra no passe curto (mantém a bola)
        const oSk = this.teams[o.team].styleKey || '';
        const styleGuard = oSk === 'tiki' ? 4 : oSk === 'press' ? 2 : 0;
        // SPREAD DE EXECUÇÃO (§Fase1, sobre a variância da 1-pré): completar a
      // circulação é a vantagem do time bom — pivô neutro, fraco erra o simples.
      const pI = duelProb(facet(d,'intercept'), facet(o,'pass') * 1.52 - 24 + styleGuard - tired - farPen);
        if (pI > ib) { ib = pI; inter = { d, px, py }; }
      }
    }
    this.stats[o.team].passes++;
    const wasIntercepted = inter && chance(ib);
    if (wasIntercepted) {
      // interceptado
      this._startTravel(o, { x: inter.px, y: inter.py }, 'pass', () => {
        this.stats[inter.d.team].interceptions++;
        this._turnover(inter.d); this._emit('intercept', { by: inter.d }); inter.d.rating += 0.1;
      });
    } else {
      const kind = best.progressM > 13 && (best.m._runDeep || best.m._breaking || best.paceEdge > .28) && (best.lineVuln > .20 || best.intoBox) && best.risk < 3.2 ? 'through'
        : best.dist > 32 ? 'launch' : 'short';
      if (kind === 'through') this.stats[o.team].throughBalls++;
      o._passX = o.x;   // memoriza onde estava ao passar (detecção de tabela §9)
      // ═══ IMPEDIMENTO (§Fase3) ═══════════════════════════════════════════════
      // No MOMENTO do passe, se o receptor está além do penúltimo defensor e à
      // frente da bola, é impedimento. A geometria já produz ~2.3 situações/jogo
      // (medido) — só faltava marcar. Só passes pra frente contam; margem de 0.7m
      // e uma pequena chance de não-marcado simulam a arbitragem real (linha justa).
      {
        const dir = _tm.attackDir;
        const rxRcv = dir > 0 ? m.x : FL - m.x;
        const rxBall = dir > 0 ? o.x : FL - o.x;
        if (rxRcv > rxBall + 2) {
          const opps = this.teams[1 - o.team].players.filter(p => !p.red);
          const xs = opps.map(d => dir > 0 ? d.x : FL - d.x).sort((a, b) => b - a);
          const offLine = xs[1] != null ? xs[1] : xs[0];
          const defendersIQ = opps.slice().sort((a,b)=>(dir>0?b.x-a.x:a.x-b.x)).slice(0,4);
          const lineIQ = defendersIQ.length ? defendersIQ.reduce((s,d)=>s+facet(d,'concentration'),0)/defendersIQ.length : 65;
          const timing = facet(m,'offball');
          const highLine = best.lineVuln || 0;
          const callP = clamp(.92 + lineIQ/700 - timing/850 - highLine*.16 - Math.max(0,best.paceEdge||0)*.08,.56,.95);
          if (rxRcv > offLine + 1.2 && chance(callP)) {
            this._emit('offside', { by: m, on: o });
            this.stats[o.team].offsides = (this.stats[o.team].offsides || 0) + 1;
            // impedimento: posse passa pro adversário (tiro livre indireto, simplificado)
            const gk = this.teams[1 - o.team].players.find(p => p.isGK && !p.red);
            this._startTravel(o, { x: m.x, y: m.y }, 'pass', () => {
              this._turnover(gk || opps[0]); m._runDeep = false;
            }, null, kind);
            return;
          }
        }
      }
      // ════════════════════════════════════════════════════════════════════════
      // PASSE INTELIGENTE (relatório §9): mira o espaço à frente de quem corre
      const spdK = kind === 'launch' ? 24 : kind === 'through' ? 20 : 17;
      const tv = best.dist / spdK;
      const mv = Math.hypot(m.vx, m.vy);
      const lead = mv > 1.2 ? Math.min(10, mv * tv) : 0;
      const lx = clamp(m.x + (mv > 0 ? m.vx / mv : 0) * lead, 2, FL - 2);
      const ly = clamp(m.y + (mv > 0 ? m.vy / mv : 0) * lead, 2, FW - 2);
      // Erro de execução é separado da escolha do passe. Distância, pressão e
      // dificuldade aumentam o erro; PAS/INT altos o reduzem. Antes, todo passe
      // não interceptado era contabilizado como certo, mesmo com alvo visual ruim.
      let nearest = 99;
      for (const d of opps) nearest = Math.min(nearest, D(o.x, o.y, d.x, d.y));
      const passSkill = (o.isGK ? facet(o,'distribution') : facet(o,'pass')) / 100;
      const longFactor = clamp((best.dist - 18) / 30, 0, 1);
      const pressureFactor = clamp((4.2 - nearest) / 4.2, 0, 1);
      const difficulty = clamp((best.risk || 0) / 4, 0, 1);
      const executionError = clamp(
        CAL.passing.baseError
        + (1 - passSkill) * 0.16
        + pressureFactor * CAL.passing.pressureError
        + longFactor * CAL.passing.longPassError
        + (kind === 'through' ? CAL.passing.throughBallError + 0.055 - clamp((best.throughThreat||0)*.012,0,.012) : 0)
        + difficulty * 0.04,
        0.01, CAL.passing.maxError
      );
      if (chance(executionError)) {
        const missSide = chance(0.5) ? -1 : 1;
        const miss = 2.8 + best.dist * 0.09 + (1 - passSkill) * 4;
        const badTarget = { x: clamp(lx + R(-1.5, 1.5), 0.5, FL - 0.5), y: clamp(ly + missSide * miss, 0.5, FW - 0.5) };
        this._emit('bad_pass', { by: o, to: m, kind });
        this._startTravel(o, badTarget, 'pass', () => this._looseBall(badTarget.x, badTarget.y), null, kind);
        return;
      }
      this._startTravel(o, { x: lx, y: ly }, 'pass', () => {
        if (kind === 'through') {
          const defenders = this.teams[1-o.team].players.filter(p=>!p.red&&!p.isGK)
            .sort((a,b)=>D(a.x,a.y,m.x,m.y)-D(b.x,b.y,m.x,m.y));
          const cover = defenders[0];
          const gk2 = this.teams[1-o.team].players.find(p=>p.isGK&&!p.red);
          const attackRun = facet(m,'offball')*.48 + ((getAttr(m,'ritmo')+getAttr(m,'aceleracao'))/2)*.34 + getAttr(m,'agilidade')*.18;
          const coverRun = cover ? facet(cover,'def_position')*.52 + ((getAttr(cover,'ritmo')+getAttr(cover,'aceleracao'))/2)*.30 + getAttr(cover,'agilidade')*.18 : 42;
          const separation = cover ? D(cover.x,cover.y,m.x,m.y) : 12;
          const runWin = clamp(duelProb(attackRun + clamp(separation-3,0,8)*1.4 + Math.max(0,best.paceEdge||0)*7, coverRun + 3), .22, .78);
          const gkDanger = gk2 ? D(m.x,m.y,this.teams[1-o.team].goal.x,this.teams[1-o.team].goal.y) : 99;
          const sweeper = gk2 && gkDanger < 23 && (gk2.oopRole === 'sweeper' || facet(gk2,'gk_one_on_one') > 78);
          const sweepP = sweeper ? clamp(.13 + (23-gkDanger)/45 + (facet(gk2,'gk_one_on_one')-65)/190, .08, .46) : 0;
          const swept = chance(sweepP);
          if (!chance(runWin) || swept) {
            const winner = swept && gk2 ? gk2 : (cover || gk2);
            if (winner) {
              this.stats[winner.team].interceptions++;
              if (winner.isGK) { this.stats[winner.team].gkSweeps++; this._emit('gk_sweep',{gk:winner,by:m}); }
              else this._emit('intercept',{by:winner,through:true});
              this._turnover(winner); winner.rating += .08;
            } else this._contestLoose();
            return;
          }
          this.stats[o.team].throughOk++;
          m._throughReceiverUntil = this.t + 3.2;
        }
        this.stats[o.team].passOk++;
        if (best.progressM < -2) m._backwardReceiveUntil = this.t + 1.6;
        if (best.intoBox) this.stats[o.team].keyPasses++;
        const linkKey = o.idx + '>' + m.idx;
        this.stats[o.team].passingMap[linkKey] = (this.stats[o.team].passingMap[linkKey] || 0) + 1;
        if (o.passLinks) o.passLinks[m.idx] = (o.passLinks[m.idx] || 0) + 1;
        o.rating += 0.02;
        this._emit('pass', { by: o, to: m, kind });
        if (m._runDeep && (this.teams[o.team].attackDir>0 ? (m.x-o.x) : (o.x-m.x)) > 12) this._emit('through', { by: o, to: m });
        this._receive(m);
      }, m, kind);
    }
  }
  _shoot(o, dtg, longshot, volley) {
    const tm=this.teams[o.team], g=tm.oppGoal;
    const fire=o._onFire?1.18:1;
    const gk=this.teams[1-o.team].players.find(p=>p.isGK&&!p.red);
    const nearest=this._nearestOpponent(o);
    const oneOnOne=dtg<19 && (nearest.dist>5.4 || (o._throughReceiverUntil||0)>this.t);
    this.stats[o.team].shots++;
    if(oneOnOne)this.stats[o.team].oneOnOnes++;
    if(o.y<FW/2)this.stats[o.team].attacksL++;else this.stats[o.team].attacksR++;
    this._bumpMom(o.team,.08); o._act='shoot';
    const atk=facet(o,oneOnOne?'one_on_one':(longshot?'shot_far':'shot'));
    const gkF=gk?facet(gk,oneOnOne?'gk_one_on_one':'gk'):40;
    let base=distanceXg(dtg); if(volley)base*=.86; if(oneOnOne)base=Math.max(base,.27); base*=fire;
    const angMul=clamp(1-Math.abs(o.y-g.y)/42,.32,1);
    const ctx=this._actionContext(o,nearest.dist,'shot');
    const skill=(atk-gkF)/100;
    let pGoal=base*CAL.shooting.conversionScale*angMul*(1+skill*CAL.shooting.skillInfluence)*ctx.execution;
    if(oneOnOne)pGoal*=1.04+getAttr(o,'compostura')/100*.12;
    if(longshot && getAttr(o,'chute_longe')>=86 && (o.ref.a8?o.ref.a8[7]:75)>=82)pGoal*=1.08;
    if(this.minute>80 && o.ref.traits.indexOf('CLUTCH_PLAYER')!==-1)pGoal*=1.15;
    // Calibração FM-like: 1x1 mantém valor alto; chutes comuns e de longe
    // têm conversão mais contida, evitando placares inflados sem reduzir volume.
    pGoal *= oneOnOne ? .84 : longshot ? .70 : .76;
    pGoal=clamp(pGoal,CAL.shooting.minGoalChance,oneOnOne?.72:CAL.shooting.maxGoalChance);
    const xg=pGoal; this.stats[o.team].xg+=xg;
    if((o._setPieceShotUntil||0)>this.t)this.stats[o.team].setPieceShots++;
    this._emit('shot_taken',{by:o,xg,baseXg:clamp(base*angMul,.003,.75),pGoal,longshot:!!longshot,dtg,volley,oneOnOne});
    this.momentum=clamp(this.momentum+(o.team===0?.5:-.5),-1,1);this.beat=.5;
    const shotQuality=clamp(atk/100,.3,1),dispersion=R(-4.8,4.8)*(1.15-shotQuality*.62);
    if(chance(pGoal)){
      const goalY=clamp(g.y+R(-3.15,3.15)*(1.15-shotQuality*.45),g.y-3.35,g.y+3.35);
      this._startTravel(o,{x:g.x+tm.attackDir*.9,y:goalY},'shot',()=>this._goal(o,longshot||facet(o,'shot')>90),null,'shot');
    }else{
      const gkQual=gk?facet(gk,oneOnOne?'gk_one_on_one':'gk')/100:.4;
      const r2=R();
      const saveCut=CAL.shooting.savedShare+gkQual*CAL.shooting.keeperSaveInfluence+(oneOnOne?.04:0);
      const blockCut=saveCut+CAL.shooting.blockedShare*(oneOnOne?.55:1);
      const postCut=blockCut+CAL.shooting.postShare;
      if(r2<saveCut){
        const saveTarget={x:g.x-tm.attackDir*1.25,y:clamp(g.y+dispersion,g.y-3.35,g.y+3.35)};
        this.stats[o.team].onTarget++;
        this._startTravel(o,saveTarget,'shot',()=>{this.stats[1-o.team].saves++;if(gk)gk.rating+=(atk>82?.35:.18);this._emit('save',{gk,big:atk>82||oneOnOne});if(chance(.5))this._setCorner(o.team);else this._turnover(gk);},null,'shot');
      }else if(r2<blockCut){
        const defenders=this.teams[1-o.team].players.filter(p=>!p.red&&!p.isGK);let blocker=null,bestLine=99;
        for(const d of defenders){const t=clamp(this._projT(o.x,o.y,g.x,g.y,d.x,d.y),0,1);if(t<.12||t>.88)continue;const px=lerp(o.x,g.x,t),py=lerp(o.y,g.y,t),ld=D(d.x,d.y,px,py);if(ld<bestLine){bestLine=ld;blocker=d;}}
        const blockTarget=blocker&&bestLine<7?{x:blocker.x,y:blocker.y}:{x:lerp(o.x,g.x,.55),y:lerp(o.y,g.y,.55)+R(-1.5,1.5)};
        this._startTravel(o,blockTarget,'shot',()=>{this._emit('blocked',{by:blocker});if(chance(.38))this._setCorner(o.team);else this._looseBall(blockTarget.x,blockTarget.y);},null,'shot');
      }else if(r2<postCut){
        this._startTravel(o,{x:g.x,y:g.y+(chance(.5)?1:-1)*3.66},'shot',()=>{this._emit('post',{by:o});if(chance(.45))this._setCorner(o.team);else this._looseBall(g.x,g.y);},null,'shot');
      }else{
        const missY=g.y+(chance(.5)?1:-1)*R(5.2,11.5);
        this._startTravel(o,{x:g.x+tm.attackDir*3,y:missY},'shot',()=>{this._emit('miss',{by:o});this._goalKickOrRestart(1-o.team);},null,'shot');o.rating-=.08;
      }
    }
    o._throughReceiverUntil=0;
  }

  _goal(o, golaco) {
    this.score[o.team]++;
    this.stats[o.team].goals++;
    this.stats[o.team].onTarget++;
    if ((o._setPieceShotUntil||0) > this.t) { this.stats[o.team].setPieceGoals++; o._setPieceShotUntil = 0; }
    o.rating += 1.0;
    // assistência: quem deu o último passe (aproxima via lastTouch anterior)
    this.beat = 0.9;
    this.momentum = o.team === 0 ? 1 : -1;
    this._emit('goal', { by: o, golaco, minute: Math.floor(this.minute), score: [...this.score] });
    // reinício com comemoração
    this.dead = 1.2;
    this.pendingRestart = () => this._kickoff(o.team === 0 ? 1 : 0, false);
    this.ball.owner = null; this.ball.traveling = false;
  }

  /* --------------------------- BOLA / VIAGEM --------------------------- */
  _startTravel(o, target, kind, onArrive, receiver, passKind) {
    const b = this.ball;
    b.owner = null; b.traveling = true; b.travelT = 0;
    b.target = { x: target.x, y: target.y };
    b.from = { x: o.x, y: o.y };
    b.kind = kind; b.passKind = passKind || kind;
    b.onArrive = onArrive; b.receiver = receiver || null;
    b.lastTouch = o;
    o.lastPassTo = receiver || null;
    const dist = D(o.x, o.y, target.x, target.y);
    // VELOCIDADE DA BOLA (§pedido): passe rasteiro mais veloz — a zaga nem sempre chega.
    // Passe forte de bom passador viaja mais rápido; cruzamento/lançamento é aéreo.
    const passPow = 0.85 + facet(o,'pass')/100 * 0.35;   // 0.85..1.2 conforme qualidade
    const spd = kind === 'shot' ? clamp(34 + facet(o,'shot')/100*16, 32, 54)  // chutes mais rápidos
              : passKind === 'launch' ? 26
              : passKind === 'through' ? 26 * passPow
              : 23 * passPow;   // curto rasteiro: bem mais rápido que antes (era 17)
    b.speed = spd;
    const ang = Math.atan2(target.y - o.y, target.x - o.x);
    // Imprecião no ângulo: só para passes (chutes já têm dispersão no alvo)
    const angErr = kind === 'shot' ? 0 : Math.pow(1 - facet(o,'pass')/100, 1.5) * 0.05 * (R()-0.5) * 2;
    const fang = ang + angErr;
    b.vx = Math.cos(fang) * spd; b.vy = Math.sin(fang) * spd;
    // ARCO baixo no passe rasteiro (bola no pé, não lob) — só lançamento sobe de verdade
    b.z = passKind === 'launch' ? 0.3 : 0.12;
    b.vz = (kind === 'shot') ? 1.0 : (passKind === 'launch' ? 7 : passKind === 'through' ? 1.2 : 0.4);
    b._timeout = dist / spd + 0.35;    // timeout de segurança generoso para chutes longos
  }

  _ballTravel(dt) {
    const b = this.ball;
    b.travelT += dt;
    // física da bola com arco + atrito
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.z += b.vz * dt; b.vz -= 20 * dt;                 // gravidade
    if (b.z < 0) { b.z = 0; b.vz = -b.vz * 0.4; }      // quica
    const fr = b.passKind === 'launch' ? 0.14 : 0.05;   // rasteiro perde pouca velocidade
    b.vx *= (1 - fr * dt); b.vy *= (1 - fr * dt);
    // Detecção de chegada robusta: raio maior para chutes (evita bola 'passar' pelo gol sem acionar)
    const arrivalRadius = (b.kind === 'shot') ? 3.5 : 1.6;
    const reached = D(b.x, b.y, b.target.x, b.target.y) < arrivalRadius;
    const passed = ((b.target.x - b.from.x) * b.vx + (b.target.y - b.from.y) * b.vy) < 0;
    const timeout = b.travelT > (b._timeout || 2.2);
    // Fora de campo: para passes, chama _ballOut normalmente.
    // Para chutes que cruzaram a linha lateral (y fora), trata como miss (não como lateral).
    // Para chutes que cruzaram a linha de fundo (x fora), o callback já foi definido pelo resultado.
    if (b.y < 0 || b.y > FW || b.x < 0 || b.x > FL) {
      if (b.kind !== 'shot') { this._ballOut(); return; }
      // Chute saiu pelo lado: aciona o callback imediatamente (miss ou gol já decidido)
      b.traveling = false;
      const cb = b.onArrive; b.onArrive = null;
      if (cb) cb();
      return;
    }
    if (reached || passed || timeout) {
      // Para chutes: se a bola chegou perto o suficiente do gol (dentro da área de gol),
      // garante que o callback seja chamado mesmo se passou levemente pelo alvo
      b.traveling = false;
      const cb = b.onArrive; b.onArrive = null;
      if (cb) cb();
    }
  }

  _ballGlue() {
    const b = this.ball, o = b.owner;
    if (!o) return;
    // bola colada ao pé do portador na direção do gol (offset reduzido para ficar visualmente no pé)
    const g = this.teams[o.team].oppGoal;
    const ang = Math.atan2(g.y - o.y, g.x - o.x);
    b.x = o.x + Math.cos(ang) * 0.55; b.y = o.y + Math.sin(ang) * 0.55;
    b.z = 0; b.vx = o.vx; b.vy = o.vy;
  }

  _looseBall(x, y) {
    const b = this.ball; b.owner = null; b.traveling = false;
    b.x = x; b.y = y; b.z = 0; b.vx = 0; b.vy = 0;
    // jogador mais próximo assume após breve disputa
    this._contestLoose();
  }
  _contestLoose() {
    const b = this.ball; let cands = [];
    for (const tm of this.teams) for (const p of tm.players) {
      if (p.red) continue; const dd = D(p.x,p.y,b.x,b.y);
      cands.push({ p, dd });
    }
    cands.sort((a,c)=>a.dd-c.dd);
    if (!cands.length) return;
    // entre quem está no raio de disputa, habilidade (reação/controle) decide
    const zone = cands.filter(c => c.dd < cands[0].dd + 2.2).slice(0, 3);
    let best = zone[0];
    for (const c of zone) {
      const sc = facet(c.p,'control') * 0.6 + getAttr(c.p,'aceleracao') * 0.4 - c.dd * 6;
      const sb = facet(best.p,'control') * 0.6 + getAttr(best.p,'aceleracao') * 0.4 - best.dd * 6;
      if (sc > sb) best = c;
    }
    if (best) { this._giveBall(best.p); best.p.settle = 0.85; }
  }

  // bola solta rolando: física + disputa pelo mais próximo (evita bola-parada §bug1)
  _looseRoll(dt) {
    const b = this.ball;
    b.x += (b.vx || 0) * dt; b.y += (b.vy || 0) * dt;
    b.vx = (b.vx || 0) * (1 - 1.6 * dt); b.vy = (b.vy || 0) * (1 - 1.6 * dt);
    if (b.z > 0 || (b.vz || 0) !== 0) { b.z += (b.vz || 0) * dt; b.vz = (b.vz || 0) - 20 * dt; if (b.z <= 0) { b.z = 0; b.vz = 0; } }
    // fora de campo
    if (b.x < -0.5 || b.x > FL + 0.5 || b.y < -0.5 || b.y > FW + 0.5) { this._ballOut(); return; }
    // jogador mais próximo coleta ao alcançar
    let best = null, bd = 1e9;
    for (const tm of this.teams) for (const p of tm.players) { if (p.red) continue; const d = D(p.x,p.y,b.x,b.y); if (d < bd) { bd = d; best = p; } }
    b._looseT = (b._looseT || 0) + dt;
    if (best && bd < 1.7 && b._looseT > 0.26) this._contestLoose();
  }

  /* ----------------------- POSSE / TROCAS (§5.5) ---------------------- */
  _receive(m) {
    if(!m||m.red){this._contestLoose();return;}
    const near=this._nearestOpponent(m);
    const ctx=this._actionContext(m,near.dist,'control');
    const control=facet(m,'control')/100;
    const poorP=clamp(.025+(1-control)*.19+ctx.pressure*.12+ctx.fatigue*.08+ctx.importance*(1-control)*.22,.015,.32);
    if(chance(poorP)){
      m._poorTouchUntil=this.t+1.25;
      this._emit('looseControl',{by:m,pressured:ctx.pressure>.35});
      if(chance(clamp(.28+(1-control)*.38+ctx.pressure*.22,.18,.72))){this._looseBall(m.x+R(-2,2),m.y+R(-2,2));return;}
    }
    this._giveBall(m);
    m.settle=lerp(CAL.possession.firstTouchMax,CAL.possession.firstTouchMin,control)/ctx.execution;
    if(m._poorTouchUntil>this.t)m.settle=Math.max(m.settle,.38);
    const tmR=this.teams[m.team];
    if(tmR._poss&&tmR._poss.phase==='build'&&near.dist<5)m.settle=Math.min(m.settle,.10+(1-control)*.12);
  }
  _giveBall(p) {
    if(!p){this._contestLoose();return;}
    const prev=this.ball.owner;
    const oldPoss=this.poss;
    this.lastPasser=(prev&&prev.team===p.team&&prev!==p)?prev:null;
    p.lastTouchMin=this.minute;
    const switched=this.ball.owner?(this.ball.owner.team!==p.team):(this.poss!==p.team);
    if(switched||this.poss!==p.team)this.possT=0;
    if(switched&&(oldPoss===0||oldPoss===1)){
      this.teams[oldPoss]._counterPressUntil=this.t+ADV4.pressing.counterPressWindow;
      this.teams[p.team]._transitionWonAt=this.t;
    }
    this.ball.owner=p;this.ball.traveling=false;this.ball.lastTouch=p;this.ball._looseT=0;
    this.poss=p.team;this.stats[p.team].poss++;
    if(switched)p.settle=Math.max(p.settle,CAL.possession.transitionProtection);
    this.decideT=Math.min(this.decideT,.10);
  }
  _turnover(d) {
    if(!d){this._contestLoose();return;}
    const wonAgainst=this.poss;
    const heldFor=this.possT||0;
    const previousOwner=this.ball.owner;
    this._giveBall(d);
    d.settle=Math.max(d.settle,lerp(.34,.16,facet(d,'control')/100));
    // Recuperações por pressão são contabilizadas no duelo ativo de pressão,
    // não em qualquer troca de posse. Isso evita dupla contagem com desarmes comuns.
  }

  _pressAndTackle(dt) {
    const o=this.ball.owner;if(!o)return;
    const defTm=this.teams[1-o.team];
    const trigger=this._pressTriggerScore(o,defTm.side);
    if(o.settle>0 && trigger<.34)return;
    const near=this._selectPresser(defTm,this.ball);
    if(!near)return;
    const nd=D(o.x,o.y,near.x,near.y),distToOwnGoal=D(o.x,o.y,defTm.goal.x,defTm.goal.y);
    const line=C.LINE_OF[near.slotPos],pw=({FWD:1.35,MID:1,DEF:.45})[line]||1;
    const work=facet(near,'press')/100,stamina=near.stamina/100;
    const reach=(defTm.fx.pressReach||0)*pw+trigger*ADV4.pressing.triggerRadiusBoost*work;
    const pressRadius=(distToOwnGoal<30?3:distToOwnGoal<55?2.6:2.25)+reach;
    if(nd<pressRadius && (!near._tackleCd||near._tackleCd<=0)){
      near._tackleCd=CAL.timing.tackleCooldown*lerp(1.18,.78,work);
      const atkCtx=this._actionContext(o,nd,'carry'),defCtx=this._actionContext(near,nd,'press');
      const poor=(o._poorTouchUntil||0)>this.t?8:0;
      const p=duelProb(facet(near,'tackle')*defCtx.execution+facet(near,'press')*.12+poor,facet(o,'carry')*atkCtx.execution+6);
      const defBox=(defTm.attackDir>0?near.x<16.5:near.x>FL-16.5)&&Math.abs(near.y-FW/2)<20;
      near._inBoxDuel=defBox;
      const baseRate=distToOwnGoal<30?CAL.defending.tackleAttemptRate*1.20:distToOwnGoal<55?CAL.defending.tackleAttemptRate:CAL.defending.tackleAttemptRate*.72;
      const energy=clamp(.45+stamina*.65,.45,1.08);
      const triggerRate=1+trigger*.72;
      if(chance(p*dt*(defBox?CAL.defending.boxAttemptRate:baseRate)*defTm.fx.tackle*defTm.mood.tackle*energy*triggerRate)){
        if(chance(this._foulProb(near)))this._awardFoul(near,o);
        else{this.stats[near.team].tackles++;if(trigger>.42 && this.possT<=ADV4.pressing.counterPressWindow)this.stats[near.team].pressWins++;this._turnover(near);this._emit('tackle',{by:near,on:o,pressing:trigger>.28});near.rating+=.1;}
      }
    }
    for(const d of defTm.players)if(d._tackleCd>0)d._tackleCd-=dt;
  }

  /* ------------------------------ FALTAS ------------------------------ */
  _foulProb(d){
    const base = CAL.defending.foulBase + (1 - getAttr(d,'compostura')/100) * CAL.defending.foulComposure;
    // cautela dentro da própria área (pênalti deve ser raro)
    const ownBox = (this.teams[d.team].attackDir > 0 ? d.x < 16.5 : d.x > FL - 16.5) && Math.abs(d.y - FW/2) < 20;
    return ownBox ? base * 0.16 : base;
  }
  _awardFoul(fouler, victim) {
    this.stats[fouler.team].fouls++;
    this._emit('foul', { by: fouler, on: victim });
    // cartão?
    const hard = chance(fouler.yellow >= 1 ? CAL.defending.yellowSecond : CAL.defending.yellowFirst);
    if (hard) {
      fouler.yellow++; this.stats[fouler.team].yellow++;
      if (fouler.yellow >= 2) {
        fouler.red = true; this.stats[fouler.team].red++; this._emit('red', { p: fouler, second: true });
        if (this.ball.owner === fouler) { this.ball.owner = null; this.ball.traveling = false; this._goalKickOrRestart(1 - fouler.team); }
      } else this._emit('yellow', { p: fouler });
    } else if (chance(CAL.defending.straightRed)) {
      fouler.red = true; this.stats[fouler.team].red++; this._emit('red', { p: fouler, second: false });
      if (this.ball.owner === fouler) { this.ball.owner = null; this.ball.traveling = false; this._goalKickOrRestart(1 - fouler.team); }
    }
    // LESÃO (§item6): falta é o gatilho natural; mais provável se foi dura (cartão).
    // Resistência do jogado atenua. Marca o jogador e força troca se houver banco.
    if (!victim.isGK && !victim._injured) {
      const resist = (victim.a8 || (victim.ref && victim.ref.a8)) ? ((victim.ref?victim.ref.a8:victim.a8)[6]) : 65;   // físico
      const pInj = (hard ? 0.05 : 0.012) * clamp(1.3 - resist / 100, 0.5, 1.15);
      if (chance(pInj)) this._injure(victim);
    }
    const vg = this.teams[victim.team].oppGoal;
    const dtg = D(victim.x, victim.y, vg.x, vg.y);
    // pênalti?
    const inBox = (this.teams[victim.team].attackDir > 0 ? victim.x > FL - 16.5 : victim.x < 16.5) && Math.abs(victim.y - FW/2) < 20;
    if (inBox) { this._penalty(victim.team); return; }
    // falta perigosa → cobrança direta
    if (dtg < 28 && chance(0.42)) { this._freeKick(victim.team, victim.x, victim.y); return; }
    // falta comum: reinício com posse
    this.dead = 0.82;
    this.pendingRestart = () => { this._giveBall(this._nearestFieldMate(victim)); this.ball.owner.settle = 0.6; };
  }
  _nearestFieldMate(p){
    const tm = this.teams[p.team]; return tm.players.filter(x=>!x.red&&!x.isGK).sort((a,b)=>D(a.x,a.y,p.x,p.y)-D(b.x,b.y,p.x,p.y))[0] || p;
  }

  _freeKick(team, x, y, input) {
    const tm = this.teams[team];
    const taker = tm.players.filter(p=>!p.red).sort((a,b)=> facet(b,'setpiece')-facet(a,'setpiece'))[0];
    const gk = this.teams[1-team].players.find(p=>p.isGK&&!p.red);
    const vg = tm.oppGoal;
    const dtg = D(x, y, vg.x, vg.y);
    if (input == null && this._requestSetPiece('freekick', { team, taker, gk, x, y, dist:dtg },
      chosen => this._freeKick(team, x, y, chosen))) return;
    this.stats[team].shots++;
    this.stats[team].setPieceShots++;
    this.beat = 0.5;
    const takerSkill = facet(taker,'setpiece');
    const keeperSkill = gk ? facet(gk,'gk') : 40;
    const resolved = C.resolveFreeKickPhysics(takerSkill, keeperSkill, dtg, input);
    const { result, pGoal, manual, visual } = resolved;
    this.stats[team].xg += pGoal;
    this._emit('freekick', { by: taker, manual });
    this._emit('fk_scene', { by: taker, gk, result, dist: dtg, defTeam: 1 - team, manual, visual });
    if (result === 'goal') { taker._setPieceShotUntil = this.t + 1; this._goal(taker, true); }
    else if (result === 'save') { if (gk) { gk.rating += 0.25; this.stats[1-team].saves++; } this.stats[team].onTarget++; if (chance(0.5)) this._setCorner(team); else this._goalKickOrRestart(1-team); }
    else if (result === 'wall') this._looseBall(x + this.teams[team].attackDir * 6, y + R(-6, 6));
    else this._goalKickOrRestart(1-team);
  }

  _penalty(team, input) {
    const tm = this.teams[team];
    const taker = tm.players.filter(p=>!p.red).sort((a,b)=> facet(b,'pen')-facet(a,'pen'))[0];
    const gk = this.teams[1-team].players.find(p=>p.isGK&&!p.red);
    if (input == null && this._requestSetPiece('penalty', { team, taker, gk },
      chosen => this._penalty(team, chosen))) return;
    this.stats[team].shots++;
    this.beat = 0.7;
    const takerSkill = facet(taker,'pen');
    const keeperSkill = gk ? facet(gk,'pen_gk') : 40;
    const manual = input && !input.assisted;
    const aimX = clamp(input && input.aimX != null ? input.aimX : .5 + R(-.38,.38), -.2,1.2);
    const aimY = clamp(input && input.aimY != null ? input.aimY : .52 + R(-.25,.2), -.2,1.2);
    const power = clamp(input && input.power != null ? input.power : R(.58,.88),0,1);
    const curve = clamp(input && input.curve != null ? input.curve : R(-.25,.25),-1,1);
    const pressure = clamp((input && input.pressure) || 0,0,1);
    const idealPower = .72;
    const powerQ = clamp(1-Math.abs(power-idealPower)*2.6,0,1);
    const composure = getAttr(taker,'compostura')/100;
    const execution = clamp(takerSkill/100*.47 + powerQ*.35 + composure*.18 - pressure*(1-composure)*.28,0,1);
    const err = manual ? lerp(.13,.018,execution) : lerp(.14,.035,takerSkill/100);
    const actualX = aimX + (R(-err,err)+R(-err,err))*.5 + curve*.012;
    const actualY = aimY + (R(-err,err)+R(-err,err))*.25 - (power-idealPower)*.58;
    const offTarget = actualX < .015 || actualX > .985 || actualY < .015 || actualY > 1.03;
    const corner = clamp(Math.hypot((actualX-.5)*1.65,(actualY-.52)*1.3),0,1);
    const pGoal = clamp(.65 + (takerSkill-keeperSkill)/100*.30 + execution*.16 + corner*.08 - pressure*(1-composure)*.13, .48,.94);
    this.stats[team].xg += pGoal;
    const result = offTarget ? 'miss' : chance(pGoal) ? 'goal' : 'save';
    const visual = { aimX, aimY, actualX, actualY, power, curve, execution };
    this._emit('penalty', { by: taker, manual, visual });
    if (result === 'goal') { this._goal(taker, false); return; }
    const saved = result === 'save';
    if (saved) {
      this.stats[team].onTarget++;
      if (gk) { gk.rating += 0.4; this.stats[1-team].saves++; }
    }
    this._emit('pen_miss', { by: taker, gk: saved ? gk : null, saved });
    this._goalKickOrRestart(1-team);
  }

  /* ---------------------------- ESCANTEIO ----------------------------- */
  _bumpMom(team, v) { if (!this.mom) this.mom = [0,0]; this.mom[team] = clamp(this.mom[team] + v, 0, 1); this.mom[1-team] = clamp(this.mom[1-team] - v*0.6, 0, 1); }
  _setCorner(team) {
    this._bumpMom(team, 0.10);
    this.stats[team].corners++;
    const tm = this.teams[team];
    const dir = tm.attackDir;
    const g = tm.oppGoal;
    const taker = tm.players.filter(p=>!p.red && !p.isGK).sort((a,b)=> getAttr(b,'cruzamento')-getAttr(a,'cruzamento'))[0];
    const headers = tm.players.filter(p=>!p.red && !p.isGK && p!==taker).sort((a,b)=> facet(b,'head_atk')-facet(a,'head_atk')).slice(0,3);
    const defs = this.teams[1-team].players.filter(p=>!p.isGK && !p.red).sort((a,b)=> facet(b,'head_def')-facet(a,'head_def')).slice(0,4);
    // CÂMERA PADRÃO: encena de verdade no campo — cobrador na bandeirinha,
    // atacantes e zagueiros brigando na área — e a bola voa com _cross orgânico
    // (duelo aéreo real, com resultado calculado quando a disputa acontece).
    const cy = chance(0.5) ? 1.5 : FW - 1.5;
    taker.x = clamp(g.x - dir*0.8, 1, FL-1); taker.y = cy; taker.settle = 1.2;
    headers.forEach((h,i)=>{ h.x = clamp(g.x - dir*(7 + i*2.6), 2, FL-2); h.y = clamp(FW/2 + (i-1)*5.5, 3, FW-3); });
    defs.forEach((d,i)=>{ d.x = clamp(g.x - dir*(5.5 + i*2.4), 2, FL-2); d.y = clamp(FW/2 + (i-1.5)*4.6, 3, FW-3); });
    // A bola já aparece na bandeirinha durante a preparação. Antes ela ficava
    // no lance anterior e teleportava somente quando _cross começava.
    this.ball.owner = null; this.ball.traveling = false;
    this.ball.x = taker.x; this.ball.y = taker.y; this.ball.z = 0;
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
    this.ball.target = null; this.ball.receiver = null;
    this._emit('corner', { team, by: taker, x: taker.x, y: taker.y });
    this.dead = 0.6;                                     // respiro pra ler a cena
    this.pendingRestart = () => { this._giveBall(taker); taker._setPieceDeliveryUntil = this.t + 2; this._cross(taker); };
  }

  /* --------------------------- FORA / REINÍCIO ------------------------ */
  _ballOut() {
    const b = this.ball; b.traveling = false; b.owner = null;
    // determina tipo pelo local
    const lastTeam = b.lastTouch ? b.lastTouch.team : this.poss;
    if (b.x <= 0 || b.x >= FL) {
      // linha de fundo: escanteio (se defesa tocou) ou tiro de meta
      // O lado de ataque muda no intervalo. Usar o índice fixo do time aqui
      // criava ciclos de centenas de escanteios depois da troca de campo.
      const lineX = b.x >= FL ? FL : 0;
      const attTeam = this.teams[0].oppGoal.x === lineX ? 0 : 1;
      if (lastTeam !== attTeam) { this.dead = 0.8; this.pendingRestart = () => this._setCorner(attTeam); }
      else { this.dead = 0.7; this.pendingRestart = () => this._goalKickOrRestart(1 - attTeam); }
    } else {
      // lateral: reposição para o time que não tocou por último
      this.dead = 0.65;
      const to = 1 - lastTeam;
      this.pendingRestart = () => {
        const y = clamp(b.y, 1, FW-1);
        const cand = this.teams[to].players.filter(p=>!p.red&&!p.isGK).sort((a,b2)=> Math.abs(a.y-y)-Math.abs(b2.y-y))[0];
        if (cand){ cand.x = clamp(b.x,1,FL-1); cand.y = y; this._giveBall(cand); cand.settle = 0.5; }
        else this._contestLoose();
      };
    }
  }
  _goalKickOrRestart(team) {
    this.dead = 0.2;
    this.pendingRestart = () => {
      const gk = this.teams[team].players.find(p=>p.isGK&&!p.red)
              || this.teams[team].players.filter(p=>!p.red)[0];
      if (gk){ this._giveBall(gk); gk.settle = 0.3; } else this._contestLoose();
    };
  }

  /* -------------------------- IA DO GOLEIRO ---------------------------
     O goleiro deixa de ocupar um ponto fixo a 4,5 m da linha e passa a ler a
     jogada. A decisão é espacial e determinística; somente o duelo técnico ao
     dominar um cruzamento usa probabilidade, confrontando atributos reais. */
  _goalkeeperTarget(tm,p,b,dt) {
    const goal=tm.goal;
    const reflex=getAttr(p,'reflexos'),pos=getAttr(p,'posicionamento'),sweep=getAttr(p,'saida_gol');
    const anticipation=getAttr(p,'antecipacao'),pace=getAttr(p,'ritmo');
    const isSweeper=(p.role==='gk_libero')||(p.ref&&p.ref.traits&&p.ref.traits.includes('SWEEPER_KEEPER'));
    const quality=clamp((pos+sweep+anticipation*.35)/235,.35,1.12);
    let depth=3.8+quality*1.8+(isSweeper?1.7:0);
    let ty=clamp(FW/2+(b.y-FW/2)*(.22+pos/290),18,FW-18);
    const attacker=b.owner&&b.owner.team!==tm.side?b.owner:null;
    if(attacker){
      const danger=D(attacker.x,attacker.y,goal.x,goal.y);
      if(danger<34){
        let cover=1e9;for(const d of tm.players){if(d===p||d.red)continue;cover=Math.min(cover,D(d.x,d.y,attacker.x,attacker.y));}
        const breakaway=cover>6;
        const narrow=clamp((34-danger)*.30+(breakaway?4.2:0),0,13);
        depth+=narrow*(.48+sweep/210+(isSweeper?.12:0));
        ty=clamp(lerp(FW/2,attacker.y,.44+pos/240),11,FW-11);
      }
    }else if(b.traveling&&b.target&&b.lastTouch&&b.lastTouch.team!==tm.side){
      const targetDanger=D(b.target.x,b.target.y,goal.x,goal.y);
      if(b.kind==='pass'&&targetDanger<25){
        const claimIntent=clamp((25-targetDanger)/17,0,1)*(.30+sweep/150+anticipation/400+(isSweeper?.15:0));
        const targetDepth=Math.abs(b.target.x-goal.x);
        depth=lerp(depth,clamp(targetDepth,5,isSweeper?20:15),claimIntent);
        ty=clamp(lerp(ty,b.target.y,.48+claimIntent*.38),8,FW-8);
      }
    }
    depth*=.92+pace/100*.10;
    const rawX=goal.x+tm.attackDir*depth;
    if(!p._gkAI)p._gkAI={x:rawX,y:ty,wait:0};
    p._gkAI.wait-=dt;
    if(p._gkAI.wait<=0){p._gkAI.x=rawX;p._gkAI.y=ty;p._gkAI.wait=lerp(.25,.065,(reflex*.45+anticipation*.55)/100);}
    return [p._gkAI.x,p._gkAI.y];
  }

  _goalkeeperClaim(tm, p, b, dt) {
    p._gkClaimCd = Math.max(0, (p._gkClaimCd || 0) - dt);
    if (p._gkClaimCd > 0 || !b.traveling || b.kind !== 'pass' || !b.target || !b.lastTouch) return false;
    if (b.lastTouch.team === tm.side || D(b.target.x, b.target.y, tm.goal.x, tm.goal.y) > 19) return false;

    const domain = getAttr(p, 'dominio_area');
    const exit = getAttr(p, 'saida_gol');
    const reflex = getAttr(p, 'reflexos');
    const radius = 1.25 + domain / 100 * 1.65;
    if (D(p.x, p.y, b.x, b.y) > radius || b.z > 2.7) return false;

    let rival = null, rd = 1e9;
    for (const a of this.teams[1 - tm.side].players) {
      if (a.red || a.isGK) continue;
      const d = D(a.x, a.y, b.x, b.y);
      if (d < rd) { rd = d; rival = a; }
    }
    const claimSkill = domain * 0.48 + exit * 0.34 + reflex * 0.18;
    const aerialThreat = rival && rd < 5.5 ? facet(rival, 'head_atk') : 42;
    const win = clamp(duelProb(claimSkill + 9, aerialThreat), 0.52, 0.96);
    p._gkClaimCd = 0.65;
    if (!chance(win)) {
      this._emit('gk_claim_miss', { gk: p, by: rival });
      return false;
    }

    b.onArrive = null; b.receiver = null; b.traveling = false;
    this._turnover(p);
    p.settle = Math.max(p.settle, 0.82);
    p.rating += 0.10;
    this.stats[tm.side].claims = (this.stats[tm.side].claims || 0) + 1;
    if (D(p.x,p.y,tm.goal.x,tm.goal.y) > 9 || b.passKind === 'through') { this.stats[tm.side].gkSweeps++; this._emit('gk_sweep',{gk:p,by:rival}); }
    this._emit('gk_claim', { gk: p, by: rival });
    return true;
  }

  /* --------------------- MOVIMENTO / FÍSICA (§5.6/5.8) ---------------- */
  _movePlayers(dt, freeze) {
    const b = this.ball;
    const ballTeam = this.poss;
    for (const tm of this.teams) {
      const attacking = (b.owner && b.owner.team === tm.side) || (this.ball.traveling && this.poss === tm.side);
      // Papéis coletivos são estáveis por uma pequena janela. Recalcular o
      // marcador mais próximo a cada quadro fazia dois jogadores alternarem a
      // perseguição e tremelicarem sem realmente fechar a jogada.
      let presser = null;
      if (!attacking) {
        presser = this._selectPresser(tm, b);
        // MARCAÇÃO REALISTA: apenas UM interceptador salta a linha de passe.
        // Antes, todos os defensores perto do corredor do passe convergiam para
        // o mesmo ponto — o "cardume" no meio-campo. Agora um só antecipa; os
        // demais seguram a zona/linha, como num bloco de verdade.
        this._selectInterceptor(tm, b, presser);
        this._defRoleT = this._defRoleT || [0, 0];
        this._defRoleT[tm.side] += dt;
        if (this._defRoleT[tm.side] > 0.42) {
          this._defRoleT[tm.side] = 0;
          this._assignDefRoles(tm, b, presser);
        }
      } else {
        this._atkRoleT = this._atkRoleT || [0, 0];
        this._atkRoleT[tm.side] += dt;
        if (this._atkRoleT[tm.side] > 0.38 || !tm._supportSide) {
          this._atkRoleT[tm.side] = 0;
          this._assignAttackRoles(tm, b);
        }
      }
      for (const p of tm.players) {
        if (p.red) continue;
        let tx, ty;
        if (p === b.owner) {
          // portador vai para onde a ação mandou
          tx = p._tx !== undefined ? p._tx : p.x; ty = p._ty !== undefined ? p._ty : p.y;
        } else if (p.isGK) {
          this._goalkeeperClaim(tm, p, b, dt);
          [tx, ty] = this._goalkeeperTarget(tm, p, b, dt);
        } else if (attacking) {
          [tx, ty] = this._attackTarget(tm, p, b);
        } else {
          [tx, ty] = this._defendTarget(tm, p, b, presser);
          // bloco desliza junto: todos (menos o presser) acompanham o lado da bola —
          // mas com FATOR INDIVIDUAL (§movimento): cada jogador desloca numa proporção
          // levemente diferente, então o bloco não é uma placa rígida.
          if (p !== presser) {
            if (p._slideF === undefined) p._slideF = 0.12 + R() * 0.14;   // 0.12–0.26 fixo por jogador
            ty = clamp(ty + (b.y - FW/2) * p._slideF, 1.5, FW - 1.5);
          }
        }
        // ── DESSINCRONIZAÇÃO DE REAÇÃO (§movimento): mata o "deslizar em bloco".
        // Cada jogador persegue um alvo SUAVIZADO com constante de tempo PRÓPRIA —
        // uns leem a jogada e ajustam rápido, outros com atraso. Assim o bloco se
        // reorganiza organicamente (não todos no mesmo frame, mesma direção, mesma
        // velocidade). O portador e quem tem dever de bola reagem na hora (sem lag).
        const ballDutyEarly = p === b.owner || p === presser || p === tm._cover ||
                              (b.traveling && b.receiver === p) || p._breaking || p._burst;
        if (!ballDutyEarly && !p.isGK) {
          if (p._smx === undefined) { p._smx = tx; p._smy = ty; p._react = p.react || 0.16; }
          // constante de tempo individual: react baixo = ajusta rápido, alto = devagar
          const a = clamp(dt / (p._react + dt), 0, 1);
          p._smx += (tx - p._smx) * a;
          p._smy += (ty - p._smy) * a;
          tx = p._smx; ty = p._smy;
        }
        // SEPARAÇÃO (relatório §5.1): ninguém divide o mesmo espaço.
        // Quem tem dever de bola (presser/cobertura/dono/receptor) fica fora.
        const ballDuty = p === presser || p === tm._cover || p === this.ball.owner ||
                         (this.ball.traveling && this.ball.receiver === p);
        if (!ballDuty) {
          let sepx = 0, sepy = 0;
          for (const q of tm.players) {                    // companheiros: raio 5.5m
            if (q === p || q.red) continue;
            const dd = D(p.x,p.y,q.x,q.y);
            if (dd < 5.5 && dd > 0.01) { sepx += (p.x-q.x)/dd * (5.5-dd); sepy += (p.y-q.y)/dd * (5.5-dd); }
          }
          const opp = this.teams[1 - tm.side];
          for (const q of opp.players) {                   // adversários: raio curto (marcação respira)
            if (q.red) continue;
            const dd = D(p.x,p.y,q.x,q.y);
            if (dd < 3.2 && dd > 0.01) { sepx += (p.x-q.x)/dd * (3.2-dd) * 0.9; sepy += (p.y-q.y)/dd * (3.2-dd) * 0.9; }
          }
          tx += sepx * 1.5; ty += sepy * 1.5;
        }
        tx = clamp(tx, 1, FL-1); ty = clamp(ty, 1, FW-1);
        this._integrate(p, tx, ty, dt, freeze);
      }
    }
    this._resolveOverlaps();
  }

  // Resolução física de sobreposição (relatório §5.1): pares travados a <1.7m
  // são empurrados diretamente — exceto quem disputa a bola de fato.
  _resolveOverlaps() {
    const b = this.ball;
    const all = [];
    for (const tm of this.teams) for (const p of tm.players) if (!p.red && !p.isGK) all.push(p);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const p = all[i], q = all[j];
        const dx = q.x - p.x, dy = q.y - p.y;
        const dd = Math.sqrt(dx*dx + dy*dy);
        if (dd >= 1.7 || dd < 0.001) continue;
        // disputa legítima: os dois a <3m da bola podem se encostar
        if (D(p.x,p.y,b.x,b.y) < 3 && D(q.x,q.y,b.x,b.y) < 3) continue;
        const push = (1.7 - dd) / 2;
        const nx = dx / dd, ny = dy / dd;
        p.x = clamp(p.x - nx * push, 1, FL - 1); p.y = clamp(p.y - ny * push, 1, FW - 1);
        q.x = clamp(q.x + nx * push, 1, FL - 1); q.y = clamp(q.y + ny * push, 1, FW - 1);
      }
    }
  }

  _selectPresser(tm, b) {
    const available=tm.players.filter(p=>!p.red&&!p.isGK);
    if(!available.length){tm._presser=null;return null;}
    const owner=b.owner&&b.owner.team!==tm.side?b.owner:null;
    const trigger=this._pressTriggerScore(owner,tm.side);
    let nearest=null,best=1e9;
    for(const p of available){
      const d=D(p.x,p.y,b.x,b.y);
      const press=facet(p,'press');
      const fatigue=(100-p.stamina)*.055;
      const role=p.oopRole||deriveOopRole(p.oopPos||p.slotPos,p.role,p.focus);
      const roleBonus=/press/.test(role)?-2.2:/screen/.test(role)?-.7:/hold/.test(role)?1.4:0;
      const line=C.LINE_OF[p.oopPos||p.slotPos];
      const zoneBonus=trigger>.35 && line==='FWD'?-1.2:0;
      const score=d-press*.035+fatigue+roleBonus+zoneBonus;
      if(score<best){best=score;nearest=p;}
    }
    const old=tm._presser;
    if(!old||old.red||old.isGK||!available.includes(old))tm._presser=nearest;
    else{
      const oldScore=D(old.x,old.y,b.x,b.y)-facet(old,'press')*.035+(100-old.stamina)*.055;
      // Histerese mais firme: o presser COMMITA. Trocar cedo demais fazia dois
      // jogadores alternarem a perseguição e tremerem lado a lado (feio, irreal).
      if(oldScore>16||best+2.6<oldScore)tm._presser=nearest;
    }
    return tm._presser;
  }

  /* MARCAÇÃO REALISTA · UM ÚNICO INTERCEPTADOR POR PASSE
     Enquanto a bola viaja num passe, escolhe o defensor MELHOR posicionado para
     saltar a linha (mais perto do corredor do passe, na janela útil do trajeto).
     Só ele antecipa em _defendTarget; o resto do time mantém zona e marcação.
     Sem isso, meia dúzia de jogadores caçava o mesmo passe — o "cardume". */
  _selectInterceptor(tm, b, presser) {
    if (!(b.traveling && b.kind === 'pass' && b.from && b.target)) { tm._interceptor = null; return; }
    const fx = b.from.x, fy = b.from.y, ldx = b.target.x - fx, ldy = b.target.y - fy;
    const len = ldx*ldx + ldy*ldy;
    if (len < 1) { tm._interceptor = null; return; }
    let best = null, bd = 4.6;
    for (const p of tm.players) {
      if (p.red || p.isGK || p === presser || p === tm._cover) continue;
      const tpr = ((p.x - fx) * ldx + (p.y - fy) * ldy) / len;
      if (tpr <= 0.2 || tpr >= 0.68) continue;
      const px = fx + ldx * tpr, py = fy + ldy * tpr, dd = D(p.x, p.y, px, py);
      if (dd < bd) { bd = dd; best = p; }
    }
    tm._interceptor = best;
  }

  _assignAttackRoles(tm, b) {
    const owner = b.owner && b.owner.team === tm.side ? b.owner : null;
    if (!owner) return;
    const dir = tm.attackDir;
    const prog = p => dir > 0 ? p.x : FL - p.x;
    const ballProg = dir > 0 ? b.x : FL - b.x;
    const pool = tm.players.filter(p => !p.red && !p.isGK && p !== owner);
    const used = new Set();
    const pickRole = score => {
      let best = null, bestScore = 1e9;
      for (const p of pool) {
        if (used.has(p)) continue;
        const s = score(p);
        if (s < bestScore) { bestScore = s; best = p; }
      }
      if (best) used.add(best);
      return best;
    };

    // Apoio de segurança atrás da bola, preferencialmente volante/meia/lateral.
    tm._supportBack = pickRole(p => {
      const line = C.LINE_OF[p.slotPos];
      const ideal = ballProg - 8;
      const rolePen = line === 'MID' ? 0 : ['LB','RB','LWB','RWB'].includes(p.slotPos) ? 2 : line === 'DEF' ? 5 : 9;
      return Math.abs(prog(p) - ideal) + Math.abs(p.y - b.y) * 0.18 + rolePen;
    });
    // Segundo vértice lateral: dá ângulo, não fica escondido atrás do portador.
    tm._supportSide = pickRole(p => {
      const dp = Math.abs(prog(p) - ballProg);
      const lateral = Math.abs(Math.abs(p.y - b.y) - 10);
      const rolePen = C.LINE_OF[p.slotPos] === 'DEF' && !['LB','RB','LWB','RWB'].includes(p.slotPos) ? 6 : 0;
      return dp * 0.7 + lateral + rolePen;
    });
    // Terceiro homem recebe entre linhas/na diagonal, sem substituir corridas
    // naturais dos pontas e atacantes.
    tm._thirdMan = pickRole(p => {
      const line = C.LINE_OF[p.slotPos];
      const ideal = ballProg + (line === 'FWD' ? 12 : 8);
      const rolePen = line === 'DEF' ? 12 : line === 'MID' ? 0 : 1.5;
      return Math.abs(prog(p) - ideal) + Math.abs(p.y - b.y) * 0.13 + rolePen;
    });
  }

  _offsideLine(attackingTeam) {
    const tm = this.teams[attackingTeam];
    const defenders = this.teams[1 - attackingTeam].players
      .filter(p => !p.red)
      .map(p => tm.attackDir > 0 ? p.x : FL - p.x)
      .sort((a, b) => b - a);
    return defenders.length > 1 ? defenders[1] : FL - 2;
  }

  _attackTarget(tm, p, b) {
    const dir = tm.attackDir;
    // coordenada de "progresso": 0 gol próprio .. 105 gol adversário (em termos de ataque)
    const prog = x => dir > 0 ? x : FL - x;
    const unprog = pv => dir > 0 ? pv : FL - pv;
    const ballProg = prog(b.x);
    const homeProg = prog(p.hx);
    const line = C.LINE_OF[p.slotPos];
    // ============ MOVIMENTAÇÃO POR PAPEL (§2 da spec) ============
    // Cada jogador tem timers/fases próprios → nada de bloco uniforme.
    const t = this.simT || 0;
    const ph = p.idx * 1.73;                              // fase pessoal estável
    const adaptive = tm.adaptive || this._neutralAdaptive();
    /* TÓPICO 4 · GATILHO TÁTICO: "se perdendo por 1+ nos 10 minutos finais →
       pressão total". Implementado direto no motor, para os DOIS times: o
       time que está atrás depois dos 80' ganha +0.28 de empuxo de postura
       (mais corpos na frente, corridas profundas mais frequentes) — o
       all-in clássico. Some sozinho se empatar. É o primeiro gatilho da
       família sugerida no documento; a estrutura (condição → ajuste de
       eixo) aceita novos gatilhos com uma linha cada. */
    const _losingLate = this.minute > 80 && this.score[p.team] < this.score[1 - p.team];
    const posturePush = (adaptive.posture || 0) + (_losingLate ? 0.28 : 0);
    // estado de RUN individual (atacantes alternam "vem no pé" ↔ "ataca espaço")
    // run individual: no último terço, atacantes/meias ofensivos infiltram com mais frequência
    const teamInFinal = ballProg > FL * 0.60;
    if (p._runUntil === undefined || t > p._runUntil) {
      const roleDepth = p.roleFx ? p.roleFx.deep : .35;
      const base = (line === 'FWD' ? 0.5 : (p.slotPos === 'CAM' || p.slotPos === 'CM' ? 0.28 : 0.18))
        + posturePush * (line === 'FWD' ? 0.48 : 0.30)
        + (roleDepth - .35) * (line === 'FWD' ? .62 : .44);
      p._runDeep = chance(teamInFinal ? Math.min(0.93, base + 0.35) : clamp(base, 0.05, 0.82));
      p._runUntil = t + 1.8 + R(0, 2.2);
    }
    // CORRIDA DE RUPTURA (§imprevisibilidade): de vez em quando, um atacante/meia
    // ofensivo DISPARA uma arrancada diagonal súbita pro espaço nas costas da linha
    // — não a oscilação suave, mas uma quebra explosiva que a defesa não previu. É o
    // movimento sem bola que CRIA a jogada de perigo (a infiltração que faltava).
    const canBreak = (line === 'FWD' || p.slotPos === 'CAM' || p.slotPos === 'LW' || p.slotPos === 'RW');
    if (p._breakCd === undefined) p._breakCd = R(2, 10);
    p._breakCd -= this._stepDt || 1 / 60;
    if (canBreak && !p._breaking && p._breakCd <= 0 && ballProg > FL * 0.50 && ballProg < FL * 0.85) {
      // só rompe se há ESPAÇO à frente do jogador (senão corre pra marcação — inútil)
      let aheadClear = true;
      for (const opp of this.teams[1 - p.team].players) {
        if (opp.red) continue;
        const oProg = tm.attackDir > 0 ? opp.x : FL - opp.x;
        const myProg = tm.attackDir > 0 ? p.x : FL - p.x;
        if (oProg > myProg && oProg < myProg + 12 && Math.abs(opp.y - p.y) < 7) { aheadClear = false; break; }
      }
      const vel = p.ref && p.ref.a8 ? p.ref.a8[3] : 70;
      const roleDepth = p.roleFx ? p.roleFx.deep : .35;
      if (aheadClear && chance(clamp(0.34 + (vel - 70) / 100 * 0.4 + (roleDepth - .35) * .48, 0.12, 0.82))) {
        p._breaking = { t: 1.4, dir: chance(0.5) ? 1 : -1 };
        p._breakCd = 7 + R(0, 5);
        this._emit('run_break', { by: p });
      } else { p._breakCd = 1.5 + R(0, 2); }
    }
    if (p._breaking) { p._breaking.t -= this._stepDt || 1 / 60; if (p._breaking.t <= 0) p._breaking = null; }
    const wide = ['LW','RW','LM','RM','LWB','RWB'].indexOf(p.slotPos) !== -1;
    const isFB = ['LB','RB','LWB','RWB'].indexOf(p.slotPos) !== -1;
    const isCDM = p.slotPos === 'CDM';
    const sameSide = ((p.hy < FW/2) === (b.y < FW/2)) || Math.abs(p.hy - FW/2) < 3.5;
    const owner = b.owner && b.owner.team === tm.side ? b.owner : null;
    let roleTy = null;

    // TETO DE AVANÇO por papel: cada posição respeita sua zona (§individualidade).
    // Zagueiro não vira ponta; volante não some no ataque; lateral sobe mas volta.
    const isCB = p.slotPos === 'CB';
    const baseCap = {
      CB: FL*0.60, LB: FL*0.82, RB: FL*0.82, LWB: FL*0.90, RWB: FL*0.90,
      CDM: FL*0.70, CM: FL*0.86, CAM: FL*0.95, LM: FL*0.95, RM: FL*0.95,
      LW: FL*1.0, RW: FL*1.0, ST: FL*1.0, CF: FL*1.0,
    }[p.slotPos] || FL*0.9;
    const roleDepthNow = p.roleFx ? p.roleFx.deep : .35;
    const rolePushNow = p.roleFx ? p.roleFx.push : 0;
    const CAP = clamp(baseCap + rolePushNow * .22 + (roleDepthNow - .35) * 7, FL*.45, FL);
    // PISO de recuo: atacante não recua demais na fase ofensiva (mantém referência lá na frente)
    const FLOOR = { ST: homeProg - 8, LW: homeProg - 12, RW: homeProg - 12, CF: homeProg - 8 }[p.slotPos];

    let tProg;
    if (line === 'FWD') {
      const falseNine = p.role === 'fc_falso';
      tProg = p._runDeep
        ? clamp(ballProg + (falseNine ? 7 : 14) + Math.sin(t * 0.8 + ph) * 2.2, homeProg - (falseNine ? 9 : 4), FL - 3)
        : falseNine
          ? clamp(ballProg + 2, homeProg - 12, Math.min(CAP, ballProg + 6))
          : clamp(Math.max(homeProg - 4, ballProg + 9), homeProg - 6, FL - 5);
    } else if (isCB) {
      // ZAGUEIRO: sobe pouquíssimo — acompanha a linha e segura a profundidade
      tProg = clamp(homeProg + Math.max(0, ballProg - FL*0.5) * 0.14, homeProg - 2, FL*0.55);
    } else if (isCDM) {
      // VOLANTE: primeiro cão de guarda — fica à frente da zaga, raramente passa do meio ofensivo
      tProg = clamp(homeProg * 0.55 + ballProg * 0.35 + 5, homeProg - 3, CAP);
    } else if (isFB && sameSide && ballProg > FL * 0.45) {
      // LATERAL: sobe pela linha no SEU lado. ULTRAPASSAGEM de verdade quando o
      // ponta do seu lado tem a bola: dispara POR FORA, além da linha da bola,
      // virando opção profunda na ponta (a defesa tem que escolher quem marca).
      // ULTRAPASSAGEM: quando o ponta do seu lado tem a bola, dispara POR FORA
      const ow = this.ball.owner;
      const ownerWinger = ow && ow.team === p.team && ow !== p &&
        ['LW','RW','LM','RM'].indexOf(ow.slotPos) !== -1 &&
        ((p.hy < FW/2) === (ow.y < FW/2));
      const pace = getAttr(p, 'ritmo');
      if (ownerWinger && pace >= 58 && ballProg > FL * 0.48) {
        p._overlapping = true;
        tProg = clamp(ballProg + 11, homeProg, FL - 4);
      } else {
        p._overlapping = false;
        tProg = clamp(ballProg + (p._runDeep ? 8 : 3), homeProg, CAP);
      }
    } else if (isFB) {
      // lateral do lado oposto: recomposição, não avança
      tProg = clamp(homeProg + Math.max(0, ballProg - FL*0.5) * 0.25, homeProg - 2, FL*0.6);
    } else if (line === 'MID') {
      const isAtkMid = p.slotPos === 'CAM' || p.slotPos === 'LM' || p.slotPos === 'RM';
      if (isAtkMid && ballProg > FL * 0.64 && p._runDeep) {
        tProg = clamp(ballProg + 6 + Math.sin(t * 0.9 + ph) * 2, homeProg, CAP);
      } else {
        tProg = clamp(homeProg * 0.5 + ballProg * 0.42 + 6 + (p._runDeep ? 6 : 0), homeProg - 4, CAP);
      }
    } else {
      tProg = clamp(homeProg + Math.max(0, ballProg - FL/2) * 0.35, homeProg - 2, CAP);
    }

    // ESTRUTURA AO REDOR DA BOLA: três jogadores recebem papéis diferentes,
    // formando linhas de passe atrás, ao lado e entre linhas. Sem isso, todos
    // obedeciam apenas à mesma relação bola-casa e às vezes se escondiam na
    // mesma faixa vertical.
    if (owner && p === tm._supportBack && line !== 'FWD') {
      tProg = clamp(ballProg - 8, homeProg - 6, Math.min(CAP, ballProg - 4));
      const sideSign = p.hy <= b.y ? -1 : 1;
      roleTy = clamp(b.y + sideSign * 8, 5, FW - 5);
    } else if (owner && p === tm._supportSide && !p._overlapping) {
      tProg = clamp(ballProg + (line === 'FWD' ? 3 : 0), homeProg - 6, CAP);
      let sideSign = Math.sign(p.hy - b.y);
      if (!sideSign) sideSign = b.y < FW/2 ? 1 : -1;
      roleTy = clamp(b.y + sideSign * 11, 4, FW - 4);
    } else if (owner && p === tm._thirdMan && line !== 'DEF' && !p._breaking) {
      tProg = clamp(ballProg + (line === 'FWD' ? 12 : 8), homeProg - 3, CAP);
      const diag = p.hy < FW/2 ? -1 : 1;
      roleTy = clamp(lerp(b.y, FW/2, 0.38) + diag * 5, 5, FW - 5);
    }
    if (FLOOR !== undefined) tProg = Math.max(tProg, Math.min(FLOOR, ballProg + 6));
    // TABELINHA: arrancada curta pras costas (ignora teto do papel por 2.4s)
    if (p._burst && p._burst.kind === 'tabela') tProg = clamp(ballProg + 12, homeProg - 4, FL - 3);
    else tProg = Math.min(tProg, CAP);   // trava dura no teto do papel
    const momPush = this.mom ? (this.mom[p.team] - this.mom[1 - p.team]) * 4.5 : 0;
    const rolePresence = line === 'FWD' ? 1 : line === 'MID' ? 0.72 : (isFB ? 0.45 : 0.18);
    tProg = clamp(tProg + tm.mood.line + momPush + posturePush * 12 * rolePresence, 2, FL - 3);
    let tx = unprog(tProg);
    // largura: ponta abre no lado oposto (amplitude §2), corta pra dentro em run no seu lado
    let ty = lerp(p.hy, FW/2, 0.10);
    if (p._overlapping) ty = p.hy < FW/2 ? 2.2 : FW - 2.2;          // ultrapassagem: POR FORA
    else if (p._burst && p._burst.kind === 'tabela') ty = lerp(p.y, FW/2, 0.45);  // tabela: corredor interno
    else if (roleTy !== null) ty = roleTy;
    else if (wide) {
      const finalThird = ballProg > FL * 0.62;
      if (!sameSide && finalThird && line === 'FWD') {
        // ponta do lado oposto ATACA O SEGUNDO PAU no cruzamento (§2/§9)
        ty = p.hy < FW/2 ? FW/2 - 7 : FW/2 + 7;
        tProg = Math.max(tProg, ballProg + 9);
      }
      else if (!sameSide) ty = p.hy < FW/2 ? Math.min(p.hy, 11) : Math.max(p.hy, FW - 11);
      else if (p._runDeep && (line === 'FWD' || line === 'MID')) {
        // ponta/meia do lado da bola CORTA pra área quando o time está na frente
        if (ballProg > FL * 0.66) { ty = lerp(p.hy, FW/2, 0.55); tProg = Math.max(tProg, ballProg + 4); }
        else ty = lerp(p.hy, FW/2, 0.42);
      }
      else ty = lerp(p.hy, FW/2, 0.12);
    }
    // A camada contextual abre/fecha o desenho sem reescrever as âncoras da
    // formação. Um corredor comprovadamente produtivo recebe somente viés leve.
    const widthMod = adaptive.width || 0;
    if (widthMod < 0) ty = lerp(ty, FW / 2, Math.min(0.24, -widthMod * 0.78));
    else if (widthMod > 0 && (wide || isFB)) {
      const openTo = p.hy < FW / 2 ? 2.5 : FW - 2.5;
      ty = lerp(ty, openTo, Math.min(0.22, widthMod * 0.66));
    }
    if (adaptive.focusSide && line !== 'DEF') {
      const focusY = adaptive.focusSide === 'L' ? FW * 0.28 : FW * 0.72;
      ty = lerp(ty, focusY, 0.055 * Math.max(0.35, adaptive.intensity || 0));
    }
    // oscilação pessoal dessincronizada: mata o "bloco que anda junto"
    tProg += Math.sin(t * 0.7 + ph) * 1.0;
    ty += Math.cos(t * 0.55 + ph * 1.3) * 1.2;
    // CORRIDA DE RUPTURA em ação: puxa o jogador forte pra frente e na diagonal —
    // a arrancada explosiva nas costas da linha (não a oscilação suave).
    if (p._breaking) {
      tProg = clamp(Math.max(tProg, ballProg + 16), homeProg, FL - 2);
      ty = clamp(ty + p._breaking.dir * 9, 3, FW - 3);
    }
    // Quem não está executando uma ruptura temporiza na linha de impedimento.
    // A corrida ainda pode atravessá-la; a posição de apoio normal não fica
    // permanentemente adiantada e inútil.
    if (!p._breaking && !(p._burst && p._burst.kind === 'tabela') &&
        (line === 'FWD' || p === tm._thirdMan)) {
      const onsideCap = Math.max(ballProg - 0.25, this._offsideLine(tm.side) - 0.25);
      tProg = Math.min(tProg, onsideCap);
    }
    // Recalcula X depois de todos os ajustes de ruptura/ultrapassagem. Antes, as
    // animações anunciavam a corrida mas o alvo longitudinal continuava antigo.
    tx = unprog(tProg);
    // corredor de profundidade: atacante do lado da bola ataca o espaço
    if (line === 'FWD') p.runT -= 0.016;
    return [tx, ty];
  }

  _defendTarget(tm, p, b, presser) {
    const dir = tm.attackDir;
    if (p === presser) return [b.x, b.y];               // único presser vai à bola
    // ANTECIPAÇÃO (§6): com a bola em voo, SÓ o interceptador designado ataca o
    // ponto do passe. Um único jogador salta a linha — o resto mantém a marcação.
    if (b.traveling && b.kind === 'pass' && b.from && b.target && p === tm._interceptor) {
      const fx2 = b.from.x, fy2 = b.from.y, txl = b.target.x, tyl = b.target.y;
      const ldx = txl - fx2, ldy = tyl - fy2;
      const len2 = ldx*ldx + ldy*ldy;
      if (len2 > 1) {
        let tpr = ((p.x - fx2) * ldx + (p.y - fy2) * ldy) / len2;
        if (tpr > 0.2 && tpr < 0.68) {
          const px2 = fx2 + ldx * tpr, py2 = fy2 + ldy * tpr;
          if (D(p.x, p.y, px2, py2) < 4.5) return [clamp(px2,1,FL-1), clamp(py2,1,FW-1)];
        }
      }
    }
    const ownHalf = (tm.attackDir > 0) ? b.x < FL * 0.55 : b.x > FL * 0.45;
    // COBERTURA (§7): o 2º mais próximo protege as costas do presser
    if (p === tm._cover && ownHalf) {
      const ang = Math.atan2(tm.goal.y - b.y, tm.goal.x - b.x);
      return [clamp(b.x + Math.cos(ang) * 8.5, 2, FL - 2), clamp(b.y + Math.sin(ang) * 8.5, 2, FW - 2)];
    }
    // SOMBRA DE PASSE (§7): um médio se posta na linha bola → atacante perigoso.
    // Só entra em ação no PRÓPRIO TERÇO defensivo: no meio-campo ele apenas
    // engrossava o aglomerado ao redor da bola, o que empobrecia a leitura.
    const ownThird = (tm.attackDir > 0) ? b.x < FL * 0.40 : b.x > FL * 0.60;
    if (p === tm._shadow && tm._shadowTgt && ownThird) {
      const tgt = tm._shadowTgt;
      return [clamp(lerp(b.x, tgt.x, 0.35), 2, FL - 2), clamp(lerp(b.y, tgt.y, 0.35), 2, FW - 2)];
    }
    // ZAGUEIRO ACOMPANHA INFILTRAÇÃO (§2): marca o atacante que arranca nas costas
    const defThird = (tm.attackDir > 0) ? b.x < FL * 0.42 : b.x > FL * 0.58;
    if (p._markRef && !p._markRef.red && (defThird ||
        (ownHalf && D(p._markRef.x, p._markRef.y, tm.goal.x, tm.goal.y) < 38))) {
      const mk = p._markRef;
      return [clamp(mk.x + (tm.goal.x > FL/2 ? 2.6 : -2.6), 2, FL - 2), clamp(mk.y + (mk.y > FW/2 ? -1 : 1), 2, FW - 2)];
    }
    // demais seguram ZONA: casa deslocada segundo a posição da bola
    const pLine = C.LINE_OF[p.oopPos || p.slotPos];
    // As linhas basculam em intensidades diferentes: ataque pressiona mais,
    // zaga protege profundidade. O mesmo 0.35 para todos deixava o bloco com
    // aparência de uma placa deslizando inteira.
    const shiftScale = pLine === 'DEF' ? 0.25 : pLine === 'MID' ? 0.34 : 0.43;
    const shiftX = (b.x - FL/2) * shiftScale;
    const shiftY = (b.y - FW/2) * 0.28;
    const minX = dir > 0 ? 3 : FL/2 - 8;
    const maxX = dir > 0 ? FL/2 + 8 : FL - 3;
    let tx = clamp(p.hx + shiftX + (tm.mood ? tm.mood.line : 0) * dir, minX, maxX);
    let ty = clamp(p.hy + shiftY, 3, FW - 3);
    const widthMod = tm.adaptive ? tm.adaptive.width || 0 : 0;
    if (widthMod < 0) ty = lerp(ty, FW / 2, Math.min(0.26, -widthMod * 0.82));
    else if (widthMod > 0) ty = lerp(ty, p.hy, Math.min(0.16, widthMod * 0.45));
    if (!p._nextDefErrorCheck || this.t >= p._nextDefErrorCheck) {
      p._nextDefErrorCheck = this.t + ADV4.defending.errorCheckEvery + (p.idx%3)*.17;
      const concentration = facet(p,'concentration')/100;
      const fatigue = clamp((72-p.stamina)/40,0,1);
      const highLine = this._lineVulnerability(1-p.team);
      const risk = ADV4.defending.baseError + (1-concentration)*.0045 + fatigue*ADV4.defending.fatigueError + highLine*ADV4.defending.highLineError;
      if (chance(risk)) {
        const amp = 2.4 + (1-concentration)*5 + fatigue*3;
        p._defErrorUntil = this.t + R(.75,1.55);
        p._defErrorX = R(-amp,amp); p._defErrorY = R(-amp,amp);
        this.stats[p.team].defErrors++;
        this._emit('defensive_error',{by:p});
      }
    }
    if ((p._defErrorUntil||0) > this.t) { tx += p._defErrorX||0; ty += p._defErrorY||0; }
    if (p.oopRole==='track_wide') ty=lerp(ty,b.y,.12);
    if (p.oopRole==='screen' || p.oopRole==='anchor') tx=lerp(tx,tm.goal.x,.05);
    return [clamp(tx,1,FL-1), clamp(ty,3,FW-3)];
  }

  // designa papéis defensivos do turno: cobertura, sombra e marcações (§7/§2)
  _assignDefRoles(tm, b, presser) {
    let cover = null, cd = 1e9;
    for (const p of tm.players) {
      if (p.red || p.isGK || p === presser) continue;
      p._markRef = null;
      const dd = D(p.x, p.y, b.x, b.y);
      const defPos = p.oopPos || p.slotPos;
      const line = C.LINE_OF[defPos];
      // Cobertura deve vir de quem naturalmente protege a zona. Um atacante
      // ligeiramente mais perto não abandona a frente para virar último homem.
      const rolePen = line === 'DEF' ? 0 : defPos === 'CDM' ? 0.8 : line === 'MID' ? 2.4 : 7;
      const score = dd + rolePen;
      if (score < cd) { cd = score; cover = p; }
    }
    tm._cover = cover;
    const opps = this.teams[1 - tm.side].players.filter(q => !q.red && !q.isGK && q !== this.ball.owner);
    // alvo perigoso p/ sombra: adversário mais perto do gol defendido
    let tgt = null, td = 1e9;
    for (const a of opps) { const dd = D(a.x, a.y, tm.goal.x, tm.goal.y); if (dd < td) { td = dd; tgt = a; } }
    tm._shadowTgt = tgt;
    let sh = null, sd = 1e9;
    for (const p of tm.players) {
      if (p.red || p.isGK || p === presser || p === cover) continue;
      const dd = tgt ? D(p.x, p.y, (b.x + tgt.x) / 2, (b.y + tgt.y) / 2) : 1e9;
      const defPos = p.oopPos || p.slotPos;
      const line = C.LINE_OF[defPos];
      const rolePen = defPos === 'CDM' ? 0 : line === 'MID' ? 1 : line === 'DEF' ? 4 : 6;
      if (dd + rolePen < sd) { sd = dd + rolePen; sh = p; }
    }
    tm._shadow = sh;
    // zagueiros pegam atacantes infiltrando na zona deles (raio 13m)
    const cbs = tm.players.filter(p => !p.red && (p.oopPos || p.slotPos) === 'CB');
    const marked = new Set();
    for (const cb of cbs) {
      let mk = null, md = 14;
      for (const a of opps) {
        if (marked.has(a)) continue;
        const dangerous = a._runDeep || a._breaking || D(a.x, a.y, tm.goal.x, tm.goal.y) < 32;
        if (dangerous) { const dd = D(cb.x, cb.y, a.x, a.y); if (dd < md) { md = dd; mk = a; } }
      }
      cb._markRef = mk;
      if (mk) marked.add(mk);
    }
  }

  _integrate(p, tx, ty, dt, freeze) {
    // timers de corrida com propósito (tabela/ultrapassagem)
    if (p._burst) { p._burst.t -= dt; if (p._burst.t <= 0) p._burst = null; else p.stamina = Math.max(35, p.stamina - dt * 1.1); }
    if (p._burstCd) { p._burstCd -= dt; if (p._burstCd <= 0) p._burstCd = 0; }
    if (p._overlapT && p._overlapT > 0) { p._overlapT -= dt; if (p._overlapT <= 0) { p._overlapT = 0; p._overlapping = false; } }
    const dx = tx - p.x, dy = ty - p.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    // velocidade desejada (desaceleração suave perto do alvo)
    const staminaF = 0.7 + p.stamina/100 * 0.3;
    // RITMO INDIVIDUAL (§movimento): nem todo jogador corre a 100% o tempo todo —
    // isso é o que causava a "mesma velocidade" (deslizar em bloco). Cada um tem uma
    // marcha própria que respira: longe da ação, muitos TROTAM (60-75%); só quem tem
    // urgência real (perto do alvo, ou com dever de bola) esprinta. A fase pessoal
    // dessincroniza quem acelera e quando.
    if (p._gaitPh === undefined) p._gaitPh = R() * 6.28;
    const hasBallDuty = p._breaking || p._burst || p === this.ball.owner ||
                        (this.ball.traveling && this.ball.receiver === p);
    let effort;
    if (hasBallDuty || dist > 16) effort = 1;           // dever real ou muito longe: esprinta
    else {
      // marcha que respira, escalada pela distância: perto trota, longe apressa.
      // cada jogador num ponto diferente do ciclo → ninguém na mesma velocidade.
      const distF = clamp((dist - 3) / 13, 0, 1);        // 3m→16m mapeia 0→1
      const breathe = 0.5 + 0.5 * Math.sin(this.t * 0.85 + p._gaitPh);
      effort = clamp(0.55 + distF * 0.35 + breathe * 0.14, 0.5, 1);
    }
    const vmax = p.maxSpd * staminaF * effort * (freeze ? 0.5 : 1);
    const desired = Math.min(vmax, dist * 3.2);         // freia perto do alvo
    const dvx = dx/dist * desired - p.vx;
    const dvy = dy/dist * desired - p.vy;
    // inércia: aproxima com aceleração limitada
    const currentDir = Math.atan2(p.vy,p.vx), wantedDir = Math.atan2(dy,dx);
    const turnDelta = Math.abs(Math.atan2(Math.sin(wantedDir-currentDir),Math.cos(wantedDir-currentDir)));
    const turnPenalty = lerp(1, p.turn || 1, clamp(turnDelta/Math.PI,0,1));
    const amax = p.acc * turnPenalty * dt;
    const dv = Math.hypot(dvx, dvy);
    if (dv > amax) { p.vx += dvx/dv*amax; p.vy += dvy/dv*amax; }
    else { p.vx += dvx; p.vy += dvy; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, 0, FL); p.y = clamp(p.y, 0, FW);
  }

  /* ------------------------------ EVENTOS ----------------------------- */
  _emit(type, data) {
    const ev = Object.assign({ type, minute: Math.floor(this.minute), t: this.t }, data);
    // O laboratório executa milhares de partidas e não precisa reter cada passe,
    // bote e corrida. O callback continua recebendo todos os eventos necessários
    // para a auditoria, mas o array interno só guarda marcos de jogo.
    if (!(this.opts && this.opts.labMode) || ['goal','yellow','red','injury','halftime','extratime','sub'].includes(type)) this.events.push(ev);
    try { this.onEvent(ev); } catch(e){}
  }

  /* ------------------------------ LESÃO ------------------------------- */
  _injure(p) {
    p._injured = true;
    const tm = this.teams[p.team];
    this._emit('injury', { by: p, team: p.team });
    // com banco: técnico troca na hora (auto-sub pelo melhor reserva compatível)
    if (tm.subsLeft > 0 && tm.bench && tm.bench.length) {
      const idx = tm.players.indexOf(p);
      // melhor reserva por overall (compat de posição atenuada — banco pequeno)
      let best = -1, bi = -1;
      tm.bench.forEach((b, i) => { const sc = (b.r || 60) + (C.LINE_OF[b.slot] === C.LINE_OF[p.slotPos] ? 8 : 0); if (sc > best) { best = sc; bi = i; } });
      if (bi >= 0) { this.substitute(p.team, idx, tm.bench[bi]); return; }
    }
    // sem banco/subs: segue em campo capengando (fôlego e rendimento caem)
    p.stamina = Math.min(p.stamina, 45);
    p.maxSpd *= 0.82; p.acc *= 0.82;
    p.rating = Math.max(4.5, (p.rating || 6) - 0.6);
  }

  /* --------------------------- SUBSTITUIÇÃO --------------------------- */
  substitute(team, outIdx, inPlayer) {
    const tm = this.teams[team];
    if (tm.subsLeft <= 0) return false;
    const outP = tm.players[outIdx];
    if (!outP) return false;
    const incomingGK = (inPlayer.slot || inPlayer.pos) === 'GK';
    if (!!outP.isGK !== !!incomingGK) return false;
    // Remove do banco se estiver lá (evita duplicação)
    const bIdx = (tm.bench || []).indexOf(inPlayer);
    if (bIdx >= 0) tm.bench.splice(bIdx, 1);
    const np = {
      ref: inPlayer, team, slotPos: outP.slotPos, ipPos: outP.ipPos || outP.slotPos, oopPos: outP.oopPos || outP.slotPos, idx: outP.idx,
      role: outP.role || C.defaultRoleFor(outP.slotPos), ipRole: outP.role || C.defaultRoleFor(outP.slotPos), focus: outP.focus || 'bal',
      roleFx: C.roleFx(outP.role || C.defaultRoleFor(outP.slotPos), outP.focus || 'bal'),
      x: outP.x, y: outP.y, vx: 0, vy: 0, hx: outP.hx, hy: outP.hy,
      dhx: outP.dhx, dhy: outP.dhy, ahx: outP.ahx, ahy: outP.ahy,
      _runDeep: false, _runUntil: 0, _markRef: null,
      maxSpd: speedOf(inPlayer), acc: accelOf(inPlayer), turn: turnOf(inPlayer),
      oopRole: deriveOopRole(outP.oopPos || outP.slotPos, outP.role || C.defaultRoleFor(outP.ipPos || outP.slotPos), outP.focus || 'bal'),
      heatmap: new Float32Array(ADV4.analytics.cols * ADV4.analytics.rows), passLinks:Object.create(null),
      react: clamp(lerp(0.255, 0.075,
        (getAttr(inPlayer,'posicionamento') * 0.45 + getAttr(inPlayer,'antecipacao') * 0.35 +
         getAttr(inPlayer,'trabalho_equipe') * 0.20) / 100) + R(-0.018, 0.018), 0.065, 0.27),
      stamina: 100, rating: 6.0, settle: 0, yellow: 0, red: false, isGK: outP.isGK, runT: 0
    };
    tm.players[outIdx] = np;
    if (this.ball.owner === outP) this.ball.owner = np;
    tm.subsLeft--;
    this._emit('sub', { team, out: outP, inP: np });
    return true;
  }

  // troca formações ao vivo: defKey = sem bola, atkKey = com bola (§4/7)
  setShapes(team, defKey, defVar, atkKey, atkVar) {
    const tm = this.teams[team];
    const side = tm.side, fx = tm.fx;
    const shape = (fk, vi) => {
      const fm = C.FORMATIONS[fk] || C.FORMATIONS['4-3-3'];
      const idx = ((vi || 0) % fm.variations.length + fm.variations.length) % fm.variations.length;
      return fm.variations[idx].slots;
    };
    const dS = shape(defKey, defVar), aS = shape(atkKey, atkVar);
    const alive = tm.players.filter(p => !p.red);
    const slotLine = pos => C.LINE_OF[pos] || 'MID';
    const playerLine = p => C.LINE_OF[(p.ref && (p.ref.slot || p.ref.pos)) || p.slotPos] || C.LINE_OF[p.slotPos] || 'MID';
    const assign = (slots, phase) => {
      const used = new Set(), out = new Map();
      const eligibleCount = sl => alive.filter(p => {
        if (used.has(p)) return false;
        if (sl.pos === 'GK') return p.isGK;
        return !p.isGK && C.canPlay(p.ref, sl.pos);
      }).length;
      const order = slots.map((sl, i) => ({ sl, i, scarce: eligibleCount(sl) })).sort((a,b) => {
        if (a.sl.pos === 'GK' && b.sl.pos !== 'GK') return -1;
        if (b.sl.pos === 'GK' && a.sl.pos !== 'GK') return 1;
        return a.scarce - b.scarce;
      });
      for (const item of order) {
        const sl = item.sl;
        let candidates = alive.filter(p => !used.has(p) && (sl.pos === 'GK' ? p.isGK : !p.isGK));
        candidates.sort((a,b) => {
          const score = p => {
            const current = phase === 'atk' ? (p.ipPos || p.slotPos) : (p.oopPos || p.slotPos);
            const legal = C.canPlay(p.ref, sl.pos) ? 120 : 0;
            const exact = current === sl.pos ? 34 : 0;
            const natural = p.ref && (p.ref.slot === sl.pos || p.ref.pos === sl.pos) ? 24 : 0;
            const sameLine = playerLine(p) === slotLine(sl.pos) ? 20 : 0;
            const adjacent = C.LINE_OF[current] === slotLine(sl.pos) ? 10 : 0;
            const gkGuard = sl.pos === 'GK' ? (p.isGK ? 500 : -500) : (p.isGK ? -500 : 0);
            return gkGuard + legal + exact + natural + sameLine + adjacent + ((p.ref && p.ref.r) || 0) * .08;
          };
          return score(b)-score(a);
        });
        const chosen = candidates[0];
        if (chosen) { used.add(chosen); out.set(chosen, { sl, i:item.i }); }
      }
      return out;
    };
    const dMap = assign(dS, 'def'), aMap = assign(aS, 'atk');
    for (const p of alive) {
      const dsl = dMap.get(p), asl = aMap.get(p) || dsl;
      if (!dsl || !asl) continue;
      const oopPos = dsl.sl.pos, ipPos = asl.sl.pos;
      const validRole = C.rolesForSlot(ipPos).some(r => r.id === p.role);
      p.role = validRole ? p.role : C.defaultRoleFor(ipPos);
      const roleDef = C.findRole(p.role);
      if (!roleDef || roleDef.foci.indexOf(p.focus) === -1)
        p.focus = roleDef && roleDef.foci.indexOf('bal') !== -1 ? 'bal' : (roleDef ? roleDef.foci[0] : 'bal');
      p.ipRole = p.role;
      p.roleFx = C.roleFx(p.role, p.focus);
      p.ipPos = ipPos;
      p.oopPos = oopPos;
      p.oopRole = deriveOopRole(oopPos, p.role, p.focus);
      const oopBaseRole = C.defaultRoleFor(oopPos);
      const oopDef = C.findRole(oopBaseRole);
      const oopFocus = oopDef && oopDef.foci.indexOf('def') !== -1 ? 'def' : (oopDef && oopDef.foci.indexOf('bal') !== -1 ? 'bal' : (oopDef ? oopDef.foci[0] : 'bal'));
      const oopFx = C.roleFx(oopBaseRole, oopFocus);
      const mk = (sl, low, rfx) => {
        const isGK = sl.pos === 'GK';
        rfx = rfx || { push:0, wide:0, deep:0 };
        let prog = isGK ? (low?4:9) : ((low?6:30) + sl.x * (low?46:66)) + fx.line * FL + rfx.push * (low ? .40 : 1);
        const wide = ['LW','RW','LM','RM','LWB','RWB','LB','RB'].includes(sl.pos);
        const baseY = side === 0 ? sl.y * FW : (1 - sl.y) * FW;
        let yy = low ? lerp(baseY, FW/2, 0.08) : (wide ? lerp(baseY, baseY < FW/2 ? 2.5 : FW - 2.5, clamp(.30 + rfx.wide, .04, .92)) : baseY);
        if (wide && rfx.wide < 0) yy = lerp(yy, FW/2, Math.min(.62, -rfx.wide * 2.5));
        const cls = C.SLOT_CLASS[sl.pos] || 'CM';
        if (cls === 'CB') yy = clamp(yy, FW/2 - 9.5, FW/2 + 9.5);
        if (cls === 'DM' || cls === 'CDM') yy = clamp(yy, FW/2 - 14, FW/2 + 14);
        if (cls === 'CB') prog = Math.min(prog, FL * .55);
        return [side === 0 ? clamp(prog,2,FL-2) : FL - clamp(prog,2,FL-2), yy];
      };
      [p.dhx, p.dhy] = mk(dsl.sl, true, oopFx);
      [p.ahx, p.ahy] = mk(asl.sl, false, p.roleFx);
      p.slotPos = ipPos;
    }
    tm.defForm = defKey; tm.defVar = defVar || 0;
    tm.atkForm = atkKey; tm.atkVar = atkVar || 0;
    return true;
  }

  _neutralAdaptive() {
    return {
      key: 'balance', label: 'Equilíbrio', reason: 'Contexto sem urgência', intensity: 0,
      line: 0, risk: 0, far: 0, tackle: 0, pressReach: 0, ritmo: 0,
      direct: 0, width: 0, posture: 0, drain: 0, focusSide: null,
      stamina: 100, redCount: 0, momentumDelta: 0
    };
  }

  _adaptivePlan(t) {
    const tm = this.teams[t];
    const diff = this.score[t] - this.score[1 - t];
    const min = this.minute;
    const active = tm.players.filter(p => !p.red && !p.isGK);
    const stamina = active.length ? active.reduce((s, p) => s + p.stamina, 0) / active.length : 100;
    const redCount = tm.players.filter(p => p.red).length;
    const momentumDelta = this.mom ? (this.mom[t] || 0) - (this.mom[1 - t] || 0) : 0;
    const plan = this._neutralAdaptive();

    const choose = (key, label, reason, intensity, mods) => {
      plan.key = key; plan.label = label; plan.reason = reason;
      plan.intensity = clamp(intensity, 0, 1);
      for (const k of ['line','risk','far','tackle','pressReach','ritmo','direct','width','posture','drain'])
        plan[k] = (mods[k] || 0) * plan.intensity;
    };

    // Prioridades: expulsão > urgência extrema > placar tardio > energia > domínio.
    // Uma expulsão define o plano principal; se o time estiver atrás, o bloco segue
    // compacto, mas preserva uma rota vertical controlada para tentar reagir.
    if (redCount > 0) {
      const losing = diff < 0;
      const i = clamp(0.62 + redCount * 0.16 + (min >= 70 ? 0.12 : 0), 0, 1);
      choose('ten_men', 'Dez jogadores',
        losing ? 'Inferioridade numérica: compactar sem abandonar a reação' : 'Inferioridade numérica: proteger espaços e reduzir exposição', i,
        losing
          ? { line: 1.4, risk: 0.14, far: 0.12, tackle: -0.10, pressReach: -0.28, ritmo: -0.04, direct: 0.16, width: -0.20, posture: 0.05, drain: -0.13 }
          : { line: -3.8, risk: -0.22, far: -0.10, tackle: -0.14, pressReach: -0.42, ritmo: -0.12, direct: -0.04, width: -0.23, posture: -0.18, drain: -0.16 });
    } else if (diff < 0 && min >= 82) {
      const i = clamp(0.72 + (min - 82) / 16 * 0.28 + Math.min(2, -diff) * 0.08, 0, 1);
      choose('all_out', 'Tudo ou nada', 'Reta final em desvantagem: aceitar espaço e atacar com máxima urgência', i,
        { line: 7.0, risk: 0.42, far: 0.30, tackle: 0.25, pressReach: 0.90, ritmo: 0.18, direct: 0.28, width: 0.12, posture: 0.32, drain: 0.20 });
    } else if ((diff >= 2 && min >= 78) || (diff > 0 && min >= 86)) {
      const i = clamp(0.68 + (min - 78) / 16 * 0.24 + Math.max(0, diff - 1) * 0.08, 0, 1);
      choose('close_game', 'Fechar o jogo', 'Vantagem na reta final: negar espaços e reter a bola', i,
        { line: -5.2, risk: -0.31, far: -0.16, tackle: -0.12, pressReach: -0.38, ritmo: -0.15, direct: -0.13, width: -0.15, posture: -0.23, drain: -0.13 });
    } else if (diff < 0 && min >= 60) {
      const i = clamp(0.48 + (min - 60) / 28 * 0.38 + Math.min(2, -diff) * 0.08, 0, 1);
      choose('chase', 'Buscar empate', 'Desvantagem no placar: subir pressão e acelerar a progressão', i,
        { line: 4.4, risk: 0.28, far: 0.18, tackle: 0.16, pressReach: 0.56, ritmo: 0.12, direct: 0.17, width: 0.08, posture: 0.21, drain: 0.13 });
    } else if (diff > 0 && min >= 68) {
      const i = clamp(0.50 + (min - 68) / 22 * 0.34 + Math.min(2, diff) * 0.07, 0, 1);
      choose('protect_lead', 'Proteger vantagem', 'Vantagem no terço final: compactar e controlar a transição', i,
        { line: -3.3, risk: -0.22, far: -0.10, tackle: -0.06, pressReach: -0.20, ritmo: -0.10, direct: 0.04, width: -0.10, posture: -0.15, drain: -0.08 });
    } else if (stamina < 62) {
      const i = clamp((66 - stamina) / 18 + 0.40, 0.42, 1);
      choose('save_energy', 'Preservar energia', 'Fôlego coletivo baixo: reduzir pressão e ritmo', i,
        { line: -1.3, risk: -0.10, far: -0.03, tackle: -0.20, pressReach: -0.52, ritmo: -0.17, direct: -0.08, width: -0.06, posture: -0.08, drain: -0.20 });
    } else if (momentumDelta < -0.24 && stamina >= 68 && min >= 14) {
      const i = clamp(0.42 + (-momentumDelta - 0.24) * 0.85, 0.42, 0.82);
      choose('regain', 'Recuperar iniciativa', 'Pressão rival recente: responder com intensidade moderada', i,
        { line: 2.3, risk: 0.10, far: 0.06, tackle: 0.17, pressReach: 0.46, ritmo: 0.09, direct: 0.08, width: 0.03, posture: 0.07, drain: 0.11 });
    } else if (diff > 0 || (momentumDelta > 0.26 && min >= 18)) {
      const i = clamp(0.38 + Math.max(0, diff) * 0.10 + Math.max(0, momentumDelta - 0.20) * 0.55, 0.38, 0.78);
      choose('control', 'Controle', diff > 0 ? 'Vantagem sem urgência: circular com menor exposição' : 'Domínio recente: administrar posse e território', i,
        { line: -1.3, risk: -0.13, far: -0.08, tackle: -0.04, pressReach: -0.12, ritmo: -0.08, direct: -0.12, width: -0.04, posture: -0.07, drain: -0.05 });
    }

    // Fôlego baixo limita qualquer plano, inclusive os de reação. Não troca o nome
    // do plano urgente; apenas impede pressão e ritmo fisicamente insustentáveis.
    if (stamina < 66 && plan.key !== 'save_energy') {
      const fatigue = clamp((66 - stamina) / 20, 0, 0.65);
      plan.tackle -= 0.12 * fatigue;
      plan.pressReach -= 0.32 * fatigue;
      plan.ritmo -= 0.12 * fatigue;
      plan.drain -= 0.16 * fatigue;
    }

    // O corredor produtivo é uma preferência leve, não uma troca de formação.
    const st = this.stats[t];
    if (st && st.attacksL + st.attacksR >= 4) {
      if (st.attacksL > st.attacksR * 1.35) plan.focusSide = 'L';
      else if (st.attacksR > st.attacksL * 1.35) plan.focusSide = 'R';
    }
    plan.stamina = stamina; plan.redCount = redCount; plan.momentumDelta = momentumDelta;
    return plan;
  }

  _applyAdaptive(tm, plan) {
    const base = tm.baseFx || tm.fx || STYLE_NEUTRO;
    const value = (v, fallback) => v == null ? fallback : v;
    const fx = Object.assign({}, base);
    fx.ritmo = clamp(value(base.ritmo, 1) * (1 + plan.ritmo), 0.78, 1.25);
    fx.pressReach = clamp(value(base.pressReach, 0) + plan.pressReach, -0.9, 2.15);
    fx.drain = clamp(value(base.drain, 1) * (1 + plan.drain), 0.72, 1.35);
    fx.direct = base.direct == null && !plan.direct ? base.direct : clamp(value(base.direct, 0.5) + plan.direct, 0.05, 0.95);
    fx.width = base.width == null && !plan.width ? base.width : clamp(value(base.width, 0.5) + plan.width, 0.08, 0.92);
    fx.posture = base.posture == null && !plan.posture ? base.posture : clamp(value(base.posture, 0.5) + plan.posture, 0.08, 0.94);
    fx.far = clamp(value(base.far, 1) * (1 + plan.far), 0.65, 1.45);
    tm.fx = fx;
    tm.mood = {
      line: clamp(plan.line, -6.2, 7.6),
      risk: clamp(1 + plan.risk, 0.64, 1.48),
      far: clamp(1 + plan.far, 0.70, 1.42),
      tackle: clamp(1 + plan.tackle, 0.70, 1.36)
    };
  }

  _updateMoods() {
    for (const t of [0, 1]) {
      const tm = this.teams[t];
      const previous = tm.adaptive || this._neutralAdaptive();
      const next = this._adaptivePlan(t);
      tm.adaptive = next;
      this._applyAdaptive(tm, next);
      // Narração só quando o plano principal muda. Variações graduais de intensidade
      // permanecem visíveis na aba Tática, mas não inundam a linha de lances.
      if (previous.key !== next.key) {
        this._emit('tactical_shift', {
          team: t, key: next.key, label: next.label, reason: next.reason,
          intensity: next.intensity, from: previous.label || 'Equilíbrio'
        });
      }
    }
    // A formação e as substituições da IA continuam sendo uma camada separada.
    this._aiReact();
  }

  // O oponente reage como um técnico: muda FORMAÇÃO pelo placar/tempo, faz SUBS
  // táticas, e LÊ por onde o jogador ataca pra reforçar aquele lado.
  _aiReact() {
    const t = this._aiTeam != null ? this._aiTeam : -1;
    if (t < 0) return;                       // sem lado de IA definido (ex.: sim dev)
    const tm = this.teams[t];
    const diff = this.score[t] - this.score[1 - t];
    const min = this.minute;
    tm._aiState = tm._aiState || { formShift: null, subsMade: 0, lastMin: 0 };
    const S = tm._aiState;

    // (a) MUDANÇA DE FORMAÇÃO reativa — uma vez por situação, não fica trocando
    if (min >= 60 && diff <= -1 && S.formShift !== 'attack') {
      // perdendo tarde → formação ofensiva (mais gente à frente)
      const atkForm = diff <= -2 ? '3-5-2' : '4-2-3-1';
      try { this.setShapes(t, tm.defForm || '4-3-3', 0, atkForm, 0); S.formShift = 'attack'; this._emit('ai_shape', { team: t, form: atkForm, why: 'chasing' }); } catch (e) {}
    } else if (min >= 70 && diff >= 2 && S.formShift !== 'defend') {
      // vencendo confortável → fecha atrás
      try { this.setShapes(t, '5-3-2', 0, tm.atkForm || '4-3-3', 0); S.formShift = 'defend'; this._emit('ai_shape', { team: t, form: '5-3-2', why: 'holding' }); } catch (e) {}
    }

    // (b) SUBSTITUIÇÃO TÁTICA — perdendo: tira defensor, põe o melhor atacante do banco
    if (min >= 62 && diff <= -1 && S.subsMade < 2 && tm.subsLeft > 0 && min - S.lastMin > 10) {
      const bench = tm.bench || [];
      // melhor atacante reserva
      let bi = -1, bScore = -1;
      bench.forEach((b, i) => { const atk = (C.LINE_OF[b.slot] === 'FWD' ? 8 : C.LINE_OF[b.slot] === 'MID' ? 3 : 0); const sc = (b.r || 60) + atk; if (sc > bScore) { bScore = sc; bi = i; } });
      let outIdx = -1, wScore = 1e9;
      tm.players.forEach((p, i) => { if (p.red || p.isGK) return; const defensive = (C.LINE_OF[p.slotPos] === 'DEF' ? 0 : 10); const sc = (p.ref.r || 60) + defensive; if (sc < wScore) { wScore = sc; outIdx = i; } });
      if (bi >= 0 && outIdx >= 0) {
        if (this.substitute(t, outIdx, bench[bi])) {
          S.subsMade++; S.lastMin = min;
          this._emit('ai_sub', { team: t, why: 'chasing' });
        }
      }
    }

    // (c) LEITURA DO ATAQUE DO JOGADOR — reforça o lado por onde o rival mais ataca
    const foe = 1 - t;
    const fst = this.stats[foe];
    if (fst && (fst.attacksL != null) && (fst.attacksL + fst.attacksR) >= 4) {
      const leftHeavy = fst.attacksL > fst.attacksR * 1.35;
      const rightHeavy = fst.attacksR > fst.attacksL * 1.35;
      if ((leftHeavy || rightHeavy) && S.sideShift !== (leftHeavy ? 'L' : 'R')) {
        // desloca o bloco defensivo levemente pro lado sob pressão
        const sideSign = leftHeavy ? 1 : -1;   // lado do campo (y) de onde vem o ataque
        for (const p of tm.players) { if (!p.isGK && C.LINE_OF[p.slotPos] === 'DEF') p.hy += sideSign * 2.5; }
        S.sideShift = leftHeavy ? 'L' : 'R';
        this._emit('ai_shift', { team: t, side: S.sideShift });
      }
    }
  }

  // troca de estilo ao vivo (aba Tática): ajusta fx e desloca a linha
  setStyle(team, key) {
    const tm = this.teams[team];
    const styleFx = STYLE_FX[key] || STYLE_NEUTRO;
    const AX = deriveAxes(STYLE_AXES[key] || STYLE_AXES.balanced, key, styleFx);
    const oldBase = tm.baseFx || tm.fx || STYLE_NEUTRO;
    const nf = Object.assign({ ritmo: 1, drible: 1, shoot: 1 }, styleFx);
    nf.line = lerp(-0.100, 0.055, AX.line / 100);
    nf.tackle = lerp(0.80, 1.42, AX.press / 100);
    nf.pressReach = lerp(-0.5, 1.4, AX.press / 100);
    nf.drain = (styleFx.drain || 1) * lerp(0.92, 1.14, AX.press / 100);
    nf.width = AX.width / 100;
    nf.direct = AX.tempo / 100;
    nf.posture = AX.posture / 100;
    nf.far = lerp((styleFx.far || 1) * 0.85, (styleFx.far || 1) * 1.15, AX.tempo / 100);
    const delta = (nf.line - (oldBase.line || 0)) * tm.attackDir * FL;
    for (const p of tm.players) if (!p.isGK) {
      // hx é apenas a posição visual atual; dhx/ahx são as âncoras que o motor
      // reutiliza a cada passo. Os três precisam mudar para a tática persistir.
      p.hx = clamp(p.hx + delta, 2, FL - 2);
      p.dhx = clamp(p.dhx + delta, 2, FL - 2);
      p.ahx = clamp(p.ahx + delta, 2, FL - 2);
    }
    tm.baseFx = Object.assign({}, nf);
    tm._axes = AX;
    tm.styleKey = key;
    this._applyAdaptive(tm, tm.adaptive || this._neutralAdaptive());
    return true;
  }

  // muda os 5 eixos ao vivo (espelha o bloco AXED do _buildTeam)
  setAxes(team, axes) {
    const tm = this.teams[team];
    const styleKey = tm.styleKey || null;
    const styleFx = STYLE_FX[styleKey] || STYLE_NEUTRO;
    const AX = deriveAxes(axes, styleKey, styleFx);
    tm._axes = AX;
    const oldBase = tm.baseFx || tm.fx || STYLE_NEUTRO;
    const nf = Object.assign({}, oldBase);
    const newLine = lerp(-0.100, 0.055, AX.line / 100);
    const delta = (newLine - (oldBase.line || 0)) * tm.attackDir * FL;
    for (const p of tm.players) if (!p.isGK) {
      p.hx = clamp(p.hx + delta, 2, FL - 2);
      p.dhx = clamp(p.dhx + delta, 2, FL - 2);
      p.ahx = clamp(p.ahx + delta, 2, FL - 2);
    }
    nf.line = newLine;
    nf.tackle = lerp(0.80, 1.42, AX.press / 100);
    nf.pressReach = lerp(-0.5, 1.4, AX.press / 100);
    nf.drain = (styleFx.drain || 1) * lerp(0.92, 1.14, AX.press / 100);
    nf.width = AX.width / 100;
    nf.direct = AX.tempo / 100;
    nf.posture = AX.posture / 100;
    nf.far = lerp((styleFx.far || 1) * 0.85, (styleFx.far || 1) * 1.15, AX.tempo / 100);
    tm.baseFx = nf;
    this._applyAdaptive(tm, tm.adaptive || this._neutralAdaptive());
    return true;
  }

  /* ----------------------------- ESTADO ------------------------------- */
  getState() {
    return {
      minute: Math.floor(this.minute), half: this.half, stoppage: Math.ceil(this.stoppage),
      score: [...this.score], momentum: this.momentum, beat: this.beat > 0,
      ball: { x: this.ball.x/FL, y: this.ball.y/FW, z: this.ball.z, traveling: this.ball.traveling,
        kind: this.ball.traveling ? this.ball.kind : null,
        from: this.ball.traveling && this.ball.from ? { x: this.ball.from.x/FL, y: this.ball.from.y/FW } : null,
        target: this.ball.traveling && this.ball.target ? { x: this.ball.target.x/FL, y: this.ball.target.y/FW } : null },
      teams: this.teams.map(tm => ({
        side: tm.side, color: tm.color,
        players: tm.players.map(p => ({
          x: p.x/FL, y: p.y/FW, n: p.ref.n, num: p.ref.num, slot: p.slotPos,
          hasBall: this.ball.owner === p, rating: Math.round(p.rating*10)/10,
          stamina: Math.round(p.stamina), yellow: p.yellow, red: p.red, ref: p.ref
        }))
      })),
      stats: this.stats
    };
  }
}

const OUT = { MatchSim, FL, FW };
if (typeof module !== 'undefined' && module.exports) module.exports = OUT;
if (typeof root !== 'undefined') Object.assign(root, OUT);
})(typeof window !== 'undefined' ? window : globalThis);


