# ESTADO — onde o projeto está neste dossiê

Gerado de `defeitos.json`, `pilha-estado.json` e `REFERENCIA.json`. Se você
abriu este zip meses depois, **é o retrato do momento em que ele foi montado**.

| | |
|---|---|
| Data | 11 de agosto de 2026 |
| Commit | `5b8c822` |
| Branch | `claude/game-ball-physics-issues-50m9e6` |
| Placar de design | **12/13** |
| Placar do futebol real | **15/21** |
| Motor | **5.086 linhas** (eram 5.262 antes da limpeza do D03) |

## A fase F1 foi executada

| # | o que era | resultado |
|---|---|---|
| **D03** | ~190 linhas mortas no motor | ✅ **176 linhas removidas** · 14/14 idênticas ao dígito |
| **D04** | o `_looseBall` do core está morto | ✅ aviso escrito no código, métricas idênticas |
| **D25** | `deflect` isento de sair do campo | ✅ feito · **sem efeito medido** — a linha não é alcançada |
| **D28** | constantes sensíveis sem registro | ✅ `calibration/sensibilidade.json`, 10 constantes |
| **D32** | `CAL` não existe no escopo da camada | ✅ lint no `verify.py` · **pegou um defeito vivo** |

### O que a execução ensinou

- **Dois dos cinco não consertaram nada** — e isso é resultado. O D25 removeu
  uma exceção inócua; a sonda provou que a linha nem executa.
- **O D32 pegou um defeito vivo no primeiro lint:** a camada 66 lia a
  calibração por `root.CAL`, que é `undefined`, e caía num `0,66` congelado.
- **A limpeza do D03 invalidou uma âncora do D08** — um dos pontos de chamada
  que ele citava como evidência estava dentro de código morto. A formulação
  do D08 precisa ser refeita antes de atacá-lo.
- **A referência de medição estava errada** (medida com `XG_ESCALA = 0,70`,
  commitada junto com a mudança para `0,651`) e reprovava mudanças inocentes.

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

## Os 34 defeitos

| estado | quantos |
|---|---|
| aberto | 20 |
| feito | 8 |
| parcial | 1 |
| guarda-corpo | 2 |
| decidir | 2 |
| adiado | 1 |
| **total** | **34** |

### Próximos, sem dependência pendente

- **D01** [F1] — Duas fisicas de bola convivem (g=20 no core, g=9,81 na camada 88)
- **D11** [F3] — Sorteio censurado 1: r12 sorteia o chute contextual, r183 existe para veta-lo
- **D14** [F4] — Sete contencoes em step consertam bugs que nunca foram procurados
- **D33** [F4] — Treze arquivos, 81 linhas, que so publicam numero de versao
- **D34** [F4] — Ate 81 sobrescritas nunca alcancadas — TETO SUPERIOR, nao contagem
- **D18** [F5] — _cross tem 255 linhas e nove correcoes embutidas

## A pilha de sobrescritas (14 partidas)

| estado | quantas |
|---|---|
| VIVA | 237 |
| MORTA | 81 |
| TERMINAL | 5 |
| **total** | **323** |

> MORTA = **não alcançada em 14 partidas**. Teto superior, não contagem.

## As 6 métricas que faltam para o futebol real

| métrica | jogo | faixa real | defeito |
|---|---|---|---|
| laterais | 15,87 | 33–48 | **D08** (formulação a rever) |
| gols no último terço | 14,8% | 19–22% | **D19** |
| gols no primeiro terço | 20,0% | 11–13% | **D19** |
| bloco defensivo | 37,4 m | 25–35 m | **D20** |
| acerto ao alvo (design) | 0,326 | ≥ 0,34 | **D13/D22** |
| passes | 385 | 700–900 | **D21** (decisão de produto) |

**O alvo realista é 19/21** — `passes` não fecha sem mexer no `clockRate`.
