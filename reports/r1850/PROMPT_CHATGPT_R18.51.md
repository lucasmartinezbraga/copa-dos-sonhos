# Copa dos Sonhos — documento de continuidade para o ChatGPT

Cole este documento inteiro como primeira mensagem. Ele é autossuficiente: não
depende de acesso ao repositório.

---

## 0. Antes de tudo: o que você pode e o que você não pode fazer aqui

Você **não tem** o laboratório. O motor é medido por baterias de 48 partidas em
Node, com três bases de semente, e isso roda na máquina do Lucas — não no seu
ambiente. Portanto:

**Não faça:** afirmar que uma mudança "vai melhorar X%", dar número medido que
você não mediu, ou dizer que um patch está pronto para promover.

**Faça:** ler o mecanismo no código, propor o patch com o texto exato do
`edit()`, prever o resultado **antes** e escrever qual medição decidiria, e
apontar armadilhas. O valor que você agrega é raciocínio sobre o código e
desenho de experimento — não medição.

Quando propuser algo, entregue nesse formato:

```
MECANISMO   o que no codigo produz o defeito, com arquivo:linha
HIPOTESE    o que muda se corrigir, em direcao (sobe/desce), nao em %
PATCH       o edit() exato, com ancora unica
PREVISAO    2 a 4 numeros que voce espera, registrados ANTES de medir
MEDICAO     qual instrumento e qual gate decide
ARMADILHA   o que pode dar errado e como perceber
```

Registrar previsão antes de medir é regra da casa: os relatórios das rodadas
anteriores têm seção "previsões que registrei antes de medir", e o valor está em
quando elas **erram**.

---

## 1. Onde o projeto está

**Build promovida:** `R18.50 — PRESERVAR ENERGIA`, SHA `495a9d684104…`
**Repositório:** github.com/lucasmartinezbraga/copa-dos-sonhos
**Branch:** `claude/handoff-leitura-execucao-qshbb0`

O jogo é um HTML único. Ele **não** vive em `src/scripts/` — esse é o tronco
abandonado da Fase 2. É construído de `src/r13/scripts/` via `tools/build_r13.py`
e depois transformado por patches aplicados ao HTML **já construído**
(`tools/r18XX/patch_*.js`, substituição de string com âncora única que aborta se
a âncora não aparecer exatamente uma vez).

O `src/r13/scripts/` também já está **atrás** do que roda. Exemplo real: os
sítios de chute chamam o planejador do goleiro com raio 1,95 no fonte e **3.0**
na build. A verdade comportamental é a build em `dist/`.

### Armadilha que já custou duas rodadas

Existem **duas definições** de `_gkInterceptTarget`. A do bundle base é
sobrescrita por `P._gkInterceptTarget=function(...)` de um bloco posterior
(`cds-physics-timeline-581`). Um patch na cópia sombreada sai **inerte** e a
bateria fica byte-idêntica. **Antes de patchar qualquer método, procure
`P.<nome>=function` em blocos posteriores.**

---

## 2. Os gates — o contrato que decide promoção

| gate | métrica | faixa | R18.50 |
|---|---|---|---:|
| ECO-01 | gols/partida | 2,4–3,2 | 2,500 |
| ECO-02 | xG/partida | 1,8–2,7 | 2,435 |
| ECO-03 | chutes/partida | 12–20 | 14,813 |
| ECO-04 | chutes no alvo | 4–7 | 4,813 |
| COE-01 | gols/xG | 0,90–1,15 | 1,037 |
| CAU-03 | % gols por falha de contato do goleiro | < 8 | 2,344 |
| INT-05 | `save_energy` (% das decisões) | 3–12 | 6,67 |
| **ECO-05** | **escanteios/partida** | **4–10** | **~1,1 — REPROVA** |
| TEC-04 | determinismo | 8/8 | ok |
| TEC-05 | carga do bundle | símbolos presentes | ok |

**Protocolo obrigatório.** Um Δ só conta se `|Δ| > banda de ruído` **E** existe
mecanismo no código que o explique. Bandas medidas: passes 2%, chutes 7%,
desarmes 22%, gols 30%, **escanteios 31%**, laterais 40%.

**Regra das três bases.** Toda decisão usa três bases de semente
(`4200000 / 8400000 / 1260000`), e a primeira pergunta não é "a candidata passa"
— é **"a baseline cumpre esse gate nessa base?"**. Um gate que a própria baseline
reprova não separa candidata boa de ruim. Isso já invalidou uma decisão real:
`ECO-03` era cumprido pela baseline em 1 de 3 bases e uma candidata foi excluída
por uma diferença de 0,35% contra banda de 7%.

---

## 3. O alvo da próxima rodada: OS-05, o escanteio sem fonte

É o defeito mais visível que resta. O jogador assiste a uma partida e vê
**1,1 escanteio**, contra faixa 4–10.

### O que já foi medido (R18.49, 18 partidas)

| | valor |
|---|---:|
| cruzamentos da linha de fundo / partida | 5,67 |
| **com último toque da DEFESA** | **1,39** |
| escanteios / partida (`setCorner`) | 2,39 |
| escanteios / partida (evento `corner`) | 1,33 |

O toque defensivo que cruza a linha é a **única** fonte de escanteio por
geometria — `_ballOut()` deriva escanteio quando a defesa tocou por último, e o
censo já mediu que essa regra acerta 99,3% das vezes. **O problema nunca foi a
regra: é a bola nunca chegar até ela.**

