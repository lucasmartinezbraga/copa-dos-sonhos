# D49–D50 · A câmera de TV, e o travessão de 1,36 m

**Data:** 2026-08-14 · **Camada 21** ·
**Instrumentos novos:** `tools/fisica/tela/camera.js`,
`tools/fisica/tela/travessao.js`

Pedido: *"e se desse uma abaixadinha na câmera"* … *"aquela abaixada angulada
da TV"*.

---

## §D49 · Duas coisas separadas, e só as duas juntas dão TV

| parâmetro | o que faz |
|---|---|
| **`R0`** | razão entre a largura da borda **distante** e a da próxima. 1,0 seria planta baixa (câmera no zênite); quanto menor, mais baixa a câmera |
| **`faixa`** | quanto da altura de tela o gramado ocupa — câmera baixa **achata** o campo na vertical |

Estava tudo fixo: `R0 = 0,72`, faixa integral.

Os dois são aplicados **mutando `G` uma vez por quadro**, no início do `grass()`,
não lidos em cada consumidor. É o único jeito que mantém todo mundo de acordo:
`G.topY` é lido pela projeção, pelo teto de altura da bola, pela base da
arquibancada, pela vinheta e pelo `faixa()` público. Se só a projeção soubesse
da câmera nova, os jogadores andariam num gramado que o desenho põe em outro
lugar.

E a câmera entra **antes do palco**: `buildStage` desenha arquibancada e céu a
partir de `G.topY`, então mudar a câmera depois deixaria o estádio no lugar
antigo com o gramado no novo.

### A tentativa que não funcionou

Comecei com `faixa < 1` junto — a receita "correta" para câmera baixa. Na
janela inteira apareceu uma **faixa morta abaixo do gramado**: o enquadramento
do runtime não acompanha a faixa encurtada. Abandonado. A perspectiva sozinha
(`R0`) entrega o ângulo sem quebrar o enquadramento.

### A escolha

`camera.js` **congela o jogo** (`G.speed = 0`) e troca só a câmera, então os
painéis são o **mesmo quadro de simulação** visto de alturas diferentes — senão
a comparação seria sobre a jogada, não sobre a câmera.

| R0 | leitura |
|---|---|
| 0,72 (antes) | perspectiva branda, quase visto de cima |
| 0,62 | muda pouco |
| **0,54 (adotado)** | ângulo de transmissão, lado distante ainda legível |
| 0,46 | comprime demais o lado distante |

---

## §D50 · O travessão desenhado tinha 1,36 m

Baixar a câmera obrigou a mexer na escala de altura — e ao fazer isso apareceu
um defeito que já existia:

```js
const hPx = 30 * s;                    // altura visual do gol
liftY = baseY - alturaVisual(z) * 22 * s;   // altura da bola
```

**30 ÷ 22 = 1,36 m.** O travessão era desenhado na altura de um travessão de
1,36 m; o real tem **2,44 m**.

A consequência se vê em campo: uma bola a 2,0 m está confortavelmente **sob** o
travessão para a física, e era desenhada a 44 px — bem **acima** da barra de
30 px. Defesa embaixo da trave parecia bola por cima.

O laudo da OS-200 chega a dizer que até 2,6 m o mapeamento é 1:1 *"senão uma
bola por cima do travessão não PARECE por cima do travessão"*. A intenção
estava escrita; o gol é que não seguia.

Agora os dois saem de `alturaPxM()`, que também carrega a compensação de
câmera: **baixar a câmera sem mexer na altura não funciona** — com a câmera mais
baixa um metro tem que ocupar mais tela, senão a bola alta fica rasteira e a
balística da OS-200 deixa de se ler.

### A verificação, sem reimplementar a fórmula

O bundle **já expõe** `window.__ballProbe(z, by, topY, s)`, chamado de dentro de
`ball()` com o `by` que o desenho vai usar (PRO-021). Basta ouvir — nada de
refazer a conta do alvo (armadilha **D7**).

`by = chão(s) − altura(z)·pxM·s`, e o chão depende **só** de `s`. Agrupando as
amostras por `s`, o chão fica fixo e a inclinação de `by` contra `z` dá `pxM`
direto.

> Primeira versão diferenciava quadros consecutivos — o que não fixa nada,
> porque entre dois quadros a bola também **anda**. Saiu 32,4 · 46,7 · 55,0 ·
> 29,0 px/m para quatro câmeras, sem padrão nenhum. O agrupamento por `s`
> corrigiu.

**Medido: 25,55 px/m em R0 = 0,62. Esperado: 22 × (0,72/0,62) = 25,55.**
Casamento exato — e a fórmula é determinística, então um grupo com amostra
suficiente basta. O travessão usa a **mesma função**, uma linha acima no mesmo
arquivo.

---

## Portão

`project`, `liftY` e `buildStage` são desenho puro e não são chamados pelo
runner headless — mas **eu já errei essa afirmação uma vez** (a ponte de
animação instala no headless, ao contrário do que escrevi na §D42), então desta
vez está medido em vez de afirmado.

Bateria pareada contra o build anterior, 24 partidas, semente 4200000:

| seção | chaves | diferenças |
|---|---|---|
| `agregado` (as 14 métricas) | 14 | **0** |
| `eventosPorPartida` | 73 | **0** |
| `fisica` | 15 | **0** |

Zero diferenças, inclusive nos somatórios de ponto flutuante.

`bash tools/testes.sh` → **8/8**.
