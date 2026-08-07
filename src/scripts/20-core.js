/* ═══════════ core.js ═══════════ */
/* ============================================================================
   CORE — helpers globais, sistema de posições, atributos, formações, buildDB
   Módulo PURO (sem DOM). Testável em Node via vm.
   ========================================================================== */

/* ------------------------------ HELPERS ---------------------------------- */
let _seed = 0x9e3779b9 >>> 0;
function srand(s){ _seed = (s >>> 0) || 1; }
function R(a, b){
  // gerador determinístico (xorshift) -> float
  _seed ^= _seed << 13; _seed >>>= 0;
  _seed ^= _seed >> 17;
  _seed ^= _seed << 5;  _seed >>>= 0;
  const u = _seed / 4294967296;
  if (a === undefined) return u;
  if (b === undefined) return u * a;
  return a + u * (b - a);
}
function Ri(a, b){ return Math.floor(R(a, b + 1)); }        // inteiro [a,b]
function chance(p){ return R() < p; }
function pick(arr){ return arr[Math.floor(R() * arr.length)]; }
function pickw(arr, weights){                                // escolha ponderada
  let tot = 0; for (const w of weights) tot += w;
  let r = R() * tot;
  for (let i = 0; i < arr.length; i++){ r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function clamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t){ return a + (b - a) * t; }
function D(x1, y1, x2, y2){ const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
function dist2(x1, y1, x2, y2){ const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
function rint(v){ return Math.round(v); }
function poisson(lambda){
  // Knuth
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= R(); } while (p > L);
  return k - 1;
}
function hash32(str){
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shortName(name){
  // "Carlos Alberto" -> "C. Alberto"; nome único fica inteiro
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0][0] + '. ' + parts[parts.length - 1];
}
function lastName(name){
  const parts = String(name).trim().split(/\s+/);
  return parts[parts.length - 1];
}

/* --------------------------- POSIÇÕES / SLOTS ---------------------------- */
// 15 slots canônicos usados nas formações
const SLOTS = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','CF','ST'];
const LINE_OF = {
  GK:'GK',
  CB:'DEF', LB:'DEF', RB:'DEF', LWB:'DEF', RWB:'DEF',
  CDM:'MID', CM:'MID', CAM:'MID', LM:'MID', RM:'MID',
  LW:'FWD', RW:'FWD', CF:'FWD', ST:'FWD'
};
// rótulos pt-BR
const SLOT_PT = {
  GK:'GOL', CB:'ZAG', LB:'LE', RB:'LD', LWB:'ALE', RWB:'ALD',
  CDM:'VOL', CM:'MC', CAM:'MEI', LM:'ME', RM:'MD',
  LW:'PE', RW:'PD', CF:'SA', ST:'CA'
};
// classe fina de atributos por slot (define o "perfil" físico/técnico)
const SLOT_CLASS = {
  GK:'GK', CB:'CB', LB:'FB', RB:'FB', LWB:'FB', RWB:'FB',
  CDM:'DM', CM:'CM', CAM:'AM', LM:'WM', RM:'WM',
  LW:'WG', RW:'WG', CF:'FC', ST:'FC'
};

/* ═══════════════════════════════════════════════════════════════════════
   SISTEMA DE PAPÉIS (FC 26) · CATÁLOGO POR CLASSE DE POSIÇÃO
   ═══════════════════════════════════════════════════════════════════════
   ROLE_CATALOG[classe] = lista de funções; cada função tem foco(s) válidos e
   um fx-base (empuxo/abertura) que DESLOCA o comportamento-raiz da posição —
   ele nunca anula a posição (o Tópico 3 mantém os tetos/corredores sagrados).
     · push  = metros de empuxo à frente (ofensivo +, defensivo −)
     · wide  = abertura lateral extra (−0,20 fecha por dentro … +0,20 cola na linha)
     · deep  = viés de corridas em profundidade (0..1; usado na Fase 2)
   O FOCO ajusta o empuxo: Ataque soma avanço, Defesa recua e segura. As
   classes vêm de SLOT_CLASS (GK, CB, FB, DM, CM, AM, WM, WG, FC). */
const ROLE_CATALOG = {
  GK: [
    { id:'gk_seguro',  n:'Goleiro',          foci:['bal'],              fx:{push:0,  wide:0,   deep:0} },
    { id:'gk_libero',  n:'Goleiro-líbero',   foci:['bal','atk'],        fx:{push:2,  wide:0,   deep:0} },
  ],
  CB: [
    { id:'cb_defensor',n:'Zagueiro',         foci:['def','bal'],        fx:{push:-3, wide:0,   deep:0} },
    { id:'cb_saida',   n:'Zagueiro de saída',foci:['bal'],              fx:{push:0,  wide:.04, deep:0} },
    { id:'cb_libero',  n:'Líbero',           foci:['bal','atk'],        fx:{push:4,  wide:0,   deep:.1} },
  ],
  FB: [
    { id:'fb_defensivo',n:'Lateral defensivo',foci:['def','bal'],       fx:{push:-6, wide:.02, deep:0} },
    { id:'fb_equilibrado',n:'Lateral equilibrado',foci:['def','bal','atk'],fx:{push:0, wide:.06, deep:.15} },
    { id:'fb_ofensivo',n:'Ala de apoio',     foci:['bal','atk'],        fx:{push:11, wide:.14, deep:.4} },
    { id:'fb_invertido',n:'Lateral por dentro',foci:['bal','def'],      fx:{push:2,  wide:-.16,deep:.1} },
  ],
  DM: [
    { id:'dm_contencao',n:'Volante de contenção',foci:['def','bal'],    fx:{push:-6, wide:0,   deep:0} },
    { id:'dm_construtor',n:'Volante construtor',foci:['def','bal'],      fx:{push:-2, wide:.04, deep:.1} },
    { id:'dm_b2b',     n:'Volante box-to-box',foci:['bal','atk'],       fx:{push:8,  wide:.04, deep:.45} },
  ],
  CM: [
    { id:'cm_b2b',     n:'Meia box-to-box',  foci:['bal','atk'],        fx:{push:5,  wide:.04, deep:.4} },
    { id:'cm_armador', n:'Meia armador',     foci:['bal'],              fx:{push:0,  wide:.05, deep:.2} },
    { id:'cm_contencao',n:'Meia de contenção',foci:['def','bal'],       fx:{push:-5, wide:0,   deep:.05} },
  ],
  AM: [
    { id:'am_armador', n:'Armador',          foci:['bal'],              fx:{push:-2, wide:.06, deep:.25} },
    { id:'am_sombra',  n:'Sombra do atacante',foci:['bal','atk'],       fx:{push:9,  wide:0,   deep:.6} },
    { id:'am_espaco',  n:'Meia entrelinhas', foci:['bal','atk'],        fx:{push:3,  wide:.1,  deep:.4} },
  ],
  WM: [
    { id:'wm_equilibrado',n:'Meia-lateral equilibrado',foci:['def','bal','atk'],fx:{push:0,wide:.1,deep:.3} },
    { id:'wm_ofensivo',n:'Meia-lateral ofensivo',foci:['bal','atk'],    fx:{push:8,  wide:.12, deep:.5} },
    { id:'wm_invertido',n:'Meia-lateral por dentro',foci:['bal'],       fx:{push:3,  wide:-.12,deep:.4} },
  ],
  WG: [
    { id:'wg_aberta',  n:'Ponta aberta',     foci:['bal','atk'],        fx:{push:4,  wide:.16, deep:.55} },
    { id:'wg_invertida',n:'Ponta invertida', foci:['bal','atk'],        fx:{push:6,  wide:-.18,deep:.6} },
    { id:'wg_atacante',n:'Ponta-atacante',   foci:['atk'],              fx:{push:9,  wide:.06, deep:.7} },
  ],
  FC: [
    { id:'fc_artilheiro',n:'Artilheiro',     foci:['bal','atk'],        fx:{push:6,  wide:0,   deep:.6} },
    { id:'fc_completo',n:'Camisa 9 completo', foci:['bal','atk'],       fx:{push:2,  wide:.04, deep:.5} },
    { id:'fc_falso',   n:'Falso 9',          foci:['bal'],              fx:{push:-8, wide:.06, deep:.35} },
    { id:'fc_alvo',    n:'Homem-alvo',       foci:['bal','atk'],        fx:{push:3,  wide:0,   deep:.3} },
  ],
};
const FOCUS_PT = { def:'Defesa', bal:'Equilibrado', atk:'Ataque' };
// papel padrão de cada classe = a função "equilibrada" (índice canônico).
const DEFAULT_ROLE = { GK:'gk_seguro', CB:'cb_defensor', FB:'fb_equilibrado', DM:'dm_construtor',
  CM:'cm_b2b', AM:'am_armador', WM:'wm_equilibrado', WG:'wg_aberta', FC:'fc_completo' };
function rolesForSlot(pos){ return ROLE_CATALOG[SLOT_CLASS[pos] || 'CM'] || ROLE_CATALOG.CM; }
function findRole(roleId){
  for (const k in ROLE_CATALOG){ const r = ROLE_CATALOG[k].find(x => x.id === roleId); if (r) return r; }
  return null;
}
function defaultRoleFor(pos){ return DEFAULT_ROLE[SLOT_CLASS[pos] || 'CM'] || 'cm_b2b'; }
/* Tradução PAPEL+FOCO → deltas de comportamento consumidos pelo mkHomes/IA.
   O foco desloca o empuxo: Ataque avança, Defesa recua e segura a linha. */
function roleFx(roleId, focus){
  const r = findRole(roleId);
  const base = r ? r.fx : { push:0, wide:0, deep:0 };
  const f = focus || 'bal';
  const fpush = f === 'atk' ? 5 : f === 'def' ? -6 : 0;
  const fdeep = f === 'atk' ? .12 : f === 'def' ? -.12 : 0;
  return { push: base.push + fpush, wide: base.wide,
           deep: clamp((base.deep || 0) + fdeep, 0, 1) };
}
const DEF = ['CB','LB','RB','LWB','RWB'];
const MID = ['CDM','CM','CAM','LM','RM'];
const FWD = ['LW','RW','CF','ST'];

// ELEGIBILIDADE por código amplo do CSV (resolvida no LAYER de mapeamento).
// Ordem do pipe = primário|secundário; expandimos com bom senso, sem editar o CSV.
const ELIG = {
  'GK'      : ['GK'],
  'DF'      : [...DEF, 'CDM'],
  'DF|MF'   : [...DEF, 'CDM', 'CM'],
  'MF|DF'   : [...MID, ...DEF],
  'MF'      : [...MID],
  'MF|FW'   : [...MID, 'LW', 'RW', 'CF'],
  'FW|MF'   : ['LW','RW','CF','ST', 'CAM','LM','RM'],
  'MF|DF|FW': [...DEF, ...MID, 'LW','RW','CF','ST'],
  'FW'      : ['LW','RW','CF','ST']
};
function eligibleSlots(posCode){ return ELIG[posCode] || [...MID]; }

/* V2: posições específicas → elegibilidade por vizinhança futebolística.
   Generosa de propósito: a base V2 tem poucos laterais/pontas "puros",
   então zagueiros improvisam na lateral, meias abrem etc. */
const ELIG_V2 = {
  GK:  ['GK'],
  CB:  ['CB','RB','LB','CDM'],
  LB:  ['LB','LWB','LM','CB','RB'],
  RB:  ['RB','RWB','RM','CB','LB'],
  LWB: ['LWB','LB','LM','LW'],
  RWB: ['RWB','RB','RM','RW'],
  CDM: ['CDM','CM','CB'],
  CM:  ['CM','CDM','CAM','LM','RM'],
  CAM: ['CAM','CM','LW','RW','CF'],
  LM:  ['LM','LW','LWB','CM','RM'],
  RM:  ['RM','RW','RWB','CM','LM'],
  LW:  ['LW','LM','RW','ST','CAM'],
  RW:  ['RW','RM','LW','ST','CAM'],
  CF:  ['CF','ST','CAM'],
  ST:  ['ST','CF','LW','RW'],
};
function eligibleSlotsV2(posCode){
  const set = new Set();
  for (const p of posCode.split('|')) for (const e of (ELIG_V2[p] || [p])) set.add(e);
  return [...set];
}
function canPlay(player, slot){ return player.elig.indexOf(slot) !== -1; }
function _draftCanProgress(d){
  if(!d||!d.cur||!d.cur.pl) return true;
  const taken = pickedIds();
  const avail = d.cur.pl.filter(p=>!taken.has(p.id));
  return d.slots.filter(s=>!s.p).every(s=> avail.some(p=>canPlay(p,s.pos)));
}
function primaryLine(posCode){
  const t = posCode.split('|')[0];
  return t === 'GK' ? 'GK' : t === 'DF' ? 'DEF' : t === 'FW' ? 'FWD' : 'MID';
}

/* ------------------------------ FORMAÇÕES -------------------------------- */
// Coordenadas no "frame de ataque": x = profundidade (0 gol próprio -> 1 gol adversário),
// y = largura (0 esquerda -> 1 direita). 11 slots. As variações trocam papéis/posições.
function F(pos, x, y){ return { pos, x, y }; }
const FORMATIONS = {
  '4-3-3': {
    name: '4-3-3',
    variations: [
      { name: 'Pontas abertos', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CM',0.48,0.30),F('CDM',0.42,0.50),F('CM',0.48,0.70),
        F('LW',0.76,0.16),F('ST',0.80,0.50),F('RW',0.76,0.84) ] },
      { name: 'Falsa 9', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CM',0.48,0.30),F('CDM',0.42,0.50),F('CM',0.48,0.70),
        F('LW',0.74,0.18),F('CF',0.72,0.50),F('RW',0.74,0.82) ] },
      { name: 'Com meia-armador', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.40,0.42),F('CDM',0.40,0.58),F('CAM',0.60,0.50),
        F('LW',0.76,0.16),F('ST',0.80,0.50),F('RW',0.76,0.84) ] }
    ]
  },
  '4-4-2': {
    name: '4-4-2',
    variations: [
      { name: 'Linha (2 pontas)', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('LM',0.52,0.16),F('CM',0.46,0.40),F('CM',0.46,0.60),F('RM',0.52,0.84),
        F('ST',0.78,0.40),F('ST',0.78,0.60) ] },
      { name: 'Losango', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.40,0.50),F('CM',0.50,0.28),F('CM',0.50,0.72),F('CAM',0.62,0.50),
        F('ST',0.80,0.40),F('ST',0.80,0.60) ] },
      { name: 'Com 2 volantes', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.42,0.38),F('CDM',0.42,0.62),F('LM',0.56,0.18),F('RM',0.56,0.82),
        F('ST',0.78,0.40),F('ST',0.78,0.60) ] }
    ]
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    variations: [
      { name: 'Meias por dentro', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.40,0.38),F('CDM',0.40,0.62),
        F('CAM',0.62,0.28),F('CAM',0.64,0.50),F('CAM',0.62,0.72),
        F('ST',0.82,0.50) ] },
      { name: 'Alas ofensivos', slots: [
        F('GK',0.06,0.50), F('LB',0.28,0.12),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.28,0.88),
        F('CDM',0.40,0.38),F('CDM',0.40,0.62),
        F('LW',0.66,0.16),F('CAM',0.62,0.50),F('RW',0.66,0.84),
        F('ST',0.82,0.50) ] }
    ]
  },
  '3-5-2': {
    name: '3-5-2',
    variations: [
      { name: 'Com alas', slots: [
        F('GK',0.06,0.50), F('CB',0.22,0.30),F('CB',0.20,0.50),F('CB',0.22,0.70),
        F('LWB',0.50,0.12),F('CDM',0.42,0.50),F('CM',0.52,0.32),F('CM',0.52,0.68),F('RWB',0.50,0.88),
        F('ST',0.80,0.40),F('ST',0.80,0.60) ] },
      { name: '2 volantes + meia', slots: [
        F('GK',0.06,0.50), F('CB',0.22,0.30),F('CB',0.20,0.50),F('CB',0.22,0.70),
        F('LWB',0.48,0.12),F('CDM',0.40,0.40),F('CDM',0.40,0.60),F('CAM',0.62,0.50),F('RWB',0.48,0.88),
        F('ST',0.80,0.40),F('ST',0.80,0.60) ] }
    ]
  },
  '5-3-2': {
    name: '5-3-2',
    variations: [
      { name: 'Defensivo', slots: [
        F('GK',0.06,0.50), F('LWB',0.30,0.10),F('CB',0.20,0.32),F('CB',0.18,0.50),F('CB',0.20,0.68),F('RWB',0.30,0.90),
        F('CM',0.48,0.32),F('CDM',0.42,0.50),F('CM',0.48,0.68),
        F('ST',0.78,0.40),F('ST',0.78,0.60) ] },
      { name: 'Alas altos', slots: [
        F('GK',0.06,0.50), F('LWB',0.40,0.10),F('CB',0.20,0.32),F('CB',0.18,0.50),F('CB',0.20,0.68),F('RWB',0.40,0.90),
        F('CM',0.50,0.30),F('CAM',0.60,0.50),F('CM',0.50,0.70),
        F('ST',0.80,0.40),F('ST',0.80,0.60) ] }
    ]
  },
  '4-3-1-2': {
    name: '4-3-1-2',
    variations: [
      { name: 'Meia clássico', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CM',0.46,0.30),F('CDM',0.42,0.50),F('CM',0.46,0.70),
        F('CAM',0.62,0.50), F('ST',0.80,0.40),F('ST',0.80,0.60) ] },
      { name: 'Com 2 volantes', slots: [
        F('GK',0.06,0.50), F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.42,0.40),F('CDM',0.42,0.60),F('CM',0.52,0.50),
        F('CAM',0.64,0.50), F('ST',0.80,0.40),F('ST',0.80,0.60) ] }
    ]
  },
  '4-1-4-1': {
    name: '4-1-4-1',
    variations: [
      { name: 'Linha de quatro', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.40,0.50),F('LM',0.55,0.16),F('CM',0.50,0.39),F('CM',0.50,0.61),F('RM',0.55,0.84),F('ST',0.82,0.50) ] },
      { name: 'Pontas agressivos', slots: [
        F('GK',0.06,0.50),F('LB',0.27,0.13),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.27,0.87),
        F('CDM',0.40,0.50),F('CM',0.52,0.37),F('CM',0.52,0.63),F('LW',0.68,0.16),F('RW',0.68,0.84),F('ST',0.83,0.50) ] }
    ]
  },
  '4-3-2-1': {
    name: '4-3-2-1',
    variations: [
      { name: 'Árvore de Natal', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CM',0.48,0.30),F('CDM',0.42,0.50),F('CM',0.48,0.70),F('CAM',0.66,0.38),F('CAM',0.66,0.62),F('ST',0.82,0.50) ] },
      { name: 'Dois segundos atacantes', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CM',0.47,0.30),F('CDM',0.41,0.50),F('CM',0.47,0.70),F('CF',0.70,0.38),F('CF',0.70,0.62),F('ST',0.84,0.50) ] }
    ]
  },
  '4-2-2-2': {
    name: '4-2-2-2',
    variations: [
      { name: 'Meias por dentro', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.41,0.38),F('CDM',0.41,0.62),F('CAM',0.62,0.31),F('CAM',0.62,0.69),F('ST',0.80,0.40),F('ST',0.80,0.60) ] },
      { name: 'Meias abertos', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.42,0.40),F('CDM',0.42,0.60),F('LM',0.60,0.16),F('RM',0.60,0.84),F('ST',0.80,0.40),F('ST',0.80,0.60) ] }
    ]
  },
  '4-5-1': {
    name: '4-5-1',
    variations: [
      { name: 'Bloco compacto', slots: [
        F('GK',0.06,0.50),F('LB',0.25,0.14),F('CB',0.21,0.38),F('CB',0.21,0.62),F('RB',0.25,0.86),
        F('LM',0.50,0.15),F('CM',0.47,0.34),F('CDM',0.41,0.50),F('CM',0.47,0.66),F('RM',0.50,0.85),F('ST',0.79,0.50) ] },
      { name: 'V ofensivo', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.40,0.50),F('CM',0.51,0.36),F('CM',0.51,0.64),F('LW',0.66,0.16),F('RW',0.66,0.84),F('ST',0.82,0.50) ] }
    ]
  },
  '3-4-3': {
    name: '3-4-3',
    variations: [
      { name: 'Pontas abertos', slots: [
        F('GK',0.06,0.50),F('CB',0.21,0.29),F('CB',0.19,0.50),F('CB',0.21,0.71),
        F('LWB',0.49,0.11),F('CM',0.47,0.39),F('CM',0.47,0.61),F('RWB',0.49,0.89),
        F('LW',0.75,0.16),F('ST',0.81,0.50),F('RW',0.75,0.84) ] },
      { name: 'Trio por dentro', slots: [
        F('GK',0.06,0.50),F('CB',0.21,0.29),F('CB',0.19,0.50),F('CB',0.21,0.71),
        F('LWB',0.49,0.11),F('CM',0.47,0.39),F('CM',0.47,0.61),F('RWB',0.49,0.89),
        F('CF',0.72,0.34),F('ST',0.82,0.50),F('CF',0.72,0.66) ] }
    ]
  },
  '3-4-2-1': {
    name: '3-4-2-1',
    variations: [
      { name: 'Dois meias', slots: [
        F('GK',0.06,0.50),F('CB',0.21,0.29),F('CB',0.19,0.50),F('CB',0.21,0.71),
        F('LWB',0.49,0.11),F('CM',0.46,0.39),F('CM',0.46,0.61),F('RWB',0.49,0.89),
        F('CAM',0.67,0.37),F('CAM',0.67,0.63),F('ST',0.83,0.50) ] },
      { name: 'Volante + armador', slots: [
        F('GK',0.06,0.50),F('CB',0.21,0.29),F('CB',0.19,0.50),F('CB',0.21,0.71),
        F('LWB',0.49,0.11),F('CDM',0.40,0.43),F('CM',0.49,0.60),F('RWB',0.49,0.89),
        F('CAM',0.65,0.37),F('CAM',0.68,0.63),F('ST',0.83,0.50) ] }
    ]
  },
  '5-2-3': {
    name: '5-2-3',
    variations: [
      { name: 'Alas equilibrados', slots: [
        F('GK',0.06,0.50),F('LWB',0.33,0.10),F('CB',0.21,0.31),F('CB',0.19,0.50),F('CB',0.21,0.69),F('RWB',0.33,0.90),
        F('CM',0.48,0.39),F('CM',0.48,0.61),F('LW',0.73,0.17),F('ST',0.80,0.50),F('RW',0.73,0.83) ] },
      { name: 'Duplo volante', slots: [
        F('GK',0.06,0.50),F('LWB',0.31,0.10),F('CB',0.21,0.31),F('CB',0.19,0.50),F('CB',0.21,0.69),F('RWB',0.31,0.90),
        F('CDM',0.42,0.39),F('CDM',0.42,0.61),F('LW',0.72,0.17),F('ST',0.80,0.50),F('RW',0.72,0.83) ] }
    ]
  },
  '5-4-1': {
    name: '5-4-1',
    variations: [
      { name: 'Linha de quatro', slots: [
        F('GK',0.06,0.50),F('LWB',0.31,0.10),F('CB',0.20,0.31),F('CB',0.18,0.50),F('CB',0.20,0.69),F('RWB',0.31,0.90),
        F('LM',0.51,0.16),F('CM',0.47,0.40),F('CM',0.47,0.60),F('RM',0.51,0.84),F('ST',0.78,0.50) ] },
      { name: 'Bloco baixo', slots: [
        F('GK',0.06,0.50),F('LWB',0.27,0.10),F('CB',0.19,0.31),F('CB',0.17,0.50),F('CB',0.19,0.69),F('RWB',0.27,0.90),
        F('LM',0.47,0.16),F('CDM',0.40,0.40),F('CDM',0.40,0.60),F('RM',0.47,0.84),F('ST',0.76,0.50) ] }
    ]
  },
  '4-2-4': {
    name: '4-2-4',
    variations: [
      { name: 'Duplo volante', slots: [
        F('GK',0.06,0.50),F('LB',0.27,0.13),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.27,0.87),
        F('CDM',0.43,0.41),F('CDM',0.43,0.59),F('LW',0.74,0.15),F('ST',0.81,0.40),F('ST',0.81,0.60),F('RW',0.74,0.85) ] },
      { name: 'Dois meias', slots: [
        F('GK',0.06,0.50),F('LB',0.27,0.13),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.27,0.87),
        F('CM',0.47,0.40),F('CM',0.47,0.60),F('LW',0.74,0.15),F('ST',0.81,0.40),F('ST',0.81,0.60),F('RW',0.74,0.85) ] }
    ]
  },
  '3-1-4-2': {
    name: '3-1-4-2',
    variations: [
      { name: 'Volante central', slots: [
        F('GK',0.06,0.50),F('CB',0.21,0.29),F('CB',0.19,0.50),F('CB',0.21,0.71),F('CDM',0.39,0.50),
        F('LM',0.55,0.14),F('CM',0.51,0.39),F('CM',0.51,0.61),F('RM',0.55,0.86),F('ST',0.80,0.40),F('ST',0.80,0.60) ] },
      { name: 'Alas em vez de meias', slots: [
        F('GK',0.06,0.50),F('CB',0.21,0.29),F('CB',0.19,0.50),F('CB',0.21,0.71),F('CDM',0.39,0.50),
        F('LWB',0.52,0.11),F('CM',0.51,0.39),F('CM',0.51,0.61),F('RWB',0.52,0.89),F('ST',0.80,0.40),F('ST',0.80,0.60) ] }
    ]
  },
  '4-1-2-1-2': {
    name: '4-1-2-1-2',
    variations: [
      { name: 'Losango estreito', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.40,0.50),F('CM',0.51,0.32),F('CM',0.51,0.68),F('CAM',0.64,0.50),F('ST',0.81,0.40),F('ST',0.81,0.60) ] },
      { name: 'Meias avançados', slots: [
        F('GK',0.06,0.50),F('LB',0.26,0.14),F('CB',0.22,0.38),F('CB',0.22,0.62),F('RB',0.26,0.86),
        F('CDM',0.39,0.50),F('CAM',0.56,0.34),F('CAM',0.56,0.66),F('CAM',0.66,0.50),F('ST',0.82,0.40),F('ST',0.82,0.60) ] }
    ]
  }
};
const FORMATION_KEYS = Object.keys(FORMATIONS);

