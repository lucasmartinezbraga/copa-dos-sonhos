# Laboratório estatístico — phase2-smoke-fast

- Partidas: **24**
- Motor: **4.0.0**
- Passo: **0.08s**
- Workers: **8**
- Tempo: **22.7s**
- Nota de calibração: **47.4/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.1667 | 2.4–3.2 | BAIXO |
| shotsPerMatch | 20.2500 | 20–30 | OK |
| xgPerMatch | 2.1607 | 2.3–3.5 | BAIXO |
| onTargetRate | 0.3930 | 0.34–0.47 | OK |
| passCompletion | 0.8116 | 0.75–0.89 | OK |
| foulsPerMatch | 39.6667 | 16–28 | ALTO |
| yellowsPerMatch | 7.0417 | 2.4–5.6 | ALTO |
| redsPerMatch | 1.2083 | 0.06–0.3 | ALTO |
| cornersPerMatch | 4.7917 | 5–11.5 | BAIXO |
| drawRate | 0.5000 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1667 | 0.045–0.12 | ALTO |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.1538 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1731 | 0.1–0.27 | OK |
| favoriteWinRate | 0.5000 | 0.6–0.79 | BAIXO |
| paritySideAWinShare | 0.3333 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 72.1945 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 6,
    "goalsPerMatch": 1.6666666666666667,
    "shotsPerMatch": 19.666666666666668,
    "xgPerMatch": 1.8747275749702492,
    "onTargetRate": 0.3220338983050847,
    "passCompletion": 0.816651904340124,
    "foulsPerMatch": 58.166666666666664,
    "yellowsPerMatch": 8.5,
    "redsPerMatch": 2.1666666666666665,
    "cornersPerMatch": 5.333333333333333,
    "tacklesPerMatch": 123.16666666666667,
    "interceptionsPerMatch": 16.666666666666668,
    "drawRate": 0.5,
    "zeroZeroRate": 0.16666666666666666,
    "blowoutRate": 0,
    "lateGoalShare": 0.3,
    "setPieceGoalShare": 0.2,
    "averageEndingStamina": 72.96260714411888,
    "averagePossessionA": 0.5211473988247461,
    "goalP50": 2,
    "goalP90": 2.5,
    "shotP90": 26,
    "maxGoals": 3,
    "scoreFrequency": {
      "1-1": 2,
      "1-0": 1,
      "1-2": 1,
      "0-0": 1,
      "0-2": 1
    },
    "paritySideAWinShare": 0.3333333333333333
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 4,
    "goalsPerMatch": 1.75,
    "shotsPerMatch": 19.5,
    "xgPerMatch": 2.321356334134049,
    "onTargetRate": 0.38461538461538464,
    "passCompletion": 0.8077373974208675,
    "foulsPerMatch": 34.75,
    "yellowsPerMatch": 5,
    "redsPerMatch": 0.25,
    "cornersPerMatch": 4.25,
    "tacklesPerMatch": 78,
    "interceptionsPerMatch": 18.25,
    "drawRate": 0.5,
    "zeroZeroRate": 0.25,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0.14285714285714285,
    "averageEndingStamina": 72.42329636841487,
    "averagePossessionA": 0.45918096118197865,
    "goalP50": 2,
    "goalP90": 2.7,
    "shotP90": 25.5,
    "maxGoals": 3,
    "scoreFrequency": {
      "0-2": 1,
      "1-1": 1,
      "0-3": 1,
      "0-0": 1
    },
    "favoriteWinRate": 0.5
  },
  "formations": {
    "name": "formations",
    "games": 5,
    "goalsPerMatch": 3,
    "shotsPerMatch": 24.8,
    "xgPerMatch": 2.3623038643340246,
    "onTargetRate": 0.49193548387096775,
    "passCompletion": 0.812807881773399,
    "foulsPerMatch": 35.2,
    "yellowsPerMatch": 7.6,
    "redsPerMatch": 1,
    "cornersPerMatch": 6.2,
    "tacklesPerMatch": 83,
    "interceptionsPerMatch": 16,
    "drawRate": 0.4,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.06666666666666667,
    "setPieceGoalShare": 0.26666666666666666,
    "averageEndingStamina": 71.50517821096453,
    "averagePossessionA": 0.4836147794962672,
    "goalP50": 3,
    "goalP90": 4,
    "shotP90": 35.6,
    "maxGoals": 4,
    "scoreFrequency": {
      "2-1": 2,
      "2-2": 2,
      "0-1": 1
    }
  },
  "random": {
    "name": "random",
    "games": 6,
    "goalsPerMatch": 1.8333333333333333,
    "shotsPerMatch": 18.666666666666668,
    "xgPerMatch": 2.145772625064844,
    "onTargetRate": 0.30357142857142855,
    "passCompletion": 0.7887864823348695,
    "foulsPerMatch": 30.5,
    "yellowsPerMatch": 6.833333333333333,
    "redsPerMatch": 1.1666666666666667,
    "cornersPerMatch": 3.5,
    "tacklesPerMatch": 61.166666666666664,
    "interceptionsPerMatch": 17.833333333333332,
    "drawRate": 0.5,
    "zeroZeroRate": 0.16666666666666666,
    "blowoutRate": 0,
    "lateGoalShare": 0.09090909090909091,
    "setPieceGoalShare": 0.09090909090909091,
    "averageEndingStamina": 71.56994407721915,
    "averagePossessionA": 0.5453285094170155,
    "goalP50": 2,
    "goalP90": 3,
    "shotP90": 25.5,
    "maxGoals": 3,
    "scoreFrequency": {
      "1-1": 2,
      "0-1": 1,
      "1-2": 1,
      "2-1": 1,
      "0-0": 1
    }
  },
  "styles": {
    "name": "styles",
    "games": 3,
    "goalsPerMatch": 3,
    "shotsPerMatch": 18,
    "xgPerMatch": 2.211921441055307,
    "onTargetRate": 0.5185185185185185,
    "passCompletion": 0.8530805687203792,
    "foulsPerMatch": 35,
    "yellowsPerMatch": 6.333333333333333,
    "redsPerMatch": 1,
    "cornersPerMatch": 4.666666666666667,
    "tacklesPerMatch": 75.33333333333333,
    "interceptionsPerMatch": 10.666666666666666,
    "drawRate": 0.6666666666666666,
    "zeroZeroRate": 0.3333333333333333,
    "blowoutRate": 0,
    "lateGoalShare": 0.3333333333333333,
    "setPieceGoalShare": 0.1111111111111111,
    "averageEndingStamina": 72.75133577560901,
    "averagePossessionA": 0.4927419626982572,
    "goalP50": 4,
    "goalP90": 4.8,
    "shotP90": 21.8,
    "maxGoals": 5,
    "scoreFrequency": {
      "2-3": 1,
      "2-2": 1,
      "0-0": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": -0.14906457453228644,
    "crossDelta": 1,
    "throughBallDelta": -2,
    "pressWinsDelta": 6,
    "staminaDelta": -0.8290435148174424,
    "shotsAllowedDelta": 7
  },
  "counter": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": 0.01232876712328762,
    "crossDelta": 0,
    "throughBallDelta": 9,
    "pressWinsDelta": 3,
    "staminaDelta": 2.261388125928491,
    "shotsAllowedDelta": 0
  },
  "press": {
    "games": 1,
    "goalDelta": 0,
    "possessionDelta": 0.11784511784511725,
    "crossDelta": 1,
    "throughBallDelta": 3,
    "pressWinsDelta": 28,
    "staminaDelta": -5.594688031257547,
    "shotsAllowedDelta": 10
  }
}
```
