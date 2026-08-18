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
| `state.json` | catálogo da última consulta — é com ele que a próxima compara |
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

## Secrets

Configurados em **Settings → Secrets and variables → Actions**:

| Secret | obrigatório | para quê |
| --- | --- | --- |
| `ABECMED_CPF` | sim | CPF do paciente, usado para entrar no assistente |
| `TELEGRAM_BOT_TOKEN` | sim | token do bot que manda a notificação |
| `TELEGRAM_CHAT_ID` | não | descoberto sozinho no primeiro envio |
| `NTFY_TOPIC` | não | canal alternativo via [ntfy.sh](https://ntfy.sh) |

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
