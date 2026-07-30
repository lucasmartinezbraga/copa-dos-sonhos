# R18.49 — O CONE DA CONDUÇÃO ERA UM RETÂNGULO

**Build** `dist/COPA DOS SONHOS - R18.49 - CONE DA CONDUCAO.html` · SHA `508dc42c2f63…`
**Baseline** R18.44 (`8466fd7bf6b9`) · **Patch** `tools/r1849/patch_cone.js`

Promovida. Todos os seis gates cumprem em 3/3 bases. `INT-01` +29%, metros
conduzidos +37%.

---

## A. De onde vem

A R18.48 mediu OS-08 e falhou ao consertá-la — por defeito meu, não do mecanismo:
a camada retornava de `_decide` sem chamar a cadeia, o ganho de condução era
artefato do bypass, e `COE-01` pegou. A lição registrada foi: **para conduzir mais
é preciso mudar a decisão, não contorná-la.** Esta rodada muda a decisão.

## B. Dois defeitos, e o nome do método esconde o primeiro

O sítio, no dispatch de `_decide` (base; a cadeia do `cds-r122` delega ao final):

```js
let cone = 0; for (const d of opps) if (this._inForwardCone(o, d, g, inAtt ? 4.5 : 5.5, 9)) cone++;
if (cone === 0 && dtg > 6) { this._carry(o, g); return; }
```

```js
_inForwardCone(o, d, g, radius, len) {
  const dirx = Math.sign(g.x - o.x);
  const fx = (d.x - o.x) * dirx;
  return fx > 0 && fx < len && Math.abs(d.y - o.y) < radius;
}
```

**1. Não é um cone, é um retângulo.** `fx < len && |dy| < radius` descreve uma caixa
de 9 m de profundidade por 9–11 m de largura à frente do portador. Um defensor a
8 m adiante e 4 m ao lado está dentro dela e não está no caminho de ninguém. Um
cone de verdade abre com a distância: perto do portador o corredor é estreito,
longe é largo — o inverso de uma caixa.

**2. `cone === 0` é um portão absoluto.** Um único defensor naquela caixa proíbe
conduzir, qualquer que seja o jogador. É o mesmo tipo de defeito que a R18.40
encontrou na escalação (`a.tier - b.tier` como primeira chave de um comparador em
cascata): um veto que não aceita ser compensado por qualidade.

## C. O conserto, e o que entrou de fato

Dois termos independentes e parametrizados, medidos **em separado** para poder
atribuir o efeito:

| variante | o que muda |
|---|---|
| **A** | só a geometria: meia-largura `2,6 + fx·0,30`, comprimento 6,5 m |
| B | geometria + portão aceita `cone ≤ 1` se `(drible+aceleração)/2 ≥ 74` |
| C | só o portão, geometria original |

Base s1, n=48:

| variante | INT-01% | m/cond | m/partida | posse TF | gols/xG |
|---|---:|---:|---:|---:|---:|
| R18.44 | 1,182 | 2,301 | 15,10 | 8,01% | 1,010 |
| **A** | 1,382 | 2,251 | 17,35 | 8,24% | **0,964** |
| B | 1,783 | 2,123 | 21,19 | 8,51% | 1,112 |
| C | 1,555 | 2,105 | 18,24 | 8,35% | 1,108 |

Os dois termos somam de forma quase aditiva (+17% e +21% de metros, juntos +40%).

**Entrou só o A.** O termo de perícia (B/C) dobra o drift de coerência e estoura
`COE-01` numa base — ver §E.

## D. A variante promovida em 3 bases

| gate | faixa | R18.44 | s1 | s2 | s3 | mediana | |
|---|---|---:|---:|---:|---:|---:|---|
| ECO-01 gols | 2,4–3,2 | 2,542 | 2,417 | 2,583 | 2,771 | **2,583** | cumpre 3/3 |
| ECO-02 xG | 1,8–2,7 | 2,495 | 2,506 | 2,431 | 2,432 | **2,432** | cumpre 3/3 |
| ECO-03 chutes | 12–20 | 15,250 | 14,813 | 15,000 | 14,354 | **14,813** | cumpre 3/3 |
| ECO-04 no alvo | 4–7 | 5,167 | 4,604 | 5,063 | 4,792 | **4,792** | cumpre 3/3 |
| COE-01 gols/xG | 0,90–1,15 | 1,019 | 0,964 | 1,062 | 1,139 | **1,062** | cumpre 3/3 |

