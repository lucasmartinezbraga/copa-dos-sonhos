# OS-31 — dois erros meus de medição, e a falta de nada a ver

## ERRO 1: `stats.passes` NÃO conta passes

`:5875` — `this.stats[o.team].passes++` está no ramo de **sucesso** do `_pass`.
Instrumentando a chamada de `_pass` diretamente:

| | valor |
|---|---|
| `_pass` chamado | **787,2 / partida** |
| `stats.passes` | 386 / partida |
| **acerto real** | **49%** |

Passe tentado está em **787, perto do real (~900)**. O que está errado não é o
volume — é o **acerto: 49% contra ~80% real**.

**A sessão inteira eu li "passes 260 contra 900" e chamei de déficit de
volume.** Era acerto. E a OS-30 (`clockRate` 0,16) foi promovida em parte com
esse argumento — o ganho de "passes" que eu reportei era ganho de passes
*completos*, não de jogo fluindo mais.

## ERRO 2: `passesOk` não existe

Zero ocorrências na build. Eu li a chave, recebi `undefined`, reportei 0,0%.

## O FLUXO, AGORA MEDIDO DE VERDADE

| | |
|---|---|
| comprimento médio | 17,7 m |
| direção | frente 49% · lado 22% · trás 29% |
| comprimento | curto <12 m 25% · médio 63% · longo >28 m 12% |
| origem | defesa 31% · meio 62% · ataque 8% |
| destino | defesa 26% · meio 61% · ataque 13% |
| decisões | pass 87% · carry 7,7% · cross 2,9% · shoot 2,1% |

Só **8% dos passes saem do terço de ataque**. O jogo circula no meio e quase
não constrói dentro do último terço — isso, e não o volume, é o que faz o
futebol parecer travado.

## A FALTA DE NADA A VER — CORRIGIDA

A OS-10 trocou `dtg < 28 && chance(0.42)` por `chance(0.92)` **sem limite de
distância**. Resultado medido na R18.62: **38% das cobranças aconteciam a mais
de 42 m do gol** — falta no meio-campo virando lance cerimonioso.

| faixa | R18.62 | R18.63 |
|---|---|---|
| 0–25 m | 0,92 | 1,08 |
| 25–42 m | 5,33 | 5,58 |
| **42–60 m** | **2,75** | **0,00** |
| **60+ m** | **1,08** | **0,00** |
| total | 10,08 | 6,67 |

Toda falta continua sendo bola parada. O que muda é a cerimônia: longe do gol,
reinício rápido.

## SOBRE O MEU JEITO DE MEDIR

A crítica está certa e tem prova. Nesta sessão eu usei como indicador:
`stats.passes` (conta outra coisa), `passesOk` (não existe), `yellowCards` e
`freeKicks` (nunca incrementados), e `decisionQuality.agreement/count` (deu
134%, denominadores diferentes).

O erro de método é o mesmo nos cinco: **li o nome da chave e supus o
significado**, em vez de verificar contra o evento que ela deveria contar.
Instrumentar a chamada — como fiz aqui com `_pass` e com `_goal` na OS-24 — é
o que separa indicador de rótulo.