/* ------------------------------ ATRIBUTOS -------------------------------- */
// 25 de linha + 5 de goleiro. getAttr determinístico: base(overall) + perfil(slot) + jitter(hash) + trait.
const ATTR_KEYS = {
  tec: ['finalizacao','passe','cruzamento','drible','conducao','cabeceio','desarme','marcacao','chute_longe','bola_parada'],
  men: ['visao','posicionamento','decisao','compostura','antecipacao','determinacao','trabalho_equipe'],
  fis: ['ritmo','aceleracao','forca','resistencia','agilidade','impulsao'],
  gk : ['reflexos','defesa','saida_gol','dominio_area','reposicao']
};
const ATTR_PT = {
  finalizacao:'Finalização', passe:'Passe', cruzamento:'Cruzamento', drible:'Drible', conducao:'Condução',
  cabeceio:'Cabeceio', desarme:'Desarme', marcacao:'Marcação', chute_longe:'Chute de Longe', bola_parada:'Bola Parada',
  visao:'Visão', posicionamento:'Posicionamento', decisao:'Decisão', compostura:'Compostura', antecipacao:'Antecipação',
  determinacao:'Determinação', trabalho_equipe:'Trabalho em Equipe',
  ritmo:'Ritmo', aceleracao:'Aceleração', forca:'Força', resistencia:'Resistência', agilidade:'Agilidade', impulsao:'Impulsão',
  reflexos:'Reflexos', defesa:'Defesa', saida_gol:'Saída de Gol', dominio_area:'Domínio de Área', reposicao:'Reposição'
};
// perfis: offset por classe de slot (positivo = destaque, negativo = fraco)
const PROF = {
  GK: { reflexos:3, defesa:2, saida_gol:0, dominio_area:1, reposicao:-2,
        // atributos de linha irrelevantes p/ GK ficam baixos (não usados no motor)
        finalizacao:-40, passe:-6, drible:-30, desarme:-20, ritmo:-15, forca:2 },
  CB: { marcacao:12, desarme:11, cabeceio:10, forca:10, posicionamento:9, antecipacao:8, impulsao:6, decisao:3,
        finalizacao:-28, drible:-18, cruzamento:-14, ritmo:-4, aceleracao:-5, chute_longe:-8, agilidade:-6 },
  FB: { ritmo:9, aceleracao:8, resistencia:9, cruzamento:8, desarme:6, marcacao:4, agilidade:5, trabalho_equipe:4,
        finalizacao:-16, cabeceio:-6, chute_longe:-8, forca:-2 },
  DM: { desarme:11, marcacao:10, antecipacao:9, posicionamento:8, passe:6, trabalho_equipe:8, forca:6, resistencia:6, decisao:4,
        finalizacao:-14, drible:-6, ritmo:-2, cruzamento:-6 },
  CM: { passe:9, visao:8, resistencia:9, decisao:7, trabalho_equipe:7, compostura:5, drible:3, conducao:4,
        cabeceio:-6, marcacao:-2, forca:-2 },
  AM: { passe:9, visao:10, drible:9, finalizacao:6, compostura:7, agilidade:7, chute_longe:6, decisao:6, conducao:6,
        marcacao:-14, desarme:-12, forca:-6, cabeceio:-4 },
  WM: { ritmo:10, aceleracao:9, cruzamento:10, drible:7, resistencia:8, agilidade:7, conducao:5,
        cabeceio:-6, marcacao:-4, forca:-4 },
  WG: { drible:11, ritmo:11, aceleracao:11, agilidade:10, finalizacao:6, conducao:8, compostura:4, cruzamento:5,
        marcacao:-16, desarme:-14, cabeceio:-8, forca:-8 },
  FC: { finalizacao:13, posicionamento:10, compostura:9, cabeceio:8, forca:7, impulsao:6, decisao:4, drible:3,
        desarme:-18, marcacao:-18, passe:-4, cruzamento:-6 }
};
// efeitos de trait em atributos específicos
const TRAIT_FX = {
  FINISHER:            { finalizacao:7, compostura:5, posicionamento:3 },
  PLAYMAKER:           { passe:8, visao:8, decisao:4 },
  CLUTCH_PLAYER:       { compostura:6, determinacao:6, decisao:3 },
  BALL_WINNER:         { desarme:7, antecipacao:6, marcacao:5, forca:3 },
  SPEEDSTER:           { ritmo:9, aceleracao:9, agilidade:4 },
  DRIBBLER:            { drible:9, agilidade:6, conducao:5 },
  LEADER:              { determinacao:7, trabalho_equipe:6, compostura:4 },
  AERIAL_THREAT:       { cabeceio:9, impulsao:8, forca:4 },
  SET_PIECE_SPECIALIST:{ bola_parada:12, cruzamento:5, chute_longe:5 },
  SWEEPER_KEEPER:      { saida_gol:9, reposicao:7, dominio_area:5 }
};

