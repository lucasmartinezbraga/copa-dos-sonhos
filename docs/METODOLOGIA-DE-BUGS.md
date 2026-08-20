# Metodologia de avaliação de bugs — Copa dos Sonhos

> Como descobrir, provar, classificar, repetir e fechar um defeito neste jogo.
> Vale para o motor, para as 80 camadas e para o que aparece na tela.

---

## 1. Por que este jogo precisa de uma metodologia própria

Três características tornam inútil o teste de software comum aqui:

**O jogo não tem estados, tem uma trajetória.** Um bug de futebol raramente é
"a função devolveu errado". É "o zagueiro parou de existir por 4 segundos no
minuto 63 da partida com semente 4207919". Não há teste unitário que chegue
lá; é preciso *rodar futebol* e olhar para todos os quadros.

**O código é uma pilha, não um programa.** São 80 blocos que se sobrescrevem.
O que roda de verdade num método é o que a última camada decidiu. Editar o
core sem saber disso é editar código morto — o próprio `CLAUDE.md` registra
uma rodada de medição perdida assim. Existe, portanto, uma família inteira de
bugs em que *o programa está certo e mesmo assim não executa*.

**Metade dos defeitos é de sensação.** "A falta acontece do nada", "o jogo
demora demais", "não tem fluidez". Isso não é opinião vaga: é uma afirmação
sobre duração, sequência e legibilidade — tudo mensurável, e nada disso
aparece em contador de gol, passe ou chute.

---

## 2. O princípio: sem oráculo não existe bug

Um **oráculo** é uma afirmação sobre o jogo que pode ser violada. Sem ele não
há bug, há impressão. Todo achado desta metodologia nasce de um dos três:

| tipo | o que é | violou, e daí? |
|---|---|---|
| **Invariante** | Nunca pode ser falso, em nenhum quadro de nenhuma partida. `bola.x` é finito. | É defeito, ponto final. |
| **Lei de jogo** | Regra de futebol que o motor promete cumprir. O expulso sai de campo. | É defeito, mas o conserto é de regra. |
| **Plausibilidade** | Faixa **medida**, não lei. Chute abaixo de 60 m/s. | É suspeita, com número em cima da mesa. |

**Regra de honestidade:** limiar de plausibilidade só entra no catálogo depois
de medido no build corrente. Limiar chutado gera alarme falso; alarme falso
mata a auditoria; auditoria que ninguém lê não encontra nada.

O catálogo vive em [`tools/auditoria/invariantes.js`](../tools/auditoria/invariantes.js)
— cada oráculo tem `id`, gravidade, classe e o **porquê** de existir.

---

## 3. Os seis níveis

Cada nível tem um oráculo diferente, um custo diferente e pega uma família de
bug diferente. Rodar só um deles dá uma falsa sensação de cobertura.

### N0 · Artefato — *o bundle é montável e carrega?*

Pega: erro de sintaxe, bloco perdido no manifesto, símbolo que sumiu do escopo,
build que não reproduz a partir de `src/`.

```bash
python3 tools/verify.py
node tests/browser_smoke.js dist/index.html
```

Um bloco que estoura na carga é defeito **de gravidade máxima**, mesmo que o
jogo pareça funcionar: significa que uma camada inteira não está instalada.

### N1 · Camadas — *quem manda de verdade em cada método?* (estático)

Pega quatro bugs que nenhuma partida revela, porque o jogo continua rodando
lindamente — só que rodando outra coisa:

- **patch perdido** — a camada guarda `var old = P.m` e nunca chama `old`.
  Tudo que estava embaixo morreu em silêncio.
- **ramo morto** — o método do core foi substituído por inteiro. O `if` que
  você está editando não executa nunca.
- **pilha funda** — o mesmo método remendado por 3+ camadas: a ordem do
  manifesto virou regra de negócio não escrita.
- **sem guarda** — camada que não se protege de dupla instalação.

```bash
node tools/auditoria/mapa_de_camadas.js --build=dist/index.html
node tools/auditoria/mapa_de_camadas.js --build=dist/index.html --metodo=_awardFoul
```

O segundo comando é o que se roda **antes de editar qualquer coisa**: ele diz
se o código que você está prestes a mexer é o que roda.

### N2 · Quadro — *o estado é legal em todo quadro?*

O observador embrulha `step` e inspeciona ~30 oráculos por quadro: coordenada
não finita, bola fora do mundo, teleporte acima do orçamento de passo da
R18.99, expulso em campo, dono da bola longe da bola, relógio parado, bola
morta que não reinicia, contador que regride.

```bash
node tools/auditoria/auditoria.js --build=dist/index.html --partidas=24 --workers=8
```

### N3 · Partida — *o jogo terminou coerente?*

