# R18.46 — NÃO PROMOVIDA: o limiar de decisão não era o gargalo do volume

**Status: NÃO PROMOVIDA. Hipótese de mecanismo falsificada pela medição.**

Baseline R18.44 (`8466fd7bf6b9`) · Patches `tools/r1845/patch_rasteiro.js` +
`tools/r1846/patch_volume.js`

---

## A. A decisão de contrato foi aplicada primeiro

O dono da matriz aprovou a re-derivação proposta em
`tools/r1845/gate_eco_consistencia.md`:

```
ECO-03  chutes por partida   17 - 27   (era 12 - 20)
ECO-04  chutes no alvo        6 - 10   (era 4 - 7)
```

derivadas de futebol real (~25 chutes, ~8,5 no alvo, somando os dois times) na
faixa 0,7–1,0× que a Ordem de Serviço define para camadas de "Momento". `ECO-01`
e `ECO-02` ficam como estão porque batem com a realidade.

Registrado em `reports/r1846/MATRIZ_DE_GATES_R18_46.xlsx` por
`tools/r1846/aplica_decisao_gates.py`.

**Consequência declarada, e ela é desconfortável:** sob as faixas novas **todas** as
builds da linhagem — inclusive a R18.44 promovida — reprovam `ECO-03` e `ECO-04`:

| build | chutes | ECO-03 novo | no alvo | ECO-04 novo |
|---|---:|---|---:|---|
| R18.43 | 14,563 | reprova | 5,688 | reprova |
| **R18.44 (promovida)** | 15,250 | **reprova** | 5,167 | **reprova** |
| R18.45-RC b2,60 | 14,750 | reprova | 4,646 | reprova |

Isso não é efeito colateral: é o propósito. As faixas antigas escondiam que o
motor chuta a ~58% do volume do futebol real. Pela regra da R18.40 (gate que a
própria baseline reprova não bloqueia promoção e vira defeito rastreado),
`ECO-03` e `ECO-04` passam a ser **defeito rastreado com alvo claro**.

## B. A hipótese que eu tinha, e por que era razoável

Em `_evaluateShotDecision` (sem sobrescrita na cadeia — verificado):

```js
const minimum = oneOnOne?.05:dtg<10?.045:dtg<16?.052:dtg<21?.062:dtg<25?.082:.105;
const choiceRatio = oneOnOne?.22:longshot?.82:.38;
let take = longPermission && shotUtility>=minimum && shotUtility>=passUtility*choiceRatio;
```

A `shotUtility` é construída sobre `base = distanceXg(dtg)`. A 22 m, com base 0,064
e ângulo 0,8, ela dá ~0,074 — **contra um `minimum` de 0,082** na faixa `dtg<25`. O
limiar está acima do que a própria curva de xG do motor produz ali, logo o chute
seria suprimido por construção justamente na faixa onde o futebol real chuta mais.
A álgebra fecha. Foi por isso que escolhi este lever.

## C. A medição derrubou

Base s1, n=48. Variei o limiar em três configurações, uma delas agressiva
(mínimo −42%, razão de longe 0,82 → 0,45):

| variante | chutes | jogo aberto/partida | gols | xG | xG/chute |
|---|---:|---:|---:|---:|---:|
| R18.44 | 14,604 | 5,812 | 2,500 | 2,475 | 0,1695 |
| bônus 1,35 · mín ×0,72 · longo 0,55 | 14,813 | 6,417 | 1,708 | 1,632 | 0,1102 |
| bônus 1,90 · mín ×0,72 · longo 0,55 | 14,896 | 6,438 | 1,813 | 1,774 | 0,1191 |
| bônus 1,90 · **mín ×0,58** · **longo 0,45** | 14,854 | 6,396 | 1,813 | 1,767 | 0,1189 |

**Afrouxar o limiar em 42% rendeu +11% de chutes de jogo aberto e +2% no total.**
E a variante agressiva não rendeu mais que a moderada — 6,396 contra 6,438. O
lever satura.

## D. O gargalo verdadeiro, medido pelo censo de eventos

