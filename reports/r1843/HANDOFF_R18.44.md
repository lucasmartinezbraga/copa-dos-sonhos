# HANDOFF — continuar a Copa dos Sonhos a partir da R18.43

Não recomece a auditoria. Tudo abaixo foi medido em 3 bases de semente, está
commitado e é verificável.

---

## 0. Leia antes de tocar em nada

**O jogo não vive em `src/scripts/`, e não vive na branch `main`.** Perdi tempo
com isto: o checkout inicial desta sessão estava em `main`, que é a linhagem
Fase 1/2/3 e não tem nada de R18. A linhagem R18 está na branch remota
**`agent/r18.25-replay-e-entrega`**. O jogo é construído de `src/r13/scripts/`
via `tools/build_r13.py` e depois transformado por patches aplicados ao **HTML
já construído** (`tools/r18XX/patch_*.js`). A verdade comportamental é a build
em `dist/`, não o fonte.

**Procure `P.<nome>=function` antes de patchar qualquer método.** Esta regra do
handoff anterior me salvou de um patch inerte nesta rodada — ver §A do
`reports/r1843/RELATORIO.md`. O caso concreto: `_defendTarget` tem **seis**
definições em cadeia, e o `shiftScale` do bundle base é código morto para DEF e
MID porque `cds-r13-football-observer` retorna antes.

**Protocolo de ruído.** Um Δ só conta se `|Δ| > banda` **E** existe mecanismo no
código que o explique. 48 sementes pareadas e **3 bases** para promoção. E
pergunte sempre primeiro se a **baseline** cumpre o gate naquela base:
`tools/r1843/multibase43.js` faz isso na ordem certa.

