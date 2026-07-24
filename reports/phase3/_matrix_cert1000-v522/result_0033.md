# Laboratório estatístico — cert1000-v522-chunk-33

- Partidas: **25**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **166.5s**
- Nota de calibração: **65.8/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 3.7600 | 2.4–3.2 | ALTO |
| shotsPerMatch | 27.5600 | 20–30 | OK |
| xgPerMatch | 3.1555 | 2.3–3.5 | OK |
| onTargetRate | 0.3745 | 0.34–0.47 | OK |
| passCompletion | 0.8137 | 0.75–0.89 | OK |
| foulsPerMatch | 21.3600 | 16–28 | OK |
| yellowsPerMatch | 3.1600 | 2.4–5.6 | OK |
| redsPerMatch | 0.2800 | 0.06–0.3 | OK |
| cornersPerMatch | 5.0400 | 5–11.5 | OK |
| drawRate | 0.2800 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0000 | 0.045–0.12 | BAIXO |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.2340 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1064 | 0.1–0.27 | OK |
| paritySideAWinShare | 0.2222 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 69.3839 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 15,
    "goalsPerMatch": 4.2,
    "shotsPerMatch": 29.066666666666666,
    "xgPerMatch": 3.2859855044948896,
    "onTargetRate": 0.3876146788990826,
    "passCompletion": 0.8234434375913475,
    "foulsPerMatch": 21.533333333333335,
    "yellowsPerMatch": 2.8666666666666667,
    "redsPerMatch": 0.2,
    "cornersPerMatch": 4.8,
    "tacklesPerMatch": 47.8,
    "interceptionsPerMatch": 15.933333333333334,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.30158730158730157,
    "setPieceGoalShare": 0.12698412698412698,
    "averageEndingStamina": 70.22399648080786,
    "averagePossessionA": 0.5215387918023343,
    "goalP50": 4,
    "goalP90": 5.6,
    "shotP90": 40.199999999999996,
    "maxGoals": 7,
    "scoreFrequency": {
      "2-3": 3,
      "1-1": 2,
      "1-3": 2,
      "2-2": 2,
      "3-2": 2,
      "4-3": 1,
      "3-3": 1,
      "0-2": 1,
      "1-2": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 10,
    "goalsPerMatch": 3.1,
    "shotsPerMatch": 25.3,
    "xgPerMatch": 2.9598897778887996,
    "onTargetRate": 0.35177865612648224,
    "passCompletion": 0.799124726477024,
    "foulsPerMatch": 21.1,
    "yellowsPerMatch": 3.6,
    "redsPerMatch": 0.4,
    "cornersPerMatch": 5.4,
    "tacklesPerMatch": 51.1,
    "interceptionsPerMatch": 18,
    "drawRate": 0.2,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.0967741935483871,
    "setPieceGoalShare": 0.06451612903225806,
    "averageEndingStamina": 68.12373769683316,
    "averagePossessionA": 0.4692724261825398,
    "goalP50": 2.5,
    "goalP90": 6.1,
    "shotP90": 40,
    "maxGoals": 7,
    "scoreFrequency": {
      "0-1": 4,
      "3-3": 2,
      "1-2": 2,
      "0-2": 1,
      "5-2": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 2,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -1,
    "xgDelta": -1.1485942304513244,
    "possessionDelta": -0.08102504832543297,
    "passCompletionDelta": -0.0055521709847889955,
    "crossDelta": -3.5,
    "throughBallDelta": -2.5,
    "pressWinsDelta": -2.5,
    "staminaDelta": -4.1106135486551665,
    "shotsForDelta": -5.5,
    "shotsAllowedDelta": 5.5
  },
  "counter": {
    "games": 2,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -1,
    "xgDelta": 0.194357019940666,
    "possessionDelta": -0.02476990465899967,
    "passCompletionDelta": -0.01467287818953289,
    "crossDelta": 0.5,
    "throughBallDelta": 1,
    "pressWinsDelta": 1.5,
    "staminaDelta": -0.05775975562026758,
    "shotsForDelta": -1,
    "shotsAllowedDelta": 1
  },
  "press": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0.5,
    "xgDelta": 0.5941636645838431,
    "possessionDelta": -0.011977605153976972,
    "passCompletionDelta": -0.046052322358940245,
    "crossDelta": 3.5,
    "throughBallDelta": -5,
    "pressWinsDelta": 22.5,
    "staminaDelta": -8.2753158009121,
    "shotsForDelta": 2.5,
    "shotsAllowedDelta": -2.5
  },
  "direct": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.5,
    "xgDelta": 0.9536995404296088,
    "possessionDelta": 0.012372662550283187,
    "passCompletionDelta": 0.03985235164234352,
    "crossDelta": 5.5,
    "throughBallDelta": -3,
    "pressWinsDelta": 2,
    "staminaDelta": -2.592916657319904,
    "shotsForDelta": 5.5,
    "shotsAllowedDelta": -5.5
  },
  "wings": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.5,
    "xgDelta": 0.63949880148365,
    "possessionDelta": -0.05022554594602696,
    "passCompletionDelta": -0.02252202723900837,
    "crossDelta": 1,
    "throughBallDelta": -3,
    "pressWinsDelta": 0.5,
    "staminaDelta": -0.3403712842073787,
    "shotsForDelta": 0.5,
    "shotsAllowedDelta": -0.5
  },
  "balanced": {
    "games": 3,
    "winRate": 0.3333333333333333,
    "drawRate": 0.3333333333333333,
    "goalDelta": 0,
    "xgDelta": -0.5875218333101394,
    "possessionDelta": -0.06646303523954801,
    "passCompletionDelta": -0.017608517608517598,
    "crossDelta": -0.3333333333333333,
    "throughBallDelta": 5,
    "pressWinsDelta": -1.6666666666666667,
    "staminaDelta": -1.3759888661553248,
    "shotsForDelta": -0.6666666666666666,
    "shotsAllowedDelta": 0.6666666666666666
  },
  "park": {
    "games": 2,
    "winRate": 0,
    "drawRate": 0,
    "goalDelta": -1,
    "xgDelta": -1.1461181747249247,
    "possessionDelta": -0.059126223060765565,
    "passCompletionDelta": -0.0525357142857143,
    "crossDelta": 1.5,
    "throughBallDelta": 8,
    "pressWinsDelta": 0,
    "staminaDelta": 5.384393758728699,
    "shotsForDelta": -5,
    "shotsAllowedDelta": 5
  }
}
```
