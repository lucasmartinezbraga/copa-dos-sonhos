#!/usr/bin/env python3
"""Testes do monitor da ABECMED.

Os textos abaixo são cópias literais do que a API do Typebot devolveu em
18/08/2026 — inclusive o "Extrato Água e Gelo Indoor #3", que saiu do ar entre
duas consultas feitas com minutos de diferença. É por isso que ele está aqui:
o parser precisa continuar enxergando nome com "#", preço com ponto decimal e
o agrupamento por categoria, senão o monitor avisa mudança que não houve (ou
pior, deixa de avisar a que houve).

Rodar:  python3 abecmed-monitor/test_monitor.py
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import monitor as M  # noqa: E402

FLORES = """🌿 Seu limite mensal para flores é de 15 gramas.

Esse total pode ser distribuído entre produtos com THC.

📋 Lista de flores e preços: 🌿

THC:
Velvet Runtz (indoor) - R$ 85.00
Papaya (indoor) - R$ 85.00
Chemdawg (indoor) - R$ 85.00
Rainbow Mints (indoor) - R$ 90.00
Double Stack (indoor) - R$ 90.00

Você deseja adquirir inflorescências de THC, CBD ou CBG?
"""

CONCENTRADOS = """⚠️ Aviso importante

Identificamos um erro de impressão no ano da data de empacotamento da etiqueta.

🌿 Seu limite mensal para concentrados é de 5 gramas.

Esse total pode ser distribuído entre produtos com THC.

💧 Lista de concentrados e preços (valores para 1g):

THC:
Extrato Água e Gelo Indoor - R$ 120.00
Extrato Água e Gelo Indoor #3 - R$ 130.00
Extrato Live Rosin - R$ 350.00

⚖️ Os valores são referente a 1g de concentrado.

