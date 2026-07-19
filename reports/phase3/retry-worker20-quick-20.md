# Laboratório estatístico — retry-worker20

- Partidas: **20**
- Motor: **4.1.0**
- Passo: **0.08s**
- Workers: **2**
- Tempo: **13.2s**
- Nota de calibração: **72.7/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.5500 | 2.4–3.2 | OK |
| shotsPerMatch | 22.6000 | 20–30 | OK |
| xgPerMatch | 2.6396 | 2.3–3.5 | OK |
| onTargetRate | 0.3584 | 0.34–0.47 | OK |
| passCompletion | 0.8158 | 0.75–0.89 | OK |
| foulsPerMatch | 22.6500 | 16–28 | OK |
| yellowsPerMatch | 3.4500 | 2.4–5.6 | OK |
| redsPerMatch | 0.2500 | 0.06–0.3 | OK |
| cornersPerMatch | 5.0000 | 5–11.5 | OK |
| drawRate | 0.4500 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1000 | 0.045–0.12 | OK |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.0588 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1176 | 0.1–0.27 | OK |
| favoriteWinRate | 1.0000 | 0.6–0.79 | ALTO |
| paritySideAWinShare | 0.5000 | 0.46–0.54 | OK |
| averageEndingStamina | 70.9914 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 3,
    "goalsPerMatch": 3.3333333333333335,
    "shotsPerMatch": 30.333333333333332,
    "xgPerMatch": 3.7454515670312865,
    "onTargetRate": 0.32967032967032966,
    "passCompletion": 0.8135048231511254,
    "foulsPerMatch": 27.666666666666668,
    "yellowsPerMatch": 4.333333333333333,
    "redsPerMatch": 0.3333333333333333,
    "cornersPerMatch": 7.333333333333333,
    "tacklesPerMatch": 64,
    "interceptionsPerMatch": 17,
    "drawRate": 1,
    "zeroZeroRate": 0.3333333333333333,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0.2,
    "averageEndingStamina": 68.30956249637609,
    "averagePossessionA": 0.5105005254882927,
    "goalP50": 2,
    "goalP90": 6.800000000000001,
    "shotP90": 39.6,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 1,
      "0-0": 1,
      "4-4": 1
    },
    "paritySideAWinShare": 0.5
  },
  "random": {
    "name": "random",
    "games": 6,
    "goalsPerMatch": 1.6666666666666667,
    "shotsPerMatch": 24,
    "xgPerMatch": 2.3660418892040083,
    "onTargetRate": 0.2986111111111111,
    "passCompletion": 0.818997756170531,
    "foulsPerMatch": 22.833333333333332,
    "yellowsPerMatch": 3.8333333333333335,
    "redsPerMatch": 0.16666666666666666,
    "cornersPerMatch": 4.5,
    "tacklesPerMatch": 36.5,
    "interceptionsPerMatch": 16,
    "drawRate": 0.5,
    "zeroZeroRate": 0.16666666666666666,
    "blowoutRate": 0,
    "lateGoalShare": 0.1,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 72.20974440793297,
    "averagePossessionA": 0.5126302754001296,
    "goalP50": 2,
    "goalP90": 2.5,
    "shotP90": 29.5,
    "maxGoals": 3,
    "scoreFrequency": {
      "1-1": 2,
      "1-2": 1,
      "0-0": 1,
      "2-0": 1,
      "1-0": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 3,
    "goalsPerMatch": 2.6666666666666665,
    "shotsPerMatch": 18.666666666666668,
    "xgPerMatch": 2.0776131758699568,
    "onTargetRate": 0.42857142857142855,
    "passCompletion": 0.8270676691729323,
    "foulsPerMatch": 29,
    "yellowsPerMatch": 3.6666666666666665,
    "redsPerMatch": 0,
    "cornersPerMatch": 5,
    "tacklesPerMatch": 46.666666666666664,
    "interceptionsPerMatch": 18.333333333333332,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0.25,
    "averageEndingStamina": 71.52567535490114,
    "averagePossessionA": 0.4625044979357535,
    "goalP50": 3,
    "goalP90": 3,
    "shotP90": 21.8,
    "maxGoals": 3,
    "scoreFrequency": {
      "3-0": 1,
      "0-2": 1,
      "2-1": 1
    },
    "favoriteWinRate": 1
  },
  "styles": {
    "name": "styles",
    "games": 3,
    "goalsPerMatch": 3.6666666666666665,
    "shotsPerMatch": 23.333333333333332,
    "xgPerMatch": 3.169994959059214,
    "onTargetRate": 0.44285714285714284,
    "passCompletion": 0.8285280728376327,
    "foulsPerMatch": 17,
    "yellowsPerMatch": 3,
    "redsPerMatch": 0.3333333333333333,
    "cornersPerMatch": 6.333333333333333,
    "tacklesPerMatch": 44,
    "interceptionsPerMatch": 13.666666666666666,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0.09090909090909091,
    "averageEndingStamina": 70.95107581648286,
    "averagePossessionA": 0.521533404162768,
    "goalP50": 4,
    "goalP90": 4.8,
    "shotP90": 24.6,
    "maxGoals": 5,
    "scoreFrequency": {
      "2-3": 1,
      "0-2": 1,
      "2-2": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 5,
    "goalsPerMatch": 2.4,
    "shotsPerMatch": 18.2,
    "xgPerMatch": 2.3234656882187337,
    "onTargetRate": 0.37362637362637363,
    "passCompletion": 0.7991031390134529,
    "foulsPerMatch": 19,
    "yellowsPerMatch": 2.6,
    "redsPerMatch": 0.4,
    "cornersPerMatch": 3.4,
    "tacklesPerMatch": 50.6,
    "interceptionsPerMatch": 22.4,
    "drawRate": 0.4,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.16666666666666666,
    "setPieceGoalShare": 0.08333333333333333,
    "averageEndingStamina": 70.84201125417061,
    "averagePossessionA": 0.5203604354127789,
    "goalP50": 2,
    "goalP90": 3.6,
    "shotP90": 25.4,
    "maxGoals": 4,
    "scoreFrequency": {
      "1-1": 2,
      "1-3": 1,
      "1-0": 1,
      "2-1": 1
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
    "possessionDelta": -0.03378864126527659,
    "passCompletionDelta": -0.09079696394686909,
    "crossDelta": -9,
    "throughBallDelta": 8,
    "pressWinsDelta": 9,
    "staminaDelta": -3.3920294021327777,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  },
  "counter": {
    "games": 1,
    "goalDelta": 2,
    "possessionDelta": 0.07350216182828867,
    "passCompletionDelta": -0.07561683599419455,
    "crossDelta": 1,
    "throughBallDelta": 16,
    "pressWinsDelta": -6,
    "staminaDelta": 6.407183424229672,
    "shotsForDelta": -6,
    "shotsAllowedDelta": 6
  },
  "press": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": 0.23649122807017392,
    "passCompletionDelta": -0.00679117147707986,
    "crossDelta": 0,
    "throughBallDelta": -6,
    "pressWinsDelta": 8,
    "staminaDelta": -3.9473045055564455,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  }
}
```
