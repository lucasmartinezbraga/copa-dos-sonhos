# Fase 12 — Análise pós-jogo — Build 5.5.0

## Módulo `52-phase12-post-match-analysis.js`

- **Manchetes táticas derivadas de métricas reais** — cada explicação só é
  emitida quando o padrão numérico ocorreu, sempre com os números que a
  sustentam: bolas nas costas da linha (throughOk + caras a cara),
  corredor sobrecarregado (attacksL/R ≥ 62%), cruzamentos certos sofridos,
  rebotes vivos concedidos, saídas erradas do goleiro, primeiro contato em
  bola parada, volume × qualidade de finalização (xG/chute), recuperações
  por pressão, erros individuais e ocupação concentrada nos corredores
  centrais (dados espaciais da Fase 7).
- **Mapa de finalizações dos eventos reais** — todos os 5 tipos de chute
  do motor (jogada, cruzamento rasteiro, cabeceio, falta, pênalti) com
  minuto, autor, xG, distância e desfecho (gol, defesa, defesa com rebote
  vivo, escanteio, bloqueio, trave, fora). Total bate 1:1 com `stats.shots`.
- **Números-chave** — xG, chutes, no alvo, precisão de passe, escanteios,
  gols de bola parada e a decomposição completa do goleiro da Fase 8.
- **Determinístico e sem texto genérico** (regras do plano mestre).

## Interface

Botão **ANÁLISE PÓS-JOGO** aparece apenas com a partida encerrada; painel
com placar, números-chave, manchetes e lista de finalizações.

## Testes

`tests/phase12_post_match.js`: mapa de chutes = stats do motor (por time),
gols do mapa = placar, manchetes sempre com números, decomposição do
goleiro consistente, análise determinística por seed.

## Build

`tools/build_phase12.py` injeta módulos 45–49 + 51 + 52.
Saída: `dist/COPA DOS SONHOS - FASE 12 - ANALISE POS-JOGO - V5.5.0.html`
