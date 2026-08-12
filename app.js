"use strict";
/* ===================================================================
 * 挂机传奇 Farm 计算器 —— 核心逻辑
 * 算法严格复刻 game.js（getStats / getDamageBreakdown / getMapIncome）
 * 新增：蓝药成本、安全度、掉落明细
 * =================================================================== */

const WAVE_SIZE = 10; // 每波怪物数量（game.js 固定 10）

// ---------- 属性汇总（复刻 game.js getStats）----------
function getStats(player) {
  const base = getJobBaseStats(player.job, player.level);
  const s = {
    minAtk: base.minAtk, maxAtk: base.maxAtk,
    minDef: base.minDef, maxDef: base.maxDef,
    minMagDef: base.minMagDef, maxMagDef: base.maxMagDef,
    minMc: base.minMagAtk, maxMc: base.maxMagAtk,
    minSc: base.minMagAtk, maxSc: base.maxMagAtk,
    maxHp: base.hp, maxMp: base.mp,
  };
  for (const slotData of Object.values(player.equipment || {})) {
    if (!slotData) continue;
    const name = typeof slotData === "string" ? slotData : slotData.name;
    const it = ITEMS[name];
    if (!it) continue;
    if (it.atk) { s.minAtk += it.atk[0]; s.maxAtk += it.atk[1]; }
    if (it.mc)  { s.minMc += it.mc[0];  s.maxMc += it.mc[1]; }
    if (it.sc)  { s.minSc += it.sc[0];  s.maxSc += it.sc[1]; }
    if (it.def) { s.minDef += it.def[0]; s.maxDef += it.def[1]; }
    if (it.magDef) { s.minMagDef += it.magDef[0]; s.maxMagDef += it.magDef[1]; }
    if (it.hp) s.maxHp += it.hp;
    const bonus = typeof slotData === "object" ? slotData.bonus : null;
    if (bonus) {
      if (bonus.atk) { s.minAtk += bonus.atk; s.maxAtk += bonus.atk; }
      if (bonus.mc)  { s.minMc += bonus.mc;  s.maxMc += bonus.mc; }
      if (bonus.sc)  { s.minSc += bonus.sc;  s.maxSc += bonus.sc; }
      if (bonus.def) { s.minDef += bonus.def; s.maxDef += bonus.def; }
      if (bonus.magDef) { s.minMagDef += bonus.magDef; s.maxMagDef += bonus.magDef; }
      if (bonus.hp) s.maxHp += bonus.hp;
    }
  }
  // 武器幸运/诅咒（±7，物攻/魔法/道术全生效）
  const wpn = player.equipment && player.equipment.weapon;
  const luck = wpn && typeof wpn === "object" ? (wpn.luck || 0) : 0;
  if (luck !== 0) {
    const apply = (minK, maxK) => {
      if (s[maxK] <= s[minK]) return;
      const span = s[maxK] - s[minK];
      if (luck > 0) s[minK] += Math.floor(span * Math.min(luck, 7) / 7);
      else s[maxK] -= Math.floor(span * Math.min(-luck, 7) / 7);
      if (s[minK] > s[maxK]) s[minK] = s[maxK];
    };
    apply("minAtk", "maxAtk"); apply("minMc", "maxMc"); apply("minSc", "maxSc");
  }
  return s;
}

