# Laboratório estatístico — baseline30

- Partidas: **30**
- Motor: **4.0.0**
- Passo: **0.08s**
- Workers: **1**
- Tempo: **28.8s**
- Nota de calibração: **46.4/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 1.8667 | 2.4–3.2 | BAIXO |
| shotsPerMatch | 20.1000 | 20–30 | OK |
| xgPerMatch | 2.2439 | 2.3–3.5 | BAIXO |
| onTargetRate | 0.3400 | 0.34–0.47 | BAIXO |
| passCompletion | 0.8183 | 0.75–0.89 | OK |
| foulsPerMatch | 35.5667 | 16–28 | ALTO |
| yellowsPerMatch | 6.3667 | 2.4–5.6 | ALTO |
| redsPerMatch | 1.5000 | 0.06–0.3 | ALTO |
| cornersPerMatch | 4.7333 | 5–11.5 | BAIXO |
| drawRate | 0.4667 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.2667 | 0.045–0.12 | ALTO |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.1429 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1250 | 0.1–0.27 | OK |
| favoriteWinRate | 0.6000 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.0000 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 72.2019 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 4,
    "goalsPerMatch": 1.75,
    "shotsPerMatch": 20.5,
    "xgPerMatch": 1.8575260469313895,
    "onTargetRate": 0.3170731707317073,
    "passCompletion": 0.8207426376440461,
    "foulsPerMatch": 50.25,
    "yellowsPerMatch": 9,
    "redsPerMatch": 2.25,
    "cornersPerMatch": 5.5,
    "tacklesPerMatch": 104.75,
    "interceptionsPerMatch": 16.5,
    "drawRate": 0.5,
    "zeroZeroRate": 0.25,
    "blowoutRate": 0,
    "lateGoalShare": 0.2857142857142857,
    "setPieceGoalShare": 0.2857142857142857,
    "averageEndingStamina": 72.04287350748537,
    "averagePossessionA": 0.5169505108002227,
    "goalP50": 2,
    "goalP90": 2.7,
    "shotP90": 26.900000000000002,
    "maxGoals": 3,
    "scoreFrequency": {
      "1-1": 1,
      "0-0": 1,
      "0-2": 1,
      "1-2": 1
    },
    "paritySideAWinShare": 0
  },
  "random": {
    "name": "random",
    "games": 10,
    "goalsPerMatch": 1.7,
    "shotsPerMatch": 16.2,
    "xgPerMatch": 1.9445085079153202,
    "onTargetRate": 0.38271604938271603,
    "passCompletion": 0.8182242990654206,
    "foulsPerMatch": 29.6,
    "yellowsPerMatch": 5.4,
    "redsPerMatch": 1.4,
    "cornersPerMatch": 4,
    "tacklesPerMatch": 61.8,
    "interceptionsPerMatch": 13.3,
    "drawRate": 0.6,
    "zeroZeroRate": 0.4,
    "blowoutRate": 0,
    "lateGoalShare": 0.11764705882352941,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 72.68291522061604,
    "averagePossessionA": 0.513928766960937,
    "goalP50": 2,
    "goalP90": 3.0999999999999996,
    "shotP90": 20.4,
    "maxGoals": 4,
    "scoreFrequency": {
      "0-0": 4,
      "2-0": 1,
      "2-2": 1,
      "1-1": 1,
      "0-3": 1,
      "1-2": 1,
      "2-1": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 5,
    "goalsPerMatch": 2,
    "shotsPerMatch": 20.8,
    "xgPerMatch": 2.4113585979594485,
    "onTargetRate": 0.34615384615384615,
    "passCompletion": 0.7918250950570342,
    "foulsPerMatch": 32.4,
    "yellowsPerMatch": 6.6,
    "redsPerMatch": 0.8,
    "cornersPerMatch": 4.4,
    "tacklesPerMatch": 68.8,
    "interceptionsPerMatch": 17,
    "drawRate": 0.4,
    "zeroZeroRate": 0.2,
    "blowoutRate": 0,
    "lateGoalShare": 0.2,
    "setPieceGoalShare": 0.2,
    "averageEndingStamina": 71.82112505185523,
    "averagePossessionA": 0.49507894476726183,
    "goalP50": 2,
    "goalP90": 3.8000000000000003,
    "shotP90": 33.8,
    "maxGoals": 5,
    "scoreFrequency": {
      "1-0": 1,
      "2-3": 1,
      "0-0": 1,
      "1-1": 1,
      "2-0": 1
    },
    "favoriteWinRate": 0.6
  },
  "styles": {
    "name": "styles",
    "games": 5,
    "goalsPerMatch": 1.6,
    "shotsPerMatch": 21.6,
    "xgPerMatch": 1.9448947921511592,
    "onTargetRate": 0.25925925925925924,
    "passCompletion": 0.8363123236124177,
    "foulsPerMatch": 31.4,
    "yellowsPerMatch": 5.8,
    "redsPerMatch": 1.4,
    "cornersPerMatch": 5.2,
    "tacklesPerMatch": 68.8,
    "interceptionsPerMatch": 15.4,
    "drawRate": 0.2,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.125,
    "setPieceGoalShare": 0.25,
    "averageEndingStamina": 73.04065628736892,
    "averagePossessionA": 0.4634977139945824,
    "goalP50": 1,
    "goalP90": 2.6,
    "shotP90": 32,
    "maxGoals": 3,
    "scoreFrequency": {
      "1-0": 2,
      "0-1": 1,
      "1-2": 1,
      "1-1": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 6,
    "goalsPerMatch": 2.3333333333333335,
    "shotsPerMatch": 24.5,
    "xgPerMatch": 3.110051514766875,
    "onTargetRate": 0.36054421768707484,
    "passCompletion": 0.8243697478991596,
    "foulsPerMatch": 41.833333333333336,
    "yellowsPerMatch": 6.5,
    "redsPerMatch": 1.8333333333333333,
    "cornersPerMatch": 5.333333333333333,
    "tacklesPerMatch": 99.33333333333333,
    "interceptionsPerMatch": 14.166666666666666,
    "drawRate": 0.5,
    "zeroZeroRate": 0.3333333333333333,
    "blowoutRate": 0,
    "lateGoalShare": 0.07142857142857142,
    "setPieceGoalShare": 0.07142857142857142,
    "averageEndingStamina": 71.12447012581971,
    "averagePossessionA": 0.47659618073365095,
    "goalP50": 2.5,
    "goalP90": 4.5,
    "shotP90": 33,
    "maxGoals": 5,
    "scoreFrequency": {
      "0-0": 2,
      "1-3": 1,
      "1-1": 1,
      "2-3": 1,
      "3-0": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 1,
    "goalDelta": -1,
    "possessionDelta": 0.045169385194478995,
    "crossDelta": -1,
    "throughBallDelta": -11,
    "pressWinsDelta": 0,
    "staminaDelta": 1.0872846117297286,
    "shotsAllowedDelta": 7
  },
  "counter": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": 0.10381077529566296,
    "crossDelta": 0,
    "throughBallDelta": 4,
    "pressWinsDelta": -1,
    "staminaDelta": 2.544461471520691,
    "shotsAllowedDelta": 0
  },
  "press": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": 0.08997429305912552,
    "crossDelta": 6,
    "throughBallDelta": 0,
    "pressWinsDelta": 53,
    "staminaDelta": -4.956780194550902,
    "shotsAllowedDelta": 11
  },
  "direct": {
    "games": 1,
    "goalDelta": -1,
    "possessionDelta": -0.06415094339622612,
    "crossDelta": -1,
    "throughBallDelta": 3,
    "pressWinsDelta": 8,
    "staminaDelta": 1.6619966347142565,
    "shotsAllowedDelta": 0
  },
  "wings": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": -0.4605067064083428,
    "crossDelta": 0,
    "throughBallDelta": -5,
    "pressWinsDelta": -3,
    "staminaDelta": -4.854346052022748,
    "shotsAllowedDelta": 1
  }
}
```