🌿 Selecione o tipo de concentrado que deseja adquirir. 💚
"""

falhas = []


def checar(condicao, descricao):
    if condicao:
        print(f"  ok   {descricao}")
    else:
        print(f"  FALHA {descricao}")
        falhas.append(descricao)


print("preços em formatos diferentes")
checar(M.para_reais("85.00") == 85.0, "'85.00' -> 85.0")
checar(M.para_reais("90,00") == 90.0, "'90,00' -> 90.0")
checar(M.para_reais("1.234,56") == 1234.56, "'1.234,56' -> 1234.56")
checar(M.para_reais("1,234.56") == 1234.56, "'1,234.56' -> 1234.56")
checar(M.reais(85.0) == "R$ 85,00", "formata 85.0 como R$ 85,00")
checar(M.reais(1234.5) == "R$ 1.234,50", "formata milhar com ponto")

checar(M.preco_txt({"preco": 93.0, "por": "/g"}) == "R$ 93,00/g", "preço por grama mostra a unidade")
checar(M.preco_txt({"preco": 85.0}) == "R$ 85,00", "produto sem unidade não ganha sufixo")

print("\nlista de flores")
flores = M.extrair_produtos(FLORES)
checar(len(flores) == 5, f"5 produtos (achou {len(flores)})")
checar(all(p["categoria"] == "THC" for p in flores), "todos marcados como THC")
nomes = [p["nome"] for p in flores]
checar("Velvet Runtz (indoor)" in nomes, "pegou Velvet Runtz")
checar("Double Stack (indoor)" in nomes, "pegou Double Stack")
precos = {p["nome"]: p["preco"] for p in flores}
checar(precos.get("Rainbow Mints (indoor)") == 90.0, "Rainbow Mints custa 90.00")
checar(
    not any("limite mensal" in n.lower() or "deseja adquirir" in n.lower() for n in nomes),
    "não confundiu linha de aviso com produto",
)
checar(M.extrair_limite(FLORES, M.SECOES["flores"]["limite_rx"]).endswith("15 gramas"), "leu o limite mensal")

print("\nlista de concentrados")
conc = M.extrair_produtos(CONCENTRADOS)
checar(len(conc) == 3, f"3 produtos (achou {len(conc)})")
checar(
    any(p["nome"] == "Extrato Água e Gelo Indoor #3" and p["preco"] == 130.0 for p in conc),
    "nome com '#' e preço 130.00 preservados",
)
checar(
    any(p["nome"] == "Extrato Live Rosin" and p["preco"] == 350.0 for p in conc),
    "pegou Live Rosin a 350.00",
)

print("\ncomparação entre duas consultas")
antes = {
    "flores": {"disponivel": True, "limite": None, "produtos": M.extrair_produtos(FLORES)},
    "concentrados": {"disponivel": True, "limite": None, "produtos": conc},
}
# O que de fato aconteceu no site: o #3 sumiu. Somamos um produto novo, uma
# mudança de preço e uma seção que esvaziou para cobrir os quatro casos.
depois = {
    "flores": {
        "disponivel": True,
        "limite": None,
        "produtos": M.extrair_produtos(
            FLORES.replace("Papaya (indoor) - R$ 85.00", "Papaya (indoor) - R$ 95.00")
            + "\nTHC:\nGelato (indoor) - R$ 100.00\n"
        ),
    },
    "concentrados": {"disponivel": True, "limite": None, "produtos": [p for p in conc if "#3" not in p["nome"]]},
}
mudancas = M.comparar(antes, depois)
texto = "\n".join(mudancas)
print("  ---")
for m in mudancas:
    print(f"  {m}")
print("  ---")
checar(any(m.startswith("🆕") and "Gelato" in m for m in mudancas), "detectou produto adicionado")
checar(any(m.startswith("❌") and "#3" in m for m in mudancas), "detectou produto removido")
checar(
    any(m.startswith("💰") and "Papaya" in m and "85,00" in m and "95,00" in m for m in mudancas),
    "detectou alteração de preço com valor antigo e novo",
)
checar(len(mudancas) == 3, f"exatamente 3 mudanças (achou {len(mudancas)})")

print("\nduas associações no mesmo catálogo")
dois_antes = {"zeleno_flores": {"disponivel": True, "produtos": []}}
dois_depois = {"zeleno_flores": {"disponivel": True, "produtos": [
    {"nome": "Power Plant", "preco": 93.0, "por": "/g", "categoria": "Híbrida (+sativa)"}]}}
md = M.comparar(dois_antes, dois_depois)
checar(len(md) == 1 and "Power Plant" in md[0], "detecta produto novo em seção da Zeleno")
checar("/g" in md[0], f"e mostra que o preço é por grama (achou {md[0]!r})")
checar("Zeleno" in md[0], "a mudança diz de qual associação veio")

print("\nseção que fica sem estoque")
vazio = {
    "flores": {"disponivel": False, "limite": None, "produtos": []},
    "concentrados": antes["concentrados"],
}
m2 = M.comparar(antes, vazio)
checar(any("ficou indisponível" in m for m in m2), "avisa quando a seção esvazia")
checar(any(m.startswith("❌") for m in m2), "lista os produtos que saíram")
m3 = M.comparar(vazio, antes)
checar(any("voltou a ter disponibilidade" in m for m in m3), "avisa quando a seção volta")

print("\nconsulta igual não gera alerta")
checar(M.comparar(antes, antes) == [], "catálogo idêntico -> nenhuma mudança")

print("\nmensagem enviada ao celular")
import datetime  # noqa: E402

agora = datetime.datetime(2026, 8, 18, 19, 30, tzinfo=M.TZ)
msg = M.render_mensagem(mudancas, depois, agora)
print("  ---")
print("\n".join("  " + l for l in msg.splitlines()))
print("  ---")
for exigido in ["🆕", "❌", "💰", "🌿 Flores", "🍯 Concentrados", "🕐", "18/08/2026 19:30"]:
    checar(exigido in msg, f"a notificação mostra {exigido!r}")
checar("Gelato" in msg and "Extrato Live Rosin" in msg, "traz o catálogo completo junto")
checar(len(msg) <= 4000, "cabe no limite do Telegram")

vazia = M.render_mensagem([], vazio, agora)
checar("sem disponibilidade no momento" in vazia, "diz quando não há nada disponível")

print("\nsegurança da navegação")
checar(
    set(M.INTENCOES_PERMITIDAS) == {"paciente", "ciente", "flores", "concentrados", "voltar"},
    "a allowlist não cresceu para além de navegar e voltar",
)
fake = {"input": {"type": "choice input", "items": [{"content": "Confirmar pedido"}, {"content": "Finalizar compra"}]}}
checar(
    all(M.achar_botao(fake, i) is None for i in M.INTENCOES_PERMITIDAS),
    "nenhuma intenção casa com botão de confirmar/finalizar pedido",
)

print("\nficha do produto (THC, genética, terpenos)")
# Cópias literais das fichas do site. A flor traz o THC embutido na linha de
# genética; o concentrado traz sozinho. O mesmo parser tem de servir aos dois.
FICHA_FLOR = """Papaya (indoor)

