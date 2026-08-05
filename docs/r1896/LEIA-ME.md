# Copa dos Sonhos — pacote de continuação, R18.96

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
node tools/r1896/build_r1896.js saida.html --base="dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"
```

Tem de imprimir, ao fim:

```
sha256  a335bbba8aad76a40df4399bbc32ebf995116e46f0e73fcdf31b4a3fa14ca164
```

Se não bater, **pare** — algo no pacote está fora do lugar. Rode duas vezes e
confira que o SHA se repete.

## O que tem dentro

```
dist/          a base R18.86 (NÃO EDITE) e a promovida R18.96
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

Promovida: **R18.96**, seis bases, 144 partidas — gols 2,181 (pior 1,875), xG
2,193 (máx 2,289), escanteios 4,785 (pior 4,000). **Zero bases reprovando
qualquer gate.**

## Última rodada

**OS-107** mediu o item A1 da fila (o time não vai para o lance), localizou a
causa em `:18287` e `:6951`, corrigiu, e **foi reprovada pela bateria** — gols
1,9722 com 1,5417 na pior base. Não promovida. Está em
`tools/r1896/patch_os107_bloco_bola_parada.js`, fora da cadeia, e o relatório
com todos os números é `reports/r1896/RODADA_OS107_BLOCO_BOLA_PARADA.md`.