// ---------- 每回合伤害分项（用于按每只怪单独扣防）----------
// 返回 { physBase, magicBase, summonPerTurn, poisonPerTurn, aoeMagicBase }
// - physBase: 物攻段基础值（扣怪物物防）
// - magicBase: 魔法段基础值（扣怪物魔防）
// - summonPerTurn / poisonPerTurn: 召唤/毒伤害（不扣防，固定值）
// - aoeMagicBase: AOE溅射基础（对其他怪，扣各自魔防）
function getDamageParts(player, stats, waveSize) {
  const baseDmg = Math.max(1, (stats.minAtk + stats.maxAtk) / 2);
  let summonBonusSum = 0, poisonBonus = 0, avgTriggered = 0;
  for (const sk of player.equippedSkills || []) {
    const sd = SKILLS[sk]; if (!sd) continue;
    if (sd.type === "summon") { summonBonusSum += sd.damageBonus; continue; }
    if (sd.type === "attack" && (sk === "施毒术" || sk === "瘟疫" || sk === "毒云")) { poisonBonus += sd.damageBonus; continue; }
    if (sd.delay > 0) avgTriggered += sd.damageBonus / sd.delay;
  }

  let physBase = 0, magicBase = 0;
  if (player.job === "warrior") {
    let passive = 0;
    for (const sk of player.equippedSkills || []) {
      const sd = SKILLS[sk];
      if (sd && (!sd.delay || sd.delay === 0) && sd.type !== "buff") passive += sd.damageBonus;
    }
    physBase = baseDmg * (1 + passive) + baseDmg * avgTriggered; // 战士物攻+触发都走物防
    magicBase = 0;
  } else {
    // 法师/道士
    let residentMagic = 0;
    for (const sk of player.equippedSkills || []) {
      const sd = SKILLS[sk];
      if (sd && sd.type === "attack" && (!sd.delay || sd.delay === 0) && !sd.aoe
          && sk !== "施毒术" && sk !== "瘟疫" && sk !== "毒云") residentMagic += sd.damageBonus;
    }
    let normalPassive = 0;
    for (const sk of player.equippedSkills || []) {
      const sd = SKILLS[sk];
      if (sd && (!sd.delay || sd.delay === 0) && sd.type !== "buff" && sd.type !== "attack" && sd.type !== "summon" && sd.type !== "passive")
        normalPassive += sd.damageBonus;
    }
    physBase = baseDmg * (1 + normalPassive);
    const mcBase = player.job === "mage" ? stats.maxMc : stats.maxSc;
    let passiveMagic = 0;
    for (const sk of player.equippedSkills || []) {
      const sd = SKILLS[sk];
      if (sd && sd.type === "passive" && (!sd.delay || sd.delay === 0)) passiveMagic += sd.damageBonus;
    }
    const magicBonus = avgTriggered + residentMagic + passiveMagic;
    magicBase = mcBase * (1 + magicBonus);
  }

  // AOE 溅射基础值（对其他怪，扣各自魔防）
  let aoeMagicBase = 0;
  if (waveSize > 1) {
    let spt = 0, hasTao = false;
    for (const sk of player.equippedSkills || []) {
      const sd = SKILLS[sk];
      if (!sd || sd.type !== "attack" || !sd.aoe || !sd.damageBonus) continue;
      const freq = sd.delay > 0 ? 1 / sd.delay : 1;
      if (player.job === "warrior") {
        spt += freq * baseDmg * sd.damageBonus * 0.5; // 简化：战士AOE走物防
      } else {
        const sb = player.job === "mage" ? stats.maxMc : stats.maxSc;
        spt += freq * sb * sd.damageBonus * (player.job === "mage" ? 1.0 : 0.5);
        if (player.job === "taoist") hasTao = true;
      }
    }
    if (hasTao) spt += stats.maxSc * 0.5;
    aoeMagicBase = spt * waveSize; // 溅射总量基础（主目标+其他怪各扣各自魔防）
  }

  // 召唤宝宝（固定伤害，不扣防——游戏里宝宝攻击独立结算）
  let summonPerTurn = 0;
  if (summonBonusSum > 0) {
    const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
    summonPerTurn = Math.max(1, Math.floor(scBase * summonBonusSum * 2.0));
    if (waveSize > 1) summonPerTurn += Math.floor(scBase * summonBonusSum * 2.0) * (waveSize - 1);
  }
  // 毒（固定伤害）
  let poisonPerTurn = 0;
  if (poisonBonus > 0) {
    const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
    poisonPerTurn = Math.max(1, Math.floor(scBase * poisonBonus * 0.6));
  }
  // 特殊装备
  let specialPerTurn = 0;
  const rings = getSpecialRings(player);
  if (rings.includes("火焰")) specialPerTurn += Math.max(1, Math.floor(stats.maxAtk * 0.3));
  if (rings.includes("连击")) specialPerTurn += physBase * 0.25;

  return { physBase, magicBase, summonPerTurn, poisonPerTurn, specialPerTurn, aoeMagicBase };
}

