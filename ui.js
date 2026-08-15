// UI渲染系统
function formatNum(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + '万亿';
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return Math.floor(n).toString();
}

// 下拉菜单是否处于展开状态（展开期间跳过重渲染，防止每秒刷新关闭菜单/重置选中值）
let _selectOpen = false;
document.addEventListener('mousedown', e => { if (e.target && e.target.tagName === 'SELECT') _selectOpen = true; });
document.addEventListener('change', e => { if (e.target && e.target.tagName === 'SELECT') _selectOpen = false; });
document.addEventListener('blur', e => { if (e.target && e.target.tagName === 'SELECT') _selectOpen = false; }, true);

// 技能伤害明细面板展开状态（每秒重渲染不重置）
let _showSkillStats = false;
// 掉落物品统计面板展开状态
let _showDropStats = false;

// 需要保持滚动位置的容器
const SCROLL_KEEP_SELECTORS = ['.log-list', '.inventory-list', '.monster-group', '.drop-list', '.left-panel', '.right-panel', '.center-panel'];

function renderApp() {
  const app = document.getElementById('app');
  // 用户正在操作下拉菜单/输入框时跳过重渲染，避免状态被重置
  const ae = document.activeElement;
  if (_selectOpen || (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'))) return;
  // 渲染前快照滚动位置
  const snapScroll = SCROLL_KEEP_SELECTORS.map(sel => {
    const el = document.querySelector(sel);
    return { sel, top: el ? el.scrollTop : 0 };
  });
  const snapWin = window.scrollY;
  // 渲染前快照所有下拉框选中值（防止重渲染按模板默认值重建，如地图、过滤、药品选择等）
  const snapSelects = Array.from(document.querySelectorAll('select'))
    .filter(s => s.id)
    .map(s => ({ id: s.id, value: s.value }));
  if (!Api.isLoggedIn()) {
    app.innerHTML = renderLogin();
  } else if (!game.player) {
    app.innerHTML = renderCharSelect();
  } else {
    app.innerHTML = renderGame();
  }
  bindEvents();
  // 渲染后恢复下拉框选中值
  for (const s of snapSelects) {
    const el = document.getElementById(s.id);
    if (el && el.value !== s.value) el.value = s.value;
  }
  // 渲染后恢复滚动位置
  for (const s of snapScroll) {
    if (s.top > 0) {
      const el = document.querySelector(s.sel);
      if (el) el.scrollTop = s.top;
    }
  }
  window.scrollTo(0, snapWin);
}

function renderLogin() {
  return `
  <div class="char-select">
    <h1>🐉 传奇挂机</h1>
    <p class="subtitle">联网版 - 基于GeeM2 1.76服务端</p>
    <div class="login-box">
      <div class="login-tabs">
        <button class="login-tab active" id="tab-login">登录</button>
        <button class="login-tab" id="tab-register">注册</button>
      </div>
      <div class="login-form">
        <input type="text" id="input-username" placeholder="用户名 (2-16字符)" maxlength="16" />
        <input type="password" id="input-password" placeholder="密码 (至少4字符)" maxlength="32" />
        <div class="login-msg" id="login-msg"></div>
        <button class="btn btn-login" id="btn-login-submit">登录</button>
      </div>
    </div>
  </div>`;
}

function renderCharSelect() {
  return `
  <div class="char-select">
    <h1>🐉 传奇挂机</h1>
    <p class="subtitle">基于GeeM2 1.76服务端配置</p>
    <div class="job-cards">
      <div class="job-card" data-job="warrior">
        <div class="job-icon">⚔️</div>
        <h3>战士</h3>
        <p>近战物理攻击，高血量高防御</p>
        <small>HP+++ ATK++ DEF++</small>
      </div>
      <div class="job-card" data-job="mage">
        <div class="job-icon">🔮</div>
        <h3>法师</h3>
        <p>远程魔法攻击，高魔法伤害</p>
        <small>MP+++ MAGATK+++ HP+</small>
      </div>
      <div class="job-card" data-job="taoist">
        <div class="job-icon">☯️</div>
        <h3>道士</h3>
        <p>辅助召唤，攻守兼备</p>
        <small>HP++ MP++ MAGATK++ 治愈</small>
      </div>
    </div>
  </div>`;
}

function renderGame() {
  const p = game.player;
  const stats = game.getStats();
  const expNeeded = game.getExpNeeded();
  const expPct = Math.min(100, (p.exp / expNeeded * 100)).toFixed(2);
  const hpPct = Math.max(0, (p.hp / stats.maxHp * 100)).toFixed(1);
  const mpPct = Math.max(0, (p.mp / stats.maxMp * 100)).toFixed(1);
  const mon = game.currentMonster;
  const monsters = game.currentMonsters.filter(m => m.currentHp > 0);

  return `
  <div class="game-layout">
    <header class="game-header">
      <span class="player-name">${p.job === 'warrior' ? '⚔️' : p.job === 'mage' ? '🔮' : '☯️'} ${p.name} Lv.${p.level}</span>
      <span class="gold">💰 ${formatNum(p.gold)}</span>
      <span class="kills">☠️ ${game.killCount}</span>
      <button id="btn-rank" class="btn-small btn-rank">🏆排行</button>
      <button id="btn-market" class="btn-small btn-market">🏪寄售</button>
      <button id="btn-tower" class="btn-small btn-tower">🗼通天塔</button>
      <button id="btn-worldboss" class="btn-small btn-tower">🐲遮天塔</button>
      <button id="btn-logout" class="btn-small btn-danger">退出</button>
      <button id="btn-blacksmith" class="btn-small btn-market">⚒️铁匠</button>
      <button id="btn-changejob" class="btn-small btn-market">🔄转职</button>
    </header>

    <div class="main-content">
      <div class="left-panel">
        <section class="panel stats-panel">
          <h3>角色属性</h3>
          <div class="bar-group">
            <label>HP</label>
            <div class="bar hp-bar"><div class="bar-fill" style="width:${hpPct}%"></div><span>${Math.floor(p.hp)}/${stats.maxHp}</span></div>
          </div>
          <div class="bar-group">
            <label>MP</label>
            <div class="bar mp-bar"><div class="bar-fill" style="width:${mpPct}%"></div><span>${Math.floor(p.mp)}/${stats.maxMp}</span></div>
          </div>
          <div class="bar-group">
            <label>EXP</label>
            <div class="bar exp-bar"><div class="bar-fill" style="width:${expPct}%"></div><span>${expPct}%</span></div>
          </div>
          <div class="stat-grid">
            <div>攻击: ${stats.minAtk}-${stats.maxAtk}</div>
            <div>防御: ${stats.minDef}-${stats.maxDef}</div>
            <div>魔防: ${stats.minMagDef}-${stats.maxMagDef}</div>
            ${p.job === 'mage' ? `<div>魔法(MC): ${stats.minMc}-${stats.maxMc}</div>` : p.job === 'taoist' ? `<div>道术(SC): ${stats.minSc}-${stats.maxSc}</div>` : `<div>魔法(MC): ${stats.minMc}-${stats.maxMc}</div><div>道术(SC): ${stats.minSc}-${stats.maxSc}</div>`}
            <div>经验: ${formatNum(p.exp)}/${formatNum(expNeeded)}</div>
          </div>
          <div class="skill-panel">
            <strong>技能槽 (${p.equippedSkills.length}/${game.getMaxSkillSlots()}):</strong>
            <div class="skill-slots">
              ${Array.from({ length: game.getMaxSkillSlots() }, (_, i) => i).map(i => {
                const sk = p.equippedSkills[i];
                if (!sk) return `<span class="skill-slot empty">空</span>`;
                const sd = SKILLS[sk];
                const pct = sd ? Math.round(sd.damageBonus * 100) : 0;
                const typeIcon = sd ? ({attack:'⚔',passive:'🔹',buff:'🛡',summon:'👻',utility:'✨',heal:'💚'}[sd.type]||'') : '';
                const cd = sd && sd.delay > 0 ? (game.skillCooldowns[sk] || 0) : 0;
                const cdTag = sd && sd.delay > 0 ? (cd <= 0 ? `<small class="cd-ready">✦就绪</small>` : `<small class="cd-wait">↻${cd}回合</small>`) : `<small class="cd-passive">常驻</small>`;
                return `<span class="skill-slot filled" title="${sd ? sd.desc + ' | 伤害+' + pct + '%' + (sd.delay > 0 ? ' | 冷却:' + sd.delay + '回合' : ' | 每次攻击触发') : ''}">${typeIcon}${sk}<small>+${pct}%</small>${cdTag}<button class="btn-skill-off" data-skill="${sk}">卸</button></span>`;
              }).join('')}
            </div>
            ${(() => {
              const unequipped = p.learnedSkills.filter(sk => !p.equippedSkills.includes(sk));
              const usable = unequipped.filter(sk => SKILLS[sk] && SKILLS[sk].job === p.job);
              const otherCount = unequipped.length - usable.length;
              if (unequipped.length === 0) return '';
              return `<div class="skill-bench"><small>待装载：</small>${usable.map(sk => {
                const sd = SKILLS[sk];
                const typeIcon = sd ? ({attack:'⚔',passive:'🔹',buff:'🛡',summon:'👻',utility:'✨',heal:'💚'}[sd.type]||'') : '';
                return `<span class="skill-slot bench">${typeIcon}${sk}<button class="btn-skill-on" data-skill="${sk}" ${p.equippedSkills.length >= game.getMaxSkillSlots() ? 'disabled title="技能槽已满"' : ''}>装</button></span>`;
              }).join('')}${otherCount > 0 ? `<small class="cd-wait">（另有${otherCount}个其他职业技能，转职后可用）</small>` : ''}</div>`;
            })()}
          </div>
        </section>

        <section class="panel equip-panel">
          <h3 class="equip-title">装备栏 ${renderEquipSlot('jade', '宝玉')}</h3>
          <div class="equip-grid">
            ${renderEquipSlot('weapon', '武器')}
            ${renderEquipSlot('armor', '衣服')}
            ${renderEquipSlot('helmet', '头盔')}
            ${renderEquipSlot('necklace', '项链')}
            ${renderEquipSlot('bracelet1', '手镯①')}
            ${renderEquipSlot('bracelet2', '手镯②')}
            ${renderEquipSlot('ring1', '戒指①')}
            ${renderEquipSlot('ring2', '戒指②')}
            ${renderEquipSlot('boots', '鞋子')}
            ${renderEquipSlot('belt', '腰带')}
          </div>
        </section>
      </div>

      <div class="center-panel">
        <section class="panel map-panel">
          <select id="map-select" class="map-select">
            ${MAPS.map(m => {
              const c2 = m.continent === 2;
              const towerOk = game.towerMax >= 30;
              const disabled = p.level < m.levelReq || (c2 && !towerOk);
              const tag = c2 ? (!towerOk ? ' 🔒通天塔30层未通关' : (game.continent2Unlocked ? ' ·二大陆' : ' ·二大陆(首次进入缴1000万金币)')) : '';
              return `<option value="${m.id}" ${game.currentMap?.id === m.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${m.name} (Lv.${m.levelReq})${tag}</option>`;
            }).join('')}
          </select>
          ${(() => {
            const rate = game.getRateStats();
            const predTag = rate.predicted ? ' <small style="color:#ffd740">(均值)</small>' : '';
            const bs = Math.floor(rate.battleSec);
            const durStr = bs >= 3600 ? `${Math.floor(bs / 3600)}时${Math.floor(bs % 3600 / 60)}分` : bs >= 60 ? `${Math.floor(bs / 60)}分${bs % 60}秒` : `${bs}秒`;
            // 技能伤害明细表（本次挂机累计，按总伤害降序）
            const ss = game.getSkillStats();
            let skillTableHtml;
            if (ss.length === 0) {
              skillTableHtml = '<div style="font-size:12px;color:#888;margin-top:6px">暂无战斗数据，开始挂机后自动统计</div>';
            } else {
              const rowsHtml = ss.map(e => {
                const icon = (typeof SKILL_ICONS !== 'undefined' && SKILL_ICONS[e.name]) ? SKILL_ICONS[e.name] : (e.name === '普攻' ? '⚔️' : '📌');
                return `<tr><td style="text-align:left;padding:2px 6px">${icon} ${e.name}</td><td style="text-align:right;padding:2px 6px">${formatNum(e.dmg)}</td><td style="text-align:right;padding:2px 6px">${formatNum(e.count)}</td><td style="text-align:right;padding:2px 6px">${formatNum(e.avg)}</td></tr>`;
              }).join('');
              skillTableHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">
                <thead><tr style="color:#ffd740"><th style="text-align:left;padding:2px 6px;border-bottom:1px solid #444">技能</th><th style="text-align:right;padding:2px 6px;border-bottom:1px solid #444">总伤害</th><th style="text-align:right;padding:2px 6px;border-bottom:1px solid #444">次数</th><th style="text-align:right;padding:2px 6px;border-bottom:1px solid #444">均伤</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table>`;
            }
            const bd = game.getDamageBreakdown();
            // 掉落物品统计（本次挂机，按怪物分组：BOSS优先，其余按等级降序）
            const ds = game.getDropStats();
            let dropStatsHtml;
            if (ds.length === 0) {
              dropStatsHtml = '<div style="font-size:12px;color:#888;margin-top:6px">本次挂机暂无物品掉落</div>';
            } else {
              dropStatsHtml = ds.map(g => {
                const headIcon = g.boss ? '👑' : '👾';
                const bossTag = g.boss ? ' <b style="color:#ff8f00">BOSS</b>' : '';
                const itemsHtml = g.items.map(it => `<span style="margin-right:10px;white-space:nowrap">${it.name} <b style="color:#ffd740">×${it.count}</b></span>`).join('');
                return `<div style="margin-top:5px;font-size:12px"><div style="color:#82b1ff">${headIcon} ${g.from} Lv.${g.level}${bossTag} <span style="color:#666">(${g.total}件)</span></div><div style="color:#ccc;margin-top:2px;padding-left:20px">${itemsHtml}</div></div>`;
              }).join('');
            }
            const segs = [
              { label: '普攻', val: bd.normal, color: '#82b1ff' },
              { label: '技能', val: bd.skill, color: '#ffd740' },
              { label: '召唤', val: bd.summon, color: '#b388ff' },
              { label: '毒伤', val: bd.poison, color: '#69f0ae' },
              { label: '特效', val: bd.special, color: '#ff8a80' },
            ].filter(s => s.val > 0);
            const barHtml = segs.map(s => `<div class="dps-seg" style="width:${(s.val / bd.total * 100).toFixed(1)}%;background:${s.color}" title="${s.label} ${Math.round(s.val / bd.total * 100)}% (${formatNum(s.val)})"></div>`).join('');
            const legendHtml = segs.filter(s => s.val / bd.total >= 0.01).map(s => `<span style="color:${s.color}">■${s.label}${Math.round(s.val / bd.total * 100)}%</span>`).join('');
            return `<div class="map-income">
              <span class="income-item" title="本次挂机累计击杀 ÷ 战斗时长，与伤害明细同源">⚔️ ${rate.kills.toFixed(1)} 击杀/分${predTag}</span>
              <span class="income-item">✨ ${formatNum(Math.round(rate.exp))} 经验/分</span>
              <span class="income-item">💰 ${formatNum(Math.round(rate.gold))} 金币/分</span>
              <span class="income-item" title="物理伤害">🛡️ ${formatNum(Math.round(rate.dmgPhys))} 承受物伤/分</span>
              <span class="income-item" title="魔法伤害（含毒）">🔮 ${formatNum(Math.round(rate.dmgMag))} 承受魔伤/分</span>
              <span class="income-item" title="本次挂机累计">👾 击杀 ${formatNum(rate.sessionKills)} 只${rate.sessionBossKills > 0 ? ` <b style="color:#ff8f00">(BOSS ${rate.sessionBossKills})</b>` : ''}${rate.sessionDeaths > 0 ? ` 💀死亡 ${rate.sessionDeaths}` : ''}</span>
              <span class="income-item" title="本次挂机战斗时长">⏱️ ${durStr}</span>
              <span class="income-item"${bd.aoeSplash > 0 ? ` title="含群攻溅射估算 ${formatNum(bd.aoeSplash)}/回合"` : ''}>📊 DPS ${formatNum(bd.total)}/回合${bd.aoeSplash > 0 ? ' ⚡群' : ''}</span>
              <div class="dps-bar">${barHtml}</div>
              <div class="dps-legend-row">
                <div class="dps-legend">${legendHtml}</div>
                <div class="stat-toggles">
                  <button id="btn-skill-stats" class="btn" style="font-size:11px;padding:2px 10px">${_showSkillStats ? '▲ 收起技能明细' : '▼ 技能伤害明细'}</button>
                  <button id="btn-drop-stats" class="btn" style="font-size:11px;padding:2px 10px">${_showDropStats ? '▲ 收起掉落统计' : '▼ 掉落物品统计'}</button>
                </div>
              </div>
              ${_showSkillStats ? skillTableHtml : ''}
              ${_showDropStats ? dropStatsHtml : ''}
            </div>`;
          })()}
        </section>

        <section class="panel combat-panel">
          <h3>⚔️ 战斗${game.inTower ? ` <span class="tower-badge">🗼 通天塔第${game.towerFloor}层 [${game.towerMonIdx+1}]</span>` : ''}${game.inWorldBoss ? ' <span class="tower-badge">🐲 遮天塔·世界BOSS</span>' : ''}</h3>
          ${monsters.length > 0 ? `
          <div class="monster-group">
            ${game.currentMonsters.map((m, i) => {
              const statTip = `ATK:${m.minAtk}-${m.maxAtk} 防:${m.minDef} 魔御:${m.minMagDef || 0}`;
              // 死怪渲染为空血占位卡（可见但置灰），保持布局高度稳定，下方按钮不移动
              if (m.currentHp <= 0) return `<div class="monster-card dead ${m.type}" title="${statTip}">
                <div class="monster-name ${m.type}">${m.type === 'boss' ? '👑' : m.type === 'elite' ? '⭐' : ''}☠️ ${m.name} Lv.${m.level}<span class="debuff-tags">&nbsp;</span></div>
                <div class="bar monster-hp-bar"><div class="bar-fill" style="width:0%"></div><span>0/${m.maxHp}</span></div>
              </div>`;
              const isTarget = (i === game.targetIdx || (game.targetIdx >= game.currentMonsters.length && i === game.currentMonsters.findIndex(x => x.currentHp > 0)));
              const hpPctM = Math.max(0, m.currentHp / m.maxHp * 100);
              // DEBUFF 标签跟在名字同一行（名称行预留占位），卡片高度恒定不抖动
              const statusTags = `${m.poison > 0 ? ' 🟢毒' : ''}${m.plague > 0 ? ' ☠️疫' : ''}${m.cloud > 0 ? ' ☁️云' : ''}${m.stunned ? ' ⚡麻' : ''}`;
              return `<div class="monster-card ${isTarget ? 'target' : ''} ${m.type}" data-idx="${i}" title="${statTip}">
                <div class="monster-name ${m.type}">${m.type === 'boss' ? '👑' : m.type === 'elite' ? '⭐' : ''}${isTarget ? '🎯' : ''} ${m.name} Lv.${m.level}<span class="debuff-tags">${statusTags || '&nbsp;'}</span></div>
                <div class="bar monster-hp-bar"><div class="bar-fill" style="width:${hpPctM}%"></div><span>${Math.max(0, Math.floor(m.currentHp))}/${m.maxHp}</span></div>
              </div>`;
            }).join('')}
            ${game.summonedMinions.length > 0 ? `<div class="summon-info">👻 召唤物 x${game.summonedMinions.length}</div>` : ''}
          </div>
          <div class="player-status">
            ${(game.playerMinions || []).map(m => `<span class="status-buff status-minion">🐾 ${m.name}(ATK:${m.atk})</span>`).join('')}
            ${game.playerPoison > 0 ? `<span class="status-debuff status-poison">☠️中毒(${game.playerPoison}回合)</span>` : ''}
            ${game.playerStunned ? `<span class="status-debuff status-stun">⚡麻痹</span>` : ''}
          </div>` : '<p class="no-monster">寻找怪物中...</p>'}
          <div class="combat-actions">
            <span class="wave-info">🌊 第${game.waveNum}波 | 剩余${monsters.length}只</span>
            <select id="sel-wave-size" class="sel-threshold" title="每波怪物数量">
              <option value="1" ${game.waveSize===1?'selected':''}>1只/波</option>
              <option value="3" ${game.waveSize===3?'selected':''}>3只/波</option>
              <option value="5" ${game.waveSize===5?'selected':''}>5只/波</option>
              <option value="10" ${game.waveSize===10?'selected':''}>10只/波</option>
            </select>
            <button id="btn-autopot" class="btn ${game.autoPot ? 'btn-autopot-on' : 'btn-autopot-off'}">${game.autoPot ? '💊 自动吃药:开' : '💊 自动吃药:关'}</button>
            ${game.autoPot ? `
            <span class="pot-cfg" title="HP低于此比例自动喝药，金币直扣药费"><input type="number" id="inp-hp-threshold" class="inp-threshold" min="1" max="99" value="${Math.round(game.autoHpThreshold * 100)}">% HP喝
              <select id="sel-hp-potion" class="sel-threshold">
                <option value="auto" ${game.hpPotion==='auto'?'selected':''}>🤖 AI自选</option>
                <option value="金创药(小量)" ${game.hpPotion==='金创药(小量)'?'selected':''}>金创药(小量) 回30/50金</option>
                <option value="金创药(中量)" ${game.hpPotion==='金创药(中量)'?'selected':''}>金创药(中量) 回60/100金</option>
                <option value="金创药(大量)" ${game.hpPotion==='金创药(大量)'?'selected':''}>金创药(大量) 回100/200金</option>
                <option value="强效金创药" ${game.hpPotion==='强效金创药'?'selected':''}>强效金创药 回200/500金</option>
                <option value="金创药(特量)" ${game.hpPotion==='金创药(特量)'?'selected':''}>金创药(特量) 回400/1000金</option>
                <option value="太阳水" ${game.hpPotion==='太阳水'?'selected':''}>太阳水 回100HP+50MP/500金</option>
                <option value="强效太阳水" ${game.hpPotion==='强效太阳水'?'selected':''}>强效太阳水 回200HP+100MP/1000金</option>
                <option value="万年雪霜" ${game.hpPotion==='万年雪霜'?'selected':''}>万年雪霜 回150HP+250MP/2500金</option>
              </select></span>
            <span class="pot-cfg" title="MP低于此比例自动喝药，金币直扣药费"><input type="number" id="inp-mp-threshold" class="inp-threshold" min="1" max="99" value="${Math.round(game.autoMpThreshold * 100)}">% MP喝
              <select id="sel-mp-potion" class="sel-threshold">
                <option value="auto" ${game.mpPotion==='auto'?'selected':''}>🤖 AI自选</option>
                <option value="魔法药(小量)" ${game.mpPotion==='魔法药(小量)'?'selected':''}>魔法药(小量) 回30/50金</option>
                <option value="魔法药(中量)" ${game.mpPotion==='魔法药(中量)'?'selected':''}>魔法药(中量) 回60/100金</option>
                <option value="魔法药(大量)" ${game.mpPotion==='魔法药(大量)'?'selected':''}>魔法药(大量) 回100/200金</option>
                <option value="强效魔法药" ${game.mpPotion==='强效魔法药'?'selected':''}>强效魔法药 回200/500金</option>
                <option value="魔法药(特量)" ${game.mpPotion==='魔法药(特量)'?'selected':''}>魔法药(特量) 回400/1000金</option>
              </select></span>` : ''}
            <button id="btn-idle" class="btn ${game.isIdle ? 'btn-stop' : 'btn-idle'}">${game.isIdle ? '⏹️ 停止挂机' : '🔄 开始挂机'}</button>
          </div>
        </section>

        <section class="panel log-panel">
          <h3>📜 战斗日志</h3>
          <div class="log-list" id="log-list">
            ${game.combatLog.slice(0, 30).map(l => `<div class="log-item log-${l.type}">${l.msg}</div>`).join('')}
          </div>
        </section>
      </div>

      <div class="right-panel">
        <section class="panel inventory-panel">
          <h3>${game.invTab==='warehouse'
            ? `📦 仓库 (${p.warehouse.length}/${game.getWarehouseCap()}) <button id="btn-wh-back" class="btn" style="font-size:11px;padding:2px 8px">↩ 返回背包</button>`
            : `🎒 背包 (装备${p.inventory.filter(x => { const i = ITEMS[x.name]; return i && i.type !== 'potion' && i.type !== 'skillbook'; }).length}/100) <select id="sel-filter" class="filter-select" title="装备加成低于此值自动出售"><option value="0" ${game.sellThreshold===0?'selected':''}>过滤:关</option><option value="2" ${game.sellThreshold===2?'selected':''}>过滤:<2</option><option value="3" ${game.sellThreshold===3?'selected':''}>过滤:<3</option><option value="4" ${game.sellThreshold===4?'selected':''}>过滤:<4</option><option value="5" ${game.sellThreshold===5?'selected':''}>过滤:<5</option><option value="6" ${game.sellThreshold===6?'selected':''}>过滤:<6</option><option value="7" ${game.sellThreshold===7?'selected':''}>过滤:<7</option></select> <button id="btn-warehouse" class="btn" style="font-size:11px;padding:2px 8px" title="打开仓库">📦 仓库</button>`}</h3>
          ${game.invTab==='warehouse' ? '' : `<div class="inv-tabs">
            <button class="inv-tab ${game.invTab==='all'?'active':''}" data-tab="all">全部</button>
            <button class="inv-tab ${game.invTab==='equip'?'active':''}" data-tab="equip">装备</button>
            <button class="inv-tab ${game.invTab==='potion'?'active':''}" data-tab="potion">药水</button>
            <button class="inv-tab ${game.invTab==='skill'?'active':''}" data-tab="skill">技能</button>
            <button class="inv-tab ${game.invTab==='item'?'active':''}" data-tab="item">道具</button>
            <button class="inv-tab ${game.invTab==='dex'?'active':''}" data-tab="dex" title="装备图鉴：勾选过滤掉落">📖图鉴</button>
            <button id="btn-sort-inv" class="btn" style="flex:1;font-size:11px;padding:4px 0" title="锁定置顶 → 装备类型 → 等级降序">🔃 排序</button>
            <button id="btn-sell-all" class="btn" style="flex:1;font-size:11px;padding:4px 0" title="出售背包内所有未锁定装备（售价50%）">💸 一键卖</button>
            <button id="btn-sell-pot" class="btn" style="flex:1;font-size:11px;padding:4px 0" title="出售背包内所有药水（售价50%）">💊 卖药水</button>
          </div>`}
          <div class="inventory-list">
            ${game.invTab==='dex' ? renderDex(p) : game.invTab==='warehouse' ? (p.warehouse.map((slot, i) => {
              const info = ITEMS[slot.name];
              const itemType = info ? info.type : 'unknown';
              const typeLabel = info ? getTypeLabel(itemType) : '?';
              const countTag = (slot.count || 1) > 1 ? `<span class="inv-count">x${slot.count}</span>` : '';
              const bonusTag = slot.bonus ? `<em class="bonus-tag">${Object.entries(slot.bonus).map(([k,v]) => '+' + v + ({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔防',hp:'HP'}[k]||k)).join(' ')}</em>` : '';
              return `<div class="inv-item" title="${getItemTooltip(slot.name)}">
                <span class="inv-type">${typeLabel}</span> ${slot.name}${bonusTag}${countTag}
                <span class="inv-actions"><button class="btn-equip" data-withdraw="${i}">取出</button></span>
              </div>`;
            }).join('') || '<p class="empty">仓库是空的</p>') : p.inventory.map((slot, i) => {
              const info = ITEMS[slot.name];
              const itemType = info ? info.type : 'unknown';
              // 分类过滤
              const isEquip = !['potion','buff','material','skillbook'].includes(itemType);
              if (game.invTab === 'equip' && !isEquip) return '';
              if (game.invTab === 'potion' && itemType !== 'potion') return '';
              if (game.invTab === 'skill' && itemType !== 'skillbook') return '';
              if (game.invTab === 'item' && !['buff','material'].includes(itemType)) return '';
              const typeLabel = info ? getTypeLabel(itemType) : '?';
              const isPotion = itemType === 'potion';
              const countTag = slot.count > 1 ? `<span class="inv-count">x${slot.count}</span>` : '';
              const bonusTag = slot.bonus ? `<em class="bonus-tag">${Object.entries(slot.bonus).map(([k,v]) => '+' + v + ({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔防',hp:'HP'}[k]||k)).join(' ')}</em>` : '';
              const luckTag = slot.luck ? `<em class="luck-tag">${slot.luck > 0 ? '🍀幸+' + slot.luck : '💀咒' + (-slot.luck)}</em>` : '';
              const lockTag = isEquip ? `<button class="btn-lock ${slot.locked?'locked':''}" data-lock="${i}">${slot.locked?'🔒':'🔓'}</button>` : '';
              // 龙鳞为铁匠铺强化材料，禁止寄售；加成+3以上（即+4起）装备禁止寄售（hp按×10存储即>30；服务端market/list同步拦截）
              const noConsign = slot.name === '龙鳞' || (slot.bonus && Object.entries(slot.bonus).some(([k, v]) => v > (k === 'hp' ? 30 : 3)));
              const consignTag = noConsign ? '' : `<button class="btn-consign" data-consign="${slot.uid || ''}">寄</button>`;
              return `<div class="inv-item ${slot.locked?'inv-locked':''}" title="${getItemTooltip(slot.name)}">
                <span class="inv-type">${typeLabel}</span> ${slot.name}${bonusTag}${luckTag}${countTag}
                <span class="inv-actions">${lockTag}${isPotion ? `<button class="btn-use" data-use="${i}">使用</button>` : `<button class="btn-equip" data-index="${i}">装备</button>`}<button class="btn-store" data-store="${i}" title="存入仓库">存</button>${consignTag}<button class="btn-sell" data-sell="${i}">卖</button></span>
              </div>`;
            }).join('') || '<p class="empty">背包空空如也</p>'}
          </div>
        </section>

        <section class="panel drop-panel">
          <h3>🏆 掉落记录</h3>
          <div class="drop-list">
            ${game.dropLog.slice(0, 20).map(d => `<div class="drop-item">[${d.from}] → ${d.item}</div>`).join('') || '<p class="empty">暂无掉落</p>'}
          </div>
        </section>
      </div>
    </div>
    ${game.showTowerPanel ? renderTowerPanel() : ''}
    ${game.showWorldBossPanel ? renderWorldBossPanel() : ''}
    ${game.showRankPanel ? renderRankPanel() : ''}
    ${game.showMarketPanel ? renderMarketPanel() : ''}
    ${game.showBlacksmithPanel ? renderBlacksmithPanel() : ''}
  </div>`;
}

function renderTowerPanel() {
  const today = game.getTodayStr();
  const cleared = game.towerCleared[today] || [];
  return `
  <div class="tower-overlay">
    <div class="tower-modal">
      <div class="tower-header">
        <h2>🗼 通天塔</h2>
        <p>每天每层只能挑战一次 | 爆率×2 | 失败不扣除门票</p>
        <button id="btn-tower-close" class="btn-small btn-danger">✖ 关闭</button>
      </div>
      <div class="tower-floor-list">
        ${TOWER_FLOORS.map(f => {
          const done = cleared.includes(f.floor);
          const canDo = !done && !game.inTower;
          const monNames = f.monsters.map(m => m.ref || m.name).join(', ');
          return `<div class="tower-floor-item ${done ? 'cleared' : ''}">
            <span class="tower-floor-num">第${f.floor}层</span>
            <span class="tower-floor-info">💰${f.cost} | ${monNames}</span>
            <span class="tower-floor-status">${done ? '✅已通关' : canDo ? `<button class="btn-tower-fight" data-floor="${f.floor}">挑战</button>` : '🔒战斗中'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

// 世界BOSS（遮天塔）面板
function renderWorldBossPanel() {
  const st = game.worldBossInfo;
  let body;
  if (!st || !st.exists) {
    body = '<p style="text-align:center;color:#8b949e;padding:20px">暂无世界BOSS降临，请留意管理员投放公告</p>';
  } else if (st.boss.status === 'dead') {
    const my = st.my;
    const rewardsHtml = (my && my.rewards && my.rewards.length > 0)
      ? my.rewards.map(r => r.item === '金币'
          ? `💰 金币 ×${(r.count || 0).toLocaleString()}`
          : `🎁 ${r.item}${r.bonus ? ' [' + Object.entries(r.bonus).map(([k, v]) => '+' + v + ({ atk: '攻', mc: '魔', sc: '道', def: '防', magDef: '魔防', hp: 'HP' }[k] || k)).join(' ') + ']' : ''}`).join('<br>')
      : '<span style="color:#8b949e">未获得奖励（未造成伤害或未命中爆率）</span>';
    body = `
      <p style="text-align:center">🎉 <strong>${st.boss.name}</strong> 已被全服勇士击杀！</p>
      ${my ? `<p style="text-align:center">我的伤害: ${my.damage.toLocaleString()} | 排名: 第${my.rank}名</p>` : '<p style="text-align:center;color:#8b949e">你未参与本次输出</p>'}
      <p style="margin-top:8px"><strong>我的奖励：</strong><br>${rewardsHtml}</p>
      ${my && my.rewards ? '<div style="text-align:center;margin-top:8px"><button id="btn-wb-claim" class="btn-small btn-tower">🎁 领取奖励到背包</button></div>' : ''}`;
  } else {
    const b = st.boss;
    const hpPct = Math.max(0, (b.hpNow / b.hpMax * 100)).toFixed(2);
    const skillsTxt = (b.skills || []).map(s => s.name).join(' / ') || '无';
    const my = st.my;
    const rankRows = (st.top || []).map((r, i) => `<tr><td>${i + 1}</td><td>${r.charName}</td><td>${r.damage.toLocaleString()}</td></tr>`).join('')
      || '<tr><td colspan="3" style="text-align:center;color:#8b949e">暂无伤害记录</td></tr>';
    body = `
      <p><strong>🐲 ${b.name}</strong> Lv.${b.level} <span style="color:#8b949e;font-size:12px">（全服共享血量，按输出量结算奖励）</span></p>
      <div class="bar-group">
        <label>HP</label>
        <div class="bar hp-bar"><div class="bar-fill" style="width:${hpPct}%"></div><span>${b.hpNow.toLocaleString()} / ${b.hpMax.toLocaleString()}</span></div>
      </div>
      <p style="font-size:12px;color:#8b949e">攻击 ${b.minAtk}-${b.maxAtk} | 防御 ${b.minDef} | 魔防 ${b.minMagDef} | 技能: ${skillsTxt}</p>
      <p>我的伤害: ${my ? `${my.damage.toLocaleString()}（第${my.rank}名）` : '尚未参与'}</p>
      <div style="text-align:center;margin:8px 0"><button id="btn-wb-fight" class="btn-small btn-tower"${game.inWorldBoss ? ' disabled' : ''}>${game.inWorldBoss ? '⚔️ 战斗中' : '⚔️ 挑战世界BOSS'}</button>
      ${game.inWorldBoss ? '<button id="btn-wb-exit" class="btn-small btn-danger">撤退</button>' : ''}</div>
      <p><strong>伤害榜 TOP10</strong></p>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><th>排名</th><th>角色</th><th>伤害</th></tr>
        ${rankRows}
      </table>`;
  }
  return `
  <div class="tower-overlay">
    <div class="tower-modal">
      <div class="tower-header">
        <h2>🐲 遮天塔·世界BOSS</h2>
        <p>全服玩家共同讨伐 | BOSS死亡后按个人总输出量加成爆率结算高级装备</p>
        <button id="btn-wb-close" class="btn-small btn-danger">✖ 关闭</button>
      </div>
      <div class="tower-floor-list" style="padding:12px">
        ${body}
      </div>
    </div>
  </div>`;
}

function renderBlacksmithPanel() {
  const p = game.player;
  const cost = game.getReforgeCost();
  const scaleCount = game.getMaterialCount('龙鳞');
  const equips = p.inventory.map((slot, i) => ({ slot, i, info: ITEMS[slot.name] }))
    .filter(x => x.info && !['potion','buff','material','skillbook'].includes(x.info.type));
  return `
  <div class="tower-overlay">
    <div class="tower-modal">
      <div class="tower-header">
        <h2>⚒️ 铁匠铺</h2>
        <p>词条强化：消耗龙鳞×1 + ${cost.gold}金币，概率给词条+1点（最高+7，难度随+N提升） | 当前龙鳞:${scaleCount}片 金币:${p.gold}</p>
        <button id="btn-blacksmith-close" class="btn-small btn-danger">✖ 关闭</button>
      </div>
      <div class="tower-floor-list">
        ${equips.length === 0 ? '<p class="empty">背包里没有装备，先去打几件吧</p>' : equips.map(({ slot, i }) => {
          const bonusStr = slot.bonus ? Object.entries(slot.bonus).map(([k, v]) => '+' + v + ({ atk: '攻', mc: '魔', sc: '道', def: '防', magDef: '魔防', hp: 'HP' }[k] || k)).join(' ') : '无词条';
          const pts = game.bonusPoints(slot);
          const chanceTxt = pts >= 7 ? '已满' : `成功率${Math.round(game.getReforgeChance(pts) * 100)}%`;
          return `<div class="tower-floor-item">
            <span class="tower-floor-num">${slot.locked ? '🔒' : ''}${slot.name}</span>
            <span class="tower-floor-info">${bonusStr} | ${chanceTxt}</span>
            <span class="tower-floor-status"><button class="btn-tower-fight" data-reforge="${i}"${pts >= 7 ? ' disabled' : ''}>强化</button></span>
          </div>`;
        }).join('')}
      </div>
      <div class="tower-header" style="margin-top:8px">
        <h2>🧪 幸运强化</h2>
        <p>消耗祝福油×1提升武器幸运（最高+7，攻击更靠近上限）；失败幸运不变或诅咒-1，幸运≤0时必成（洗诅咒） | 当前祝福油:${game.getMaterialCount('祝福油')}瓶</p>
      </div>
      <div class="tower-floor-list">
        ${(() => {
          const wpns = [];
          const ew = p.equipment.weapon;
          const ewName = ew ? (typeof ew === 'string' ? ew : ew.name) : null;
          if (ewName && ITEMS[ewName] && ITEMS[ewName].type === 'weapon') {
            wpns.push({ name: ewName, luck: (ew && typeof ew === 'object' ? ew.luck : 0) || 0, target: 'equipped', tag: '[已装备] ' });
          }
          p.inventory.forEach((s, i) => { const inf = ITEMS[s.name]; if (inf && inf.type === 'weapon') wpns.push({ name: s.name, luck: s.luck || 0, target: String(i), tag: '' }); });
          if (wpns.length === 0) return '<p class="empty">没有武器，无法进行幸运强化</p>';
          return wpns.map(w => {
            const luckStr = w.luck > 0 ? `🍀幸+${w.luck}` : w.luck < 0 ? `💀咒${-w.luck}` : '无幸运';
            const chancePct = Math.round(game.getBlessChance(w.luck) * 100);
            return `<div class="tower-floor-item">
              <span class="tower-floor-num">${w.tag}${w.name}</span>
              <span class="tower-floor-info">${luckStr}${w.luck >= 7 ? '（极限）' : ` | 成功率${chancePct}%`}</span>
              <span class="tower-floor-status"><button class="btn-tower-fight" data-bless="${w.target}" ${w.luck >= 7 ? 'disabled' : ''}>祝福</button></span>
            </div>`;
          }).join('');
        })()}
      </div>
    </div>
  </div>`;
}

function renderRankPanel() {
  const jobNames = { warrior: '战士', mage: '法师', taoist: '道士' };
  const tab = game.rankTab || 'level';
  const data = game.rankData;
  return `
  <div class="tower-overlay">
    <div class="tower-modal rank-modal">
      <div class="tower-header">
        <h2>🏆 排行榜</h2>
        <div class="rank-tabs">
          <button class="rank-tab ${tab==='level'?'active':''}" data-ranktab="level">等级榜</button>
          <button class="rank-tab ${tab==='tower'?'active':''}" data-ranktab="tower">通天塔榜</button>
        </div>
        <button id="btn-rank-close" class="btn-small btn-danger">✖ 关闭</button>
      </div>
      <div class="rank-list">
        <table class="rank-table">
          <tr><th>排名</th><th>角色</th><th>职业</th><th>${tab==='level'?'等级':'通天塔层数'}</th></tr>
          ${data === null ? '<tr><td colspan="4">加载中...</td></tr>' : data.length === 0 ? '<tr><td colspan="4">暂无数据</td></tr>' : data.map(r => `
            <tr class="${r.rank<=3?'rank-top':''}">
              <td>${r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:r.rank}</td>
              <td>${r.name}</td>
              <td>${jobNames[r.job]||r.job}</td>
              <td>${tab==='level'?'Lv.'+r.level:'第'+r.towerMax+'层'}</td>
            </tr>`).join('')}
        </table>
      </div>
    </div>
  </div>`;
}

function renderMarketPanel() {
  const tab = game.marketTab || 'browse';
  const data = game.marketData || { items: [], total: 0, page: 1 };
  const myListings = game.myListings || [];
  return `
  <div class="tower-overlay">
    <div class="tower-modal market-modal">
      <div class="tower-header">
        <h2>🏪 装备寄售市场</h2>
        <div class="rank-tabs">
          <button class="rank-tab ${tab==='browse'?'active':''}" data-markettab="browse">浏览市场</button>
          <button class="rank-tab ${tab==='mine'?'active':''}" data-markettab="mine">我的寄售</button>
        </div>
        <button id="btn-market-close" class="btn-small btn-danger">✖ 关闭</button>
      </div>
      <div class="market-content">
        ${tab === 'browse' ? `
          <div class="market-list">
            ${data.items.length === 0 ? '<p class="empty">暂无在售装备</p>' : data.items.map(item => `
              <div class="market-item">
                <span class="market-item-name">${item.itemName}${item.bonus ? `<em class="bonus-tag">${Object.entries(item.bonus).map(([k,v])=>'+'+v+({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔防',hp:'HP'}[k]||k)).join(' ')}</em>` : ''}</span>
                <span class="market-item-seller">卖家:${item.seller}</span>
                <span class="market-item-price">💰${formatNum(item.price)}</span>
                <button class="btn-market-buy" data-buy="${item.id}">购买</button>
              </div>`).join('')}
          </div>
          <div class="market-pager">
            ${data.page > 1 ? `<button class="btn-small" data-marketpage="${data.page-1}">←上一页</button>` : ''}
            <span>第${data.page}页 / 共${Math.ceil((data.total||0)/20)||1}页</span>
            ${data.page < Math.ceil((data.total||0)/20) ? `<button class="btn-small" data-marketpage="${data.page+1}">下一页→</button>` : ''}
          </div>
        ` : `
          <div class="market-list">
            ${myListings.length === 0 ? '<p class="empty">你没有在售装备</p>' : myListings.map(item => `
              <div class="market-item">
                <span class="market-item-name">${item.itemName}${item.bonus ? `<em class="bonus-tag">${Object.entries(item.bonus).map(([k,v])=>'+'+v+({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔防',hp:'HP'}[k]||k)).join(' ')}</em>` : ''}</span>
                <span class="market-item-price">💰${formatNum(item.price)}</span>
                <button class="btn-market-cancel" data-cancel="${item.id}">下架</button>
              </div>`).join('')}
          </div>
        `}
      </div>
    </div>
  </div>`;
}

function renderEquipSlot(slot, label) {
  const data = game.player.equipment[slot];
  if (!data) return `<div class="equip-slot"><small>${label}</small><span>空</span></div>`;
  const name = typeof data === 'string' ? data : data.name;
  const bonus = typeof data === 'object' ? data.bonus : null;
  const bonusStr = bonus ? `<em class="bonus-tag">${Object.entries(bonus).map(([k,v]) => '+' + v + ({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔防',hp:'HP'}[k]||k)).join(' ')}</em>` : '';
  const luck = typeof data === 'object' ? (data.luck || 0) : 0;
  const luckStr = luck ? `<em class="luck-tag">${luck > 0 ? '🍀幸+' + luck : '💀咒' + (-luck)}</em>` : '';
  let tip = getItemTooltip(name);
  if (bonus) tip += ' | ' + Object.entries(bonus).map(([k,v]) => '加成+' + v + ({atk:'攻击',mc:'魔法',sc:'道术',def:'防御',magDef:'魔防',hp:'HP'}[k]||k)).join(' ');
  if (luck) tip += ` | 幸运${luck > 0 ? '+' + luck + '（攻击更靠近上限）' : luck + '（攻击更靠近下限）'}`;
  return `<div class="equip-slot equipped" title="${tip}"><small>${label}</small><span>${name}${bonusStr}${luckStr}</span><button class="btn-unequip" data-slot="${slot}">卸</button></div>`;
}

// === 装备图鉴：分组/属性/状态判定（渲染与事件绑定共用） ===
const DEX_GROUPS = [
  { type: 'weapon', label: '⚔️ 武器' }, { type: 'armor', label: '🛡️ 衣服' }, { type: 'helmet', label: '🪖 头盔' },
  { type: 'necklace', label: '📿 项链' }, { type: 'bracelet', label: '⭕ 手镯' }, { type: 'ring', label: '💍 戒指' },
  { type: 'boots', label: '👢 鞋子' }, { type: 'belt', label: '🧵 腰带' }, { type: 'jade', label: '🟩 玉石' },
  { type: 'other', label: '📦 其他' },
];
function dexItemsOfType(type) {
  const known = DEX_GROUPS.filter(g => g.type !== 'other').map(g => g.type);
  return Object.entries(ITEMS).filter(([n, i]) => {
    const isEquip = !['potion','buff','material','skillbook'].includes(i.type);
    if (!isEquip) return false;
    return type === 'other' ? !known.includes(i.type) : i.type === type;
  }).sort((a, b) => (a[1].level || 1) - (b[1].level || 1));
}

function renderDex(p) {
  const jobNames = { all: '通用', warrior: '战士', mage: '法师', taoist: '道士' };
  const equippedNames = Object.values(p.equipment || {}).map(d => typeof d === 'string' ? d : (d && d.name));
  const ownState = name => equippedNames.includes(name) ? 1 : p.inventory.some(s => s.name === name) ? 2 : (p.warehouse || []).some(s => s.name === name) ? 3 : 0;
  const statStr = info => ['atk','mc','sc','def','magDef'].filter(k => info[k]).map(k => ({atk:'攻',mc:'魔',sc:'道',def:'防',magDef:'魔御'}[k]) + info[k][0] + '-' + info[k][1]).join(' ');
  const badge = st => st === 1 ? '<em class="dex-badge b-eq">🟢已装备</em>' : st === 2 ? '<em class="dex-badge b-bag">🎒持有</em>' : st === 3 ? '<em class="dex-badge b-wh">📦仓库</em>' : '<em class="dex-badge b-none">未获得</em>';
  let html = `<div class="dex-toolbar">⚠️ 勾选 = 该装备<span class="dex-tip-strong">不再掉落</span> | 已过滤 <b>${game.dropFilter.length}</b> 件 <button id="btn-dex-clearall" class="btn" style="font-size:11px;padding:2px 8px">清空全部过滤</button></div>`;
  for (const g of DEX_GROUPS) {
    const items = dexItemsOfType(g.type);
    if (items.length === 0) continue;
    const filteredCnt = items.filter(([n]) => game.dropFilter.includes(n)).length;
    html += `<div class="dex-group-title">${g.label}（${items.length}）${filteredCnt > 0 ? ` <span class="dex-cnt">已过滤${filteredCnt}</span>` : ''}
      <button class="btn dex-group-btn" data-dexgroup="${g.type}" data-dexact="all">全勾</button>
      <button class="btn dex-group-btn" data-dexgroup="${g.type}" data-dexact="none">清空</button></div>`;
    for (const [name, info] of items) {
      const checked = game.dropFilter.includes(name);
      html += `<div class="dex-row ${checked ? 'dex-checked' : ''}" title="${getItemTooltip(name)}">
        <label class="dex-label"><input type="checkbox" data-dexname="${name}" ${checked ? 'checked' : ''}> <span class="dex-name">${name}</span></label>
        <span class="dex-lv">Lv${info.level || 1}</span>
        <span class="dex-job">${jobNames[info.job] || ''}</span>
        <span class="dex-stats">${statStr(info)}</span>${badge(ownState(name))}
      </div>`;
    }
  }
  return html;
}

function getTypeLabel(type) {
  const map = { weapon: '武', armor: '衣', helmet: '盔', necklace: '链', bracelet: '镯', ring: '戒', boots: '鞋', belt: '带', jade: '玉', skillbook: '书', potion: '药' };
  return map[type] || '?';
}

function getItemTooltip(name) {
  const item = ITEMS[name];
  if (!item) return name;
  let parts = [name];
  if (item.type === 'skillbook' && SKILLS[item.skill]) {
    const sd = SKILLS[item.skill];
    const typeMap = {attack:'攻击',passive:'被动',buff:'增益',summon:'召唤',utility:'辅助',heal:'治疗'};
    parts.push(`[${typeMap[sd.type]||sd.type}] ${sd.desc}`);
    parts.push(`伤害加成:+${Math.round(sd.damageBonus*100)}%`);
    parts.push(`需要等级:${sd.levelReq}`);
    return parts.join(' | ');
  }
  if (item.atk) parts.push(`攻击:${item.atk[0]}-${item.atk[1]}`);
  if (item.mc) parts.push(`魔法:${item.mc[0]}-${item.mc[1]}`);
  if (item.sc) parts.push(`道术:${item.sc[0]}-${item.sc[1]}`);
  if (item.def) parts.push(`防御:${item.def[0]}-${item.def[1]}`);
  if (item.magDef) parts.push(`魔御:${item.magDef[0]}-${item.magDef[1]}`);
  if (item.special) {
    const SPECIAL_DESC = { '麻痹': '攻击15%概率麻痹目标', '护身': '所受伤害转化为MP消耗', '传送': '传送', '复活': '被击杀时原地复活', '火焰': '附加火焰伤害', '超负载': '负重提升', '防御': '防御强化', '记忆': '击杀时概率召唤幻影助战', '吸血': '普攻伤害的20%转化为HP（武器）/15%（虹魔戒指）', '连击': '每回合25%概率追加一击' };
    parts.push(`特效:${SPECIAL_DESC[item.special] || item.special}`);
  }
  if (item.healHp) parts.push(`回HP:${item.healHp}`);
  if (item.healMp) parts.push(`回MP:${item.healMp}`);
  if (item.level) parts.push(`需要等级:${item.level}`);
  if (item.needAtk) parts.push(`需要最大攻击:${item.needAtk}`);
  if (item.price) parts.push(`价格:${item.price}金`);
  return parts.join(' | ');
}

function bindEvents() {
  // === 技能伤害明细面板展开/收起 ===
  const btnSkillStats = document.getElementById('btn-skill-stats');
  if (btnSkillStats) {
    btnSkillStats.onclick = () => { _showSkillStats = !_showSkillStats; renderApp(); };
  }
  // === 掉落物品统计面板展开/收起 ===
  const btnDropStats = document.getElementById('btn-drop-stats');
  if (btnDropStats) {
    btnDropStats.onclick = () => { _showDropStats = !_showDropStats; renderApp(); };
  }
  // === 登录/注册 ===
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const btnLoginSubmit = document.getElementById('btn-login-submit');
  if (tabLogin && tabRegister && btnLoginSubmit) {
    let isRegister = false;
    tabLogin.onclick = () => { isRegister = false; tabLogin.classList.add('active'); tabRegister.classList.remove('active'); btnLoginSubmit.textContent = '登录'; };
    tabRegister.onclick = () => { isRegister = true; tabRegister.classList.add('active'); tabLogin.classList.remove('active'); btnLoginSubmit.textContent = '注册'; };
    btnLoginSubmit.onclick = async () => {
      const username = document.getElementById('input-username').value.trim();
      const password = document.getElementById('input-password').value;
      const msgEl = document.getElementById('login-msg');
      if (!username || !password) { msgEl.textContent = '❗ 请输入用户名和密码'; return; }
      msgEl.textContent = '请稍候...';
      const res = isRegister ? await Api.register(username, password) : await Api.login(username, password);
      if (res.error) { msgEl.textContent = '❌ ' + res.error; return; }
      msgEl.textContent = '✅ 成功';
      // 切换账号先清空上一账号的内存残留，防止新账号无存档时残留旧角色并被自动save上传污染
      game.clearSession();
      const saveRes = await Api.downloadSave();
      if (saveRes.exists && saveRes.data) {
        game.loadFromData(saveRes.data);
        if (saveRes.version) game._saveVersion = saveRes.version;
      }
      renderApp();
    };
    return;
  }

  // 职业选择
  document.querySelectorAll('.job-card').forEach(el => {
    el.onclick = async () => {
      const job = el.dataset.job;
      const defaultName = job === 'warrior' ? '战士' : job === 'mage' ? '法师' : '道士';
      const name = prompt('请输入角色名（2-8个字符）:', defaultName);
      if (name === null) return;
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 8) { alert('角色名需2-8个字符'); return; }
      // 检查角色名唯一性
      const check = await Api.checkName(trimmed);
      if (!check.available) { alert(check.reason || '角色名已被使用'); return; }
      game.init(job, trimmed);
      renderApp();
    };
  });
  // 地图选择
  const mapSel = document.getElementById('map-select');
  if (mapSel) mapSel.onchange = () => { game.changeMap(mapSel.value); renderApp(); };
  // 自动吃药开关
  const btnAutoPot = document.getElementById('btn-autopot');
  if (btnAutoPot) btnAutoPot.onclick = () => { game.autoPot = !game.autoPot; game.addLog(game.autoPot ? '💊 自动吃药已开启' : '💊 自动吃药已关闭', 'info'); renderApp(); };
  // 波次数量设置
  const selWave = document.getElementById('sel-wave-size');
  if (selWave) selWave.onchange = () => { game.waveSize = parseInt(selWave.value); game.waveKills = 0; game.waveNum = 1; game.addLog(`🌊 波次设置: 每波${game.waveSize}只怪物`, 'info'); renderApp(); };
  // HP阈值自由输入
  const inpHp = document.getElementById('inp-hp-threshold');
  if (inpHp) inpHp.onchange = () => {
    const v = Math.max(1, Math.min(99, parseInt(inpHp.value) || 70));
    game.autoHpThreshold = v / 100;
    inpHp.value = v;
    game.addLog(`💊 红药阈值: HP<${v}%`, 'info');
    game.save();
  };
  // MP阈值自由输入
  const inpMp = document.getElementById('inp-mp-threshold');
  if (inpMp) inpMp.onchange = () => {
    const v = Math.max(1, Math.min(99, parseInt(inpMp.value) || 30));
    game.autoMpThreshold = v / 100;
    inpMp.value = v;
    game.addLog(`💧 蓝药阈值: MP<${v}%`, 'info');
    game.save();
  };
  // 红药选择
  const selHpPot = document.getElementById('sel-hp-potion');
  if (selHpPot) selHpPot.onchange = () => { game.hpPotion = selHpPot.value; game.addLog(`💊 自动红药: ${selHpPot.value === 'auto' ? 'AI自选' : selHpPot.value}`, 'info'); game.save(); };
  // 蓝药选择
  const selMpPot = document.getElementById('sel-mp-potion');
  if (selMpPot) selMpPot.onchange = () => { game.mpPotion = selMpPot.value; game.addLog(`💧 自动蓝药: ${selMpPot.value === 'auto' ? 'AI自选' : selMpPot.value}`, 'info'); game.save(); };
  // 挂机
  const btnIdle = document.getElementById('btn-idle');
  if (btnIdle) btnIdle.onclick = () => {
    if (game.isIdle) { game.stopIdle(); renderApp(); }
    else { game.startIdle(); renderApp(); }
  };
  // 点击怪物切换目标（dead为死亡占位卡，跳过）
  document.querySelectorAll('.monster-card:not(.dead)').forEach(el => {
    el.onclick = () => { game.setTarget(parseInt(el.dataset.idx)); };
  });
  // 背包装备
  document.querySelectorAll('.btn-equip').forEach(el => {
    if (el.dataset.withdraw !== undefined) return;
    el.onclick = (e) => { e.stopPropagation(); game.equipItem(parseInt(el.dataset.index)); renderApp(); };
  });
  // 仓库取出
  document.querySelectorAll('[data-withdraw]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.withdrawItem(parseInt(el.dataset.withdraw)); renderApp(); };
  });
  // 存入仓库
  document.querySelectorAll('.btn-store').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.storeItem(parseInt(el.dataset.store)); renderApp(); };
  });
  // 仓库开关
  const btnWh = document.getElementById('btn-warehouse');
  if (btnWh) btnWh.onclick = () => { game.invTab = 'warehouse'; renderApp(); };
  const btnWhBack = document.getElementById('btn-wh-back');
  if (btnWhBack) btnWhBack.onclick = () => { game.invTab = 'all'; renderApp(); };
  // 背包使用药水
  document.querySelectorAll('.btn-use').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.useInventoryPotion(parseInt(el.dataset.use)); renderApp(); };
  });
  // 背包出售
  document.querySelectorAll('.btn-sell').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.sellItem(parseInt(el.dataset.sell)); renderApp(); };
  });
  // 背包寄售（按uid精确识别物品，避免索引漂移上架错物品）
  document.querySelectorAll('.btn-consign').forEach(el => {
    el.onclick = async (e) => {
      e.stopPropagation();
      const uid = parseInt(el.dataset.consign);
      let slot = game.player.inventory.find(s => s.uid === uid);
      if (!slot) {
        // 旧条目无uid时按按钮所在索引补发（首次升级兼容）
        const fallbackIdx = [...document.querySelectorAll('.btn-consign')].indexOf(el);
        const visibleSlots = game.player.inventory;
        slot = visibleSlots[fallbackIdx];
        if (!slot) return;
        game._ensureUid(slot);
      }
      if (slot.name === '龙鳞') { alert('龙鳞为铁匠铺强化材料，无法寄售'); return; }
      if (slot.bonus && Object.entries(slot.bonus).some(([k, v]) => v > (k === 'hp' ? 30 : 3))) { alert('加成+3以上装备无法寄售'); return; }
      const price = prompt(`寄售【${slot.name}】\n请输入售价(金币):`, '10000');
      if (price === null) return;
      const p = parseInt(price);
      if (!p || p < 1) { alert('价格无效'); return; }
      const itemUid = game._ensureUid(slot);
      // 先强制同步存档到服务端，确保服务端读到最新背包
      const flushed = await game.flushToServer();
      if (!flushed) { alert('存档同步失败，请稍后重试'); renderApp(); return; }
      // 同步后再次确认物品仍在背包中
      if (!game.player.inventory.find(s => s.uid === itemUid)) { alert('物品已变动，请重新操作'); renderApp(); return; }
      const res = await Api.listItem(itemUid, p);
      if (res.error) { alert(res.error); } else { game.addLog('🏪 ' + res.msg, 'info'); }
      const saveRes = await Api.downloadSave();
      if (saveRes.exists && saveRes.data) { game.loadFromData(saveRes.data); if (saveRes.version) game._saveVersion = saveRes.version; }
      renderApp();
    };
  });
  // 背包装备锁定
  document.querySelectorAll('.btn-lock').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.toggleLock(parseInt(el.dataset.lock)); renderApp(); };
  });
  // 装备栏卸下
  document.querySelectorAll('.btn-unequip').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.unequipItem(el.dataset.slot); renderApp(); };
  });
  // 技能卸下（二次确认，卸下后技能永久消失）
  document.querySelectorAll('.btn-skill-off').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const sk = el.dataset.skill;
      if (!confirm(`确定卸下【${sk}】？\n\n⚠️ 卸下后技能将永久消失，需重新获取技能书才能再次学习！`)) return;
      game.unequipSkill(sk); renderApp();
    };
  });
  // 技能装载
  document.querySelectorAll('.btn-skill-on').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.equipSkill(el.dataset.skill); renderApp(); };
  });
  // 技能遗忘
  document.querySelectorAll('.btn-skill-forget').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); game.forgetSkill(el.dataset.skill); renderApp(); };
  });
  // 装备过滤
  const selFilter = document.getElementById('sel-filter');
  if (selFilter) selFilter.onchange = () => { game.sellThreshold = parseInt(selFilter.value); game.sellFilteredEquip(); renderApp(); };
  // 背包分类选项卡
  document.querySelectorAll('.inv-tab').forEach(el => {
    el.onclick = () => { game.invTab = el.dataset.tab; renderApp(); };
  });
  // 装备图鉴：勾选过滤掉落
  document.querySelectorAll('input[data-dexname]').forEach(el => {
    el.onchange = () => { game.toggleDropFilter(el.dataset.dexname); renderApp(); };
  });
  document.querySelectorAll('.dex-group-btn').forEach(el => {
    el.onclick = () => {
      const names = dexItemsOfType(el.dataset.dexgroup).map(([n]) => n);
      if (el.dataset.dexact === 'all') names.forEach(n => { if (!game.dropFilter.includes(n)) game.dropFilter.push(n); });
      else game.dropFilter = game.dropFilter.filter(n => !names.includes(n));
      game.save(); renderApp();
    };
  });
  const btnDexClearAll = document.getElementById('btn-dex-clearall');
  if (btnDexClearAll) btnDexClearAll.onclick = () => { game.dropFilter = []; game.save(); renderApp(); };
  // 背包手动排序
  const btnSortInv = document.getElementById('btn-sort-inv');
  if (btnSortInv) btnSortInv.onclick = () => { game.sortInventory(); renderApp(); };
  // 一键出售未锁定装备
  const btnSellAll = document.getElementById('btn-sell-all');
  if (btnSellAll) btnSellAll.onclick = () => {
    const count = game.player.inventory.filter(s => { const i = ITEMS[s.name]; return i && !['potion','buff','material','skillbook'].includes(i.type) && !s.locked; }).length;
    if (count === 0) { game.addLog('💸 背包里没有可出售的未锁定装备', 'info'); renderApp(); return; }
    if (confirm(`确定一键出售 ${count} 件未锁定装备吗？（锁定装备不受影响，售价为原价50%）`)) {
      game.sellAllUnlockedEquip();
      renderApp();
    }
  };
  // 一键出售药水
  const btnSellPot = document.getElementById('btn-sell-pot');
  if (btnSellPot) btnSellPot.onclick = () => {
    const count = game.player.inventory.reduce((s, x) => { const i = ITEMS[x.name]; return i && i.type === 'potion' ? s + (x.count || 1) : s; }, 0);
    if (count === 0) { game.addLog('💊 背包里没有可出售的药水', 'info'); renderApp(); return; }
    if (confirm(`确定一键出售 ${count} 瓶药水吗？（售价为原价50%，自动吃药可直接扣金币无需囤药）`)) {
      game.sellAllPotions();
      renderApp();
    }
  };
  // 退出登录
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.onclick = () => {
    if (confirm('确定退出登录？')) { Api.logout(); game.clearSession(); renderApp(); }
  };
  // 排行榜
  const btnRank = document.getElementById('btn-rank');
  if (btnRank) btnRank.onclick = async () => {
    game.showRankPanel = true; game.rankTab = 'level'; game.rankData = null;
    renderApp();
    const data = await Api.getLevelRank();
    if (!data.error) { game.rankData = data; renderApp(); }
  };
  const btnRankClose = document.getElementById('btn-rank-close');
  if (btnRankClose) btnRankClose.onclick = () => { game.showRankPanel = false; renderApp(); };
  document.querySelectorAll('.rank-tab[data-ranktab]').forEach(el => {
    el.onclick = async () => {
      game.rankTab = el.dataset.ranktab; game.rankData = null;
      renderApp();
      const data = game.rankTab === 'level' ? await Api.getLevelRank() : await Api.getTowerRank();
      if (!data.error) { game.rankData = data; renderApp(); }
    };
  });
  // 寄售市场
  const btnMarket = document.getElementById('btn-market');
  if (btnMarket) btnMarket.onclick = async () => {
    game.showMarketPanel = true; game.marketTab = 'browse'; game.marketData = { items: [], total: 0, page: 1 };
    renderApp();
    const data = await Api.getMarket(1);
    if (!data.error) { game.marketData = data; renderApp(); }
  };
  const btnMarketClose = document.getElementById('btn-market-close');
  if (btnMarketClose) btnMarketClose.onclick = () => { game.showMarketPanel = false; renderApp(); };
  document.querySelectorAll('.rank-tab[data-markettab]').forEach(el => {
    el.onclick = async () => {
      game.marketTab = el.dataset.markettab;
      renderApp();
      if (game.marketTab === 'browse') {
        const data = await Api.getMarket(1);
        if (!data.error) { game.marketData = data; renderApp(); }
      } else {
        const data = await Api.getMyListings();
        if (!data.error) { game.myListings = data; renderApp(); }
      }
    };
  });
  // 市场翻页
  document.querySelectorAll('[data-marketpage]').forEach(el => {
    el.onclick = async () => {
      const page = parseInt(el.dataset.marketpage);
      const data = await Api.getMarket(page);
      if (!data.error) { game.marketData = data; renderApp(); }
    };
  });
  // 市场购买
  document.querySelectorAll('.btn-market-buy').forEach(el => {
    el.onclick = async () => {
      if (!confirm('确定购买？')) return;
      // 购买前先强制同步，避免服务端基于旧存档操作后回拉覆盖本地最近掉落
      const flushed = await game.flushToServer();
      if (!flushed) { alert('存档同步失败，请稍后重试'); renderApp(); return; }
      const res = await Api.buyItem(parseInt(el.dataset.buy));
      if (res.error) { alert(res.error); } else { game.addLog('🏪 ' + res.msg, 'info'); }
      const saveRes = await Api.downloadSave();
      if (saveRes.exists && saveRes.data) { game.loadFromData(saveRes.data); if (saveRes.version) game._saveVersion = saveRes.version; }
      const data = await Api.getMarket(game.marketData.page || 1);
      if (!data.error) game.marketData = data;
      renderApp();
    };
  });
  // 市场下架
  document.querySelectorAll('.btn-market-cancel').forEach(el => {
    el.onclick = async () => {
      // 下架前先强制同步，避免服务端基于旧存档操作后回拉覆盖本地最近掉落
      const flushed = await game.flushToServer();
      if (!flushed) { alert('存档同步失败，请稍后重试'); renderApp(); return; }
      const res = await Api.cancelItem(parseInt(el.dataset.cancel));
      if (res.error) { alert(res.error); } else { game.addLog('🏪 ' + res.msg, 'info'); }
      const saveRes = await Api.downloadSave();
      if (saveRes.exists && saveRes.data) { game.loadFromData(saveRes.data); if (saveRes.version) game._saveVersion = saveRes.version; }
      const data = await Api.getMyListings();
      if (!data.error) game.myListings = data;
      renderApp();
    };
  });
  // 铁匠铺
  const btnBlacksmith = document.getElementById('btn-blacksmith');
  if (btnBlacksmith) btnBlacksmith.onclick = () => { game.showBlacksmithPanel = !game.showBlacksmithPanel; renderApp(); };
  // 转职
  const btnChangeJob = document.getElementById('btn-changejob');
  if (btnChangeJob) btnChangeJob.onclick = () => {
    const p = game.player;
    const jobLabel = { warrior: '战士', mage: '法师', taoist: '道士' };
    if (p.level < 25) { alert(`转职需要等级≥25（当前Lv.${p.level}）`); return; }
    if (game.isIdle) { alert('请先停止挂机再转职'); return; }
    if (p.gold < 100000) { alert(`转职需要10万金币（当前${formatNum(p.gold)}）`); return; }
    const targets = ['warrior', 'mage', 'taoist'].filter(j => j !== p.job);
    const pick = prompt(`当前职业：${jobLabel[p.job]}\n转职花费：10万金币（已学技能保留，转回可直接装载）\n\n请输入目标职业序号：\n1. ${jobLabel[targets[0]]}\n2. ${jobLabel[targets[1]]}`, '1');
    if (pick === null) return;
    const idx = parseInt(pick, 10) - 1;
    if (isNaN(idx) || !targets[idx]) { alert('无效选择'); return; }
    const newJob = targets[idx];
    // 代价清单：转职保留全部装备，仅卸下非新职业技能
    const offSkills = p.equippedSkills.filter(sk => SKILLS[sk] && SKILLS[sk].job !== newJob);
    let msg = `确定转职：${jobLabel[p.job]} → ${jobLabel[newJob]}？\n\n花费：100,000 金币\n装备全部保留，无需卸下`;
    msg += offSkills.length > 0 ? `\n将卸下技能（已学保留）：${offSkills.join('、')}` : '\n无需卸下技能';
    if (!confirm(msg)) return;
    game.changeJob(newJob);
    renderApp();
  };
  const btnBlacksmithClose = document.getElementById('btn-blacksmith-close');
  if (btnBlacksmithClose) btnBlacksmithClose.onclick = () => { game.showBlacksmithPanel = false; renderApp(); };
  document.querySelectorAll('[data-reforge]').forEach(el => {
    el.onclick = () => { game.reforgeItem(parseInt(el.dataset.reforge)); renderApp(); };
  });
  document.querySelectorAll('[data-bless]').forEach(el => {
    el.onclick = () => {
      const t = el.dataset.bless;
      game.blessWeapon(t === 'equipped' ? 'equipped' : parseInt(t));
      renderApp();
    };
  });
  // 通天塔
  const btnTower = document.getElementById('btn-tower');
  if (btnTower) btnTower.onclick = () => { game.showTowerPanel = !game.showTowerPanel; renderApp(); };
  const btnTowerClose = document.getElementById('btn-tower-close');
  if (btnTowerClose) btnTowerClose.onclick = () => { game.showTowerPanel = false; renderApp(); };
  document.querySelectorAll('.btn-tower-fight').forEach(el => {
    if (el.dataset.reforge !== undefined || el.dataset.bless !== undefined) return; // 铁匠铺按钮已单独绑定，避免覆盖
    el.onclick = () => {
      const floor = parseInt(el.dataset.floor);
      game.showTowerPanel = false;
      game.startTowerFloor(floor);
      renderApp();
    };
  });
  // 遮天塔（世界BOSS）
  const btnWorldBoss = document.getElementById('btn-worldboss');
  if (btnWorldBoss) btnWorldBoss.onclick = () => {
    game.showWorldBossPanel = !game.showWorldBossPanel;
    if (game.showWorldBossPanel) game.refreshWorldBossState();
    renderApp();
  };
  const btnWbClose = document.getElementById('btn-wb-close');
  if (btnWbClose) btnWbClose.onclick = () => { game.showWorldBossPanel = false; renderApp(); };
  const btnWbFight = document.getElementById('btn-wb-fight');
  if (btnWbFight) btnWbFight.onclick = () => { game.enterWorldBoss(); };
  const btnWbExit = document.getElementById('btn-wb-exit');
  if (btnWbExit) btnWbExit.onclick = () => { game.exitWorldBoss(); game.showWorldBossPanel = true; renderApp(); };
  const btnWbClaim = document.getElementById('btn-wb-claim');
  if (btnWbClaim) btnWbClaim.onclick = async () => {
    btnWbClaim.disabled = true;
    btnWbClaim.textContent = '领取中...';
    await game.claimWorldBossReward();
  };
}