/* V2: os 28 atributos granulares do motor derivam dos 8 REAIS do dataset
   (FIN, PAS, DRI, VEL, DEF, INT, FIS, TEC), com jitter estável pequeno.
   Goleiros mantêm o modelo sintético por overall (os 8 de campo de um GK
   não descrevem a qualidade dele no gol). */
const A8_IX = { FIN:0, PAS:1, DRI:2, VEL:3, DEF:4, INT:5, FIS:6, TEC:7 };
const GRAN_MAP = {
  finalizacao:[['FIN',1]],            cabeceio:[['FIN',.55],['FIS',.45]],
  chute_longe:[['FIN',.65],['TEC',.35]],
  passe:[['PAS',1]],                  visao:[['PAS',.5],['INT',.5]],
  cruzamento:[['TEC',.55],['PAS',.45]], bola_parada:[['TEC',.6],['FIN',.4]],
  drible:[['DRI',1]],                 conducao:[['DRI',.6],['TEC',.4]],
  agilidade:[['DRI',.45],['VEL',.55]],
  ritmo:[['VEL',1]],                  aceleracao:[['VEL',.9],['DRI',.1]],
  marcacao:[['DEF',1]],               desarme:[['DEF',.9],['FIS',.1]],
  antecipacao:[['DEF',.5],['INT',.5]],
  decisao:[['INT',1]],                posicionamento:[['INT',.85],['DEF',.15]],
  compostura:[['INT',.6],['FIN',.4]], determinacao:[['INT',.5],['FIS',.5]],
  trabalho_equipe:[['INT',.7],['PAS',.3]],
  forca:[['FIS',1]],                  impulsao:[['FIS',.85],['VEL',.15]],
  resistencia:[['FIS',1]],
};

/* ================= CALIBRAÇÃO CANÔNICA DO MOTOR V3 =====================
   Os parâmetros globais que controlam frequência e equilíbrio vivem aqui;
   limiares locais de decisão permanecem junto da ação que explicam. A ficha
   e o motor usam a mesma escala 0..100, sem uma segunda nota invisível e
   saturada em 99. Os blocos separam intenção, execução e resultado. */
const ENGINE_CALIBRATION = Object.freeze({
  version: '4.3.2',
  attributes: Object.freeze({
    /* ═══ BALANCEAMENTO · ONDE O ATRIBUTO MANDA E ONDE A SORTE ENTRA ═════
       O motor decide TUDO por sigmoide de duelo: P = 1/(1+e^(-Δ/spread)),
       onde Δ é a diferença de facetas (combinações dos 8 atributos, ver
       GRAN_MAP/facet). O spread é o "volume da sorte": spread alto achata a
       curva (a moeda pesa mais), spread baixo deixa o atributo ditar.
       · duelSpread 11.5 → 10.5: +10 de vantagem passava 70,3% e passa a
         72,4%; +15 vai a 80,7%. O craque decide mais 1x1 sem eliminar o
         azar — um 90 ainda perde ~1 em 5 duelos para um 75.
       · lineJitter/keeperJitter: ruído DETERMINÍSTICO por jogador (hash do
         nome) — variação de elenco, não de rolagem; ficam como estão.
       Mapa rápido de quem manda em cada lance (fórmulas reais):
         FIN → conversão do chute (skillInfluence) e cabeceio;
         PAS → interceptação de passe (peso 1.52: cada ponto ≈ ±13% em
               log-odds — passador fraco erra o simples, de propósito);
         DRI → 1x1 (drб_atk), condução, agilidade;
         VEL → velocidade FÍSICA real (speedOf 4,6–8,8 m/s), disputas de
               bola solta, arrancadas;
         DEF → desarme/marcação/antecipação (facetas tackle/intercept);
         INT → decisão, posicionamento, compostura (entra em quase tudo);
         FIS → força no bote, impulsão aérea, resistência (drenagem);
         TEC → bola parada, condução fina, chute de longe. */
    lineJitter: 0.8,
    keeperJitter: 1.8,
    traitEffect: 0.55,
    duelSpread: 10.5,
    shotDuelSpread: 13.5,
  }),
  timing: Object.freeze({
    /* OS-201 · RELOGIO DA PARTIDA — minutos de jogo por segundo de simulacao.
       Estava em 0,13, e nesse valor o jogo nao batia NENHUM dos proprios
       minimos de `calibration/targets.json` em volume: 13,2 chutes (min 20),
       9,6 faltas (min 16), 1,97 gol (min 2,4), e 41,7% de empates com 25% de
       0 a 0 — consequencia direta de faltar jogo dentro dos 90 minutos.
       Nao era compressao "arcade": era subnutricao.

       Medido em varredura de 5 valores (tools/fisica/calibrar.py, 40 partidas
       cada), 0,085 e onde o volume entra na faixa de design. Custo: a partida
       passa de ~14,7 para ~22,8 minutos de observacao em 1X — mas o jogo abre
       em 2X, entao na pratica sao ~11 minutos.

       A fadiga foi desacoplada deste numero na mesma mudanca (OS-201 em
       40-match-engine), senao baixar o relogio deixaria o time exausto sem que
       nada no futebol tivesse mudado. */
    clockRate: 0.085,
    /* OS-201 · quanto de folego volta por segundo de bola parada. O motor so
       sabia gastar; sem recuperacao a stamina final ficava abaixo do minimo de
       design por construcao. Calibrado com a bateria. */
    /* 0,055 e nao mais: subir para 0,075 poe a stamina em 64,4 (contra 64,2),
       ganho irrisorio, mas jogador mais inteiro no fim faz o placar abrir —
       os empates caem de 29,2% para 17,5% (abaixo do minimo) e as goleadas
       sobem de 17,5% para 20,8%. Medido, 12/13 vira 10/13. */
    deadBallRecovery: 0.055,
    fixedStep: 1 / 60,
    decisionInterval: 0.28,
    tackleCooldown: 0.55,
  }),
  possession: Object.freeze({
    firstTouchMin: 0.10,
    firstTouchMax: 0.34,
    transitionProtection: 0.42,
  }),
  passing: Object.freeze({
    baseError: 0.018,
    pressureError: 0.075,
    longPassError: 0.090,
    throughBallError: 0.050,
    maxError: 0.24,
  }),
  defending: Object.freeze({
    tackleAttemptRate: 12.0,
    boxAttemptRate: 4.2,
    /* OS-201 · as faltas ficam em ~14,9 por partida contra um minimo de design
       de 16 (alvo 21), e o miss e consistente em quatro medicoes. Nao mexido:
       o volume de faltas nao sai deste numero, sai de quantos DUELOS acontecem
       por partida — subir a probabilidade por duelo so trocaria falta por
       cartao, e os amarelos ja estao em 4,7 de um teto de 5,6.
       Fica registrado como pendencia real. */
    foulBase: 0.29,
    foulComposure: 0.12,
    yellowFirst: 0.18,
    yellowSecond: 0.05,
    straightRed: 0.0008,
  }),
  shooting: Object.freeze({
    distanceXg: Object.freeze([
      [6, 0.48], [11, 0.27], [16, 0.135], [22, 0.064], [30, 0.032], [Infinity, 0.015],
    ]),
    conversionScale: 2.25,
    /* BALANCEAMENTO · finalizador e goleiro com voz de verdade:
       · skillInfluence 0.90 → 1.05: o termo (FIN−GK)/100 modula a conversão
         em ±~26% na faixa típica (antes ±22%). A POSIÇÃO do chute continua
         soberana (xG a 6 m é 7,5× o de 22 m) — talento não substitui estar
         bem colocado, apenas aproveita melhor.
       · goleiro: a fatia de DEFESA nos não-gols era 0.15 + qual×0.08 — um
         paredão de 90 defendia quase igual a um goleiro de 60 (Δ≈2,4 pts
         percentuais). Agora 0.05 + qual×0.21: média preservada (~20,8% com
         goleiro 75), mas o intervalo abre para 16,6%↔23,9% — cada +10 de
         goleiro ≈ +2 defesas a mais a cada 100 finalizações, além do efeito
         que ele já exerce dentro do pGoal. A sorte segue existindo (o roll
         r2 é uma moeda), só que a moeda agora é visivelmente viciada pela
         qualidade de quem está embaixo das traves. */
    skillInfluence: 1.05,
    minGoalChance: 0.006,
    maxGoalChance: 0.58,
    savedShare: 0.20,
    keeperSaveInfluence: 0.21,
    blockedShare: 0.18,
    postShare: 0.055,
  }),
  restarts: Object.freeze({
    /* CALIBRAÇÃO (auditoria v5.2.2): escanteios mediam 4.08/partida com a
       faixa de design em 5.0–11.5. Shares elevados ~25% de forma distribuída
       — desvios, bloqueios e bolas na trave passam a morrer mais na linha de
       fundo, como no futebol real (~10/jogo). Validado por bateria de 100
       partidas antes do commit. */
    lowCrossSaveCorner: 0.55,
    failedCrossCorner: 0.76,
    aerialSaveCorner: 0.58,
    aerialBlockCorner: 0.70,
    shotSaveCorner: 0.68,
    shotBlockCorner: 0.66,
    postCorner: 0.64,
    freeKickSaveCorner: 0.68,
  }),
  targets: Object.freeze({
    goals: Object.freeze([1.8, 2.8]),
    shots: Object.freeze([13, 21]),
    passCompletion: Object.freeze([0.76, 0.88]),
    corners: Object.freeze([3, 9]),
    fouls: Object.freeze([4, 12]),
    tackles: Object.freeze([9, 22]),
    interceptions: Object.freeze([8, 22]),
  }),
});

