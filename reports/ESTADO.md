# ESTADO — onde o projeto está

| | |
|---|---|
| Data | 11 de agosto de 2026 |
| Commit | `3c8965d` |
| Branch | `claude/game-ball-physics-issues-50m9e6` |
| Placar de design | **12/13** |
| Placar do futebol real | **15/21** |
| Motor | **5.086 linhas** (eram 5.262) |

## A fase F1 foi executada — e metade dela refutou o próprio documento

| # | resultado |
|---|---|
| **D01** | ✅ premissa **corrigida** · a segunda física estava em `_looseRoll`, não no voo · aprovado |
| **D02** | ⛔ **REFUTADO** · a entrega mais longa é 1,53 m, não 6,8 m · não implementar |
| **D03** | ✅ **176 linhas mortas removidas** · 14/14 idênticas ao dígito |
| **D04** | ✅ aviso no código · idênticas |
| **D25** | ✅ feito · **sem efeito medido** — a linha não é alcançada |
| **D28** | ✅ `calibration/sensibilidade.json` · 10 constantes |
| **D32** | ✅ lint de escopo · **pegou um defeito vivo** |

> ### Leia o Volume VIII-A antes de continuar
>
> **Quatro premissas caíram na mesma rodada** (D25, D01, D02, D08). A causa é
> comum: as sondas originais mediram o código do motor, e o motor não é o que
> roda. Antes de consertar um ramo específico, escreva uma sonda de 40 linhas
> que conte **aquele ramo**. Custa 2 minutos e já economizou quatro ciclos de
> medição de 25 minutos.

**Sete defeitos** ainda formulados por leitura de código precisam de sonda de
ramo antes de virar conserto: D08, D11, D12, D13, D14, D15, D16 e D26.

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

## O que continua de pé

Os defeitos medidos por **agregado** não dependem de eu ter acertado qual linha
executa, e seguem válidos:

| métrica | jogo | faixa real | defeito |
|---|---|---|---|
| gols no último terço | 14,8% | 19–22% | **D19** |
| gols no primeiro terço | 20,0% | 11–13% | **D19** |
| bloco defensivo | 37,4 m | 25–35 m | **D20** |
| acerto ao alvo (design) | 0,326 | ≥ 0,34 | **D13/D22** |
| tarja preta | 24–43% | 0% | **D24** |
| laterais | 15,81 | 33–48 | **D08** — fenômeno de pé, causa a refazer |
