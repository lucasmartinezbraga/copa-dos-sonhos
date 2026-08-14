# OS-207 · A "bugadinha" da bola parada

Relato do dono: *"a bugadinha que dá na animação na hora que o jogador vai bater
falta, escanteio, sofre falta"*.

Não é uma. São quatro defeitos independentes que se encontram no mesmo instante
do jogo — justamente o instante em que a bola está parada, nada acontece e o
olho tem tempo de olhar.

O HTML entregue estava à frente do `src/` (tinha OS-203 e OS-206; o repositório
parava na OS-202). Ele foi importado com `tools/import_build.py` antes de
qualquer correção, e `tools/build.py` confirmou que remontava o arquivo do dono
byte a byte (`sha256` idêntico) antes de começar.

---

## Os quatro defeitos

### 1 · A passada do batedor saltava de volta (OS-89, desenho)

`70-game-runtime-and-rendering.js`

A OS-89 avança o corpo do batedor sobre a bola só no desenho. O fator subia até
1 no primeiro terço e **ficava** em 1 pelos 66% restantes dos 420 ms; no quadro
em que a animação terminava, o deslocamento caía a zero de uma vez. O desenho
saltava de volta o vetor inteiro jogador→bola — até 6 m.

E isso acontece embaixo do `slowmo` de 0,35× que a OS-88 liga *justamente para o
dono olhar a cobrança*. Era o pulo mais visível do jogo.

Agora o pé avança, encosta e o corpo volta ao eixo físico de forma contínua: em
`_e = 1` o deslocamento já **é** zero, então não existe quadro de salto.

### 2 · O tremor do #anti-cardume na bola parada (desenho)

`70-game-runtime-and-rendering.js`

O balanço #anti-cardume foi calibrado para quem **corre**: amplitude até 2,2 px
oscilando a 14–24 rad/s, proporcional ao deslocamento de tela do quadro. Ele
entra no desenho, e `CDS_F25D.body` deriva a passada do deslocamento
**desenhado** (`d.vms`) — então o balanço realimenta a própria cadência das
pernas.

Correndo isso é tempero (a §D41 mediu 2% de `mv`). Na bola parada, que é quando
todo mundo **caminha** a ~1 m/s até o posto, o deslocamento real por quadro cai
para a mesma ordem de grandeza do balanço — e ele deixa de ser tempero para
virar a maior parte do sinal.

Bola parada não tem cardume para quebrar: ninguém está correndo em bloco. O
balanço desliga com a bola morta e volta com ela rolando.

### 3 · Quem sofre a falta não tinha gesto nenhum

`21-cds-ux-boot.js` + `60-cds-os46-anim-wiring.js`

São 62 estados de animação declarados e **nenhum deles é levar uma falta**. O
motor emite `foul` com `by` e `on` desde sempre; a apresentação tinha só
`fxAt(e.on,'foul')` — uma partícula e um som. O jogador derrubado seguia com a
locomoção que tivesse, então a falta lia como "apitou do nada" e ele saía
trotando do próprio tombo.

É o evento mais frequente sem gesto: ~21 por partida nesta build.

Entram `fouled` (o desequilíbrio) e `get_up` (a recomposição), em *tier* de ação
para que a locomoção não os sobrescreva, com envelope e pose próprios. O
infrator ganha `standing_tackle → recover` — antes só o ramo do bote pedia pose,
e a maior parte das faltas vem de outros ramos.

### 4 · A animação lia a velocidade antes da bola parada escrever a posição

`79-os207-cerimonia-sem-tremor.js` (camada nova, a última do documento)

Cada camada envolve `P.step` capturando a anterior, então a **ordem do
documento** decide quem roda por fora de quem. A ponte de animação é o bloco 21.
Depois dela ainda escrevem `p.x/p.y` — várias também `p.vx/p.vy` — a OS-77
(falta comum), a OS-83 (impedimento), a OS-100 (lateral), a OS-107 (bloco de
bola parada), a OS-112 e a R18.99.

Ou seja: **tudo** que move gente durante a cerimônia escreve depois que a
animação já escolheu a pose do quadro. O desenhista pinta a posição final; a
máquina de estados escolheu a pose com a velocidade do meio do caminho.

A R18.99/T7 diagnosticou exatamente este sintoma — o comentário dela diz, com
todas as letras, *"o 'meio bugadinho' que se vê na hora da falta"* — e a conta
dela está certa. Só que ela aplica a correção **quatro níveis por fora** da
ponte: a velocidade corrigida existe e a animação nunca a vê, porque o quadro
dela já passou.

A correção não é refazer a conta, é mudar a **hora**.

---

## Medição

