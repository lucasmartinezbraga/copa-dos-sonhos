# Laboratório estatístico — retry-bench10

- Partidas: **10**
- Motor: **4.1.0**
- Passo: **0.08s**
- Workers: **1**
- Tempo: **13.7s**
- Nota de calibração: **77.7/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.5000 | 2.4–3.2 | OK |
| shotsPerMatch | 24.2000 | 20–30 | OK |
| xgPerMatch | 2.7153 | 2.3–3.5 | OK |
| onTargetRate | 0.3099 | 0.34–0.47 | BAIXO |
| passCompletion | 0.8066 | 0.75–0.89 | OK |
| foulsPerMatch | 18.4000 | 16–28 | OK |
| yellowsPerMatch | 3.2000 | 2.4–5.6 | OK |
| redsPerMatch | 0.1000 | 0.06–0.3 | OK |
| cornersPerMatch | 4.2000 | 5–11.5 | BAIXO |
| drawRate | 0.2000 | 0.2–0.33 | OK |
| zeroZeroRate | 0.0000 | 0.045–0.12 | BAIXO |
| blowoutRate | 0.1000 | 0.025–0.13 | OK |
| lateGoalShare | 0.2000 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1200 | 0.1–0.27 | OK |
| favoriteWinRate | 1.0000 | 0.6–0.79 | ALTO |
| paritySideAWinShare | 0.5000 | 0.46–0.54 | OK |
| averageEndingStamina | 70.7825 | 64–83 | OK |

## Suites

```json
{
  "parity": {
    "name": "parity",
    "games": 1,
    "goalsPerMatch": 2,
    "shotsPerMatch": 26,
    "xgPerMatch": 2.5379921220830317,
    "onTargetRate": 0.2692307692307692,
    "passCompletion": 0.7914691943127962,
    "foulsPerMatch": 22,
    "yellowsPerMatch": 3,
    "redsPerMatch": 0,
    "cornersPerMatch": 6,
    "tacklesPerMatch": 66,
    "interceptionsPerMatch": 27,
    "drawRate": 1,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0.5,
    "averageEndingStamina": 71.43813587362342,
    "averagePossessionA": 0.5474189675870346,
    "goalP50": 2,
    "goalP90": 2,
    "shotP90": 26,
    "maxGoals": 2,
    "scoreFrequency": {
      "1-1": 1
    },
    "paritySideAWinShare": 0.5
  },
  "random": {
    "name": "random",
    "games": 3,
    "goalsPerMatch": 2.3333333333333335,
    "shotsPerMatch": 23.666666666666668,
    "xgPerMatch": 2.5382758862743415,
    "onTargetRate": 0.23943661971830985,
    "passCompletion": 0.7820710973724884,
    "foulsPerMatch": 19.666666666666668,
    "yellowsPerMatch": 3.3333333333333335,
    "redsPerMatch": 0.3333333333333333,
    "cornersPerMatch": 4.333333333333333,
    "tacklesPerMatch": 39,
    "interceptionsPerMatch": 16.666666666666668,
    "drawRate": 0.3333333333333333,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0.42857142857142855,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 70.16758910176854,
    "averagePossessionA": 0.5204539835191074,
    "goalP50": 2,
    "goalP90": 3.6,
    "shotP90": 32.2,
    "maxGoals": 4,
    "scoreFrequency": {
      "1-0": 1,
      "3-1": 1,
      "1-1": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 1,
    "goalsPerMatch": 1,
    "shotsPerMatch": 24,
    "xgPerMatch": 2.6242643026988133,
    "onTargetRate": 0.375,
    "passCompletion": 0.8414634146341463,
    "foulsPerMatch": 14,
    "yellowsPerMatch": 3,
    "redsPerMatch": 0,
    "cornersPerMatch": 2,
    "tacklesPerMatch": 23,
    "interceptionsPerMatch": 15,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 73.50940743893646,
    "averagePossessionA": 0.5620204603580559,
    "goalP50": 1,
    "goalP90": 1,
    "shotP90": 24,
    "maxGoals": 1,
    "scoreFrequency": {
      "1-0": 1
    },
    "favoriteWinRate": 1
  },
  "styles": {
    "name": "styles",
    "games": 1,
    "goalsPerMatch": 1,
    "shotsPerMatch": 8,
    "xgPerMatch": 0.7789781290033233,
    "onTargetRate": 0.375,
    "passCompletion": 0.9045454545454545,
    "foulsPerMatch": 16,
    "yellowsPerMatch": 3,
    "redsPerMatch": 0,
    "cornersPerMatch": 0,
    "tacklesPerMatch": 30,
    "interceptionsPerMatch": 4,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0,
    "lateGoalShare": 0,
    "setPieceGoalShare": 0,
    "averageEndingStamina": 73.00552259165478,
    "averagePossessionA": 0.5034065102195306,
    "goalP50": 1,
    "goalP90": 1,
    "shotP90": 8,
    "maxGoals": 1,
    "scoreFrequency": {
      "1-0": 1
    }
  },
  "formations": {
    "name": "formations",
    "games": 4,
    "goalsPerMatch": 3.5,
    "shotsPerMatch": 28.25,
    "xgPerMatch": 3.399330782282501,
    "onTargetRate": 0.34513274336283184,
    "passCompletion": 0.7940503432494279,
    "foulsPerMatch": 18.25,
    "yellowsPerMatch": 3.25,
    "redsPerMatch": 0,
    "cornersPerMatch": 5.25,
    "tacklesPerMatch": 41.75,
    "interceptionsPerMatch": 17.5,
    "drawRate": 0,
    "zeroZeroRate": 0,
    "blowoutRate": 0.25,
    "lateGoalShare": 0.14285714285714285,
    "setPieceGoalShare": 0.14285714285714285,
    "averageEndingStamina": 69.84239964036148,
    "averagePossessionA": 0.45464833010643013,
    "goalP50": 3,
    "goalP90": 6.1000000000000005,
    "shotP90": 37.7,
    "maxGoals": 7,
    "scoreFrequency": {
      "1-3": 1,
      "0-1": 1,
      "1-6": 1,
      "2-0": 1
    }
  }
}
```

## Estilos

```json
{
  "tiki": {
    "games": 1,
    "goalDelta": 1,
    "possessionDelta": 0.00681302043906129,
    "passCompletionDelta": 0.06519742883379243,
    "crossDelta": 0,
    "throughBallDelta": 0,
    "pressWinsDelta": 4,
    "staminaDelta": 3.312908091222738,
    "shotsForDelta": -2,
    "shotsAllowedDelta": 2
  }
}
```
