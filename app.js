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

// 计算某怪的金币期望 + 药水期望（瓶数 + 回血/回蓝量，按该怪自己的掉落档）
function rollDropExpect(monName, monLevel) {
  const table = getDropTable(monName, monLevel);
  let gold = 0, hpPot = 0, mpPot = 0; // 瓶数
  let hpHeal = 0, mpHeal = 0;         // 回血/回蓝总量（瓶数×单瓶恢复量）
  const items = [];
  for (const d of table) {
    const p = 1 / d.chance;
    if (d.item === "金币") { gold += p * (d.count || 100); continue; }
    const it = ITEMS[d.item];
    if (it && it.type === "potion") {
      if (it.healHp) { hpPot += p; hpHeal += p * it.healHp; }
      else if (it.healMp) { mpPot += p; mpHeal += p * it.healMp; }
    }
    items.push({ name: d.item, chance: d.chance, info: it });
  }
  return { gold, hpPot, mpPot, hpHeal, mpHeal, items };
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
  let wHpHealPerKill = 0, wMpHealPerKill = 0; // 逐怪按各自掉落档的回血/回蓝量
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
    wHpHealPerKill += r.hpHeal * w; // 该怪按自己掉落档的回血量
    wMpHealPerKill += r.mpHeal * w;
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

  // 蓝药：用 wMpHealPerKill（每只怪按各自掉落档的回蓝量，精确计算）
  const mpCostPerMin = mpPerTurn * turnsPerMin;
  const mpPotPerMin = wMpPotPerKill * killsPerMin; // 瓶数（展示用）
  const freeMpPerMin = wMpHealPerKill * killsPerMin; // 白嫖回蓝总量
  const mpCost = Math.max(0, mpCostPerMin - freeMpPerMin) * (50 / 30);

  // 红药：用 wHpHealPerKill（每只怪按各自掉落档的回血量，精确计算）
  const hpTakenPerMin = wDmgToPlayer * turnsPerMin;
  const hpPotPerMin = wHpPotPerKill * killsPerMin; // 瓶数（展示用）
  const freeHpPerMin = wHpHealPerKill * killsPerMin; // 白嫖回血总量
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

/* ===================================================================
 * 数据库 Tab
 * =================================================================== */

// 反向索引（页面加载时构建一次）
let _reverseIndex = null; // { itemToSources, monsterToMaps }

function buildReverseIndex() {
  if (_reverseIndex) return _reverseIndex;
  // 1. monsterToMaps: 怪物名 → [{地图名, levelReq, continent, count}]
  const monsterToMaps = {};
  for (const map of MAPS) {
    const continent = map.continent || 1;
    for (const mc of map.monsters) {
      if (!monsterToMaps[mc.name]) monsterToMaps[mc.name] = [];
      monsterToMaps[mc.name].push({ name: map.name, levelReq: map.levelReq, continent, count: mc.count });
    }
  }
  // 2. itemToSources: 物品名 → [{怪物名, 怪物等级, 怪物类型, chance, count?, maps[]}]
  const itemToSources = {};
  function addItemSource(itemName, monName, chance, count) {
    if (!ITEMS[itemName]) return; // 悬挂引用忽略
    if (!itemToSources[itemName]) itemToSources[itemName] = [];
    const mon = MONSTERS[monName];
    const maps = monsterToMaps[monName] || [];
    itemToSources[itemName].push({
      monName, monLevel: mon ? mon.level : null, monType: mon ? mon.type : null,
      chance, count, maps, generic: false
    });
  }
  // 遍历专属 DROPS（二大陆是 forEach 动态挂载的，此时已执行完）
  for (const [monName, drops] of Object.entries(DROPS)) {
    if (!Array.isArray(drops)) continue;
    for (const d of drops) addItemSource(d.item, monName, d.chance, d.count);
  }
  // 遍历通用 GENERIC_DROPS（标注档位）
  for (const [tier, table] of Object.entries(GENERIC_DROPS)) {
    const lvRange = tier === "low" ? "Lvl≤20" : (tier === "mid" ? "Lvl 21-40" : "Lvl>40");
    for (const d of table) {
      if (!ITEMS[d.item]) continue;
      if (!itemToSources[d.item]) itemToSources[d.item] = [];
      itemToSources[d.item].push({
        monName: `通用掉落(${lvRange})`, monLevel: null, monType: null,
        chance: d.chance, count: d.count, maps: [], generic: true, tier: lvRange
      });
    }
  }
  // 每个 item 的 sources 按 chance 升序（最易得的在前）
  for (const k in itemToSources) itemToSources[k].sort((a, b) => a.chance - b.chance);
  _reverseIndex = { itemToSources, monsterToMaps };
  return _reverseIndex;
}

// === Tab 切换 ===
function switchTab(name, btn) {
  document.querySelectorAll(".main-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.getElementById("view-" + name).classList.add("active");
  if (name === "db") {
    buildReverseIndex();
    if (!document.getElementById("item-filter-type").options.length) initDbFilters();
    renderItems();
  }
}

function switchDbSection(section, btn) {
  document.querySelectorAll(".db-nav-item").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".db-section").forEach(s => s.style.display = "none");
  const el = document.getElementById("db-section-" + section);
  el.style.display = "block";
  if (section === "items") renderItems();
  else if (section === "monsters") renderMonsters();
  else if (section === "skills") renderSkills();
}

// === 初始化下拉选项 ===
function initDbFilters() {
  const types = ["", "weapon", "armor", "helmet", "necklace", "bracelet", "ring", "boots", "belt", "jade", "potion", "material", "skillbook"];
  const typeNames = { "": "全部", weapon: "武器", armor: "衣服", helmet: "头盔", necklace: "项链", bracelet: "手镯", ring: "戒指", boots: "鞋子", belt: "腰带", jade: "宝玉", potion: "药水", material: "材料", skillbook: "技能书" };
  const sel = document.getElementById("item-filter-type");
  types.forEach(t => {
    const o = document.createElement("option");
    o.value = t; o.textContent = typeNames[t];
    sel.appendChild(o);
  });
}

const TYPE_NAMES = { weapon: "武器", armor: "衣服", helmet: "头盔", necklace: "项链", bracelet: "手镯", ring: "戒指", boots: "鞋子", belt: "腰带", jade: "宝玉", potion: "药水", material: "材料", skillbook: "技能书" };
const JOB_NAMES = { mage: "法师", warrior: "战士", taoist: "道士", all: "通用" };
const JOB_COLORS = { mage: "mage", warrior: "warrior", taoist: "taoist", all: "all" };

function fmtRange(arr) { return arr && arr.length ? arr[0] + "-" + arr[1] : ""; }

// === 装备物品渲染 ===
let dbExpandedItem = null;
function renderItems() {
  const job = document.getElementById("item-filter-job").value;
  const type = document.getElementById("item-filter-type").value;
  const lvmin = parseInt(document.getElementById("item-filter-lvmin").value) || 0;
  const lvmax = parseInt(document.getElementById("item-filter-lvmax").value) || 999;
  const special = document.getElementById("item-filter-special").value;
  const kw = document.getElementById("item-filter-kw").value.trim().toLowerCase();

  let list = Object.entries(ITEMS).filter(([name, it]) => {
    if (job && it.job !== job) return false;
    if (type && it.type !== type) return false;
    const lv = it.level || 0;
    if (lv < lvmin || lv > lvmax) return false;
    if (special === "yes" && !it.special) return false;
    if (kw) {
      const hay = (name + " " + (it.special || "") + " " + fmtRange(it.atk) + fmtRange(it.mc) + fmtRange(it.sc)).toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
  list.sort((a, b) => (a[1].level || 0) - (b[1].level || 0));
  document.getElementById("item-count").textContent = `${list.length} 件`;

  const body = document.getElementById("items-body");
  body.innerHTML = list.map(([name, it], i) => renderItemRow(name, it, i)).join("");
}

function renderItemRow(name, it, idx) {
  const isExpanded = dbExpandedItem === name;
  const jobTag = it.job ? `<span class="job-tag ${JOB_COLORS[it.job] || ""}">${JOB_NAMES[it.job] || it.job}</span>` : "";
  const specialTag = it.special ? `<span class="special-tag">${it.special}</span>` : "";
  const row = `<tr onclick="toggleItem('${name}')">
    <td><b>${name}</b></td>
    <td><span class="type-tag ${it.type}">${TYPE_NAMES[it.type] || it.type}</span></td>
    <td>${jobTag}</td>
    <td class="num">${it.level || "-"}</td>
    <td class="num">${fmtRange(it.atk)}</td>
    <td class="num">${fmtRange(it.mc)}</td>
    <td class="num">${fmtRange(it.sc)}</td>
    <td class="num">${fmtRange(it.def)}</td>
    <td class="num">${fmtRange(it.magDef)}</td>
    <td>${specialTag}</td>
  </tr>`;
  const detail = isExpanded ? `<tr class="db-detail-row"><td colspan="10">${renderItemDetail(name, it)}</td></tr>` : "";
  return row + detail;
}

function renderItemDetail(name, it) {
  const idx = buildReverseIndex();
  const sources = (idx && idx.itemToSources && idx.itemToSources[name]) || [];
  // 属性区
  const stats = [];
  if (it.atk) stats.push(["攻击", fmtRange(it.atk)]);
  if (it.mc) stats.push(["魔法(MC)", fmtRange(it.mc)]);
  if (it.sc) stats.push(["道术(SC)", fmtRange(it.sc)]);
  if (it.def) stats.push(["防御", fmtRange(it.def)]);
  if (it.magDef) stats.push(["魔防", fmtRange(it.magDef)]);
  if (it.healHp) stats.push(["回血", it.healHp + " HP"]);
  if (it.healMp) stats.push(["回蓝", it.healMp + " MP"]);
  if (it.price) stats.push(["价格", it.price + " 金"]);
  if (it.skill) stats.push(["技能", it.skill]);
  if (it.special) stats.push(["特效", it.special]);
  const statsHtml = stats.map(([l, v]) => `<div class="stat-item"><span class="lbl">${l}</span> <span class="val">${v}</span></div>`).join("");

  // 掉落来源
  let dropsHtml = '<div style="color:#666">无掉落数据（可能仅商店购买或任务获得）</div>';
  if (sources.length) {
    const monTypeText = { normal: "普通", elite: "精英", boss: "Boss" };
    dropsHtml = sources.map(s => {
      if (s.generic) {
        return `<div class="drop-source generic"><span class="mon">📜 ${s.monName}</span> <span class="prob">概率 1/${s.chance}</span>${s.count ? ` ×${s.count}` : ""}</div>`;
      }
      const tt = s.monType ? monTypeText[s.monType] || s.monType : "";
      const monTypeTag = tt ? `<span class="mtype-${s.monType}">[${tt}]</span> ` : "";
      const mapsTag = s.maps.length
        ? `<div class="maps">📍 ${s.maps.map(m => `${m.name}(L${m.levelReq}${m.continent===2?",二大陆":""})`).join("， ")}</div>`
        : '<div class="maps" style="color:#666">📍 无地图记录</div>';
      const lvTag = s.monLevel ? ` <span style="color:#888">Lv${s.monLevel}</span>` : "";
      const cntTag = s.count ? ` ×${s.count}` : "";
      return `<div class="drop-source"><span class="mon">${monTypeTag}${s.monName}</span>${lvTag} <span class="prob">概率 1/${s.chance}</span>${cntTag}${mapsTag}</div>`;
    }).join("");
  }
  return `<div class="db-detail-content">
    <div class="db-detail-section"><h4>📋 属性</h4><div class="stat-grid">${statsHtml}</div></div>
    <div class="db-detail-section"><h4>📍 掉落来源（${sources.length}条，按概率从高到低）</h4>${dropsHtml}</div>
  </div>`;
}

function toggleItem(name) { dbExpandedItem = dbExpandedItem === name ? null : name; renderItems(); }

// === 怪物图鉴 ===
let dbExpandedMon = null;
function renderMonsters() {
  const type = document.getElementById("mon-filter-type").value;
  const cont = document.getElementById("mon-filter-cont").value;
  const lvmin = parseInt(document.getElementById("mon-filter-lvmin").value) || 0;
  const lvmax = parseInt(document.getElementById("mon-filter-lvmax").value) || 999;
  const kw = document.getElementById("mon-filter-kw").value.trim().toLowerCase();
  const { monsterToMaps } = buildReverseIndex();

  let list = Object.entries(MONSTERS).filter(([name, m]) => {
    if (type && m.type !== type) return false;
    if (cont) {
      const maps = monsterToMaps[name] || [];
      if (!maps.some(m => m.continent == cont)) return false;
    }
    if (m.level < lvmin || m.level > lvmax) return false;
    if (kw && !name.toLowerCase().includes(kw)) return false;
    return true;
  });
  list.sort((a, b) => a[1].level - b[1].level);
  document.getElementById("mon-count").textContent = `${list.length} 只`;

  const body = document.getElementById("monsters-body");
  body.innerHTML = list.map(([name, m]) => renderMonRow(name, m)).join("");
}

function renderMonRow(name, m) {
  const { monsterToMaps } = buildReverseIndex();
  const maps = monsterToMaps[name] || [];
  const isExpanded = dbExpandedMon === name;
  const typeCls = `mtype-${m.type}`;
  const typeText = { normal: "普通", elite: "精英", boss: "Boss" }[m.type] || m.type;
  const mapsShort = maps.slice(0, 2).map(x => x.name).join(",") + (maps.length > 2 ? ` 等${maps.length}` : "") || "无";
  const skills = m.skills && m.skills.length ? `${m.skills.length}个` : "-";
  const row = `<tr onclick="toggleMon('${name}')">
    <td><b>${name}</b></td>
    <td class="num">${m.level}</td>
    <td class="${typeCls}">${typeText}</td>
    <td class="num">${m.hp}</td>
    <td class="num">${m.minAtk}-${m.maxAtk}</td>
    <td class="num">${m.minDef || 0}</td>
    <td class="num">${m.minMagDef || 0}</td>
    <td class="num">${m.exp}</td>
    <td class="num">${skills}</td>
    <td style="font-size:11px;color:#90caf9">${mapsShort}</td>
  </tr>`;
  const detail = isExpanded ? `<tr class="db-detail-row"><td colspan="10">${renderMonDetail(name, m, maps)}</td></tr>` : "";
  return row + detail;
}

function renderMonDetail(name, m, maps) {
  // 技能
  let skillsHtml = '<div style="color:#666">无技能</div>';
  if (m.skills && m.skills.length) {
    skillsHtml = m.skills.map(s => `<div class="stat-item"><span class="lbl">${s.name} [${s.type}]</span> <span class="val">概率${(s.chance*100).toFixed(0)}%${s.power?` 威力×${s.power}`:""}</span></div>`).join("");
  }
  // 掉落
  let drops = DROPS[name];
  if (!drops) {
    const tier = m.level <= 20 ? "low" : (m.level <= 40 ? "mid" : "high");
    drops = GENERIC_DROPS[tier];
  }
  const dropsHtml = (Array.isArray(drops) ? drops : []).filter(d => d.item !== "金币").slice(0, 20).map(d => {
    const it = ITEMS[d.item];
    const typeTag = it ? `<span class="type-tag ${it.type}">${TYPE_NAMES[it.type]||it.type}</span>` : "";
    return `<div class="stat-item">${typeTag} <span class="val">${d.item}</span> <span class="lbl">1/${d.chance}</span></div>`;
  }).join("") || '<div style="color:#666">无掉落</div>';
  // 地图
  const mapsHtml = maps.length ? maps.map(x => `<div class="stat-item"><span class="val">${x.name}</span> <span class="lbl">L${x.levelReq}${x.continent===2?" 二大陆":""} ×${x.count}</span></div>`).join("") : '<div style="color:#666">无地图记录</div>';
  return `<div class="db-detail-content">
    <div class="db-detail-section"><h4>⚔️ 怪物技能</h4><div class="stat-grid">${skillsHtml}</div></div>
    <div class="db-detail-section"><h4>📦 掉落物品（前20）</h4><div class="stat-grid">${dropsHtml}</div></div>
    <div class="db-detail-section"><h4>📍 所在地图</h4><div class="stat-grid">${mapsHtml}</div></div>
  </div>`;
}

function toggleMon(name) { dbExpandedMon = dbExpandedMon === name ? null : name; renderMonsters(); }

// === 技能库 ===
let dbExpandedSkill = null;
function renderSkills() {
  const job = document.getElementById("skill-filter-job").value;
  const type = document.getElementById("skill-filter-type").value;
  const kw = document.getElementById("skill-filter-kw").value.trim().toLowerCase();
  let list = Object.entries(SKILLS).filter(([name, s]) => {
    if (job && s.job !== job) return false;
    if (type && s.type !== type) return false;
    if (kw && !name.toLowerCase().includes(kw) && !(s.desc || "").toLowerCase().includes(kw)) return false;
    return true;
  });
  list.sort((a, b) => a[1].levelReq - b[1].levelReq);
  document.getElementById("skill-count").textContent = `${list.length} 个`;
  const body = document.getElementById("skills-body");
  body.innerHTML = list.map(([name, s]) => {
    const jobTag = `<span class="job-tag ${JOB_COLORS[s.job]||""}">${JOB_NAMES[s.job]||s.job}</span>`;
    const isExpanded = dbExpandedSkill === name;
    const row = `<tr onclick="dbExpandedSkill=dbExpandedSkill==='${name}'?null:'${name}';renderSkills()">
      <td><b>${name}</b></td><td>${jobTag}</td><td>${{attack:"攻击",passive:"被动",buff:"增益",summon:"召唤",utility:"辅助",heal:"治疗"}[s.type]||s.type}</td>
      <td class="num">${s.levelReq}</td><td class="num">+${(s.damageBonus*100).toFixed(0)}%</td>
      <td class="num">${s.delay?`${s.delay}回合`:"无"}</td><td>${s.aoe?"AOE":""}</td>
      <td style="font-size:11px;color:#b0bec5;max-width:240px">${(s.desc||"").slice(0,40)}</td>
    </tr>`;
    const detail = isExpanded ? `<tr class="db-detail-row"><td colspan="8"><div class="db-detail-content">
      <div class="stat-grid">
        <div class="stat-item"><span class="lbl">威力power</span> <span class="val">${s.power}</span></div>
        <div class="stat-item"><span class="lbl">附加defPower</span> <span class="val">${s.defPower}</span></div>
        <div class="stat-item"><span class="lbl">加成</span> <span class="val">+${(s.damageBonus*100).toFixed(0)}%</span></div>
        <div class="stat-item"><span class="lbl">冷却</span> <span class="val">${s.delay?`${s.delay}回合`:"无冷却"}</span></div>
      </div>
      <div style="color:#b0bec5;font-size:12px;margin-top:6px">${s.desc||""}</div>
    </div></td></tr>` : "";
    return row + detail;
  }).join("");
}

