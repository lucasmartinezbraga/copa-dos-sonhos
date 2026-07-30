# HANDOFF — continuar a Copa dos Sonhos a partir da R18.40A

Você está retomando o desenvolvimento. **Não recomece a auditoria** e não presuma
que os patches experimentais foram promovidos. Tudo abaixo foi medido, está
commitado e é verificável.

---

## 0. Leia antes de tocar em nada

**O jogo NÃO vive em `src/scripts/`.** Esse é o tronco abandonado da Fase 2. O
jogo é construído de `src/r13/scripts/` via `tools/build_r13.py`, e depois
transformado por patches aplicados ao **HTML já construído**
(`tools/r18XX/patch_*.js`). O `src/r13/scripts/` também já está **atrás** do que
roda: por exemplo, os sítios de chute chamam o planejador do goleiro com raio
1,95 no fonte e com **3.0** na build. A verdade comportamental é a build em
`dist/`, não o fonte.

**Duas definições do mesmo método.** Perdi tempo com isto: existem duas
`_gkInterceptTarget`. A do bundle base é **sobrescrita** por
`P._gkInterceptTarget=function(...)` do bloco `cds-physics-timeline-581`
(= `20-physics-timeline.js`). Um patch na cópia sombreada sai **inerte** e a
bateria fica byte-idêntica. Antes de patchar qualquer método, procure por
`P.<nome>=function` em blocos posteriores.

**Ambiente.** Node portátil em
`C:\Users\lucmartinez\AppData\Local\nodejs-portable\node-v24.18.0-win-x64\node.exe`.
Repositório em `Downloads/COPA%20DOS%20SONHOS…/COPA_DOS_SONHOS_FASE_1`, branch
`agent/r18.25-replay-e-entrega`. O `%20` no caminho é literal.

**Protocolo de ruído, obrigatório.** Um Δ só conta se `|Δ| > banda de ruído` **E**
existe mecanismo no código que o explique. Mínimo 5 sementes para efeito, 48
sementes pareadas para promoção, e — regra nova desta rodada — **3 bases de
semente**, porque uma base sozinha decide por sorteio (ver seção 3).

---

## 1. Estado promovido

**R18.40A** · `dist/COPA DOS SONHOS - R18.40A - GOLEIRO E TETO DE VELOCIDADE.html`
SHA `65933257de25469a9bb863bda55d3550960c8637b2eb5b2c81cd72e714fee048`

Contém, acumulado: R18.21-RC2 (replay), R18.25 (entrega na área), R18.31 (bola
livre), R18.35 (falta cobrada) e:

| item | gate | antes | depois |
|---|---|---:|---:|
| OS-10 velocidade derivada satura em `maxSpd*1,05` | TEC-01 | 18,28 m/s | 8,98 m/s |
| OS-01 goleiro caminha até o ponto planejado | CAU-03 | 21,34% | 17,75% (**PARCIAL**, alvo 8%) |

Gates: `ECO-01` 2,729 ok · `ECO-02` 2,067 ok · `ECO-03` 12,042 ok · `ECO-04`
4,604 ok · `TEC-02/03/04` ok (determinismo 8/8 e 8/8 em ordem inversa) ·
`TEC-05` cumprido em espírito (ver seção 3) · `UX-01` **não verificado** (precisa
de aparelho real).

---

## 2. O que está medido e NÃO promovido — comece por aqui

Estes patches existem, funcionam e têm bateria. O que falta é decisão de contrato,
não código.

### 2.1 O nó central: OS-02 + raio do goleiro

`tools/r1840/patch_escalacao.js` — tier deixa de ser portão absoluto na escalação.
Corrige um defeito grave e visível: **Pelé (98) ficava no banco** e Fontana (69)
jogava de centroavante, porque o slot primário de Pelé não é ST. Vagas com
reserva elegível 6+ melhor: 2 397 → 397.

`tools/r1840/patch_gkraio.js` — o plano e a checagem voltam a usar o mesmo raio.
**Este é o mecanismo verdadeiro de OS-01**, e não é velocidade: os três sítios de
chute planejam com `radius = 3.0` e `_gkResolveSave` valida com
`_physicalContactValid(gk, 1.95, z)`. Como `required = max(0, dist − radius)`, um
ponto a 3 m tem `required = 0`: o plano declara o goleiro já no lugar, o corpo
nunca recebe ordem de andar, e a checagem reprova. Quem introduziu foi
`tools/r1821/build_rc1.js` (~linha 128). Corrigir leva **CAU-03 de 21,34% para
1,24%**.

Builds prontas, medidas em 3 bases (mediana):

