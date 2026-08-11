# LEIA PRIMEIRO — briefing para quem (ou o que) vai trabalhar neste código

**Duas páginas. Leia inteiras antes de abrir qualquer arquivo.**

Se você é uma IA e alguém te mandou `INVESTIGACAO-COMPLETA-2026-08.md`:
**não leia as 107 páginas.** São ~31 mil palavras e você vai gastar contexto que
precisa para trabalhar. O caminho é:

```bash
python3 tools/defeito.py --proximo     # o que fazer agora
python3 tools/defeito.py D25           # a ficha, o CODIGO ATUAL e so a secao relevante
```

Leia este arquivo inteiro (2 páginas), depois carregue **só** o defeito em que
você vai trabalhar. O documento completo é referência, não leitura de entrada.

---

## 1. As quatro regras que não se negociam

### Regra 1 · Descubra quem é o dono do método ANTES de editar

> **E saiba o limite da ferramenta.** `pilha.js` responde se o **método** é
> alcançado, não se **uma linha dentro dele** é. Foi assim que o D25 virou a
> sexta edição do motor sem efeito: as quatro sobrescritas de `_ballTravel`
> eram VIVAS — corretamente — e mesmo assim a linha editada nunca executava.
> Quando o alvo é uma linha específica, instrumente aquela linha. A sonda
> `tools/fisica/ramo-d25.js` é o modelo: 40 linhas, resposta em 2 minutos.

```bash
node tools/fisica/pilha.js dist/index.html 14
```

Este projeto tem **362 sobrescritas de método** espalhadas por **60 arquivos de
camada**, empilhadas sobre `MatchSim.prototype`. Uma camada pode substituir um
método **sem chamar a versão de baixo**. Quando isso acontece, o código do core
não roda — e editá-lo não faz nada.

**Isso já aconteceu cinco vezes**, com custo de uma rodada de medição cada:

| o que foi editado | quem interceptava |
|---|---|
| arrasto da R13 | consumidor no mesmo quadro |
| `if (p === presser)` em `_defendTarget` | camada 17 responde por todos os ramos |
| `b.z = 0.12` "decorativo" | virou física quando o integrador ligou |
| `_looseBall` | camada 08 converte em desvio e **não chama o core** |
| `decideT` | camada 17 reescreve todo quadro |

Nas duas últimas a ferramenta já existia e não foi usada. **Não seja a sexta.**

O campo `dono` de cada defeito em `reports/defeitos.json` já diz onde editar.
Confirme mesmo assim: o documento pode ter envelhecido, a `pilha.js` não.

### Regra 2 · Edite `src/`, nunca `dist/`

`dist/index.html` é gerado por `python3 tools/build.py`. Qualquer edição direta
ali é apagada no próximo build.

### Regra 3 · Meça antes e depois, sempre

```bash
bash tools/aceitar.sh --antes      # antes de editar
# ... edite src/ ...
bash tools/aceitar.sh --depois     # constroi, testa, mede e compara
```

Para mudanças que **não devem** mudar comportamento (apagar código morto,
promover um método, extrair uma função):

```bash
bash tools/aceitar.sh --depois --identico
```

Ele exige as 14 métricas **idênticas ao dígito**. Se alguma mudar, a região que
você apagou não era morta.

### Regra 4 · A bateria não vê a tela

`tools/fisica/bateria.js` roda em `vm.runInThisContext` e **não desenha nada**.
A bola quicando 54 vezes por minuto de jogo atravessou uma versão inteira sem
aparecer em nenhuma das 14 métricas.

- mexeu em **trajetória** → `node tools/fisica/tela/pinga.js dist/index.html 60`
- mexeu em **movimentação** → `node tools/fisica/tela/forma.js dist/index.html 90`
- mexeu em **qualquer coisa** → `node tests/browser_smoke.js` (é o único teste
  que prova que o jogo sobe num navegador de verdade)

