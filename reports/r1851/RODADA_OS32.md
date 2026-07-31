# OS-32 — o funil do passe, medido direito (e a correção da minha correção)

**Base:** R18.63 · 10 partidas, semente 4200000

## O FUNIL REAL

| | por partida |
|---|---|
| `_pass` chamado | 778,6 |
| chega à execução (`stats.passes`, `:5875`) | 385,6 |
| evento `pass` (completou) | 332,6 |
| evento `bad_pass` | 30,7 |
| evento `intercept` | 16,2 |

**Acerto = 332,6 / 385,6 = 86%.** Isso é valor de futebol real (~80%). **Não há
problema de precisão de passe.**

## EU ERREI DUAS VEZES SEGUIDAS NO MESMO NÚMERO

**Primeiro erro (sessão inteira):** li `stats.passes` = 386 como "passes por
partida" e comparei com ~900 real, concluindo déficit de volume. Usei isso para
justificar o `clockRate`.

**Segundo erro (rodada anterior):** ao descobrir que `_pass` é chamado 778×,
dividi 386/778 e anunciei "acerto de 49%, o problema é precisão e não volume".
**Também errado.** 386 não são os passes completados — são os que **chegam à
execução**. Os outros ~393 saem de `_pass` por ramos anteriores sem executar
passe nenhum.

O acerto verdadeiro só aparece comparando execução com evento de desfecho: 86%.

**Conclusão corrigida:** o volume executado é 385/partida contra ~900 real —
o déficit de volume que eu descrevi primeiro **existe**. A precisão está certa.
Minha "correção" da rodada passada estava errada e a afirmação original estava
certa pelo motivo errado.

## O QUE NÃO SEI

Não sei o que são os ~393 `_pass` que não executam. Podem ser conversão em
cruzamento, passe seguro por outro caminho, ou aborto. **Não vou patchar sem
saber** — três hipóteses minhas já morreram nesta sessão por eu agir antes de
medir a população.

O próximo passo é um censo de saída de `_pass`: instrumentar cada `return`
anterior a `:5875` e contar. Uma medição, e o eixo fecha.

## LIÇÃO DE MÉTODO

Três leituras diferentes do mesmo número em três rodadas. A regra que faltava:
**contador só significa alguma coisa depois de casado com o evento que ele
deveria contar.** `stats.passes` não é "passes"; é "passes que chegaram à
execução". O nome mentiu nas três vezes, e eu só descobri instrumentando a
chamada e os eventos ao mesmo tempo — que é o que deveria ter feito na primeira.
