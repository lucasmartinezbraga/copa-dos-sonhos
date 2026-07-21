# Gate V0–V1 — 2.5D: snapshot read-only + protótipo de câmera/projeção

Primeiro protótipo visual real do motor 2.5D, construído **sobre os contratos
que já existiam** na R13.0 (`CDS_25D_CONTRACTS` v0.2.0). O motor autoritativo
**não foi tocado**: o render apenas lê snapshots e projeta.

## V0 — Snapshot streaming somente-leitura (PASS)

`tools/r13/snapshot_stream.js` roda uma partida real e coleta `VisualState`
via `createVisualStateFromSim` a cada N passos.

| Prova | Resultado |
|---|---|
| Placar/stats vs golden | **2–0 == golden** (seed 870000, partida 0) |
| Snapshots imutáveis para o render | `Object.isFrozen` = **true** |
| Hash determinístico do snapshot | **true** (8 hex) |
| Frames coletados | 6.113 (partida completa, stride 2) |

Conclusão: gerar snapshots não altera o resultado do futebol (adapter
read-only). Atende auditoria itens **8, 141, 142** e reforça **7, 12**.

## V1 — Projeção e câmera protótipo (PASS)

`src/2_5d/scene-2_5d.js` (SceneRenderer) + `tools/2_5d/render_shots.js`
(Chromium headless). Renderiza frames reais em 4 formatos e mede a projeção.

| Gate | Alvo | Resultado |
|---|---|---|
| Projeção reversível (world→screen→world) | erro ~0 | **2,56e-14** (epsilon de máquina) |
| Linhas do campo coerentes | sem distorção | **retas em 16:9, 19.5:9, 4:3 e retrato** |
| Câmera mostra contexto tático | pitch inteiro | **campo completo, formações legíveis** |
| Entidades presentes | 22 + bola | **22/22 + bola em todos os shots** |
| Altura da bola legível | sombra separada | **bola elevada (z=3,4 m) com sombra** |
| Escala por profundidade | near>far | **aplicada** |

Evidências: `reports/2_5d/shots/*.png` (20 screenshots) + `render-report.json`.
A forma tática é legível para um observador humano: no frame de saída de bola
lê-se **4-1-4-1 (casa) × 4-3-1-2 (visitante)** — as formações reais do frame.

### O que o protótipo mostra

- Campo com faixas de corte, contorno, meio, círculo central (elipse correta
  sob projeção afim), áreas, marcas de pênalti e gols com traves em `z`.
- Atletas como cápsulas com cabeça e indicador de direção (facing do motor);
  goleiros com cor própria; sombra elíptica sob cada corpo.
- Bola com altura (`z`) e sombra que se separa do corpo conforme sobe.
- Ordenação por profundidade (`worldY`): quem está à frente desenha por cima.

### Pendências conhecidas (próximos passos)

- **Retrato mobile:** o campo horizontal não preenche a tela vertical. Correção
  é rotacionar o pitch 90° no modo retrato (comprimento na vertical) — será
  feito na UX da tela de partida. Não é defeito de projeção; as linhas seguem
  coerentes.
- V2 completo (anti-teleporte em sequência longa), V3 (interpolação/animação)
  e integração na tela de jogo real vêm após aprovação de câmera/escala.

## Fronteira preservada

O renderizador está **fora do build R13** (`src/2_5d/`, não no manifesto), então
a R13.0 continua **byte-idêntica**. A integração como camada versionada só
ocorre após a aprovação de câmera/projeção/escala (regra explícita do handoff:
"aprovar câmera, escala e projeção antes de produzir arte em escala").

## Reproduzir

```bash
# stream completo (regenerável; ~12 MB, fora do git):
( cd tools/r13 && node snapshot_stream.js --build="../../dist/COPA DOS SONHOS - V5.9.3-R13.0 - FUTEBOL OBSERVAVEL E CADENCIADO.html" --start=0 --stride=2 --out=../../reports/2_5d/stream-match0.json )
# screenshots do protótipo (usa o clip committado):
NODE_PATH=./node_modules node tools/2_5d/render_shots.js
```
