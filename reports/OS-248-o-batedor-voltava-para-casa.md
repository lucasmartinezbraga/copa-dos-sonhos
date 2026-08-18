# OS-248 · Hipótese reprovada: o batedor **não** volta para casa

Achado **pelo portão novo**, não por relato: a etapa `lances` da Mesa reprovou
com o único invariante que tinha amostra suficiente para julgar.

```
BAI  F6 batedor nao salta na cobranca      16/19   84.2%   pior 0.56 m
```

Meia passada de teletransporte no quadro em que se olha para o batedor — a
queixa do dono sobre falta, em versão pequena.

**A correção não foi feita. Esta página existe para registrar por quê.**

---

## O que estava certo

**Não é regressão.** Rodei o mesmo invariante contra o build do commit anterior:

| | controle (HEAD) | build novo |
|---|---|---|
| F6 | 12/14 · **85,7%** | 16/19 · 84,2% |

Igual dentro do ruído: o defeito **precede** a OS-246/247.

E as outras três reprovações da primeira execução da Mesa (`F3 88,9%`,
`F4 50,0%`, `E2 75,0%`) eram amostra pequena — `F4 50,0%` era *uma barreira de
duas*. Sumiram quando o portão ganhou piso de amostra.

## A hipótese, que parecia sólida

A camada da caminhada de recomposição tem a exceção escrita:

```js
if (p === _bat) return;   // batedor: OS-77/OS-83/R18.15
```

E `_bat` vem de `this.__cdsTakerWait` — marca que as camadas de espera
**limpam assim que o batedor chega na bola**, ainda com `dead` correndo. Da
limpeza até a cobrança a exceção deixa de valer justamente para ele. Parecia o
décimo caso do padrão desta base: *um conceito é escrito, é lido, e não pode
acontecer* — aqui com o agravante de funcionar e parar de funcionar exatamente
no intervalo que importa.

Escrevi a trava: uma vez batedor daquele lance, batedor até a bola voltar a
viver. F6 mediu pior salto **0,56 → 0,34 m**.

## Por que foi reprovada

Duas razões, e a primeira sozinha já basta:

**1. A camada não roda durante falta.** A janela dela é armada em UM lugar:

```js
P._kickoff = function (side, start) { … this.__os214Ate = … }
```

`_kickoff` — **pontapé de saída**, depois de gol e de intervalo. E o passo só
age com `ativa = __os214Ate > t && dead > 0`. Numa falta, `__os214Ate` é zero:
a camada está inerte. Ela não podia estar arrastando o batedor, porque ela não
está lá. Os 0,56 → 0,34 m foram **outra partida**, não o efeito do conserto.

**2. O meu patch tinha o próprio defeito que eu vivo documentando.** A linha
que limpa a trava:

```js
if (num(this.dead) <= 0) this.__os248Bat = null;
```

está dentro do bloco que só executa quando `dead > 0`. **Ela nunca roda.** O
batedor do primeiro lance ficaria excluído da recomposição pelo resto da
partida. Escrito, lido, impossível de acontecer — a mesma armadilha, cometida
por mim, no mesmo dia em que a documentei pela décima vez.

## O que fica

* Revertida por inteiro. Quarta hipótese reprovada por medição nesta base,
  junto com a OS-233 (constantes do escanteio) e a OS-244 (aceleração da
  câmera).
* **F6 continua aberto**: 16/19, pior 0,56 m, pré-existente. A causa é outro
  escritor de posição durante a bola morta da falta, ainda não identificado.
* A camada 81 documenta, no próprio código, que a falta pede **arbitragem entre
  os escritores existentes**, não mais um escritor — e que isso é rodada
  própria, com bateria junto. É por aí que a próxima tentativa começa: medir
  quadro a quadro *quem* move o batedor entre a chegada e a cobrança, como a
  `aproximacao.js` fez para o escanteio.

## A bateria fechou a prova

Rodei 288 partidas nos dois builds — com a OS-248 e sem ela (o controle, HEAD).
As **treze métricas voltaram idênticas até a terceira casa**:

```
goalsPerMatch 3.14 · shotsPerMatch 25.38 · xgPerMatch 3.16 · onTargetRate 0.324
passCompletion 0.822 · foulsPerMatch 22.70 · yellowsPerMatch 4.59
redsPerMatch 0.368 · cornersPerMatch 7.56 · drawRate 0.250
zeroZeroRate 0.069 · blowoutRate 0.184 · averageEndingStamina 64.36
```

A camada 81 **não** é pulada pela bateria. Se a trava tivesse encostado em
alguma coisa, algum número teria se mexido. Nenhum se mexeu — porque a trava
nunca chegou a engatar: `__cdsTakerWait` é marca de falta, escanteio e lateral,
e no pontapé — o único lance em que essa camada acorda — ela é nula. `_bat`
nunca existiu, `__os248Bat` nunca foi escrito.

Ou seja: o patch era **inerte no motor e inerte no lance que ele queria
consertar**. Os 0,56 → 0,34 m eram, do começo ao fim, duas amostras diferentes
de partidas diferentes.

## Um item aberto que essa medição revelou de graça

O controle a 288 partidas dá `redsPerMatch` **0,368** contra teto de 0,30. Não
é da OS-246, nem da 247, nem da 248 — é o valor da própria linha principal
hoje. Rodadas anteriores dispensaram 0,318 como ruído; 0,368 em 288 partidas
é ~106 expulsões contra as ~70 do controle antigo (`controle-288.json`, anterior
à OS-234), e isso não se explica por amostra.

Fica anotado como próxima medição: **o que subiu as expulsões entre a OS-234 e
hoje.** A comparação certa é a bateria commit a commit nesse intervalo.

## A lição de método

Eu tinha o número (0,56 → 0,34 m) e uma explicação plausível. O que faltava era
a pergunta mais barata de todas: **essa camada chega a rodar neste lance?**
Trinta segundos de leitura teriam poupado a rodada inteira — e teriam evitado
que eu quase commitasse um patch que nunca limpa o próprio estado.
