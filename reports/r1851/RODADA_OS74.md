# OS-74 — o lado do escanteio passa a seguir a bola

**Item 2 do `PROXIMA_RODADA.md`** · base R18.83 (`5897f3af409f`) ·
candidata `dist/COPA DOS SONHOS - R18.84-RC - LADO DO ESCANTEIO (NAO PROMOVIDA).html`
(`801cc4735e1e`) · patch `tools/r1851/patch_os74_corner_side.js`

**Status: NÃO PROMOVIDA.** O defeito foi corrigido e medido — concordância de
lado de 44,2% para 94% — mas o xG sobe de forma consistente nas três bases, e o
xG já está encostado no teto.

---

## A. Duas armadilhas do documento, confirmadas antes de patchar

**A âncora do `PROXIMA_RODADA.md` não casaria.** Ele escreve:

```js
const cy = chance(.5) ? 1.5 : FW-1.5, sign = cy < FW/2 ? -1 : 1;
```

O texto real na R18.83 é `sign=cy<FW/2?-1:1;`, sem espaços. Com o helper
`edit()` isso morre em `ABORTA: ancora 0x`.

**`_setCorner` tem seis camadas empilhadas**, todas encadeando, uma delas
falando em "cobra de lá". Era exatamente o cenário que o documento levantou
("pode existir uma camada posterior que já corrija o lado"). Por isso a medição
veio antes.

## B. O meu primeiro instrumento estava errado

A primeira versão do `diag_os74_corner_side.js` localizava o batedor por
`_setPieceRole === 'taker'` e lia `y` entre 15 e 47. Com `FW = 68`, um batedor
de escanteio tem de estar em ~1,5 ou ~66,5 — **nenhum estava**. O marcador
sobra de bolas paradas anteriores e não é limpo, então eu lia um jogador
qualquer.

**A primeira medição, 55,6%, não vale.** A leitura confiável é a posição da
**bola**, que `_setCorner` coloca no canto.

## C. Medido, com o instrumento corrigido — 16 partidas

| | R18.83 | +OS-74 |
|---|---:|---:|
| escanteios legíveis | 95 | 83 |
| concordam com o lado da saída | 42 | 78 |
| **taxa de concordância** | **44,2%** | **94%** |

44,2% é cara-ou-coroa. O defeito do item 2 estava confirmado, e o patch o
resolve.

## D. A decisão que moldou o patch

O `chance(.5)` **continua sendo chamado**, e o resultado é descartado quando há
lado confiável:

```js
const _os74Sorteio = chance(.5);
const _os74Y = (this.ball && Number.isFinite(this.ball.y)) ? this.ball.y : null;
const _os74TemLado = _os74Y !== null && Math.abs(_os74Y - FW / 2) > 4;
const cy = _os74TemLado ? (_os74Y < FW / 2 ? 1.5 : FW - 1.5)
                        : (_os74Sorteio ? 1.5 : FW - 1.5), sign=cy<FW/2?-1:1;
```

Remover a extração mudaria o consumo do gerador seedado, e o `HANDOFF.md` §6
avisa que aí duas configurações divergem por **caos**, não por efeito. Mantendo
a chamada, o fluxo fica alinhado ao da base até o ponto da decisão.

Quando a bola já foi recolocada ao centro antes da chamada, não há lado para
ler e o sorteio decide. Inventar um lado seria pior que sortear.

## E. Previsões, registradas antes de medir

| previsão | resultado |
|---|---|
| 1. concordância sobe para perto de 100% | **acertou** — 94% |
| 2. o número de escanteios não muda | **errou** — 163 → 150 na amostra de 16 |
| 3. agregados dentro da banda de ruído | **errou** — xG e chutes fora |
| 4. os casos sem-canto continuam existindo | **acertou** — 68 → 67 |

A previsão 2 estava mal formulada: assim que a bola vai para outro canto o jogo
diverge de verdade, e contar escanteios entre builds diferentes mistura efeito
com caos. O que serve é o delta pareado em várias bases, abaixo.

## F. O que derrubou a promoção — três bases, n=24 cada

| métrica | s1 `4200000` | s2 `8400000` | s3 `1260000` | direção | banda |
|---|---:|---:|---:|---|---:|
| **xG** | +8,1% | +23,7% | +1,8% | **CONSISTENTE** | 7% |
| chutes | +9,3% | +6,6% | +0,6% | consistente | 7% |
| escanteios | +19,5% | −12,4% | −2,6% | inconsistente | 31% |
| gols | −13,2% | +20,0% | +18,2% | inconsistente | 30% |

**O xG sobe nas três bases**, com mediana de +8,1% acima da banda de 7%. Não é
caos.

**Mecanismo plausível, não isolado:** o escanteio passa a sair do lado onde a
jogada estava, então os atacantes já estão perto da entrega e a chance nasce
melhor. É futebol mais correto que custa qualidade de chance. Registro como
hipótese — não medi a distância dos atacantes à entrega antes e depois.

Com o xG documentado em **2,67** contra teto de **2,7**, um aumento consistente
não cabe.

## G. Ressalva sobre o meu instrumento de ecologia

A minha bateria (`tools/r1840/bateria.js`) **não reproduz os números
documentados da R18.83**:

| | documentado | minha medição da base |
|---|---:|---:|
| xG | 2,67 | 2,861 / 2,330 / 2,397 (três bases) |
| chutes | 21,8 | 23,2 / 22,2 / 22,3 |

Portanto **minhas leituras absolutas de gate não valem** como veredito de
`ECO-02`. O que vale é o delta pareado, porque aí o instrumento é o mesmo dos
dois lados. Quem for retomar deve conferir o `ECO-02` com o ferramental oficial
do projeto antes de tratar o número absoluto como gate.

## H. O achado secundário, não tratado

Das 163 chamadas de `_setCorner` em 16 partidas, **68 não levam a bola a canto
nenhum** — ela fica a 12–20 m da linha, no meio do campo. São escanteios
cunhados com a bola em jogo, o padrão que a linhagem já combateu em rodadas
anteriores. O patch não os toca (previsão 4), e eles merecem ficha própria.

## I. O que fica para quem continuar

O patch está no repositório, fora da cadeia de build, como manda o `HANDOFF.md`
§1. Três caminhos, em ordem de honestidade:

1. **Medir a distância dos atacantes à entrega** antes e depois, para confirmar
   ou derrubar o mecanismo da §F. Se for isso, o custo de xG é intrínseco à
   correção e a decisão passa a ser do dono: escanteio no lado certo vale 8% de
   xG?
2. **Compensar dentro do próprio escanteio** — se o lado correto aproxima os
   atacantes, a rotina pode ser ajustada para manter a mesma qualidade média de
   chance. É calibração, não conserto.
3. **Tratar o achado da §H primeiro.** Se 42% dos escanteios são cunhados com a
   bola em jogo, o lado correto está sendo aplicado a um evento que já não
   deveria existir — e consertar a fonte pode mudar todo o quadro.

## J. Arquivos

```
tools/r1851/diag_os74_corner_side.js   instrumento (2a versao, a 1a estava errada)
tools/r1851/patch_os74_corner_side.js  patch, fora da cadeia
reports/r1851/os74_base_n16.json       concordancia, base
reports/r1851/os74_patch_n16.json      concordancia, candidata
reports/r1851/os74_eco_{base,patch}[_sN].json   ecologia, 3 bases
dist/COPA DOS SONHOS - R18.84-RC - LADO DO ESCANTEIO (NAO PROMOVIDA).html
```