function getAttr(p, key){
  // No motor, o atleta em campo encapsula sua ficha completa em `ref`.
  // Centralizar o desembrulho aqui evita fórmulas lendo atributos inexistentes.
  if (p && p.ref) p = p.ref;
  if (!p) return 50;
  if (!p._a) p._a = {};
  if (p._a[key] !== undefined) return p._a[key];
  let v;
  const gm = GRAN_MAP[key];
  if (p.a8 && gm && p.slot !== 'GK') {
    let acc = 0;
    for (const [k, w] of gm) acc += p.a8[A8_IX[k]] * w;
    const h = hash32(p.n + '#' + key);
    const jit = ((h % 2001) / 1000 - 1) * ENGINE_CALIBRATION.attributes.lineJitter;
    let tr = 0;
    for (const t of p.traits){ const fx = TRAIT_FX[t]; if (fx && fx[key]) tr += fx[key]; }
    v = clamp(Math.round(acc + jit + tr * ENGINE_CALIBRATION.attributes.traitEffect), 20, 99);
  } else {
    // GK (chaves de goleiro e de campo) e fallback V1: sintético por overall
    const cls = SLOT_CLASS[p.slot] || 'CM';
    const base = p.r;
    const prof = (PROF[cls] && PROF[cls][key]) || 0;
    const h = hash32(p.n + '#' + key);
    const jit = ((h % 2001) / 1000 - 1) * ENGINE_CALIBRATION.attributes.keeperJitter;
    let tr = 0;
    for (const t of p.traits){ const fx = TRAIT_FX[t]; if (fx && fx[key]) tr += fx[key]; }
    v = clamp(Math.round(base + prof + jit + tr * ENGINE_CALIBRATION.attributes.traitEffect), 25, 99);
  }
  p._a[key] = v;
  return v;
}
// combinações ponderadas usadas pelo motor de duelos
function facet(p, which){
  const g = getAttr;
  switch (which){
    case 'drб_atk':  return g(p,'drible')*0.43 + g(p,'agilidade')*0.37 + g(p,'aceleracao')*0.20;
    case 'drб_def':  return g(p,'desarme')*0.42 + g(p,'posicionamento')*0.28 + g(p,'antecipacao')*0.20 + g(p,'agilidade')*0.10;
    case 'pass':     return g(p,'passe')*0.54 + g(p,'visao')*0.31 + g(p,'decisao')*0.15;
    case 'intercept':return g(p,'antecipacao')*0.42 + g(p,'posicionamento')*0.38 + g(p,'trabalho_equipe')*0.20;
    case 'shot':     return g(p,'finalizacao')*0.48 + g(p,'compostura')*0.30 + g(p,'posicionamento')*0.12 + g(p,'conducao')*0.10;
    case 'shot_far': return g(p,'chute_longe')*0.48 + g(p,'compostura')*0.23 + g(p,'conducao')*0.17 + g(p,'decisao')*0.12;
    case 'one_on_one': return g(p,'finalizacao')*0.43 + g(p,'compostura')*0.38 + g(p,'agilidade')*0.10 + g(p,'decisao')*0.09;
    case 'gk':       return g(p,'reflexos')*0.43 + g(p,'defesa')*0.27 + g(p,'posicionamento')*0.20 + g(p,'dominio_area')*0.10;
    case 'gk_one_on_one': return g(p,'reflexos')*0.40 + g(p,'saida_gol')*0.30 + g(p,'posicionamento')*0.20 + g(p,'agilidade')*0.10;
    case 'distribution': return g(p,'reposicao')*0.52 + g(p,'passe')*0.20 + g(p,'decisao')*0.16 + g(p,'compostura')*0.12;
    case 'head_atk': return g(p,'cabeceio')*0.46 + g(p,'impulsao')*0.34 + g(p,'antecipacao')*0.20;
    case 'head_def': return g(p,'cabeceio')*0.34 + g(p,'impulsao')*0.25 + g(p,'marcacao')*0.23 + g(p,'posicionamento')*0.18;
    case 'tackle':   return g(p,'desarme')*0.42 + g(p,'forca')*0.22 + g(p,'antecipacao')*0.22 + g(p,'agilidade')*0.14;
    case 'carry':    return g(p,'conducao')*0.34 + g(p,'drible')*0.26 + g(p,'agilidade')*0.24 + g(p,'forca')*0.16;
    case 'control':  return g(p,'conducao')*0.42 + g(p,'compostura')*0.30 + g(p,'agilidade')*0.18 + g(p,'decisao')*0.10;
    case 'offball':  return g(p,'posicionamento')*0.34 + g(p,'antecipacao')*0.31 + g(p,'decisao')*0.20 + g(p,'ritmo')*0.15;
    case 'def_position': return g(p,'posicionamento')*0.39 + g(p,'antecipacao')*0.27 + g(p,'marcacao')*0.20 + g(p,'trabalho_equipe')*0.14;
    case 'concentration': return g(p,'posicionamento')*0.34 + g(p,'decisao')*0.28 + g(p,'antecipacao')*0.23 + g(p,'determinacao')*0.15;
    case 'press':    return g(p,'trabalho_equipe')*0.31 + g(p,'resistencia')*0.24 + g(p,'antecipacao')*0.22 + g(p,'determinacao')*0.13 + g(p,'ritmo')*0.10;
    case 'low_cross':return g(p,'cruzamento')*0.44 + g(p,'visao')*0.22 + g(p,'conducao')*0.18 + g(p,'decisao')*0.16;
    case 'setpiece': return g(p,'bola_parada')*0.55 + g(p,'finalizacao')*0.22 + g(p,'compostura')*0.15 + g(p,'visao')*0.08;
    case 'pen':      return g(p,'bola_parada')*0.36 + g(p,'finalizacao')*0.34 + g(p,'compostura')*0.30;
    case 'pen_gk':   return g(p,'reflexos')*0.47 + g(p,'posicionamento')*0.28 + g(p,'agilidade')*0.15 + g(p,'decisao')*0.10;
    default: return p && p.ref ? p.ref.r : p.r;
  }
}

/* Física canônica da cobrança direta. Partida e modo de treinamento chamam
   exatamente esta função: não existe uma versão "fácil" separada para teste. */
function resolveFreeKickPhysics(takerSkill, keeperSkill, dtg, input){
  const supplied=input!=null;
  input = input || {};
  const manual = supplied && !input.assisted;
  const aimX = clamp(input.aimX != null ? input.aimX : .5 + R(-.3,.3), -.2, 1.2);
  const aimY = clamp(input.aimY != null ? input.aimY : .48 + R(-.25,.22), -.2, 1.2);
  const power = clamp(input.power != null ? input.power : R(.58,.86), 0, 1);
  const curve = clamp(input.curve != null ? input.curve : R(-.7,.7), -1, 1);
  const idealPower = clamp(.64 + (dtg - 18) * .012, .62, .82);
  const powerQ = clamp(1 - Math.abs(power - idealPower) * 2.35, 0, 1);
  const curveQ = clamp(Math.abs(curve) * (takerSkill/100), 0, 1);
  const pressure = clamp(input.pressure || 0, 0, 1);
  const execution = clamp(takerSkill/100 * .52 + powerQ * .30 + curveQ * .18 - pressure * .10, 0, 1);
  const err = manual ? lerp(.155, .025, execution) : lerp(.18, .045, takerSkill/100);
  const actualX = aimX + (R(-err,err)+R(-err,err))*.5 + curve * .025;
  const actualY = aimY + (R(-err,err)+R(-err,err))*.28 - (power-idealPower)*.62;
  const offTarget = actualX < .02 || actualX > .98 || actualY < .02 || actualY > 1.02;
  const wallRisk = clamp(.46 - power*.34 - Math.abs(curve)*.16 + Math.max(0,actualY-.55)*.55, .03, .48);
  const corner = clamp(Math.hypot((actualX-.5)*1.55,(actualY-.5)*1.25),0,1);
  /* BALANCEAMENTO · falta direta: o cobrador de elite se separa mais do
     mediano (fator de habilidade 1.2 → 1.5 no gol-base): batedor 90 contra
     goleiro 75 sobe de ~6,1% para ~6,4% de base antes dos multiplicadores
     de execução — e o execution (52% habilidade) segue mandando no erro. */
  /* §OS-101 · o gol de falta direta.
     Medido amostrando esta funcao 50 000 vezes por cenario: batedor 90 x
     goleiro 75 convertia 4,17%, mediano 3,13%, fraco 2,02%. A referencia real
     e ~8-10% para especialista, ~5-6% no geral e ~3-5% para o mediano — e,
     pior que o patamar, a SEPARACAO por atributo era de apenas 2,06x, ou
     seja o atributo quase nao decidia quem faz gol de falta.
     O comentario acima esta defasado: ele fala em ~6,1% de base, e a conta
     antiga dava 3,85% com batedor 90 contra goleiro 75. Confie na amostragem
     da funcao pura, nao no comentario.
     ARMADILHA: `pGoal` entra em `stats.xg` ANTES do sorteio, entao isto NAO e
     neutro no ECO-02 — cada ponto percentual custa ~0,036 de xG por partida. */
  const baseGoal = clamp(0.048 * (1 + (takerSkill - keeperSkill)/100 * 2.2), .012, 0.13);
  const pGoal = clamp(baseGoal * (.52 + execution*.82 + corner*.28 + curveQ*.14), .010, .140);
  let result;
  if (offTarget) result = 'miss';
  else if (chance(wallRisk)) result = 'wall';
  else if (chance(pGoal)) result = 'goal';
  /* §OS-89 · a falta direta quase nunca ia para fora.
     Medido amostrando esta funcao 50 000 vezes por cenario: do total,
     `fora` ficava em ~14,7% e `defesa` em ~64% — e do que passa a barreira
     e nao e gol, praticamente TUDO virava defesa. Com goleiro 75 a conta
     antiga dava .58 + 75/220 = 0,921 e o clamp SATURAVA no teto de 0,82: o
     atributo do goleiro deixava de pesar. Referencia real de falta direta:
     fora ~35-40%, defesa ~30-35%.
     CALIBRADA em cima da medicao, nao de palpite. A primeira tentativa usou
     base .17 e corrigiu DEMAIS: `fora` foi de 14,7% para 50,5%, passando da
     referencia real. Base .35 poe a divisao perto de defesa ~40% e fora ~38%,
     com a barreira nos 18% que ja existiam. */
  else result = chance(clamp(.35 + keeperSkill/300 - corner*.20, .20,.70)) ? 'save' : 'miss';
  return {
    result, pGoal, manual, idealPower, powerQ, curveQ, corner,
    visual:{ aimX, aimY, actualX, actualY, power, curve, execution }
  };
}
// funções sigmoides de duelo (§5.2)
function duelProb(a, b){ return 1 / (1 + Math.exp(-(a - b) / ENGINE_CALIBRATION.attributes.duelSpread)); }
function duelShotProb(a, b){ return 1 / (1 + Math.exp(-(a - b) / ENGINE_CALIBRATION.attributes.shotDuelSpread)); }

/* ------------------------------ buildDB ---------------------------------- */
// Constrói o banco a partir do objeto DATA (window.DATA no browser, ou passado no teste).

/* ============ LENDAS POR COPA (desempenho na edição define o teto) ============
   Critério: atuação NAQUELA Copa. overall final = max(fórmula, nota da lenda).
   [trecho do nome, país, ano, overall] — match: nome inclui trecho + país + ano. */
