// 游戏核心引擎
// 技能日志图标（常驻/触发技能发动时显示在战斗日志）
const SKILL_ICONS = {
  '火球术': '🔥', '大火球': '🔥', '地狱火': '🔥', '雷电术': '⚡', '疾光电影': '✨',
  '火墙': '🔥', '爆裂火焰': '💥', '地狱雷光': '⚡', '冰咆哮': '❄️', '寒冰掌': '❄️',
  '灭天火': '🔥', '流星火雨': '☄️', '圣言术': '☀️', '嗜血术': '🩸', '火龙气焰': '🐲',
  '天霜冰环': '❄️', '冰焰术': '❄️',
  '灵魂火符': '🔥', '气功波': '💨', '诅咒术': '💀', '施毒术': '☠️', '瘟疫': '☠️', '毒云': '☠️',
  '攻杀剑术': '⚔️', '刺杀剑术': '⚔️', '半月弯刀': '🌙', '烈火剑法': '🔥', '雷霆剑法': '⚡',
  '双龙斩': '⚔️', '龙影剑法': '🐉', '擒龙手': '🐉', '逐日剑法': '🌅', '剑气爆': '💥', '天务': '⚔️',
  '狮子吼': '📢', '抗拒火环': '🔥', '困魔咒': '⛓️',
};

class Game {
  constructor() {
    this.player = null;
    this.currentMap = null;
    this.currentMonsters = []; // 当前波次所有怪物
    this.targetIdx = 0; // 玩家攻击目标索引
    this.isIdle = false;
    this.idleTimer = null;
    this.autoPot = true;
    this.autoHpThreshold = 0.7; // HP低于此比例自动喝红药（自由设置，默认70%）
    this.autoMpThreshold = 0.3; // MP低于此比例自动喝蓝药
    this.hpPotion = 'auto'; // 自动红药选择：'auto'=AI按缺口自动选药，或指定药品名
    this.mpPotion = 'auto'; // 自动蓝药选择
    this.sellThreshold = 0; // 0=关闭, 1-7=低于此加成的装备自动出售
    this.dropFilter = []; // 装备图鉴掉落黑名单：勾选的装备不再掉落
    this.invTab = 'all'; // 背包分类选项卡: all/equip/potion/skill/item
    this.combatLog = [];
    this.dropLog = [];
    this.killCount = 0;
    this.totalGold = 0;
    this.listeners = [];
    // 怪物技能状态
    this.playerPoison = 0; // 中毒剩余回合
    this.playerPoisonDmg = 0; // 每回合毒伤
    this.playerStunned = false; // 麻痹/冰冻（跳过下一回合）
    this.summonedMinions = []; // 怪物召唤的小怪
    // 玩家技能状态
    this.playerMinions = []; // 玩家召唤的宝宝列表（每个召唤技能1只）
        this.stealthTurns = 0; // 隐身术剩余回合数（仇恨转移）
        this.charmedMinion = null; // 诱惑之光魅惑的怪物
        this.memoryMinion = null; // 记忆戒指的记忆幻影（turns字段记录剩余回合）
    // 特殊戒指状态
    this.revivalUsed = false; // 复活戒指是否已触发
    this.bossPity = 0; // 传送戒指：距上次BOSS后累计击杀的小怪数（每30只必出BOSS）
    // 通天塔状态
    this.inTower = false;
    this.towerFloor = 0;
    this.towerMonIdx = 0;
    this.towerCleared = {}; // { '2026-08-01': [1,2,3] } 当天已通关层数
    this.showTowerPanel = false;
    this.skillCooldowns = {}; // { '技能名': 剩余冷却回合数 }
    // 联网功能状态
    this.showRankPanel = false;
    this.rankTab = 'level';
    this.rankData = [];
    this.showMarketPanel = false;
    this.showBlacksmithPanel = false; // 铁匠铺（词条强化+幸运强化）
    this.marketTab = 'browse';
    this.marketData = { items: [], total: 0, page: 1 };
    this.myListings = [];
    this.towerMax = 0; // 历史最高通天塔层数
    this.continent2Unlocked = false; // 二大陆是否已解锁（通天塔30层通关 + 缴纳1000万金币后永久解锁）
    // 世界BOSS（遮天塔）状态：血量为服务端权威，本地演算战斗并定期上报伤害
    this.inWorldBoss = false;
    this.worldBossInfo = null; // 最近一次服务端BOSS状态（面板展示用）
    this.showWorldBossPanel = false;
    this._wbPendingDmg = 0; // 待上报累计伤害
    this._wbTurns = 0; // 战斗回合计数（每3回合上报一次）
    // 波次系统
    this.waveSize = 10; // 每波怪物数量（固定10只，配合双列网格展示）
    this.waveKills = 0; // 当前波已击杀数
    this.waveNum = 1; // 当前波次编号
    this._lastSyncTime = 0;
    this._saveVersion = 0; // 服务端存档版本号
    this.nextItemUid = 1; // 物品唯一标识计数器（寄售按uid精确识别）
    // 本次挂机会话统计（与技能伤害明细同一生命周期：开始挂机时重置，停止仅冻结）
    // 速率类指标全部由会话累计 ÷ 战斗时长得出，不再用滑动窗口
    this._session = { kills: 0, bossKills: 0, deaths: 0, exp: 0, gold: 0, dmgPhys: 0, dmgMag: 0, battleMs: 0, activeSince: 0 };
    this._skillStats = {}; // 技能伤害明细 { 名称: { dmg, count } }，停止挂机重置
    this._dropStats = {}; // 掉落物品统计 { 来源: { level, boss, items: {物品:数量} } }，开始挂机重置
  }

  // 技能伤害归因打点（实际造成的伤害才计入）
  _logSkillDmg(name, dmg) {
    if (!name || !dmg || dmg <= 0) return;
    if (!this._skillStats) this._skillStats = {};
    const e = this._skillStats[name] || (this._skillStats[name] = { dmg: 0, count: 0 });
    e.dmg += Math.floor(dmg);
    e.count++;
  }

  // 技能伤害明细（按总伤害降序，含平均伤害）
  getSkillStats() {
    if (!this._skillStats) return [];
    return Object.entries(this._skillStats)
      .map(([name, e]) => ({ name, dmg: e.dmg, count: e.count, avg: Math.round(e.dmg / e.count) }))
      .sort((a, b) => b.dmg - a.dmg);
  }

  // 记录一次统计事件（exp/gold/kills/dmgPhys/dmgMag）：累加到会话总量，与伤害明细同源
  _logStat(key, amount) {
    if (!this._session || !amount) return;
    if (this._session[key] === undefined) this._session[key] = 0;
    this._session[key] += amount;
  }

  // 每分钟速率统计：会话累计 ÷ 战斗时长（与技能伤害明细同一数据源/生命周期）
  getRateStats() {
    const s = this._session || {};
    const now = Date.now();
    const extraMs = s.activeSince > 0 ? now - s.activeSince : 0;
    const battleSec = Math.max(0, ((s.battleMs || 0) + extraMs) / 1000);
    const denomSec = Math.max(battleSec, 1); // 至少按1秒计，避免刚起步数值爆炸
    const perMin = v => (v || 0) / denomSec * 60;
    return {
      kills: perMin(s.kills),
      exp: perMin(s.exp),
      gold: perMin(s.gold),
      dmgPhys: perMin(s.dmgPhys),
      dmgMag: perMin(s.dmgMag),
      predicted: battleSec < 60, // 不足1分钟时仅作均值参考
      sessionKills: s.kills || 0,
      sessionBossKills: s.bossKills || 0,
      sessionDeaths: s.deaths || 0,
      battleSec
    };
  }

  init(job, name) {
    this.player = this.createPlayer(job, name);
    this.currentMap = MAPS[0];
    this.save();
    this.notify();
  }

  createPlayer(job, name) {
    // 基于mirror-master职业成长表(job_1/2/3.txt)
    const s = getJobBaseStats(job, 1);
    const armorName = '布衣';
    return {
      name: name || (job === 'warrior' ? '战士' : job === 'mage' ? '法师' : '道士'),
      job, level: 1, exp: 0,
      maxHp: s.hp, hp: s.hp, maxMp: s.mp, mp: s.mp,
      gold: 0,
      equipment: { weapon: '木剑', armor: armorName, helmet: null, necklace: null, bracelet1: null, bracelet2: null, ring1: null, ring2: null, boots: null, belt: null, jade: null },
      inventory: [{ uid: this.nextItemUid++, name: '金创药(小量)', count: 50 }],
      warehouse: [],
      learnedSkills: [],
      equippedSkills: [],
    };
  }

  getStats() {
    const p = this.player;
    const base = getJobBaseStats(p.job, p.level);
    let stats = {
      minAtk: base.minAtk,
      maxAtk: base.maxAtk,
      minDef: base.minDef,
      maxDef: base.maxDef,
      minMagDef: base.minMagDef,
      maxMagDef: base.maxMagDef,
      // MC(魔法)和SC(道术)独立追踪
      minMc: base.minMagAtk,
      maxMc: base.maxMagAtk,
      minSc: base.minMagAtk,
      maxSc: base.maxMagAtk,
      maxHp: base.hp,
      maxMp: base.mp,
    };
    // 装备加成
    for (const slotData of Object.values(p.equipment)) {
      if (!slotData) continue;
      const slotName = typeof slotData === 'string' ? slotData : slotData.name;
      const item = ITEMS[slotName];
      if (!item) continue;
      // DC(物攻)：所有职业普攻受益
      if (item.atk) { stats.minAtk += item.atk[0]; stats.maxAtk += item.atk[1]; }
      // MC(魔法)：法师技能伤害来源
      if (item.mc) { stats.minMc += item.mc[0]; stats.maxMc += item.mc[1]; }
      // SC(道术)：道士技能伤害来源
      if (item.sc) { stats.minSc += item.sc[0]; stats.maxSc += item.sc[1]; }
      if (item.def) { stats.minDef += item.def[0]; stats.maxDef += item.def[1]; }
      if (item.magDef) { stats.minMagDef += item.magDef[0]; stats.maxMagDef += item.magDef[1]; }
      if (item.hp) stats.maxHp += item.hp;
      // 随机加成
      const bonus = typeof slotData === 'object' ? slotData.bonus : null;
      if (bonus) {
        if (bonus.atk) { stats.minAtk += bonus.atk; stats.maxAtk += bonus.atk; }
        if (bonus.mc) { stats.minMc += bonus.mc; stats.maxMc += bonus.mc; }
        if (bonus.sc) { stats.minSc += bonus.sc; stats.maxSc += bonus.sc; }
        if (bonus.def) { stats.minDef += bonus.def; stats.maxDef += bonus.def; }
        if (bonus.magDef) { stats.minMagDef += bonus.magDef; stats.maxMagDef += bonus.magDef; }
        if (bonus.hp) stats.maxHp += bonus.hp;
      }
    }
    // 武器幸运/诅咒：幸运抬升攻击下限，诅咒压低攻击上限（±7满值，物攻/魔法/道术全生效）
    const wpn = p.equipment.weapon;
    const luck = wpn && typeof wpn === 'object' ? (wpn.luck || 0) : 0;
    if (luck !== 0) {
      const applyLuck = (minKey, maxKey) => {
        if (stats[maxKey] <= stats[minKey]) return;
        const span = stats[maxKey] - stats[minKey];
        if (luck > 0) stats[minKey] += Math.floor(span * Math.min(luck, 7) / 7);
        else stats[maxKey] -= Math.floor(span * Math.min(-luck, 7) / 7);
        if (stats[minKey] > stats[maxKey]) stats[minKey] = stats[maxKey];
      };
      applyLuck('minAtk', 'maxAtk');
      applyLuck('minMc', 'maxMc');
      applyLuck('minSc', 'maxSc');
    }
    return stats;
  }

  // 武器幸运展示标签
  static luckLabel(luck) {
    if (luck > 0) return `幸+${luck}`;
    if (luck < 0) return `咒${-luck}`;
    return '';
  }

  // 幸运强化成功率（当前幸运→+1），幸运≤0时必成（先洗掉诅咒）
  getBlessChance(luck) {
    const table = { 0: 1.0, 1: 0.9, 2: 0.8, 3: 0.65, 4: 0.5, 5: 0.35, 6: 0.25 };
    if (luck < 0) return 1.0;
    return table[luck] !== undefined ? table[luck] : 0;
  }

  // 获取已装备的特殊戒指效果列表
  getSpecialRings() {
    const specials = [];
    for (const slotData of Object.values(this.player.equipment)) {
      if (!slotData) continue;
      const slotName = typeof slotData === 'string' ? slotData : slotData.name;
      const item = ITEMS[slotName];
      if (item && item.special) specials.push(item.special);
    }
    return specials;
  }

  // 已装备吸血特效的来源名与吸血比例（嗜血战斧20% 优先于虹魔戒指15%）
  getLeechSource() {
    const wpn = this.player.equipment.weapon;
    const wpnName = wpn ? (typeof wpn === 'string' ? wpn : wpn.name) : null;
    if (wpnName && ITEMS[wpnName] && ITEMS[wpnName].special === '吸血') return { name: wpnName, rate: 0.2 };
    return { name: '虹魔戒指', rate: 0.15 };
  }

  getExpNeeded() { return getExpForLevel(this.player.level); }

  // 掉落统一记录（物品/经验/金币都写入右侧掉落列表；meta传入时同步聚合进掉落物品统计）
  _logDrop(itemText, from, meta) {
    this.dropLog.unshift({ item: itemText, from, time: Date.now() });
    if (this.dropLog.length > 50) this.dropLog.pop();
    // 掉落物品统计：按来源×物品名累计（经验/金币条目不计入；通天塔用meta.key按怪物名分组）
    if (meta && !itemText.startsWith('✨') && !itemText.startsWith('💰')) {
      if (!this._dropStats) this._dropStats = {};
      const key = meta.key || from;
      const g = this._dropStats[key] || (this._dropStats[key] = { level: meta.level || 0, boss: !!meta.boss, items: {} });
      const baseName = itemText.split(' [')[0]; // 去掉加成后缀，同名装备合并计数
      g.items[baseName] = (g.items[baseName] || 0) + 1;
    }
  }

  // 掉落物品统计列表：BOSS优先，其余按怪物等级降序；每组内按数量降序
  getDropStats() {
    if (!this._dropStats) return [];
    return Object.entries(this._dropStats)
      .map(([from, g]) => ({
        from, level: g.level, boss: g.boss,
        items: Object.entries(g.items).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        total: Object.values(g.items).reduce((s, c) => s + c, 0),
      }))
      .sort((a, b) => (b.boss - a.boss) || (b.level - a.level));
  }

  gainExp(amount) {
    const p = this.player;
    p.exp += amount;
    this._logStat('exp', amount);
    let leveled = false;
    while (p.exp >= this.getExpNeeded() && p.level < MAX_LEVEL) {
      p.exp -= this.getExpNeeded();
      p.level++;
      leveled = true;
      const stats = this.getStats();
      p.maxHp = stats.maxHp; p.hp = stats.maxHp;
      p.maxMp = stats.maxMp; p.mp = stats.maxMp;
      this.addLog(`🎉 升级！当前等级: ${p.level}`, 'level');
    }
    if (leveled) this.notify();
  }

  // 兼容getter：返回当前目标怪物
  get currentMonster() {
    if (this.currentMonsters.length === 0) return null;
    if (this.targetIdx < this.currentMonsters.length && this.currentMonsters[this.targetIdx].currentHp > 0) {
      return this.currentMonsters[this.targetIdx];
    }
    return this.currentMonsters.find(m => m.currentHp > 0) || null;
  }
  set currentMonster(val) {
    if (val === null) { this.currentMonsters = []; this.targetIdx = 0; }
    else { this.currentMonsters = [val]; this.targetIdx = 0; }
  }

