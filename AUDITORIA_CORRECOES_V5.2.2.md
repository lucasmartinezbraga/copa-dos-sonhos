# Correções da Auditoria de Conformidade (Fases 0–9) — v5.2.2

Branch: `agent/correcao-auditoria-fases-0-9` (base: v5.2.1, commit `c004d5a`).
Referência: "COPA DOS SONHOS — Auditoria de Conformidade das Fases 0 a 9".

## Itens corrigidos nesta entrega

### 1. Uso proibido de `Math.random()` — ✓ IMPLEMENTADO E COMPROVADO
- **Era:** 13 usos em `60-ui-flow.js` e `70-game-runtime-and-rendering.js`
  (confete, partículas, ruído de áudio, narração, cena de falta).
- **Correção:** `vrand()` — RNG visual determinístico (mulberry32) próprio de
  cada módulo, que não consome rolagens do RNG seedado do motor.
- **Evidência:** `git grep "Math.random()" -- src/` retorna zero;
  commit `7243bd5`.

### 2. Fase 4 — seleção probabilística ponderada (BLOQUEADOR) — ✓ IMPLEMENTADO E COMPROVADO
- **Era:** a camada de decisão escolhia sempre a maior pontuação (argmax),
  contrariando o requisito "a maior pontuação aumenta a probabilidade, mas
  não vence sempre".
- **Correção:** amostragem softmax (T=0.06) sobre os candidatos usando o
  `chance()` seedado do motor — determinística por seed, zero `Math.random`.
  Métrica auditável `decisionNonBest` por time.
- **Evidência:** `tests/audit_phase4_probabilistic.js` (983 decisões em 3
  partidas; 51% das escolhas fora do topo; placares e contagens idênticos em
  execuções repetidas com a mesma seed). Regressão de 100 partidas em
  dt=1/60 com a pilha completa (Fases 4–9): **nota 91.4/100** — a melhor da
  série (relatório `reports/phase3/audit-p4softmax-v522-quick-100.json`);
  gols 2.79, xG 2.93, vermelhos 0.14, todos no alvo. Fora da faixa apenas
  escanteios 4.19 (pendência crônica pré-existente) e empates 35%.

### 3. Contrato de saves versionado com migração — ✓ IMPLEMENTADO E COMPROVADO
- **Era:** `v:1` fixo; qualquer outra versão era rejeitada silenciosamente;
  contrato acoplado à UI; sem migração nem registro do motor de origem.
- **Correção:** novo módulo `src/scripts/48-save-contract.js` (fora da UI,
  testável em Node): `SAVE_VERSION=2`, migração encadeada v1→v2 com defaults
  neutros, rejeição segura de corrompidos e versões futuras. O save registra
  `engineVersion`, fase/rodada, e persiste instruções/preset/funções por
  fase/estado do treinador (Fases 6 e 9).
- **Evidência:** `tests/audit_save_contract.js` (migração v1, corrompidos,
  versão futura, roundtrip v2); módulo incluído no build da Fase 9.

## Itens ainda PARCIAIS (próximo ciclo, em ordem de prioridade)

1. **Fase 5** — editor completo de funções IP/OOP na UI e validação
   comparativa de comportamento (persistência no save: resolvida acima).
2. **Fase 6** — completar o catálogo oficial de instruções e interface
   granular (estrutura, presets e coerência: já existentes).
3. **Fase 7** — movimentos coordenados restantes (terceiro homem, tabelas,
   basculação documentada) e física corporal gradual.
4. **Fase 8** — rotinas de escanteio com responsabilidades explícitas e
   defesa zonal/individual posicional (parcial: resolvedor de defesas com
   rebote vivo, decisão de saída com falha, primeiro contato medido).
5. **Escanteios/partida abaixo da faixa** (4.19 < 5.0) — item de calibração
   a tratar junto com as rotinas da Fase 8.
6. **Regressões retomáveis** — checkpoints existem (`run_matrix_chunks.py`);
   falta retomada por ID documentada de ponta a ponta no fluxo oficial.
