# Laboratório estatístico — audit-p4softmax-v522

- Partidas: **100**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **4**
- Tempo: **69.0s**
- Nota de calibração: **91.4/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.7900 | 2.4–3.2 | OK |
| shotsPerMatch | 23.4800 | 20–30 | OK |
| xgPerMatch | 2.9274 | 2.3–3.5 | OK |
| onTargetRate | 0.3663 | 0.34–0.47 | OK |
| passCompletion | 0.8106 | 0.75–0.89 | OK |
| foulsPerMatch | 24.3900 | 16–28 | OK |
| yellowsPerMatch | 3.8300 | 2.4–5.6 | OK |
| redsPerMatch | 0.1400 | 0.06–0.3 | OK |
| cornersPerMatch | 4.1900 | 5–11.5 | BAIXO |
| drawRate | 0.3500 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1100 | 0.045–0.12 | OK |
| blowoutRate | 0.0600 | 0.025–0.13 | OK |
| lateGoalShare | 0.2222 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1290 | 0.1–0.27 | OK |
| favoriteWinRate | 0.7059 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.4923 | 0.46–0.54 | OK |
| averageEndingStamina | 69.7075 | 64–83 | OK |

## Suites

```json
{
  "random": {
    "name": "random",
    "games": 34,
    "goalsPerMatch": 2.4411764705882355,
    "shotsPerMatch": 18.176470588235293,
    "xgPerMatch": 2.2860962179152104,
    "onTargetRate": 0.36084142394822005,
    "passCompletion": 0.8020298047276464,
    "foulsPerMatch": 28.38235294117647,
    "yellowsPerMatch": 4.382352941176471,
    "redsPerMatch": 0.17647058823529413,
    "cornersPerMatch": 2.8823529411764706,
    "tacklesPerMatch": 58.26470588235294,
    "interceptionsPerMatch": 19.470588235294116,
    "drawRate": 0.4117647058823529,
    "zeroZeroRate": 0.14705882352941177,
    "blowoutRate": 0.058823529411764705,
    "lateGoalShare": 0.20481927710843373,
    "setPieceGoalShare": 0.12048192771084337,
    "averageEndingStamina": 69.38945186798686,
    "averagePossessionA": 0.49629815731969995,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 28.799999999999997,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-1": 6,
      "0-0": 5,
      "1-2": 4,
      "1-0": 3,
      "0-1": 3,
      "0-3": 2,
      "3-0": 2,
      "0-5": 2,
      "2-2": 2,
      "2-0": 1,
      "3-2": 1,
      "2-1": 1,
      "3-3": 1,
      "2-5": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 17,
    "goalsPerMatch": 2.6470588235294117,
    "shotsPerMatch": 22.941176470588236,
    "xgPerMatch": 2.916093799329339,
    "onTargetRate": 0.3769230769230769,
    "passCompletion": 0.8150564617314932,
    "foulsPerMatch": 25.352941176470587,
    "yellowsPerMatch": 3.6470588235294117,
    "redsPerMatch": 0.17647058823529413,
    "cornersPerMatch": 4.352941176470588,
    "tacklesPerMatch": 50.294117647058826,
    "interceptionsPerMatch": 19.529411764705884,
    "drawRate": 0.29411764705882354,
    "zeroZeroRate": 0.058823529411764705,
    "blowoutRate": 0.11764705882352941,
    "lateGoalShare": 0.17777777777777778,
    "setPieceGoalShare": 0.1111111111111111,
    "averageEndingStamina": 69.66321392419961,
    "averagePossessionA": 0.5029176609018153,
    "goalP50": 2,
    "goalP90": 4.4,
    "shotP90": 29.200000000000003,
    "maxGoals": 5,
    "scoreFrequency": {
      "1-1": 3,
      "2-0": 2,
      "3-1": 2,
      "1-0": 2,
      "0-1": 1,
      "2-2": 1,
      "5-0": 1,
      "0-2": 1,
      "1-4": 1,
      "1-3": 1,
      "0-4": 1,
      "0-0": 1
    },
    "favoriteWinRate": 0.7058823529411765
  },
  "parity": {
    "name": "parity",
    "games": 15,
    "goalsPerMatch": 3.8,
    "shotsPerMatch": 29.466666666666665,
    "xgPerMatch": 3.446044536455292,
    "onTargetRate": 0.39819004524886875,
    "passCompletion": 0.8182877111240536,
    "foulsPerMatch": 22.866666666666667,
    "yellowsPerMatch": 3.8,
    "redsPerMatch": 0.26666666666666666,
    "cornersPerMatch": 4.466666666666667,
    "tacklesPerMatch": 53,
    "interceptionsPerMatch": 18.333333333333332,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.24561403508771928,
    "setPieceGoalShare": 0.08771929824561403,
    "averageEndingStamina": 70.9090004067477,
    "averagePossessionA": 0.5050791611447888,
    "goalP50": 4,
    "goalP90": 5.6,
    "shotP90": 40.2,
    "maxGoals": 7,
    "scoreFrequency": {
      "2-2": 4,
      "2-1": 2,
      "1-2": 2,
      "3-2": 1,
      "3-3": 1,
      "0-1": 1,
      "1-0": 1,
      "1-3": 1,
      "5-2": 1,
      "4-1": 1
    },
    "paritySideAWinShare": 0.6
  },
  "formations": {
    "name": "formations",
    "games": 16,
    "goalsPerMatch": 3.25,
    "shotsPerMatch": 25.3125,
    "xgPerMatch": 3.2755265390378736,
    "onTargetRate": 0.3802469135802469,
    "passCompletion": 0.804635761589404,
    "foulsPerMatch": 21.8125,
    "yellowsPerMatch": 3.75,
    "redsPerMatch": 0.0625,
    "cornersPerMatch": 5.5625,
    "tacklesPerMatch": 54.6875,
    "interceptionsPerMatch": 18.4375,
    "drawRate": 0.25,
    "zeroZeroRate": 0.0625,
    "blowoutRate": 0.125,
    "lateGoalShare": 0.21153846153846154,
    "setPieceGoalShare": 0.17307692307692307,
    "averageEndingStamina": 68.77624526411043,
    "averagePossessionA": 0.5003090788956177,
    "goalP50": 2.5,
    "goalP90": 5,
    "shotP90": 30,
    "maxGoals": 9,
    "scoreFrequency": {
      "1-1": 3,
      "2-3": 2,
      "0-2": 1,
      "3-2": 1,
      "1-0": 1,
      "3-1": 1,
      "2-7": 1,
      "2-0": 1,
      "0-0": 1,
      "1-3": 1,
      "0-5": 1,
      "3-0": 1,
      "0-1": 1
    }
  },
  "styles": {
    "name": "styles",
    "games": 18,
    "goalsPerMatch": 2.3333333333333335,
    "shotsPerMatch": 27.38888888888889,
    "xgPerMatch": 3.4075159837835454,
    "onTargetRate": 0.32454361054766734,
    "passCompletion": 0.8213346089452284,
    "foulsPerMatch": 19.5,
    "yellowsPerMatch": 3.0555555555555554,
    "redsPerMatch": 0,
    "cornersPerMatch": 5.055555555555555,
    "tacklesPerMatch": 41.77777777777778,
    "interceptionsPerMatch": 17.22222222222222,
    "drawRate": 0.3888888888888889,
    "zeroZeroRate": 0.2222222222222222,
    "blowoutRate": 0,
    "lateGoalShare": 0.2857142857142857,
    "setPieceGoalShare": 0.16666666666666666,
    "averageEndingStamina": 70.17677675826525,
    "averagePossessionA": 0.5027795818144902,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 36,
    "maxGoals": 5,
    "scoreFrequency": {
      "0-0": 4,
      "1-1": 2,
      "2-3": 2,
      "1-2": 2,
      "2-1": 2,
      "2-0": 2,
      "2-2": 1,
      "0-2": 1,
      "1-0": 1,
      "3-2": 1
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
    "drawRate": 0.75,
    "goalDelta": 0.25,
    "xgDelta": 0.05464941601567097,
    "possessionDelta": 0.19931636350112242,
    "passCompletionDelta": 0.056184372477218525,
    "crossDelta": -1.75,
    "throughBallDelta": -3.75,
    "pressWinsDelta": 2.75,
    "staminaDelta": 1.828351978635009,
    "shotsForDelta": -1,
    "shotsAllowedDelta": 1
  },
  "counter": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.5,
    "goalDelta": -0.25,
    "xgDelta": -0.9457672258131782,
    "possessionDelta": -0.0704756552414573,
    "passCompletionDelta": -0.026618713416286854,
    "crossDelta": 0.5,
    "throughBallDelta": 5.75,
    "pressWinsDelta": -1.5,
    "staminaDelta": 4.0864543571714265,
    "shotsForDelta": -4.5,
    "shotsAllowedDelta": 4.5
  },
  "press": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0,
    "xgDelta": 0.8462324184417627,
    "possessionDelta": 0.060297119463799315,
    "passCompletionDelta": 0.06357662445645829,
    "crossDelta": 2,
    "throughBallDelta": -2.5,
    "pressWinsDelta": 20.5,
    "staminaDelta": -5.475461762297417,
    "shotsForDelta": -1.5,
    "shotsAllowedDelta": 1.5
  },
  "direct": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0,
    "xgDelta": 0.8655775997123515,
    "possessionDelta": -0.1224723644263768,
    "passCompletionDelta": -0.004032832592729241,
    "crossDelta": 1,
    "throughBallDelta": 2,
    "pressWinsDelta": 4,
    "staminaDelta": -1.5214712719411807,
    "shotsForDelta": 3.5,
    "shotsAllowedDelta": -3.5
  },
  "wings": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 1,
    "xgDelta": 0.6377756336594316,
    "possessionDelta": 0.09681877549670609,
    "passCompletionDelta": 0.07185050112773894,
    "crossDelta": 0,
    "throughBallDelta": -6,
    "pressWinsDelta": 5.5,
    "staminaDelta": 2.4105772901965707,
    "shotsForDelta": 8,
    "shotsAllowedDelta": -8
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
    "drawRate": 0.5,
    "goalDelta": -1,
    "xgDelta": -1.1434316418269794,
    "possessionDelta": 0.0470975958265597,
    "passCompletionDelta": -0.05226042639600137,
    "crossDelta": -2,
    "throughBallDelta": 11,
    "pressWinsDelta": -4.5,
    "staminaDelta": 5.096735637953316,
    "shotsForDelta": -9.5,
    "shotsAllowedDelta": 9.5
  }
}
```
