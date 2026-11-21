/*
 * Copa dos Sonhos · R14 · PONTE MOTOR -> MÁQUINA DE ANIMAÇÃO (Fase 3)
 *
 * Liga os eventos do contrato de ação (Fase 2) ao controlador por atleta.
 * É apresentação pura: envolve _emit apenas para OBSERVAR. Nenhuma decisão do
 * motor depende disto, e o runner headless nem carrega esta camada.
 *
 * O ganho sobre motionAt(): a pose de contato é agendada pela duração que o
 * MOTOR declarou no contrato, então o quadro em que o pé toca a bola é o mesmo
 * tick em que a bola parte — não um palpite de 0,42s fixo.
 */
(function (root) {
  'use strict';
  if (!root || root.__CDS_ANIM_BRIDGE__) return;

  function install() {
    const M = root.MatchSim, A = root.CDS_ANIM;
    if (!M || !M.prototype || !A || M.prototype.__CDS_ANIM_BRIDGE__) return false;
    M.prototype.__CDS_ANIM_BRIDGE__ = true;
    root.__CDS_ANIM_BRIDGE__ = true;

    // Qualificado por TIME: p.idx é numerado por equipe e o nome pode repetir,
    // então ids sem o time colidiam entre os dois lados e dois atletas
    // dividiam o mesmo controlador (22 jogadores viravam 17 estados).
    const idOf = p => (p ? (p.team != null ? p.team : '?') + ':' +
                          ((p.ref && (p.ref.id || p.ref.n)) || p.id || p.idx) : null);

    const oldEmit = M.prototype._emit;
    M.prototype._emit = function (type, data) {
      try {
        if (!this.__anim) this.__anim = A.create();
        const now = Number(this.t) || 0;
        if (type === 'action_prepare' && data && data.by) {
          // guarda o preparo; o contrato completo chega no contato
          this.__animPending = { id: idOf(data.by), action: data.action,
                                 prepareDuration: data.prepareDuration, actionId: data.actionId };
          const c = this.__anim.of(this.__animPending.id);
          c.beginAction({ actionId: data.actionId, action: data.action,
                          prepareDuration: data.prepareDuration,
                          followThroughDuration: 0.12, recoveryDuration: 0.14 }, now);
        } else if (type === 'action_contact' && data && data.by && data.contract) {
          const c = this.__anim.of(idOf(data.by));
          if (!c.seq) c.beginAction(data.contract, now);
        } else if (type === 'action_interrupted' && data && data.by) {
          this.__anim.of(idOf(data.by)).interrupt(now, 'tackled');
        } else if (data && data.by && (type === 'tackle' || type === 'slide_tackle')) {
          this.__anim.of(idOf(data.by)).request('standing_tackle', now, { force: true });
        } else if (data && data.gk) {
          const map = { gk_save: 'gk_parry', gk_claim: 'gk_catch', gk_punch: 'gk_punch',
                        gk_claim_miss: 'gk_ground_recover' };
          if (map[type]) this.__anim.of(idOf(data.gk)).request(map[type], now, { force: true });
        }
      } catch (_) { /* apresentação nunca derruba o motor */ }
      return oldEmit.apply(this, arguments);
    };

    /* Avança os controladores junto do relógio do motor e publica o estado por
       atleta para o desenhista consultar. */
    const oldStep = M.prototype.step;
    M.prototype.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        if (this.__anim) {
          const ctx = Object.create(null);
          for (const tm of this.teams) {
            for (const p of tm.players) {
              if (p.red) continue;
              // garante controlador para TODO atleta em campo: sem isto, só quem
              // recebe um evento de ação ganha estado, e os demais ficam sem
              // locomoção nenhuma para o desenhista consultar
              this.__anim.of(idOf(p));
              ctx[idOf(p)] = {
                speed: Math.hypot(Number(p.vx) || 0, Number(p.vy) || 0),
                hasBall: this.ball && this.ball.owner === p,
                isGK: !!p.isGK
              };
            }
          }
          this.__animState = this.__anim.update(Number(dt) || 0, Number(this.t) || 0, ctx);
          // Publica também pela CHAVE DE DESENHO (a mesma que CDS_F25D.body e o
          // dirCache já usam), para o desenhista consultar o estado sem precisar
          // do objeto do jogador nem da instância da partida.
          const byKey = Object.create(null);
          for (const tm of this.teams) {
            for (const p of tm.players) {
              if (p.red) continue;
              const s = this.__animState[idOf(p)];
              if (s) byKey[(p.ref && p.ref.n) || p.n || ('#' + (p.num || 0))] = s;
            }
          }
          root.__CDS_ANIM_BY_KEY = byKey;
        }
      } catch (_) { }
      return r;
    };

    /* Consulta usada pelo desenhista: estado + fase do atleta. */
    M.prototype.animOf = function (p) {
      const s = this.__animState;
      return (s && s[idOf(p)]) || null;
    };
    return true;
  }

  if (!install()) {
    // o bundle do motor pode ainda não ter sido avaliado quando esta camada carrega
    let tries = 0;
    const t = setInterval(function () {
      if (install() || ++tries > 100) clearInterval(t);
    }, 50);
  }
})(typeof window !== 'undefined' ? window : null);