**Ambiente desta sessão** (não o do handoff anterior): Linux, `node v22.22.2`,
Chromium em `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Uma bateria
n=48 leva ~2,5 min; `diag_espaco` n=12 leva ~45 s.

---

## 1. Estado promovido

**R18.43** · `dist/COPA DOS SONHOS - R18.43 - ESTRUTURA DE BLOCO.html`
SHA `0062c2eaad188301c11debf8d50856481d466931a8098f5532ebc3a4d3f12f35`

Acumulado: R18.21-RC2 (replay), R18.25 (entrega na área), R18.31 (bola livre),
R18.35 (falta cobrada), R18.40A (goleiro + teto de velocidade) e agora o **piso
de profundidade do bloco** (OS-07 parcial).

Medianas de 3 bases (4200000 / 8400000 / 1260000, n=48 para ECO, n=12 para ESP):

| gate | baseline R18.40A | R18.43 | faixa | |
|---|---:|---:|---|---|
| ECO-01 gols | 2,729 | 3,125 | 2,4–3,2 | ok, **no topo** |
| ECO-02 xG | 2,067 | 2,421 | 1,8–2,7 | ok |
| ECO-03 chutes | 12,042 | 14,563 | 12–20 | ok, **reparado** |
| ECO-04 no alvo | 4,604 | 5,688 | 4–7 | ok |
| ESP-01 campo vazio | 68,70% | 68,06% | <50% | **reprova, alvo inatingível** |
| ESP-02 bloco | 32,84 m | 37,07 m | >35 m | **ok** |
| ESP-03 zaga→ataque | 25,67 m | 31,05 m | >30 m | **ok** |
| ESP-04 <20 m da bola | 41,64% | 41,28% | 35–45% | ok |

TEC-02 0 · TEC-03 0 erros no navegador · TEC-04 8/8 e 8/8 invertido · TEC-05
48 ok / 1 erro conhecido · `tools/verify.py` exit 0 · UX-01 **não verificado**
(precisa de aparelho real).

---

## 2. As duas coisas que você precisa saber antes de planejar

### 2.1 OS-07 não abriu espaço para OS-02 — consumiu espaço

Esta é a informação mais importante deste handoff, porque **contraria a premissa
da rota que foi escolhida**. O handoff R18.40B §2.1 apostava que estrutura
defensiva reduziria `xG/chute` por mérito e então OS-02 (escalação) caberia sem
mexer em faixa. Medido:

| | xG/chute | folga até o teto de ECO-02 (2,7) |
|---|---:|---|
| R18.40A | 0,1671 | 0,633 / 0,818 / 0,601 |
| R18.43 | 0,1659 (−0,7%) | **0,279 / 0,320 / 0,143** |

A qualidade por chute cai, mas só 0,7%; o volume sobe 21%; o xG total sobe 17%.
**Volume domina qualidade neste motor** — exatamente o que o handoff anterior já
tinha medido na escalação (+0,65 de xG por volume contra +0,27 por qualidade).

Consequência prática: com o XI correto valendo +0,92 de xG e só 0,14–0,32 de
folga sobrando, **OS-02 agora cabe menos do que antes da R18.43**. Não repita a
aposta "conserta espaço primeiro e a finalização se resolve". As opções honestas
voltaram a ser duas, e nenhuma é de espaço:

1. **Re-derivar `ECO-01`/`ECO-02`** sobre o XI correto. O argumento ficou mais
   forte, não mais fraco: as faixas foram calibradas com escalação quebrada
   **e** com bloco encurtado. Ambos são fatos medidos. Isto é decisão de quem
   governa a matriz, não minha.
2. **Atacar o volume de chutes**, que é `INT-03` (chute irracional do meio-campo,
   microcenário SH-01) e não espaço. Se o motor chuta 14,6 com bloco correto e o
   teto de ECO-02 implica ~15,5 chutes, a margem toda está em *quais* chutes.

### 2.2 ECO-01 está no topo e estoura numa base

`3,063 / 3,125 / **3,521**` — a base s3 viola o teto de 3,2. Passa só pela regra
da mediana de 3 bases. Os +26,1% de s3 ficam dentro da banda declarada de ECO-01
(30%), mas o absoluto viola a faixa e isso está registrado no relatório §E.3.

Testei mais brando (`30/32/0,55`): ESP-03 cai a 29,83 e reprova. Mais forte
(`34/36/0,70`): ECO-01 vai a 3,250 em s1 e reprova. **A configuração promovida é
a mais branda que ainda limpa ESP-03 nas três bases.** Qualquer coisa que suba
gols daqui para frente precisa contar com essa falta de folga.

---

## 3. Fichas abertas, com diagnóstico já feito

**OS-05 escanteio sem causalidade — a de maior valor visível, e está isolada.**
Não foi tocada nesta rodada. O diagnóstico do handoff anterior continua válido:
a direção da OS original está **errada** (`_clearBall` é chamada **0 vezes** em 12
partidas, e manda a bola para frente, `o.x + dir*25`, então nem funcionando
geraria escanteio por geometria). O caminho é criar toque defensivo que mande a
bola para a **própria** linha de fundo, no padrão de inversão de causalidade que
a R18.31 provou. Instrumentos prontos: `diag_corte.js`, `diag_saida.js`,
`diag_pressao.js`. **Novidade desta rodada:** escanteios subiram de 1,125 para
1,396/partida (+24%) só pela geometria do bloco, sem nenhum patch de causalidade
— a faixa de `ECO-05` é 4–10, então ainda falta um fator ~3.

**ESP-01 — alvo inatingível, precisa de decisão.** `<50%` de campo vazio é
geometricamente impossível: 20 jogadores × disco de raio 8 m = 4 021 m² de
7 140 m², piso teórico **43,7%**, exigindo sobreposição zero em todo quadro.
Proposta em `tools/r1843/gate_esp01.md`. Registro que nenhuma das 11 definições
que medi aprova a build promovida — a proposta não é auto-servente.

**ESP-02 e ESP-03 cumpridos, mas OS-07 não está fechada.** O que foi consertado é
a *profundidade* do bloco. `ESP-01` (cobertura) e a ocupação de corredores
continuam sem tratamento, e `ESP-04` (41,28%) tem direção **inconsistente** entre
bases com piso de faixa em 35% — é o gate a vigiar em qualquer continuação.

**OS-04** poucos corpos no escanteio (3 atacantes / 4 defensores, por dois
`slice`). Depende de OS-05 primeiro.

**OS-06** Copa com poucos gols e 19,8% de 0×0. Medir com `window.CUP` no
navegador — `tools/r1843/browser_smoke.js` já mostra que `CUP.teamFor` carrega lá
e não no laboratório.

**OS-08** condução 1,0% das ações do portador.

**OS-09** `save_energy` continua fora, arquivada em `tools/r1840/patch_folego.js`.
O argumento a favor era o volume de chutes; **isso mudou**: ECO-03 agora está
reparado por mérito (14,563), então o gate que a excluía deixou de reprovar na
baseline. Vale reavaliar — era exatamente a condição que `gate_eco03.md` pedia.

**CAU-04** o planejador do goleiro promete 8,98 m/s contra `maxSpd` de 6,05, em
100% das 117 chamadas. Baixar a promessa saiu **inerte**; o que morde é o raio,
não a velocidade — e o raio está em `tools/r1840/patch_gkraio.js`, **não
promovido**, junto com a escalação (RC1, `de576abcb4fa`). Esse par continua sendo
a correção de maior valor pendente e continua bloqueado pela decisão de §2.1.

---

## 4. Missão sugerida

1. **Levar §2.1 ao dono da matriz.** A rota escolhida na rodada anterior foi
   medida e não entrega o que prometia. Sem re-derivar contrato ou atacar
   INT-03, OS-02 e o raio do goleiro seguem bloqueados — e são as duas correções
   de maior valor pendentes.
2. **OS-05**, que é independente dessa decisão e é o que o jogador vê.
3. **Reavaliar OS-09** agora que ECO-03 cumpre na baseline.
4. Antes de qualquer promoção: `tools/r1843/multibase43.js`, 3 bases, e primeiro
   pergunte se a baseline cumpre o gate naquela base.

## 5. Erros meus que valem como aviso

- **Quase patcheei o `shiftScale` do bundle base.** Está genuinamente invertido
  em relação ao futebol, a álgebra fecha, e teria saído **inerte** porque o
  observer R13 retorna antes para DEF e MID. Só não aconteceu porque procurei
  `P.<nome>=function` primeiro, como o handoff anterior mandava. A lição do §6
  anterior se aplicou literalmente na primeira oportunidade.
- **Os baselines de ESP-01..04 na matriz não são reproduzíveis:** o instrumento
  citado como evidência (`auditoria_blob`) não existe no repositório. Reconstruí
  as definições e três das quatro caem a ~1,5 do valor da matriz com viés
  positivo uniforme — o que é evidência de reconstrução correta, mas **não** é a
  definição original, e isso está declarado em vez de escondido.
- **Reportei ECO-01 como folgado depois de medir só s1** (3,063 contra teto 3,2)
  antes de ter s3, onde ele estoura em 3,521. Foi corrigido antes de qualquer
  promoção porque as 3 bases estavam programadas desde o início — mas se eu
  tivesse parado em s1 teria promovido dizendo que havia folga.
