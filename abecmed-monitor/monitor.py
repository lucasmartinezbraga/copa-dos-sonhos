#!/usr/bin/env python3
"""Monitor do catálogo da ABECMED (flores e concentrados).

O assistente da ABECMED em https://bot.abecmed.com.br é um Typebot. O widget do
navegador conversa com o servidor por uma API JSON pública, e é essa API que
usamos aqui — nada de Playwright. A diferença é grande: uma verificação leva
~5 segundos em vez de ~60, não precisa de Chromium instalado no runner e não
quebra quando o CSS ou o rótulo de um botão muda de lugar.

Fluxo que este script percorre (mapeado contra o site real em 18/08/2026):

    startChat                        -> "Sou Paciente"
    "Por favor, informe seu CPF"     -> CPF (vem de ABECMED_CPF, nunca do código)
    aviso sobre validade da receita  -> "Estou ciente"
    menu do paciente                 -> "Quero adquirir flores!"   -> lista
                                     -> "VOLTAR"
                                     -> "Quero adquirir concentrados!"
    aviso sobre etiqueta             -> "Estou ciente!"            -> lista

O script para na listagem. Ele nunca escolhe quantidade nem confirma pedido:
`INTENCOES_PERMITIDAS` é uma allowlist e qualquer botão fora dela faz o script
abortar em vez de clicar em algo desconhecido. Isso é deliberado — um clique
errado aqui viraria um pedido real no nome do paciente.

Uso:
    ABECMED_CPF=... python3 monitor.py                 # verifica e notifica se mudou
    ABECMED_CPF=... python3 monitor.py --forcar        # notifica mesmo sem mudança
    ABECMED_CPF=... python3 monitor.py --sem-estado    # só imprime o catálogo
"""

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "https://bot.abecmed.com.br"
PUBLIC_ID = "pix-pagamento"
AQUI = Path(__file__).resolve().parent
ESTADO = AQUI / "state.json"

# Fuso de Brasília. zoneinfo existe no runner do GitHub, mas se a tzdata faltar
# o -03:00 fixo entrega a mesma hora para o que interessa aqui.
try:
    from zoneinfo import ZoneInfo

    TZ = ZoneInfo("America/Sao_Paulo")
except Exception:  # pragma: no cover - depende da imagem do runner
    TZ = timezone(timedelta(hours=-3))

# Allowlist de navegação. Cada entrada é (intenção, regex do rótulo do botão).
# Só clicamos em botões que casem com uma destas — ver docstring do módulo.
INTENCOES_PERMITIDAS = {
    "paciente": re.compile(r"^\s*sou\s+paciente", re.I),
    "ciente": re.compile(r"estou\s+ciente", re.I),
    "flores": re.compile(r"adquirir\s+flores", re.I),
    "concentrados": re.compile(r"adquirir\s+concentrados", re.I),
    "voltar": re.compile(r"^\s*voltar\s*$", re.I),
}

SECOES = {
    "flores": {"intencao": "flores", "titulo": "🌿 Flores", "limite_rx": r"limite mensal para flores[^.]*"},
    "concentrados": {"intencao": "concentrados", "titulo": "🍯 Concentrados", "limite_rx": r"limite mensal para concentrados[^.]*"},
}


class ErroDeFluxo(RuntimeError):
    """O bot respondeu algo que não sabemos navegar com segurança."""


# ---------------------------------------------------------------- HTTP


def _post(url, payload, tentativas=3):
    """POST JSON com backoff. A API do Typebot dá 5xx esporádico."""
    ultimo = None
    for n in range(tentativas):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    # Identificação honesta: é um monitor, não um navegador.
                    "User-Agent": "abecmed-catalog-monitor/1.0 (paciente associado; verificacao de disponibilidade)",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            corpo = e.read().decode("utf-8", "replace")[:300]
            ultimo = f"HTTP {e.code}: {corpo}"
            if e.code < 500 and e.code != 429:
                break  # erro nosso, repetir não adianta
        except Exception as e:  # rede, DNS, timeout
            ultimo = f"{type(e).__name__}: {e}"
        if n < tentativas - 1:
            time.sleep((2 ** n) + random.uniform(0, 0.6))
    raise ErroDeFluxo(f"falha ao chamar {url.rsplit('/', 1)[-1]} — {ultimo}")


# ------------------------------------------------------- leitura das mensagens


