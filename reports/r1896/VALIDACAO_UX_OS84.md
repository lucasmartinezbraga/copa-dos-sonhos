# Validação de UX · OS-84 (desfecho do chute)

Critérios aplicados, o que reprovou na primeira versão e o que mudou. Tudo o que
está aqui foi verificado no navegador, não deduzido do código.

---

## 1. Consistência com a linguagem já existente — **REPROVOU, corrigido**

O jogo já tem um código de cor definido em `:13098` e `:13202`:

| cor | significado no jogo | onde |
|---|---|---|
| `#45df79` verde | GOL | cena de pênalti e de falta |
| `#ff5d78` vermelho | **DEFENDEU** (defesa do goleiro) | idem |
| `#e5ebf4` branco neutro | **PARA FORA** | idem |

A primeira versão desta camada pintou "PRA FORA" de `#ff5d78`. Nesse
vocabulário, isso quer dizer *defesa do goleiro*. **Colisão semântica direta com
uma convenção que o próprio jogo estabeleceu.**

**Corrigido:** o veredito de fora usa `#e5ebf4`; o de gol segue `#45df79`.

## 2. Acessibilidade de cor — **REPROVOU por tabela, resolvido junto**

O par original verde/vermelho é exatamente o eixo que a deuteranopia e a
protanopia colapsam (~8% dos homens). Como o veredito na linha era carregado
**só** pela cor, a informação sumia para essa fatia.

**Corrigido pela mesma mudança:** o par passou a ser verde × branco neutro, que
separa por **luminância** e não por matiz. Além disso a informação agora tem
canal redundante — texto ("FORA · raspando o poste"), a posição da bola em
relação à trave desenhada, e a rede estufando no gol.

## 3. Hierarquia visual — **REPROVOU, redesenhado**

A primeira versão usava letreiro `Anton 34px` no topo da tela. Isso dá a um
chute para fora o **mesmo peso visual de um gol**, que é o evento mais
importante do jogo e já tem letreiro de tela cheia.

**Corrigido:** o "fora" virou uma **pílula de 17px ancorada no lance**; o
letreiro de tela cheia fica reservado ao gol. Nível de ênfase proporcional à
importância do evento.

## 4. Colisão de layout — **REPROVOU, medido no navegador**

Medida real do DOM sobre o canvas durante a partida:

```
CANVAS #fieldcv ............. 890 x 487 CSS
DIV #cds-sp (HUD de bola parada, z-index 9999)
    top 14 px, left 371, largura 504, altura 27
```

O letreiro estava em `y = 44` lógico ≈ 38 px CSS, com ~30 px de altura — ou
seja, **atravessando a faixa 14–41 px ocupada pelo HUD**, que está por cima
(z-index 9999).

**Corrigido:** o desenho tem clamp explícito `py >= 52 + h/2`, com o número e o
motivo comentados no código.

## 5. Posicionamento em relação ao objeto de interesse — **REPROVOU, corrigido**

A segunda versão ancorava a pílula 46 px **acima** do ponto de cruzamento. Isso
a coloca em cima da **boca do gol e do travessão** — precisamente a região que o
usuário precisa enxergar para julgar se entrou ou saiu. A legenda cobria o
assunto da legenda.

**Corrigido:** a pílula sai para o **lado do campo** (`paraDentro = atRight ? -1
: 1`), a 34 px da âncora, e sobe 62 px para não disputar espaço com o goleiro e
a zaga, que ficam logo abaixo da linha. Uma **linha de chamada** liga a pílula
ao ponto exato de cruzamento — é o que a torna legenda e não aviso solto
(princípio de conexão da Gestalt).

## 6. Tipografia estável sob zoom de câmera — **REPROVARIA, prevenido**

A câmera de TV aplica zoom de 1,30 a 1,35 (`camBaseZoom()`), e em panorâmica
converge para 1,0. Texto desenhado **dentro** da transformação mudaria de corpo
conforme a lente — o mesmo rótulo apareceria com tamanhos diferentes na mesma
partida.

**Prevenido:** o ponto do mundo é projetado à mão por `_camView = {z, cpx, cpy}`
e o texto é desenhado **depois** de `ctx.restore()`. Corpo fixo em qualquer
lente. As famílias usadas (`Barlow Condensed`, `Anton`) e o fundo da pílula
`rgba(4,8,18,.82)` são os mesmos dos rótulos de nome de jogador (`:13965`).

## 7. Uma mensagem por evento — **REPROVOU, corrigido**

A camada armava o veredito também no `pen_miss`. Mas o pênalti roda em cena
dedicada (`penScene`), que já resolve o desfecho com o próprio "PARA FORA!" —
e `paintField` retorna cedo enquanto ela está no ar.

**Corrigido:** o pênalti não arma mais o veredito, com o motivo escrito no
código. Dois vereditos para o mesmo evento é ruído, não reforço.

## 8. Ordem de empilhamento — o defeito de origem

Não é preferência, é o defeito: o palco 2.5D (gramado, linhas, **gols**) é
pré-renderizado uma vez e é o **primeiro** desenho de cada quadro. A bola vem
depois. Logo, uma bola dentro da rede era desenhada **por cima do gol** — e
lia-se como "bola parada na boca da área".

**Corrigido:** a mesma geometria do gol é redesenhada **depois** da bola, com a
malha translúcida (alpha 0,30) e a moldura opaca. A bola que cruzou fica atrás
da rede, que é onde o olho a procura.

## 9. Movimento — custo declarado

O desfecho do chute para fora durava **0,12 s de relógio de parede** (0,217 s de
simulação a 1,8×). Nenhum ser humano lê isso. A camada usa a mesma alavanca de
câmera lenta que o jogo já tem em `:12507` — que reduz o passo da
**apresentação**, não o da simulação.

Custo declarado: ~0,80 s de relógio de parede por chute para fora, ~13 por
partida ⇒ **~10 s numa partida de ~384 s no 2X, ou +2,7%**. A OS-78 comprou
35,7% de andamento; isto devolve 2,7% exatamente no evento sobre o qual o dono
reclamou. É uma troca, e está declarada como troca.

---

## O que esta validação NÃO cobriu

- **Retrato de celular.** `camBaseZoom()` devolve 1,22 e o canvas lógico continua
  1024×500, então os clamps valem; mas eu não capturei quadros em retrato.
- **Contraste medido em número (WCAG).** Avaliei por convenção do próprio jogo e
  por luminância, não com medição formal de razão de contraste.
- **Leitura por usuário real.** Não houve teste com pessoa.