// 对单只怪计算每回合实际伤害（扣该怪自身物防/魔防）
function dmgToMonster(parts, mon) {
  const phys = Math.max(1, parts.physBase - (mon.minDef || 0) * 0.6);
  const magic = Math.max(1, parts.magicBase - (mon.minMagDef || 0) * 0.6);
  // AOE溅射：对该怪扣它自己的魔防
  const aoe = parts.aoeMagicBase > 0 ? Math.max(1, parts.aoeMagicBase - (mon.minMagDef || 0) * 0.6) : 0;
  return Math.max(1, Math.floor(phys + magic + aoe + parts.summonPerTurn + parts.poisonPerTurn + parts.specialPerTurn));
}

// 兼容旧接口：getDPS 返回打0防怪的总值（用于玩家卡片展示）
function getDPS(player, stats, waveSize) {
  const parts = getDamageParts(player, stats, waveSize);
  return Math.max(1, Math.floor(parts.physBase + parts.magicBase + parts.aoeMagicBase + parts.summonPerTurn + parts.poisonPerTurn + parts.specialPerTurn));
}

function getSpecialRings(player) {
  const out = [];
  for (const slot of Object.values(player.equipment || {})) {
    if (!slot) continue;
    const name = typeof slot === "string" ? slot : slot.name;
    const it = ITEMS[name];
    if (it && it.special) out.push(it.special);
  }
  return out;
}

// 伤害公式（复刻 calcDamage）
function calcDamage(minAtk, maxAtk, minDef, maxDef) {
  const atk = minAtk + Math.random() * (maxAtk - minAtk);
  const def = minDef + Math.random() * (maxDef - minDef);
  return Math.max(1, Math.floor(atk - def * 0.6));
}
// 期望伤害（平均值，用于稳定估算）
function avgDamage(minAtk, maxAtk, minDef, maxDef) {
  const a = (minAtk + maxAtk) / 2;
  const d = ((minDef || 0) + (maxDef || 0)) / 2;
  return Math.max(1, a - d * 0.6);
}

// ---------- 蓝药消耗：每回合耗 MP ----------
function getMpCostPerTurn(player) {
  // 每个无冷却单体攻击技能耗 2MP/回合（游戏第 487-502 行）
  let singleAtkSkills = 0;
  for (const sk of player.equippedSkills || []) {
    const sd = SKILLS[sk];
    if (sd && sd.type === "attack" && (!sd.delay || sd.delay === 0) && !sd.aoe
        && sk !== "施毒术" && sk !== "瘟疫" && sk !== "毒云") singleAtkSkills++;
  }
  // 触发型技能（delay>0）触发时耗 delay×2 MP，按平均每回合 delay分之一 次触发
  let triggeredMpPerTurn = 0;
  for (const sk of player.equippedSkills || []) {
    const sd = SKILLS[sk];
    if (sd && sd.delay > 0 && sd.type !== "heal") triggeredMpPerTurn += (sd.delay * 2) / sd.delay;
  }
  return { perTurn: singleAtkSkills * 2 + triggeredMpPerTurn, singleAtkSkills };
}

// ---------- 掉落表选择 ----------
function getDropTable(monName, monLevel) {
  let t = DROPS[monName];
  if (!t) {
    if (monLevel <= 20) t = GENERIC_DROPS.low;
    else if (monLevel <= 40) t = GENERIC_DROPS.mid;
    else t = GENERIC_DROPS.high;
  }
  return t;
}

// 计算某怪的金币期望 + 药水期望（瓶数）
function rollDropExpect(monName, monLevel) {
  const table = getDropTable(monName, monLevel);
  let gold = 0, hpPot = 0, mpPot = 0;
  const items = [];
  for (const d of table) {
    const p = 1 / d.chance;
    if (d.item === "金币") { gold += p * (d.count || 100); continue; }
    const it = ITEMS[d.item];
    if (it && it.type === "potion") {
      if (it.healHp) hpPot += p;
      else if (it.healMp) mpPot += p;
    }
    items.push({ name: d.item, chance: d.chance, info: it });
  }
  return { gold, hpPot, mpPot, items };
}

