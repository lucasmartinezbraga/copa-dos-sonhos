# Laboratório estatístico — corners-nudge-v522

- Partidas: **200**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **4**
- Tempo: **302.5s**
- Nota de calibração: **88.1/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.9950 | 2.4–3.2 | OK |
| shotsPerMatch | 23.1550 | 20–30 | OK |
| xgPerMatch | 2.9155 | 2.3–3.5 | OK |
| onTargetRate | 0.3656 | 0.34–0.47 | OK |
| passCompletion | 0.8090 | 0.75–0.89 | OK |
| foulsPerMatch | 22.9100 | 16–28 | OK |
| yellowsPerMatch | 3.4450 | 2.4–5.6 | OK |
| redsPerMatch | 0.1300 | 0.06–0.3 | OK |
| cornersPerMatch | 4.8250 | 5–11.5 | BAIXO |
| drawRate | 0.3200 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0800 | 0.045–0.12 | OK |
| blowoutRate | 0.0850 | 0.025–0.13 | OK |
| lateGoalShare | 0.1786 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1402 | 0.1–0.27 | OK |
| favoriteWinRate | 0.7353 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.4485 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 70.0398 | 64–83 | OK |

## Suites

```json
{
  "random": {
    "name": "random",
    "games": 68,
    "goalsPerMatch": 2.7058823529411766,
    "shotsPerMatch": 20.88235294117647,
    "xgPerMatch": 2.764530023912594,
    "onTargetRate": 0.36338028169014086,
    "passCompletion": 0.7981576124676636,
    "foulsPerMatch": 24.66176470588235,
    "yellowsPerMatch": 3.6470588235294117,
    "redsPerMatch": 0.1323529411764706,
    "cornersPerMatch": 4.279411764705882,
    "tacklesPerMatch": 50.455882352941174,
    "interceptionsPerMatch": 20.029411764705884,
    "drawRate": 0.27941176470588236,
    "zeroZeroRate": 0.10294117647058823,
    "blowoutRate": 0.07352941176470588,
    "lateGoalShare": 0.16847826086956522,
    "setPieceGoalShare": 0.1358695652173913,
    "averageEndingStamina": 69.31386557745266,
    "averagePossessionA": 0.49902768059108465,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 28,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-1": 10,
      "1-3": 8,
      "0-0": 7,
      "1-2": 7,
      "0-1": 6,
      "2-1": 6,
      "1-0": 3,
      "0-3": 3,
      "3-0": 3,
      "0-2": 2,
      "2-2": 2,
      "6-0": 1,
      "3-1": 1,
      "5-1": 1,
      "1-6": 1,
      "4-1": 1
    }
  },
  "parity": {
    "name": "parity",
    "games": 30,
    "goalsPerMatch": 2.8333333333333335,
    "shotsPerMatch": 24.5,
    "xgPerMatch": 2.6939265735337226,
    "onTargetRate": 0.37551020408163266,
    "passCompletion": 0.81602628195972,
    "foulsPerMatch": 24.333333333333332,
    "yellowsPerMatch": 3.1666666666666665,
    "redsPerMatch": 0.1,
    "cornersPerMatch": 5.033333333333333,
    "tacklesPerMatch": 50.5,
    "interceptionsPerMatch": 18.6,
    "drawRate": 0.4,
    "zeroZeroRate": 0.03333333333333333,
    "blowoutRate": 0.03333333333333333,
    "lateGoalShare": 0.2235294117647059,
    "setPieceGoalShare": 0.21176470588235294,
    "averageEndingStamina": 70.75979537482657,
    "averagePossessionA": 0.49239486032518726,
    "goalP50": 2,
    "goalP90": 5.100000000000001,
    "shotP90": 38,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-1": 7,
      "1-2": 4,
      "2-0": 3,
      "0-1": 2,
      "0-2": 2,
      "2-2": 2,
      "1-4": 2,
      "2-1": 2,
      "3-3": 2,
      "0-0": 1,
      "3-0": 1,
      "1-0": 1,
      "6-1": 1
    },
    "paritySideAWinShare": 0.4444444444444444
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 34,
    "goalsPerMatch": 3.3529411764705883,
    "shotsPerMatch": 24.441176470588236,
    "xgPerMatch": 3.362790098691125,
    "onTargetRate": 0.34777376654632974,
    "passCompletion": 0.8061928043123981,
    "foulsPerMatch": 23.764705882352942,
    "yellowsPerMatch": 3.6176470588235294,
    "redsPerMatch": 0.11764705882352941,
    "cornersPerMatch": 4.647058823529412,
    "tacklesPerMatch": 49.26470588235294,
    "interceptionsPerMatch": 20.41176470588235,
    "drawRate": 0.2647058823529412,
    "zeroZeroRate": 0.11764705882352941,
    "blowoutRate": 0.20588235294117646,
    "lateGoalShare": 0.17543859649122806,
    "setPieceGoalShare": 0.09649122807017543,
    "averageEndingStamina": 70.25802504843588,
    "averagePossessionA": 0.4902664666778471,
    "goalP50": 3,
    "goalP90": 6,
    "shotP90": 34,
    "maxGoals": 7,
    "scoreFrequency": {
      "2-1": 4,
      "0-0": 4,
      "2-0": 3,
      "2-2": 3,
      "6-0": 2,
      "1-6": 2,
      "1-1": 2,
      "1-2": 2,
      "0-3": 1,
      "3-4": 1,
      "0-6": 1,
      "3-2": 1,
      "0-1": 1,
      "4-1": 1,
      "1-5": 1,
      "1-4": 1
    },
    "favoriteWinRate": 0.7352941176470589
  },
  "styles": {
    "name": "styles",
    "games": 36,
    "goalsPerMatch": 3.3055555555555554,
    "shotsPerMatch": 23.97222222222222,
    "xgPerMatch": 2.878756693819718,
    "onTargetRate": 0.3684820393974508,
    "passCompletion": 0.8212121212121212,
    "foulsPerMatch": 19.5,
    "yellowsPerMatch": 3.2777777777777777,
    "redsPerMatch": 0.2222222222222222,
    "cornersPerMatch": 5.222222222222222,
    "tacklesPerMatch": 45.80555555555556,
    "interceptionsPerMatch": 15.444444444444445,
    "drawRate": 0.3888888888888889,
    "zeroZeroRate": 0.08333333333333333,
    "blowoutRate": 0.08333333333333333,
    "lateGoalShare": 0.14285714285714285,
    "setPieceGoalShare": 0.11764705882352941,
    "averageEndingStamina": 70.49938624590504,
    "averagePossessionA": 0.5046085393751001,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 33.5,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 6,
      "3-2": 4,
      "3-1": 4,
      "1-2": 4,
      "0-0": 3,
      "2-2": 3,
      "0-4": 2,
      "2-0": 1,
      "1-0": 1,
      "2-1": 1,
      "3-3": 1,
      "0-1": 1,
      "3-0": 1,
      "6-2": 1,
      "0-2": 1,
      "4-4": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 32,
    "goalsPerMatch": 3.03125,
    "shotsPerMatch": 24.4375,
    "xgPerMatch": 3.009974814447431,
    "onTargetRate": 0.37595907928388744,
    "passCompletion": 0.814829876643622,
    "foulsPerMatch": 20.78125,
    "yellowsPerMatch": 3.28125,
    "redsPerMatch": 0.0625,
    "cornersPerMatch": 5.53125,
    "tacklesPerMatch": 45.28125,
    "interceptionsPerMatch": 17.65625,
    "drawRate": 0.3125,
    "zeroZeroRate": 0.03125,
    "blowoutRate": 0.03125,
    "lateGoalShare": 0.20618556701030927,
    "setPieceGoalShare": 0.16494845360824742,
    "averageEndingStamina": 70.15826775689456,
    "averagePossessionA": 0.5007597495498735,
    "goalP50": 3,
    "goalP90": 5.900000000000002,
    "shotP90": 33,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 6,
      "0-1": 4,
      "0-2": 4,
      "2-1": 4,
      "2-2": 3,
      "0-3": 2,
      "1-2": 2,
      "3-2": 1,
      "0-0": 1,
      "2-4": 1,
      "3-4": 1,
      "4-1": 1,
      "3-5": 1,
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
    "xgDelta": 0.5022239802874714,
    "possessionDelta": 0.2152665052835039,
    "passCompletionDelta": 0.024143022889461796,
    "crossDelta": 0.3333333333333333,
    "throughBallDelta": -1.5,
    "pressWinsDelta": 2.5,
    "staminaDelta": 1.3559843975160841,
    "shotsForDelta": 1.3333333333333333,
    "shotsAllowedDelta": -1.3333333333333333
  },
  "counter": {
    "games": 6,
    "winRate": 0.3333333333333333,
    "drawRate": 0.5,
    "goalDelta": 0.6666666666666666,
    "xgDelta": 0.496621704170225,
    "possessionDelta": 0.02333529041696843,
    "passCompletionDelta": -0.008802408058247724,
    "crossDelta": 1.6666666666666667,
    "throughBallDelta": 0.16666666666666666,
    "pressWinsDelta": 2.1666666666666665,
    "staminaDelta": 3.179101121071014,
    "shotsForDelta": 3.3333333333333335,
    "shotsAllowedDelta": -3.3333333333333335
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
    "drawRate": 0,
    "goalDelta": -0.6666666666666666,
    "xgDelta": 0.24054107676082537,
    "possessionDelta": -0.05451286063226785,
    "passCompletionDelta": -0.02539253220354602,
    "crossDelta": -0.8333333333333334,
    "throughBallDelta": 1.3333333333333333,
    "pressWinsDelta": 3.8333333333333335,
    "staminaDelta": -0.12874681684092573,
    "shotsForDelta": 4.333333333333333,
    "shotsAllowedDelta": -4.333333333333333
  },
  "wings": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.75,
    "xgDelta": -0.16006223419152138,
    "possessionDelta": -0.09364090635528267,
    "passCompletionDelta": -0.038524668306587045,
    "crossDelta": 0.5,
    "throughBallDelta": -2.5,
    "pressWinsDelta": -0.25,
    "staminaDelta": -3.17864159748369,
    "shotsForDelta": 1.75,
    "shotsAllowedDelta": -1.75
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
    "xgDelta": -1.1157526703979181,
    "possessionDelta": 0.03252755614768993,
    "passCompletionDelta": -0.05714308488119674,
    "crossDelta": -4,
    "throughBallDelta": 7,
    "pressWinsDelta": -2.5,
    "staminaDelta": 6.242404550092676,
    "shotsForDelta": -5.25,
    "shotsAllowedDelta": 5.25
  }
}
```
