import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

CPF = re.sub(r"\D", "", os.environ.get("ABECMED_CPF", ""))
URL = "https://bot.abecmed.com.br"
BASE = Path(__file__).resolve().parent
STATE = BASE / "state.json"
ALERT = BASE / "alert.md"


def clean(s):
    return re.sub(r"[ \t]+", " ", s or "").strip()


def body(page):
    return page.locator("body").inner_text(timeout=8000)


def wait_text(page, needles, timeout=25000):
    end = time.time() + timeout / 1000
    needles = [x.lower() for x in needles]
    while time.time() < end:
        try:
            txt = body(page).lower()
            if any(x in txt for x in needles):
                return True
        except Exception:
            pass
        time.sleep(0.4)
    return False


def click_text(page, names, timeout=4000):
    for name in names:
        candidates = [
            page.get_by_role("button", name=re.compile(re.escape(name), re.I)),
            page.get_by_text(name, exact=True),
            page.get_by_text(re.compile(re.escape(name), re.I)),
        ]
        for loc in candidates:
            try:
                for i in range(min(loc.count(), 8)):
                    el = loc.nth(i)
                    if el.is_visible():
                        el.click(timeout=timeout)
                        time.sleep(0.7)
                        return True
            except Exception:
                pass
    return False


def visible_input(page):
    sels = [
        'textarea:visible',
        'input[type="text"]:visible',
        'input[type="tel"]:visible',
        'input:not([type]):visible',
        '[contenteditable="true"]:visible',
    ]
    for sel in sels:
        loc = page.locator(sel)
        try:
            for i in range(loc.count() - 1, -1, -1):
                el = loc.nth(i)
                if el.is_visible() and el.is_enabled():
                    return el
        except Exception:
            pass
    return None


def login(page):
    page.goto(URL, wait_until="domcontentloaded", timeout=45000)
    wait_text(page, ["Sou Paciente", "Bem-vindo"], 15000)
    if not click_text(page, ["Sou Paciente"]):
        raise RuntimeError("botão Sou Paciente não encontrado")

    wait_text(page, ["informe seu CPF", "CPF para continuar"], 12000)
    inp = visible_input(page)
    if inp is None:
        raise RuntimeError("campo de CPF não encontrado")
    try:
        inp.fill(CPF)
    except Exception:
        inp.click()
        inp.type(CPF, delay=35)
    inp.press("Enter")
    time.sleep(1)

    end = time.time() + 45
    while time.time() < end:
        txt = body(page).lower()
        if "quero adquirir flores" in txt or "quero adquirir concentrados" in txt:
            return
        if "estou ciente" in txt:
            click_text(page, ["Estou ciente", "Estou ciente!"])
            continue
        if any(x in txt for x in ["cpf inválido", "cpf nao encontrado", "cpf não encontrado", "cadastro não encontrado"]):
            raise RuntimeError("CPF/cadastro não aceito pelo site")
        time.sleep(0.5)
    raise RuntimeError("menu do paciente não apareceu")


def money(raw):
    s = raw.strip().replace(" ", "")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    return round(float(s), 2)


def parse_catalog(txt, kind):
    if kind == "flowers":
        unavailable = bool(re.search(r"sem disponibilidade de (?:flores?|infloresc[eê]ncias?)", txt, re.I))
        markers = [r"lista de flores e pre[cç]os", r"lista de infloresc[eê]ncias e pre[cç]os"]
    else:
        unavailable = bool(re.search(r"sem disponibilidade de concentrado", txt, re.I))
        markers = [r"lista de concentrados? e pre[cç]os"]

    start = 0
    for pat in markers:
        ms = list(re.finditer(pat, txt, re.I))
        if ms:
            start = max(start, ms[-1].start())
    section = txt[start:] if start else txt

    products = []
    seen = set()
    rx = re.compile(r"(?:^|\n)\s*[•●·\-–—]?\s*([^\n\r]{2,100}?)\s*[\-–—:]\s*R\$\s*([0-9][0-9\.,]*)", re.I)
    for m in rx.finditer(section):
        name = clean(m.group(1))
        if re.search(r"lista de|limite mensal|deseja adquirir|seu limite|total pode|atenção|aviso", name, re.I):
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        products.append({"name": name, "price": money(m.group(2))})

    products.sort(key=lambda x: x["name"].lower())
    return {
        "available": bool(products) or not unavailable,
        "products": products,
    }