def _rich_para_texto(no):
    """Achata o richText do Typebot (árvore estilo Slate) em texto puro."""
    if isinstance(no, str):
        return no
    if isinstance(no, list):
        return "".join(_rich_para_texto(x) for x in no)
    if isinstance(no, dict):
        if "text" in no and "children" not in no:
            return no["text"]
        dentro = _rich_para_texto(no.get("children", []))
        if no.get("type") in ("p", "li", "h1", "h2", "h3", "blockquote"):
            return dentro + "\n"
        return dentro
    return ""


def texto_das_mensagens(data):
    partes = []
    for m in data.get("messages", []) or []:
        c = m.get("content") or {}
        if m.get("type") == "text":
            partes.append(_rich_para_texto(c["richText"]) if "richText" in c else (c.get("plainText") or ""))
    return "\n".join(partes)


def botoes(data):
    inp = data.get("input") or {}
    return [str(i.get("content", "")) for i in (inp.get("items") or [])]


def tipo_de_entrada(data):
    return ((data.get("input") or {}).get("type") or "")


def achar_botao(data, intencao):
    rx = INTENCOES_PERMITIDAS[intencao]
    for rotulo in botoes(data):
        if rx.search(rotulo):
            return rotulo
    return None


# ---------------------------------------------------------------- sessão


class Sessao:
    def __init__(self):
        self.id = None
        self.ultimo_texto = ""

    def iniciar(self):
        data = _post(f"{BASE}/api/v1/typebots/{PUBLIC_ID}/startChat", {"isStreamEnabled": False})
        self.id = data.get("sessionId")
        if not self.id:
            raise ErroDeFluxo("startChat não devolveu sessionId")
        self.ultimo_texto = texto_das_mensagens(data)
        return data

    def responder(self, mensagem):
        data = _post(f"{BASE}/api/v1/sessions/{self.id}/continueChat", {"message": mensagem})
        self.ultimo_texto = texto_das_mensagens(data)
        return data

    def clicar(self, data, intencao):
        rotulo = achar_botao(data, intencao)
        if rotulo is None:
            raise ErroDeFluxo(
                f"botão '{intencao}' não apareceu (opções: {botoes(data) or 'nenhuma'})"
            )
        return self.responder(rotulo)


# ---------------------------------------------------------------- parsing

RX_CATEGORIA = re.compile(r"^\s*(THC|CBD|CBG)\s*:\s*$", re.I)
# "Velvet Runtz (indoor) - R$ 85.00" / "Extrato Live Rosin – R$ 350,00"
RX_PRODUTO = re.compile(r"^\s*[•●·*]?\s*(.{2,90}?)\s*[-–—]\s*R\$\s*([0-9][0-9.,]*)\s*$", re.I)
RX_SEM_DISPONIBILIDADE = re.compile(r"sem\s+disponibilidade|no\s+momento\s+n[ãa]o\s+(?:temos|h[áa])|indispon[íi]vel", re.I)


def para_reais(bruto):
    """'85.00' -> 85.0 ; '1.234,56' -> 1234.56 ; '90,00' -> 90.0"""
    s = bruto.strip().replace(" ", "")
    if "," in s and "." in s:
        # o separador decimal é o que aparece por último
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    return round(float(s), 2)


def extrair_produtos(texto):
    """Lê 'CATEGORIA:' seguida de linhas 'Nome - R$ preço'."""
    categoria = None
    produtos, vistos = [], set()
    for linha in texto.splitlines():
        m = RX_CATEGORIA.match(linha)
        if m:
            categoria = m.group(1).upper()
            continue
        m = RX_PRODUTO.match(linha)
        if not m:
            continue
        nome = re.sub(r"\s+", " ", m.group(1)).strip()
        # linhas de aviso que por acaso tenham um "R$" no meio
        if re.search(r"limite mensal|total pode|valores s[ãa]o|deseja adquirir", nome, re.I):
            continue
        chave = (nome.lower(), categoria)
        if chave in vistos:
            continue
        vistos.add(chave)
        produtos.append({"nome": nome, "preco": para_reais(m.group(2)), "categoria": categoria})
    produtos.sort(key=lambda p: (p["categoria"] or "", p["nome"].lower()))
    return produtos


def extrair_limite(texto, rx):
    m = re.search(rx, texto, re.I)
    if not m:
        return None
    return re.sub(r"\s+", " ", m.group(0)).strip()


# ---------------------------------------------------------------- navegação