| build | gols | xG | chutes | no alvo |
|---|---:|---:|---:|---:|
| baseline R18.35 | 2,646 ok | 2,059 ok | **11,854 FORA** | 4,354 ok |
| R18.40A promovida | 2,729 ok | 2,067 ok | 12,042 ok | 4,604 ok |
| **R18.40B-RC1** escalação+raio | **3,375 FORA** | **2,980 FORA** | 15,604 ok | 5,938 ok |
| **R18.40B-RC2** +conversão 2,12 | **3,396 FORA** | **2,923 FORA** | 15,646 ok | 5,688 ok |

RC1 = `dist/COPA DOS SONHOS - R18.40B-RC1 - ESCALACAO E RAIO (NAO PROMOVIDA).html`
(`de576abcb4fa`) · RC2 = idem RC2 (`2645f8f2c19d`).

**O achado estrutural, e é o mais importante deste handoff.** Com o XI correto,
`xG por chute` é 0,191. Logo o teto de `ECO-02` (xG ≤ 2,7) implica um **teto de
~15,5 chutes por partida**. Mas `ECO-03` exige ≥ 12 e o jogo com XI correto
entrega 15,6. **`ECO-02` e `ECO-03` são quase incompatíveis** assim que a
escalação é corrigida. Decompondo os +0,92 de xG: **+0,65 vem de volume** e +0,27
de qualidade por chute.

**Já tentei a conversão e não resolve.** `patch_conversao.js` com
`conversionScale 2,25 → 2,12` move s1 em −6,5% de gols, mas a **mediana de 3
bases não se move** (3,375 → 3,396): a variação entre bases domina o efeito. Não
insista nesse lever com essa magnitude.

**Não subi o teto de `ECO-02` de propósito.** Isso aprovaria diretamente a
candidata que eu propus, e seria auto-servente. É decisão de quem governa a
matriz. As opções honestas:
1. re-derivar `ECO-01`/`ECO-02` sobre o XI correto (as faixas atuais foram
   calibradas com a escalação quebrada, e isso é fato medido, não hipótese);
2. atacar **OS-07** (cardume) antes: 67,5% do campo vazio e bloco de 31,3 m são
   parte do motivo de as chances serem tão boas. Uma defesa com estrutura
   reduziria `xG/chute` por mérito, e aí OS-02 caberia sem mexer em faixa.

A opção 2 é a mais defensável tecnicamente e é o que eu faria. A Ordem de Serviço
avisa que OS-07 tem o maior acoplamento e **merece etapa própria, sozinha**.

### 2.2 OS-09 — `save_energy` sai do código morto

`tools/r1840/patch_folego.js`. Gatilho de estamina 62 → 73 põe `save_energy` em
3,56% das decisões (alvo `INT-05` 3–12%); o piso do jogo é 61,8, então o gatilho
original estava abaixo do mínimo que o motor produz. Ficou **fora** da R18.40A.

Cuidado com a história aqui, porque eu errei e depois me corrigi: excluí por
`ECO-03` comparando 11,958 contra 12,042 — diferença de 0,35% contra banda de 7%.
Isso foi decisão sobre ruído. Sob mediana de 3 bases a OS-09 **continua fora**
(11,958), então a conclusão se sustentou, mas o método estava errado.

Sinal contrário, registrado para não se perder: `sub_a` melhora **gols** (+0,8% /
+5,5% / +15,6%) e **chutes no alvo** (+0,5% / +5,3% / +17,7%) de forma
consistente nas três bases, com "no alvo" acima da banda. É o argumento mais
forte a favor da OS-09.

---

## 3. Duas coisas do laboratório que você precisa saber

**O harness mentia (gate `TEC-05`).** Todos os harnesses desta linhagem engoliam
`document is not defined` e a bateria contava o bloco falho como `scriptsOk++`.
Por isso R18.25, R18.31 e R18.35 reportam `scriptsComErro: 0`. O ponto exato:
`script-2`, **linha 7583 de 12182 (62,3%)**, em
`document.addEventListener('click', …)`.

Verifiquei que a medição do simulador continua válida: depois dessa linha há
**zero** atribuições a `MatchSim.prototype`, **zero** mutações de `CAL` e **zero**
reatribuições de `autoLineup`. O que o laboratório perde é a UI e a camada da
Copa (`bestFormationFor`, `teamFor` — para medir formação use `CUP.teamFor` **no
navegador**, via `tools/r1840/server.js`).

Use `tools/r1840/bateria.js`, não `tools/r1821/bateria.js`: ele reporta
`48 ok / 1 erro`, registra bloco/linha/mensagem e **aborta** se faltar um de 13
símbolos do motor. Prova de que a correção não mexeu em número: a baseline
re-medida deu agregados **idênticos** nas 14 métricas × 7 campos
(`reports/r1840/verif_r1835_harness.json`).

