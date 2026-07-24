# Laboratório estatístico — cert1000-v522-chunk-28

- Partidas: **25**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **161.9s**
- Nota de calibração: **73.8/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.0400 | 2.4–3.2 | BAIXO |
| shotsPerMatch | 23.7200 | 20–30 | OK |
| xgPerMatch | 2.4571 | 2.3–3.5 | OK |
| onTargetRate | 0.3305 | 0.34–0.47 | BAIXO |
| passCompletion | 0.8166 | 0.75–0.89 | OK |
| foulsPerMatch | 21.3600 | 16–28 | OK |
| yellowsPerMatch | 3.8400 | 2.4–5.6 | OK |
| redsPerMatch | 0.2400 | 0.06–0.3 | OK |
| cornersPerMatch | 5.8000 | 5–11.5 | OK |
| drawRate | 0.4800 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1200 | 0.045–0.12 | OK |
| blowoutRate | 0.0400 | 0.025–0.13 | OK |
| lateGoalShare | 0.1765 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.2745 | 0.1–0.27 | ALTO |
| paritySideAWinShare | 0.5385 | 0.46–0.54 | OK |
| averageEndingStamina | 70.1842 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 25,
    "goalsPerMatch": 2.04,
    "shotsPerMatch": 23.72,
    "xgPerMatch": 2.457090903775119,
    "onTargetRate": 0.3305227655986509,
    "passCompletion": 0.8166380789022298,
    "foulsPerMatch": 21.36,
    "yellowsPerMatch": 3.84,
    "redsPerMatch": 0.24,
    "cornersPerMatch": 5.8,
    "tacklesPerMatch": 47,
    "interceptionsPerMatch": 19.44,
    "drawRate": 0.48,
    "zeroZeroRate": 0.12,
    "blowoutRate": 0.04,
    "lateGoalShare": 0.17647058823529413,
    "setPieceGoalShare": 0.27450980392156865,
    "averageEndingStamina": 70.18418507864283,
    "averagePossessionA": 0.5141021394321913,
    "goalP50": 2,
    "goalP90": 4,
    "shotP90": 33,
    "maxGoals": 4,
    "scoreFrequency": {
      "1-1": 7,
      "0-1": 4,
      "0-0": 3,
      "2-1": 2,
      "2-0": 2,
      "1-2": 2,
      "2-2": 2,
      "1-0": 1,
      "3-1": 1,
      "4-0": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 4,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 0.5,
    "xgDelta": 0.12822285587321902,
    "possessionDelta": 0.26533528945748575,
    "passCompletionDelta": 0.07074585611456405,
    "crossDelta": 0.75,
    "throughBallDelta": -5.25,
    "pressWinsDelta": 1,
    "staminaDelta": 2.8029061881206054,
    "shotsForDelta": -0.5,
    "shotsAllowedDelta": 0.5
  },
  "counter": {
    "games": 4,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.75,
    "xgDelta": -0.4380979902486701,
    "possessionDelta": -0.06134342358650227,
    "passCompletionDelta": -0.02965760956255903,
    "crossDelta": -1.25,
    "throughBallDelta": -1.5,
    "pressWinsDelta": 1.5,
    "staminaDelta": 0.6452251610157731,
    "shotsForDelta": -0.25,
    "shotsAllowedDelta": 0.25
  },
  "press": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.75,
    "goalDelta": 1,
    "xgDelta": 0.5666167961918493,
    "possessionDelta": 0.09497973473683088,
    "passCompletionDelta": -0.011157139050760823,
    "crossDelta": 0.75,
    "throughBallDelta": -4.25,
    "pressWinsDelta": 16.5,
    "staminaDelta": -7.4499276761878015,
    "shotsForDelta": 2.25,
    "shotsAllowedDelta": -2.25
  },
  "direct": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.5,
    "goalDelta": -0.25,
    "xgDelta": -0.4187885314296643,
    "possessionDelta": -0.004782640273794242,
    "passCompletionDelta": -0.028429815856722884,
    "crossDelta": -0.5,
    "throughBallDelta": 0.75,
    "pressWinsDelta": 2.25,
    "staminaDelta": 1.8709756704821032,
    "shotsForDelta": -0.25,
    "shotsAllowedDelta": 0.25
  },
  "wings": {
    "games": 3,
    "winRate": 0.3333333333333333,
    "drawRate": 0.3333333333333333,
    "goalDelta": 0,
    "xgDelta": -0.07414075211792936,
    "possessionDelta": 0.018739032883662427,
    "passCompletionDelta": 0.05318575720512464,
    "crossDelta": -0.3333333333333333,
    "throughBallDelta": -4.333333333333333,
    "pressWinsDelta": 2.3333333333333335,
    "staminaDelta": 1.5577008271129908,
    "shotsForDelta": 3,
    "shotsAllowedDelta": -3
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
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.5,
    "goalDelta": -0.25,
    "xgDelta": -0.09520933551473831,
    "possessionDelta": 0.04843973250032661,
    "passCompletionDelta": -0.012181151843973198,
    "crossDelta": -1.25,
    "throughBallDelta": 2,
    "pressWinsDelta": -3.5,
    "staminaDelta": 6.285237063599137,
    "shotsForDelta": -3.25,
    "shotsAllowedDelta": 3.25
  }
}
```
