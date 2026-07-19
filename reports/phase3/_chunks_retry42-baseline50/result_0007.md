# Laboratório estatístico — retry42-baseline50

- Partidas: **5**
- Motor: **4.2.0**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **21.5s**
- Nota de calibração: **51.5/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 1.6000 | 2.4–3.2 | BAIXO |
| shotsPerMatch | 19.8000 | 20–30 | BAIXO |
| xgPerMatch | 1.6861 | 2.3–3.5 | BAIXO |
| onTargetRate | 0.3131 | 0.34–0.47 | BAIXO |
| passCompletion | 0.8387 | 0.75–0.89 | OK |
| foulsPerMatch | 14.8000 | 16–28 | BAIXO |
| yellowsPerMatch | 3.0000 | 2.4–5.6 | OK |
| redsPerMatch | 0.2000 | 0.06–0.3 | OK |
| cornersPerMatch | 3.8000 | 5–11.5 | BAIXO |
| drawRate | 0.6000 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.2000 | 0.045–0.12 | ALTO |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.1250 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1250 | 0.1–0.27 | OK |
| averageEndingStamina | 73.5735 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 5,
    "goalsPerMatch": 1.6,
    "shotsPerMatch": 19.8,
    "xgPerMatch": 1.6861169379743948,
    "onTargetRate": 0.31313131313131315,
    "passCompletion": 0.8387096774193549,
    "foulsPerMatch": 14.8,
    "yellowsPerMatch": 3,
    "redsPerMatch": 0.2,
    "cornersPerMatch": 3.8,
    "tacklesPerMatch": 29.6,
    "interceptionsPerMatch": 11.4,
    "drawRate": 0.6,
    "zeroZeroRate": 0.2,
    "blowoutRate": 0,
    "lateGoalShare": 0.125,
    "setPieceGoalShare": 0.125,
    "averageEndingStamina": 73.57347866676741,
    "averagePossessionA": 0.409500732861909,
    "goalP50": 1,
    "goalP90": 3.2,
    "shotP90": 32.4,
    "maxGoals": 4,
    "scoreFrequency": {
      "0-1": 2,
      "1-1": 1,
      "0-0": 1,
      "2-2": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": 0.47011596788580334,
    "passCompletionDelta": 0.07282913165266103,
    "crossDelta": -2,
    "throughBallDelta": -4,
    "pressWinsDelta": 0,
    "staminaDelta": 9.387498446449285,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  },
  "direct": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": -0.12714386959602847,
    "passCompletionDelta": -0.07408354646206317,
    "crossDelta": 0,
    "throughBallDelta": 4,
    "pressWinsDelta": 4,
    "staminaDelta": -5.7092658986596945,
    "shotsForDelta": 2,
    "shotsAllowedDelta": -2
  },
  "wings": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": -0.49414847161570735,
    "passCompletionDelta": -0.011048074051955847,
    "crossDelta": 2,
    "throughBallDelta": 1,
    "pressWinsDelta": 3,
    "staminaDelta": -10.74166308783559,
    "shotsForDelta": 2,
    "shotsAllowedDelta": -2
  },
  "balanced": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": 0.07510101713807837,
    "passCompletionDelta": 0.016905974988420613,
    "crossDelta": -2,
    "throughBallDelta": 2,
    "pressWinsDelta": 1,
    "staminaDelta": 0.8165016660836812,
    "shotsForDelta": -10,
    "shotsAllowedDelta": 10
  },
  "park": {
    "games": 1,
    "goalDelta": -1,
    "possessionDelta": 0.0072289156626504925,
    "passCompletionDelta": 0.03952603355820794,
    "crossDelta": -12,
    "throughBallDelta": 11,
    "pressWinsDelta": -8,
    "staminaDelta": 0.45354824599338883,
    "shotsForDelta": -10,
    "shotsAllowedDelta": 10
  }
}
```