  spawnMonster() {
    if (!this.currentMap) return;
    const map = this.currentMap;
    // 传送戒指：累计击杀30只小怪后，下一波必定传送一只当前地图的BOSS过来
    if (!this.inTower && this.bossPity >= 30 && this.getSpecialRings().includes('传送')) {
      const bossNames = map.monsters
        .map(m => m.name)
        .filter(n => MONSTERS[n] && MONSTERS[n].type === 'boss');
      if (bossNames.length > 0) {
        const chosen = bossNames[Math.floor(Math.random() * bossNames.length)];
        const template = MONSTERS[chosen];
        this.currentMonsters = [{
          name: chosen, ...template,
          currentHp: template.hp,
          maxHp: template.hp,
          maxDef: template.minDef,
          maxMagDef: template.minMagDef,
          poison: 0, poisonDmg: 0, stunned: false,
        }];
        this.targetIdx = 0;
        this.bossPity = 0;
        this.addLog(`💍 传送戒指发动！空间波动闪过，${chosen} 出现在你面前！`, 'info');
        return;
      }
    }
    const count = this.inTower ? 1 : this.waveSize;
    const monsters = [];
    for (let i = 0; i < count; i++) {
      const totalWeight = map.monsters.reduce((s, m) => s + m.count, 0);
      let roll = Math.random() * totalWeight;
      let chosen = map.monsters[0].name;
      for (const m of map.monsters) {
        roll -= m.count;
        if (roll <= 0) { chosen = m.name; break; }
      }
      const template = MONSTERS[chosen];
      if (!template) continue;
      monsters.push({
        name: chosen, ...template,
        currentHp: template.hp,
        maxHp: template.hp,
        maxDef: template.minDef,       // AC固定值作为物理防御范围
        maxMagDef: template.minMagDef, // MAC固定值作为魔法防御范围
        poison: 0, poisonDmg: 0, stunned: false,
      });
    }
    this.currentMonsters = monsters;
    this.targetIdx = 0;
  }

  playerAttack() {
    if (this.currentMonsters.length === 0 || !this.currentMonsters.some(m => m.currentHp > 0)) this.spawnMonster();
    if (this.currentMonsters.length === 0) return;
    const stats = this.getStats();
    // 获取当前目标
    let mon = this.currentMonster;
    if (!mon) return;

    // 目标怪物中毒DOT结算（施毒术/瘟疫/毒云独立通道，可同时生效）
    if (mon.poison > 0) {
      mon.currentHp -= mon.poisonDmg;
      mon.poison--;
      this._logSkillDmg('施毒术', mon.poisonDmg);
      this.addLog(`🟢 毒素侵蚀${mon.name}，受到 ${mon.poisonDmg} 点毒伤${mon.poison > 0 ? `(剩余${mon.poison}回合)` : '(毒素消散)'}`, 'attack');
      if (mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }
    }
    if (mon.plague > 0) {
      mon.currentHp -= mon.plagueDmg;
      mon.plague--;
      this._logSkillDmg('瘟疫', mon.plagueDmg);
      this.addLog(`☠️ 瘟疫侵蚀${mon.name}，受到 ${mon.plagueDmg} 点伤害${mon.plague > 0 ? `(剩余${mon.plague}回合)` : '(瘟疫消散)'}`, 'attack');
      if (mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }
    }
    if (mon.cloud > 0) {
      mon.currentHp -= mon.cloudDmg;
      mon.cloud--;
      this._logSkillDmg('毒云', mon.cloudDmg);
      this.addLog(`☁️ 毒云弥漫${mon.name}，受到 ${mon.cloudDmg} 点毒伤${mon.cloud > 0 ? `(剩余${mon.cloud}回合)` : '(毒云消散)'}`, 'attack');
      if (mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }
    }

    // 玩家中毒DOT结算（怪物施毒，归入魔法伤害统计）
    if (this.playerPoison > 0) {
      this.player.hp -= this.playerPoisonDmg;
      this._logStat('dmgMag', this.playerPoisonDmg);
      this.playerPoison--;
      this.addLog(`☠️ 毒素侵蚀，受到 ${this.playerPoisonDmg} 点毒伤${this.playerPoison > 0 ? `(剩余${this.playerPoison}回合)` : '(毒素消散)'}`, 'hurt');
      if (this.player.hp <= 0) { this.onPlayerDeath(); return; }
    }

    // 麻痹/冰冻：跳过本回合攻击，所有怪物反击
    if (this.playerStunned) {
      this.playerStunned = false;
      this.addLog(`⚡ 你处于麻痹状态，无法行动！`, 'error');
      for (const m of this.currentMonsters) {
        if (m.currentHp <= 0) continue;
        this.monsterBasicAttack(m, stats);
        if (this.player.hp <= 0) { this.onPlayerDeath(); return; }
        this.monsterSkillPhase(m, stats);
        if (this.player.hp <= 0) { this.onPlayerDeath(); return; }
      }
      this.summonedMinionAttack(mon, stats);
      if (this.player.hp <= 0) { this.onPlayerDeath(); return; }
      this.playerHealPhase(stats);
      this.autoHeal();
      this.notify();
      return;
    }

    // 玩家普攻目标
    const p = this.player;
    let dmg = this.calcDamage(stats.minAtk, stats.maxAtk, mon.minDef, mon.maxDef);
    const passiveBonus = this.getSkillDamageBonus();
    const { triggeredBonus, triggeredSkills } = this.processSkillCooldowns();
    const residentMagic = []; // 本回合生效的常驻魔法技能（delay=0单体攻击，日志展示用）
    // 无冷却常驻技能：诱惑之光(delay=0)每回合尝试魅惑（下方循环内 !charmedMinion 守卫防重复）
    if (p.equippedSkills.includes('诱惑之光') && SKILLS['诱惑之光'] && !SKILLS['诱惑之光'].delay && !triggeredSkills.includes('诱惑之光')) {
      triggeredSkills.push('诱惑之光');
    }
    
        // 隐身术触发：进入隐身状态（仇恨转移，怪物强制攻击召唤物）
        for (const sk of triggeredSkills) {
          if (sk === '隐身术' || sk === '集体隐身术') {
            this.stealthTurns = 6;
            this.addLog(`👻 ${sk} 生效！6回合内怪物强制攻击召唤物`, 'info');
          } else if (sk === '诱惑之光') {
            // 魅惑当前怪物为友军单位（继承攻击力，HP为当前50%）
            // 精英怪和BOSS无法被魅惑
            if (mon && mon.currentHp > 0 && (mon.type === 'elite' || mon.type === 'boss')) {
              this.addLog(`✨ 诱惑之光对 ${mon.name} 无效（精英/BOSS无法被魅惑）`, 'info');
            } else if (!this.charmedMinion && mon && mon.currentHp > 0) {
              const charmHp = Math.max(10, Math.floor(mon.currentHp * 0.5));
              this.charmedMinion = { name: `${mon.name}(魅惑)`, atk: Math.max(1, mon.maxAtk), hp: charmHp, maxHp: charmHp };
              this.addLog(`✨ 诱惑之光生效！${mon.name} 被魅惑，转为你作战`, 'info');
            }
          } else if (sk === '净化术' && this.playerPoison > 0) {
            this.playerPoison = 0;
            this.playerPoisonDmg = 0;
            this.addLog('💚 净化术生效，体内毒素被清除', 'heal');
          }
        }

    let skillAttrib = null; // 触发攻击技能归因列表 [{sk, bonus}]（战士物理/法道魔法共用）
    let attribDmg = 0; // 本回合已归因给技能的伤害（普攻只记剩余部分，避免双算）
    if (p.job === 'warrior') {
      // 战士：技能加成全部乘以物攻
      const baseDmg = Math.floor(dmg * (1 + passiveBonus));
      const totalBonus = passiveBonus + triggeredBonus;
      dmg = Math.floor(dmg * (1 + totalBonus));
      // 触发技能的额外伤害按各自加成占比归因
      skillAttrib = triggeredSkills
        .filter(sk => SKILLS[sk] && SKILLS[sk].type === 'attack')
        .map(sk => ({ sk, bonus: SKILLS[sk].damageBonus }));
      const attrSum = skillAttrib.reduce((s, a) => s + a.bonus, 0);
      const extraDmg = dmg - baseDmg;
      if (attrSum > 0 && extraDmg > 0) {
        attribDmg = extraDmg;
        for (const a of skillAttrib) this._logSkillDmg(a.sk, extraDmg * a.bonus / attrSum);
      }
    } else {
      // 法师/道士：攻击类/召唤类常驻技能已有独立伤害通道（魔法段/溅射/宝宝），
      // 不再重复乘到普攻上，避免普攻段占比虚高；普攻只吃真正的被动加成
      // （passive类如精神力战法归入魔法段，不在此列）
      let normalPassiveBonus = 0;
      for (const sk of p.equippedSkills) {
        const sd = SKILLS[sk];
        if (sd && (!sd.delay || sd.delay === 0) && sd.type !== 'buff' && sd.type !== 'attack' && sd.type !== 'summon' && sd.type !== 'passive') {
          normalPassiveBonus += sd.damageBonus;
        }
      }
      dmg = Math.floor(dmg * (1 + normalPassiveBonus));
      
      // 计算魔法伤害：触发技能 + 无冷却单体攻击技能
      let magicBonus = triggeredBonus;
      skillAttrib = triggeredSkills
        .filter(sk => SKILLS[sk] && SKILLS[sk].type === 'attack')
        .map(sk => ({ sk, bonus: SKILLS[sk].damageBonus }));
      // 无冷却单体攻击技能（如雷电术/灵魂火符）每回合都触发魔法伤害，每个消耗2MP
      for (const sk of p.equippedSkills) {
        const sd = SKILLS[sk];
        if (sd && sd.type === 'attack' && (!sd.delay || sd.delay === 0) && !sd.aoe 
            && sk !== '施毒术' && sk !== '瘟疫' && sk !== '毒云') {
          if (p.mp >= 2) {
            p.mp -= 2;
            this._mpShortageClear(sk);
            magicBonus += sd.damageBonus;
            residentMagic.push(sk);
            skillAttrib.push({ sk, bonus: sd.damageBonus });
          } else {
            this._mpShortageLog(sk, 2);
          }
        }
      }
      // 法师/道士被动技能（精神力战法等）增强魔法段（道术/魔法输出）
      for (const sk of p.equippedSkills) {
        const sd = SKILLS[sk];
        if (sd && sd.type === 'passive' && (!sd.delay || sd.delay === 0)) {
          magicBonus += sd.damageBonus;
          skillAttrib.push({ sk, bonus: sd.damageBonus });
        }
      }
      
      if (magicBonus > 0) {
        const magicBase = p.job === 'mage' ? stats.maxMc : stats.maxSc;
        // 魔法段自带1.0基础系数，技能加成在其上叠加：MC × (1 + Σ加成)
        const magicMin = Math.floor(magicBase * (1 + magicBonus) * 0.9);
        const magicMax = Math.floor(magicBase * (1 + magicBonus) * 1.1);
        const magicDmg = this.calcDamage(magicMin, magicMax, mon.minMagDef || 0, mon.maxMagDef || 0);
        dmg += magicDmg;
        // 魔法伤害按各技能加成占比归因（1.0基础部分不归因给任何技能，计入普攻段之外的未归因部分）
        const attrSum = skillAttrib.reduce((s, a) => s + a.bonus, 0);
        if (attrSum > 0) {
          attribDmg = magicDmg;
          for (const a of skillAttrib) this._logSkillDmg(a.sk, magicDmg * a.bonus / (1 + attrSum));
        }
      }
    }
    dmg = Math.max(1, dmg);
    mon.currentHp -= dmg;
    this._logSkillDmg('普攻', Math.max(1, dmg - attribDmg));
    // 战斗日志：带上技能名（触发技能+常驻魔法技能，如 ⚡雷电术+🔥火符）
    const fmtSkill = sk => (SKILL_ICONS[sk] || '✨') + sk;
    if (triggeredSkills.length > 0) {
      const names = [...new Set([...triggeredSkills, ...residentMagic])];
      this.addLog(`✨ ${names.map(fmtSkill).join('+')} 发动！你对 ${mon.name} 造成 ${dmg} 点伤害`, 'attack');
    } else if (residentMagic.length > 0) {
      this.addLog(`${residentMagic.map(fmtSkill).join('+')} 你对 ${mon.name} 造成 ${dmg} 点伤害`, 'attack');
    } else {
      this.addLog(`你对 ${mon.name} 造成 ${dmg} 点伤害`, 'attack');
    }

    // 武器特效·连击（喋血战刃）：目标存活时25%概率追加一击（不计技能加成，纯物攻结算）
    let leechBase = dmg; // 吸血结算基数：本回合普攻段累计命中伤害
    const wpnFx = this.getSpecialRings();
    if (mon.currentHp > 0 && wpnFx.includes('连击') && Math.random() < 0.25) {
      const comboDmg = Math.max(1, this.calcDamage(stats.minAtk, stats.maxAtk, mon.minDef, mon.maxDef));
      mon.currentHp -= comboDmg;
      leechBase += comboDmg;
      this._logSkillDmg('连击', comboDmg);
      this.addLog(`⚔️ 连击发动！追加命中 ${mon.name}，造成 ${comboDmg} 点伤害`, 'attack');
    }

    // 主目标死亡检查：必须在溅射阶段前结算，否则目标变量被重指向后
    // 该怪永远不会调用 onMonsterDeath，导致经验/掉落/击杀数丢失
    if (mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }

    // === 群攻溅射：AOE技能对其他怪物造成溅射伤害 ===
    // 收集所有生效的AOE技能：触发型(delay>0) + 被动型(delay=0)
    const aoeSkills = triggeredSkills.filter(sk => SKILLS[sk] && SKILLS[sk].aoe);
    for (const sk of p.equippedSkills) {
      const sd = SKILLS[sk];
      if (sd && sd.aoe && (!sd.delay || sd.delay === 0) && !aoeSkills.includes(sk)) {
        aoeSkills.push(sk);
      }
    }
    if (aoeSkills.length > 0) {
      const aoeBonus = aoeSkills.reduce((s, sk) => s + SKILLS[sk].damageBonus, 0);
      const others = this.currentMonsters.filter(m => m.currentHp > 0 && m !== mon);
      // 群攻命中全场：主目标与其余存活怪全部吃溅射，不再是"其他死光才打主目标"
      const targets = [mon, ...others];
      let splashBase;
      if (p.job === 'warrior') {
        splashBase = Math.floor(dmg * aoeBonus * 0.5);
      } else if (p.job === 'mage') {
        // 法师溅射不打折扣：MC × Σ(AOE技能加成)全额溅射
        splashBase = Math.floor(stats.maxMc * aoeBonus);
      } else {
        const magicBase = stats.maxSc;
        // 道士溅射带+1底数：SC × (1+ΣAOE加成) × 0.45~0.55浮动
        const splashMin = Math.floor(magicBase * (1 + aoeBonus) * 0.45);
        const splashMax = Math.floor(magicBase * (1 + aoeBonus) * 0.55);
        splashBase = this.calcDamage(splashMin, splashMax, 0, 0); // 溅射简化计算
      }
      splashBase = Math.max(1, splashBase);
      // 溅射总伤害按AOE技能加成占比归因
      for (const sk of aoeSkills) this._logSkillDmg(sk, splashBase * targets.length * SKILLS[sk].damageBonus / aoeBonus);
      const aoeNames = aoeSkills.join('+');
      // 毒系AOE（瘟疫/毒云）溅射命中时同步附上对应DOT（与施毒术同公式，独立通道）
      const scBaseDot = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
      const dotChannels = [];
      if (aoeSkills.includes('瘟疫')) dotChannels.push(['瘟疫', 'plague', 'plagueDmg']);
      if (aoeSkills.includes('毒云')) dotChannels.push(['毒云', 'cloud', 'cloudDmg']);
      for (const other of targets) {
        other.currentHp -= splashBase;
        this.addLog(`💥 ${aoeNames} ${other === mon ? '命中' : '溅射'} ${other.name}，造成 ${splashBase} 点伤害`, 'attack');
        if (other.currentHp <= 0) { this.onMonsterDeath(other); }
        else {
          for (const [sk, turnsField, dmgField] of dotChannels) {
            other[turnsField] = 3;
            other[dmgField] = Math.max(1, Math.floor(scBaseDot * SKILLS[sk].damageBonus * 0.6));
          }
        }
      }
      if (this.player.hp <= 0) return;
      // 主目标也死了就重新获取
      if (mon.currentHp <= 0) { mon = this.currentMonster; if (!mon) { this.notify(); return; } }
    }

    // 特殊戒指效果
    const rings = this.getSpecialRings();
    if (rings.includes('火焰')) {
      const fireDmg = Math.max(1, Math.floor(stats.maxAtk * 0.3));
      mon.currentHp -= fireDmg;
      this._logSkillDmg('火焰戒指', fireDmg);
      this.addLog(`🔥 火焰戒指灼烧 ${mon.name}，额外 ${fireDmg} 点伤害`, 'attack');
    }
    if (rings.includes('麻痹') && Math.random() < 0.15) {
      mon.stunned = true;
      this.addLog(`⚡ 麻痹戒指触发！${mon.name} 被麻痹，下回合无法行动`, 'info');
    }
    // 野蛮冲撞：25%概率眩晕目标1回合
    if (p.equippedSkills.includes('野蛮冲撞') && mon.currentHp > 0 && !mon.stunned && Math.random() < 0.25) {
      mon.stunned = true;
      this.addLog(`💢 野蛮冲撞撞晕了 ${mon.name}，下回合无法行动`, 'info');
    }
    if (rings.includes('吸血')) {
      const leechSrc = this.getLeechSource();
      const leechBaseDmg = (typeof leechBase === 'number' && leechBase > 0) ? leechBase : dmg;
      const leech = Math.max(1, Math.floor(leechBaseDmg * leechSrc.rate));
      const before = this.player.hp;
      this.player.hp = Math.min(stats.maxHp, this.player.hp + leech);
      if (this.player.hp > before) this.addLog(`🩸 ${leechSrc.name}吸取 ${this.player.hp - before} HP`, 'heal');
    }

    // 施毒术
    this.playerPoisonApply(mon, stats);

    if (mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }

    // 玩家宝宝攻击（神兽群攻可能击杀主目标，需重新指向）
    this.playerMinionAttack(mon, stats);
    if (mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }

    // 魅惑怪物攻击（诱惑之光）
    if (this.charmedMinion && this.charmedMinion.hp > 0) {
      const charmDmg = Math.max(1, Math.floor(this.charmedMinion.atk * (0.8 + Math.random() * 0.4)));
      mon.currentHp -= charmDmg;
      this._logSkillDmg('诱惑之光', charmDmg);
      this.addLog(`🦊 ${this.charmedMinion.name} 攻击 ${mon.name}，造成 ${charmDmg} 点伤害`, 'attack');
      if (mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }
    }

    // 记忆幻影攻击（记忆戒指）
    if (this.memoryMinion && this.memoryMinion.hp > 0) {
      const memDmg = Math.max(1, Math.floor(this.memoryMinion.atk * (0.8 + Math.random() * 0.4)));
      mon.currentHp -= memDmg;
      this._logSkillDmg('记忆戒指', memDmg);
      this.addLog(`🌀 ${this.memoryMinion.name} 攻击 ${mon.name}，造成 ${memDmg} 点伤害`, 'attack');
      this.memoryMinion.turns--;
      if (this.memoryMinion.turns <= 0) {
        this.addLog('🌀 记忆幻影消散了', 'info');
        this.memoryMinion = null;
      }
      if (mon && mon.currentHp <= 0) { this.onMonsterDeath(mon); if (this.player.hp <= 0) return; mon = this.currentMonster; if (!mon) { this.notify(); return; } }
    }

    // === 所有存活怪物反击 ===
    for (const m of this.currentMonsters) {
      if (m.currentHp <= 0) continue;
      // 怪物被麻痹：跳过
      if (m.stunned) {
        m.stunned = false;
        this.addLog(`⚡ ${m.name} 处于麻痹状态，无法行动！`, 'info');
        continue;
      }
      // 收集存活的宝宝单位（召唤物+魅惑怪）
      const aliveMinions = [];
      for (const pm of this.playerMinions) {
        if (pm.hp > 0) aliveMinions.push(pm);
      }
      if (this.charmedMinion && this.charmedMinion.hp > 0) aliveMinions.push(this.charmedMinion);
      if (this.memoryMinion && this.memoryMinion.hp > 0) aliveMinions.push(this.memoryMinion);
      // 隐身状态且有宝宝：强制攻击宝宝（仇恨转移）
      if (this.stealthTurns > 0 && aliveMinions.length > 0) {
        this.monsterAttackMinion(m, aliveMinions[Math.floor(Math.random() * aliveMinions.length)]);
      } else if (aliveMinions.length > 0 && Math.random() < 0.4) {
        // 随机选择目标：40%概率攻击宝宝单位（如果存在）
        this.monsterAttackMinion(m, aliveMinions[Math.floor(Math.random() * aliveMinions.length)]);
      } else {
        this.monsterBasicAttack(m, stats);
        if (this.player.hp <= 0) { this.onPlayerDeath(); return; }
        this.monsterSkillPhase(m, stats);
        if (this.player.hp <= 0) { this.onPlayerDeath(); return; }
      }
    }

    // 隐身回合递减
    if (this.stealthTurns > 0) {
      this.stealthTurns--;
      if (this.stealthTurns === 0) this.addLog('👻 隐身效果消失', 'info');
    }

    // 怪物召唤物攻击
    this.summonedMinionAttack(mon, stats);
    if (this.player.hp <= 0) { this.onPlayerDeath(); return; }

    // 玩家治疗术
    this.playerHealPhase(stats);

    // 每回合自动吃药检测
    this.autoHeal();

    this.notify();
  }

