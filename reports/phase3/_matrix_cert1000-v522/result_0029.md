# Laboratório estatístico — cert1000-v522-chunk-29

- Partidas: **25**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **166.0s**
- Nota de calibração: **68.4/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.3200 | 2.4–3.2 | BAIXO |
| shotsPerMatch | 20.8800 | 20–30 | OK |
| xgPerMatch | 2.6313 | 2.3–3.5 | OK |
| onTargetRate | 0.3352 | 0.34–0.47 | BAIXO |
| passCompletion | 0.8294 | 0.75–0.89 | OK |
| foulsPerMatch | 21.4400 | 16–28 | OK |
| yellowsPerMatch | 3.2000 | 2.4–5.6 | OK |
| redsPerMatch | 0.2800 | 0.06–0.3 | OK |
| cornersPerMatch | 4.3200 | 5–11.5 | BAIXO |
| drawRate | 0.3200 | 0.2–0.33 | OK |
| zeroZeroRate | 0.2000 | 0.045–0.12 | ALTO |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.2759 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.0690 | 0.1–0.27 | BAIXO |
| paritySideAWinShare | 0.4118 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 70.8400 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 25,
    "goalsPerMatch": 2.32,
    "shotsPerMatch": 20.88,
    "xgPerMatch": 2.6312660762005553,
    "onTargetRate": 0.33524904214559387,
    "passCompletion": 0.8294147932040501,
    "foulsPerMatch": 21.44,
    "yellowsPerMatch": 3.2,
    "redsPerMatch": 0.28,
    "cornersPerMatch": 4.32,
    "tacklesPerMatch": 48.2,
    "interceptionsPerMatch": 15.24,
    "drawRate": 0.32,
    "zeroZeroRate": 0.2,
    "blowoutRate": 0,
    "lateGoalShare": 0.27586206896551724,
    "setPieceGoalShare": 0.06896551724137931,
    "averageEndingStamina": 70.84002128177785,
    "averagePossessionA": 0.49999208912966664,
    "goalP50": 3,
    "goalP90": 4,
    "shotP90": 27.6,
    "maxGoals": 5,
    "scoreFrequency": {
      "0-0": 5,
      "0-1": 4,
      "2-2": 3,
      "1-2": 3,
      "2-1": 2,
      "1-0": 2,
      "3-1": 2,
      "1-3": 1,
      "1-4": 1,
      "3-2": 1,
      "0-3": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.25,
    "goalDelta": -0.75,
    "xgDelta": 0.22812449851721528,
    "possessionDelta": -0.011862372245652314,
    "passCompletionDelta": 0.011510000692285638,
    "crossDelta": 1.25,
    "throughBallDelta": -2.75,
    "pressWinsDelta": 1,
    "staminaDelta": -2.9954018632490502,
    "shotsForDelta": 2.5,
    "shotsAllowedDelta": -2.5
  },
  "counter": {
    "games": 4,
    "winRate": 0.75,
    "drawRate": 0,
    "goalDelta": 0.5,
    "xgDelta": -0.5030648542261473,
    "possessionDelta": 0.029143225669888737,
    "passCompletionDelta": -0.08264372016405394,
    "crossDelta": -0.5,
    "throughBallDelta": 1.25,
    "pressWinsDelta": -1,
    "staminaDelta": 2.1456660689085716,
    "shotsForDelta": -4,
    "shotsAllowedDelta": 4
  },
  "press": {
    "games": 4,
    "winRate": 0.75,
    "drawRate": 0.25,
    "goalDelta": 1.75,
    "xgDelta": 0.9701207365740636,
    "possessionDelta": 0.03092974049218787,
    "passCompletionDelta": 0.006587338178662638,
    "crossDelta": 1.5,
    "throughBallDelta": -0.25,
    "pressWinsDelta": 20.25,
    "staminaDelta": -6.141899591386071,
    "shotsForDelta": 8.25,
    "shotsAllowedDelta": -8.25
  },
  "direct": {
    "games": 2,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.5,
    "xgDelta": 0.25172699074335425,
    "possessionDelta": -0.08121545006015596,
    "passCompletionDelta": -0.006693510737628361,
    "crossDelta": 1.5,
    "throughBallDelta": 1.5,
    "pressWinsDelta": 0.5,
    "staminaDelta": 1.1623885571313792,
    "shotsForDelta": 2,
    "shotsAllowedDelta": -2
  },
  "wings": {
    "games": 3,
    "winRate": 0,
    "drawRate": 0.3333333333333333,
    "goalDelta": -1.3333333333333333,
    "xgDelta": -1.2239177037614424,
    "possessionDelta": -0.061443936615426374,
    "passCompletionDelta": -0.02889197746448539,
    "crossDelta": -1.3333333333333333,
    "throughBallDelta": 5.666666666666667,
    "pressWinsDelta": 3.3333333333333335,
    "staminaDelta": -1.2503554837036006,
    "shotsForDelta": -4.333333333333333,
    "shotsAllowedDelta": 4.333333333333333
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
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.75,
    "xgDelta": -0.4150304500320541,
    "possessionDelta": -0.028983581249130794,
    "passCompletionDelta": -0.01952157475122346,
    "crossDelta": 1,
    "throughBallDelta": 6.75,
    "pressWinsDelta": -1.75,
    "staminaDelta": 4.388929466988053,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  }
}
```
