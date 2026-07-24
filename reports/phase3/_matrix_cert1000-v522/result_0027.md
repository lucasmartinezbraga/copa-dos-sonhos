# Laboratório estatístico — cert1000-v522-chunk-27

- Partidas: **25**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **107.5s**
- Nota de calibração: **71.4/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 3.3200 | 2.4–3.2 | ALTO |
| shotsPerMatch | 26.1200 | 20–30 | OK |
| xgPerMatch | 3.2894 | 2.3–3.5 | OK |
| onTargetRate | 0.3354 | 0.34–0.47 | BAIXO |
| passCompletion | 0.8228 | 0.75–0.89 | OK |
| foulsPerMatch | 23.6800 | 16–28 | OK |
| yellowsPerMatch | 3.6800 | 2.4–5.6 | OK |
| redsPerMatch | 0.1200 | 0.06–0.3 | OK |
| cornersPerMatch | 5.1600 | 5–11.5 | OK |
| drawRate | 0.3200 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0400 | 0.045–0.12 | BAIXO |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.0843 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1687 | 0.1–0.27 | OK |
| paritySideAWinShare | 0.6471 | 0.46–0.54 | ALTO |
| averageEndingStamina | 69.5470 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 25,
    "goalsPerMatch": 3.32,
    "shotsPerMatch": 26.12,
    "xgPerMatch": 3.289369621782348,
    "onTargetRate": 0.33537519142419603,
    "passCompletion": 0.8227826675693974,
    "foulsPerMatch": 23.68,
    "yellowsPerMatch": 3.68,
    "redsPerMatch": 0.12,
    "cornersPerMatch": 5.16,
    "tacklesPerMatch": 45.76,
    "interceptionsPerMatch": 16.76,
    "drawRate": 0.32,
    "zeroZeroRate": 0.04,
    "blowoutRate": 0,
    "lateGoalShare": 0.08433734939759036,
    "setPieceGoalShare": 0.1686746987951807,
    "averageEndingStamina": 69.54700827007261,
    "averagePossessionA": 0.5103905764481598,
    "goalP50": 3,
    "goalP90": 5.600000000000001,
    "shotP90": 29.6,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-1": 6,
      "1-2": 3,
      "2-1": 3,
      "3-0": 3,
      "4-1": 2,
      "0-3": 1,
      "3-3": 1,
      "3-4": 1,
      "0-0": 1,
      "5-2": 1,
      "3-1": 1,
      "2-0": 1,
      "2-3": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 3,
    "winRate": 1,
    "drawRate": 0,
    "goalDelta": 2,
    "xgDelta": 1.7318855496566767,
    "possessionDelta": 0.11513864582900078,
    "passCompletionDelta": 0.05696551691442079,
    "crossDelta": 2.3333333333333335,
    "throughBallDelta": -6.666666666666667,
    "pressWinsDelta": 3.3333333333333335,
    "staminaDelta": 0.5454670006695418,
    "shotsForDelta": 9.666666666666666,
    "shotsAllowedDelta": -9.666666666666666
  },
  "counter": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.75,
    "xgDelta": -0.6178004429142341,
    "possessionDelta": -0.09893521271016643,
    "passCompletionDelta": -0.050635044520686595,
    "crossDelta": -0.25,
    "throughBallDelta": 3.75,
    "pressWinsDelta": 1.75,
    "staminaDelta": 0.14993394591425968,
    "shotsForDelta": -0.25,
    "shotsAllowedDelta": 0.25
  },
  "press": {
    "games": 4,
    "winRate": 1,
    "drawRate": 0,
    "goalDelta": 1.5,
    "xgDelta": 1.7936198836683008,
    "possessionDelta": 0.044849910658360095,
    "passCompletionDelta": 0.004412310323340857,
    "crossDelta": 1.5,
    "throughBallDelta": 2.5,
    "pressWinsDelta": 15,
    "staminaDelta": -7.001952275892867,
    "shotsForDelta": 5.75,
    "shotsAllowedDelta": -5.75
  },
  "direct": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.5,
    "goalDelta": 0,
    "xgDelta": -0.044931290533660045,
    "possessionDelta": -0.0020521508252923093,
    "passCompletionDelta": -0.010078423625002025,
    "crossDelta": 0.25,
    "throughBallDelta": 3,
    "pressWinsDelta": 0.75,
    "staminaDelta": 0.5667188008046828,
    "shotsForDelta": 1.75,
    "shotsAllowedDelta": -1.75
  },
  "wings": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.25,
    "goalDelta": -1.25,
    "xgDelta": -0.30610570696324946,
    "possessionDelta": -0.06680472992254402,
    "passCompletionDelta": 0.010762262805651318,
    "crossDelta": 2.5,
    "throughBallDelta": -2.25,
    "pressWinsDelta": 0.25,
    "staminaDelta": 0.6453511688451954,
    "shotsForDelta": 1.75,
    "shotsAllowedDelta": -1.75
  },
  "balanced": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.5,
    "goalDelta": 0,
    "xgDelta": 0,
    "possessionDelta": 0,
    "passCompletionDelta": 0,
    "crossDelta": 0,
    "throughBallDelta": 0,
    "pressWinsDelta": 0,
    "staminaDelta": 0,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "park": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.5,
    "xgDelta": -0.7931551506646848,
    "possessionDelta": 0.052543053571331516,
    "passCompletionDelta": -0.015574661761882824,
    "crossDelta": -0.5,
    "throughBallDelta": 5,
    "pressWinsDelta": -4,
    "staminaDelta": 7.915643139448463,
    "shotsForDelta": -2,
    "shotsAllowedDelta": 2
  }
}
```