  monsterBasicAttack(mon, stats) {
    const monDmg = this.calcDamage(mon.minAtk, mon.maxAtk, stats.minDef, stats.maxDef);
    const defBonus = this.getSkillDefBonus();
    let finalMonDmg = Math.max(1, Math.floor(monDmg * (1 - defBonus)));
    // 护身戒指：部分伤害转化为MP消耗
    const rings = this.getSpecialRings();
    if (rings.includes('护身') && this.player.mp > 0) {
      const mpShield = Math.floor(finalMonDmg * 0.3);
      const actualMpCost = Math.min(this.player.mp, mpShield);
      this.player.mp -= actualMpCost;
      finalMonDmg -= actualMpCost;
      finalMonDmg = Math.max(1, finalMonDmg);
    }
    this.player.hp -= finalMonDmg;
    this._logStat('dmgPhys', finalMonDmg);
    this.addLog(`${mon.name} 对你造成 ${finalMonDmg} 点伤害`, 'hurt');
  }

  // 怪物攻击宝宝单位（召唤物/魅惑怪）
  monsterAttackMinion(mon, minion) {
    if (!minion || minion.hp <= 0) return;
    // 宝宝享受玩家防御减免（与玩家受物理攻击同公式，不再是裸承受全额伤害）
    const pstats = this.getStats();
    const dmg = this.calcDamage(mon.minAtk, mon.maxAtk, pstats.minDef, pstats.maxDef);
    minion.hp -= dmg;
    this.addLog(`💥 ${mon.name} 攻击 ${minion.name}，造成 ${dmg} 点伤害`, 'hurt');
    if (minion.hp <= 0) {
      if (this.playerMinions.includes(minion)) {
        this.addLog(`☠️ ${minion.name} 被击杀！下回合将重新召唤`, 'error');
        this.playerMinions = this.playerMinions.filter(m => m !== minion); // 清除，下回合重新召唤
      } else if (minion === this.memoryMinion) {
        this.addLog(`☠️ ${minion.name} 被击杀！`, 'error');
        this.memoryMinion = null;
      } else {
        this.addLog(`☠️ ${minion.name} 被击杀！`, 'error');
        this.charmedMinion = null;
      }
    }
  }

  monsterSkillPhase(mon, stats) {
    if (!mon.skills || mon.skills.length === 0) return;
    for (const skill of mon.skills) {
      if (Math.random() > skill.chance) continue;
      switch (skill.type) {
        case 'magic': {
          // 远程魔法攻击：用魔防减伤
          const magDmg = Math.floor(this.calcDamage(mon.minAtk, mon.maxAtk, stats.minMagDef, stats.maxMagDef) * skill.power);
          const defBonus = this.getSkillDefBonus();
          let finalDmg = Math.max(1, Math.floor(magDmg * (1 - defBonus)));
          // 护身戒指对魔法也生效
          const rings = this.getSpecialRings();
          if (rings.includes('护身') && this.player.mp > 0) {
            const mpShield = Math.floor(finalDmg * 0.3);
            const actualMpCost = Math.min(this.player.mp, mpShield);
            this.player.mp -= actualMpCost;
            finalDmg -= actualMpCost;
            finalDmg = Math.max(1, finalDmg);
          }
          this.player.hp -= finalDmg;
          this._logStat('dmgMag', finalDmg);
          this.addLog(`🔥 ${mon.name} 释放【${skill.name}】，魔法伤害 ${finalDmg}！`, 'error');
          break;
        }
        case 'poison': {
          // 毒：持续伤害3回合
          const poisonDmg = Math.max(2, Math.floor(mon.maxAtk * skill.power * 0.3));
          this.playerPoison = 3;
          this.playerPoisonDmg = poisonDmg;
          this.addLog(`🟢 ${mon.name} 释放【${skill.name}】，你中毒了！每回合-${poisonDmg}HP(3回合)`, 'error');
          break;
        }
        case 'paralysis': {
          // 麻痹：下回合无法行动
          this.playerStunned = true;
          this.addLog(`⚡ ${mon.name} 释放【${skill.name}】，你被麻痹了！下回合无法行动`, 'error');
          break;
        }
        case 'freeze': {
          // 冰冻：同麻痹
          this.playerStunned = true;
          this.addLog(`❄️ ${mon.name} 释放【${skill.name}】，你被冰冻了！下回合无法行动`, 'error');
          break;
        }
        case 'summon': {
          // 召唤小怪（最多2个）
          if (this.summonedMinions.length < 2) {
            const minionHp = Math.floor(mon.maxHp * skill.power * 0.15);
            const minionAtk = Math.floor(mon.maxAtk * skill.power * 0.5);
            this.summonedMinions.push({ name: `${mon.name}的召唤物`, hp: minionHp, atk: minionAtk });
            this.addLog(`👻 ${mon.name} 释放【${skill.name}】，召唤了援军！`, 'error');
          }
          break;
        }
        case 'lifesteal': {
          // 吸血：造成伤害并回复
          const stealDmg = Math.floor(this.calcDamage(mon.minAtk, mon.maxAtk, stats.minDef, stats.maxDef) * skill.power);
          const defBonus = this.getSkillDefBonus();
          const finalDmg = Math.max(1, Math.floor(stealDmg * (1 - defBonus)));
          this.player.hp -= finalDmg;
          this._logStat('dmgPhys', finalDmg);
          const healAmt = Math.floor(finalDmg * 0.5);
          mon.currentHp = Math.min(mon.maxHp, mon.currentHp + healAmt);
          this.addLog(`🩸 ${mon.name} 释放【${skill.name}】，吸取 ${finalDmg} HP并回复 ${healAmt}！`, 'error');
          break;
        }
      }
    }
  }

  summonedMinionAttack(mon, stats) {
    for (let i = this.summonedMinions.length - 1; i >= 0; i--) {
      const minion = this.summonedMinions[i];
      const dmg = Math.max(1, Math.floor(minion.atk * (0.8 + Math.random() * 0.4) - stats.minDef * 0.3));
      this.player.hp -= dmg;
      this._logStat('dmgPhys', dmg);
      this.addLog(`👻 ${minion.name} 攻击你，造成 ${dmg} 点伤害`, 'hurt');
    }
  }

  calcDamage(minAtk, maxAtk, minDef, maxDef) {
    const atk = minAtk + Math.random() * (maxAtk - minAtk);
    const def = minDef + Math.random() * (maxDef - minDef);
    return Math.max(1, Math.floor(atk - def * 0.6));
  }

  getSkillDamageBonus() {
    // 只返回delay=0的被动/持续加成（战士近战、buff、被动）
    // 排除buff类型技能，它们只提供减伤，不加攻击
    let bonus = 0;
    const p = this.player;
    for (const sk of p.equippedSkills) {
      const skillData = SKILLS[sk];
      if (skillData && (!skillData.delay || skillData.delay === 0) && skillData.type !== 'buff') {
        bonus += skillData.damageBonus;
      }
    }
    return bonus;
  }

  // 技能冷却系统：每回合递减，到0时触发并重置（触发时消耗MP = 冷却回合数×2）
  processSkillCooldowns() {
    const p = this.player;
    let triggeredBonus = 0;
    const triggeredSkills = [];
    for (const sk of p.equippedSkills) {
      const skillData = SKILLS[sk];
      if (!skillData || !skillData.delay || skillData.delay === 0) continue;
      // 初始化冷却（首次装载时立即就绪）
      if (this.skillCooldowns[sk] === undefined) this.skillCooldowns[sk] = 0;
      if (this.skillCooldowns[sk] <= 0) {
        // 技能蓝耗：冷却回合数×2（治疗类保持原有独立蓝耗，不叠加）
        const mpCost = skillData.type === 'heal' ? 0 : skillData.delay * 2;
        if (p.mp < mpCost) {
          this._mpShortageLog(sk, mpCost);
          continue; // MP不足：本回合不触发，冷却保持就绪
        }
        p.mp -= mpCost;
        this._mpShortageClear(sk);
        // 冷却完成，触发技能
        triggeredBonus += skillData.damageBonus;
        triggeredSkills.push(sk);
        this.skillCooldowns[sk] = skillData.delay; // 重置冷却
      } else {
        this.skillCooldowns[sk]--; // 递减冷却
      }
    }
    return { triggeredBonus, triggeredSkills };
  }

  // MP不足提示（每技能仅在状态切换时提示一次，防止刷屏）
  _mpShortageLog(sk, cost) {
    if (!this._mpShortLogged) this._mpShortLogged = {};
    if (!this._mpShortLogged[sk]) {
      this._mpShortLogged[sk] = true;
      this.addLog(`💧 MP不足，${sk} 无法施放（需要 ${cost} MP）`, 'info');
    }
  }
  _mpShortageClear(sk) {
    if (this._mpShortLogged && this._mpShortLogged[sk]) this._mpShortLogged[sk] = false;
  }

  getSkillDefBonus() {
    // 防御类技能减伤（护身气幕/魔法盾/阴阳盾等buff技能）
    let defBonus = 0;
    const p = this.player;
    for (const sk of p.equippedSkills) {
      const skillData = SKILLS[sk];
      if (skillData && skillData.type === 'buff') defBonus += skillData.damageBonus; // 减伤直接等于damageBonus（不乘0.5）
    }
    return defBonus;
  }

