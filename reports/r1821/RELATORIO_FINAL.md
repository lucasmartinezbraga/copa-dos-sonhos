# RELATÓRIO FINAL — R18.21-RC1

**Status: `CANDIDATA — NECESSITA AJUSTES`**

---

## A. Base encontrada

| | |
|---|---|
| Arquivo | `COPA DOS SONHOS - R18.20 - INTELIGENCIA DE CHANCE.html` |
| Versão interna | `CDS_BUILD_ID = 'R18.20'` (a `<title>` estática do `<head>` está parada em R18.17; não confiar nela) |
| SHA-256 | `11ab3fc32609f1a4cd87ea75437e27ce8ad491a4c8849c4c686f7c0a07314805` |
| Origem | `00_BASE_CORRETA/` do pacote `COPA_DOS_SONHOS_HANDOFF_CLAUDE_R18.20.zip`, idêntica byte a byte à cópia em Downloads e ao manifesto do pacote |

**A base não foi alterada.** Verificado ao final: o SHA-256 continua idêntico.

## B. Variante experimental

A variante de 73,47% de cobertura descrita no handoff **não foi encontrada** — ela nunca
foi preservada como arquivo, conforme o próprio handoff declara. A candidata foi
**reconstruída** sobre a R18.20.

**A reconstrução não seguiu o roteiro do handoff**, e isso é a decisão mais importante
deste relatório. Ablação por camada (desligando blocos por `id` no probe) mostrou que a
`cds-r1819-tactical-authority` — que o contrato mandava preservar — era a causa da
regressão de ecologia atribuída à R18.20:

| | com R18.19 | sem R18.19 | |
|---|---:|---:|---|
| chutes | 9,76 | 12,27 | +26% |
| tentativas de desarme | 7,00 | 9,43 | +35% |
| faltas | 3,16 | 4,96 | +57% |
| `parkIdentity` / `tikiIdentity` / `noDominantStyle` | 0/3 | 3/3 | — |

O harness reproduz as baselines documentadas no handoff, o que valida a medição: R18.20
medida em 9,76 chutes contra 9,85 documentado; sem r1819/r1820 em 12,27 contra 11,91 da
R18.18.3.

O usuário foi informado do conflito com o contrato e autorizou a remoção.

## C. Correções realizadas

### Motor

| camada | o que faz |
|---|---|
| `cds-r1821-throwin-law` | Restaura a lei do lateral (sem gol direto). Ver seção F. |
| `cds-r1821-post-recovery-decision` | Alívio só no terço defensivo ou sob perigo real; no meio-campo passe/condução. Separa `foot_clearance` de `header_clear` e emite `long_pass`. |
| `cds-r1821-shot-plausibility` | Comprime a amplitude do chute errado (ia até 6,4 m com a trave em 3,3) para raspar o poste. |
| `cds-r1821-press-anticipation` | O pressionador passa a ir ao **recebedor** em vez de perseguir a bola em voo. Deriva do alvo limitada a 0,8 m por avaliação. |
| `cds-r1821-respread-top` | Reespalha o topo saturado de `finalizacao` e `passe`. |
| `cds-r1821-tempo-e-pausas` | Acréscimos, fim de jogo só com bola parada, e pausa real na cobrança de falta. |

**Dois patches cirúrgicos**, aplicados pelo construtor sobre uma cópia (a base fica intacta):

1. Remoção do bloco `cds-r1819-tactical-authority` (47.376 caracteres).
2. `contactRadius` do goleiro de 1,95 para 3,0 nas duas rotas de **jogo aberto** (chute de
   cruzamento rasteiro e cabeceio). O chute normal já usava 3,0; a assimetria não tinha
   justificativa física. Bola parada fica em 1,95 de propósito.

### Auditor

Definição corrigida de **ameaça crítica**, medida ao lado da original:

- a definição antiga contava atacante a até 46 m do gol e, por causa de `|| p._breaking ||
  p._runDeep`, contava um corredor a **qualquer** distância;
- a corrigida exige zona de perigo (35 m, ou 45 m em ruptura), marcador a **≤ 8 m**,
  **goal-side real** e mesmo corredor;
