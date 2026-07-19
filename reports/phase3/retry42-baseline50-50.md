# Laboratório estatístico — retry42-baseline50

- Partidas: **50**
- Motor: **4.2.0**
- Passo: **0.016666666666666666s**
- Workers: **0**
- Tempo: **0.0s**
- Nota de calibração: **71.9/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.5000 | 2.4–3.2 | OK |
| shotsPerMatch | 22.7200 | 20–30 | OK |
| xgPerMatch | 2.6704 | 2.3–3.5 | OK |
| onTargetRate | 0.3636 | 0.34–0.47 | OK |
| passCompletion | 0.8056 | 0.75–0.89 | OK |
| foulsPerMatch | 24.1000 | 16–28 | OK |
| yellowsPerMatch | 4.1600 | 2.4–5.6 | OK |
| redsPerMatch | 0.1400 | 0.06–0.3 | OK |
| cornersPerMatch | 4.6000 | 5–11.5 | BAIXO |
| drawRate | 0.4000 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1200 | 0.045–0.12 | OK |
| blowoutRate | 0.0600 | 0.025–0.13 | OK |
| lateGoalShare | 0.1760 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.0880 | 0.1–0.27 | BAIXO |
| favoriteWinRate | 0.5000 | 0.6–0.79 | BAIXO |
| paritySideAWinShare | 0.0000 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 70.5378 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 7,
    "goalsPerMatch": 2.5714285714285716,
    "shotsPerMatch": 24.571428571428573,
    "xgPerMatch": 2.7945453189461147,
    "onTargetRate": 0.38372093023255816,
    "passCompletion": 0.8081180811808119,
    "foulsPerMatch": 22.857142857142858,
    "yellowsPerMatch": 3.857142857142857,
    "redsPerMatch": 0,
    "cornersPerMatch": 5.142857142857143,
    "tacklesPerMatch": 54.285714285714285,
    "interceptionsPerMatch": 18.285714285714285,
    "drawRate": 0.5714285714285714,
    "zeroZeroRate": 0.14285714285714285,
    "blowoutRate": 0.14285714285714285,
    "lateGoalShare": 0.2222222222222222,
    "setPieceGoalShare": 0.16666666666666666,
    "averageEndingStamina": 70.78714693868382,
    "averagePossessionA": 0.4847611732427225,
    "goalP50": 3,
    "goalP90": 4,
    "shotP90": 33.400000000000006,
    "maxGoals": 4,
    "scoreFrequency": {
      "2-2": 2,
      "1-1": 1,
      "0-1": 1,
      "0-4": 1,
      "1-2": 1,
      "0-0": 1
    },
    "paritySideAWinShare": 0
  },
  "random": {
    "name": "random",
    "games": 17,
    "goalsPerMatch": 2.3529411764705883,
    "shotsPerMatch": 20.764705882352942,
    "xgPerMatch": 2.505267303575218,
    "onTargetRate": 0.3881019830028329,
    "passCompletion": 0.7920443101711984,
    "foulsPerMatch": 28,
    "yellowsPerMatch": 4.294117647058823,
    "redsPerMatch": 0.058823529411764705,
    "cornersPerMatch": 4.882352941176471,
    "tacklesPerMatch": 58.1764705882353,
    "interceptionsPerMatch": 20.58823529411765,
    "drawRate": 0.35294117647058826,
    "zeroZeroRate": 0.058823529411764705,
    "blowoutRate": 0.058823529411764705,
    "lateGoalShare": 0.2,
    "setPieceGoalShare": 0.1,
    "averageEndingStamina": 70.23256422786285,
    "averagePossessionA": 0.5013237983833632,
    "goalP50": 2,
    "goalP90": 4,
    "shotP90": 31.000000000000004,
    "maxGoals": 4,
    "scoreFrequency": {
      "0-1": 3,
      "2-2": 3,
      "1-1": 2,
      "1-0": 2,
      "0-4": 1,
      "3-0": 1,
      "2-0": 1,
      "1-2": 1,
      "0-0": 1,
      "3-1": 1,
      "2-1": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 8,
    "goalsPerMatch": 2.125,
    "shotsPerMatch": 21.125,
    "xgPerMatch": 2.489429256511738,
    "onTargetRate": 0.3668639053254438,
    "passCompletion": 0.8073836276083467,
    "foulsPerMatch": 17.875,
    "yellowsPerMatch": 3.5,
    "redsPerMatch": 0.375,
    "cornersPerMatch": 3.5,
    "tacklesPerMatch": 43,
    "interceptionsPerMatch": 19.25,
    "drawRate": 0.5,
    "zeroZeroRate": 0.375,
    "blowoutRate": 0.125,
    "lateGoalShare": 0.11764705882352941,
    "setPieceGoalShare": 0.058823529411764705,
    "averageEndingStamina": 71.56232018540399,
    "averagePossessionA": 0.4180684484224421,
    "goalP50": 1.5,
    "goalP90": 5,
    "shotP90": 28.9,
    "maxGoals": 5,
    "scoreFrequency": {
      "0-0": 3,
      "4-1": 1,
      "1-1": 1,
      "2-3": 1,
      "4-0": 1,
      "0-1": 1
    },
    "favoriteWinRate": 0.5
  },
  "styles": {
    "name": "styles",
    "games": 9,
    "goalsPerMatch": 1.8888888888888888,
    "shotsPerMatch": 22.22222222222222,
    "xgPerMatch": 2.089869438845154,
    "onTargetRate": 0.3,
    "passCompletion": 0.8349881796690307,
    "foulsPerMatch": 19.22222222222222,
    "yellowsPerMatch": 3.888888888888889,
    "redsPerMatch": 0.1111111111111111,
    "cornersPerMatch": 3.6666666666666665,
    "tacklesPerMatch": 39.22222222222222,
    "interceptionsPerMatch": 14.444444444444445,
    "drawRate": 0.4444444444444444,
    "zeroZeroRate": 0.1111111111111111,
    "blowoutRate": 0,
    "lateGoalShare": 0.058823529411764705,
    "setPieceGoalShare": 0.11764705882352941,
    "averageEndingStamina": 72.04851518085998,
    "averagePossessionA": 0.44587395568441845,
    "goalP50": 2,
    "goalP90": 4,
    "shotP90": 35,
    "maxGoals": 4,
    "scoreFrequency": {
      "0-1": 3,
      "1-1": 2,
      "3-1": 1,
      "0-0": 1,
      "2-2": 1,
      "2-0": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 9,
    "goalsPerMatch": 3.6666666666666665,
    "shotsPerMatch": 26.88888888888889,
    "xgPerMatch": 3.627351117112499,
    "onTargetRate": 0.36363636363636365,
    "passCompletion": 0.7980769230769231,
    "foulsPerMatch": 28.11111111111111,
    "yellowsPerMatch": 5,
    "redsPerMatch": 0.2222222222222222,
    "cornersPerMatch": 5.555555555555555,
    "tacklesPerMatch": 60.111111111111114,
    "interceptionsPerMatch": 20.333333333333332,
    "drawRate": 0.2222222222222222,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.21212121212121213,
    "setPieceGoalShare": 0.030303030303030304,
    "averageEndingStamina": 68.49927363581217,
    "averagePossessionA": 0.4771370718746161,
    "goalP50": 3,
    "goalP90": 6,
    "shotP90": 31.6,
    "maxGoals": 6,
    "scoreFrequency": {
      "3-3": 2,
      "1-2": 2,
      "1-3": 2,
      "0-3": 1,
      "2-0": 1,
      "0-2": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 2,
    "goalDelta": 0.5,
    "possessionDelta": 0.13534584576922748,
    "passCompletionDelta": 0.03529223137066273,
    "crossDelta": 0,
    "throughBallDelta": -3,
    "pressWinsDelta": 0,
    "staminaDelta": 2.740953446112009,
    "shotsForDelta": 1.5,
    "shotsAllowedDelta": -1.5
  },
  "counter": {
    "games": 2,
    "goalDelta": 1.5,
    "possessionDelta": 0.04624985950190513,
    "passCompletionDelta": 0.005332167832167833,
    "crossDelta": -0.5,
    "throughBallDelta": 14,
    "pressWinsDelta": -6,
    "staminaDelta": 5.920265971020946,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  },
  "press": {
    "games": 1,
    "goalDelta": 2,
    "possessionDelta": -0.021826165568900602,
    "passCompletionDelta": 0.030753255052320405,
    "crossDelta": -3,
    "throughBallDelta": -4,
    "pressWinsDelta": 24,
    "staminaDelta": -4.622015768392686,
    "shotsForDelta": 7,
    "shotsAllowedDelta": -7
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
