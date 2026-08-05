# Copa dos Sonhos

Simulador de futebol histórico em HTML único, construído para montar seleções de diferentes Copas do Mundo e disputar partidas em um motor próprio de futebol.

[**Jogar no navegador**](https://lucasmartinezbraga.github.io/copa-dos-sonhos/)

## Estado atual

| Frente | Versão / situação |
|---|---|
| Build pública no GitHub Pages | **5.0.0** |
| **Build promovida (linhagem atual)** | **R18.97** — `df4d9f28…` |
| Base imutável da cadeia de build | **R18.86** — `f920ae1a…` |
| Promovida anterior | R18.96 — `a335bbba…` |
| Última rodada técnica | **OS-107 — o time vai para o lance** · **promovida** |

A **R18.97** é a referência da linhagem atual e substitui a R18.50 como baseline
de desenvolvimento. Ela é produzida por uma cadeia reprodutível de patches sobre
a R18.86, e a build sai **byte a byte** igual:

```bash
node tools/r1896/build_r1897.js saida.html \
  --base="dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"
# sha256  df4d9f284691ca5341866983c3bd1d4ffc91bbb1258d6192125cc74b67a34e66
```

> A pasta `tools/r1896/` guarda a cadeia da **linhagem inteira** (base R18.86 em
> diante), não de uma versão só. O mesmo vale para `reports/r1896/` e
> `docs/r1896/`.

Leia `docs/r1896/HANDOFF.md` inteiro antes de tocar em qualquer coisa desta
linhagem, e `docs/r1896/PROXIMA_RODADA.md` para a fila de trabalho.

## O jogo

- draft de jogadores e seleções históricas;
- elencos de diferentes edições de Copa do Mundo;
- formações, mentalidade, funções e ajustes táticos;
- partidas em campo 2.5D;
- atributos e perfis individuais influenciando decisões;
- bolas paradas, goleiros e inteligência do treinador adversário;
- interface para desktop e celular;
- entrega jogável em um único arquivo HTML.

## Arquivos principais

- `docs/index.html`: versão jogável publicada no GitHub Pages;
- `dist/COPA DOS SONHOS - R18.97 - JOGO DE FUTEBOL.html`: **build promovida**;
- `dist/COPA DOS SONHOS - R18.96 - JOGO DE FUTEBOL.html`: promovida anterior;
- `dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html`: base da cadeia — **não editar**;
- `tools/r1896/`: a cadeia de build, os patches (na cadeia e falsificados), os
  diagnósticos, a bateria oficial e o gerador da cópia de laboratório;
- `reports/r1896/`: um relatório por rodada, com a previsão registrada antes de medir;
- `docs/r1896/HANDOFF.md`: como se constrói, as armadilhas e o estado com número;
- `docs/r1896/PROXIMA_RODADA.md`: a fila de trabalho e o que **não** refazer;
- `src/`: código modular do projeto;
- `tests/` e `tools/`: validações, auditorias e laboratórios.

A linhagem R18.50 (`dist/COPA DOS SONHOS - R18.50 - *.html`, `tools/r1851/`,
`reports/r1851/`) fica no repositório como registro; ela não é mais a baseline.

## Última rodada — OS-107, o time vai para o lance · promovida

Primeiro item da PARTE A da fila: *"quando acontecer o escanteio o time tem que ir
pra área, mesma coisa a falta"*. O censo mediu e confirmou o defeito —
**0,656 atacante dentro da grande área no instante em que o escanteio é cobrado**,
e **0,095 defensor dentro da própria área** na falta cruzada, cujos três alvos são
teleportados até **70,40 m**.

A correção resolve o defeito — postos ocupados no reinício 28,8% → 94,3%,
atacantes na área 0,656 → 2,233, defensor na própria área na falta 0,26 → 4,47,
teleporte de 70 m → **zero em 2140 jogadores** — e **passa nos três gates** na
bateria oficial (48 × 6): gols 2,0070 (pior 1,8125), xG 2,1139, escanteios
4,9305. **Promovida como R18.97.**

O preço foi medido e aceito com número na mesa: **chutes 19,13 → 17,59 por
partida, negativo nas seis bases**. Parte disso é conserto — cruzamento contra
área vazia virando finalização inflava a estatística. Os **−1,13 do jogo
corrido** continuam sem canal isolado e são o **item A0** da fila. E a pior base
fica a **0,0125 do piso** num gate cujo ruído é ±0,3: a próxima rodada trabalha
sem folga.

Dois subprodutos que valem mais que a rodada:

1. **A bateria oficial foi pega errando** e foi consertada. Duas metades da mesma
   base, com a mesma build, chegam a diferir **0,79 gol** — dez vezes a folga do
   gate. O protocolo passou de 24 para **48 partidas por base**, a linha de base
   foi re-medida e agora há um comando só: `tools/r1896/bateria_oficial.sh`.
2. **Marcar `_setPieceRole` fora do escanteio faz o jogador sumir de duas camadas
   de movimento** por até 183 s de jogo vivo, porque só a cadeia de escanteio
   limpa o papel. Virou a §2.3c do HANDOFF.

Relatórios completos:
[`RODADA_OS107_BLOCO_BOLA_PARADA.md`](reports/r1896/RODADA_OS107_BLOCO_BOLA_PARADA.md)
e [`RODADA_OS108_OS109_CANAL_DOS_CHUTES.md`](reports/r1896/RODADA_OS108_OS109_CANAL_DOS_CHUTES.md).

## Desenvolvimento

### Linhagem R18.9x (atual)

```bash
# reconstruir a build promovida a partir da base — tem de bater o sha256
node tools/r1896/build_r1897.js saida.html \
  --base="dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"

# bateria oficial: SEIS bases, 48 partidas cada, os três gates no fim
tools/r1896/bateria_oficial.sh saida.html
```

Gates: `gols` entre 1,8 e 3,0 · `xG ≤ 2,7` (ECO-02) · `escanteios` entre 4 e 10
(ECO-05), **nas seis bases**. Gate é rede de segurança, não objetivo.

**48 partidas por base, não 24.** Duas metades da mesma base com a mesma build
chegam a diferir 0,79 gol; o gate policia margens de 0,075. E mesmo com 48,
diferença de gol menor que ~0,3 não é resolvida — olhe se o sinal se repete nas
seis bases antes de acreditar em qualquer média.

Nunca edite a build à mão — ela é saída. Um patch só é promovido depois da
bateria completa, e um patch reprovado fica no repositório, fora da cadeia, com o
número que o derrubou no cabeçalho.

### Estrutura modular (linhagem Fase 1-3)

```bash
python3 tools/build.py
python3 tools/verify.py
python3 tests/browser_smoke.py
```

A versão em `docs/` é a publicada. As builds instrumentais em `dist/` só devem ser promovidas depois de passarem pelos gates e pelas baterias previstas.
