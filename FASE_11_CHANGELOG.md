# Fase 11 — Draft e montagem do elenco — Build 5.4.0

## Conselheiro do Draft (`src/scripts/51-phase11-draft-advisor.js`)

O draft passa a avaliar **encaixe**, não apenas overall:

- **Arquétipos derivados de atributos reais** (goleiro, zagueiro, lateral,
  volante, armador, meia-ofensivo, ponta, finalizador) — desarme vs
  passe/visão vs finalização vs cruzamento decidem o papel; sem rótulos
  mágicos.
- **Encaixe posicional em 4 níveis**: vaga exata (posição primária V3),
  secundária, mesma linha, nenhum.
- **Detecção de carências do elenco montado**: meio-campo sem volante de
  marcação; defesa com estatura média < 180 cm (fragilidade aérea); lado
  esquerdo sem canhoto (pé dominante V3).
- **Redundância**: candidatos do mesmo arquétipo já escalado são
  sinalizados.
- **Explicações em português geradas dos dados** — ex.: "Você já tem 2
  armadores — aumenta a qualidade individual, mas não cobre a carência
  do elenco."
- **Sem bônus por seleção, clube ou idioma** (regra do plano mestre).
- **Regras clássicas do draft preservadas**: sorteio, um por vez, reroll,
  sem duplicados, titulares/reservas, mobile.

## Interface

Botão **CONSELHEIRO** aparece apenas na tela de draft; painel lista os
candidatos da seleção sorteada ordenados por nota de encaixe (0–100), com
arquétipo, pé e explicação, além das carências atuais do elenco.

## Testes

`tests/phase11_draft_advisor.js`: encaixe exato de goleiro, detecção de
SEM_VOLANTE com dois armadores, volante resolvendo a carência, aviso de
redundância, explicação de reserva com elenco completo, pontuações 0–100
e avaliação determinística (sem RNG).

## Build

`tools/build_phase11.py` injeta os módulos 45–49 + 51 antes do torneio.
Saída: `dist/COPA DOS SONHOS - FASE 11 - DRAFT INTELIGENTE - V5.4.0.html`
Manifesto: `manifests/phase11-build.json`.
