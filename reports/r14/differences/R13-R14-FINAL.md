# Diferenças R13 -> R14 (sonda de trava)

- **antes**: `reports/r14/ball-lock/baseline-r14-candidata.json` — build `08716e3df6f7a08a…` seeds [0, 200]
- **depois**: `reports/r14/ball-lock/r14-recalibrada.json` — build `0230a6ffe90f3ecd…` seeds [0, 200]

### P0 — travas de bola

| métrica | antes | depois | delta |
|---|---:|---:|---:|
| partidas | 200 | 200 | =0 (+0.0%) |
| travas totais | 1415 | 168 | -1247 (-88.1%) |
| travas por partida | 7.08 | 0.84 | -6.24 (-88.1%) |
| travas de 2 jogadores | 1048 | 18 | -1030 (-98.3%) |
| pior trava (s) | 47.8 | 6 | -41.8 (-87.4%) |
| partidas com >=1 trava | 200 | 113 | -87 (-43.5%) |
| travas >=5s (amostradas) | 989 | 4 | -985 (-99.6%) |
| travas >=10s (amostradas) | 400 | 0 | -400 (-100.0%) |
| travas >=20s (amostradas) | 51 | 0 | -51 (-100.0%) |
| stallFires | 0 | 0 | =0 (—) |

### Futebol observado

| métrica | antes | depois | delta |
|---|---:|---:|---:|
| goals/partida | 1.975 | 1.805 | -0.17 (-8.6%) |
| shots/partida | 12.605 | 12.99 | +0.385 (+3.1%) |
| passes/partida | 127.6 | 214.57 | +86.97 (+68.2%) |
| corners/partida | 5.375 | 6.095 | +0.72 (+13.4%) |
| offsides/partida | 0.805 | 1.195 | +0.39 (+48.4%) |
| throwIns/partida | 7.075 | 11.115 | +4.04 (+57.1%) |
| ev:pass/partida | 108.29 | 182.81 | +74.52 (+68.8%) |
| ev:shot_taken/partida | 7.64 | 6.46 | -1.18 (-15.4%) |
| ev:dribble/partida | 7.6 | 9.61 | +2.01 (+26.4%) |
| ev:tackle/partida | 12.13 | 3.07 | -9.06 (-74.7%) |
| ev:cross/partida | 13.4 | 16.12 | +2.72 (+20.3%) |
| ev:goal/partida | 1.98 | 1.8 | -0.18 (-9.1%) |
| ev:bad_pass/partida | 11.68 | 19.59 | +7.91 (+67.7%) |
| ev:looseControl/partida | 14.76 | 24.66 | +9.9 (+67.1%) |
| ev:pressure/partida | 180.51 | 61.71 | -118.8 (-65.8%) |
| ev:containment/partida | 51.19 | 30.19 | -21 (-41.0%) |
| ev:tackle_missed/partida | 3.48 | 0.93 | -2.55 (-73.3%) |
| ev:corner/partida | 5.38 | 6.09 | +0.71 (+13.2%) |
| ev:throw_in/partida | 7.08 | 11.12 | +4.04 (+57.1%) |
| ev:offside/partida | 0.81 | 1.2 | +0.39 (+48.1%) |
| obs:defensiveLineMeanRange | 0.808 | 1.271 | +0.463 (+57.3%) |
| obs:markerMeanDistance | 8.173 | 8.238 | +0.065 (+0.8%) |
| obs:uncoveredThreatRate | 0.247 | 0.305 | +0.058 (+23.5%) |
| obs:disconnectedLineRate | 0 | 0 | =0 (—) |

---

## Gate de balanço de estilos — **APROVA** (após recalibração)

| gate | limite | golden R13 | candidata | R14 sem calibrar | **R14 final** |
|---|---:|---:|---:|---:|---:|
| `ppgRange` | ≤ 0,75 | 0,571 | 0,571 | 0,821 FAIL | **0,500 PASS** |
| `maxAbsGoalDiffPerMatch` | ≤ 0,65 | 0,464 | 0,464 | 0,536 | **0,429 PASS** |
| `noDominantStyle` | true | PASS | PASS | FAIL | **PASS** |
| `parkIdentity` | true | PASS | PASS | FAIL | **PASS** |
| `tikiIdentity` | true | PASS | PASS | PASS | **PASS** |

Robustez: com o dobro da amostra (196 partidas, `--repeats=4`), `ppgRange`
0,554 e `maxAbsGoalDiff` 0,464 — todos os gates seguem PASS. A ordem entre
estilos muda entre amostras (há ruído nas médias individuais), mas o **range**,
que é o gate, fica folgado nos dois tamanhos.

### A recalibração

```
STYLE_FX.wings.cross   1,55 -> 1,85
STYLE_FX.direct.cross  1,35 -> 1,05
STYLE_FX.park.cross    0,95 -> 1,30
```

Três números, todos no mesmo campo. O achado que os produziu é
contraintuitivo: **reduzir `cross` fortalece o time**. O multiplicador governa a
*probabilidade de escolher cruzar* (`crossP`), e o cruzamento é uma ação de
baixo valor esperado neste motor — quem cruza menos escolhe opções melhores.
`cross` funciona, na prática, como handicap.

Com o portador congelado em `build_up`, esse handicap quase não era exercido:
poucas decisões, poucos cruzamentos. Liberada a decisão, ele passou a incidir
em cheio e de forma desigual — `wings` (cross 1,55) e `direct` (1,35) foram os
mais afetados, em direções opostas ao que se esperaria. A recalibração
redistribui o handicap sobre o motor que efetivamente decide.

`park.cross` 0,95 → 1,30 também restaura a identidade da retranca: cruzar
encerra a posse mais cedo, então park volta a passar abaixo da mediana
(104,1 contra 107,1) e segue com o menor volume de finalizações (5,18).

### Estado final por estilo (98 partidas)

| estilo | ppg | gols/j | passes | chutes |
|---|---:|---:|---:|---:|
| wings | 1,643 | 2,11 | 109,2 | 9,57 |
| press | 1,536 | 1,75 | 107,1 | 9,50 |
| park | 1,321 | 1,32 | 104,1 | 5,18 |
| counter | 1,286 | 1,39 | 101,6 | 6,79 |
| tiki | 1,286 | 1,21 | 116,9 | 7,46 |
| direct | 1,250 | 1,68 | 88,2 | 8,18 |
| balanced | 1,143 | 1,46 | 110,5 | 7,75 |

## Veredito

`BLK-001` **PASS** · `BAL-001` **PASS** · R13.0 congelada e byte-idêntica ·
cenários 25/25 · smoke estático 13/13 · smoke de navegador 4/4 viewports.

**Nenhum P0 automatizável em FAIL.** Pendências físicas e humanas seguem
`PENDENTE` e são separadas por definição.