def ir_ate_o_menu(sessao, cpf):
    """startChat -> Sou Paciente -> CPF -> avisos -> menu do paciente."""
    data = sessao.iniciar()
    for _ in range(12):
        if achar_botao(data, "flores"):
            return data  # chegamos ao menu do paciente

        tipo = tipo_de_entrada(data)
        if tipo == "text input":
            if not re.search(r"CPF", sessao.ultimo_texto, re.I):
                raise ErroDeFluxo(f"campo de texto inesperado: {sessao.ultimo_texto[:160]!r}")
            data = sessao.responder(cpf)
            texto = sessao.ultimo_texto
            if re.search(r"n[ãa]o (?:foi )?(?:encontrado|localizado)|inv[áa]lido|n[ãa]o consta", texto, re.I):
                raise ErroDeFluxo(f"a ABECMED não aceitou o CPF: {texto[:200]!r}")
            continue

        for intencao in ("paciente", "ciente"):
            if achar_botao(data, intencao):
                data = sessao.clicar(data, intencao)
                break
        else:
            raise ErroDeFluxo(
                f"não sei seguir daqui (botões: {botoes(data) or 'nenhum'}; texto: {sessao.ultimo_texto[:160]!r})"
            )
    raise ErroDeFluxo("o menu do paciente não apareceu depois de 12 passos")


def ler_secao(sessao, data, chave):
    """Abre flores/concentrados, atravessa avisos e devolve a listagem."""
    cfg = SECOES[chave]
    data = sessao.clicar(data, cfg["intencao"])
    acumulado = sessao.ultimo_texto

    # Concentrados abre com um aviso ("erro de impressão na etiqueta"); flores
    # não. Em vez de fixar a diferença, atravessamos qualquer "Estou ciente".
    for _ in range(4):
        if achar_botao(data, "voltar") or RX_SEM_DISPONIBILIDADE.search(acumulado):
            break
        if achar_botao(data, "ciente"):
            data = sessao.clicar(data, "ciente")
            acumulado += "\n" + sessao.ultimo_texto
            continue
        break

    produtos = extrair_produtos(acumulado)
    secao = {
        "disponivel": bool(produtos),
        "limite": extrair_limite(acumulado, cfg["limite_rx"]),
        "produtos": produtos,
    }
    return data, secao


def consultar(cpf):
    """Uma verificação completa: flores + concentrados."""
    sessao = Sessao()
    menu = ir_ate_o_menu(sessao, cpf)

    data, flores = ler_secao(sessao, menu, "flores")

    # Voltar ao menu para a segunda seção. Se o VOLTAR sumir, refazemos a
    # sessão do zero — é mais lento, mas nunca clica em algo não previsto.
    if achar_botao(data, "voltar"):
        data = sessao.clicar(data, "voltar")
    if not achar_botao(data, "concentrados"):
        sessao = Sessao()
        data = ir_ate_o_menu(sessao, cpf)

    _, concentrados = ler_secao(sessao, data, "concentrados")

    return {"flores": flores, "concentrados": concentrados}


# ---------------------------------------------------------------- comparação


def _mapa(secao):
    return {(p["nome"].lower(), p.get("categoria")): p for p in secao.get("produtos", [])}


def comparar(antigo, novo):
    """Lista legível do que mudou entre duas consultas."""
    mudancas = []
    for chave in ("flores", "concentrados"):
        titulo = SECOES[chave]["titulo"]
        a, n = antigo.get(chave) or {}, novo.get(chave) or {}
        ma, mn = _mapa(a), _mapa(n)

        for k in sorted(mn.keys() - ma.keys()):
            p = mn[k]
            mudancas.append(f"🆕 {titulo} — {p['nome']}: {reais(p['preco'])}")
        for k in sorted(ma.keys() - mn.keys()):
            mudancas.append(f"❌ {titulo} — {ma[k]['nome']} saiu do catálogo")
        for k in sorted(mn.keys() & ma.keys()):
            if mn[k]["preco"] != ma[k]["preco"]:
                mudancas.append(
                    f"💰 {titulo} — {mn[k]['nome']}: {reais(ma[k]['preco'])} → {reais(mn[k]['preco'])}"
                )

        if a and bool(a.get("disponivel")) != bool(n.get("disponivel")):
            mudancas.append(
                f"{titulo}: {'voltou a ter disponibilidade' if n.get('disponivel') else 'ficou indisponível'}"
            )
        if a.get("limite") and n.get("limite") and a["limite"] != n["limite"]:
            mudancas.append(f"ℹ️ {titulo} — {n['limite']}")
    return mudancas


