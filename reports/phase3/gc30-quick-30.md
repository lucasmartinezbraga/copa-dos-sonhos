# Laboratório estatístico — gc30

- Partidas: **30**
- Motor: **4.1.0**
- Passo: **0.08s**
- Workers: **1**
- Tempo: **32.7s**
- Nota de calibração: **77.0/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.7000 | 2.4–3.2 | OK |
| shotsPerMatch | 23.2333 | 20–30 | OK |
| xgPerMatch | 2.7274 | 2.3–3.5 | OK |
| onTargetRate | 0.3472 | 0.34–0.47 | OK |
| passCompletion | 0.8103 | 0.75–0.89 | OK |
| foulsPerMatch | 16.5333 | 16–28 | OK |
| yellowsPerMatch | 2.8000 | 2.4–5.6 | OK |
| redsPerMatch | 0.3000 | 0.06–0.3 | OK |
| cornersPerMatch | 4.7000 | 5–11.5 | BAIXO |
| drawRate | 0.3667 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.2000 | 0.045–0.12 | ALTO |
| blowoutRate | 0.0667 | 0.025–0.13 | OK |
| lateGoalShare | 0.1605 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1235 | 0.1–0.27 | OK |
| favoriteWinRate | 1.0000 | 0.6–0.79 | ALTO |
| paritySideAWinShare | 0.5000 | 0.46–0.54 | OK |
| averageEndingStamina | 70.9431 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 4,
    "goalsPerMatch": 2.5,
    "shotsPerMatch": 30,
    "xgPerMatch": 3.2662778144913105,
    "onTargetRate": 0.325,
    "passCompletion": 0.8161592505854801,
    "foulsPerMatch": 24.75,
    "yellowsPerMatch": 3.5,
    "redsPerMatch": 0.25,
    "cornersPerMatch": 7.75,
    "tacklesPerMatch": 54.25,
    "interceptionsPerMatch": 18,
    "drawRate": 1,
    "zeroZeroRate": 0.5,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0.2,
    "averageEndingStamina": 69.61253426167437,
    "averagePossessionA": 0.511526730349905,
    "goalP50": 1,
    "goalP90": 6.200000000000001,
    "shotP90": 38.800000000000004,
    "maxGoals": 8,
    "scoreFrequency": {
      "0-0": 2,
      "1-1": 1,
      "4-4": 1
    },
    "paritySideAWinShare": 0.5
  },
  "random": {
    "name": "random",
    "games": 10,
    "goalsPerMatch": 1.7,
    "shotsPerMatch": 17,
    "xgPerMatch": 1.9393436490687304,
    "onTargetRate": 0.36470588235294116,
    "passCompletion": 0.800451467268623,
    "foulsPerMatch": 14.7,
    "yellowsPerMatch": 2.4,
    "redsPerMatch": 0.3,
    "cornersPerMatch": 3.6,
    "tacklesPerMatch": 32.2,
    "interceptionsPerMatch": 16.9,
    "drawRate": 0.3,
    "zeroZeroRate": 0.2,
    "blowoutRate": 0,
    "lateGoalShare": 0.11764705882352941,
    "setPieceGoalShare": 0.058823529411764705,
    "averageEndingStamina": 71.99298638219811,
    "averagePossessionA": 0.4853628424739423,
    "goalP50": 1,
    "goalP90": 3.1999999999999993,
    "shotP90": 21.4,
    "maxGoals": 5,
    "scoreFrequency": {
      "0-1": 2,
      "1-0": 2,
      "0-0": 2,
      "3-2": 1,
      "0-3": 1,
      "1-1": 1,
      "2-1": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 5,
    "goalsPerMatch": 4.2,
    "shotsPerMatch": 28.2,
    "xgPerMatch": 3.875388695555769,
    "onTargetRate": 0.3900709219858156,
    "passCompletion": 0.8149532710280374,
    "foulsPerMatch": 16.8,
    "yellowsPerMatch": 4,
    "redsPerMatch": 0.8,
    "cornersPerMatch": 5.6,
    "tacklesPerMatch": 35.8,
    "interceptionsPerMatch": 16.2,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0.4,
    "lateGoalShare": 0.14285714285714285,
    "setPieceGoalShare": 0.09523809523809523,
    "averageEndingStamina": 71.36591260666903,
    "averagePossessionA": 0.48177594526218764,
    "goalP50": 3,
    "goalP90": 8,
    "shotP90": 38.6,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-0": 1,
      "0-8": 1,
      "3-0": 1,
      "0-1": 1,
      "7-1": 1
    },
    "favoriteWinRate": 1
  },
  "styles": {
    "name": "styles",
    "games": 5,
    "goalsPerMatch": 2,
    "shotsPerMatch": 20.4,
    "xgPerMatch": 2.242976116123097,
    "onTargetRate": 0.29411764705882354,
    "passCompletion": 0.8369565217391305,
    "foulsPerMatch": 11.2,
    "yellowsPerMatch": 1.4,
    "redsPerMatch": 0,
    "cornersPerMatch": 3.6,
    "tacklesPerMatch": 31.6,
    "interceptionsPerMatch": 13.6,
    "drawRate": 0.6,
    "zeroZeroRate": 0.4,
    "blowoutRate": 0,
    "lateGoalShare": 0.4,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 71.25070364105238,
    "averagePossessionA": 0.4527183127468441,
    "goalP50": 1,
    "goalP90": 4.800000000000001,
    "shotP90": 28,
    "maxGoals": 6,
    "scoreFrequency": {
      "0-0": 2,
      "3-3": 1,
      "1-2": 1,
      "0-1": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 6,
    "goalsPerMatch": 3.8333333333333335,
    "shotsPerMatch": 27.333333333333332,
    "xgPerMatch": 3.1286962064894577,
    "onTargetRate": 0.34146341463414637,
    "passCompletion": 0.7969348659003831,
    "foulsPerMatch": 18.333333333333332,
    "yellowsPerMatch": 3.1666666666666665,
    "redsPerMatch": 0.16666666666666666,
    "cornersPerMatch": 4.666666666666667,
    "tacklesPerMatch": 37.666666666666664,
    "interceptionsPerMatch": 21,
    "drawRate": 0.16666666666666666,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.17391304347826086,
    "setPieceGoalShare": 0.21739130434782608,
    "averageEndingStamina": 69.47157697523392,
    "averagePossessionA": 0.4877789935516991,
    "goalP50": 4,
    "goalP90": 5.5,
    "shotP90": 39.5,
    "maxGoals": 6,
    "scoreFrequency": {
      "2-3": 2,
      "0-2": 1,
      "2-1": 1,
      "1-1": 1,
      "4-2": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": 0.026485325697924,
    "passCompletionDelta": 0.03126976319302932,
    "crossDelta": 1,
    "throughBallDelta": -4,
    "pressWinsDelta": -2,
    "staminaDelta": 0.5853111075678896,
    "shotsForDelta": 6,
    "shotsAllowedDelta": -6
  },
  "counter": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": 0.05698005698005665,
    "passCompletionDelta": -0.045401337792642105,
    "crossDelta": -5,
    "throughBallDelta": 9,
    "pressWinsDelta": 0,
    "staminaDelta": 2.408632863460298,
    "shotsForDelta": -2,
    "shotsAllowedDelta": 2
  },
  "press": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": -0.07572815533980543,
    "passCompletionDelta": 0.040082644628099184,
    "crossDelta": 1,
    "throughBallDelta": -6,
    "pressWinsDelta": 13,
    "staminaDelta": -9.307003366001581,
    "shotsForDelta": 7,
    "shotsAllowedDelta": -7
  },
  "direct": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": 0.08700564971751373,
    "passCompletionDelta": 0.01400560224089642,
    "crossDelta": 0,
    "throughBallDelta": -3,
    "pressWinsDelta": -6,
    "staminaDelta": -0.7609541345653383,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "wings": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": -0.27958833619210766,
    "passCompletionDelta": -0.01769829503335807,
    "crossDelta": 2,
    "throughBallDelta": 1,
    "pressWinsDelta": -2,
    "staminaDelta": -3.1525651899933678,
    "shotsForDelta": 5,
    "shotsAllowedDelta": -5
  }
}
```
