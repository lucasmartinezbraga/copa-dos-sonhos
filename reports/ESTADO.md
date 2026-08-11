# ESTADO — onde o projeto está neste dossiê

Gerado automaticamente. Se você abriu este zip meses depois, **este é o
retrato do momento em que ele foi montado** — o repositório pode ter andado.

| | |
|---|---|
| Data | 11 de agosto de 2026 |
| Commit | `ed3786c` |
| Branch | `claude/game-ball-physics-issues-50m9e6` |
| Build analisado | `ff808761f579765613f0a13fdab1112a9ab335837300fbd61e2f92e6c8c95e7e` |
| Placar de design | **12/13** |
| Placar do futebol real | **15/21** |

## Os 34 defeitos

| estado | quantos |
|---|---|
| aberto | 24 |
| feito | 4 |
| parcial | 1 |
| guarda-corpo | 2 |
| decidir | 2 |
| adiado | 1 |
| **total** | **34** |

### Já feitos

- **D04** — _looseBall do core esta morto e nao parece
- **D05** — Passe rasteiro decolava (14 cm de salto, 2 quiques)
- **D06** — Goleiro mergulhava no primeiro instante alcancavel (folga ~0 por construcao)
- **D07** — _bestPass tinha 25+ termos e nenhum era a linha de impedimento

### Os cinco de maior retorno, ainda abertos

- **D25** [F1] — _ballTravel isenta 'deflect' de sair do campo, sem justificativa
- **D01** [F1] — Duas fisicas de bola convivem (g=20 no core, g=9,81 na camada 88)
- **D02** [F1] — _contestLoose entrega a bola sem teto de distancia
- **D08** [F2] — Laterais pela metade — a direcao do desvio e sempre para dentro
- **D03** [F1] — ~190 linhas mortas guardadas por return antecipado dentro do motor

## A pilha de sobrescritas, medida em 14 partidas

| estado | quantas |
|---|---|
| VIVA | 237 |
| MORTA | 81 |
| TERMINAL | 5 |
| **total** | **323** |

> **MORTA aqui significa NÃO ALCANÇADA EM 14 PARTIDAS** — é teto superior,
> não contagem de código morto. Catorze partidas não exercitam pênalti
> decisivo, expulsão dupla, prorrogação nem metade da bola parada. Antes de
> apagar qualquer coisa, rode `node tools/fisica/pilha.js dist/index.html 300`.

## As 6 métricas que faltam para o futebol real

| métrica | jogo | faixa real | defeito que fecha |
|---|---|---|---|
| laterais | 15,91 | 33–48 | **D08** |
| gols no último terço | 14,1% | 19–22% | **D19** |
| gols no primeiro terço | 20,0% | 11–13% | **D19** |
| bloco defensivo | 37,4 m | 25–35 m | **D20** |
| acerto ao alvo (design) | 0,326 | ≥ 0,34 | **D13/D22** |
| passes por partida | 385 | 700–900 | **D21** (decisão de produto) |

**O alvo realista é 19/21, não 21/21.** `passes` não fecha sem mudar o
`clockRate`, e mudar o `clockRate` custa tempo de tela. Está discutido em D21.