| evento por partida | R18.44 | R18.46 (agressiva) |
|---|---:|---:|
| `shot_taken` | 5,813 | 6,396 |
| `shot_deferred` | 2,604 | 2,708 |
| **situações de chute avaliadas** | **8,417** | **9,104** |
| `cross` | **14,750** | 13,833 |
| `low_cross_shot` | 6,750 | 6,667 |
| `dribble` | 15,271 | 13,729 |

**O portador chega a uma avaliação de chute apenas ~8,4 vezes por partida.** Mesmo
que *todo* chute adiado virasse chute, o jogo aberto entregaria 8,4 finalizações —
contra as ~24 (12 por time) do futebol real. O limiar de decisão não pode
entregar volume que a oportunidade não oferece.

E o contraste é a resposta: o motor gera **14,75 eventos de cruzamento** contra
8,4 avaliações de chute. **O ataque está roteado para os flancos.** O jogo não
"decide não chutar" — ele raramente chega a uma posição de chute, porque a
progressão termina em cruzamento.

Isso também explica por que `low_cross_shot` é 44–46% das finalizações: não é um
caminho hipertrofiado por acidente de preço, é o **destino padrão do ataque**.

## E. O que isto significa para o plano

O volume de finalização **não é um problema de finalização.** É um problema de
progressão: quantas vezes o portador chega ao terço final pelo centro em vez de
terminar em cruzamento. Isso é território de `OS-08` (condução em 1,0% das ações
do portador) e da própria decisão cruzar-vs-progredir, e é etapa própria.

Sequência revista, com a razão medida:

1. **Progressão central** — subir as *oportunidades* de chute de ~8,4 para ~20+.
   Sem isso `ECO-03` na faixa nova é inalcançável por qualquer ajuste de
   finalização. Instrumento pronto: o censo de eventos da bateria
   (`shot_taken` + `shot_deferred` contra `cross`).
2. **Depois** o preço posicional do rasteiro (`tools/r1845/patch_rasteiro.js`, já
   escrito e medido), que aí encontra volume para sustentar `ECO-01`.
3. **Depois** `OS-02` (escalação).

## F. `INT-03` não regrediu, e isso vale registrar

O risco declarado deste patch era trocar "não chuta" por "chuta besteira". A
distribuição dos chutes de jogo aberto por banda:

| banda | R18.44 | R18.46 agressiva |
|---|---:|---:|
| <6 m | 2% | 1% |
| 6–11 m | 10% | 11% |
| 11–16 m | 20% | 17% |
| 16–22 m | 57% | 55% |
| 22–30 m | 11% | 12% |
| ≥30 m | 0% | **4%** |

A forma se preserva. Aparecem 4% de chutes além de 30 m que antes não existiam —
é pouco, mas é o sinal que `INT-03` persegue, e é mais uma razão para não promover
este patch como está. `maxRange`, `longPermission` e a curva `distanceXg` não
foram tocados, então a trava estrutural segue intacta; os 4% vêm de especialistas
que agora passam o limiar mais baixo.

## G. Erro meu nesta rodada

Escolhi o lever pela álgebra (limiar 0,082 acima da utilidade 0,074 alcançável a
22 m) sem antes medir **quantas vezes a decisão é sequer tomada**. O censo de
eventos custava uma linha e estava disponível na bateria desde o começo — ele
teria mostrado o teto de 8,4 antes de eu escrever o patch. É o mesmo padrão do §6
do handoff R18.40B: mecanismo plausível no código, medido na coisa errada.

O patch fica arquivado e parametrizado. Ele volta a ser candidato quando a
progressão central subir as oportunidades — aí o limiar passa a importar.

## H. Arquivos

```
tools/r1846/patch_volume.js              o patch, parametrizado, arquivado
tools/r1846/aplica_decisao_gates.py      registra a decisao aprovada na matriz
reports/r1846/MATRIZ_DE_GATES_R18_46.xlsx
reports/r1846/bat_*_s1.json  reports/r1846/xg_*_s1.json
```
