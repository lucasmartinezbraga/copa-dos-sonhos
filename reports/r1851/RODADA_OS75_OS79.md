# Fila de campo — itens 1, 3, 4, 5 e 6

Base **R18.83** (`5897f3af409f`). Continuação da OS-74 (item 2), que está em
`RODADA_OS74.md`.

| item | o que é | estado |
|---|---|---|
| 3 | anel dourado de lenda | **RESOLVIDO** — motor idêntico |
| 4 | dourado no modo clássico | **RESOLVIDO** — motor idêntico |
| 1 | falta atrás | **PARCIAL** — afastamento sim, colocação não |
| 6 | jogo mais rápido | **FEITO**, duração real não medida (exige navegador) |
| 5 | interceptações | **DIAGNOSTICADO** — censo abaixo, sem patch |
| 2 | lado do escanteio | resolvido e **rejeitado** (xG), ver `RODADA_OS74.md` |

---

## Itens 3 e 4 — apresentação, gate cumprido

`tools/r1851/patch_os75_legend_ring.js` · `patch_os76_classic_gold.js`

O teste que o `HANDOFF.md` §6 define para apresentação pura é "os números do
motor ficam idênticos". Medido, n=24:

> **14 métricas × 7 campos: nenhuma diferença.** Nada vazou para a simulação.

**Item 3.** O anel era desenhado para toda lenda, em qualquer estado. Segui o
compromisso que o próprio `PROXIMA_RODADA.md` sugeriu, em vez de inventar
substituto: a condição passa de `isLegend` para `isLegend && p._onFire`. Sai o
anel permanente — que é o que incomodou — e fica o de "em chamas", que já
existia e é estado temporário de forma. Parametrizado: `--onfire=0` deixa o
gramado totalmente limpo.

**Item 4 — e uma correção ao documento.** Ele diz "nos três pontos onde a linha
é montada". Medido: `legend-row` aparece 3 vezes, mas **duas são a definição no
CSS**. O ponto de aplicação é **um só**, e `hideOvr` já está três linhas acima
dele. A correção é uma condição, não três:

```js
(isLegend && !hideOvr ? ' legend-row' : '')
```

O documento manda "não mexa no CSS" — e não mexi.

**Não verificado:** a conferência visual no navegador, em modo clássico e com
elenco que tenha lenda. O próprio documento avisa que "um `grep` não basta — foi
assim que a listra de camisa passou". Existem outros pontos dourados
(`.legend-chip`, `.gold`, `--ouro`) que este patch **não** toca.

---

## Item 1 — falta atrás: PARCIAL

`tools/r1851/patch_os77_foul_restart.js`

### O que a arquitetura exigiu

`armTaker` e `armarBarreira` vivem em **blocos diferentes**:

| símbolo | bloco |
|---|---|
| `armarBarreira`, `__os36Guard` | `cds-os36-freekick-distance` |
| `armTaker` | `cds-r18fix-restart-positions` |

Por isso o patch entra no bloco do `armTaker` e **não chama** `armarBarreira`
(inalcançável dali) — monta o objeto de guard que o clamp de `_movePlayers` já
sabe consumir, `{x, y, team, until, wall}`. Assim herda o **clamp de passo por
quadro**, que é a defesa contra a armadilha do salto.

### Medido, 8 partidas

| | R18.83 | +OS-77 | previsão |
|---|---:|---:|---|
| adversário mais próximo, mediana | 2,77 m | **6,03 m** | 2 — **acertou** |
| adversário mais próximo, p10 | 0,06 m | **2,94 m** | 2 — **acertou** |
| chega aos 9,15 m? | — | **não** | 3 — **acertou** |
| deslocamento da bola, mediana | 0,84 m | **1,61 m** | 1 — **errou** |

**A previsão 3 era a que importava:** se o p10 tivesse chegado a 9,15 m, alguém
teria teleportado. Ficou em 2,94 m, que é o quanto o clamp consegue empurrar no
tempo do reinício rápido.

**Guarda obrigatória do documento — salto por quadro:**

| | R18.83 | +OS-77 |
|---|---:|---:|
| acima de 12 m/s | 0,537% | **0,493%** |
| cortes de cena (>3 m) | 566 | **527** |

Não piorou. O afastamento **não** introduziu teleporte.

### Por que é parcial, e não resolvido

O deslocamento **subiu** de 0,84 para 1,61 m, quando eu previ que cairia para
perto de zero. A métrica é `hypot(dono - localDaFalta)` no instante em que a
posse volta — ou seja, mede se a bola está no ponto.

Hipótese, **não medida**: `armTaker` instala o próprio `pendingRestart` com a
espera pelo batedor, e o patch **sobrescreve** logo depois, perdendo o "segura
até ele chegar". Quem continuar deve encadear em vez de substituir.

Registro também que a base aqui mede 0,84 m e o documento reporta 2,76 m —
amostras diferentes (8 partidas contra 4). O número do documento não se
reproduziu.

