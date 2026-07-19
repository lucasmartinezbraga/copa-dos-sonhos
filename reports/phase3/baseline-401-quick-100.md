# Laboratório estatístico — baseline-401

- Partidas: **100**
- Motor: **4.0.1**
- Passo: **0.03333333333333333s**
- Workers: **4**
- Tempo: **102.2s**
- Nota de calibração: **80.8/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.8600 | 2.4–3.2 | OK |
| shotsPerMatch | 22.9400 | 20–30 | OK |
| xgPerMatch | 2.7833 | 2.3–3.5 | OK |
| onTargetRate | 0.3784 | 0.34–0.47 | OK |
| passCompletion | 0.8114 | 0.75–0.89 | OK |
| foulsPerMatch | 25.3200 | 16–28 | OK |
| yellowsPerMatch | 4.3100 | 2.4–5.6 | OK |
| redsPerMatch | 0.5800 | 0.06–0.3 | ALTO |
| cornersPerMatch | 4.9300 | 5–11.5 | BAIXO |
| drawRate | 0.3100 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0600 | 0.045–0.12 | OK |
| blowoutRate | 0.0300 | 0.025–0.13 | OK |
| lateGoalShare | 0.1923 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1294 | 0.1–0.27 | OK |
| favoriteWinRate | 0.8824 | 0.6–0.79 | ALTO |
| paritySideAWinShare | 0.5000 | 0.46–0.54 | OK |
| averageEndingStamina | 71.3503 | 64–83 | OK |

## Suites

