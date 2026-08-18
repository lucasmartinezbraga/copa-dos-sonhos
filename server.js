import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '20kb' }));

const PORT = process.env.PORT || 10000;
const ABECMED_URL = 'https://bot.abecmed.com.br';
let running = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function allFrames(page) {
  return page.frames();
}

async function bodyText(page) {
  const parts = [];
  for (const frame of await allFrames(page)) {
    try {
      const txt = await frame.locator('body').innerText({ timeout: 2500 });
      if (txt) parts.push(txt);
    } catch {}
  }
  return parts.join('\n');
}

async function hasText(page, needle) {
  const txt = (await bodyText(page)).toLowerCase();
  return txt.includes(needle.toLowerCase());
}

async function waitForText(page, needles, timeout = 25000) {
  const list = Array.isArray(needles) ? needles : [needles];
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const txt = (await bodyText(page)).toLowerCase();
    if (list.some((n) => txt.includes(n.toLowerCase()))) return txt;
    await sleep(350);
  }
  return null;
}

async function clickText(page, labels, timeout = 12000) {
  const list = Array.isArray(labels) ? labels : [labels];
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const frame of await allFrames(page)) {
      for (const label of list) {
        const exact = frame.getByText(label, { exact: true });
        try {
          const count = await exact.count();
          for (let i = count - 1; i >= 0; i--) {
            const el = exact.nth(i);
            if (await el.isVisible().catch(() => false)) {
              await el.click({ timeout: 2500 }).catch(async () => {
                await el.evaluate((e) => e.click());
              });
              await sleep(650);
              return true;
            }
          }
        } catch {}
      }
    }
    await sleep(300);
  }
  return false;
}

async function findEditable(page) {
  const selectors = [
    'textarea',
    'input[type="text"]',
    'input[type="tel"]',
    'input:not([type])',
    '[contenteditable="true"]'
  ];
  for (const frame of await allFrames(page)) {
    for (const selector of selectors) {
      try {
        const loc = frame.locator(selector);
        const count = await loc.count();
        for (let i = count - 1; i >= 0; i--) {
          const el = loc.nth(i);
          if (await el.isVisible().catch(() => false) && await el.isEnabled().catch(() => true)) return el;
        }
      } catch {}
    }
  }
  return null;
}

function parseMoney(raw) {
  let s = String(raw).trim().replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseProducts(text, kind) {
  let section = text;
  const markers = kind === 'flowers'
    ? [/lista de flores e pre[cç]os/ig, /lista de infloresc[eê]ncias e pre[cç]os/ig]
    : [/seu limite mensal para\s+concentrados/ig, /lista de concentrados? e pre[cç]os/ig];

  let start = -1;
  for (const re of markers) {
    let m;
    while ((m = re.exec(text))) start = Math.max(start, m.index);
  }
  if (start >= 0) section = text.slice(start);

  const unavailable = kind === 'flowers'
    ? /sem disponibilidade de (flores?|infloresc[eê]ncias?)/i.test(section)
    : /sem disponibilidade de concentrado/i.test(section);

  const products = [];
  const seen = new Set();
  const priceRe = /(?:^|\n)\s*[•●·\-–—]?\s*([^\n\r]{2,100}?)\s*[\-–—:]\s*R\$\s*([0-9][0-9.,]*)/gim;
  let match;
  while ((match = priceRe.exec(section))) {
    const name = match[1].replace(/\s+/g, ' ').trim();
    if (/lista de|limite mensal|deseja adquirir|seu limite|aviso importante/i.test(name)) continue;
    const price = parseMoney(match[2]);
    if (price === null) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    products.push({ name, price });
  }

  return {
    available: products.length > 0 || !unavailable,
    products,
    unavailable
  };
}

async function enterPatientFlow(page, cpf) {
  await page.goto(ABECMED_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForText(page, ['Sou Paciente', 'Bem-vindo'], 15000);

  if (!(await clickText(page, 'Sou Paciente', 10000))) {
    throw new Error('Não encontrei o botão “Sou Paciente”.');
  }

  await waitForText(page, ['informe seu CPF', 'CPF para continuar'], 12000);
  const input = await findEditable(page);
  if (!input) throw new Error('Não encontrei o campo do CPF.');

  try {
    await input.fill(cpf);
  } catch {
    await input.click();
    await input.press('Control+A').catch(() => {});
    await input.type(cpf, { delay: 35 });
  }
  await input.press('Enter').catch(() => {});
  await sleep(1000);

  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await hasText(page, 'Quero adquirir flores') || await hasText(page, 'Quero adquirir concentrados')) return;

    if (await hasText(page, 'Estou ciente')) {
      await clickText(page, ['Estou ciente', 'Estou ciente!'], 3000);
      await sleep(700);
      continue;
    }

    const txt = (await bodyText(page)).toLowerCase();
    if (txt.includes('cpf inválido') || txt.includes('cpf não encontrado') || txt.includes('cadastro não encontrado')) {
      throw new Error('A ABECMED não aceitou esse CPF.');
    }
    await sleep(500);
  }
  throw new Error('O menu de pedidos não apareceu após a identificação.');
}

