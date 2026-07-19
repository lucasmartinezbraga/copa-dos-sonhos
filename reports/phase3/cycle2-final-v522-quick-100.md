# Laboratório estatístico — cycle2-final-v522

- Partidas: **100**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **4**
- Tempo: **109.8s**
- Nota de calibração: **85.6/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.7800 | 2.4–3.2 | OK |
| shotsPerMatch | 23.3900 | 20–30 | OK |
| xgPerMatch | 2.9131 | 2.3–3.5 | OK |
| onTargetRate | 0.3591 | 0.34–0.47 | OK |
| passCompletion | 0.8126 | 0.75–0.89 | OK |
| foulsPerMatch | 23.8300 | 16–28 | OK |
| yellowsPerMatch | 3.6700 | 2.4–5.6 | OK |
| redsPerMatch | 0.1700 | 0.06–0.3 | OK |
| cornersPerMatch | 4.0800 | 5–11.5 | BAIXO |
| drawRate | 0.3000 | 0.2–0.33 | OK |
| zeroZeroRate | 0.1000 | 0.045–0.12 | OK |
| blowoutRate | 0.0900 | 0.025–0.13 | OK |
| lateGoalShare | 0.1942 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1367 | 0.1–0.27 | OK |
| favoriteWinRate | 0.5882 | 0.6–0.79 | BAIXO |
| paritySideAWinShare | 0.5714 | 0.46–0.54 | ALTO |
| averageEndingStamina | 69.6395 | 64–83 | OK |

## Suites