// ---------- 主计算：单张地图收益（对每只怪单独算，最后加权）----------
function calcMap(map, player, stats, _dps, mpPerTurn, parts) {
  const totalWeight = map.monsters.reduce((s, m) => s + m.count, 0);
  const buffDefBonus = getBuffDefBonus(player);
  const allDrops = {};
  let dangerCount = 0, dangerMonsters = [];

  // 逐怪计算：每只怪的击杀回合、经验、金币、承伤 → 再按 count 加权
  // 关键：伤害用 dmgToMonster(parts, mon) 扣该怪自己的物防/魔防
  let wExpPerKill = 0, wGoldPerKill = 0, wTurnsPerKill = 0;
  let wDmgToPlayer = 0, wHpPotPerKill = 0, wMpPotPerKill = 0;
  let wSurvive = 0;

  for (const entry of map.monsters) {
    const mon = MONSTERS[entry.name];
    if (!mon) continue;
    const w = entry.count / totalWeight;
    // 该怪每回合受到的真实伤害（扣该怪自身防/魔防）
    const dmgPerTurn = dmgToMonster(parts, mon);
    const turns = Math.max(1, Math.ceil(mon.hp / dmgPerTurn)); // 击杀回合（离散，与游戏一致）
    // 该怪每回合打玩家多少
    const dmgToPlayerRaw = avgDamage(mon.minAtk, mon.maxAtk, stats.minDef, stats.maxDef);
    const dmgToPlayer = Math.max(1, Math.floor(dmgToPlayerRaw * (1 - buffDefBonus)));
    const survive = Math.floor(stats.maxHp / dmgToPlayer);
    // 掉落
    const r = rollDropExpect(entry.name, mon.level);
    for (const it of r.items) {
      const k = it.name;
      if (!allDrops[k]) allDrops[k] = { name: k, chance: it.chance, info: it.info, sources: [] };
      if (allDrops[k].sources.length < 3 && !allDrops[k].sources.includes(entry.name))
        allDrops[k].sources.push(entry.name);
    }
    // 危险判定：以"扛不住"为准（survive<5），等级差仅作参考
    // 只看等级会导致L25僵尸这种"等级略高但实际扛得住"的怪被误判
    const tooStrong = survive < 5;
    if (tooStrong) {
      dangerCount += entry.count;
      dangerMonsters.push({ name: entry.name, lv: mon.level, dmg: Math.round(dmgToPlayer), survive, count: entry.count });
    }
    // 加权累加（按只数权重）
    wExpPerKill += mon.exp * w;
    wGoldPerKill += r.gold * w;
    wTurnsPerKill += turns * w;
    wDmgToPlayer += dmgToPlayer * w;
    wHpPotPerKill += r.hpPot * w;
    wMpPotPerKill += r.mpPot * w;
    wSurvive += survive * w;
  }

  // 每分钟击杀：60秒 ÷ 加权平均击杀回合（每秒1回合）
  // 实战损耗系数 0.95：波次切换空转/save开销等（实测校准：尸王殿理论8.6杀/分，实测8.2杀/分）
  const COMBAT_EFFICIENCY = 0.95;
  const killsPerMin = Math.min(60, (60 / wTurnsPerKill) * COMBAT_EFFICIENCY);
  const turnsPerMin = killsPerMin * wTurnsPerKill; // 每分钟总回合数

  // 经验/金币
  const expPerMin = Math.round(wExpPerKill * killsPerMin);
  const goldPerMin = Math.round(wGoldPerKill * killsPerMin);

  // 蓝药
  const mpCostPerMin = mpPerTurn * turnsPerMin;
  const mpPotPerMin = wMpPotPerKill * killsPerMin;
  const isHighTier = map.monsters.some(e => { const m = MONSTERS[e.name]; return m && m.level > 40; });
  const isMidTier = map.monsters.some(e => { const m = MONSTERS[e.name]; return m && m.level > 20; });
  const mpPerPot = isHighTier ? 200 : 60;
  const freeMpPerMin = mpPotPerMin * mpPerPot;
  const mpCost = Math.max(0, mpCostPerMin - freeMpPerMin) * (50 / 30);

  // 红药：每回合挨 wDmgToPlayer HP
  const hpTakenPerMin = wDmgToPlayer * turnsPerMin;
  const hpPotPerMin = wHpPotPerKill * killsPerMin;
  const hpPerPot = isHighTier ? 200 : (isMidTier ? 60 : 30);
  const freeHpPerMin = hpPotPerMin * hpPerPot;
  const hpCost = Math.max(0, hpTakenPerMin - freeHpPerMin) * (50 / 30);

  const netGold = Math.round(goldPerMin - mpCost - hpCost);
  const safety = Math.max(0, Math.round(100 - (dangerCount / totalWeight) * 100));
  // 可行性：加权扛几击 ≥ 加权击杀回合×1.2，且安全度≥40
  const practical = wSurvive >= wTurnsPerKill * 1.2 && safety >= 40;

  const dropSummary = Object.values(allDrops)
    .filter(d => {
      if (!d.info) return false;
      const t = d.info.type;
      return t === "weapon" || t === "armor" || t === "helmet" || t === "necklace" ||
             t === "bracelet" || t === "ring" || t === "skillbook" || d.info.special || t === "jade";
    })
    .sort((a, b) => a.chance - b.chance)
    .slice(0, 6);

  return {
    map, expPerMin, goldPerMin, netGold, killsPerMin: Math.round(killsPerMin * 10) / 10,
    hitsToKill: Math.round(wTurnsPerKill * 10) / 10, safety, dangerMonsters,
    mpCostPerMin: Math.round(mpCostPerMin), freeMpPot: Math.round(mpPotPerMin * 10) / 10,
    hpTakenPerMin: Math.round(hpTakenPerMin), hpCost: Math.round(hpCost),
    allDrops: Object.values(allDrops).sort((a, b) => a.chance - b.chance), dropSummary,
    locked: player.level < map.levelReq,
    practical, wSurvive: Math.round(wSurvive * 10) / 10,
  };
}

