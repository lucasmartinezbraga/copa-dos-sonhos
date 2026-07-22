# Gate UX — Redesign das telas (em progresso)

Redesign de todas as telas em desktop, mobile vertical e horizontal (doc 04).
Trabalho incremental, tela a tela, com evidência antes/depois em navegador real.

## Modelo de candidato (preserva a R13.0)

O redesign **não** altera a R13.0. A UX é uma **camada aditiva** construída num
candidato próprio:

- `src/r13/` permanece a R13.0 **byte-idêntica** (SHA `363d…8a8`, `verify_r13`).
- `src/ux/*.css` + `src/ux/*.js` = camada de redesign.
- `tools/build_ux.py` → `dist/COPA DOS SONHOS - RC-UX.html` (novo SHA).
- Regressão de motor no candidato **deve** bater com o golden R13 (a UX não
  pode mudar o futebol).

Reproduzir:
```bash
python3 tools/build_ux.py
NODE_PATH=./node_modules node tools/ux/capture.js --build="dist/COPA DOS SONHOS - RC-UX.html" --outdir=reports/ux/after --tag=after
```

## Sistema visual

Reaproveita os tokens existentes da R13.0 (`:root`: `--noite`, `--painel`,
`--ouro`, `--azul`, `--rosa` para risco, fontes `--f-display/-cond/-ui`) e
acrescenta, em `src/ux/00-ux-system.css`:

- escala de espaçamento 8 px (`--sp-1..8`), raios (`--r-sm/md/lg/pill`),
  movimento 120–220 ms (`--dur-*`, `--ease`), alvo de toque `--touch: 44px`;
- **foco de teclado visível** (`:focus-visible`) — acessibilidade;
- **movimento reduzido** (`prefers-reduced-motion`);
- guarda de overflow horizontal; áreas seguras (notch) para barras fixas.

## Increment 1 — limpeza dos overlays de DEV (PASS)

As ferramentas de dev (Tática 5.0, IA do Treinador, Lab Físico, Auditor
Pré-2.5D) poluíam **todas** as telas e sobrepunham o conteúdo no mobile. Agora
ficam **ocultas por padrão** na visão do jogador e reaparecem com `?dev=1`
(classe `.cds-dev`). Nada foi removido.

| Evidência | Resultado |
|---|---|
| R13.0 autoritativa | **inalterada** (byte-idêntica) |
| RC-UX SHA | `49b6101f…` |
| Motor no RC-UX | smoke **13/13**, cenários **25/25**, **40/40** golden |
| Overlays na home (mobile) | **removidos** (antes: 3 botões sobre o campo) |

Antes/depois: `reports/ux/before/*` vs `reports/ux/after/*` (home desktop/
mobile-vertical/mobile-horizontal).

## Inventário de telas (a migrar)

Fluxo mapeado: **home → setup → draft → elenco/formação → pré-jogo → partida →
resultado → grupos → chave**, + intervalo, bola parada, estatísticas/momentum,
save/continuar, configurações/ajuda (15 telas do doc 04).

## Próximos increments

1. Telas-piloto (doc 04): **home, formação, partida** com tokens e componentes
   compartilhados; antes/depois nos 6 tamanhos (360×800…1920×1080).
2. Migrar as demais telas; consolidar overrides (não empilhar CSS solto).
3. HUD da partida: campo ocupa o máximo; placar/tempo compactos; painéis como
   bottom-sheet (retrato) e rail (paisagem).
4. Rotação do campo no retrato (liga com o 2.5D).

## Increment 6 — Campo 2.5D "Canvas 2D Pro" + revalidação do placar (PASS)

Seguindo a referência aprovada pelo proprietário ("o salto está na técnica,
não na troca de tecnologia"): upgrade do campo no Canvas 2D existente, via
9 patches de apresentação no candidato RC-UX (`src/ux/patches.json`, gerados
por `tools/ux/make_patches.py` — precedente: inject_r13.js) + camada
`src/ux/50-field25d.js` (`window.CDS_F25D`).

- **Gramado**: faixas com gradiente, luz central e vinheta (cache offscreen).
- **Jogadores**: mini-atletas top-down (camisa com luz, ombros, cabeça
  adiantada indicando direção; número legível no torso; GK distinto).
- **Bola**: gomos com rotação, cresce com a altura; **fio bola↔sombra**
  tracejado; **anel de queda** pulsante no destino de bolas aéreas;
  **rastro em arco** (trail agora guarda z).
- **Pill de nome** clampada ao campo (fim do chip cortado na borda).

### Revalidação do placar (navegador real, gol de verdade)

**Bug pré-existente da R13.0 encontrado e corrigido**: o placar do header
(`#score`) não atualizava após gol — confirmado no build autoritativo puro
(motor `[0,1]` × header `"0–0"`, mesmo depois do intervalo). As auditorias
headless validavam o estado do motor, não o DOM (item 14 da auditoria mestra).
Fix `score-resync`: o tick de UI (0,35 s) re-sincroniza o placar. Validado:
motor `[0,1]` ↔ header `"0–1"` após gol em TURBO.

Regressão de motor no RC-UX patchado: smoke 13/13, cenários 25/25,
**40/40 golden** — motor inalterado (patches são apresentação pura).
Evidências: `reports/ux/after/field25d__*.png`.