`tools/fisica/tela/cerimonia.js` (sonda nova). Ela existe porque a bateria de
física **não consegue** medir isto: ela pula o bloco `cds-ux-boot`
(`bateria.js:65`), que é onde moram a ponte de animação e o desenhista.

A sonda compara a faixa de locomoção que a máquina de estados escolheu com a
velocidade que o deslocamento do quadro implica — as duas coisas que o
desenhista junta na tela. 6 partidas, bola morta apenas.

| | antes | depois |
|---|---:|---:|
| quadros de bola morta | 32.283 | 32.283 |
| amostras de locomoção | 247.258 | 237.583 |
| pose fora da faixa | 61.116 (24,72%) | 27.650 (11,64%) |
| **desenhado PARADO e deslizando** | **316** | **0** |
| **desenhado CORRENDO e parado** | **10.617 (4,29%)** | **0** |

As duas linhas em negrito são a "bugadinha" descrita. Zeradas.

O resíduo de 11,64% é discordância de faixa **vizinha** (`walk` desenhado com a
velocidade já em `jog`), que é inerente: a animação suaviza e as faixas são
discretas. As duas categorias patológicas não existem mais.

### Custo: nenhum

`reports/antes-os207.json` e `reports/depois-os207.json`, 48 partidas, mesmas
sementes. Os agregados são **idênticos campo a campo** — conferido por
comparação de JSON, não a olho. 12/13 métricas de design, as mesmas antes e
depois. O smoke de navegador devolve o mesmo placar (0x1, 15 chutes) e a sonda
conta os mesmos 32.283 quadros de bola morta.

Isso é por construção: a velocidade honesta é **emprestada**. A camada troca
`p.vx/p.vy` pelo valor coerente com o deslocamento, manda a ponte amostrar, e
devolve os originais no mesmo passo, num `finally`. O motor termina o quadro com
exatamente os números que teria sem a camada.

---

## O que foi tentado e revertido

A primeira versão da OS-207 também mexia no motor, e a bateria a reprovou.

**Freio contínuo da cerimônia.** O motor chama
`_movePlayers(pdt, this.waiting || this.dead > 0.4)` e isso vira `freeze ? .5 : 1`.
São dois defeitos reais: (a) no quadro em que `dead` cruza 0,4 os 22 jogadores
dobram de velocidade juntos; (b) as camadas de espera do batedor seguram o
reinício devolvendo `dead = 0.12` quadro a quadro, e como 0,12 < 0,4 o freio
fica **desligado durante toda a cerimônia** — o sistema tático corre a 100%
disputando cada jogador com o alvo de bola parada.

O diagnóstico continua de pé. A correção não: trocar o degrau por uma rampa
levou **12/13 → 11/13**, com `zeroZeroRate` indo de 0,062 para 0,146 (faixa
0,045–0,12) e `onTargetRate` caindo para fora por baixo. Bola parada é onde se
fazem gols; mexer no passo de quem se posiciona muda quantos saem. É a mesma
armadilha que a R18.35 documentou — as métricas de volume não viram, a
distribuição de placares viu.

**Escritor final do batedor.** `snapTakerBeforeRestart` crava o batedor no ponto
no quadro do reinício, e a R18.99/T3 não o alcança: ela roda só quando `dead > 0`
nos dois extremos do quadro, e o quadro do reinício termina com `dead <= 0` —
além de pular qualquer salto acima de 2,50 m como recolocação administrativa.
O snap cai exatamente nas duas exceções.

Medido no HTML original: **5,66% dos reinícios** (15 de 265) com salto acima do
passo físico, média 0,95 m, máximo 4,94 m. É pequeno e quase sempre invisível.
A tentativa de corrigi-lo por fora andava junto com o freio e não foi possível
separar o efeito sem outra rodada de calibração.

**Fica registrado como pendência**, não como corrigido. É trabalho de motor, com
medição própria — não de apresentação.

---

## Pendência adicional encontrada (não corrigida)

O desenhista guarda três caches por **nome** do jogador: `_prevScreen` (balanço),
`dirCache` (passada, em `CDS_F25D.body`) e `__CDS_SCREEN.p` (posição de tela,
lida pela OS-21). A ponte de animação já corrigiu esta exata colisão para os
seus próprios ids — *"ids sem o time colidiam entre os dois lados e dois atletas
dividiam o mesmo controlador (22 jogadores viravam 17 estados)"* — mas os três
caches do desenho ficaram por nome.

Dois jogadores homônimos em campo dividem passada e balanço a partida inteira.
Não é o defeito relatado (não é específico de bola parada) e a correção cruza
quatro arquivos e um contrato entre camadas, então ficou de fora desta rodada.
