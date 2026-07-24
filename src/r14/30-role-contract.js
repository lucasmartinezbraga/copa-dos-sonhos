/*
 * Copa dos Sonhos · §18 · CONTRATO DE FUNÇÃO — passo 1 de 6
 *
 * O problema (medido, não suposto): a função de cada jogador é INFERIDA em
 * quatro lugares independentes, com quatro definições da mesma ideia —
 * `line13()` em `_assignDefRoles`, `laneOf()` em terços, o literal
 * `['LB','RB','LWB','RWB','LM','RM']` para flanco, e `p.dhy/p.hy` em
 * `_defendTarget`. Não existe fonte única do que um jogador É. É a causa-raiz
 * de `marking_coverage` travado em 0,54–0,56 e de 4 gates que não têm como ser
 * medidos (`role_observable`, `zone_discipline`, …).
 *
 * ESTE PASSO NÃO CORRIGE NADA. Ele apenas cria o objeto e o preenche, uma vez
 * por jogador por partida, a partir do que o motor JÁ calculou. Ninguém lê.
 *
 * É de propósito: o critério pré-registrado do §18
 * (`reports/r15/CRITERIO-POS-18-PRE-REGISTRADO.md`, item 0) exige paridade
 * determinística — 294/294 placares idênticos e métricas iguais até 1e-9 —
 * ANTES de qualquer leitura. Se a matriz mudar, o contrato vazou para o motor
 * antes da hora, e a regra é reverter, não ajustar.
 *
 * Duas precauções para que o vazamento seja impossível por construção:
 *
 *   1. `contract` é definido com `enumerable: false`. `Object.keys`, spread e
 *      `JSON.stringify` não o enxergam — nenhum snapshot, save ou serialização
 *      do observador pode captá-lo por acidente.
 *   2. Nada aqui escreve em campo nenhum que o motor leia. O módulo só LÊ
 *      `dhx/dhy/ahx/ahy/slotPos/role/idx`, que `_buildTeam` acabou de produzir.
 *
 * LINE_OF é redefinido aqui porque o original (`10-base-bundle.js:121`) é
 * `const` de escopo de script e não é exportado. `__contractAudit.slotsUnknown`
 * registra qualquer slot que este mapa não conheça, para que a divergência
 * apareça no passo 2 em vez de silenciar.
 */
