# Laboratório estatístico — validation214-v432-final2

- Partidas: **214**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **0**
- Tempo: **0.0s**
- Nota de calibração: **93.1/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.9019 | 2.4–3.2 | OK |
| shotsPerMatch | 22.5841 | 20–30 | OK |
| xgPerMatch | 2.8291 | 2.3–3.5 | OK |
| onTargetRate | 0.3927 | 0.34–0.47 | OK |
| passCompletion | 0.8138 | 0.75–0.89 | OK |
| foulsPerMatch | 22.9533 | 16–28 | OK |
| yellowsPerMatch | 3.8645 | 2.4–5.6 | OK |
| redsPerMatch | 0.2664 | 0.06–0.3 | OK |
| cornersPerMatch | 5.8972 | 5–11.5 | OK |
| drawRate | 0.2617 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0654 | 0.045–0.12 | OK |
| blowoutRate | 0.0561 | 0.025–0.13 | OK |
| lateGoalShare | 0.2013 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1272 | 0.1–0.27 | OK |
| favoriteWinRate | 0.7500 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.5000 | 0.46–0.54 | OK |
| averageEndingStamina | 71.1715 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 30,
    "goalsPerMatch": 3.3333333333333335,
    "shotsPerMatch": 27.9,
    "xgPerMatch": 3.4703125445941425,
    "onTargetRate": 0.3859020310633214,
    "passCompletion": 0.8170436761986057,
    "foulsPerMatch": 22.633333333333333,
    "yellowsPerMatch": 3.8666666666666667,
    "redsPerMatch": 0.3,
    "cornersPerMatch": 6.666666666666667,
    "tacklesPerMatch": 49.9,
    "interceptionsPerMatch": 17.033333333333335,
    "drawRate": 0.16666666666666666,
    "zeroZeroRate": 0.03333333333333333,
    "blowoutRate": 0.03333333333333333,
    "lateGoalShare": 0.18,
    "setPieceGoalShare": 0.1,
    "averageEndingStamina": 71.80182810891738,
    "averagePossessionA": 0.5030421613477939,
    "goalP50": 3,
    "goalP90": 7,
    "shotP90": 43.1,
    "maxGoals": 8,
    "scoreFrequency": {
      "2-1": 4,
      "3-1": 4,
      "0-1": 3,
      "1-1": 3,
      "0-2": 2,
      "2-0": 2,
      "1-2": 2,
      "4-1": 1,
      "3-0": 1,
      "4-4": 1,
      "2-5": 1,
      "1-0": 1,
      "4-3": 1,
      "6-2": 1,
      "0-0": 1,
      "3-2": 1
    },
    "paritySideAWinShare": 0.64
  },
  "random": {
    "name": "random",
    "games": 40,
    "goalsPerMatch": 2.625,
    "shotsPerMatch": 18.625,
    "xgPerMatch": 2.4554858279530833,
    "onTargetRate": 0.38791946308724834,
    "passCompletion": 0.8079385403329066,
    "foulsPerMatch": 23.525,
    "yellowsPerMatch": 4.525,
    "redsPerMatch": 0.35,
    "cornersPerMatch": 4.875,
    "tacklesPerMatch": 51.325,
    "interceptionsPerMatch": 19.375,
    "drawRate": 0.275,
    "zeroZeroRate": 0.1,
    "blowoutRate": 0.075,
    "lateGoalShare": 0.20952380952380953,
    "setPieceGoalShare": 0.10476190476190476,
    "averageEndingStamina": 71.2256206690639,
    "averagePossessionA": 0.4941737478679139,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 25.1,
    "maxGoals": 8,
    "scoreFrequency": {
      "2-1": 6,
      "1-1": 6,
      "0-1": 5,
      "0-0": 4,
      "0-2": 3,
      "0-4": 2,
      "0-3": 2,
      "2-0": 2,
      "1-0": 2,
      "2-2": 1,
      "1-3": 1,
      "4-0": 1,
      "5-2": 1,
      "3-4": 1,
      "3-5": 1,
      "4-1": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 40,
    "goalsPerMatch": 3.025,
    "shotsPerMatch": 22.95,
    "xgPerMatch": 3.0159426745321634,
    "onTargetRate": 0.3790849673202614,
    "passCompletion": 0.8081654294803817,
    "foulsPerMatch": 26.775,
    "yellowsPerMatch": 3.9,
    "redsPerMatch": 0.2,
    "cornersPerMatch": 5.725,
    "tacklesPerMatch": 54.45,
    "interceptionsPerMatch": 19.875,
    "drawRate": 0.15,
    "zeroZeroRate": 0.025,
    "blowoutRate": 0.125,
    "lateGoalShare": 0.1487603305785124,
    "setPieceGoalShare": 0.15702479338842976,
    "averageEndingStamina": 71.04816244042263,
    "averagePossessionA": 0.49002645654094107,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 33.1,
    "maxGoals": 7,
    "scoreFrequency": {
      "0-2": 5,
      "1-1": 5,
      "1-0": 5,
      "4-0": 3,
      "2-3": 3,
      "3-1": 3,
      "2-1": 2,
      "2-0": 2,
      "1-3": 2,
      "1-5": 2,
      "1-2": 2,
      "0-0": 1,
      "4-1": 1,
      "3-2": 1,
      "0-1": 1,
      "4-3": 1
    },
    "favoriteWinRate": 0.75
  },
  "styles": {
    "name": "styles",
    "games": 70,
    "goalsPerMatch": 2.6857142857142855,
    "shotsPerMatch": 21.357142857142858,
    "xgPerMatch": 2.5578086036433465,
    "onTargetRate": 0.40735785953177256,
    "passCompletion": 0.8227886056971514,
    "foulsPerMatch": 19.12857142857143,
    "yellowsPerMatch": 3.3,
    "redsPerMatch": 0.22857142857142856,
    "cornersPerMatch": 6.0285714285714285,
    "tacklesPerMatch": 43.07142857142857,
    "interceptionsPerMatch": 16.728571428571428,
    "drawRate": 0.37142857142857144,
    "zeroZeroRate": 0.08571428571428572,
    "blowoutRate": 0.02857142857142857,
    "lateGoalShare": 0.25,
    "setPieceGoalShare": 0.14361702127659576,
    "averageEndingStamina": 71.53345764540448,
    "averagePossessionA": 0.5034002377872789,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 32,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 12,
      "0-1": 9,
      "1-0": 7,
      "0-0": 6,
      "2-2": 5,
      "1-2": 4,
      "2-1": 4,
      "0-2": 3,
      "4-1": 3,
      "3-2": 2,
      "1-4": 2,
      "4-4": 2,
      "0-4": 2,
      "2-3": 2,
      "1-3": 2,
      "3-3": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 34,
    "goalsPerMatch": 3.1470588235294117,
    "shotsPerMatch": 24.647058823529413,
    "xgPerMatch": 3.041368479814042,
    "onTargetRate": 0.3926014319809069,
    "passCompletion": 0.8057819663779928,
    "foulsPerMatch": 25.941176470588236,
    "yellowsPerMatch": 4.205882352941177,
    "redsPerMatch": 0.29411764705882354,
    "cornersPerMatch": 6.352941176470588,
    "tacklesPerMatch": 55.6764705882353,
    "interceptionsPerMatch": 20.647058823529413,
    "drawRate": 0.23529411764705882,
    "zeroZeroRate": 0.058823529411764705,
    "blowoutRate": 0.029411764705882353,
    "lateGoalShare": 0.18691588785046728,
    "setPieceGoalShare": 0.11214953271028037,
    "averageEndingStamina": 69.95129055812974,
    "averagePossessionA": 0.4965221192063543,
    "goalP50": 3,
    "goalP90": 6,
    "shotP90": 33.7,
    "maxGoals": 8,
    "scoreFrequency": {
      "0-1": 6,
      "1-1": 4,
      "1-2": 4,
      "2-0": 3,
      "4-2": 3,
      "2-1": 2,
      "4-3": 2,
      "0-0": 2,
      "2-3": 2,
      "1-3": 1,
      "2-2": 1,
      "4-4": 1,
      "3-0": 1,
      "3-1": 1,
      "0-4": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 10,
    "winRate": 0.5,
    "drawRate": 0.3,
    "goalDelta": 0.8,
    "xgDelta": 0.10040769100450167,
    "possessionDelta": 0.047558329461587875,
    "passCompletionDelta": 0.017057240743641865,
    "crossDelta": 0.8,
    "throughBallDelta": -2.3,
    "pressWinsDelta": 1,
    "staminaDelta": 1.1100955518161784,
    "shotsForDelta": 0.9,
    "shotsAllowedDelta": -0.9
  },
  "counter": {
    "games": 10,
    "winRate": 0.1,
    "drawRate": 0.4,
    "goalDelta": -0.3,
    "xgDelta": -0.15920121259513742,
    "possessionDelta": -0.06276585623343964,
    "passCompletionDelta": -0.03651599201441269,
    "crossDelta": 0.5,
    "throughBallDelta": 8.8,
    "pressWinsDelta": 1.9,
    "staminaDelta": 0.9446694116823849,
    "shotsForDelta": -0.8,
    "shotsAllowedDelta": 0.8
  },
  "press": {
    "games": 10,
    "winRate": 0.2,
    "drawRate": 0.6,
    "goalDelta": 0.1,
    "xgDelta": 0.7992123281748779,
    "possessionDelta": -0.00567280641235422,
    "passCompletionDelta": -0.017972198015977225,
    "crossDelta": -0.3,
    "throughBallDelta": 2.1,
    "pressWinsDelta": 9.8,
    "staminaDelta": -6.7380020299984125,
    "shotsForDelta": 0.8,
    "shotsAllowedDelta": -0.8
  },
  "direct": {
    "games": 10,
    "winRate": 0.4,
    "drawRate": 0.3,
    "goalDelta": 0.4,
    "xgDelta": 0.18934766538279932,
    "possessionDelta": -0.11078549876465049,
    "passCompletionDelta": -0.08927475273304544,
    "crossDelta": -0.3,
    "throughBallDelta": 6.3,
    "pressWinsDelta": -1.2,
    "staminaDelta": -1.2509856844389915,
    "shotsForDelta": 0.6,
    "shotsAllowedDelta": -0.6
  },
  "wings": {
    "games": 10,
    "winRate": 0.4,
    "drawRate": 0.4,
    "goalDelta": 0.5,
    "xgDelta": 0.3277380957011979,
    "possessionDelta": -0.03495194818376225,
    "passCompletionDelta": 0.006549099493056487,
    "crossDelta": 1.8,
    "throughBallDelta": 1.9,
    "pressWinsDelta": 0.2,
    "staminaDelta": 1.0434074011291457,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "balanced": {
    "games": 10,
    "winRate": 0.3,
    "drawRate": 0.4,
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
    "games": 10,
    "winRate": 0.3,
    "drawRate": 0.2,
    "goalDelta": -0.5,
    "xgDelta": -0.28632828733614923,
    "possessionDelta": -0.04124836826036577,
    "passCompletionDelta": -0.02011085743569537,
    "crossDelta": -0.8,
    "throughBallDelta": 6.7,
    "pressWinsDelta": -1.7,
    "staminaDelta": 2.8764627353007257,
    "shotsForDelta": -1.2,
    "shotsAllowedDelta": 1.2
  }
}
```