# ---------------------------------------------------------------- formatação


def reais(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def escapar(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_catalogo(catalogo):
    linhas = []
    for chave in ("flores", "concentrados"):
        sec = catalogo.get(chave) or {}
        titulo = SECOES[chave]["titulo"]
        limite = f" — {sec['limite']}" if sec.get("limite") else ""
        linhas.append(f"<b>{escapar(titulo)} disponíveis</b>{escapar(limite)}")
        produtos = sec.get("produtos") or []
        if not produtos:
            linhas.append("• sem disponibilidade no momento")
        else:
            atual = object()
            for p in produtos:
                if p.get("categoria") != atual:
                    atual = p.get("categoria")
                    if atual:
                        linhas.append(f"<i>{escapar(atual)}</i>")
                linhas.append(f"• {escapar(p['nome'])} — {reais(p['preco'])}")
        linhas.append("")
    return "\n".join(linhas).strip()


def render_mensagem(mudancas, catalogo, agora):
    cab = "🚨 <b>ABECMED — o catálogo mudou</b>" if mudancas else "✅ <b>ABECMED — sem mudanças</b>"
    partes = [cab, f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília)", ""]
    if mudancas:
        partes.append("<b>O que mudou</b>")
        partes += [escapar(m) for m in mudancas]
        partes.append("")
    partes.append(render_catalogo(catalogo))
    texto = "\n".join(partes)
    return texto[:4000]  # limite do Telegram, com folga


# ---------------------------------------------------------------- notificação


BOTAO_CATALOGO = "🌿 Ver catálogo agora"
BOTAO_STATUS = "📊 Status"

# Teclado fixo na conversa: os botões só mandam esse texto de volta, e a
# execução seguinte responde. É o mais perto de "rodar sob demanda" que dá para
# fazer sem manter um servidor ligado ouvindo o Telegram.
TECLADO = {
    "keyboard": [[{"text": BOTAO_CATALOGO}, {"text": BOTAO_STATUS}]],
    "resize_keyboard": True,
    "is_persistent": True,
}

AJUDA = (
    "❓ <b>Como isto funciona</b>\n\n"
    "Eu consulto o catálogo da ABECMED de 5 em 5 minutos, comparo com a consulta "
    "anterior e só te chamo quando alguma coisa muda: produto novo, produto que "
    "saiu, preço alterado ou seção que ficou sem estoque.\n\n"
    "Roda no GitHub Actions — seu celular e seu computador podem ficar desligados.\n\n"
    f"<b>{BOTAO_CATALOGO}</b> — manda o catálogo atual.\n"
    f"<b>{BOTAO_STATUS}</b> — diz se está tudo funcionando.\n\n"
    "Não existe um servidor ouvindo o tempo todo (isso custaria dinheiro), então "
    "o toque no botão é atendido na próxima verificação: até ~5 minutos.\n"
    "Para uma consulta na hora, use <b>Run workflow</b> em\n"
    "github.com/lucasmartinezbraga/copa-dos-sonhos/actions"
)


def enviar_telegram(token, chat, texto):
    _post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        {
            "chat_id": chat,
            "text": texto,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": TECLADO,
        },
    )


def responder_comando(texto, catalogo, estado, agora, ao_vivo):
    """Traduz o que a pessoa mandou na resposta correspondente."""
    t = texto.strip().lower().lstrip("/")

    if t.startswith(("catalogo", "catálogo")) or texto.strip() == BOTAO_CATALOGO:
        if not catalogo:
            return "⚠️ Ainda não tenho um catálogo guardado. Tente de novo no próximo ciclo."
        quando = "consultado agora" if ao_vivo else "última consulta que deu certo"
        return (
            f"🌿 <b>Catálogo da ABECMED</b>\n"
            f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília) — {quando}\n\n"
            + render_catalogo(catalogo)
        )

    if t.startswith("status") or texto.strip() == BOTAO_STATUS:
        falhas = int(estado.get("falhas_seguidas", 0))
        saude = "✅ funcionando" if falhas == 0 else f"⚠️ {falhas} falha(s) seguida(s)"
        cat = catalogo or {}
        nf = len((cat.get("flores") or {}).get("produtos") or [])
        nc = len((cat.get("concentrados") or {}).get("produtos") or [])
        linhas = [
            "📊 <b>Status do monitor</b>",
            f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília)",
            "",
            f"Estado: {saude}",
            f"Verificação: a cada 5 minutos, 24h por dia",
            f"🌿 Flores: {nf} produto(s)",
            f"🍯 Concentrados: {nc} produto(s)",
        ]
        if estado.get("ultima_mudanca_em"):
            linhas.append(f"Última mudança detectada: {estado['ultima_mudanca_em'][:16].replace('T', ' ')}")
        if estado.get("ultima_falha"):
            linhas.append(f"Último erro: {escapar(str(estado['ultima_falha'])[:150])}")
        return "\n".join(linhas)

    if t.startswith("start"):
        return (
            "👋 <b>Pronto, estou de olho!</b>\n\n"
            "A partir de agora eu te aviso sozinho quando o catálogo da ABECMED "
            "mudar — flores, concentrados, preços e disponibilidade.\n\n"
            "Use os botões aqui embaixo quando quiser consultar na hora."
        )

    if t.startswith(("ajuda", "help")):
        return AJUDA

    return None  # mensagem solta: não responde nada


