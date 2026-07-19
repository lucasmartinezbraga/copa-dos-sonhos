# Laboratório estatístico — validation214-v42

- Partidas: **214**
- Motor: **4.2.0**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **764.3s**
- Nota de calibração: **90.0/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.6262 | 2.4–3.2 | OK |
| shotsPerMatch | 22.7944 | 20–30 | OK |
| xgPerMatch | 2.7631 | 2.3–3.5 | OK |
| onTargetRate | 0.3645 | 0.34–0.47 | OK |
| passCompletion | 0.8154 | 0.75–0.89 | OK |
| foulsPerMatch | 22.3505 | 16–28 | OK |
| yellowsPerMatch | 3.5467 | 2.4–5.6 | OK |
| redsPerMatch | 0.2150 | 0.06–0.3 | OK |
| cornersPerMatch | 5.0561 | 5–11.5 | OK |
| drawRate | 0.3037 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0748 | 0.045–0.12 | OK |
| blowoutRate | 0.0514 | 0.025–0.13 | OK |
| lateGoalShare | 0.1797 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.0943 | 0.1–0.27 | BAIXO |
| favoriteWinRate | 0.7750 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.5000 | 0.46–0.54 | OK |
| averageEndingStamina | 70.9564 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 30,
    "goalsPerMatch": 3.3666666666666667,
    "shotsPerMatch": 28.066666666666666,
    "xgPerMatch": 3.2445019997737714,
    "onTargetRate": 0.36342042755344417,
    "passCompletion": 0.8115153251217416,
    "foulsPerMatch": 22.733333333333334,
    "yellowsPerMatch": 3,
    "redsPerMatch": 0.26666666666666666,
    "cornersPerMatch": 6,
    "tacklesPerMatch": 51.9,
    "interceptionsPerMatch": 18.766666666666666,
    "drawRate": 0.26666666666666666,
    "zeroZeroRate": 0.03333333333333333,
    "blowoutRate": 0,
    "lateGoalShare": 0.13861386138613863,
    "setPieceGoalShare": 0.10891089108910891,
    "averageEndingStamina": 71.4827583090993,
    "averagePossessionA": 0.49671243648457747,
    "goalP50": 4,
    "goalP90": 5,
    "shotP90": 36,
    "maxGoals": 7,
    "scoreFrequency": {
      "2-2": 6,
      "2-1": 3,
      "0-1": 2,
      "1-2": 2,
      "4-1": 2,
      "1-3": 2,
      "2-0": 2,
      "1-0": 2,
      "1-4": 2,
      "1-1": 1,
      "3-1": 1,
      "3-4": 1,
      "0-0": 1,
      "3-2": 1,
      "0-3": 1,
      "2-3": 1
    },
    "paritySideAWinShare": 0.5
  },
  "random": {
    "name": "random",
    "games": 40,
    "goalsPerMatch": 2.175,
    "shotsPerMatch": 19.575,
    "xgPerMatch": 2.6119605856003543,
    "onTargetRate": 0.37420178799489145,
    "passCompletion": 0.804898828541001,
    "foulsPerMatch": 23.2,
    "yellowsPerMatch": 3.75,
    "redsPerMatch": 0.225,
    "cornersPerMatch": 4.65,
    "tacklesPerMatch": 51.5,
    "interceptionsPerMatch": 19.4,
    "drawRate": 0.325,
    "zeroZeroRate": 0.075,
    "blowoutRate": 0.025,
    "lateGoalShare": 0.1839080459770115,
    "setPieceGoalShare": 0.10344827586206896,
    "averageEndingStamina": 70.98698710606425,
    "averagePossessionA": 0.4928244434626115,
    "goalP50": 2,
    "goalP90": 4,
    "shotP90": 26.200000000000003,
    "maxGoals": 6,
    "scoreFrequency": {
      "0-1": 8,
      "1-1": 7,
      "2-1": 5,
      "1-0": 4,
      "2-2": 3,
      "0-0": 3,
      "2-0": 3,
      "3-2": 2,
      "0-6": 1,
      "0-3": 1,
      "3-1": 1,
      "3-0": 1,
      "0-2": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 40,
    "goalsPerMatch": 2.375,
    "shotsPerMatch": 22.7,
    "xgPerMatch": 2.779445973553867,
    "onTargetRate": 0.35462555066079293,
    "passCompletion": 0.8126651865947775,
    "foulsPerMatch": 25.8,
    "yellowsPerMatch": 4.375,
    "redsPerMatch": 0.35,
    "cornersPerMatch": 4.825,
    "tacklesPerMatch": 55.15,
    "interceptionsPerMatch": 19.875,
    "drawRate": 0.175,
    "zeroZeroRate": 0.1,
    "blowoutRate": 0.175,
    "lateGoalShare": 0.15789473684210525,
    "setPieceGoalShare": 0.12631578947368421,
    "averageEndingStamina": 70.62931752877157,
    "averagePossessionA": 0.49749105403501614,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 30.200000000000003,
    "maxGoals": 7,
    "scoreFrequency": {
      "0-1": 7,
      "1-0": 6,
      "0-0": 4,
      "0-2": 3,
      "2-1": 3,
      "1-1": 3,
      "5-0": 2,
      "0-3": 2,
      "3-0": 1,
      "1-5": 1,
      "0-4": 1,
      "2-0": 1,
      "0-6": 1,
      "4-0": 1,
      "1-6": 1,
      "3-1": 1
    },
    "favoriteWinRate": 0.775
  },
  "styles": {
    "name": "styles",
    "games": 70,
    "goalsPerMatch": 2.4857142857142858,
    "shotsPerMatch": 21.642857142857142,
    "xgPerMatch": 2.544118418293488,
    "onTargetRate": 0.34917491749174917,
    "passCompletion": 0.8269677650002979,
    "foulsPerMatch": 18.242857142857144,
    "yellowsPerMatch": 2.8714285714285714,
    "redsPerMatch": 0.12857142857142856,
    "cornersPerMatch": 4.6,
    "tacklesPerMatch": 41.871428571428574,
    "interceptionsPerMatch": 16.97142857142857,
    "drawRate": 0.34285714285714286,
    "zeroZeroRate": 0.08571428571428572,
    "blowoutRate": 0.04285714285714286,
    "lateGoalShare": 0.1839080459770115,
    "setPieceGoalShare": 0.06321839080459771,
    "averageEndingStamina": 71.54627723589441,
    "averagePossessionA": 0.5060025254388811,
    "goalP50": 2,
    "goalP90": 6,
    "shotP90": 32.2,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 14,
      "0-1": 12,
      "1-2": 7,
      "1-0": 6,
      "0-0": 6,
      "2-1": 4,
      "0-2": 3,
      "2-2": 3,
      "2-0": 3,
      "2-4": 2,
      "4-3": 1,
      "4-1": 1,
      "1-7": 1,
      "3-2": 1,
      "5-1": 1,
      "3-4": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 34,
    "goalsPerMatch": 3.088235294117647,
    "shotsPerMatch": 24.41176470588235,
    "xgPerMatch": 2.9480347791052695,
    "onTargetRate": 0.39518072289156625,
    "passCompletion": 0.8100770299280212,
    "foulsPerMatch": 25.41176470588235,
    "yellowsPerMatch": 4.205882352941177,
    "redsPerMatch": 0.17647058823529413,
    "cornersPerMatch": 5.911764705882353,
    "tacklesPerMatch": 53.470588235294116,
    "interceptionsPerMatch": 19.5,
    "drawRate": 0.38235294117647056,
    "zeroZeroRate": 0.058823529411764705,
    "blowoutRate": 0,
    "lateGoalShare": 0.22857142857142856,
    "setPieceGoalShare": 0.09523809523809523,
    "averageEndingStamina": 69.6263098392423,
    "averagePossessionA": 0.48869845127777556,
    "goalP50": 3,
    "goalP90": 6,
    "shotP90": 31,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 6,
      "0-1": 5,
      "1-2": 4,
      "2-2": 3,
      "2-3": 2,
      "3-0": 2,
      "2-0": 2,
      "0-0": 2,
      "4-2": 2,
      "4-4": 1,
      "3-3": 1,
      "1-0": 1,
      "3-1": 1,
      "2-4": 1,
      "4-3": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 10,
    "winRate": 0.8,
    "drawRate": 0.2,
    "goalDelta": 1.5,
    "xgDelta": 0.77887283535644,
    "possessionDelta": 0.12547394283330934,
    "passCompletionDelta": 0.01964755626142266,
    "crossDelta": 0.6,
    "throughBallDelta": -1.4,
    "pressWinsDelta": 0.7,
    "staminaDelta": 2.8458478544670016,
    "shotsForDelta": 1.1,
    "shotsAllowedDelta": -1.1
  },
  "counter": {
    "games": 10,
    "winRate": 0.2,
    "drawRate": 0.3,
    "goalDelta": -0.7,
    "xgDelta": -0.2898648369492558,
    "possessionDelta": -0.06481841503481664,
    "passCompletionDelta": -0.06399827312085649,
    "crossDelta": -0.9,
    "throughBallDelta": 8.8,
    "pressWinsDelta": 0.1,
    "staminaDelta": 1.0789247725897213,
    "shotsForDelta": -3.2,
    "shotsAllowedDelta": 3.2
  },
  "press": {
    "games": 10,
    "winRate": 0.3,
    "drawRate": 0.3,
    "goalDelta": -0.1,
    "xgDelta": 0.6624966908090063,
    "possessionDelta": -0.03858791294552312,
    "passCompletionDelta": -0.01841538950025211,
    "crossDelta": -0.2,
    "throughBallDelta": 1.4,
    "pressWinsDelta": 8.8,
    "staminaDelta": -7.3700224111808605,
    "shotsForDelta": 1.5,
    "shotsAllowedDelta": -1.5
  },
  "direct": {
    "games": 10,
    "winRate": 0.5,
    "drawRate": 0.2,
    "goalDelta": 0.3,
    "xgDelta": 0.11749552992750427,
    "possessionDelta": -0.06942030865891444,
    "passCompletionDelta": -0.09424777028694782,
    "crossDelta": 0,
    "throughBallDelta": 6.4,
    "pressWinsDelta": -1.4,
    "staminaDelta": -0.6182647407588646,
    "shotsForDelta": 1,
    "shotsAllowedDelta": -1
  },
  "wings": {
    "games": 10,
    "winRate": 0.3,
    "drawRate": 0.3,
    "goalDelta": 0.2,
    "xgDelta": -0.10670020202635525,
    "possessionDelta": -0.04728872604599728,
    "passCompletionDelta": -0.018972991622301715,
    "crossDelta": 0.5,
    "throughBallDelta": 1.4,
    "pressWinsDelta": -1.4,
    "staminaDelta": 0.8440273196537504,
    "shotsForDelta": -1.4,
    "shotsAllowedDelta": 1.4
  },
  "balanced": {
    "games": 10,
    "winRate": 0.1,
    "drawRate": 0.8,
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
    "winRate": 0.2,
    "drawRate": 0.3,
    "goalDelta": -0.6,
    "xgDelta": -0.5246258151250276,
    "possessionDelta": 0.08822461905151462,
    "passCompletionDelta": -0.019355239909142674,
    "crossDelta": -0.7,
    "throughBallDelta": 7.5,
    "pressWinsDelta": 0.5,
    "staminaDelta": 4.5066166835683275,
    "shotsForDelta": -3.3,
    "shotsAllowedDelta": 3.3
  }
}
```