---

## 2. O critério de aceite

> Uma métrica **se moveu** quando |Δ| ≥ 2 × SE, com SE = desvio/√n.

E a regra que já reprovou uma mudança minha:

> **Mover 2 SE para pior uma métrica que você não declarou que ia mexer reprova
> a mudança** — mesmo que o alvo declarado tenha melhorado.

`tools/comparar.py` aplica isso automaticamente. Se ele reprovar e o movimento
era o **objetivo** da sua mudança, registre isso no commit e siga. O ponto não
é travar: é que ninguém descubra depois.

---

## 3. Como carregar um defeito (o comando que substitui a leitura)

```bash
python3 tools/defeito.py --proximo     # o que fazer agora, sem dependencia pendente
python3 tools/defeito.py --lista       # os 34, uma linha cada
python3 tools/defeito.py --fase F1     # so os de uma fase
python3 tools/defeito.py D08           # UM defeito, completo
python3 tools/defeito.py D08 --so-codigo
```

`tools/defeito.py D08` devolve três coisas de uma vez:

1. **a ficha** — dono real, camadas que interceptam, evidência medida, critério
   de aceite, dependências, risco;
2. **o código como ele está agora**, localizado por âncora e não por número de
   linha — com aviso explícito se o código andou desde que o texto foi escrito;
3. **a seção do documento**, extraída por intervalo de linhas.

É por isso que você não precisa abrir as 4.900 linhas.

## 4. Como usar `reports/defeitos.json`

```bash
python3 tools/defeitos.py          # valida as ancoras e regrava o indice
python3 tools/defeitos.py --check  # so valida (roda dentro do aceitar.sh)
```

Cada defeito tem:

| campo | para que serve |
|---|---|
| `id`, `titulo`, `sev` | identificação |
| `locais[].arquivo` + `ancora` | **onde**, de forma que não envelhece |
| `locais[].linha_atual` | recalculado a cada `defeitos.py`, confie neste |
| `locais[].linha` | onde estava quando o documento foi escrito |
| `dono` | **quem realmente executa** — leia antes de editar |
| `intercepta` | as camadas que rodam por cima |
| `evidencia` | o número medido que sustenta o defeito |
| `criterio` | o que precisa acontecer para a mudança ser aceita |
| `depende` | o que tem de estar pronto antes |
| `risco` | o que pode quebrar |

**As âncoras são a parte importante.** Número de linha envelhece na primeira
edição do motor; a âncora é um trecho literal do código que aparece **exatamente
uma vez** no arquivo. `tools/defeitos.py` **falha** se alguma deixar de ser
única — o envelhecimento do catálogo vira erro de build em vez de bug
silencioso.

> Isso já pegou um erro meu: o documento afirmava que `_planPhysicalSegment`,
> `_trajectoryPoint` e `_physicalTargetZ` eram versões mortas **no core**. Não
> são: nunca existiram no core. Nascem na camada 07 e são substituídos pela 88.
> A validação de âncora encontrou isso em segundos.

---

## 5. Por onde começar

A ordem está em `defeitos.json` no campo `fase`, e o raciocínio completo no
Volume V do documento. O resumo:

| fase | o que é | comece por |
|---|---|---|
| **F0** | pôr a medição no caminho do commit | já feito: `tools/aceitar.sh` |
| **F1** | consertos localizados, risco baixo | **D25** (uma linha), depois D03, D04, D32, D01, D02 |
| **F2** | o orçamento de laterais | D12 → D08 → D29 |
| **F3** | matar os três sorteios censurados | D13 → D11 |
| **F4** | cada contenção vira asserção | D14 (uma camada por commit) |
| **F5** | promover os donos terminais | D17 (um método por commit) |
| **F6** | o futebol que sobra | D19, depois D20 — **nunca juntos** |

