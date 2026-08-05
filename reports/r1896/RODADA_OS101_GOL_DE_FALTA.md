# RODADA OS-101 · o gol de falta direta

Build promovida: **R18.95**, sha256
`31b5c1b2461920bb0b75bcbb925fb0f234aa8151f67ab791f7031e858d0e2ccd`.
Cadeia reproduzida duas vezes byte a byte.

---

## 1. O defeito, medido na função pura

`resolveFreeKickPhysics` é **função pura**: 50 000 amostras por cenário, sem
simular partida.

| batedor × goleiro | R18.94 | referência real |
|---|---:|---:|
| 90 × 75, 22 m | **4,17%** | ~8–10% (especialista) |
| 90 × 75, 28 m | 3,99% | |
| 75 × 75, 25 m | **3,13%** | ~5–6% (geral) |
| 60 × 80, 30 m | **2,02%** | ~3–5% (mediano) |
| **separação elite / fraco** | **2,06×** | muito maior no futebol |

Dois problemas, e **o segundo importa mais**: o patamar estava baixo, mas a
**separação por atributo era de apenas 2,06×** — ou seja, ser especialista de
falta quase não decidia quem faz gol de falta.

## 2. O mecanismo

```js
:2888  const baseGoal = clamp(.032 * (1 + (takerSkill - keeperSkill)/100 * 1.35), .010, .090);
:2889  const pGoal    = clamp(baseGoal * (.52 + execution*.82 + corner*.28 + curveQ*.14), .010, .140);
```

Com batedor 90 e goleiro 75: `.032 × 1,2025 = 0,0385`. O multiplicador de
execução/canto/curva fica em ~1,276, então `pGoal ≈ 0,049`, e a taxa realizada é
~4,17% — o sorteio de gol vem **depois** de `offTarget` e da barreira, então a
realizada é ~84% do `pGoal`.

### Um comentário defasado, que vale como aviso

O comentário em `:2884-2887` afirma que *"batedor 90 contra goleiro 75 sobe de
~6,1% para ~6,4% de base"*. **A conta da linha não produz isso com nenhum
fator**: 1,2 daria 3,58%, 1,35 dá 3,85%, 1,5 daria 3,92%. O comentário
sobreviveu a uma recalibração anterior e passou a mentir. Quem calibrar lendo
ele vai ancorar num número que não existe.

## 3. A correção

```
de:   .032 * (1 + (t-k)/100 * 1.35),  teto .090
para: .048 * (1 + (t-k)/100 * 2.20),  teto .130
```

Sobe o patamar **e abre a separação por atributo**, que era o alvo principal.

## 4. Resultado — modelo puro

| batedor × goleiro | R18.94 | **R18.95** |
|---|---:|---:|
| 90 × 75, 22 m | 4,17% | **6,68%** |
| 90 × 75, 28 m | 3,99% | **6,75%** |
| 75 × 75, 25 m | 3,13% | **4,67%** |
| 60 × 80, 30 m | 2,02% | **2,35%** |
| **separação elite / fraco** | 2,06× | **2,84×** |

Defesa, barreira e fora praticamente intactos — como previsto, porque o sorteio
de gol vem antes da moeda defesa/fora.

## 5. Bateria — seis bases, 144 partidas

| semente | gols | xG | chutes | escanteios |
|---:|---:|---:|---:|---:|
| 4200000 | 2,4583 | 2,2354 | 20,333 | 4,8333 |
| 8400000 | 2,0833 | 2,1521 | 18,042 | **4,0000** |
| 1260000 | 2,0417 | 2,2267 | 19,250 | 4,3750 |
| 2100000 | 2,0833 | 2,2894 | 20,792 | 5,3333 |
| 6300000 | **1,8750** | 2,0470 | 18,625 | 5,5000 |
| 3150000 | 2,5417 | 2,2072 | 18,208 | 4,6667 |
| **média** | **2,1805** | **2,1930** | 19,208 | **4,7847** |

**Gols abaixo de 1,8: 0. xG acima de 2,7: 0. Escanteios abaixo de 4: 0.**

| | R18.94 | R18.95 |
|---|---:|---:|
| gols | 2,125 | 2,181 |
| **xG** | 2,077 | **2,193** |
| escanteios | 4,778 | 4,785 |
| chutes | 19,208 | 19,208 |
| passes | 442,2 | 442,0 |

O xG subiu **+0,116**, praticamente os +0,09 que eu tinha estimado no cabeçalho
do patch. Este patch **não é neutro no ECO-02** por construção — `pGoal` entra em
`stats.xg` antes do sorteio.

### Uma leitura precipitada minha, corrigida

Na primeira base o xG saltou +0,241 e eu registrei que tinha subestimado a
magnitude. Com as seis bases, o deslocamento real é **+0,116**. A primeira base
tinha caos junto. **Não concluir sobre bateria parcial** — mesmo erro que já
cometi na R18.92, e que já está na memória do projeto.

## 6. O que continua aberto

- **elite em 6,7% contra ~8–10% reais.** Dá para subir mais, mas cada ponto
  percentual de `pGoal` custa ~0,036 de xG por partida. Com 2,193 e teto 2,7,
  cabe — mas o caminho melhor está abaixo.
- **`wallRisk` em 17–18% contra ~20–25% reais.** Subir a barreira tira cobranças
  do sorteio de gol **sem mexer no xG por cobrança**, e é o jeito certo de abrir
  espaço se o ECO-02 apertar. Não foi tocado nesta rodada.
- **base 8400000 com escanteios cravados em 4,000.** Passa sem margem. É o mesmo
  ponto frágil registrado desde a R18.91, e a causa é a taxa base de escanteio do
  jogo (~4,8 contra ~10,5 reais), não este patch.