(function installCDSRoleContract(root) {
  'use strict';
  const M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__CDS_R18_CONTRACT__) return;
  const P = M.prototype;
  P.__CDS_R18_CONTRACT__ = true;

  const VERSION = '5.9.4-R18.0-inerte';
  const FL = 105, FW = 68;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);

  const LINE_OF = {
    GK: 'GK',
    CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
    CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
    LW: 'FWD', RW: 'FWD', CF: 'FWD', ST: 'FWD'
  };

  /* Cinco corredores, não três. Terços misturam ala com zagueiro central, que é
     exatamente a confusão que o §18 existe para desfazer.
     y baixo = esquerda, coerente com `side` e com `mkHomes`. */
  const CORRIDORS = ['L', 'CL', 'C', 'CR', 'R'];

  /* O corredor vem do SLOT, não do y do momento. Medido na primeira versão
     desta sonda: derivando de `dhy`, 210 de 374 jogadores caíam em 'C' e só 9
     nas faixas L/R — porque no bloco defensivo o time inteiro está compacto.
     Um lateral-esquerdo é do corredor esquerdo mesmo encolhido para o miolo;
     é isso que "responsabilidade espacial persistente" significa. */
  const WIDE_LEFT = new Set(['LB', 'LWB', 'LM', 'LW']);
  const WIDE_RIGHT = new Set(['RB', 'RWB', 'RM', 'RW']);

  /* Progresso no campo próprio: 0 = linha de fundo própria, 1 = do adversário.
     Espelha `const P = v => side===0 ? v : FL-v` do `mkHomes` do motor. */
  const ownProg = (side, x) => clamp((side === 0 ? finite(x) : FL - finite(x)) / FL, 0, 1);

  /* Raio da zona permitida, por linha. Zagueiro tem menos licença que ponta —
     é isso que "responsabilidade espacial persistente" quer dizer. Elipse: mais
     larga em x (profundidade do bloco) do que em y (disciplina de corredor). */
  const ZONE = {
    GK:  { rx: 9.0,  ry: 7.0 },
    DEF: { rx: 11.0, ry: 8.5 },
    MID: { rx: 15.0, ry: 12.0 },
    FWD: { rx: 19.0, ry: 15.0 }
  };

  /* Quanto este slot persegue referência em vez de segurar zona. */
  const MARK_PRIORITY = { GK: 0.00, DEF: 0.85, MID: 0.55, FWD: 0.20 };

  /* Histerese declarada. NÃO é lida por ninguém neste passo — entra em vigor no
     passo 4, junto com `assignmentId`. Os valores estão aqui para serem
     revisados agora, não improvisados depois. */
  const HOLD = { GK: 0.0, DEF: 1.8, MID: 1.4, FWD: 0.9 };   // segundos
  const SWITCH_COST = { GK: 0, DEF: 4.5, MID: 3.0, FWD: 1.5 }; // no escore de atribuição
  const RISK = { GK: 0.10, DEF: 0.25, MID: 0.50, FWD: 0.75 };

  function buildContract(p, side, audit) {
    const slot = String(p.slotPos || (p.ref && p.ref.slot) || 'CM');
    const line = LINE_OF[slot] || (audit.slotsUnknown.push(slot), 'MID');
    const z = ZONE[line] || ZONE.MID;

    const dhx = finite(p.dhx, p.hx), dhy = finite(p.dhy, p.hy);
    const ahx = finite(p.ahx, p.hx), ahy = finite(p.ahy, p.hy);

    return {
      version: VERSION,
      id: `${side}:${p.idx}:${slot}`,
      idx: p.idx, team: side, slot, line,

      /* ── geometria de responsabilidade ─────────────────────────────────── */
      homeZone: {
        defend: { x: dhx, y: dhy, rx: z.rx, ry: z.ry },
        attack: { x: ahx, y: ahy, rx: z.rx, ry: z.ry }
      },
      /* preenchidos no segundo passe (`assignStructure`): dependem do time
         inteiro, não só deste jogador */
      corridor: null,
      corridorAttack: null,
      /* lado: -1 esquerda, 0 miolo, +1 direita — do ponto de vista do time */
      side: dhy < FW / 2 - 6 ? -1 : dhy > FW / 2 + 6 ? 1 : 0,
      height: ownProg(side, dhx),
      heightAttack: ownProg(side, ahx),
      width: clamp(Math.abs(dhy - FW / 2) / (FW / 2), 0, 1),

      /* ── função por fase (o motor já resolveu; aqui só fica declarado) ──── */
      onBall: p.ipRole || p.role || null,
      offBall: p.oopRole || null,
      focus: p.focus || 'bal',
      inTransitionA: line === 'DEF' ? 'hold' : line === 'MID' ? 'support' : 'break',
      inTransitionD: line === 'FWD' ? 'delay' : 'recover',

      /* ── responsabilidade defensiva (preenchida no segundo passe) ───────── */
      coverFor: [], coveredBy: [],
      markPriority: MARK_PRIORITY[line],

      /* ── histerese: declarada agora, aplicada no passo 4 ────────────────── */
      minHoldSeconds: HOLD[line],
      switchCost: SWITCH_COST[line],
      riskTolerance: RISK[line],
      leaveZoneWhen: line === 'DEF'
        ? ['markRef_entra_na_zona', 'sobrecarga_no_corredor', 'bola_no_proprio_terco']
        : ['pressing_trigger', 'apoio_ao_portador', 'transicao_ofensiva'],
      returnZoneWhen: ['referencia_transferida', 'bola_sai_do_setor', 'compensador_fora_de_posicao'],

      /* ── só auditoria; nenhum destes campos governa comportamento ───────── */
      preferredActions: [], forbiddenActions: []
    };
  }

  const ADJACENT = { GK: ['DEF'], DEF: ['MID', 'GK'], MID: ['DEF', 'FWD'], FWD: ['MID'] };

  /* Segundo passe: corredor e cobertura dependem do time inteiro, não do
     jogador isolado. */
  function assignStructure(players) {
    const byLine = {};
    for (const p of players) {
      if (!p.contract) continue;
      (byLine[p.contract.line] = byLine[p.contract.line] || []).push(p);
    }

    /* ── corredor ──────────────────────────────────────────────────────────
       Slots largos são L/R por definição. Os centrais se distribuem entre
       CL/C/CR pela ordem de y DENTRO da própria linha — é o que produz o
       "DCR/DCL" legível do FM em vez de quatro jogadores marcados 'C'. */
    for (const line of Object.keys(byLine)) {
      const row = byLine[line];
      const centrais = row.filter(p => !WIDE_LEFT.has(p.contract.slot) &&
                                       !WIDE_RIGHT.has(p.contract.slot));
      for (const p of row) {
        const s = p.contract.slot;
        if (WIDE_LEFT.has(s)) p.contract.corridor = 'L';
        else if (WIDE_RIGHT.has(s)) p.contract.corridor = 'R';
      }
      const ord = centrais.slice().sort(
        (a, b) => a.contract.homeZone.defend.y - b.contract.homeZone.defend.y);
      for (let i = 0; i < ord.length; i++) {
        ord[i].contract.corridor = ord.length === 1 ? 'C'
          : i === 0 ? 'CL'
          : i === ord.length - 1 ? 'CR'
          : 'C';
      }
      /* O corredor de ataque só difere quando o jogador de fato muda de faixa
         entre bloco e posse; senão herda, para não inventar amplitude. */
      for (const p of row) {
        const d = p.contract.homeZone.defend.y, a = p.contract.homeZone.attack.y;
        p.contract.corridorAttack = Math.abs(a - d) < 4 ? p.contract.corridor
          : CORRIDORS[clamp(Math.floor(a / FW * 5), 0, 4)];
      }
    }

    /* ── cobertura ─────────────────────────────────────────────────────────
       Quem está ao lado, na mesma linha, compensa a saída. Nenhum lugar do
       motor diz isso hoje. */
    for (const line of Object.keys(byLine)) {
      const row = byLine[line].slice().sort(
        (a, b) => a.contract.homeZone.defend.y - b.contract.homeZone.defend.y);
      for (let i = 0; i < row.length; i++) {
        const c = row[i].contract;
        if (i > 0) { c.coveredBy.push(row[i - 1].contract.id); c.coverFor.push(row[i - 1].contract.id); }
        if (i < row.length - 1) { c.coveredBy.push(row[i + 1].contract.id); c.coverFor.push(row[i + 1].contract.id); }
      }
    }

    /* Linha de um jogador só — centroavante isolado do 4-5-1, volante único —
       ficava sem compensador nenhum. Medido: 12 de 374 jogadores nas 17
       formações. O compensador vem da linha adjacente, pelo y mais próximo. */
    for (const p of players) {
      const c = p.contract;
      if (!c || c.line === 'GK' || c.coverFor.length) continue;
      let best = null, bestD = Infinity;
      for (const ln of ADJACENT[c.line] || []) {
        for (const q of byLine[ln] || []) {
          if (q === p || !q.contract) continue;
          const d = Math.abs(q.contract.homeZone.defend.y - c.homeZone.defend.y);
          if (d < bestD) { bestD = d; best = q; }
        }
      }
      if (best) { c.coverFor.push(best.contract.id); c.coveredBy.push(best.contract.id); }
    }
  }

  const oldBuildTeam = P._buildTeam;
  P._buildTeam = function (t, side) {
    const tm = oldBuildTeam.apply(this, arguments);
    try {
      const audit = { slotsUnknown: [], built: 0 };
      for (const p of (tm && tm.players) || []) {
        const c = buildContract(p, side, audit);
        /* enumerable:false — invisível para Object.keys, spread e JSON.
           É o que garante que nenhum snapshot capture o contrato por acidente. */
        Object.defineProperty(p, 'contract', {
          value: c, enumerable: false, writable: true, configurable: true
        });
        audit.built++;
      }
      assignStructure((tm && tm.players) || []);
      Object.defineProperty(tm, '__contractAudit', {
        value: audit, enumerable: false, writable: true, configurable: true
      });
    } catch (_) {
      /* O contrato é inerte: se ele falhar, a partida NÃO pode falhar junto.
         No passo 3, quando alguém passar a ler, este catch tem de sair. */
    }
    return tm;
  };

  root.CDS_R18_CONTRACT = { version: VERSION, LINE_OF, ZONE, CORRIDORS, inert: true };
})(typeof window !== 'undefined' ? window : globalThis);