def get_flowers(page):
    if not click_text(page, ["Quero adquirir flores!", "Quero adquirir flores"], 6000):
        raise RuntimeError("botão Flores não encontrado")
    wait_text(page, ["Lista de flores", "inflorescências", "sem disponibilidade de flor"], 18000)
    time.sleep(1)
    return parse_catalog(body(page), "flowers")


def get_concentrates(page):
    if not click_text(page, ["Quero adquirir concentrados!", "Quero adquirir concentrados"], 6000):
        raise RuntimeError("botão Concentrados não encontrado")
    time.sleep(0.8)
    if "estou ciente" in body(page).lower():
        click_text(page, ["Estou ciente", "Estou ciente!"])
    wait_text(page, ["concentrado", "sem disponibilidade"], 18000)
    time.sleep(1)
    return parse_catalog(body(page), "concentrates")


def scrape():
    if len(CPF) != 11:
        raise RuntimeError("ABECMED_CPF não configurado como Secret")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(locale="pt-BR", timezone_id="America/Sao_Paulo", viewport={"width": 390, "height": 844})
        page = ctx.new_page()
        try:
            login(page)
            flowers = get_flowers(page)
            if not click_text(page, ["VOLTAR", "Voltar"], 5000):
                login(page)
            elif not wait_text(page, ["Quero adquirir concentrados"], 10000):
                login(page)
            concentrates = get_concentrates(page)
            return {"flowers": flowers, "concentrates": concentrates}
        finally:
            ctx.close()
            browser.close()


def load_state():
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def pmap(section):
    return {p["name"].lower(): p for p in section.get("products", [])}


def diff(old, new):
    changes = []
    for key, label in [("flowers", "🌿 Flores"), ("concentrates", "🍯 Concentrados")]:
        o = old.get(key, {})
        n = new.get(key, {})
        if o and bool(o.get("available")) != bool(n.get("available")):
            changes.append(f"{label}: {'voltou a ter disponibilidade' if n.get('available') else 'ficou indisponível'}")
        om, nm = pmap(o), pmap(n)
        for k in sorted(nm.keys() - om.keys()):
            p = nm[k]
            changes.append(f"🆕 {p['name']} — R$ {p['price']:.2f}")
        for k in sorted(om.keys() - nm.keys()):
            changes.append(f"❌ {om[k]['name']} removido")
        for k in sorted(nm.keys() & om.keys()):
            if nm[k]["price"] != om[k]["price"]:
                changes.append(f"💲 {nm[k]['name']}: R$ {om[k]['price']:.2f} → R$ {nm[k]['price']:.2f}")
    return changes


def catalog_md(cat):
    lines = []
    for key, title in [("flowers", "🌿 **Flores**"), ("concentrates", "🍯 **Concentrados**")]:
        sec = cat[key]
        lines.append(title)
        if not sec.get("available") and not sec.get("products"):
            lines.append("- indisponível no momento")
        elif sec.get("products"):
            for p in sec["products"]:
                lines.append(f"- {p['name']} — R$ {p['price']:.2f}")
        else:
            lines.append("- disponível, mas a lista não foi identificada")
        lines.append("")
    return "\n".join(lines).strip()


def main():
    old_wrapper = load_state()
    old = old_wrapper.get("catalog", old_wrapper)
    current = scrape()
    changes = diff(old, current) if old else []
    wrapper = {
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "catalog": current,
    }
    STATE.write_text(json.dumps(wrapper, ensure_ascii=False, indent=2), encoding="utf-8")

    if changes:
        msg = ["# 🚨 ABECMED atualizou", "", "## Mudanças", ""]
        msg += [f"- {c}" for c in changes]
        msg += ["", "## Cardápio atual", "", catalog_md(current), "", f"Consultado em {wrapper['checked_at']} UTC."]
        ALERT.write_text("\n".join(msg), encoding="utf-8")
        print("CHANGED=1")
        print("\n".join(changes))
    else:
        if ALERT.exists():
            ALERT.unlink()
        print("CHANGED=0")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(2)