> **F1 já foi executada.** D03, D04, D25, D28 e D32 estão feitos. Rode
> `python3 tools/defeito.py --proximo` para o estado atual — os próximos sem
> dependência pendente são **D01** (uma física só) e **D02** (teto de disputa,
> risco alto).

**O que a execução da F1 ensinou, e vale antes de você começar:**

- **D25 não moveu nada.** A exceção que ele removia era inócua — a sonda mostrou
  que a linha editada nem é alcançada. **A hipótese central de D08 precisa ser
  revista**, e a limpeza do D03 reforçou isso: um dos pontos de chamada que o
  D08 citava como evidência estava dentro de código morto.
- **D32 pegou um defeito vivo no primeiro lint:** uma camada lia a calibração
  por um caminho que nunca acerta e caía num número congelado.
- **A referência de medição estava errada** e reprovava mudanças inocentes.
  Confira que `reports/REFERENCIA.json` corresponde ao build atual antes de
  confiar num `--identico`.

---

## 6. Três coisas que este projeto aprendeu do jeito caro

**Número decorativo vira número físico quando o integrador liga.** `b.z = 0.12`
existiu por versões só para desenhar a bola acima do gramado. No dia em que a
integração numérica entrou, virou altura inicial real e o passe rasteiro passou
a quicar. Todo campo que hoje existe "só para desenhar" é um defeito futuro.

**Quando aumentar um recurso piora o resultado, o modelo está usando o recurso
do jeito errado.** Subir a envergadura do goleiro de 1,05 para 1,45 **piorou** o
jogo. Esse resultado invertido é que revelou a causa real: ele mergulhava no
primeiro instante alcançável, não no melhor. O conserto foi uma linha, em outro
lugar.

**Resultado negativo é resultado.** Duas das quatro tentativas desta série foram
revertidas, e as duas estão documentadas com o mesmo cuidado das que deram
certo (Volume VII). Uma taxa de acerto de 50% é saudável quando se mede; o
perigo é a taxa de 100% de quem não mede.

---

## 7. O que este projeto ainda não sabe sobre si mesmo

Leia antes de afirmar qualquer coisa sobre estas áreas:

- **Bola parada não foi lida.** `_freeKick`, `_penalty`, `_setCorner` e mais de
  1.000 linhas de camadas de reinício. Maior mancha cega.
- **A IA de treinador não foi lida.** ~1.100 linhas, 21% do arquivo do motor.
- **O desenho foi lido a 10%.** As recomendações de tela são as menos
  fundamentadas do documento.
- **11 hipóteses estão abertas** e listadas na seção 8.5 do documento. Elas
  estão marcadas `[HIPÓTESE]` e não devem ser citadas como fato.

O documento marca toda afirmação com `[LIDO]`, `[MEDIDO]` ou `[HIPÓTESE]`.
**Mantenha essa convenção** em qualquer coisa que você acrescentar.

---

## 8. O ciclo completo, para copiar e colar

```bash
# 0. quem e o dono do metodo que voce vai editar?
node tools/fisica/pilha.js dist/index.html 14

# 1. medicao ANTES
bash tools/aceitar.sh --antes

# 2. edite src/  (NUNCA dist/)

# 3. medicao DEPOIS + build + testes + os dois placares, num comando
bash tools/aceitar.sh --depois

# 4. se mexeu em trajetoria ou movimentacao
node tools/fisica/tela/pinga.js dist/index.html 60
node tools/fisica/tela/forma.js dist/index.html 90

# 5. so entao
git add -A && git commit

# 6. se a mudanca foi ACEITA, promova a nova base
bash tools/aceitar.sh --fixar
```

---

**Documento completo:** `reports/INVESTIGACAO-COMPLETA-2026-08.md`
**Índice legível por máquina:** `reports/defeitos.json`
**Build da análise:** `ff808761f579765613f0a13fdab1112a9ab335837300fbd61e2f92e6c8c95e7e`
**Placar na análise:** design 12/13 · futebol real 15/21
