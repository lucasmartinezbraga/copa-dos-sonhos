# ESTADO — onde o projeto está

| | |
|---|---|
| Data | 12 de agosto de 2026 |
| Commit | `a2fceaf` |
| Branch | `claude/game-ball-physics-issues-50m9e6` |
| Placar de design | **12/13** |
| Placar do futebol real | **15/21** |
| Motor | **5.086 linhas** (eram 5.262) |

## Fase F1 — executada

| # | resultado |
|---|---|
| **D01** | ✅ premissa **corrigida** · a 2ª física estava em `_looseRoll` · aprovado |
| **D02** | ⛔ **REFUTADO** · entrega mais longa 1,53 m, não 6,8 m |
| **D03** | ✅ **176 linhas mortas removidas** · 14/14 idênticas |
| **D04** | ✅ aviso no código · idênticas |
| **D25** | ✅ feito · **sem efeito** — a linha não é alcançada |
| **D28** | ✅ `calibration/sensibilidade.json` · 10 constantes |
| **D32** | ✅ lint · **pegou um defeito vivo** |

## Segunda rodada de sondas — os sete formulados por leitura

| # | veredito | o número |
|---|---|---|
| **D11** | ✅ confirmado, **e maior** | 264,67 vetos em 515,17 decisões — **51,4%** |
| **D13** | ✅ confirmado, **e maior** | 52,7% dos chutes comprimidos; pior caso **13,30 m** vs 6,5 m suposto |
| **D26** | ✅ confirmado, intacto | 35.195 mudanças/partida de `decideT` |
| **D12** | ⚠ formulação refutada | o core devolve a posse em **2,8%** das chamadas |
| **D16** | ⚠ reclassificado | `_breaking` sai diferente **0×** em 887 mil chamadas |
| **D15** | ⛔ não mensurável | a camada 84 não publica auditor nenhum |
| **D08** | ⏸ pendente | fenômeno medido; causa sem sonda |

> ### O que mudou de prioridade
>
> **D11 sobe.** Metade das decisões do jogo passa pelo censor — 264,67 vetos
> por partida, mais de quatro por minuto. É o defeito estrutural com maior
> alcance medido do catálogo, e sai de F3 para o primeiro depois da F1.
>
> **D16 desce.** A falsificação não vaza; é modelo ausente, não bug escondido.
>
> **D15 volta uma casa.** O primeiro passo não é consertar nem apagar: é
> acrescentar um contador na camada 84. Sem isso, remover 255 linhas é aposta.

## Os 34 defeitos

| estado | quantos |
|---|---|
| aberto | 18 |
| feito | 9 |
| decidir | 2 |
| guarda-corpo | 2 |
| refutado | 1 |
| parcial | 1 |
| adiado | 1 |
| **total** | **34** |

## A linha de base (300 partidas, semente pareada)

| métrica | média |
|---|---|
| `goals` | 2.867 |
| `shots` | 23.713 |
| `onTarget` | 7.590 |
| `xg` | 3.011 |
| `corners` | 11.343 |
| `fouls` | 22.143 |
| `yellow` | 4.487 |
| `passes` | 384.683 |
| `passOk` | 314.333 |
| `tackles` | 49.833 |
| `offsides` | 5.177 |
| `throwIns` | 15.810 |
| `goalKicks` | 12.960 |

## Leia o Volume VIII-A antes de continuar

Quatro premissas caíram na primeira rodada e duas na segunda. A causa é comum:
as sondas originais mediram o código do motor, e o motor não é o que roda.
**Antes de consertar um ramo, escreva uma sonda de 40 linhas que conte aquele**
**ramo.** Modelos: `ramo-d25.js`, `ramo-g20.js`, `ramo-rolagem.js`,
`ramo-d02.js`, `ramos.js`.
