# Laboratório estatístico — cert1000-v522-chunk-32

- Partidas: **25**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **161.6s**
- Nota de calibração: **75.6/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.3600 | 2.4–3.2 | BAIXO |
| shotsPerMatch | 23.7200 | 20–30 | OK |
| xgPerMatch | 2.8117 | 2.3–3.5 | OK |
| onTargetRate | 0.3558 | 0.34–0.47 | OK |
| passCompletion | 0.8215 | 0.75–0.89 | OK |
| foulsPerMatch | 19.1200 | 16–28 | OK |
| yellowsPerMatch | 2.8800 | 2.4–5.6 | OK |
| redsPerMatch | 0.1600 | 0.06–0.3 | OK |
| cornersPerMatch | 4.0400 | 5–11.5 | BAIXO |
| drawRate | 0.3200 | 0.2–0.33 | OK |
| zeroZeroRate | 0.1600 | 0.045–0.12 | ALTO |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.2203 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.2034 | 0.1–0.27 | OK |
| paritySideAWinShare | 0.5882 | 0.46–0.54 | ALTO |
| averageEndingStamina | 70.1744 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 25,
    "goalsPerMatch": 2.36,
    "shotsPerMatch": 23.72,
    "xgPerMatch": 2.811743785635321,
    "onTargetRate": 0.35581787521079256,
    "passCompletion": 0.8215192014887498,
    "foulsPerMatch": 19.12,
    "yellowsPerMatch": 2.88,
    "redsPerMatch": 0.16,
    "cornersPerMatch": 4.04,
    "tacklesPerMatch": 39.92,
    "interceptionsPerMatch": 17.4,
    "drawRate": 0.32,
    "zeroZeroRate": 0.16,
    "blowoutRate": 0,
    "lateGoalShare": 0.22033898305084745,
    "setPieceGoalShare": 0.2033898305084746,
    "averageEndingStamina": 70.1743797974746,
    "averagePossessionA": 0.5231025511763849,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 31,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-0": 7,
      "0-0": 4,
      "1-2": 3,
      "2-3": 2,
      "4-2": 2,
      "2-2": 2,
      "1-1": 2,
      "0-2": 1,
      "1-3": 1,
      "2-1": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 4,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.5,
    "xgDelta": -0.08614220937791311,
    "possessionDelta": 0.15484228986896326,
    "passCompletionDelta": 0.03174322108198668,
    "crossDelta": 0,
    "throughBallDelta": -0.25,
    "pressWinsDelta": -0.75,
    "staminaDelta": 2.0794106075077963,
    "shotsForDelta": -1.5,
    "shotsAllowedDelta": 1.5
  },
  "counter": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.25,
    "goalDelta": -0.5,
    "xgDelta": -0.1309102383777624,
    "possessionDelta": -0.1335539787485334,
    "passCompletionDelta": -0.05677591420669725,
    "crossDelta": -0.5,
    "throughBallDelta": 6,
    "pressWinsDelta": -3.25,
    "staminaDelta": 1.7017254163648765,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "press": {
    "games": 4,
    "winRate": 0.75,
    "drawRate": 0.25,
    "goalDelta": 1.25,
    "xgDelta": 0.782952462733196,
    "possessionDelta": 0.10290206442290659,
    "passCompletionDelta": 0.03519558126038752,
    "crossDelta": 1,
    "throughBallDelta": -5.75,
    "pressWinsDelta": 14.5,
    "staminaDelta": -7.554238145485169,
    "shotsForDelta": 4.25,
    "shotsAllowedDelta": -4.25
  },
  "direct": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.25,
    "goalDelta": -0.25,
    "xgDelta": 0.09957956196568474,
    "possessionDelta": 0.04351393187456627,
    "passCompletionDelta": -0.0008876454145599344,
    "crossDelta": 1.5,
    "throughBallDelta": 0,
    "pressWinsDelta": 1.25,
    "staminaDelta": 0.17407038755230886,
    "shotsForDelta": -0.25,
    "shotsAllowedDelta": 0.25
  },
  "wings": {
    "games": 4,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.5,
    "xgDelta": 0.7104917212474415,
    "possessionDelta": -0.012601972291423028,
    "passCompletionDelta": -0.005892625950956326,
    "crossDelta": 1.5,
    "throughBallDelta": -5,
    "pressWinsDelta": 0.25,
    "staminaDelta": 2.0619480396999066,
    "shotsForDelta": 4,
    "shotsAllowedDelta": -4
  },
  "balanced": {
    "games": 3,
    "winRate": 0.3333333333333333,
    "drawRate": 0.3333333333333333,
    "goalDelta": 0,
    "xgDelta": 0.5875218333101395,
    "possessionDelta": 0.06646303523954801,
    "passCompletionDelta": 0.017608517608517598,
    "crossDelta": 0.3333333333333333,
    "throughBallDelta": -5,
    "pressWinsDelta": 1.6666666666666667,
    "staminaDelta": 1.3759888661553248,
    "shotsForDelta": 0.6666666666666666,
    "shotsAllowedDelta": -0.6666666666666666
  },
  "park": {
    "games": 2,
    "winRate": 1,
    "drawRate": 0,
    "goalDelta": 1.5,
    "xgDelta": -0.18232984944980313,
    "possessionDelta": -0.009143611395496631,
    "passCompletionDelta": -0.003742314164277505,
    "crossDelta": 1,
    "throughBallDelta": 0.5,
    "pressWinsDelta": -1,
    "staminaDelta": 9.006000459237114,
    "shotsForDelta": 0.5,
    "shotsAllowedDelta": -0.5
  }
}
```
