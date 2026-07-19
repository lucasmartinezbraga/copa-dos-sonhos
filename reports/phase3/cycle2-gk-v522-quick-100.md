# Laboratório estatístico — cycle2-gk-v522

- Partidas: **100**
- Motor: **4.3.2**
- Passo: **0.016666666666666666s**
- Workers: **4**
- Tempo: **92.8s**
- Nota de calibração: **88.0/100**

## Métricas gerais

| Métrica | Valor | Faixa | Situação |
|---|---:|---:|---|
| goalsPerMatch | 2.8700 | 2.4–3.2 | OK |
| shotsPerMatch | 23.0500 | 20–30 | OK |
| xgPerMatch | 2.7304 | 2.3–3.5 | OK |
| onTargetRate | 0.3584 | 0.34–0.47 | OK |
| passCompletion | 0.8070 | 0.75–0.89 | OK |
| foulsPerMatch | 23.7700 | 16–28 | OK |
| yellowsPerMatch | 3.7000 | 2.4–5.6 | OK |
| redsPerMatch | 0.1900 | 0.06–0.3 | OK |
| cornersPerMatch | 3.6000 | 5–11.5 | BAIXO |
| drawRate | 0.3400 | 0.2–0.33 | ALTO |
| zeroZeroRate | 0.1000 | 0.045–0.12 | OK |
| blowoutRate | 0.0800 | 0.025–0.13 | OK |
| lateGoalShare | 0.2160 | 0.17–0.34 | OK |
| setPieceGoalShare | 0.1359 | 0.1–0.27 | OK |
| favoriteWinRate | 0.7647 | 0.6–0.79 | OK |
| paritySideAWinShare | 0.4697 | 0.46–0.54 | OK |
| averageEndingStamina | 69.7198 | 64–83 | OK |

## Suites