- **não** usa `_markRef` preenchido como prova de cobertura;
- devolve `PASS` / `FAIL` / `INSUFFICIENT_DATA`.

**46,2% das "ameaças" da definição antiga eram falsas.** A cobertura passa de 59,52% para
63,45% — e continua reprovando.

## D. Resultados dos testes

### Determinismo — PASS

8 seeds, cada um rodado duas vezes com uma partida intercalada entre os runs (para pegar
contaminação de estado). Assinatura comparada: placar, número de passos, todas as chaves
numéricas de `stats` dos dois times, censo completo de eventos e posição final de cada
jogador com 6 casas decimais. **Zero divergências.** A base também passa, como controle.

### Bateria final — 100 partidas pareadas

Mesmos seeds nas duas builds, 17 formações e 7 estilos em rotação determinística.
48 scripts carregados, 0 erros.

| métrica | R18.20 | R18.21-RC1 | alvo | |
|---|---:|---:|---|---|
| chutes | 8,95 | **12,39** | 12–20 | **PASS** |
| chutes no alvo | 2,70 | **4,37** | 4–7 | **PASS** |
| xG | 1,392 | **2,088** | 1,8–2,7 | **PASS** |
| gols | 1,42 | 2,77 | — | — |
| passes | 221,7 | 238,7 | 170–235 | FAIL (+3,7) |
| desarmes | 4,32 | 7,49 | 8–22 | FAIL (−0,51) |
| faltas | 3,68 | 6,39 | 7–17 | FAIL (−0,61) |
| laterais | 4,25 | 4,89 | 5–16 | FAIL (−0,11) |
| escanteios | 1,18 | 1,21 | 4–10 | FAIL |

### Tempo de jogo: acréscimos, fim de partida e pausa de bola parada

Três defeitos de regra, encontrados pelo usuário jogando e confirmados por leitura:

1. **Acréscimos nunca existiram.** `this.stoppage` é inicializado em zero (linha 4635),
   zerado nas trocas de tempo (4894, 4910) e LIDO em três lugares — o fim do 1º tempo
   (4893), o `isOver()` (4918) e a interface (7991, que exibe `Math.ceil(this.stoppage)`).
   **Nenhuma linha do motor jamais atribuía outro valor.** Toda partida mostrava "+0".
2. **A partida acabava com a bola rolando** em 75% dos casos: `isOver()` comparava só o
   minuto, sem olhar se a bola estava viva, viajando ou em reinício pendente.
3. **A cobrança de falta tinha a menor pausa do jogo** — 0,45 s, contra 0,82 da falta
   comum, 0,60 do escanteio e 1,20 do gol. Justamente o lance que na vida real leva mais
   tempo.

Corrigidos. Medido em 40 partidas:

| | antes | depois |
|---|---:|---:|
| acréscimo do 1º tempo | 0 | **2,17** (máx 5,1) |
| acréscimo do 2º tempo | 0 | **3,38** (máx 7,0) |
| minuto final médio | 90,1 | 94,76 |
| partidas que acabaram com a bola em jogo | **75%** | **0%** |
| pausa da cobrança de falta | 0,8 s | 1,7 s |

**Consequência declarada:** a partida passou a durar ~5 minutos a mais, então tudo que se
conta por partida subiu junto — o que é correto, já que no futebol as estatísticas incluem
os acréscimos. Isso fez **chutes ENTRAREM** na faixa (11,88 → 12,39) e **passes SAÍREM**
(220,1 → 238,7, estourando por 3,7). Não reduzi a magnitude do acréscimo nem mexi na faixa
para acomodar o passe: os acréscimos estão em números de futebol e a faixa do contrato foi
calibrada sobre um jogo que não tinha acréscimo nenhum.

### Amostra intermediária — 30 partidas pareadas

chutes 9,50 → 12,27; desarmes 4,07 → 6,77; faltas 3,90 → 5,80; laterais 3,63 → 4,20;
escanteios 1,17 → 1,23. Confirma a direção fora da matriz de estilos.

### Cenários dirigidos

| prova | resultado |
|---|---|
| 119 cenários pós-roubada (17 formações × 7 estilos) | 119 chutões → **0**; 119 decisões direcionadas. Robusto até marcação de 0,9 m. |
| Lei do lateral (40 cobranças) | 40 gols diretos → **0** (viram tiro de meta) |

