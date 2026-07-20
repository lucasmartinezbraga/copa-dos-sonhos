# Laboratório estatístico — corners-final-v522

- Partidas: **200**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **4**
- Tempo: **1150.1s**
- Nota de calibração: **92.3/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.9200 | 2.4–3.2 | OK |
| shotsPerMatch | 23.1800 | 20–30 | OK |
| xgPerMatch | 2.9037 | 2.3–3.5 | OK |
| onTargetRate | 0.3645 | 0.34–0.47 | OK |
| passCompletion | 0.8091 | 0.75–0.89 | OK |
| foulsPerMatch | 23.1350 | 16–28 | OK |
| yellowsPerMatch | 3.5150 | 2.4–5.6 | OK |
| redsPerMatch | 0.1450 | 0.06–0.3 | OK |
| cornersPerMatch | 4.9100 | 5–11.5 | BAIXO |
| drawRate | 0.2800 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0850 | 0.045–0.12 | OK |
| blowoutRate | 0.0700 | 0.025–0.13 | OK |
| lateGoalShare | 0.1866 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1370 | 0.1–0.27 | OK |
| favoriteWinRate | 0.7647 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.4931 | 0.46–0.54 | OK |
| averageEndingStamina | 70.0492 | 64–83 | OK |

## Suites

