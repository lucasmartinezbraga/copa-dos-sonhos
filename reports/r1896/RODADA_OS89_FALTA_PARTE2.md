# RODADA OS-89 · a falta, segunda parte

Continuação de `RODADA_OS87_OS88_FALTA.md`. Fecha os itens que eu tinha deixado
abertos — e **derruba duas afirmações minhas** e **uma correção minha**.

---

## 1. Duas coisas que eu tinha escrito e estavam erradas

### 1.1 "A rotina curta nunca acontece — 0 de 60" · **FALSO, artefato do meu instrumento**

O censo anterior rodou no protocolo `espelho_30`: Brasil 1970 dos **dois** lados.
A decisão de rotina (`:6905`–`:6916`) depende de `aerialEdge`, a diferença entre
o melhor cabeceador do ataque e o melhor da defesa. Com times idênticos,
`aerialEdge ≡ 0`, então `aerialEdge > -5` é sempre verdadeiro e o ramo `short`
é inalcançável **por construção do meu protocolo**.

Medido com elencos diferentes, 12 partidas:

```
direct 49 | crossed 30 | short 9
aerialEdge: min -17,9 | p10 -12,0 | mediana 1,3 | p90 13,6 | max 19,0
             36,4% das cobranças abaixo de -5
```

A rotina curta acontece em ~10% das cobranças. **Não havia defeito.** Havia um
protocolo cego para esse ramo. Fica a lição: o espelho é ótimo para pareamento e
**inútil para qualquer decisão que dependa de diferença entre os times**.

### 1.2 "0 gol em 35 diretas, 54% de defesa" · o número certo era pior

`resolveFreeKickPhysics` é função **pura**: dá para amostrá-la sem simular. 50 000
amostras por cenário:

| batedor × goleiro | gol | defesa | barreira | fora |
|---|---:|---:|---:|---:|
| 90 × 75, 22 m | 4,17% | **64,0%** | 16,9% | 14,9% |
| 90 × 75, 28 m | 3,99% | **63,4%** | 18,1% | 14,5% |
| 75 × 75, 25 m | 3,13% | **64,5%** | 17,7% | 14,7% |
| 60 × 80, 30 m | 2,02% | **65,2%** | 18,3% | 14,5% |

Ver zero gol em 35 cobranças tinha **16,6%** de probabilidade — era amostra
pequena, não defeito. Mas a defesa era **64%**, não 54%.

---

## 2. OS-89A — a falta direta quase nunca ia para fora

### Mecanismo

```js
:2894  else result = chance(clamp(.58 + keeperSkill/220 - corner*.28, .28,.82))
                     ? 'save' : 'miss';
```

Com goleiro 75: `.58 + 75/220 = 0,921`. Menos `corner*.28` continua acima do teto
de `0,82` na maioria dos casos — **o clamp satura e o atributo do goleiro deixa
de importar**. Decompondo o total: `offTarget` ~13,8%, barreira ~18%, e do que
sobra praticamente **tudo** virava defesa.

É o padrão do HANDOFF §3 — "parâmetro que existe e não faz nada" — aqui por
saturação em vez de sobrescrita.

### Calibração, em duas medições

Referência real de falta direta em posição de chute: gol ~5–8%, barreira ~20%,
fora ~30–40%, defesa ~35–42%.

| tentativa | fórmula | fora | defesa |
|---|---|---:|---:|
| base | `.58 + k/220 - c*.28`, teto .82 | 14,9% | 64,0% |
| 1ª (**corrigiu demais**) | `.17 + k/300 - c*.20`, teto .60 | **50,5%** | 28,4% |
| **promovida** | `.35 + k/300 - c*.20`, teto .70 | **36,6%** | **42,3%** |

A primeira tentativa passou da referência para o outro lado. A segunda foi
calibrada **em cima do número medido**, não de palpite.

### Uma previsão minha que a medição derrubou

Eu registrei: *"gols de falta SOBEM de leve"*. **Estão idênticos** — 4,17% antes
e 4,17% depois. O sorteio de gol acontece **antes** da moeda defesa/fora
(`:2893` vem antes de `:2894`), então mexer nela não cria gol nenhum.

Fica aberto e registrado: **gol de falta direta em 2,0–4,2% contra ~5–8% reais**.
Não mexi, porque `pGoal` alimenta `stats.xg` diretamente e mudá-lo é outra
rodada, com outro gate.

---

## 3. OS-89B — a passada do cobrador

Depois da OS-87 o cobrador chega a 1,400 m da bola em 100% das cobranças, mas
batia **parado**. A passada faz o corpo avançar sobre a bola durante o contato.

Feita **no desenho, não na física**, seguindo o precedente que o próprio arquivo
estabelece em `:13837`: *"#anti-cardume (VISUAL) … Só no DESENHO — a posição real
(física) não muda"*. Deslocamento de ~1,4 m em 420 ms, num boneco desenhado com
~2,4 m de largura.

**Medido no navegador:** 1 de 1 cobrança direta com passada armada, vetor
`dx = −1,40 · dy = 0,03`, módulo **1,40 m** — exatamente a distância do cobrador
à bola, na direção da meta. Zero erros de página.

---

## 4. OS-89C — **falsificada e removida**

Eu ia limitar o empurrão da barreira, porque medi 1,14% dos passos acima de
0,2333 m por quadro.