// 版本检测：每60秒比对服务端版本号，不一致时弹更新横幅，60秒后自动刷新
let _initialGameVersion = null;
let _updateBannerShown = false;
let _pendingNewVersion = null; // 检测到的新版本（刷新目标）

async function checkGameVersion() {
  const res = await Api.getVersion();
  if (!res || res.error || !res.version) return; // 网络异常静默跳过
  if (_initialGameVersion === null) {
    _initialGameVersion = res.version; // 首次记录基准版本
    // 版本匹配成功：清除版本门槛强刷的重试计数，保证下次发版仍可强刷
    if (res.version === CLIENT_VERSION) {
      try { sessionStorage.removeItem('force_update_retry'); } catch (e) { /* 静默 */ }
    }
    // 上次更新刷新留下的标记：若目标版本已生效则清除（避免重复弹横幅）
    try {
      const pending = sessionStorage.getItem('pending_update_ver');
      const retries = parseInt(sessionStorage.getItem('update_reload_retry') || '0');
      if (pending) {
        if (res.version === pending || retries >= 3) {
          sessionStorage.removeItem('pending_update_ver');
          sessionStorage.removeItem('update_reload_retry');
        }
      }
    } catch (e) { /* 隐私模式下静默 */ }
    return;
  }
  if (res.version !== _initialGameVersion && !_updateBannerShown) {
    // 若刚刷新过仍是旧版本（缓存未破），不重复弹横幅，等下一轮重试
    try {
      if (sessionStorage.getItem('pending_update_ver')) {
        const retries = parseInt(sessionStorage.getItem('update_reload_retry') || '0');
        if (retries >= 3) return; // 重试超限，等玩家手动刷新
        sessionStorage.setItem('update_reload_retry', String(retries + 1));
      }
    } catch (e) { /* 静默 */ }
    _updateBannerShown = true;
    _pendingNewVersion = res.version;
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    let left = 60;
    banner.innerHTML = `🎉 游戏已更新！<button id="btn-reload-now">立即刷新</button> <span id="reload-countdown">${left}秒后自动刷新</span>`;
    document.body.appendChild(banner);
    document.getElementById('btn-reload-now').onclick = doReloadForUpdate;
    const timer = setInterval(() => {
      left--;
      const el = document.getElementById('reload-countdown');
      if (el) el.textContent = `${left}秒后自动刷新`;
      if (left <= 0) { clearInterval(timer); doReloadForUpdate(); }
    }, 1000);
  }
}

