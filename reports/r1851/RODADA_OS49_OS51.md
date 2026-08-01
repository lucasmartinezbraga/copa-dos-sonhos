# RODADA OS-49 / OS-50 / OS-51 — corpo em 360, falta limpa, drible com consequência

Três observações de campo numa mensagem só. Medi as três antes de mexer em
qualquer uma.

---

## OS-49 · "não consegue conduzir em 360 graus igual FIFA"

A **condução** já é 360 (6 partidas, 61.485 quadros com bola no pé):

```
frente (0-30)            43,4%
diagonal (30-60)         20,4%
lateral (60-120)         16,3%
diagonal para tras       8,1%
para tras (150-180)     11,9%
```

Mais de um terço já é lateral ou para trás. **O que não gira é o corpo**
(`:19533`):

```js
if (Math.abs(mvx) > 0.4) d.face = Math.sign(mvx);
```

`face` só vale +1 ou −1, e **só muda quando há deslocamento lateral de tela**.
Quem corre para cima ou para baixo do campo mantém a orientação antiga — desce
o gramado encarando o lado. São duas direções, não 360. E o `lean`, calculado
com suavização logo acima, só desloca a **cabeça**; o tronco nunca se inclina.

Edits: `face` passa a sair do vetor inteiro com ângulo suavizado; o tronco
inclina para onde corre; e a corrida vertical ganha perspectiva (o corpo
estreita, porque visto mais de frente/costas).

---

## OS-50 · "os negócio que tem na hora da falta ainda tá muito estranho"

Cinco coisas desenhadas ao mesmo tempo em cima do lance: cartão grande no topo,
linha tracejada até o gol, círculo de 9,15 m, **polilinha azul ligando todo
defensor a menos de 11 m** e anel pulsante com seta sobre o cobrador.

A polilinha era a pior: ela não desenhava a barreira, desenhava um **grafo de
proximidade** — incluindo quem estava atrás da bola ou fora do lance. Desde a
OS-36 a barreira existe no motor e tem marca própria (`_os36Wall`), então dava
para desenhar a barreira de verdade.

Agora: só quem é barreira aparece, como faixa discreta ao pé; a linha até o gol
saiu; o círculo ficou fraco; o anel do cobrador encolheu e perdeu a seta; e o
cartão virou uma tarja compacta de uma linha.

---

## OS-51 · "não tá rolando dribles"

Os dribles acontecem — **46,7 por partida**, 10,8 com efeito — e a pose dura
~0,7 s. O que não acontece é a **consequência**. 277 dribles vencidos medidos:

```
distancia ao marcador   antes 1,46 m -> 1 s depois 3,43 m
deixou o marcador para tras            62,1%
MARCADOR CONTINUOU COLADO              27,8%
```

Quase um terço dos dribles vencidos não gera separação nenhuma. É o mesmo padrão
que esta linhagem inteira vem encontrando: **o desfecho existe na estatística e
não tem consequência física** — igual ao bloqueio (OS-39), à barreira (OS-36) e
ao duelo aéreo (OS-43).

Edit: quem é driblado entra em recuperação por 0,62 s, com o passo em direção ao
alvo reduzido a 46%. Não é penalidade de atributo nem teletransporte — é o tempo
de reequilibrar o corpo.

### Medido

```
                          R18.73   R18.74
separacao 1 s depois       3,43 m   4,02 m
marcador colado            27,8%    20,5%
deixou para tras           62,1%    55,6%   <- CAIU; previ que subiria
```

Testei uma versão mais suave (janela 0,45 / fator 0,62): devolve gols, mas
**perde o conserto** — "colado" volta para 28,0%, igual à base. Foi descartada.

---

## Bateria — 40 partidas, mesmas sementes

```
             R18.73   R18.74
goals         2.35     1.85
xg            2.05     2.01
shots        18.00    17.10
corners       4.47     4.75
passes      371.27   368.13
```

**O custo é real e está nos gols: 2,35 → 1,85**, contra ~2,7 do futebol real. A
razão gol/xG ficou em 0,92, que é saudável, mas o nível absoluto caiu de novo.
Registro como a dívida aberta desta linhagem — os gols vêm caindo desde 3,27 e
eu já disse duas vezes que não vou compensar com multiplicador. **Este é o
próximo alvo.**

Escanteios subiram (4,47 → 4,75) e seguem na faixa. Navegador: sem `pageerror`,
sem erro de console.

---

## Previsões que não se cumpriram

- "deixou o marcador para trás" deveria subir; **caiu** de 62,1% para 55,6%. Com
  o defensor mais lento a separação cresce em qualquer direção, não só do lado
  do gol.
- OS-49 e OS-50 são apresentação pura e não alteram nada do motor; a queda de
  gols é inteiramente da OS-51.

## Fica aberto

- **gols 1,85** — a dívida principal.
- "marcador colado" ainda em 20,5%.