## E. Gates

| gate | valor | alvo | status |
|---|---|---|---|
| Determinismo | 8/8 idênticos | exato | **PASS** |
| Chutes | 12,39 | 12–20 | **PASS** |
| Chutes no alvo | 4,37 | 4–7 | **PASS** |
| xG | 2,088 | 1,8–2,7 | **PASS** |
| Fim de jogo com bola parada | 0% em jogo | sempre | **PASS** |
| `parkIdentity` | — | — | **PASS** |
| `tikiIdentity` | — | — | **PASS** |
| Passes | 238,7 | 170–235 | FAIL (+3,7) |
| Desarmes | 7,49 | 8–22 | FAIL (−0,51) |
| Faltas | 6,39 | 7–17 | FAIL (−0,61) |
| Laterais | 4,89 | 5–16 | FAIL (−0,11) |
| Cobertura crítica | 63,45% | ≥ 70% | FAIL |
| Escanteios | 1,21 | 4–10 | FAIL |
| `noDominantStyle` | ppgRange 0,81 | ≤ 0,75 | **INSUFFICIENT_DATA** |
| Boot desktop / mobile | — | — | **NOT_EXECUTED** |
| Matriz 17×7 completa | — | — | **NOT_EXECUTED** (o contrato manda deixar para depois) |

`noDominantStyle` é declarado indecidível: a métrica desloca ~11,5% sozinha entre amostras
da mesma build, e numa build intermediária o gate passou por margem de **0,007**. Só
resolve com `--repeats=6` (294 partidas).

## F. Regressões

**Uma regressão foi introduzida e corrigida nesta mesma sessão.** A regra que impede gol
direto de cobrança de lateral foi escrita na R18.18.3.1 mas vivia *dentro* do bloco
`cds-r1819-tactical-authority`. Ao remover aquela camada, a lei foi junto: a base tem 4
ocorrências de `untouchedSinceRestart`, a candidata intermediária tinha zero.

Foi **encontrada pelo usuário jogando**, não pelos gates — gol de lateral não aparece em
nenhuma contagem. Prova dirigida: 40/40 cobranças viravam gol; com a camada restaurada,
0/40. Custo em 147 partidas pareadas: **zero**, todas as métricas idênticas.

Auditoria do resto do bloco removido (27 métodos embrulhados) não encontrou outras perdas:
`setStyle`, `setAxes`, `setTeamInstructions`, `setShapes` e `substitute` seguem funcionando
e propagando; as referências a `offside` eram flags de configuração e as a `red` eram
filtros `!p.red`.

**Regressões não corrigidas:** escanteios caem de 1,18 para 1,16 (dentro do ruído);
impedimentos caem 38,8%, efeito não investigado.

## G. Status da candidata

**`CANDIDATA — NECESSITA AJUSTES`**

Quatro gates de ecologia seguem reprovando (desarmes, faltas, laterais, escanteios), a
cobertura crítica reprova em 63,45% contra 70%, e boot desktop/mobile não foi executado.
Não há base para `PROMOVIDA`.

### Limitação principal, e é a mais importante deste relatório

**74,3% dos cruzamentos são feitos com a área vazia** — nenhum companheiro dentro de 24 m
do gol; 96,9% sem ninguém dentro de 16 m. Medido em 619 cruzamentos, três formações.

A causa está localizada: `_canCross` libera o cruzamento a partir de 27 m do gol, e no
instante do cruzamento a bola está a ~30 m enquanto os atacantes estão a 32 m — ou seja,
corretamente ao lado dela. **A jogada nunca chega perto da área.**

Isso explica de uma vez o cabeceio ao gol em 1,20/partida contra 4–6 reais, o atributo
`cabeceio` valendo só +3,6%, e o escanteio travado — sem disputa aérea perto do gol não há
toque defensivo saindo pela linha de fundo.

**Nenhum gate mede isso.** Cruzamento conta 19/partida, dentro da faixa real, e fica verde.