**Não injete um `document` completo.** Faria o bundle inteiro rodar, mas mudaria o
que está carregado em relação a todas as baterias promovidas anteriores, e a
comparação pareada perderia sentido.

**`ECO-03` não é robusto à semente.** Ver `tools/r1840/gate_eco03.md`. A baseline
R18.35 **já promovida** entrega 12,458 / 11,854 / 11,750 nas três bases: cumpre o
piso de 12 em **1 de 3**. Proposta registrada: manter 12 como meta mas aplicar
sobre a **mediana de 3 bases**, e enquanto reprovar na baseline ele **não bloqueia
promoção** — vira defeito rastreado, como `ECO-05`.

---

## 4. Fichas ainda abertas, com o diagnóstico já feito

**OS-05 escanteio sem causalidade — REDIAGNOSTICADO, a direção da OS original é
errada.** Ela manda destravar o `chance(.16)` em `_clearBall`. Medi com hook no
**protótipo**: `_clearBall` é chamado **0 vezes** em 12 partidas. O gate está
dentro de função morta. Além disso `_clearBall` manda a bola para **frente**
(`o.x + dir*25`), então nem um corte funcionando geraria escanteio por geometria.
Censo da linha de fundo: 4,08 cruzamentos/partida, **80% com último toque do
ataque**, e 120 tiros de meta para 20 escanteios. O caminho é criar toque
defensivo que mande a bola para a **própria** linha de fundo, no padrão de
inversão de causalidade que a R18.31 já provou funcionar. Escanteios hoje:
**1,1/partida** contra faixa 4–10 (`ECO-05`). Instrumentos prontos:
`diag_corte.js`, `diag_saida.js`, `diag_pressao.js`.

**OS-04** poucos corpos no escanteio (3 atacantes / 4 defensores, por dois
`slice`). Depende de OS-05 primeiro.

**OS-06** Copa com poucos gols e 19,8% de 0×0. Medir com `window.CUP` **depois**
dos reparos causais.

**OS-07** cardume — 67,5% do campo vazio, bloco 31,3 m. Etapa própria, sozinha.
Ver seção 2.1: pode ser o pré-requisito de OS-02.

**OS-08** condução 1,0% das ações do portador.

**CAU-04** o planejador vivo promete **8,98 m/s** (`horizontalReach`:
`vmax = 6,4 + q*3,1`) contra `p.maxSpd` de **6,05 m/s**, em 100% das 117
chamadas. A matriz registra "8,53", que veio da cópia morta. Atenção: baixar a
promessa saiu **inerte** no ponto escolhido (o ponto vencedor é escolhido por
proximidade da projeção natural do goleiro, e a margem mediana é 0,6 m, então
continua válido a 6,05). O que morde é o **raio**, não a velocidade.

---

## 5. Missão sugerida

1. Decidir com o dono da matriz: re-derivar `ECO-01`/`ECO-02` sobre o XI correto,
   **ou** atacar OS-07 antes de OS-02. Sem essa decisão, OS-02 e o raio do
   goleiro ficam bloqueados — e são as duas correções de maior valor pendentes.
2. Se a resposta for OS-07: etapa isolada, alvos `ESP-01..04`, sem dividir
   bateria com finalização.
3. Se a resposta for re-derivar contrato: promover RC1 (escalação+raio) direto,
   porque ela já resolve `ECO-03`, `CAU-03` (1,24%) e o Pelé no banco.
4. Independente disso, **OS-05** é a de maior valor visível e está isolada: o
   jogador vê 1,1 escanteio por partida hoje.
5. Antes de qualquer promoção: 3 bases de semente, e primeiro pergunte se a
   **baseline** cumpre o gate naquela base. Instrumento pronto:
   `tools/r1840/multibase.js`.

## 6. Regras que eu quebrei e que valem como aviso

- Reportei `CAU-03 21,9% → 10,8%` com **uma** semente. Com 5 sementes o número é
  **17,75%**. Ruído reportado como conserto.
- Afirmei que o clamp de velocidade era neutro no movimento. **Não é** — `p.vx`
  realimenta a integração de posição no quadro seguinte. Impedimentos subiram
  56%. A **lei** foi verificada e está intacta (100% de concordância com a
  geometria, `diag_impedimento.js`), mas a afirmação estava errada.
- Atribuí a queda de chutes ao patch de velocidade. Era o **fôlego**.
- Patcheei a cópia sombreada de `_gkInterceptTarget` e celebrei um patch inerte
  até a bateria byte-idêntica me denunciar.

O padrão dos quatro: **número sem mecanismo, ou instrumento medindo a coisa
errada.** Todos caíram porque construí um segundo instrumento para tentar
derrubar o primeiro. Faça isso.