**Esse teto estava errado.** Ele veio do `VMAX = 7` da OS-36, que é a velocidade
do **empurrão da barreira**, não a velocidade de corrida de um jogador. 0,35 m
num quadro de 1/30 s é **10,5 m/s** — sprint humano, não teleporte.

Previsão registrada: *"passosAcimaDoTeto cai a zero"*. Medido, em duas
tentativas:

| tentativa | acima do teto | máximo |
|---|---:|---:|
| base | 1,14% | 0,3275 m |
| capar só o clamp radial | 0,82% | 0,3094 m |
| orçamento único por quadro | **1,48%** | **0,3549 m** |

A segunda **piorou**, o que derruba também a minha hipótese de que as duas
escritas da OS-36 se somavam — o excesso vem da camada de movimento normal, que
roda antes. **Nenhuma das duas entrou na build.** O bloco fica no script de
patch, desativado, com os números que o derrubaram.

---

## 4b. OS-90 — o goleiro se posiciona para a falta

Último item da falta que eu ainda não tinha olhado. Medido em 58 cobranças
diretas, 12 partidas com elencos diferentes, lendo a posição do goleiro no
instante do chute:

| posição do goleiro | R18.90 |
|---|---:|
| do lado da **barreira** (errado) | **53 de 58 · 91,4%** |
| do lado **longo** (correto) | 1 de 58 · 1,7% |
| profundidade (distância à linha) | mediana **6,88 m** · p90 7,04 · máx 11,88 |

No futebol a barreira cobre o lado **curto** — e a OS-36 a arma exatamente
assim, sobre a linha bola → poste mais próximo (`:24842`). O goleiro cobre o
resto. Aqui ele ficava **atrás da própria barreira** em 91,4% das cobranças,
cobrindo o ângulo já coberto e deixando o lado longo inteiro aberto. E a 6,88 m
da linha, quando o goleiro real numa falta fica a 1,5–3 m.

### Não era bug — era contexto errado

`_goalkeeperTarget` (`:7190`) é escrito para **jogo corrido**, e ali deslocar-se
na direção da bola é o certo:

```js
:7197  let ty=clamp(FW/2+(b.y-FW/2)*(.22+pos/290),18,FW-18);
:7226  const _bis=goal.y+_dy/_L*depth;     // bissetriz bola->gol
:7196  let depth=3.8+quality*1.8;          // profundidade de bola em jogo
```

Numa falta **com barreira** isso se inverte. A correção sobrescreve o alvo
somente dentro da janela marcada por `__os36Guard` e **enquanto a bola ainda não
voou**; no quadro em que ela parte, o ramo de `:7236` assume e leva o goleiro ao
ponto de interceptação — essa lógica não foi tocada.

### Resultado

| | R18.90 | R18.91 |
|---|---:|---:|
| do lado longo (correto) | 1,7% | **72,7%** |
| atrás da barreira (errado) | 91,4% | **9,1%** |
| profundidade, mediana | 6,88 m | **3,91 m** (mín 2,21) |

Os 27% que não estão do lado longo são goleiros ainda **em trânsito** — o
deslocamento é físico, com passo limitado, e a janela de bola morta nem sempre
dá tempo. Não há teletransporte.

### Uma previsão minha que se inverteu, para melhor

Eu registrei: *"com o goleiro mais longe da trajetória, `_gkInterceptTarget`
pode devolver null e `:6961` converte save em miss — então defesa pode DESCER"*.

Subiu:

| desfecho realizado, 8 partidas | R18.90 | R18.91 |
|---|---:|---:|
| defesa | 30,6% | **39,5%** |
| fora | 52,8% | 44,2% |
| barreira | 16,7% | 16,3% |

E o motivo é o melhor possível. O modelo puro prevê **42,3%** de defesa, mas o
realizado era **30,6%**, porque `:6961` convertia defesa em fora quando o
goleiro não alcançava. Com ele posicionado, **plano e execução passaram a
concordar** (42,3% previsto contra 39,5% realizado). É o defeito estrutural do
HANDOFF §4 fechando por conta própria.

---

## 5. Estado final da falta

| item | R18.87 | R18.91 |
|---|---:|---:|
| cobrador → bola no chute | 9,162 m | **1,400 m** |
| espera apito → chute | 1,7 s constante | 1,7 → 4,1 s |
| passada sobre a bola | não existia | **1,40 m em 420 ms** |
| tempo de retina no contato | 0,12 s de parede | **~0,6 s** (slow-mo 700 ms) |
| goleiro do lado correto | 1,7% | **72,7%** |
| goleiro, distância à linha | 6,88 m | **3,91 m** |
| defesa (modelo puro) | 64,0% | **42,3%** |
| defesa (realizada em jogo) | — | **39,5%** |
| fora (modelo puro) | 14,9% | **36,6%** |
| barreira | 16,9% | 16,9% |
| gol | 4,17% | 4,17% |

### Continua aberto

- **gol de falta em 2,0–4,2% contra ~5–8% reais** — mexer em `pGoal` mexe no xG;
- **barreira em 17–18% contra ~20–25% reais** — `wallRisk` não foi tocado;
- **espera mediana de 2,5 s** é tempo morto, contra os 35,7% de andamento que a
  OS-78 comprou;
- o **goleiro** não se reposiciona de forma legível para a barreira e o ângulo;
- a cena dedicada `fk_scene` continua morta — **por decisão**, ver OS-55 em
  `:12564`.