const LEGEND = [
  ['Maradona','Argentina',1986,99], ['Pelé','Brasil',1970,98], ['Garrincha','Brasil',1962,97],
  ['Ronaldo','Brasil',2002,97], ['Messi','Argentina',2022,97], ['Zidane','França',1998,96],
  ['Cruijff','Holanda',1974,96], ['Rossi','Itália',1982,95], ['Kempes','Argentina',1978,95],
  ['Müller','Alemanha',1970,95],
  ['Romário','Brasil',1994,95], ['Baggio','Itália',1994,94], ['Pelé','Brasil',1958,95],
  ['Jairzinho','Brasil',1970,94], ['Beckenbauer','Alemanha',1974,95], ['Eusebio','Portugal',1966,94],
  ['Fontaine','França',1958,94], ['Zidane','França',2006,95], ['Mbappé','França',2022,95],
  ['Matthäus','Alemanha',1990,94], ['Puskás','Hungria',1954,94], ['Kocsis','Hungria',1954,93],
  ['Garrincha','Brasil',1958,93], ['Cannavaro','Itália',2006,94], ['Iniesta','Espanha',2010,94],
  ['Maradona','Argentina',1990,93], ['Rivaldo','Brasil',2002,93], ['Ronaldinho','Brasil',2002,91],
  ['Cafu','Brasil',2002,89], ['Roberto Carlos','Brasil',2002,89], ['Zico','Brasil',1982,93],
  ['Socrates','Brasil',1982,91], ['Falcão','Brasil',1982,91], ['Éder','Brasil',1982,87],
  ['Zoff','Itália',1982,91], ['Conti','Itália',1982,88], ['Rummenigge','Alemanha',1982,91],
  ['Boniek','Polônia',1982,90], ['Platini','França',1982,89], ['Platini','França',1986,90],
  ['Rivelino','Brasil',1970,93], ['Tostão','Brasil',1970,91], ['Gérson','Brasil',1970,92],
  ['Carlos Alberto','Brasil',1970,91], ['Banks','Inglaterra',1970,90], ['Riva','Itália',1970,90],
  ['Beckenbauer','Alemanha',1970,93], ['Facchetti','Itália',1970,89], ['Boninsegna','Itália',1970,88],
  ['Overath','Alemanha',1970,89], ['Cubillas','Peru',1970,89], ['Cubillas','Peru',1978,91],
  ['Lato','Polônia',1974,91], ['Deyna','Polônia',1974,89], ['Szarmach','Polônia',1974,88],
  ['Neeskens','Holanda',1974,90], ['Krol','Holanda',1974,89], ['Rensenbrink','Holanda',1974,88],
  ['Rensenbrink','Holanda',1978,90], ['Breitner','Alemanha',1974,89], ['Passarella','Argentina',1978,90],
  ['Fillol','Argentina',1978,89], ['Ardiles','Argentina',1978,88], ['Luque','Argentina',1978,88],
  ['Charlton','Inglaterra',1966,93], ['Moore','Inglaterra',1966,93], ['Hurst','Inglaterra',1966,91],
  ['Yashin','União Soviética',1966,90], ['Albert','Hungria',1966,89], ['Seeler','Alemanha',1966,88],
  ['Masopust','Tchecoslováquia',1962,90], ['Vavá','Brasil',1962,91], ['Amarildo','Brasil',1962,89],
  ['Didi','Brasil',1958,93], ['Vavá','Brasil',1958,90], ['Kopa','França',1958,92],
  ['Nílton Santos','Brasil',1958,90], ['Zagallo','Brasil',1958,88],
  ['Rahn','Alemanha',1954,91], ['Walter','Alemanha',1954,92], ['Hidegkuti','Hungria',1954,91],
  ['Bozsik','Hungria',1954,90], ['Czibor','Hungria',1954,89],
  ['Ademir','Brasil',1950,93], ['Zizinho','Brasil',1950,92], ['Schiaffino','Uruguai',1950,93],
  ['Ghiggia','Uruguai',1950,91], ['Varela','Uruguai',1950,92],
  ['Leônidas','Brasil',1938,93], ['Meazza','Itália',1938,93], ['Piola','Itália',1938,92],
  ['Lineker','Inglaterra',1986,91], ['Careca','Brasil',1986,89], ['Butragueño','Espanha',1986,89],
  ['Elkjær','Dinamarca',1986,89], ['Laudrup','Dinamarca',1986,89], ['Burruchaga','Argentina',1986,89],
  ['Valdano','Argentina',1986,89], ['Belanov','União Soviética',1986,89],
  ['Schillaci','Itália',1990,92], ['Klinsmann','Alemanha',1990,91], ['Brehme','Alemanha',1990,90],
  ['Milla','Camarões',1990,90], ['Goycochea','Argentina',1990,89], ['Caniggia','Argentina',1990,89],
  ['Valderrama','Colômbia',1990,88],
  ['Hagi','Romênia',1994,92], ['Stoichkov','Bulgária',1994,93], ['Baresi','Itália',1994,91],
  ['Maldini','Itália',1994,90], ['Brolin','Suécia',1994,89], ['Dunga','Brasil',1994,89],
  ['Bebeto','Brasil',1994,90], ['Taffarel','Brasil',1994,88],
  ['Ronaldo','Brasil',1998,93], ['Suker','Croácia',1998,91], ['Thuram','França',1998,91],
  ['Deschamps','França',1998,88], ['Barthez','França',1998,88], ['Rivaldo','Brasil',1998,90],
  ['Bergkamp','Holanda',1998,91], ['Owen','Inglaterra',1998,88],
  ['Kahn','Alemanha',2002,92], ['Ballack','Alemanha',2002,89], ['Hong Myung-Bo','Coreia do Sul',2002,88],
  ['Buffon','Itália',2006,93], ['Pirlo','Itália',2006,92], ['Gattuso','Itália',2006,89],
  ['Totti','Itália',2006,88], ['Materazzi','Itália',2006,88], ['Grosso','Itália',2006,88],
  ['Henry','França',2006,90], ['Vieira','França',2006,89], ['Makélélé','França',2006,89],
  ['Klose','Alemanha',2006,90], ['Ballack','Alemanha',2006,89], ['Riquelme','Argentina',2006,89],
  ['Forlán','Uruguai',2010,92], ['Suárez','Uruguai',2010,89], ['Xavi','Espanha',2010,93],
  ['Villa','Espanha',2010,92], ['Casillas','Espanha',2010,92], ['Puyol','Espanha',2010,89],
  ['Sneijder','Holanda',2010,92], ['Robben','Holanda',2010,91], ['Müller','Alemanha',2010,90],
  ['Schweinsteiger','Alemanha',2010,90], ['Özil','Alemanha',2010,88],
  ['Messi','Argentina',2014,94], ['Mascherano','Argentina',2014,90], ['Di María','Argentina',2014,88],
  ['James Rodríguez','Colômbia',2014,92], ['Neymar','Brasil',2014,90], ['Thiago Silva','Brasil',2014,89],
  ['Müller','Alemanha',2014,92], ['Klose','Alemanha',2014,90], ['Neuer','Alemanha',2014,93],
  ['Kroos','Alemanha',2014,91], ['Schweinsteiger','Alemanha',2014,91], ['Hummels','Alemanha',2014,89],
  ['Lahm','Alemanha',2014,90], ['Robben','Holanda',2014,92], ['Navas','Costa Rica',2014,89],
  ['Ochoa','México',2014,88],
  ['Mbappé','França',2018,92], ['Griezmann','França',2018,92], ['Kanté','França',2018,91],
  ['Varane','França',2018,90], ['Pogba','França',2018,89], ['Modric','Croácia',2018,94],
  ['Perisic','Croácia',2018,89], ['Rakitic','Croácia',2018,88], ['Hazard','Bélgica',2018,91],
  ['De Bruyne','Bélgica',2018,90], ['Courtois','Bélgica',2018,90], ['Lukaku','Bélgica',2018,89],
  ['Kane','Inglaterra',2018,89], ['Cheryshev','Rússia',2018,87], ['Akinfeev','Rússia',2018,87],
  ['Álvarez','Argentina',2022,89], ['Enzo Fernández','Argentina',2022,88], ['De Paul','Argentina',2022,88],
  ['Emiliano Martínez','Argentina',2022,90], ['Otamendi','Argentina',2022,87],
  ['Modric','Croácia',2022,90], ['Gvardiol','Croácia',2022,89], ['Livakovic','Croácia',2022,88],
  ['Bounou','Marrocos',2022,89], ['Amrabat','Marrocos',2022,88], ['Hakimi','Marrocos',2022,88],
  ['En-Nesyri','Marrocos',2022,87], ['Ziyech','Marrocos',2022,87],
  ['Giroud','França',2022,88], ['Griezmann','França',2022,90], ['Theo Hernández','França',2022,87],
  ['Richarlison','Brasil',2022,87], ['Casemiro','Brasil',2022,88], ['Neymar','Brasil',2022,88],
  ['Gakpo','Holanda',2022,87], ['Bellingham','Inglaterra',2022,87], ['Valverde','Uruguai',2022,84],
  ['Núñez','Uruguai',2022,82], ['Bentancur','Uruguai',2022,83], ['Araújo','Uruguai',2022,84],
  ['Suárez','Uruguai',2022,82], ['Cavani','Uruguai',2022,81], ['Godín','Uruguai',2022,81],
  ['Giménez','Uruguai',2022,83],
];
function legendOvr(name, country, year) {
  for (const [m, c, y, o] of LEGEND) {
    if (y === year && c === country && name.includes(m)) return o;
  }
  return 0;
}