  // === 玩家召唤技能：宝宝攻击（每个召唤技能各生成1只，共存） ===
  playerMinionAttack(mon, stats) {
    const p = this.player;
    // 收集所有已装备的召唤技能
    const summons = [];
    for (const sk of p.equippedSkills) {
      const sd = SKILLS[sk];
      if (sd && sd.type === 'summon') summons.push({ skillName: sk, sd });
    }
    if (summons.length === 0) { this.playerMinions = []; return; }
    // 移除已卸下召唤技能对应的宝宝
    this.playerMinions = this.playerMinions.filter(m => summons.some(s => s.skillName === m.skillName));
    const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
    // 每个召唤技能各生成1只宝宝（最多3只）
    for (const s of summons) {
      let minion = this.playerMinions.find(m => m.skillName === s.skillName);
      if (!minion) {
        // 宝宝攻击力基于SC(道术)
        const minionAtk = Math.max(1, Math.floor(scBase * s.sd.damageBonus * 2.0));
        // 全面强化：宝宝HP ×30（最低200），配合防御减免提升生存
        const minionHp = Math.max(200, Math.floor(scBase * s.sd.damageBonus * 30));
        const minionName = s.skillName === '召唤神兽' ? '神兽' : s.skillName === '召唤月灵' ? '月灵' : '骷髅';
        minion = { name: minionName, skillName: s.skillName, atk: minionAtk, hp: minionHp, maxHp: minionHp };
        this.playerMinions.push(minion);
        this.addLog(`✨ 召唤【${minionName}】出现，攻击力 ${minionAtk}，生命 ${minionHp}`, 'info');
      }
      // 宝宝攻击（目标死亡则停止）
      if (minion.hp > 0 && mon.currentHp > 0) {
        const dmg = Math.max(1, Math.floor(minion.atk * (0.8 + Math.random() * 0.4)));
        // 全部召唤物群攻：主目标吃全额伤害（由调用点统一结算），其余存活怪物各吃一份全额伤害
        mon.currentHp -= dmg;
        this._logSkillDmg(minion.skillName, dmg);
        this.addLog(`🐾 ${minion.name}攻击 ${mon.name}，造成 ${dmg} 点伤害`, 'attack');
        const others = this.currentMonsters.filter(m => m.currentHp > 0 && m !== mon);
        for (const t of others) {
          const sDmg = Math.max(1, Math.floor(minion.atk * (0.8 + Math.random() * 0.4)));
          t.currentHp -= sDmg;
          this._logSkillDmg(minion.skillName, sDmg);
          this.addLog(`🐾 ${minion.name}群攻 ${t.name}，造成 ${sDmg} 点伤害`, 'attack');
          if (t.currentHp <= 0) this.onMonsterDeath(t);
        }
      }
    }
  }

  // === 玩家治疗技能：战斗中自动回血 ===
  playerHealPhase(stats) {
    const p = this.player;
    // 防御戒指：每回合自动回复2%最大HP（不耗MP）
    if (this.getSpecialRings().includes('防御') && p.hp > 0 && p.hp < stats.maxHp) {
      const ringHeal = Math.max(1, Math.floor(stats.maxHp * 0.02));
      p.hp = Math.min(stats.maxHp, p.hp + ringHeal);
    }
    let healPower = 0;
    for (const sk of p.equippedSkills) {
      const sd = SKILLS[sk];
      if (sd && sd.type === 'heal') healPower += sd.power;
    }
    if (healPower <= 0) return;
    // HP低于70%时触发治疗，消耗MP
    if (p.hp < stats.maxHp * 0.7 && p.mp >= 3) {
      // 治疗量基于SC(道术)
      const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
      const healAmt = Math.floor(stats.maxHp * 0.03 + (healPower * 0.5 + scBase * 0.2));
      p.hp = Math.min(stats.maxHp, p.hp + healAmt);
      p.mp -= 3;
      this.addLog(`💚 治疗术恢复 ${healAmt} HP`, 'heal');
      // 治疗术同时治疗存活宝宝（等量回复，不超过宝宝上限）
      const healTargets = [...this.playerMinions.filter(m => m.hp > 0)];
      if (this.charmedMinion && this.charmedMinion.hp > 0) healTargets.push(this.charmedMinion);
      if (this.memoryMinion && this.memoryMinion.hp > 0) healTargets.push(this.memoryMinion);
      for (const minion of healTargets) {
        if (minion.hp < minion.maxHp) {
          const mHeal = Math.min(minion.maxHp - minion.hp, healAmt);
          if (mHeal > 0) {
            minion.hp += mHeal;
            this.addLog(`💚 ${minion.name} 被治愈，恢复 ${mHeal} HP`, 'heal');
          }
        }
      }
    }
  }

  // === 玩家施毒技能：给怪物上DOT（施毒术/瘟疫/毒云独立通道，可同时生效） ===
  playerPoisonApply(mon, stats) {
    const p = this.player;
    // 毒伤基于SC(道术)
    const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
    // 每本技能独立施加一路DOT：持续3回合，每回合攻击时刷新
    const channels = [
      ['施毒术', 'poison', 'poisonDmg'],
      ['瘟疫', 'plague', 'plagueDmg'],
      ['毒云', 'cloud', 'cloudDmg'],
    ];
    for (const [sk, turnsField, dmgField] of channels) {
      const sd = SKILLS[sk];
      if (!p.equippedSkills.includes(sk) || !sd || sd.type !== 'attack') continue;
      mon[turnsField] = 3;
      mon[dmgField] = Math.max(1, Math.floor(scBase * sd.damageBonus * 0.6));
    }
  }

  onMonsterDeath(deadMon) {
    const mon = deadMon || this.currentMonster;
    if (!mon) return;
    // 世界BOSS：击杀以服务端判定为准，本地钉在1血等待确认（不给经验/不掉物）
    if (this.inWorldBoss) {
      if (!mon._wbPinned) {
        mon._wbPinned = true;
        this.addLog(`🐲 ${mon.name} 濒死！等待全服伤害结算确认...`, 'info');
        this._wbReport(true);
      }
      mon.currentHp = 1;
      return;
    }
    this.killCount++;
    this._logStat('kills', 1);
    if (this._session && mon.type === 'boss') this._session.bossKills++;
    // 传送戒指保底计数：BOSS击杀清零，小怪累加（通天塔不计）
    if (!this.inTower) {
      if (mon.type === 'boss') this.bossPity = 0;
      else this.bossPity++;
    }
    this.addLog(`☠️ ${mon.name} 被击杀！获得 ${mon.exp} 经验`, 'kill');
    this._logDrop(`✨ ${mon.exp} 经验`, mon.name);
    if (this.inTower) {
      this.towerRollDrops(mon.name, mon.level, mon.type === 'boss');
    } else {
      this.rollDrops(mon.name, mon.level, mon.type === 'boss');
    }
    // 给经验
    this.gainExp(mon.exp);
    // 记忆戒指：击杀时5%概率召唤记忆幻影助战（5回合，继承30%玩家攻击）
    if (!this.memoryMinion && this.getSpecialRings().includes('记忆') && Math.random() < 0.05) {
      const stats = this.getStats();
      const memAtk = Math.max(1, Math.floor(stats.maxAtk * 0.3));
      const memHp = Math.max(20, Math.floor(stats.maxHp * 0.2));
      this.memoryMinion = { name: '记忆幻影', atk: memAtk, hp: memHp, maxHp: memHp, turns: 5 };
      this.addLog('💍 记忆戒指发动！记忆幻影现身助战（持续5回合）', 'info');
    }
    // 检查是否全波清除
    const alive = this.currentMonsters.filter(m => m.currentHp > 0);
    if (alive.length === 0) {
      // 波次清除
      if (!this.inTower) {
        this.waveKills += this.currentMonsters.length;
        if (this.waveKills >= this.waveSize) {
          this.addLog(`🌊 第${this.waveNum}波清除！`, 'level');
          this.waveNum++;
          this.waveKills = 0;
        }
      }
      // 清除战斗状态
      this.summonedMinions = [];
      this.playerMinions = [];
      this.stealthTurns = 0;
      this.charmedMinion = null;
      this.memoryMinion = null;
      this.playerPoison = 0;
      this.playerPoisonDmg = 0;
      this.playerStunned = false;
      this.revivalUsed = false;
      this.autoHeal();
      // 刷新下一波/下一只
      if (this.inTower) {
        this.towerNextMonster();
      } else {
        this.spawnMonster();
      }
    } else {
      // 还有存活怪物，调整目标
      if (this.targetIdx >= this.currentMonsters.length || this.currentMonsters[this.targetIdx].currentHp <= 0) {
        this.targetIdx = this.currentMonsters.findIndex(m => m.currentHp > 0);
      }
    }
    this.notify();
  }

  rollDrops(monsterName, monLevel, isBoss) {
    let dropTable = DROPS[monsterName];
    if (!dropTable) {
      if (monLevel <= 20) dropTable = GENERIC_DROPS.low;
      else if (monLevel <= 40) dropTable = GENERIC_DROPS.mid;
      else dropTable = GENERIC_DROPS.high;
    }
    for (const drop of dropTable) {
      if (Math.random() < 1 / drop.chance) {
        if (drop.item === '金币') {
          const amount = drop.count || 100;
          this.player.gold += amount;
          this.totalGold += amount;
          this._logStat('gold', amount);
          this.addLog(`💰 获得 ${amount} 金币`, 'drop');
          this._logDrop(`💰 ${amount} 金币`, monsterName);
        } else {
          if (this.dropFilter.includes(drop.item)) continue; // 图鉴黑名单过滤：勾选的装备不掉落
          const info = ITEMS[drop.item];
          const isEquip = info && !['potion','buff','material','skillbook'].includes(info.type);
          const bonus = isEquip ? this.rollBonus(info, 1, 3, [70, 20, 10]) : null;
          // 过滤系统：加成低于阈值自动出售（特戒靠special特效保值，永不参与过滤）
          if (bonus && this.sellThreshold > 0 && !info.special) {
            const bonusVal = Object.values(bonus)[0] || 0;
            if (bonusVal < this.sellThreshold) {
              const price = info?.price || 50;
              const sellPrice = Math.floor(price * 0.5);
              this.player.gold += sellPrice;
              this.totalGold += sellPrice;
              this._logStat('gold', sellPrice);
              const bonusStr = ` [+${bonusVal}${Object.keys(bonus)[0] === 'atk' ? '攻' : Object.keys(bonus)[0] === 'mc' ? '魔' : Object.keys(bonus)[0] === 'sc' ? '道' : Object.keys(bonus)[0] === 'def' ? '防' : Object.keys(bonus)[0] === 'hp' ? 'HP' : ''}]`;
              this.addLog(`🗑️ 自动出售 ${drop.item}${bonusStr} → +${sellPrice}金币`, 'info');
              continue;
            }
          }
          this.addItem(drop.item, bonus);
          const bonusStr = bonus ? ` [${Object.entries(bonus).map(([k,v]) => '+' + v + ({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔防',hp:'HP'}[k]||k)).join(' ')}]` : '';
          this.addLog(`📦 获得物品: ${drop.item}${bonusStr}`, 'drop');
          this._logDrop(drop.item + bonusStr, monsterName, { level: monLevel, boss: isBoss });
        }
      }
    }
  }

  addItem(itemName, bonus, luck) {
    const info = ITEMS[itemName];
    if (!info) return; // 跳过未定义的道具
    // 可叠加：药水/技能书/材料（祝福油、龙鳞等）
    const stackable = info.type === 'potion' || info.type === 'skillbook' || info.type === 'material';
    if (stackable) {
      const existing = this.player.inventory.find(x => x.name === itemName);
      if (existing) {
        existing.count = Math.min(9999, (existing.count || 1) + 1);
        return;
      }
      // 药水/技能书/材料不占背包装备格数限制
      this.player.inventory.push({ uid: this.nextItemUid++, name: itemName, count: 1 });
      return;
    }
    // 装备限100格（超负载戒指+10格）
    const equipCap = 100 + (this.getSpecialRings().includes('超负载') ? 10 : 0);
    const equipCount = this.player.inventory.filter(x => { const i = ITEMS[x.name]; return i && i.type !== 'potion' && i.type !== 'skillbook' && i.type !== 'material'; }).length;
    if (equipCount < equipCap) {
      const entry = { uid: this.nextItemUid++, name: itemName, count: 1 };
      if (bonus) entry.bonus = bonus;
      if (luck) entry.luck = luck;
      this.player.inventory.push(entry);
    } else {
      // 背包已满：掉落被丢弃，限频警告（防刷屏，30秒一次）
      if (!this._bagFullWarnAt || Date.now() - this._bagFullWarnAt > 30000) {
        this._bagFullWarnAt = Date.now();
        this.addLog('⚠️ 背包装备格已满，新掉落的装备已被丢弃！请及时出售/存入仓库', 'error');
      }
    }
  }

  // 确保物品条目有uid（旧条目/初始背包补发）
  _ensureUid(slot) {
    if (!slot.uid) slot.uid = this.nextItemUid++;
    return slot.uid;
  }

  // 背包手动排序：锁定装备置顶 → 装备类型顺序 → 同类型按物品等级降序
  sortInventory() {
    const typeOrder = { weapon: 0, armor: 1, helmet: 2, necklace: 3, bracelet: 4, ring: 5, boots: 6, belt: 7, jade: 8, skillbook: 9, potion: 10, buff: 11, material: 12 };
    this.player.inventory.sort((a, b) => {
      if (!!a.locked !== !!b.locked) return a.locked ? -1 : 1;
      const ia = ITEMS[a.name], ib = ITEMS[b.name];
      const ta = ia && typeOrder[ia.type] !== undefined ? typeOrder[ia.type] : 13;
      const tb = ib && typeOrder[ib.type] !== undefined ? typeOrder[ib.type] : 13;
      if (ta !== tb) return ta - tb;
      const la = ia && ia.level ? ia.level : 0;
      const lb = ib && ib.level ? ib.level : 0;
      return lb - la;
    });
    this.addLog('🎒 背包已排序（锁定置顶 → 类型 → 等级）', 'info');
    this.notify();
  }

  // === 仓库：背包/仓库互转，仓库容量100格 ===
  getWarehouseCap() { return 100; }

  storeItem(index) {
    const slot = this.player.inventory[index];
    if (!slot) return;
    if (this.player.warehouse.length >= this.getWarehouseCap()) {
      this.addLog('❌ 仓库已满（100格）', 'error');
      this.notify();
      return;
    }
    this._ensureUid(slot);
    this.player.inventory.splice(index, 1);
    const info = ITEMS[slot.name];
    const stackable = info && (info.type === 'potion' || info.type === 'skillbook');
    if (stackable) {
      const existing = this.player.warehouse.find(x => x.name === slot.name);
      if (existing) {
        existing.count = Math.min(9999, existing.count + (slot.count || 1));
        this.addLog(`📦 ${slot.name} 已存入仓库（合并）`, 'info');
        this.save();
        this.notify();
        return;
      }
    }
    this.player.warehouse.push(slot);
    this.addLog(`📦 ${slot.name} 已存入仓库`, 'info');
    this.save();
    this.notify();
  }

  withdrawItem(index) {
    const slot = this.player.warehouse[index];
    if (!slot) return;
    const info = ITEMS[slot.name];
    const stackable = info && (info.type === 'potion' || info.type === 'skillbook');
    if (!stackable) {
      // 取出装备时检查背包装备格是否已满
      const equipCap = 100 + (this.getSpecialRings().includes('超负载') ? 10 : 0);
      const equipCount = this.player.inventory.filter(x => { const i = ITEMS[x.name]; return i && i.type !== 'potion' && i.type !== 'skillbook' && i.type !== 'material'; }).length;
      if (equipCount >= equipCap) {
        this.addLog('❌ 背包装备格已满，无法取出', 'error');
        this.notify();
        return;
      }
    }
    this.player.warehouse.splice(index, 1);
    if (stackable) {
      const existing = this.player.inventory.find(x => x.name === slot.name);
      if (existing) {
        existing.count = Math.min(9999, existing.count + (slot.count || 1));
        this.addLog(`📤 ${slot.name} 已取回背包（合并）`, 'info');
        this.save();
        this.notify();
        return;
      }
    }
    this.player.inventory.push(slot);
    this.addLog(`📤 ${slot.name} 已取回背包`, 'info');
    this.save();
    this.notify();
  }