Dez tentativas de correção foram feitas e **nenhuma foi promovida**: elevar o limiar enche
a área (76,3% → 19,4% de área vazia) mas derruba os cruzamentos de 14,88 para 2,50, porque
o ponta cruza no primeiro instante legal em vez de conduzir até a linha.

### Outras limitações declaradas

- **Seeds das baselines não disponíveis.** O handoff cita `AUDITORIA_100_PARTIDAS_R18.20.json`
  e companhia, mas os arquivos não vieram no pacote. A bateria usa semente fixa registrada
  (4200000, incremento 7919), repetível, mas não comparável partida a partida com os
  números do relatório anterior.
- **Boot no navegador não verificado.** A build não passa da tela de carregamento no painel
  de navegador disponível — mas a **base R18.20 original também não**, então não é
  regressão. Causa provável: as bandeiras do flagcdn são host externo e ficam bloqueadas.
- **Replay de gol não corrigido.** Diagnosticado: quando existe timeline física o replay de
  buffer é desligado e o de timeline só é instalado se a validação da ponte passar; se
  falhar, não sobra replay. É código de interface, não embrulhável por camada aditiva, e
  precisa de verificação no navegador.
- **Dados de 2026 com corrupção.** 11 dos 29 elencos de 2026 contêm jogador de elenco de
  2010 ou anterior. Casos claros: Patrick Kluivert em Gana, Ibañez (Chile 1950) no Brasil,
  Roberto Fernández (Espanha 1990) no Paraguai, Pontus Jansson escalado como goleiro,
  Uruguai com 4 goleiros, Maradona duplicado. É reparo de dado, não de motor.

## H. Arquivos entregues

| arquivo | SHA-256 |
|---|---|
| `COPA DOS SONHOS - R18.21-RC1 - DEFESA PRESSAO E ECOLOGIA.html` | `ef461809b98e5751d4d3f8d9d82aaaefae1fd49819274a95f62f18bff16a71e7` |
| base R18.20 (intocada, para conferência) | `11ab3fc32609f1a4cd87ea75437e27ce8ad491a4c8849c4c686f7c0a07314805` |

Auditoria bruta em JSON: `auditoria/bat100_base.json`, `auditoria/bat100_rc1.json`
(100 partidas com detalhe por partida), `auditoria/determinismo.json`.

Código e ferramentas no repositório, branch `agent/r18.21-rc1`:
`tools/r1821/` (construtor, 5 camadas, 10 instrumentos) e `reports/r1821/README.md`.

### Reproduzir a build

```bash
node tools/r1821/build_rc1.js \
  --base="COPA DOS SONHOS - R18.20 - INTELIGENCIA DE CHANCE.html" \
  --out="dist/COPA DOS SONHOS - R18.21-RC1 - DEFESA PRESSAO E ECOLOGIA.html" \
  --layers=tools/r1821/layers
```

O construtor **aborta** se o SHA-256 da base não bater.

### Repetir os testes

```bash
node tools/r1821/teste_determinismo.js --build="<candidata>"
node tools/r1821/bateria.js --build="<candidata>" --matches=100 --detalhe=1 --out=bat100.json
node tools/r1821/scenario_119.js --build="<candidata>"
node tools/r1821/teste_lateral.js --build="<candidata>"
node tools/r1821/diag_area.js --build="<candidata>" --matches=8
```

## Nota sobre o método

Quatro diagnósticos herdados do relatório anterior foram medidos e **não se confirmaram**:
os 119 cenários (a rota `_clearBall` é chamada zero vezes em partida real), o clamp da
lateral em `y=0,5` (nunca morde), a supressão de escanteio pela r18183 (todas as supressões
são legalmente corretas) e o `tackleAttemptRate` em 12 (não é o gargalo).

Regra adotada e registrada: **nenhum cenário dirigido vira prioridade sem antes medir
quantas vezes a rota dispara em partida real.**

Também foi medido o ruído próprio de cada métrica, comparando a mesma build em amostras
diferentes. Escanteio, lateral, passe e tentativa de desarme sustentam decisão com 49
partidas; **gol (27%), drible (60%), impedimento (33%) e `ppgRange` (11,5%) não sustentam** —
e as amostras usadas nessa medição eram correlacionadas, então os valores reais são maiores.
