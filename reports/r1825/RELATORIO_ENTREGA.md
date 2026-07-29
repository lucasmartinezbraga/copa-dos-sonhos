# R18.25 — ENTREGA NA ÁREA

**Status: `PROMOVÍVEL`** · base R18.21-RC2 (`3b2fece8ac4a`) · entrega `ddccf733e880`

Uma expressão mudou. A causa foi encontrada depois de quatro hipóteses medidas, três delas erradas — e é o registro dessas três que vale mais do que o patch.

---

## A. A causa

O ramo `!atk` de `_cross` — cruzamento aéreo sem atacante na área, **5,47 lances por partida, 37,5% de todos os cruzamentos** — entregava a bola em `{x: g.x, y: FW/2 + R(-8,8)}`.

`x = g.x` é **em cima da linha de gol**.

Geometria medida na chegada, antes do patch:

| | goleiro | bola |
|---|---:|---:|
| profundidade (distância da linha de gol) | 5,6 m | **0,0 m** |
| desvio lateral do centro | 2,9 m | 5,6 m |
| distância entre eles | | **9,4 m** |

Lateralmente estavam a 2,7 m. **Toda a distância estava na profundidade.** A bola era entregue 5,6 m atrás do goleiro e atrás de toda a defesa — num lugar onde nenhum jogador de futebol fica. Por construção não havia quem disputasse.

O próprio motor já sabia a geometria certa: o ramo do cruzamento rasteiro, 50 linhas acima, entrega em `g.x - attackDir*5.2`.

## B. O patch

```js
// antes
{x: g.x,                                    y: FW/2+R(-8,8)}
// depois
{x: g.x - tm.attackDir*(5.5+R(0,5.5)),      y: FW/2+R(-8,8)}
```

A bola passa a cair entre a pequena área e a marca do pênalti. Nada mais é tocado: nenhum sorteio, nem `_goalkeeperClaim`, nem posicionamento.

Construtor: `auditoria/patch_entrega.js` (aborta se o SHA da base não bater).

## C. Efeito medido

**Geometria** (12 partidas, 3 formações):

| | antes | depois |
|---|---:|---:|
| goleiro até a bola | 9,4 m | **6,6 m** (mediana 5,8; p10 3,7) |
| zagueiro mais próximo | 22,1 m | **16,5 m** |
| goleiro passa na validação de contato | 0% | **5,4%** |

**Bateria pareada, n=48, mesmas sementes:**

| métrica | RC2 | R18.25 | faixa do contrato |
|---|---:|---:|---|
| escanteios | 1,250 | **1,438** (+15%) | 4–10 |
| `header_clear` | 1,06 | **1,21** (+14%) | — |
| tiros de meta | 11,479 | 10,938 (−4,7%) | — |
| chutes | 12,458 | 12,750 | 12–20 **✓** |
| no alvo | 4,333 | 4,688 | 4–7 **✓** |
| xG | 2,102 | 2,202 | 1,8–2,7 **✓** |
| gols | 2,729 | 2,813 | — |

**Nenhuma faixa estourada.** Escanteio é a métrica mais estável do probe (0% de deslocamento próprio a n=49), então o +15% sustenta decisão.

## D. As três hipóteses que morreram

Registradas porque poupam repetir o caminho.

| | o que testei | resultado |
|---|---|---|
| **R18.22** | ramo `!atk` vira disputa (goleiro/zagueiro), matando o `chance(.76)` | **rejeitado.** Meus portões de contato falhavam 100% e tudo caía em `_looseBall` na pequena área: xG 2,102 → **2,748**, estourando a faixa. Troquei um sorteio por fábrica de chance fácil. |
| **R18.23 P1** | goleiro decide sair e converge para o ponto de chegada | **rejeitado.** Decide sair 3,89×/partida, mas percorre 3,84 m dos 9,45 m necessários — `speedOf` lhe dá ~5 m/s. Somado ao P3 não acrescenta nada (6,6 → 6,9 m). |
| **R18.24 P2** | goleiro para de seguir a lateral do ponta até o poste | **rejeitado.** Efeito exatamente zero (9,4 m antes e depois). A separação era de profundidade, não lateral. |

## E. O que sobrou, com causa localizada

**94,6% dos cruzamentos ainda chegam sem disputa**, e agora o resíduo é lateral: a entrega espalha ±8 m do centro, o goleiro cobre ±2,9 m, e quem deveria estar nas bolas abertas é um **zagueiro** — que está a 16,5 m.

No instante em que o cruzamento sai:

| | |
|---|---:|
| zagueiro mais próximo do próprio gol | 26,6 m |
| **defensores dentro da própria grande área** | **0,25** |

Um cruzamento sai de 30 m e há um quarto de zagueiro na área.

**A causa está localizada e é diferente da que eu supunha.** Não é o bloco de zona: com a bola no terço final, `defThird` é verdadeiro e **todo defensor com `_markRef` retorna antes, pelo ramo de marcação individual** (linha ~7468). A defesa **espelha o ataque** — como os atacantes não entram na área (0,04 a até 12 m do ponto de chegada), os zagueiros também não.

Tentei uma defesa zonal de cruzamento inserida antes do ramo de marcação (`auditoria/patch_zaga.js`, R18.27). Ela executa, mas move pouco: **0,25 → 0,32 defensor na área**, porque a ameaça calculada fica em ~0,28 num cruzamento de 30 m e põe o zagueiro a 13,5 m do gol enquanto a bola cai entre 5,5 e 11 m. **Não promovida** — precisa de calibração e de bateria pareada, e mexer em forma defensiva afeta todas as defesas do jogo.

**Este é o próximo alvo, agora isolado:** fazer os zagueiros centrais ocuparem a área na fase de cruzamento, largando a marcação individual. É o que destrava, na ordem: disputa aérea → desvio → escanteio nascido de evento real → e aí sim dá para desligar os cinco `chance()` que hoje fabricam 80% dos escanteios.

## F. Instrumentos

Todos em `auditoria/`, todos só de observação:

| | |
|---|---|
| `censo_geometria.js` | reinício concedido × geometria (26% com a bola em campo; 80% dos escanteios) |
| `diag_cross_gate.js` | qual portão autoriza cada cruzamento (85% vêm da abertura da R12.2, a 48 m) |
| `diag_cross_branch.js` | ramo rasteiro × aéreo e onde está o finalizador |
| `diag_partida.js` · `diag_chegada.js` | geometria na saída e na chegada do cruzamento |
| `diag_zaga.js` | onde está a defesa quando o cruzamento sai |
| `diag_gk.js` | decisão, deslocamento e velocidade do goleiro |
