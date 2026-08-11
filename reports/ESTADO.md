# ESTADO — onde o projeto está neste dossiê

Gerado automaticamente de `defeitos.json`, `pilha-estado.json` e `REFERENCIA.json`.
Se você abriu este zip meses depois, **este é o retrato do momento em que ele
foi montado** — o repositório pode ter andado.

| | |
|---|---|
| Data | 11 de agosto de 2026 |
| Commit | `7cff564` |
| Branch | `claude/game-ball-physics-issues-50m9e6` |
| Placar de design | **12/13** |
| Placar do futebol real | **15/21** |

## A linha de base (300 partidas, semente pareada)

| métrica | média |
|---|---|
| `goals` | 2.933 |
| `shots` | 23.720 |
| `onTarget` | 7.743 |
| `xg` | 3.017 |
| `corners` | 11.200 |
| `fouls` | 22.230 |
| `yellow` | 4.427 |
| `passes` | 385.460 |
| `passOk` | 315.263 |
| `tackles` | 50.033 |
| `offsides` | 5.080 |
| `throwIns` | 15.873 |
| `goalKicks` | 12.940 |

> **Atenção:** esta referência foi **refeita**. A anterior era o arquivo
> `a2-goleiro-n300.json`, que havia sido medido com `XG_ESCALA = 0,70` e
> commitado junto com a mudança para `0,651` — ou seja, era anterior ao
> código que dizia representar. Ela fazia o `--identico` reprovar mudanças
> inocentes. Detalhe na seção D25 do documento.

## Os 34 defeitos

| estado | quantos |
|---|---|
| aberto | 22 |
| feito | 6 |
| parcial | 1 |
| guarda-corpo | 2 |
| decidir | 2 |
| adiado | 1 |
| **total** | **34** |

### Feitos

- **D04** — _looseBall do core esta morto e nao parece
- **D05** — Passe rasteiro decolava (14 cm de salto, 2 quiques)
- **D06** — Goleiro mergulhava no primeiro instante alcancavel (folga ~0 por construcao)
- **D07** — _bestPass tinha 25+ termos e nenhum era a linha de impedimento
- **D25** — _ballTravel isenta 'deflect' de sair do campo, sem justificativa — **sem efeito medido**
- **D32** — Armadilha de escopo: CAL nao existe dentro de uma camada

### Próximos, sem dependência pendente

- **D28** [F0] — deadBallRecovery: delta de 0,02 move o placar de design em 2 pontos
- **D01** [F1] — Duas fisicas de bola convivem (g=20 no core, g=9,81 na camada 88)
- **D03** [F1] — ~190 linhas mortas guardadas por return antecipado dentro do motor
- **D11** [F3] — Sorteio censurado 1: r12 sorteia o chute contextual, r183 existe para veta-lo
- **D14** [F4] — Sete contencoes em step consertam bugs que nunca foram procurados
- **D33** [F4] — Treze arquivos, 81 linhas, que so publicam numero de versao

## A pilha de sobrescritas (14 partidas)

| estado | quantas |
|---|---|
| VIVA | 237 |
| MORTA | 81 |
| TERMINAL | 5 |
| **total** | **323** |

> MORTA aqui = **não alcançada em 14 partidas**. É teto superior, não
> contagem de código morto. Rode `pilha.js dist/index.html 300` antes de apagar.

## As 6 métricas que faltam para o futebol real

| métrica | jogo | faixa real | defeito |
|---|---|---|---|
| laterais | 15,87 | 33–48 | **D08** |
| gols no último terço | 14,8% | 19–22% | **D19** |
| gols no primeiro terço | 20,0% | 11–13% | **D19** |
| bloco defensivo | 37,4 m | 25–35 m | **D20** |
| acerto ao alvo (design) | 0,326 | ≥ 0,34 | **D13/D22** |
| passes | 385 | 700–900 | **D21** (produto) |

**O alvo realista é 19/21, não 21/21** — `passes` não fecha sem mexer no `clockRate`.
