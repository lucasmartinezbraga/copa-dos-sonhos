# OS-256 · A bola tinha quase quatro vezes o tamanho que devia

**Cobrança do dono, e ela reorientou a sessão inteira:**

> "tudo que eu peço que você olhe é pra olhar o VISUAL... tem que ver o gif do
> lance... qual é a animação quando o jogador dá um chute? quando sai
> driblando? o pulo do goleiro? ... você vai ficar ajustando várias coisas, mas
> eu não sei se isso vai melhorar de fato o que precisa ser melhorado."

Ele está certo. Uma sessão inteira de número não substitui olhar o lance — e
quando finalmente olhei, o primeiro defeito não estava em nenhuma métrica que
eu vinha medindo.

## O instrumento que faltava

`tools/fisica/tela/lance-em-quadros.js`. Duas coisas que as ferramentas
anteriores erravam:

* `gif-de-jogo.js` só sabia esperar falta, escanteio, gol e lateral — chute,
  drible e defesa não estavam mapeados, e o gatilho nunca disparava;
* ela começava a capturar **no** evento, mas o chute começa antes: a perna
  arma, o corpo gira, o pé encosta. Capturar a partir do evento perde
  exatamente a parte que se julga.

Esta grava num buffer rolante e, quando o lance acontece, guarda os quadros de
**antes** junto com os de depois. E segue o **atleta que executa**, não a bola
— centrar na bola parecia óbvio e está errado: depois do chute a bola sai, o
chutador fica, e o recorte perde quem fez o gesto.

## O que se vê na primeira folha

Um chute do HAZARD contra o SEAMAN, 24 quadros. Três coisas saltam, e a
primeira não é o gesto:

1. **A bola é uma bola de praia.** Ela tem mais da metade da altura do atleta.
2. **Não há chute visível.** Do quadro −8 ao +15 o corpo mal muda: não há perna
   armando, estendendo, nem acompanhamento.
3. **O goleiro é uma estátua** — de pé, braços colados, imóvel os 24 quadros,
   com um chute saindo na frente dele.

## A bola, medida

Interceptando o raio que o desenhista de fato usa (cuidado: `ball()` desenha
três círculos — halo, sombra e bola; pegar o maior mede o halo):

| | controle | depois |
|---|---|---|
| diâmetro desenhado da bola | 10,2 px | **6,6 px** |
| altura desenhada do atleta | 17,1 px | 17,1 px |
| proporção bola/atleta | **0,596** | **0,385** |
| exagero contra o futebol real (0,126) | **4,7×** | **3,1×** |

Bola grande demais é a razão número um de um jogo 2.5D não *ler* como futebol:
**o olho usa a bola como régua de escala**, e uma bola de praia encolhe o campo
inteiro. Comparando com o gol atrás (7,32 m), a bola antiga ocupava quase um
sexto da meta; a real ocuparia um trigésimo.

Não desci até 0,126 porque a 34 px/m isso daria uma bola de 4 px, invisível em
movimento — é o piso de jogabilidade que todo jogo do gênero paga. `3,9` é o
meio-termo, e ficou como interruptor (`CDS_BOLA_R`) para ser escolhido
olhando, não por mim.

Apresentação pura: verify e smoke passam, e o bloco é pulado pela bateria.

## O que eu vi e ainda não consertei

* **O chute não tem gesto visível.** `shot_contact` existe na máquina de
  estados e o Árbitro diz que o evento vira gesto — mas na tela, a 17 px de
  altura, não se lê perna nenhuma. Ou o gesto é curto demais para o olho, ou é
  pequeno demais na silhueta.
* **O goleiro não reage ao chute.** Nos 24 quadros ele não se move.
* **As placas de nome tapam os corpos** — "SEAMAN" cobre o peito do 9.

Estes três são a fila, e os três só apareceram porque eu finalmente olhei.
