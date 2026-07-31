# OS-25 — alcance de marcação e teto de screen

**Base:** R18.57 · 24 partidas, semente 4200000

A bateria 3×48 da OS-06 decidiu a rota. Dois sítios: `reach` em `:21192` e o
teto de UM screen em `:21206`. O DEF fica 48% do tempo em zona contra 36% do
MID, então o reach do DEF pesa tanto quanto o do MID.

## DOIS PONTOS MEDIDOS

| | R18.57 | **24/22/16 · 3 screens** | 30/28/18 · 5 screens |
|---|---|---|---|
| `threatCoverage` (gate ≥ 0,65) | 0,633 ✗ | **0,656 ✓** | 0,642 ✗ |
| `markerMeanDistance` (≤ 8,5) | 6,32 | 7,06 ✓ | 8,05 ✓ |
| gate `marking` reprovado | 62% | **50%** | 46% |
| `swarmRate` reprovado | 15% | 12,5% | 8% |
| `severeCollapse` reprovado | 35% | 29% | 29% |
| `entreLinhas_cobertura` | 0,723 | 0,733 | 0,726 |
| DEF em zona | 0,476 | 0,466 | 0,446 |
| escanteios | 2,56 | **1,79** | 2,58 |
| gols / xG | 2,81 / 2,26 | 2,79 / 2,27 | 2,63 / 2,22 |

## ESCOLHA: 24/22/16 com 3 screens

É o único ponto que passa o gate registrado (`threatCoverage ≥ 0,65`). Escolhi
por ele e não por preferência: o critério estava escrito antes da medição.

**Custo, e não vou disfarçar:** escanteios caem de 2,56 para 1,79 nessa
configuração — numa métrica que já está longe da faixa 4–10. Marcação melhor
gera menos chance, e menos chance gera menos escanteio. O ponto 30/28/18
preserva o escanteio (2,58) mas **não passa** o gate de marcação.

Os dois valores de escanteio vêm de N=24 e N=48 respectivamente, e escanteio
tem variância alta nesse tamanho — a direção é confiável, a magnitude não.

## O QUE NÃO SE MOVEU

`corredorMax` seguiu em 10 e `colunaLongeDaBola` em ~0,034 nos dois pontos. O
alcance de marcação **não resolve a coluna**. Ela é ocupação de faixa, e nenhum
dos dois sítios desta rodada toca faixa.
