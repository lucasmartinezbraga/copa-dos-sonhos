#!/usr/bin/env node
'use strict';
/*
 * OS-84 · O DESFECHO DO CHUTE PASSA A SER VISÍVEL
 * ===============================================
 *
 * OBSERVAÇÃO DO DONO
 *   "o chute pra fora nao da pra ver que é pra fora, nem o chute pra dentro do
 *    gol vc nao percebe que eh pra dentro do gol"
 *
 * MEDIDO ANTES (R18.86 intocada, 27 finalizações em 4 partidas no Chromium,
 * instrumentando MatchSim.prototype.step e o desfecho de _goal/_emit):
 *
 *   chute PARA FORA (23 casos)
 *     a bola congela entre 0,90 e 3,00 m alem da linha de fundo
 *     no ar, z entre 0,45 e 1,67 m
 *     por 13 quadros (0,217 s de simulacao)
 *     a no maximo 1,24 m do poste (minimo 0,34 m)
 *     depois SALTA de 7,4 a 18,0 m de uma vez, para o pe do goleiro
 *
 *   GOL (4 casos)
 *     a bola congela a 0,90 m alem da linha e nunca entra na rede
 *
 *   NA TELA (projecao 2.5D, escala s=0,823 medida com CDS_F25D.project)
 *     bola de um chute para fora tipico ......  6,7 px do poste
 *     bola de um gol rente ao mesmo poste .... 11,3 px do poste
 *     separacao entre "entrou" e "saiu" ......  9,4 px
 *     raio desenhado da bola .................  5,1 px
 *
 *   Ou seja: menos de dois diametros de bola separam os dois desfechos, ambos
 *   parados no ar, atras da mesma linha, e o gol esta desenhado no palco
 *   estatico -- ATRAS da bola. E o unico marcador visual de "fora" nasce no pe
 *   do CHUTADOR (`fxAt(e.by,'miss')`), a ~25 m do gol.
 *
 *   Em relogio de parede o evento inteiro dura 0,217/1,8 = 0,12 s.
 *
 * MECANISMO, com arquivo:linha (R18.86)
 *   :6642  _ballTravel   -> reached||crossed => b.traveling=false; cb()
 *                           a bola PARA no alvo; nada continua a trajetoria
 *   :6525  _goal         -> dead=1.2 e a bola fica a 0,9 m da linha
 *   :7177  _goalKickOrRestart -> dead=0.2 e o goleiro recebe (o salto medido)
 *   :12451 onEvent       -> fxAt(e.by,'miss') marca o CHUTADOR, nao a linha
 *   :19613 buildStage    -> o gol e pre-renderizado no palco e vai ANTES de tudo
 *
 * HIPOTESE (direcao, nunca porcentagem -- HANDOFF §5)
 *   1. a separacao de tela entre um chute que sai e um que entra SOBE;
 *   2. o tempo de tela do desfecho SOBE;
 *   3. os agregados do motor ficam IDENTICOS (patch de apresentacao pura).
 *
 * GATE QUE DECIDE
 *   (3). Bateria pareada antes/depois, protocolo espelho_30, tres bases de 24.
 *   Se um unico agregado se mover, o patch vazou para a simulacao e cai.
 *
 * ARMADILHAS REGISTRADAS
 *   a) cx()/cy() recebem 0..1, NAO metros (HANDOFF §7). Escrever metros joga o
 *      desenho para fora do quadro -- aconteceu comigo na primeira medicao.
 *   b) o palco 2.5D e pre-renderizado uma vez e desenhado antes de tudo; para
 *      a bola aparecer DENTRO da rede a gaiola tem de ser redesenhada dentro do
 *      paintField, na mesma transformacao de camera e com a mesma projecao.
 *   c) na comemoracao o laco NAO chama sim.step (`celebrating` bloqueia). Um
 *      fantasma que avance em tempo de simulacao congela junto. Por isso ele
 *      tem relogio proprio, pautado pela mesma velocidade efetiva da tela.
 *   d) o fantasma tem de morrer no quadro em que o motor devolve a posse, ou a
 *      tela mostra duas bolas.
 */
const fs = require('fs');

const IN = process.argv[2], OUT = process.argv[3];
if (!IN || !OUT) { console.error('uso: node patch_os84_shot_verdict.js <entrada.html> <saida.html>'); process.exit(1); }
let src = fs.readFileSync(IN, 'utf8');

