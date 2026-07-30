# R18.43 — ESTRUTURA DE BLOCO (OS-07)

**Build** `dist/COPA DOS SONHOS - R18.43 - ESTRUTURA DE BLOCO.html`
SHA `0062c2eaad188301c11debf8d50856481d466931a8098f5532ebc3a4d3f12f35`
**Baseline** R18.40A (`65933257de25…`) · **Decisão de rota** OS-07 antes de OS-02,
etapa isolada, conforme §5.1/§5.2 do handoff R18.40B.

---

## 0. Antes de tudo: o repositório desta sessão não era o do handoff

O checkout inicial estava em `main` — a linhagem Fase 1/2/3, com `src/scripts/` e
`tools/build.py`. Nada de `src/r13/`, `tools/r1840/` ou das builds R18. A
linhagem R18 vive na branch remota **`agent/r18.25-replay-e-entrega`**; busquei
essa branch e reapontei a branch de trabalho para ela. Registro porque quem
retomar isto de outra máquina vai cair no mesmo tronco errado.

Verificações de identidade antes de medir qualquer coisa:

| artefato | SHA esperado (handoff) | medido |
|---|---|---|
| R18.40A promovida | `65933257de25…` | confere |
| R18.40B-RC1 (escalação+raio) | `de576abcb4fa` | confere |
| R18.40B-RC2 (conversão 2,12) | `2645f8f2c19d` | confere |

E a bateria reproduz os quatro agregados da R18.40A **exatamente** — `2,729` gols,
`2,067` xG, `12,042` chutes, `4,604` no alvo, `48 ok / 1 erro`. O laboratório
está válido; as medições abaixo são comparáveis às promovidas anteriores.

---

## A. O patch que eu quase escrevi, e que teria saído inerte

O candidato óbvio para o cardume está no bundle base, em `_defendTarget`:

```js
const shiftScale = pLine === 'DEF' ? 0.25 : pLine === 'MID' ? 0.34 : 0.43;
const shiftX = (b.x - FL/2) * shiftScale;
```

Isto **está** invertido em relação ao futebol: o atacante acompanha a coordenada
longitudinal da bola com coeficiente 0,43 e o zagueiro com 0,25, então quando a
bola desce o atacante recua mais que o zagueiro e o bloco encurta sozinho. A
álgebra é direta: `comprimento = base + s·(c_FWD − c_DEF)`, com `s = b.x − FL/2`;
recuando (`s < 0`) e com `c_FWD > c_DEF`, o comprimento cai.

**E corrigir ali não faria nada.** O bloco `cds-r13-football-observer`
sobrescreve `_defendTarget` e trata presser, marcação, cobertura, sombra,
dropper, **DEF e MID** com `return` próprio, caindo em `oldDefend13.apply`
somente para FWD sem papel. Para DEF e MID aquele `shiftScale` é código morto.
Seria exatamente o erro do §6 do handoff (patch na cópia sombreada, celebrado
até a bateria byte-idêntica denunciar), evitado desta vez procurando
`P.<nome>=function` em blocos posteriores **antes** de editar.

A cadeia viva de `_defendTarget`, em ordem de execução — todos os elos delegam,
portanto todos contam:

```
base(7471) <- r13-observer <- R18.5 <- orientacao <- r18173 <- antecipacao
```

## B. O mecanismo verdadeiro de OS-07

O elo que fixa a geometria é o **R18.5**:

```js
if(L==='DEF')      px = clamp(px, line-2.45, line+2.45);
else if(L==='MID') px = clamp(px, line-1.8,  line+10.8);
// nao existe ramo para FWD
```

`line` é `tm._r13LineDepth`. Zaga e meio andam num trilho apertado relativo à
linha; **o ataque não é ancorado em nada coletivo.** E nas duas fases ele é
ancorado *na bola*:

- atacando (`_attackTarget`): `tProg = clamp(max(homeProg−4, ballProg + 9), …)`
- defendendo (base): `tx = p.hx + (b.x − FL/2)·0,43`

Com a bola recuando, o atacante recua junto nos dois casos, e nada no motor
garante profundidade mínima de bloco. **Isso é o cardume: 20 corpos que seguem a
bola porque ninguém tem ordem de não seguir.**

Medido com `tools/r1843/diag_espaco.js` na R18.40A (n=12, s=4200000), quebrado
por fase — é essa quebra que localiza o defeito em vez de adivinhá-lo:

| | defendendo | atacando |
|---|---:|---:|
| DEF→MID | 11,91 m | 12,87 m |
| DEF→FWD | 25,04 m | 26,38 m |