function getBuffDefBonus(player) {
  // buff 类技能减伤（魔法盾0.3 / 分身0.4 / 阴阳盾0.45 等累加）
  let b = 0;
  for (const sk of player.equippedSkills || []) {
    const sd = SKILLS[sk];
    if (sd && sd.type === "buff") b += sd.damageBonus;
  }
  return Math.min(0.85, b); // 上限保护
}

// ===================== UI =====================
let currentResults = [];
let sortKey = "expPerMin";
let sortDesc = true;
let expandedRow = null;

const SAMPLE = `{
  "name": "法师kui", "job": "mage", "level": 17, "exp": 14155,
  "maxHp": 70, "hp": 22, "maxMp": 117, "mp": 67, "gold": 2744,
  "equipment": {
    "weapon": { "name": "半月", "bonus": { "mc": 1 } },
    "armor": { "name": "布衣", "bonus": { "def": 3 } },
    "helmet": null,
    "necklace": { "name": "金项链", "bonus": { "magDef": 3 } },
    "bracelet1": { "name": "钢手镯", "bonus": { "magDef": 1 } },
    "bracelet2": { "name": "铁手镯", "bonus": { "def": 3 } },
    "ring1": { "name": "六角戒指", "bonus": { "mc": 2 } },
    "ring2": { "name": "古铜戒指", "bonus": { "atk": 3 } },
    "boots": null, "belt": null, "jade": null
  },
  "learnedSkills": ["火球术"],
  "equippedSkills": ["火球术"]
}`;

function loadSample() {
  document.getElementById("json-input").value = SAMPLE;
  loadAndCalc();
}
function clearAll() {
  document.getElementById("json-input").value = "";
  document.getElementById("error-msg").textContent = "";
  document.getElementById("player-panel").style.display = "none";
  document.getElementById("result-panel").style.display = "none";
  currentResults = [];
}

function loadAndCalc() {
  const err = document.getElementById("error-msg");
  err.textContent = "";
  const txt = document.getElementById("json-input").value.trim();
  if (!txt) { err.textContent = "请粘贴 player JSON"; return; }
  let player;
  try { player = JSON.parse(txt); }
  catch (e) { err.textContent = "JSON 解析失败: " + e.message; return; }
  if (!player.job || !player.level) { err.textContent = "JSON 缺少 job/level 字段"; return; }
  if (!player.equippedSkills) player.equippedSkills = [];
  if (!player.equipment) player.equipment = {};

  const stats = getStats(player);
  const parts = getDamageParts(player, stats, WAVE_SIZE);
  const dps = getDPS(player, stats, WAVE_SIZE);
  const { perTurn: mpPerTurn, singleAtkSkills } = getMpCostPerTurn(player);

  renderPlayer(player, stats, dps, mpPerTurn, singleAtkSkills);

  // 计算所有地图（parts 用于对每只怪单独扣防）
  currentResults = MAPS.map(m => calcMap(m, player, stats, dps, mpPerTurn, parts));
  // 默认按经验降序
  sortKey = "expPerMin"; sortDesc = true;
  renderTable();
}

