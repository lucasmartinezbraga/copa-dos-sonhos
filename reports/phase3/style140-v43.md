# Laboratório estatístico — style140-v43

- Partidas: **140**
- Motor: **4.3.0**
- Passo: **0.016666666666666666s**
- Workers: **4**
- Tempo: **222.7s**
- Nota de calibração: **79.2/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.4571 | 2.4–3.2 | OK |
| shotsPerMatch | 21.6143 | 20–30 | OK |
| xgPerMatch | 2.5435 | 2.3–3.5 | OK |
| onTargetRate | 0.3701 | 0.34–0.47 | OK |
| passCompletion | 0.8261 | 0.75–0.89 | OK |
| foulsPerMatch | 19.9643 | 16–28 | OK |
| yellowsPerMatch | 3.3571 | 2.4–5.6 | OK |
| redsPerMatch | 0.1857 | 0.06–0.3 | OK |
| cornersPerMatch | 4.6643 | 5–11.5 | BAIXO |
| drawRate | 0.3571 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1643 | 0.045–0.12 | ALTO |
| blowoutRate | 0.0143 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.1628 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1134 | 0.1–0.27 | OK |
| averageEndingStamina | 71.3085 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 140,
    "goalsPerMatch": 2.4571428571428573,
    "shotsPerMatch": 21.614285714285714,
    "xgPerMatch": 2.543505108761133,
    "onTargetRate": 0.3701255783212161,
    "passCompletion": 0.8260869565217391,
    "foulsPerMatch": 19.964285714285715,
    "yellowsPerMatch": 3.357142857142857,
    "redsPerMatch": 0.18571428571428572,
    "cornersPerMatch": 4.664285714285715,
    "tacklesPerMatch": 43.93571428571428,
    "interceptionsPerMatch": 16.135714285714286,
    "drawRate": 0.35714285714285715,
    "zeroZeroRate": 0.16428571428571428,
    "blowoutRate": 0.014285714285714285,
    "lateGoalShare": 0.16279069767441862,
    "setPieceGoalShare": 0.11337209302325581,
    "averageEndingStamina": 71.30852093780939,
    "averagePossessionA": 0.5043905995369878,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 32.10000000000001,
    "maxGoals": 9,
    "scoreFrequency": {
      "0-0": 23,
      "2-1": 21,
      "1-0": 15,
      "1-1": 14,
      "0-1": 13,
      "2-2": 9,
      "2-0": 7,
      "0-2": 6,
      "3-2": 5,
      "1-2": 4,
      "3-3": 3,
      "2-3": 3,
      "3-4": 3,
      "1-3": 3,
      "3-1": 2,
      "0-3": 2
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 20,
    "winRate": 0.55,
    "drawRate": 0.25,
    "goalDelta": 0.6,
    "xgDelta": 0.6939057769550685,
    "possessionDelta": 0.06562928716884106,
    "passCompletionDelta": 0.012223785062367255,
    "crossDelta": -0.55,
    "throughBallDelta": -1.25,
    "pressWinsDelta": 0.4,
    "staminaDelta": 1.9182465735299246,
    "shotsForDelta": 1.1,
    "shotsAllowedDelta": -1.1
  },
  "counter": {
    "games": 20,
    "winRate": 0.35,
    "drawRate": 0.4,
    "goalDelta": 0,
    "xgDelta": -0.4459848054685637,
    "possessionDelta": -0.06304413515632559,
    "passCompletionDelta": -0.03349968364426698,
    "crossDelta": -0.95,
    "throughBallDelta": 7.05,
    "pressWinsDelta": -1.4,
    "staminaDelta": 1.4844831993850427,
    "shotsForDelta": -2.6,
    "shotsAllowedDelta": 2.6
  },
  "press": {
    "games": 20,
    "winRate": 0.4,
    "drawRate": 0.4,
    "goalDelta": 0.3,
    "xgDelta": 0.4862398478558851,
    "possessionDelta": -0.04213529741653122,
    "passCompletionDelta": -0.022996166006299258,
    "crossDelta": 0.5,
    "throughBallDelta": 1.3,
    "pressWinsDelta": 9.8,
    "staminaDelta": -7.467585779648789,
    "shotsForDelta": 2.65,
    "shotsAllowedDelta": -2.65
  },
  "direct": {
    "games": 20,
    "winRate": 0.45,
    "drawRate": 0.25,
    "goalDelta": 0.4,
    "xgDelta": 0.25674351937676865,
    "possessionDelta": -0.07035019269520018,
    "passCompletionDelta": -0.052818951727616505,
    "crossDelta": -0.95,
    "throughBallDelta": 4.75,
    "pressWinsDelta": 0.9,
    "staminaDelta": -0.25337390439929663,
    "shotsForDelta": 1.9,
    "shotsAllowedDelta": -1.9
  },
  "wings": {
    "games": 20,
    "winRate": 0.35,
    "drawRate": 0.4,
    "goalDelta": 0.15,
    "xgDelta": -0.21132198882335018,
    "possessionDelta": -0.05062658556689521,
    "passCompletionDelta": -0.033887534268625744,
    "crossDelta": 2.65,
    "throughBallDelta": 3.7,
    "pressWinsDelta": -0.05,
    "staminaDelta": 1.427300192228826,
    "shotsForDelta": -0.95,
    "shotsAllowedDelta": 0.95
  },
  "balanced": {
    "games": 20,
    "winRate": 0.35,
    "drawRate": 0.3,
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
    "games": 20,
    "winRate": 0.15,
    "drawRate": 0.5,
    "goalDelta": -0.15,
    "xgDelta": -0.3599104820633351,
    "possessionDelta": 0.008644119033882736,
    "passCompletionDelta": -0.018524338846021986,
    "crossDelta": -1.3,
    "throughBallDelta": 7.35,
    "pressWinsDelta": -1.2,
    "staminaDelta": 3.3949540067678505,
    "shotsForDelta": -2.5,
    "shotsAllowedDelta": 2.5
  }
}
```
