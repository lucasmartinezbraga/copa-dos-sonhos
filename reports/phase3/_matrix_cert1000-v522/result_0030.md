# Laboratório estatístico — cert1000-v522-chunk-30

- Partidas: **25**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **166.8s**
- Nota de calibração: **82.5/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.8800 | 2.4–3.2 | OK |
| shotsPerMatch | 29.5600 | 20–30 | OK |
| xgPerMatch | 2.9885 | 2.3–3.5 | OK |
| onTargetRate | 0.3424 | 0.34–0.47 | OK |
| passCompletion | 0.8241 | 0.75–0.89 | OK |
| foulsPerMatch | 20.2400 | 16–28 | OK |
| yellowsPerMatch | 3.5200 | 2.4–5.6 | OK |
| redsPerMatch | 0.2400 | 0.06–0.3 | OK |
| cornersPerMatch | 6.3600 | 5–11.5 | OK |
| drawRate | 0.2400 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0400 | 0.045–0.12 | BAIXO |
| blowoutRate | 0.0400 | 0.025–0.13 | OK |
| lateGoalShare | 0.2222 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1806 | 0.1–0.27 | OK |
| paritySideAWinShare | 0.6316 | 0.46–0.54 | ALTO |
| averageEndingStamina | 69.9953 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 25,
    "goalsPerMatch": 2.88,
    "shotsPerMatch": 29.56,
    "xgPerMatch": 2.9884820318157717,
    "onTargetRate": 0.3423545331529093,
    "passCompletion": 0.8241206030150754,
    "foulsPerMatch": 20.24,
    "yellowsPerMatch": 3.52,
    "redsPerMatch": 0.24,
    "cornersPerMatch": 6.36,
    "tacklesPerMatch": 45.44,
    "interceptionsPerMatch": 16.12,
    "drawRate": 0.24,
    "zeroZeroRate": 0.04,
    "blowoutRate": 0.04,
    "lateGoalShare": 0.2222222222222222,
    "setPieceGoalShare": 0.18055555555555555,
    "averageEndingStamina": 69.99533791450764,
    "averagePossessionA": 0.5055010026636461,
    "goalP50": 3,
    "goalP90": 4.600000000000001,
    "shotP90": 39.400000000000006,
    "maxGoals": 8,
    "scoreFrequency": {
      "1-1": 5,
      "2-1": 5,
      "0-1": 3,
      "1-3": 2,
      "3-1": 2,
      "1-2": 2,
      "0-0": 1,
      "1-0": 1,
      "3-2": 1,
      "2-0": 1,
      "5-1": 1,
      "5-3": 1
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
    "drawRate": 0.25,
    "goalDelta": -0.25,
    "xgDelta": 0.6454560482847985,
    "possessionDelta": 0.09279525517567433,
    "passCompletionDelta": -0.004697661200304043,
    "crossDelta": 1.75,
    "throughBallDelta": -2.75,
    "pressWinsDelta": 4.25,
    "staminaDelta": -2.5845391979309227,
    "shotsForDelta": 4,
    "shotsAllowedDelta": -4
  },
  "counter": {
    "games": 3,
    "winRate": 0.3333333333333333,
    "drawRate": 0,
    "goalDelta": 0,
    "xgDelta": -0.8118972606416364,
    "possessionDelta": -0.045037464286136364,
    "passCompletionDelta": -0.010979744142450546,
    "crossDelta": -1.6666666666666667,
    "throughBallDelta": 4.333333333333333,
    "pressWinsDelta": -1,
    "staminaDelta": 4.104323490988975,
    "shotsForDelta": -1.6666666666666667,
    "shotsAllowedDelta": 1.6666666666666667
  },
  "press": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0,
    "goalDelta": 0,
    "xgDelta": 0.9755266086030352,
    "possessionDelta": 0.04419134107185349,
    "passCompletionDelta": -0.0035874479056297037,
    "crossDelta": 0.5,
    "throughBallDelta": -3.5,
    "pressWinsDelta": 21.5,
    "staminaDelta": -7.555062914332989,
    "shotsForDelta": 5.5,
    "shotsAllowedDelta": -5.5
  },
  "direct": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.75,
    "goalDelta": -0.5,
    "xgDelta": -0.2504361871705036,
    "possessionDelta": 0.030450762593799155,
    "passCompletionDelta": 0.031405267082999705,
    "crossDelta": 2,
    "throughBallDelta": 3.75,
    "pressWinsDelta": 2,
    "staminaDelta": 2.0348263631807875,
    "shotsForDelta": -0.75,
    "shotsAllowedDelta": 0.75
  },
  "wings": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.25,
    "goalDelta": -1,
    "xgDelta": -0.41320811273446756,
    "possessionDelta": 0.04128398501849767,
    "passCompletionDelta": 0.01158291765317454,
    "crossDelta": -0.5,
    "throughBallDelta": -1.5,
    "pressWinsDelta": 3.5,
    "staminaDelta": -0.1870080250887547,
    "shotsForDelta": 0.25,
    "shotsAllowedDelta": -0.25
  },
  "balanced": {
    "games": 4,
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
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.25,
    "goalDelta": -1.25,
    "xgDelta": -1.5587164224306709,
    "possessionDelta": -0.05989034602918383,
    "passCompletionDelta": -0.05778967309322214,
    "crossDelta": -4.25,
    "throughBallDelta": 8,
    "pressWinsDelta": -3,
    "staminaDelta": 5.477442361708576,
    "shotsForDelta": -10.25,
    "shotsAllowedDelta": 10.25
  }
}
```