async function scrapeCatalog(cpf) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  });
  const page = await context.newPage();

  try {
    await enterPatientFlow(page, cpf);

    if (!(await clickText(page, ['Quero adquirir flores!', 'Quero adquirir flores'], 10000))) {
      throw new Error('Não encontrei o botão de flores.');
    }
    await waitForText(page, ['Lista de flores', 'flores e preços', 'inflorescências'], 18000);
    await sleep(900);
    const flowersText = await bodyText(page);
    const flowers = parseProducts(flowersText, 'flowers');

    if (!(await clickText(page, ['VOLTAR', 'Voltar'], 9000))) {
      throw new Error('Não consegui voltar ao menu depois de ler as flores.');
    }
    await waitForText(page, ['Quero adquirir concentrados'], 12000);

    if (!(await clickText(page, ['Quero adquirir concentrados!', 'Quero adquirir concentrados'], 10000))) {
      throw new Error('Não encontrei o botão de concentrados.');
    }

    await sleep(700);
    if (await hasText(page, 'Estou ciente')) {
      await clickText(page, ['Estou ciente!', 'Estou ciente'], 5000);
    }

    await waitForText(page, ['Seu limite mensal para concentrados', 'sem disponibilidade de concentrado', 'concentrados'], 18000);
    await sleep(900);
    const concentratesText = await bodyText(page);
    const concentrates = parseProducts(concentratesText, 'concentrates');

    return {
      checkedAt: new Date().toISOString(),
      flowers,
      concentrates
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#078c91" />
<title>ABECMED Check</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f7f7;color:#152226;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px}main{max-width:620px;margin:0 auto}.card{background:white;border-radius:20px;padding:20px;margin:14px 0;box-shadow:0 5px 22px #00000012}h1{font-size:28px;margin:4px 0}.sub{color:#69777b;margin:6px 0 18px}.big{width:100%;border:0;border-radius:18px;background:#078c91;color:#fff;font-size:22px;font-weight:800;padding:21px 14px;cursor:pointer}.big:disabled{opacity:.55}.field{width:100%;font-size:19px;padding:15px;border:1px solid #c9d4d5;border-radius:14px}.label{font-weight:750;display:block;margin-bottom:8px}.muted{color:#69777b}.ok{color:#087542;font-weight:700}.error{color:#a51f2d;font-weight:700}.row{display:flex;justify-content:space-between;gap:10px;align-items:center}.badge{font-size:13px;background:#edf5f5;padding:7px 10px;border-radius:999px}.products{padding-left:22px}.products li{margin:9px 0}.changes{background:#fff4d7;border-radius:14px;padding:12px;margin-top:12px}.toggle{display:flex;gap:10px;align-items:center;margin-top:13px}.toggle input{width:20px;height:20px}
</style>
</head>
<body><main>
<div class="card"><h1>🌿 ABECMED Check</h1><p class="sub">Flores e concentrados em um botão.</p>
<label class="label" for="cpf">CPF</label><input id="cpf" class="field" inputmode="numeric" maxlength="14" placeholder="Digite uma vez" />
<p class="muted" style="font-size:13px">O CPF fica salvo somente neste navegador e é enviado apenas quando você faz a consulta.</p>
<button id="check" class="big">VERIFICAR ABECMED AGORA</button>
<label class="toggle"><input id="auto" type="checkbox"/><span>Atualizar a cada 5 min enquanto esta página estiver aberta</span></label>
<p id="status" class="muted">Pronto.</p></div>
<div class="card"><div class="row"><b>Última consulta</b><span id="time" class="badge">—</span></div><div id="changes"></div></div>
<div class="card"><h2>🌿 Flores</h2><div id="flowers" class="muted">Ainda não consultado.</div></div>
<div class="card"><h2>🍯 Concentrados</h2><div id="concentrates" class="muted">Ainda não consultado.</div></div>
</main>
<script>
const $=id=>document.getElementById(id);const cpf=$('cpf'),btn=$('check'),status=$('status'),auto=$('auto');
cpf.value=localStorage.getItem('abec_cpf')||'';auto.checked=localStorage.getItem('abec_auto')==='1';
cpf.addEventListener('input',()=>localStorage.setItem('abec_cpf',cpf.value.replace(/\\D/g,'')));
auto.addEventListener('change',()=>localStorage.setItem('abec_auto',auto.checked?'1':'0'));
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function mapSec(s){return Object.fromEntries((s?.products||[]).map(p=>[p.name.toLowerCase(),p]))}
function diffs(oldv,newv){if(!oldv)return[];const out=[];for(const [k,label] of [['flowers','Flores'],['concentrates','Concentrados']]){const a=mapSec(oldv[k]),b=mapSec(newv[k]);for(const x of Object.keys(b).filter(x=>!a[x]))out.push('🆕 '+b[x].name+' — '+money(b[x].price));for(const x of Object.keys(a).filter(x=>!b[x]))out.push('❌ '+a[x].name+' removido');for(const x of Object.keys(b).filter(x=>a[x]&&Math.abs(a[x].price-b[x].price)>.001))out.push('💲 '+b[x].name+': '+money(a[x].price)+' → '+money(b[x].price));if(oldv[k]?.available!==newv[k]?.available)out.push((newv[k].available?'✅ ':'⚠️ ')+label+(newv[k].available?' voltou a ter disponibilidade':' ficou sem disponibilidade'));}return out}
function renderSec(id,s){const el=$(id);if(!s){el.innerHTML='<span class="muted">Sem dados.</span>';return}if(s.unavailable&&!s.products.length){el.innerHTML='<b>Indisponível no momento.</b>';return}if(s.products.length){el.innerHTML='<ul class="products">'+s.products.map(p=>'<li><b>'+esc(p.name)+'</b> — '+money(p.price)+'</li>').join('')+'</ul>';return}el.innerHTML='<span class="muted">A página abriu, mas não consegui identificar os itens automaticamente.</span>'}
function render(data){const previous=JSON.parse(localStorage.getItem('abec_last')||'null');const ch=diffs(previous,data);localStorage.setItem('abec_last',JSON.stringify(data));$('time').textContent=new Date(data.checkedAt).toLocaleString('pt-BR');renderSec('flowers',data.flowers);renderSec('concentrates',data.concentrates);$('changes').innerHTML=previous?(ch.length?'<div class="changes"><b>Mudanças:</b><br>'+ch.map(esc).join('<br>')+'</div>':'<p class="muted">Nenhuma mudança desde a última consulta neste aparelho.</p>'):'<p class="muted">Primeira consulta salva como referência.</p>'}
async function run(){const digits=cpf.value.replace(/\\D/g,'');if(digits.length!==11){status.className='error';status.textContent='Digite um CPF com 11 números.';return}localStorage.setItem('abec_cpf',digits);btn.disabled=true;btn.textContent='CONSULTANDO…';status.className='muted';status.textContent='Entrando na ABECMED e lendo flores + concentrados. Pode levar alguns segundos.';try{const r=await fetch('/api/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cpf:digits})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha na consulta.');render(d);status.className='ok';status.textContent='✓ Consulta concluída.'}catch(e){status.className='error';status.textContent=e.message}finally{btn.disabled=false;btn.textContent='VERIFICAR ABECMED AGORA'}}
btn.addEventListener('click',run);setInterval(()=>{if(auto.checked&&!document.hidden)run()},300000);
</script></body></html>`;

app.get('/', (_req, res) => res.type('html').send(html));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/api/check', async (req, res) => {
  const cpf = String(req.body?.cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) return res.status(400).json({ error: 'CPF inválido.' });
  if (running) return res.status(429).json({ error: 'Já existe uma consulta em andamento. Tente novamente em alguns segundos.' });

  running = true;
  try {
    const data = await scrapeCatalog(cpf);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Não foi possível consultar a ABECMED.' });
  } finally {
    running = false;
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`ABECMED Check rodando na porta ${PORT}`));
