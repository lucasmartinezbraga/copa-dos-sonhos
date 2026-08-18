# Monitor do catálogo da ABECMED

Verifica de tempos em tempos o que a ABECMED tem disponível em **flores** e
**concentrados**, compara com a consulta anterior e manda uma notificação no
celular quando alguma coisa muda.

Roda inteiro dentro do GitHub Actions: nenhum computador precisa ficar ligado,
nenhuma página aberta, nada para executar na mão.

## Como funciona

O assistente em `https://bot.abecmed.com.br` é um [Typebot](https://typebot.io).
O widget do navegador conversa com o servidor por uma API JSON pública, e é
essa API que o monitor usa — sem Chromium, sem Playwright. Uma verificação leva
cerca de 5 segundos.

O caminho percorrido é o mesmo que uma pessoa faria:

```
startChat  →  "Sou Paciente"  →  CPF  →  "Estou ciente"  →  menu
           →  "Quero adquirir flores!"        →  lê a lista
           →  "VOLTAR"
           →  "Quero adquirir concentrados!"  →  "Estou ciente!"  →  lê a lista
```

**O monitor para na listagem.** Ele nunca escolhe quantidade nem confirma
pedido: `INTENCOES_PERMITIDAS` no `monitor.py` é uma allowlist com cinco
rótulos (`Sou Paciente`, `Estou ciente`, `flores`, `concentrados`, `VOLTAR`), e
qualquer botão fora dela faz o script abortar em vez de clicar em algo
desconhecido. Um clique errado aqui viraria um pedido real.

## Arquivos

| arquivo | o que é |
| --- | --- |
| `monitor.py` | consulta, compara e notifica |
| `test_monitor.py` | testes do parser e da comparação, sobre texto real do site |
| `state.json` | catálogo da última consulta, fichas dos produtos e histórico de preços |
| `../.github/workflows/abecmed-monitor.yml` | o agendamento |

O `state.json` é commitado pelo próprio workflow quando o catálogo muda, então
`git log abecmed-monitor/state.json` acaba virando o histórico de preços e
disponibilidade da associação.

## O que chega no celular

```
🚨 ABECMED — o catálogo mudou
🕐 18/08/2026 19:30 (Brasília)

O que mudou
🆕 🌿 Flores — Gelato (indoor): R$ 100,00
💰 🌿 Flores — Papaya (indoor): R$ 85,00 → R$ 95,00
❌ 🍯 Concentrados — Extrato Água e Gelo Indoor #3 saiu do catálogo

🌿 Flores disponíveis — limite mensal para flores é de 15 gramas
THC
• Chemdawg (indoor) — R$ 85,00
...

🍯 Concentrados disponíveis — limite mensal para concentrados é de 5 gramas
THC
• Extrato Live Rosin — R$ 350,00
...
```

Toda notificação leva o catálogo completo junto, não só o que mudou.

## Fichas: THC, genética, terpenos e foto

Um nível abaixo da listagem, cada produto tem ficha com foto, teor de THC e
(nas flores) genética e terpenos. O monitor lê essa ficha **uma vez por
produto** e guarda: em regime normal a verificação de 5 em 5 minutos continua
custando as mesmas requisições de antes, porque ficha só é buscada quando
aparece produto que ainda não tem.

Ler uma ficha custa três idas ao servidor, então há teto de 6 por rodada — o
resto entra nas rodadas seguintes.

A URL da foto que a ABECMED entrega é assinada e expira em ~40 minutos, então
ela não é guardada. O que fica no estado é o `file_id` que o Telegram devolve
no primeiro envio, e esse não expira: da segunda vez em diante a foto sai sem
tocar no servidor deles.

O caminho da ficha é o único lugar do fluxo onde existe um botão **Continuar**,
que leva a montar pedido. A saída é sempre pelo **Voltar**, e se o Voltar não
estiver lá a consulta aborta em vez de improvisar.

## Botões no Telegram

A conversa tem um teclado fixo com **💡 O que usar hoje?**, **🌿 Ver catálogo
agora**, **📸 Fotos e THC** e **📊 Status**, e o menu de comandos traz `/guia`,
`/catalogo`, `/fotos`, `/status` e `/ajuda`.

**A resposta é imediata.** Não existe servidor ligado — quem escuta é a própria
execução agendada: depois de verificar o catálogo, ela fica pendurada no *long
polling* do Telegram (`getUpdates?timeout=25`) até a rodada seguinte começar. A
chamada dorme enquanto não chega nada e retorna no instante em que a mensagem
chega, então o toque no botão é atendido em segundos.

Isso não gera nenhuma requisição a mais para a ABECMED: a janela de escuta só
conversa com o Telegram. O que ela consome é tempo de runner, que é gratuito e
ilimitado em repositório público.

A janela está em 240 s (`ESCUTA` no workflow). Vale saber que isso usa o
Actions mais como processo de plantão do que como CI — se preferir ser
conservador, baixar `ESCUTA` para `0` volta ao comportamento de responder só na
rodada seguinte.

Só o dono recebe resposta. O bot é público — qualquer um acha `@abecmed_bot` e
pode mandar mensagem —, então as mensagens de outros chats são consumidas e
ignoradas.

## Sugestão por atividade

O botão **💡 O que usar hoje?** responde qual produto combina com dormir,
trabalhar, treinar, criar, aliviar o corpo ou acalmar — e aceita texto livre
(*"vou treinar"*, *"preciso dormir"*, *"dor nas costas"*).

Não é um modelo de linguagem. É um casamento entre a atividade e o que a
própria ABECMED publica na ficha: terpenos, proporção índica/sativa e teor de
THC. A vantagem de não usar LLM aqui não é só o custo — a resposta sai sempre
do dado real da ficha, então não há como inventar um terpeno que o produto não
tem, nem recomendar produto fora de estoque.

Os pesos estão em `PERFIS`, no `monitor.py`. O eixo índica/sativa pesa mais que
os terpenos porque é o sinal mais forte para dia/noite; os terpenos afinam.
Sem esse ajuste, uma flor 55% índica ganhava de uma 80% índica na sugestão de
dormir.

As associações entre terpeno e efeito são as descritas na literatura de
cannabis e são **gerais**. Toda resposta diz, junto, que isso não é orientação
médica e que quem decide é o prescritor.

## Secrets

Configurados em **Settings → Secrets and variables → Actions**:

| Secret | obrigatório | para quê |
| --- | --- | --- |
| `ABECMED_CONFIG` | um deles | CPF e token juntos, separados por `\|` — cadastro único |
| `ABECMED_CPF` | um deles | CPF do paciente, usado para entrar no assistente |
| `TELEGRAM_BOT_TOKEN` | um deles | token do bot que manda a notificação |
| `TELEGRAM_CHAT_ID` | não | descoberto sozinho no primeiro envio |
| `NTFY_TOPIC` | não | canal alternativo via [ntfy.sh](https://ntfy.sh) |

Criar Secret é a única coisa deste projeto que o dono do repositório tem de
fazer à mão: o token de um agente não recebe permissão de escrever Secrets, de
propósito. Por isso existe o `ABECMED_CONFIG`, que junta as duas credenciais em
um cadastro só. Com ele o monitor separa as partes e mascara cada uma no log
(`::add-mask::`), já que o GitHub só mascara o valor exato do Secret.

O CPF só existe como Secret. Ele não aparece no código, e o GitHub mascara
Secrets na saída dos jobs — nada de dado pessoal fica visível neste
repositório, que é público.

## Frequência

O agendamento está em `*/5 * * * *` (cinco minutos, o mínimo que o cron do
GitHub aceita). O agendador é "melhor esforço": em horário de pico a fila
atrasa alguns minutos ou pula uma rodada.

Cinco minutos são ~288 verificações por dia. Cada uma abre uma sessão nova no
Typebot da ABECMED, e sessões contam como atendimento no painel deles. Se
preferir pegar mais leve com o servidor da associação, troque para `*/15` ou
`*/30` no workflow — é uma linha só, e para reposição de estoque continua de
sobra.

## Quando algo quebra

Falha isolada (site fora do ar, timeout) não vira alarme nem e-mail: o monitor
conta falhas seguidas no `state.json`. Na sexta seguida ele manda **uma**
notificação avisando que parou de funcionar, e outra quando voltar ao normal.

Para testar sem esperar mudança de catálogo: aba **Actions → Monitor ABECMED →
Run workflow**, com `forcar` marcado. Ele consulta e manda a notificação mesmo
que nada tenha mudado.

Localmente:

```bash
python3 abecmed-monitor/test_monitor.py               # testes, sem rede
ABECMED_CPF=... python3 abecmed-monitor/monitor.py --sem-estado   # consulta e imprime
```
