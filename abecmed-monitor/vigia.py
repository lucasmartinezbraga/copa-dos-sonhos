#!/usr/bin/env python3
"""Vigia do monitor: avisa quando o próprio monitor para de rodar.

O pior modo de falha deste projeto não é errar — é emudecer. Um monitor parado
é indistinguível de "nada mudou no catálogo", e foi exatamente isso que
aconteceu: o ciclo encerrava cedo por um defeito, o bot ficava horas fora do ar
e a única forma de descobrir era tocar num botão e não receber resposta.

Este script pergunta à API do GitHub quando foi a última execução bem-sucedida
do monitor. Se faz tempo demais, manda um alerta no Telegram.

Ele **não lê** mensagens do Telegram: dois leitores do mesmo bot brigam por
`getUpdates` e o Telegram devolve 409 para um deles. Aqui só se envia.

Sem estado próprio: os avisos saem quando a idade da última execução cruza uma
das faixas de ESCALA. Com o vigia rodando de hora em hora, cada faixa dispara
uma vez só, e um problema longo rende três avisos espaçados em vez de um por
hora.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo

    TZ = ZoneInfo("America/Sao_Paulo")
except Exception:  # pragma: no cover
    TZ = timezone(timedelta(hours=-3))

REPO = os.environ.get("GITHUB_REPOSITORY", "lucasmartinezbraga/copa-dos-sonhos")
WORKFLOW = "abecmed-monitor.yml"
ESTADO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "state.json")

# (limite em horas, como chamar) — a faixa vai deste limite até o próximo.
ESCALA = [(2, "⚠️"), (6, "🚨"), (24, "🚨🚨")]


def credenciais():
    """Aceita os Secrets separados ou o ABECMED_CONFIG combinado."""
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        for parte in re.split(r"[|\n;,\s]+", os.environ.get("ABECMED_CONFIG", "")):
            if ":" in parte.strip():
                token = parte.strip()
                break
    chat = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()
    if not chat:
        try:
            with open(ESTADO, encoding="utf-8") as f:
                chat = str(json.load(f).get("telegram_chat_id") or "")
        except Exception:
            chat = ""
    return token, chat


def ultima_execucao_boa():
    """Quando o monitor concluiu com sucesso pela última vez."""
    url = (
        f"https://api.github.com/repos/{REPO}/actions/workflows/{WORKFLOW}"
        "/runs?status=success&per_page=1"
    )
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {os.environ.get('GITHUB_TOKEN', '')}",
            "User-Agent": "abecmed-vigia/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        runs = json.loads(r.read().decode()).get("workflow_runs") or []
    if not runs:
        return None
    return datetime.fromisoformat(runs[0]["updated_at"].replace("Z", "+00:00"))


def faixa(horas):
    """A faixa que esta idade acabou de cruzar, se cruzou alguma."""
    for limite, marca in ESCALA:
        if limite <= horas < limite + 1:
            return limite, marca
    return None, None


def main():
    token, chat = credenciais()
    if not token or not chat:
        print("ERRO: sem token do Telegram ou sem chat conhecido.", file=sys.stderr)
        return 2

    try:
        ultima = ultima_execucao_boa()
    except Exception as e:
        print(f"ERRO: não consegui consultar a API do GitHub: {e}", file=sys.stderr)
        return 1

    agora = datetime.now(timezone.utc)
    if ultima is None:
        horas = 999.0
    else:
        horas = (agora - ultima).total_seconds() / 3600

    print(f"última execução bem-sucedida há {horas:.1f}h")

    limite, marca = faixa(horas)
    if limite is None:
        print("dentro do esperado — nada a avisar.")
        return 0

    quando = ultima.astimezone(TZ).strftime("%d/%m %H:%M") if ultima else "nunca"
    texto = (
        f"{marca} <b>Monitor parado</b>\n"
        f"🕐 {datetime.now(TZ).strftime('%d/%m/%Y %H:%M')} (Brasília)\n\n"
        f"A última verificação que deu certo foi <b>{quando}</b>, "
        f"há cerca de {int(horas)} horas.\n\n"
        "Enquanto isso, silêncio no bot não quer dizer que o catálogo está "
        "parado — quer dizer que ninguém está olhando.\n\n"
        f"Actions: github.com/{REPO}/actions"
    )
    corpo = json.dumps({"chat_id": chat, "text": texto, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=corpo,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        print(f"ERRO: não consegui avisar pelo Telegram: {e}", file=sys.stderr)
        return 1
    print(f"AVISADO: faixa de {limite}h")
    return 0


if __name__ == "__main__":
    sys.exit(main())
