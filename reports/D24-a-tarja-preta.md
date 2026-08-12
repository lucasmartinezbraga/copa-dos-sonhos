# D24 · a tarja preta — resolvida no layout, com o caminho da solução completa provado

**Data:** 2026-08-12 · **Resultado: ENTREGUE** — o vazio dentro do quadro caiu de
**31,8% / 22,3% / 28,2% / 46,0%** para **0,5% / 0,3% / 0,5% / 0,8%**, com as 14
métricas **idênticas ao dígito**. Duas tentativas anteriores foram revertidas, e
o caminho para o passo seguinte está provado por experimento.

---

## O que estava escrito

> **D24** — tarja preta ocupa 24% a 43% da caixa do campo.
> **Critério de aceite:** letterbox ≤ 4% nas 4 resoluções.
> **Risco:** a recomendação MENOS fundamentada do documento.

A ficha estava certa sobre o risco, e por um motivo que ela não sabia.

---

## Conclusão 1 · o critério é aritmeticamente impossível

O canvas tem proporção **fixa**. Com proporção fixa `A` num contêiner de
proporção `A_caixa`, o vazio é exatamente:

```
vazio = 1 − min(A, A_caixa) / max(A, A_caixa)
```

As caixas medidas nas quatro resoluções:

| viewport | caixa | proporção |
|---|---|---|
| 1400×900 | 986×672 | 1,467 |
| 1920×1080 | 1410×852 | 1,655 |
| 1280×800 | 890×572 | 1,556 |
| 1024×768 | 634×540 | **1,174** |

Os extremos são 1,174 e 1,655 — razão **0,709**. Para o vazio ficar ≤ 4% em
todas, seria preciso `min/max ≥ 0,96` em todas simultaneamente. **Nenhum valor
fixo de A satisfaz isso.** O melhor A possível é a média geométrica dos
extremos (1,394) e ainda deixa **15,8%** nas duas pontas.

**O critério "≤ 4% nas 4 resoluções" só é atingível com proporção responsiva ao
contêiner** — ou seja, mudando o layout da partida, não uma constante.

## Conclusão 2 · a proporção 2,048 é calibração do palco 2.5D, não CSS

A hipótese natural era: o campo real é 105×68 (proporção **1,544**) e o mundo
lógico é 1024×500 (**2,048**), então o gramado é desenhado **37% mais largo do
que é**. Corrigir para `CH = 673` põe o gramado em 996×645 = 105:68 exato e
aproxima o canvas das caixas reais.

Implementei e medi. **A métrica melhorou muito:**

| viewport | antes | depois |
|---|---|---|
| 1400×900 | 31,8% | **8,2%** |
| 1920×1080 | 22,3% | **11,5%** |
| 1280×800 | 28,2% | **7,6%** |
| 1024×768 | 46,0% | **27,3%** |

Média **32,1% → 13,7%**. Build, verify e smoke em Chromium: todos passaram.

**E o jogo quebrou.** A captura mostra o gramado virado num trapézio torto, só
um gol em quadro, a perspectiva escapando pela direita.

A causa está na camada 21 (`cds-ux-boot`, o palco 2.5D):

```js
G.topY = M + 34;  G.bottomY = G.CH - 3;
R0: 0.72,          // largura distante / próxima
```

`R0` é a razão de perspectiva, calibrada para a faixa vertical de **451 px**
que `CH = 500` produz. Com `CH = 673` a faixa vira **624 px** e a mesma razão
espalha a perspectiva por 38% mais altura. Junto vão a escala de altura da bola
(22 px/m), o plano de chão (`FOOT = 13×0,98 − 2`) e o raio do atleta (`13×s`) —
todos calibrados contra o mesmo mundo.

> **A proporção 2,048 não é um descuido de CSS. É uma constante do palco.**
> Mudá-la exige re-derivar a perspectiva inteira, e isso é uma OS de render, não
> um conserto de uma linha.

---

## O instrumento também estava medindo errado — duas vezes

**Primeira:** `caixa.js` media só a tarja **vertical**. Com essa métrica, esticar
o canvas na altura "consertaria" o defeito criando tarja **lateral** que ela não
vê. Corrigido para medir **área**, com as duas sobras separadas.

Foi decisivo: depois do conserto, 1920×1080 ficou com **0% vertical e 8% lateral**.
Na métrica antiga isso seria vitória total.

**Segunda:** ela media o preenchimento dentro do **elemento canvas**, não dentro
do quadro que o jogador vê. Dava para zerar sem melhorar nada — bastava o canvas
se dimensionar por aspecto, e a sobra sairia dele para o `.field-wrap`, onde
continua preta. Agora publica os dois, e o número que vale é o do quadro.

Sem essas duas correções eu teria reportado "28,4% → 3,6%, critério atingido em
2 de 4" sobre um jogo visivelmente quebrado.

---

## O que fica

**Não implementar** o D24 como está escrito. O que sobra é uma escolha de
produto, e ela tem três caminhos, em ordem de custo:

1. **Aceitar a tarja e diminuí-la pelo layout.** O `.field-wrap` reserva mais
   altura do que o canvas pode usar; devolver essa altura ao painel lateral ou
   à narração transforma preto em conteúdo. Não mexe no render.