function buildDB(DATA){
  const H = {};   // helpers expostos pelo decodeSquad p/ a passada global
  const NATIONS = DATA.NATIONS;
  const POS_CODES = DATA.POS_CODES;
  const TRAITS = DATA.TRAITS;

  /* Alguns lotes do CSV V2 deslocaram a coluna de posição. A consequência mais
     grave era funcional: seleções sem goleiro e zagueiros escalados no gol.
     Esta curadoria cobre somente os elencos estruturalmente inválidos (0 ou
     mais de 3 candidatos) e não tenta reescrever posições históricas em massa. */
  const GK_ROSTER_FIX = Object.freeze({
    10:['Pumpido','Islas','Zelada'],
    11:['Nery Pumpido','Sergio Goycochea','Fabián Cancelarich'],
    17:['Sergio Romero'],
    36:["Michel Preud'homme",'Filip de Wilde'],
    47:['Leão'],
    48:['Leão','Valdir Pérez','Carlos'],
    49:['Valdir Pérez'],
    50:['Leão','Carlos'],
    65:['Borislav Mikhailov','Zdravko Zdravkov'],
    84:['David Ospina'],
    89:['Jose Francisco Porras','Wardy Alfaro'],
    95:['Stipe Pletikosa','Joseph Didulica'],
    103:['Schrojf','Borovièka. Kouba'],
    106:['Rasmussen','Høgh','Qvist'],
    109:['Thomas Sørensen'],
    112:['Kasper Schmeichel','Frederik Rönnow','Oliver Christensen'],
    113:['Ditchburn','Williams'],
    151:['Bodo Illgner','Andreas Köpke','Oliver Kahn'],
    152:['Oliver Kahn','Andreas Köpke'],
    173:['Ebrahim Mirzapour','Vahid Taleblou','Hassan Roudbarian'],
    176:['Alireza Beiranvand','Payam Niazmand','Hossein Hosseini'],
    177:['Alireza Beiranvand','Payam Niazmand','Hossein Hosseini'],
    186:['Tancredi','Zenga','Galli'],
    203:['Larios','Heredia-Orosco','Rodriguez-Bahena'],
    208:['Oscar Pérez'],
    224:['Edwin van der Sar','Ed de Goeij'],
    231:['Peter Rufai'],
    238:['José Luis Chilavert'],
    255:['Carvalho','López'],
    267:['Bogdan Stelea','Florian Prunea'],
    268:['Bogdan Stelea','Dumitru Stîngaciu','Florian Prunea'],
    280:['Martin'],
    289:['Oh Yung-kyo'],
    308:['Zubizarreta','Ablanedo','Ochotorena'],
    312:['Iker Casillas','Santiago Canizares','Jose Manuel Reina'],
    316:['Unai Simón','Robert Sánchez','David Raya'],
    342:['Aymen Dahmen','Mouez Hassen','Bechir Ben Said'],
    343:['Aymen Dahmen','Mouez Hassen','Bechir Ben Said'],
    352:['Fernando Muslera'],
    353:['Fernando Muslera'],
    359:['Tony Meola','Brad Friedel','Kasey Keller'],
    360:['Tim Howard','Marcus Hahnemann','Kasey Keller'],
  });
  // Blocos comprovadamente anexados à seleção errada no arquivo-fonte.
  const FOREIGN_PLAYER_FIX = Object.freeze({
    203:new Set(['IRK: Jassim','Allawe','Majeed','Amaiesh','Tweresh','Basim','Salim','Al-Roubai','Abidoun','Minahid','Shihab']),
    237:new Set(['IRK: Salman','Allawe','Mahmoud','Salim','Al-Roubai','Abidoun','Amaiesh','Hanna','Mohammed','Hassan','Shihab']),
    355:new Set(['Emiliano Martínez']),
  });

  // template de posições de exibição por linha (dá espalhamento realista por seleção)
  const TPL = {
    DEF: ['CB','CB','RB','LB','CB','RB','LB','RWB','LWB','CB'],
    MID: ['CDM','CM','CAM','CM','CDM','LM','RM','CAM','CM','CM'],
    FWD: ['ST','LW','RW','CF','ST','LW','RW','CF']
  };

  function decodeTraits(mask){
    const out = [];
    for (let i = 0; i < TRAITS.length; i++) if (mask & (1 << i)) out.push(TRAITS[i]);
    return out;
  }

  function makeSquad(sqRow){
    const [sid, nid, yr, fp, ovr] = sqRow;
    const nat = NATIONS[String(nid)];
    const raw = DATA.SP[String(sid)] || DATA.SP[sid] || [];
    // decodifica jogadores
    const isV2 = DATA.V === 2;

    // Overall derivado dos 8 atributos reais, PONDERADO POR POSIÇÃO.
    // Corrige o descompasso (ex.: OVR alto com um único atributo bom).
    // Pesos por linha de atuação: [FIN,PAS,DRI,VEL,DEF,INT,FIS,TEC]
    const OVR_W = {
      GK:  null,  // GK usa modelo próprio (r original é a qualidade no gol)
      CB:  [0.02,0.10,0.03,0.08,0.30,0.20,0.17,0.10],
      RB:  [0.05,0.13,0.09,0.16,0.20,0.14,0.11,0.12],
      LB:  [0.05,0.13,0.09,0.16,0.20,0.14,0.11,0.12],
      RWB: [0.07,0.14,0.11,0.17,0.15,0.12,0.10,0.14],
      LWB: [0.07,0.14,0.11,0.17,0.15,0.12,0.10,0.14],
      CDM: [0.05,0.16,0.07,0.08,0.22,0.20,0.12,0.10],
      CM:  [0.10,0.20,0.12,0.09,0.12,0.16,0.09,0.12],
      CAM: [0.16,0.20,0.16,0.10,0.04,0.14,0.05,0.15],
      RM:  [0.12,0.16,0.16,0.14,0.07,0.11,0.07,0.17],
      LM:  [0.12,0.16,0.16,0.14,0.07,0.11,0.07,0.17],
      RW:  [0.18,0.13,0.19,0.16,0.03,0.10,0.05,0.16],
      LW:  [0.18,0.13,0.19,0.16,0.03,0.10,0.05,0.16],
      CF:  [0.24,0.12,0.15,0.12,0.02,0.12,0.08,0.15],
      ST:  [0.28,0.09,0.13,0.13,0.02,0.11,0.10,0.14],
    };
    // bônus de trait pequeno: um trait NÃO transforma um jogador mediano em craque.
    const TRAIT_BONUS = {
      PLAYMAKER: 1.5, FINISHER: 1.0, DRIBBLER: 1.0, SPEEDSTER: 0.8,
      BALL_WINNER: 1.0, LEADER: 1.0, AERIAL_THREAT: 0.6, CLUTCH_PLAYER: 1.0,
      SET_PIECE_SPECIALIST: 0.5, SWEEPER_KEEPER: 0.5,
    };
    // offset de normalização por posição: a base ponderada média difere muito entre
    // posições (CF ~74, CM/CB ~63). Isso traz todas ao mesmo centro (~68) pra que
    // um lateral excelente e um atacante excelente cheguem a overalls comparáveis.
    const POS_OFFSET = {
      ST: 2.0, CF: -3.0, CAM: -2.0, RW: -1.0, LW: 0.5,
      RM: 2.5, LM: 2.5, CM: 6.0, CDM: 3.0, CB: 3.5,
      RB: 6.0, LB: 6.0, RWB: 6.0, LWB: 6.0,
    };
    function overallFromA8(a8, slot, traits) {
      const w = OVR_W[slot]; if (!w || !a8) return null;
      // ── FÓRMULA VALIDADA CONTRA A REALIDADE (§rebalance) ──
      // Testada contra ~7000 overalls reais do dataset: esta forma (best-3 × 0.50
      // + ponderada-posicional × 0.40 + melhor-atributo × 0.10) foi a que MENOS
      // errou (MAE 2.4 pura). É a definição pura de coerência: o overall É o resumo
      // dos melhores atributos, nada mais — nunca um 95 com overall baixo, nem o
      // inverso. A reputação das lendas é bancada elevando os ATRIBUTOS (upliftP),
      // não forçando o overall; assim os dois sempre batem (MAE cai p/ 1.25).
      let acc = 0; for (let k = 0; k < 8; k++) acc += a8[k] * w[k];
      acc += (POS_OFFSET[slot] || 0);
      const s = [...a8].sort((x, y) => y - x);
      const best3 = (s[0] + s[1] + s[2]) / 3;
      let base = best3 * 0.50 + acc * 0.40 + s[0] * 0.10;
      // traits com retorno decrescente (pequeno — não transforma mediano em craque)
      let tb = 0;
      for (const tr of (traits || [])) tb += TRAIT_BONUS[tr] || 0;
      tb = Math.min(tb, 3);
      const damp = base >= 88 ? 0.4 : base >= 82 ? 0.7 : 1.0;
      base += tb * damp;
      return Math.round(clamp(base, 40, 99));
    }
    H.OVR_W = OVR_W; H.overallFromA8 = overallFromA8;

    let pls = raw.map((rec, i) => {
      const [name, r, posIx, starter, trMask, a8Raw] = rec;
      // buildDB pode ser chamado novamente ao reiniciar/depurar. Trabalhar sobre
      // uma cópia impede comprimir INT/FIS repetidas vezes dentro de window.DATA.
      const a8 = Array.isArray(a8Raw) ? a8Raw.slice() : null;
      // ── COMPRESSÃO DE INT/FIS (§atributos-base) ──
      // O dataset infla Inteligência e Físico pra todo mundo (média ~72 vs ~59 dos
      // outros atributos) — por isso apareciam medianos com FIS 88. Comprimimos os
      // dois em direção a um centro mais baixo, escalando: o jogador comum passa a
      // ter físico/QI comuns, e só o verdadeiramente dominante (Cannavaro, Kanté)
      // mantém valor alto. Coerência preservada: o overall é recalculado embaixo.
      if (a8 && a8.length === 8) {
        a8[5] = Math.max(20, Math.min(99, Math.round(58 + (a8[5] - 58) * 0.76)));   // INT
        a8[6] = Math.max(20, Math.min(99, Math.round(56 + (a8[6] - 56) * 0.74)));   // FIS
      }
      const posCode = POS_CODES[posIx];
      const main = posCode.split('|')[0];
      const trArr = decodeTraits(trMask);
      const newR = isV2 ? (overallFromA8(a8, main, trArr) || r) : r;
      return {
        id: 's' + sid + 'p' + i,
        n: name, r: newR, rOrig: r, posCode,
        line: isV2 ? (LINE_OF[main] || 'MID') : primaryLine(posCode),
        elig: isV2 ? eligibleSlotsV2(posCode) : eligibleSlots(posCode),
        traits: decodeTraits(trMask),
        starter: !!starter,
        slot: isV2 ? main : null,       // V2: a posição real É o slot de exibição
        a8: a8 || null,                  // [FIN,PAS,DRI,VEL,DEF,INT,FIS,TEC] reais
        num: 0
      };
    });
    const foreignNames = FOREIGN_PLAYER_FIX[sid];
    if (foreignNames) pls = pls.filter(p => !foreignNames.has(p.n));
    if (!isV2) {
      const buckets = { GK: [], DEF: [], MID: [], FWD: [] };
      for (const p of pls) buckets[p.line].push(p);
      for (const p of buckets.GK) p.slot = 'GK';
      for (const ln of ['DEF','MID','FWD']){
        const arr = buckets[ln].sort((a, b) => b.r - a.r);
        const tpl = TPL[ln];
        arr.forEach((p, i) => {
          let s = tpl[i % tpl.length];
          if (p.elig.indexOf(s) === -1) s = p.elig.find(x => LINE_OF[x] === ln) || p.elig[0];
          p.slot = s;
        });
      }
    }
    // Normaliza goleiros nos lotes afetados. Ao promover, atualiza também
    // posCode/elig; mudar apenas slot deixava autoLineup sem reconhecer o GK.
    const curatedKeepers = GK_ROSTER_FIX[sid];
    if (curatedKeepers) {
      const keeperSet = new Set(curatedKeepers);
      for (const p of pls) {
        if (keeperSet.has(p.n)) {
          p.slot = p.posCode = 'GK'; p.line = 'GK'; p.elig = ['GK'];
          p.a8 = null; p._a = undefined;
        } else if (p.slot === 'GK') {
          // Jogador de linha marcado como GK: recupera a função mais coerente
          // com seus oito atributos, sem inventar qualidade nova.
          const fieldSlots = ['CB','RB','LB','CDM','CM','CAM','RW','LW','ST'];
          let bestSlot = 'CB', bestScore = -Infinity;
          for (const slot of fieldSlots) {
            const score = overallFromA8(p.a8, slot, p.traits);
            if (score != null && score > bestScore) { bestScore = score; bestSlot = slot; }
          }
          p.slot = p.posCode = bestSlot;
          p.line = LINE_OF[bestSlot] || 'MID';
          p.elig = eligibleSlotsV2(bestSlot);
          if (bestScore > -Infinity) p.r = bestScore;
          p._a = undefined;
        }
      }
    }
    // Perfil-base [FIN,PAS,DRI,VEL,DEF,INT,FIS,TEC] relativo ao overall.
    // Usado apenas quando uma posição curada revela A8 claramente incompatível.
    const ROLE_A8_OFFSET = {
      CB:[-38,-18,-30,-18,6,0,2,-24], RB:[-25,-8,-12,2,1,-2,-3,-8], LB:[-25,-8,-12,2,1,-2,-3,-8],
      CDM:[-25,-2,-15,-10,2,1,0,-10], CM:[-15,3,-5,-7,-8,1,-5,0],
      CAM:[-4,4,2,-2,-30,0,-18,3], RM:[-8,1,3,2,-18,-2,-10,3], LM:[-8,1,3,2,-18,-2,-10,3],
      RW:[0,-8,4,4,-35,-5,-12,2], LW:[0,-8,4,4,-35,-5,-12,2],
      CF:[2,-10,1,0,-38,-6,-4,0], ST:[4,-18,-8,2,-42,-8,0,-10],
    };
    // Overrides pontuais de jogadores de linha confirmados no mesmo lote.
    const POS_FIX = {
      'Clausen|Argentina|1986': 'RB',
      'Garré|Argentina|1986': 'LB',
      'Olarticoechea|Argentina|1986': 'LB',
      'Batista|Argentina|1986': 'CDM',
      'Marcos Rojo|Argentina|2014': 'LB',
      'Martín Demichelis|Argentina|2014': 'CB',
      'Junior|Brasil|1982': 'LB',
      'Oscar|Brasil|1982': 'CB',
      'Zico|Brasil|1982': 'CAM',
      'Falção|Brasil|1982': 'CM',
      'Socrates|Brasil|1982': 'CAM',
      'Cerezo|Brasil|1982': 'CM',
      'Eder|Brasil|1982': 'LW',
      'Serginho|Brasil|1982': 'ST',
      'Jefferson Lerma|Colômbia|2018': 'CDM',
      'Santiago Arias|Colômbia|2018': 'RB',
      'Dávinson Sánchez|Colômbia|2018': 'CB',
      'José Izquierdo|Colômbia|2018': 'LW',
      'Juan Fernando Quintero|Colômbia|2018': 'CAM',
      'Yerry Mina|Colômbia|2018': 'CB',
      'Carlos Sánchez|Colômbia|2018': 'CDM',
      'Johan Mojica|Colômbia|2018': 'LB',
      'Juan Guillermo Cuadrado|Colômbia|2018': 'RW',
      'Mateus Uribe|Colômbia|2018': 'CM',
      'Radamel Falcao García|Colômbia|2018': 'ST',
      'Wilmar Barrios|Colômbia|2018': 'CDM',
      'Abel Aguilar|Colômbia|2018': 'CM',
      'Cristhian Stuani|Uruguai|2014': 'ST',
      'Maximiliano Pereira|Uruguai|2014': 'RB',
      'Cristian Rodríguez|Uruguai|2014': 'LM',
      'Martín Cáceres|Uruguai|2014': 'CB',
      'Álvaro Pereira|Uruguai|2014': 'LB',
      'Walter Gargano|Uruguai|2014': 'CDM',
      'Alvaro González|Uruguai|2014': 'CM',
      'Egidio Arévalo Ríos|Uruguai|2014': 'CDM',
      'Diego Forlán|Uruguai|2014': 'CF',
      'Nicolás Lodeiro|Uruguai|2014': 'CAM',
      'Cristhian Stuani|Uruguai|2018': 'ST',
      'Guillermo Varela|Uruguai|2018': 'RB',
      'Diego Laxalt|Uruguai|2018': 'LB',
      'Cristian Rodríguez|Uruguai|2018': 'LM',
      'Martín Cáceres|Uruguai|2018': 'CB',
      'Lucas Torreira|Uruguai|2018': 'CDM',
      'Carlos Sánchez|Uruguai|2018': 'RM',
      'Nahitan Nández|Uruguai|2018': 'CM',
      'Sebastián Coates|Uruguai|2018': 'CB',
      'Giorgian De Arrascaeta|Uruguai|2018': 'CAM',
    };
    for (const p of pls) {
      const fx2 = POS_FIX[p.n + '|' + nat[0] + '|' + yr];
      if (fx2) {
        p.slot = p.posCode = fx2;
        p.line = fx2 === 'GK' ? 'GK' : (LINE_OF[fx2] || p.line);
        p.elig = eligibleSlotsV2(fx2);
        p._positionFixed = true;
        if (p.a8 && ROLE_A8_OFFSET[fx2]) {
          const target = p.rOrig || p.r || 65;
          const implied = overallFromA8(p.a8, fx2, p.traits);
          if (target - implied >= 4) {
            const off = ROLE_A8_OFFSET[fx2];
            p.a8 = p.a8.map((rawV, k) => {
              const roleV = clamp(target + off[k], 30, 99);
              return Math.round(rawV * 0.25 + roleV * 0.75);
            });
          }
        }
        if (fx2 === 'GK') { p.a8 = null; p._a = undefined; }   // GK usa modelo sintético (some o FIN 95)
      }
    }
    assignNumbers(pls);
    // ordena: por linha (GK,DEF,MID,FWD) e overall
    const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    pls.sort((a, b) => (order[a.line] - order[b.line]) || (b.r - a.r));
    // overall do time: média dos 11 melhores + peso menor pro banco (reflete OVR recalculado)
    // LENDAS: desempenho na Copa define o teto (nunca rebaixa)
    for (const p of pls) {
      const lg = legendOvr(p.n, nat[0], yr);
      if (lg) p.r = Math.max(p.r, lg);
    }

    // ===== VARREDURA DE COERÊNCIA (todos os jogadores) =====
    // (a) UPLIFT: se o overall final supera o que os atributos implicam, os
    // atributos sobem até a coerência — preservando o PERFIL da posição
    // (atributo-chave sobe cheio; secundário sobe menos). Lendas jogam como lendas.
    for (const p of pls) {
      if (!p.a8 || p.slot === 'GK') continue;
      const w = OVR_W[p.slot]; if (!w) continue;
      const maxW = Math.max(...w);
      for (let iter = 0; iter < 14; iter++) {
        const implied = overallFromA8(p.a8, p.slot, p.traits);
        const gap = p.r - implied;
        if (gap <= 3) break;
        const step = Math.min(gap, 4);
        for (let k = 0; k < 8; k++) {
          const f = 0.45 + 0.55 * (w[k] / maxW);   // chave ~1.0, irrelevante ~0.45
          p.a8[k] = Math.min(99, Math.round(p.a8[k] + step * f));
        }
      }
      p._a = undefined;   // invalida cache de atributos derivados
    }

    // (b) TRAITS por tipo: elite tem identidade garantida
    const keyTrait = (p) => {
      const L = p.line;
      if (p.slot === 'GK') return 'SWEEPER_KEEPER';
      if (L === 'FWD') return (p.a8 && p.a8[2] > p.a8[0]) ? 'DRIBBLER' : 'FINISHER';
      if (L === 'MID') return (p.slot === 'CDM') ? 'BALL_WINNER' : 'PLAYMAKER';
      return (p.a8 && p.a8[3] >= 80) ? 'SPEEDSTER' : 'BALL_WINNER';
    };
    H.keyTrait = keyTrait;
    for (const p of pls) {
      if (p.r >= 88 && p.traits.length === 0) p.traits.push(keyTrait(p));
      if (p.r >= 93 && !p.traits.includes('CLUTCH_PLAYER')) p.traits.push('CLUTCH_PLAYER');
      if (p.r >= 92) p.legend = true;    // marca para o motor/visual
    }

    let teamR = ovr;
    if (isV2) {
      // monta o MELHOR XI possível respeitando posições e tira a média dele.
      // Testa algumas formações comuns e fica com a de maior média (a IA da seleção
      // usa o esquema que melhor aproveita o elenco).
      const squadStub = { pl: pls };
      let bestXI = 0;
      for (const fk of ['4-3-3','4-4-2','3-5-2','4-2-3-1']) {
        try {
          const { lineup } = autoLineup(squadStub, fk, 0);
          const rs = lineup.filter(l => l.p).map(l => l.p.r);
          if (rs.length >= 10) {
            const avg = rs.reduce((a,b)=>a+b,0) / rs.length;
            if (avg > bestXI) bestXI = avg;
          }
        } catch (e) {}
      }
      if (bestXI === 0) {   // fallback: 11 melhores soltos
        const byR = [...pls].sort((a,b)=>b.r-a.r).slice(0,11);
        bestXI = byR.reduce((s,p)=>s+p.r,0) / Math.max(1, byR.length);
      }
      // expande em torno de ~72 (novo centro) pra separar grandes dos fracos
      teamR = Math.round(clamp(72 + (bestXI - 72) * 1.45, 60, 95));
    }
    return {
      sid, nid, y: yr, fp,
      c: nat[0], f: nat[1], cont: nat[2],
      r: teamR, rOrig: ovr, pl: pls,
      key: nat[0] + ' ' + yr
    };
  }

  function assignNumbers(pls){
    // heurística: 1 p/ GK, resto distribui por slot
    const want = { GK:1, CB:4, LB:3, RB:2, LWB:3, RWB:2, CDM:5, CM:8, CAM:10, LM:11, RM:7, LW:11, RW:7, CF:9, ST:9 };
    const used = new Set(); let n = 12;
    const byLine = [...pls].sort((a,b)=> (a.line==='GK'?0:1)-(b.line==='GK'?0:1) || b.r-a.r);
    for (const p of byLine){
      let d = want[p.slot] || 0;
      if (d && !used.has(d)){ p.num = d; used.add(d); }
    }
    for (const p of byLine){ if (!p.num){ while (used.has(n)) n++; p.num = n; used.add(n); } }
  }

  // monta todas as seleções (lazy-friendly, mas aqui direto)
  const squads = DATA.SQUADS.map(makeSquad);
  /* =============== CALIBRAÇÃO ÚNICA DOS JOGADORES =====================
     A edição da Copa é a verdade. Não há piso de carreira propagado entre anos,
     curva entre temporadas, âncora coletiva nem perfil artificial para time
     fraco. Oito atributos da edição -> overall posicional -> motor. Somente uma
     nota histórica alta da PRÓPRIA edição ou a curadoria LEGEND pode elevar os
     atributos, mantendo ficha, overall e comportamento coerentes. */
  for (const sq of squads) {
    for (const p of sq.pl) {
      const editionLegend = legendOvr(p.n, sq.c, sq.y) || 0;
      if (p.slot === 'GK' || !p.a8) {
        p.r = Math.round(clamp(Math.max(p.rOrig || p.r || 60, editionLegend), 45, 96));
        p._a = undefined;
        p.legend = p.r >= 92;
        continue;
      }

      const w = H.OVR_W[p.slot];
      if (!w) continue;
      const editionTarget = Math.max(editionLegend,
        p._positionFixed ? (p.rOrig || 0) : (p.rOrig || 0) >= 84 ? p.rOrig : 0);
      const maxW = Math.max(...w);
      for (let it = 0; it < 20 && editionTarget > 0; it++) {
        const current = H.overallFromA8(p.a8, p.slot, p.traits);
        if (current >= editionTarget) break;
        const step = Math.min(3, editionTarget - current);
        for (let k = 0; k < 8; k++) {
          const relevance = 0.38 + 0.62 * (w[k] / maxW);
          p.a8[k] = Math.min(99, Math.round(p.a8[k] + step * relevance));
        }
      }
      p.r = H.overallFromA8(p.a8, p.slot, p.traits);
      p._a = undefined;
      if (p.r >= 88 && p.traits.length === 0) p.traits.push(H.keyTrait(p));
      if (p.r >= 93 && !p.traits.includes('CLUTCH_PLAYER')) p.traits.push('CLUTCH_PLAYER');
      p.legend = p.r >= 92;
      // Traits alteram a fórmula; fecha a coerência depois de atribuí-los.
      p.r = H.overallFromA8(p.a8, p.slot, p.traits);
      p._a = undefined;
    }
  }
  // re-cálculo do overall dos TIMES com os novos valores (mesma fórmula do melhor XI)
  for (const sq of squads) {
    let bestXI = 0;
    for (const fk of ['4-3-3','4-4-2','3-5-2','4-2-3-1']) {
      try {
        const { lineup } = autoLineup(sq, fk, 0);
        const rs = lineup.filter(l => l.p).map(l => l.p.r);
        if (rs.length >= 10) bestXI = Math.max(bestXI, rs.reduce((a,b)=>a+b,0)/rs.length);
      } catch (e) {}
    }
    if (bestXI > 0) sq.r = Math.round(clamp(72 + (bestXI - 72) * 1.45, 60, 95));
  }

  /* ═══ CORREÇÃO DE DADO · POSIÇÕES HISTÓRICAS CORROMPIDAS ═══════════════
     Alguns craques ofensivos chegaram do CSV com a posição de origem trocada
     (Figo e Okocha catalogados como CB), o que os fazia surgir escalados na
     zaga. Aqui reescrevemos a posição real desses nomes e RECALCULAMOS slot,
     linha e elegibilidade — assim eles voltam a ser candidatos naturais das
     suas funções ofensivas e a trava de natureza passa a protegê-los.
     Chave = tokens do nome-raiz (sem acento/partículas); valor = posição
     correta. Novos casos entram com uma linha. */
  const POS_OVERRIDE = [
    { root: ['figo'],   pos: 'RW'  },   // Luís Figo — ponta/meia direita
    { root: ['okocha'], pos: 'CAM' },   // Jay-Jay Okocha — meia atacante
  ];
  let _posFixes = 0;
  for (const s of squads) {
    for (const p of (s.pl || [])) {
      const toks = nameRootTokens(p.n);
      const ov = POS_OVERRIDE.find(o => o.root.every(t => toks.includes(t)));
      if (ov && p.slot !== ov.pos && p.slot !== 'GK') {
        p.slot = p.posCode = ov.pos;
        p.line = LINE_OF[ov.pos] || 'MID';
        p.elig = eligibleSlotsV2(ov.pos);
        _posFixes++;
        window.__cdsDebugWarn('[BANCO·POS] "' + p.n + '" (' + (s.c || s.sid) + '): posição de origem corrigida para ' + ov.pos + '.');
      }
    }
  }
  if (_posFixes) window.__cdsDebugWarn('[BANCO·POS] ' + _posFixes + ' posição(ões) histórica(s) corrigida(s) na carga.');
  const byId = {}; for (const s of squads) byId[s.sid] = s;
  // agrupa por nação
  const byNation = {};
  for (const s of squads){ (byNation[s.nid] = byNation[s.nid] || []).push(s); }

  return { NATIONS, squads, byId, byNation };
}




