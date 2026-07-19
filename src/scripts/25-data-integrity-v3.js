/* ═══════════════════════════════════════════════════════════════════════════
   FASE 2 · BANCO V3 — POSIÇÕES, ATRIBUTOS, GOLEIROS, TRAITS E VALIDAÇÃO
   ---------------------------------------------------------------------------
   Este módulo não reescreve o arquivo bruto. Ele cria uma camada canônica e
   auditável depois do decode legado, preservando compatibilidade com o jogo.

   Campos novos por atleta:
     p.positionsV3       posição primária, secundárias e emergenciais
     p.attributesV3      atributos granulares persistentes usados pelo motor
     p.profileV3         pé, pé fraco, altura de simulação e perfil físico
     p.behaviorTraits    tendências individuais de decisão
     p.naturalRoles      funções mais compatíveis
     p.dataQuality       origem/proveniência e alertas

   IMPORTANTE: altura e pé dos jogadores sem curadoria são PARÂMETROS DE
   SIMULAÇÃO estimados, não dados biográficos apresentados como fatos.
   ═══════════════════════════════════════════════════════════════════════════ */
(function installDataIntegrityV3(){
  const SCHEMA_VERSION = 3;
  const originalBuildDB = buildDB;
  const originalGetAttr = getAttr;
  const originalAttr8 = attr8;
  const originalAutoLineup = autoLineup;
  const VALID_SLOTS = new Set(SLOTS);
  const ALL_ENGINE_ATTRS = [...ATTR_KEYS.tec, ...ATTR_KEYS.men, ...ATTR_KEYS.fis, ...ATTR_KEYS.gk];
  const EXTRA_ATTRS = [
    'primeiro_toque','penaltis','concentracao','movimentacao','agressividade',
    'coragem','lideranca','consistencia','jogos_grandes','equilibrio',
    'condicionamento','um_contra_um','seguranca','jogo_aereo','chute_longo',
    'passe_curto','passe_longo'
  ];
  const ALL_V3_ATTRS = [...ALL_ENGINE_ATTRS, ...EXTRA_ATTRS];
  const POSITION_NEIGHBORS = Object.freeze({
    GK:  { secondary:[], emergency:[] },
    CB:  { secondary:['CDM'], emergency:['LB','RB'] },
    LB:  { secondary:['LWB','LM'], emergency:['CB','RB'] },
    RB:  { secondary:['RWB','RM'], emergency:['CB','LB'] },
    LWB: { secondary:['LB','LM','LW'], emergency:['CM'] },
    RWB: { secondary:['RB','RM','RW'], emergency:['CM'] },
    CDM: { secondary:['CM','CB'], emergency:['CAM'] },
    CM:  { secondary:['CDM','CAM'], emergency:['LM','RM'] },
    CAM: { secondary:['CM','CF'], emergency:['LW','RW'] },
    LM:  { secondary:['LW','LWB','CM'], emergency:['RM'] },
    RM:  { secondary:['RW','RWB','CM'], emergency:['LM'] },
    LW:  { secondary:['LM','RW','CAM'], emergency:['CF','ST'] },
    RW:  { secondary:['RM','LW','CAM'], emergency:['CF','ST'] },
    CF:  { secondary:['ST','CAM'], emergency:['LW','RW'] },
    ST:  { secondary:['CF'], emergency:['LW','RW'] },
  });
  const POSITION_WEIGHTS = Object.freeze({
    GK:  [0,0,0,0,0,0,0,0],
    CB:  [.02,.10,.03,.08,.31,.20,.17,.09],
    LB:  [.04,.14,.10,.19,.20,.12,.10,.11],
    RB:  [.04,.14,.10,.19,.20,.12,.10,.11],
    LWB: [.06,.15,.13,.20,.14,.10,.09,.13],
    RWB: [.06,.15,.13,.20,.14,.10,.09,.13],
    CDM: [.04,.17,.07,.08,.23,.20,.12,.09],
    CM:  [.09,.21,.13,.09,.12,.16,.09,.11],
    CAM: [.16,.21,.17,.10,.03,.14,.05,.14],
    LM:  [.11,.17,.17,.15,.07,.11,.07,.15],
    RM:  [.11,.17,.17,.15,.07,.11,.07,.15],
    LW:  [.18,.13,.20,.17,.02,.10,.05,.15],
    RW:  [.18,.13,.20,.17,.02,.10,.05,.15],
    CF:  [.25,.11,.15,.12,.02,.12,.08,.15],
    ST:  [.29,.08,.12,.14,.02,.10,.11,.14],
  });
  const HEIGHT_RANGES = Object.freeze({
    GK:[184,199], CB:[180,196], LB:[169,188], RB:[169,188], LWB:[168,187], RWB:[168,187],
    CDM:[172,191], CM:[169,189], CAM:[166,187], LM:[166,186], RM:[166,186],
    LW:[165,187], RW:[165,187], CF:[170,193], ST:[172,197]
  });
  const LEFT_FOOT_CURATED = new Set([
    'lionel messi','diego maradona','roberto carlos','rivaldo','arjen robben','mohamed salah',
    'gareth bale','angel di maria','mesut ozil','antoine griezmann','gheorghe hagi','hristo stoichkov',
    'ferenc puskas','james rodriguez','paulo futre','davor suker','robert jarni','marcelo',
    'raphael guerreiro','theo hernandez','bukayo saka','phil foden','bernardo silva','riyad mahrez',
    'ederson','manuel neuer'
  ]);
  const TWO_FOOT_CURATED = new Set([
    'pele','zinedine zidane','ronaldo','ronaldinho','neymar','kevin de bruyne','luka modric',
    'andres iniesta','xavi','santi cazorla','son heung min','pavel nedved','cristiano ronaldo'
  ]);

  /* Correções com confiança alta, identificadas pela auditoria do próprio banco
     e por casos inequívocos já observados no jogo. Chave normalizada do nome. */
  const ROOT_POSITION_OVERRIDES = Object.freeze({
    'vincent enyeama':'GK','ben foster':'GK','pepe reina':'GK','jose manuel reina':'GK',
    'rais mbolhi':'GK','david ospina':'GK','yoshikatsu kawaguchi':'GK','mohammed al owais':'GK',
    'lee woon jae':'GK','ali boumnijel':'GK','mouez hassen':'GK','fernando muslera':'GK',
    'oscar perez':'GK','alireza beiranvand':'GK','alireza biranvand':'GK','igor akinfeev':'GK','igor akinfeyev':'GK','aymen dahmen':'GK',
    'matt turner':'GK','jasper cillessen':'GK','gordon banks':'GK','banks':'GK','springett':'GK',
    'aleksandr golovin':'CAM','luke shaw':'LB','joseph yobo':'CB','simon kjaer':'CB',
    'vahid amiri':'LM','yassine meriah':'CB','anthony seric':'LB',
    'gonzalo jara':'CB','dejan lovren':'CB','joel matip':'CB','bruno alves':'CB',
    'sergey ignashevich':'CB','raphael guerreiro':'LB','jorge fucile':'RB',
    'francisco javier rodriguez':'CB','khosro heydari':'RB','hamdi nagguez':'RB',
    'oh beom seok':'RB','guillermo varela':'RB','diego laxalt':'LB','martin caceres':'CB',
    'sebastian coates':'CB','marcos rojo':'LB','davinson sanchez':'CB','santiago arias':'RB',
    'jefferson lerma':'CDM','william carvalho':'CDM','lucas torreira':'CDM',
    'yuriy zhirkov':'LM','arturo vidal':'CM','park ji sung':'CM','wesley sneijder':'CAM',
    'christian eriksen':'CAM','keisuke honda':'CAM','hidalgo nakata':'CAM','hidedoshi nakata':'CAM',
    'james rodriguez':'CAM','zvonimir boban':'CAM','steven gerrard':'CM','frank j lampard':'CM',
    'frank lampard':'CM','luka modric':'CM','ivan rakitic':'CM','diego forlan':'CF',
    'alexis sanchez':'LW','cha bum keun':'ST','kim joo sung':'LW','ivica olic':'ST',
    'martin braithwaite':'ST','jeremain lens':'RW','yakubu aiyegbeni':'ST','ola toivonen':'CF',
    'clint dempsey':'CF','andrew nabbout':'ST','salem ad dawsari':'LW','alireza jahanbakhsh':'RW',
    'giorgian de arrascaeta':'CAM','nahitan nandez':'CM','carlos sanchez':'RM',
    'cristian rodriguez':'LM','diego maradona':'CAM','maradona':'CAM','laudrup':'CAM',
    'randall brenes':'ST','jozy altidore':'ST','daryl janmaat':'RB','arjen robben':'RW',
    'bryan ruiz':'CAM','michael umana':'CB','cristian gamboa':'RB','giancarlo gonzalez':'CB',
    'joel campbell':'RW','roy miller':'LB','oscar duarte':'CB','yeltsin tejeda':'CDM','johnny acosta':'CB',
    'dirk kuyt':'RW','bruno martins indi':'CB','nigel de jong':'CDM','paul verhaegh':'RB',
    'daley blind':'LB','jordy clasie':'CM','memphis depay':'LW','jonathan de guzman':'CM',
    'georginio wijnaldum':'CM','stefan de vrij':'CB','ron vlaar':'CB',
    'morteza pouraliganji':'CB','majid hosseini':'CB','mehdi taremi':'ST','sardar azmoun':'ST',
    'masoud shojaei':'CAM','saeid ezzatollahi':'CDM','ramin rezaeian':'RB','ehsan hajsafi':'LB',
    'karim ansarifard':'ST','rouzbeh cheshmi':'CDM','omid ebrahimi':'CDM',
    'aleksandr samedov':'RM','alan dzagoyev':'CAM','igor smolnikov':'RB','fyodor kudryashov':'LB',
    'aleksey miranchuk':'CAM','daler kuzyayev':'CM','mario fernandes':'RB','roman zobnin':'CM',
    'yuriy gazinskiy':'CDM','ilya kutepov':'CB','fyodor smolov':'ST','denis cheryshev':'LW',
    'johnny haynes':'CAM','bobby moore':'CB','ron flowers':'CM','jimmy greaves':'ST','roger hunt':'ST',
    'armfield':'RB','wilson':'LB','hitchens':'ST'
  });

  /* Correções por edição evitam aplicar nomes curtos/comuns globalmente. São
     usadas apenas quando a auditoria estrutural confirmou deslocamento de
     colunas em um elenco específico. */
  const SQUAD_POSITION_OVERRIDES = Object.freeze({
    '1|merzekane':'RB','1|dahleb':'LW','1|bencheikh':'LW','1|assad':'LW',
    '115|springett':'GK','115|banks':'GK','115|armfield':'RB','115|haynes':'CAM',
    '115|wilson':'LB','115|moore':'CB','115|connely':'RW','115|eastham':'CM',
    '115|hodgkinson':'GK','115|hunt':'ST','115|swan':'CB','115|howe':'RB',
    '115|kevan':'ST','115|robson':'CM','115|flowers':'CM','115|douglas':'RW',
    '115|greaves':'ST','115|hitchens':'ST','115|peacock':'LW',
    '277|osama hawsawi':'CB','277|mohammed al owais':'GK','277|yasser al musailim':'GK',
    '277|yasser ash shahrani':'LB','277|hussain al moqahwi':'CM','277|abdullah otaif':'CDM',
    '277|omar hawsawi':'CB','277|mohammed as sahlawi':'ST','277|ali al buleihi':'CB',
    '277|salem ad dawsari':'LW','277|salman al faraj':'CM','277|hatan bahbri':'RW',
    '277|taisir al jassem':'CM','277|moataz hawsawi':'CB','277|fahad al muwaled':'RW',
    '277|mohammed al bureik':'RB','277|abdullah al mayouf':'GK','277|yahya ash shehri':'CAM',
    '289|oh yung kyo':'GK','289|cho byung duk':'GK','289|park kyung hoon':'RB',
    '289|chung yong hwan':'CB','289|cho min kook':'CB','289|kim yong se':'ST',
    '289|cho kwang rae':'CM','289|park chang sun':'CAM','289|noh soo jin':'ST',
    '289|byun byung joo':'RW','289|cho young jeung':'CB','289|kim sam hoo':'CB',
    '289|tae lee ho':'CM','289|kang deuk soo':'LM','289|yoo byung ok':'RB',
    '289|jung moo':'CM','289|kim jung nam':'CM','289|kim ho kon':'CB','289|huh':'CM',
    '289|choi soon ho':'CF','289|kim joo sung':'LW','289|cha bum keun':'ST',
    '361|tim howard':'GK','361|oguchi onyewu':'CB','361|jonathan bornstein':'LB',
    '361|ricardo clark':'CDM','361|carlos bocanegra':'CB','361|steve cherundolo':'RB',
    '361|robbie findley':'ST','361|jose francisco torres':'CM','361|jozy altidore':'ST',
    '361|landon donovan':'LW','361|clint dempsey':'CF','361|maurice edu':'CDM',
    '361|michael bradley':'CM','361|jay demerit':'CB','361|herculez gomez':'ST'
  });

  function normName(v){
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[’'`´]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
  }
  function signedHash(seed){
    return ((hash32(String(seed)) % 20001) / 10000) - 1;
  }
  function intHash(seed, min, max){
    return min + (hash32(String(seed)) % (max - min + 1));
  }
  function safeA8(p){
    if (Array.isArray(p && p.a8) && p.a8.length === 8) return p.a8;
    return null;
  }
  function lineOfSlot(pos){ return pos === 'GK' ? 'GK' : (LINE_OF[pos] || 'MID'); }
  function positionScore(p, pos){
    if (pos === 'GK') return p.slot === 'GK' ? (p.r || 50) : -999;
    const a = safeA8(p); if (!a) return p.slot === pos ? (p.r || 50) : -999;
    const w = POSITION_WEIGHTS[pos]; if (!w) return -999;
    let score = 0;
    for (let i=0;i<8;i++) score += a[i] * w[i];
    if (pos === p.slot) score += 2.5;
    if (lineOfSlot(pos) === lineOfSlot(p.slot)) score += 1.2;
    return score;
  }
  function rankedPositions(p){
    if (p.slot === 'GK') return [{pos:'GK', score:p.r || 50}];
    return SLOTS.filter(x => x !== 'GK').map(pos => ({pos,score:positionScore(p,pos)}))
      .sort((a,b)=>b.score-a.score);
  }
  function genericName(name){
    const n = normName(name); const parts = n.split(' ').filter(Boolean);
    return parts.length === 1 && (n.length < 7 || ['carlos','jose','mario','paulo','junior','oscar','silva','santos'].includes(n));
  }
  function buildConsensus(db){
    const groups = new Map();
    for (const sq of db.squads) for (const p of sq.pl || []) {
      if (genericName(p.n)) continue;
      const k = `${sq.nid}|${normName(p.n)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({p,sq});
    }
    const consensus = new Map();
    for (const [k, arr] of groups) {
      if (arr.length < 2) continue;
      const counts = new Map();
      for (const {p} of arr) counts.set(p.slot, (counts.get(p.slot)||0) + 1 + (p.starter ? .25 : 0));
      const ranked = [...counts.entries()].sort((a,b)=>b[1]-a[1]);
      const total = ranked.reduce((s,x)=>s+x[1],0);
      if (ranked[0] && (ranked[0][1] >= 2 || ranked[0][1] / total >= .67)) consensus.set(k, ranked[0][0]);
    }
    return consensus;
  }
  function resolvePrimary(p, sq, consensus){
    const root = normName(p.n);
    const squadFix = SQUAD_POSITION_OVERRIDES[`${sq.sid}|${root}`];
    if (squadFix) return {pos:squadFix, source:'squad-curated'};
    if (ROOT_POSITION_OVERRIDES[root]) return {pos:ROOT_POSITION_OVERRIDES[root], source:'curated'};
    /* A curadoria estrutural do decoder tem precedência sobre inferências. */
    if (p._positionFixed) return {pos:p.slot, source:'legacy-curated'};
    if (p.slot === 'GK') return {pos:'GK', source:'source'};
    const ck = `${sq.nid}|${root}`;
    const cp = consensus.get(ck);
    /* Consenso não promove jogador de linha a goleiro. Essa transição exige
       curadoria explícita, porque os lotes corrompidos continham GKs falsos. */
    if (cp && cp !== 'GK' && VALID_SLOTS.has(cp)) return {pos:cp, source:'cross-edition-consensus'};
    const ranked = rankedPositions(p);
    const currentScore = positionScore(p,p.slot);
    const best = ranked[0];
    /* Correção automática só cruza linhas com uma margem muito grande. Isso
       detecta fichas absurdas sem transformar inferência em curadoria histórica. */
    if (best && lineOfSlot(best.pos) !== lineOfSlot(p.slot) && best.score-currentScore >= 15 && best.score >= 67)
      return {pos:best.pos, source:'attribute-high-confidence'};
    return {pos:VALID_SLOTS.has(p.slot) ? p.slot : (best ? best.pos : 'CM'), source:p._positionFixed ? 'legacy-curated' : 'source'};
  }
  function buildPositionProfile(p, primary){
    if (primary === 'GK') return { primary:'GK', secondary:[], emergency:[], fit:{GK:100} };
    const ranked = rankedPositions(p);
    const primaryScore = positionScore(p,primary);
    const neighbors = POSITION_NEIGHBORS[primary] || {secondary:[],emergency:[]};
    const secondary = [];
    for (const pos of neighbors.secondary) {
      const sc = positionScore(p,pos);
      if (sc >= primaryScore - 7.5 && !secondary.includes(pos)) secondary.push(pos);
    }
    /* Garante pelo menos uma alternativa plausível quando o perfil é realmente
       versátil, sem liberar o jogador para uma linha incompatível. */
    if (!secondary.length) {
      const alt = ranked.find(x => x.pos !== primary && lineOfSlot(x.pos) === lineOfSlot(primary) && x.score >= primaryScore - 4.5);
      if (alt) secondary.push(alt.pos);
    }
    const emergency = neighbors.emergency.filter(pos => !secondary.includes(pos));
    const fit = {};
    for (const x of ranked.slice(0,8)) fit[x.pos] = Math.round(x.score*10)/10;
    fit[primary] = Math.round(primaryScore*10)/10;
    return { primary, secondary:secondary.slice(0,3), emergency:emergency.slice(0,3), fit };
  }
  function applyPosition(p, profile){
    p.positionsV3 = profile;
    p.slot = p.posCode = profile.primary;
    p.line = lineOfSlot(profile.primary);
    p.elig = [profile.primary, ...profile.secondary];
    p.emergencyElig = profile.emergency.slice();
    if (profile.primary === 'GK') p.elig = ['GK'];
  }
  function estimateFoot(p){
    const n = normName(p.n);
    if (TWO_FOOT_CURATED.has(n)) return {dominant:'B', weakFoot:5, source:'curated'};
    if (LEFT_FOOT_CURATED.has(n)) return {dominant:'L', weakFoot:Math.max(3, Math.min(5, Math.round((p.a8?.[7]||p.r||70)/22))), source:'curated'};
    const pos = p.slot;
    let leftChance = ['LB','LWB','LM','LW'].includes(pos) ? .58 : ['RB','RWB','RM','RW'].includes(pos) ? .16 : .24;
    const roll = (hash32(p.id+'#foot') % 1000)/1000;
    const dominant = roll < leftChance ? 'L' : 'R';
    const tech = p.a8?.[7] || p.r || 65;
    const twoFoot = tech >= 87 && (hash32(p.id+'#twofoot') % 100) < 18;
    return { dominant:twoFoot?'B':dominant, weakFoot:twoFoot?5:clamp(2+Math.round((tech-55)/18)+intHash(p.id+'#wf',0,1),2,4), source:'simulation-estimate' };
  }
  function estimateHeight(p){
    const [lo,hi] = HEIGHT_RANGES[p.slot] || [169,190];
    const fis = p.a8?.[6] || p.r || 70;
    const center = lo + (hi-lo) * clamp((fis-45)/55,0,1);
    return clamp(Math.round(center + signedHash(p.id+'#height')*4.5),lo,hi);
  }
  function makeBodyType(p,height){
    const fis = p.a8?.[6] || p.r || 70;
    if (height >= 190 && fis >= 78) return 'alto_e_forte';
    if (height <= 174 && (p.a8?.[3]||0) >= 78) return 'baixo_e_explosivo';
    if (fis >= 82) return 'forte';
    if ((p.a8?.[3]||0) >= 82) return 'veloz';
    return 'equilibrado';
  }
  function buildExpandedAttributes(p){
    const out = {};
    const base = key => originalGetAttr(p,key);
    for (const key of ALL_ENGINE_ATTRS) {
      /* Ruído por atributo menor que 3 pontos: desfaz clones matemáticos sem
         apagar os oito fundamentos do banco. */
      const amp = p.slot === 'GK' ? 2.4 : 2.0;
      out[key] = clamp(Math.round(base(key) + signedHash(p.id+'#v3#'+key)*amp),20,99);
    }
    out.primeiro_toque = clamp(Math.round(out.conducao*.48 + out.drible*.24 + out.compostura*.18 + out.passe*.10 + signedHash(p.id+'#first')*2),20,99);
    out.penaltis = clamp(Math.round(out.bola_parada*.34 + out.finalizacao*.34 + out.compostura*.32 + signedHash(p.id+'#pen')*3),20,99);
    out.concentracao = clamp(Math.round(out.posicionamento*.34 + out.decisao*.27 + out.antecipacao*.24 + out.determinacao*.15 + signedHash(p.id+'#conc')*2.5),20,99);
    out.movimentacao = clamp(Math.round(out.posicionamento*.32 + out.antecipacao*.28 + out.decisao*.20 + out.ritmo*.12 + out.agilidade*.08 + signedHash(p.id+'#offball')*2.5),20,99);
    out.agressividade = clamp(Math.round(out.determinacao*.35 + out.forca*.24 + out.desarme*.18 + out.trabalho_equipe*.10 + 8 + signedHash(p.id+'#agg')*5),20,99);
    out.coragem = clamp(Math.round(out.determinacao*.42 + out.forca*.25 + out.antecipacao*.15 + out.trabalho_equipe*.08 + 7 + signedHash(p.id+'#brave')*4),20,99);
    out.lideranca = clamp(Math.round((p.r||65)*.48 + out.determinacao*.28 + out.trabalho_equipe*.24 + signedHash(p.id+'#lead')*5),20,99);
    out.consistencia = clamp(Math.round(56 + (p.r||65)*.32 + out.decisao*.15 + signedHash(p.id+'#cons')*6),35,96);
    out.jogos_grandes = clamp(Math.round(50 + (p.r||65)*.36 + out.compostura*.18 + (p.traits||[]).includes('CLUTCH_PLAYER')*8 + signedHash(p.id+'#big')*6),30,98);
    out.equilibrio = clamp(Math.round(out.agilidade*.42 + out.forca*.28 + out.conducao*.18 + out.compostura*.12 + signedHash(p.id+'#bal')*2),20,99);
    out.condicionamento = clamp(Math.round(out.resistencia*.55 + out.determinacao*.18 + out.forca*.12 + 12 + signedHash(p.id+'#fit')*4),30,99);
    out.um_contra_um = clamp(Math.round(out.reflexos*.40 + out.saida_gol*.26 + out.posicionamento*.20 + out.agilidade*.14 + signedHash(p.id+'#1v1')*2),20,99);
    out.seguranca = clamp(Math.round(out.defesa*.45 + out.dominio_area*.25 + out.posicionamento*.18 + out.compostura*.12 + signedHash(p.id+'#hand')*2),20,99);
    out.jogo_aereo = clamp(Math.round(out.dominio_area*.42 + out.impulsao*.24 + out.forca*.15 + out.antecipacao*.19 + signedHash(p.id+'#air')*2),20,99);
    out.chute_longo = clamp(Math.round(out.reposicao*.45 + out.forca*.22 + out.passe*.20 + out.decisao*.13 + signedHash(p.id+'#kick')*2),20,99);
    out.passe_curto = clamp(Math.round(out.reposicao*.30 + out.passe*.35 + out.compostura*.20 + out.decisao*.15 + signedHash(p.id+'#short')*2),20,99);
    out.passe_longo = clamp(Math.round(out.reposicao*.32 + out.passe*.28 + out.visao*.20 + out.forca*.12 + out.decisao*.08 + signedHash(p.id+'#long')*2),20,99);
    if (p.slot !== 'GK') {
      /* Para jogadores de linha, os atributos de goleiro ficam explicitamente
         baixos; evita qualquer sistema futuro confundi-los com goleiros. */
      for (const k of ATTR_KEYS.gk) out[k] = clamp(Math.round(18 + signedHash(p.id+'#nogk#'+k)*4),10,25);
      out.um_contra_um = out.seguranca = out.jogo_aereo = out.chute_longo = out.passe_curto = out.passe_longo = 20;
    } else {
      /* Goleiros recebem ficha completa, inclusive os 91 que não tinham A8. */
      out.finalizacao = clamp(12 + intHash(p.id+'#gkfin',0,8),10,25);
      out.drible = clamp(20 + Math.round((p.r-60)*.22) + intHash(p.id+'#gkdri',-3,4),15,45);
      out.desarme = clamp(22 + Math.round((p.r-60)*.20) + intHash(p.id+'#gktac',-3,4),18,48);
      out.cabeceio = clamp(18 + intHash(p.id+'#gkhead',0,10),15,32);
      out.marcacao = clamp(20 + intHash(p.id+'#gkmark',0,8),16,32);
      out.passe = clamp(Math.round(out.passe_curto*.55 + out.passe_longo*.45),25,88);
      if ((p.traits||[]).includes('SWEEPER_KEEPER')) {
        out.saida_gol = clamp(out.saida_gol+5,20,99);
        out.reposicao = clamp(out.reposicao+4,20,99);
        out.agilidade = clamp(out.agilidade+3,20,99);
      }
    }
    return Object.freeze(out);
  }
  function assignLegacyTraits(p){
    const old = [...new Set(p.traits || [])];
    p.legacyTraits = old.slice();
    const a = p.attributesV3 || {};
    const candidates = [];
    const add = (trait,score) => candidates.push({trait,score});
    if (p.slot === 'GK') {
      add('SWEEPER_KEEPER',(a.saida_gol||0)*.55+(a.reposicao||0)*.45);
      add('LEADER',(a.lideranca||0));
    } else {
      add('FINISHER',(a.finalizacao||0)*.62+(a.compostura||0)*.38);
      add('PLAYMAKER',(a.passe||0)*.48+(a.visao||0)*.36+(a.decisao||0)*.16);
      add('BALL_WINNER',(a.desarme||0)*.42+(a.marcacao||0)*.30+(a.antecipacao||0)*.28);
      add('SPEEDSTER',(a.ritmo||0)*.52+(a.aceleracao||0)*.48);
      add('DRIBBLER',(a.drible||0)*.55+(a.agilidade||0)*.25+(a.conducao||0)*.20);
      add('AERIAL_THREAT',(a.cabeceio||0)*.48+(a.impulsao||0)*.34+(a.forca||0)*.18);
      add('SET_PIECE_SPECIALIST',(a.bola_parada||0)*.68+(a.cruzamento||0)*.17+(a.chute_longe||0)*.15);
      add('LEADER',(a.lideranca||0));
    }
    if ((a.jogos_grandes||0) >= 84 && p.r >= 84) add('CLUTCH_PLAYER',a.jogos_grandes+3);
    candidates.sort((x,y)=>y.score-x.score);
    const target = p.r >= 90 ? 3 : p.r >= 80 || p.starter ? 2 : p.r >= 64 ? 1 : 0;
    for (const c of candidates) {
      if ((p.traits||[]).length >= Math.max(target,old.length)) break;
      if (c.score < (p.starter || p.r>=68 ? 60 : 66) || (p.traits||[]).includes(c.trait)) continue;
      p.traits.push(c.trait);
    }
    p.traits = [...new Set(p.traits || [])].slice(0,4);
  }
  function behaviorTraitsFor(p){
    const a = p.attributesV3;
    const out = [];
    const add = (id,score,limit=78) => { if (score >= limit) out.push({id,score:Math.round(score)}); };
    if (p.slot === 'GK') {
      add('GOLEIRO_LIBERO',a.saida_gol*.55+a.ritmo*.15+a.antecipacao*.30,76);
      add('DISTRIBUIDOR_CURTO',a.passe_curto*.58+a.compostura*.22+a.decisao*.20,76);
      add('LANCADOR',a.passe_longo*.58+a.visao*.22+a.chute_longo*.20,78);
      add('DOMINA_AREA',a.jogo_aereo*.52+a.seguranca*.28+a.coragem*.20,77);
    } else {
      add('FINALIZADOR_FRIO',a.finalizacao*.55+a.compostura*.45,80);
      add('PASSE_VERTICAL',a.passe*.42+a.visao*.40+a.decisao*.18,80);
      add('CHUTA_DE_LONGE',a.chute_longe*.58+a.compostura*.20+a.conducao*.22,81);
      add('CONDUZ_E_DRIBLA',a.drible*.43+a.conducao*.30+a.agilidade*.27,80);
      add('PRESSIONADOR',a.trabalho_equipe*.33+a.resistencia*.27+a.antecipacao*.24+a.determinacao*.16,80);
      add('MARCADOR_POSICIONAL',a.marcacao*.42+a.posicionamento*.35+a.concentracao*.23,80);
      add('AMEACA_AEREA',a.cabeceio*.45+a.impulsao*.35+a.forca*.20,80);
      add('ATACA_PROFUNDIDADE',a.movimentacao*.38+a.ritmo*.34+a.aceleracao*.28,81);
      add('CRUZA_CEDO',a.cruzamento*.50+a.visao*.25+a.decisao*.25,80);
      add('JOGA_ENTRELINHAS',a.primeiro_toque*.27+a.visao*.31+a.movimentacao*.23+a.compostura*.19,81);
    }
    out.sort((x,y)=>y.score-x.score);
    if (!out.length && (p.starter || p.r >= 64)) {
      if (p.slot === 'GK') out.push({id:'GOLEIRO_DE_LINHA',score:70});
      else if (['CB','LB','RB','LWB','RWB','CDM'].includes(p.slot)) out.push({id:'MARCADOR_POSICIONAL',score:70});
      else if (['CM','CAM','LM','RM'].includes(p.slot)) out.push({id:'APOIO_E_CONEXAO',score:70});
      else out.push({id:'ATACA_PROFUNDIDADE',score:70});
    }
    return out.slice(0,4).map(x=>x.id);
  }
  function naturalRolesFor(p){
    const roles = rolesForSlot(p.slot);
    if (!roles || !roles.length) return [defaultRoleFor(p.slot)];
    const a = p.attributesV3;
    const score = role => {
      const id = role.id;
      let s = p.r || 60;
      if (id.includes('saida') || id.includes('construtor') || id.includes('armador')) s = a.passe*.35+a.visao*.30+a.decisao*.20+a.compostura*.15;
      else if (id.includes('defensivo') || id.includes('contencao') || id.includes('defensor')) s = a.marcacao*.30+a.desarme*.27+a.posicionamento*.23+a.antecipacao*.20;
      else if (id.includes('ofensivo') || id.includes('atacante') || id.includes('artilheiro')) s = a.movimentacao*.24+a.ritmo*.20+a.finalizacao*.28+a.drible*.16+a.compostura*.12;
      else if (id.includes('invertido') || id.includes('espaco') || id.includes('falso')) s = a.passe*.22+a.visao*.22+a.drible*.20+a.primeiro_toque*.20+a.decisao*.16;
      else if (id.includes('alvo')) s = a.forca*.30+a.cabeceio*.28+a.impulsao*.24+a.compostura*.18;
      else if (id.includes('libero')) s = (p.slot==='GK'?a.saida_gol:a.passe)*.34+a.antecipacao*.27+a.ritmo*.18+a.decisao*.21;
      else s = a.trabalho_equipe*.24+a.decisao*.22+a.resistencia*.18+a.passe*.18+a.posicionamento*.18;
      return s;
    };
    return roles.map(r=>({id:r.id,score:Math.round(score(r))})).sort((a,b)=>b.score-a.score).slice(0,3);
  }
  function profilePlayer(p, sq, consensus, stats){
    const resolved = resolvePrimary(p,sq,consensus);
    const before = p.slot;
    const posProfile = buildPositionProfile(p,resolved.pos);
    applyPosition(p,posProfile);
    if (before !== p.slot) stats.positionCorrections.push({sid:sq.sid,team:sq.c,year:sq.y,id:p.id,name:p.n,from:before,to:p.slot,source:resolved.source});
    const foot = estimateFoot(p);
    const heightCmSim = estimateHeight(p);
    p.profileV3 = Object.freeze({
      dominantFoot:foot.dominant, weakFoot:foot.weakFoot, footSource:foot.source,
      heightCmSim, heightSource:'simulation-estimate', bodyType:makeBodyType(p,heightCmSim),
      primaryPosition:p.slot
    });
    /* Primeira geração usa traits legados para derivar a ficha; depois amplia
       traits e recalcula uma vez, mantendo coerência e identidade. */
    p.attributesV3 = buildExpandedAttributes(p);
    assignLegacyTraits(p);
    p.attributesV3 = buildExpandedAttributes(p);
    p.behaviorTraits = behaviorTraitsFor(p);
    p.naturalRoles = naturalRolesFor(p);
    p.dataQuality = {
      schemaVersion:SCHEMA_VERSION,
      positionSource:resolved.source,
      footSource:foot.source,
      heightSource:'simulation-estimate',
      attributesSource:p.slot==='GK'?'goalkeeper-v3-synthetic':'a8-v3-decorrelated',
      historicallyVerified:false,
      warnings:[]
    };
    if (resolved.source === 'attribute-high-confidence') p.dataQuality.warnings.push('posição corrigida por perfil de atributos');
    if (foot.source === 'simulation-estimate') p.dataQuality.warnings.push('pé dominante estimado para simulação');
    p._a = {};
    stats.players++;
    if (p.traits.length) stats.traitPlayers++;
    if (p.behaviorTraits.length) stats.behaviorTraitPlayers++;
    if (p.slot === 'GK') stats.goalkeepers++;
  }
  function enrichDatabase(db){
    const consensus = buildConsensus(db);
    const stats = {schemaVersion:SCHEMA_VERSION,players:0,goalkeepers:0,traitPlayers:0,behaviorTraitPlayers:0,positionCorrections:[]};
    for (const sq of db.squads) {
      for (const p of sq.pl || []) profilePlayer(p,sq,consensus,stats);
      /* Mantém números e ordenação depois das correções. */
      const order = {GK:0,DEF:1,MID:2,FWD:3};
      sq.pl.sort((a,b)=>(order[a.line]-order[b.line])||(b.r-a.r));
    }
    stats.traitCoveragePct = +(stats.traitPlayers/Math.max(1,stats.players)*100).toFixed(2);
    stats.behaviorTraitCoveragePct = +(stats.behaviorTraitPlayers/Math.max(1,stats.players)*100).toFixed(2);
    return stats;
  }
  function positionTier(p,slot){
    if (!p || !p.positionsV3) return p && p.slot===slot ? 0 : canPlay(p,slot) ? 1 : lineOfSlot(p?.slot)===lineOfSlot(slot) ? 3 : 5;
    if (p.positionsV3.primary === slot) return 0;
    if (p.positionsV3.secondary.includes(slot)) return 1;
    if (p.positionsV3.emergency.includes(slot)) return 2;
    if (lineOfSlot(p.positionsV3.primary) === lineOfSlot(slot)) return 3;
    return 5;
  }
  function strictAutoLineup(squad, formKey, varIdx){
    const form = FORMATIONS[formKey];
    const variation = form.variations[(varIdx||0)%form.variations.length];
    const slots = variation.slots;
    const pool = dedupeRoster((squad.pl||[]).slice(),squad.c||squad.sid);
    const used = new Set(); const filled = new Array(slots.length);
    const line = p => lineOfSlot(p?.positionsV3?.primary || p?.slot);
    const forbidden = (slot,p) => {
      const a=lineOfSlot(slot),b=line(p);
      return (a==='GK')!==(b==='GK') || (a==='DEF'&&b==='FWD') || (a==='FWD'&&b==='DEF');
    };
    const order = slots.map((s,i)=>({s,i,available:pool.filter(p=>!forbidden(s.pos,p)&&positionTier(p,s.pos)<=2).length}))
      .sort((a,b)=>(a.s.pos==='GK'?-1:0)-(b.s.pos==='GK'?-1:0)||a.available-b.available);
    for (const item of order) {
      const {s,i}=item;
      const free=pool.filter(p=>!used.has(p.id)&&!forbidden(s.pos,p));
      const ranked=free.map(p=>({p,tier:positionTier(p,s.pos),fit:p.positionsV3?.fit?.[s.pos] ?? positionScore(p,s.pos)}))
        .sort((a,b)=>a.tier-b.tier||(b.p.starter-a.p.starter)*3+(b.fit-a.fit)*.18+(b.p.r-a.p.r));
      let chosen=ranked[0]?.p;
      if (!chosen) {
        /* Último recurso continua respeitando a natureza GK × linha. Um elenco
           curto pode improvisar entre linhas de campo, mas nunca coloca goleiro
           na linha nem jogador de linha no gol. */
        const wantedGK = s.pos === 'GK';
        chosen = pool.filter(p=>!used.has(p.id) && (((p.positionsV3?.primary||p.slot)==='GK')===wantedGK))
          .sort((a,b)=>(b.starter-a.starter)*3+(b.r-a.r))[0];
      }
      if (chosen) used.add(chosen.id);
      filled[i]={p:chosen,x:s.x,y:s.y,pos:s.pos,compatibility:chosen?positionTier(chosen,s.pos):9};
    }
    return {lineup:filled,bench:pool.filter(p=>!used.has(p.id)).slice(0,5)};
  }
  function validateDatabaseV3(db, full=false){
    const report={schemaVersion:SCHEMA_VERSION,squads:db.squads.length,players:0,errors:[],warnings:[],counts:{positions:{},traits:{},behaviorTraits:{},positionSources:{}},lineups:null};
    const ids=new Set();
    for (const sq of db.squads) {
      let gks=0;
      for (const p of sq.pl||[]) {
        report.players++;
        if (ids.has(p.id)) report.errors.push({code:'DUPLICATE_ID',sid:sq.sid,id:p.id}); else ids.add(p.id);
        if (!VALID_SLOTS.has(p.slot)) report.errors.push({code:'INVALID_POSITION',sid:sq.sid,id:p.id,pos:p.slot});
        if (p.slot==='GK') gks++;
        if (!p.positionsV3 || p.positionsV3.primary!==p.slot) report.errors.push({code:'POSITION_PROFILE_MISSING',sid:sq.sid,id:p.id});
        if (!p.attributesV3) report.errors.push({code:'ATTRIBUTES_V3_MISSING',sid:sq.sid,id:p.id});
        else for (const k of ALL_V3_ATTRS) if (!Number.isFinite(p.attributesV3[k]) || p.attributesV3[k]<1 || p.attributesV3[k]>100) report.errors.push({code:'INVALID_ATTRIBUTE',sid:sq.sid,id:p.id,key:k,value:p.attributesV3[k]});
        if (!p.profileV3?.dominantFoot || !Number.isFinite(p.profileV3?.heightCmSim)) report.errors.push({code:'PROFILE_MISSING',sid:sq.sid,id:p.id});
        if (p.slot==='GK' && (p.elig.length!==1 || p.elig[0]!=='GK')) report.errors.push({code:'GK_ELIGIBILITY',sid:sq.sid,id:p.id,elig:p.elig});
        report.counts.positions[p.slot]=(report.counts.positions[p.slot]||0)+1;
        for (const t of p.traits||[]) report.counts.traits[t]=(report.counts.traits[t]||0)+1;
        for (const t of p.behaviorTraits||[]) report.counts.behaviorTraits[t]=(report.counts.behaviorTraits[t]||0)+1;
        const src=p.dataQuality?.positionSource||'unknown'; report.counts.positionSources[src]=(report.counts.positionSources[src]||0)+1;
      }
      if (!gks) report.errors.push({code:'SQUAD_WITHOUT_GK',sid:sq.sid,team:sq.c,year:sq.y});
      if (gks>4) report.warnings.push({code:'SQUAD_TOO_MANY_GK',sid:sq.sid,count:gks});
    }
    report.traitCoveragePct=+(Object.values(report.counts.traits).reduce((a,b)=>a+b,0)/Math.max(1,report.players)*100).toFixed(2);
    if (full) {
      const l={tested:0,exact:0,secondary:0,emergency:0,sameLine:0,bridgeLine:0,crossLine:0,invalidGoalkeepers:0,missing:0,samples:[]};
      for (const sq of db.squads) for (const fk of FORMATION_KEYS) for (let vi=0;vi<FORMATIONS[fk].variations.length;vi++) {
        const r=strictAutoLineup(sq,fk,vi); l.tested++;
        const gkCount=r.lineup.filter(x=>x?.p?.slot==='GK').length;
        if (gkCount!==1) l.invalidGoalkeepers++;
        for (const x of r.lineup) {
          if (!x?.p){l.missing++;continue;}
          const t=positionTier(x.p,x.pos);
          if(t===0)l.exact++;else if(t===1)l.secondary++;else if(t===2)l.emergency++;else if(t===3)l.sameLine++;else{
            const from=lineOfSlot(x.p.slot),to=lineOfSlot(x.pos);
            const absurd=(from==='GK'||to==='GK'||(from==='DEF'&&to==='FWD')||(from==='FWD'&&to==='DEF'));
            if(absurd){l.crossLine++;if(l.samples.length<50)l.samples.push({sid:sq.sid,team:sq.c,year:sq.y,player:x.p.n,from:x.p.slot,to:x.pos});}
            else l.bridgeLine++;
          }
        }
      }
      report.lineups=l;
    }
    report.ok=report.errors.length===0 && (!report.lineups || (report.lineups.invalidGoalkeepers===0&&report.lineups.missing===0&&report.lineups.crossLine===0));
    return report;
  }

  /* O motor passa a ler a ficha persistente V3. */
  getAttr = function getAttrV3(p,key){
    if (p && p.ref) p=p.ref;
    if (p && p.attributesV3 && Number.isFinite(p.attributesV3[key])) return p.attributesV3[key];
    return originalGetAttr(p,key);
  };
  attr8 = function attr8V3(p){
    if (p && p.ref) p=p.ref;
    if (!p || !p.attributesV3) return originalAttr8(p);
    const a=k=>getAttr(p,k),w=items=>Math.round(items.reduce((s,[k,q])=>s+a(k)*q,0));
    if (p.slot==='GK') return [
      {k:'REF',l:'Reflexos',v:a('reflexos')},{k:'SEG',l:'Segurança',v:a('seguranca')},
      {k:'1X1',l:'Um contra um',v:a('um_contra_um')},{k:'AER',l:'Jogo aéreo',v:a('jogo_aereo')},
      {k:'SAI',l:'Saída',v:a('saida_gol')},{k:'REP',l:'Reposição',v:a('reposicao')},
      {k:'DEC',l:'Decisão',v:a('decisao')},{k:'COM',l:'Compostura',v:a('compostura')}
    ];
    return [
      {k:'FIN',l:'Finalização',v:w([['finalizacao',.72],['chute_longe',.16],['cabeceio',.12]])},
      {k:'PAS',l:'Passe',v:w([['passe',.58],['visao',.24],['cruzamento',.18]])},
      {k:'DRI',l:'Drible',v:w([['drible',.50],['conducao',.28],['primeiro_toque',.22]])},
      {k:'VEL',l:'Velocidade',v:w([['ritmo',.56],['aceleracao',.44]])},
      {k:'DEF',l:'Defesa',v:w([['marcacao',.38],['desarme',.36],['posicionamento',.26]])},
      {k:'INT',l:'Inteligên.',v:w([['decisao',.30],['antecipacao',.25],['visao',.20],['concentracao',.15],['movimentacao',.10]])},
      {k:'FIS',l:'Físico',v:w([['forca',.24],['resistencia',.25],['agilidade',.18],['equilibrio',.16],['impulsao',.17]])},
      {k:'TEC',l:'Técnica',v:w([['conducao',.28],['primeiro_toque',.24],['bola_parada',.18],['cruzamento',.15],['chute_longe',.15]])}
    ];
  };
  autoLineup = strictAutoLineup;
  if (typeof __CORE!=='undefined') { __CORE.getAttr=getAttr; __CORE.attr8=attr8; __CORE.autoLineup=autoLineup; }
  buildDB = function buildDBV3(DATA){
    const db=originalBuildDB(DATA);
    const enrichment=enrichDatabase(db);
    const audit=validateDatabaseV3(db,false);
    audit.enrichment=enrichment;
    window.CDS_DATA_AUDIT=audit;
    window.CDS_DATA_SCHEMA_VERSION=SCHEMA_VERSION;
    return db;
  };
  if (typeof __CORE!=='undefined') __CORE.buildDB=buildDB;
  window.CDSDataV3=Object.freeze({
    schemaVersion:SCHEMA_VERSION, normName, positionScore, rankedPositions, positionTier,
    validateDatabase:validateDatabaseV3, enrichDatabase, strictAutoLineup,
    attributes:ALL_V3_ATTRS.slice()
  });
})();