def atender_comandos(estado, catalogo, agora, ao_vivo):
    """Lê o que chegou no bot desde a última execução e responde.

    Sem servidor ouvindo, quem "escuta" o Telegram é esta execução, que já roda
    de 5 em 5 minutos por causa do monitoramento. O offset guardado no estado
    marca o que já foi atendido, senão responderíamos a mesma mensagem para
    sempre.
    """
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    dono = estado.get("telegram_chat_id") or os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not dono:
        return 0

    url = f"https://api.telegram.org/bot{token}/getUpdates?timeout=0&limit=20"
    if estado.get("telegram_offset"):
        url += f"&offset={int(estado['telegram_offset'])}"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        print(f"AVISO: não consegui ler mensagens do Telegram: {e}", file=sys.stderr)
        return 0

    atendidos = 0
    for upd in data.get("result") or []:
        estado["telegram_offset"] = int(upd["update_id"]) + 1
        msg = upd.get("message") or {}
        texto = msg.get("text") or ""
        chat = str((msg.get("chat") or {}).get("id") or "")
        # O bot é público: qualquer pessoa pode achá-lo e mandar mensagem. Só o
        # dono recebe resposta — os outros são consumidos e ignorados.
        if not texto or chat != str(dono):
            continue
        resposta = responder_comando(texto, catalogo, estado, agora, ao_vivo)
        if not resposta:
            continue
        try:
            enviar_telegram(token, chat, resposta)
            atendidos += 1
        except Exception as e:
            print(f"AVISO: falha ao responder '{texto[:20]}': {e}", file=sys.stderr)
    return atendidos


def telegram_chat_id(token, cacheado):
    """Descobre o chat pelo /start que o usuário mandou ao bot."""
    if os.environ.get("TELEGRAM_CHAT_ID"):
        return os.environ["TELEGRAM_CHAT_ID"].strip()
    if cacheado:
        return cacheado
    try:
        with urllib.request.urlopen(
            f"https://api.telegram.org/bot{token}/getUpdates?limit=10", timeout=30
        ) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        raise ErroDeFluxo(f"não consegui falar com o Telegram: {e}")
    for upd in reversed(data.get("result") or []):
        msg = upd.get("message") or upd.get("channel_post") or {}
        chat = msg.get("chat") or {}
        if chat.get("id"):
            return str(chat["id"])
    raise ErroDeFluxo(
        "o bot do Telegram ainda não recebeu nenhuma mensagem — abra o bot no "
        "celular e toque em INICIAR (/start) uma vez"
    )