Cardápio de eventos defensivos por partida:
`intercept` 11,44 · `tackle` 7,33 · `gk_claim` 2,83 · `save` 1,89 ·
`header_clear` 1,00 · `gk_punch` 0,56 · `_clearBall` 0,17.

### Direção que a Ordem de Serviço original dava — e por que está errada

Ela mandava destravar um `chance(.16)` dentro de `_clearBall`. Medido com hook no
**protótipo**: `_clearBall` roda 0,17 vez por partida. O portão está dentro de
função quase morta, e além disso `_clearBall` manda a bola para **frente**
(`o.x + dir*25`), então nem funcionando geraria escanteio por geometria.

### O mecanismo que eu localizei, e a tentativa que falhou

`10-base-bundle.js:3255`, ramo aéreo de `_cross`, quando o **zagueiro** ganha o
primeiro contato:

```js
if(def){ def.rating+=.08; this._emit('header_clear',{by:def}); this._turnover(def); }
```

`_turnover(def)` entrega a bola ao zagueiro no mesmo quadro. Cabecear um
cruzamento vira posse limpa: a bola não viaja, não existe segunda bola, e nunca
pode cruzar a própria linha.

**Minha correção quebrou o jogo e está rejeitada.** Fiz a bola seguir viva. O
patch executava (`corte_livre` disparava), e mesmo assim o **evento `corner` foi
a zero** enquanto `_setCorner` continuava sendo chamado — escanteio armado e
nunca entregue. Duas variantes com direções opostas do cabeceio e shas diferentes
produziram partidas **idênticas nos 62 eventos**.

**A causa:** esse mesmo ramo aéreo também processa a **cobrança de escanteio**.
Deixar a bola viva ali interfere na máquina de bola parada. Eu não distingui
cruzamento de jogada corrida de cobrança de bola parada — e era exatamente a
distinção que o sítio exigia. O código tem um `setPiece` disponível nesse escopo
(há um `if(setPiece)` na mesma linha).

### O orçamento que limita a ambição

Levar escanteios à faixa adiciona **+0,1 a +0,26 de xG**, e a folga até o teto de
`ECO-02` é **0,265** (2,435 contra 2,7). Mire no **piso 4**, não no teto 10. Uma
correção que traga 4 escanteios e estoure o xG é rejeitada.

### Armadilha herdada, não repita

`_looseBall(x,y)` **não** deixa a bola solta: zera a velocidade e chama
`_contestLoose()`, que entrega ao jogador mais próximo **sem limite de
distância**. Foi assim que a R18.22 inflou o xG em 30%. O caminho certo é a bola
seguir com velocidade e `_ballOut()` decidir — padrão que a R18.31 provou.

---

## 4. Outras fichas abertas

**OS-02 — craques elegíveis no banco. BLOQUEADA, e o bloqueio é legítimo.**
A escalação põe Pelé (98) no banco com Fontana (69) de centroavante, porque o
slot primário de Pelé não é ST. O patch existe e corrige (2 397 → 397 vagas).
Mas com o XI correto o xG vai a ~3,0 contra teto de 2,7 — e **o teto está certo**:
futebol real tem ~2,7 de xG por partida. Não é gate mal calibrado; é o resto do
motor generoso demais para suportar um ataque bem escalado. A saída provável é
melhorar a defesa antes (ver OS-07), não afrouxar o gate.

**OS-07 — cardume.** 67,5% das células do campo vazias, bloco de 31,3 m (real
35–45). Maior acoplamento do projeto; a Ordem de Serviço manda tratar em etapa
própria, sozinha, sem dividir bateria com finalização. É a candidata a
desbloquear a OS-02.

**OS-04 — poucos corpos no escanteio.** Dois `slice` limitam a 3 atacantes e 4
defensores. Depende de OS-05 primeiro: não faz sentido povoar a área de um
escanteio que quase não acontece.

**OS-06 — Copa.** 1,69–1,98 gols por jogo e 19,8% de 0×0 contra alvo de <13%. Só
se mede no navegador (`window.CUP`), porque a camada da Copa não carrega no
harness de Node.

**OS-08 — condução.** Está em 1,53% das ações depois da R18.49. O relatório dela
concluiu algo útil: a condução não sobe mexendo em quem **pode** conduzir, e sim
em quem **prefere** — o passe de progressão vem antes no dispatch e tem barra
baixa.

---

## 5. Como um patch é escrito neste projeto

```js
const a = (n,d) => { const h = process.argv.slice(2).find(x=>x.startsWith('--'+n+'=')); return h ? h.slice(n.length+3) : d; };
const PARAM = Number(a('param', 0.34));       // tudo calibrável fica exposto
let src = fs.readFileSync(a('in'), 'utf8');
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA ['+id+']: ancora '+n+'x'); process.exit(1); }
  src = src.replace(from, to);
}
```

A âncora **tem** que casar exatamente uma vez — é o que impede patchar a cópia
errada. O comentário no patch explica o mecanismo e traz o número que o motivou,
porque o patch é o documento.

---

## 6. Como responder

Comece propondo **uma** rodada — não um plano de cinco. Diga qual ficha, qual
mecanismo, qual patch, o que você prevê, e o que reprovaria a sua própria ideia.
Se achar que o meu diagnóstico da OS-05 está errado, diga onde: eu já errei nesta
linhagem reportando ruído como conserto e patchando cópia sombreada, e a lista
está nos relatórios.
