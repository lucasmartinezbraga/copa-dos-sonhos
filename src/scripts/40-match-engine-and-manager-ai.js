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
  version: '4.3.2',
  context: Object.freeze({
    pressureRadius: 5.4,
    lateMinute: 74,
    /* OS-201 · relogio em que o dreno de stamina foi calibrado. Serve so para
       normalizar a fadiga por minuto de jogo; nao muda o relogio do jogo, que
       vive em ENGINE_CALIBRATION.timing.clockRate. */
    clockRateRef: 0.13,
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
    aerialSetPieceBoost: 0.15,
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
    if (_chem >= 3) { t._chem = _chem; }   /* §19/§41: sem multiplicador global de química */
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
        react: clamp((lerp(0.255, 0.075,
          (getAttr(p,'posicionamento') * 0.45 + getAttr(p,'antecipacao') * 0.35 +
           getAttr(p,'trabalho_equipe') * 0.20) / 100) + R(-0.018, 0.018)) *
          (1 - ((sl.persistence || p._phase10Persistence || {}).roleFamiliarity || 0) * .03), 0.062, 0.27),
        stamina: clamp(Number(sl.initialStamina != null ? sl.initialStamina : (p._phase10InitialStamina != null ? p._phase10InitialStamina : 100)), 35, 100),
        persistence: sl.persistence || p._phase10Persistence || null,
        rating: 6.0, settle: 0,
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
    this.visualIntegrity = {
      contacts:0, failedContacts:0, travelFaults:0, teleports:0,
      saves:0, blocks:0, penaltySaves:0, postContacts:0,
      maxSubframeCorrection:0
    };
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
      goalkeeping:{shotsFaced:st.gkShotsFaced,secureCatches:st.gkSecureCatches,parries:st.gkParries,rebounds:st.reboundsConceded,sweeps:st.gkSweeps,sweepsFailed:st.gkSweepsFailed,claimsAttempted:st.gkClaimsAttempted,claimsWon:st.gkClaimsWon,claimsMissed:st.gkClaimsMissed,punches:st.gkPunches,distribution:{short:st.gkDistributionShort,long:st.gkDistributionLong,completed:st.gkDistributionCompleted,failed:st.gkDistributionFailed}},
      setPieces:{shots:st.setPieceShots,goals:st.setPieceGoals,firstContactWon:st.setPieceFirstContactWon,firstContactLost:st.setPieceFirstContactLost,corners:{nearPost:st.cornersNearPost,farPost:st.cornersFarPost,penaltySpot:st.cornersPenaltySpot,short:st.cornersShort},freeKicks:{direct:st.freeKickDirect,crossed:st.freeKickCrossed,short:st.freeKickShort},penalties:{taken:st.penaltiesTaken,scored:st.penaltiesScored,saved:st.penaltiesSaved,missed:st.penaltiesMissed}},
      roles:tm.players.map(p=>({id:p.ref&&p.ref.id,name:p.ref&&p.ref.n,position:p.slotPos,inPossessionPosition:p.ipPos||p.slotPos,outOfPossessionPosition:p.oopPos||p.slotPos,inPossession:p.ipRole||p.role,outOfPossession:p.oopRole,focus:p.focus,stamina:Math.round(p.stamina),rating:+(p.rating||6).toFixed(2)})),
      heatmaps:tm.players.map(p=>({id:p.ref&&p.ref.id,name:p.ref&&p.ref.n,cols:ADV4.analytics.cols,rows:ADV4.analytics.rows,values:p.heatmap?Array.from(p.heatmap):[]})),
      passingMap:Object.entries(st.passingMap||{}).map(([link,count])=>({link,count})),
      visualIntegrity:Object.assign({},this.visualIntegrity||{}),
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
    gkShotsFaced:0, gkSecureCatches:0, gkParries:0, reboundsConceded:0, gkDoubleCatches:0,
    gkDistToFullback:0, gkDistToCenterBack:0, gkDistToMidfield:0, gkDistToForward:0,
    cornersInswinger:0, cornersOutswinger:0,
    gkSweepsFailed:0, gkClaimsAttempted:0, gkClaimsWon:0, gkClaimsMissed:0, gkPunches:0,
    gkDistributionShort:0, gkDistributionLong:0, gkDistributionCompleted:0, gkDistributionFailed:0,
    setPieceFirstContactWon:0, setPieceFirstContactLost:0,
    cornersNearPost:0, cornersFarPost:0, cornersPenaltySpot:0, cornersShort:0,
    cornerDefZonal:0, cornerDefMan:0, cornerDefMixed:0,
    freeKickDirect:0, freeKickCrossed:0, freeKickShort:0,
    penaltiesTaken:0, penaltiesScored:0, penaltiesSaved:0, penaltiesMissed:0,
    passingMap:Object.create(null), heatSamples:0
  }; }

  _resetPositions() {
    for (const tm of this.teams) for (const p of tm.players) {
      if (p.red) continue;
      p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0; p.settle = 0; p._setPieceRole = null;
    }
  }

  /* O lado do usuário define apenas qual adversário recebe decisões da IA.
     Toda finalização e bola parada é resolvida pela mesma fórmula do motor. */
  setInteractive(team) { this.interactiveTeam = team; if (team === 0 || team === 1) this._aiTeam = 1 - team; }

  /* Suspende somente o relógio/física enquanto o jogador prepara a cobrança.
     O callback resolve uma única vez e devolve o controle ao motor. */
  _requestSetPiece(kind, data, execute) {
    /* MOTOR VISUAL · minigames de falta e pênalti DESATIVADOS: as cobranças
       resolvem no motor com voo real e goleiro convergindo. A arquitetura de
       requisição fica preservada para reconexão futura sobre a base coerente. */
    return false;
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
          this._legendFired = true;
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
      /* OS-201 · A FADIGA SEGUE O RELOGIO DA PARTIDA, NAO O DO SIMULADOR.
         O dreno usava `dt` cru, ou seja dependia de quantos SEGUNDOS DE
         SIMULACAO a partida levasse. Como `clockRate` decide justamente essa
         relacao, baixar o relogio para caber mais jogo fazia o time acabar
         exausto sem que nada no futebol tivesse mudado: medido, a stamina final
         caia de 57,8 para 50,3 so por trocar 0,13 por 0,085.

         Um jogador se cansa por jogar 90 minutos, nao por o simulador demorar.
         Normalizando pelo clockRate de referencia (aquele em que este dreno foi
         calibrado), o gasto passa a ser por minuto de jogo e o numero fica
         igual em qualquer relogio — em 0,13 o fator e exatamente 1, entao a
         normalizacao em si nao mexe na calibracao existente.

         O MODULO do dreno, esse sim, foi reduzido em 27%: a stamina final media
         era 57,4 contra um minimo de design de 64 (alvo 73), e isso valia tanto
         no relogio antigo quanto no novo — era erro proprio, nao efeito do
         clockRate. Times terminando a 57% faziam o futebol do fim de jogo pior
         do que o desenho pedia. Com 0,040 / 0,0088 a media final fica em 63,9,
         a um decimo do minimo de 64.

         TENTEI AFROUXAR MAIS (0,0375 / 0,0083) para ganhar folga e REVERTI:
         poe a stamina em 65,1, dentro da faixa, mas jogador mais inteiro muda
         o jogo inteiro — o acerto ao alvo cai de 0,361 para 0,337 (min 0,34) e
         o 0 a 0 sobe de 0,092 para 0,125 (max 0,12). Placar geral de 10/13
         para 9/13. Ficar a um decimo do minimo numa metrica custa menos do que
         derrubar duas outras. */
      const clockNorm = CAL.timing.clockRate / ADV4.context.clockRateRef;
      /* OS-201 · FOLEGO NA BOLA PARADA.
         O motor só sabia gastar: não havia recuperação nenhuma, e o dreno
         rodava inclusive com o jogo parado. Mas é justamente na bola parada
         que um jogador recupera — falta, escanteio, lateral, comemoração de
         gol. Sem isso a stamina final ficava em 63,9 contra um mínimo de
         design de 64.

         Recuperar aqui é melhor do que afrouxar o dreno geral, que foi o que
         tentei antes: baixar o dreno deixa o jogador mais inteiro DURANTE o
         jogo e muda o futebol inteiro (o acerto ao alvo caiu e o 0 a 0 subiu).
         Isto mexe só no que acontece com o relógio parado. */
      if (this.dead > 0) {
        p.stamina = clamp(p.stamina + CAL.timing.deadBallRecovery * dt * clockNorm
          * (0.6 + getAttr(p,'resistencia')/100 * 0.6), 32, 100);
        continue;
      }
      p.stamina = clamp(p.stamina - (moving ? 0.040 : 0.0088) * dt * clockNorm * (2 - getAttr(p,'resistencia')/100) * this.teams[p.team].fx.drain * lateDrain * pressDuty, 32, 100);
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
    const persist = p && p.persistence ? p.persistence : null;
    const importanceExtra = persist ? (persist.importanceExtra || 0) : 0;
    let execution = 1 - pressure * ADV4.context.pressureExecution * (1.08 - comp * .48)
      - fatigue * ADV4.context.fatigueExecution
      - (importance + importanceExtra) * (1 - comp) * .55;
    if (persist) {
      execution += persist.executionBonus || 0;
      if (action === 'shot') execution += persist.shotBonus || 0;
      if (action === 'press' || action === 'defend') execution += persist.defensiveBonus || 0;
    }
    if (action === 'press') execution *= 0.88 + getAttr(p,'resistencia')/100 * .18;
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
    if(!best){
      this.stats[o.team].gkDistributionLong++;
      this.stats[o.team].gkDistributionFailed++;
      this._clearBall(o); return;
    }
    const distKind = best.dist > 30 || direct > .66 ? 'long' : 'short';
    this.stats[o.team][distKind === 'long' ? 'gkDistributionLong' : 'gkDistributionShort']++;
    // distribuição direcionada (auditoria Fase 8): registra a FUNÇÃO do alvo
    // real da reposição — lateral, zagueiro, meio ou ataque
    const rp = String(best.m && best.m.slotPos || '');
    this.stats[o.team][/CB/.test(rp) ? 'gkDistToCenterBack'
      : /WB$|^LB$|^RB$/.test(rp) ? 'gkDistToFullback'
      : /M$/.test(rp) ? 'gkDistToMidfield' : 'gkDistToForward']++;
    o._gkDistributionPending = true;
    const ctx=this._actionContext(o,nearest,'pass');
    const bad=clamp(.18-(skill-55)/250 + ctx.pressure*.12 + ctx.fatigue*.05, .025,.28);
    if(chance(bad)){
      this.stats[o.team].gkBadDistribution++;
      this.stats[o.team].gkDistributionFailed++;
      o._gkDistributionPending = false;
      this._emit('gk_bad_distribution',{by:o});
      // R9: distribuição ruim continua sendo ruim, mas não é chutada para uma
      // coordenada vazia. Ela erra ao redor do alvo real, permitindo disputa e
      // interceptação sem deixar a bola morrer parada no campo.
      const intended = best && best.m && !best.m.red ? best.m : null;
      const bx = intended ? intended.x : clamp(o.x + tm.attackDir * 18, 2, FL - 2);
      const by = intended ? intended.y : clamp(o.y, 2, FW - 2);
      const dx = bx-o.x, dy = by-o.y, dl = Math.max(.001,Math.hypot(dx,dy));
      const err = (direct>.6 ? 2.8 : 1.8) + R(0,1.8) + ctx.pressure*1.1;
      const side = chance(.5)?-1:1;
      const tx=clamp(bx + (-dy/dl)*side*err + (dx/dl)*R(-.7,.7),2,FL-2);
      const ty=clamp(by + ( dx/dl)*side*err + (dy/dl)*R(-.7,.7),2,FW-2);
      this._startTravel(o,{x:tx,y:ty},'pass',()=> intended ? this._receive(intended) : this._contestLoose(),intended,direct>.6?'launch':'short',{gkBadDistribution:true});
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
    /* R18.17.2 · APROXIMAÇÃO ANTES DO CHUTE
       A terceira alternativa que faltava: quando um chute distante é pior que
       avançar por um corredor realmente livre, o portador NÃO encerra a jogada.
       Ele conduz em direção ao gol para aumentar o xG. A escolha é determinística;
       o RNG continua reservado à execução física das ações. */
    if (shotDecision.approach) {
      const recent=(o._r18172ApproachUntil||0)>this.t?(o._r18172ApproachCount||0):0;
      o._r18172ApproachCount=recent+1;o._r18172ApproachUntil=this.t+2.4;
      this._emit('shot_deferred',{by:o,reason:'improve_xg',dtg:+dtg.toFixed(2),projectedDtg:+shotDecision.projectedDtg.toFixed(2),laneQuality:+shotDecision.laneQuality.toFixed(3),blockers:shotDecision.blockers,shotUtility:+shotDecision.shotUtility.toFixed(4),approachUtility:+shotDecision.approachUtility.toFixed(4),longshot:!!shotDecision.longshot});
      this._carry(o,g); return;
    }
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
    /* OS-12 · mesmo criterio de inBox de :5304. Sem companheiro na area nao
       existe cruzamento: antes disso o sorteio subia a bola para ninguem. */
    const _os12Alvo = tm.players.some(m => m !== o && !m.red && !m.isGK && D(m.x, m.y, g.x, g.y) < 24);
    /* OS-27 · perto do gol o ponta decide, nao cruza por reflexo. */
    if (this._canCross(o) && _os12Alvo && dtg > 23 && chance(crossP)) { this._cross(o); return; }

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
    let cone = 0; { const _cdx = Math.sign(g.x - o.x), _cl = 6.5, _cr0 = 2.6, _cab = 0.30; for (const d of opps) { if (d.red || d.isGK) continue;   const _fx = (d.x - o.x) * _cdx;   if (_fx <= 0 || _fx >= _cl) continue;   if (Math.abs(d.y - o.y) < _cr0 + _fx * _cab) cone++; } }
    { const _cnDri = getAttr(o, 'drible'), _cnAcc = getAttr(o, 'aceleracao'); const _cnTeto = ((_cnDri + _cnAcc) / 2 >= 55) ? 2 : 0; if (cone <= _cnTeto && dtg > 6) { this._carry(o, g); return; } }
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
    const g = tm.oppGoal, dir=tm.attackDir||1;
    const longAttr = getAttr(o, 'chute_longe');
    const technique = o.ref && o.ref.a8 ? o.ref.a8[7] : getAttr(o,'conducao');
    const decision=getAttr(o,'decisao'), dribble=getAttr(o,'drible');
    const acceleration=getAttr(o,'aceleracao'), composure=getAttr(o,'compostura')/100;
    const eliteLong = longAttr >= 84 && technique >= 82;

    /* Alcances honestos: 38 m fazia até especialistas tratarem uma tentativa
       remota como ação normal. O chute muito longo continua existindo, mas só
       para especialistas reais e nunca substitui uma aproximação claramente
       superior. */
    const maxRange = longAttr>=92&&technique>=86 ? 33
      : longAttr>=87&&technique>=83 ? 30
      : eliteLong ? 27.5
      : longAttr>=76&&technique>=72 ? 24.5
      : longAttr>=68 ? 22.5 : 20.5;

    const nearestDef = this._nearestOpponent(o).dist;
    const oneOnOne = dtg < 19 && (nearestDef > 5.4 || (o._throughReceiverUntil||0) > this.t);
    const base = distanceXg(dtg);
    const longshot = !oneOnOne && (dtg > 21 || (dtg > 18.5 && eliteLong));
    const skill = facet(o, oneOnOne ? 'one_on_one' : (longshot ? 'shot_far' : 'shot')) / 100;
    const angle = clamp(1 - Math.abs(o.y - g.y) / 42, 0.30, 1);
    const ctx = this._actionContext(o, nearestDist, 'shot');
    const scoreDiff = this.score[o.team] - this.score[1-o.team];
    const urgency = this.minute > 76 && scoreDiff < 0 ? .044 : 0;
    const restraint = this.minute > 70 && scoreDiff > 0 ? .028 : 0;
    const traitIntent = T && T.finalizador ? .025 : 0;
    const styleIntent = (tm.fx.shoot || 1) * (tm.mood.far || 1);
    const oneBoost = oneOnOne ? .13 + composure*.06 : 0;
    const longBoost = longshot && longAttr>=87 && technique>=84 ? .022 : 0;
    const shotUtility = base * angle * (.70 + skill*.72) * ctx.execution * styleIntent
      + composure*.030 + urgency + traitIntent + oneBoost + longBoost - restraint;
    const passUtility = best
      ? clamp(.055 + best.score*.045 + (best.intoBox?.17:0) - best.risk*.022, .025,.44)
      : .035;

    /* Lê um corredor de condução de 11 m, mais estreito perto do portador e
       ligeiramente mais largo adiante. Não basta estar "sem pressão": precisa
       haver espaço físico utilizável para avançar. */
    let blockers=0, closestFront=99;
    for(const d of this.teams[1-o.team].players){
      if(d.red||d.isGK)continue;
      const fx=(d.x-o.x)*dir, fy=Math.abs(d.y-o.y);
      if(fx>0&&fx<12&&fy<4.2+fx*.24){blockers++;closestFront=Math.min(closestFront,Math.hypot(d.x-o.x,d.y-o.y));}
    }
    const laneQuality=clamp(1-blockers*.42+clamp((nearestDist-3.0)/9,0,.24)+(closestFront>8?.10:0),0,1);
    const carrySkill=clamp((dribble*.36+acceleration*.24+decision*.24+technique*.16)/100,.48,.98);
    const advance=clamp(4.2+laneQuality*4.1+(carrySkill-.5)*3.0,4.2,9.4);
    const projectedDtg=Math.max(8.5,dtg-advance);
    const projectedXg=distanceXg(projectedDtg)*angle;
    const approachGain=Math.max(0,projectedXg-base*angle);
    const approachUtility=(projectedXg*(.68+carrySkill*.37)+approachGain*.72)
      *(0.82+laneQuality*.30)-blockers*.018-(nearestDist<4.2?.025:0);

    const recentApproaches=(o._r18172ApproachUntil||0)>this.t?(o._r18172ApproachCount||0):0;
    const firstTime=o.settle>0&&o.settle<.45;
    const specialistIntent=eliteLong&&longAttr>=88&&technique>=84&&angle>=.60&&!pressured;
    const emergency=this.minute>82&&scoreDiff<0;
    const canApproach=!oneOnOne&&!firstTime&&dtg>18.2&&dtg<34&&!pressured
      &&nearestDist>3.35&&blockers<=1&&laneQuality>=.43&&recentApproaches<2;

    if(dtg>maxRange){
      const approach=canApproach&&approachUtility>=passUtility*.68;
      return {take:false,approach,longshot,oneOnOne,projectedDtg,laneQuality,blockers,shotUtility,approachUtility};
    }

    const minimum = oneOnOne?.05:dtg<10?.045:dtg<16?.052:dtg<21?.062:dtg<25?.082:.105;
    const longPermission = !longshot || (!pressured && longAttr>=70 && technique>=72);
    const choiceRatio = oneOnOne?.22:longshot?.82:.38;
    let take=longPermission&&shotUtility>=minimum&&shotUtility>=passUtility*choiceRatio;

    /* Um especialista pode manter a assinatura de longe, mas só quando seu
       próprio valor de chute se aproxima do ganho da condução. Jogador comum
       precisa preferir claramente o avanço. */
    const preserveSpecialist=(specialistIntent||emergency)&&shotUtility>=approachUtility*.78;
    const approach=canApproach&&!preserveSpecialist&&approachUtility>shotUtility*(longshot?.86:.98)
      &&approachUtility>=passUtility*.64;
    if(approach)take=false;
    return {take,approach,longshot,oneOnOne,projectedDtg,laneQuality,blockers,shotUtility,approachUtility};
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
    const p10SetPiece = setPiece && o.persistence ? (o.persistence.setPieceBonus || 0) : 0;
    const crossSkill = setPiece ? facet(o,'setpiece') * (1 + p10SetPiece) : facet(o,'low_cross');
    const lowTargets = lowPool.slice().sort((a,b)=>
      (facet(b,'offball')*.34+facet(b,'one_on_one')*.38+getAttr(b,'ritmo')*.28)
      -(facet(a,'offball')*.34+facet(a,'one_on_one')*.38+getAttr(a,'ritmo')*.28));
    const aerialTargets = inBox.slice().sort((a,b)=>facet(b,'head_atk')-facet(a,'head_atk'));
    const bestLow = lowTargets[0], bestAir = aerialTargets[0];
    const aerialAdv = bestAir ? facet(bestAir,'head_atk') - (bestLow?facet(bestLow,'one_on_one'):60) : -20;
    const lowP = clamp(ADV4.crossing.lowCrossBase + crossSkill/260 + (nearByline?.17:0) - Math.max(0,aerialAdv)/280 + (setPiece?-.22:0), .30, .82);
    /* OS-12 · sem alvo aereo, o rasteiro deixa de ser sorteado e passa a ser
       a escolha. Antes, a ausencia de bestLow levantava a bola por omissao. */
    const delivery = !setPiece && bestLow && (!bestAir || chance(lowP)) ? 'low' : 'air';
    this._emit('cross',{by:o,delivery,setPiece});

    if(delivery==='low'){
      this.stats[o.team].lowCrosses++;
      const atk=bestLow;
      const nearPostY = o.y<FW/2 ? g.y-2.8 : g.y+2.8;
      const target={x:g.x-tm.attackDir*5.2,y:clamp(lerp(atk.y,nearPostY,.72),g.y-7,g.y+7)};
      const def=defs.slice().sort((a,b)=>D(a.x,a.y,target.x,target.y)-D(b.x,b.y,target.x,target.y))[0];
      const atkScore=facet(atk,'offball')*.38+facet(atk,'one_on_one')*.34+getAttr(atk,'ritmo')*.18+crossSkill*.10;
      const defScore=def ? facet(def,'def_position')*.48+facet(def,'intercept')*.32+getAttr(def,'ritmo')*.20 : 45;
      let lowCrossWon=chance(duelProb(atkScore+6,defScore));
      const crossSpeed=26*(.85+facet(o,'pass')/100*.35);
      const physicalCrossBlock=(!lowCrossWon&&def)?this._actorInterceptTarget(def,this.ball.x,this.ball.y,target,crossSpeed,2.05,'pass','through'):null;
      // O duelo probabilístico só pode virar bloqueio quando existe encontro
      // físico alcançável na trajetória. Caso contrário, o cruzamento segue.
      /* OS-45 · o defensor venceu o duelo e nao alcanca fisicamente. Isso nao
         e vitoria do atacante — e entrega ERRADA. A linha antiga convertia toda
         derrota defensiva sem contato em sucesso do cruzamento, o que fazia o
         rasteiro quase nunca falhar. */
      if(!lowCrossWon&&!physicalCrossBlock){
        this.stats[o.team].crossesBad=(this.stats[o.team].crossesBad||0)+1;
        this._emit('cross_ruim',{by:o,kind:'low'});
        const _o45y=clamp(target.y+(chance(.5)?1:-1)*R(5,10),2,FW-2);
        this._startTravel(o,{x:clamp(target.x-tm.attackDir*R(0,3.5),2,FL-2),y:_o45y},'pass',()=>{
          const _b=this.ball;
          _b.owner=null;_b.traveling=false;_b.meta=null;_b.receiver=null;_b.onArrive=null;
          _b._looseT=0;_b.__r10Pass=null;_b.__p04PendingReceiver=null;_b.__p04Live=true;
        },null,'through');
        return;
      }
      if(!lowCrossWon){
        this._startTravel(o,physicalCrossBlock,'pass',()=>{
          const _cv=this._physicalContactValid(def,2.05,this.ball.z),contactD=_cv.horizontal;
          if(!_cv.ok){
            this.visualIntegrity.failedContacts++;
            this._emit('visual_contact_failed',{kind:'cross_block',by:def,distance:contactD});
            this._looseBall(this.ball.x,this.ball.y);
            return;
          }
          this._recordVisualContact('cross_block',def,this.ball.x,this.ball.y,{distance:contactD,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface});
          this._emit('blocked',{by:def,kind:'cross',contact:{x:this.ball.x,y:this.ball.y,distance:contactD}});
          if(chance(.42)) this._setCorner(o.team); else this._turnover(def);
        },atk,'through',{outcome:'block',actor:def,contactRadius:2.05,targetZ:physicalCrossBlock.z,interceptT:physicalCrossBlock.t});
        return;
      }
      this._startTravel(o,target,'pass',()=>{
        /* OS-81 · vencer o duelo abstrato nao teleporta o atacante ao ponto
           da entrega. O mesmo raio de coleta de _looseRoll (1,70 m) decide se
           houve contato. Sem ele, a bola segue viva e ninguem ganha posse por
           decreto. */
        const _os81cv=this._physicalContactValid(atk,1.7,this.ball.z);
        if(!_os81cv.ok){
          this.stats[o.team].crossesBad=(this.stats[o.team].crossesBad||0)+1;
          this._emit('low_cross_no_contact',{by:atk,from:o,distance:_os81cv.horizontal,
            z:_os81cv.z,maxZ:_os81cv.maxZ,radius:1.7});
          const _os81b=this.ball;
          _os81b.owner=null;_os81b.traveling=false;_os81b.meta=null;
          _os81b.receiver=null;_os81b.onArrive=null;_os81b._looseT=0;
          /* OS-83 · a viagem acabou; a sobra agora pertence a _looseRoll. */
          _os81b.__r10Pass=null;_os81b.__p04PendingReceiver=null;
          _os81b.__p04Live=true;
          return;
        }
        this._recordVisualContact('low_cross_receive',atk,this.ball.x,this.ball.y,
          {distance:_os81cv.horizontal,z:_os81cv.z,maxZ:_os81cv.maxZ,surface:_os81cv.surface});
        this.stats[o.team].crossesOk++; this.stats[o.team].lowCrossesOk++;
        this.stats[o.team].shots++; this.stats[o.team].keyPasses++;
        const ctx=this._actionContext(atk,def?D(atk.x,atk.y,def.x,def.y):8,'shot');
        const finish=facet(atk,'one_on_one'), keeper=gk?facet(gk,'gk_one_on_one'):45;
        const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);
        this.stats[o.team].xg+=pGoal;
        this._emit('low_cross_shot',{by:atk,from:o,xg:pGoal});
        if(setPiece){ this.stats[o.team].setPieceShots++; atk._setPieceShotUntil=this.t+1; }
        // MOTOR VISUAL: o chute do rasteiro VOA até o gol antes de resolver —
        // o goleiro converge durante o voo e o contato acontece no ponto real
        const lcDir=this.teams[atk.team].attackDir;
        /* OS-200 · mesma inversao do chute de bola rolando: a finalizacao do
           cruzamento rasteiro tambem era sorteada antes da bola sair do pe.
           Forca menor que a de um chute armado — e uma finalizacao de
           primeira, nao uma bomba. */
        if(this._os200ResolverChute){
          this._os200ResolverChute(atk,{g,tm:this.teams[atk.team],gk,atk:finish,pGoal,
            dtg:D(atk.x,atk.y,g.x,g.y),longshot:false,volley:false,oneOnOne:true,
            forca:clamp(20+finish/100*8,18,29),
            finishPlan:{type:'placed',dispersionMul:1,speedMul:1},gkScrambling:false});
          return;
        }
        if(chance(pGoal)) this._startTravel(atk,{x:g.x+lcDir*.9,y:clamp(g.y+R(-3,3),g.y-3.3,g.y+3.3)},'shot',()=>this._goal(atk,false),null,'shot');
        else {
          const goalAim={x:g.x+lcDir*.9,y:clamp(g.y+R(-2.5,2.5),g.y-3.3,g.y+3.3)};
          const shotSpeed=clamp(34+facet(atk,'shot')/100*16,32,54);
          const st=this._gkInterceptTarget(gk,atk.x,atk.y,goalAim,shotSpeed,1.95);
          if(chance(.48+(gk?facet(gk,'gk')/300:0))&&st){
            this._startTravel(atk,st,'shot',()=>this._gkResolveSave(gk,atk,{atk:finish,oneOnOne:true,saveTarget:st,g,tm:this.teams[atk.team],cornerChance:CAL.restarts.lowCrossSaveCorner}),null,'shot',{outcome:'save',actor:gk,contactRadius:1.95,interceptT:st.t});
          } else this._startTravel(atk,{x:g.x+lcDir*2,y:g.y+(chance(.5)?1:-1)*R(3.4,6.4)},'shot',()=>{this._emit('miss',{by:atk});this._goalKickOrRestart(1-o.team);},null,'shot');
        }
        /* fim da resolução física do chute rasteiro */
      },atk,'through');
      return;
    }

    const atk=bestAir;
    const deliveryFail = clamp(.34-(crossSkill-55)/210-(setPiece?.08:0),.10,.43);
    if(!atk || chance(deliveryFail)){
      /* §R18.25 · o alvo era {x:g.x}, EM CIMA da linha de gol — 5,6 m atrás do
         goleiro e atrás de toda a defesa. Ninguém disputava porque ninguém está
         na própria linha de gol. Agora cai entre a pequena área e a marca do
         pênalti, mesma geometria que o ramo rasteiro já usa (g.x - dir*5.2). */
      const __alvo={x:g.x-tm.attackDir*(5.5+R(0,5.5)),y:FW/2+R(-8,8)};
      this._startTravel(o,__alvo,'pass',()=>{
        /* §R18.31 · a bola NÃO é resolvida: ela segue. Quem alcançar (1,7 m,
           regra do _looseRoll) fica com ela; se ninguém alcançar, ela cruza a
           linha e o reinício nasce de _ballOut, que já deriva escanteio ou
           tiro de meta do último toque real. Nada de _looseBall aqui: aquele
           entrega a bola ao mais próximo sem limite de distância. */
        const _b=this.ball;
        _b.owner=null; _b.traveling=false; _b.meta=null; _b.receiver=null; _b.onArrive=null;
        let _vx=Number.isFinite(_b.vx)?_b.vx:0, _vy=Number.isFinite(_b.vy)?_b.vy:0;
        const _v=Math.hypot(_vx,_vy);
        if(!(_v>7)){
          /* a bola tem de MANTER a jogada viva: segue no rumo da entrega. */
          const _dx=__alvo.x-o.x, _dy=__alvo.y-o.y, _L=Math.max(.001,Math.hypot(_dx,_dy));
          _vx=_dx/_L*7; _vy=_dy/_L*7;
        }
        _b.vx=_vx; _b.vy=_vy; _b.vz=Math.min(0,Number.isFinite(_b.vz)?_b.vz:0);
        _b._looseT=0;_b.__r10Pass=null;_b.__p04PendingReceiver=null;_b.__p04Live=true;
        this._emit('cross_livre',{by:o,x:_b.x,y:_b.y});
      },null,'launch');
      return;
    }
    /* OS-45 · a entrega aerea mirava a cabeca do atacante EXATAMENTE, sempre.
       Medido: praticamente todo cruzamento encontrava alguem (44,7% chute +
       38,0% corte + 22% defesa), contra 25 a 30% que no futebol real nao acham
       ninguem. A precisao passa a depender de quem cruza. */
    {
      const _o45ok=clamp(0.34+crossSkill/260+(nearByline?.08:0)+(setPiece?.14:0),0.40,0.82);
      if(!chance(_o45ok)){
        this.stats[o.team].crossesBad=(this.stats[o.team].crossesBad||0)+1;
        const _lado=chance(.5)?1:-1;
        const _mx=clamp(g.x-tm.attackDir*R(-1.5,6.5),2,FL-2);
        const _my=clamp(g.y+_lado*R(9,15.5),2,FW-2);
        this._emit('cross_ruim',{by:o,x:_mx,y:_my});
        this._startTravel(o,{x:_mx,y:_my},'pass',()=>{
          /* mesma saida do cruzamento livre (R18.31): a bola SEGUE viva. */
          const _b=this.ball;
          _b.owner=null;_b.traveling=false;_b.meta=null;_b.receiver=null;_b.onArrive=null;
          let _vx=Number.isFinite(_b.vx)?_b.vx:0,_vy=Number.isFinite(_b.vy)?_b.vy:0;
          if(!(Math.hypot(_vx,_vy)>7)){
            const _dx=_mx-o.x,_dy=_my-o.y,_L=Math.max(.001,Math.hypot(_dx,_dy));
            _vx=_dx/_L*7;_vy=_dy/_L*7;
          }
          _b.vx=_vx;_b.vy=_vy;_b.vz=Math.min(0,Number.isFinite(_b.vz)?_b.vz:0);
          _b._looseT=0;_b.__r10Pass=null;_b.__p04PendingReceiver=null;_b.__p04Live=true;
        },null,'launch');
        return;
      }
    }
    const def=defs.slice().sort((a,b)=>D(a.x,a.y,atk.x,atk.y)-D(b.x,b.y,atk.x,atk.y))[0];
    this._startTravel(o,{x:atk.x,y:atk.y},'pass',()=>{
      const setBoost=setPiece?(ADV4.crossing.aerialSetPieceBoost+p10SetPiece)*90:0;
      const sw=(o._deliverySwingUntil||0)>this.t?o._deliverySwing:null;
      /* OS-44 · o duelo aereo ignorava a distancia: `def` era o defensor mais
         proximo do atacante SEM LIMITE, entao um zagueiro a 15 m disputava com
         o atributo dele e um zagueiro colado nao ganhava nada por estar colado.
         Medido: 68,6% dos cruzamentos viravam finalizacao contra ~25% reais. */
      const _o44d=def?D(def.x,def.y,atk.x,atk.y):99;
      const _o44prox=clamp((3.2-_o44d)*9,-22,22);
      const pWin=duelProb(facet(atk,'head_atk')+setBoost+(sw==='in'?2.5:0),(def?facet(def,'head_def'):40)+5+_o44prox);
      /* OS-201 · O DUELO AEREO NAO GERA FALTA, E TENTEI CORRIGIR ISSO.
         E de fato uma categoria que nao existe no motor — empurrao nas costas,
         cotovelada, subir por cima —, e as faltas ficam em 15,3 por partida
         contra um minimo de design de 16. Mas acrescentar falta aqui rendeu
         +0,05 falta: o duelo aereo acontece pouco demais para mover o numero,
         e ainda custou stamina e acerto ao alvo (12/13 virou 11/13).

         Somando a tentativa de subir `foulBase` (mesmo resultado, ver
         20-core.js), a conclusao esta medida duas vezes: o volume de faltas
         nao sai da probabilidade POR DUELO, sai de QUANTOS DUELOS acontecem
         por partida. Consertar de verdade exige mexer na densidade de disputa,
         nao numa constante de probabilidade. */
      if(chance(pWin)){
        this.stats[o.team].crossesOk++; this.stats[o.team].shots++; this.beat=.5;
        if(setPiece)this.stats[o.team].setPieceFirstContactWon++;
        const pGoal=clamp(.105*(1+(facet(atk,'head_atk')-(gk?facet(gk,'gk'):40))/100*.9)*(setPiece?.62:1),setPiece?.012:.012,setPiece?.110:.28);
        this.stats[o.team].xg+=pGoal;
        if(setPiece){this.stats[o.team].setPieceShots++;atk._setPieceShotUntil=this.t+1;}
        this._emit('header_shot',{by:atk,xg:pGoal,setPiece});
        // MOTOR VISUAL: o cabeceio VOA até o gol antes de resolver — nada de
        // defesa instantânea com o goleiro a 10m do lance
        const hdDir=this.teams[atk.team].attackDir;
        /* OS-200 · o cabeceio tambem sorteava o desfecho antes. A forca vem
           do cabeceio, nao do chute: bola de cabeca sai bem mais devagar, e
           usar a faixa do chute daria ao goleiro tempo nenhum. */
        if(this._os200ResolverChute){
          this._os200ResolverChute(atk,{g,tm:this.teams[atk.team],gk,atk:facet(atk,'head_atk'),pGoal,
            dtg:D(atk.x,atk.y,g.x,g.y),longshot:false,volley:false,oneOnOne:false,
            forca:clamp(13+facet(atk,'head_atk')/100*7,12,21),
            finishPlan:{type:'power',dispersionMul:1,speedMul:1},gkScrambling:false});
          return;
        }
        if(chance(pGoal))this._startTravel(atk,{x:g.x+hdDir*.9,y:clamp(g.y+R(-3,3),g.y-3.3,g.y+3.3)},'shot',()=>this._goal(atk,false),null,'shot');
        else{
          const hr=R();
          const goalAim={x:g.x+hdDir*.9,y:clamp(g.y+R(-3,3),g.y-3.3,g.y+3.3)};
          const shotSpeed=clamp(34+facet(atk,'shot')/100*16,32,54);
          const st=this._gkInterceptTarget(gk,atk.x,atk.y,goalAim,shotSpeed,1.95);
          const saveShare=st?.27+(gk?facet(gk,'gk')/100:.4)*.12:0;
          if(hr<saveShare&&st){
            this._startTravel(atk,st,'shot',()=>this._gkResolveSave(gk,atk,{atk:facet(atk,'head_atk'),oneOnOne:false,saveTarget:st,g,tm:this.teams[atk.team],cornerChance:CAL.restarts.aerialSaveCorner}),null,'shot',{outcome:'save',actor:gk,contactRadius:1.95,interceptT:st.t});
          }
          else if(hr<saveShare+.18&&def){
            const bt=this._physicalBlockPoint(atk,g,def,.08,.62);
            if(bt&&this._actorReachable(def,atk.x,atk.y,bt,34)){
              this._startTravel(atk,bt,'shot',()=>{
                const _cv=this._physicalContactValid(def,2.05,this.ball.z),contactD=_cv.horizontal;
                if(!_cv.ok){
                  this.visualIntegrity.failedContacts++;
                  this._emit('visual_contact_failed',{kind:'header_block',by:def,distance:contactD});
                  const miss={x:g.x+hdDir*2,y:g.y+(chance(.5)?1:-1)*R(4.5,10)};
                  this._continueTravel(miss,'shot',()=>{this._emit('miss',{by:atk,reason:'header_blocker_did_not_reach'});this._goalKickOrRestart(1-o.team);},{outcome:'miss'},30);
                  return;
                }
                this._recordVisualContact('header_block',def,this.ball.x,this.ball.y,{distance:contactD,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface});
                this._emit('blocked',{by:def,kind:'header',contact:{x:this.ball.x,y:this.ball.y,distance:contactD}});
                if(chance(CAL.restarts.aerialBlockCorner))this._setCorner(o.team);
                else this._deflectTo(clamp(this.ball.x-hdDir*R(2,6),2,FL-2),clamp(this.ball.y+R(-5,5),2,FW-2),10);
              },null,'shot',{outcome:'block',actor:def,contactRadius:2.05});
            } else this._startTravel(atk,{x:g.x+hdDir*2,y:g.y+(chance(.5)?1:-1)*R(4.5,10)},'shot',()=>{this._emit('miss',{by:atk,reason:'no_physical_header_block'});this._goalKickOrRestart(1-o.team);},null,'shot');
          }
          else this._startTravel(atk,{x:g.x+hdDir*2,y:g.y+(chance(.5)?1:-1)*R(4.5,10)},'shot',()=>{this._emit('miss',{by:atk});this._goalKickOrRestart(1-o.team);},null,'shot');
        }
      }else{if(setPiece)this.stats[o.team].setPieceFirstContactLost++;if(def){def.rating+=.08;this._emit('header_clear',{by:def});/* §R19.04 · sob pressao, perto da propria linha, o corte de cabeca sai. */if(!(this._r19ClearOut&&this._r19ClearOut(def,'header')))this._turnover(def);}else this._goalKickOrRestart(1-o.team);}
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

  // chutão de zagueiro: alívio direcionado para uma segunda bola real.
  _clearBall(o) {
    const tm = this.teams[o.team];
    const dir = tm.attackDir;
    // CALIBRAÇÃO · corte afobado: pressionado e colado na própria meta,
    // parte dos cortes morre atrás da linha de fundo — escanteio contra
    if (D(o.x, o.y, tm.goal.x, tm.goal.y) < 20 && this._nearestOpponent(o).dist < 3.2 && chance(.16)) {
      this._emit('clear_behind', { by: o });
      this._setCorner(1 - o.team); return;
    }
    const opps=this.teams[1-o.team].players.filter(p=>!p.red);
    let targetMate=null, bestScore=-1e9;
    for(const m of tm.players){
      if(!m||m===o||m.red||m.isGK)continue;
      const dist=D(o.x,o.y,m.x,m.y), progress=dir*(m.x-o.x);
      if(dist<12||dist>50||progress<-5)continue;
      let space=20; for(const d of opps)space=Math.min(space,D(m.x,m.y,d.x,d.y));
      const score=-Math.abs(dist-29)*.22 + progress*.10 + Math.min(space,10)*.22 - Math.abs(m.y-o.y)*.025 + R(-.35,.35);
      if(score>bestScore){bestScore=score;targetMate=m;}
    }
    if(targetMate){
      const mv=Math.hypot(targetMate.vx||0,targetMate.vy||0);
      const lead=Math.min(2.1,mv*.25);
      const bx=targetMate.x+(mv?targetMate.vx/mv*lead:0), by=targetMate.y+(mv?targetMate.vy/mv*lead:0);
      const dx=bx-o.x,dy=by-o.y,dl=Math.max(.001,Math.hypot(dx,dy));
      const err=1.0+R(0,1.8),side=chance(.5)?-1:1;
      const tx=clamp(bx+(-dy/dl)*side*err,2,FL-2),ty=clamp(by+(dx/dl)*side*err,2,FW-2);
      this._startTravel(o,{x:tx,y:ty},'pass',()=>this._receive(targetMate),targetMate,'launch',{clearance:true,secondBall:true});
    }else{
      const tx=clamp(o.x+dir*(25+R(0,10)),2,FL-2),ty=clamp(o.y+R(-10,10),2,FW-2);
      this._startTravel(o,{x:tx,y:ty},'pass',()=>this._contestLoose(),null,'launch',{clearance:true,fallback:true});
    }
    this.ball.passKind='launch';
    this._emit('header_clear',{by:o,to:targetMate});
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
      const legendPull = 0;   /* §40/§41: sem exceção por rótulo de fama */
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
    const tm = this.teams[o.team], dir = tm.attackDir || 1;
    const opps = this.teams[1 - o.team].players;
    const adv = dir > 0 ? o.x : FL - o.x;              // progressao 0..FL
    const wide = Math.abs(o.y - FW / 2) > 16;          // proximo de um corredor
    const finalThird = adv > FL * 0.66;
    const byX = dir > 0 ? FL - 1.5 : 1.5;              // linha de fundo adversaria
    // Candidatos de direcao: gol, espaco a frente no corredor, e a LINHA DE FUNDO
    // quando ja e ponta avancado (conduz ate o fundo para o cutback/cruzamento).
    const cands = [{ tx: g.x, ty: g.y, bias: 0 },
                   { tx: o.x + dir * 12, ty: o.y, bias: 0.4 }];
    let centralBlocked = false;
    { const ang0 = Math.atan2(g.y - o.y, g.x - o.x);
      for (const d of opps) { if (d.red) continue;
        const da = Math.atan2(d.y - o.y, d.x - o.x), dd = Math.hypot(d.x - o.x, d.y - o.y);
        if (dd < 9 && Math.abs(Math.atan2(Math.sin(da - ang0), Math.cos(da - ang0))) < 0.5) centralBlocked = true; } }
    if (wide && finalThird) cands.push({ tx: byX, ty: o.y + (o.y < FW / 2 ? 2 : -2), bias: centralBlocked ? 0.5 : 0.2 });
    // CORTAR PRA DENTRO: aberto e na metade ofensiva, a diagonal para a entrada
    // da area (a ~17 m do gol, puxando para o centro) monta o chute de fora.
    if (wide && adv > FL * 0.52) {
      const cutY = FW / 2 + (o.y < FW / 2 ? -6 : 6);
      const cutX = dir > 0 ? FL - 17 : 17;
      cands.push({ tx: cutX, ty: cutY, bias: centralBlocked ? 0.15 : 0.6 });
    }
    let bestAng = Math.atan2(g.y - o.y, g.x - o.x), bestSpace = 0, bestScore = -1e9;
    for (const c of cands) {
      const ang = Math.atan2(c.ty - o.y, c.tx - o.x);
      const px = o.x + Math.cos(ang) * 10, py = o.y + Math.sin(ang) * 10;
      const prog = dir > 0 ? px - o.x : o.x - px;      // quanto esse rumo avanca
      let space = 99;
      for (const d of opps) { if (d.red) continue; const dd = Math.hypot(px - d.x, py - d.y); if (dd < space) space = dd; }
      const score = prog * 0.5 + Math.min(space, 12) + c.bias * 6;
      if (score > bestScore) { bestScore = score; bestAng = ang; bestSpace = space; }
    }
    // carrega mais longe quando ha espaco a frente; encurta quando o espaco fecha
    const reach = 8 + Math.min(6, bestSpace) * 0.6;
    o._tx = clamp(o.x + Math.cos(bestAng) * reach, 1, FL - 1);
    o._ty = clamp(o.y + Math.sin(bestAng) * reach, 1, FW - 1);
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
    /* OS-82 · o evento de interceptacao nao decide mais, sozinho, que a bola
       foi dominada. O contrato de posse continua soberano; contato esticado
       que nao fecha esse contrato desvia a bola usando a geometria real. */
    const _os82ResolveIntercept=(winner,contact,prepared)=>{
      let controlled=false;
      if(prepared) controlled=this._turnover(winner)!==false && this.ball.owner===winner;
      if(!controlled){
        const _b=this.ball,_ivx=Number(_b.vx)||0,_ivy=Number(_b.vy)||0;
        const _is=Math.max(.001,Math.hypot(_ivx,_ivy));
        let _nx=(Number(_b.x)||0)-(Number(winner.x)||0),_ny=(Number(_b.y)||0)-(Number(winner.y)||0);
        let _nl=Math.hypot(_nx,_ny);
        if(_nl<.05){const _sg=((winner.idx||0)+(winner.team||0))%2?1:-1;_nx=-_ivy/_is*_sg;_ny=_ivx/_is*_sg;_nl=1;}
        _nx/=_nl;_ny/=_nl;
        let _ox=_ivx/_is*.22+_nx*.78,_oy=_ivy/_is*.22+_ny*.78,_ol=Math.hypot(_ox,_oy);
        if(_ol<.05){_ox=-_ivy/_is;_oy=_ivx/_is;_ol=1;}
        _ox/=_ol;_oy/=_ol;
        const _len=clamp(_is*.42,5.5,8.5),_spd=clamp(_is*.42,5.8,9.5);
        _b.owner=null;_b.lastTouch=winner;_b.__p04Live=true;_b._looseT=0;
        /* O passe terminou no contato. Manter o watchdog da viagem anterior
           armado faria a recuperacao fisica ser tratada como passe travado. */
        _b.__r10Pass=null;_b.__p04PendingReceiver=null;
        this._deflectTo(_b.x+_ox*_len,_b.y+_oy*_len,_spd);
      }
      return controlled;
    };
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
      const pI = duelProb(facet(d,'intercept')+2, facet(o,'pass') * 1.38 - 22 + styleGuard - tired - farPen*1.45);
        if (pI > ib) { ib = pI; inter = { d, px, py }; }
      }
    }
    this.stats[o.team].passes++;
    const kind = best.progressM > 13 && (best.m._runDeep || best.m._breaking || best.paceEdge > .28) && (best.lineVuln > .20 || best.intoBox) && best.risk < 3.2 ? 'through'
      : best.dist > 32 ? 'launch' : 'short';
    // R7: a previsão de interceptação usa a MESMA velocidade da execução.
    // O passe curto anterior chegava perto de 30 m/s e criava alvos irreais.
    const passPowPhysical = 0.92 + facet(o,'pass')/100 * 0.16;
    const passSpeedPhysical = kind === 'launch' ? 22.5 : kind === 'through' ? 19.5 * passPowPhysical : 16.2 * passPowPhysical;
    const _os82BlockRadius=kind==='through'?1.58:1.45,_os82ControlRadius=1.00;
    const _os82Block=inter?this._actorInterceptTarget(inter.d,this.ball.x,this.ball.y,{x:m.x,y:m.y},passSpeedPhysical,_os82BlockRadius,'pass',kind):null;
    const _os82Control=inter?this._actorInterceptTarget(inter.d,this.ball.x,this.ball.y,{x:m.x,y:m.y},passSpeedPhysical,_os82ControlRadius,'pass',kind):null;
    const _os82Reserve=_os82Control&&Number.isFinite(_os82Control.ballTime)&&Number.isFinite(_os82Control.reaction)?_os82Control.ballTime-_os82Control.reaction:-Infinity;
    const _os82Prepared=!!(_os82Control&&_os82Reserve>=2/30);
    const physicalInter=_os82Prepared?_os82Control:_os82Block;
    const _os82ContactRadius=_os82Prepared?_os82ControlRadius:_os82BlockRadius;
    if (kind === 'through') this.stats[o.team].throughBalls++;
    const wasIntercepted = inter && chance(ib) && physicalInter;
    if (wasIntercepted) {
      if (o.isGK && o._gkDistributionPending) { this.stats[o.team].gkDistributionFailed++; o._gkDistributionPending=false; }
      this._startTravel(o, physicalInter, 'pass', () => {
        const cv=this._physicalContactValid(inter.d,_os82ContactRadius,physicalInter.z);
        if(!cv.ok){
          if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
          this._emit('visual_contact_failed',{kind:'pass_intercept',by:inter.d,distance:cv.horizontal,z:this.ball.z,maxZ:cv.maxZ});
          // R9: tentativa falha não congela a bola. Ela continua como bola viva.
          this.ball.owner=null; this.ball.traveling=false; this.ball.meta=null; this.ball._looseT=0;
          this.ball.vx=(this.ball.vx||0)*.62; this.ball.vy=(this.ball.vy||0)*.62; this.ball.vz=Math.max(0,(this.ball.vz||0)*.45);
          return;
        }
        const contact=this._recordVisualContact('pass_intercept',inter.d,this.ball.x,this.ball.y,{distance:cv.horizontal,z:this.ball.z,maxZ:cv.maxZ,surface:cv.surface,
          reaction:physicalInter.reaction,ballTime:physicalInter.ballTime,reactionReserve:_os82Reserve,controlRadius:_os82ControlRadius});
        this.stats[inter.d.team].interceptions++;
        const _os82Controlled=_os82ResolveIntercept(inter.d,contact,_os82Prepared);
        this._emit('intercept',{by:inter.d,contact,through:kind==='through',controlled:_os82Controlled,deflection:!_os82Controlled,reactionReserve:_os82Reserve});
        inter.d.rating+=0.1;
      },null,kind,{outcome:'intercept',actor:inter.d,contactRadius:_os82ContactRadius,targetZ:physicalInter.z});
    } else {
      /* R11.14: throughBalls was already counted at decision time. */
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
          if (rxRcv > offLine + 0.45 && chance(clamp(callP + 0.05, 0.62, 0.97))) {
            this._emit('offside', { by: m, on: o });
            if (o.isGK && o._gkDistributionPending) { this.stats[o.team].gkDistributionFailed++; o._gkDistributionPending=false; }
            this.stats[o.team].offsides = (this.stats[o.team].offsides || 0) + 1;
            /* OS-83 · impedimento nao e passe do infrator. A bola morre no
               ponto e o defensor mais proximo caminha para cobrar o tiro livre
               indireto. O ramo antigo armava __r10Pass sem receptor e depois
               tentava _turnover em um jogador fisicamente distante. */
            const _os83Spot={x:clamp(m.x,1,FL-1),y:clamp(m.y,1,FW-1)};
            const _os83Pool=this.teams[1-o.team].players.filter(p=>p&&!p.red);
            const _os83Taker=_os83Pool.slice().sort((a,b)=>D(a.x,a.y,_os83Spot.x,_os83Spot.y)-D(b.x,b.y,_os83Spot.x,_os83Spot.y))[0];
            const _os83D=_os83Taker?D(_os83Taker.x,_os83Taker.y,_os83Spot.x,_os83Spot.y):0;
            this.ball.owner=null;this.ball.traveling=false;this.ball.meta=null;
            this.ball.receiver=null;this.ball.onArrive=null;this.ball.target=null;
            this.ball.x=_os83Spot.x;this.ball.y=_os83Spot.y;this.ball.z=0;
            this.ball.vx=this.ball.vy=this.ball.vz=0;this.ball.__r10Pass=null;
            m._runDeep=false;
            if(_os83Taker){
              const _os83Wait=clamp(.55+_os83D/6.5,.55,3.2);
              _os83Taker.__spTarget={x:_os83Spot.x,y:_os83Spot.y};
              this.dead=Math.max(this.dead||0,_os83Wait);
              this.__os83OffsideWait={taker:_os83Taker,x:_os83Spot.x,y:_os83Spot.y,
                until:this.t+_os83Wait,radius:0.75};
              this.pendingRestart=()=>{this._giveBall(_os83Taker);_os83Taker.settle=Math.max(_os83Taker.settle||0,.45);};
              this._emit('offside_restart',{team:1-o.team,by:_os83Taker,x:_os83Spot.x,y:_os83Spot.y});
            }else this._goalKickOrRestart(1-o.team);
            return;
          }
        }
      }
      // ════════════════════════════════════════════════════════════════════════
      // PASSE INTELIGENTE (relatório §9): mira o espaço à frente de quem corre
      // R7 · ALVO COERENTE: o alvo usa a velocidade física real do passe.
      // Antes a previsão usava 17/20 m/s, mas a bola saía a 23–30 m/s. Isso
      // projetava o receptor até 10 m à frente e fazia passes bons parecerem
      // lançamentos sem sentido. Passe curto agora prioriza o pé; somente a
      // bola em profundidade ataca espaço de forma agressiva.
      const passPowAim = 0.92 + facet(o,'pass')/100 * 0.16;
      const spdK = kind === 'launch' ? 22.5 : kind === 'through' ? 19.5 * passPowAim : 16.2 * passPowAim;
      const tv = best.dist / Math.max(12, spdK);
      const mv = Math.hypot(m.vx, m.vy);
      const rawLead = mv > 0.75 ? mv * tv : 0;
      let leadScale, leadCap;
      if (kind === 'through') { leadScale = 0.82; leadCap = clamp(3.6 + Math.max(0,best.progressM-8)*0.08, 3.6, 5.5); }
      else if (kind === 'launch') { leadScale = 0.42; leadCap = 2.8; }
      else {
        leadScale = 0.28;
        leadCap = best.dist < 12 ? 0.55 : best.dist < 22 ? 0.95 : 1.55;
      }
      const lead = Math.min(leadCap, rawLead * leadScale);
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
        // R7: erro continua existindo, porém deixa de virar um passe aleatório
        // de 6–10 metros para o lado. O tamanho depende do tipo de passe.
        // R9 · ERRO FÍSICO COERENTE: o erro acontece perpendicularmente à
        // linha do passe, nunca num eixo global arbitrário. O receptor continua
        // identificado e corre para a bola; se não alcançar, ela segue viva com
        // a velocidade residual tratada pelo P0-4, sem parar no target.
        const missBase = kind === 'through' ? 1.55 : kind === 'launch' ? 1.35 : 0.65;
        const miss = missBase + best.dist * (kind === 'short' ? 0.022 : 0.040) + (1 - passSkill) * 1.75;
        const adx = lx - o.x, ady = ly - o.y, alen = Math.max(0.001, Math.hypot(adx, ady));
        const px = -ady / alen, py = adx / alen, ax = adx / alen, ay = ady / alen;
        const along = R(-0.42, 0.42);
        const badTarget = {
          x: clamp(lx + px * missSide * miss + ax * along, 0.5, FL - 0.5),
          y: clamp(ly + py * missSide * miss + ay * along, 0.5, FW - 0.5)
        };
        this._emit('bad_pass', { by: o, to: m, kind });
        if (o.isGK && o._gkDistributionPending) { this.stats[o.team].gkDistributionFailed++; o._gkDistributionPending=false; }
        this._startTravel(o, badTarget, 'pass', () => this._receive(m), m, kind, { executionError: true });
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
          /* FASE 8 · a saída vira decisão + execução: o goleiro decide sair
             (função, distância, 1v1) e pode FALHAR — antecipação e aceleração
             decidem. Batido, fica 2,5s fora do lance e o chute seguinte
             encontra o gol semiaberto (_sweptFailUntil consumido no _shoot). */
          let swept = false, sweepFailed = false;
          if (sweeper && chance(clamp(sweepP*1.35, 0, .55))) {
            const exec = clamp(.44 + (facet(gk2,'gk_one_on_one')-60)/140
              + (getAttr(gk2,'aceleracao')-60)/260 - Math.max(0, gkDanger-14)/38, .18, .90);
            if (chance(exec)) swept = true;
            else {
              sweepFailed = true; gk2._sweptFailUntil = this.t + 2.5;
              this.stats[gk2.team].gkSweepsFailed++;
              this._emit('gk_sweep_failed', { gk: gk2, by: m });
            }
          }
          if ((!chance(runWin) && !sweepFailed) || swept) {
            const winner = swept && gk2 ? gk2 : (cover || gk2);
            const cv=winner?this._physicalContactValid(winner,winner.isGK?1.75:1.18,this.ball.z):{ok:false};
            if (winner && cv.ok) {
              const contact=this._recordVisualContact(winner.isGK?'gk_sweep_intercept':'through_intercept',winner,this.ball.x,this.ball.y,{distance:cv.horizontal,z:this.ball.z,maxZ:cv.maxZ,surface:cv.surface});
              this.stats[winner.team].interceptions++;
              const _os82Prepared=cv.horizontal<=(winner.isGK?1.22:1.03);
              const _os82Controlled=_os82ResolveIntercept(winner,contact,_os82Prepared);
              if(winner.isGK){this.stats[winner.team].gkSweeps++;this._emit('gk_sweep',{gk:winner,by:m,contact,controlled:_os82Controlled,deflection:!_os82Controlled});}
              else this._emit('intercept',{by:winner,through:true,contact,controlled:_os82Controlled,deflection:!_os82Controlled});
              winner.rating += .08;
              return;
            }
            if(winner)this._emit('intercept_attempt_aborted',{kind:'through_intercept',by:winner,distance:cv.horizontal,z:Math.max(0,this.ball.z||0),maxZ:cv.maxZ});
          }
          this.stats[o.team].throughOk++;
          m._throughReceiverUntil = this.t + (sweepFailed ? 4.5 : 3.2);
        }
        this.stats[o.team].passOk++;
        if (o.isGK && o._gkDistributionPending) { this.stats[o.team].gkDistributionCompleted++; o._gkDistributionPending=false; }
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
  /* R18.17 · INTELIGÊNCIA DE FINALIZAÇÃO
     Escolhe deterministicamente o TIPO de chute pelo contexto e atributos.
     Não consome RNG, não cria um resultado paralelo e não fabrica defesas:
     apenas parametriza a resolução física autoritativa já existente. */
  _r1817FinishPlan(o, dtg, longshot, volley, oneOnOne, gk, g) {
    const fin=getAttr(o,'finalizacao'), comp=getAttr(o,'compostura');
    const dec=getAttr(o,'decisao'), tech=(o.ref&&o.ref.a8?o.ref.a8[7]:getAttr(o,'conducao'));
    const power=Math.max(getAttr(o,'chute_longe'),getAttr(o,'forca'));
    const pressure=this._nearestOpponent(o).dist;
    const keeperAdvanced=!!(gk&&D(gk.x,gk.y,g.x,g.y)>4.4);
    let type='balanced', fit=(fin+comp+dec)/3;
    if(volley){ type='first_time'; fit=(fin*.45+tech*.30+comp*.25); }
    else if(oneOnOne&&keeperAdvanced&&tech>=82&&dec>=80){ type='chip'; fit=(tech*.42+dec*.32+comp*.26); }
    else if(oneOnOne||dtg<=17){
      const placed=(fin*.42+comp*.38+tech*.20);
      const driven=(fin*.42+power*.38+comp*.20);
      if(placed>=driven+2||pressure>3.6){type='placed';fit=placed;}
      else {type='power';fit=driven;}
    }else if(longshot){
      const placed=(getAttr(o,'chute_longe')*.38+tech*.34+comp*.28);
      const driven=(getAttr(o,'chute_longe')*.48+power*.34+tech*.18);
      if(placed>=driven+4){type='placed';fit=placed;}else{type='power';fit=driven;}
    }else if(pressure<2.8&&power>=78){type='power';fit=(fin*.40+power*.40+comp*.20);}
    else {type='placed';fit=(fin*.42+comp*.38+tech*.20);}
    const q=clamp((fit-60)/35,0,1);
    const plan={type,fit,q,goalMul:1,dispersionMul:1,speedMul:1,saveBias:0,blockBias:0,postBias:0};
    if(type==='placed'){
      plan.goalMul=.975+q*.065; plan.dispersionMul=.98-q*.16; plan.speedMul=.94;
      plan.saveBias=-q*.018; plan.postBias=.006;
    }else if(type==='power'){
      plan.goalMul=.955+q*.075; plan.dispersionMul=1.10-q*.12; plan.speedMul=1.06+q*.06;
      plan.saveBias=-q*.010; plan.blockBias=.012+(1-q)*.010; plan.postBias=.010;
    }else if(type==='chip'){
      plan.goalMul=(keeperAdvanced?1.02:.90)+q*.08; plan.dispersionMul=.94-q*.08; plan.speedMul=.76;
      plan.saveBias=keeperAdvanced?-.035:.025; plan.postBias=.012;
    }else if(type==='first_time'){
      plan.goalMul=.92+q*.11; plan.dispersionMul=1.14-q*.16; plan.speedMul=1.03+q*.05;
      plan.saveBias=-q*.008; plan.blockBias=.010;
    }
    return plan;
  }

  _shoot(o, dtg, longshot, volley) {
    const tm=this.teams[o.team], g=tm.oppGoal;
    const fire=1;
    const gk=this.teams[1-o.team].players.find(p=>p.isGK&&!p.red);
    const nearest=this._nearestOpponent(o);
    const oneOnOne=dtg<19 && (nearest.dist>5.4 || (o._throughReceiverUntil||0)>this.t);
    const finishPlan=this._r1817FinishPlan(o,dtg,longshot,volley,oneOnOne,gk,g);
    this.stats[o.team].shots++;
    if(oneOnOne)this.stats[o.team].oneOnOnes++;
    if(o.y<FW/2)this.stats[o.team].attacksL++;else this.stats[o.team].attacksR++;
    this._bumpMom(o.team,.08); o._act='shoot';
    const atk=facet(o,oneOnOne?'one_on_one':(longshot?'shot_far':'shot'));
    const gkScrambling=gk&&(gk._sweptFailUntil||0)>this.t;
    const gkF=gk?(gkScrambling?18:facet(gk,oneOnOne?'gk_one_on_one':'gk')):40;
    let base=distanceXg(dtg); if(volley)base*=.86; if(oneOnOne)base=Math.max(base,.27); base*=fire;
    const angMul=clamp(1-Math.abs(o.y-g.y)/42,.32,1);
    const ctx=this._actionContext(o,nearest.dist,'shot');
    const skill=(atk-gkF)/100;
    let pGoal=base*CAL.shooting.conversionScale*angMul*(1+skill*CAL.shooting.skillInfluence)*ctx.execution;
    if(oneOnOne)pGoal*=1.04+getAttr(o,'compostura')/100*.12;
    if(longshot && getAttr(o,'chute_longe')>=86 && (o.ref.a8?o.ref.a8[7]:75)>=82)pGoal*=1.08;
    // Calibração FM-like: 1x1 mantém valor alto; chutes comuns e de longe
    // têm conversão mais contida, evitando placares inflados sem reduzir volume.
    pGoal *= oneOnOne ? .70 : longshot ? .50 : 0.62;
    pGoal *= finishPlan.goalMul;
    pGoal=clamp(pGoal,CAL.shooting.minGoalChance,oneOnOne?.72:CAL.shooting.maxGoalChance);
    /* OS-200 · o xG registrado passa por uma escala medida. Com o desfecho
       vindo da geometria, `pGoal` calibra a pontaria e nao e mais igual a
       probabilidade de gol; sem a escala a coluna de xG passa a superestimar
       de forma sistematica. A escala mora junto da calibracao da fisica. */
    const xg=pGoal*(this._os200EscalaXg?this._os200EscalaXg():1); this.stats[o.team].xg+=xg;
    if((o._setPieceShotUntil||0)>this.t)this.stats[o.team].setPieceShots++;
    this._emit('shot_taken',{by:o,xg,baseXg:clamp(base*angMul,.003,.75),pGoal,longshot:!!longshot,dtg,volley,oneOnOne,finishType:finishPlan.type,finishFit:+finishPlan.fit.toFixed(2)});
    this._emit('finish_choice',{by:o,type:finishPlan.type,fit:+finishPlan.fit.toFixed(2),dtg,oneOnOne:!!oneOnOne,longshot:!!longshot,volley:!!volley});
    this.momentum=clamp(this.momentum+(o.team===0?.5:-.5),-1,1);this.beat=.5;
    /* OS-200 · INVERSAO DA CAUSALIDADE DO CHUTE
       -----------------------------------------
       Tudo acima permanece: a chance da finalizacao, o xG contabilizado, os
       eventos emitidos. O que muda e o que vem DEPOIS. Ate aqui o desfecho era
       sorteado antes da bola sair do pe (`if (chance(pGoal))`) e a trajetoria
       era fabricada para chegar no resultado ja escolhido — por isso qualquer
       mexida na fisica mexia no placar, e por isso a OS-104 nao conseguiu
       fazer chute passar por cima do gol sem derrubar a media de gols.

       Com a camada OS-200 instalada, pGoal passa a calibrar a PONTARIA e quem
       decide gol/trave/fora/defesa e a geometria da meta, lida da trajetoria
       que a bola realmente descreveu.

       O ramo antigo fica logo abaixo, intacto, como rede: se a camada de
       fisica nao estiver carregada, o motor se comporta como antes. */
    if(this._os200ResolverChute){
      this._os200ResolverChute(o,{g,tm,gk,atk,gkF,pGoal,dtg,longshot,volley,oneOnOne,finishPlan,gkScrambling});
      o._throughReceiverUntil=0;
      return;
    }
    const shotQuality=clamp(atk/100,.3,1),dispersion=R(-4.8,4.8)*(1.15-shotQuality*.62)*finishPlan.dispersionMul;
    if(chance(pGoal)){
      let goalY;
      if(finishPlan.type==='placed'){
        const far=(o.y<g.y?1:-1); goalY=clamp(g.y+far*R(1.55,3.05),g.y-3.35,g.y+3.35);
      }else if(finishPlan.type==='chip') goalY=clamp(g.y+R(-1.45,1.45),g.y-3.35,g.y+3.35);
      else goalY=clamp(g.y+R(-3.15,3.15)*(1.15-shotQuality*.45)*finishPlan.dispersionMul,g.y-3.35,g.y+3.35);
      this._startTravel(o,{x:g.x+tm.attackDir*.9,y:goalY},'shot',()=>this._goal(o,longshot||facet(o,'shot')>90),null,'shot');
    }else{
      const gkQual=gk?(gkScrambling?.15:facet(gk,oneOnOne?'gk_one_on_one':'gk')/100):.4;
      const r2=R();
      // O alvo da defesa é calculado SOBRE a trajetória do chute. A fatia de
      // save só existe quando o goleiro consegue interceptá-la no mesmo tempo.
      const goalAim={x:g.x+tm.attackDir*.9,y:clamp(g.y+dispersion,g.y-3.35,g.y+3.35)};
      const shotSpeed=clamp((34+facet(o,'shot')/100*16)*finishPlan.speedMul,26,59);
      const saveTarget=this._gkInterceptTarget(gk,o.x,o.y,goalAim,shotSpeed,1.95);
      const saveReachable=!!saveTarget;
      if(!saveReachable){
        /* OS-18 · o bloqueio nao depende do alcance do goleiro. Mesma busca de
           defensor na linha do chute do ramo alcancavel (:6165), mesmo raio de
           2,2 m, mesmo desfecho por CAL.restarts.shotBlockCorner. Sem defensor
           na linha, nada muda. */
        if(chance(CAL.shooting.blockedShare)){
          const _os18Def=this.teams[1-o.team].players.filter(p=>!p.red&&!p.isGK);
          let _os18B=null,_os18L=99,_os18T=null;
          for(const d of _os18Def){
            const t=clamp(this._projT(o.x,o.y,g.x,g.y,d.x,d.y),0,1);
            if(t<.12||t>.88)continue;
            const px=lerp(o.x,g.x,t),py=lerp(o.y,g.y,t),ld=D(d.x,d.y,px,py);
            if(ld<_os18L){_os18L=ld;_os18B=d;_os18T={x:px,y:py};}
          }
          if(_os18B&&_os18L<=2.2){
            this._startTravel(o,_os18T,'shot',()=>{
              const _cv=this._physicalContactValid(_os18B,2.05,this.ball.z);
              if(!_cv.ok){
                if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
                this._emit('visual_contact_failed',{kind:'block',by:_os18B,distance:_cv.horizontal});
                this._looseBall(this.ball.x,this.ball.y);
                return;
              }
              this._recordVisualContact('block',_os18B,this.ball.x,this.ball.y,{distance:_cv.horizontal,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface});
              this._emit('blocked',{by:_os18B,contact:{x:this.ball.x,y:this.ball.y,distance:_cv.horizontal}});
              if(chance(CAL.restarts.shotBlockCorner))this._setCorner(o.team);
              else this._looseBall(this.ball.x,this.ball.y);
            },null,'shot',{outcome:'block',actor:_os18B,contactRadius:2.05});
            o._throughReceiverUntil=0;
            return;
          }
        }
        const _edge=clamp((atk-gkF)/100,-.35,.55);
        /* OS-23 · usa o MESMO pGoal contabilizado como xG em :6122. Antes
           este ramo sorteava o gol por uma probabilidade propria, e por isso
           os gols saiam acima do xG registrado. */
        const _pg=clamp(pGoal,.08,.46);
        const _y=clamp(g.y+(chance(.5)?1:-1)*R(2.55,3.28),g.y-3.35,g.y+3.35);
        const _aim={x:g.x+tm.attackDir*.9,y:_y};
        if(r2<_pg){
          this._startTravel(o,_aim,'shot',()=>this._goal(o,longshot||facet(o,'shot')>90),null,'shot');
        }else if(r2<_pg+.30){
          this._startTravel(o,_aim,'shot',()=>{if(chance(.5))this._setCorner(o.team);else this._goalKickOrRestart(1-o.team);},null,'shot');
        }else{
          this._startTravel(o,{x:g.x+tm.attackDir*.9,y:g.y+(chance(.5)?1:-1)*R(3.7,4.3)},'shot',()=>{this._emit('miss',{by:o});this._goalKickOrRestart(1-o.team);},null,'shot');
        }
        o._throughReceiverUntil=0;
        return;
      }
      const saveCut=saveReachable?clamp(CAL.shooting.savedShare+gkQual*CAL.shooting.keeperSaveInfluence+(oneOnOne?.04:0)+finishPlan.saveBias,.04,.72):0;
      const blockCut=clamp(saveCut+CAL.shooting.blockedShare*(oneOnOne?.55:1)+finishPlan.blockBias,saveCut,.88);
      const postCut=clamp(blockCut+CAL.shooting.postShare+finishPlan.postBias,blockCut,.94);
      if(r2<saveCut){
        this._startTravel(o,saveTarget,'shot',()=>this._gkResolveSave(gk,o,{atk,oneOnOne,saveTarget,g,tm}),null,'shot',{
          outcome:'save', actor:gk, contactRadius:1.9, interceptT:saveTarget.t
        });
      }else if(r2<blockCut){
        const defenders=this.teams[1-o.team].players.filter(p=>!p.red&&!p.isGK);
        let blocker=null,bestLine=99,blockTarget=null;
        for(const d of defenders){
          const t=clamp(this._projT(o.x,o.y,g.x,g.y,d.x,d.y),0,1);
          if(t<.12||t>.88)continue;
          const px=lerp(o.x,g.x,t),py=lerp(o.y,g.y,t),ld=D(d.x,d.y,px,py);
          if(ld<bestLine){bestLine=ld;blocker=d;blockTarget={x:px,y:py};}
        }
        // Sem defensor próximo da linha não existe bloqueio. A bola continua
        // como finalização para fora, em vez de parar num ponto sem agente.
        if(!blocker||bestLine>2.2){
          const missY=g.y+(chance(.5)?1:-1)*R(3.8,7.4);
          this._startTravel(o,{x:g.x+tm.attackDir*3,y:missY},'shot',()=>{
            this._emit('miss',{by:o,reason:'no_physical_block'});
            this._goalKickOrRestart(1-o.team);
          },null,'shot',{outcome:'miss'});
          o.rating-=.06;
        }else{
          /* OS-14 · defensor em cima do finalizador: parte desse contato e
             falta, nao bloqueio. Entra antes do _startTravel, entao nao
             converte bloqueio limpo — divide a populacao. Dentro da area,
             _awardFoul (:6706) roteia sozinho para _penalty. */
          if(chance(this._foulProb(blocker)*1)){this._awardFoul(blocker,o);return;}
          this._startTravel(o,blockTarget,'shot',()=>{
            const _cv=this._physicalContactValid(blocker,2.05,this.ball.z),contactD=_cv.horizontal;
            if(!_cv.ok){
              if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
              this._emit('visual_contact_failed',{kind:'block',by:blocker,distance:contactD});
              const missY=g.y+(chance(.5)?1:-1)*R(3.8,7.0);
              this._continueTravel({x:g.x+tm.attackDir*3,y:missY},'shot',()=>{
                this._emit('miss',{by:o,reason:'blocker_did_not_reach'});
                this._goalKickOrRestart(1-o.team);
              },{outcome:'miss'},Math.max(24,this.ball.speed*.72));
              return;
            }
            this._recordVisualContact('block',blocker,this.ball.x,this.ball.y,{distance:contactD,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface});
            this._emit('blocked',{by:blocker,contact:{x:this.ball.x,y:this.ball.y,distance:contactD}});
            if(chance(CAL.restarts.shotBlockCorner))this._setCorner(o.team);
            else this._looseBall(this.ball.x,this.ball.y);
          },null,'shot',{outcome:'block',actor:blocker,contactRadius:2.05});
        }
      }else if(r2<postCut){
        this._startTravel(o,{x:g.x,y:g.y+(chance(.5)?1:-1)*3.66},'shot',()=>{
          this._recordVisualContact('post',null,this.ball.x,this.ball.y,{shooterId:o.idx??null});
          this._emit('post',{by:o,contact:{x:this.ball.x,y:this.ball.y}});
          /* R18.15.5 · A trave não concede escanteio. Sem toque defensivo,
             a bola que morre além da linha de fundo gera tiro de meta; caso
             contrário, o rebote continua vivo dentro do campo. Mantemos a
             mesma frequência de saída/rebote da calibração anterior, mudando
             apenas o reinício incorreto. */
          if(chance(CAL.restarts.postCorner))this._goalKickOrRestart(1-o.team);
          else{
            const rx=clamp(this.ball.x-tm.attackDir*R(3,9),2,FL-2);
            const ry=clamp(this.ball.y+R(-7,7),2,FW-2);
            this._deflectTo(rx,ry,12);
          }
        },null,'shot',{outcome:'post'});
      }else{
        const missY=g.y+(chance(.5)?1:-1)*R(3.8,7.4);
        this._startTravel(o,{x:g.x+tm.attackDir*3,y:missY},'shot',()=>{this._emit('miss',{by:o});this._goalKickOrRestart(1-o.team);},null,'shot');o.rating-=.08;
      }
    }
    o._throughReceiverUntil=0;
  }

  _physicalBlockPoint(shooter, goal, defender, minT, maxT) {
    if(!shooter||!goal||!defender)return null;
    const t=clamp(this._projT(shooter.x,shooter.y,goal.x,goal.y,defender.x,defender.y),minT==null?.08:minT,maxT==null?.88:maxT);
    const point={x:lerp(shooter.x,goal.x,t),y:lerp(shooter.y,goal.y,t)};
    return D(defender.x,defender.y,point.x,point.y)<=2.8?point:null;
  }

  _actorReachable(actor, sx, sy, target, ballSpeed) {
    if(!actor||!target)return false;
    const quality=clamp(facet(actor,actor.isGK?'gk':'duel')/100,.30,1);
    const ballTime=D(sx,sy,target.x,target.y)/Math.max(16,ballSpeed||34);
    const reaction=actor.isGK?(.11+(1-quality)*.19):(.045+(1-quality)*.09);
    const moveTime=Math.max(0,ballTime-reaction);
    const moveSpeed=actor.isGK?(6.2+quality*2.8):(5.5+quality*2.2);
    const bodyReach=actor.isGK?(1.55+quality*.55):(.75+quality*.55);
    return D(actor.x,actor.y,target.x,target.y)<=bodyReach+moveSpeed*moveTime;
  }

  /* MOTOR VISUAL · INTERCEPTAÇÃO FÍSICA DO GOLEIRO (§13A)
     A defesa não mira mais um ponto fixo junto à linha do gol. Procuramos um
     ponto NA TRAJETÓRIA do chute em que a bola e a zona alcançável do goleiro
     se encontrem no mesmo instante. O cálculo replica reação, velocidade e
     raio de contato usados por _ballTravel; portanto não concede alcance que
     a animação não consegue executar. Sem RNG e sem reposicionamento final. */
  _gkInterceptTarget(gk, sx, sy, goalTarget, shotSpeed, contactRadius) {
    if(!gk||!goalTarget)return null;
    const ox=(this.ball&&Number.isFinite(this.ball.x))?this.ball.x:sx;
    const oy=(this.ball&&Number.isFinite(this.ball.y))?this.ball.y:sy;
    const total=D(ox,oy,goalTarget.x,goalTarget.y);
    if(total<.25)return null;
    const speed=Math.max(16,shotSpeed||40);
    const quality=clamp(facet(gk,'gk')/100,.30,1);
    const reaction=.11+(1-quality)*.19;
    const moveSpeed=6.2+quality*2.8;
    const radius=contactRadius==null?1.90:contactRadius;
    const projection=clamp(this._projT(ox,oy,goalTarget.x,goalTarget.y,gk.x,gk.y),.08,.985);
    const minT=clamp(Math.max(.08,2.25/total),.08,.72);
    let best=null;
    // 73 amostras dão resolução espacial inferior a 0,4 m nos chutes comuns.
    for(let i=0;i<=72;i++){
      const t=minT+(0.985-minT)*(i/72);
      const x=lerp(ox,goalTarget.x,t),y=lerp(oy,goalTarget.y,t);
      const ballTime=(total*t)/speed;
      const moveTime=Math.max(0,ballTime-reaction);
      const centerTravel=moveSpeed*moveTime;
      const required=Math.max(0,D(gk.x,gk.y,x,y)-radius);
      const margin=centerTravel-required;
      if(margin<-.035)continue;
      // Prefere o encontro mais próximo da projeção natural do goleiro sobre
      // a linha do chute; margem maior desempata sem puxar o contato ao gol.
      const score=Math.abs(t-projection)-Math.min(.12,Math.max(0,margin)*.018);
      if(!best||score<best.score){
        best={x,y,t,ballTime,margin,score,contactRadius:radius};
      }
    }
    return best;
  }

  _gkReachable(gk, sx, sy, target, shotSpeed) {
    return this._actorReachable(gk,sx,sy,target,shotSpeed||40);
  }

  _recordVisualContact(kind, actor, x, y, extra) {
    if(this.visualIntegrity){
      this.visualIntegrity.contacts++;
      if(kind==='save')this.visualIntegrity.saves++;
      else if(kind==='penalty_save')this.visualIntegrity.penaltySaves++;
      else if(kind==='post')this.visualIntegrity.postContacts++;
      else if(String(kind).includes('block'))this.visualIntegrity.blocks++;
    }
    const c={kind,actorId:actor?(actor.idx??actor.id??null):null,x,y,time:this.t,minute:this.minute,...(extra||{})};
    if(!this.visualContacts)this.visualContacts=[];
    this.visualContacts.push(c);
    if(this.visualContacts.length>240)this.visualContacts.shift();
    this._emit('visual_contact',c);
    return c;
  }

  /* FASE 8 · A defesa deixa de ser um evento único: o goleiro resolve o
     chute conforme segurança e dificuldade — segura, espalma para escanteio
     ou concede rebote VIVO (via _looseBall, a mesma segunda bola já disputada
     em bloqueios e bolas na trave). Toda aleatoriedade é seedada (chance/R). */
  _gkResolveSave(gk, o, ctx) {
    const st = this.stats[1-o.team];
    const _cv=gk?this._physicalContactValid(gk,1.95,this.ball.z):{ok:false,horizontal:Infinity,maxZ:0,surface:'none'};
    const gd=_cv.horizontal;
    // A defesa só é registrada quando goleiro e bola se encontram em x/y/z.
    if(!gk||!_cv.ok){
      if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
      this._emit('visual_contact_failed',{kind:'save',gk,distance:gd,target:ctx.saveTarget});
      this._continueTravel({x:ctx.g.x+ctx.tm.attackDir*.95,y:ctx.saveTarget.y},'shot',
        ()=>this._goal(o,false),{outcome:'goal_after_failed_reach'},Math.max(26,this.ball.speed*.68));
      return;
    }
    this._recordVisualContact('save',gk,this.ball.x,this.ball.y,{distance:gd,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface,interceptT:ctx.saveTarget&&ctx.saveTarget.t,ballTime:ctx.saveTarget&&ctx.saveTarget.ballTime,margin:ctx.saveTarget&&ctx.saveTarget.margin,verticalMargin:ctx.saveTarget&&ctx.saveTarget.verticalMargin});
    this.stats[o.team].onTarget++;
    st.saves++; st.gkShotsFaced++;
    if (gk) gk.rating += (ctx.atk > 82 ? .35 : .18);
    const big = ctx.atk > 82 || ctx.oneOnOne;
    const sec = gk ? facet(gk, 'gk')/100 : .4;              // qualidade/segurança
    const hard = clamp(ctx.atk/100*(ctx.oneOnOne ? 1.08 : 1), .3, 1.1);
    // defesa segura: goleiro confiável domina chutes controláveis
    if (chance(clamp(.60 + sec*.5 - hard*.55, .10, .90))) {
      st.gkSecureCatches++;
      this._emit('save', { gk, big, kind:'catch' });
      this._turnover(gk); return;
    }
    st.gkParries++;
    // espalmada lateral: some pela linha de fundo → escanteio (chance base
    // vem do contexto do lance: chute aberto, cruzamento rasteiro, falta...)
    const cornerBase = ctx.cornerChance != null ? ctx.cornerChance : CAL.restarts.shotSaveCorner;
    if (chance(clamp(cornerBase + (1-sec)*.10, .15, .75))) {
      this._emit('save', { gk, big, kind:'deflect_corner' });
      this._setCorner(o.team); return;
    }
    // defesa em dois tempos: a bola que ficou em jogo pode ser morta no chão
    // antes do ataque chegar — goleiro seguro transforma o rebote em posse
    if (chance(clamp(.18 + sec*.30 - hard*.18, .06, .50))) {
      st.gkDoubleCatches++;
      this._emit('save', { gk, big, kind:'double_catch' });
      this._turnover(gk); return;
    }
    // rebote vivo dentro da área: posição real, ambos os times reagem
    st.reboundsConceded++;
    const central = chance(clamp(.42 - sec*.30, .08, .50)); // GK inseguro solta no meio
    const rx = clamp(ctx.g.x - ctx.tm.attackDir*(central ? R(2.5,6) : R(4,10)), 2, FL-2);
    const ry = clamp(central ? ctx.g.y + R(-3,3)
                             : ctx.g.y + (ctx.saveTarget.y > ctx.g.y ? 1 : -1)*R(4,12), 2, FW-2);
    this._emit('save', { gk, big, kind: central ? 'spill_central' : 'parry_wide', rebound:true });
    // rebote nasce NO ponto de contato e viaja até onde vai morrer
    this._deflectTo(rx, ry, 9 + hard * 6);
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
    this.ball.owner = null; this.ball.traveling = false; this.ball.meta = null;
  }

  /* --------------------------- BOLA / VIAGEM --------------------------- */
  _startTravel(o, target, kind, onArrive, receiver, passKind, meta) {
    const b = this.ball;
    // A bola parte da posição visual real do contato (pé/cabeça), não do centro
    // lógico do jogador. Usar o centro criava uma linha paralela deslocada e a
    // bola passava ao lado do próprio alvo, obrigando o antigo snap no timeout.
    const sx=Number.isFinite(b.x)?b.x:o.x, sy=Number.isFinite(b.y)?b.y:o.y;
    b.owner = null; b.traveling = true; b.travelT = 0;
    b.x=sx;b.y=sy;
    b.target = { x: target.x, y: target.y };
    b.from = { x: sx, y: sy };
    b.kind = kind; b.passKind = passKind || kind;
    b.onArrive = onArrive; b.receiver = receiver || null;
    b.meta = meta || null;
    b.lastTouch = o;
    o.lastPassTo = receiver || null;
    const dist = D(sx, sy, target.x, target.y);
    // VELOCIDADE DA BOLA (§pedido): passe rasteiro mais veloz — a zaga nem sempre chega.
    // Passe forte de bom passador viaja mais rápido; cruzamento/lançamento é aéreo.
    // R7 · força calibrada: qualidade altera precisão e um pouco da força,
    // sem transformar todo passe curto em uma pancada de quase 30 m/s.
    const passPow = 0.92 + facet(o,'pass')/100 * 0.16;   // 0.92..1.08
    const spd = kind === 'shot' ? clamp(34 + facet(o,'shot')/100*16, 32, 54)
              : passKind === 'launch' ? 24.3
              : passKind === 'through' ? 21.1 * passPow
              : 17.5 * passPow;
    b.speed = spd;
    const ang = Math.atan2(target.y - sy, target.x - sx);
    // A imprecisão do passe já é resolvida em _pass() por badTarget. Aplicar
    // outro erro angular aqui fazia a bola nunca cruzar o alvo lógico e o antigo
    // código escondia isso ancorando-a no timeout. A viagem agora segue o alvo
    // físico que foi realmente decidido pela execução.
    const fang = ang;
    b.vx = Math.cos(fang) * spd; b.vy = Math.sin(fang) * spd;
    // ARCO baixo no passe rasteiro (bola no pé, não lob) — só lançamento sobe de verdade
    // CUIDADO (OS-203): estes 0,12 eram decorativos — `z` só existia para o
    // desenho. Desde a OS-200 a camada 88 lê este valor como ALTURA DE SAÍDA
    // real e integra a queda: o passe rasteiro virava um salto de 14 cm seguido
    // de quiques de 4 cm e 1 cm. Quem consome isto é `_startTravel` da camada
    // 07 (`origin.z = b.z`), e o regime rasteiro da camada 88 agora achata a
    // origem para o gramado. Não conserte aqui: mexer nos 0,12 mexe também na
    // origem do CHUTE, que está calibrada.
    b.z = passKind === 'launch' ? 0.3 : 0.12;
    b.vz = (kind === 'shot') ? 1.0 : (passKind === 'launch' ? 7 : passKind === 'through' ? 1.2 : 0.4);
    b._timeout = dist / spd + 0.35;    // timeout de segurança generoso para chutes longos
  }

  _continueTravel(target, kind, onArrive, meta, speed) {
    const b=this.ball, sx=b.x, sy=b.y;
    b.owner=null; b.traveling=true; b.travelT=0;
    b.from={x:sx,y:sy}; b.target={x:target.x,y:target.y};
    b.kind=kind||'shot'; b.passKind=b.kind; b.onArrive=onArrive;
    b.receiver=null; b.meta=meta||null;
    const d=Math.max(D(sx,sy,target.x,target.y),.01),v=Math.max(8,speed||b.speed||28);
    b.vx=(target.x-sx)/d*v; b.vy=(target.y-sy)/d*v;
    b.speed=v; b.vz=Math.max(b.vz||0,.35); b._timeout=d/v+.45;
  }

  _ballTravel(dt) {
    const b = this.ball;
    const prevX=b.x,prevY=b.y;
    b.travelT += dt;

    // Somente atores que PARTICIPAM do desfecho convergem ao ponto de contato.
    // O deslocamento é contínuo, limitado por velocidade e começa após reação.
    if(b.meta&&b.meta.actor&&b.target){
      const actor=b.meta.actor;
      const gd=D(actor.x,actor.y,b.target.x,b.target.y);
      if(gd>0.05){
        const quality=clamp(facet(actor,actor.isGK?'gk':'duel')/100,.3,1);
        const reaction=b.meta.outcome==='save'?(.11+(1-quality)*.19):.04;
        if(b.travelT>=reaction){
          const moveSpeed=b.meta.outcome==='save'?(6.2+quality*2.8):(5.5+quality*2.2);
          const step=Math.min(moveSpeed*dt,gd);
          actor.x+=(b.target.x-actor.x)/gd*step;
          actor.y+=(b.target.y-actor.y)/gd*step;
          if(b.meta.outcome==='save')actor._divingUntil=this.t+.5;
          if(b.meta.outcome==='block')actor._blockingUntil=this.t+.35;
        }
      }
    }

    // Física contínua da bola.
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.z += b.vz * dt; b.vz -= 20 * dt;
    if (b.z < 0) { b.z = 0; b.vz = -b.vz * 0.4; }
    const fr = b.passKind === 'launch' ? 0.14 : 0.05;
    b.vx *= (1 - fr * dt); b.vy *= (1 - fr * dt);

    // Colisão temporal: o alvo só é fechado quando o segmento percorrido
    // neste frame realmente toca/cruza o ponto. A correção máxima é sub-frame.
    const segX=b.x-prevX,segY=b.y-prevY,seg2=segX*segX+segY*segY;
    let crossed=false,closestDist=Infinity,hitX=b.x,hitY=b.y;
    if(seg2>1e-9){
      const u=clamp(((b.target.x-prevX)*segX+(b.target.y-prevY)*segY)/seg2,0,1);
      const cx=prevX+segX*u,cy=prevY+segY*u;
      closestDist=D(cx,cy,b.target.x,b.target.y);
      crossed=u>0&&u<1&&closestDist<=.42;
      if(crossed){hitX=cx;hitY=cy;}
    }
    const reached=D(b.x,b.y,b.target.x,b.target.y)<=.42;

    // Passes continuam usando a regra normal de saída. Chutes podem atravessar
    // a linha de fundo porque o alvo de gol fica ligeiramente além da linha.
    if(b.kind!=='shot'&&b.kind!=='deflect'&&(b.y<0||b.y>FW||b.x<0||b.x>FL)){
      this._ballOut();return;
    }

    if(reached||crossed){
      // A posição final vem da integração. Quando o segmento cruzou o alvo,
      // recuamos somente ao ponto sub-frame realmente atravessado, nunca ao
      // destino por teletransporte.
      if(crossed){
        const correction=D(b.x,b.y,hitX,hitY);
        const stepDistance=Math.hypot(segX,segY);
        b.x=hitX;b.y=hitY;
        if(this.visualIntegrity){
          this.visualIntegrity.maxSubframeCorrection=Math.max(this.visualIntegrity.maxSubframeCorrection,correction);
          if(correction>stepDistance+1e-6)this.visualIntegrity.teleports++;
        }
      }
      b.traveling=false;
      const cb=b.onArrive;b.onArrive=null;
      if(cb)cb();
      return;
    }

    // Timeout não força resultado nem teleporta a bola. Aborta de modo seguro
    // e registra falha técnica para que nenhum save/gol falso seja exibido.
    const hardTimeout=b.travelT>Math.max((b._timeout||2.2)*3,4.5);
    const escaped=b.x<-12||b.x>FL+12||b.y<-18||b.y>FW+18;
    if(hardTimeout||escaped){
      b.traveling=false;b.onArrive=null;
      if(this.visualIntegrity)this.visualIntegrity.travelFaults++;
      this._emit('visual_travel_fault',{kind:b.kind,outcome:b.meta&&b.meta.outcome,time:b.travelT,x:b.x,y:b.y});
      if(b.lastTouch&&b.kind==='shot')this._goalKickOrRestart(1-b.lastTouch.team);
      else this._contestLoose();
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

  /* MOTOR VISUAL · DEFLEXÃO CONTÍNUA: a bola muda de trajetória APENAS no
     ponto de contato — daí viaja de verdade até o destino, em vez de
     teleportar. Usada em rebotes de defesa e desvios na barreira. */
  _deflectTo(x, y, spd) {
    const b = this.ball;
    b.owner = null; b.traveling = true; b.travelT = 0;
    b.from = { x: b.x, y: b.y };
    b.target = { x, y };
    b.kind = 'deflect'; b.passKind = 'short';
    // limpa o ator/meta da trajetória anterior: o goleiro não continua sendo
    // puxado atrás do rebote depois do contato.
    b.meta = { outcome:'deflect' };
    const d = Math.max(D(b.x, b.y, x, y), 0.1);
    const v = spd || 11;
    b.vx = (x - b.x) / d * v; b.vy = (y - b.y) / d * v;
    b.z = Math.max(b.z, 0.2); b.vz = 1.5; b.speed = v;
    b._timeout = d / v + 0.3;
    b.onArrive = () => this._looseBall(x, y);
    b.receiver = null;
  }

  _looseBall(x, y) {
    const b = this.ball; b.owner = null; b.traveling = false; b.meta = null;
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
    // R7: a bola não perde toda a energia em poucos quadros. Ainda desacelera,
    // mas continua rolando o bastante para a disputa parecer natural.
    b.vx = (b.vx || 0) * (1 - 0.92 * dt); b.vy = (b.vy || 0) * (1 - 0.92 * dt);
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
    const baseControl=facet(m,'control')/100;
    const reception=this.getReceptionIntelligenceProfile?this.getReceptionIntelligenceProfile(m,ctx):null;
    const active=!!(reception&&reception.activeReception);
    const control=baseControl;
    const rstats=this.__r1810ReceptionStats||(this.__r1810ReceptionStats={receptions:0,pressured:0,attributeReceptions:0,poorTouches:0,looseTouches:0,
      settleTotal:0,firstActions:0,firstActionTemperatureAdjustments:0,firstActionPressureTotal:0});
    rstats.receptions++;if(ctx.pressure>.35)rstats.pressured++;if(active)rstats.attributeReceptions++;
    let poor=false;
    const poorP=clamp(.025+(1-control)*.19+ctx.pressure*.12+ctx.fatigue*.08+ctx.importance*(1-control)*.22,.015,.32);
    if(chance(poorP)){
      poor=true;rstats.poorTouches++;
      m._poorTouchUntil=this.t+1.25;
      this._emit('looseControl',{by:m,pressured:ctx.pressure>.35,receptionIQ:reception&&reception.receptionIQ});
      const looseP=clamp(.28+(1-control)*.38+ctx.pressure*.22,.18,.72);
      if(chance(looseP)){rstats.looseTouches++;this._looseBall(m.x+R(-2,2),m.y+R(-2,2));return;}
    }
    this._giveBall(m);
    if(active)m.settle=lerp(CAL.possession.firstTouchMax,CAL.possession.firstTouchMin,control)/ctx.execution*reception.settleMultiplier*(1+reception.incomingDifficulty*.008);
    else m.settle=lerp(CAL.possession.firstTouchMax,CAL.possession.firstTouchMin,control)/ctx.execution;
    if(poor||m._poorTouchUntil>this.t)m.settle=Math.max(m.settle,.38*(active?reception.settleMultiplier:1));
    const tmR=this.teams[m.team];
    if(tmR._poss&&tmR._poss.phase==='build'&&near.dist<5){
      if(active)m.settle=Math.min(m.settle,(.10+(1-control)*.12)*reception.settleMultiplier*(1+reception.incomingDifficulty*.005));
      else m.settle=Math.min(m.settle,.10+(1-control)*.12);
    }
    if(reception&&(reception.activeReception||reception.activeFirstAction)){
      m._r1810Reception=Object.assign({},reception,{time:this.t,poorTouch:poor,settle:m.settle});
      m._r1810FirstActionUntil=this.t+.95;
    }
    rstats.settleTotal+=m.settle;
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
    /* §SONDA OS-98 · o OPERADOR, nao o valor.
       Medido: `decideT` ja esta NEGATIVO em 96,92% das recepcoes (mediana
       -0,802 s), entao `Math.min(-0,80 , 0,10)` = -0,80 e este teto nunca e
       aplicado — ele mudou algo em apenas 1,87% das 4162 recepcoes medidas.
       A OS-68 multiplicou o VALOR e mediu dominio identico; era inevitavel.
       Aqui a recepcao ATRIBUI o intervalo, e o receptor espera de verdade. */
    this.decideT=0.28;
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
      const atkCtx=this._actionContext(o,nd,'carry'),defCtx=this._actionContext(near,nd,'press');
      const poor=(o._poorTouchUntil||0)>this.t?8:0;
      const p=duelProb(facet(near,'tackle')*defCtx.execution+facet(near,'press')*.12+poor,facet(o,'carry')*atkCtx.execution+6);
      const defBox=(defTm.attackDir>0?near.x<16.5:near.x>FL-16.5)&&Math.abs(near.y-FW/2)<20;
      near._inBoxDuel=defBox;
      const baseRate=distToOwnGoal<30?CAL.defending.tackleAttemptRate*1.20:distToOwnGoal<55?CAL.defending.tackleAttemptRate:CAL.defending.tackleAttemptRate*.72;
      const energy=clamp(.45+stamina*.65,.45,1.08);
      const triggerRate=1+trigger*.72;
      const attemptRate=(defBox?CAL.defending.boxAttemptRate:baseRate)*defTm.fx.tackle*defTm.mood.tackle*energy*triggerRate;
      const attemptP=1-Math.exp(-Math.max(0,p*attemptRate)*dt);
      if(chance(attemptP)){
        near._tackleCd=CAL.timing.tackleCooldown*lerp(1.18,.78,work);
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
    return ownBox ? base * 0.80 : base;
  }
  _awardFoul(fouler, victim) {
    this.stats[fouler.team].fouls++;
    this._emit('foul', { by: fouler, on: victim });
    // cartão?
    const _r19r = (typeof fouler.__r19risco === 'number' && isFinite(fouler.__r19risco)) ? fouler.__r19risco : .30;
    fouler.__r19risco = null;
    const _r19base = fouler.yellow >= 1 ? CAL.defending.yellowSecond : CAL.defending.yellowFirst;
    const hard = chance(Math.max(.02, Math.min(.72, _r19base * (.40 + 4.2 * _r19r))));
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
      const persistenceRisk = victim.persistence ? (victim.persistence.injuryRisk || 1) : 1;
      const pInj = (hard ? 0.05 : 0.012) * clamp(1.3 - resist / 100, 0.5, 1.15) * persistenceRisk;
      if (chance(pInj)) this._injure(victim);
    }
    const vg = this.teams[victim.team].oppGoal;
    const dtg = D(victim.x, victim.y, vg.x, vg.y);
    // pênalti?
    const inBox = (this.teams[victim.team].attackDir > 0 ? victim.x > FL - 16.5 : victim.x < 16.5) && Math.abs(victim.y - FW/2) < 20;
    if (inBox) { this._penalty(victim.team); return; }
    // falta perigosa → cobrança direta
    /* OS-10 · sem corte de distancia: _freeKick (:6718) ja escolhe direct/
       crossed/short pela propria distancia. O 0.92 deixa espaco para vantagem. */
    /* OS-31 · perto do gol vira lance de cobranca; longe, reinicio rapido.
       Toda falta continua sendo bola parada — o que muda e a cerimonia. */
    if (dtg < 42 && chance(0.92)) { this._freeKick(victim.team, victim.x, victim.y); return; }
    // falta comum: reinício com posse
    this.dead = 0.82;
    this.pendingRestart = () => { this._giveBall(this._nearestFieldMate(victim)); this.ball.owner.settle = 0.6; };
  }
  _nearestFieldMate(p){
    const tm = this.teams[p.team]; return tm.players.filter(x=>!x.red&&!x.isGK).sort((a,b)=>D(a.x,a.y,p.x,p.y)-D(b.x,b.y,p.x,p.y))[0] || p;
  }

  _freeKick(team, x, y, input) {
    const tm = this.teams[team];
    const taker = ((tm.__cdsChosenTaker&&!tm.__cdsChosenTaker.red&&!tm.__cdsChosenTaker.isGK&&tm.players.indexOf(tm.__cdsChosenTaker)>=0)?tm.__cdsChosenTaker:tm.players.filter(p=>!p.red&&!p.isGK).sort((a,b)=> facet(b,'setpiece')-facet(a,'setpiece'))[0]);
    const gk = this.teams[1-team].players.find(p=>p.isGK&&!p.red);
    const vg = tm.oppGoal;
    const dtg = D(x, y, vg.x, vg.y);
    if (input == null && this._requestSetPiece('freekick', { team, taker, gk, x, y, dist:dtg },
      chosen => this._freeKick(team, x, y, chosen))) return;

    const manual = !!(input && !input.assisted);
    const aerial = tm.players.filter(p=>!p.red&&!p.isGK&&p!==taker).sort((a,b)=>facet(b,'head_atk')-facet(a,'head_atk'));
    const oppAerial = this.teams[1-team].players.filter(p=>!p.red&&!p.isGK).sort((a,b)=>facet(b,'head_def')-facet(a,'head_def'));
    const aerialEdge = (aerial[0]?facet(aerial[0],'head_atk'):50) - (oppAerial[0]?facet(oppAerial[0],'head_def'):50);
    let routine = input && input.routine;
    if (!routine) {
      /* OS-53 · o angulo entra na decisao. Medido: diretas 1,90 contra
         cruzamentos 3,92, porque a rotina saia so da distancia — falta a 22 m
         na linha lateral virava chute e falta a 28 m em frente ao gol virava
         cruzamento. Quem decide e a posicao em relacao a meta. */
      const _o53lat = Math.abs(y - vg.y);
      if (manual || (_o53lat <= 13.5 && dtg <= 33) || (dtg <= 24 && _o53lat <= 19)
          || (dtg <= 29 && facet(taker,'setpiece') >= 78 && chance(.62))) routine='direct';
      else if (dtg <= 42 && (aerialEdge > -5 || chance(.58))) routine='crossed';
      else routine='short';
    }
    this._emit('freekick_routine',{team,by:taker,routine,dist:dtg});

    if (routine === 'crossed') {
      this.stats[team].freeKickCrossed++;
      const sideY = y < FW/2 ? 1 : FW-1;
      taker.x=clamp(x,2,FL-2); taker.y=clamp(y,2,FW-2);
      aerial.slice(0,3).forEach((a,i)=>{a._setPieceRole=i===0?'target_primary':i===1?'target_far':'second_ball';a.x=clamp(vg.x-tm.attackDir*(7+i*2.8),2,FL-2);a.y=clamp(FW/2+(i-1)*5.2,3,FW-3);});
      this.dead=.45;
      this.pendingRestart=()=>{this._giveBall(taker);taker._setPieceDeliveryUntil=this.t+2.2;this._cross(taker);};
      return;
    }
    if (routine === 'short') {
      this.stats[team].freeKickShort++;
      const mate=tm.players.filter(p=>!p.red&&!p.isGK&&p!==taker).sort((a,b)=>D(a.x,a.y,x,y)-D(b.x,b.y,x,y))[0];
      this.dead=.35;
      this.pendingRestart=()=>{
        this._giveBall(taker);
        if(!mate){this._clearBall(taker);return;}
        mate.x=clamp(x+tm.attackDir*5,2,FL-2);mate.y=clamp(y+(y<FW/2?4:-4),2,FW-2);
        this.stats[team].passes++;
        this._startTravel(taker,{x:mate.x,y:mate.y},'pass',()=>{this.stats[team].passOk++;mate._setPieceDeliveryUntil=this.t+2;this._receive(mate);},mate,'short');
      };
      return;
    }

    /* §OS-87 · O COBRADOR PRECISA SER IDENTIFICAVEL.
       Medido na R18.87: no instante do chute o cobrador estava a 9,162 m da
       bola (mediana), 22,385 m no pior caso — metade das cobrancas era
       chutada por ninguem. A camada de caminhada (:21555) elege o batedor
       como "o jogador mais proximo do ponto, porque o nucleo o pos la", e
       essa premissa so vale para o ramo `crossed`, que teleporta em :6922.
       O ramo direto nao teleporta ninguem, entao ela fazia a VITIMA da falta
       andar ate a bola enquanto o especialista chutava de longe.
       O escanteio ja resolve isso marcando o cobrador (:7107). A direta passa
       a usar a mesma convencao. */
    taker._setPieceRole = 'taker';
    taker.__os87Spot = { x: x, y: y };

    /* OS-36 · a direta passa a resolver no reinicio. Antes ela resolvia no
       apito e a camada :20931 cancelava o voo ao devolver a bola ao ponto para
       o cobrador andar — 12 de 21 diretas terminavam em nada, ja contadas em
       shots e xG. */
    const _os36Bater = () => {
    this.stats[team].freeKickDirect++;
    this.stats[team].shots++;
    this.stats[team].setPieceShots++;
    this.beat = 0.5;
    const takerSkill = facet(taker,'setpiece') * (1 + ((taker.persistence && taker.persistence.setPieceBonus) || 0));
    const keeperSkill = gk ? facet(gk,'gk') : 40;
    const resolved = C.resolveFreeKickPhysics(takerSkill, keeperSkill, dtg, input);
    let { result, pGoal, visual } = resolved;
    const tmA=this.teams[team];
    const goalY=clamp(tmA.oppGoal.y+((visual&&visual.actualX!=null)?(visual.actualX-.5)*6:R(-3,3)),tmA.oppGoal.y-3.3,tmA.oppGoal.y+3.3);
    const fkHeight=clamp((1-((visual&&Number.isFinite(visual.actualY))?visual.actualY:.52))*2.35,.16,2.32);
    const fkGoalAim={x:tmA.oppGoal.x+tmA.attackDir*.9,y:goalY,z:fkHeight};
    const fkSpeed=clamp(34+facet(taker,'shot')/100*16,32,54);
    const saveTarget=this._gkInterceptTarget(gk,taker.x,taker.y,fkGoalAim,fkSpeed,1.95);
    if(result==='save'&&!saveTarget)result='miss';
    this.stats[team].xg += pGoal;
    this._emit('freekick', { by: taker, manual:resolved.manual, visual, result, pGoal, direct:true });
    if (result === 'goal') {
      const gt={x:tmA.oppGoal.x+tmA.attackDir*.9,y:goalY};
      this._startTravel(taker,gt,'shot',()=>{taker._setPieceShotUntil=this.t+1;this._goal(taker,true);},null,'shot',{outcome:'goal'});
    }
    else if (result === 'save') {
      this._startTravel(taker,saveTarget,'shot',()=>this._gkResolveSave(gk,taker,{atk:takerSkill,oneOnOne:false,saveTarget,g:tmA.oppGoal,tm:tmA,cornerChance:CAL.restarts.freeKickSaveCorner}),null,'shot',{outcome:'save',actor:gk,contactRadius:1.95,interceptT:saveTarget.t});
    }
    else if (result === 'wall') {
      const defenders=this.teams[1-team].players.filter(p=>!p.red&&!p.isGK);
      const wp={x:lerp(x,tmA.oppGoal.x,.20),y:lerp(y,tmA.oppGoal.y,.20)};
      const wall=defenders.slice().sort((a,b)=>D(a.x,a.y,wp.x,wp.y)-D(b.x,b.y,wp.x,wp.y))[0];
      const wallHit=wall?this._actorInterceptTarget(wall,this.ball.x,this.ball.y,wp,30,2.05,'shot','shot'):null;
      if(wall&&wallHit){
        this._startTravel(taker,wallHit,'shot',()=>{
          const _cv=this._physicalContactValid(wall,2.05,this.ball.z),d=_cv.horizontal;
          if(!_cv.ok){
            if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
            this._emit('visual_contact_failed',{kind:'wall',by:wall,distance:d});
            this._continueTravel({x:tmA.oppGoal.x+tmA.attackDir*2,y:tmA.oppGoal.y+R(5,9)*(chance(.5)?1:-1)},'shot',()=>{this._emit('miss',{by:taker,reason:'wall_did_not_reach'});this._goalKickOrRestart(1-team);},{outcome:'miss'},28);
            return;
          }
          this._recordVisualContact('wall_block',wall,this.ball.x,this.ball.y,{distance:d,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface});
          this._emit('blocked',{by:wall,kind:'wall',contact:{x:this.ball.x,y:this.ball.y,distance:d}});
          this._deflectTo(clamp(this.ball.x-tmA.attackDir*R(1,5),2,FL-2),clamp(this.ball.y+R(-6,6),2,FW-2),12);
        },null,'shot',{outcome:'block',actor:wall,contactRadius:2.05,targetZ:wallHit.z,interceptT:wallHit.t});
      } else this._startTravel(taker,{x:tmA.oppGoal.x+tmA.attackDir*2,y:tmA.oppGoal.y+R(5,9)*(chance(.5)?1:-1)},'shot',()=>{this._emit('miss',{by:taker,reason:'no_physical_wall'});this._goalKickOrRestart(1-team);},null,'shot',{outcome:'miss'});
    }
    else this._startTravel(taker,{x:tmA.oppGoal.x+tmA.attackDir*2,y:tmA.oppGoal.y+R(5,10)*(chance(.5)?1:-1)},'shot',()=>{this._emit('miss',{by:taker});this._goalKickOrRestart(1-team);},null,'shot',{outcome:'miss'});
    };
    this.dead = Math.max(Number(this.dead) || 0, .9);
    /* §OS-87 · a marca do cobrador morre com o lance: se sobrevivesse, a
       camada de caminhada elegeria o mesmo jogador na proxima bola parada. */
    const _os87Bater = () => { try { taker._setPieceRole = null; taker.__os87Spot = null; } catch (_) {} return _os36Bater(); };
    this.pendingRestart = _os87Bater;
  }

  _penalty(team, input) {
    const tm = this.teams[team];
    const taker = tm.players.filter(p=>!p.red).sort((a,b)=> facet(b,'pen')-facet(a,'pen'))[0];
    const gk = this.teams[1-team].players.find(p=>p.isGK&&!p.red);
    if (input == null && this._requestSetPiece('penalty', { team, taker, gk },
      chosen => this._penalty(team, chosen))) return;
    this.stats[team].shots++;
    this.stats[team].setPieceShots++;
    this.stats[team].penaltiesTaken++;
    this.beat = 0.7;
    const takerSkill = facet(taker,'pen') * (1 + ((taker.persistence && taker.persistence.setPieceBonus) || 0));
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
    let result = offTarget ? 'miss' : chance(pGoal) ? 'goal' : 'save';
    const visual = { aimX, aimY, actualX, actualY, power, curve, execution };
    /* MOTOR VISUAL: o pênalti agora É um lance físico — a bola sai do pé,
       voa até o canto escolhido e o goleiro mergulha para o ponto real. */
    const tmA = this.teams[team], pg = tmA.oppGoal;
    const aimLat = clamp(pg.y + (actualX - .5) * 6.6, pg.y - 3.3, pg.y + 3.3);
    const penaltyHeight=clamp((1-actualY)*2.35,.12,2.28);
    const penaltyGoalAim={x:pg.x+tmA.attackDir*.9,y:aimLat,z:penaltyHeight};
    const penaltySpeed=clamp(34+facet(taker,'shot')/100*16,32,54);
    const penaltySaveTarget=this._gkInterceptTarget(gk,taker.x,taker.y,penaltyGoalAim,penaltySpeed,1.95);
    if(result==='save'&&!penaltySaveTarget)result='goal';
    this._emit('penalty', { by: taker, manual, visual, result });
    if (result === 'goal') {
      this._startTravel(taker, { x: pg.x + tmA.attackDir * .9, y: aimLat }, 'shot',
        () => { this.stats[team].penaltiesScored++; taker._setPieceShotUntil = this.t + 1; this._goal(taker, false); }, null, 'shot');
      return;
    }
    if (result === 'save') {
      const st = penaltySaveTarget;
      this._startTravel(taker, st, 'shot', () => {
        const _cv=gk?this._physicalContactValid(gk,1.95,this.ball.z):{ok:false,horizontal:Infinity,maxZ:0,surface:'none'};
        const gd=_cv.horizontal;
        if(!gk||!_cv.ok){
          if(this.visualIntegrity)this.visualIntegrity.failedContacts++;
          this._emit('visual_contact_failed',{kind:'penalty_save',gk,distance:gd,target:st});
          this._continueTravel({x:pg.x+tmA.attackDir*.95,y:aimLat},'shot',()=>{this.stats[team].penaltiesScored++;taker._setPieceShotUntil=this.t+1;this._goal(taker,false);},{outcome:'goal_after_failed_penalty_reach'},Math.max(30,this.ball.speed*.75));
          return;
        }
        this._recordVisualContact('penalty_save',gk,this.ball.x,this.ball.y,{distance:gd,z:this.ball.z,maxZ:_cv.maxZ,surface:_cv.surface,interceptT:st&&st.t,ballTime:st&&st.ballTime,margin:st&&st.margin,verticalMargin:st&&st.verticalMargin});
        this.stats[team].onTarget++;
        this.stats[team].penaltiesSaved++;
        gk.rating+=0.4;
        this.stats[1-team].saves++;
        this.stats[1-team].gkShotsFaced++;
        this._emit('pen_miss',{by:taker,gk,saved:true,contact:{x:this.ball.x,y:this.ball.y,distance:gd}});
        this._goalKickOrRestart(1-team);
      }, null, 'shot',{outcome:'save',actor:gk,contactRadius:1.95,interceptT:st.t});
      return;
    }
    this._startTravel(taker, { x: pg.x + tmA.attackDir * 2, y: pg.y + (actualX < .5 ? -1 : 1) * R(4.5, 7) }, 'shot',
      () => { this.stats[team].penaltiesMissed++; this._emit('pen_miss', { by: taker, gk: null, saved: false }); this._goalKickOrRestart(1-team); }, null, 'shot');
  }

  /* ---------------------------- ESCANTEIO ----------------------------- */
  _bumpMom(team, v) { if (!this.mom) this.mom = [0,0]; this.mom[team] = clamp(this.mom[team] + v, 0, 1); this.mom[1-team] = clamp(this.mom[1-team] - v*0.6, 0, 1); }
  _setCorner(team, forcedRoutine, forcedDefStyle) {
    this._bumpMom(team, 0.10);
    this.stats[team].corners++;
    const tm = this.teams[team], defTm=this.teams[1-team];
    const dir = tm.attackDir, g = tm.oppGoal;
    const taker = ((tm.__cdsChosenTaker&&!tm.__cdsChosenTaker.red&&!tm.__cdsChosenTaker.isGK&&tm.players.indexOf(tm.__cdsChosenTaker)>=0)?tm.__cdsChosenTaker:tm.players.filter(p=>!p.red && !p.isGK).sort((a,b)=> facet(b,'setpiece')-facet(a,'setpiece'))[0]);
    const attackers = tm.players.filter(p=>!p.red&&!p.isGK&&p!==taker).sort((a,b)=>facet(b,'head_atk')-facet(a,'head_atk'));
    const defenders = defTm.players.filter(p=>!p.isGK&&!p.red).sort((a,b)=>facet(b,'head_def')-facet(a,'head_def'));
    const aerialEdge=(attackers[0]?facet(attackers[0],'head_atk'):50)-(defenders[0]?facet(defenders[0],'head_def'):50);
    let routine=forcedRoutine;
    if (!routine) {
      if (aerialEdge < -7 && facet(taker,'setpiece')>72 && chance(.38)) routine='short';
      else if (attackers[0] && getAttr(attackers[0],'impulsao')>80 && chance(.38)) routine='near_post';
      else if (attackers[1] && facet(attackers[1],'head_atk')>76 && chance(.42)) routine='far_post';
      else routine='penalty_spot';
    }
    const defStyle = forcedDefStyle || (defenders.length>=4 && defenders.slice(0,4).reduce((n,d)=>n+facet(d,'head_def'),0)/4>76 ? 'zonal' : chance(.5)?'mixed':'man');
    this.stats[team][routine==='near_post'?'cornersNearPost':routine==='far_post'?'cornersFarPost':routine==='short'?'cornersShort':'cornersPenaltySpot']++;
    this.stats[1-team][defStyle==='zonal'?'cornerDefZonal':defStyle==='man'?'cornerDefMan':'cornerDefMixed']++;

    /* §OS-74 · o lado do escanteio passa a seguir por onde a bola saiu.
     Medido antes: 37,0% de concordancia em 54 escanteios legiveis, compativel
     com cara-ou-coroa. A informacao ja estava em this.ball.y e nao era lida.
     O chance(.5) continua sendo CHAMADO de proposito, e o resultado dele so e
     usado quando nao ha lado confiavel: assim o consumo do gerador seedado fica
     identico ao da base e a bateria pareada mede efeito, nao caos (HANDOFF §6).
     Quando a bola ja foi recolocada ao centro antes desta chamada nao existe
     lado para ler, e ai o sorteio decide — inventar um seria pior. */
  const _os74Sorteio = chance(.5);
  const _os74Y = (this.ball && Number.isFinite(this.ball.y)) ? this.ball.y : null;
  const _os74X = (this.ball && Number.isFinite(this.ball.x)) ? this.ball.x : null;
  /* Na linha de fundo, inclusive perto do centro em y, a origem e fisica e
     autoritativa. A margem so protege chamadas administrativas ainda no campo. */
  const _os74ForaFundo = _os74X !== null && (_os74X <= 0 || _os74X >= FL);
  const _os74TemLado = _os74Y !== null && (_os74ForaFundo || Math.abs(_os74Y - FW / 2) > 4);
  const cy = _os74TemLado ? (_os74Y < FW / 2 ? 1.5 : FW - 1.5) : (_os74Sorteio ? 1.5 : FW - 1.5), sign=cy<FW/2?-1:1;
    taker.x=clamp(g.x-dir*.8,1,FL-1);taker.y=cy;taker.settle=1.2;taker._setPieceRole='taker';
    const zones = routine==='near_post'
      ? [[5.2,-3.0],[8.8,2.0],[11.5,6.5]]
      : routine==='far_post'
      ? [[9.5,5.5],[6.8,-1.5],[12.5,-6.0]]
      : [[9.0,0],[7.0,-5],[11.5,5.5]];
    attackers.slice(0,3).forEach((a,i)=>{const z=zones[i];a._setPieceRole=i===0?'target_primary':i===1?'target_secondary':'second_ball';a.x=clamp(g.x-dir*z[0],2,FL-2);a.y=clamp(g.y+z[1]*sign,3,FW-3);});
    const rebound=attackers[3];if(rebound){rebound._setPieceRole='rebound';rebound.x=clamp(g.x-dir*19,2,FL-2);rebound.y=clamp(g.y,4,FW-4);}
    attackers.slice(4,6).forEach((a,i)=>{a._setPieceRole='cover';a.x=clamp(g.x-dir*(29+i*5),2,FL-2);a.y=clamp(g.y+(i?10:-10),4,FW-4);});

    defenders.slice(0,4).forEach((d,i)=>{
      d._setPieceRole=defStyle==='man'?'mark':defStyle==='zonal'?'zone':'mixed';
      if(defStyle==='man'&&attackers[i]){d.x=clamp(attackers[i].x-dir*.9,2,FL-2);d.y=clamp(attackers[i].y+(i%2?.7:-.7),3,FW-3);}
      else {d.x=clamp(g.x-dir*(4.8+i*1.7),2,FL-2);d.y=clamp(g.y+(i-1.5)*4.3,3,FW-3);}
    });
    const counter=defenders[4];if(counter){counter._setPieceRole='counter';counter.x=clamp(g.x-dir*28,2,FL-2);counter.y=g.y;}

    this.ball.owner=null;this.ball.traveling=false;this.ball.x=taker.x;this.ball.y=taker.y;this.ball.z=0;
    this.ball.vx=this.ball.vy=this.ball.vz=0;this.ball.target=null;this.ball.receiver=null;
    this._emit('corner',{team,by:taker,x:taker.x,y:taker.y,routine,defStyle,assignments:tm.players.filter(p=>p._setPieceRole).map(p=>({idx:p.idx,role:p._setPieceRole}))});
    this.dead=.6;
    this.pendingRestart=()=>{
      this._giveBall(taker);
      if(routine==='short'){
        const support=attackers[0];
        if(!support){taker._setPieceDeliveryUntil=this.t+2;this._cross(taker);return;}
        support.x=clamp(taker.x-dir*5,2,FL-2);support.y=clamp(taker.y-sign*5,2,FW-2);support._setPieceRole='short_option';
        this.stats[team].passes++;
        this._startTravel(taker,{x:support.x,y:support.y},'pass',()=>{this.stats[team].passOk++;support._setPieceDeliveryUntil=this.t+2.2;this._receive(support);},support,'short');
      }else{
        /* AUDITORIA · cruzamento fechado (inswinger) ou aberto (outswinger):
           decidido pelo pé dominante do cobrador × lado do escanteio.
           Fechado gira para o gol: primeiro contato mais perigoso, mas o
           goleiro alcança mais bolas; aberto foge do goleiro. */
        const foot=(taker.ref&&taker.ref.profileV3&&taker.ref.profileV3.dominantFoot)||'right';
        const leftCorner=dir>0?cy<FW/2:cy>FW/2;
        const inswing=(foot==='right')===leftCorner;
        this.stats[team][inswing?'cornersInswinger':'cornersOutswinger']++;
        taker._deliverySwing=inswing?'in':'out';taker._deliverySwingUntil=this.t+3;
        this._emit('corner_delivery',{team,by:taker,swing:taker._deliverySwing});
        taker._setPieceDeliveryUntil=this.t+2.2;this._cross(taker);
      }
    };
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
        /* OS-200 · mano a mano exige estar PERTO do gol, nao so sem marcador.
           `cover>6` sozinho classificava como breakaway um chute de 25 m sem
           defensor por perto, e o goleiro entao ignorava o teto de avanco e
           saia da area para enfrentar um chute de fora. */
        const breakaway=cover>6&&danger<18;
        const narrow=clamp((34-danger)*.30+(breakaway?4.2:0),0,13);
        depth+=narrow*(.48+sweep/210+(isSweeper?.12:0));
        /* OS-200 · TETO DE AVANCO FORA DO MANO A MANO.
           `narrow` cresce quando o atacante se APROXIMA, entao um chute de
           16 m punha o goleiro a ~10 m da propria linha — medido: 9,9 m de
           media no momento do chute. Ele ficava a 6 m do batedor, e a bola
           passava por ele antes do tempo de reacao terminar.

           Isso nunca apareceu porque a defesa era sorteada antes da bola sair
           do pe: a posicao do goleiro nao decidia nada. Com o desfecho vindo da
           geometria, ela decide tudo, e o erro fica visivel na hora.

           No mano a mano sair e correto e continua liberado. No resto, o
           avanco fica preso a uma fracao da distancia do chute: 2,8 m para um
           chute de 8 m, 4,0 m para um de 16 m, 6,1 m para um de 30 m. */
        if(!breakaway)depth=Math.min(depth,1.6+danger*.15);
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
    /* OS-19 · bissetriz real: o goleiro fica sobre o segmento bola->gol, a
       `depth` da linha. O lerp de fator fixo acima o punha ate 8 m fora do
       poste com a bola aberta. Mesclado por `posicionamento`, para que a
       diferenca entre goleiros continue existindo. */
    {
      const _rx=(b&&b.owner&&b.owner.team!==tm.side)?b.owner.x:(b?b.x:goal.x);
      const _ry=(b&&b.owner&&b.owner.team!==tm.side)?b.owner.y:(b?b.y:goal.y);
      const _dx=_rx-goal.x,_dy=_ry-goal.y,_L=Math.max(.6,Math.hypot(_dx,_dy));
      const _bis=goal.y+_dy/_L*depth;
      if(Number.isFinite(_bis))ty=clamp(lerp(ty,_bis,clamp(pos/100,.35,1)*0.85),6,FW-6);
    }
    const rawX=goal.x+tm.attackDir*depth;
    /* §R18.40 · O plano e a execucao passam a concordar. A camada R10 ja
       aponta a bola para o ponto de interceptacao calculado para ESTE goleiro;
       faltava o goleiro ir ate ele. Sem o desvio abaixo, o contato falha por
       ausencia e o lance vira gol automatico (21,9% dos gols medidos). A
       espera do _gkAI tambem e ignorada aqui: congelar o alvo por ate 0,25 s
       enquanto a bola voa e exatamente o que fazia o corpo chegar atrasado. */
    if(b&&b.traveling&&b.kind==='shot'&&b.meta&&b.meta.actor===p&&b.target
       &&Number.isFinite(b.target.x)&&Number.isFinite(b.target.y)){
      p._gkAI={x:b.target.x,y:b.target.y,wait:0};
      return [b.target.x,b.target.y];
    }
    if(!p._gkAI)p._gkAI={x:rawX,y:ty,wait:0};
    p._gkAI.wait-=dt;
    if(p._gkAI.wait<=0){p._gkAI.x=rawX;p._gkAI.y=ty;p._gkAI.wait=lerp(.25,.065,(reflex*.45+anticipation*.55)/100);}
    return [p._gkAI.x,p._gkAI.y];
  }

  _goalkeeperClaim(tm, p, b, dt) {
    p._gkClaimCd = Math.max(0, (p._gkClaimCd || 0) - dt);
    if (p._gkClaimCd > 0 || !b.traveling || b.kind !== 'pass' || !b.target || !b.lastTouch) return false;
    if (b.lastTouch.team === tm.side || D(b.target.x, b.target.y, tm.goal.x, tm.goal.y) > 19) return false;
    const domain=getAttr(p,'dominio_area'),exit=getAttr(p,'saida_gol'),reflex=getAttr(p,'reflexos'),security=getAttr(p,'seguranca');
    const sw=b.lastTouch&&(b.lastTouch._deliverySwingUntil||0)>this.t?b.lastTouch._deliverySwing:null;
    const radius=1.25+domain/100*1.65+(sw==='in'?.55:sw==='out'?-.55:0);
    if(D(p.x,p.y,b.x,b.y)>radius||b.z>2.7)return false;
    let rival=null,rd=1e9;for(const a of this.teams[1-tm.side].players){if(a.red||a.isGK)continue;const d=D(a.x,a.y,b.x,b.y);if(d<rd){rd=d;rival=a;}}
    this.stats[tm.side].gkClaimsAttempted++;
    const claimSkill=domain*.44+exit*.31+reflex*.15+security*.10;
    const aerialThreat=rival&&rd<5.5?facet(rival,'head_atk'):42;
    const win=clamp(duelProb(claimSkill+9,aerialThreat),.48,.96);
    p._gkClaimCd=.65;
    if(!chance(win)){this.stats[tm.side].gkClaimsMissed++;this._emit('gk_claim_miss',{gk:p,by:rival});return false;}
    b.onArrive=null;b.receiver=null;b.traveling=false;
    const pressure=clamp((5.5-rd)/5.5,0,1);
    const catchP=clamp(.46+security/190+domain/310-pressure*.35-b.z*.07,.18,.91);
    if(chance(catchP)){
      this.stats[tm.side].gkClaimsWon++;
      this._turnover(p);p.settle=Math.max(p.settle,.82);p.rating+=.10;
      if(D(p.x,p.y,tm.goal.x,tm.goal.y)>9||b.passKind==='through'){this.stats[tm.side].gkSweeps++;this._emit('gk_sweep',{gk:p,by:rival});}
      this._emit('gk_claim',{gk:p,by:rival,kind:'catch'});return true;
    }
    this.stats[tm.side].gkPunches++;
    // soco sob pressão pode morrer atrás da linha de fundo → escanteio
    if(chance(.30)){this._emit('gk_punch',{gk:p,by:rival,corner:true});this._setCorner(1-tm.side);return true;}
    const awayX=clamp(p.x+tm.attackDir*R(7,14),2,FL-2),awayY=clamp(p.y+(chance(.5)?-1:1)*R(6,15),2,FW-2);
    this._emit('gk_punch',{gk:p,by:rival,x:awayX,y:awayY});
    this._looseBall(awayX,awayY);return true;
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
        } else if (b.traveling && b.kind === 'pass' && b.receiver === p && b.target) {
          // R8 · RECEPÇÃO ATIVA: o receptor ataca o ponto físico do passe.
          // Antes ele continuava obedecendo ao alvo tático do bloco e podia
          // mudar de direção enquanto a bola chegava, transformando um passe
          // correto em bola perdida. Não há snap: o jogador corre até o contato.
          tx = clamp(b.target.x, 1, FL - 1); ty = clamp(b.target.y, 1, FW - 1);
        } else if (!b.owner && !b.traveling && b.__p04PendingReceiver === p) {
          // Se a bola passou muito perto, o receptor conclui a aproximação
          // fisicamente em vez de abandonar a jogada e esperar outro atleta.
          tx = clamp(b.x, 1, FL - 1); ty = clamp(b.y, 1, FW - 1);
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
                         (this.ball.traveling && this.ball.receiver === p) ||
                         !!(p.__r1821BoxRun && p.__r1821BoxRun.ate > this.t);
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
      if(oldScore>14||best+1.6<oldScore)tm._presser=nearest;
    }
    return tm._presser;
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
    /* OS-202 · ATENCAO: este ramo NAO roda. A camada R13
       (17-cds-r13-football-observer-cadence.js) intercepta `p === presser` e
       retorna sem chamar o core, mandando o marcador para 1,25 m do lado do
       proprio gol. Editar aqui nao muda nada — a correcao de perseguicao vive
       na ultima camada. Ja perdi uma rodada de medicao acreditando que este
       codigo valia. */
    if (p === presser) return [b.x, b.y];               // unico presser vai a bola
    // ANTECIPAÇÃO (§6): com a bola em voo, quem está perto da linha ataca o ponto
    if (b.traveling && b.kind === 'pass' && b.from && b.target && p !== tm._cover) {
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
    // SOMBRA DE PASSE (§7): um médio se posta na linha bola → atacante perigoso
    if (p === tm._shadow && tm._shadowTgt && ownHalf) {
      const tgt = tm._shadowTgt;
      return [clamp(lerp(b.x, tgt.x, 0.62), 2, FL - 2), clamp(lerp(b.y, tgt.y, 0.62), 2, FW - 2)];
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
    if (this.opts && this.opts.labMode) {
      // Em calibração estatística, todas as contagens relevantes já vivem em
      // `stats`. Só gols precisam atravessar o callback para registrar o minuto.
      if (type === 'goal') { try { this.onEvent(ev); } catch(e){} }
      return;
    }
    this.events.push(ev);
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
      react: clamp((lerp(0.255, 0.075,
        (getAttr(inPlayer,'posicionamento') * 0.45 + getAttr(inPlayer,'antecipacao') * 0.35 +
         getAttr(inPlayer,'trabalho_equipe') * 0.20) / 100) + R(-0.018, 0.018)) *
        (1 - (((inPlayer._phase10Persistence || {}).roleFamiliarity) || 0) * .03), 0.062, 0.27),
      stamina: clamp(Number(inPlayer._phase10InitialStamina != null ? inPlayer._phase10InitialStamina : 100),35,100),
      persistence: inPlayer._phase10Persistence || null,
      rating: 6.0, settle: 0, yellow: 0, red: false, isGK: outP.isGK, runT: 0
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
    } else if (stamina < 76) {
      /* §R18.40 · Era 62. O piso de estamina media do time medido em 30
         partidas e 61,8 — o gatilho estava abaixo do minimo que o motor
         produz, e o plano foi escolhido 1 vez em 2 908 decisoes (0,03%).
         Com p10 = 71,0 este gatilho poe a decisao ao alcance do jogo sem
         torna-la comum. As rotas de placar continuam antes desta na cascata. */
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
/* Copa dos Sonhos — Fases 4–7 — motor 5.0.0 */
(function(root){
'use strict';
const NODE=typeof module!=='undefined'&&module.exports;
let B=root;if(NODE)try{B=Object.assign({},require('./40-match-engine-and-manager-ai.js'),require('./20-core.js'));}catch(_){B=root;}
const M=B.MatchSim||root.MatchSim;if(!M||M.prototype.__P47__)return;
const V='5.0.0',FL=B.FL||105,FW=B.FW||68,C=B.clamp||((v,a,b)=>Math.max(a,Math.min(b,v))),L=B.lerp||((a,b,t)=>a+(b-a)*t),D=B.D||((a,b,c,d)=>Math.hypot(a-c,b-d));
const A=(p,k,f=65)=>{try{const z=p&&p.ref?p.ref:p;if(z&&z.attributesV3&&Number.isFinite(z.attributesV3[k]))return z.attributesV3[k];const q=B.getAttr||root.getAttr,v=q&&q(z,k);if(Number.isFinite(v))return v;}catch(_){}return f;};
const cp=x=>JSON.parse(JSON.stringify(x)),mg=(a,b)=>{const o=cp(a);for(const k in b)o[k]=b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&o[k]?mg(o[k],b[k]):cp(b[k]);return o;};
const DEF={inPossession:{buildup:{method:'balanced',focus:'mixed',useGoalkeeper:true},progression:{tempo:50,passLength:50,verticality:50,width:50,carryMore:false,passMore:false},finalThird:{workBall:false,earlyShots:false,crossType:'mixed',overlap:false,underlap:false,longShots:'balanced'}},transition:{afterLoss:'regroup',afterRecovery:'balanced',goalkeeperDistribution:'balanced'},outOfPossession:{block:'mid',defensiveLine:50,engagementLine:50,pressing:50,orientation:'balanced',marking:'zonal',preventCross:false,protectBox:true,offsideTrap:false}};
const P={balanced:DEF,possession:mg(DEF,{inPossession:{buildup:{method:'short',focus:'inside'},progression:{tempo:36,passLength:30,verticality:42,width:48,passMore:true},finalThird:{workBall:true,crossType:'cutback',underlap:true}},transition:{afterLoss:'counterpress',afterRecovery:'retain',goalkeeperDistribution:'short'},outOfPossession:{block:'high',defensiveLine:63,engagementLine:66,pressing:68}}),counter:mg(DEF,{inPossession:{buildup:{method:'direct'},progression:{tempo:78,passLength:74,verticality:83,width:55,carryMore:true},finalThird:{earlyShots:true,longShots:'more',overlap:true}},transition:{afterRecovery:'counter',goalkeeperDistribution:'fast'},outOfPossession:{defensiveLine:38,engagementLine:45,pressing:44}}),highPress:mg(DEF,{transition:{afterLoss:'counterpress',afterRecovery:'counter'},outOfPossession:{block:'high',defensiveLine:72,engagementLine:78,pressing:86,offsideTrap:true}}),lowBlock:mg(DEF,{inPossession:{buildup:{method:'direct',focus:'wide'},progression:{tempo:58,passLength:70,verticality:68,width:62},finalThird:{crossType:'high'}},transition:{afterRecovery:'counter',goalkeeperDistribution:'long'},outOfPossession:{block:'low',defensiveLine:24,engagementLine:32,pressing:28}}),wings:mg(DEF,{inPossession:{buildup:{focus:'wide'},progression:{width:82},finalThird:{overlap:true}}})};
const MAP={tiki:'possession',counter:'counter',press:'highPress',park:'lowBlock',wings:'wings'};
function norm(x,style){let o=mg(P[MAP[style]||'balanced'],typeof x==='string'?(P[x]||{}):(x||{})),p=o.inPossession.progression,d=o.outOfPossession;['tempo','passLength','verticality','width'].forEach(k=>p[k]=C(+p[k]||50,0,100));['defensiveLine','engagementLine','pressing'].forEach(k=>d[k]=C(+d[k]||50,0,100));return o;}
function conflicts(i){const z=[],a=(code,severity,message)=>z.push({code,severity,message}),b=i.inPossession.buildup,p=i.inPossession.progression,f=i.inPossession.finalThird,t=i.transition,o=i.outOfPossession;if(b.method==='short'&&t.afterRecovery==='counter'&&p.verticality>77)a('SHORT_COUNTER',2,'Saída curta e contra-ataque extremamente direto competem pela primeira decisão.');if(o.block==='low'&&o.offsideTrap&&o.defensiveLine<42)a('LOW_OFFSIDE',3,'Bloco baixo e linha de impedimento agressiva são contraditórios.');if(t.afterRecovery==='retain'&&f.earlyShots)a('RETAIN_SHOOT',2,'Manter a posse e finalizar cedo pedem ritmos opostos.');if(t.afterLoss==='regroup'&&o.pressing>81)a('REGROUP_PRESS',2,'Recomposição imediata limita a pressão extrema após a perda.');if(o.preventCross&&o.orientation==='outside')a('CROSS_OUTSIDE',2,'Forçar por fora aumenta os cruzamentos que a equipe quer impedir.');if(f.overlap&&f.underlap)a('DUAL_RUN',1,'Overlap e underlap simultâneos exigem cobertura adicional.');return z;}
function coherence(i){const c=conflicts(i),pen=c.reduce((s,x)=>s+(x.severity===3?18:x.severity===2?10:5),0);return{score:C(100-pen,0,100),conflicts:c};}
function apply(tm){const i=tm.instructions,b=i.inPossession.buildup,p=i.inPossession.progression,f=i.inPossession.finalThird,t=i.transition,o=i.outOfPossession,base=tm.baseFx||tm.fx||{},fx=Object.assign({},base);let direct=(p.passLength+p.verticality)/200+(b.method==='direct'?.14:b.method==='short'?-.12:0)+(t.afterRecovery==='counter'?.13:t.afterRecovery==='retain'?-.11:0);const press=C((o.pressing*.72+o.engagementLine*.28)/100+(t.afterLoss==='counterpress'?.12:t.afterLoss==='regroup'?-.08:0),0,1);fx.direct=C(direct,.08,.95);fx.width=C(p.width/100+(b.focus==='wide'?.08:b.focus==='inside'?-.07:0),.12,.94);fx.line=L(-.1,.055,C(o.defensiveLine/100+(o.block==='high'?.08:o.block==='low'?-.1:0),0,1));fx.tackle=L(.8,1.42,press);fx.pressReach=L(-.5,1.4,press);fx.drain=(base.drain||1)*L(.9,1.18,press);fx.ritmo=(base.ritmo||1)*L(.88,1.12,p.tempo/100);fx.drible=(base.drible||1)*(p.carryMore?1.1:p.passMore?.92:1);fx.shoot=(base.shoot||1)*(f.earlyShots?1.04:f.workBall?.96:1);fx.cross=(base.cross||1)*(f.crossType==='high'?1.05:f.crossType==='cutback'?1.02:1);fx.far=(base.far||1)*(f.longShots==='more'?1.06:1);tm.baseFx=Object.assign({},fx);tm.fx=Object.assign({},fx);tm.coherence=coherence(i);}
function stats(s){s.decisions=s.decisions||{};s.decisionQuality=s.decisionQuality||{count:0,score:0,agreement:0};s.decisionNonBest=s.decisionNonBest||0;s.corridorOccupancy=s.corridorOccupancy||[0,0,0,0,0];s.spatialSamples=s.spatialSamples||0;s.clumpCorrections=s.clumpCorrections||0;s.overlaps=s.overlaps||0;s.underlaps=s.underlaps||0;s.thirdManRuns=s.thirdManRuns||0;return s;}
function role(sl,p){const ip=sl.inPossession||sl.ip||{},op=sl.outOfPossession||sl.oop||{};return{inPossession:{position:ip.position||sl.ipPos||p.slotPos,role:ip.role||sl.ipRole||p.role,duty:ip.duty||sl.ipDuty||'support'},outOfPossession:{position:op.position||sl.oopPos||p.slotPos,role:op.role||sl.oopRole||p.oopRole,duty:op.duty||sl.oopDuty||'defend'}};}
function homes(p,tm){if(!p._p47h)p._p47h={a:[p.ahx,p.ahy],d:[p.dhx,p.dhy]};const R=String(p.ipRole||''),O=String(p.oopRole||''),wide=y=>L(y,y<FW/2?2.5:FW-2.5,.22),inside=y=>L(y,FW/2,.3);p.ahx=C(p._p47h.a[0]+tm.attackDir*((/wingback|ala|inside_forward|shadow/.test(R)?4:0)+(p.ipDuty==='attack'?2.5:0)),2,FL-2);p.ahy=/invert|inside|armador|playmaker/.test(R)?inside(p._p47h.a[1]):/winger|wingback|ala/.test(R)?wide(p._p47h.a[1]):p._p47h.a[1];p.dhx=C(p._p47h.d[0]-tm.attackDir*((/defensive|anchor|screen|conten/.test(O)?3:0)+(p.oopDuty==='defend'?1.5:0)),2,FL-2);p.dhy=p._p47h.d[1];p.hx=p.dhx;p.hy=p.dhy;}
const Q=M.prototype;Q.__P47__=true;
const ob=Q._buildTeam;Q._buildTeam=function(t,side){const tm=ob.call(this,t,side);tm.instructions=norm(t.instructions||t.teamInstructions,tm.styleKey);tm.instructionPreset=t.instructionPreset||MAP[tm.styleKey]||'balanced';tm.phase47={clock:0,lastDecision:null};apply(tm);tm.players.forEach(p=>{const r=role((t.lineup||[])[p.idx]||{},p);p.ipPos=r.inPossession.position;p.ipRole=r.inPossession.role;p.ipDuty=r.inPossession.duty;p.oopPos=r.outOfPossession.position;p.oopRole=r.outOfPossession.role;p.oopDuty=r.outOfPossession.duty;p.phaseRole=r;homes(p,tm);});return tm;};
const os=Q._blankStats;Q._blankStats=function(){return stats(os.call(this));};
Q.setTeamInstructions=function(team,x){const tm=this.teams[team];if(!tm)return false;tm.instructions=norm(typeof x==='string'?P[x]:mg(tm.instructions,x||{}),tm.styleKey);tm.instructionPreset=typeof x==='string'?x:'custom';apply(tm);return{instructions:cp(tm.instructions),coherence:cp(tm.coherence)};};
Q.getTacticalCoherence=function(team){const tm=this.teams[team];return tm&&cp(tm.coherence);};
Q.setPlayerPhaseRole=function(team,id,x){const tm=this.teams[team],p=typeof id==='number'?tm.players[id]:tm.players.find(q=>q.ref&&(q.ref.id===id||q.ref.n===id));if(!p)return false;const r=mg(p.phaseRole,x||{});p.phaseRole=r;p.ipPos=r.inPossession.position||p.slotPos;p.ipRole=r.inPossession.role||p.role;p.ipDuty=r.inPossession.duty||'support';p.oopPos=r.outOfPossession.position||p.slotPos;p.oopRole=r.outOfPossession.role||p.oopRole;p.oopDuty=r.outOfPossession.duty||'defend';homes(p,tm);return cp(r);};
function context(sim,p){const tm=sim.teams[p.team],opp=sim.teams[1-p.team];let nd=99;opp.players.forEach(d=>{if(!d.red)nd=Math.min(nd,D(p.x,p.y,d.x,d.y));});const pressure=C((6.2-nd)/6.2,0,1),fatigue=C((100-p.stamina)/68,0,1),prog=tm.attackDir>0?p.x/FL:(FL-p.x)/FL,phase=(sim.possT||0)<2.2?'transition':prog<.36?'buildup':prog<.7?'progression':'finalThird',ins=tm.instructions,pass=(A(p,'passe')*.6+A(p,'visao')*.2+A(p,'decisao')*.2)/100,drib=(A(p,'drible')*.6+A(p,'agilidade')*.2+A(p,'decisao')*.2)/100,shot=(A(p,'finalizacao')*.6+A(p,'compostura')*.2+A(p,'decisao')*.2)/100,c=[];const add=(action,ability,fit,space,risk)=>c.push({action,score:fit+ability+space-pressure-fatigue-risk});add('pass_short',pass,phase==='buildup'?.8:.45,.2,.18);add('pass_vertical',pass,ins.inPossession.progression.verticality/100,.3,.32);if(phase!=='buildup')add('pass_through',pass,.65,.42,.54);add('carry',drib,ins.inPossession.progression.carryMore?.72:0.52,C((nd-3)/9,0,1)*0.75,0.22);add('dribble',drib,.45,phase==='finalThird'?.45:.2,.5);if(prog>.6)add('cross',A(p,'cruzamento')/100,.55,Math.abs(p.y-FW/2)>13?.4:.1,.38);if(prog>.68)add('shoot',shot,ins.inPossession.finalThird.earlyShots?.72:.5,1-C(D(p.x,p.y,tm.oppGoal.x,tm.oppGoal.y)/38,0,1),.48);return{phase,pressure,fatigue,candidates:c};}
/* AUDITORIA · Fase 4 (bloqueador): a maior pontuação AUMENTA a probabilidade
   mas não vence sempre — softmax (T=0.30) amostrado com o chance() SEEDADO do
   motor: determinístico por seed e sem Math.random. decisionNonBest mede a
   fração de escolhas fora do topo (evidência auditável da distribuição). */
const od=Q._decide;Q._decide=function(p){const q=context(this,p),tm=this.teams[p.team],st=stats(this.stats[p.team]);const pool=q.candidates.slice().sort((a,b)=>b.score-a.score);let best=null;if(pool.length){const mx=pool[0].score,decisionIQ=A(p,'decisao')*.50+A(p,'compostura')*.22+A(p,'visao')*.18+A(p,'trabalho_equipe')*.10,decisionQ=C((decisionIQ-48)/47,0,1),decisionGap=pool[1]?pool[0].score-pool[1].score:999,baseT=decisionGap<.03?L(.075,.045,decisionQ):.060,T=typeof this.getFirstActionDecisionTemperature==='function'?this.getFirstActionDecisionTemperature(p,decisionGap,baseT):baseT,w=pool.map(c=>Math.exp((c.score-mx)/T));let rem=w.reduce((s,x)=>s+x,0);const CH=B.chance||root.chance;for(let i=0;i<pool.length&&!best;i++){if(i===pool.length-1||CH(Math.min(1,w[i]/Math.max(rem,1e-9))))best=pool[i];rem-=w[i];}p._r188DecisionMeta={decisionIQ,decisionQuality:decisionQ,decisionGap,temperature:T,top:pool[0]&&pool[0].action,chosen:best&&best.action,nonBest:best!==pool[0]};if(best!==pool[0])st.decisionNonBest=(st.decisionNonBest||0)+1;}p._p47Decision=best;tm.phase47.lastDecision=best;if(best){st.decisionQuality.count++;st.decisionQuality.score+=best.score;const save={direct:tm.fx.direct,drible:tm.fx.drible,shoot:tm.fx.shoot,cross:tm.fx.cross};if(/^pass_/.test(best.action))tm.fx.direct=C(tm.fx.direct+(best.action==='pass_short'?-.06:.07),.05,.98);if(best.action==='dribble'||best.action==='carry')tm.fx.drible*=1.06;if(best.action==='shoot')tm.fx.shoot*=1.04;if(best.action==='cross')tm.fx.cross*=1.04;try{return od.call(this,p);}finally{Object.assign(tm.fx,save);}}return od.call(this,p);};
function rec(sim,p,a){if(!p||p.team==null)return;const s=stats(sim.stats[p.team]);s.decisions[a]=(s.decisions[a]||0)+1;if(p._p47Decision&&(p._p47Decision.action===a||(a==='pass'&&/^pass_/.test(p._p47Decision.action))))s.decisionQuality.agreement++;}
[['_pass','pass'],['_carry','carry'],['_dribble','dribble'],['_cross','cross'],['_shoot','shoot'],['_clearBall','clear']].forEach(([k,a])=>{const f=Q[k];if(f)Q[k]=function(){rec(this,arguments[0],a);return f.apply(this,arguments);};});
const om=Q._movePlayers;if(om)Q._movePlayers=function(dt){const out=om.apply(this,arguments);/* OS-37 · entrega do saldo de correcao, 5 m/s no maximo, TODO quadro. */{const _bl=Math.max(.004,5*(Number.isFinite(dt)?dt:1/60));for(const _tm of this.teams)for(const _p of _tm.players){if(!_p||_p.red)continue;const _nx=_p._nudgeX||0,_ny=_p._nudgeY||0;if(!_nx&&!_ny)continue;const _L=Math.hypot(_nx,_ny);if(_L<1e-4){_p._nudgeX=0;_p._nudgeY=0;continue;}const _s=Math.min(_bl,_L);_p.x=C(_p.x+_nx/_L*_s,1,FL-1);_p.y=C(_p.y+_ny/_L*_s,1,FW-1);const _r=(_L-_s)/_L;_p._nudgeX=_nx*_r;_p._nudgeY=_ny*_r;}}this.teams.forEach(tm=>{tm.phase47.clock+=dt;if(tm.phase47.clock<.25)return;tm.phase47.clock=0;const ps=tm.players.filter(p=>!p.red&&!p.isGK),s=stats(this.stats[tm.side]);ps.forEach(p=>s.corridorOccupancy[C(Math.floor(p.y/FW*5),0,4)]++);s.spatialSamples++;for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j],d=D(a.x,a.y,b.x,b.y);if(d<2.05){const nx=d>.01?(a.x-b.x)/d:1,ny=d>.01?(a.y-b.y)/d:0,k=Math.min((2.05-d)*.16,.16);if(this.ball.owner!==a){a._nudgeX=C((a._nudgeX||0)+nx*k,-1.2,1.2);a._nudgeY=C((a._nudgeY||0)+ny*k,-1.2,1.2);}if(this.ball.owner!==b){b._nudgeX=C((b._nudgeX||0)-nx*k,-1.2,1.2);b._nudgeY=C((b._nudgeY||0)-ny*k,-1.2,1.2);}s.clumpCorrections++;}
else if(!a._markRef&&!b._markRef&&!a._r18173ScreenTgt&&!b._r18173ScreenTgt&&Math.abs(a.y-b.y)<5.5&&Math.abs(a.x-b.x)<22){const _sy=(a.y-b.y)>=0?1:-1,_kk=Math.min((5.5-Math.abs(a.y-b.y))*.10,.30);if(this.ball.owner!==a)a._nudgeY=C((a._nudgeY||0)+_sy*_kk,-1.2,1.2);if(this.ball.owner!==b)b._nudgeY=C((b._nudgeY||0)-_sy*_kk,-1.2,1.2);s.clumpCorrections++;}}const f=tm.instructions.inPossession.finalThird;if(this.ball.owner&&this.ball.owner.team===tm.side&&(f.overlap||f.underlap)){const fb=ps.find(p=>['LB','RB','LWB','RWB'].includes(p.slotPos));if(fb){fb._overlapping=!!f.overlap;fb._underlapping=!!f.underlap;f.overlap?s.overlaps++:s.underlaps++;}}});return out;};
const oa=Q.getAdvancedData;Q.getAdvancedData=function(team){const z=oa?oa.call(this,team):{},tm=this.teams[team],s=stats(this.stats[team]);z.engineVersion=V;z.phase47={instructions:cp(tm.instructions),preset:tm.instructionPreset,coherence:cp(tm.coherence),decisions:cp(s.decisions),decisionQuality:{count:s.decisionQuality.count,averageScore:s.decisionQuality.count?s.decisionQuality.score/s.decisionQuality.count:0,agreementRate:s.decisionQuality.count?s.decisionQuality.agreement/s.decisionQuality.count:0},spatial:{samples:s.spatialSamples,corridorOccupancy:s.corridorOccupancy.slice(),clumpCorrections:s.clumpCorrections,overlaps:s.overlaps,underlaps:s.underlaps,thirdManRuns:s.thirdManRuns},roles:tm.players.map(p=>({id:p.ref&&p.ref.id,name:p.ref&&p.ref.n,inPossession:{position:p.ipPos,role:p.ipRole,duty:p.ipDuty},outOfPossession:{position:p.oopPos,role:p.oopRole,duty:p.oopDuty}}))};return z;};
const og=Q.getState;Q.getState=function(){const s=og.call(this);s.engineVersion=V;s.tactical=this.teams.map(t=>({preset:t.instructionPreset,coherence:t.coherence.score,instructions:t.instructions}));return s;};
if(!NODE&&typeof document!=='undefined'){const Old=root.MatchSim;class Active extends Old{constructor(){super(...arguments);root.__CDS_ACTIVE_SIM=this;}}root.MatchSim=Active;const boot=()=>{if(document.getElementById('p47btn'))return;const css=document.createElement('style');css.textContent='#p47btn{position:fixed;right:12px;bottom:12px;z-index:999999;border:1px solid #ffcb45;border-radius:999px;background:#101a2e;color:#ffcb45;padding:9px 12px;font:700 11px system-ui}#p47box{position:fixed;inset:0;z-index:1000000;background:#020712dd;display:none;place-items:end center;padding:12px;color:#fff;font-family:system-ui}#p47box.on{display:grid}#p47box>div{width:min(720px,100%);max-height:86vh;overflow:auto;background:#0b1425;border:1px solid #294064;border-radius:18px;padding:15px}.p47ps{display:flex;gap:7px;flex-wrap:wrap}.p47ps button{background:#172641;color:#fff;border:1px solid #38527a;border-radius:8px;padding:8px}.p47warn{background:#34231c;border-left:3px solid #ff9d4a;padding:8px;margin:7px 0;font-size:11px}';document.head.appendChild(css);const b=document.createElement('button');b.id='p47btn';b.textContent='TÁTICA 5.0';const x=document.createElement('div');x.id='p47box';x.innerHTML='<div><button id="p47close" style="float:right">×</button><h3>Central Tática · Fases 4–7</h3><main></main></div>';document.body.append(b,x);const paint=()=>{const sim=root.__CDS_ACTIVE_SIM,m=x.querySelector('main');if(!sim)return m.innerHTML='<p>Inicie uma partida.</p>';const side=sim.interactiveTeam===1?1:0,tm=sim.teams[side],a=sim.getAdvancedData(side).phase47;m.innerHTML='<h4>Coerência '+tm.coherence.score+'/100</h4><div class="p47ps">'+Object.keys(P).map(k=>'<button data-p="'+k+'">'+k+'</button>').join('')+'</div>'+tm.coherence.conflicts.map(c=>'<div class="p47warn">'+c.message+'</div>').join('')+'<p>Decisões: '+a.decisionQuality.count+' · Antiamontoamento: '+a.spatial.clumpCorrections+'</p>';m.querySelectorAll('[data-p]').forEach(q=>q.onclick=()=>{sim.setTeamInstructions(side,q.dataset.p);paint();});};b.onclick=()=>{x.classList.add('on');paint();};x.querySelector('#p47close').onclick=()=>x.classList.remove('on');};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();}
const API={VERSION:V,DEFAULT_INSTRUCTIONS:DEF,PRESETS:P,normalizeInstructions:norm,detectConflicts:conflicts,coherenceReport:coherence,installed:true};root.CDS_PHASES_4_7=API;if(NODE)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);

/* Copa dos Sonhos — Fase 8 — goleiros e bolas paradas — motor 5.1.0 */
(function(root){
'use strict';
const NODE=typeof module!=='undefined'&&module.exports;
const M=root.MatchSim;
const VERSION='5.1.0';
const CORNER_ROUTINES=Object.freeze(['near_post','far_post','penalty_spot','short']);
const CORNER_DEFENCES=Object.freeze(['zonal','man','mixed']);
const FREE_KICK_ROUTINES=Object.freeze(['direct','crossed','short']);
function snapshot(sim,team){
  const side=team===1?1:0,st=sim&&sim.stats&&sim.stats[side];
  if(!st)return null;
  return {
    version:VERSION,team:side,
    goalkeeping:{
      shotsFaced:st.gkShotsFaced||0,secureCatches:st.gkSecureCatches||0,parries:st.gkParries||0,
      reboundsConceded:st.reboundsConceded||0,sweeps:st.gkSweeps||0,sweepsFailed:st.gkSweepsFailed||0,
      claimsAttempted:st.gkClaimsAttempted||0,claimsWon:st.gkClaimsWon||0,claimsMissed:st.gkClaimsMissed||0,
      punches:st.gkPunches||0,doubleCatches:st.gkDoubleCatches||0,
      distribution:{short:st.gkDistributionShort||0,long:st.gkDistributionLong||0,
        completed:st.gkDistributionCompleted||0,failed:st.gkDistributionFailed||0,
        toFullback:st.gkDistToFullback||0,toCenterBack:st.gkDistToCenterBack||0,
        toMidfield:st.gkDistToMidfield||0,toForward:st.gkDistToForward||0}
    },
    setPieces:{
      shots:st.setPieceShots||0,goals:st.setPieceGoals||0,firstContactWon:st.setPieceFirstContactWon||0,
      firstContactLost:st.setPieceFirstContactLost||0,
      corners:{nearPost:st.cornersNearPost||0,farPost:st.cornersFarPost||0,penaltySpot:st.cornersPenaltySpot||0,short:st.cornersShort||0,inswinger:st.cornersInswinger||0,outswinger:st.cornersOutswinger||0},
      cornerDefence:{zonal:st.cornerDefZonal||0,man:st.cornerDefMan||0,mixed:st.cornerDefMixed||0},
      freeKicks:{direct:st.freeKickDirect||0,crossed:st.freeKickCrossed||0,short:st.freeKickShort||0},
      penalties:{taken:st.penaltiesTaken||0,scored:st.penaltiesScored||0,saved:st.penaltiesSaved||0,missed:st.penaltiesMissed||0}
    }
  };
}
if(M&&M.prototype&&!M.prototype.__P8__){
  const Q=M.prototype;Q.__P8__=true;
  const oldState=Q.getState;
  Q.getState=function(){const out=oldState.call(this);out.engineVersion=VERSION;out.phase8=this.stats.map((_,i)=>snapshot(this,i));return out;};
  const oldAdvanced=Q.getAdvancedData;
  Q.getAdvancedData=function(team){const out=oldAdvanced?oldAdvanced.call(this,team):{};out.engineVersion=VERSION;out.phase8=snapshot(this,team);return out;};
  Q.getPhase8Data=function(team){return snapshot(this,team);};
}
const API={VERSION,CORNER_ROUTINES,CORNER_DEFENCES,FREE_KICK_ROUTINES,getMatchData:snapshot,installed:!!(M&&M.prototype&&M.prototype.__P8__)};
root.CDS_PHASE8=API;
if(NODE)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);

/* Copa dos Sonhos — Fase 9 — inteligência do treinador adversário — motor 5.2.0 */
(function(root){
'use strict';
const NODE=typeof module!=='undefined'&&module.exports;
const M=root.MatchSim;
if(!M||!M.prototype||M.prototype.__P9__)return;
const VERSION='5.2.2';
const C=root.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const LINE=root.LINE_OF||{};
const getAttr=(p,k,f=60)=>{try{const fn=root.getAttr,v=fn&&fn(p&&p.ref?p.ref:p,k);return Number.isFinite(v)?v:f;}catch(_){return f;}};
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const sum=(xs,fn)=>xs.reduce((a,x)=>a+fn(x),0);
const avg=(xs,fn,f=0)=>xs.length?sum(xs,fn)/xs.length:f;
const hash=s=>{let h=2166136261>>>0;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const PROFILE_TEMPLATES=Object.freeze({
  pragmatic:{key:'pragmatic',label:'Pragmático',aggression:46,riskTolerance:42,adaptability:72,pressingPreference:42,possessionPreference:50,defensivePreference:72,substitutionTiming:58,evidenceThreshold:.54,persistence:12,reviewMinutes:8},
  aggressive:{key:'aggressive',label:'Agressivo',aggression:82,riskTolerance:78,adaptability:66,pressingPreference:86,possessionPreference:44,defensivePreference:35,substitutionTiming:66,evidenceThreshold:.48,persistence:9,reviewMinutes:7},
  possession:{key:'possession',label:'Controlador',aggression:54,riskTolerance:48,adaptability:74,pressingPreference:68,possessionPreference:88,defensivePreference:48,substitutionTiming:55,evidenceThreshold:.52,persistence:11,reviewMinutes:8},
  adaptive:{key:'adaptive',label:'Adaptável',aggression:60,riskTolerance:58,adaptability:90,pressingPreference:64,possessionPreference:64,defensivePreference:60,substitutionTiming:62,evidenceThreshold:.44,persistence:8,reviewMinutes:6}
});
function deriveProfile(source,tm){
  const explicit=source&&source.managerProfile;
  if(explicit&&typeof explicit==='object')return Object.assign({},PROFILE_TEMPLATES.adaptive,clone(explicit));
  if(typeof explicit==='string'&&PROFILE_TEMPLATES[explicit])return clone(PROFILE_TEMPLATES[explicit]);
  const style=(source&&source.style)||tm.styleKey||'balanced';
  const styleMap={press:'aggressive',tiki:'possession',park:'pragmatic',counter:'pragmatic',direct:'aggressive'};
  const keys=['pragmatic','aggressive','possession','adaptive'];
  const key=styleMap[style]||keys[hash((tm.name||'')+'|'+style)%keys.length];
  const p=clone(PROFILE_TEMPLATES[key]);
  const n=hash((tm.name||'')+'|profile');
  const jitter=(shift)=>((n>>>shift)%11)-5;
  p.aggression=C(p.aggression+jitter(0),20,95);
  p.riskTolerance=C(p.riskTolerance+jitter(4),20,95);
  p.adaptability=C(p.adaptability+jitter(8),30,98);
  p.substitutionTiming=C(p.substitutionTiming+jitter(12),40,82);
  return p;
}
function blankManagerStats(st){
  st.managerAnalyses=st.managerAnalyses||0;st.managerDiagnoses=st.managerDiagnoses||0;
  st.managerChanges=st.managerChanges||0;st.managerSubstitutions=st.managerSubstitutions||0;
  st.managerEvaluations=st.managerEvaluations||0;st.managerSuccessfulChanges=st.managerSuccessfulChanges||0;
  st.managerFailedChanges=st.managerFailedChanges||0;st.managerInconclusiveChanges=st.managerInconclusiveChanges||0;st.managerReversals=st.managerReversals||0;
  st.managerPreMatchPlans=st.managerPreMatchPlans||0;st.managerNoActions=st.managerNoActions||0;
  st.managerRoleChanges=st.managerRoleChanges||0;st.managerDutyChanges=st.managerDutyChanges||0;
  st.managerPressOrientations=st.managerPressOrientations||0;st.managerCrossChanges=st.managerCrossChanges||0;
  st.managerTargetedPlayers=st.managerTargetedPlayers||0;st.managerStateExports=st.managerStateExports||0;st.managerStateImports=st.managerStateImports||0;
  return st;
}
function activePlayers(tm){return tm.players.filter(p=>!p.red);}
function playerName(p){return p&&p.ref&&(p.ref.n||p.ref.name)||'Jogador';}
function playerId(p){return p&&p.ref&&(p.ref.id!=null?p.ref.id:p.ref.n)||p&&p.idx;}
function nearestMateDistance(tm,p){let d=99;for(const q of tm.players){if(q===p||q.red)continue;const dx=(p.x||0)-(q.x||0),dy=(p.y||0)-(q.y||0);d=Math.min(d,Math.hypot(dx,dy));}return d;}
function roleMismatch(p){
  const base=LINE[p.slotPos]||'MID',ip=LINE[p.ipPos||p.slotPos]||base,oop=LINE[p.oopPos||p.slotPos]||base;
  if(base==='DEF'&&ip==='FWD')return 'Defensor projetado como atacante sem cobertura';
  if(base==='FWD'&&oop==='DEF'&&p.oopDuty==='attack')return 'Atacante com dever ofensivo na fase defensiva';
  if(base==='MID'&&ip==='DEF'&&p.ipDuty==='attack')return 'Meio-campista recuado com dever ofensivo incompatível';
  if(p.ipDuty==='attack'&&p.oopDuty==='attack')return 'Dever ofensivo simultâneo com e sem bola';
  return null;
}
function visibleTournamentContext(tm){
  const k=tm.managerAI&&tm.managerAI.knowledge||{};
  return {
    recentResults:Array.isArray(k.recentResults)?k.recentResults.slice(-5):null,
    fatigue:Number.isFinite(k.fatigue)?k.fatigue:null,
    cards:k.cards&&typeof k.cards==='object'?clone(k.cards):null,
    suspensions:Array.isArray(k.suspensions)?k.suspensions.slice():null,
    injuries:Array.isArray(k.injuries)?k.injuries.slice():null
  };
}
function metricSnapshot(sim,t){
  const tm=sim.teams[t],oppTm=sim.teams[1-t],own=sim.stats[t],opp=sim.stats[1-t],ps=activePlayers(tm).filter(p=>!p.isGK),oppPs=activePlayers(oppTm).filter(p=>!p.isGK);
  const ownPoss=own.possTime||0,oppPoss=opp.possTime||0,totalPoss=ownPoss+oppPoss;
  const yellowPlayers=ps.filter(p=>p.yellow>0),oppYellow=oppPs.filter(p=>p.yellow>0);
  const line=tm.instructions&&tm.instructions.outOfPossession?tm.instructions.outOfPossession.defensiveLine:(tm._axes?tm._axes.line:50);
  const press=tm.instructions&&tm.instructions.outOfPossession?tm.instructions.outOfPossession.pressing:(tm._axes?tm._axes.press:50);
  const zones=[0,0,0,0,0];for(const p of ps){const y=C(p.y||0,0,67.999),z=Math.min(4,Math.floor(y/13.6));zones[z]++;}
  const wide=ps.filter(p=>['LW','RW','LM','RM','LWB','RWB'].includes(p.slotPos)||['LW','RW','LM','RM'].includes(p.ipPos));
  let disconnected=null;for(const p of wide){const distance=nearestMateDistance(tm,p);const score=distance+(6.4-(p.rating||6))*3;if(distance>14&&(!disconnected||score>disconnected.score))disconnected={id:playerId(p),name:playerName(p),distance:+distance.toFixed(1),side:(p.y||0)<34?'left':'right',score};}
  let mismatch=null;for(const p of ps){const reason=roleMismatch(p);if(reason){mismatch={id:playerId(p),name:playerName(p),reason,slot:p.slotPos,ipRole:p.ipRole,ipDuty:p.ipDuty,oopRole:p.oopRole,oopDuty:p.oopDuty};break;}}
  let yellowTarget=null;for(const p of yellowPlayers){const side=(p.y||p.dhy||0)<34?'left':'right';const volume=side==='left'?(opp.attacksL||0):(opp.attacksR||0);if(volume>=5&&(!yellowTarget||volume>yellowTarget.volume))yellowTarget={id:playerId(p),name:playerName(p),side,volume};}
  let opponentYellowTarget=null;for(const p of oppYellow){const side=(p.y||p.dhy||0)<34?'left':'right';const volume=side==='left'?(own.attacksL||0):(own.attacksR||0);if(volume>=4&&(!opponentYellowTarget||volume>opponentYellowTarget.volume))opponentYellowTarget={id:playerId(p),name:playerName(p),side,volume};}
  const lowZoneIndex=zones.reduce((best,v,i,a)=>v<a[best]?i:best,0),lowZone=zones[lowZoneIndex]<=1?{index:lowZoneIndex,count:zones[lowZoneIndex],label:['left-wide','left-half','central','right-half','right-wide'][lowZoneIndex]}:null;
  return {
    minute:sim.minute,diff:sim.score[t]-sim.score[1-t],score:sim.score.slice(),
    xgFor:own.xg||0,xgAgainst:opp.xg||0,shotsFor:own.shots||0,shotsAgainst:opp.shots||0,
    onTargetFor:own.onTarget||0,onTargetAgainst:opp.onTarget||0,
    possTimeFor:ownPoss,possTimeAgainst:oppPoss,possession:totalPoss?ownPoss/totalPoss:.5,
    passes:own.passes||0,passOk:own.passOk||0,passAccuracy:own.passes?own.passOk/own.passes:1,
    oppPassAccuracy:opp.passes?opp.passOk/opp.passes:1,
    attacksForL:own.attacksL||0,attacksForR:own.attacksR||0,attacksAgainstL:opp.attacksL||0,attacksAgainstR:opp.attacksR||0,
    crossesAgainst:opp.crosses||0,crossesOkAgainst:opp.crossesOk||0,
    throughAgainst:opp.throughBalls||0,throughOkAgainst:opp.throughOk||0,oneOnOnesAgainst:opp.oneOnOnes||0,
    pressWins:own.pressWins||0,defErrors:own.defErrors||0,gkBadDistribution:own.gkBadDistribution||0,
    stamina:avg(ps,p=>p.stamina,100),yellowCount:yellowPlayers.length,redCount:tm.players.filter(p=>p.red).length,
    lowestStamina:ps.length?Math.min(...ps.map(p=>p.stamina)):100,line,press,
    setPieceThreat:(opp.setPieceShots||0),coherence:tm.coherence?tm.coherence.score:100,
    zones,lowZone,disconnectedWinger:disconnected,roleMismatch:mismatch,yellowTarget,opponentYellowTarget,
    dangerousCrossRate:opp.crosses?(opp.crossesOk||0)/opp.crosses:0
  };
}
function windowDelta(before,after){
  const possFor=after.possTimeFor-before.possTimeFor,possAgainst=after.possTimeAgainst-before.possTimeAgainst,pt=possFor+possAgainst;
  return {xgFor:after.xgFor-before.xgFor,xgAgainst:after.xgAgainst-before.xgAgainst,shotsFor:after.shotsFor-before.shotsFor,shotsAgainst:after.shotsAgainst-before.shotsAgainst,possession:pt?possFor/pt:.5,scoreDelta:after.diff-before.diff};
}
function diagnose(sim,t,m){
  const out=[],add=(code,severity,label,evidence,objective,meta)=>out.push(Object.assign({code,severity:C(severity,0,1),label,evidence,objective,affectedPlayers:[],affectedSectors:[]},meta||{}));
  const oppAttacks=m.attacksAgainstL+m.attacksAgainstR;
  const shotQuality=m.shotsFor?m.xgFor/m.shotsFor:0;
  if(m.redCount>0)add('RED_CARD',.96,'Inferioridade numérica',`${m.redCount} expulsão(ões) alteraram o equilíbrio`,m.diff<0?'attack':'defend',{affectedSectors:['central']});
  if(m.diff<0&&m.minute>=58)add('LOSING_LATE',C(.58+(m.minute-58)/42+Math.min(2,-m.diff)*.1,0,1),'Desvantagem no placar',`Perdendo por ${-m.diff} aos ${Math.floor(m.minute)} minutos`,'attack',{affectedSectors:['attack']});
  if(m.diff>0&&m.minute>=68)add('LEADING_LATE',C(.52+(m.minute-68)/30+m.diff*.08,0,1),'Vantagem a proteger',`Vencendo por ${m.diff} no terço final`,'defend',{affectedSectors:['defence','midfield']});
  if(oppAttacks>=6&&m.attacksAgainstL>m.attacksAgainstR*1.4)add('LEFT_OVERLOAD',C(.5+(m.attacksAgainstL-m.attacksAgainstR)/16,0,1),'Sobrecarga pelo lado esquerdo rival',`${m.attacksAgainstL} ataques contra ${m.attacksAgainstR}`,'defend',{affectedSectors:['left']});
  if(oppAttacks>=6&&m.attacksAgainstR>m.attacksAgainstL*1.4)add('RIGHT_OVERLOAD',C(.5+(m.attacksAgainstR-m.attacksAgainstL)/16,0,1),'Sobrecarga pelo lado direito rival',`${m.attacksAgainstR} ataques contra ${m.attacksAgainstL}`,'defend',{affectedSectors:['right']});
  if(m.line>=64&&(m.oneOnOnesAgainst+m.throughOkAgainst)>=3)add('HIGH_LINE_EXPOSED',C(.55+(m.oneOnOnesAgainst+m.throughOkAgainst)/14,0,1),'Linha alta vulnerável',`${m.oneOnOnesAgainst} um contra um e ${m.throughOkAgainst} bolas em profundidade`,'defend',{affectedSectors:['defensive-line']});
  if(m.minute>=22&&m.possession<.43&&m.xgAgainst>m.xgFor+.25)add('MIDFIELD_INFERIORITY',C(.5+(.43-m.possession)*2+(m.xgAgainst-m.xgFor)*.16,0,1),'Meio-campo em inferioridade',`${Math.round(m.possession*100)}% de posse e desvantagem territorial`,'control',{affectedSectors:['midfield']});
  if(m.minute>=28&&m.shotsFor<=3&&m.xgFor<.48)add('ISOLATED_ATTACK',C(.58+(3-m.shotsFor)*.08,0,1),'Ataque isolado',`${m.shotsFor} finalizações e ${m.xgFor.toFixed(2)} xG`,'attack',{affectedSectors:['attack']});
  if(m.disconnectedWinger&&m.minute>=18)add('WINGER_DISCONNECTED',C(.52+(m.disconnectedWinger.distance-14)/20,0,1),'Ponta desconectado',`${m.disconnectedWinger.name} está a ${m.disconnectedWinger.distance} m do apoio mais próximo`,'attack',{affectedPlayers:[m.disconnectedWinger],affectedSectors:[m.disconnectedWinger.side]});
  if(m.minute>=20&&m.passAccuracy<.72&&(m.gkBadDistribution>=1||m.defErrors>=1))add('BUILDUP_FAIL',C(.55+(.72-m.passAccuracy)*1.8,0,1),'Saída de bola falhando',`${Math.round(m.passAccuracy*100)}% de passe e ${m.gkBadDistribution} erros do goleiro`,'control',{affectedSectors:['build-up']});
  if(m.gkBadDistribution>=2&&m.minute>=18)add('GK_DISTRIBUTION_FAIL',C(.58+m.gkBadDistribution*.05,0,1),'Goleiro errando reposições',`${m.gkBadDistribution} perdas originadas na distribuição`,'control',{affectedSectors:['goalkeeper','build-up']});
  if(m.minute>=26&&m.press>=68&&m.pressWins<3)add('PRESS_INEFFECTIVE',C(.5+(m.press-68)/80,0,1),'Pressão ineficiente',`Pressão ${Math.round(m.press)} com apenas ${m.pressWins} recuperações`,'defend',{affectedSectors:['pressing']});
  if(m.shotsFor>=8&&shotQuality<.085)add('POOR_SHOT_QUALITY',C(.55+(.085-shotQuality)*4,0,1),'Finalizações de baixa qualidade',`${m.shotsFor} chutes para ${m.xgFor.toFixed(2)} xG`,'attack',{affectedSectors:['final-third']});
  /* §R19.06 · a media do time so cruza 61 por volta dos 72 minutos, mas aos 60
     ja existe alguem com 34% de folego. `m.lowestStamina` era calculado em
     :8498 e nao era lido por diagnostico nenhum -- unica ocorrencia do
     identificador no arquivo. Agora o exausto INDIVIDUAL tambem acusa. */
  if(m.stamina<61)add('FATIGUE',C(.55+(61-m.stamina)/18,0,1),'Fadiga coletiva',`Média física em ${m.stamina.toFixed(1)}%`,'control',{affectedSectors:['all']});
  else if(m.lowestStamina<46)add('FATIGUE',C(.56+(46-m.lowestStamina)/26,0,1),'Jogador exausto',`Jogador mais desgastado em ${m.lowestStamina.toFixed(1)}% com o time em ${m.stamina.toFixed(1)}%`,'control',{affectedSectors:['all']});
  if(m.yellowTarget)add('YELLOW_TARGETED',C(.54+m.yellowTarget.volume/25,0,1),'Jogador amarelado sob ataque',`${m.yellowTarget.name} está amarelado e recebeu ${m.yellowTarget.volume} ataques pelo setor`,'defend',{affectedPlayers:[m.yellowTarget],affectedSectors:[m.yellowTarget.side]});
  else if(m.yellowCount>=2&&m.minute>=45)add('YELLOW_RISK',C(.48+m.yellowCount*.08,0,1),'Risco disciplinar',`${m.yellowCount} jogadores amarelados`,'defend');
  if(m.opponentYellowTarget)add('EXPLOIT_YELLOW',C(.52+m.opponentYellowTarget.volume/24,0,1),'Adversário amarelado vulnerável',`${m.opponentYellowTarget.name} está amarelado no corredor ${m.opponentYellowTarget.side}`,'attack',{affectedPlayers:[m.opponentYellowTarget],affectedSectors:[m.opponentYellowTarget.side]});
  if(m.crossesAgainst>=7&&m.dangerousCrossRate>.34)add('DANGEROUS_CROSSES',C(.5+m.crossesOkAgainst/12,0,1),'Cruzamentos adversários perigosos',`${m.crossesOkAgainst}/${m.crossesAgainst} cruzamentos encontraram alvo`,'defend',{affectedSectors:['wide','box']});
  if(m.lowZone&&m.minute>=20)add('LOW_ZONE_OCCUPANCY',C(.48+(1-m.lowZone.count)*.12,0,1),'Baixa ocupação de zona',`Zona ${m.lowZone.label} possui ${m.lowZone.count} jogador(es)`,'control',{affectedSectors:[m.lowZone.label]});
  if(m.roleMismatch)add('ROLE_MISMATCH',.62,'Função incompatível',`${m.roleMismatch.name}: ${m.roleMismatch.reason}`,'control',{affectedPlayers:[m.roleMismatch],affectedSectors:['role-structure']});
  if(m.coherence<80)add('TACTICAL_CONFLICT',C(.5+(80-m.coherence)/40,0,1),'Instruções conflitantes',`Coerência tática ${m.coherence}/100`,'control',{affectedSectors:['team-structure']});
  return out.sort((a,b)=>b.severity-a.severity);
}
function snapshotTeamState(tm){return{preset:tm.instructionPreset,instructions:clone(tm.instructions),axes:clone(tm._axes),defForm:tm.defForm,defVar:tm.defVar||0,atkForm:tm.atkForm,atkVar:tm.atkVar||0,sideShift:clone(tm.managerAI&&tm.managerAI.sideShift||null),attackFocus:clone(tm.managerAI&&tm.managerAI.attackFocus||null),pressOrientation:clone(tm.managerAI&&tm.managerAI.pressOrientation||null),roles:tm.players.map(p=>({id:playerId(p),inPossession:{position:p.ipPos,role:p.ipRole,duty:p.ipDuty},outOfPossession:{position:p.oopPos,role:p.oopRole,duty:p.oopDuty}}))};}
function availableForm(key){return !!(root.FORMATIONS&&root.FORMATIONS[key]);}
function actionFor(d,sim,t,profile){
  const m=metricSnapshot(sim,t),bold=profile.riskTolerance>=65,target=d.affectedPlayers&&d.affectedPlayers[0];
  switch(d.code){
    case 'RED_CARD':return{id:'red_compact',label:'Reorganizar após expulsão',objective:m.diff<0?'attack':'defend',preset:m.diff<0?'counter':'lowBlock',shape:{def:'5-3-2',atk:m.diff<0?'3-4-3':'5-3-2'},axes:{press:-12,width:-8,line:m.diff<0?-4:-12,posture:m.diff<0?4:-12},intensity:'high',sectors:['central'],expected:'Reduzir espaços centrais sem abandonar a transição'};
    case 'LOSING_LATE':return{id:bold?'all_out_attack':'structured_chase',label:bold?'Ataque total':'Busca estruturada do empate',objective:'attack',preset:bold?'highPress':'counter',shape:{def:bold?'3-4-3':'4-2-3-1',atk:bold?'4-2-4':'4-2-3-1'},axes:{press:bold?14:8,line:bold?12:7,tempo:bold?12:7,posture:bold?16:9},sub:'attack',intensity:bold?'very-high':'high',sectors:['attack'],expected:'Aumentar xG, presença de área e recuperações altas'};
    case 'LEADING_LATE':return{id:'protect_lead',label:'Proteger a vantagem',objective:'defend',preset:profile.defensivePreference>=65?'lowBlock':'possession',shape:{def:profile.defensivePreference>=65?'5-4-1':'4-5-1',atk:'4-3-3'},axes:{press:-9,line:-12,tempo:-8,posture:-10},sub:'defend',intensity:'high',sectors:['defence','midfield'],expected:'Reduzir xG e finalizações adversárias'};
    case 'LEFT_OVERLOAD':return{id:'reinforce_left',label:'Reforçar corredor esquerdo defensivo',objective:'defend',side:'L',pressOrientation:'left',instructions:{outOfPossession:{preventCross:true,protectBox:true,orientation:'left'}},intensity:'medium',sectors:['left'],expected:'Reduzir progressões e cruzamentos pelo corredor atacado'};
    case 'RIGHT_OVERLOAD':return{id:'reinforce_right',label:'Reforçar corredor direito defensivo',objective:'defend',side:'R',pressOrientation:'right',instructions:{outOfPossession:{preventCross:true,protectBox:true,orientation:'right'}},intensity:'medium',sectors:['right'],expected:'Reduzir progressões e cruzamentos pelo corredor atacado'};
    case 'HIGH_LINE_EXPOSED':return{id:'drop_line',label:'Baixar linha e proteger profundidade',objective:'defend',preset:'balanced',axes:{line:-16,press:-6},shape:{def:'4-1-4-1',atk:sim.teams[t].atkForm||'4-3-3'},intensity:'high',sectors:['defensive-line'],expected:'Reduzir um contra um e bolas nas costas'};
    case 'MIDFIELD_INFERIORITY':return{id:'add_midfield',label:'Adicionar volante e presença no meio',objective:'control',preset:'possession',shape:{def:'4-1-4-1',atk:'4-2-3-1'},axes:{width:-7,tempo:-4,press:4},intensity:'high',sectors:['midfield'],expected:'Recuperar posse e conexões centrais'};
    case 'ISOLATED_ATTACK':return{id:'add_attacker',label:'Adicionar atacante e aproximar o setor',objective:'attack',preset:'wings',shape:{def:'4-2-3-1',atk:'4-2-4'},axes:{posture:8,width:7,tempo:5},sub:'attack',intensity:'high',sectors:['attack'],expected:'Aumentar finalizações e entradas no último terço'};
    case 'WINGER_DISCONNECTED':return{id:'reconnect_winger_'+(target&&target.id),label:'Reconectar ponta ao bloco',objective:'attack',playerRole:target&&{id:target.id,inPossession:{role:'inside_forward',duty:'support'},outOfPossession:{role:'track_wide',duty:'support'}},axes:{width:-5},attackFocus:target&&target.side,intensity:'medium',players:target?[target]:[],sectors:target?[target.side]:['wide'],expected:'Criar apoios curtos e aproximar o ponta da zona de criação'};
    case 'BUILDUP_FAIL':return{id:'bypass_press',label:'Contornar a pressão rival',objective:'control',preset:'counter',instructions:{inPossession:{buildup:{method:'direct'},progression:{passLength:68,verticality:66}},transition:{goalkeeperDistribution:'long'}},intensity:'medium',sectors:['build-up'],expected:'Reduzir perdas na saída e avançar com segurança'};
    case 'GK_DISTRIBUTION_FAIL':return{id:'change_gk_distribution',label:'Alterar distribuição do goleiro',objective:'control',instructions:{transition:{goalkeeperDistribution:'long'},inPossession:{buildup:{useGoalkeeper:false,method:'direct'}}},intensity:'medium',sectors:['goalkeeper','build-up'],expected:'Retirar o goleiro da zona de pressão e reduzir perdas perigosas'};
    case 'PRESS_INEFFECTIVE':return{id:'reset_press',label:'Reorganizar e orientar a pressão',objective:'defend',preset:'balanced',axes:{press:-14,line:-6},pressOrientation:m.attacksAgainstL>m.attacksAgainstR?'left':m.attacksAgainstR>m.attacksAgainstL?'right':'centre',instructions:{transition:{afterLoss:'regroup'},outOfPossession:{orientation:m.attacksAgainstL>m.attacksAgainstR?'left':m.attacksAgainstR>m.attacksAgainstL?'right':'balanced'}},intensity:'medium',sectors:['pressing'],expected:'Reduzir desgaste e recuperar compactação'};
    case 'POOR_SHOT_QUALITY':return{id:'work_ball',label:'Trabalhar melhor as chances',objective:'attack',preset:'possession',crossType:'cutback',instructions:{inPossession:{finalThird:{workBall:true,earlyShots:false,longShots:'balanced',crossType:'cutback'}}},intensity:'medium',sectors:['final-third'],expected:'Aumentar xG por finalização'};
    case 'FATIGUE':{
      /* §R19.07 · id POR JOGADOR. Com id fixo, `:8652` bloqueava a segunda
         troca por fadiga durante `persistence + 7` minutos -- tirar um exausto
         impedia tirar outro. Mesma convencao que `protect_targeted_yellow_` e
         `exploit_yellow_` ja usam para acao dirigida a um jogador. */
      const _f9tm=sim&&sim.teams&&sim.teams[t];
      let _f9w=null;
      for(const _p of (_f9tm&&_f9tm.players)||[]){
        if(!_p||_p.red||_p.isGK)continue;
        if(!_f9w||(_p.stamina||100)<(_f9w.stamina||100))_f9w=_p;
      }
      const _f9id=_f9w?(playerId(_f9w)!=null?playerId(_f9w):_f9w.idx):'x';
      const _f9n=_f9w?playerName(_f9w):null;
      return{id:'manage_fatigue_'+_f9id,label:_f9n?('Render '+_f9n+', desgastado'):'Gerir fadiga e renovar energia',objective:'control',preset:'balanced',axes:{press:-12,tempo:-8},sub:'physical',intensity:'medium',players:_f9w?[{id:_f9id,name:_f9n}]:[],sectors:['all'],expected:'Estabilizar intensidade e substituir jogador exausto'};
    }
    case 'YELLOW_TARGETED':return{id:'protect_targeted_yellow_'+(target&&target.id),label:'Proteger jogador amarelado atacado',objective:'defend',playerRole:target&&{id:target.id,outOfPossession:{duty:'defend'}},pressOrientation:target&&target.side,sub:'disciplinary',intensity:'high',players:target?[target]:[],sectors:target?[target.side]:[],expected:'Reduzir duelos isolados e risco de expulsão'};
    case 'YELLOW_RISK':return{id:'disciplinary_sub',label:'Proteger jogador amarelado',objective:'defend',sub:'disciplinary',intensity:'medium',expected:'Reduzir risco de expulsão'};
    case 'EXPLOIT_YELLOW':return{id:'exploit_yellow_'+(target&&target.id),label:'Explorar adversário amarelado',objective:'attack',attackFocus:target&&target.side,pressOrientation:target&&target.side,instructions:{inPossession:{buildup:{focus:'wide'},progression:{width:76,carryMore:true}},outOfPossession:{orientation:target&&target.side||'balanced'}},intensity:'high',players:target?[target]:[],sectors:target?[target.side]:[],expected:'Forçar duelos e decisões defensivas no setor do adversário amarelado'};
    case 'DANGEROUS_CROSSES':return{id:'stop_dangerous_crosses',label:'Bloquear cruzamentos perigosos',objective:'defend',crossType:'low',pressOrientation:m.attacksAgainstL>=m.attacksAgainstR?'left':'right',instructions:{outOfPossession:{preventCross:true,protectBox:true,marking:'mixed',orientation:m.attacksAgainstL>=m.attacksAgainstR?'left':'right'}},axes:{width:8,line:-5},intensity:'high',sectors:['wide','box'],expected:'Reduzir cruzamentos limpos e duelos aéreos adversários'};
    case 'LOW_ZONE_OCCUPANCY':return{id:'occupy_zone_'+(d.affectedSectors&&d.affectedSectors[0]),label:'Reocupar zona vazia',objective:'control',attackFocus:d.affectedSectors&&d.affectedSectors[0],axes:{width:4},intensity:'medium',sectors:d.affectedSectors||[],expected:'Restaurar cobertura e linha de passe na zona pouco ocupada'};
    case 'ROLE_MISMATCH':return{id:'fix_role_'+(target&&target.id),label:'Corrigir função incompatível',objective:'control',playerRole:target&&{id:target.id,inPossession:{position:target.slot,role:target.ipRole||'support',duty:'support'},outOfPossession:{position:target.slot,role:target.oopRole||'cover',duty:'defend'}},intensity:'medium',players:target?[target]:[],sectors:['role-structure'],expected:'Alinhar função e dever à posição real do jogador'};
    case 'TACTICAL_CONFLICT':return{id:'restore_coherence',label:'Restaurar coerência tática',objective:'control',preset:'balanced',intensity:'medium',sectors:['team-structure'],expected:'Eliminar instruções contraditórias'};
  }
  return null;
}
function applyAxes(sim,t,mods){if(!mods||typeof sim.setAxes!=='function')return false;const tm=sim.teams[t],a=Object.assign({line:50,press:50,width:50,tempo:50,posture:50},tm._axes||{});for(const k of ['line','press','width','tempo','posture'])if(Number.isFinite(mods[k]))a[k]=C((a[k]==null?50:a[k])+mods[k],0,100);return sim.setAxes(t,a);}
function restoreShift(tm,state,key,classes){const cur=state[key];if(cur&&cur.delta){for(const p of tm.players){if(p.isGK||!classes(p))continue;p.dhy-=cur.delta;p.hy-=cur.delta;p.ahy-=cur.delta;}}state[key]=null;}
function shiftSide(tm,state,side){
  restoreShift(tm,state,'sideShift',p=>LINE[p.slotPos]==='DEF'||p.slotPos==='CDM');
  if(!side)return;
  const delta=side==='L'||side==='left'?-2.6:2.6;
  for(const p of tm.players){if(p.isGK)continue;if(LINE[p.slotPos]==='DEF'||p.slotPos==='CDM'){p.dhy=C(p.dhy+delta,2,66);p.hy=C(p.hy+delta,2,66);p.ahy=C(p.ahy+delta,2,66);}}
  state.sideShift={side,delta};
}
function shiftAttackFocus(tm,state,side){
  restoreShift(tm,state,'attackFocus',p=>LINE[p.slotPos]==='FWD'||LINE[p.slotPos]==='MID');
  if(!side||side==='central'||side==='centre')return;
  const left=String(side).includes('left'),right=String(side).includes('right');if(!left&&!right)return;
  const delta=left?-2.2:2.2;
  for(const p of tm.players){if(p.isGK)continue;const ln=LINE[p.slotPos];if(ln==='FWD'||ln==='MID'){p.ahy=C(p.ahy+delta,2,66);p.hy=C(p.hy+delta*.45,2,66);p.dhy=C(p.dhy+delta*.25,2,66);}}
  state.attackFocus={side,delta};
}
function orientPress(tm,state,side){
  restoreShift(tm,state,'pressOrientation',p=>LINE[p.slotPos]==='FWD'||LINE[p.slotPos]==='MID');
  if(!side||side==='balanced'||side==='centre'||side==='central')return;
  const delta=String(side).includes('left')?-1.8:1.8;
  for(const p of tm.players){if(p.isGK)continue;const ln=LINE[p.slotPos];if(ln==='FWD'||ln==='MID'){p.dhy=C(p.dhy+delta,2,66);p.hy=C(p.hy+delta,2,66);}}
  state.pressOrientation={side,delta};
}
function applyPlayerRole(sim,t,change){if(!change||change.id==null||typeof sim.setPlayerPhaseRole!=='function')return null;const tm=sim.teams[t],p=tm.players.find(x=>playerId(x)===change.id||String(playerId(x))===String(change.id));if(!p)return null;const before={id:playerId(p),name:playerName(p),inPossession:{position:p.ipPos||p.slotPos,role:p.ipRole||p.role||'support',duty:p.ipDuty||'support'},outOfPossession:{position:p.oopPos||p.slotPos,role:p.oopRole||'cover',duty:p.oopDuty||'defend'}};if(!p.phaseRole)p.phaseRole=clone({inPossession:before.inPossession,outOfPossession:before.outOfPossession});const payload={};if(change.inPossession)payload.inPossession=Object.assign({},before.inPossession,change.inPossession);if(change.outOfPossession)payload.outOfPossession=Object.assign({},before.outOfPossession,change.outOfPossession);for(const phase of ['inPossession','outOfPossession'])if(payload[phase])for(const k of Object.keys(payload[phase]))if(payload[phase][k]==null)delete payload[phase][k];const after=sim.setPlayerPhaseRole(t,p.idx,payload);return after?{before,after:clone(after)}:null;}
function bestBench(tm,wantedLine){let bi=-1,best=-1;for(let i=0;i<(tm.bench||[]).length;i++){const b=tm.bench[i],ln=LINE[b.slot||b.pos]||'MID';if((b.slot||b.pos)==='GK')continue;const fit=ln===wantedLine?12:wantedLine==='FWD'&&ln==='MID'?4:wantedLine==='DEF'&&ln==='MID'?2:0;const score=(b.r||60)+fit;if(score>best){best=score;bi=i;}}return bi;}
function chooseOut(tm,mode){let idx=-1,score=1e9;for(let i=0;i<tm.players.length;i++){const p=tm.players[i];if(p.red||p.isGK)continue;const ln=LINE[p.slotPos]||'MID';let s=(p.rating||6)*10+p.stamina*.25+(p.ref.r||60)*.15;if(mode==='attack'&&ln==='DEF')s-=16;if(mode==='defend'&&ln==='FWD')s-=14;if(mode==='physical')s=p.stamina+(p.rating||6)*2;if(mode==='disciplinary')s=p.yellow?0+(p.rating||6):100+(p.rating||6);if(s<score){score=s;idx=i;}}return idx;}
function makeSubstitution(sim,t,mode){const tm=sim.teams[t],state=tm.managerAI;/* §R19.06 · o teto de 3 era cravado e contradizia o proprio `tm.subsLeft` (5) do motor; e 11 minutos de espacamento, com a fadiga so abrindo aos ~72, permitiam no maximo duas trocas na partida inteira. */if(tm.subsLeft<=0||state.subsMade>=5||!tm.bench||!tm.bench.length)return null;if(sim.minute-state.lastSubMinute<7)return null;const critical=tm.players.some(p=>!p.red&&!p.isGK&&p.stamina<44);if(mode!=='disciplinary'&&!critical&&sim.minute<state.profile.substitutionTiming-6)return null;const outIdx=chooseOut(tm,mode),out=tm.players[outIdx];if(!out)return null;let wanted=LINE[out.slotPos]||'MID';if(mode==='attack')wanted='FWD';else if(mode==='defend')wanted='DEF';const bi=bestBench(tm,wanted);if(bi<0)return null;const incoming=tm.bench[bi],outName=out.ref&&out.ref.n,inName=incoming.n;if(!sim.substitute(t,outIdx,incoming))return null;blankManagerStats(sim.stats[t]).managerSubstitutions++;state.subsMade++;state.lastSubMinute=sim.minute;return{out:outName,in:inName,mode};}
function evaluateChange(sim,t,force){const tm=sim.teams[t],state=tm.managerAI,pending=state.pendingEvaluation;if(!pending)return null;const elapsed=sim.minute-pending.minute;if(!force&&elapsed<state.profile.reviewMinutes)return null;const after=metricSnapshot(sim,t),d=windowDelta(pending.before,after);let score=0;if(pending.objective==='attack')score=d.xgFor*1.35+d.shotsFor*.07-d.xgAgainst*.55;else if(pending.objective==='defend')score=-d.xgAgainst*1.45-d.shotsAgainst*.06+d.xgFor*.25;else score=(d.possession-.5)*1.5+d.xgFor*.55-d.xgAgainst*.7;score=C(score,-1,1);const outcome=score>.06?'positive':score<-.08?'negative':'inconclusive',success=outcome==='positive'?true:outcome==='negative'?false:null;const st=blankManagerStats(sim.stats[t]);st.managerEvaluations++;if(outcome==='positive')st.managerSuccessfulChanges++;else if(outcome==='negative')st.managerFailedChanges++;else st.managerInconclusiveChanges++;
  let decision=outcome==='positive'?'maintain':outcome==='negative'?'adjust':'maintain';
  pending.entry.evaluation={minute:Math.floor(sim.minute),score:+score.toFixed(3),outcome,success,window:d,decision};
  sim._emit('manager_evaluation',{team:t,action:pending.action,label:pending.entry.action.label,outcome,success,score,decision});
  if(!success&&score<-.22&&state.profile.adaptability>=75&&!pending.emergency&&!pending.entry.substitution){
    const prev=pending.previous;let restored=false;
    if(prev.instructions&&typeof sim.setTeamInstructions==='function'){try{sim.setTeamInstructions(t,prev.instructions);restored=true;}catch(_){}}
    if(prev.axes&&typeof sim.setAxes==='function'){try{sim.setAxes(t,prev.axes);restored=true;}catch(_){}}
    if(prev.defForm&&prev.atkForm&&typeof sim.setShapes==='function'){try{sim.setShapes(t,prev.defForm,prev.defVar||0,prev.atkForm,prev.atkVar||0);restored=true;}catch(_){}}
    try{shiftSide(tm,state,prev.sideShift&&prev.sideShift.side||null);shiftAttackFocus(tm,state,prev.attackFocus&&prev.attackFocus.side||null);orientPress(tm,state,prev.pressOrientation&&prev.pressOrientation.side||null);restored=true;}catch(_){}
    if(Array.isArray(prev.roles)&&typeof sim.setPlayerPhaseRole==='function')for(const r of prev.roles){try{const rp=tm.players.find(x=>playerId(x)===r.id||String(playerId(x))===String(r.id));if(rp){sim.setPlayerPhaseRole(t,rp.idx,{inPossession:r.inPossession,outOfPossession:r.outOfPossession});restored=true;}}catch(_){}}
    if(restored){st.managerReversals++;pending.entry.reverted=true;pending.entry.evaluation.decision='revert';decision='revert';sim._emit('manager_reversal',{team:t,action:pending.action,reason:'A mudança não melhorou os indicadores'});}
  }
  pending.entry.afterEvaluationConfig=snapshotTeamState(tm);state.pendingEvaluation=null;return pending.entry.evaluation;
}
function knownFoot(p){const r=p&&p.ref||{};return r.foot||r.preferredFoot||r.peDominante||r.dominantFoot||'unknown';}
function preMatchPlan(sim,t){const tm=sim.teams[t],state=tm.managerAI;if(state.preMatch)return state.preMatch;const opp=sim.teams[1-t],profile=state.profile,forwards=opp.players.filter(p=>LINE[p.slotPos]==='FWD'),pace=avg(forwards,p=>(getAttr(p,'ritmo')+getAttr(p,'aceleracao'))/2,60),air=avg(forwards,p=>(getAttr(p,'cabecalho')+getAttr(p,'impulsao'))/2,60),gk=opp.players.find(p=>p.isGK),gkBuild=gk?avg([gk],p=>(getAttr(p,'passe')+getAttr(p,'decisao')+getAttr(p,'visao'))/3,60):null;
  const keys=opp.players.filter(p=>!p.red).slice().sort((a,b)=>(b.ref&&b.ref.r||0)-(a.ref&&a.ref.r||0)).slice(0,3).map(p=>({id:playerId(p),name:playerName(p),position:p.slotPos,overall:p.ref&&p.ref.r||null,dominantFoot:knownFoot(p),likelyRole:{inPossession:p.ipRole||p.role||null,outOfPossession:p.oopRole||null}}));
  const context=visibleTournamentContext(opp),fatigueVisible=Number.isFinite(context.fatigue)?context.fatigue:+avg(opp.players.filter(p=>!p.red),p=>100-p.stamina,0).toFixed(1),cards=context.cards||{yellow:opp.players.filter(p=>p.yellow).map(p=>playerName(p)),red:opp.players.filter(p=>p.red).map(p=>playerName(p))},suspensions=context.suspensions,injuries=context.injuries||opp.players.filter(p=>p._injured).map(p=>playerName(p));
  let preset='balanced',reason='Plano equilibrado para iniciar a leitura da partida';if(profile.key==='aggressive')preset='highPress',reason='Perfil agressivo: pressionar a primeira construção';else if(profile.key==='possession')preset='possession',reason='Perfil controlador: dominar bola e território';else if(gkBuild!=null&&gkBuild<55&&profile.pressingPreference>=60)preset='highPress',reason='Goleiro adversário limitado com a bola: orientar pressão sobre a saída';else if(pace>=78)preset='counter',reason='Ataque adversário veloz: controlar profundidade e transitar';else if(profile.defensivePreference>=68)preset='lowBlock',reason='Perfil pragmático: proteger zonas centrais';
  if(typeof sim.setTeamInstructions==='function')sim.setTeamInstructions(t,preset);
  if(air>=76&&typeof sim.setTeamInstructions==='function')sim.setTeamInstructions(t,{outOfPossession:{preventCross:true,protectBox:true}});
  if(pace>=78)applyAxes(sim,t,{line:-9,press:-3});if(gkBuild!=null&&gkBuild<55)orientPress(tm,state,'centre');
  state.preMatch={minute:0,preset,reason,opponent:{name:opp.name,form:{inPossession:opp.atkForm||null,outOfPossession:opp.defForm||null},style:opp.styleKey||null,keyPlayers:keys,pace:+pace.toFixed(1),aerial:+air.toFixed(1),goalkeeperBuild:gkBuild==null?null:+gkBuild.toFixed(1),recentResults:context.recentResults,fatigue:fatigueVisible,cards,suspensions:suspensions||'unknown',injuries:injuries||'unknown'}};
  const evidence=[`Velocidade ofensiva rival ${pace.toFixed(1)}`,`Ameaça aérea ${air.toFixed(1)}`,`Jogadores-chave: ${keys.map(k=>k.name).join(', ')||'não identificados'}`,`Goleiro com a bola: ${gkBuild==null?'desconhecido':gkBuild.toFixed(1)}`,`Contexto recente: ${context.recentResults?context.recentResults.join(', '):'desconhecido'}`];
  const entry={minute:0,type:'pre_match',diagnosis:'Plano pré-jogo',evidence,affectedPlayers:keys,affectedSectors:['team-plan'],intensity:'baseline',action:{id:'pre_match_'+preset,label:'Plano '+preset},expected:reason,decision:'maintain'};state.history.push(entry);blankManagerStats(sim.stats[t]).managerPreMatchPlans++;sim._emit('manager_plan',{team:t,profile:profile.label,preset,reason,evidence});return state.preMatch;
}
function applyAction(sim,t,diag,action){const tm=sim.teams[t],state=tm.managerAI,previous=snapshotTeamState(tm);let changed=false,substitution=null,roleChange=null;
  if(action.preset&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,action.preset);changed=true;}
  if(action.instructions&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,action.instructions);changed=true;}
  if(action.crossType&&typeof sim.setTeamInstructions==='function'){sim.setTeamInstructions(t,{inPossession:{finalThird:{crossType:action.crossType}}});blankManagerStats(sim.stats[t]).managerCrossChanges++;changed=true;}
  if(action.axes){applyAxes(sim,t,action.axes);changed=true;}
  if(action.shape&&typeof sim.setShapes==='function'){const df=availableForm(action.shape.def)?action.shape.def:tm.defForm,af=availableForm(action.shape.atk)?action.shape.atk:tm.atkForm;try{sim.setShapes(t,df||'4-3-3',0,af||'4-3-3',0);changed=true;}catch(_){}}
  if(action.side){shiftSide(tm,state,action.side);changed=true;}
  if(action.attackFocus){shiftAttackFocus(tm,state,action.attackFocus);changed=true;}
  if(action.pressOrientation){orientPress(tm,state,action.pressOrientation);blankManagerStats(sim.stats[t]).managerPressOrientations++;changed=true;}
  if(action.playerRole){roleChange=applyPlayerRole(sim,t,action.playerRole);if(roleChange){const st=blankManagerStats(sim.stats[t]);st.managerRoleChanges++;if(JSON.stringify(roleChange.before.inPossession)!==JSON.stringify(roleChange.after.inPossession)||JSON.stringify(roleChange.before.outOfPossession)!==JSON.stringify(roleChange.after.outOfPossession))st.managerDutyChanges++;changed=true;}}
  if(action.sub&&sim.minute-state.lastSubMinute>=6){substitution=makeSubstitution(sim,t,action.sub);if(substitution)changed=true;}
  if(!changed)return null;
  const now=metricSnapshot(sim,t),entry={minute:Math.floor(sim.minute),type:'change',diagnosis:diag.label,diagnosisCode:diag.code,evidence:[diag.evidence],severity:+diag.severity.toFixed(3),affectedPlayers:clone(action.players||diag.affectedPlayers||[]),affectedSectors:clone(action.sectors||diag.affectedSectors||[]),intensity:action.intensity||'medium',action:{id:action.id,label:action.label},expected:action.expected,substitution,roleChange,beforeConfig:previous,afterConfig:snapshotTeamState(tm),decision:'pending'};
  if(entry.affectedPlayers.length)blankManagerStats(sim.stats[t]).managerTargetedPlayers+=entry.affectedPlayers.length;
  state.history.push(entry);state.lastActionMinute=sim.minute;state.tried[action.id]=sim.minute;state.currentDiagnosis=diag;blankManagerStats(sim.stats[t]).managerChanges++;
  state.pendingEvaluation={minute:sim.minute,action:action.id,objective:action.objective,before:now,previous,entry,emergency:['RED_CARD','LOSING_LATE','LEADING_LATE'].includes(diag.code)};
  sim._emit('manager_change',{team:t,profile:state.profile.label,diagnosis:diag.label,action:action.label,expected:action.expected,substitution,affectedPlayers:entry.affectedPlayers,affectedSectors:entry.affectedSectors,intensity:entry.intensity});return entry;
}
const Q=M.prototype;Q.__P9__=true;
const oldBuild=Q._buildTeam;Q._buildTeam=function(source,side){const tm=oldBuild.call(this,source,side);tm.managerAI={profile:deriveProfile(source,tm),knowledge:clone(source&&((source.managerKnowledge)||(source.tournamentContext)||(source.phase9Context))||{}),preMatch:null,history:[],diagnoses:[],currentDiagnosis:null,pendingEvaluation:null,lastThinkMinute:-99,lastActionMinute:-99,lastSubMinute:-99,lastNoActionMinute:-99,subsMade:0,tried:Object.create(null),sideShift:null,attackFocus:null,pressOrientation:null};return tm;};
const oldBlank=Q._blankStats;Q._blankStats=function(){return blankManagerStats(oldBlank.call(this));};
const oldInteractive=Q.setInteractive;Q.setInteractive=function(team){const out=oldInteractive.call(this,team);if(this._aiTeam===0||this._aiTeam===1)preMatchPlan(this,this._aiTeam);return out;};
Q.setManagerProfile=function(team,profile){const tm=this.teams[team];if(!tm)return false;tm.managerAI=tm.managerAI||{};tm.managerAI.profile=typeof profile==='string'&&PROFILE_TEMPLATES[profile]?clone(PROFILE_TEMPLATES[profile]):Object.assign({},tm.managerAI.profile||PROFILE_TEMPLATES.adaptive,clone(profile||{}));return clone(tm.managerAI.profile);};
Q._phase9Evaluate=function(team,force){return evaluateChange(this,team,!!force);};
function recordNoAction(sim,t,state,diag,reason){if(sim.minute-state.lastNoActionMinute<4)return null;const entry={minute:Math.floor(sim.minute),type:'no_action',diagnosis:diag&&diag.label||'Sem diagnóstico prioritário',diagnosisCode:diag&&diag.code||null,evidence:diag?[diag.evidence]:[],affectedPlayers:clone(diag&&diag.affectedPlayers||[]),affectedSectors:clone(diag&&diag.affectedSectors||[]),intensity:'none',action:{id:'hold',label:'Manter configuração'},expected:reason,decision:'maintain'};state.history.push(entry);state.lastNoActionMinute=sim.minute;blankManagerStats(sim.stats[t]).managerNoActions++;return entry;}
Q._phase9Think=function(team,force){const t=team===1?1:0,tm=this.teams[t],state=tm.managerAI;if(!state)return null;preMatchPlan(this,t);evaluateChange(this,t,false);const interval=C(10-state.profile.adaptability/30,6,9);if(!force&&this.minute-state.lastThinkMinute<interval)return null;state.lastThinkMinute=this.minute;const metrics=metricSnapshot(this,t),diags=diagnose(this,t,metrics);state.diagnoses=diags.slice(0,7);const st=blankManagerStats(this.stats[t]);st.managerAnalyses++;st.managerDiagnoses+=diags.length;if(!diags.length)return recordNoAction(this,t,state,null,'Nenhuma evidência atingiu o limiar de intervenção');
  const emergency=diags[0].severity>=.9;const changeLimit=emergency?6:5;if(st.managerChanges>=changeLimit)return recordNoAction(this,t,state,diags[0],`Limite de ${changeLimit} intervenções autônomas atingido; manter estrutura`);if(state.pendingEvaluation&&!emergency)return recordNoAction(this,t,state,diags[0],'Mudança anterior ainda está em período mínimo de avaliação');
  const cooldown=C(state.profile.persistence-(state.profile.adaptability-50)/12,8,16);if(!force&&!emergency&&this.minute-state.lastActionMinute<cooldown)return recordNoAction(this,t,state,diags[0],'Persistir na mudança anterior antes de novo ajuste');
  let chosen=null;for(const d of diags){const a=actionFor(d,this,t,state.profile);if(!a)continue;const last=state.tried[a.id],repeatWindow=state.profile.persistence+(d.code==='LOSING_LATE'?9:7);if(last!=null&&this.minute-last<repeatWindow)continue;const personality=(a.objective==='attack'?(state.profile.riskTolerance*.7+state.profile.aggression*.3):a.objective==='defend'?state.profile.defensivePreference:state.profile.possessionPreference)/100*.1;const score=d.severity+personality;if(score>=state.profile.evidenceThreshold&&(!chosen||score>chosen.score))chosen={diag:d,action:a,score};}
  if(!chosen)return recordNoAction(this,t,state,diags[0],'Evidência insuficiente ou resposta já utilizada recentemente');return applyAction(this,t,chosen.diag,chosen.action);
};
Q.getManagerData=function(team){const t=team===1?1:0,tm=this.teams[t],s=blankManagerStats(this.stats[t]),state=tm.managerAI;return{version:VERSION,team:t,profile:clone(state.profile),knowledge:clone(state.knowledge),preMatch:clone(state.preMatch),currentDiagnosis:clone(state.currentDiagnosis),diagnoses:clone(state.diagnoses),pendingEvaluation:state.pendingEvaluation?{minute:state.pendingEvaluation.minute,action:state.pendingEvaluation.action,objective:state.pendingEvaluation.objective,entry:clone(state.pendingEvaluation.entry)}:null,history:clone(state.history),metrics:{analyses:s.managerAnalyses,diagnoses:s.managerDiagnoses,changes:s.managerChanges,substitutions:s.managerSubstitutions,evaluations:s.managerEvaluations,successful:s.managerSuccessfulChanges,failed:s.managerFailedChanges,inconclusive:s.managerInconclusiveChanges,reversals:s.managerReversals,preMatchPlans:s.managerPreMatchPlans,noActions:s.managerNoActions,roleChanges:s.managerRoleChanges,dutyChanges:s.managerDutyChanges,pressOrientations:s.managerPressOrientations,crossChanges:s.managerCrossChanges,targetedPlayers:s.managerTargetedPlayers,stateExports:s.managerStateExports,stateImports:s.managerStateImports}};};
/* §R19.05 · `_aiTeam` so existe depois de `setInteractive`, que numa partida CPU x CPU nunca e chamada -- entao `_phase9Think` rodava ZERO vez e ninguem nunca era substituido (medido: 0 subs, 0 mudancas de formacao, 10 reservas terminando no banco por partida). O `managerAI` ja e criado para os DOIS times em `_buildTeam` (:8638); faltava chamar. */
Q._aiReact=function(){
  const humano=(this.interactiveTeam===0||this.interactiveTeam===1)?this.interactiveTeam:-1;
  for(let t=0;t<2;t++){
    if(t===humano)continue;            // o time do dono e do dono
    if(!this.teams[t]||!this.teams[t].managerAI)continue;
    try{this._phase9Think(t,false);}catch(_){}
  }
};
const oldAdvanced=Q.getAdvancedData;Q.getAdvancedData=function(team){const out=oldAdvanced?oldAdvanced.call(this,team):{};out.engineVersion=VERSION;out.phase9=this.getManagerData(team);return out;};
Q.exportManagerState=function(team){const t=team===1?1:0,tm=this.teams[t],state=tm&&tm.managerAI;if(!state)return null;blankManagerStats(this.stats[t]).managerStateExports++;return{version:VERSION,team:t,state:clone(state),teamConfig:snapshotTeamState(tm)};};
Q.importManagerState=function(team,payload){const t=team===1?1:0,tm=this.teams[t];if(!tm||!payload||!payload.state)return false;const incoming=clone(payload.state),cfg=clone(payload.teamConfig||null);incoming.profile=Object.assign({},PROFILE_TEMPLATES.adaptive,incoming.profile||{});incoming.history=Array.isArray(incoming.history)?incoming.history:[];incoming.diagnoses=Array.isArray(incoming.diagnoses)?incoming.diagnoses:[];incoming.tried=incoming.tried||Object.create(null);const savedSide=incoming.sideShift&&incoming.sideShift.side,savedAttack=incoming.attackFocus&&incoming.attackFocus.side,savedPress=incoming.pressOrientation&&incoming.pressOrientation.side;incoming.sideShift=null;incoming.attackFocus=null;incoming.pressOrientation=null;tm.managerAI=Object.assign(tm.managerAI||{},incoming);try{if(cfg){if(cfg.instructions&&typeof this.setTeamInstructions==='function')this.setTeamInstructions(t,cfg.instructions);if(cfg.axes&&typeof this.setAxes==='function')this.setAxes(t,cfg.axes);if(cfg.defForm&&cfg.atkForm&&typeof this.setShapes==='function')this.setShapes(t,cfg.defForm,cfg.defVar||0,cfg.atkForm,cfg.atkVar||0);if(Array.isArray(cfg.roles)&&typeof this.setPlayerPhaseRole==='function')for(const r of cfg.roles){const rp=tm.players.find(x=>playerId(x)===r.id||String(playerId(x))===String(r.id));if(rp)this.setPlayerPhaseRole(t,rp.idx,{inPossession:r.inPossession,outOfPossession:r.outOfPossession});}}shiftSide(tm,tm.managerAI,savedSide||null);shiftAttackFocus(tm,tm.managerAI,savedAttack||null);orientPress(tm,tm.managerAI,savedPress||null);}catch(_){return false;}blankManagerStats(this.stats[t]).managerStateImports++;return true;};
const oldState=Q.getState;Q.getState=function(){const out=oldState.call(this);out.engineVersion=VERSION;out.phase9=this.teams.map((tm,i)=>({version:VERSION,team:i,state:clone(tm.managerAI),teamConfig:snapshotTeamState(tm)}));return out;};
if(!NODE&&typeof document!=='undefined'){
  const Old=root.MatchSim;class Active extends Old{constructor(){super(...arguments);root.__CDS_ACTIVE_SIM=this;}}root.MatchSim=Active;
  const boot=()=>{if(document.getElementById('p9btn'))return;const css=document.createElement('style');css.textContent='#p9btn{position:fixed;left:12px;bottom:12px;z-index:999999;border:1px solid #64d8ff;border-radius:999px;background:#0b1726;color:#a9edff;padding:9px 12px;font:700 11px system-ui}#p9box{position:fixed;inset:0;z-index:1000001;background:#020712dd;display:none;place-items:end center;padding:12px;color:#fff;font-family:system-ui}#p9box.on{display:grid}#p9box>div{width:min(760px,100%);max-height:86vh;overflow:auto;background:#0b1425;border:1px solid #29536d;border-radius:18px;padding:15px}.p9card{background:#101d30;border:1px solid #203c58;border-radius:10px;padding:10px;margin:8px 0}.p9ev{font-size:12px;color:#b8c9d9;margin-top:4px}';document.head.appendChild(css);const b=document.createElement('button');b.id='p9btn';b.textContent='IA DO TREINADOR 5.2.2';const x=document.createElement('div');x.id='p9box';x.innerHTML='<div><button id="p9close" style="float:right">×</button><h3>Leitura do treinador adversário — 5.2.2</h3><main></main></div>';document.body.append(b,x);const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const paint=()=>{const sim=root.__CDS_ACTIVE_SIM,m=x.querySelector('main');if(!sim)return m.innerHTML='<p>Inicie uma partida.</p>';const side=sim._aiTeam===0?0:1,d=sim.getManagerData(side);m.innerHTML='<div class="p9card"><b>'+esc(d.profile.label)+'</b><div class="p9ev">Adaptabilidade '+d.profile.adaptability+' · Risco '+d.profile.riskTolerance+' · Pressão '+d.profile.pressingPreference+'</div></div>'+(d.currentDiagnosis?'<div class="p9card"><b>Diagnóstico atual</b><div>'+esc(d.currentDiagnosis.label)+'</div><div class="p9ev">'+esc(d.currentDiagnosis.evidence)+'</div></div>':'')+'<h4>Decisões</h4>'+d.history.slice(-8).reverse().map(h=>'<div class="p9card"><b>'+h.minute+'’ · '+esc(h.action&&h.action.label||h.diagnosis)+'</b><div>'+esc(h.diagnosis||'')+'</div><div class="p9ev">'+esc(h.expected||'')+(h.evaluation?' · avaliação '+h.evaluation.score:'')+'</div></div>').join('')+'<p>Análises: '+d.metrics.analyses+' · Mudanças: '+d.metrics.changes+' · Subs: '+d.metrics.substitutions+' · Reversões: '+d.metrics.reversals+'</p>';};b.onclick=()=>{x.classList.add('on');paint();};x.querySelector('#p9close').onclick=()=>x.classList.remove('on');};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
}
const API={VERSION,PROFILES:PROFILE_TEMPLATES,deriveProfile,metricSnapshot,diagnose,actionFor,applyAction,preMatchPlan,getManagerData:(sim,team)=>sim.getManagerData(team),installed:true};root.CDS_PHASE9=API;if(NODE)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);

/* Copa dos Sonhos — Contrato de save versionado.
   Regras:
   - todo save carrega `v` (schema) e `engineVersion`;
   - saves antigos passam por migrações encadeadas;
   - versão futura/desconhecida ou estrutura inválida → null;
   - campos novos entram com defaults neutros, sem inventar progresso. */
(function (root) {
'use strict';
const SAVE_VERSION = 3;

const MIGRATIONS = {
  1: function (s) {
    return Object.assign({}, s, {
      v: 2,
      engineVersion: s.engineVersion || 'legacy-4.x',
      savedAt: s.savedAt || null,
      instructions: s.instructions || null,
      instructionPreset: s.instructionPreset || null,
      phaseRoles: s.phaseRoles || null,
      manager: s.manager || null,
    });
  },
  2: function (s) {
    const cup = s.cup && typeof s.cup === 'object' ? s.cup : null;
    return Object.assign({}, s, {
      v: 3,
      phase10Version: 1,
      phase10: s.phase10 || (cup && cup.persistence) || null,
      preparationSelection: s.preparationSelection || null,
    });
  },
};

function migrateSave(s) {
  if (!s || typeof s.v !== 'number') return null;
  s = Object.assign({}, s);
  let guard = 0;
  while (s.v < SAVE_VERSION && guard++ < 16) {
    const up = MIGRATIONS[s.v];
    if (!up) return null;
    s = up(s);
  }
  return s.v === SAVE_VERSION ? s : null;
}
function validateSave(s) {
  return !!(s && s.v === SAVE_VERSION && s.cup && typeof s.cup === 'object'
    && Array.isArray(s.picks) && s.picks.length >= 11);
}
function decodeSave(json) {
  let s;
  try { s = JSON.parse(json); } catch (_) { return null; }
  s = migrateSave(s);
  return validateSave(s) ? s : null;
}
function encodeSave(s) {
  const migrated = migrateSave(s);
  if (!validateSave(migrated)) return null;
  try { return JSON.stringify(migrated); } catch (_) { return null; }
}

const API = { SAVE_VERSION, MIGRATIONS, migrateSave, validateSave, decodeSave, encodeSave };
root.CDS_SAVE_CONTRACT = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* Copa dos Sonhos — Fase 10 · Persistência da Copa
   Cada partida deixa consequências explícitas para a próxima:
   condição, fadiga acumulada, lesões, cartões, suspensões, forma recente,
   confiança contextual, adaptação à função, sequência de gols e preparação.
   Não há moral/química como bônus mágico: os efeitos entram somente nos
   mecanismos que representam (fôlego inicial, execução, leitura, bola parada). */
(function (root) {
'use strict';
const C = (typeof module !== 'undefined' && module.exports) ? require('./20-core.js') : root;
const clamp = C.clamp || ((v,a,b)=>Math.max(a,Math.min(b,v)));
const VERSION = '1.0.0';
const ENGINE_VERSION = '5.3.0';
const STATE_VERSION = 1;

const PREPARATIONS = Object.freeze({
  recovery: Object.freeze({
    key:'recovery', label:'Recuperação física', icon:'🫁',
    description:'+12 de condição e −8 de fadiga acumulada para o elenco. Sem bônus técnico.',
    effects:Object.freeze({ recovery:12, fatigueRelief:8 })
  }),
  tactical: Object.freeze({
    key:'tactical', label:'Treino tático', icon:'🧠',
    description:'+6% de familiaridade nas funções atuais e até +1,2% de execução na próxima partida.',
    effects:Object.freeze({ roleLearning:.06, execution:.012 })
  }),
  setpieces: Object.freeze({
    key:'setpieces', label:'Bolas paradas', icon:'🎯',
    description:'+3,5% de execução em faltas, escanteios e pênaltis na próxima partida.',
    effects:Object.freeze({ setPiece:.035 })
  }),
  finishing: Object.freeze({
    key:'finishing', label:'Finalização', icon:'🥅',
    description:'+2,5% de execução dos chutes na próxima partida. Não altera o atributo permanente.',
    effects:Object.freeze({ shot:.025 })
  }),
  defensive: Object.freeze({
    key:'defensive', label:'Preparação defensiva', icon:'🛡️',
    description:'+2,5% de execução em pressão, cobertura e duelos defensivos na próxima partida.',
    effects:Object.freeze({ defend:.025 })
  })
});

function playerKey(p) {
  if (!p) return null;
  return String(p.id != null ? p.id : (p.n || 'unknown') + '#' + (p.slot || p.pos || ''));
}
function roleKey(slot) {
  if (!slot) return 'unknown|unknown|bal';
  const p = slot.p || slot.ref || slot;
  return [slot.pos || p.slot || p.pos || 'CM', slot.role || 'default', slot.focus || 'bal'].join('|');
}
function stateKey(p, sid) { return String(sid == null ? 'GLOBAL' : sid) + '::' + playerKey(p); }
function blankPlayer(p, sid) {
  return {
    key:stateKey(p,sid), id: playerKey(p), sid: sid || null, name: (p && p.n) || '',
    condition:100, cumulativeFatigue:0,
    injuryMatches:0, injuryType:null, suspensionMatches:0, yellowCards:0,
    recentForm:[], confidence:{ finishing:0, defending:0, decision:0 },
    roleFamiliarity:{}, scoringStreak:0,
    appearances:0, starts:0, benchAppearances:0, minutes:0,
    lastMinutes:0, lastStarted:false, lastRating:6, lastGoals:0,
    lastRole:null, lastMatchIndex:0
  };
}
function blankTeam(sid) {
  return {
    sid, matches:0, pendingPreparation:true, activePreparation:null,
    lastPreparation:null, preparationHistory:[], recoveryAppliedFor:-1,
    knockoutPressure:0, lastExtraTime:false, lastUnavailable:[], lastReplacements:[]
  };
}
function ensureCup(cup, db) {
  if (!cup) return null;
  if (!cup.persistence || cup.persistence.version !== STATE_VERSION) {
    const old = cup.persistence || {};
    cup.persistence = {
      version:STATE_VERSION,
      players:old.players || {}, teams:old.teams || {},
      history:old.history || [], createdAtMatch:old.createdAtMatch || 0
    };
  }
  const P = cup.persistence;
  const sids = [];
  if (cup.groups) for (const g of cup.groups) for (const sid of g.teams || []) if (!sids.includes(sid)) sids.push(sid);
  if (cup.playerSid != null && !sids.includes(cup.playerSid)) sids.push(cup.playerSid);
  if (db && db.byId) for (const sid of sids) {
    const sq = db.byId[sid];
    if (sq) registerTeam(cup, sq, sid);
  }
  return P;
}
function ensureTeam(cup, sid) {
  ensureCup(cup);
  const P = cup.persistence;
  if (!P.teams[sid]) P.teams[sid] = blankTeam(sid);
  return P.teams[sid];
}
function ensurePlayer(cup, p, sid) {
  if (!p) return null;
  ensureCup(cup);
  const key = stateKey(p, sid);
  if (!cup.persistence.players[key]) cup.persistence.players[key] = blankPlayer(p, sid);
  const st = cup.persistence.players[key];
  if (!st.sid && sid) st.sid = sid;
  return st;
}
function registerTeam(cup, squad, sid) {
  sid = sid != null ? sid : (squad && squad.sid);
  if (sid == null) return null;
  const ts = ensureTeam(cup, sid);
  for (const p of (squad && squad.pl) || []) ensurePlayer(cup, p, sid);
  return ts;
}
function status(cup, p, sid) {
  let st;
  if (sid != null) st = ensurePlayer(cup,p,sid);
  else {
    const id=playerKey(p); st=Object.values((ensureCup(cup)||{}).players||{}).find(x=>x.id===id) || ensurePlayer(cup,p,'GLOBAL');
  }
  return {
    available:st.injuryMatches <= 0 && st.suspensionMatches <= 0,
    injured:st.injuryMatches > 0, suspended:st.suspensionMatches > 0,
    condition:Math.round(st.condition), fatigue:Math.round(st.cumulativeFatigue),
    injuryMatches:st.injuryMatches, injuryType:st.injuryType,
    suspensionMatches:st.suspensionMatches, yellowCards:st.yellowCards,
    form:recentFormValue(st), scoringStreak:st.scoringStreak,
    confidence:Object.assign({}, st.confidence)
  };
}
function recentFormValue(st) {
  const a = st && st.recentForm || [];
  return a.length ? +(a.reduce((s,v)=>s+v,0)/a.length).toFixed(2) : 6;
}
function allRoster(team) {
  const out=[], seen=new Set();
  const add=p=>{ const k=playerKey(p); if(p && k && !seen.has(k)){seen.add(k);out.push(p);} };
  for (const sl of team.lineup || []) add(sl.p || sl);
  for (const p of team.bench || []) add(p.p || p);
  for (const p of (team.squad && team.squad.pl) || []) add(p);
  return out;
}
function applyBaseRecovery(cup, sid, team) {
  const ts = ensureTeam(cup, sid);
  if (ts.recoveryAppliedFor === ts.matches) return;
  for (const p of allRoster(team)) {
    const st = ensurePlayer(cup, p, sid);
    const base = ts.matches === 0 ? 0 : (st.lastMinutes >= 45 ? 14 : st.lastMinutes > 0 ? 17 : 20);
    st.condition = clamp(st.condition + base, 35, 100);
    st.cumulativeFatigue = clamp(st.cumulativeFatigue - base * .70, 0, 100);
  }
  ts.recoveryAppliedFor = ts.matches;
}
function choosePreparation(cup, sid, choice, lineup, squadOrTeam, meta) {
  const def = PREPARATIONS[choice];
  if (!def) throw new Error('Preparação desconhecida: ' + choice);
  const team = squadOrTeam && squadOrTeam.lineup ? squadOrTeam : {
    squad:squadOrTeam || null, lineup:lineup || [], bench:(squadOrTeam && squadOrTeam.pl) || []
  };
  registerTeam(cup, team.squad || squadOrTeam, sid);
  const ts = ensureTeam(cup, sid);
  applyBaseRecovery(cup, sid, team);
  const eff = Object.assign({}, def.effects);
  if (eff.recovery || eff.fatigueRelief) for (const p of allRoster(team)) {
    const st = ensurePlayer(cup, p, sid);
    st.condition = clamp(st.condition + (eff.recovery || 0), 35, 100);
    st.cumulativeFatigue = clamp(st.cumulativeFatigue - (eff.fatigueRelief || 0), 0, 100);
  }
  if (eff.roleLearning) for (const sl of lineup || team.lineup || []) {
    const p = sl.p || sl, st = ensurePlayer(cup, p, sid), rk = roleKey(sl);
    st.roleFamiliarity[rk] = clamp((st.roleFamiliarity[rk] == null ? .35 : st.roleFamiliarity[rk]) + eff.roleLearning, 0, 1);
  }
  const record = {
    choice, label:def.label, selectedAtMatch:ts.matches,
    forMatch:ts.matches + 1, effects:eff,
    automatic:!!(meta && meta.automatic)
  };
  ts.activePreparation = record;
  ts.lastPreparation = choice;
  ts.pendingPreparation = false;
  ts.preparationHistory.push(record);
  if (ts.preparationHistory.length > 12) ts.preparationHistory.shift();
  cup.persistence.history.push({ type:'preparation', sid, ...record });
  return record;
}
function pressureForStage(stage) {
  return ({groups:.05,r16:.35,qf:.55,sf:.75,third:.35,final:1})[stage] || 0;
}
function autoPreparationChoice(cup, sid, team) {
  const roster=allRoster(team), avg=roster.length?roster.reduce((s,p)=>s+ensurePlayer(cup,p,sid).condition,0)/roster.length:100;
  if (avg < 74) return 'recovery';
  const ts=ensureTeam(cup,sid);
  return ['tactical','defensive','setpieces','finishing'][ts.matches % 4];
}
function scoreReplacement(C0, p, sl) {
  const pos=sl.pos || (sl.p && sl.p.slot) || 'CM';
  let s=(p.r || 60);
  if (C0.canPlay && Array.isArray(p.elig) && C0.canPlay(p,pos)) s+=35;
  if ((C0.LINE_OF && C0.LINE_OF[p.slot]) === (C0.LINE_OF && C0.LINE_OF[pos])) s+=12;
  if (p.slot===pos) s+=15;
  return s;
}
function attachPlayer(cup, sid, p, sl, prep, ts) {
  const st=ensurePlayer(cup,p,sid), rk=roleKey(sl || p);
  const familiarity=st.roleFamiliarity[rk] == null ? .35 : st.roleFamiliarity[rk];
  const conf=st.confidence || {finishing:0,defending:0,decision:0};
  const effects=(prep && prep.effects) || {};
  const persistence={
    condition:st.condition, cumulativeFatigue:st.cumulativeFatigue,
    roleFamiliarity:familiarity,
    executionBonus:clamp((familiarity-.5)*.03 + (effects.execution||0) + (conf.decision||0),-.035,.035),
    shotBonus:clamp((effects.shot||0)+(conf.finishing||0),-.03,.04),
    setPieceBonus:clamp(effects.setPiece||0,0,.04),
    defensiveBonus:clamp((effects.defend||0)+(conf.defending||0),-.03,.04),
    importanceExtra:clamp(ts.knockoutPressure*.025,0,.025),
    injuryRisk:clamp(.85 + st.cumulativeFatigue/100*.55, .80, 1.40),
    scoringStreak:st.scoringStreak
  };
  const cp=Object.assign({},p,{_phase10Sid:sid,_phase10InitialStamina:clamp(st.condition,35,100),_phase10Persistence:persistence});
  return { player:cp, persistence, status:st };
}
function prepareTeam(cup, team, sid, opts) {
  opts=opts||{};
  registerTeam(cup, team.squad, sid);
  const ts=ensureTeam(cup,sid);
  /* A pressão pertence à partida que será jogada, não à fase anterior.
     Assim a estreia no mata-mata já recebe o contexto de oitavas/quartas/etc. */
  if (opts.stage) ts.knockoutPressure=pressureForStage(opts.stage);
  if (ts.pendingPreparation && !ts.activePreparation) {
    const choice=opts.user ? 'recovery' : autoPreparationChoice(cup,sid,team);
    choosePreparation(cup,sid,choice,team.lineup,team,{automatic:true});
  } else applyBaseRecovery(cup,sid,team);
  const prep=ts.activePreparation;
  const lineup=(team.lineup||[]).map(sl=>Object.assign({},sl));
  let bench=(team.bench||[]).slice();
  /* Todo indisponível do elenco precisa cumprir a duração da lesão/suspensão,
     mesmo quando era reserva. Antes apenas titulares bloqueados entravam no
     snapshot e um reserva lesionado podia ficar congelado para sempre. */
  const unavailable=allRoster(team).map(p=>({p,st:ensurePlayer(cup,p,sid)}))
    .filter(x=>x.st.injuryMatches>0||x.st.suspensionMatches>0)
    .map(x=>({id:x.st.key,name:x.p.n,reason:x.st.injuryMatches>0?'injury':'suspension',matches:Math.max(x.st.injuryMatches,x.st.suspensionMatches),starter:false}));
  const replacements=[];
  const used=new Set(lineup.map(sl=>playerKey(sl.p)));
  for(let i=0;i<lineup.length;i++){
    const sl=lineup[i], st=ensurePlayer(cup,sl.p,sid);
    if(st.injuryMatches<=0 && st.suspensionMatches<=0) continue;
    const listed=unavailable.find(x=>x.id===st.key); if(listed) listed.starter=true;
    const candidates=bench.filter(p=>{const ps=ensurePlayer(cup,p,sid);return ps.injuryMatches<=0&&ps.suspensionMatches<=0&&!used.has(playerKey(p));});
    candidates.sort((a,b)=>scoreReplacement(C,b,sl)-scoreReplacement(C,a,sl));
    const rep=candidates[0];
    if(rep){
      replacements.push({out:sl.p.n,in:rep.n,pos:sl.pos});
      used.delete(playerKey(sl.p)); used.add(playerKey(rep));
      bench=bench.filter(p=>playerKey(p)!==playerKey(rep));
      sl.p=rep;
    }
  }
  for(const sl of lineup){
    const a=attachPlayer(cup,sid,sl.p,sl,prep,ts);
    sl.p=a.player; sl.initialStamina=a.player._phase10InitialStamina; sl.persistence=a.persistence;
  }
  bench=bench.filter(p=>{const st=ensurePlayer(cup,p,sid);return st.injuryMatches<=0&&st.suspensionMatches<=0;}).map(p=>attachPlayer(cup,sid,p,p,prep,ts).player);
  ts.lastUnavailable=unavailable; ts.lastReplacements=replacements;
  ts._matchSnapshot={unavailable:unavailable.map(x=>x.id),preparation:prep,originalLineup:(team.lineup||[]).map(sl=>playerKey(sl.p)),stage:opts.stage||null};
  return Object.assign({},team,{lineup,bench,phase10:{sid,preparation:prep,unavailable,replacements}});
}
function captureMatch(sim, side, originalTeam, stage) {
  const total=Math.max(90,Math.min(120,Math.round(sim.minute||90)));
  const participants={};
  const add=(p,started,entry)=>{if(!p)return;const ref=p.ref||p,k=playerKey(ref);if(!participants[k])participants[k]={id:k,ref,started:!!started,entry:entry||0,exit:total,minutes:0,rating:p.rating||6,finalStamina:p.stamina==null?100:p.stamina,goals:0,yellow:0,red:0,injured:false,role:p.role||null,focus:p.focus||'bal',position:p.slotPos||ref.slot};};
  for(const sl of (originalTeam&&originalTeam.lineup)||[]) add({ref:sl.p,role:sl.role,focus:sl.focus,slotPos:sl.pos,stamina:sl.initialStamina||100,rating:6},true,0);
  for(const ev of sim.events||[]){
    if(ev.type==='sub'&&ev.team===side){
      const ko=playerKey(ev.out&&ev.out.ref),ki=playerKey(ev.inP&&ev.inP.ref);
      if(ko&&participants[ko]){const q=participants[ko];q.exit=Math.min(total,ev.minute||0);q.rating=ev.out.rating||6;q.finalStamina=ev.out.stamina==null?q.finalStamina:ev.out.stamina;q.yellow=Math.max(q.yellow,ev.out.yellow||0);q.red=Math.max(q.red,ev.out.red?1:0);q.injured=q.injured||!!ev.out._injured;}
      add(ev.inP,false,ev.minute||0); if(ki&&participants[ki]) participants[ki].entry=ev.minute||0;
    } else if(ev.type==='goal'&&ev.by&&ev.by.team===side){add(ev.by,false,0);participants[playerKey(ev.by.ref)].goals++;}
    else if(ev.type==='yellow'&&ev.p&&ev.p.team===side){add(ev.p,false,0);participants[playerKey(ev.p.ref)].yellow++;}
    else if(ev.type==='red'&&ev.p&&ev.p.team===side){add(ev.p,false,0);participants[playerKey(ev.p.ref)].red++;}
    else if(ev.type==='injury'&&ev.by&&ev.by.team===side){add(ev.by,false,0);participants[playerKey(ev.by.ref)].injured=true;}
  }
  for(const p of (sim.teams[side]&&sim.teams[side].players)||[]){add(p,false,0);const q=participants[playerKey(p.ref)];q.rating=p.rating||q.rating;q.finalStamina=p.stamina==null?q.finalStamina:p.stamina;q.yellow=Math.max(q.yellow,p.yellow||0);q.red=Math.max(q.red,p.red?1:0);q.injured=q.injured||!!p._injured;}
  for(const q of Object.values(participants)) q.minutes=clamp(q.exit-q.entry,0,total);
  return {sid:(originalTeam&&originalTeam.squad&&originalTeam.squad.sid)||null,totalMinutes:total,extraTime:total>95,stage:stage||null,score:[sim.score[side],sim.score[1-side]],players:Object.values(participants)};
}
function injuryDuration(q,teamMatches) {
  let h=2166136261>>>0;const s=String(q.id)+'#'+teamMatches;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return 1+(h%3)+(q.finalStamina<35?1:0);
}
function recordTeamMatch(cup, sid, summary, squad) {
  const ts=ensureTeam(cup,sid), snap=ts._matchSnapshot||{unavailable:[]};
  for(const id of snap.unavailable||[]){const st=cup.persistence.players[id];if(!st)continue;if(st.injuryMatches>0)st.injuryMatches--;if(st.suspensionMatches>0)st.suspensionMatches--;if(st.injuryMatches<=0)st.injuryType=null;}
  const played=new Set();
  for(const q of summary.players||[]){
    const st=ensurePlayer(cup,q.ref,sid);played.add(st.key);
    const extra=Math.max(0,q.minutes-90);
    const load=clamp((q.minutes/90)*18 + Math.max(0,100-q.finalStamina)*.70 + extra*.22,0,65);
    st.cumulativeFatigue=clamp(st.cumulativeFatigue*.45+load,0,100);
    st.condition=clamp(100-st.cumulativeFatigue,35,100);
    st.appearances++;if(q.started)st.starts++;else if(q.minutes>0)st.benchAppearances++;
    st.minutes+=q.minutes;st.lastMinutes=q.minutes;st.lastStarted=!!q.started;st.lastRating=+q.rating.toFixed(2);st.lastGoals=q.goals;st.lastMatchIndex=ts.matches+1;
    st.recentForm.push(st.lastRating);if(st.recentForm.length>5)st.recentForm.shift();
    st.scoringStreak=q.goals>0?st.scoringStreak+1:(q.minutes>=45?0:st.scoringStreak);
    const role=[q.position||'CM',q.role||'default',q.focus||'bal'].join('|');st.lastRole=role;
    st.roleFamiliarity[role]=clamp((st.roleFamiliarity[role]==null?.35:st.roleFamiliarity[role])+q.minutes/90*.045,0,1);
    const line=C.LINE_OF&&C.LINE_OF[q.position||q.ref.slot];
    st.confidence.decision=clamp(st.confidence.decision*.65+(q.rating-6.2)*.007,-.025,.025);
    st.confidence.finishing=clamp(st.confidence.finishing*.65+q.goals*.012-(line==='FWD'&&q.minutes>=60&&q.goals===0?.003:0),-.025,.03);
    st.confidence.defending=clamp(st.confidence.defending*.65+(summary.score[1]===0?.008:-summary.score[1]*.003),-.025,.025);
    if(q.injured){st.injuryMatches=Math.max(st.injuryMatches,injuryDuration(q,ts.matches+1));st.injuryType=q.finalStamina<35?'muscular':'impact';}
    st.yellowCards+=q.yellow||0;
    if(st.yellowCards>=2){st.suspensionMatches=Math.max(st.suspensionMatches,1);st.yellowCards=0;}
    if(q.red)st.suspensionMatches=Math.max(st.suspensionMatches,1);
  }
  for(const p of (squad&&squad.pl)||[]){const st=ensurePlayer(cup,p,sid);if(!played.has(st.key)){st.condition=clamp(st.condition+3,35,100);st.cumulativeFatigue=clamp(st.cumulativeFatigue-3,0,100);st.lastMinutes=0;st.lastStarted=false;}}
  ts.matches++;ts.lastExtraTime=!!summary.extraTime;ts.pendingPreparation=true;ts.activePreparation=null;ts.recoveryAppliedFor=-1;ts._matchSnapshot=null;
  ts.knockoutPressure=pressureForStage(summary.stage);
  cup.persistence.history.push({type:'match',sid,match:ts.matches,stage:summary.stage,score:summary.score,extraTime:summary.extraTime});
  return ts;
}
function recordSimulation(cup, sim, teams, opts) {
  opts=opts||{};
  const out=[];
  for(let side=0;side<2;side++){
    const team=teams[side], sid=team&&team.squad&&team.squad.sid;
    if(sid==null)continue;
    const summary=captureMatch(sim,side,team,opts.stage);
    recordTeamMatch(cup,sid,summary,team.squad);
    out.push(summary);
  }
  return out;
}
function teamOverview(cup, sid, squad) {
  const ts=ensureTeam(cup,sid), players=[];
  for(const p of (squad&&squad.pl)||[]){const st=ensurePlayer(cup,p,sid);players.push({p,state:st,status:status(cup,p,sid)});}
  const avg=players.length?players.reduce((s,x)=>s+x.state.condition,0)/players.length:100;
  return {team:ts,averageCondition:+avg.toFixed(1),players};
}
function needsPreparation(cup,sid){return !!ensureTeam(cup,sid).pendingPreparation;}
function preparationOptions(){return Object.values(PREPARATIONS).map(x=>({key:x.key,label:x.label,icon:x.icon,description:x.description,effects:Object.assign({},x.effects)}));}

const API={VERSION,ENGINE_VERSION,STATE_VERSION,PREPARATIONS,pressureForStage,ensureCup,ensureTeam,ensurePlayer,registerTeam,status,recentFormValue,choosePreparation,autoPreparationChoice,prepareTeam,captureMatch,recordTeamMatch,recordSimulation,teamOverview,needsPreparation,preparationOptions,playerKey,stateKey,roleKey};
root.CDS_PHASE10=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);

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