/* ------------------------- 8 ATRIBUTOS (§1 doc) -------------------------- */
// Agregados visíveis ao jogador, derivados dos 28 granulares que o motor usa.
function attr8(p) {
  // V2: usa os atributos reais do dataset
  if (p.a8 && (p.slot || '') !== 'GK') {
    const L = [['FIN','Finalização'],['PAS','Passe'],['DRI','Drible'],['VEL','Velocidade'],
               ['DEF','Defesa'],['INT','Inteligên.'],['FIS','Físico'],['TEC','Técnica']];
    return L.map(([k, l], i) => ({ k, l, v: p.a8[i] }));
  }
  const a = k => getAttr(p, k);
  const w = pairs => Math.round(pairs.reduce((s, [k, x]) => s + a(k) * x, 0));
  if ((p.slot || '') === 'GK' || p.line === 'GK') return [
    { k: 'REF', l: 'Reflexos',   v: a('reflexos') },
    { k: 'DEF', l: 'Defesa',     v: a('defesa') },
    { k: 'SAI', l: 'Saída',      v: w([['saida_gol', .6], ['dominio_area', .4]]) },
    { k: 'REP', l: 'Reposição',  v: a('reposicao') },
    { k: 'VEL', l: 'Velocidade', v: w([['aceleracao', .5], ['agilidade', .5]]) },
    { k: 'INT', l: 'Inteligên.', v: w([['decisao', .4], ['posicionamento', .4], ['antecipacao', .2]]) },
    { k: 'FIS', l: 'Físico',     v: w([['forca', .5], ['impulsao', .5]]) },
    { k: 'FOL', l: 'Fôlego',     v: w([['resistencia', .8], ['determinacao', .2]]) },
  ];
  return [
    { k: 'VEL', l: 'Velocidade', v: w([['ritmo', .45], ['aceleracao', .35], ['agilidade', .2]]) },
    { k: 'FIN', l: 'Finalização',v: w([['finalizacao', .6], ['cabeceio', .2], ['chute_longe', .2]]) },
    { k: 'PAS', l: 'Passe',      v: w([['passe', .6], ['visao', .25], ['cruzamento', .15]]) },
    { k: 'TEC', l: 'Técnica',    v: w([['drible', .5], ['conducao', .3], ['bola_parada', .2]]) },
    { k: 'INT', l: 'Inteligên.', v: w([['decisao', .3], ['posicionamento', .3], ['antecipacao', .2], ['visao', .2]]) },
    { k: 'MAR', l: 'Marcação',   v: w([['marcacao', .4], ['desarme', .4], ['antecipacao', .2]]) },
    { k: 'FIS', l: 'Físico',     v: w([['forca', .5], ['impulsao', .3], ['agilidade', .2]]) },
    { k: 'FOL', l: 'Fôlego',     v: w([['resistencia', .8], ['determinacao', .2]]) },
  ];
}