`ECO-03`/`ECO-04` acima são as faixas **antigas**. Nas faixas novas aprovadas
(17–27 e 6–10) esta build reprova, como reprova a R18.44 e todas as anteriores —
defeito rastreado, não bloqueio (ver `reports/r1846/RELATORIO.md` §A).

OS-08, mediana de 3 bases:

| | R18.44 | R18.49 | Δ |
|---|---:|---:|---:|
| `INT-01` condução % das ações | 1,182 | **1,527** | **+29%** |
| metros conduzidos por partida | 15,103 | **20,646** | **+37%** |
| metros por condução | 2,301 | 2,423 | +5% |

Direção consistente nas três bases nas três métricas.

## E. Por que o termo de perícia ficou fora

| | R18.44 | A | B |
|---|---:|---:|---:|
| gols/xG (mediana 3 bases) | 1,019 | **1,062** | 1,112 |
| gols/xG sem os gols de falha do goleiro | 0,994 | 1,037 | 1,086 |
| `COE-01` cumpre | — | **3/3** | **2/3** (s2 = 1,154) |

O B introduz ~0,09 de gol por partida **sem xG**, e não é o caminho do goleiro:
`gols_menos_falhas_sobre_xg` vai de 0,994 para 1,086. Não consegui atribuir a
fonte. Como é exatamente a assinatura do artefato que a R18.48 produziu — só
quatro vezes menor — o termo fica fora até a fonte ser encontrada.

**O A também drifta, e declaro:** 1,019 → 1,062, ou seja +4%. Isso está **dentro**
da banda de ruído de 10% do próprio `COE-01`, então não é regressão mensurável —
mas é a mesma direção, e quem continuar deve vigiar.

## F. Previsões que eu registrei antes de medir

| previsão | resultado |
|---|---|
| `metros_por_conducao` fica parado em ~2,3 m | **acertou** (2,42) |
| `COE-01` tem de ficar em [0,90; 1,15] | **acertou** para A (3/3); falhou para B |
| `INT-01` sobe para 2–5% | **errou** — chegou a 1,53 (A) e 1,78 (B) |

O erro do `INT-01` é informativo: **o cone era defeito real mas contribuinte
menor.** Passe continua ganhando 85% das ações, porque o passe de progressão
(`progressM > 3 && score > 0.6`) vem **antes** da condução no dispatch e tem barra
baixa. É o terceiro lever desta linhagem que se mostra secundário depois de
medido — junto com o limiar de chute (R18.46) e a janela de compromisso (R18.48).

E o que isto diz sobre `INT-01` = 1,53%: a condução não vai chegar a valores de
futebol real mexendo em quem **pode** conduzir. Vai ter de mexer em quem **prefere**
conduzir, e isso é a ordem do dispatch.

## G. Utilidade: a condução ainda não progride

`posse_no_terco_final_pct` foi de 8,01% para 8,24% e `situacoes_de_chute` de 8,42
para 8,73 — dentro do ruído. **A condução aumentou e não virou chegada.** Portanto
esta rodada é uma correção de *correção* (o predicado agora descreve o que o nome
promete), não um ganho de progressão.

O caminho que de fato move a chegada continua sendo o da R18.47 (roteamento de
cruzamento, +29% de oportunidades), que está escrito e medido e reprova por outro
motivo.

## H. Integridade

| gate | resultado |
|---|---|
| TEC-04 determinismo | 8/8 e 8/8 em ordem inversa |
| TEC-03 erros de console | 0 em Chromium real, camada da Copa carregada |
| `_inForwardCone` | **intacto** — o cone novo é calculado no próprio sítio, então os outros chamadores do predicado (`_openLaneAhead` e cia.) não mudaram |
| `_carry`, `decisionInterval`, ordem do dispatch | não tocados |

## I. Arquivos

```
dist/COPA DOS SONHOS - R18.49 - CONE DA CONDUCAO.html   508dc42c2f63
tools/r1849/patch_cone.js
reports/r1849/{bat,cond,xg}_A_s{1,2,3}.json    variante promovida, 3 bases
reports/r1849/{bat,cond,xg}_B_s{1,2,3}.json    termo de pericia, rejeitado
reports/r1849/{bat,cond,prog}_C_s1.json        so pericia, exploratoria
reports/r1849/determinismo.json  reports/r1849/browser_smoke.json
```