DEF→MID é saudável e está encostado no clamp de 10,8. **O déficit está inteiro na
linha de frente, e nas duas fases.**

## C. O conserto

`tools/r1843/patch_espaco.js` injeta a camada `cds-r1843-block-depth`: um **piso
de profundidade** — o atacante não pode ficar a menos de X metros à frente do
centroide da própria zaga. É a mesma ideia que o R18.5 já aplica a DEF e MID
(trilho relativo à linha), estendida à linha que ficou de fora. Não é um número
novo inventado; é a regra existente completada.

Decisões de implementação que importam:

- **Camada no fim da build, não edição no R18.5.** Depois do R18.5 ainda correm
  o elo de zona/duty (`r18173`) e a antecipação de pressão, que reescrevem `tx`
  para vários papéis. Um piso posto no meio da cadeia seria desfeito por eles.
- **Aditiva.** Quando o piso já está satisfeito, nenhum caminho de código muda.
- **Cortada por `_offsideLine`** na fase ofensiva, então o piso nunca cria
  posição irregular. O §6 do handoff registra uma rodada que subiu impedimentos
  56% sem perceber; aqui o teto é explícito e contado.
- **Sem RNG e sem teleporte.** `rngUsed: false`; o corpo continua andando pelo
  `_integrate` normal com o `maxSpd` do próprio atleta (o piso move o *alvo*, e
  só uma fração `suave` do que falta por avaliação).

Parâmetros promovidos: `pisoDef=32`, `pisoAtk=33`, `suave=0,62`.

### C.1 Prova de que a camada não está inerte

`tools/r1843/diag_bloco.js` existe só para fechar a porta do §6 **antes** de eu
comemorar. Na build promovida, 6 partidas:

| | valor |
|---|---:|
| chamadas / elevações defendendo | 515 736 / 496 218 (**96,22%**) |
| chamadas / elevações atacando | 428 312 / 57 075 (**13,33%**) |
| cortes por impedimento | 106 542 |
| ganho médio por elevação | 13,04 m |

E no navegador (`tools/r1843/browser_smoke.js`), não só no laboratório:
`elevadosDef 30 649`, `elevadosAtk 2 855`, `cortadoPorImpedimento 6 888`.

## D. Instrumento de espaço, e um problema com ESP-01

**O instrumento que produziu os baselines da matriz não existe no repositório.**
Procurei `auditoria_blob`, `campoVazio`, `emptyField`, `blockLength`, `grid` e
`grade` em `tools/` (r13, r14, r15, r1821, r1825, r1831, r1835, r1840) e em
`reports/`. Não está lá. Os quatro números de ESP-01..04 na matriz **não são
reproduzíveis a partir do fonte** e a definição de "campo vazio" está perdida.

Em vez de adivinhar a definição e anunciar que "reproduzi o baseline", escrevi as
definições e medi ESP-01 em **onze** definições simultâneas. Resultado na R18.40A:

| gate | matriz | reconstrução | Δ |
|---|---:|---:|---:|
| ESP-02 bloco | 31,3 m | 32,84 m | +1,54 |
| ESP-03 zaga→ataque | 24,0 m | 25,67 m | +1,67 |
| ESP-04 <20 m da bola | 40,2% | 41,64% | +1,44 |
| ESP-01 campo vazio (`vazio_r8`) | 67,5% | 68,60% | +1,10 |

Quatro reconstruções independentes errando na mesma direção e na mesma magnitude
é evidência de que as definições estão certas e a matriz foi medida numa build
ligeiramente anterior — não de que o instrumento está torto.

**ESP-01 tem alvo geometricamente inatingível.** 20 jogadores de linha × disco de
raio 8 m = 20 × 201,06 = 4 021 m², num campo de 105 × 68 = 7 140 m². Cobertura
máxima 56,3% ⇒ **piso teórico de campo vazio 43,7%**, e isso exigindo sobreposição
zero em todos os quadros. Ficar sob 50% pediria ≥ 88% da cobertura máxima
teórica, permanentemente — é alvo de empacotamento de círculos, não de futebol.
Numa dividida na área os corpos *devem* se sobrepor. Detalhe e proposta de
reespecificação em `tools/r1843/gate_esp01.md`.

Registro que **nenhuma** das definições que medi aprova a candidata em ESP-01 (a
mais generosa, grade 7x4, dá 62,4% na baseline) — logo a proposta de aposentar o
alvo não é auto-servente.

## E. Decisão em 3 bases de semente

