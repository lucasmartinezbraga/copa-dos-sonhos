# Laboratório estatístico — cert1000-v522-chunk-31

- Partidas: **25**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **1**
- Tempo: **164.6s**
- Nota de calibração: **72.8/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 3.3600 | 2.4–3.2 | ALTO |
| shotsPerMatch | 29.0000 | 20–30 | OK |
| xgPerMatch | 3.3063 | 2.3–3.5 | OK |
| onTargetRate | 0.3752 | 0.34–0.47 | OK |
| passCompletion | 0.8093 | 0.75–0.89 | OK |
| foulsPerMatch | 21.2000 | 16–28 | OK |
| yellowsPerMatch | 3.2400 | 2.4–5.6 | OK |
| redsPerMatch | 0.2400 | 0.06–0.3 | OK |
| cornersPerMatch | 6.6000 | 5–11.5 | OK |
| drawRate | 0.5600 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1200 | 0.045–0.12 | OK |
| blowoutRate | 0.0000 | 0.025–0.13 | BAIXO |
| lateGoalShare | 0.1190 | 0.17–0.34 | BAIXO |
| setPieceGoalShare | 0.1310 | 0.1–0.27 | OK |
| paritySideAWinShare | 0.4545 | 0.46–0.54 | BAIXO |
| averageEndingStamina | 69.8455 | 64–83 | OK |

## Suites

```json
{
  "styles": {
    "name": "styles",
    "games": 25,
    "goalsPerMatch": 3.36,
    "shotsPerMatch": 29,
    "xgPerMatch": 3.306272133504149,
    "onTargetRate": 0.37517241379310345,
    "passCompletion": 0.8093015214384509,
    "foulsPerMatch": 21.2,
    "yellowsPerMatch": 3.24,
    "redsPerMatch": 0.24,
    "cornersPerMatch": 6.6,
    "tacklesPerMatch": 45.12,
    "interceptionsPerMatch": 17.56,
    "drawRate": 0.56,
    "zeroZeroRate": 0.12,
    "blowoutRate": 0,
    "lateGoalShare": 0.11904761904761904,
    "setPieceGoalShare": 0.13095238095238096,
    "averageEndingStamina": 69.84547591298242,
    "averagePossessionA": 0.5031046206258216,
    "goalP50": 4,
    "goalP90": 5.600000000000001,
    "shotP90": 38.6,
    "maxGoals": 6,
    "scoreFrequency": {
      "2-2": 6,
      "1-1": 4,
      "0-0": 3,
      "3-1": 1,
      "0-2": 1,
      "2-1": 1,
      "2-4": 1,
      "1-2": 1,
      "4-2": 1,
      "1-4": 1,
      "3-3": 1,
      "2-3": 1,
      "3-0": 1,
      "1-3": 1,
      "3-2": 1
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
    "goalDelta": -0.5,
    "xgDelta": 0.5027763173134635,
    "possessionDelta": -0.12964669086457659,
    "passCompletionDelta": -0.03724417911526162,
    "crossDelta": -2,
    "throughBallDelta": -5,
    "pressWinsDelta": 0.5,
    "staminaDelta": -7.482083794139015,
    "shotsForDelta": 4.5,
    "shotsAllowedDelta": -4.5
  },
  "counter": {
    "games": 3,
    "winRate": 0.3333333333333333,
    "drawRate": 0.6666666666666666,
    "goalDelta": 0.6666666666666666,
    "xgDelta": 0.45740264396149977,
    "possessionDelta": 0.07802334023128528,
    "passCompletionDelta": -0.004838259906030522,
    "crossDelta": 0,
    "throughBallDelta": -1.6666666666666667,
    "pressWinsDelta": 2,
    "staminaDelta": 5.270490278244016,
    "shotsForDelta": 1,
    "shotsAllowedDelta": -1
  },
  "press": {
    "games": 4,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 1.25,
    "xgDelta": 1.2632076049269083,
    "possessionDelta": 0.12314269107439568,
    "passCompletionDelta": 0.0362430787982744,
    "crossDelta": 1.75,
    "throughBallDelta": -4.75,
    "pressWinsDelta": 18.5,
    "staminaDelta": -7.068203793908014,
    "shotsForDelta": 6.75,
    "shotsAllowedDelta": -6.75
  },
  "direct": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.75,
    "goalDelta": 0.25,
    "xgDelta": 0.8735778382824042,
    "possessionDelta": -0.146076172335964,
    "passCompletionDelta": -0.022267691935828365,
    "crossDelta": 3.75,
    "throughBallDelta": 1.25,
    "pressWinsDelta": 1.5,
    "staminaDelta": -0.6776991974881419,
    "shotsForDelta": 2.75,
    "shotsAllowedDelta": -2.75
  },
  "wings": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.25,
    "goalDelta": 0,
    "xgDelta": 0.12443324297786307,
    "possessionDelta": -0.01018694374250216,
    "passCompletionDelta": -0.015550140915268601,
    "crossDelta": -1.75,
    "throughBallDelta": 0.75,
    "pressWinsDelta": -0.25,
    "staminaDelta": 0.24528146599230283,
    "shotsForDelta": 1.25,
    "shotsAllowedDelta": -1.25
  },
  "balanced": {
    "games": 4,
    "winRate": 0,
    "drawRate": 1,
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
    "drawRate": 0.25,
    "goalDelta": -1.25,
    "xgDelta": -0.39918391537203257,
    "possessionDelta": -0.04919420896317803,
    "passCompletionDelta": 0.022849842087325406,
    "crossDelta": 0.5,
    "throughBallDelta": 1.75,
    "pressWinsDelta": -2,
    "staminaDelta": 4.888131418005589,
    "shotsForDelta": -2,
    "shotsAllowedDelta": 2
  }
}
```