2. **Proporção responsiva.** O canvas acompanha a caixa e o palco 2.5D é
   re-derivado em função dela. Atinge ≤ 4% em qualquer resolução, e é a única
   coisa que atinge. É uma OS de render.
3. **Corrigir a geometria do campo** (1,544 em vez de 2,11) junto com (2) — o
   gramado hoje é 37% mais largo do que um campo de futebol, e isso é um defeito
   próprio, independente da tarja.

O caminho 1 é barato e melhora o sintoma. Os caminhos 2 e 3 são a solução real e
são trabalho de render, com re-calibração de `R0`, `topY`, da escala de altura e
do plano de chão.

**A ficha do D24 foi atualizada:** o critério antigo era impossível e agora está
escrito o que é atingível, com o número medido de cada caminho.


---

# ADENDO 1 — a correção que entrou

Nenhuma das duas hipóteses de render era necessária. O quadro (`.field-wrap`)
tinha `align-self: stretch` + `height: 100%` e tomava a linha `1fr` inteira do
grid do cockpit. O canvas, de proporção fixa, só conseguia preencher parte dela
— **o resto virava preto dentro da moldura do campo.**

```css
/* camada 19 · antes */
align-self: stretch; height: 100%; max-height: none;
#fieldcv { position:absolute; bottom:var(--cds-narr-h);
           height:calc(100% - var(--cds-narr-h)); object-fit:contain; }

/* depois */
align-self: center;  height: auto;  max-height: 100%;
#fieldcv { position:relative; width:100%; height:auto;
           aspect-ratio:1024/500; margin-bottom:var(--cds-narr-h); }
```

O quadro passa a ter altura de conteúdo e se centraliza. A sobra sai de dentro
da moldura e vira fundo de página.

| viewport | antes | depois |
|---|---|---|
| 1400×900 | 31,8% | **0,5%** |
| 1920×1080 | 22,3% | **0,3%** |
| 1280×800 | 28,2% | **0,5%** |
| 1024×768 | 46,0% | **0,8%** |

`aceitar.sh --depois --identico`: **14/14 idênticas ao dígito.** Smoke em
Chromium: passou. Capturas conferidas nas quatro resoluções — perspectiva
intacta, os dois gols em quadro.

**O que isto não faz:** o campo não fica maior. A moldura encolhe até ele. Em
1024×768 sobra bastante fundo abaixo do quadro, porque o campo é limitado pela
**largura** da coluna do cockpit.

# ADENDO 2 — a correção da minha própria conclusão

Eu escrevi acima que *"o gramado é desenhado 37% mais largo do que é"*. **Isso
está errado**, e a matéria-prima para ver o erro estava na projeção o tempo
todo:

```js
const vn = (fy - G.M) / fH;                    // normaliza a altura logica
y: G.bottomY - Yn * (G.bottomY - G.topY)
```

`vn` normaliza antes de projetar. **A forma do campo na tela não depende de
`CH`** — depende de `fW`, `topY`, `bottomY` e `R0`. Os 2,11 do espaço lógico
são intermediários; a perspectiva os normaliza.

E, por consequência, **não foi mudar `CH` que quebrou a tela na tentativa 2 —
foi `bottomY = CH − 3`.** Com `CH` maior a faixa da projeção saltou de 451 px
para 624 e espalhou a perspectiva por 38% mais altura.

# ADENDO 3 — o caminho para "o campo perfeito", provado por experimento

Se o acoplamento é só esse, então **fixar a faixa** deve preservar a
perspectiva com qualquer `CH`. Testei:

```js
G.bottomY = G.CH - 3;  G.topY = G.bottomY - 451;   // faixa fixa, ancorada embaixo
const CW=1024, CH=619, M=14;                       // canvas mais alto
```

**A perspectiva sobreviveu intacta** — trapézio correto, áreas certas, nada do
desenho torto da tentativa 2. A captura está em `reports/fotos-d24c/`.

O que ainda falta, e é a razão de o experimento não ter entrado: **a câmera
também depende de `CH`.**

```js
const cpy = Math.max(vh / 2, Math.min(CH - vh / 2, camY));
ctx.translate(CW / 2, CH / 2);
```

Com `CH` maior o enquadramento muda — no experimento o campo ficou mais
ampliado e cortado embaixo. Para fechar:

1. `CH` responsivo ao contêiner (`CH = CW / proporçãoDaCaixa`, travado numa
   faixa sã);
2. faixa da projeção fixa em 451 px, ancorada em `bottomY`;
3. **câmera re-enquadrada**: o alvo e os limites de `cpy` passam a ser
   relativos à faixa do gramado, não a `CH`;
4. o céu/arquibancada preenche o que sobrar acima — preto vira estádio.

Com isso o vazio é **zero em qualquer formato de janela**, sem distorcer o
campo e sem cortar nada. É trabalho de render com verificação por captura em
pelo menos quatro resoluções — não é ajuste de constante, mas o caminho deixou
de ser hipótese: os itens 1 e 2 estão medidos e o item 3 é o que resta.