function renderPlayer(player, stats, dps, mpPerTurn, singleAtkSkills) {
  document.getElementById("player-panel").style.display = "block";
  const jobName = { mage: "法师", warrior: "战士", taoist: "道士" }[player.job] || player.job;
  const mainStat = player.job === "mage" ? `MC ${stats.minMc}-${stats.maxMc}`
    : player.job === "taoist" ? `SC ${stats.minSc}-${stats.maxSc}` : `攻 ${stats.minAtk}-${stats.maxAtk}`;
  const cards = [
    { label: "角色", value: `${player.name||""} Lv${player.level} ${jobName}` },
    { label: "HP / MP", value: `${stats.maxHp} / ${stats.maxMp}`, danger: stats.maxHp < 100 },
    { label: "攻击", value: `${stats.minAtk}-${stats.maxAtk}` },
    { label: "防御", value: `${stats.minDef}-${stats.maxDef}` },
    { label: "魔防", value: `${stats.minMagDef}-${stats.maxMagDef}` },
    { label: player.job === "mage" ? "魔法(MC)" : (player.job === "taoist" ? "道术(SC)" : "主属性"), value: mainStat },
    { label: "每回合输出", value: dps + " 伤害" },
    { label: "蓝耗/回合", value: mpPerTurn + " MP (" + singleAtkSkills + "单体技能)", danger: mpPerTurn > 6 },
  ];
  const html = cards.map(c =>
    `<div class="stat${c.danger ? " danger" : ""}"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`
  ).join("") +
  `<div class="stat" style="grid-column:1/-1;"><div class="label">已装备技能</div><div class="skill-tags">${
    (player.equippedSkills||[]).map(s => `<span class="skill-tag">${s}</span>`).join("") || "<span style='color:#888'>无</span>"
  }</div></div>`;
  document.getElementById("player-card").innerHTML = html;
}

const COLUMNS = [
  { key: "name",     label: "地图",        sort: r => r.map.name,            align: "left" },
  { key: "lv",       label: "要求",        sort: r => r.map.levelReq,        align: "center" },
  { key: "kills",    label: "击杀/分",     sort: r => r.killsPerMin,         align: "right" },
  { key: "expPerMin",label: "经验/分",     sort: r => r.expPerMin,           align: "right" },
  { key: "goldPerMin",label:"金币/分",     sort: r => r.goldPerMin,          align: "right" },
  { key: "netGold",  label: "净金币/分",   sort: r => r.netGold,             align: "right" },
  { key: "safety",   label: "安全度",      sort: r => r.safety,              align: "center" },
  { key: "drops",    label: "掉落概要",    sort: null,                       align: "left" },
];

function renderTable() {
  document.getElementById("result-panel").style.display = "block";
  // 表头
  const head = COLUMNS.map(c => {
    const arrow = sortKey === c.key ? (sortDesc ? "▼" : "▲") : "";
    const style = c.sort ? ` style="cursor:pointer" onclick="setSort('${c.key}')"` : "";
    return `<th${style} class="${c.align === 'right' ? 'num' : c.align === 'center' ? 'num' : ''}">${c.label} <span class="arrow">${arrow}</span></th>`;
  }).join("");
  document.getElementById("result-head").innerHTML = `<tr>${head}</tr>`;

  // 排序：锁定的图永远沉底，其余按当前列排
  const col = COLUMNS.find(c => c.key === sortKey);
  const sorted = [...currentResults];
  if (col && col.sort) {
    const dir = sortDesc ? -1 : 1;
    sorted.sort((a, b) => {
      // 锁定沉底
      if (a.locked !== b.locked) return a.locked ? 1 : -1;
      // 不实际（打不动）沉底
      if (a.practical !== b.practical) return a.practical ? -1 : 1;
      return dir * (col.sort(a) - col.sort(b));
    });
  }

  // 表体
  const body = sorted.map((r, i) => renderRow(r, i)).join("");
  document.getElementById("result-body").innerHTML = body;
}