function edit(id, from, to, esperado) {
  const n = src.split(from).length - 1;
  if (n !== (esperado || 1)) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x (esperado ' + (esperado || 1) + ')'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

/* ── 1. estado da camada ────────────────────────────────────────────────── */
edit('os84-estado',
  "let slowmo = null;        // câmera lenta no chute perigoso { until, f }",
  "let slowmo = null;        // câmera lenta no chute perigoso { until, f }\n" +
  "/* §OS-84 · desfecho do chute visível. `shotFx` é o FANTASMA de apresentação:\n" +
  "   a continuação da trajetória que o motor interrompe quando fecha o lance.\n" +
  "   Ele não existe para a simulação — nasce de uma leitura de sim.ball, tem\n" +
  "   relógio próprio e morre no quadro em que o motor devolve a posse. */\n" +
  "let shotFx = null;        // { kind,x,y,z,vx,vy,vz,gx,gy,dir,atRight,cy,cz,t,parked,ripple }\n" +
  "let outMark = null;       // veredito na linha de fundo { kind, y, z, folga, until }\n" +
  "/* matriz viva da câmera do quadro, para projetar um ponto do mundo à mão\n" +
  "   depois do ctx.restore() — texto não pode escalar com o zoom da lente. */\n" +
  "let _camView = null;      // { z, cpx, cpy }");

/* ── 2. o motor não é tocado: o gancho é o próprio onEvent ──────────────── */
edit('os84-arma-miss',
  "  if (e.type === 'miss' && e.by) fxAt(e.by, 'miss', 0.8);",
  "  /* §OS-84 · o marcador de 'fora' nascia no pé do CHUTADOR, a ~25 m do gol.\n" +
  "     Passa a nascer onde a bola cruzou a linha de fundo, e a bola passa a\n" +
  "     cruzá-la de verdade em vez de congelar a 0,9-3,0 m dela. */\n" +
  "  if (e.type === 'miss' && e.by) { fxAt(e.by, 'miss', 0.5); armShotFx('miss', e.by); }\n" +
  "  /* O pênalti NÃO entra aqui de propósito: `penScene` é uma cena dedicada que\n" +
  "     já resolve o desfecho com o próprio 'PARA FORA!' (:13098), e paintField\n" +
  "     retorna cedo enquanto ela roda. Dois vereditos para o mesmo evento é\n" +
  "     ruído, não reforço. */");

edit('os84-arma-gol',
  "    goalFlash = { team: e.by.team, alpha: 1.0 };",
  "    goalFlash = { team: e.by.team, alpha: 1.0 };\n" +
  "    armShotFx('goal', e.by);   /* §OS-84 · a bola entra na rede antes do overlay */");

/* ── 3. física do fantasma + desenho da gaiola ──────────────────────────── */
edit('os84-funcoes',
  "function trackTrail() {\n  const b = sim.getState().ball;\n  trailPts.unshift({ x: b.x, y: b.y, z: b.z || 0 });\n  if (trailPts.length > 7) trailPts.pop();\n}",
  "function trackTrail() {\n" +
  "  const b = shotFx ? { x: shotFx.x / 105, y: shotFx.y / 68, z: shotFx.z } : sim.getState().ball;\n" +
  "  trailPts.unshift({ x: b.x, y: b.y, z: b.z || 0 });\n" +
  "  if (trailPts.length > 7) trailPts.pop();\n" +
  "}\n" +
  "\n" +
  "/* ══════════════ §OS-84 · DESFECHO DO CHUTE ═══════════════════════════════\n" +
  "   Medido na R18.86 intocada, 27 finalizações em 4 partidas: um chute para\n" +
  "   fora congela entre 0,90 e 3,00 m além da linha de fundo, no ar (z de 0,45\n" +
  "   a 1,67 m), por 13 quadros, a no máximo 1,24 m do poste — e então salta de\n" +
  "   7,4 a 18,0 m para o pé do goleiro. Na tela: 6,7 px do poste contra 11,3 px\n" +
  "   de um gol rente ao mesmo poste. Nove vírgula quatro pixels separavam\n" +
  "   'entrou' de 'saiu', com a bola de raio 5,1 px.\n" +
  "\n" +
  "   Nada aqui altera a simulação. O fantasma LÊ sim.ball no instante do\n" +
  "   desfecho e continua a parábola que o motor interrompeu. ═══════════════ */\n" +
  "const CDS_POSTE = 3.66, CDS_TRAVESSAO = 2.44, CDS_FUNDO_REDE = 2.2;\n" +
  "\n" +
  "function armShotFx(kind, by) {\n" +
  "  try {\n" +
  "    if (!sim || !by || !sim.teams || !sim.teams[by.team]) return;\n" +
  "    const b = sim.ball, tm = sim.teams[by.team], g = tm && tm.oppGoal;\n" +
  "    if (!g || !b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return;\n" +
  "    const dir = tm.attackDir || (g.x > 52.5 ? 1 : -1);\n" +
  "    let vx = b.vx, vy = b.vy, vz = b.vz || 0;\n" +
  "    if (!(Math.hypot(vx || 0, vy || 0) > 1)) { vx = dir * 24; vy = 0; vz = 0.6; }\n" +
  "    /* ONDE ANCORAR O VEREDITO — e por que NÃO no ponto de cruzamento.\n" +
  "\n" +
  "       A retro-projeção da reta até x = g.x dá o ponto em que a bola cruzou a\n" +
  "       linha de fundo, que seria o lugar geometricamente certo. Medido, porém:\n" +
  "       em 27 de 63 chutes para fora (42,9%) esse ponto cai ENTRE OS POSTES e\n" +
  "       por baixo do travessão — o motor põe o alvo do 'fora' 2 a 3 m atrás da\n" +
  "       linha e sorteia o desvio lateral para o ponto de PARADA, não para o de\n" +
  "       cruzamento (defeito OS-84B, medido e em aberto).\n" +
  "\n" +
  "       Ancorar ali desenharia um marcador de 'FORA' dentro da meta. Enquanto a\n" +
  "       geometria não for corrigida, o veredito é ancorado onde o motor de fato\n" +
  "       encerrou o lance, e a folga anunciada é a desse ponto: uma afirmação\n" +
  "       verdadeira sobre o que o jogo decidiu. */\n" +
  "    const cyM = b.y;\n" +
  "    const czM = Math.max(0, b.z || 0);\n" +
  "    const folga = Math.abs(cyM - g.y) - CDS_POSTE;   // >0 = passou por fora do poste\n" +
  "    shotFx = { kind: kind, team: by.team,\n" +
  "               x: b.x, y: b.y, z: Math.max(0, b.z || 0), vx: vx, vy: vy, vz: vz,\n" +
  "               gx: g.x, gy: g.y, dir: dir, atRight: g.x > 52.5,\n" +
  "               cy: cyM, cz: czM, t: 0, parked: 0, ripple: 0, netY: null, netZ: null };\n" +
  "    outMark = { kind: kind, y: cyM, z: czM, gy: g.y, atRight: g.x > 52.5, folga: folga,\n" +
  "                alto: czM > CDS_TRAVESSAO,\n" +
  "                until: performance.now() + (kind === 'goal' ? 2400 : 2000) };\n" +
  "    /* Câmera lenta só no chute para fora: a bola morta do motor dura 0,217 s\n" +
  "       de simulação — 0,12 s de relógio de parede no 2X. Reduzir o passo da\n" +
  "       APRESENTAÇÃO estica isso para ~0,8 s sem tirar nem acrescentar um único\n" +
  "       passo de sim.step (é a mesma alavanca do slow-mo de :12507). */\n" +
  "    if (kind !== 'goal') slowmo = { until: performance.now() + 950, f: 0.28 };\n" +
  "  } catch (_) {}\n" +
  "}\n" +
  "\n" +
  "function stepShotFx(hs) {\n" +
  "  const f = shotFx; if (!f) return;\n" +
  "  if (f.ripple > 0) f.ripple = Math.max(0, f.ripple - hs * 1.4);\n" +
  "  /* o motor devolveu a bola: o fantasma morre no mesmo quadro, ou a tela\n" +
  "     passaria a mostrar duas bolas (armadilha registrada no cabeçalho). */\n" +
  "  if (!sim || !sim.ball || sim.ball.owner || sim.ball.traveling) { shotFx = null; return; }\n" +
  "  if (f.parked) return;\n" +
  "  f.t += hs;\n" +
  "  if (f.t > 3.2) { shotFx = null; return; }\n" +
  "  let n = Math.max(1, Math.min(8, Math.ceil(hs / 0.012))); const h = hs / n;\n" +
  "  while (n-- > 0) {\n" +
  "    f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h; f.vz -= 20 * h;\n" +
  "    if (f.z < 0) { f.z = 0; f.vz = -f.vz * 0.36; f.vx *= 0.74; f.vy *= 0.74; }\n" +
  "    const alem = (f.x - f.gx) * f.dir;\n" +
  "    if (f.kind === 'goal' && (alem >= CDS_FUNDO_REDE || Math.hypot(f.vx, f.vy) < 1.5)) {\n" +
  "      f.x = f.gx + f.dir * Math.max(0.7, Math.min(alem, CDS_FUNDO_REDE));\n" +
  "      f.parked = 1; f.ripple = 1; f.netY = f.y; f.netZ = f.z;\n" +
  "      f.vx = 0; f.vy = 0; f.vz = 0;\n" +
  "      break;\n" +
  "    }\n" +
  "  }\n" +
  "}\n" +
  "\n" +
  "/* A GAIOLA DO GOL DESENHADA NA FRENTE.\n" +
  "   O palco 2.5D (:19613) pré-renderiza postes, travessão e rede e é o PRIMEIRO\n" +
  "   desenho do quadro. Com isso uma bola dentro da rede aparece por cima do gol\n" +
  "   e lê como 'parada na boca da área'. Aqui a mesma geometria é redesenhada\n" +
  "   depois da bola, com a malha translúcida: a bola que cruzou fica atrás da\n" +
  "   rede, que é exatamente o que o olho procura. */\n" +
  "function drawGoalCage(ctx, atRight, f) {\n" +
  "  const F = window.CDS_F25D; if (!F || !F.project) return;\n" +
  "  const gl = atRight ? cx(1) : cx(0), out = atRight ? 1 : -1;\n" +
  "  const goalH = (7.32 / 68) * fH;\n" +
  "  const a = F.project(gl, (CH - goalH) / 2), b = F.project(gl, (CH + goalH) / 2);\n" +
  "  const s = (a.s + b.s) / 2, hPx = 30 * s, back = 9 * s * out, rTop = hPx * 0.78;\n" +
  "  const rax = a.x + back, ray = a.y, rbx = b.x + back, rby = b.y;\n" +
  "  ctx.save();\n" +
  "  ctx.lineCap = 'round';\n" +
  "  /* malha: colunas frente->fundo e travessas horizontais no plano do fundo */\n" +
  "  ctx.lineWidth = Math.max(0.5, 0.75 * s);\n" +
  "  ctx.strokeStyle = 'rgba(228,242,255,.30)';\n" +
  "  for (let i = 0; i <= 8; i++) {\n" +
  "    const t = i / 8;\n" +
  "    const fx0 = a.x + (b.x - a.x) * t, fy0 = a.y + (b.y - a.y) * t;\n" +
  "    const rx0 = rax + (rbx - rax) * t, ry0 = ray + (rby - ray) * t;\n" +
  "    ctx.beginPath(); ctx.moveTo(fx0, fy0 - hPx); ctx.lineTo(rx0, ry0 - rTop); ctx.stroke();\n" +
  "    ctx.beginPath(); ctx.moveTo(rx0, ry0 - rTop); ctx.lineTo(rx0, ry0); ctx.stroke();\n" +
  "  }\n" +
  "  for (let j = 1; j <= 4; j++) {\n" +
  "    const u = 1 - j / 5;\n" +
  "    ctx.beginPath(); ctx.moveTo(rax, ray - rTop * u); ctx.lineTo(rbx, rby - rTop * u); ctx.stroke();\n" +
  "  }\n" +
  "  /* a rede estufa no ponto de entrada e relaxa */\n" +
  "  if (f && f.ripple > 0 && f.netY != null) {\n" +
  "    const t = Math.max(0, Math.min(1, (f.netY - (f.gy - CDS_POSTE)) / (CDS_POSTE * 2)));\n" +
  "    const hz = Math.max(0, Math.min(1, (f.netZ || 0) / CDS_TRAVESSAO));\n" +
  "    const px = rax + (rbx - rax) * t + out * 5 * s * f.ripple;\n" +
  "    const py = (ray + (rby - ray) * t) - rTop * hz;\n" +
  "    const gr = ctx.createRadialGradient(px, py, 0, px, py, 26 * s);\n" +
  "    gr.addColorStop(0, 'rgba(255,255,255,' + (0.36 * f.ripple).toFixed(3) + ')');\n" +
  "    gr.addColorStop(1, 'rgba(255,255,255,0)');\n" +
  "    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, 26 * s, 0, Math.PI * 2); ctx.fill();\n" +
  "    ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * f.ripple).toFixed(3) + ')';\n" +
  "    ctx.lineWidth = 1.3 * s;\n" +
  "    for (let k = 0; k < 3; k++) {\n" +
  "      ctx.beginPath();\n" +
  "      ctx.ellipse(px, py, (6 + k * 7) * s * (1.5 - f.ripple * 0.5), (3.4 + k * 4) * s, 0, 0, Math.PI * 2);\n" +
  "      ctx.stroke();\n" +
  "    }\n" +
  "  }\n" +
  "  /* moldura branca por cima de tudo */\n" +
  "  ctx.strokeStyle = 'rgba(250,254,255,.95)'; ctx.lineWidth = 2.6 * s;\n" +
  "  ctx.beginPath();\n" +
  "  ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - hPx);\n" +
  "  ctx.lineTo(b.x, b.y - hPx); ctx.lineTo(b.x, b.y);\n" +
  "  ctx.stroke();\n" +
  "  ctx.restore();\n" +
  "}\n" +
  "\n" +
  "/* O VEREDITO NA LINHA. Uma haste no ponto exato em que a bola cruzou a linha\n" +
  "   de fundo, verde quando entrou e vermelha quando saiu, mais o trecho da\n" +
  "   linha entre os postes aceso no gol. É o que responde 'entrou ou saiu?' sem\n" +
  "   depender de o olho medir 9,4 px. */\n" +
  "function drawLineVerdict(ctx) {\n" +
  "  const om = outMark; if (!om) return;\n" +
  "  const now = performance.now();\n" +
  "  if (now >= om.until) { outMark = null; return; }\n" +
  "  const F = window.CDS_F25D;\n" +
  "  const gl = om.atRight ? cx(1) : cx(0);\n" +
  "  const a = Math.max(0, Math.min(1, (om.until - now) / 420));\n" +
  "  const dentro = om.kind === 'goal';\n" +
  "  /* Mesmo vocabulário de cor da cena de pênalti (:13098): verde é gol, branco\n" +
  "     neutro é para fora. O vermelho está tomado por 'defendeu' e não pode ser\n" +
  "     reusado aqui. O par verde/branco também separa por luminância, o que\n" +
  "     mantém a leitura para quem não distingue verde de vermelho. */\n" +
  "  const C = dentro ? '#45df79' : '#e5ebf4';\n" +
  "  const pj = (ly) => (F && F.project) ? F.project(gl, ly) : { x: gl, y: ly, s: 1 };\n" +
  "  const p = pj(cy(om.y / 68)), s = p.s;\n" +
  "  const alturaPx = Math.max(6, Math.min(1.6, (om.z || 0) / CDS_TRAVESSAO) * 30 * s);\n" +
  "  ctx.save(); ctx.globalAlpha = a;\n" +
  "  if (dentro) {\n" +
  "    const g0 = pj(cy((om.gy - CDS_POSTE) / 68)), g1 = pj(cy((om.gy + CDS_POSTE) / 68));\n" +
  "    ctx.strokeStyle = C; ctx.lineWidth = 3.4 * s;\n" +
  "    ctx.shadowColor = C; ctx.shadowBlur = 12;\n" +
  "    ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke();\n" +
  "    ctx.shadowBlur = 0;\n" +
  "  }\n" +
  "  ctx.strokeStyle = C; ctx.lineWidth = 2.2 * s; ctx.setLineDash([5 * s, 4 * s]);\n" +
  "  ctx.beginPath(); ctx.moveTo(p.x, p.y + 4 * s); ctx.lineTo(p.x, p.y - alturaPx - 8 * s); ctx.stroke();\n" +
  "  ctx.setLineDash([]);\n" +
  "  ctx.fillStyle = C;\n" +
  "  ctx.beginPath(); ctx.arc(p.x, p.y - alturaPx - 8 * s, 3.6 * s, 0, Math.PI * 2); ctx.fill();\n" +
  "  ctx.restore();\n" +
  "}\n" +
  "\n" +
  "/* O VEREDITO ESCRITO — validação de UX, três decisões e o porquê de cada uma.\n" +
  "\n" +
  "   1. COR. O jogo já tem vocabulário próprio (:13098, :13202): verde #45df79 é\n" +
  "      GOL, vermelho #ff5d78 é DEFENDEU, e branco neutro #e5ebf4 é PARA FORA. A\n" +
  "      primeira versão desta camada pintou o 'fora' de vermelho — que neste\n" +
  "      jogo quer dizer defesa do goleiro. Colisão semântica. Aqui o fora volta\n" +
  "      ao branco neutro; de quebra o par que sobra (verde x branco) separa por\n" +
  "      LUMINÂNCIA e não por matiz, então continua legível para quem não\n" +
  "      distingue verde de vermelho.\n" +
  "\n" +
  "   2. HIERARQUIA. Um letreiro de 34 px no topo dá a um chute para fora o mesmo\n" +
  "      peso visual de um gol. O veredito passa a ser uma pílula ANCORADA no\n" +
  "      ponto de cruzamento — onde o olho já está, porque a câmera segue a bola\n" +
  "      — e o letreiro de tela cheia fica reservado ao gol.\n" +
  "\n" +
  "   3. TIPOGRAFIA NÃO ESCALA COM A CÂMERA. O texto é desenhado FORA da\n" +
  "      transformação, projetando o ponto do mundo à mão por `_camView`. Dentro\n" +
  "      dela o zoom de 1,30–1,35 mudaria o corpo da fonte conforme a lente.\n" +
  "      A pílula usa o mesmo fundo dos rótulos de nome (:13965) — mesma língua.\n" +
  "\n" +
  "   A faixa y < 52 é proibida: o HUD de bola parada (#cds-sp) tem z-index 9999\n" +
  "   e ocupa de 14 a 41 px de CSS sobre o canvas. Medido no navegador. */\n" +
  "function drawShotVerdictLabel(ctx) {\n" +
  "  const om = outMark; if (!om || om.kind === 'goal') return;\n" +
  "  const now = performance.now(); if (now >= om.until) return;\n" +
  "  const a = Math.max(0, Math.min(1, (om.until - now) / 500));\n" +
  "  const folga = om.folga;\n" +
  "  /* O rótulo não pode mentir: `folga` é a distância do ponto de CRUZAMENTO\n" +
  "     até o poste, e só é positiva quando a bola realmente saiu por fora. */\n" +
  "  const detalhe = om.alto ? 'por cima'\n" +
  "    : folga <= 0.02 ? 'na trave'\n" +
  "    : folga < 0.60 ? 'raspando o poste'\n" +
  "    : folga < 1.80 ? 'perto'\n" +
  "    : 'longe';\n" +
  "  const txt = 'FORA · ' + detalhe;\n" +
  "  const sub = Math.abs(folga).toFixed(2).replace('.', ',') + ' m do poste';\n" +
  "  /* ponto do mundo -> tela, com a mesma matriz que a câmera aplicou */\n" +
  "  const F = window.CDS_F25D;\n" +
  "  const gl = om.atRight ? cx(1) : cx(0);\n" +
  "  const p0 = (F && F.project) ? F.project(gl, cy(om.y / 68)) : { x: gl, y: cy(om.y / 68), s: 1 };\n" +
  "  const V = _camView || { z: 1, cpx: CW / 2, cpy: CH / 2 };\n" +
  "  const ax = (p0.x - V.cpx) * V.z + CW / 2;      // ancora: o ponto de cruzamento\n" +
  "  const ay = (p0.y - V.cpy) * V.z + CH / 2;\n" +
  "  ctx.save(); ctx.globalAlpha = a;\n" +
  "  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';\n" +
  "  ctx.font = \"800 17px 'Barlow Condensed',Arial,sans-serif\";\n" +
  "  const w = Math.max(104, ctx.measureText(txt).width + 26), h = 38;\n" +
  "  /* POSICIONAMENTO. A pílula sai para o lado do CAMPO, nunca para cima da\n" +
  "     boca do gol: a bola escapa para fora e é justamente a relação dela com o\n" +
  "     poste que o olho precisa ver. Colocá-la acima do cruzamento cobriria o\n" +
  "     travessão — o objeto de interesse. Ela também sobe um pouco, para não\n" +
  "     disputar espaço com o goleiro e a zaga, que ficam logo abaixo da linha. */\n" +
  "  const paraDentro = om.atRight ? -1 : 1;\n" +
  "  let px = ax + paraDentro * (w / 2 + 34);\n" +
  "  let py = ay - 62;\n" +
  "  px = Math.max(w / 2 + 8, Math.min(CW - w / 2 - 8, px));\n" +
  "  py = Math.max(52 + h / 2, Math.min(CH - h / 2 - 10, py));   // nunca sob o HUD\n" +
  "  /* linha de chamada: liga o rótulo ao ponto exato, que é o que o torna uma\n" +
  "     legenda e não um aviso solto (Gestalt, conexão). */\n" +
  "  ctx.strokeStyle = 'rgba(232,237,247,.42)'; ctx.lineWidth = 1;\n" +
  "  ctx.beginPath();\n" +
  "  ctx.moveTo(px - paraDentro * (w / 2), py);\n" +
  "  ctx.lineTo(ax - paraDentro * 6, ay - 10);\n" +
  "  ctx.stroke();\n" +
  "  ctx.fillStyle = 'rgba(4,8,18,.82)';\n" +
  "  ctx.beginPath(); ctx.roundRect(px - w / 2, py - h / 2, w, h, 9); ctx.fill();\n" +
  "  ctx.strokeStyle = 'rgba(232,237,247,.34)';\n" +
  "  ctx.beginPath(); ctx.roundRect(px - w / 2, py - h / 2, w, h, 9); ctx.stroke();\n" +
  "  ctx.fillStyle = '#e5ebf4';\n" +
  "  ctx.fillText(txt, px, py - 7);\n" +
  "  ctx.font = \"600 12px 'Barlow Condensed',Arial,sans-serif\";\n" +
  "  ctx.fillStyle = 'rgba(232,237,247,.62)';\n" +
  "  ctx.fillText(sub, px, py + 11);\n" +
  "  ctx.restore();\n" +
  "}");

/* ── 3b. a bola na rede ganha tempo de retina antes do overlay ──────────── */
edit('os84-batida-do-gol',
  "    const celebStart = Math.max(now0, sceneUntil ? sceneUntil + 120 : now0);",
  "    /* §OS-84 · a comemoração cobria a tela no MESMO quadro do gol. Como a\n" +
  "       bola percorre os 1,1 m da linha até o fundo da rede em 0,03 s, o\n" +
  "       instante em que ela estufa a malha durava um quadro e ninguém o via —\n" +
  "       que é exatamente a metade da queixa (\"não percebo que é pra dentro\").\n" +
  "       620 ms de batida antes do overlay. Nenhum passo de simulação é criado\n" +
  "       nem perdido: `celebrating` já suspende sim.step desde o quadro do gol,\n" +
  "       e o acumulador é zerado quando a comemoração acaba (:12655). */\n" +
  "    const celebStart = Math.max(now0 + 620, sceneUntil ? sceneUntil + 120 : now0);",
  1);

/* ── 4. relógio do fantasma, pautado pela velocidade efetiva da tela ────── */
edit('os84-relogio',
  "    paintField();                          // campo nunca congela (fix)",
  "    /* §OS-84 · o fantasma tem relógio próprio: durante a comemoração o laço\n" +
  "       NÃO chama sim.step (o gate `celebrating` bloqueia), e um fantasma preso\n" +
  "       ao tempo de simulação congelaria junto com ela. Aqui ele anda pela\n" +
  "       MESMA velocidade efetiva da apresentação — a de :12611 — e nenhum passo\n" +
  "       de simulação é criado ou perdido por causa dele. */\n" +
  "    if (shotFx && !paused) stepShotFx(Math.min(0.05, dt) * (slowmo ? Math.min(G.speed, 1) * slowmo.f : G.speed));\n" +
  "    if (outMark && performance.now() >= outMark.until) outMark = null;\n" +
  "    paintField();                          // campo nunca congela (fix)");

/* ── 5. a câmera segue o fantasma ───────────────────────────────────────── */
edit('os84-camera',
  "    } else if (sim) {\n" +
  "      const sb = sim.getState().ball;\n" +
  "      let tx = cx(sb.x), ty = cy(sb.y);",
  "    } else if (sim) {\n" +
  "      /* §OS-84 · com a bola do motor congelada, a câmera parava e a bola saía\n" +
  "         do quadro. Enquanto o fantasma vive, ele é o alvo da câmera. */\n" +
  "      const sb = shotFx ? { x: shotFx.x / 105, y: shotFx.y / 68 } : sim.getState().ball;\n" +
  "      let tx = cx(sb.x), ty = cy(sb.y);");

/* ── 5b. guarda a matriz da câmera do quadro ────────────────────────────── */
edit('os84-matriz-camera',
  "    ctx.translate(CW / 2, CH / 2);\n" +
  "    ctx.scale(z, z);\n" +
  "    ctx.translate(-cpx, -cpy);\n" +
  "  } else {\n" +
  "    camX = CW / 2;\n" +
  "    camY = CH / 2;\n" +
  "  }",
  "    ctx.translate(CW / 2, CH / 2);\n" +
  "    ctx.scale(z, z);\n" +
  "    ctx.translate(-cpx, -cpy);\n" +
  "    _camView = { z: z, cpx: cpx, cpy: cpy };   /* §OS-84 · para projetar texto fora do zoom */\n" +
  "  } else {\n" +
  "    camX = CW / 2;\n" +
  "    camY = CH / 2;\n" +
  "    _camView = { z: 1, cpx: CW / 2, cpy: CH / 2 };\n" +
  "  }");

/* ── 6. a bola desenhada é o fantasma; gaiola e veredito por cima ───────── */
edit('os84-desenho',
  "  /* bola */\n" +
  "  const b = rframe ? rframe.ball : st.ball;\n" +
  "  const bx=cx(b.x), by=cy(b.y)-(b.z||0)*22;",
  "  /* §OS-84 · veredito na linha, desenhado ANTES da bola para não cobri-la */\n" +
  "  if (!rframe) drawLineVerdict(ctx);\n" +
  "\n" +
  "  /* bola — enquanto o fantasma vive, ele É a bola na tela */\n" +
  "  const b = rframe ? rframe.ball\n" +
  "          : shotFx ? { x: shotFx.x / 105, y: shotFx.y / 68, z: shotFx.z }\n" +
  "          : st.ball;\n" +
  "  const bx=cx(b.x), by=cy(b.y)-(b.z||0)*22;");

edit('os84-gaiola',
  "  ctx.restore();   // fim do mundo com câmera",
  "  /* §OS-84 · a gaiola do gol por cima da bola. Sem isto a bola dentro da rede\n" +
  "     é desenhada SOBRE o gol (o palco é pré-renderizado e vai primeiro) e um\n" +
  "     gol fica idêntico a uma bola parada na boca da área. Só é desenhada\n" +
  "     quando importa: no desfecho, no veredito, ou com um chute em voo. */\n" +
  "  if (!rframe) {\n" +
  "    let cage = null;\n" +
  "    if (shotFx) cage = shotFx.atRight;\n" +
  "    else if (outMark) cage = outMark.atRight;\n" +
  "    else if (bT && bT.traveling && bT.kind === 'shot' && bT.target)\n" +
  "      cage = bT.target.x > 0.5;\n" +
  "    else if (b && (b.x > 0.955 || b.x < 0.045)) cage = b.x > 0.5;\n" +
  "    if (cage !== null) drawGoalCage(ctx, cage, shotFx);\n" +
  "  }\n" +
  "\n" +
  "  ctx.restore();   // fim do mundo com câmera\n" +
  "  if (!rframe) drawShotVerdictLabel(ctx);   /* §OS-84 · rótulo em espaço de tela */");

/* ── 7. limpeza nos reinícios ───────────────────────────────────────────── */
edit('os84-reset-partida',
  "trailPts=[]; goalFlash=null; celebration=null; replay=null; replayBuf=[]; penScene=null;",
  "trailPts=[]; goalFlash=null; shotFx=null; outMark=null; celebration=null; replay=null; replayBuf=[]; penScene=null;",
  2);

edit('os84-reset-apito',
  "  breakOv = null; slowmo = null; goalFlash = null;",
  "  breakOv = null; slowmo = null; goalFlash = null; shotFx = null; outMark = null;");

fs.writeFileSync(OUT, src, 'utf8');
const crypto = require('crypto');
console.log('\nescrito ->', OUT);
console.log('bytes   ->', Buffer.byteLength(src, 'utf8'));
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