Placar bate com os eventos de gol; `passOk ≤ passes`, `onTarget ≤ shots`,
`xg ≤ shots`; substituições dentro do permitido; e os contadores que o próprio
motor mantém contra si mesmo (`visualIntegrity`: teleportes, contatos
falhados, faltas de viagem) — contador acima de zero é confissão.

### N4 · Amostra — *o que só aparece em centenas de partidas*

- **funcionalidade morta**: evento que o código sabe emitir e que a amostra
  nunca viu. O runner compara a lista estática de `_emit('...')` do bundle com
  o que de fato aconteceu.
- **alvos de design**: `calibration/targets.json` é o contrato do projeto.
  Fora da faixa é bug de balanceamento, com número.
- **viés de lado**: com elencos iguais em campo neutro, mandante e visitante
  empatam na média. Não empatar é bug.
- **determinismo**: mesma semente, mesmo jogo. Sem isso não há repetição, e
  sem repetição não há conserto.

### N5 · Tela — *o ritmo, a pausa e a fluidez, em relógio de parede*

Este nível existe porque **tudo que decide a experiência mora no laço de
render**, e nada disso existe fora do navegador: o multiplicador do botão, o
adianto de bola parada (`ADIANTA_PARADA`), a janela de cerimônia da OS-263, a
comemoração, a câmera lenta.

E se mede em **segundos de parede**, nunca em segundos de simulação: a pausa
que o olho sente é a que o relógio do olho conta. Uma falta de 1,7 s de
simulação pode virar 0,3 s de tela (se algo a adianta) ou 5 s (se algo a
segura) — bugs opostos, mesmo número de simulação.

```bash
node tools/auditoria/tela.js --build=dist/index.html --segundos=150
node tools/auditoria/tela.js --build=dist/index.html --velocidade=1 --segundos=120
```

Devolve: custo de tela (parede por simulação) e a projeção da partida inteira;
pausa por tipo de reinício em ms de parede; orçamento do tempo de tela (quanto
é futebol rolando, quanto é espera); e fluidez medida **no que é desenhado** —
tremor (deslocamento que inverte de direção entre quadros) e salto (passada 4×
acima da mediana). Contar passo de simulação por quadro mede a *velocidade
escolhida*, não a fluidez; só o desenho mede fluidez.

### Eixo transversal · Sondas de lance — *o que o jogador vê acontecer*

Queixa de jogador é sobre **lance**, e lance não aparece em contador nenhum.
Cada sonda traduz uma frase em número:

| a frase | a medida |
|---|---|
| "a falta acontece do nada" | fração de faltas sem evento de contato visível nos 0,6 s antes do apito; distância infrator‑vítima no apito |
| "não tem pausa pro batedor bater" | espera até a bola voltar a rolar (simulação) e a pausa correspondente em parede |
| "o jogador sai andando, não sai batendo" | desfecho do reinício: **batida** (a bola voa) ou **carregou** (o dono anda 3 m com ela) |
| "a batida às vezes é nada a ver" | distância da bola ao ponto da falta e do cobrador à bola no quadro do reinício |
| "a bola pisca de um lugar para outro" | metros que a bola pula, de graça, no quadro do reinício |

Sonda nova se acrescenta em `criarObservador` e é **medição, não violação** —
vira violação só quando existe faixa medida para comparar.

---

## 4. Gravidade

| | o que é | o que fazer |
|---|---|---|
| **S1** | Trava, corrompe ou impede terminar. NaN, bola morta eterna, placar que regride. | Barra o commit. |
| **S2** | Quebra regra de futebol ou lei do motor sem travar. Expulso jogando, teleporte, patch perdido. | Entra na rodada atual. |
| **S3** | Implausível ou fora da faixa de design. Chute a 300 km/h, gols abaixo do alvo. | Entra na fila com medição. |
| **S4** | Inconsistência interna invisível ao jogador. | Anota e agrupa. |

---

## 5. Da violação ao conserto

```
     auditoria ──► violação (id, semente, minuto, quadro)
                          │
                          ▼
       repro.js ──► a janela de quadros do defeito
                          │
                          ▼
   mapa_de_camadas ──► quem manda naquele método
                          │
                          ▼
                     correção em src/
                          │
                          ▼
     auditoria de novo ──► MESMA amostra, números comparados
```

**1. Repetir.** Toda violação sai com `partida`, `semente` e `quadro` — isso é
a receita:

```bash
node tools/auditoria/repro.js --build=dist/index.html --partida=3 --regra=E1
```

Ele reproduz a partida e narra a janela de quadros em volta do defeito, com
bola, dono, velocidade, viagem e eventos. É o passo que transforma "existe um
bug" em "está aqui, olhe".

**2. Localizar o dono.** `mapa_de_camadas.js --metodo=X` diz qual camada
executa. Corrigir no core um método que a camada 12 substituiu não muda nada.

