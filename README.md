# Copa dos Sonhos

Simulador de futebol histórico em HTML único, construído para montar seleções de diferentes Copas do Mundo e disputar partidas em um motor próprio de futebol.

[**Jogar no navegador**](https://lucasmartinezbraga.github.io/copa-dos-sonhos/)

## Estado atual

| Frente | Versão / situação |
|---|---|
| Build pública no GitHub Pages | **5.0.0** |
| **Build promovida (linhagem atual)** | **R18.96** — `a335bbba…` |
| Base imutável da cadeia de build | **R18.86** — `f920ae1a…` |
| Última rodada técnica | **OS-107 — o time vai para o lance** |
| Situação da OS-107 | Defeito medido e corrigido; **reprovada pela bateria e não promovida** |

A **R18.96** é a referência da linhagem atual e substitui a R18.50 como baseline
de desenvolvimento. Ela é produzida por uma cadeia reprodutível de patches sobre
a R18.86, e a build sai **byte a byte** igual:

```bash
node tools/r1896/build_r1896.js saida.html \
  --base="dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"
# sha256  a335bbba8aad76a40df4399bbc32ebf995116e46f0e73fcdf31b4a3fa14ca164
```

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
- `dist/COPA DOS SONHOS - R18.96 - JOGO DE FUTEBOL.html`: **build promovida**;
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

## Última rodada — OS-107, o time vai para o lance

Primeiro item da PARTE A da fila: *"quando acontecer o escanteio o time tem que ir
pra área, mesma coisa a falta"*. O censo mediu e confirmou o defeito —
**0,656 atacante dentro da grande área no instante em que o escanteio é cobrado**,
e **0,095 defensor dentro da própria área** na falta cruzada, cujos três alvos são
teleportados até **70,40 m**.

A correção resolve o defeito (postos ocupados no reinício 28,8% → 93,6%,
teleporte → zero) e **foi reprovada pela bateria de seis bases**: gols 2,1805 →
1,9722, com 1,5417 na pior base contra um piso de 1,8. Ela fica no repositório
fora da cadeia, com o número que a derrubou no cabeçalho.

Leia o relatório completo em
[`reports/r1896/RODADA_OS107_BLOCO_BOLA_PARADA.md`](reports/r1896/RODADA_OS107_BLOCO_BOLA_PARADA.md).

## Desenvolvimento

### Linhagem R18.96 (atual)

```bash
# reconstruir a build promovida a partir da base — tem de bater o sha256
node tools/r1896/build_r1896.js saida.html \
  --base="dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"

# bateria oficial, protocolo espelho_30 — SEIS bases, nunca três
for s in 4200000 8400000 1260000 2100000 6300000 3150000; do
  node tools/r1896/bateria_espelho30.js --build=saida.html --matches=24 --semente=$s
done
```

Gates: `gols` entre 1,8 e 3,0 · `xG ≤ 2,7` (ECO-02) · `escanteios` entre 4 e 10
(ECO-05), **nas seis bases**. Gate é rede de segurança, não objetivo.

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
