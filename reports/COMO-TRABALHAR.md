# COMO TRABALHAR NESTE CÓDIGO

Passo a passo, do zero até o commit. Se você seguir só este arquivo, não erra.

---

## 0 · Antes de tudo

```bash
bash tools/doutor.sh
```

Dezenove verificações. Se falhar, resolva antes de continuar — cada falha aqui
vira meia hora perdida depois.

---

## 1 · Escolha o que fazer

```bash
python3 tools/defeito.py --proximo
```

Ele lista o que está sem dependência pendente e recomenda um. Se quiser ver
tudo:

```bash
python3 tools/defeito.py --lista        # os 34
python3 tools/defeito.py --fase F6      # só os de uma fase
```

---

## 2 · Carregue o defeito

```bash
python3 tools/defeito.py D19
```

Devolve três coisas: a **ficha** (dono real, camadas que interceptam, evidência
medida, critério de aceite, dependências, risco), o **código como está agora**
localizado por âncora, e a **seção do relatório**.

> Não abra o relatório inteiro. São ~5.000 linhas e você vai gastar o contexto
> de que precisa para trabalhar.

---

## 3 · Descubra quem é o dono do método

```bash
node tools/fisica/pilha.js dist/index.html 14
```

**Esta é a regra que mais quebra trabalho aqui.** São 362 sobrescritas em 60
camadas empilhadas sobre `MatchSim.prototype`. Uma camada pode substituir um
método e **não chamar a de baixo** — nesse caso editar o motor não faz nada.
Já aconteceu **seis vezes**.

### E saiba o limite da ferramenta

`pilha.js` diz se o **método** é alcançado. **Não diz se a sua linha é.** Na
sexta vez ela respondeu VIVA e estava certa — o método rodava, a linha editada
não.

**Se o seu alvo é um ramo específico, meça aquele ramo antes de editar:**

```bash
node tools/fisica/ramos.js dist/index.html 12    # os ramos ja catalogados
```

Ou escreva uma sonda de ~40 linhas. Os modelos estão em `tools/fisica/`:
`ramo-d25.js`, `ramo-g20.js`, `ramo-rolagem.js`, `ramo-d02.js`.

**Custa 2 minutos e já economizou seis ciclos de 25 minutos.** Sete premissas
deste catálogo caíram por falta disso.

---

## 4 · Meça antes

```bash
bash tools/aceitar.sh --antes
```

Build, verify, validação de âncoras, balística, smoke em Chromium real e 300
partidas. Guarda em `reports/_aceitar-antes.json`.

---

## 5 · Edite

**`src/`, nunca `dist/`.** O `dist/index.html` é gerado; edição direta é apagada
no próximo build.

Se for criar uma camada nova:

1. arquivo em `src/scripts/layers/`
2. marcador `/*__CDS_BLOCK_N__*/` em `src/index.template.html`
3. registre em `manifests/build-manifest.json`
4. **publique contadores por ramo** — sem eles a camada é invisível, e foi
   assim que o D15 ficou anos sem poder ser medido

Cuidado com escopo: `facet`, `chance`, `R`, `clamp`, `FL`, `FW`, `getAttr`,
`lerp`, `D` e `srand` são globais. **`CAL` não é** — use `ENGINE_CALIBRATION`.
O lint do `verify.py` reprova o build se você esquecer.

---

## 6 · Meça depois

```bash
bash tools/aceitar.sh --depois
```

Para mudanças que **não devem** mudar comportamento — apagar código morto,
promover método, extrair função:

```bash
bash tools/aceitar.sh --depois --identico
```

Exige as 14 métricas **idênticas ao dígito**. Se alguma mudar, a região que
você apagou não era morta.

### O critério

> Uma métrica **se moveu** quando |Δ| ≥ 2 × SE.
>
> **Mover 2 SE para pior uma métrica que você não declarou que ia mexer
> REPROVA a mudança** — mesmo que o alvo declarado tenha melhorado.

---

## 7 · Se mexeu em trajetória ou movimentação

A bateria roda em `vm.runInThisContext` e **não desenha nada**. A bola quicando
54 vezes por minuto de jogo atravessou uma versão inteira sem aparecer em
métrica nenhuma.

```bash
node tools/fisica/tela/pinga.js dist/index.html 60    # trajetoria
node tools/fisica/tela/forma.js dist/index.html 90    # movimentacao
node tools/fisica/narrar.js dist/index.html           # leia a partida
```

---

## 8 · Commit

**Não faça commit se o `aceitar.sh` reprovar.** Se ele reprovar e o movimento
era o **objetivo declarado** da sua mudança, diga isso no commit — mas não
esconda e não chame de sucesso.

---

## 9 · Se foi aceito, promova a referência

```bash
bash tools/aceitar.sh --fixar
```

Só depois do aceite. A referência **tem** de corresponder ao build atual — ela
já esteve errada uma vez (medida com `XG_ESCALA = 0,70` e commitada junto com a
mudança para `0,651`) e passou a reprovar mudanças inocentes.

---

## 10 · Atualize o catálogo e veja se está dando resultado

```bash
python3 tools/defeitos.py            # revalida os enderecos
python3 tools/monitorar.py --html    # a trajetoria de cada metrica
python3 tools/conhecimento.py        # regrava a base de conhecimento
```

O painel responde a pergunta que importa: **isto está dando resultado?** Uma
métrica marcada **PARADA** há várias medições não precisa de outra tentativa do
mesmo tipo. Precisa de outro diagnóstico.

---

## O ciclo inteiro, para copiar

```bash
bash tools/doutor.sh
python3 tools/defeito.py --proximo
python3 tools/defeito.py <ID>
node tools/fisica/pilha.js dist/index.html 14
# se o alvo e um ramo especifico: escreva/rode a sonda de ramo
bash tools/aceitar.sh --antes
#   ... edite src/ ...
bash tools/aceitar.sh --depois
node tools/fisica/tela/pinga.js dist/index.html 60     # se mexeu em trajetoria
git add -A && git commit
bash tools/aceitar.sh --fixar
python3 tools/defeitos.py && python3 tools/monitorar.py --html
```

---

## Escreva como o projeto escreve

Marque toda afirmação:

- `[LIDO]` — li o código
- `[MEDIDO]` — rodei e contei
- `[HIPÓTESE]` — inferência, pode estar errada

**Resultado negativo é resultado.** Sete premissas deste catálogo foram
refutadas pela medição e estão documentadas com o mesmo cuidado das que deram
certo. Se a sua medição contrariar o documento, **escreva isso** — não ajuste a
conclusão para caber na hipótese.