**3. Corrigir em `src/`, nunca em `dist/`.** Build, verify, smoke.

**4. Re-medir a MESMA amostra.** Mesmas sementes, mesmo número de partidas,
números lado a lado. "Passou" não é resultado; resultado é o número antes e o
número depois.

---

## 6. Calibrar limiar é parte do método

Um oráculo mal calibrado é pior que oráculo nenhum. Dois exemplos reais desta
própria implementação, que valem como regra:

**O expulso que "continuou jogando".** A regra acusou 3 casos. Todos no minuto
45, todos com o atleta "andando" 40‑70 m num quadro. Não era o expulso
voltando: é `_switchSides` espelhando **todos** os atletas no intervalo,
inclusive os expulsos, enquanto `_resetPositions` os pula. Inconsistência real
— mas S4, não S2. A regra foi partida em duas (`C4` e `C4b`) em vez de ter o
limiar afrouxado, porque afrouxar teria escondido o caso verdadeiro junto.

**O chute a 929 m/s.** A regra acusou 4 casos. Nenhum era chute: era a bola
sendo *recolocada* no ponto do reinício, e a sonda lendo o salto como
velocidade. A correção foi excluir a janela administrativa do teste de
velocidade — e, no lugar, criar uma sonda para a própria recolocação (`B8`),
porque 31 m de salto instantâneo são um defeito **de apresentação** que
merecia nome próprio.

A lição das duas: quando um oráculo acusa demais, a pergunta certa não é
"quanto afrouxo?", é **"o que ele está realmente vendo?"**.

---

## 7. Cadência e portão

| quando | o que roda | tempo | portão |
|---|---|---|---|
| a cada commit | `verify.py` + `browser_smoke.js` + auditoria com `--partidas=8` | ~1 min | zero S1; nenhum bloco com erro de carga |
| ao mexer no motor/física | acima + `--partidas=48` + `tools/fisica/bateria.js` | ~5 min | zero S1; S2 não pode aumentar; agregados comparados com a medição anterior |
| ao mexer em ritmo, pausa ou render | acima + `tela.js` nas velocidades 1X e 3X | ~10 min | custo de tela e pausas por tipo comparados com a medição anterior |
| antes de fechar rodada | tudo, `--partidas=200`, mais `mapa_de_camadas` | ~30 min | zero S1; laudo gerado e commitado em `reports/auditoria/` |

**Neutralidade da própria auditoria.** O observador não pode mudar o jogo. A
prova roda junto:

```bash
node tools/auditoria/auditoria.js --build=dist/index.html --verificar-neutralidade
```

Mesma partida com e sem observador tem de dar a mesma assinatura. Se der
diferente, a auditoria está medindo a si mesma e todo resultado é suspeito.

---

## 8. O que esta metodologia **não** pega

Dizer isto é parte do método — cobertura que se supõe é pior que buraco
conhecido:

- **Fluxo de telas**: draft, escalação, navegação da Copa. Só o `browser_smoke`
  toca nisso, e superficialmente.
- **Mobile**: nada aqui roda em viewport de celular nem em toque.
- **Copa inteira**: a auditoria roda partidas isoladas. Bug de chaveamento,
  classificação, pênaltis de mata-mata e persistência entre partidas fica fora.
- **Áudio e efeito visual**: nenhum oráculo.
- **Gosto**: a metodologia mede se a falta parou o jogo por 2,0 s. Se 2,0 s é o
  número certo, é decisão de projeto — a medida só garante que a discussão
  aconteça sobre um número, e não sobre uma lembrança.

---

## 9. Como acrescentar um oráculo

1. Escreva a frase que ele nega, em português, no campo `porque`. Se não
   couber numa frase, o oráculo ainda não está pronto.
2. Escolha o tipo (invariante / lei / plausibilidade). Se for plausibilidade,
   **meça primeiro** e só depois fixe o limiar.
3. Acrescente ao `CATALOGO` com id, classe e gravidade.
4. Implemente em `inspecionar()` (por quadro) ou `finalizar()` (por partida).
5. Rode com `--partidas=24` e olhe os exemplos **um por um** antes de confiar.
6. Verifique a neutralidade.

---

## 10. Arquivos

```
docs/METODOLOGIA-DE-BUGS.md        este documento
tools/auditoria/nucleo.js          carga do bundle (inteira ou parcial)
tools/auditoria/invariantes.js     catálogo de oráculos + observador
tools/auditoria/auditoria.js       runner N2/N3/N4 (paralelo)
tools/auditoria/tela.js            sonda N5 (Chromium, relógio de parede)
tools/auditoria/mapa_de_camadas.js análise estática N1
tools/auditoria/repro.js           repetição de um defeito, quadro a quadro
tools/auditoria/relatorio.js       junta tudo num laudo em Markdown
reports/auditoria/                 medições e laudos
```
