# Como me ajudar a diagnosticar

Escrito a partir do que deu certo e do que deu errado nesta auditoria. Não é
teoria: cada item abaixo tem um caso real desta sessão atrás dele.

---

## 1. O que vale ouro: um caso reproduzível

A diferença entre um relato e um diagnóstico é a **reprodução**.

**Relato:** "às vezes a bola trava e o jogo fica parado."
Com isso eu chuto. Chutei três vezes na marcação e errei três.

**Reprodução:** "seed 870000, 4-1-4-1 contra 4-3-1-2, por volta dos 71 minutos."
Com isso eu instrumentei o tick exato e achei `decideT` congelado em 0.10 —
causa raiz em uma tarde.

### O que capturar quando algo parece errado

| campo | por quê |
|---|---|
| **seed** | sem ela não reproduzo; com ela, rodo 40 vezes |
| **minuto aproximado** | corta 90 minutos para 2 |
| **formações e estilos dos dois times** | metade dos defeitos só aparece em combinação |
| **o que você ESPERAVA ver** | às vezes o motor está certo e a expectativa é que muda |
| **o que viu** | descreva o comportamento, não a causa |
| **print ou vídeo curto** | vale mais que parágrafo, principalmente em coisa visual |

### O que NÃO precisa fazer

Não tente adivinhar a causa. "Acho que é a física da bola" me enviesa e eu
posso perseguir sua hipótese em vez de medir. Descreva o **sintoma**; a causa é
meu trabalho.

---

## 2. Perguntas que me deixam mais afiado

Estas cinco perguntas teriam economizado horas nesta sessão. Use sem dó.

### "Isso é medido ou suposto?"

A pergunta mais valiosa de todas. Eu misturo os dois quando não tomo cuidado.

Caso real: afirmei que a marcação regrediu porque "o marcador perde a
referência com o jogo mais rápido". Era **suposição**. Quando medi,
`markerMeanDistance` estava inerte em 8,22 — o rastreio nunca foi o problema.

### "Como você sabe?"

Força a cadeia de evidência. Se a resposta for "faz sentido" ou "geralmente é
assim", ainda não é diagnóstico.

### "Você testou o contrário?"

Caso real: só descobri que o contraste era falso positivo porque fui checar se
os elementos reprovados tinham gradiente. Tinham. Se eu tivesse reportado sem
checar, você caçaria três defeitos inexistentes.

### "Qual número mudaria se você estivesse errado?"

Obriga a definir a falsificação **antes** de rodar. Foi o que finalmente
resolveu a marcação: se a cadência fosse a causa, desacelerar 50% teria
reduzido os passes. Não reduziu (188,3 → 187,9). Hipótese morta, com número.

### "Esse teste pegaria o defeito se ele existisse?"

Teste que nunca falha não é teste. Eu valido os meus por **mutação**: quebro o
código de propósito e confiro se o teste acusa. Os 29 cenários de animação
pegaram 3 de 3 mutantes. Pode me cobrar isso.

---

## 3. Sinais de alerta no que eu escrevo

Quando eu usar estas palavras, desconfie e pergunte:

- **"provavelmente", "deve ser", "a causa provável"** → é hipótese, não achado.
- **"corrigido"** sem número antes/depois → não aceite. Todo conserto meu
  deveria vir com medição dos dois lados.
- **"o teste passou"** sem dizer o que ele mediria se falhasse.
- **"quase passa"** (ex.: 70,4% contra exigência de 70%) → margem apertada é
  frágil. Peça o número exato e pergunte quanto ele oscila entre amostras.
- **silêncio sobre o custo** → quase todo conserto cobra algo. Se eu não
  mencionar o custo, pergunte qual foi.

---

## 4. Como reportar um defeito visual (o mais difícil)

Coisa visual é onde eu sou mais cego — não enxergo a tela como você. O que
mais ajuda:

1. **Vídeo de 5 a 10 segundos** com o problema acontecendo.
2. **Momento exato**: "aos 3 segundos, o jogador de azul".
3. **O que deveria acontecer**: "o pé deveria tocar a bola antes dela sair".
4. Se souber, **a seed** — aí eu reproduzo no motor e comparo com o render.

Formato pronto:

```
SEED:        870000
MINUTO:      71
FORMAÇÕES:   4-1-4-1 (press) x 4-3-1-2 (park)
ESPERADO:    o atacante chuta e a bola sai no contato do pé
OBSERVADO:   a bola sai antes, o chute acontece no vazio
EVIDÊNCIA:   video.mp4, aos 0:04
```

---

## 5. Usando o kit humano de forma útil

`reports/r14/kit-humano/` — marque `[x]` passou, `[!]` falhou, `[?]` não deu.

**`[!]` vale mais que `[x]`.** Um PASS confirma o que eu já esperava; um FAIL me
dá trabalho novo e direção. Não force `[x]` para "ajudar o número" — auditoria
com item aprovado sem observação real não vale nada, e eu prefiro 20 itens
honestos a 200 carimbados.

Se marcar `[!]`, escreva uma linha embaixo dizendo o que viu. Isso vira minha
reprodução.

**Comece por `02-aparelho-fisico.txt`**: 35 controles, ~20 minutos, e fecha um
domínio que nenhuma emulação minha pode fechar.

---

## 6. Quando me mandar parar

Me interrompa se perceber:

- **duas tentativas seguidas sem mover a métrica-alvo** → estou chutando;
  peça o experimento que *decide* em vez de mais um conserto;
- **eu mexendo no limite do teste em vez do comportamento** → quase sempre
  errado;
- **conserto sem antes/depois** → provavelmente não medi;
- **eu escalando o escopo sem terminar o anterior** → peça para fechar um.

---

## 7. O erro meu mais caro desta sessão, para você reconhecer o padrão

Passei **três tentativas** consertando a marcação. Todas falharam. Todas
custaram gols. Todas foram revertidas.

O padrão que eu deveria ter visto na primeira: a métrica-alvo (`cobertura`) não
se mexeu — 0,704 → 0,703 → 0,709 → 0,702. Quando a variável que você mexe não
move o número que você quer mover, **a hipótese está errada**, não a dose.

Quando me vir ajustando a dose de algo que não reagiu, diga: *"você já tentou
isso e não mexeu — mede outra coisa."*
