/* R18.21 · PLAUSIBILIDADE DA FINALIZAÇÃO ERRADA
   -------------------------------------------------------------------------
   QUEIXA: "o gol está vazio e o atacante chuta pra fora, tipo como assim".

   CAUSA. O motor sorteia o DESFECHO e depois escolhe uma trajetória para
   ilustrá-lo. Quando o sorteio dá "fora", o alvo do chute é jogado longe:
     · cruzamento rasteiro (linha 5368): y = gol ± R(3,4 .. 6,4)
     · chute com goleiro batido (linha 6126): y = gol ± R(3,7 .. 4,3)
   com a trave em 3,3-3,35 m. Um chute de dentro da área saindo 6,4 m do
   centro é implausível, e é o que se vê na tela.

   O QUE ESTA CAMADA FAZ. Comprime a amplitude do erro para que a bola RASPE
   a trave em vez de ir para a arquibancada. NADA MAIS. O desfecho continua
   exatamente o mesmo: quem ia para fora vai para fora, quem ia ser gol é gol,
   defesa segue defesa. Nenhuma estatística muda — gols, chutes, defesas,
   escanteios e xG têm que sair idênticos. É correção de aparência, e o teste
   de aceitação é justamente a AUSÊNCIA de mudança estatística.

   Não consome RNG: usa apenas a posição já sorteada, reescalando-a. */
(function installR1821ShotPlausibility(root) {
'use strict';
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__CDS_R1821_SHOT_PLAUSIBILITY__) return;
const P = M.prototype;
Object.defineProperty(P, '__CDS_R1821_SHOT_PLAUSIBILITY__', { value: true });

const VERSION = '5.15.0-R18.21';
const FL = Number(root.FL) || 105;
const FW = Number(root.FW) || 68;
const finite = (v, d) => Number.isFinite(v) ? v : (d || 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Trave em 3,3-3,35 no motor. Um erro plausível de finalização passa perto:
   entre meio metro e um metro e meio fora do poste. Acima disso vira
   arquibancada, que é o que incomoda. */
const POST = 3.35;
const ERRO_MIN = 0.45;   // mínimo fora do poste: continua sendo fora, sem dúvida
const ERRO_MAX = 1.55;   // máximo fora do poste: raspou

function audit(sim) {
  if (!sim.__r1821shot) {
    Object.defineProperty(sim, '__r1821shot', {
      value: { version: VERSION, chutesVistos: 0, comprimidos: 0,
               amplitudeAntesSoma: 0, amplitudeDepoisSoma: 0, amplitudeMaxAntes: 0 },
      enumerable: false, writable: true, configurable: true
    });
  }
  return sim.__r1821shot;
}

const oldStartTravel = P._startTravel;
if (typeof oldStartTravel === 'function') {
  P._startTravel = function (actor, target, kind, cb, receiver, travelKind, meta) {
    try {
      if (kind === 'shot' && target && actor && this.teams) {
        const a = audit(this);
        a.chutesVistos++;
        const tm = this.teams[actor.team];
        const g = tm && tm.oppGoal;
        if (g) {
          const gy = finite(g.y, FW / 2);
          const dy = finite(target.y) - gy;
          const amp = Math.abs(dy);
          // Só age em chute que JÁ ia para fora. Quem ia para dentro não é tocado.
          if (amp > POST) {
            a.amplitudeAntesSoma += amp;
            if (amp > a.amplitudeMaxAntes) a.amplitudeMaxAntes = amp;
            // Reescala o excesso para a faixa plausível, preservando o lado e a
            // ordem relativa do erro sorteado (erro maior continua maior).
            const excesso = amp - POST;
            const excessoMax = 6.5 - POST;           // pior caso observado no motor
            const t = clamp(excesso / excessoMax, 0, 1);
            const novoExcesso = ERRO_MIN + t * (ERRO_MAX - ERRO_MIN);
            const novoAmp = POST + novoExcesso;
            a.amplitudeDepoisSoma += novoAmp;
            a.comprimidos++;
            target = {
              x: target.x,
              y: clamp(gy + Math.sign(dy || 1) * novoAmp, 1, FW - 1)
            };
            if (Number.isFinite(target.z)) target.z = target.z;
          }
        }
      }
    } catch (_) {}
    return oldStartTravel.call(this, actor, target, kind, cb, receiver, travelKind, meta);
  };
}

P.getShotPlausibilityAudit = function () {
  const a = audit(this);
  return {
    version: VERSION,
    chutesVistos: a.chutesVistos,
    chutesForaComprimidos: a.comprimidos,
    amplitudeMediaAntes_m: a.comprimidos ? a.amplitudeAntesSoma / a.comprimidos : 0,
    amplitudeMediaDepois_m: a.comprimidos ? a.amplitudeDepoisSoma / a.comprimidos : 0,
    amplitudeMaximaAntes_m: a.amplitudeMaxAntes,
    poste_m: POST, faixaDeErro_m: [POST + ERRO_MIN, POST + ERRO_MAX]
  };
};

try {
  root.CDS_R1821_SHOT_PLAUSIBILITY = Object.freeze({
    version: VERSION, post: POST, erroMin: ERRO_MIN, erroMax: ERRO_MAX,
    outcomeChanged: false, rngUsed: false, statsChanged: false
  });
} catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