def notificar(texto, estado):
    """Manda a notificação. Telegram se houver token, ntfy se houver tópico."""
    enviados, erros = [], []

    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    if token:
        try:
            chat = telegram_chat_id(token, estado.get("telegram_chat_id"))
            enviar_telegram(token, chat, texto)
            estado["telegram_chat_id"] = chat
            enviados.append("telegram")
        except Exception as e:
            erros.append(f"telegram: {e}")

    topico = (os.environ.get("NTFY_TOPIC") or "").strip()
    if topico:
        try:
            simples = re.sub(r"<[^>]+>", "", texto)
            req = urllib.request.Request(
                f"https://ntfy.sh/{topico}",
                data=simples.encode("utf-8"),
                headers={"Title": "ABECMED - catalogo", "Priority": "default", "Tags": "herb"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=30).read()
            enviados.append("ntfy")
        except Exception as e:
            erros.append(f"ntfy: {e}")

    if not token and not topico:
        erros.append("nenhum canal configurado (falta o Secret TELEGRAM_BOT_TOKEN)")
    return enviados, erros


# ---------------------------------------------------------------- estado


def ler_estado():
    try:
        return json.loads(ESTADO.read_text(encoding="utf-8"))
    except Exception:
        return {}


def gravar_estado(estado):
    ESTADO.write_text(json.dumps(estado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- principal


def main():
    ap = argparse.ArgumentParser(description="Monitor do catálogo da ABECMED")
    ap.add_argument("--forcar", action="store_true", help="notifica mesmo sem mudança")
    ap.add_argument("--sem-estado", action="store_true", help="só consulta e imprime, não grava nada")
    args = ap.parse_args()

    cpf = re.sub(r"\D", "", os.environ.get("ABECMED_CPF", ""))
    if len(cpf) != 11:
        print("ERRO: ABECMED_CPF ausente ou inválido (esperado 11 dígitos).", file=sys.stderr)
        print("      Configure o Secret ABECMED_CPF no repositório.", file=sys.stderr)
        return 2

    agora = datetime.now(TZ)
    estado = ler_estado()
    anterior = estado.get("catalogo") or {}

    try:
        catalogo = consultar(cpf)
    except ErroDeFluxo as e:
        # Falha transitória não vira alerta: só depois de várias seguidas. O
        # contador satura em 6 (o limiar do aviso) e a falha é gravada sem
        # horário, senão o state.json mudaria a cada tentativa e o workflow
        # ficaria commitando de 5 em 5 minutos enquanto o site estivesse fora.
        falhas = min(int(estado.get("falhas_seguidas", 0)) + 1, 6)
        print(f"FALHA ({falhas}x seguidas): {e}", file=sys.stderr)
        if not args.sem_estado:
            estado["falhas_seguidas"] = falhas
            estado["ultima_falha"] = str(e)
            if falhas == 6 and not estado.get("falha_avisada"):
                estado["falha_avisada"] = True
                notificar(
                    "⚠️ <b>ABECMED — monitor com problema</b>\n"
                    f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília)\n\n"
                    f"Já são {falhas} verificações seguidas sem resposta útil.\n"
                    f"Último erro: {escapar(str(e))}",
                    estado,
                )
            # Mesmo sem conseguir consultar, os botões continuam respondendo —
            # com o último catálogo bom e o aviso de que ele não é de agora.
            atender_comandos(estado, estado.get("catalogo"), agora, ao_vivo=False)
            gravar_estado(estado)
        return 1

    if args.sem_estado:
        print(json.dumps(catalogo, ensure_ascii=False, indent=2))
        return 0

    mudancas = comparar(anterior, catalogo) if anterior else []
    recuperou = bool(estado.get("falha_avisada"))

    # De propósito não gravamos o horário exato da verificação: ele mudaria a
    # cada 5 minutos e o workflow commitaria o state.json 288 vezes por dia. Só
    # o dia entra — muda uma vez por dia, o que mantém o repositório ativo (o
    # GitHub desliga agendamentos após 60 dias parados) sem poluir o histórico.
    # A hora exata vai na notificação e fica no log da execução.
    estado["verificado_dia"] = agora.strftime("%Y-%m-%d")
    estado["catalogo"] = catalogo
    estado["falhas_seguidas"] = 0
    estado.pop("falha_avisada", None)
    estado.pop("ultima_falha", None)
    if mudancas:
        estado["ultima_mudanca_em"] = agora.isoformat(timespec="seconds")

    if mudancas or args.forcar or recuperou:
        texto = render_mensagem(mudancas, catalogo, agora)
        if recuperou and not mudancas:
            texto = "✅ <b>ABECMED — monitor normalizado</b>\n" + texto.split("\n", 1)[1]
        enviados, erros = notificar(texto, estado)
        for e in erros:
            print(f"AVISO: {e}", file=sys.stderr)
        print(f"NOTIFICADO={','.join(enviados) or 'nenhum'}")
        if not enviados:
            gravar_estado(estado)
            return 3  # houve o que avisar e não saiu — o job deve falhar

    atendidos = atender_comandos(estado, catalogo, agora, ao_vivo=True)
    gravar_estado(estado)
    if atendidos:
        print(f"COMANDOS_ATENDIDOS={atendidos}")
    print(f"MUDANCAS={len(mudancas)}")
    for m in mudancas:
        print(f"  {m}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
