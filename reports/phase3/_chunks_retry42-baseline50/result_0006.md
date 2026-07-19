# Laboratório estatístico — retry42-baseline50

- Partidas: **5**
- Motor: **4.2.0**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **20.6s**
- Nota de calibração: **60.4/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.4000 | 2.4–3.2 | OK |
| shotsPerMatch | 22.2000 | 20–30 | OK |
| xgPerMatch | 2.5244 | 2.3–3.5 | OK |
| onTargetRate | 0.3784 | 0.34–0.47 | OK |
| passCompletion | 0.8200 | 0.75–0.89 | OK |
| foulsPerMatch | 25.0000 | 16–28 | OK |
| yellowsPerMatch | 4.6000 | 2.4–5.6 | OK |
| redsPerMatch | 0.4000 | 0.06–0.3 | ALTO |
| cornersPerMatch | 3.8000 | 5–11.5 | BAIXO |
| drawRate | 0.2000 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0000 | 0.045–0.12 | BAIXO |
| blowoutRate | 0.2000 | 0.025–0.13 | ALTO |
| lateGoalShare | 0.0000 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.0833 | 0.1–0.27 | BAIXO |
| favoriteWinRate | 1.0000 | 0.6–0.79 | ALTO |
| averageEndingStamina | 69.9737 | 64–83 | OK |

## Suites

```json
{
  "strongWeak": {
    "name": "strongWeak",
    "games": 2,
    "goalsPerMatch": 2.5,
    "shotsPerMatch": 20,
    "xgPerMatch": 2.4097561387534063,
    "onTargetRate": 0.475,
    "passCompletion": 0.7882882882882883,
    "foulsPerMatch": 23,
    "yellowsPerMatch": 4,
    "redsPerMatch": 1,
    "cornersPerMatch": 4,
    "tacklesPerMatch": 54,
    "interceptionsPerMatch": 20,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0.5,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 70.16031792621024,
    "averagePossessionA": 0.44336007329885285,
    "goalP50": 2.5,
    "goalP90": 3.7,
    "shotP90": 20.8,
    "maxGoals": 4,
    "scoreFrequency": {
      "4-0": 1,
      "0-1": 1
    },
    "favoriteWinRate": 1
  },
  "styles": {
    "name": "styles",
    "games": 3,
    "goalsPerMatch": 2.3333333333333335,
    "shotsPerMatch": 23.666666666666668,
    "xgPerMatch": 2.6007542548971583,
    "onTargetRate": 0.323943661971831,
    "passCompletion": 0.8392370572207084,
    "foulsPerMatch": 26.333333333333332,
    "yellowsPerMatch": 5,
    "redsPerMatch": 0,
    "cornersPerMatch": 3.6666666666666665,
    "tacklesPerMatch": 57,
    "interceptionsPerMatch": 17.333333333333332,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0.14285714285714285,
    "averageEndingStamina": 69.84930431897835,
    "averagePossessionA": 0.4680811427316986,
    "goalP50": 2,
    "goalP90": 3.6,
    "shotP90": 34.8,
    "maxGoals": 4,
    "scoreFrequency": {
      "1-1": 1,
      "0-1": 1,
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
    "possessionDelta": -0.19942427634734838,
    "passCompletionDelta": -0.002244668911335568,
    "crossDelta": 2,
    "throughBallDelta": -2,
    "pressWinsDelta": 0,
    "staminaDelta": -3.9055915542252677,
    "shotsForDelta": 6,
    "shotsAllowedDelta": -6
  },
  "counter": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": -0.029737298306440285,
    "passCompletionDelta": -0.06818181818181823,
    "crossDelta": -1,
    "throughBallDelta": 17,
    "pressWinsDelta": -9,
    "staminaDelta": 7.2561236097299115,
    "shotsForDelta": -8,
    "shotsAllowedDelta": 8
  },
  "press": {
    "games": 1,
    "goalDelta": 2,
    "possessionDelta": -0.021826165568900602,
    "passCompletionDelta": 0.030753255052320405,
    "crossDelta": -3,
    "throughBallDelta": -4,
    "pressWinsDelta": 24,
    "staminaDelta": -4.622015768392686,
    "shotsForDelta": 7,
    "shotsAllowedDelta": -7
  }
}
```