```json
{
  "random": {
    "name": "random",
    "games": 34,
    "goalsPerMatch": 2.8529411764705883,
    "shotsPerMatch": 20.558823529411764,
    "xgPerMatch": 2.6062617015648124,
    "onTargetRate": 0.38912732474964234,
    "passCompletion": 0.7953667953667953,
    "foulsPerMatch": 28.147058823529413,
    "yellowsPerMatch": 4.617647058823529,
    "redsPerMatch": 0.6470588235294118,
    "cornersPerMatch": 4.235294117647059,
    "tacklesPerMatch": 59.205882352941174,
    "interceptionsPerMatch": 20.823529411764707,
    "drawRate": 0.38235294117647056,
    "zeroZeroRate": 0.058823529411764705,
    "blowoutRate": 0.08823529411764706,
    "lateGoalShare": 0.21649484536082475,
    "setPieceGoalShare": 0.1134020618556701,
    "averageEndingStamina": 71.10426005960565,
    "averagePossessionA": 0.4723219816237157,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 31,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-1": 6,
      "0-1": 4,
      "2-2": 3,
      "2-0": 3,
      "1-0": 2,
      "3-3": 2,
      "0-0": 2,
      "2-1": 2,
      "0-2": 1,
      "1-4": 1,
      "2-3": 1,
      "4-0": 1,
      "5-0": 1,
      "2-4": 1,
      "0-4": 1,
      "3-1": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 17,
    "goalsPerMatch": 3.1176470588235294,
    "shotsPerMatch": 22,
    "xgPerMatch": 2.7392740634000248,
    "onTargetRate": 0.43315508021390375,
    "passCompletion": 0.8121504829689883,
    "foulsPerMatch": 23.58823529411765,
    "yellowsPerMatch": 4.176470588235294,
    "redsPerMatch": 0.5294117647058824,
    "cornersPerMatch": 4.9411764705882355,
    "tacklesPerMatch": 44.8235294117647,
    "interceptionsPerMatch": 16.823529411764707,
    "drawRate": 0.058823529411764705,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.11320754716981132,
    "setPieceGoalShare": 0.18867924528301888,
    "averageEndingStamina": 71.14249847033447,
    "averagePossessionA": 0.5175643538318894,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 28.4,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-0": 2,
      "3-1": 2,
      "0-3": 2,
      "3-2": 1,
      "3-0": 1,
      "0-1": 1,
      "0-2": 1,
      "4-3": 1,
      "1-3": 1,
      "2-0": 1,
      "1-2": 1,
      "2-1": 1,
      "1-1": 1,
      "4-1": 1
    },
    "favoriteWinRate": 0.8823529411764706
  },
  "parity": {
    "name": "parity",
    "games": 15,
    "goalsPerMatch": 2.8666666666666667,
    "shotsPerMatch": 27.333333333333332,
    "xgPerMatch": 2.9818563074126527,
    "onTargetRate": 0.33902439024390246,
    "passCompletion": 0.8200824499411072,
    "foulsPerMatch": 26.066666666666666,
    "yellowsPerMatch": 4.266666666666667,
    "redsPerMatch": 0.4666666666666667,
    "cornersPerMatch": 6.266666666666667,
    "tacklesPerMatch": 53.93333333333333,
    "interceptionsPerMatch": 16.6,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0.06666666666666667,
    "blowoutRate": 0,
    "lateGoalShare": 0.16279069767441862,
    "setPieceGoalShare": 0.16279069767441862,
    "averageEndingStamina": 71.86720781845989,
    "averagePossessionA": 0.5015696110872524,
    "goalP50": 3,
    "goalP90": 4.6,
    "shotP90": 41.2,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-1": 3,
      "2-1": 3,
      "0-2": 2,
      "2-0": 1,
      "2-2": 1,
      "0-0": 1,
      "3-2": 1,
      "1-3": 1,
      "0-3": 1,
      "2-4": 1
    },
    "paritySideAWinShare": 0.5
  },
  "formations": {
    "name": "formations",
    "games": 16,
    "goalsPerMatch": 3,
    "shotsPerMatch": 24.0625,
    "xgPerMatch": 3.15191491951294,
    "onTargetRate": 0.37662337662337664,
    "passCompletion": 0.8101545253863135,
    "foulsPerMatch": 23.9375,
    "yellowsPerMatch": 4.25,
    "redsPerMatch": 0.5625,
    "cornersPerMatch": 4.625,
    "tacklesPerMatch": 51.6875,
    "interceptionsPerMatch": 20.1875,
    "drawRate": 0.3125,
    "zeroZeroRate": 0.125,
    "blowoutRate": 0,
    "lateGoalShare": 0.20833333333333334,
    "setPieceGoalShare": 0.125,
    "averageEndingStamina": 71.30084657765231,
    "averagePossessionA": 0.5020538346825332,
    "goalP50": 3.5,
    "goalP90": 5,
    "shotP90": 31,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-3": 3,
      "0-0": 2,
      "1-0": 2,
      "1-2": 2,
      "3-2": 2,
      "0-2": 1,
      "1-1": 1,
      "3-1": 1,
      "2-2": 1,
      "3-3": 1
    }
  },
  "styles": {
    "name": "styles",
    "games": 18,
    "goalsPerMatch": 2.5,
    "shotsPerMatch": 23.666666666666668,
    "xgPerMatch": 2.66606547124728,
    "onTargetRate": 0.352112676056338,
    "passCompletion": 0.8345306513409961,
    "foulsPerMatch": 22.22222222222222,
    "yellowsPerMatch": 3.9444444444444446,
    "redsPerMatch": 0.6111111111111112,
    "cornersPerMatch": 5.388888888888889,
    "tacklesPerMatch": 46.166666666666664,
    "interceptionsPerMatch": 14.38888888888889,
    "drawRate": 0.3888888888888889,
    "zeroZeroRate": 0.05555555555555555,
    "blowoutRate": 0,
    "lateGoalShare": 0.24444444444444444,
    "setPieceGoalShare": 0.06666666666666667,
    "averageEndingStamina": 71.62433063787415,
    "averagePossessionA": 0.5004953279061093,
    "goalP50": 2,
    "goalP90": 4,
    "shotP90": 31.900000000000002,
    "maxGoals": 5,
    "scoreFrequency": {
      "1-1": 4,
      "2-2": 2,
      "1-2": 2,
      "2-0": 2,
      "1-0": 1,
      "2-1": 1,
      "0-0": 1,
      "3-0": 1,
      "3-1": 1,
      "0-2": 1,
      "0-1": 1,
      "2-3": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 3,
    "goalDelta": 1,
    "possessionDelta": 0.05591714190099175,
    "passCompletionDelta": 0.0390765159448497,
    "crossDelta": -0.6666666666666666,
    "throughBallDelta": -4.666666666666667,
    "pressWinsDelta": -2,
    "staminaDelta": 2.2129930555342505,
    "shotsForDelta": 0.3333333333333333,
    "shotsAllowedDelta": -0.3333333333333333
  },
  "counter": {
    "games": 3,
    "goalDelta": -0.6666666666666666,
    "possessionDelta": -0.06779334372797413,
    "passCompletionDelta": -0.05292672491267599,
    "crossDelta": -1,
    "throughBallDelta": 4.666666666666667,
    "pressWinsDelta": -4.333333333333333,
    "staminaDelta": 3.355741023558925,
    "shotsForDelta": -4.666666666666667,
    "shotsAllowedDelta": 4.666666666666667
  },
  "press": {
    "games": 3,
    "goalDelta": 0.3333333333333333,
    "possessionDelta": 0.026143881372766724,
    "passCompletionDelta": 0.013528970901990492,
    "crossDelta": 1.6666666666666667,
    "throughBallDelta": -1.3333333333333333,
    "pressWinsDelta": 15.333333333333334,
    "staminaDelta": -3.7162738785327414,
    "shotsForDelta": 1.3333333333333333,
    "shotsAllowedDelta": -1.3333333333333333
  },
  "direct": {
    "games": 3,
    "goalDelta": -1,
    "possessionDelta": -0.13337989755075944,
    "passCompletionDelta": -0.10025741456760391,
    "crossDelta": 0.6666666666666666,
    "throughBallDelta": 3,
    "pressWinsDelta": 3.3333333333333335,
    "staminaDelta": -1.248388095891163,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "wings": {
    "games": 2,
    "goalDelta": 0.5,
    "possessionDelta": -0.06497022207452366,
    "passCompletionDelta": -0.06255229458437606,
    "crossDelta": -3.5,
    "throughBallDelta": 4.5,
    "pressWinsDelta": -2,
    "staminaDelta": 1.6029920086287888,
    "shotsForDelta": -4.5,
    "shotsAllowedDelta": 4.5
  },
  "balanced": {
    "games": 2,
    "goalDelta": 0.5,
    "possessionDelta": 0.06548070367473757,
    "passCompletionDelta": -0.013301953275625944,
    "crossDelta": -3.5,
    "throughBallDelta": 2.5,
    "pressWinsDelta": -1,
    "staminaDelta": 3.7167301239268653,
    "shotsForDelta": -1.5,
    "shotsAllowedDelta": 1.5
  },
  "park": {
    "games": 2,
    "goalDelta": -1,
    "possessionDelta": -0.019073240546000708,
    "passCompletionDelta": 0.02564418267364671,
    "crossDelta": -3.5,
    "throughBallDelta": 2.5,
    "pressWinsDelta": -3,
    "staminaDelta": 2.9664662092539515,
    "shotsForDelta": -0.5,
    "shotsAllowedDelta": 0.5
  }
}
```
