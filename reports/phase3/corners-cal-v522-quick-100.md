# Laboratório estatístico — corners-cal-v522

- Partidas: **100**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **4**
- Tempo: **80.2s**
- Nota de calibração: **86.8/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 3.1200 | 2.4–3.2 | OK |
| shotsPerMatch | 24.0900 | 20–30 | OK |
| xgPerMatch | 2.9582 | 2.3–3.5 | OK |
| onTargetRate | 0.3707 | 0.34–0.47 | OK |
| passCompletion | 0.8124 | 0.75–0.89 | OK |
| foulsPerMatch | 23.9600 | 16–28 | OK |
| yellowsPerMatch | 3.6500 | 2.4–5.6 | OK |
| redsPerMatch | 0.1900 | 0.06–0.3 | OK |
| cornersPerMatch | 5.0300 | 5–11.5 | OK |
| drawRate | 0.2300 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0700 | 0.045–0.12 | OK |
| blowoutRate | 0.1200 | 0.025–0.13 | OK |
| lateGoalShare | 0.2115 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1571 | 0.1–0.27 | OK |
| favoriteWinRate | 0.7647 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.5584 | 0.46–0.54 | ALTO |
| averageEndingStamina | 69.5673 | 64–83 | OK |

## Suites

```json
{
  "random": {
    "name": "random",
    "games": 34,
    "goalsPerMatch": 2.7941176470588234,
    "shotsPerMatch": 19.441176470588236,
    "xgPerMatch": 2.4869274737765763,
    "onTargetRate": 0.3827534039334342,
    "passCompletion": 0.809023327351961,
    "foulsPerMatch": 26.941176470588236,
    "yellowsPerMatch": 3.823529411764706,
    "redsPerMatch": 0.23529411764705882,
    "cornersPerMatch": 3.823529411764706,
    "tacklesPerMatch": 56.794117647058826,
    "interceptionsPerMatch": 19,
    "drawRate": 0.3235294117647059,
    "zeroZeroRate": 0.14705882352941177,
    "blowoutRate": 0.11764705882352941,
    "lateGoalShare": 0.22105263157894736,
    "setPieceGoalShare": 0.17894736842105263,
    "averageEndingStamina": 69.39158598784552,
    "averagePossessionA": 0.5113077411109979,
    "goalP50": 2,
    "goalP90": 5.699999999999999,
    "shotP90": 30.7,
    "maxGoals": 8,
    "scoreFrequency": {
      "0-0": 5,
      "1-1": 5,
      "2-0": 3,
      "3-1": 2,
      "0-2": 2,
      "0-4": 2,
      "0-1": 2,
      "3-0": 2,
      "4-1": 2,
      "1-0": 2,
      "6-0": 1,
      "2-1": 1,
      "4-4": 1,
      "2-5": 1,
      "1-2": 1,
      "4-3": 1
    }
  },
  "parity": {
    "name": "parity",
    "games": 15,
    "goalsPerMatch": 3.066666666666667,
    "shotsPerMatch": 28.533333333333335,
    "xgPerMatch": 3.213106500165526,
    "onTargetRate": 0.3691588785046729,
    "passCompletion": 0.8198146002317497,
    "foulsPerMatch": 21.2,
    "yellowsPerMatch": 3.3333333333333335,
    "redsPerMatch": 0.13333333333333333,
    "cornersPerMatch": 4.933333333333334,
    "tacklesPerMatch": 52.666666666666664,
    "interceptionsPerMatch": 18.066666666666666,
    "drawRate": 0.26666666666666666,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.1956521739130435,
    "setPieceGoalShare": 0.13043478260869565,
    "averageEndingStamina": 70.79075874040919,
    "averagePossessionA": 0.5095707064258037,
    "goalP50": 3,
    "goalP90": 4.6,
    "shotP90": 36.2,
    "maxGoals": 6,
    "scoreFrequency": {
      "2-1": 3,
      "3-1": 2,
      "1-1": 2,
      "1-0": 2,
      "1-2": 2,
      "2-2": 1,
      "3-3": 1,
      "0-2": 1,
      "4-1": 1
    },
    "paritySideAWinShare": 0.7272727272727273
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 17,
    "goalsPerMatch": 3.176470588235294,
    "shotsPerMatch": 25.058823529411764,
    "xgPerMatch": 3.1722542255559047,
    "onTargetRate": 0.3568075117370892,
    "passCompletion": 0.8045569620253165,
    "foulsPerMatch": 27.11764705882353,
    "yellowsPerMatch": 3.764705882352941,
    "redsPerMatch": 0.29411764705882354,
    "cornersPerMatch": 5.470588235294118,
    "tacklesPerMatch": 53.94117647058823,
    "interceptionsPerMatch": 20,
    "drawRate": 0.11764705882352941,
    "zeroZeroRate": 0.11764705882352941,
    "blowoutRate": 0.17647058823529413,
    "lateGoalShare": 0.12962962962962962,
    "setPieceGoalShare": 0.18518518518518517,
    "averageEndingStamina": 69.33740455087388,
    "averagePossessionA": 0.5142235712511682,
    "goalP50": 3,
    "goalP90": 5.4,
    "shotP90": 32.6,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-0": 2,
      "0-0": 2,
      "1-2": 2,
      "3-0": 1,
      "1-3": 1,
      "3-1": 1,
      "5-0": 1,
      "0-1": 1,
      "2-1": 1,
      "2-4": 1,
      "0-3": 1,
      "8-0": 1,
      "0-4": 1,
      "4-1": 1
    },
    "favoriteWinRate": 0.7647058823529411
  },
  "formations": {
    "name": "formations",
    "games": 16,
    "goalsPerMatch": 3.5,
    "shotsPerMatch": 26.25,
    "xgPerMatch": 3.120193172670602,
    "onTargetRate": 0.36666666666666664,
    "passCompletion": 0.8126721763085399,
    "foulsPerMatch": 21.375,
    "yellowsPerMatch": 3.9375,
    "redsPerMatch": 0.125,
    "cornersPerMatch": 6.5625,
    "tacklesPerMatch": 53.6875,
    "interceptionsPerMatch": 17.6875,
    "drawRate": 0.25,
    "zeroZeroRate": 0,
    "blowoutRate": 0.1875,
    "lateGoalShare": 0.17857142857142858,
    "setPieceGoalShare": 0.14285714285714285,
    "averageEndingStamina": 68.6346846364481,
    "averagePossessionA": 0.49631376743347366,
    "goalP50": 3,
    "goalP90": 6.5,
    "shotP90": 32,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 3,
      "0-1": 2,
      "3-0": 2,
      "2-2": 1,
      "1-0": 1,
      "5-2": 1,
      "3-2": 1,
      "3-5": 1,
      "1-5": 1,
      "5-0": 1,
      "0-4": 1,
      "0-2": 1
    }
  },
  "styles": {
    "name": "styles",
    "games": 18,
    "goalsPerMatch": 3.388888888888889,
    "shotsPerMatch": 26.333333333333332,
    "xgPerMatch": 3.2897962345181027,
    "onTargetRate": 0.37130801687763715,
    "passCompletion": 0.8198284080076264,
    "foulsPerMatch": 19.944444444444443,
    "yellowsPerMatch": 3.2222222222222223,
    "redsPerMatch": 0.1111111111111111,
    "cornersPerMatch": 5.611111111111111,
    "tacklesPerMatch": 46.05555555555556,
    "interceptionsPerMatch": 16.666666666666668,
    "drawRate": 0.1111111111111111,
    "zeroZeroRate": 0,
    "blowoutRate": 0.1111111111111111,
    "lateGoalShare": 0.3114754098360656,
    "setPieceGoalShare": 0.13114754098360656,
    "averageEndingStamina": 69.92602459064516,
    "averagePossessionA": 0.5065848605108263,
    "goalP50": 3,
    "goalP90": 5.300000000000001,
    "shotP90": 32.3,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-2": 5,
      "3-1": 2,
      "2-0": 2,
      "0-1": 2,
      "1-1": 1,
      "4-0": 1,
      "1-5": 1,
      "3-2": 1,
      "2-3": 1,
      "2-2": 1,
      "4-2": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.25,
    "goalDelta": 0.5,
    "xgDelta": 1.2322974493786059,
    "possessionDelta": 0.2539220855951188,
    "passCompletionDelta": 0.07575504372162176,
    "crossDelta": 1.25,
    "throughBallDelta": -6.75,
    "pressWinsDelta": 5,
    "staminaDelta": 2.622063010759355,
    "shotsForDelta": 5.75,
    "shotsAllowedDelta": -5.75
  },
  "counter": {
    "games": 4,
    "winRate": 0.75,
    "drawRate": 0,
    "goalDelta": 0.5,
    "xgDelta": -0.14792250394784795,
    "possessionDelta": -0.005091870389185224,
    "passCompletionDelta": -0.019902591336199094,
    "crossDelta": 0.75,
    "throughBallDelta": 2,
    "pressWinsDelta": -1.25,
    "staminaDelta": 3.7284204384869817,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "press": {
    "games": 2,
    "winRate": 1,
    "drawRate": 0,
    "goalDelta": 1.5,
    "xgDelta": -0.24350127187699477,
    "possessionDelta": 0.006582466553895827,
    "passCompletionDelta": 0.031863767191613934,
    "crossDelta": -2,
    "throughBallDelta": 4.5,
    "pressWinsDelta": 22,
    "staminaDelta": -5.739098320646729,
    "shotsForDelta": -4,
    "shotsAllowedDelta": 4
  },
  "direct": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0,
    "xgDelta": 1.2747576808455463,
    "possessionDelta": -0.14126250438536422,
    "passCompletionDelta": 0.0075951665052301776,
    "crossDelta": 1.5,
    "throughBallDelta": 1,
    "pressWinsDelta": 1.5,
    "staminaDelta": -0.5036694176061616,
    "shotsForDelta": 5,
    "shotsAllowedDelta": -5
  },
  "wings": {
    "games": 2,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.5,
    "xgDelta": 0.32277317704143016,
    "possessionDelta": 0.11169179730784407,
    "passCompletionDelta": 0.030455100316748085,
    "crossDelta": 0,
    "throughBallDelta": 2.5,
    "pressWinsDelta": 5,
    "staminaDelta": 1.2504255789410195,
    "shotsForDelta": 1.5,
    "shotsAllowedDelta": -1.5
  },
  "balanced": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
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
    "winRate": 0,
    "drawRate": 0,
    "goalDelta": -2.5,
    "xgDelta": -0.34072959035139605,
    "possessionDelta": -0.021566693315991314,
    "passCompletionDelta": -0.038177798325861656,
    "crossDelta": -7,
    "throughBallDelta": 9,
    "pressWinsDelta": -3,
    "staminaDelta": 2.520434691264825,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  }
}
```
