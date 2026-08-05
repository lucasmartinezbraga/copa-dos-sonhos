# Copa dos Sonhos — linhagem R18.8x/R18.9x, promovida R18.97

Este pacote é **autossuficiente**: com ele e um Node qualquer você reproduz a
build promovida byte a byte, mede tudo o que foi medido, e sabe o que já foi
tentado e falsificado.

## Comece por aqui, nesta ordem

1. **`HANDOFF.md`** — como se constrói, as armadilhas que custam rodadas
   inteiras, como medir, e o estado atual com número. **Leia inteiro antes de
   tocar em qualquer coisa.**
2. **`PROXIMA_RODADA.md`** — a fila de trabalho, o que está aberto, e a lista do
   que **não** refazer.
3. `reports/` — o relatório de cada rodada, com as previsões registradas antes de
   medir e os números que promoveram ou derrubaram cada patch.

## Verificação em 30 segundos

Rodando da raiz do repositório:

```bash
node tools/r1896/build_r1897.js saida.html --base="dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"
```

Tem de imprimir, ao fim:

```
sha256  df4d9f284691ca5341866983c3bd1d4ffc91bbb1258d6192125cc74b67a34e66
```

Se não bater, **pare** — algo no pacote está fora do lugar. Rode duas vezes e
confira que o SHA se repete.

## O que tem dentro

```
dist/          a base R18.86 (NÃO EDITE), a promovida R18.97 e a anterior R18.96
tools/r1896/   os patches da cadeia, os patches falsificados, os diagnósticos,
               a bateria oficial e o gerador da cópia de laboratório
reports/r1896/ um .md por rodada, mais os JSON de censo e bateria
docs/r1896/    este arquivo, o HANDOFF e a PROXIMA_RODADA
```

## As três coisas que mais economizam seu tempo

1. **Nunca conclua qual camada está viva lendo código.** Quatorze sítios envolvem
   `_startTravel`. Instrumente com setter na propriedade capturando a pilha —
   isso respondeu em uma rodada o que três tentativas de dedução não resolveram.
2. **Use SEIS bases na bateria.** A build que era promovida reprova o piso de
   gols numa base que ninguém tinha rodado. Três bases é recorte.
3. **Registre a previsão antes de medir.** Cinco patches desta sessão foram
   derrubados pela própria previsão registrada. É o que separa medir de torcer.

## Estado em uma linha

Promovida: **R18.97**, seis bases, **288 partidas** — gols 2,007 (pior 1,8125),
xG 2,114 (máx 2,293), escanteios 4,931 (pior 4,583). **Zero bases reprovando
qualquer gate** — mas a folga acima do piso de gols é **0,0125**, e o ruído do
gate é ±0,3. A próxima rodada trabalha sem folga.

## Última rodada

**OS-107** resolveu o item A1 da fila — o time agora vai para a área no escanteio
e na falta, dos dois lados, caminhando e sem teleporte. Atacantes na área quando
o escanteio é cobrado: **0,656 → 2,233**. Defensores dentro da própria área na
falta cruzada: **0,262 → 4,468**. Teleporte de até 70,4 m: **zero em 2140**.

O preço foi medido e aceito: **chutes 19,13 → 17,59**, negativo nas seis bases.
Parte disso é conserto (cruzamento contra área vazia inflava a estatística);
**−1,13 no jogo corrido continua sem canal isolado e é o item A0 da fila.**

Duas coisas mudaram de fundação no caminho: a bateria oficial passou de 24 para
**48 partidas por base** (§3.2b), e marcar `_setPieceRole` fora do escanteio faz
o jogador sumir de duas camadas (§2.3c).
