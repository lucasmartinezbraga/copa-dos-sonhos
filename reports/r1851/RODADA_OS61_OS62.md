# RODADA OS-61 / OS-62 — o estádio fecha e os rótulos param de se atropelar

Duas correções de design, ambas **consequência da OS-57**: ao ligar a câmera de
TV no desktop, o quadro deixou de mostrar o campo inteiro e passou a mostrar
também o que há em volta e o que acontece quando os atletas se juntam. Nos dois
casos o defeito já existia; a câmera só o trouxe para dentro do quadro.

## OS-61 · o mundo fora do campo estava vazio

`buildStage()` (`:19344`) monta o cenário nesta ordem: céu escuro no canvas
inteiro → **arquibancada só na faixa de cima** (`standBot = G.topY + 8`) →
placas de publicidade → avental de gramado de 26 px → gramado listrado.

Torcida só atrás do fundo distante. Nas laterais e embaixo ficava o céu, que
colado no gramado vira **vazio escuro**.

Agora a arquibancada envolve o canvas inteiro, com a mesma torcida pontilhada e
a mesma semente (continua determinístico), e o avental cresceu de 26 para 64 px
para não deixar costura entre a linha lateral e a torcida.

### E as faixas verdes chapadas em cima e embaixo

Medi antes de supor:

```
canvas interno   973 x 475   (proporcao 2,049)
caixa CSS        986 x 672   (proporcao 1,467)
object-fit       contain
background       rgb(22,111,50)   <- verde de gramado
```

Não era cenário: era **letterbox**. O `object-fit: contain` deixa faixas, e elas
mostravam o fundo verde do elemento — que lido como gramado parecia campo morto.
Viraram moldura de estádio.

## OS-62 · os rótulos se atropelavam

O chip de sobrenome era desenhado num deslocamento **fixo** (`py2 = y + r + 2`),
sem nenhuma noção de que outro chip já ocupava o espaço. E o gatilho é "está
perto da bola" — ou seja, os chips aparecem exatamente onde os atletas estão
mais juntos, o pior caso possível. Resultado na captura: "CARRASCO"/"INCE" um
sobre o outro, "TIELEMANS"/"MCMANAMAN" ilegíveis.

Agora há lista de ocupação por quadro: o chip tenta o lugar de sempre, desce em
degraus de 12 px até três vezes, e se ainda não couber é **omitido** — melhor um
nome a menos do que dois ilegíveis.

## Gate

12 partidas, mesmas sementes: `goals 1.67 · xg 2.48 · shots 22.42 · corners 6.58
· passes 461.83` — idênticos à R18.79. As duas rodadas são cenário e rótulo.

Navegador: sem `pageerror`, sem erro de console.