```json
{
  "random": {
    "name": "random",
    "games": 68,
    "goalsPerMatch": 2.7205882352941178,
    "shotsPerMatch": 21.323529411764707,
    "xgPerMatch": 2.8418353667561846,
    "onTargetRate": 0.36758620689655175,
    "passCompletion": 0.798469226390031,
    "foulsPerMatch": 25.941176470588236,
    "yellowsPerMatch": 3.764705882352941,
    "redsPerMatch": 0.1323529411764706,
    "cornersPerMatch": 4.529411764705882,
    "tacklesPerMatch": 51.044117647058826,
    "interceptionsPerMatch": 20.514705882352942,
    "drawRate": 0.2647058823529412,
    "zeroZeroRate": 0.11764705882352941,
    "blowoutRate": 0.07352941176470588,
    "lateGoalShare": 0.1783783783783784,
    "setPieceGoalShare": 0.15135135135135136,
    "averageEndingStamina": 69.21848018830953,
    "averagePossessionA": 0.5014397260958755,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 28,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-1": 8,
      "2-1": 8,
      "0-0": 8,
      "1-3": 7,
      "1-2": 7,
      "0-1": 6,
      "3-0": 3,
      "1-0": 3,
      "2-0": 2,
      "3-1": 2,
      "2-3": 2,
      "2-2": 2,
      "0-3": 1,
      "6-0": 1,
      "0-2": 1,
      "5-1": 1
    }
  },
  "parity": {
    "name": "parity",
    "games": 30,
    "goalsPerMatch": 2.933333333333333,
    "shotsPerMatch": 25.033333333333335,
    "xgPerMatch": 2.728554997203136,
    "onTargetRate": 0.3808255659121172,
    "passCompletion": 0.8179865387369325,
    "foulsPerMatch": 24.066666666666666,
    "yellowsPerMatch": 3.4,
    "redsPerMatch": 0.16666666666666666,
    "cornersPerMatch": 5.1,
    "tacklesPerMatch": 51.4,
    "interceptionsPerMatch": 17.966666666666665,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0.03333333333333333,
    "blowoutRate": 0.03333333333333333,
    "lateGoalShare": 0.25,
    "setPieceGoalShare": 0.20454545454545456,
    "averageEndingStamina": 70.84362039301938,
    "averagePossessionA": 0.49278541911377705,
    "goalP50": 3,
    "goalP90": 6,
    "shotP90": 38.1,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-1": 5,
      "1-2": 3,
      "1-0": 3,
      "0-1": 3,
      "2-1": 3,
      "2-0": 2,
      "2-2": 2,
      "1-4": 2,
      "3-3": 2,
      "1-3": 1,
      "0-0": 1,
      "3-0": 1,
      "2-4": 1,
      "6-1": 1
    },
    "paritySideAWinShare": 0.5
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 34,
    "goalsPerMatch": 3.1176470588235294,
    "shotsPerMatch": 23.441176470588236,
    "xgPerMatch": 3.131151571179844,
    "onTargetRate": 0.33500627352572143,
    "passCompletion": 0.8085820895522388,
    "foulsPerMatch": 23.352941176470587,
    "yellowsPerMatch": 3.5,
    "redsPerMatch": 0.08823529411764706,
    "cornersPerMatch": 4.764705882352941,
    "tacklesPerMatch": 48.11764705882353,
    "interceptionsPerMatch": 20.147058823529413,
    "drawRate": 0.20588235294117646,
    "zeroZeroRate": 0.11764705882352941,
    "blowoutRate": 0.17647058823529413,
    "lateGoalShare": 0.1509433962264151,
    "setPieceGoalShare": 0.08490566037735849,
    "averageEndingStamina": 70.24922570878537,
    "averagePossessionA": 0.49012653041089665,
    "goalP50": 3,
    "goalP90": 6,
    "shotP90": 32.4,
    "maxGoals": 7,
    "scoreFrequency": {
      "0-0": 4,
      "2-0": 3,
      "2-1": 3,
      "1-2": 3,
      "0-3": 2,
      "6-0": 2,
      "1-6": 2,
      "1-1": 2,
      "0-1": 2,
      "0-2": 2,
      "3-4": 1,
      "0-6": 1,
      "3-2": 1,
      "2-2": 1,
      "2-3": 1,
      "4-1": 1
    },
    "favoriteWinRate": 0.7647058823529411
  },
  "styles": {
    "name": "styles",
    "games": 36,
    "goalsPerMatch": 3.111111111111111,
    "shotsPerMatch": 24.305555555555557,
    "xgPerMatch": 2.899423036114541,
    "onTargetRate": 0.36,
    "passCompletion": 0.8181047018904508,
    "foulsPerMatch": 19.583333333333332,
    "yellowsPerMatch": 3.4444444444444446,
    "redsPerMatch": 0.2222222222222222,
    "cornersPerMatch": 5.416666666666667,
    "tacklesPerMatch": 45.25,
    "interceptionsPerMatch": 16.055555555555557,
    "drawRate": 0.4166666666666667,
    "zeroZeroRate": 0.08333333333333333,
    "blowoutRate": 0.027777777777777776,
    "lateGoalShare": 0.15178571428571427,
    "setPieceGoalShare": 0.11607142857142858,
    "averageEndingStamina": 70.55251656368819,
    "averagePossessionA": 0.5016941193399727,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 36,
    "maxGoals": 9,
    "scoreFrequency": {
      "1-1": 7,
      "3-2": 4,
      "3-1": 4,
      "2-2": 4,
      "1-2": 3,
      "0-0": 3,
      "0-1": 2,
      "2-0": 1,
      "1-0": 1,
      "0-4": 1,
      "2-1": 1,
      "3-3": 1,
      "3-0": 1,
      "6-3": 1,
      "0-2": 1,
      "4-1": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 32,
    "goalsPerMatch": 2.90625,
    "shotsPerMatch": 23.84375,
    "xgPerMatch": 2.962245960039623,
    "onTargetRate": 0.37876802096985585,
    "passCompletion": 0.8141664422300027,
    "foulsPerMatch": 20.0625,
    "yellowsPerMatch": 3.1875,
    "redsPerMatch": 0.125,
    "cornersPerMatch": 5.125,
    "tacklesPerMatch": 43.09375,
    "interceptionsPerMatch": 17.6875,
    "drawRate": 0.1875,
    "zeroZeroRate": 0.03125,
    "blowoutRate": 0.03125,
    "lateGoalShare": 0.22580645161290322,
    "setPieceGoalShare": 0.12903225806451613,
    "averageEndingStamina": 70.29117298292842,
    "averagePossessionA": 0.5120243213555481,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 32.800000000000004,
    "maxGoals": 7,
    "scoreFrequency": {
      "2-1": 5,
      "1-1": 4,
      "0-1": 4,
      "1-2": 3,
      "0-2": 3,
      "0-3": 2,
      "3-2": 2,
      "0-0": 1,
      "2-4": 1,
      "3-4": 1,
      "3-1": 1,
      "4-1": 1,
      "2-0": 1,
      "2-2": 1,
      "1-0": 1,
      "5-1": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 6,
    "winRate": 0.3333333333333333,
    "drawRate": 0.6666666666666666,
    "goalDelta": 1,
    "xgDelta": 0.4966720907638968,
    "possessionDelta": 0.1984734458376259,
    "passCompletionDelta": 0.020546867180321855,
    "crossDelta": 0.3333333333333333,
    "throughBallDelta": -1.5,
    "pressWinsDelta": 1.6666666666666667,
    "staminaDelta": 0.9853664774613904,
    "shotsForDelta": 1,
    "shotsAllowedDelta": -1
  },
  "counter": {
    "games": 6,
    "winRate": 0.3333333333333333,
    "drawRate": 0.5,
    "goalDelta": 0.16666666666666666,
    "xgDelta": -0.5432300620179596,
    "possessionDelta": -0.00040281904461323775,
    "passCompletionDelta": -0.03972224110726735,
    "crossDelta": 0.8333333333333334,
    "throughBallDelta": -0.6666666666666666,
    "pressWinsDelta": 0.3333333333333333,
    "staminaDelta": 3.561157325993456,
    "shotsForDelta": 0.5,
    "shotsAllowedDelta": -0.5
  },
  "press": {
    "games": 6,
    "winRate": 0.6666666666666666,
    "drawRate": 0.16666666666666666,
    "goalDelta": 1,
    "xgDelta": 0.5456910512053433,
    "possessionDelta": 0.1291947573608612,
    "passCompletionDelta": 0.035904469635433846,
    "crossDelta": 1.3333333333333333,
    "throughBallDelta": -0.3333333333333333,
    "pressWinsDelta": 18.666666666666668,
    "staminaDelta": -5.71475998738362,
    "shotsForDelta": 2.8333333333333335,
    "shotsAllowedDelta": -2.8333333333333335
  },
  "direct": {
    "games": 6,
    "winRate": 0.3333333333333333,
    "drawRate": 0.16666666666666666,
    "goalDelta": -0.3333333333333333,
    "xgDelta": 0.2806985631715329,
    "possessionDelta": -0.07098364622184541,
    "passCompletionDelta": -0.02995099411563649,
    "crossDelta": -1,
    "throughBallDelta": -0.5,
    "pressWinsDelta": 2.8333333333333335,
    "staminaDelta": -0.8532854579734016,
    "shotsForDelta": 4.166666666666667,
    "shotsAllowedDelta": -4.166666666666667
  },
  "wings": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.75,
    "xgDelta": -0.13842384141583586,
    "possessionDelta": -0.0859252032439692,
    "passCompletionDelta": -0.03002431324334398,
    "crossDelta": 0.5,
    "throughBallDelta": -2.5,
    "pressWinsDelta": 0,
    "staminaDelta": -3.1718442350125073,
    "shotsForDelta": 2,
    "shotsAllowedDelta": -2
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
    "games": 4,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.5,
    "xgDelta": -0.4837208148556925,
    "possessionDelta": -0.008773968535070911,
    "passCompletionDelta": -0.057334502260114106,
    "crossDelta": -2,
    "throughBallDelta": 7.25,
    "pressWinsDelta": -2,
    "staminaDelta": 5.3179170292320315,
    "shotsForDelta": -2,
    "shotsAllowedDelta": 2
  }
}
```
