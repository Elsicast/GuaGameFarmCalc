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

// ---------- 每回合伤害分项（波次模型：分离「单点流」与「AOE流」）----------
// 单点流（扣该怪防，仅主目标承受）：物理段 + 魔法段 + 施毒术DOT(只主目标) + 特殊(火焰/连击)
// AOE流（每只存活怪都承受，不扣防）：AOE溅射 + 召唤群攻 + 瘟疫/毒云DOT
// 严格复刻 game.js：AOE溅射法/道不扣防、召唤/毒不扣防；战士溅射=主物伤×aoeBonus×0.5
function getDamageParts(player, stats) {
  const equipped = player.equippedSkills || [];
  const job = player.job;
  const baseDmg = Math.max(1, (stats.minAtk + stats.maxAtk) / 2); // 期望物攻（防御在 singleDmgToMon 内逐怪扣）
  const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;

  // === delay>0 触发型技能：平均每回合贡献（法/道魔法段含「召唤/治疗也放大魔法段」quirk）===
  let avgTriggered = 0, stealthDelay = 0;
  for (const sk of equipped) {
    const sd = SKILLS[sk]; if (!sd || !sd.delay) continue;
    avgTriggered += sd.damageBonus / sd.delay; // 平均每回合
    if (sk === "隐身术" || sk === "集体隐身术") stealthDelay = sd.delay;
  }

  // === AOE 技能加成总和（被动 delay=0 + 触发 delay>0）===
  let aoeBonus = 0, summonBonusSum = 0;
  for (const sk of equipped) {
    const sd = SKILLS[sk]; if (!sd) continue;
    if (sd.aoe && sd.damageBonus) aoeBonus += sd.damageBonus;
    if (sd.type === "summon") summonBonusSum += sd.damageBonus;
  }

  // --- 单点流基础值 ---
  let physSingleBase = 0, magicSingleBase = 0, warriorMult = 1, normalPassive = 0, magicBonus = 0;
  if (job === "warrior") {
    let passive = 0; // delay=0 非buff技能全部叠加到物攻
    for (const sk of equipped) {
      const sd = SKILLS[sk];
      if (sd && !sd.delay && sd.type !== "buff") passive += sd.damageBonus;
    }
    warriorMult = 1 + passive + avgTriggered;
    physSingleBase = baseDmg;
  } else {
    // 法/道：utility类被动进物攻段
    for (const sk of equipped) {
      const sd = SKILLS[sk];
      if (sd && !sd.delay && sd.type !== "buff" && sd.type !== "attack" && sd.type !== "summon" && sd.type !== "passive")
        normalPassive += sd.damageBonus;
    }
    physSingleBase = baseDmg * (1 + normalPassive);
    const mcBase = job === "mage" ? stats.maxMc : stats.maxSc;
    let residentMagic = 0; // delay=0 单体攻击技能(非aoe非毒)，各耗2MP
    for (const sk of equipped) {
      const sd = SKILLS[sk];
      if (sd && sd.type === "attack" && !sd.delay && !sd.aoe
          && sk !== "施毒术" && sk !== "瘟疫" && sk !== "毒云") residentMagic += sd.damageBonus;
    }
    let passiveMagic = 0; // delay=0 passive（精神力战法等）
    for (const sk of equipped) {
      const sd = SKILLS[sk];
      if (sd && sd.type === "passive" && !sd.delay) passiveMagic += sd.damageBonus;
    }
    magicBonus = avgTriggered + residentMagic + passiveMagic;
    magicSingleBase = mcBase * (1 + magicBonus);
  }

  // --- AOE流溅射（每只怪，不扣防；战士在 aoeDmgToMon 内基于单点物伤算）---
  let aoeSplashPerMon = 0;
  if (aoeBonus > 0) {
    if (job === "mage") aoeSplashPerMon = Math.max(1, Math.floor(stats.maxMc * aoeBonus));          // 法师全额
    else if (job === "taoist") aoeSplashPerMon = Math.max(1, Math.floor(stats.maxSc * (1 + aoeBonus) * 0.5)); // 道士SC×(1+aoeBonus)×0.5
    // 战士 aoeSplashPerMon 保持0，由 aoeDmgToMon 逐怪计算
  }
  // 召唤群攻（每只怪每回合承受所有宝宝各1份，不扣防）
  const summonPerMon = summonBonusSum > 0 ? Math.max(1, Math.floor(scBase * summonBonusSum * 2.0)) : 0;
  // 毒DOT（不扣防）：施毒术只主目标；瘟疫/毒云每只
  let poisonSingle = 0, poisonAoEPerMon = 0;
  if (equipped.includes("施毒术")) poisonSingle = Math.max(1, Math.floor(scBase * 0.20 * 0.6));     // SC×0.12
  if (equipped.includes("瘟疫")) poisonAoEPerMon += Math.max(1, Math.floor(scBase * 0.55 * 0.6));   // SC×0.33
  if (equipped.includes("毒云")) poisonAoEPerMon += Math.max(1, Math.floor(scBase * 0.40 * 0.6));   // SC×0.24

  // --- 特殊装备（主目标）---
  let specialSingle = 0;
  const rings = getSpecialRings(player);
  if (rings.includes("火焰")) specialSingle += Math.max(1, Math.floor(stats.maxAtk * 0.3));
  if (rings.includes("连击")) specialSingle += baseDmg * 0.25; // 25%概率追击一次物攻

  // --- 承伤分摊：召唤宝宝 / 隐身术 ---
  const hasMinion = summonBonusSum > 0 || rings.includes("记忆") || equipped.includes("诱惑之光");
  // 隐身覆盖率：触发后6回合隐身，delay周期触发 → min(1, 6/delay)；隐身需有宝宝承接仇恨
  const stealthUptime = (stealthDelay > 0 && hasMinion) ? Math.min(1, 6 / stealthDelay) : 0;

  return { job, physSingleBase, warriorMult, normalPassive, magicSingleBase, magicBonus,
           aoeBonus, aoeSplashPerMon, summonPerMon, poisonAoEPerMon, poisonSingle, specialSingle,
           hasMinion, stealthUptime };
}

// 单点流对单只怪的每回合伤害（扣该怪自身物防/魔防；毒/特殊不扣防）——仅主目标承受
function singleDmgToMon(parts, mon) {
  const physFinal = parts.job === "warrior" ? parts.physSingleBase * parts.warriorMult : parts.physSingleBase;
  const phys = Math.max(1, physFinal - (mon.minDef || 0) * 0.6);
  const magic = parts.magicSingleBase > 0 ? Math.max(1, parts.magicSingleBase - (mon.minMagDef || 0) * 0.6) : 0;
  return Math.max(1, Math.floor(phys + magic + parts.poisonSingle + parts.specialSingle));
}

// AOE流对单只怪的每回合伤害（每只存活怪都承受；法/道溅射不扣防，战士=该怪单点物伤×aoeBonus×0.5；召唤/毒不扣防）
function aoeDmgToMon(parts, mon) {
  let splash = parts.aoeSplashPerMon;
  if (parts.job === "warrior" && parts.aoeBonus > 0) {
    const physFinal = parts.physSingleBase * parts.warriorMult;
    const phys = Math.max(1, physFinal - (mon.minDef || 0) * 0.6);
    splash = Math.max(1, Math.floor(phys * parts.aoeBonus * 0.5));
  }
  return Math.floor(splash + parts.summonPerMon + parts.poisonAoEPerMon);
}