function renderRow(r, idx) {
  // 区分两种状态：等级不足(locked) vs 打不动(impractical但能进)
  let rowCls = "";
  let statusTag = "";
  if (r.locked) {
    rowCls = " locked";
    statusTag = ' <span style="color:#ef5350;font-size:11px">🔒等级不足</span>';
  } else if (!r.practical) {
    rowCls = " impractical";
    statusTag = ' <span style="color:#ff9800;font-size:11px">⚠️打不动</span>';
  }
  const c2tag = r.map.continent === 2 ? ' <span class="c2">[二大陆]</span>' : "";
  const netCls = r.netGold >= 0 ? "pos" : "neg";
  const safeCls = r.safety >= 80 ? "safe-high" : (r.safety >= 50 ? "safe-mid" : "safe-low");
  const safeTxt = r.safety + "%" + (r.dangerMonsters.length ? ` <span style="color:#888;font-size:10px">(${r.dangerMonsters.length}种危险)</span>` : "");

  const dropHtml = r.dropSummary.length
    ? r.dropSummary.map(d => `<div>${d.name} <span style="color:#888">1/${d.chance}</span></div>`).join("")
      + (r.allDrops.length > 6 ? `<div class="more" onclick="toggleDetail(${idx})">展开全部 ${r.allDrops.length} 项 ▾</div>` : "")
    : '<span style="color:#666">无特殊掉落</span>';

  const row = `<tr class="${rowCls}" id="row-${idx}">
    <td class="map-name"><b>${r.map.name}</b>${c2tag}${statusTag}</td>
    <td class="num">${r.map.levelReq}</td>
    <td class="num">${r.killsPerMin}</td>
    <td class="num">${r.practical ? "<b>"+r.expPerMin.toLocaleString()+"</b>" : '<span style="color:#888" title="扛不到杀死怪就死，拿不到经验">'+r.expPerMin.toLocaleString()+'*</span>'}</td>
    <td class="num">${r.practical ? r.goldPerMin.toLocaleString() : '<span style="color:#888" title="打不死怪，无掉落">~0*</span>'}</td>
    <td class="num ${r.practical ? netCls : "neg"}">${r.practical ? (r.netGold >= 0 ? "+" : "") + r.netGold.toLocaleString() : "−" + (r.mpCostPerMin/30*50 + r.hpCost).toLocaleString() + "*"}</td>
    <td class="num ${safeCls}">${safeTxt}</td>
    <td class="drops-cell">${dropHtml}</td>
  </tr>`;

  const detailRow = expandedRow === idx
    ? `<tr class="detail-row"><td colspan="8">${renderDetail(r)}</td></tr>` : "";
  return row + detailRow;
}

function renderDetail(r) {
  const danger = r.dangerMonsters.length
    ? `<div style="margin-bottom:10px;color:#ef9a9a;">⚠️ 危险怪物: ${r.dangerMonsters.map(d => `${d.name}(L${d.lv},打${d.dmg}/击,扛${d.survive})×${d.count}`).join("， ")}</div>`
    : "";
  const mpInfo = `<div style="margin-bottom:10px;color:#90caf9;">💧 蓝耗 ${r.mpCostPerMin} MP/分，地图掉落蓝药 ${r.freeMpPot} 瓶/分</div>`;
  const hpInfo = `<div style="margin-bottom:10px;color:#ef9a9a;">❤️ 承受伤害 ${r.hpTakenPerMin} HP/分，红药成本 ${r.hpCost} 金/分</div>`;
  const drops = `<div class="detail-content">${r.allDrops.map(d => {
    const it = d.info || {};
    const typeTag = it.type ? `<span class="prob">[${it.type}${it.job ? "/" + it.job : ""}${it.level ? " L" + it.level : ""}]</span>` : "";
    return `<div class="drop-item"><span class="name">${d.name}</span> ${typeTag}<span class="prob"> 1/${d.chance}</span><br><span class="src">来源: ${d.sources.join("， ")}</span></div>`;
  }).join("")}</div>`;
  return danger + mpInfo + hpInfo + drops;
}

function setSort(key) {
  if (sortKey === key) sortDesc = !sortDesc;
  else { sortKey = key; sortDesc = true; }
  expandedRow = null;
  renderTable();
}

function toggleDetail(idx) {
  expandedRow = expandedRow === idx ? null : idx;
  renderTable();
}
