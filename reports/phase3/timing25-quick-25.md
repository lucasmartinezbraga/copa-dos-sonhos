# Laboratório estatístico — timing25

- Partidas: **25**
- Motor: **4.1.0**
- Passo: **0.08s**
- Workers: **1**
- Tempo: **25.2s**
- Nota de calibração: **66.0/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.5200 | 2.4–3.2 | OK |
| shotsPerMatch | 21.9600 | 20–30 | OK |
| xgPerMatch | 2.6202 | 2.3–3.5 | OK |
| onTargetRate | 0.3752 | 0.34–0.47 | OK |
| passCompletion | 0.8174 | 0.75–0.89 | OK |
| foulsPerMatch | 26.8400 | 16–28 | OK |
| yellowsPerMatch | 4.0800 | 2.4–5.6 | OK |
| redsPerMatch | 0.4000 | 0.06–0.3 | ALTO |
| cornersPerMatch | 5.3200 | 5–11.5 | OK |
| drawRate | 0.1600 | 0.2–0.33 | BAIXO |
| zeroZeroRate | 0.0800 | 0.045–0.12 | OK |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.1587 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1270 | 0.1–0.27 | OK |
| favoriteWinRate | 1.0000 | 0.6–0.79 | ALTO |
| paritySideAWinShare | 0.3333 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 71.3715 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 3,
    "goalsPerMatch": 3,
    "shotsPerMatch": 24,
    "xgPerMatch": 3.2616351501897114,
    "onTargetRate": 0.3888888888888889,
    "passCompletion": 0.8376068376068376,
    "foulsPerMatch": 40.666666666666664,
    "yellowsPerMatch": 4.666666666666667,
    "redsPerMatch": 1.3333333333333333,
    "cornersPerMatch": 5.666666666666667,
    "tacklesPerMatch": 100.66666666666667,
    "interceptionsPerMatch": 14.333333333333334,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.1111111111111111,
    "setPieceGoalShare": 0.2222222222222222,
    "averageEndingStamina": 70.34039230888504,
    "averagePossessionA": 0.4669509734856652,
    "goalP50": 3,
    "goalP90": 3.8,
    "shotP90": 29,
    "maxGoals": 4,
    "scoreFrequency": {
      "1-3": 1,
      "1-2": 1,
      "2-0": 1
    },
    "paritySideAWinShare": 0.3333333333333333
  },
  "random": {
    "name": "random",
    "games": 8,
    "goalsPerMatch": 2.25,
    "shotsPerMatch": 21.5,
    "xgPerMatch": 2.3126720424701532,
    "onTargetRate": 0.3372093023255814,
    "passCompletion": 0.7971098265895954,
    "foulsPerMatch": 24.75,
    "yellowsPerMatch": 3.25,
    "redsPerMatch": 0.25,
    "cornersPerMatch": 4.625,
    "tacklesPerMatch": 55,
    "interceptionsPerMatch": 16.25,
    "drawRate": 0.25,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.2222222222222222,
    "setPieceGoalShare": 0.05555555555555555,
    "averageEndingStamina": 72.03198218530278,
    "averagePossessionA": 0.5149748806597042,
    "goalP50": 2,
    "goalP90": 3.3,
    "shotP90": 31.3,
    "maxGoals": 4,
    "scoreFrequency": {
      "0-2": 2,
      "0-3": 1,
      "1-0": 1,
      "2-2": 1,
      "1-1": 1,
      "3-0": 1,
      "0-1": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 4,
    "goalsPerMatch": 2.5,
    "shotsPerMatch": 20,
    "xgPerMatch": 2.566885222503346,
    "onTargetRate": 0.5125,
    "passCompletion": 0.8203723986856517,
    "foulsPerMatch": 24.25,
    "yellowsPerMatch": 4.25,
    "redsPerMatch": 0.25,
    "cornersPerMatch": 6.25,
    "tacklesPerMatch": 53.5,
    "interceptionsPerMatch": 17,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.3,
    "setPieceGoalShare": 0.2,
    "averageEndingStamina": 69.98639098342957,
    "averagePossessionA": 0.4840880244063987,
    "goalP50": 2.5,
    "goalP90": 3.7,
    "shotP90": 22,
    "maxGoals": 4,
    "scoreFrequency": {
      "3-1": 1,
      "0-1": 1,
      "2-1": 1,
      "0-2": 1
    },
    "favoriteWinRate": 1
  },
  "styles": {
    "name": "styles",
    "games": 4,
    "goalsPerMatch": 3.25,
    "shotsPerMatch": 28,
    "xgPerMatch": 3.1608104955275422,
    "onTargetRate": 0.35714285714285715,
    "passCompletion": 0.8226950354609929,
    "foulsPerMatch": 32.5,
    "yellowsPerMatch": 4.25,
    "redsPerMatch": 0.25,
    "cornersPerMatch": 6,
    "tacklesPerMatch": 64.75,
    "interceptionsPerMatch": 15.5,
    "drawRate": 0.25,
    "zeroZeroRate": 0.25,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 69.94242236893811,
    "averagePossessionA": 0.48163574234224943,
    "goalP50": 4,
    "goalP90": 5,
    "shotP90": 34.7,
    "maxGoals": 5,
    "scoreFrequency": {
      "0-0": 1,
      "3-2": 1,
      "2-3": 1,
      "0-3": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 6,
    "goalsPerMatch": 2.1666666666666665,
    "shotsPerMatch": 18.833333333333332,
    "xgPerMatch": 2.384772689529149,
    "onTargetRate": 0.34513274336283184,
    "passCompletion": 0.8293233082706767,
    "foulsPerMatch": 20.666666666666668,
    "yellowsPerMatch": 4.666666666666667,
    "redsPerMatch": 0.3333333333333333,
    "cornersPerMatch": 5,
    "tacklesPerMatch": 48.666666666666664,
    "interceptionsPerMatch": 17.833333333333332,
    "drawRate": 0.16666666666666666,
    "zeroZeroRate": 0.16666666666666666,
    "blowoutRate": 0,
    "lateGoalShare": 0.15384615384615385,
    "setPieceGoalShare": 0.23076923076923078,
    "averageEndingStamina": 72.88235236984745,
    "averagePossessionA": 0.5025777049037624,
    "goalP50": 2,
    "goalP90": 4,
    "shotP90": 28,
    "maxGoals": 4,
    "scoreFrequency": {
      "1-2": 1,
      "0-0": 1,
      "0-1": 1,
      "1-0": 1,
      "1-3": 1,
      "3-1": 1
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
    "possessionDelta": -0.02394106813996305,
    "passCompletionDelta": -0.028369905956112884,
    "crossDelta": 0,
    "throughBallDelta": -2,
    "pressWinsDelta": 7,
    "staminaDelta": -4.480356642828028,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "counter": {
    "games": 1,
    "goalDelta": -1,
    "possessionDelta": -0.07468354430379703,
    "passCompletionDelta": -0.014389799635701306,
    "crossDelta": -1,
    "throughBallDelta": 2,
    "pressWinsDelta": -3,
    "staminaDelta": 0.05222386994459782,
    "shotsForDelta": 1,
    "shotsAllowedDelta": -1
  },
  "press": {
    "games": 1,
    "goalDelta": -1,
    "possessionDelta": -0.07028223574986131,
    "passCompletionDelta": -0.008947368421052593,
    "crossDelta": -1,
    "throughBallDelta": 2,
    "pressWinsDelta": 18,
    "staminaDelta": -10.359201512359014,
    "shotsForDelta": -3,
    "shotsAllowedDelta": 3
  },
  "direct": {
    "games": 1,
    "goalDelta": 3,
    "possessionDelta": 0.12737430167597702,
    "passCompletionDelta": 0.05853570134106567,
    "crossDelta": -1,
    "throughBallDelta": -1,
    "pressWinsDelta": 12,
    "staminaDelta": 2.496730130905192,
    "shotsForDelta": 4,
    "shotsAllowedDelta": -4
  }
}
```
