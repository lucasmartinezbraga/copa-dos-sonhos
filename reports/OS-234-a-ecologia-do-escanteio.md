# OS-234 · A ecologia do escanteio — o ramo "fica viva" era inalcançável

`cornersPerMatch` media **12,99** contra alvo 8,0 e teto 11,5. Era o maior
desvio de design que restava, presente em toda partida, e sobreviveu a todas as
ordens anteriores.

---

## 1. Duas leituras erradas antes da certa

### Erro 1 — a sonda media correlação, não causa

A primeira versão de `fonte-do-escanteio.js` atribuía cada escanteio à "última
ação emitida nos 4 s anteriores" e concluiu `blocked 54,5%`. Em quatro segundos
de futebol acontece de tudo: aquilo era **vizinhança temporal**, não causa.

Refeita por **pilha de chamada** — `_setCorner` guarda o quadro de quem o
chamou — o resultado não tem janela de tempo nenhuma e é a fonte de verdade.

### Erro 2 — OS-233, cortar oito probabilidades que ninguém consulta

Agindo sobre a leitura errada, escalei por 0,62 as oito constantes de escanteio
da calibração (`shotBlockCorner` 0,66, `shotSaveCorner` 0,68 e mais seis).
Medido a 288 partidas:

| | controle | oito constantes × 0,62 |
|---|---|---|
| `cornersPerMatch` | 13,29 | **13,36** |
| `zeroZeroRate` | 0,083 | 0,115 |
| `blowoutRate` | 0,184 | 0,201 |
| placar | 10/13 | **9/13** |

**Não se moveu.** Custo puro, revertida. E o resultado nulo é a informação: a
camada R18.18.3 resolve escanteio por **geometria**, e nunca consulta essas
constantes. Baixar a probabilidade de um caminho que não é o usado é o retrato
da armadilha 7 do briefing.

---

## 2. A medição que resolveu — e ela não precisou de sonda

A camada `43-cds-r18183-corner-ecology.js` já mantém os próprios contadores.
Lidos ao fim de uma partida (`tools/fisica/tela/ecologia-do-escanteio.js`):

```
blockResolutions    14  ->  blockCorners      14  ->  blockLive       0
saveParriesResolved  3  ->  saveParryCorners   3  ->  saveParryLive   0
emergencyClearCorners 5
```

**Todo bloqueio virava escanteio. Toda espalmada virava escanteio.** Os ramos
`blockLive` e `saveParryLive` estão escritos, são contados e **nunca rodam**.

É o padrão desta base pela sétima vez:

> **Um conceito é escrito, é lido, e não pode acontecer.**

A causa é geométrica. O vetor do desvio aponta sempre para a frente
(`vx = attackDir*0.78 + inc.x*0.30`) e o teste de saída aceitava um percurso de
até **22,5 m** até a linha — a área inteira mais seis metros. Como o bloqueio
acontece quase sempre dentro dessa faixa, o ramo de saída engolia 100%.

---

## 3. A correção

O percurso até a linha passa a ter de ser curto de verdade. Um bloqueio a 22 m
da linha de fundo não manda a bola para escanteio: ela sobra.

| | antes | agora |
|---|---|---|
| `endLimit` chute | 22,5 m | **14,0 m** |
| `endLimit` cabeceio | 20,5 m | 13,5 m |
| `endLimit` cruzamento | 19,5 m | 12,5 m |
| espalmada vira escanteio | `score ≥ .56` e `endDist ≤ 9,6` | `score ≥ .60` e `endDist ≤ 8,4` |
| alívio de emergência | `score ≥ .31` | `score ≥ .42`, e área menor |

A dose foi encontrada por varredura, com resposta monotônica:

| `endLimit` (chute) | `cornersPerMatch` (288) |
|---|---|
| 22,5 (original) | 13,29 |
| 8,5 | 6,27 |
| **14,0** | **7,56** |

---

## 4. Estado medido

### Bateria pareada, 576 partidas

| métrica | controle | OS-234 |
|---|---|---|
| **`cornersPerMatch`** | **12,99** (teto 11,5) | **7,29** ✓ (alvo 8,0) |
| `blowoutRate` | **0,193** (teto 0,19) | **0,189** ✓ |
| `onTargetRate` | 0,315 | 0,324 |
| `zeroZeroRate` | 0,083 | 0,071 |
| `goalsPerMatch` | 3,04 | 3,16 |
| `shotsPerMatch` | 24,84 | 24,92 |
| `foulsPerMatch` | 22,35 | 22,48 |
| `yellowsPerMatch` | 4,53 | 4,47 |
| `redsPerMatch` | 0,269 | **0,318** (teto 0,30) |
| **placar** | **10/13** | **11/13** |

Duas métricas entram na faixa (escanteio e goleada) e uma sai (vermelho).
`onTargetRate` melhora de 0,315 para 0,324 — ainda abaixo do piso 0,34, que é
o custo declarado da OS-212, mas na direção certa.

**Sobre o vermelho.** Faltas (+0,6%) e amarelos (−1,3%) estão parados; só o
vermelho anda. E ele **recua com a amostra**: 0,368 a 288 partidas, 0,318 a
576, andando na direção do controle. A dose A (mais bola viva que a dose B,
porque tem menos escanteio) mediu **menos** vermelho, 0,302 — ou seja, o número
não é monotônico com o mecanismo que explicaria uma causa real. É a mesma
assinatura de ruído da OS-232, onde a confirmação a 576 fechou em 0,267 contra
0,269 do controle.

### Tela

| invariante | resultado |
|---|---|
| ESCANTEIO `E4` sem salto visível | 7/7 · pior 0,38 m |
| ESCANTEIO `E1` batedor na bandeirinha | 7/7 |
| ESCANTEIO `E3` bola na quina | 7/7 |

As falhas de `FALTA` no mesmo relatório (`F2` pior 21,71 m, `F3` 18,20 m) são o
resíduo de instrumento já documentado na OS-231: `_freeKick` também é chamado
fora da cadeia de `_awardFoul` e ali a amarra cai numa falta antiga. O controle
medido com a **mesma** sonda dá 22,04 m e 18,54 m — iguais. E o pior salto de
`F6` aqui (7,30 m) é **menor** que o do controle (12,91 m).

---

## 5. Itens abertos

* `onTargetRate` 0,324 contra piso 0,34 — custo declarado da OS-212, melhorando.
* `redsPerMatch` 0,318 contra teto 0,30 — ver §4; recuando com a amostra.
* `atletas_empilhados` e `atleta_congelado_20s` aparecem de forma intermitente
  na varredura de sanidade, com flags diferentes a cada partida. Ainda não
  caracterizados.
* A amarra falta↔espera da `validar-lances.js` cobre `_awardFoul`; falta cobrir
  as chamadas de `_freeKick` fora dessa cadeia.