  rollBonus(info, min = 1, max = 3, weights = null) {
    // 随机min-max点，从装备拥有的属性中随机选一个加成
    // 掉落默认1-3点且带权重（+1常见/+2较难/+3稀有），不传weights则均匀分布
    let total;
    if (weights && weights.length === max - min + 1) {
      const sum = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum;
      total = min;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) { total = min + i; break; }
      }
    } else {
      total = min + Math.floor(Math.random() * (max - min + 1));
    }
    const bonus = {};
    // 收集装备所有可加成属性
    const candidates = [];
    if (info.atk) candidates.push('atk');
    if (info.mc) candidates.push('mc');
    if (info.sc) candidates.push('sc');
    if (info.def) candidates.push('def');
    if (info.magDef) candidates.push('magDef');
    if (info.hp) candidates.push('hp');
    // 衣服额外可滚攻击类词条（按装备职业限制筛选，避免重复词条改变权重）
    if (info.type === 'armor') {
      const jobOk = j => !info.job || info.job === 'all' || info.job === j;
      if (jobOk('warrior') && !candidates.includes('atk')) candidates.push('atk');
      if (jobOk('mage') && !candidates.includes('mc')) candidates.push('mc');
      if (jobOk('taoist') && !candidates.includes('sc')) candidates.push('sc');
    }
    if (candidates.length === 0) candidates.push('atk');
    // 随机选取一个属性
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    bonus[pick] = pick === 'hp' ? total * 10 : total;
    return bonus;
  }

  equipItem(index) {
    const p = this.player;
    const slot = p.inventory[index];
    if (!slot) return;
    const itemName = slot.name;
    const item = ITEMS[itemName];
    if (!item) return;
    if (item.type === 'skillbook') {
      if (item.job !== p.job) {
        this.addLog(`❌ 该技能书不属于${p.name}职业`, 'error');
        this.notify();
        return;
      }
      const skillData = SKILLS[item.skill];
      if (skillData && p.level < skillData.levelReq) {
        this.addLog(`❌ 需要等级 ${skillData.levelReq} 才能学习 ${item.skill}`, 'error');
        this.notify();
        return;
      }
      if (!p.learnedSkills.includes(item.skill)) {
        p.learnedSkills.push(item.skill);
        this.addLog(`📖 学会技能: ${item.skill}`, 'level');
        // 自动装载到空槽
        if (p.equippedSkills.length < 3) {
          p.equippedSkills.push(item.skill);
          this.addLog(`⚔️ 自动装载技能: ${item.skill}`, 'info');
        }
      } else {
        this.addLog(`❌ 已学会该技能`, 'error');
      }
      slot.count--;
      if (slot.count <= 0) p.inventory.splice(index, 1);
      this.notify();
      return;
    }
    if (item.type === 'potion' || item.type === 'buff' || item.type === 'material') return;
    // 装备等级限制
    if (item.level && p.level < item.level) {
      this.addLog(`❌ 需要等级 ${item.level} 才能装备 ${itemName}`, 'error');
      this.notify();
      return;
    }
    // 属性门槛限制（如力量戒指要求最大攻击力≥needAtk，按当前面板属性判断）
    if (item.needAtk) {
      const stats = this.getStats();
      if (stats.maxAtk < item.needAtk) {
        this.addLog(`❌ 需要最大攻击力 ${item.needAtk} 才能装备 ${itemName}（当前 ${stats.maxAtk}）`, 'error');
        this.notify();
        return;
      }
    }
    const slotMap = { weapon: 'weapon', armor: 'armor', helmet: 'helmet', necklace: 'necklace', bracelet: 'bracelet', ring: 'ring', boots: 'boots', belt: 'belt', jade: 'jade' };
    let eqSlot = slotMap[item.type];
    if (!eqSlot) return;
    // 手镯/戒指双槽位：优先装空槽
    if (eqSlot === 'bracelet') {
      if (!p.equipment.bracelet1) eqSlot = 'bracelet1';
      else if (!p.equipment.bracelet2) eqSlot = 'bracelet2';
      else eqSlot = 'bracelet1'; // 都满则替换槽1
    } else if (eqSlot === 'ring') {
      if (!p.equipment.ring1) eqSlot = 'ring1';
      else if (!p.equipment.ring2) eqSlot = 'ring2';
      else eqSlot = 'ring1';
    }
    // 卸下旧装备（保留幸运值）
    if (p.equipment[eqSlot]) {
      const old = p.equipment[eqSlot];
      this.addItem(typeof old === 'string' ? old : old.name, typeof old === 'object' ? old.bonus : null, typeof old === 'object' ? old.luck : undefined);
    }
    p.equipment[eqSlot] = { name: itemName, bonus: slot.bonus || null, ...(slot.luck ? { luck: slot.luck } : {}) };
    slot.count = (slot.count || 1) - 1; // 兼容无count字段的异常条目，防止NaN导致背包不移除造成复制
    if (slot.count <= 0) p.inventory.splice(index, 1);
    const stats = this.getStats();
    p.maxHp = stats.maxHp; p.maxMp = stats.maxMp;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    this.notify();
  }

  usePotion(type) {
    const p = this.player;
    const stats = this.getStats();
    // 从背包中找到对应类型最合适的药水
    const potions = p.inventory.map((slot, i) => ({ name: slot.name, count: slot.count, i, info: ITEMS[slot.name] }))
      .filter(x => x.info && x.info.type === 'potion');
    let target;
    if (type === 'hp') {
      target = potions.filter(x => x.info.healHp).sort((a, b) => a.info.healHp - b.info.healHp).pop();
    } else {
      target = potions.filter(x => x.info.healMp && !x.info.healHp).sort((a, b) => a.info.healMp - b.info.healMp).pop();
    }
    if (!target) { this.addLog('❌ 背包中没有对应药水', 'error'); this.notify(); return; }
    const info = target.info;
    if (info.healHp) {
      const heal = Math.min(info.healHp, stats.maxHp - p.hp);
      p.hp += heal;
      this.addLog(`❤️ 使用${target.name}，恢复 ${heal} HP`, 'heal');
    }
    if (info.healMp) {
      const heal = Math.min(info.healMp, stats.maxMp - p.mp);
      p.mp += heal;
      if (!info.healHp) this.addLog(`💙 使用${target.name}，恢复 ${heal} MP`, 'heal');
    }
    p.inventory[target.i].count--;
    if (p.inventory[target.i].count <= 0) p.inventory.splice(target.i, 1);
    this.notify();
  }

  useInventoryPotion(index) {
    const p = this.player;
    const slot = p.inventory[index];
    if (!slot) return;
    const itemName = slot.name;
    const info = ITEMS[itemName];
    if (!info || info.type !== 'potion') return;
    const stats = this.getStats();
    if (info.healHp) {
      const heal = Math.min(info.healHp, stats.maxHp - p.hp);
      p.hp += heal;
      this.addLog(`❤️ 使用${itemName}，恢复 ${heal} HP`, 'heal');
    }
    if (info.healMp) {
      const heal = Math.min(info.healMp, stats.maxMp - p.mp);
      p.mp += heal;
      this.addLog(`💙 使用${itemName}，恢复 ${heal} MP`, 'heal');
    }
    slot.count--;
    if (slot.count <= 0) p.inventory.splice(index, 1);
    this.notify();
  }

  // 自动吃药选药：背包有同名药品优先白嫖，否则直接扣金币；AI模式下金币不足自动降级换便宜药
  _resolveAutoPotion(kind, missing) {
    const p = this.player;
    const chosen = kind === 'hp' ? this.hpPotion : this.mpPotion;
    let candidates = Object.entries(ITEMS).filter(([n, i]) =>
      i.type === 'potion' && (kind === 'hp' ? i.healHp : (i.healMp && !i.healHp)));
    if (chosen !== 'auto' && ITEMS[chosen]) {
      candidates = candidates.filter(([n]) => n === chosen);
    } else {
      // AI自动选择：恢复量最贴合缺口优先
      candidates = candidates.slice().sort((a, b) => {
        const va = kind === 'hp' ? a[1].healHp : a[1].healMp;
        const vb = kind === 'hp' ? b[1].healHp : b[1].healMp;
        return Math.abs(va - missing) - Math.abs(vb - missing);
      });
    }
    for (const [name, info] of candidates) {
      const slot = p.inventory.find(x => x.name === name && (x.count || 0) > 0);
      if (slot) return { name, info, free: true, slot };
      if (p.gold >= (info.price || 0)) return { name, info, free: false };
    }
    return null;
  }

  autoHeal() {
    const p = this.player;
    const stats = this.getStats();
    if (!this.autoPot) return;

    // 自动喝红药：HP < 阈值
    if (p.hp < stats.maxHp * this.autoHpThreshold) {
      const pick = this._resolveAutoPotion('hp', stats.maxHp - p.hp);
      if (pick) {
        const heal = Math.min(pick.info.healHp, stats.maxHp - p.hp);
        p.hp += heal;
        if (pick.info.healMp) p.mp = Math.min(stats.maxMp, p.mp + pick.info.healMp);
        if (pick.free) {
          pick.slot.count--;
          if (pick.slot.count <= 0) p.inventory.splice(p.inventory.indexOf(pick.slot), 1);
        } else {
          p.gold -= pick.info.price;
        }
        this.addLog(`💊 自动使用${pick.name}${pick.free ? '' : `（-${pick.info.price}金币）`}，恢复 ${heal} HP`, 'heal');
      }
    }

    // 自动喝蓝药：MP < 阈值
    if (p.mp < stats.maxMp * this.autoMpThreshold) {
      const pick = this._resolveAutoPotion('mp', stats.maxMp - p.mp);
      if (pick) {
        const heal = Math.min(pick.info.healMp, stats.maxMp - p.mp);
        p.mp += heal;
        if (pick.free) {
          pick.slot.count--;
          if (pick.slot.count <= 0) p.inventory.splice(p.inventory.indexOf(pick.slot), 1);
        } else {
          p.gold -= pick.info.price;
        }
        this.addLog(`💧 自动使用${pick.name}${pick.free ? '' : `（-${pick.info.price}金币）`}，恢复 ${heal} MP`, 'heal');
      }
    }
  }

  onPlayerDeath() {
    // 复活戒指：每场战斗触发一次，原地复活50%HP
    if (!this.revivalUsed && this.getSpecialRings().includes('复活')) {
      this.revivalUsed = true;
      const stats = this.getStats();
      this.player.hp = Math.floor(stats.maxHp * 0.5);
      this.playerPoison = 0;
      this.playerPoisonDmg = 0;
      this.playerStunned = false;
      this.addLog('💍 复活戒指触发！原地复活，恢复50%HP', 'heal');
      this.notify();
      return;
    }
    // 会话统计：死亡次数（复活戒指触发不算真正死亡）
    if (this._session) this._session.deaths++;
    // 通天塔中死亡：退出副本
    if (this.inTower) {
      this.addLog('💀 你在通天塔中被击杀！挑战失败...', 'death');
      this.exitTower();
      return;
    }
    // 世界BOSS挑战中死亡：退出并补报已造成伤害
    if (this.inWorldBoss) {
      this.addLog('💀 你被世界BOSS击杀！挑战中断...', 'death');
      this.exitWorldBoss();
      return;
    }
    this.addLog('💀 你被击杀了！自动复活继续战斗...', 'death');
    const stats = this.getStats();
    this.player.hp = stats.maxHp;
    this.player.mp = stats.maxMp;
    // 清除所有状态
    this.playerPoison = 0;
    this.playerPoisonDmg = 0;
    this.playerStunned = false;
    this.summonedMinions = [];
    this.playerMinions = [];
    this.stealthTurns = 0;
    this.charmedMinion = null;
    this.memoryMinion = null;
    this.revivalUsed = false;
    // 损失少量金币
    const loss = Math.floor(this.player.gold * 0.01);
    this.player.gold -= loss;
    this.currentMonsters = [];
    this.targetIdx = 0;
    this.waveKills = 0;
    this.waveNum = 1;
    this.spawnMonster();
    this.notify();
  }

  setTarget(idx) {
    if (idx >= 0 && idx < this.currentMonsters.length && this.currentMonsters[idx].currentHp > 0) {
      this.targetIdx = idx;
      this.notify();
    }
  }

  flee() {
    if (!this.currentMonster) return;
    if (this.inTower) {
      this.addLog('🏃 你逃离了通天塔，挑战失败...', 'info');
      this.exitTower();
      return;
    }
    const monName = this.currentMonster ? this.currentMonster.name : '怪物';
    this.currentMonsters = [];
    this.targetIdx = 0;
    this.summonedMinions = [];
    this.playerPoison = 0;
    this.playerPoisonDmg = 0;
    this.playerStunned = false;
    this.revivalUsed = false;
    this.waveKills = 0;
    this.waveNum = 1;
    this.spawnMonster();
    this.addLog(`🏃 你逃离了 ${monName}，遇到了新的怪物`, 'info');
    this.notify();
  }

  // === 通天塔副本 ===
  getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  canChallengeTower(floor) {
    const today = this.getTodayStr();
    const cleared = this.towerCleared[today] || [];
    return !cleared.includes(floor);
  }

  startTowerFloor(floor) {
    if (this.inWorldBoss) {
      this.addLog('❌ 遮天塔战斗中无法挑战通天塔', 'error');
      this.notify();
      return;
    }
    const floorData = TOWER_FLOORS.find(f => f.floor === floor);
    if (!floorData) return;
    // 不能越层挑战：只能挑战 towerMax+1 及以下的层
    if (floor > this.towerMax + 1) {
      this.addLog(`❌ 请先通关第${this.towerMax + 1}层才能挑战更高层`, 'error');
      this.notify();
      return;
    }
    if (!this.canChallengeTower(floor)) {
      this.addLog(`❌ 通天塔第${floor}层今天已挑战过`, 'error');
      this.notify();
      return;
    }
    if (this.player.gold < floorData.cost) {
      this.addLog(`❌ 金币不足，需要 ${floorData.cost} 金币`, 'error');
      this.notify();
      return;
    }
    // 扣除门票
    this.player.gold -= floorData.cost;
    // 停止挂机
    if (this.isIdle) this.stopIdle();
    // 进入通天塔
    this.inTower = true;
    this.towerFloor = floor;
    this.towerMonIdx = 0;
    this.addLog(`🗼 进入通天塔第 ${floor} 层！(消耗${floorData.cost}金币)`, 'info');
    this.spawnTowerMonster();
    this.notify();
  }

  spawnTowerMonster() {
    const floorData = TOWER_FLOORS.find(f => f.floor === this.towerFloor);
    if (!floorData) return;
    const monDef = floorData.monsters[this.towerMonIdx];
    if (!monDef) return;
    let template;
    if (monDef.ref) {
      template = MONSTERS[monDef.ref];
      if (!template) return;
      this.currentMonster = { name: monDef.ref, ...template, currentHp: template.hp, maxHp: template.hp, maxDef: template.minDef, maxMagDef: template.minMagDef };
    } else {
      template = monDef;
      this.currentMonster = { name: monDef.name, hp: monDef.hp, minAtk: monDef.minAtk, maxAtk: monDef.maxAtk, minDef: monDef.minDef, maxDef: monDef.minDef, minMagDef: monDef.minMagDef || 0, maxMagDef: monDef.minMagDef || 0, exp: monDef.exp, level: monDef.level, type: monDef.type, skills: monDef.skills, currentHp: monDef.hp, maxHp: monDef.hp };
    }
    this.addLog(`⚔️ 通天塔第${this.towerFloor}层 [${this.towerMonIdx+1}/${floorData.monsters.length}]: ${this.currentMonster.name} 出现！`, 'info');
  }

  towerNextMonster() {
    const floorData = TOWER_FLOORS.find(f => f.floor === this.towerFloor);
    if (!floorData) return;
    this.towerMonIdx++;
    if (this.towerMonIdx >= floorData.monsters.length) {
      // 通关
      const today = this.getTodayStr();
      if (!this.towerCleared[today]) this.towerCleared[today] = [];
      this.towerCleared[today].push(this.towerFloor);
      if (this.towerFloor > this.towerMax) this.towerMax = this.towerFloor;
      this.addLog(`🎉 通天塔第 ${this.towerFloor} 层通关！`, 'kill');
      this.exitTower();
    } else {
      this.spawnTowerMonster();
    }
  }

  towerRollDrops(monsterName, monLevel, isBoss) {
    // 通天塔掉落：使用怪物本身掉落表，爆率×2
    let dropTable = DROPS[monsterName];
    if (!dropTable) {
      if (monLevel <= 20) dropTable = GENERIC_DROPS.low;
      else if (monLevel <= 40) dropTable = GENERIC_DROPS.mid;
      else dropTable = GENERIC_DROPS.high;
    }
    for (const drop of dropTable) {
      // 爆率×2 = chance分母减半
      const chance = Math.max(1, Math.floor(drop.chance / 2));
      if (Math.random() < 1 / chance) {
        if (drop.item === '金币') {
          const amount = drop.count || 100;
          this.player.gold += amount;
          this.totalGold += amount;
          this._logStat('gold', amount);
          this.addLog(`💰 获得 ${amount} 金币`, 'drop');
          this._logDrop(`💰 ${amount} 金币`, `通天塔${this.towerFloor}层`);
        } else {
          if (this.dropFilter.includes(drop.item)) continue; // 图鉴黑名单过滤：勾选的装备不掉落
          const info = ITEMS[drop.item];
          const isEquip = info && !['potion','buff','material','skillbook'].includes(info.type);
          const bonus = isEquip ? this.rollBonus(info, 1, 3, [70, 20, 10]) : null;
          this.addItem(drop.item, bonus);
          const bonusStr = bonus ? ` [${Object.entries(bonus).map(([k,v]) => '+' + v + ({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔防',hp:'HP'}[k]||k)).join(' ')}]` : '';
          this.addLog(`📦 获得物品: ${drop.item}${bonusStr}`, 'drop');
          this._logDrop(drop.item + bonusStr, `通天塔${this.towerFloor}层`, { level: monLevel, boss: isBoss, key: monsterName });
        }
      }
    }
  }

  exitTower() {
    this.inTower = false;
    this.towerFloor = 0;
    this.towerMonIdx = 0;
    this.currentMonsters = [];
    this.targetIdx = 0;
    this.summonedMinions = [];
    this.playerPoison = 0;
    this.playerPoisonDmg = 0;
    this.playerStunned = false;
    this.revivalUsed = false;
    // 恢复状态
    const stats = this.getStats();
    this.player.hp = stats.maxHp;
    this.player.mp = stats.maxMp;
    // 回到原地图继续
    this.spawnMonster();
    this.notify();
  }

  // ==================== 世界BOSS（遮天塔） ====================

  // 进入世界BOSS挑战：BOSS作为单怪载入，血量取服务端剩余值
  async enterWorldBoss() {
    if (this.inTower || this.inWorldBoss) return;
    const state = await Api.getWorldBossState();
    if (!state || state.error || !state.exists) {
      this.addLog('❌ 当前没有世界BOSS降临', 'error');
      this.notify();
      return;
    }
    this.worldBossInfo = state;
    const b = state.boss;
    if (b.status !== 'active' || b.hpNow <= 0) {
      this.addLog('🎉 世界BOSS已被击杀', 'info');
      this.notify();
      return;
    }
    if (this.isIdle) this.stopIdle();
    this.inWorldBoss = true;
    this._wbPendingDmg = 0;
    this._wbTurns = 0;
    this.showWorldBossPanel = false;
    this.currentMonsters = [{
      name: b.name, hp: b.hpMax, minAtk: b.minAtk, maxAtk: b.maxAtk,
      minDef: b.minDef, maxDef: b.minDef, minMagDef: b.minMagDef, maxMagDef: b.minMagDef,
      exp: 0, level: b.level, type: 'boss', skills: b.skills || [],
      currentHp: b.hpNow, maxHp: b.hpMax,
      poison: 0, poisonDmg: 0, stunned: false,
    }];
    this.targetIdx = 0;
    this.addLog(`🐲 进入遮天塔，挑战世界BOSS ${b.name}！点击开始挂机进入战斗`, 'info');
    this.notify();
  }

  // 退出世界BOSS挑战（补报剩余伤害并恢复状态）
  exitWorldBoss() {
    if (this._wbPendingDmg > 0) this._wbReport(true);
    this.inWorldBoss = false;
    this.currentMonsters = [];
    this.targetIdx = 0;
    this.summonedMinions = [];
    this.playerPoison = 0;
    this.playerPoisonDmg = 0;
    this.playerStunned = false;
    this.revivalUsed = false;
    const stats = this.getStats();
    this.player.hp = stats.maxHp;
    this.player.mp = stats.maxMp;
    this.spawnMonster();
    this.notify();
  }

  // 上报累计伤害：服务端扣减全服共享血量并返回权威剩余血量
  async _wbReport(force = false) {
    if (!this.inWorldBoss) return;
    const dmg = Math.floor(this._wbPendingDmg);
    if (dmg <= 0 && !force) return;
    this._wbPendingDmg = 0;
    const res = await Api.worldBossAttack(Math.max(0, dmg));
    if (!res || res.error) return;
    if (res.dead) { this._wbServerDead(); return; }
    // 用服务端权威血量覆盖本地（含其他玩家造成的伤害）
    const mon = this.currentMonster;
    if (mon && typeof res.hpNow === 'number') {
      mon.currentHp = Math.max(1, Math.min(mon.maxHp, res.hpNow));
    }
  }

  // 服务端确认BOSS被击杀：停战并打开面板展示结算
  _wbServerDead() {
    this.stopIdle();
    this.inWorldBoss = false;
    this.currentMonsters = [];
    this.targetIdx = 0;
    this.summonedMinions = [];
    this.playerPoison = 0;
    this.playerPoisonDmg = 0;
    this.playerStunned = false;
    this.addLog('🎉 世界BOSS已被击杀！奖励已结算，请到遮天塔查看', 'kill');
    const stats = this.getStats();
    this.player.hp = stats.maxHp;
    this.player.mp = stats.maxMp;
    this.spawnMonster();
    this.showWorldBossPanel = true;
    this.refreshWorldBossState();
    this.notify();
  }

  // 刷新BOSS状态（面板展示用）
  async refreshWorldBossState() {
    const state = await Api.getWorldBossState();
    if (state && !state.error) {
      this.worldBossInfo = state;
      this.notify();
    }
  }

  // 领取世界BOSS奖励：强制保存当前进度后重拉服务端存档（奖励装备入包）
  async claimWorldBossReward() {
    await this.save(true);
    await this._resyncFromServer();
    this.refreshWorldBossState();
  }

  changeMap(mapId) {
    if (this.inTower) {
      this.addLog('❌ 通天塔战斗中无法切换地图', 'error');
      this.notify();
      return;
    }
    if (this.inWorldBoss) {
      this.addLog('❌ 遮天塔战斗中无法切换地图', 'error');
      this.notify();
      return;
    }
    const map = MAPS.find(m => m.id === mapId);
    if (!map) return;
    // 二大陆进入门槛：通天塔通关30层；首次进入缴纳1000万金币后永久解锁
    if (map.continent === 2) {
      if (this.towerMax < 30) {
        this.addLog('❌ 进入二大陆需要先通关通天塔第 30 层', 'error');
        this.notify();
        return;
      }
      if (this.player.level < map.levelReq) {
        this.addLog(`❌ 需要等级 ${map.levelReq} 才能进入 ${map.name}`, 'error');
        this.notify();
        return;
      }
      if (!this.continent2Unlocked) {
        const fee = 10000000;
        if (this.player.gold < fee) {
          this.addLog(`❌ 首次进入二大陆需缴纳 ${fee.toLocaleString()} 金币（当前 ${Math.floor(this.player.gold).toLocaleString()}）`, 'error');
          this.notify();
          return;
        }
        this.player.gold -= fee;
        this.continent2Unlocked = true;
        this.addLog(`💰 缴纳 ${fee.toLocaleString()} 金币，二大陆永久解锁！`, 'kill');
        this.save(true);
      }
    }
    if (this.player.level < map.levelReq) {
      this.addLog(`❌ 需要等级 ${map.levelReq} 才能进入 ${map.name}`, 'error');
      this.notify();
      return;
    }
    this.currentMap = map;
    this.currentMonster = null;
    this.waveKills = 0;
    this.waveNum = 1;
    this.spawnMonster();
    this.addLog(`📍 进入地图: ${map.name}`, 'info');
    this.notify();
  }

  // 计算地图理论收益（经验/分钟、金币/分钟）
  getMapIncome(map) {
    if (!map || !map.monsters || map.monsters.length === 0) return { expPerMin: 0, goldPerMin: 0, killsPerMin: 0 };
    const totalWeight = map.monsters.reduce((s, m) => s + m.count, 0);
    let weightedExp = 0, weightedGold = 0, weightedHp = 0;
    for (const entry of map.monsters) {
      const mon = MONSTERS[entry.name];
      if (!mon) continue;
      const w = entry.count / totalWeight;
      weightedExp += mon.exp * w;
      weightedHp += mon.hp * w;
      // 金币期望：从掉落表计算
      let dropTable = DROPS[entry.name];
      if (!dropTable) {
        if (mon.level <= 20) dropTable = GENERIC_DROPS.low;
        else if (mon.level <= 40) dropTable = GENERIC_DROPS.mid;
        else dropTable = GENERIC_DROPS.high;
      }
      let goldPerKill = 0;
      for (const drop of dropTable) {
        if (drop.item === '金币') {
          goldPerKill += (drop.count || 100) / drop.chance;
        }
      }
      weightedGold += goldPerKill * w;
    }
    // 估算每回合总输出（普攻 + 技能 + 召唤物 + 毒）
    const effectiveDmg = this.getEffectiveDPS();
    const hitsToKill = Math.max(1, weightedHp / effectiveDmg);
    const killsPerMin = Math.min(60, 60 / hitsToKill);
    return {
      expPerMin: Math.round(weightedExp * killsPerMin),
      goldPerMin: Math.round(weightedGold * killsPerMin),
      killsPerMin: Math.round(killsPerMin * 10) / 10,
    };
  }

  // 伤害来源明细（普攻/技能/召唤/毒伤/特效，用于收益统计展示）
  getDamageBreakdown() {
    const stats = this.getStats();
    const p = this.player;
    const baseDmg = Math.max(1, (stats.minAtk + stats.maxAtk) / 2);

    // 被动技能加成（delay=0）
    let passiveBonus = 0;
    // 触发技能平均加成（delay>0，按冷却周期平均）
    let avgTriggeredBonus = 0;
    // 毒术加成
    let poisonBonus = 0;
    // 召唤技能加成总和（每个技能各生成1只宝宝）
    let summonBonusSum = 0;

    for (const sk of p.equippedSkills) {
      const sd = SKILLS[sk];
      if (!sd) continue;
      if (sd.type === 'summon') {
        summonBonusSum += sd.damageBonus;
        continue;
      }
      if (sd.type === 'attack' && (sk === '施毒术' || sk === '瘟疫' || sk === '毒云')) {
        poisonBonus += sd.damageBonus;
        continue;
      }
      if (!sd.delay || sd.delay === 0) {
        if (sd.type !== 'buff') passiveBonus += sd.damageBonus; // buff技能不加攻击
      } else {
        avgTriggeredBonus += sd.damageBonus / sd.delay; // 平均每回合贡献
      }
    }

    let normal = 0, skill = 0;
    if (p.job === 'warrior') {
      // 战士：普攻含被动加成，技能为触发技能增量
      normal = baseDmg * (1 + passiveBonus);
      skill = baseDmg * avgTriggeredBonus;
    } else {
      // 法师/道士：常驻单体魔法技能（雷电术/火符等）在实战中会被计入普攻段（乘物攻），
      // 但按伤害归属应划入技能(魔法)段，否则普攻占比虚高
      let residentMagicBonus = 0;
      for (const sk of p.equippedSkills) {
        const sd = SKILLS[sk];
        if (sd && sd.type === 'attack' && (!sd.delay || sd.delay === 0) && !sd.aoe
            && sk !== '施毒术' && sk !== '瘟疫' && sk !== '毒云') {
          residentMagicBonus += sd.damageBonus;
        }
      }
      // 法师/道士：普攻只计非攻击类被动加成（与实战公式一致），
      // 常驻魔法技能全部归入技能段，避免普攻占比虚高；passive类归魔法段
      let normalPassiveBonus = 0;
      for (const sk of p.equippedSkills) {
        const sd = SKILLS[sk];
        if (sd && (!sd.delay || sd.delay === 0) && sd.type !== 'buff' && sd.type !== 'attack' && sd.type !== 'summon' && sd.type !== 'passive') {
          normalPassiveBonus += sd.damageBonus;
        }
      }
      normal = baseDmg * (1 + normalPassiveBonus);
      const magicBase = p.job === 'mage' ? stats.maxMc : stats.maxSc;
      // 被动技能（精神力战法等）增强魔法段
      let passiveMagicBonus = 0;
      for (const sk of p.equippedSkills) {
        const sd = SKILLS[sk];
        if (sd && sd.type === 'passive' && (!sd.delay || sd.delay === 0)) passiveMagicBonus += sd.damageBonus;
      }
      // 常驻单体魔法技能全量贡献 + 触发技能平均贡献（含1.0基础系数，与实战公式一致）
      let magicBonusPerTick = avgTriggeredBonus + residentMagicBonus + passiveMagicBonus;
      skill = magicBase * (1 + magicBonusPerTick);
    }

    // AOE溅射估算：让理论DPS反映群怪清场效率（平均每回合溅射总伤）
    const waveSize = (this.currentMap && this.currentMap.waveSize) || 1;
    let aoeSplash = 0;
    if (waveSize > 1) {
      let splashPerTick = 0;
      let hasTaoistAoe = false;
      for (const sk of p.equippedSkills) {
        const sd = SKILLS[sk];
        if (!sd || sd.type !== 'attack' || !sd.aoe || !sd.damageBonus) continue;
        const freq = sd.delay > 0 ? 1 / sd.delay : 1; // 平均触发频率
        if (p.job === 'warrior') {
          splashPerTick += freq * baseDmg * (1 + passiveBonus) * sd.damageBonus * 0.5;
        } else {
          const splashBase = p.job === 'mage' ? stats.maxMc : stats.maxSc;
          splashPerTick += freq * splashBase * sd.damageBonus * (p.job === 'mage' ? 1.0 : 0.5); // 法师溅射不打折扣
          if (p.job === 'taoist') hasTaoistAoe = true;
        }
      }
      // 道士溅射带+1底数：有AOE时每回合额外一份 SC×0.5 基础溅射
      if (hasTaoistAoe) splashPerTick += stats.maxSc * 0.5;
      aoeSplash = splashPerTick * waveSize; // 群攻命中全场：主目标也吃溅射
      skill += aoeSplash;
    }

    // 召唤宝宝伤害（多只共存，每只每回合攻击一次）
    let summon = 0;
    if (summonBonusSum > 0) {
      const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
      summon = Math.max(1, Math.floor(scBase * summonBonusSum * 2.0));
      // 全部召唤物群攻：主目标外的每只怪物各吃一份全额伤害
      if (waveSize > 1) {
        summon += Math.floor(scBase * summonBonusSum * 2.0) * (waveSize - 1);
      }
    }

    // 施毒术DOT（每回合触发，持续3回合，等效于每回合额外毒伤）
    let poison = 0;
    if (poisonBonus > 0) {
      const scBase = stats.maxSc > 0 ? stats.maxSc : stats.maxAtk;
      poison = Math.max(1, Math.floor(scBase * poisonBonus * 0.6));
    }

    // 火焰戒指等特殊装备
    let special = 0;
    const rings = this.getSpecialRings();
    if (rings.includes('火焰')) {
      special = Math.max(1, Math.floor(stats.maxAtk * 0.3));
    }
    // 连击特效（喋血战刃）：每回合25%概率追加一次普攻，平均贡献普攻段×0.25
    if (rings.includes('连击')) {
      special += normal * 0.25;
    }

    const total = Math.max(1, Math.floor(normal + skill + summon + poison + special));
    return { normal: Math.floor(normal), skill: Math.floor(skill), summon, poison, special, aoeSplash: Math.floor(aoeSplash), total };
  }

  // 计算玩家每回合有效总伤害（用于收益估算）
  getEffectiveDPS() {
    return this.getDamageBreakdown().total;
  }

  startIdle() {
    if (this.isIdle) return;
    this.isIdle = true;
    // 开始挂机时重置会话统计、技能明细（停止挂机仅冻结不清零）
    this._session = { kills: 0, bossKills: 0, deaths: 0, exp: 0, gold: 0, dmgPhys: 0, dmgMag: 0, battleMs: 0, activeSince: Date.now() };
    this._skillStats = {};
    this._dropStats = {};
    this.bossPity = 0;
    this.idleTimer = setInterval(() => {
      try {
        // 世界BOSS伤害采集：回合前后取BOSS血量差值，天然覆盖普攻/技能/连击/召唤/毒/火焰戒全部来源
        const wbMon = this.inWorldBoss ? this.currentMonster : null;
        const wbHpBefore = wbMon ? Math.max(0, wbMon.currentHp) : -1;
        this.playerAttack();
        if (wbHpBefore >= 0 && this.inWorldBoss) {
          const cur = this.currentMonster;
          const dealt = wbHpBefore - (cur ? Math.max(0, cur.currentHp) : 0);
          if (dealt > 0) this._wbPendingDmg += dealt;
          this._wbTurns++;
          if (this._wbTurns % 3 === 0) this._wbReport();
        }
        this.save();
      } catch (e) {
        console.error('挂机循环错误:', e);
        this.notify();
      }
    }, 1000);
    this.addLog('⚔️ 开始挂机...', 'info');
    this.notify();
  }

  stopIdle() {
    this.isIdle = false;
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    // 停止挂机：冻结战斗时长（保留本次统计供查看，下次开始挂机时再重置）
    if (this._session && this._session.activeSince > 0) {
      this._session.battleMs += Date.now() - this._session.activeSince;
      this._session.activeSince = 0;
    }
    this.addLog('⏸️ 停止挂机', 'info');
    this.notify();
  }

  addLog(msg, type) {
    this.combatLog.unshift({ msg, type, time: Date.now() });
    if (this.combatLog.length > 100) this.combatLog.pop();
  }

  notify() {
    for (const fn of this.listeners) fn();
  }

  onChange(fn) { this.listeners.push(fn); }

  async save(force = false) {
    const data = {
      player: this.player,
      currentMapId: this.currentMap?.id,
      killCount: this.killCount,
      totalGold: this.totalGold,
      dropLog: this.dropLog,
      towerCleared: this.towerCleared,
      tower_max: this.towerMax,
      continent2_unlocked: this.continent2Unlocked,
      waveSize: this.waveSize,
      auto_hp_threshold: this.autoHpThreshold,
      auto_mp_threshold: this.autoMpThreshold,
      hp_potion: this.hpPotion,
      mp_potion: this.mpPotion,
      dropFilter: this.dropFilter,
    };
    localStorage.setItem('mir2_idle_save', JSON.stringify(data));
    // 服务端同步（每30秒最多一次，force=true时强制立即上传）
    if (Api.isLoggedIn()) {
      const now = Date.now();
      if (force || now - this._lastSyncTime > 30000) {
        this._lastSyncTime = now;
        const syncData = { ...data, _version: this._saveVersion };
        Api.uploadSave(syncData).then(res => {
          if (res && res.version) this._saveVersion = res.version;
          // 服务端变速钳制修正了等级/经验：客户端采纳，避免每次同步重复触发
          this._applyServerCorrection(res);
        }).catch(err => {
          // 版本冲突：服务端被管理员/市场修改，重新拉取
          if (err && err.needSync) {
            this._resyncFromServer();
          }
        });
      }
    }
  }

  // 服务端防作弊钳制后的等级/经验修正回写：采纳服务端值并重算HP/MP上限
  _applyServerCorrection(res) {
    if (!res || !this.player) return;
    if (typeof res.level === 'number' && res.level < this.player.level) {
      const oldLv = this.player.level;
      this.player.level = res.level;
      if (typeof res.exp === 'number') this.player.exp = res.exp;
      const base = getJobBaseStats(this.player.job, this.player.level);
      this.player.maxHp = base.hp;
      this.player.maxMp = base.mp;
      if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
      if (this.player.mp > this.player.maxMp) this.player.mp = this.player.maxMp;
      this.addLog(`🛡️ 服务端收益校验：等级已修正 ${oldLv} → ${res.level}（收益增速超出合法上限）`, 'error');
      this.notify();
    }
  }

  // 强制同步存档到服务端（市场寄售前调用，确保服务端读到最新背包）
  // 返回 true=成功；若提示同步过于频繁会自动等待重试
  async flushToServer() {
    if (!Api.isLoggedIn() || !this.player) return true;
    const data = {
      player: this.player,
      currentMapId: this.currentMap?.id,
      killCount: this.killCount,
      totalGold: this.totalGold,
      dropLog: this.dropLog,
      towerCleared: this.towerCleared,
      tower_max: this.towerMax,
      continent2_unlocked: this.continent2Unlocked,
      waveSize: this.waveSize,
      auto_hp_threshold: this.autoHpThreshold,
      auto_mp_threshold: this.autoMpThreshold,
      hp_potion: this.hpPotion,
      mp_potion: this.mpPotion,
      dropFilter: this.dropFilter,
    };
    localStorage.setItem('mir2_idle_save', JSON.stringify(data));
    for (let attempt = 0; attempt < 3; attempt++) {
      this._lastSyncTime = Date.now();
      const syncData = { ...data, _version: this._saveVersion };
      try {
        const res = await Api.uploadSave(syncData);
        if (res && res.version) this._saveVersion = res.version;
        this._applyServerCorrection(res);
        return true;
      } catch (err) {
        if (err && err.needSync) { this._resyncFromServer(); return false; }
        if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
        return false;
      }
    }
    return false;
  }

  // 从服务端重新拉取存档（版本冲突时调用）
  async _resyncFromServer() {
    try {
      const res = await Api.downloadSave();
      if (res.exists && res.data) {
        this.loadFromData(res.data);
        if (res.version) this._saveVersion = res.version;
        this.addLog('🔄 存档已从服务端同步更新', 'info');
        this.notify();
      }
    } catch (e) { /* 静默失败 */ }
  }

  // 从服务端数据加载存档
  loadFromData(data) {
    if (!data || !data.player) return false;
    this.player = data.player;
    this.currentMap = MAPS.find(m => m.id === data.currentMapId) || MAPS[0];
    this.killCount = data.killCount || 0;
    this.totalGold = data.totalGold || 0;
    this.dropLog = data.dropLog || [];
    this.towerCleared = data.towerCleared || {};
    this.towerMax = data.tower_max || 0;
    this.continent2Unlocked = !!data.continent2_unlocked;
    this.waveSize = data.waveSize || 10; // 默认每波10只
    this.dropFilter = data.dropFilter || []; // 图鉴掉落黑名单
    this._loadPotSettings(data);
    // 兼容旧存档迁移
    this._migrateSave();
    localStorage.setItem('mir2_idle_save', JSON.stringify(data));
    return true;
  }

  load() {
    const raw = localStorage.getItem('mir2_idle_save');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.player = data.player;
      this._migrateSave();
      this.currentMap = MAPS.find(m => m.id === data.currentMapId) || MAPS[0];
      this.killCount = data.killCount || 0;
      this.totalGold = data.totalGold || 0;
      this.dropLog = data.dropLog || [];
      this.towerCleared = data.towerCleared || {};
      this.towerMax = data.tower_max || 0;
      this.continent2Unlocked = !!data.continent2_unlocked;
      this.waveSize = data.waveSize || 10; // 默认每波10只
      this.dropFilter = data.dropFilter || []; // 图鉴掉落黑名单
      this._loadPotSettings(data);
      this.spawnMonster();
      return true;
    } catch (e) { return false; }
  }

  // 自动吃药设置读取（旧存档无字段时用默认值：HP阈值70%、药品AI自选）
  _loadPotSettings(data) {
    this.autoHpThreshold = data.auto_hp_threshold !== undefined ? data.auto_hp_threshold : 0.7;
    this.autoMpThreshold = data.auto_mp_threshold !== undefined ? data.auto_mp_threshold : 0.3;
    this.hpPotion = data.hp_potion || 'auto';
    this.mpPotion = data.mp_potion || 'auto';
  }

  // 存档迁移/修复逻辑（load和loadFromData共用）
  _migrateSave() {
    // 将字符串数组迁移为 {name, count} 格式
    if (this.player.inventory.length > 0 && typeof this.player.inventory[0] === 'string') {
      const merged = {};
      const order = [];
      for (const name of this.player.inventory) {
        if (merged[name]) { merged[name].count = Math.min(9999, merged[name].count + 1); }
        else { merged[name] = { name, count: 1 }; order.push(name); }
      }
      this.player.inventory = order.map(n => merged[n]);
    }
    // 仓库字段补发（旧存档无此字段）
    if (!Array.isArray(this.player.warehouse)) this.player.warehouse = [];
    // 一次性迁移：旧版本掉落词条最高+7/重铸3~9，统一将存量装备词条钳制到最高+3（后续铁匠铺强化不受影响）
    if (!this.player._affixClamp3) {
      let n = 0;
      const clampSlot = s => {
        if (!s || typeof s !== 'object' || !s.bonus) return;
        for (const [k, v] of Object.entries(s.bonus)) {
          const cap = k === 'hp' ? 30 : 3;
          if (v > cap) { s.bonus[k] = cap; n++; }
        }
      };
      for (const s of Object.values(this.player.equipment || {})) clampSlot(s);
      for (const s of this.player.inventory || []) clampSlot(s);
      for (const s of this.player.warehouse || []) clampSlot(s);
      this.player._affixClamp3 = true;
      if (n > 0) this.addLog(`⚒️ 版本调整：${n}件存量装备词条已降至最高+3`, 'info');
    }
    // 手镯/戒指单槽迁移为双槽
    const eq = this.player.equipment;
    if ('bracelet' in eq) { eq.bracelet1 = eq.bracelet; eq.bracelet2 = null; delete eq.bracelet; }
    if ('ring' in eq) { eq.ring1 = eq.ring; eq.ring2 = null; delete eq.ring; }
    if (!('bracelet1' in eq)) { eq.bracelet1 = null; eq.bracelet2 = null; }
    if (!('ring1' in eq)) { eq.ring1 = null; eq.ring2 = null; }
    if (!('jade' in eq)) { eq.jade = null; }
    // skills数组迁移为 learnedSkills/equippedSkills
    if ('skills' in this.player && !('learnedSkills' in this.player)) {
      this.player.learnedSkills = this.player.skills.slice(0);
      this.player.equippedSkills = this.player.skills.slice(0, 3);
      delete this.player.skills;
    }
    if (this.player.learnedSkills && !Array.isArray(this.player.learnedSkills)) {
      this.player.learnedSkills = Object.keys(this.player.learnedSkills);
    }
    if (!this.player.learnedSkills) this.player.learnedSkills = [];
    if (!this.player.equippedSkills) this.player.equippedSkills = [];
    // 迁移到mirror-master职业成长表，重算HP/MP
    const base = getJobBaseStats(this.player.job, this.player.level);
    this.player.maxHp = base.hp;
    this.player.maxMp = base.mp;
    if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
    if (this.player.mp > this.player.maxMp) this.player.mp = this.player.maxMp;
    // 合并背包中同名可叠加物品（含材料：存量重复的祝福油/龙鳞合并为一条）
    const merged = {};
    const order = [];
    for (const slot of this.player.inventory) {
      const info = ITEMS[slot.name];
      const canStack = info && (info.type === 'potion' || info.type === 'skillbook' || info.type === 'material');
      if (canStack && merged[slot.name]) {
        merged[slot.name].count += slot.count || 1;
      } else if (canStack) {
        merged[slot.name] = { name: slot.name, count: slot.count || 1 };
        order.push(slot.name);
      } else {
        const key = '__eq_' + order.length + '_' + slot.name;
        merged[key] = slot;
        order.push(key);
      }
    }
    this.player.inventory = order.map(k => merged[k]);
    // 为无uid的旧条目补发uid（寄售按uid精确识别）
    for (const slot of this.player.inventory) {
      if (!slot.uid) slot.uid = this.nextItemUid++;
      else if (slot.uid >= this.nextItemUid) this.nextItemUid = slot.uid + 1;
    }
  }

  buyPotion(potionName, qty = 5) {
    const p = this.player;
    const info = ITEMS[potionName];
    if (!info || info.type !== 'potion') return;
    const cost = info.price * qty;
    if (p.gold >= cost) {
      p.gold -= cost;
      const existing = p.inventory.find(x => x.name === potionName);
      if (existing) {
        existing.count = Math.min(9999, existing.count + qty);
      } else {
        p.inventory.push({ uid: this.nextItemUid++, name: potionName, count: qty });
      }
      this.addLog(`🛒 购买 ${potionName} x${qty} (-${cost}金币)`, 'info');
    } else {
      this.addLog(`❌ 金币不足，需要${cost}金币`, 'error');
    }
    this.notify();
  }

  sellItem(index) {
    const p = this.player;
    const slot = p.inventory[index];
    if (!slot) return;
    if (slot.locked) {
      this.addLog('🔒 该装备已锁定，请先解锁再出售', 'error');
      this.notify();
      return;
    }
    const itemName = slot.name;
    const item = ITEMS[itemName];
    const price = item?.price || 50;
    const sellPrice = Math.floor(price * 0.5);
    p.gold += sellPrice;
    slot.count--;
    if (slot.count <= 0) p.inventory.splice(index, 1);
    this.addLog(`💰 出售 ${itemName} 获得 ${sellPrice} 金币`, 'drop');
    this.notify();
  }

  // === 装备图鉴：掉落黑名单切换（勾选=该装备不再掉落） ===
  toggleDropFilter(name) {
    const idx = this.dropFilter.indexOf(name);
    if (idx >= 0) this.dropFilter.splice(idx, 1);
    else this.dropFilter.push(name);
    this.save();
    this.notify();
  }

  sellFilteredEquip() {
    if (this.sellThreshold <= 0) { this.addLog('🗑️ 装备过滤已关闭', 'info'); this.notify(); return; }
    const p = this.player;
    let sold = 0, gold = 0;
    for (let i = p.inventory.length - 1; i >= 0; i--) {
      const slot = p.inventory[i];
      const info = ITEMS[slot.name];
      if (!info || ['potion','buff','material','skillbook'].includes(info.type)) continue;
      if (slot.locked) continue;
      if (info.special) continue; // 特戒靠特效保值，不参与过滤出售
      const bonusVal = slot.bonus ? (Object.values(slot.bonus)[0] || 0) : 0;
      if (bonusVal < this.sellThreshold) {
        const item = ITEMS[slot.name];
        const sellPrice = Math.floor((item?.price || 50) * 0.5);
        p.gold += sellPrice;
        gold += sellPrice;
        sold++;
        p.inventory.splice(i, 1);
      }
    }
    if (sold > 0) this.addLog(`🗑️ 过滤出售 ${sold} 件装备，获得 ${gold} 金币`, 'info');
    else this.addLog(`🗑️ 装备过滤已开启：加成<${this.sellThreshold}自动出售（背包无符合出售条件的装备）`, 'info');
    this.notify();
  }

  // 一键出售：背包内所有未锁定装备（药水/技能书/材料不受影响），售价=原价50%
  sellAllUnlockedEquip() {
    const p = this.player;
    let sold = 0, gold = 0;
    for (let i = p.inventory.length - 1; i >= 0; i--) {
      const slot = p.inventory[i];
      const info = ITEMS[slot.name];
      if (!info || ['potion','buff','material','skillbook'].includes(info.type)) continue;
      if (slot.locked) continue;
      const sellPrice = Math.floor((info.price || 50) * 0.5);
      p.gold += sellPrice;
      gold += sellPrice;
      sold++;
      p.inventory.splice(i, 1);
    }
    if (sold > 0) {
      this.addLog(`💸 一键出售 ${sold} 件未锁定装备，获得 ${gold} 金币`, 'info');
      this.save();
    } else {
      this.addLog('💸 背包里没有可出售的未锁定装备', 'info');
    }
    this.notify();
  }

  // 一键卖药水：背包内所有药水（含堆叠数量），售价=原价50%
  sellAllPotions() {
    const p = this.player;
    let sold = 0, gold = 0;
    for (let i = p.inventory.length - 1; i >= 0; i--) {
      const slot = p.inventory[i];
      const info = ITEMS[slot.name];
      if (!info || info.type !== 'potion') continue;
      const count = slot.count || 1;
      const sellPrice = Math.floor((info.price || 50) * 0.5) * count;
      p.gold += sellPrice;
      gold += sellPrice;
      sold += count;
      p.inventory.splice(i, 1);
    }
    if (sold > 0) {
      this.addLog(`💊 一键出售 ${sold} 瓶药水，获得 ${gold} 金币`, 'info');
      this.save();
    } else {
      this.addLog('💊 背包里没有可出售的药水', 'info');
    }
    this.notify();
  }

  // === 铁匠铺：词条强化，消耗1片龙鳞+50000金币概率给词条+1点（最高+7） ===
  getReforgeCost() { return { gold: 50000, scale: 1 }; }

  // 词条强化成功率（当前点数→+1），难度随+N提升，无词条时首次必成
  getReforgeChance(points) {
    const table = { 0: 1.0, 1: 0.9, 2: 0.8, 3: 0.65, 4: 0.5, 5: 0.35, 6: 0.25 };
    return table[points] !== undefined ? table[points] : 0;
  }

  // 词条当前点数（hp词条按×10存储，需除回）
  bonusPoints(slot) {
    if (!slot.bonus) return 0;
    const [key, val] = Object.entries(slot.bonus)[0];
    return key === 'hp' ? Math.floor(val / 10) : val;
  }

  getMaterialCount(name) {
    const slot = this.player.inventory.find(x => x.name === name);
    return slot ? (slot.count || 0) : 0;
  }

  _consumeMaterial(name, n = 1) {
    const slot = this.player.inventory.find(x => x.name === name);
    if (!slot || (slot.count || 0) < n) return false;
    slot.count -= n;
    if (slot.count <= 0) this.player.inventory.splice(this.player.inventory.indexOf(slot), 1);
    return true;
  }

  reforgeItem(index) {
    const p = this.player;
    const slot = p.inventory[index];
    if (!slot) return;
    const info = ITEMS[slot.name];
    if (!info || ['potion','buff','material','skillbook'].includes(info.type)) {
      this.addLog('⚒️ 只有装备才能强化词条', 'error');
      this.notify();
      return;
    }
    const points = this.bonusPoints(slot);
    if (points >= 7) {
      this.addLog('⚒️ 该装备词条已达最高+7，无法继续强化', 'error');
      this.notify();
      return;
    }
    const cost = this.getReforgeCost();
    if (this.getMaterialCount('龙鳞') < cost.scale) {
      this.addLog('⚒️ 强化需要龙鳞×1（魔龙教主1/20掉落）', 'error');
      alert('⚒️ 强化需要龙鳞×1\n（魔龙教主 1/20 掉落）');
      this.notify();
      return;
    }
    if (p.gold < cost.gold) {
      this.addLog(`⚒️ 金币不足，强化需要${cost.gold}金币`, 'error');
      this.notify();
      return;
    }
    this._consumeMaterial('龙鳞', cost.scale);
    p.gold -= cost.gold;
    const fmt = (k, pts) => '+' + pts + ({ atk: '攻', mc: '魔', sc: '道', def: '防', magDef: '魔防', hp: 'HP' }[k] || k);
    const chance = this.getReforgeChance(points);
    if (Math.random() < chance) {
      if (points === 0) {
        // 无词条：首次强化必成，随机赋予1点词条
        slot.bonus = this.rollBonus(info, 1, 1);
        const [k] = Object.entries(slot.bonus)[0];
        this.addLog(`⚒️ 强化 ${slot.name}：赋予词条 ${fmt(k, 1)}（消耗龙鳞×1、金币${cost.gold}）`, 'info');
      } else {
        const [k, v] = Object.entries(slot.bonus)[0];
        slot.bonus[k] = k === 'hp' ? v + 10 : v + 1;
        this.addLog(`⚒️ 强化成功 ${slot.name}：${fmt(k, points)} → ${fmt(k, points + 1)}（消耗龙鳞×1、金币${cost.gold}）`, 'info');
      }
    } else {
      this.addLog(`⚒️ 强化失败 ${slot.name}：词条保持+${points}不变（成功率${Math.round(chance * 100)}%，消耗龙鳞×1、金币${cost.gold}）`, 'error');
    }
    this.save();
    this.notify();
  }

  // === 铁匠铺：幸运强化，消耗祝福油×1给武器+幸运（最高+7，失败可能诅咒-1） ===
  blessWeapon(target) {
    const p = this.player;
    let slot = null;
    if (target === 'equipped') {
      if (typeof p.equipment.weapon === 'string') {
        // 旧存档字符串格式归一为对象，方便挂luck字段
        p.equipment.weapon = { name: p.equipment.weapon, count: 1 };
      }
      slot = p.equipment.weapon;
    } else {
      slot = p.inventory[target];
    }
    if (!slot) return;
    const info = ITEMS[slot.name];
    if (!info || info.type !== 'weapon') {
      this.addLog('⚒️ 只有武器才能进行幸运强化', 'error');
      this.notify();
      return;
    }
    const luck = slot.luck || 0;
    if (luck >= 7) {
      this.addLog(`✨ ${slot.name} 已达幸运+7极限，无法再强化`, 'info');
      this.notify();
      return;
    }
    if (this.getMaterialCount('祝福油') < 1) {
      this.addLog('⚒️ 幸运强化需要祝福油×1（沃玛/祖玛/魔龙教主掉落）', 'error');
      alert('⚒️ 幸运强化需要祝福油×1\n（沃玛教主 1/400、祖玛教主 1/300、魔龙/火龙/幽灵教主 1/20 掉落）');
      this.notify();
      return;
    }
    this._consumeMaterial('祝福油', 1);
    const chance = this.getBlessChance(luck);
    const oldLabel = Game.luckLabel(luck) || '无幸运';
    if (Math.random() < chance) {
      slot.luck = luck + 1;
      const newLabel = Game.luckLabel(slot.luck);
      this.addLog(slot.luck > 0
        ? `✨ 祝福成功！${slot.name}：${oldLabel} → ${newLabel}（攻击更靠近上限）`
        : `✨ 祝福成功！${slot.name} 诅咒被洗除：${oldLabel} → 无幸运`, 'level');
    } else {
      if (Math.random() < 0.5) {
        this.addLog(`🕯️ 祝福失败…${slot.name} 幸运保持不变（${oldLabel}）`, 'info');
      } else {
        slot.luck = Math.max(-7, luck - 1);
        this.addLog(`💀 祝福失败！${slot.name} 被诅咒：${oldLabel} → ${Game.luckLabel(slot.luck)}（攻击更靠近下限）`, 'error');
      }
    }
    this.save();
    this.notify();
  }

  unequipItem(slot) {
    const p = this.player;
    const data = p.equipment[slot];
    if (!data) return;
    const name = typeof data === 'string' ? data : data.name;
    const bonus = typeof data === 'object' ? data.bonus : null;
    this.addItem(name, bonus, typeof data === 'object' ? data.luck : undefined);
    p.equipment[slot] = null;
    this.addLog(`📤 卸下装备: ${name}`, 'info');
    const stats = this.getStats();
    p.maxHp = stats.maxHp; p.maxMp = stats.maxMp;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    this.notify();
  }

  // === 转职：花费10万金币切换职业（Lv25+，需停止挂机） ===
  changeJob(newJob) {
    const p = this.player;
    const jobLabel = { warrior: '战士', mage: '法师', taoist: '道士' };
    if (!['warrior', 'mage', 'taoist'].includes(newJob)) return false;
    if (newJob === p.job) { this.addLog('🔄 当前已是该职业，无需转职', 'info'); this.notify(); return false; }
    if (this.isIdle) { this.addLog('🔄 请先停止挂机再转职', 'error'); this.notify(); return false; }
    if (p.level < 25) { this.addLog('🔄 转职需要等级≥25', 'error'); this.notify(); return false; }
    if (p.gold < 100000) { this.addLog('🔄 转职需要10万金币', 'error'); this.notify(); return false; }
    p.gold -= 100000;
    const oldJob = p.job;
    // 装备保留：转职不卸下任何装备（装备属性结算无职业限制，避免背包满时装备丢失）
    // 保底：武器/衣服为空时发放通用初始装
    if (!p.equipment.weapon) p.equipment.weapon = '木剑';
    if (!p.equipment.armor) p.equipment.armor = '布衣';
    // 技能清洗：卸下非新职业技能（learnedSkills全保留，转回可直接装载）
    for (const sk of [...p.equippedSkills]) {
      const sd = SKILLS[sk];
      if (!sd || sd.job !== newJob) {
        const idx = p.equippedSkills.indexOf(sk);
        if (idx !== -1) p.equippedSkills.splice(idx, 1);
        delete this.skillCooldowns[sk];
        this.addLog(`📤 转职卸下技能: ${sk}`, 'info');
      }
    }
    // 战斗状态清空（防宝宝/魅惑/隐身等状态残留）
    this.playerMinions = [];
    this.summonedMinions = [];
    this.charmedMinion = null;
    this.memoryMinion = null;
    this.stealthTurns = 0;
    this.playerPoison = 0;
    this.playerPoisonDmg = 0;
    this.playerStunned = false;
    // 属性重算：HP/MP按转职前百分比折算
    const hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const mpPct = p.maxMp > 0 ? p.mp / p.maxMp : 1;
    p.job = newJob;
    const stats = this.getStats();
    p.maxHp = stats.maxHp; p.maxMp = stats.maxMp;
    p.hp = Math.max(1, Math.floor(p.maxHp * hpPct));
    p.mp = Math.max(0, Math.floor(p.maxMp * mpPct));
    this.addLog(`🔄 转职成功：${jobLabel[oldJob]} → ${jobLabel[newJob]}（花费10万金币，装备全部保留）`, 'level');
    this.save(true); // 强制立即同步，保证排行榜/后台职业即时更新
    this.notify();
    return true;
  }

  toggleLock(index) {
    const slot = this.player.inventory[index];
    if (!slot) return;
    slot.locked = !slot.locked;
    this.notify();
  }

  // 技能槽数量按等级解锁：Lv1-19=3 / Lv20-34=4 / Lv35-49=5 / Lv50+=6
  getMaxSkillSlots() {
    const lv = this.player.level;
    if (lv >= 50) return 6;
    if (lv >= 35) return 5;
    if (lv >= 20) return 4;
    return 3;
  }

  equipSkill(skillName) {
    const p = this.player;
    if (!p.learnedSkills.includes(skillName)) return;
    if (p.equippedSkills.includes(skillName)) return;
    const sd = SKILLS[skillName];
    if (sd && sd.job !== p.job) {
      this.addLog(`❌ ${skillName}不属于当前职业，转职后才能装载`, 'error');
      this.notify();
      return;
    }
    const maxSlots = this.getMaxSkillSlots();
    if (p.equippedSkills.length >= maxSlots) {
      this.addLog(`❌ 技能槽已满(${maxSlots}个)，请先卸下技能`, 'error');
      this.notify();
      return;
    }
    p.equippedSkills.push(skillName);
    this.addLog(`⚔️ 装载技能: ${skillName}`, 'info');
    this.notify();
  }

  unequipSkill(skillName) {
    const p = this.player;
    const idx = p.equippedSkills.indexOf(skillName);
    if (idx === -1) return;
    p.equippedSkills.splice(idx, 1);
    delete this.skillCooldowns[skillName]; // 清除冷却状态
    const li = p.learnedSkills.indexOf(skillName);
    if (li !== -1) p.learnedSkills.splice(li, 1);
    this.addLog(`📤 卸下并遗忘技能: ${skillName}`, 'info');
    this.notify();
  }

  forgetSkill(skillName) {
    const p = this.player;
    const li = p.learnedSkills.indexOf(skillName);
    if (li === -1) return;
    p.learnedSkills.splice(li, 1);
    this.addLog(`🗑️ 遗忘技能: ${skillName}`, 'info');
    this.notify();
  }

  // 切换账号时全量清空内存状态（登录成功/退出/401失效时调用）：
  // 防止新账号无服务端存档时残留旧账号角色被显示、并被自动save上传污染新账号存档
  clearSession() {
    this.stopIdle();
    this.resetSave();
    this.currentMap = null;
    this.currentMonsters = [];
    this.dropFilter = [];
    this.towerMax = 0;
    this.continent2Unlocked = false;
    this._saveVersion = 0;
    this._lastSyncTime = 0;
    this.playerMinions = [];
    this.summonedMinions = [];
    this.charmedMinion = null;
    this.memoryMinion = null;
    this.skillCooldowns = {};
    this.playerPoison = 0;
    this.playerPoisonDmg = 0;
    this.playerStunned = false;
    this.inTower = false;
    this.inWorldBoss = false;
    this.showWorldBossPanel = false;
    this.worldBossInfo = null;
    this.showRankPanel = false;
    this.showMarketPanel = false;
    this.showBlacksmithPanel = false;
  }

  resetSave() {
    localStorage.removeItem('mir2_idle_save');
    this.player = null;
    this.currentMonster = null;
    this.combatLog = [];
    this.dropLog = [];
    this.killCount = 0;
    this.totalGold = 0;
    this.inTower = false;
    this.towerFloor = 0;
    this.towerMonIdx = 0;
    this.towerCleared = {};
    this.showTowerPanel = false;
    this.stopIdle();
    this.notify();
  }
}

const game = new Game();
