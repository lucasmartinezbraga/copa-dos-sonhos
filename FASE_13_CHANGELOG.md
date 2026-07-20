# Fase 13 — UX: Análise pós-jogo visual — Build 5.6.0

## Módulo 52 elevado a 5.6.0 (Fase 12 + apresentação 2D)

- **Mapa de finalizações no campo (SVG)** — gramado com linhas, círculo
  central e áreas; cada chute vira um ponto na posição REAL do lance
  (capturada no instante do evento via gancho em `_emit`, normalizada
  atacando para a direita). Tamanho do ponto = xG; cor = desfecho
  (gol dourado, defesa azul, trave laranja, bloqueio/fora cinza);
  tooltip com minuto, autor, tipo e xG.
- **Linha do tempo de domínio** — xG acumulado dos dois times ao longo
  dos 90+', com marcadores de gol; mostra quem mandou em cada fase.
- **Barras comparativas** — xG, finalizações, no alvo, precisão de passe
  e escanteios em barras duplas verde × vermelho.
- **Leitura tática** — as manchetes data-driven da Fase 12 preservadas
  abaixo dos gráficos.
- 100% SVG inline: leve, sem bibliotecas, funciona no HTML autocontido
  e em telas pequenas (largura fluida).

## Testes

`phase12_post_match.js` ampliado: toda finalização tem posição capturada
dentro do campo; chutes de jogada nunca aparecem no campo defensivo após
a normalização; SVGs contêm todos os pontos e as duas linhas.

## Smoke estrutural (partida real Brasil 4×1 Itália na build)

Painel aberto com 2 SVGs, 25 pontos de chute + círculo central, 2 linhas
de timeline, 5 marcadores de gol (= placar), 5 barras e 6 manchetes.

## Build

`tools/build_phase13.py` → `dist/COPA DOS SONHOS - FASE 13 - ANALISE
VISUAL - V5.6.0.html` · manifesto `manifests/phase13-build.json`.