Genética: Citral #13 × Ice #2 Híbrida com predominância índica (20% sativa / 80% indica) - THC: até 15%
Terpenos predominantes: Mirceno - Limoneno
"""
FICHA_CONC = """Extrato Live Rosin
THC: 74%
"""
ff = M.extrair_ficha(FICHA_FLOR, "https://exemplo/foto.jpeg")
checar(ff["thc"] == "até 15%", f"THC da flor sai da linha de genética (achou {ff['thc']!r})")
checar(len(ff["detalhes"]) == 2, "guarda genética e terpenos")
checar(any("Mirceno" in d for d in ff["detalhes"]), "terpenos preservados")
checar(ff["foto_url"] == "https://exemplo/foto.jpeg", "guarda a URL da foto")
fc = M.extrair_ficha(FICHA_CONC, None)
checar(fc["thc"] == "74%", f"THC do concentrado (achou {fc['thc']!r})")
checar(fc["detalhes"] == [], "concentrado não inventa genética")
checar(M.extrair_ficha("sem nada aqui", None)["thc"] is None, "ficha sem THC não quebra")

cat_thc = {
    "flores": {"disponivel": True, "limite": None, "produtos": M.extrair_produtos(FLORES)},
    "concentrados": {"disponivel": True, "limite": None, "produtos": conc},
}
saida = M.render_catalogo(cat_thc, {"papaya (indoor)": {"thc": "até 15%"}})
checar("THC até 15%" in saida, "o catálogo mostra o THC de quem tem ficha")
checar(">Chemdawg (indoor)</a> — R$ 85,00" in saida, "quem não tem ficha aparece igual, sem THC")

print("\nhistórico de preços (matéria-prima do gráfico)")
est = {}
M.registrar_historico(est, cat_thc, agora)
n1 = len(est["historico"])
checar(n1 == 8, f"primeira consulta registra os 8 produtos (achou {n1})")
M.registrar_historico(est, cat_thc, agora)
checar(len(est["historico"]) == n1, "preço repetido não vira registro novo")
caro = json.loads(json.dumps(cat_thc))
caro["flores"]["produtos"][0]["preco"] = 99.0
M.registrar_historico(est, caro, agora)
checar(len(est["historico"]) == n1 + 1, "mudança de preço vira um registro")
checar(est["historico"][-1]["preco"] == 99.0, "o registro guarda o preço novo")

print("\nrecomendação por atividade")
FICHAS = {
    "papaya (indoor)": {
        "thc": "até 15%",
        "detalhes": [
            "Genética: Citral #13 × Ice #2 Híbrida com predominância índica (20% sativa / 80% indica)",
            "Terpenos predominantes: Mirceno - Limoneno",
        ],
    },
    "double stack (indoor)": {
        "thc": "19%",
        "detalhes": [
            "Genética: híbrida (40% sativa / 60% indica)",
            "Terpenos predominantes: Limoneno - Cariofileno",
        ],
    },
    "chemdawg (indoor)": {
        "thc": "20%",
        "detalhes": [
            "Genética: híbrida (45% sativa / 55% indica)",
            "Terpenos predominantes: Mirceno - Cariofileno",
        ],
    },
    "extrato live rosin": {"thc": "74%", "detalhes": []},
}
perf = M.perfil_do_produto(FICHAS["papaya (indoor)"])
checar(perf["indica"] == 0.8 and perf["sativa"] == 0.2, f"lê 80/20 da genética (achou {perf['indica']}/{perf['sativa']})")
checar(perf["terpenos"] == ["mirceno", "limoneno"], f"lê os terpenos (achou {perf['terpenos']})")
checar(perf["thc"] == 15.0, "converte 'até 15%' em 15.0")
checar(M.thc_numero("44,9%") == 44.9, "converte '44,9%' com vírgula")
checar(M.thc_numero(None) is None, "ficha sem THC não quebra o perfil")

checar(M.atividade_do_texto("preciso dormir") == "dormir", "'preciso dormir' -> dormir")
checar(M.atividade_do_texto("vou treinar hoje") == "disposicao", "'vou treinar' -> disposição")
checar(M.atividade_do_texto("tenho que trabalhar") == "foco", "'trabalhar' -> foco")
checar(M.atividade_do_texto("dor nas costas") == "corpo", "'dor nas costas' -> corpo")
checar(M.atividade_do_texto("estou com ansiedade") == "calma", "'ansiedade' -> calma")
# 'dor' é pedaço de 'dormir': a ordem dos perfis tem de resolver isso
checar(M.atividade_do_texto("quero dormir cedo") == "dormir", "'dormir' não cai em 'dor'")
checar(M.atividade_do_texto("bom dia") is None, "conversa solta não vira recomendação")

cat_rec = {
    "flores": {"disponivel": True, "limite": None, "produtos": [
        {"nome": "Papaya (indoor)", "preco": 85.0, "categoria": "THC"},
        {"nome": "Double Stack (indoor)", "preco": 90.0, "categoria": "THC"},
        {"nome": "Chemdawg (indoor)", "preco": 85.0, "categoria": "THC"},
    ]},
    "concentrados": {"disponivel": True, "limite": None, "produtos": [
        {"nome": "Extrato Live Rosin", "preco": 350.0, "categoria": "THC"},
    ]},
}
topo = lambda a: M.recomendar(cat_rec, FICHAS, a, quantos=1)[0][1]["nome"]
checar(topo("dormir") == "Papaya (indoor)", f"dormir -> a mais índica com mirceno (achou {topo('dormir')})")
checar(topo("foco") == "Double Stack (indoor)", f"foco -> limoneno e THC mais leve (achou {topo('foco')})")
checar(topo("corpo") == "Chemdawg (indoor)", f"corpo -> mirceno + cariofileno (achou {topo('corpo')})")

guia = M.render_guia(cat_rec, FICHAS, agora)
checar("Papaya" in guia and "Double Stack" in guia, "o guia cobre atividades diferentes com produtos diferentes")
checar("orientação médica" in guia and "prescritor" in guia, "o guia deixa claro que não é orientação médica")
rec = M.render_recomendacao(cat_rec, FICHAS, "dormir", agora)
checar("orientação médica" in rec and "prescritor" in rec, "a recomendação avulsa também avisa")
vazia_rec = M.render_recomendacao({"flores": {"produtos": []}}, {}, "dormir", agora)
checar("Ainda não tenho ficha" in vazia_rec, "sem ficha, não inventa recomendação")

r_livre = M.responder_comando("vou treinar", cat_rec, {"fichas": FICHAS}, agora, True)
checar(r_livre is not None and "Exercício" in r_livre, "texto livre no Telegram vira recomendação")

print("\nduas escutas ao mesmo tempo (409 do Telegram)")
# O Telegram entrega cada update a um leitor só; o segundo leva 409. Sem recuo,
# o laço girava e a janela inteira passava sem responder nada — foi o que
# aconteceu numa janela real de 9 minutos.
import io as _io  # noqa: E402
import time as _time  # noqa: E402
import urllib.error as _uerr  # noqa: E402

_tentativas = []
_real_urlopen = M.urllib.request.urlopen


def _sempre_409(url, timeout=None):
    _tentativas.append(_time.time())
    raise _uerr.HTTPError(url, 409, "Conflict", {}, _io.BytesIO(b""))


M.urllib.request.urlopen = _sempre_409
os.environ["TELEGRAM_BOT_TOKEN"] = "falso"
_t0 = _time.time()
M.escutar({"telegram_chat_id": "1"}, {}, None, 8)
_gasto = _time.time() - _t0
M.urllib.request.urlopen = _real_urlopen
os.environ.pop("TELEGRAM_BOT_TOKEN", None)
checar(len(_tentativas) <= 5, f"recua em vez de girar (fez {len(_tentativas)} tentativas em 8s)")
checar(_gasto >= 7, "e ainda assim respeita a janela pedida")

print("\nSecret único (ABECMED_CONFIG)")


def com_config(valor):
    for k in ("ABECMED_CPF", "TELEGRAM_BOT_TOKEN", "ABECMED_CONFIG"):
        os.environ.pop(k, None)
    os.environ["ABECMED_CONFIG"] = valor
    M.carregar_credenciais()
    return os.environ.get("ABECMED_CPF"), os.environ.get("TELEGRAM_BOT_TOKEN")


cpf, tok = com_config("42689744821|123456:ABCdef")
checar(cpf == "42689744821" and tok == "123456:ABCdef", "separa CPF e token do valor combinado")
cpf, tok = com_config("123456:ABCdef | 426.897.448-21")
checar(cpf == "42689744821", "aceita ordem trocada e CPF pontuado")
checar(tok == "123456:ABCdef", "token continua íntegro com a ordem trocada")
cpf, tok = com_config("42689744821\n123456:ABCdef")
checar(cpf == "42689744821" and tok == "123456:ABCdef", "aceita quebra de linha como separador")
for k in ("ABECMED_CPF", "TELEGRAM_BOT_TOKEN", "ABECMED_CONFIG"):
    os.environ.pop(k, None)
os.environ["ABECMED_CPF"] = "11122233344"
os.environ["ABECMED_CONFIG"] = "99988877766|123456:XYZ"
M.carregar_credenciais()
checar(os.environ["ABECMED_CPF"] == "11122233344", "Secret separado tem prioridade sobre o combinado")
for k in ("ABECMED_CPF", "TELEGRAM_BOT_TOKEN", "ABECMED_CONFIG"):
    os.environ.pop(k, None)
M.carregar_credenciais()
checar("ABECMED_CPF" not in os.environ, "sem ABECMED_CONFIG não inventa credencial")

print("\nlink para a página do produto")
_pz = {"nome": "Power Plant", "preco": 93.0, "por": "/g", "link": "207-(power-plant).html"}
_url = M.link_do_produto(_pz, "zeleno_flores")
checar(_url.startswith("https://catalogoassociativo.zelenomeds.com/"), "produto da Zeleno aponta para a página dele")
checar("%28power-plant%29" in _url, f"parênteses vão codificados (achou {_url})")
checar(M.link_do_produto({"nome": "Papaya"}, "flores") == M.BASE, "produto da ABECMED aponta para o bot, que é onde se pede")
checar(M.link_do_produto({"nome": "X"}, "zeleno_oleos").startswith("https://catalogoassociativo"), "sem link, cai na home da Zeleno")

_cat_link = {"zeleno_flores": {"disponivel": True, "produtos": [_pz]}}
_saida = M.render_catalogo(_cat_link, {})
checar('<a href="https://catalogoassociativo' in _saida, "o nome vira link na listagem")
checar(">Power Plant</a>" in _saida, "e o texto do link é o nome do produto")
_perigoso = {"nome": "Flor <b>&</b>", "preco": 1.0, "link": "x.html"}
_esc = M.render_catalogo({"zeleno_flores": {"produtos": [_perigoso]}}, {})
checar("&lt;b&gt;" in _esc and "&amp;" in _esc, "nome com caractere de marcação continua escapado dentro do link")

print("\ncadência separada por associação")
checar(M.toca_abecmed(datetime.datetime(2026, 8, 19, 10, 0, tzinfo=M.TZ)), "consulta a ABECMED no minuto :00")
checar(not M.toca_abecmed(datetime.datetime(2026, 8, 19, 10, 7, tzinfo=M.TZ)), "pula no minuto :07")
checar(M.toca_abecmed(datetime.datetime(2026, 8, 19, 10, 16, tzinfo=M.TZ)), "volta no minuto :16")
quantas = sum(1 for m in range(60) if M.toca_abecmed(datetime.datetime(2026, 8, 19, 10, m, tzinfo=M.TZ)))
checar(quantas == 20, f"a janela cobre 20 dos 60 minutos (achou {quantas})")

# O risco desta mudança tem nome: pular a ABECMED e deixar as seções dela fora
# do catálogo faria a comparação anunciar TODOS os produtos como removidos.
_ant = {
    "flores": {"disponivel": True, "produtos": [{"nome": "Papaya (indoor)", "preco": 85.0}]},
    "concentrados": {"disponivel": True, "produtos": [{"nome": "Live Rosin", "preco": 350.0}]},
    "zeleno_flores": {"disponivel": True, "produtos": [{"nome": "Power Plant", "preco": 93.0, "por": "/g"}]},
}
_real_abecmed, _real_zeleno = M.consultar_abecmed, M.zeleno.consultar


def _nao_deveria(_cpf):
    raise AssertionError("consultou a ABECMED fora da janela")


M.consultar_abecmed = _nao_deveria
M.zeleno.consultar = lambda: {"zeleno_flores": _ant["zeleno_flores"]}
_cat = M.consultar("42689744821", _ant, datetime.datetime(2026, 8, 19, 10, 7, tzinfo=M.TZ))
M.consultar_abecmed, M.zeleno.consultar = _real_abecmed, _real_zeleno
checar("flores" in _cat and "concentrados" in _cat, "as seções da ABECMED continuam no catálogo")
checar(M.comparar(_ant, _cat) == [], "pular a consulta NÃO vira alerta de remoção")

print("\nbotão só da Zeleno")
cat_duplo = {
    "flores": {"disponivel": True, "produtos": [{"nome": "Papaya (indoor)", "preco": 85.0}]},
    "zeleno_flores": {"disponivel": True, "produtos": [
        {"nome": "Power Plant", "preco": 93.0, "por": "/g", "categoria": "Híbrida (+sativa)"}]},
    "zeleno_oleos": {"disponivel": True, "produtos": [{"nome": "Óleo THC Rosin", "preco": 490.0}]},
}
so_z = M.secoes_da_fonte(cat_duplo, "zeleno")
checar(set(so_z) == {"zeleno_flores", "zeleno_oleos"}, f"recorta só a Zeleno (achou {set(so_z)})")
checar(M.secoes_da_fonte(cat_duplo, "abecmed").keys() == {"flores"}, "e sabe recortar a ABECMED também")
saida_z = M.render_catalogo(so_z, {})
checar("Power Plant" in saida_z, "o recorte mostra o produto da Zeleno")
checar("ABECMED" not in saida_z, "e não anuncia as seções da ABECMED como indisponíveis")
checar("Papaya" not in saida_z, "nem vaza produto da outra associação")
completo = M.render_catalogo(cat_duplo, {})
checar("Papaya" in completo and "Power Plant" in completo, "o catálogo completo segue trazendo as duas")

# "Alto em THC" e "216mg THC" já trazem a sigla
rot = M.render_catalogo(so_z, {"power plant": {"thc": "Alto em THC"}})
checar("THC Alto em THC" not in rot, "não repete a sigla quando o valor já a contém")
checar("Alto em THC" in rot, "mas mostra o valor")
rot2 = M.render_catalogo(so_z, {"power plant": {"thc": "20,5%"}})
checar("THC 20,5%" in rot2, "valor numérico ganha o rótulo THC")

print("\nbotões e comandos do bot")
estado_ex = {"falhas_seguidas": 0, "ultima_mudanca_em": "2026-08-18T19:30:00-03:00"}
cat = {
    "flores": antes["flores"],
    "concentrados": antes["concentrados"],
}
r = M.responder_comando("/catalogo", cat, estado_ex, agora, True)
checar(r is not None and "Extrato Live Rosin" in r, "/catalogo devolve a lista completa")
checar("consultado agora" in r, "diz que o dado é da consulta ao vivo")
r_off = M.responder_comando("/catalogo", cat, estado_ex, agora, False)
checar("última consulta que deu certo" in r_off, "avisa quando o dado não é ao vivo")
r_st = M.responder_comando(M.BOTAO_STATUS, cat, estado_ex, agora, True)
checar("✅ funcionando" in r_st, "status diz que está funcionando quando não há falha")
checar("5 produto(s)" in r_st and "3 produto(s)" in r_st, "status conta os produtos das duas seções")
r_ruim = M.responder_comando("/status", cat, {"falhas_seguidas": 4}, agora, True)
checar("4 falha(s)" in r_ruim, "status mostra as falhas acumuladas")
checar(M.responder_comando("/ajuda", cat, estado_ex, agora, True).startswith("❓"), "responde /ajuda")
checar(M.responder_comando("/start", cat, estado_ex, agora, True).startswith("👋"), "responde /start")
checar(M.responder_comando("bom dia", cat, estado_ex, agora, True) is None, "ignora conversa solta")
# Por posição não: o teclado ganha linha quando entra botão novo, e o teste
# quebrava por layout em vez de por comportamento.
rotulos = {b["text"] for linha in M.TECLADO["keyboard"] for b in linha}
checar(
    {M.BOTAO_ABECMED, M.BOTAO_ZELENO, M.BOTAO_GUIA, M.BOTAO_STATUS} == rotulos,
    f"o teclado tem uma associação por botão, sem sobra (achou {sorted(rotulos)})",
)
checar(M.TECLADO.get("is_persistent") is True, "o teclado não some depois de usar")
checar(len(M.TECLADO["keyboard"]) == 3, "três fileiras, não uma parede de botões")
checar(
    [b["text"] for b in M.TECLADO["keyboard"][0]] == [M.BOTAO_ABECMED, M.BOTAO_ZELENO],
    "as duas associações ficam lado a lado na primeira fileira",
)

print()
if falhas:
    print(f"{len(falhas)} teste(s) falharam:")
    for f in falhas:
        print(f"  - {f}")
    sys.exit(1)
print("todos os testes passaram")
