# Próximo passo — destravar o bloco visual do canvas

Bloqueia ~156 controles `VIS` (trajetória, oclusão, sombra, número da camisa,
câmera, VFX) que **são** automatizáveis por amostragem de pixel. A técnica já
está provada: `browser_pixel_probe.py` achou o defeito `A11Y-011` com ela.

## RESOLVIDO — como chegar à copa

O bloqueio anterior (`Cannot read properties of null (reading 'phase')`) era
falta de `G.cup`. Setar `G.lineup` na mão não basta: o time precisa passar por
`CUP.registerPlayerTeam`, senão a copa não reconhece o elenco.

Receita que **funciona** (verificada no navegador):

```js
const sq = G.db.squads[0], lu = autoLineup(sq, '4-3-3', 0);
const picks = lu.lineup.map(s => ({ p: s.p, from: sq.c }));
const me = CUP.registerPlayerTeam(G.db, picks, (lu.bench||[]).map(p => ({ p, from: sq.c })));
G.lineup = lu.lineup.map((s,i) => ({ p: me.pl[i], x: s.x, y: s.y, pos: s.pos, from: sq.c }));
G.bench = me.pl.slice(11);
G.formKey = '4-3-3'; G.style = 'balanced';
G.cup = CUP.createCup(G.db, 'ME');
UI.go('cup');
```

Resultado: `G.cup.phase === 'groups'`, `G.screen === 'cup'`, hub da copa
renderizado com as abas Rodada / Grupos / Mata-mata / Gols / Time.

Isto é o mesmo caminho de `finishDraft()` no bundle base — não é atalho
artificial.

## FALTA — iniciar a partida

Do hub da copa, achar o controle que inicia o jogo. Minha tentativa clicou no
botão errado: filtrei por `/jogar|iniciar|partida|começar/i` e peguei um card de
preparação ("Treino tático"). O botão certo provavelmente está na aba **Rodada**
(`cupTab = 'rodada'`), que é a aba padrão de `SCREENS.cup`.

Sugestão: inspecionar `SCREENS.cup` no bundle base a partir da linha ~7961 e
localizar o handler que chama a simulação, em vez de procurar por texto.

## DEPOIS — o que medir no canvas

Com o campo pintando (canvas 840x544), estender `browser_pixel_probe.py`:

- fração de gramado e presença da bola;
- sombra sob o atleta (elipse escura abaixo do corpo);
- ordenação por profundidade — quem está atrás desenha antes;
- número da camisa legível conforme a profundidade;
- ausência de duplicação de jogador;
- limpeza de VFX entre partidas (comparar contagem de cores distintas).

## Observação que merece confirmação

`UI.go('match')` troca a tela mesmo sem `G.cup`, e o render morre em silêncio:
canvas em branco, nenhum erro de página. Pelo fluxo normal o `cup` sempre
existe, então não registrei como defeito — mas uma navegação que aceita ir para
uma tela cujo pré-requisito não foi satisfeito é frágil.