/* ------------------------------ ESTILOS ---------------------------------- */
// Modificadores leves de comportamento do time (aplicados no motor).
const STYLE_FX = {
  tiki:    { l:'Tiki-Taka',     d:'Posse alta e passes curtos.',        line:+0.030, tackle:1.00, far:0.60, cross:0.85, drain:1.00 },
  counter: { l:'Contra-Ataque', d:'Bloco baixo, transição letal.',      line:-0.060, tackle:0.88, far:1.00, cross:1.00, drain:0.95 },
  press:   { l:'Gegenpressing', d:'Pressão alta. Custa fôlego.',        line:+0.020, tackle:1.30, far:1.00, cross:1.00, drain:1.18 },
  direct:  { l:'Jogo Direto',   d:'Bola longa e cruzamento.',           line:-0.010, tackle:1.00, far:1.25, cross:1.35, drain:1.00 },
  wings:   { l:'Pelas Alas',    d:'Amplitude máxima pelos lados.',      line: 0.000, tackle:1.00, far:0.90, cross:1.55, drain:1.00 },
  balanced:{ l:'Equilibrado',   d:'Sem extremos: joga o que o jogo pede.',line: 0.000, tackle:1.05, far:0.95, cross:1.05, drain:1.02 },
  park:    { l:'Retranca',      d:'Ferrolho: defende com todos, sai no susto.',line:-0.095, tackle:1.10, far:1.10, cross:0.95, drain:0.90 },
};
STYLE_FX.direct.cross=1.05; STYLE_FX.park.cross=1.3; STYLE_FX.wings.cross=1.85;
const STYLE_KEYS = Object.keys(STYLE_FX);
const STYLE_NEUTRO = { l:'Equilibrado', d:'', line:0, tackle:1, far:1, cross:1, drain:1 };

/* Eixos táticos padrão por estilo (preset 0..100, 50 neutro). O jogador parte
   daqui e afina. Compartilhado entre o motor (match.js) e a UI. */
const STYLE_AXES = {
  tiki:     { line: 60, press: 52, width: 42, tempo: 30, posture: 55 },
  counter:  { line: 34, press: 44, width: 48, tempo: 72, posture: 49 },
  press:    { line: 66, press: 92, width: 50, tempo: 60, posture: 66 },
  direct:   { line: 46, press: 52, width: 62, tempo: 85, posture: 58 },
  wings:    { line: 50, press: 50, width: 90, tempo: 60, posture: 60 },
  balanced: { line: 50, press: 50, width: 50, tempo: 50, posture: 50 },
  park:     { line: 18, press: 42, width: 34, tempo: 95, posture: 40 },
};

/* ------------------------- ESCALACAO AUTOMATICA ------------------------ */
/* ═══════════════════════════════════════════════════════════════════════
   TÓPICO 1 · VALIDADOR DE ENTIDADES — identidade-raiz do jogador
   ═══════════════════════════════════════════════════════════════════════
   PROBLEMA REAL: o banco histórico tem ruídos ("Cubillas" e "Velasquez
   Cubillas" no mesmo elenco; "Fergani  Belloumi"), e o draft permite duas
   cartas do MESMO atleta ("Messi 2014" + "Messi 2022"). A regra do produto
   é: UMA pessoa física por time, sempre.
   COMO FUNCIONA: reduzimos cada nome à sua "raiz" — minúsculas, sem
   acentos, sem partículas (da/de/van/jr...) — e consideramos DUAS fichas a
   mesma pessoa quando o conjunto de tokens de uma CONTÉM o da outra
   ("cubillas" ⊆ "velasquez cubillas" → mesma pessoa). Nação diferente
   quebra o vínculo (o Ronaldo brasileiro nunca colide com o Cristiano
   Ronaldo português). Sobrenomes hipercomuns de token único (Silva,
   Santos...) exigem igualdade EXATA para não gerar falso positivo entre
   "Silva" (1962) e "Thiago da Silva" (2014).
   ONDE APLICA: (a) dedupeRoster() roda no início de TODO autoLineup — a
   trava vale para qualquer time, histórico ou montado; (b) o elenco do
   draft ("Seleção dos Sonhos") é saneado no momento em que entra no banco.
   Cada bloqueio emite console.warn para a equipe técnica auditar. */
const NAME_STOP = new Set(['da','de','do','dos','das','di','du','la','le','el','al','van','der','den','von','jr','junior','ii','iii','filho','neto','van\'t']);
const COMMON_SURNAME = new Set(['silva','santos','souza','sousa','oliveira','pereira','costa','gomes','gomez','lopez','lopes','gonzalez','fernandez','garcia','martinez','rodriguez','perez','hernandez','diaz','torres','muller','johnson','brown','wilson','moore','lima','rojas']);
function nameRootTokens(n){
  return String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter(t => t.length > 1 && !NAME_STOP.has(t));
}
function samePlayerRoot(a, b){
  // nações declaradas e distintas → pessoas distintas, encerra.
  const na = a.from && a.from.c, nb = b.from && b.from.c;
  if (na && nb && na !== nb) return false;
  const ta = nameRootTokens(a.n), tb = nameRootTokens(b.n);
  if (!ta.length || !tb.length) return false;
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // token único só casa por contenção se for distintivo (>=4 letras) e não for
  // sobrenome/primeiro-nome hipercomum — evita fundir "Ben"⊂"Ben Mabrouk".
  if (small.length === 1 && (small[0].length < 4 || COMMON_SURNAME.has(small[0])))
    return ta.join(' ') === tb.join(' ');            // curto/comum: só exato
  return small.every(t => big.includes(t));          // raiz contida = mesmo atleta
}
function dedupeRoster(pl, ctx){
  const kept = [];
  for (const p of pl.slice().sort((x, y) => y.r - x.r)) {   // maior overall vence
    const dup = kept.find(k => samePlayerRoot(k, p));
    if (dup) { window.__cdsDebugWarn('[ESCALAÇÃO·T1] Clone bloqueado em "' + (ctx||'?') + '": "' + p.n + '" ≡ "' + dup.n + '" (mesma identidade-raiz) — mantido o de maior overall.'); continue; }
    kept.push(p);
  }
  // devolve na ordem original do elenco, sem os clones
  return pl.filter(p => kept.includes(p));
}
function autoLineup(squad, formKey, varIdx) {
  const form = FORMATIONS[formKey];
  const variation = form.variations[(varIdx || 0) % form.variations.length];
  const slots = variation.slots;
  // TÓPICO 1 · a trava de clones roda em TODA montagem de onze, para
  // qualquer time — cobre o draft E os ruídos do próprio banco histórico.
  const pool = dedupeRoster(squad.pl.slice(), squad.c || squad.sid);
  const used = new Set();
  const order = slots.map((s, i) => ({ s, i })).sort((a, b) => {
    const ca = pool.filter(p => canPlay(p, a.s.pos)).length;
    const cb = pool.filter(p => canPlay(p, b.s.pos)).length;
    return (a.s.pos === 'GK' ? -1 : 0) - (b.s.pos === 'GK' ? -1 : 0) || ca - cb;
  });
  const filled = new Array(slots.length);
  for (const { s } of order) {
    const eligible = pool.filter(p => !used.has(p.id) && canPlay(p, s.pos));
    /* BUG 2 · TRAVA DE NATUREZA (atacante nunca na zaga). A linha primária do
       jogador (pela sua posição de origem p.slot) é comparada à linha do
       slot; DEF↔FWD é a incompatibilidade proibida. Filtramos os
       incompatíveis SE sobrar qualquer candidato compatível. */
    const slotLine = s.pos === 'GK' ? 'GK' : (LINE_OF[s.pos] || 'MID');
    const natLine = p => p.slot === 'GK' ? 'GK' : (LINE_OF[p.slot] || 'MID');
    const forbidden = (sl, pl) => (sl === 'DEF' && pl === 'FWD') || (sl === 'FWD' && pl === 'DEF') || (sl === 'GK') !== (pl === 'GK');
    const compat = eligible.filter(p => !forbidden(slotLine, natLine(p)));
    const cands = compat.length ? compat : eligible;
    if (compat.length < eligible.length && slotLine === 'DEF')
      eligible.filter(p => natLine(p) === 'FWD' && !compat.includes(p))
        .forEach(p => window.__cdsDebugWarn('[ESCALAÇÃO·T1] Natureza respeitada: "' + p.n + '" (atacante) não assume a vaga de ' + s.pos + '.'));
    cands.sort((a, b) => (b.starter - a.starter) * 3 + (b.r - a.r) + (b.slot === s.pos ? 3 : 0) - (a.slot === s.pos ? 3 : 0));
    /* ═══ TÓPICO 1 · FALLBACK POR NATUREZA (fim das aberrações) ═══════════
       ANTES: se nenhum candidato natural existisse, o slot recebia QUALQUER
       sobra do elenco — foi assim que Figo e Okocha viraram zagueiros
       centrais. AGORA o preenchimento de emergência respeita a natureza:
         · slot de DEFESA (CB/LB/RB/...) aceita, na falta de defensor, um
           MEIA (que sabe marcar) — NUNCA um atacante/ponta;
         · slot de ATAQUE aceita um meia; um zagueiro só em último caso;
         · GK jamais é preenchido por jogador de linha (e vice-versa).
       Cada rebaixamento de tier gera console.warn; o bloqueio de uma
       aberração (FWD→zaga) também, para auditoria da equipe técnica. */
    let chosen = cands[0];
    if (!chosen) {
      const free = pool.filter(p => !used.has(p.id));
      const slotLine = LINE_OF[s.pos] || (s.pos === 'GK' ? 'GK' : 'MID');
      const lineOfP = p => p.slot === 'GK' ? 'GK' : (LINE_OF[p.slot] || 'MID');
      const TIERS = {
        GK:  [['GK']],                          // linha nunca vai pro gol
        DEF: [['DEF'], ['MID']],                // atacante NUNCA cai na zaga
        MID: [['MID'], ['DEF'], ['FWD']],
        FWD: [['FWD'], ['MID'], ['DEF']],
      }[slotLine] || [['MID'], ['DEF'], ['FWD']];
      for (let ti = 0; ti < TIERS.length && !chosen; ti++) {
        const tier = free.filter(p => TIERS[ti].includes(lineOfP(p)))
                         .sort((a, b) => b.r - a.r);
        if (tier.length) {
          chosen = tier[0];
          if (ti > 0) window.__cdsDebugWarn('[ESCALAÇÃO·T1] Improviso controlado em ' + s.pos + ': "' + chosen.n + '" (' + lineOfP(chosen) + ') — não havia ' + slotLine + ' disponível.');
        }
      }
      const blocked = free.filter(p => !chosen || p !== chosen)
        .some(p => slotLine === 'DEF' && lineOfP(p) === 'FWD');
      if (blocked && slotLine === 'DEF')
        window.__cdsDebugWarn('[ESCALAÇÃO·T1] Aberração bloqueada: atacante/ponta impedido de assumir vaga de ' + s.pos + '.');
      if (!chosen) chosen = free[0];   // elenco esgotado: último recurso explícito
    }
    if (chosen) used.add(chosen.id);
    filled[slots.indexOf(s)] = { p: chosen, x: s.x, y: s.y, pos: s.pos };
  }
  const lineup = [];
  for (let i = 0; i < slots.length; i++) lineup.push(filled[i] || { p: pool[i], x: slots[i].x, y: slots[i].y, pos: slots[i].pos });
  const bench = pool.filter(p => !used.has(p.id)).slice(0, 5);
  return { lineup, bench };
}

/* ------------------------------ EXPORTS ---------------------------------- */
const __CORE = {
  srand, R, Ri, chance, pick, pickw, shuffle, clamp, lerp, D, dist2, rint, poisson,
  hash32, shortName, lastName,
  SLOTS, LINE_OF, SLOT_PT, SLOT_CLASS, DEF, MID, FWD, ELIG,
  eligibleSlots, canPlay, primaryLine, samePlayerRoot, dedupeRoster,
  ROLE_CATALOG, FOCUS_PT, DEFAULT_ROLE, rolesForSlot, findRole, defaultRoleFor, roleFx,
  FORMATIONS, FORMATION_KEYS, STYLE_FX, STYLE_KEYS, STYLE_NEUTRO, STYLE_AXES,
  ENGINE_CALIBRATION,
  ATTR_KEYS, ATTR_PT, PROF, TRAIT_FX, getAttr, facet, resolveFreeKickPhysics, duelProb, duelShotProb, autoLineup, attr8,
  buildDB
};
if (typeof module !== 'undefined' && module.exports) module.exports = __CORE;
if (typeof window !== 'undefined') Object.assign(window, __CORE);