async function doReloadForUpdate() {
  try { if (game.player && Api.isLoggedIn()) await game.flushToServer(); } catch (e) { /* 静默 */ }
  // 记录目标版本+破缓存参数强刷：避免浏览器缓存导致刷新后仍是旧代码
  try {
    sessionStorage.setItem('pending_update_ver', _pendingNewVersion || '');
    sessionStorage.setItem('update_reload_retry', '0');
  } catch (e) { /* 静默 */ }
  const u = new URL(location.href);
  u.searchParams.set('_upd', Date.now());
  location.replace(u.toString());
}

// 初始化
window.onload = () => {
  game.onChange(() => renderApp());
  // 必须登录才能游戏（无离线模式）
  if (Api.isLoggedIn()) {
    // 先显示加载状态，验证token有效性
    document.getElementById('app').innerHTML = '<div class="char-select"><h1>🐉 传奇挂机</h1><p class="subtitle">正在验证登录状态...</p></div>';
    Api.downloadSave().then(res => {
      if (res.error) { renderApp(); return; }
      if (res.exists && res.data) {
        game.loadFromData(res.data);
        if (res.version) game._saveVersion = res.version;
      }
      renderApp();
    }).catch(() => { renderApp(); });
  } else {
    renderApp();
  }
  // 备用渲染：挂机时每秒强制刷新一次
  setInterval(() => { if (game.isIdle) renderApp(); }, 1000);
  // 自动保存（本地+服务端）
  setInterval(() => { if (game.player) game.save(); }, 10000);
  // 版本检测：立即查一次记录基准，之后每60秒比对
  checkGameVersion();
  setInterval(checkGameVersion, 60000);
  // 遮天塔面板开启时每5秒轮询BOSS状态（战斗中伤害上报已同步血量，无需轮询）
  setInterval(() => { if (game.showWorldBossPanel && !game.inWorldBoss) game.refreshWorldBossState(); }, 5000);
};