```json
{
  "random": {
    "name": "random",
    "games": 34,
    "goalsPerMatch": 2.5294117647058822,
    "shotsPerMatch": 18.823529411764707,
    "xgPerMatch": 2.3807442522475646,
    "onTargetRate": 0.38125,
    "passCompletion": 0.8038283658787256,
    "foulsPerMatch": 26.941176470588236,
    "yellowsPerMatch": 4.205882352941177,
    "redsPerMatch": 0.29411764705882354,
    "cornersPerMatch": 3,
    "tacklesPerMatch": 58.970588235294116,
    "interceptionsPerMatch": 19.558823529411764,
    "drawRate": 0.29411764705882354,
    "zeroZeroRate": 0.14705882352941177,
    "blowoutRate": 0.08823529411764706,
    "lateGoalShare": 0.20930232558139536,
    "setPieceGoalShare": 0.1511627906976744,
    "averageEndingStamina": 69.35039651428511,
    "averagePossessionA": 0.5010946849467367,
    "goalP50": 2,
    "goalP90": 5.699999999999999,
    "shotP90": 30.7,
    "maxGoals": 8,
    "scoreFrequency": {
      "0-0": 5,
      "0-2": 3,
      "0-1": 3,
      "1-1": 3,
      "1-0": 3,
      "2-0": 2,
      "3-0": 2,
      "0-3": 2,
      "1-2": 2,
      "2-1": 2,
      "2-2": 2,
      "1-7": 1,
      "4-3": 1,
      "0-5": 1,
      "0-6": 1,
      "4-2": 1
    }
  },
  "strongWeak": {
    "name": "strongWeak",
    "games": 17,
    "goalsPerMatch": 2.764705882352941,
    "shotsPerMatch": 22.823529411764707,
    "xgPerMatch": 2.6123964807665923,
    "onTargetRate": 0.35051546391752575,
    "passCompletion": 0.7991409802930773,
    "foulsPerMatch": 26.294117647058822,
    "yellowsPerMatch": 4.235294117647059,
    "redsPerMatch": 0.17647058823529413,
    "cornersPerMatch": 3.7058823529411766,
    "tacklesPerMatch": 54.1764705882353,
    "interceptionsPerMatch": 21.058823529411764,
    "drawRate": 0.11764705882352941,
    "zeroZeroRate": 0,
    "blowoutRate": 0.23529411764705882,
    "lateGoalShare": 0.1276595744680851,
    "setPieceGoalShare": 0.14893617021276595,
    "averageEndingStamina": 69.40764009303511,
    "averagePossessionA": 0.5108352498582269,
    "goalP50": 2,
    "goalP90": 5,
    "shotP90": 26,
    "maxGoals": 6,
    "scoreFrequency": {
      "0-1": 2,
      "0-2": 2,
      "1-0": 2,
      "1-1": 2,
      "5-0": 2,
      "2-0": 1,
      "2-1": 1,
      "2-4": 1,
      "1-2": 1,
      "0-3": 1,
      "4-0": 1,
      "0-4": 1
    },
    "favoriteWinRate": 0.7647058823529411
  },
  "parity": {
    "name": "parity",
    "games": 15,
    "goalsPerMatch": 3.4,
    "shotsPerMatch": 27.066666666666666,
    "xgPerMatch": 2.9920215534105234,
    "onTargetRate": 0.3916256157635468,
    "passCompletion": 0.804410911201393,
    "foulsPerMatch": 21.4,
    "yellowsPerMatch": 3.1333333333333333,
    "redsPerMatch": 0.13333333333333333,
    "cornersPerMatch": 4.466666666666667,
    "tacklesPerMatch": 56.266666666666666,
    "interceptionsPerMatch": 20.066666666666666,
    "drawRate": 0.4666666666666667,
    "zeroZeroRate": 0.06666666666666667,
    "blowoutRate": 0.06666666666666667,
    "lateGoalShare": 0.23529411764705882,
    "setPieceGoalShare": 0.1568627450980392,
    "averageEndingStamina": 70.94076385907888,
    "averagePossessionA": 0.4935074144184842,
    "goalP50": 3,
    "goalP90": 6,
    "shotP90": 36.2,
    "maxGoals": 10,
    "scoreFrequency": {
      "1-1": 3,
      "2-1": 2,
      "0-1": 2,
      "4-2": 1,
      "4-0": 1,
      "0-0": 1,
      "1-3": 1,
      "2-2": 1,
      "3-3": 1,
      "1-2": 1,
      "5-5": 1
    },
    "paritySideAWinShare": 0.5
  },
  "formations": {
    "name": "formations",
    "games": 16,
    "goalsPerMatch": 3.125,
    "shotsPerMatch": 25.4375,
    "xgPerMatch": 2.7682445737158825,
    "onTargetRate": 0.36855036855036855,
    "passCompletion": 0.8097345132743363,
    "foulsPerMatch": 22.5,
    "yellowsPerMatch": 4,
    "redsPerMatch": 0.0625,
    "cornersPerMatch": 4.0625,
    "tacklesPerMatch": 52.3125,
    "interceptionsPerMatch": 17.6875,
    "drawRate": 0.3125,
    "zeroZeroRate": 0.125,
    "blowoutRate": 0,
    "lateGoalShare": 0.2,
    "setPieceGoalShare": 0.08,
    "averageEndingStamina": 68.81137768983987,
    "averagePossessionA": 0.4868870374907826,
    "goalP50": 3,
    "goalP90": 5,
    "shotP90": 31,
    "maxGoals": 6,
    "scoreFrequency": {
      "0-3": 3,
      "2-2": 2,
      "0-0": 2,
      "0-2": 1,
      "3-3": 1,
      "3-1": 1,
      "2-1": 1,
      "3-2": 1,
      "2-0": 1,
      "4-1": 1,
      "3-0": 1,
      "1-2": 1
    }
  },
  "styles": {
    "name": "styles",
    "games": 18,
    "goalsPerMatch": 2.9444444444444446,
    "shotsPerMatch": 25.77777777777778,
    "xgPerMatch": 3.250750918670127,
    "onTargetRate": 0.2952586206896552,
    "passCompletion": 0.8199333967649858,
    "foulsPerMatch": 18.5,
    "yellowsPerMatch": 2.4444444444444446,
    "redsPerMatch": 0.16666666666666666,
    "cornersPerMatch": 3.5,
    "tacklesPerMatch": 44.22222222222222,
    "interceptionsPerMatch": 16.055555555555557,
    "drawRate": 0.5555555555555556,
    "zeroZeroRate": 0.1111111111111111,
    "blowoutRate": 0,
    "lateGoalShare": 0.3018867924528302,
    "setPieceGoalShare": 0.1320754716981132,
    "averageEndingStamina": 70.50225488865381,
    "averagePossessionA": 0.48110991735997544,
    "goalP50": 3.5,
    "goalP90": 4.600000000000001,
    "shotP90": 35.3,
    "maxGoals": 7,
    "scoreFrequency": {
      "2-2": 6,
      "0-0": 2,
      "0-2": 2,
      "0-1": 2,
      "5-2": 1,
      "3-3": 1,
      "1-2": 1,
      "3-1": 1,
      "1-0": 1,
      "1-1": 1
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
    "drawRate": 0.75,
    "goalDelta": 0.25,
    "xgDelta": 0.41466847778006977,
    "possessionDelta": 0.1965763102438608,
    "passCompletionDelta": 0.05878859409845241,
    "crossDelta": -0.5,
    "throughBallDelta": -3.75,
    "pressWinsDelta": 2,
    "staminaDelta": 2.0432915328113452,
    "shotsForDelta": -1,
    "shotsAllowedDelta": 1
  },
  "counter": {
    "games": 4,
    "winRate": 0.25,
    "drawRate": 0.75,
    "goalDelta": 0.5,
    "xgDelta": -0.7412801162001867,
    "possessionDelta": 0.02707782340487655,
    "passCompletionDelta": -0.02003721426587013,
    "crossDelta": -1,
    "throughBallDelta": 7.5,
    "pressWinsDelta": 2.5,
    "staminaDelta": 3.77390913642002,
    "shotsForDelta": -4.5,
    "shotsAllowedDelta": 4.5
  },
  "press": {
    "games": 2,
    "winRate": 0.5,
    "drawRate": 0.5,
    "goalDelta": 1.5,
    "xgDelta": 1.2844548526673998,
    "possessionDelta": 0.06325692750983314,
    "passCompletionDelta": 0.006399983218660865,
    "crossDelta": 3,
    "throughBallDelta": -5,
    "pressWinsDelta": 24,
    "staminaDelta": -8.911906413695725,
    "shotsForDelta": 5,
    "shotsAllowedDelta": -5
  },
  "direct": {
    "games": 2,
    "winRate": 0,
    "drawRate": 0.5,
    "goalDelta": -0.5,
    "xgDelta": 0.6220380002956342,
    "possessionDelta": -0.10420310927049767,
    "passCompletionDelta": -0.000576783546582138,
    "crossDelta": -0.5,
    "throughBallDelta": 2,
    "pressWinsDelta": 1,
    "staminaDelta": -0.12482681809319018,
    "shotsForDelta": 0,
    "shotsAllowedDelta": 0
  },
  "wings": {
    "games": 2,
    "winRate": 1,
    "drawRate": 0,
    "goalDelta": 2,
    "xgDelta": 0.820403438570968,
    "possessionDelta": 0.12453558318571897,
    "passCompletionDelta": 0.02102369543847593,
    "crossDelta": 1,
    "throughBallDelta": -1,
    "pressWinsDelta": 2,
    "staminaDelta": 2.6817926947951634,
    "shotsForDelta": 7.5,
    "shotsAllowedDelta": -7.5
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
    "games": 2,
    "winRate": 0,
    "drawRate": 1,
    "goalDelta": 0,
    "xgDelta": -1.016489390723301,
    "possessionDelta": 0.0053478794228243864,
    "passCompletionDelta": 0.030715086922322943,
    "crossDelta": 0.5,
    "throughBallDelta": 0,
    "pressWinsDelta": -2.5,
    "staminaDelta": 4.520993881146822,
    "shotsForDelta": -4.5,
    "shotsAllowedDelta": 4.5
  }
}
```
