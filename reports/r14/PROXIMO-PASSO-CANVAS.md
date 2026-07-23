# Próximo passo — destravar o bloco visual do canvas

Bloqueia ~156 controles `VIS` (trajetória, oclusão, sombra, número da camisa,
câmera, VFX) que **são** automatizáveis por amostragem de pixel, mas exigem uma
partida realmente desenhando.

## O que já funciona

`tools/r14/browser_pixel_probe.py` amostra pixel renderizado e já encontrou um
defeito real (`A11Y-011`, contraste). A técnica está provada.

## O bloqueio exato (medido, não suposto)

Levar a UI até a partida:

```js
const sq = G.db.squads[0], p = autoLineup(sq, '4-3-3', 0);
G.lineup = p.lineup; G.bench = p.bench; G.formKey = '4-3-3'; G.style = 'balanced';
UI.go('match');
```

Resultado: `G.screen` vira `'match'` e a escalação fica com 11 — **mas o canvas
continua vazio** (0 amostras em 840x544) e o console acusa:

```
Cannot read properties of null (reading 'phase')
```

Falta **`G.cup`**. A tela de partida lê `G.cup.phase` e aborta o desenho antes
de pintar o campo. `UI.go` não valida esse pré-requisito, então a tela troca e
o render morre em silêncio — nenhum erro de página, só canvas em branco.

## O caminho

1. Inicializar `G.cup` (ver `CDS_PHASE10.ensureCup` / `prepareTeam` no bundle
   base) antes de `UI.go('match')`, ou dirigir o fluxo real de draft pela UI.
2. Com o campo pintando, estender `browser_pixel_probe.py`:
   - fração de gramado, presença da bola, sombra sob o atleta;
   - ordenação por profundidade (quem está atrás desenha antes);
   - número da camisa legível em profundidade;
   - ausência de duplicação de jogador;
   - limpeza de VFX entre partidas (comparar contagem de cores).

## Nota

O canvas em branco com `G.screen === 'match'` é, em si, um comportamento que
merece atenção: a navegação aceita ir para uma tela cujo pré-requisito não foi
satisfeito. Não registrei como defeito porque cheguei nesse estado por caminho
artificial (setei `G.lineup` na mão); pelo fluxo normal do jogo o `cup` já
existiria. Vale confirmar antes de tratar como bug.