`tools/r1843/multibase43.js`, mesma disciplina de `tools/r1840/multibase.js`: a
primeira pergunta é se a **baseline** cumpre o gate em cada base, porque um gate
que a própria base reprova não separa candidata boa de ruim.

### E.1 Validade dos gates na baseline R18.40A

| gate | s1 4200000 | s2 8400000 | s3 1260000 | válido |
|---|---:|---:|---:|---|
| ECO-01 gols | 2,729 ok | 2,646 ok | 2,792 ok | 3/3 |
| ECO-02 xG | 2,067 ok | 1,882 ok | 2,099 ok | 3/3 |
| ECO-03 chutes | 12,042 ok | **11,438 REP** | 12,563 ok | 2/3 frágil |
| ECO-04 no alvo | 4,604 ok | 4,417 ok | 5,042 ok | 3/3 |
| ESP-01 campo vazio | 68,60 REP | 69,12 REP | 68,70 REP | **0/3 inútil** |
| ESP-02 bloco | 32,84 REP | 32,25 REP | 32,86 REP | **0/3** |
| ESP-03 zaga→ataque | 25,67 REP | 25,19 REP | 25,73 REP | **0/3** |
| ESP-04 <20 m | 41,64 ok | 42,05 ok | 40,39 ok | 3/3 |

ECO-03 confirma o achado da R18.40A: a baseline promovida reprova em 1 de 3 bases.

### E.2 Efeito da candidata

| gate | s1 | s2 | s3 | mediana | faixa | |
|---|---:|---:|---:|---:|---|---|
| ECO-01 gols | 3,063 | 3,125 | **3,521** | **3,125** | 2,4–3,2 | CUMPRE |
| ECO-02 xG | 2,421 | 2,380 | 2,557 | **2,421** | 1,8–2,7 | CUMPRE |
| ECO-03 chutes | 14,563 | 14,542 | 15,417 | **14,563** | 12–20 | CUMPRE |
| ECO-04 no alvo | 5,688 | 5,667 | 6,083 | **5,688** | 4–7 | CUMPRE |
| ESP-01 campo vazio | 67,88 | 68,21 | 68,06 | **68,06** | <50 | REPROVA |
| ESP-02 bloco | 37,07 | 36,40 | 37,10 | **37,07** | >35 | CUMPRE |
| ESP-03 zaga→ataque | 31,18 | 30,55 | 31,05 | **31,05** | >30 | CUMPRE |
| ESP-04 <20 m | 40,81 | 42,10 | 41,28 | **41,28** | 35–45 | CUMPRE |

**Nenhum gate válido (3/3 na baseline) é perdido.** Três gates que a baseline não
cumpria passam a ser cumpridos: ECO-03, ESP-02, ESP-03. ESP-02 e ESP-03 sobem
+12,9% e +21% com direção consistente nas três bases e magnitude acima da banda.

### E.3 O que está apertado, e eu não vou esconder

**ECO-01 estoura na base s3: 3,521 contra teto de 3,2.** Passa apenas pela regra
da mediana de 3 bases estabelecida na R18.40. Os +26,1% de s3 ficam dentro da
banda de ruído declarada de ECO-01 (30%), mas o valor absoluto viola a faixa, e
isso precisa constar. A candidata promovida está no topo de ECO-01, sem folga.

Testei variante mais branda (`pisoDef=30, pisoAtk=32, suave=0,55`): ESP-03 cai a
29,83 em s1 e **reprova**. E uma mais forte (`34/36/0,70`): ECO-01 vai a 3,250 em
s1 e reprova. A configuração promovida é, das três medidas, a **mais branda que
ainda limpa ESP-03 nas três bases** — é por isso que aceitei o aperto em ECO-01
em vez de recuar.

## F. O achado que contraria a premissa da rota escolhida

A rota "OS-07 antes de OS-02" foi escolhida porque, segundo §2.1 do handoff, uma
defesa com estrutura reduziria `xG/chute` por mérito e então OS-02 caberia sem
mexer em faixa. **Medido, não é o que acontece.**

| base | xG/chute baseline | xG/chute R18.43 | Δ |
|---|---:|---:|---:|
| s1 | 0,1716 | 0,1662 | −3,1% |
| s2 | 0,1645 | 0,1637 | −0,5% |
| s3 | 0,1671 | 0,1659 | −0,7% |
| **mediana** | **0,1671** | **0,1659** | **−0,7%** |

A qualidade por chute cai, como previsto — mas só 0,7% na mediana, enquanto o
volume sobe 21%. O xG total portanto **sobe** 17%. A folga até o teto de ECO-02
(2,7) que sobra para OS-02:

