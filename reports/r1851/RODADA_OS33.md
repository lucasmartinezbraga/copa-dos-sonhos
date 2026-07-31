# OS-33 — o censo de saída de `_pass`: era fase de preparo

**Base:** R18.63 · 10 partidas, semente 4200000

## CENSO EXECUTADO

Envolvi `_pass` e verifiquei, a cada chamada, se `stats.passes` subiu. Quando
não subiu, capturei qual ação saiu no lugar e quais eventos dispararam dentro
da chamada.

| | por partida |
|---|---|
| `_pass` entradas | 778,6 |
| executou passe | 385,4 (49,5%) |
| **saiu sem executar** | **393,2 (50,5%)** |
| — por outra ação (`_cross`, `_carry`, …) | **0** |
| — sem ação nenhuma | 393,2 |
| evento `action_prepare` dentro dessas saídas | **393,2** |

A correspondência é exata: **toda** saída precoce emite `action_prepare` e
nenhuma outra ação.

## O MECANISMO: PREPARO EM DUAS FASES

`:17440` — a camada R14 intercepta a ação e grava `__r14Pending` com
`contactAt = t + prepDur(o, type)`, emite `action_prepare` e **retorna sem
executar**. O comentário logo abaixo explica: *"enquanto a ação está em preparo
o portador está comprometido"*. A execução acontece numa chamada posterior, no
instante do contato.

Ou seja: `_pass` é chamado **duas vezes por passe** — uma para preparar, uma
para executar. As 778 chamadas são 393 preparos + 385 execuções.

## CONCLUSÃO, E A TERCEIRA VERSÃO DO MESMO NÚMERO

- **Passes executados: 385/partida.** `stats.passes` estava certo o tempo todo.
- **Acerto: 86%** (332,6 eventos `pass` sobre 385,4 execuções). Correto.
- **Os 49% que anunciei eram artefato da chamada em duas fases.**

Logo: o déficit de **volume** que descrevi na primeira leitura **existe** —
385 contra ~900 real. A precisão está certa. A justificativa original da OS-30
(`clockRate`) volta a ser válida.

Três rodadas, três leituras do mesmo número, e a primeira estava certa.

## O QUE ISSO CUSTOU E O QUE ENSINA

Duas correções públicas erradas antes de chegar aqui. A causa raiz não foi o
contador: foi eu ter tratado "número de chamadas de `_pass`" como "tentativas
de passe" sem verificar o que a função faz quando é chamada. O contador
`stats.passes` nunca mentiu — eu é que inventei um denominador.

**A regra, agora completa:** antes de dividir dois números, verificar que os
dois contam eventos da mesma natureza. Chamada de função não é tentativa de
ação quando existe uma camada de preparo no meio.