```json
{
  "random": {
    "name": "random",
    "games": 34,
    "goalsPerMatch": 2.411764705882353,
    "shotsPerMatch": 19.08823529411765,
    "xgPerMatch": 2.3802587525126735,
    "onTargetRate": 0.35130970724191063,
    "passCompletion": 0.8047254150702426,
    "foulsPerMatch": 27.058823529411764,
    "yellowsPerMatch": 4.176470588235294,
    "redsPerMatch": 0.23529411764705882,
    "cornersPerMatch": 3.0294117647058822,
    "tacklesPerMatch": 56.14705882352941,
    "interceptionsPerMatch": 19.470588235294116,
    "drawRate": 0.2647058823529412,
    "zeroZeroRate": 0.14705882352941177,
    "blowoutRate": 0.08823529411764706,
    "lateGoalShare": 0.24390243902439024,
    "setPieceGoalShare": 0.15853658536585366,
    "averageEndingStamina": 69.3986582141383,
    "averagePossessionA": 0.5055629455647083,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 30.7,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-0": 6,
      "0-0": 5,
      "1-2": 3,
      "1-1": 3,
      "3-0": 2,
      "4-1": 2,
      "0-1": 2,
      "0-5": 2,
      "3-1": 2,
      "0-2": 1,
      "0-4": 1,
      "2-1": 1,
      "2-2": 1,
      "2-5": 1,
      "2-0": 1,
      "0-3": 1
    }
  },
  "parity": {
    "name": "parity",
    "games": 15,
    "goalsPerMatch": 3.2,
    "shotsPerMatch": 27.133333333333333,
    "xgPerMatch": 3.131901310371193,
    "onTargetRate": 0.3832923832923833,
    "passCompletion": 0.8179982693971733,
    "foulsPerMatch": 22.266666666666666,
    "yellowsPerMatch": 3.6,
    "redsPerMatch": 0.2,
    "cornersPerMatch": 4.533333333333333,
    "tacklesPerMatch": 55.2,
    "interceptionsPerMatch": 18,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0,
    "blowoutRate": 0.06666666666666667,
    "lateGoalShare": 0.125,
    "setPieceGoalShare": 0.125,
    "averageEndingStamina": 70.78170131942649,
    "averagePossessionA": 0.5073418290921247,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 34.6,
    "maxGoals": 6,
    "scoreFrequency": {
      "2-1": 2,
      "1-1": 2,
      "2-2": 2,
      "1-2": 2,
      "3-1": 1,
      "3-3": 1,
      "0-1": 1,
      "1-0": 1,
      "0-5": 1,
      "4-1": 1,
      "2-0": 1
    },
    "paritySideAWinShare": 0.6
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 17,
    "goalsPerMatch": 2.7058823529411766,
    "shotsPerMatch": 23.470588235294116,
    "xgPerMatch": 3.036883308510971,
    "onTargetRate": 0.3433583959899749,
    "passCompletion": 0.8091275844679778,
    "foulsPerMatch": 25.764705882352942,
    "yellowsPerMatch": 3.3529411764705883,
    "redsPerMatch": 0.11764705882352941,
    "cornersPerMatch": 4.411764705882353,
    "tacklesPerMatch": 52.8235294117647,
    "interceptionsPerMatch": 20,
    "drawRate": 0.29411764705882354,
    "zeroZeroRate": 0.11764705882352941,
    "blowoutRate": 0.11764705882352941,
    "lateGoalShare": 0.13043478260869565,
    "setPieceGoalShare": 0.15217391304347827,
    "averageEndingStamina": 69.39895164050118,
    "averagePossessionA": 0.5032218734473319,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 32,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-1": 2,
      "0-0": 2,
      "0-2": 2,
      "2-0": 1,
      "0-1": 1,
      "2-2": 1,
      "3-1": 1,
      "5-0": 1,
      "2-1": 1,
      "2-4": 1,
      "3-0": 1,
      "0-4": 1,
      "1-0": 1,
      "4-1": 1
    },
    "favoriteWinRate": 0.5882352941176471
  },
  "formations": {
    "name": "formations",
    "games": 16,
    "goalsPerMatch": 3.1875,
    "shotsPerMatch": 26.25,
    "xgPerMatch": 3.262258705899485,
    "onTargetRate": 0.37857142857142856,
    "passCompletion": 0.8137931034482758,
    "foulsPerMatch": 21.3125,
    "yellowsPerMatch": 3.5625,
    "redsPerMatch": 0.0625,
    "cornersPerMatch": 5.25,
    "tacklesPerMatch": 52,
    "interceptionsPerMatch": 16.8125,
    "drawRate": 0.375,
    "zeroZeroRate": 0.0625,
    "blowoutRate": 0.125,
    "lateGoalShare": 0.19607843137254902,
    "setPieceGoalShare": 0.09803921568627451,
    "averageEndingStamina": 68.93736526416023,
    "averagePossessionA": 0.5085376743626898,
    "goalP50": 3,
    "goalP90": 5.5,
    "shotP90": 31.5,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-1": 4,
      "2-1": 2,
      "3-0": 2,
      "2-2": 1,
      "4-2": 1,
      "3-2": 1,
      "3-1": 1,
      "0-0": 1,
      "2-0": 1,
      "1-5": 1,
      "0-4": 1
    }
  },
  "styles": {
    "name": "styles",
    "games": 18,
    "goalsPerMatch": 2.8333333333333335,
    "shotsPerMatch": 25.77777777777778,
    "xgPerMatch": 3.309996873568302,
    "onTargetRate": 0.3448275862068966,
    "passCompletion": 0.8248749106504646,
    "foulsPerMatch": 19.444444444444443,
    "yellowsPerMatch": 3.1666666666666665,
    "redsPerMatch": 0.16666666666666666,
    "cornersPerMatch": 4.333333333333333,
    "tacklesPerMatch": 46.333333333333336,
    "interceptionsPerMatch": 16.77777777777778,
    "drawRate": 0.2777777777777778,
    "zeroZeroRate": 0.1111111111111111,
    "blowoutRate": 0.05555555555555555,
    "lateGoalShare": 0.23529411764705882,
    "setPieceGoalShare": 0.13725490196078433,
    "averageEndingStamina": 69.99363731864716,
    "averagePossessionA": 0.5041800732551298,
    "goalP50": 2.5,
    "goalP90": 5.300000000000001,
    "shotP90": 34.3,
    "maxGoals": 6,
    "scoreFrequency": {
      "1-0": 3,
      "0-0": 2,
      "1-1": 2,
      "2-4": 2,
      "1-2": 2,
      "2-3": 1,
      "2-2": 1,
      "1-4": 1,
      "0-1": 1,
      "0-2": 1,
      "4-0": 1,
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
    "drawRate": 0.5,
    "goalDelta": 0,
    "xgDelta": 0.427874228727677,
    "possessionDelta": 0.21362196903811936,
    "passCompletionDelta": 0.04536334667166428,
    "crossDelta": -0.75,
    "throughBallDelta": -4.25,
    "pressWinsDelta": 2.5,
    "staminaDelta": 1.5694742189224336,
    "shotsForDelta": 1,
    "shotsAllowedDelta": -1
  },
  "counter": {
    "games": 4,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.75,
    "xgDelta": -1.0204099628664385,
    "possessionDelta": -0.040853704479007186,
    "passCompletionDelta": 0.03383654618430901,
    "crossDelta": -0.5,
    "throughBallDelta": 0,
    "pressWinsDelta": 1.5,
    "staminaDelta": 4.968464785520808,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  },
  "press": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0.5,
    "xgDelta": 0.1393396604663545,
    "possessionDelta": -0.003218444436398432,
    "passCompletionDelta": 0.03165831336322228,
    "crossDelta": -1,
    "throughBallDelta": 4.5,
    "pressWinsDelta": 21.5,
    "staminaDelta": -7.211299267172155,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "direct": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0,
    "xgDelta": 1.1714580409726576,
    "possessionDelta": -0.11349659307612484,
    "passCompletionDelta": -0.0060049549160257065,
    "crossDelta": 0.5,
    "throughBallDelta": 2.5,
    "pressWinsDelta": 2,
    "staminaDelta": -0.5329698977310855,
    "shotsForDelta": 2.5,
    "shotsAllowedDelta": -2.5
  },
  "wings": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0.5,
    "xgDelta": 0.10236984203320765,
    "possessionDelta": 0.0808389498350652,
    "passCompletionDelta": 0.004090612777053415,
    "crossDelta": 0,
    "throughBallDelta": 0.5,
    "pressWinsDelta": 4.5,
    "staminaDelta": 0.5525787615088831,
    "shotsForDelta": 2.5,
    "shotsAllowedDelta": -2.5
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
    "goalDelta": -2,
    "xgDelta": -1.0576717275373895,
    "possessionDelta": 0.04318025208851975,
    "passCompletionDelta": 0.013172452354326791,
    "crossDelta": -1.5,
    "throughBallDelta": 6,
    "pressWinsDelta": -5,
    "staminaDelta": 5.376194441352894,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  }
}
```