// 兼容展示：主目标打0防怪时每回合承受的总量（单点流 + AOE流份），用于玩家卡片
function getDPS(player, stats) {
  const parts = getDamageParts(player, stats);
  const dummy = { minDef: 0, minMagDef: 0 };
  return Math.max(1, Math.floor(singleDmgToMon(parts, dummy) + aoeDmgToMon(parts, dummy)));
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

// 缓存：所有通用掉落表里的物品名集合（用于区分"通用/独特"掉落）
let _genericItemSet = null;
function getGenericItemSet() {
  if (_genericItemSet) return _genericItemSet;
  _genericItemSet = new Set();
  for (const tier of ["low", "mid", "high"]) {
    const table = GENERIC_DROPS[tier] || [];
    for (const d of table) if (d.item !== "金币") _genericItemSet.add(d.item);
  }
  return _genericItemSet;
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

// 读取用户选择的波次大小（1/3/5/10，与游戏内设置一致；默认10）
// 影响波次同场怪物数 → AOE/召唤/毒打几只、几只怪同时打玩家
function getWaveSize() {
  const sel = document.getElementById("wave-size");
  return (sel && parseInt(sel.value)) || WAVE_SIZE;
}

// ---------- 主计算：单张地图收益（波次模型）----------
// 波次 N=10 只同场：单点流(DS)只削主目标1只，AOE流(DA)每回合削全部 N 只
// 清波回合 T = N×H / (DS + N×DA)；每分钟击杀 = 60×(DS + N×DA)/H×0.95
function calcMap(map, player, stats, _dps, mpPerTurn, parts) {
  const N = getWaveSize();
  const totalWeight = map.monsters.reduce((s, m) => s + m.count, 0);
  const buffDefBonus = getBuffDefBonus(player);
  const allDrops = {};
  let dangerCount = 0, dangerMonsters = [];

  let wHP = 0, wExp = 0, wGold = 0, wSingle = 0, wAoe = 0;
  let wDmgToPlayer = 0, wHpPotPerKill = 0, wMpPotPerKill = 0;
  let wHpHealPerKill = 0, wMpHealPerKill = 0, wSurvive = 0;

  for (const entry of map.monsters) {
    const mon = MONSTERS[entry.name];
    if (!mon) continue;
    const w = entry.count / totalWeight;
    const single = singleDmgToMon(parts, mon); // 主目标单点流（扣该怪自身防/魔防）
    const aoe = aoeDmgToMon(parts, mon);       // 每只AOE流（法/道溅射不扣防、召唤/毒不扣防）
    const r = rollDropExpect(entry.name, mon.level);
    // 承伤 & 扛几击（先算，用于判定绝对秒杀）
    const dmgToPlayerRaw = avgDamage(mon.minAtk, mon.maxAtk, stats.minDef, stats.maxDef);
    const dmgToPlayer = Math.max(1, Math.floor(dmgToPlayerRaw * (1 - buffDefBonus)));
    const survive = Math.floor(stats.maxHp / dmgToPlayer);
    // ★ 绝对秒杀怪（survive ≤ 1，玩家扛不住第二下）完全隔离：
    // 收益/清场HP/对怪伤害/承伤/药水全部按 0 计入加权，不影响其他能打的怪的收益与清场速度。
    // 仅保留在 dangerMonsters 做危险提示。
    const z = survive <= 1 ? 0 : 1;
    wHP += mon.hp * w * z;
    wExp += mon.exp * w * z;
    wSingle += single * w * z;
    wAoe += aoe * w * z;
    wGold += r.gold * w * z;
    wDmgToPlayer += dmgToPlayer * w * z;
    wHpPotPerKill += r.hpPot * w * z; wMpPotPerKill += r.mpPot * w * z;
    wHpHealPerKill += r.hpHeal * w * z; wMpHealPerKill += r.mpHeal * w * z;
    wSurvive += survive * w * z;
    // 掉落展示：秒杀怪仍可入 allDrops（仅展示来源，不计入收益）
    for (const it of r.items) {
      const k = it.name;
      if (!allDrops[k]) allDrops[k] = { name: k, chance: it.chance, info: it.info, sources: [] };
      if (allDrops[k].sources.length < 3 && !allDrops[k].sources.includes(entry.name))
        allDrops[k].sources.push(entry.name);
    }
    if (survive < 5) {
      dangerCount += entry.count;
      dangerMonsters.push({ name: entry.name, lv: mon.level, dmg: Math.round(dmgToPlayer), survive, count: entry.count });
    }
  }

  const H = wHP, DS = wSingle, DA = wAoe;
  const COMBAT_EFFICIENCY = 0.95;
  // 波次清场：每分钟击杀 = 60×(DS + N×DA)/H×0.95
  const clearRate = DS + N * DA; // 每回合有效清场速度
  const killsPerMin = clearRate > 0 ? Math.min(60, 60 * clearRate / H * COMBAT_EFFICIENCY) : 0;
  const turnsPerMin = 60 * COMBAT_EFFICIENCY; // 每分钟战斗回合数（1回合/秒×损耗）
  const hitsToKill = (DS + DA) > 0 ? H / (DS + DA) : 999; // 主目标击杀回合（代表性）

  const expPerMin = Math.round(wExp * killsPerMin);
  const goldPerMin = Math.round(wGold * killsPerMin);

  // 蓝药
  const mpCostPerMin = mpPerTurn * turnsPerMin;
  const mpPotPerMin = wMpPotPerKill * killsPerMin;
  const freeMpPerMin = wMpHealPerKill * killsPerMin;
  const mpCost = Math.max(0, mpCostPerMin - freeMpPerMin) * (50 / 30);

  // 红药：每回合承伤 = 平均存活(N/2) × 单怪伤害 × 分摊率（宝宝40%挡 / 隐身100%挡）
  const shareRate = parts.hasMinion ? (1 - parts.stealthUptime) * 0.6 : 1.0;
  const dmgPerTurn = (N / 2) * wDmgToPlayer * shareRate;
  const hpTakenPerMin = dmgPerTurn * turnsPerMin;
  const hpPotPerMin = wHpPotPerKill * killsPerMin;
  const freeHpPerMin = wHpHealPerKill * killsPerMin;
  const hpCost = Math.max(0, hpTakenPerMin - freeHpPerMin) * (50 / 30);

  const safety = Math.max(0, Math.round(100 - (dangerCount / totalWeight) * 100));
  // 瞬间秒杀判定：autoHeal 每回合末才喝药，而怪物先反击——若一回合内合击总伤害 ≥ maxHp，
  // 则吃药来不及、直接阵亡（反复秒杀=无法有效挂机）→ 收益全部归 0。
  const instakillBarrage = dmgPerTurn >= stats.maxHp;
  // 可行性：扛几击 ≥ 主目标击杀回合×1.2，且安全度≥40，且不被瞬间秒杀
  const practical = !instakillBarrage && wSurvive >= hitsToKill * 1.2 && safety >= 40;
  // 瞬间秒杀：收益全 0（无有效战斗，无药费亏损）
  const expPerMinFinal = instakillBarrage ? 0 : expPerMin;
  const goldPerMinFinal = instakillBarrage ? 0 : goldPerMin;
  const netGold = instakillBarrage ? 0 : Math.round(goldPerMin - mpCost - hpCost);

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
    map, expPerMin: expPerMinFinal, goldPerMin: goldPerMinFinal, netGold,
    killsPerMin: Math.round(killsPerMin * 10) / 10,
    hitsToKill: Math.round(hitsToKill * 10) / 10, safety, dangerMonsters,
    mpCostPerMin: Math.round(mpCostPerMin), freeMpPot: Math.round(mpPotPerMin * 10) / 10,
    hpTakenPerMin: Math.round(hpTakenPerMin), hpCost: Math.round(hpCost),
    allDrops: Object.values(allDrops).sort((a, b) => a.chance - b.chance), dropSummary,
    locked: player.level < map.levelReq,
    practical, lethal: instakillBarrage, wSurvive: Math.round(wSurvive * 10) / 10,
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

/* ===================================================================
 * 蒙特卡洛战斗模拟 —— 逐回合复刻原版 game.js 战斗循环
 * （参考 docs/reference/origin-game.js，2026-08 抓取自 guagame.com）
 *
 * 与解析式 calcMap 的区别：伤害逐次 roll（攻/防独立均匀随机）、
 * 波次首回合全怪齐射、一回合只喝一瓶药、怪物技能/麻痹/毒/召唤
 * 全部真实结算、死亡清波重来并损失1%金币。
 * 输出真实的 死亡/小时 与受死亡拖累后的实际收益。
 * =================================================================== */
const SIM_DEFAULT_TURNS = 3000; // 模拟回合数（1回合=1秒，3000回合≈50分钟游戏时间）
const SIM_HP_THRESHOLD = 0.7;   // 原版默认：HP<70% 自动喝红药
const SIM_MP_THRESHOLD = 0.3;   // 原版默认：MP<30% 自动喝蓝药

function simulateMap(map, player, stats, parts, opts) {
  opts = opts || {};
  const N = opts.waveSize || getWaveSize();
  const TURNS = opts.turns || SIM_DEFAULT_TURNS;
  const HP_TH = opts.hpThreshold || SIM_HP_THRESHOLD;
  const MP_TH = opts.mpThreshold || SIM_MP_THRESHOLD;
  const rng = opts.rng || Math.random;
  const rollDmg = (minAtk, maxAtk, minDef, maxDef) => {
    const atk = minAtk + rng() * (maxAtk - minAtk);
    const def = (minDef || 0) + rng() * ((maxDef || 0) - (minDef || 0));
    return Math.max(1, Math.floor(atk - def * 0.6));
  };

  const defBonus = getBuffDefBonus(player);
  const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
  const magicBase = player.job === "mage" ? stats.maxMc : stats.maxSc;

  // 输出侧技能分类（延迟型独立冷却，常驻型每回合生效）
  const delaySkills = [], residentSkills = [], aoeResident = [], aoeDelay = [];
  let passiveMagic = 0, normalPassive = parts.normalPassive;
  for (const sk of player.equippedSkills || []) {
    const sd = SKILLS[sk]; if (!sd) continue;
    if (sd.delay > 0) {
      if (sd.aoe) aoeDelay.push(sk); else delaySkills.push(sk);
    } else if (sd.type === "attack" && !sd.aoe && sk !== "施毒术" && sk !== "瘟疫" && sk !== "毒云") {
      residentSkills.push(sk);
    } else if (sd.aoe && sd.type === "attack") {
      aoeResident.push(sk);
    } else if (sd.type === "passive") {
      passiveMagic += sd.damageBonus;
    }
  }
  const cooldowns = {};

  // 击杀收益：金币期望 / 经验
  const killGold = {};
  for (const m of map.monsters) {
    const r = rollDropExpect(m.name, MONSTERS[m.name] ? MONSTERS[m.name].level : 1);
    killGold[m.name] = r.gold;
  }

  // 模拟状态
  let hp = stats.maxHp, mp = stats.maxMp;
  let monsters = [];            // 当前波存活怪
  let bossMinions = [];         // BOSS 召唤物（最多2只，atk）
  let playerPoison = 0, playerPoisonDmg = 0, playerStunned = false;
  let simGold = 1000000;        // 模拟金币池（死亡按1%扣）
  let kills = 0, expGain = 0, deaths = 0, dropGold = 0, potGold = 0;

  const spawnWave = () => {
    const total = map.monsters.reduce((s, m) => s + m.count, 0);
    monsters = [];
    for (let i = 0; i < N; i++) {
      let roll = rng() * total, chosen = map.monsters[0].name;
      for (const m of map.monsters) { roll -= m.count; if (roll <= 0) { chosen = m.name; break; } }
      const t = MONSTERS[chosen]; if (!t) continue;
      monsters.push({ name: chosen, cur: t.hp, maxHp: t.hp, minAtk: t.minAtk, maxAtk: t.maxAtk,
        minDef: t.minDef, maxDef: t.minDef, minMagDef: t.minMagDef, maxMagDef: t.minMagDef,
        exp: t.exp, skills: t.skills || [], stunned: false });
    }
    bossMinions = [];
  };

  const onKill = (m) => {
    kills++; expGain += m.exp; dropGold += killGold[m.name] || 0; simGold += killGold[m.name] || 0;
  };
  const hit = (m, dmg) => { m.cur -= dmg; if (m.cur <= 0 && !m.dead) { m.dead = true; onKill(m); } };

  // AI 选药（复刻 _resolveAutoPotion auto 模式：恢复量最贴合缺口；金币不足自动降级）
  const drinkPotion = (kind, cur, max) => {
    const missing = max - cur;
    const cands = Object.entries(ITEMS).filter(([, i]) =>
      i.type === "potion" && (kind === "hp" ? i.healHp : (i.healMp && !i.healHp)));
    cands.sort((a, b) => Math.abs((kind === "hp" ? a[1].healHp : a[1].healMp) - missing)
      - Math.abs((kind === "hp" ? b[1].healHp : b[1].healMp) - missing));
    for (const [, info] of cands) {
      if (simGold >= (info.price || 0)) {
        simGold -= info.price || 0; potGold += info.price || 0;
        return kind === "hp" ? Math.min(info.healHp, missing) : Math.min(info.healMp, max - cur);
      }
    }
    return 0;
  };

  const autoHeal = () => {
    if (hp < stats.maxHp * HP_TH) hp = Math.min(stats.maxHp, hp + drinkPotion("hp", hp, stats.maxHp));
    if (mp > 0 && mp < stats.maxMp * MP_TH) mp = Math.min(stats.maxMp, mp + drinkPotion("mp", mp, stats.maxMp));
  };

  const onDeath = () => {
    deaths++;
    const loss = Math.floor(simGold * 0.01);
    simGold -= loss; dropGold -= loss; // 死亡损失1%金币（从收益中扣除）
    hp = stats.maxHp; mp = stats.maxMp;
    playerPoison = 0; playerPoisonDmg = 0; playerStunned = false;
    monsters = []; bossMinions = []; // 波次清零重刷（打了一半的怪作废）
  };

  // 全部存活怪反击一轮（麻痹回合 / 普通回合共用）
  const monstersAttack = () => {
    // 宝宝分流：隐身覆盖率内100%打宝宝，其余40%概率打宝宝（宝宝不死、不追踪，简化）
    const petRate = parts.hasMinion ? parts.stealthUptime + (1 - parts.stealthUptime) * 0.4 : 0;
    for (const m of monsters) {
      if (m.dead) continue;
      if (m.stunned) { m.stunned = false; continue; }
      if (rng() < petRate) continue;
      hp -= Math.max(1, Math.floor(rollDmg(m.minAtk, m.maxAtk, stats.minDef, stats.maxDef) * (1 - defBonus)));
      if (hp <= 0) return;
      for (const sk of m.skills) {
        if (rng() > sk.chance) continue;
        if (sk.type === "magic") {
          hp -= Math.max(1, Math.floor(rollDmg(m.minAtk, m.maxAtk, stats.minMagDef, stats.maxMagDef) * sk.power * (1 - defBonus)));
        } else if (sk.type === "poison") {
          playerPoison = 3; playerPoisonDmg = Math.max(2, Math.floor(m.maxAtk * sk.power * 0.3)); // 毒不吃减伤
        } else if (sk.type === "paralysis" || sk.type === "freeze") {
          playerStunned = true;
        } else if (sk.type === "summon") {
          if (bossMinions.length < 2) bossMinions.push({ atk: Math.floor(m.maxAtk * sk.power * 0.5) });
        } else if (sk.type === "lifesteal") {
          const d = Math.max(1, Math.floor(rollDmg(m.minAtk, m.maxAtk, stats.minDef, stats.maxDef) * sk.power * (1 - defBonus)));
          hp -= d; m.cur = Math.min(m.maxHp, m.cur + Math.floor(d * 0.5));
        }
        if (hp <= 0) return;
      }
    }
    // BOSS 召唤物攻击（不走减伤，扣最小防×0.3）
    for (const s of bossMinions) {
      hp -= Math.max(1, Math.floor(s.atk * (0.8 + rng() * 0.4) - stats.minDef * 0.3));
      if (hp <= 0) return;
    }
  };

  for (let turn = 0; turn < TURNS; turn++) {
    if (monsters.length === 0) spawnWave();
    monsters = monsters.filter(m => !m.dead);

    // 1. 玩家中毒 DOT（先于行动结算）
    if (playerPoison > 0) { hp -= playerPoisonDmg; playerPoison--; if (hp <= 0) { onDeath(); continue; } }

    // 2. 麻痹回合：跳过行动，全怪围殴
    if (playerStunned) {
      playerStunned = false;
      monstersAttack();
      if (hp <= 0) { onDeath(); continue; }
      autoHeal();
      continue;
    }

    // 3. 玩家攻击主目标（普攻 roll + 魔法段 roll）
    let mon = monsters.find(m => !m.dead);
    if (!mon) { spawnWave(); monsters = monsters.filter(m => !m.dead); mon = monsters[0]; if (!mon) continue; }

    // 技能冷却推进 + 当回合触发加成（复刻 processSkillCooldowns）
    let triggeredBonus = 0; const triggeredAoe = [];
    for (const sk of delaySkills.concat(aoeDelay)) {
      const sd = SKILLS[sk];
      if (cooldowns[sk] === undefined) cooldowns[sk] = 0;
      if (cooldowns[sk] <= 0) {
        const cost = sd.delay * 2;
        if (mp >= cost) {
          mp -= cost; triggeredBonus += sd.damageBonus; cooldowns[sk] = sd.delay;
          if (sd.aoe) triggeredAoe.push(sk); // 触发型AOE：既进魔法段也进当回合溅射
        }
      } else cooldowns[sk]--;
    }
    // 常驻单体魔法技能（各耗2MP，MP不足跳过）
    let residentBonus = 0;
    for (const sk of residentSkills) { if (mp >= 2) { mp -= 2; residentBonus += SKILLS[sk].damageBonus; } }

    let dmg = rollDmg(stats.minAtk, stats.maxAtk, mon.minDef, mon.maxDef);
    // 战士:普攻乘完整技能乘区(warriorMult, 所有delay=0非buff技能加成); 法/道只乘utility类被动
    const physMult = player.job === "warrior" ? parts.warriorMult : (1 + normalPassive);
    dmg = Math.floor(dmg * physMult);
    const magicBonus = triggeredBonus + residentBonus + passiveMagic;
    if (magicBonus > 0 && magicBase > 0) {
      const mMin = Math.floor(magicBase * (1 + magicBonus) * 0.9);
      const mMax = Math.floor(magicBase * (1 + magicBonus) * 1.1);
      dmg += rollDmg(mMin, mMax, mon.minMagDef, mon.maxMagDef);
    }
    hit(mon, Math.max(1, dmg));

    // 4. AOE 溅射：全场存活怪（含主目标）；道士/战士口径与原版一致
    const aoeBonusNow = aoeResident.reduce((s, sk) => s + SKILLS[sk].damageBonus, 0)
      + triggeredAoe.reduce((s, sk) => s + SKILLS[sk].damageBonus, 0);
    if (aoeBonusNow > 0) {
      let splash = 0;
      if (player.job === "mage") splash = Math.max(1, Math.floor(stats.maxMc * aoeBonusNow));
      else if (player.job === "taoist") splash = rollDmg(Math.floor(magicBase * (1 + aoeBonusNow) * 0.45), Math.floor(magicBase * (1 + aoeBonusNow) * 0.55), 0, 0);
      else splash = Math.max(1, Math.floor(dmg * aoeBonusNow * 0.5));
      for (const m of monsters) if (!m.dead) hit(m, splash);
    }
    // 5. 施毒/特效/召唤宝宝（期望值通道，原版为3回合刷新DOT，稳态等效）
    const main = monsters.find(m => !m.dead);
    if (main) hit(main, parts.poisonSingle + parts.specialSingle);
    if (parts.poisonAoEPerMon > 0) for (const m of monsters) if (!m.dead) hit(m, parts.poisonAoEPerMon);
    if (parts.summonPerMon > 0) for (const m of monsters) if (!m.dead) hit(m, parts.summonPerMon);

    // 6. 怪物反击
    monstersAttack();
    if (hp <= 0) { onDeath(); continue; }

    // 7. 回合末喝药（一回合一瓶HP+一瓶MP）
    autoHeal();

    // 8. 波次全灭：清除毒/麻痹状态（下回合重刷）
    if (monsters.every(m => m.dead)) { monsters = []; bossMinions = []; playerPoison = 0; playerStunned = false; }
  }

  const minutes = TURNS / 60;
  return {
    turns: TURNS,
    killsPerMin: Math.round(kills / minutes * 10) / 10,
    expPerMin: Math.round(expGain / minutes),
    dropGoldPerMin: Math.round(dropGold / minutes),
    potGoldPerMin: Math.round(potGold / minutes),
    netGoldPerMin: Math.round((dropGold - potGold) / minutes),
    deathsPerHour: Math.round(deaths / (TURNS / 3600) * 10) / 10,
    deaths: deaths, kills,
  };
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
  const parts = getDamageParts(player, stats);
  const dps = getDPS(player, stats);
  const { perTurn: mpPerTurn, singleAtkSkills } = getMpCostPerTurn(player);

  renderPlayer(player, stats, dps, mpPerTurn, singleAtkSkills);

  // 计算所有地图（parts 用于对每只怪单独扣防）
  const simOpts = getSimOptions();
  currentResults = MAPS.map(m => {
    const r = calcMap(m, player, stats, dps, mpPerTurn, parts);
    r.sim = simulateMap(m, player, stats, parts, simOpts);
    return r;
  });
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

// 模拟选项：从页面控件读取（喝药阈值需与游戏内设置一致，否则死亡/时严重失真）
function getSimOptions() {
  const hpSel = document.getElementById("sim-hp-threshold");
  return {
    hpThreshold: hpSel ? parseFloat(hpSel.value) : 0.7,
    mpThreshold: 0.3,
  };
}

const COLUMNS = [
  { key: "name",     label: "地图",        sort: r => r.map.name,            align: "left" },
  { key: "lv",       label: "要求",        sort: r => r.map.levelReq,        align: "center" },
  { key: "kills",    label: "击杀/分",     sort: r => r.killsPerMin,         align: "right" },
  { key: "expPerMin",label: "经验/分",     sort: r => r.expPerMin,           align: "right" },
  { key: "goldPerMin",label:"金币/分",     sort: r => r.goldPerMin,          align: "right" },
  { key: "netGold",  label: "净金币/分",   sort: r => r.netGold,             align: "right" },
  { key: "safety",   label: "安全度",      sort: r => r.safety,              align: "center" },
  { key: "simDeath", label: "死亡/时🎲",   sort: r => r.sim ? r.sim.deathsPerHour : Infinity, align: "center" },
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
  // 区分状态：等级不足(locked) / 合击致死(lethal) / 打不动(impractical但能进)
  let rowCls = "";
  let statusTag = "";
  if (r.locked) {
    rowCls = " locked";
    statusTag = ' <span style="color:#ef5350;font-size:11px">🔒等级不足</span>';
  } else if (r.lethal) {
    rowCls = " impractical";
    statusTag = ' <span style="color:#ef5350;font-size:11px" title="单回合承伤'+Math.round((r.hpTakenPerMin/(60*0.95)))+'HP ≥ 满血，吃药来不及直接秒杀">💀瞬间秒杀</span>';
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

  // 合击致死：经验/金币/净金全显示 0（无有效战斗）
  const expCell = r.lethal ? '<span style="color:#888">0</span>'
    : r.practical ? "<b>"+r.expPerMin.toLocaleString()+"</b>"
    : '<span style="color:#888" title="扛不到杀死怪就死，拿不到经验">'+r.expPerMin.toLocaleString()+'*</span>';
  const goldCell = r.lethal ? '<span style="color:#888">0</span>'
    : r.practical ? r.goldPerMin.toLocaleString()
    : '<span style="color:#888" title="打不死怪，无掉落">~0*</span>';
  const netCell = r.lethal ? '<span style="color:#888">0</span>'
    : r.practical ? (r.netGold >= 0 ? "+" : "") + r.netGold.toLocaleString()
    : "−" + (r.mpCostPerMin/30*50 + r.hpCost).toLocaleString() + "*";

  // 模拟死亡/时徽章：主数值死亡频率，括号内为模拟实际经验/分（受死亡拖累）
  const simCell = r.sim
    ? (() => {
        const d = r.sim.deathsPerHour;
        const color = d <= 5 ? "#4caf50" : d <= 30 ? "#ffc107" : d <= 120 ? "#ff9800" : "#ef5350";
        const dTxt = d >= 1000 ? "≈" + Math.round(d) : d;
        const e = r.sim.expPerMin >= 10000 ? (r.sim.expPerMin / 10000).toFixed(1) + "万" : r.sim.expPerMin;
        return `<span style="color:${color};font-weight:600" title="蒙特卡洛模拟${r.sim.turns}回合：死亡${r.sim.deaths}次，实际经验${r.sim.expPerMin}/分，药费${r.sim.potGoldPerMin}/分">${dTxt}</span> <span style="color:#888;font-size:10px">(${e})</span>`;
      })()
    : '<span style="color:#888">-</span>';

  const row = `<tr class="${rowCls}" id="row-${idx}">
    <td class="map-name"><b>${r.map.name}</b>${c2tag}${statusTag}</td>
    <td class="num">${r.map.levelReq}</td>
    <td class="num">${r.killsPerMin}</td>
    <td class="num">${expCell}</td>
    <td class="num">${goldCell}</td>
    <td class="num ${r.lethal ? "" : (r.practical ? netCls : "neg")}">${netCell}</td>
    <td class="num ${safeCls}">${safeTxt}</td>
    <td class="num">${simCell}</td>
    <td class="drops-cell">${dropHtml}</td>
  </tr>`;

  const detailRow = expandedRow === idx
    ? `<tr class="detail-row"><td colspan="9">${renderDetail(r)}</td></tr>` : "";
  return row + detailRow;
}

function renderDetail(r) {
  const danger = r.dangerMonsters.length
    ? `<div style="margin-bottom:10px;color:#ef9a9a;">⚠️ 危险怪物: ${r.dangerMonsters.map(d => `${d.name}(L${d.lv},打${d.dmg}/击,扛${d.survive})×${d.count}`).join("， ")}</div>`
    : "";
  const simInfo = r.sim
    ? `<div style="margin-bottom:10px;color:#ce93d8;">🎲 蒙特卡洛模拟（${r.sim.turns}回合≈${Math.round(r.sim.turns/60)}分钟游戏时间）：死亡 <b>${r.sim.deathsPerHour}/时</b>（共${r.sim.deaths}次），实际击杀 ${r.sim.killsPerMin}/分、经验 ${r.sim.expPerMin.toLocaleString()}/分、药费 ${r.sim.potGoldPerMin.toLocaleString()}金/分、净金 ${r.sim.netGoldPerMin.toLocaleString()}金/分。解析式经验 ${r.expPerMin.toLocaleString()}/分${r.sim.expPerMin < r.expPerMin * 0.8 ? '，模拟受死亡拖累明显低于解析值' : ''}</div>`
    : "";
  const lethalInfo = r.lethal
    ? `<div style="margin-bottom:10px;color:#ef5350;">💀 瞬间秒杀：单回合承伤约 ${Math.round(r.hpTakenPerMin/(60*0.95))} HP ≥ 满血，autoHeal 来不及喝药就阵亡，无法有效挂机，收益为 0</div>`
    : "";
  const mpInfo = `<div style="margin-bottom:10px;color:#90caf9;">💧 蓝耗 ${r.mpCostPerMin} MP/分，地图掉落蓝药 ${r.freeMpPot} 瓶/分</div>`;
  const hpInfo = `<div style="margin-bottom:10px;color:#ef9a9a;">❤️ 承受伤害 ${r.hpTakenPerMin} HP/分，红药成本 ${r.hpCost} 金/分</div>`;  const drops = `<div class="detail-content">${r.allDrops.map(d => {
    const it = d.info || {};
    const typeTag = it.type ? `<span class="prob">[${it.type}${it.job ? "/" + it.job : ""}${it.level ? " L" + it.level : ""}]</span>` : "";
    return `<div class="drop-item"><span class="name">${d.name}</span> ${typeTag}<span class="prob"> 1/${d.chance}</span><br><span class="src">来源: ${d.sources.join("， ")}</span></div>`;
  }).join("")}</div>`;
  return danger + simInfo + lethalInfo + mpInfo + hpInfo + drops;
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
  } else if (name === "recommend") {
    renderRecommend();
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
  else if (section === "regions") renderRegions();
  else if (section === "skills") renderSkills();
  else if (section === "tower") renderTower();
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

// 特殊装备效果说明（特效名 → 实际战斗效果描述，提炼自 game.js）
const SPECIAL_EFFECTS = {
  "传送": "每击杀30只小怪，下一波必定传送1只当前地图的BOSS过来",
  "护身": "受到伤害的30%转化为MP消耗（MP耗尽后失效）",
  "复活": "战斗中死亡时原地复活，恢复50%HP（每场战斗1次）",
  "火焰": "每回合额外造成 maxAtk×30% 火焰伤害",
  "超负载": "背包装备格 +10",
  "防御": "每回合自动回复 maxHp×2% HP",
  "记忆": "击杀怪物时5%概率召唤记忆幻影助战5回合（继承30%攻击力）",
  "吸血": "造成伤害时吸取15%回复HP（嗜血战斧20%）",
  "连击": "目标存活时25%概率追加一次物理攻击",
  "麻痹": "攻击时15%概率麻痹目标，下回合无法行动",
};

// 物品悬浮提示文本（属性 + 特效描述），用于地区图鉴/掉落列表的 title 属性
function itemTooltip(name) {
  const it = ITEMS[name];
  if (!it) return name;
  const parts = [];
  const r = k => it[k] ? fmtRange(it[k]) : "";
  if (it.atk) parts.push("攻" + r("atk"));
  if (it.mc) parts.push("魔" + r("mc"));
  if (it.sc) parts.push("道" + r("sc"));
  if (it.def) parts.push("防" + r("def"));
  if (it.magDef) parts.push("魔防" + r("magDef"));
  if (it.hp) parts.push("HP+" + it.hp);
  if (it.healHp) parts.push("回血" + it.healHp);
  if (it.healMp) parts.push("回蓝" + it.healMp);
  if (it.special) parts.push("【" + it.special + "】" + (SPECIAL_EFFECTS[it.special] || ""));
  return parts.join(" ") || name;
}

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
  // 排序：无等级的物品(药水/材料/力量戒指等)排最后，有等级的按等级升序
  list.sort((a, b) => {
    const la = a[1].level, lb = b[1].level;
    if (!la && !lb) return a[0].localeCompare(b[0]);
    if (!la) return 1;
    if (!lb) return -1;
    return la - lb;
  });
  document.getElementById("item-count").textContent = `${list.length} 件`;

  const body = document.getElementById("items-body");
  body.innerHTML = list.map(([name, it], i) => renderItemRow(name, it, i)).join("");
}

function renderItemRow(name, it, idx) {
  const isExpanded = dbExpandedItem === name;
  const jobTag = it.job ? `<span class="job-tag ${JOB_COLORS[it.job] || ""}">${JOB_NAMES[it.job] || it.job}</span>` : "";
  const specialTag = it.special ? `<span class="special-tag" title="${it.special}：${SPECIAL_EFFECTS[it.special] || ""}">${it.special}</span>` : "";
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
  if (it.special) stats.push(["特效", it.special + "：" + (SPECIAL_EFFECTS[it.special] || "未知效果")]);
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
  // 掉落：区分专属表 vs 通用回退；专属表内再区分"独特"(仅此怪/少数怪)与"通用"(通用表也有)
  const explicitDrops = resolveDropTable(name); // 解析字符串别名，返回数组或 null
  let dropsHtml;
  if (explicitDrops) {
    // 有专属掉落表：按 通用/独特 分组，独特在前
    const genSet = getGenericItemSet();
    const uniq = [], gen = [];
    for (const d of explicitDrops) {
      if (d.item === "金币") continue;
      (genSet.has(d.item) ? gen : uniq).push(d);
    }
    const renderGrp = (arr, label, badgeCls) => arr.length ? `<div class="drop-group">
      <div class="drop-group-label">${label} <span class="drop-count">${arr.length}</span></div>
      <div class="stat-grid">${arr.map(d => {
        const it = ITEMS[d.item];
        const typeTag = it ? `<span class="type-tag ${it.type}">${TYPE_NAMES[it.type]||it.type}</span>` : "";
        const badge = `<span class="drop-badge ${badgeCls}">${badgeCls==="uniq"?"独特":"通用"}</span>`;
        return `<div class="stat-item" title="${itemTooltip(d.item)}">${typeTag}${badge} <span class="val">${d.item}</span> <span class="lbl">1/${d.chance}</span></div>`;
      }).join("")}</div></div>` : "";
    dropsHtml = renderGrp(uniq, "独特掉落", "uniq") + renderGrp(gen, "通用掉落", "gen") || '<div style="color:#666">无掉落</div>';
  } else {
    // 无专属表：套用通用掉落表（按怪物等级分档）
    const tier = m.level <= 20 ? "low" : (m.level <= 40 ? "mid" : "high");
    const table = GENERIC_DROPS[tier] || [];
    const arr = table.filter(d => d.item !== "金币");
    dropsHtml = arr.length ? `<div class="drop-group">
      <div class="drop-group-label">通用掉落 <span class="drop-tier-tag">${GENERIC_TIER_INFO[tier].label}</span> <span class="drop-count">${arr.length}</span></div>
      <div class="stat-grid">${arr.map(d => {
        const it = ITEMS[d.item];
        const typeTag = it ? `<span class="type-tag ${it.type}">${TYPE_NAMES[it.type]||it.type}</span>` : "";
        return `<div class="stat-item" title="${itemTooltip(d.item)}">${typeTag}<span class="drop-badge gen">通用</span> <span class="val">${d.item}</span> <span class="lbl">1/${d.chance}</span></div>`;
      }).join("")}</div></div>` : '<div style="color:#666">无掉落</div>';
  }
  // 地图
  const mapsHtml = maps.length ? maps.map(x => `<div class="stat-item"><span class="val">${x.name}</span> <span class="lbl">L${x.levelReq}${x.continent===2?" 二大陆":""} ×${x.count}</span></div>`).join("") : '<div style="color:#666">无地图记录</div>';
  return `<div class="db-detail-content">
    <div class="db-detail-section"><h4>⚔️ 怪物技能</h4><div class="stat-grid">${skillsHtml}</div></div>
    <div class="db-detail-section"><h4>📦 掉落物品</h4>${dropsHtml}</div>
    <div class="db-detail-section"><h4>📍 所在地图</h4><div class="stat-grid">${mapsHtml}</div></div>
  </div>`;
}

function toggleMon(name) { dbExpandedMon = dbExpandedMon === name ? null : name; renderMonsters(); }

// === 地区图鉴 ===
// 收起的地图名集合（默认全部展开）
let dbCollapsedRegions = new Set();
// 通用掉落分档标签（与 getDropTable 一致：level<=20 low, 21-40 mid, >40 high）
const GENERIC_TIER_INFO = {
  low:  { label: "低档 (怪物等级 ≤ 20)", color: "#a5d6a7" },
  mid:  { label: "中档 (怪物等级 21-40)", color: "#ffd54f" },
  high: { label: "高档 (怪物等级 > 40)",  color: "#ef9a9a" },
};
const MON_TYPE_TEXT = { normal: "普通", elite: "精英", boss: "Boss" };

// 渲染顶部通用掉落（low/mid/high 各一次，避免每怪重复）
function renderGenericDrops() {
  const tiers = ["low", "mid", "high"];
  const html = `<div class="region-generic-panel">
    <div class="region-generic-title">📜 通用掉落表（无专属掉落的怪物按等级套用下表，不必每怪重复列出）</div>
    ${tiers.map(tier => {
      const table = GENERIC_DROPS[tier] || [];
      const info = GENERIC_TIER_INFO[tier];
      const items = table.filter(d => d.item !== "金币").map(d => {
        const it = ITEMS[d.item];
        const typeTag = it ? `<span class="type-tag ${it.type}">${TYPE_NAMES[it.type]||it.type}</span>` : "";
        const cntTag = d.count ? ` ×${d.count}` : "";
        return `<span class="region-gen-item" title="${itemTooltip(d.item)}">${typeTag}<b>${d.item}</b><span class="prob">1/${d.chance}</span>${cntTag}</span>`;
      }).join("");
      return `<div class="region-gen-tier">
        <div class="region-gen-tier-label" style="color:${info.color}">${info.label}</div>
        <div class="region-gen-items">${items}</div>
      </div>`;
    }).join("")}
  </div>`;
  document.getElementById("region-generic-drops").innerHTML = html;
}

// 解析专属掉落表：DROPS[name] 可能是数组，也可能是字符串别名（指向另一个怪），跟随引用并防循环
function resolveDropTable(name) {
  let cur = name;
  const seen = new Set();
  while (Object.prototype.hasOwnProperty.call(DROPS, cur)) {
    if (seen.has(cur)) return null; // 循环引用保护
    seen.add(cur);
    const t = DROPS[cur];
    if (Array.isArray(t)) return t;
    if (typeof t === "string") { cur = t; continue; }
    return null; // 其他异常类型
  }
  return null;
}

// 单个掉落条目渲染（复用于专属掉落；标注通用/独特）
function renderDropEntry(d) {
  const it = ITEMS[d.item];
  const tip = itemTooltip(d.item);
  const typeTag = it ? `<span class="type-tag ${it.type}">${TYPE_NAMES[it.type]||it.type}</span>` : "";
  const cntTag = d.count ? ` ×${d.count}` : "";
  const isGen = getGenericItemSet().has(d.item);
  const badge = `<span class="region-drop-badge ${isGen?"gen":"uniq"}">${isGen?"通":"独"}</span>`;
  return `<span class="region-drop-item ${isGen?"is-gen":"is-uniq"}" title="${tip}">${badge}${typeTag}<b>${d.item}</b><span class="prob">1/${d.chance}</span>${cntTag}</span>`;
}

// 渲染单张地图卡片（全部展开，不折叠）
function renderRegionCard(map) {
  const continent = map.continent || 1;
  const c2tag = continent === 2 ? ' <span class="c2">[二大陆]</span>' : "";
  const totalWeight = map.monsters.reduce((s, m) => s + m.count, 0);

  const monsParts = map.monsters.map(entry => {
    const mon = MONSTERS[entry.name];
    if (!mon) return ""; // 悬挂引用跳过
    const pct = entry.count / totalWeight * 100;
    const pctStr = pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
    const typeText = MON_TYPE_TEXT[mon.type] || mon.type;
    const typeCls = `mtype-${mon.type}`;
    // 专属掉落：只用 DROPS[name]（解析字符串别名），不混入通用表
    const specialTable = resolveDropTable(entry.name);
    let dropsHtml;
    if (specialTable) {
      const drops = specialTable.filter(d => d.item !== "金币");
      dropsHtml = drops.length
        ? `<div class="region-drops">${drops.map(renderDropEntry).join("")}</div>`
        : '<div class="region-drops-empty">无掉落</div>';
    } else {
      const tier = mon.level <= 20 ? "low" : (mon.level <= 40 ? "mid" : "high");
      dropsHtml = `<div class="region-drops-generic">通用${GENERIC_TIER_INFO[tier].label.split(" ")[0]} ↑</div>`;
    }
    return `<div class="region-mon">
      <div class="region-mon-head">
        <span class="${typeCls}"><b>${entry.name}</b></span>
        <span class="region-mon-meta">Lv${mon.level} ${typeText} HP${mon.hp} <span class="region-pct">${pctStr}%</span></span>
      </div>
      ${dropsHtml}
    </div>`;
  });
  const monsHtml = monsParts.join("");
  const monCount = map.monsters.length;

  const isCollapsed = dbCollapsedRegions.has(map.name);
  const toggleIcon = isCollapsed ? "▶" : "▼";
  const monsBlock = isCollapsed ? "" : `<div class="region-mons">${monsHtml}</div>`;
  return `<div class="region-card${isCollapsed?" collapsed":""}">
    <div class="region-card-header" onclick="toggleRegion('${map.name.replace(/'/g,"\\'")}')" title="点击展开/收起">
      <span class="region-toggle">${toggleIcon}</span>
      <b>${map.name}</b>${c2tag}
      <span class="region-card-summary">${monCount}种怪物</span>
      <span class="region-card-lv">要求 Lv${map.levelReq}</span>
    </div>
    ${monsBlock}
  </div>`;
}

function toggleRegion(name) {
  if (dbCollapsedRegions.has(name)) dbCollapsedRegions.delete(name);
  else dbCollapsedRegions.add(name);
  renderRegions();
}
// 展开/收起当前筛选结果里的全部地图
function expandAllRegions() { dbCollapsedRegions.clear(); renderRegions(); }
function collapseAllRegions() {
  // 复用 renderRegions 的筛选逻辑得到当前可见地图名
  const cont = document.getElementById("region-filter-cont").value;
  const kw = document.getElementById("region-filter-kw").value.trim().toLowerCase();
  for (const m of MAPS) {
    const mc = m.continent || 1;
    if (cont && mc != cont) continue;
    if (kw) {
      const inName = m.name.toLowerCase().includes(kw);
      const inMon = m.monsters.some(e => e.name.toLowerCase().includes(kw));
      if (!inName && !inMon) continue;
    }
    dbCollapsedRegions.add(m.name);
  }
  renderRegions();
}

function renderRegions() {
  const cont = document.getElementById("region-filter-cont").value;
  const kw = document.getElementById("region-filter-kw").value.trim().toLowerCase();

  // 通用掉落全局展示
  renderGenericDrops();

  // 过滤地图：大陆 + 关键词（匹配地图名或其怪物名）
  let list = MAPS.filter(m => {
    const mc = m.continent || 1;
    if (cont && mc != cont) return false;
    if (kw) {
      const inName = m.name.toLowerCase().includes(kw);
      const inMon = m.monsters.some(e => e.name.toLowerCase().includes(kw));
      if (!inName && !inMon) return false;
    }
    return true;
  });
  // 排序：一大陆在前，再按等级要求升序
  list.sort((a, b) => {
    const ca = a.continent || 1, cb = b.continent || 1;
    if (ca !== cb) return ca - cb;
    return a.levelReq - b.levelReq;
  });

  document.getElementById("region-count").textContent = `${list.length} 张地图`;
  document.getElementById("regions-body").innerHTML = list.map(renderRegionCard).join("");
}

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
    // 掉落位置：技能名 == 技能书物品名，直接查反向索引
    const idx = buildReverseIndex();
    const sources = (idx && idx.itemToSources && idx.itemToSources[name]) || [];
    const monTypeText = { normal: "普通", elite: "精英", boss: "Boss" };
    let dropLocHtml = '<div style="color:#666">无掉落数据（可能为初始技能或任务获得）</div>';
    if (sources.length) {
      dropLocHtml = sources.map(sr => {
        if (sr.generic) {
          return `<div class="drop-source generic"><span class="mon">📜 ${sr.monName}</span> <span class="prob">概率 1/${sr.chance}</span></div>`;
        }
        const tt = sr.monType ? monTypeText[sr.monType] || sr.monType : "";
        const monTypeTag = tt ? `<span class="mtype-${sr.monType}">[${tt}]</span> ` : "";
        const mapsTag = sr.maps.length
          ? `<div class="maps">📍 ${sr.maps.map(m => `${m.name}(L${m.levelReq}${m.continent===2?",二大陆":""})`).join("， ")}</div>`
          : '<div class="maps" style="color:#666">📍 无地图记录</div>';
        const lvTag = sr.monLevel ? ` <span style="color:#888">Lv${sr.monLevel}</span>` : "";
        const cntTag = sr.count ? ` ×${sr.count}` : "";
        return `<div class="drop-source"><span class="mon">${monTypeTag}${sr.monName}</span>${lvTag} <span class="prob">概率 1/${sr.chance}</span>${cntTag}${mapsTag}</div>`;
      }).join("");
    }
    const detail = isExpanded ? `<tr class="db-detail-row"><td colspan="8"><div class="db-detail-content">
      <div class="stat-grid">
        <div class="stat-item"><span class="lbl">威力power</span> <span class="val">${s.power}</span></div>
        <div class="stat-item"><span class="lbl">附加defPower</span> <span class="val">${s.defPower}</span></div>
        <div class="stat-item"><span class="lbl">加成</span> <span class="val">+${(s.damageBonus*100).toFixed(0)}%</span></div>
        <div class="stat-item"><span class="lbl">冷却</span> <span class="val">${s.delay?`${s.delay}回合`:"无冷却"}</span></div>
      </div>
      <div style="color:#b0bec5;font-size:12px;margin-top:6px">${s.desc||""}</div>
      <div class="db-detail-section"><h4>📍 技能书掉落位置（${sources.length}条，按概率从高到低）</h4>${dropLocHtml}</div>
    </div></td></tr>` : "";
    return row + detail;
  }).join("");
}

// === 通天塔 ===
let dbExpandedTower = null;
const TOWER_MON_RANK = { normal: 1, elite: 2, boss: 3 };

// 解析 tower.js 怪物定义为统一结构（复刻 game.js spawnTowerMonster）
// def.ref → 引用 MONSTERS 已有怪物；否则用内联属性（通天塔专属怪）
function resolveTowerMon(def) {
  if (def.ref) {
    const t = MONSTERS[def.ref];
    if (!t) return { name: def.ref, hp: 0, minAtk: 0, maxAtk: 0, minDef: 0, minMagDef: 0, exp: 0, level: 0, type: 'normal', source: 'ref' };
    return Object.assign({ name: def.ref, source: 'ref' }, t);
  }
  return {
    name: def.name, hp: def.hp, minAtk: def.minAtk, maxAtk: def.maxAtk,
    minDef: def.minDef || 0, minMagDef: def.minMagDef || 0,
    exp: def.exp, level: def.level, type: def.type, skills: def.skills,
    source: 'custom'
  };
}

function renderTower() {
  const fmin = parseInt(document.getElementById("tower-filter-min").value) || 1;
  const fmax = parseInt(document.getElementById("tower-filter-max").value) || 30;
  const ftype = document.getElementById("tower-filter-type").value;
  const kw = document.getElementById("tower-filter-kw").value.trim().toLowerCase();

  let list = TOWER_FLOORS.filter(f => {
    if (f.floor < fmin || f.floor > fmax) return false;
    const mons = f.monsters.map(resolveTowerMon);
    if (ftype === "boss" && !mons.some(m => m.type === "boss")) return false;
    if (ftype === "elite" && !mons.some(m => m.type === "boss" || m.type === "elite")) return false;
    if (kw && !mons.some(m => m.name.toLowerCase().includes(kw))) return false;
    return true;
  });
  document.getElementById("tower-count").textContent = `${list.length} 层`;
  document.getElementById("tower-body").innerHTML = list.map(renderTowerRow).join("");
}

function renderTowerRow(f) {
  const mons = f.monsters.map(resolveTowerMon);
  const isExpanded = dbExpandedTower === f.floor;
  const monTags = mons.map(m => `<span class="mtype-${m.type || 'normal'}" style="margin-right:6px">${m.name}</span>`).join("");
  const totalHp = mons.reduce((s, m) => s + (m.hp || 0), 0);
  const maxLv = mons.length ? Math.max.apply(null, mons.map(m => m.level || 0)) : 0;
  const topType = mons.reduce((a, m) => (TOWER_MON_RANK[m.type] > TOWER_MON_RANK[a] ? m.type : a), "normal");
  const topText = { normal: "普通", elite: "精英", boss: "Boss" }[topType] || topType;
  // 掉落预览：合并该层所有怪的专属掉落物品名（去重）
  const dropItems = [];
  mons.forEach(m => {
    const d = DROPS[m.name];
    if (d) d.forEach(x => { if (x.item !== "金币" && !dropItems.includes(x.item)) dropItems.push(x.item); });
  });
  const dropPreview = dropItems.slice(0, 4).map(it => `<span style="font-size:11px;color:#90caf9;margin-right:4px">${it}</span>`).join("")
    + (dropItems.length > 4 ? `<span style="font-size:11px;color:#666">等${dropItems.length}</span>` : "")
    || '<span style="font-size:11px;color:#666">通用掉落</span>';

  const row = `<tr onclick="toggleTower(${f.floor})">
    <td><b>第${f.floor}层</b></td>
    <td class="num">${f.cost.toLocaleString()}</td>
    <td>${monTags}</td>
    <td class="num">${totalHp.toLocaleString()}</td>
    <td class="num">${maxLv}</td>
    <td class="mtype-${topType}">${topText}</td>
    <td>${dropPreview}</td>
  </tr>`;
  const detail = isExpanded ? `<tr class="db-detail-row"><td colspan="7">${renderTowerDetail(f, mons)}</td></tr>` : "";
  return row + detail;
}

function renderTowerDetail(f, mons) {
  const cards = mons.map(m => {
    const typeText = { normal: "普通", elite: "精英", boss: "Boss" }[m.type] || m.type || "普通";
    const srcTag = m.source === "ref"
      ? '<span style="font-size:11px;color:#66bb6a">引用已有</span>'
      : '<span style="font-size:11px;color:#ce93d8">通天塔专属</span>';
    const skillsHtml = (m.skills && m.skills.length)
      ? m.skills.map(s => `<div class="stat-item"><span class="lbl">${s.name}[${s.type}]</span> <span class="val">${(s.chance*100).toFixed(0)}%${s.power ? ` ×${s.power}` : ""}</span></div>`).join("")
      : '<div style="color:#666">无技能</div>';
    let drops = DROPS[m.name];
    if (!drops) {
      const tier = (m.level || 0) <= 20 ? "low" : ((m.level || 0) <= 40 ? "mid" : "high");
      drops = GENERIC_DROPS[tier];
    }
    const dropsHtml = (Array.isArray(drops) ? drops : []).filter(d => d.item !== "金币").slice(0, 16).map(d => {
      const it = ITEMS[d.item];
      const tag = it ? `<span class="type-tag ${it.type}">${TYPE_NAMES[it.type] || it.type}</span>` : "";
      return `<div class="stat-item">${tag} <span class="val">${d.item}</span> <span class="lbl">1/${d.chance}</span></div>`;
    }).join("") || '<div style="color:#666">无掉落</div>';

    return `<div class="db-detail-section">
      <h4><span class="mtype-${m.type || 'normal'}">${m.name}</span> <span style="font-size:12px;color:#888">${typeText}</span> ${srcTag}</h4>
      <div class="stat-grid">
        <div class="stat-item"><span class="lbl">等级</span> <span class="val">${m.level || 0}</span></div>
        <div class="stat-item"><span class="lbl">HP</span> <span class="val">${(m.hp || 0).toLocaleString()}</span></div>
        <div class="stat-item"><span class="lbl">攻击</span> <span class="val">${m.minAtk || 0}-${m.maxAtk || 0}</span></div>
        <div class="stat-item"><span class="lbl">物防</span> <span class="val">${m.minDef || 0}</span></div>
        <div class="stat-item"><span class="lbl">魔防</span> <span class="val">${m.minMagDef || 0}</span></div>
        <div class="stat-item"><span class="lbl">经验</span> <span class="val">${(m.exp || 0).toLocaleString()}</span></div>
      </div>
      <div class="db-detail-section"><h4>⚔️ 技能</h4><div class="stat-grid">${skillsHtml}</div></div>
      <div class="db-detail-section"><h4>📦 掉落（前16，塔内爆率×2）</h4><div class="stat-grid">${dropsHtml}</div></div>
    </div>`;
  }).join("");

  return `<div class="db-detail-content">
    <div style="background:#0f1726;padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:12px;color:#b0bec5">
      🎫 门票 <b style="color:#ffd700">${f.cost.toLocaleString()}</b> 金币 ｜ 每天每层限挑战1次 ｜ 不能越层挑战 ｜ 塔内爆率 <b style="color:#66bb6a">×2</b>${f.floor === 30 ? ' ｜ 通关+1000万金币解锁<b style="color:#ce93d8">二大陆</b>' : ''}
    </div>
    ${cards}
  </div>`;
}

function toggleTower(floor) { dbExpandedTower = dbExpandedTower === floor ? null : floor; renderTower(); }

/* ===================================================================
 * 装备技能推荐
 * 按职业×等级分档自动推荐最优装备组合 + 技能搭配
 * =================================================================== */

// 等级分档（对应技能槽位阶梯：Lv20→4槽/Lv35→5槽/Lv50→6槽）
const RECOMMEND_TIERS = [
  { lv: 7,  label: "Lv7 初学",  slots: 3 },
  { lv: 15, label: "Lv15 成长", slots: 3 },
  { lv: 25, label: "Lv25 进阶", slots: 4 },
  { lv: 35, label: "Lv35 高级", slots: 5 },
  { lv: 50, label: "Lv50 毕业", slots: 6 },
];
// 各职业主属性字段（战士堆物攻DC/法师堆魔法MC/道士堆道术SC）
const JOB_MAIN_STAT = { warrior: "atk", mage: "mc", taoist: "sc" };
const JOB_NAMES_FULL = { warrior: "战士", mage: "法师", taoist: "道士" };
// 装备槽位定义（顺序即展示顺序；bracelet/ring 各占2槽）
const EQUIP_SLOTS = [
  { type: "weapon",   label: "武器", count: 1 },
  { type: "armor",    label: "衣服", count: 1 },
  { type: "helmet",   label: "头盔", count: 1 },
  { type: "necklace", label: "项链", count: 1 },
  { type: "bracelet", label: "手镯", count: 2 },
  { type: "ring",     label: "戒指", count: 2 },
  { type: "boots",    label: "鞋子", count: 1 },
  { type: "belt",     label: "腰带", count: 1 },
  { type: "jade",     label: "宝玉", count: 1 },
];

let recommendJob = "warrior";

function setRecommendJob(job, btn) {
  recommendJob = job;
  document.querySelectorAll(".recommend-job-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderRecommend();
}

// 装备推荐：对每个槽位选出该职业该等级能穿、且能实际获取的主属性最高的装备
// 可获取性：装备掉落怪的最低等级不超过 tierLv+ACQ_MARGIN（避免推荐打不了的装备）
const ACQ_MARGIN = 10; // 允许稍微越级打怪获取
function recommendEquip(job, tierLv) {
  const mainStat = JOB_MAIN_STAT[job];
  const baseStats = getJobBaseStats(job, tierLv);
  // 力量戒指门槛：该等级基础物攻上限
  const baseAtkMax = baseStats.maxAtk;
  const idx = buildReverseIndex();
  // 查装备的最低掉落怪等级：专属掉落取 monLevel；通用掉落按档位估算(low=1,mid=11,high=21)
  // 返回 null 表示无掉落数据（商店/任务，不拦）
  function minDropLv(name) {
    const sources = (idx.itemToSources && idx.itemToSources[name]) || [];
    const lvls = sources.map(s => {
      if (s.generic) {
        // 通用掉落档位 → 最低怪等级：Lvl≤20→1, Lvl 21-40→11, Lvl>40→21
        if (!s.tier) return null;
        if (s.tier.includes("≤20")) return 1;
        if (s.tier.includes("21-40")) return 11;
        if (s.tier.includes(">40")) return 21;
        return null;
      }
      return s.monLevel;
    }).filter(x => x != null);
    return lvls.length ? Math.min(...lvls) : null;
  }
  const results = [];
  for (const slot of EQUIP_SLOTS) {
    // 筛选该槽位可用装备
    const candidates = Object.entries(ITEMS).filter(([name, it]) => {
      if (it.type !== slot.type) return false;
      if (it.job && it.job !== job && it.job !== "all") return false;
      if (it.level && it.level > tierLv) return false;
      if (it.needAtk && baseAtkMax < it.needAtk) return false;
      if (["skillbook", "potion", "material", "buff"].includes(it.type)) return false;
      // 可获取性：掉落怪等级不超过 tierLv+ACQ_MARGIN（无掉落数据的不拦，可能是商店购买）
      const mdl = minDropLv(name);
      if (mdl != null && mdl > tierLv + ACQ_MARGIN) return false;
      return true;
    });
    // 排序：输出类槽位(武器/戒指/项链)按主属性上限；防具类(衣服/头盔/手镯/鞋子/腰带/宝玉)按物防优先
    // 注：承伤公式(app.js calcMap 第288行)只用 minDef/maxDef 物防，magDef 不参与减伤 → 防具优先堆物防
    const isDefSlot = ["armor", "helmet", "bracelet", "boots", "belt", "jade"].includes(slot.type);
    const sorted = candidates.sort((a, b) => {
      if (isDefSlot) {
        // 物防上限优先；物防相同再比魔防（聊胜于无）
        const da = a[1].def ? a[1].def[1] : 0, db_ = b[1].def ? b[1].def[1] : 0;
        if (db_ !== da) return db_ - da;
        const ma = a[1].magDef ? a[1].magDef[1] : 0, mb = b[1].magDef ? b[1].magDef[1] : 0;
        return mb - ma;
      }
      const va = (a[1][mainStat] ? a[1][mainStat][1] : -1);
      const vb = (b[1][mainStat] ? b[1][mainStat][1] : -1);
      return vb - va;
    });
    // 取 count 个推荐（手镯/戒指取2个）+ 备选列表（top 5，去重已推荐的）
    const ALT_MAX = 5; // 每个槽位最多展示5个备选
    const picks = [];
    // 手镯双槽特殊处理：1个攻击型(主属性最高) + 1个物防型(物防最高)，物防/魔防互补不重复
    // 理由：手镯是少数能加主属性的防具槽，攻击型价值高；承伤只算物防，防御位选物防最实用
    if (slot.type === "bracelet" && slot.count === 2) {
      // 攻击型：按主属性上限排序
      const byAtk = [...candidates].sort((a, b) => {
        const va = a[1][mainStat] ? a[1][mainStat][1] : -1;
        const vb = b[1][mainStat] ? b[1][mainStat][1] : -1;
        return vb - va;
      });
      // 物防型：按物防上限排序（跳过已选的攻击型同名件）
      const byDef = [...candidates].sort((a, b) => {
        const da = a[1].def ? a[1].def[1] : 0, db_ = b[1].def ? b[1].def[1] : 0;
        return db_ - da;
      });
      const mkPick = (entry) => {
        const [name, it] = entry;
        const mdl = minDropLv(name);
        return { name, item: it, mainVal: it[mainStat] ? it[mainStat][1] : 0,
          special: it.special || null, equipLv: it.level || 0,
          dropLv: mdl != null ? mdl : (it.level || tierLv), dup: false };
      };
      // 是否存在真正的攻击型手镯（主属性上限≥1）？没有则双槽都按物防选
      const hasAtkBracelet = byAtk.length > 0 && (byAtk[0][1][mainStat] ? byAtk[0][1][mainStat][1] : 0) >= 1;
      if (hasAtkBracelet) {
        const atkPick = mkPick(byAtk[0]);
        picks.push(atkPick);
        // 第二个：物防型，优先选与攻击型不同的装备；若候选不足则回落同名×2
        const defCandidate = byDef.find(([n]) => n !== atkPick.name);
        if (defCandidate) {
          picks.push(mkPick(defCandidate));
        } else if (byDef.length > 0) {
          picks.push(mkPick(byDef[0]));
        } else {
          picks.push(atkPick); // 回落：同名×2
        }
      } else if (byDef.length > 0) {
        // 无攻击型手镯：双槽都选物防最高的（取 top1 + top2，允许同名×2）
        picks.push(mkPick(byDef[0]));
        const second = byDef.find(([n]) => n !== byDef[0][0]);
        picks.push(second ? mkPick(second) : mkPick(byDef[0]));
      }
    } else if (sorted.length > 0) {
      // 其他双槽(戒指)：游戏允许同名×2，取 top1 重复 count 次（属性最优）
      const [name, it] = sorted[0];
      const mainVal = it[mainStat] ? it[mainStat][1] : 0;
      const mdl = minDropLv(name);
      const pick = { name, item: it, mainVal, special: it.special || null,
        equipLv: it.level || 0,
        dropLv: mdl != null ? mdl : (it.level || tierLv), dup: slot.count > 1 };
      for (let i = 0; i < slot.count; i++) picks.push(pick);
    }
    // 备选：排序结果中不在 picks 的，取 top ALT_MAX 个
    const pickNames = new Set(picks.map(p => p.name));
    const alts = [];
    for (const [name, it] of sorted) {
      if (pickNames.has(name)) continue;
      const mainVal = it[mainStat] ? it[mainStat][1] : 0;
      const mdl = minDropLv(name);
      alts.push({ name, item: it, mainVal, special: it.special || null,
        equipLv: it.level || 0,
        dropLv: mdl != null ? mdl : (it.level || tierLv) });
      if (alts.length >= ALT_MAX) break;
    }
    results.push({ slot, picks, alts });
  }
  return results;
}

// 技能推荐：选出该等级能学且最强的 N 个技能
// 核心机制（复刻 game.js/app.js）：
// - AOE 技能 damageBonus 累加，法师全额溅射每只怪、0蓝耗 → 法师优先堆 AOE
// - 单体 attack 技能每个耗 2MP/回合，只打主目标
// - buff 减伤累加（上限85%）：法师魔法盾0.30+分身0.40=0.70，脆皮法师必上双减伤
function recommendSkills(job, tierLv, slots, stats) {
  const available = Object.entries(SKILLS).filter(([n, s]) => s.job === job && s.levelReq <= tierLv);
  // 分类并按 damageBonus 降序
  const aoeAttacks = available.filter(([n, s]) => s.type === "attack" && s.aoe).sort((a, b) => b[1].damageBonus - a[1].damageBonus);
  const singleAttacks = available.filter(([n, s]) => s.type === "attack" && !s.aoe).sort((a, b) => b[1].damageBonus - a[1].damageBonus);
  const buffs = available.filter(([n, s]) => s.type === "buff").sort((a, b) => b[1].damageBonus - a[1].damageBonus);
  const summons = available.filter(([n, s]) => s.type === "summon").sort((a, b) => b[1].damageBonus - a[1].damageBonus);
  const heals = available.filter(([n, s]) => s.type === "heal").sort((a, b) => b[1].damageBonus - a[1].damageBonus);
  const passives = available.filter(([n, s]) => s.type === "passive").sort((a, b) => b[1].damageBonus - a[1].damageBonus);

  const picked = [];
  const pickedNames = new Set();
  const push = (entry, reason) => {
    if (!entry || pickedNames.has(entry[0])) return false;
    pickedNames.add(entry[0]);
    picked.push({ name: entry[0], skill: entry[1], reason });
    return true;
  };
  const full = () => picked.length >= slots;

  if (job === "mage") {
    // 法师脆皮(HP低)，减伤buff优先占槽：魔法盾0.30+分身术0.40叠加=70%减伤，几乎必带
    // 先上所有可用 buff（最多2个），再用 AOE(0蓝耗打全场)填满，单体(耗蓝仅打主目标)最后
    for (const e of buffs) { if (full()) break; push(e, "减伤" + Math.round(e[1].damageBonus * 100) + "%"); }
    for (const e of aoeAttacks) { if (full()) break; push(e, "AOE输出"); }
    for (const e of singleAttacks) { if (full()) break; push(e, "单体输出"); }
  } else if (job === "taoist") {
    // 道士：召唤技能全带(每个1只宝宝,共存且全部群攻全场) → 隐身术(配合召唤近乎无敌)
    // 阴阳盾阈值：SC≥20时宝宝总HP≥980,每回合净承伤~98,撑10+回合(清波仅2-4回合)
    //   隐身100%覆盖→怪物全打宝宝→玩家不挨打→阴阳盾(玩家减伤)无用,省下槽位装输出
    //   SC<20时宝宝脆易死→隐身漏→玩家挨打→需要阴阳盾保命
    const scVal = stats ? stats.maxSc : 0;
    const petStrongEnough = scVal >= 20;
    for (const e of summons) { if (full()) break; push(e, "召唤群攻"); }
    // 隐身术：delay=6触发6回合隐身=100%覆盖率，怪物强制打宝宝（需有召唤物），近乎无敌
    const stealth = available.find(e => e[0] === "隐身术" || e[0] === "集体隐身术");
    if (stealth && summons.length > 0 && !full()) push(stealth, "隐身无敌");
    // 阴阳盾：仅在宝宝不够硬(SC<20)时带；SC≥20隐身全覆盖,省槽装输出
    if (!petStrongEnough) {
      const defBuff = buffs.find(e => e[1].damageBonus > 0);
      if (defBuff && !full()) push(defBuff, "减伤" + Math.round(defBuff[1].damageBonus * 100) + "%");
    }
    // 施毒术（道士核心 DOT，独立通道）
    const poison = singleAttacks.find(e => e[0] === "施毒术");
    if (poison && !full()) push(poison, "持续毒伤");
    // AOE DOT（瘟疫/毒云）
    for (const e of aoeAttacks) { if (full()) break; push(e, "AOE输出"); }
    if (singleAttacks.length > 0 && !full()) {
      const main = singleAttacks.find(e => e[0] !== "施毒术") || singleAttacks[0];
      push(main, "单体输出");
    }
    if (passives.length > 0 && !full()) push(passives[0], "被动加成");
    if (heals.length > 0 && !full()) push(heals[0], "回血");
  } else {
    // 战士：无隐身无召唤，怪物直接打玩家 → 减伤buff(护身气幕)必带(直接省红药,净金+1084/分)
    //   AOE优先(半月弯刀/剑气爆) → 护身气幕减伤 → 单体最多2个(MP少) → 被动
    // 数据验证(Lv50石墓阵): 2AOE+3单体+护身气幕 净金7379 > 2AOE+4单体无减伤 净金6295
    for (const e of aoeAttacks) { if (full()) break; push(e, "AOE输出"); }
    // 护身气幕必带（Lv39+解锁；战士无隐身，减伤直接降低红药成本）
    const defBuff = buffs.find(e => e[1].damageBonus > 0);
    if (defBuff && !full()) push(defBuff, "减伤" + Math.round(defBuff[1].damageBonus * 100) + "%");
    // 单体输出：战士 MP 少（Lv50 仅 243），最多带 2 个单体（4MP/回合，可撑 60 回合）
    for (let i = 0; i < 2 && i < singleAttacks.length; i++) { if (full()) break; push(singleAttacks[i], "单体输出"); }
    if (passives.length > 0 && !full()) push(passives[0], "被动加成");
    // 剩余空槽补第3个单体或被动
    for (const e of singleAttacks.slice(2)) { if (full()) break; push(e, "单体输出"); }
  }

  return picked.slice(0, slots);
}

// 装备属性摘要文本（用于展示）
function equipStatSummary(it, job) {
  const mainStat = JOB_MAIN_STAT[job];
  const parts = [];
  if (it[mainStat]) parts.push(fmtRange(it[mainStat]));
  if (it.def) parts.push("防" + fmtRange(it.def));
  if (it.magDef) parts.push("魔防" + fmtRange(it.magDef));
  if (it.hp) parts.push("HP+" + it.hp);
  if (it.special) parts.push("【" + it.special + "】");
  return parts.join(" ");
}

function renderRecommend() {
  const job = recommendJob;
  const hint = document.getElementById("recommend-hint");
  const mainStatName = { warrior: "物攻(DC)", mage: "魔法(MC)", taoist: "道术(SC)" }[job];
  let hintExtra = "";
  if (job === "taoist") {
    hintExtra = " · 阴阳盾阈值：SC≥20时宝宝够硬(总HP≥980撑10+回合)，隐身100%覆盖怪物全打宝宝，不带阴阳盾省槽装输出；SC<20宝宝脆易死需阴阳盾保命";
  } else if (job === "mage") {
    hintExtra = " · 减伤buff优先(魔法盾+分身术叠加70%减伤) · AOE不耗蓝打全场，单体耗蓝只打主目标故不推荐";
  } else if (job === "warrior") {
    hintExtra = " · 无隐身/召唤，怪物直接打玩家 → 护身气幕必带(40%减伤直接省红药，净金+1084/分) · 单体最多2个(MP少)";
  }
  hint.textContent = `${JOB_NAMES_FULL[job]} 推荐配装 · 主属性：${mainStatName}` + hintExtra;

  const body = document.getElementById("recommend-body");
  body.innerHTML = RECOMMEND_TIERS.map(tier => {
    const equips = recommendEquip(job, tier.lv);
    // 用推荐装备组装 player 算实际面板属性（道士需 SC 判断阴阳盾阈值）
    const equipObj = {};
    for (const { slot, picks } of equips) {
      if (picks[0]) equipObj[slot.type] = { name: picks[0].name };
    }
    const tierStats = getStats({ job, level: tier.lv, equipment: equipObj });
    const skills = recommendSkills(job, tier.lv, tier.slots, tierStats);

    // 装备列表：推荐(高亮) + 备选(top5)
    const equipHtml = equips.map(({ slot, picks, alts }) => {
      if (picks.length === 0) {
        return `<div class="rec-equip-row"><span class="rec-slot">${slot.label}</span><span class="rec-empty">无可用装备</span></div>`;
      }
      const fmtItem = (p, isPick) => {
        const tip = itemTooltip(p.name);
        const specialTag = p.special ? `<span class="rec-special">${p.special}</span>` : "";
        const lvTag = `<span class="rec-drop">穿${p.equipLv||1}·掉${p.dropLv}</span>`;
        const cls = isPick ? "rec-item rec-pick" : "rec-item rec-alt";
        return `<span class="${cls}" title="${tip}"><b>${p.name}</b> <span class="rec-stat">${equipStatSummary(p.item, job)}</span>${specialTag}${lvTag}</span>`;
      };
      // 同名×2：双槽推荐同一件装备时显示"×2(需两件)"，避免重复渲染
      let pickHtml;
      if (slot.count > 1 && picks.length === 2 && picks[0].name === picks[1].name) {
        const p = picks[0];
        const tip = itemTooltip(p.name);
        const specialTag = p.special ? `<span class="rec-special">${p.special}</span>` : "";
        const lvTag = `<span class="rec-drop">穿${p.equipLv||1}·掉${p.dropLv}</span>`;
        pickHtml = `<span class="rec-item rec-pick" title="${tip}"><b>${p.name} ×2</b> <span class="rec-stat">${equipStatSummary(p.item, job)}</span>${specialTag}${lvTag}<span class="rec-need2">需两件</span></span>`;
      } else {
        pickHtml = picks.map(p => fmtItem(p, true)).join(slot.count > 1 ? " + " : "");
      }
      const altHtml = alts.length > 0
        ? `<div class="rec-alts">${alts.map(p => fmtItem(p, false)).join("")}</div>`
        : "";
      return `<div class="rec-equip-row"><span class="rec-slot">${slot.label}${slot.count>1?" ×"+slot.count:""}</span><div class="rec-items">${pickHtml}${altHtml}</div></div>`;
    }).join("");

    // 技能列表
    const skillsHtml = skills.length ? skills.map(s => {
      const bonus = `+${(s.skill.damageBonus*100).toFixed(0)}%`;
      const aoeTag = s.skill.aoe ? " <span class='rec-aoe'>AOE</span>" : "";
      return `<span class="rec-skill" title="${s.skill.desc||""}"><b>${s.name}</b>${aoeTag} <span class="rec-skill-bonus">${bonus}</span> <span class="rec-reason">${s.reason}</span></span>`;
    }).join("") : '<span class="rec-empty">该等级无可学技能</span>';

    return `<div class="rec-tier-card">
      <div class="rec-tier-header">
        <b>${tier.label}</b>
        <span class="rec-slots">技能槽 ×${tier.slots}</span>
      </div>
      <div class="rec-section"><div class="rec-section-title">⚔️ 装备推荐</div>${equipHtml}</div>
      <div class="rec-section"><div class="rec-section-title">✨ 技能推荐（${skills.length}/${tier.slots}）</div><div class="rec-skills">${skillsHtml}</div></div>
    </div>`;
  }).join("");
}