| | folga antes (R18.40A) | folga depois (R18.43) |
|---|---:|---:|
| s1 | 0,633 | 0,279 |
| s2 | 0,818 | 0,320 |
| s3 | 0,601 | 0,143 |

**OS-07 não abriu espaço para OS-02: consumiu espaço.** É o mesmo padrão que o
handoff já tinha medido na escalação (+0,65 de xG por volume contra +0,27 por
qualidade) — volume domina qualidade neste motor. A sequência OS-07 → OS-02
precisa ser reconsiderada com este número na mesa; ver §H.

## G. Integridade

| gate | resultado |
|---|---|
| TEC-02 NaN/infinito | 0 |
| TEC-03 erros de console | **0** no navegador, na candidata e na baseline (pareado) |
| TEC-04 determinismo | **8/8** e **8/8** em ordem inversa |
| TEC-05 completude do bundle | 48 ok / 1 erro conhecido, `motorVerificado: true` |
| impedimentos | 1,792 → 1,979 (+10,4%) — teto de impedimento explícito na camada |
| `tools/verify.py` | exit 0 (linhagem Fase 1/2 intacta, `src/` não foi tocado) |

Camada da Copa (`CUP`, `CUP.teamFor`) carrega no navegador nas duas builds.
`bestFormationFor` não é global em nenhuma das duas — não é regressão.

## H. Próximos passos

1. **Decidir ESP-01** com o dono da matriz: aposentar o alvo `<50%` (inatingível,
   §D) ou trocar por `ESP-01a` sobre grade 7x4 com alvo derivado. Enquanto isso
   fica reprovado e rastreado, como ECO-05.
2. **Reabrir a decisão de rota com o número de §F.** OS-07 não criou folga para
   OS-02; reduziu-a. As opções honestas voltam a ser: (a) re-derivar
   ECO-01/ECO-02 sobre o XI correto — agora com o argumento adicional de que as
   faixas foram calibradas com escalação quebrada **e** com bloco encurtado; ou
   (b) atacar o volume de chutes diretamente (o motor chuta 14,6 com bloco
   correto e o teto de ECO-02 implica ~15,5), o que é agenda de **INT-03**
   (chute irracional do meio-campo), não de espaço.
3. **OS-05 continua a de maior valor visível e está isolada** — escanteios
   1,4/partida contra faixa 4–10. Nota: subiram de 1,125 para 1,396 (+24%) só
   pela geometria do bloco, sem nenhum patch de causalidade. O diagnóstico do
   §4 do handoff R18.40B (criar toque defensivo para a própria linha de fundo,
   `_clearBall` é função morta com 0 chamadas) continua válido e não foi tocado.
4. **ESP-04 é o gate a vigiar** em qualquer continuação de espaço: 41,28% com
   direção **inconsistente** entre bases, e o piso da faixa é 35%.

## I. Arquivos

```
dist/COPA DOS SONHOS - R18.43 - ESTRUTURA DE BLOCO.html   0062c2eaad18
tools/r1843/patch_espaco.js        a camada (piso de profundidade)
tools/r1843/diag_espaco.js         instrumento ESP-01..04, 11 definicoes, por fase
tools/r1843/diag_bloco.js          prova de que a camada nao esta inerte
tools/r1843/browser_smoke.js       TEC-03 + Copa em Chromium real
tools/r1843/multibase43.js         decisao em 3 bases, valida gate na baseline primeiro
tools/r1843/atualiza_matriz.py     matriz de gates a partir dos JSON medidos
tools/r1843/gate_esp01.md          por que <50% e inatingivel
reports/r1843/bat_{base,rcc}_s{1,2,3}.json    bateria n=48, 3 bases
reports/r1843/esp_{base,rcc}_s{1,2,3}.json    espaco n=12, 3 bases
```

## J. Regras do handoff que segui, e o que elas custaram

- **Procurei `P.<nome>=function` antes de patchar** — e foi o que impediu o patch
  inerte no `shiftScale`. Custou uma leitura de seis elos da cadeia.
- **Construí um segundo instrumento para tentar derrubar o primeiro**:
  `diag_bloco.js` contra a hipótese "a camada funciona", e o smoke de navegador
  contra "funciona só no laboratório".
- **Medi ESP-01 em onze definições** em vez de escolher a que favorecia.
- **3 bases, e a baseline primeiro.** Sem isso eu teria promovido pela s1 e
  reportado ECO-01 como folgado, quando em s3 ele estoura.
- **Não subi teto de gate nenhum.** ESP-01 continua reprovado na build promovida.