---

## Item 6 — a partida começa em 2x

`tools/r1851/patch_os78_default_speed.js` — `G.speed` de `1.0` para `2.0`.

Segui a opção (2) do documento, que ele mesmo classifica como "a única com custo
zero em realismo". Não toquei em `clockRate`: a OS-67 mediu que ele é botão de
**volume**, e mexer nele leva gols de 1,81 para 4,38.

**Não medi a duração real.** O documento é explícito: "Não meça isso em Node. A
duração real depende do laço de render". A estimativa de ~7 min é dele, não
minha, e não a repito como se fosse medição.

**Conflito de fila, e ele é real:** o item 1 estende `dead` porque o batedor
caminha, e bola morta já é 11,1% dos quadros. **Os itens 1 e 6 puxam em direções
opostas.** Quem decidir o 6 precisa saber disso.

---

## Item 5 — censo de interceptação

`tools/r1851/diag_os79_intercept_census.js` — 8 partidas, 211 interceptações
(26,4 por partida). **Sem patch**, como o documento manda.

| pergunta do documento | medido | leitura |
|---|---|---|
| 1. distância à linha do passe | mediana **1,47 m**, máx 1,74 | **não é teleporte** — estão em cima da linha |
| 2. ângulo corpo × bola | mediana 66°, **p90 158°** | 10% interceptam quase **de costas** |
| 3. velocidade no instante | mediana 4,85 m/s, 0,9% parados | **não é interceptar parado** |
| 4. tempo da bola no ar | mediana 0,37 s, **9,5% abaixo de 0,1 s** | quase instantânea na saída do passe |
| 5. desfecho | 52,2% posse / 47,8% desvio | **quase metade desvia** |

### O que isto derruba

A hipótese principal do documento era o padrão do `HANDOFF.md` §4 — "o desfecho
existe na estatística e não tem consequência física". **O censo não sustenta
isso:** 47,8% das interceptações desviam a bola em vez de capturá-la. Não é o
caso de bloqueio, barreira e duelo aéreo.

### O que sobra, com número

Dois candidatos concretos, ambos do próprio checklist do documento:

1. **9,5% das interceptações acontecem com a bola há menos de 0,1 s no ar.**
   O documento diz: "interceptação instantânea na saída do passe não existe no
   futebol". É o achado mais objetivo.
2. **p90 do ângulo em 158°** — um décimo das interceptações acontece com o
   jogador se movendo quase na direção oposta à bola.

Nenhum dos dois foi patchado. O documento manda "só depois disso escolha o
mecanismo", e escolher exigiria localizar a camada viva de `_intercept` com o
gancho de pilha — que não fiz.

---

## Ecologia da build combinada, e por que ela não é promovível

`dist/COPA DOS SONHOS - R18.84-RC2 - FILA DE CAMPO (NAO PROMOVIDA).html`
(`ea0a5148845c`) = R18.83 + OS-75 + OS-76 + OS-77 + OS-78.

n=24, semente 4200000, contra a base:

| | R18.83 | RC2 | Δ |
|---|---:|---:|---:|
| gols | 2,833 | 3,417 | +20,6% |
| **xG** | 2,861 | 3,091 | **+8,0%** |
| chutes | 23,208 | 24,583 | +5,9% |
| no alvo | 9,167 | 10,375 | +13,2% |
| faltas | 13,542 | 15,333 | +13,2% |

O xG sobe 8,0%, acima da banda de 7%, com o xG já no teto. **Uma base só não
decide** — o protocolo pede três — mas o sinal é o mesmo da OS-74, e o
responsável é o OS-77 (os patches de apresentação são provadamente neutros e o
OS-78 não entra na simulação).

Mecanismo plausível, **não isolado**: afastar o adversário no reinício dá espaço
ao time que sofreu a falta.

---

## Ressalva que vale para todos os números daqui

A minha bateria (`tools/r1840/bateria.js`) **não reproduz os números
documentados da R18.83**: mede xG 2,861 contra 2,67 documentado, e chutes 23,2
contra 21,8. Portanto minhas leituras **absolutas** de gate não valem — só os
deltas pareados valem, porque aí o instrumento é o mesmo dos dois lados.

## Arquivos

```
tools/r1851/patch_os75_legend_ring.js       item 3, motor identico
tools/r1851/patch_os76_classic_gold.js      item 4, motor identico
tools/r1851/patch_os77_foul_restart.js      item 1, PARCIAL
tools/r1851/patch_os78_default_speed.js     item 6
tools/r1851/diag_os79_intercept_census.js   item 5, censo
reports/r1851/os75_76_eco.json              prova de motor identico
reports/r1851/os77_os73_foul_restart_*.json
reports/r1851/os77_os37_frame_jump_*.json   guarda do salto por quadro
reports/r1851/os79_intercept_census.json
dist/COPA DOS SONHOS - R18.84-RC2 - FILA DE CAMPO (NAO PROMOVIDA).html
```
