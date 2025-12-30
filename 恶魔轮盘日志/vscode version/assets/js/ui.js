/**
 * ui.js - 负责所有界面显示与交互效果
 * 作用：处理 DOM 操作、文本翻译、动画渲染、弹窗管理、3D视差效果
 */

// =========================================
// 1. 翻译与文本渲染 (Localization)
// =========================================

// 语言翻译核心函数
// key: 文本常量的键名 (如 'shot_live')
// params: 动态参数对象 (如 {dmg: 2})
function t(key, params = {}) {
    let str = TEXT[curLang][key]; // 从 constants.js 获取对应语言的文本
    if (!str) return key; // 如果没找到，直接返回键名方便调试
    // 遍历参数，将文本中的 {placeholder} 替换为实际数值
    for (let p in params) str = str.replace(`{${p}}`, params[p]);
    return str;
}

// 刷新页面上所有的静态文本 (切换语言时调用)
function renderLanguage() {
    // 菜单按钮文本
    document.getElementById('btn-pve').innerText = t('pve_btn');
    document.getElementById('btn-pvp').innerText = t('pvp_btn');
    document.getElementById('btn-continue').innerText = t('btn_continue');
    document.getElementById('restart-btn').innerText = t('restart_btn');
    
    // 顶部状态栏文本
    document.getElementById('txt-twist').innerText = isTwisted ? t('twist_on') : t('twist_off');
    document.getElementById('subtitle-fix').innerText = t('subtitle_fix');
    
    // 操作按钮文本 (如果是俄罗斯轮盘模式，按钮文字会变)
    document.getElementById('txt-self').innerText = isRussianRoulette ? t('btn_pull') : t('btn_self');
    document.getElementById('txt-enemy').innerText = t('btn_enemy');
    document.querySelector('#btn-self small').innerText = isRussianRoulette ? "" : t('sub_self');
    document.querySelector('#btn-enemy small').innerText = t('sub_enemy');

    // 玩家/敌人标签
    document.getElementById('label-demon').innerText = (gameMode === 'pvp') ? t('label_p2') : t('label_demon');
    document.getElementById('label-you').innerText = (gameMode === 'pvp') ? t('label_p1') : t('label_you');

    // 设置菜单文本
    document.querySelector('.settings-content button:nth-of-type(1)').innerText = t('s_resume');
    document.querySelector('.settings-content button:nth-of-type(2)').innerText = t('s_menu');
    document.querySelector('.settings-content button:nth-of-type(3)').innerText = t('s_giveup');
    document.getElementById('txt-sound').innerText = t('s_sound');
    document.getElementById('setting-paused').innerText = t('setting_paused');

    // 天赋与契约标题
    document.getElementById('title-talent').innerText = t('title_talent');
    document.getElementById('title-pact').innerText = t('title_pact');
    document.getElementById('pact-desc').innerText = t('pact_desc');
    document.getElementById('btn-nodeal').innerText = t('btn_nodeal');

    // 实时更新天赋/契约悬浮窗文本 (鼠标悬停在血条时显示)
    if (selectedTalent) {
        let tal = TALENTS.find(t => t.id === selectedTalent);
        if (tal) {
            document.getElementById('hover-talent-name').innerText = t(tal.key);
            document.getElementById('hover-talent-desc').innerText = t(tal.desc);
        }
    }
    const pactIconEl = document.getElementById('ui-pact-icon');
    const pactInfoBox = document.getElementById('ui-pact-info');

    if (selectedPact) {
        // 如果选择了契约，从常量表中查找数据
        let pact = PACTS.find(p => p.id === selectedPact);
        if (pact) {
            // 1. 显示名字旁边的图标
            pactIconEl.innerText = pact.icon;
            pactIconEl.style.display = 'block';

            // 2. 显示悬浮窗里的详细信息
            document.getElementById('hover-pact-name').innerText = t(pact.key);
            document.getElementById('hover-pact-desc').innerText = t(pact.desc);
            pactInfoBox.style.display = 'block';
        }
    } else {
        // 如果没有契约，隐藏相关元素
        pactIconEl.style.display = 'none';
        pactInfoBox.style.display = 'none';
    }    

    // Boss 信息栏更新
    if (currentBoss) {
        let prefix = (gameMode === 'pvp') ? 'player2' : currentBoss.id;
        let displayName = t('b_'+prefix);
        if(displayName.startsWith('b_')) displayName = t('boss_unknown'); // 防止报错
        document.getElementById('boss-name-display').innerText = displayName;
        document.getElementById('boss-passive-display').innerText = t('p_' + prefix);
    } else {
        document.getElementById('boss-name-display').innerText = t('boss_unknown');
    }

    // 当前事件信息更新
    if (currentEvent) {
        document.getElementById('active-event-name').innerText = t('e_'+currentEvent.id);
        document.getElementById('tooltip-event-title').innerText = t('e_'+currentEvent.id);
        document.getElementById('tooltip-event-desc').innerText = t('ed_'+currentEvent.id);
        // 更新开场动画的文字
        document.getElementById('splash-title').innerText = t('e_'+currentEvent.id);
        document.getElementById('splash-desc').innerText = t('ed_'+currentEvent.id);
    }

    // 俄罗斯轮盘模式特殊覆盖
    if (isRussianRoulette) {
        document.getElementById('active-event-name').innerText = "ROULETTE";
        document.getElementById('splash-title').innerText = t('rr_trigger');
        document.getElementById('splash-desc').innerText = t('rr_desc');
   }

    // 刷新其他动态 UI 组件
    updateAmmoTracker();
    renderItemsGrid();
    renderUI();
    updateAchievementsUI(); 
    checkSave();
}

// =========================================
// 2. 动态游戏状态渲染 (Health, Items)
// =========================================

// 渲染血条、生命数(除颤器)和道具状态
function renderUI() {
    // 内部函数：绘制单个角色的血条
    const drawHP = (pid, elId) => {
        let h = '';
        let styleClass = (pid === 1) ? 'you-active' : 'demon-active'; // 颜色区分
        for (let i = 0; i < maxHp[pid]; i++) {
            // 护盾逻辑：如果有护盾且该格血量存在，加金边
            let shieldClass = (statusEffects[pid].shield > 0 && i < hp[pid]) ? 'shielded' : '';
            // 生成血格 div
            h += `<div class="hp-point ${i < hp[pid] ? styleClass : ''} ${shieldClass}"></div>`;
        }
        document.getElementById(elId).innerHTML = h;
        
        // 绘制生命数 (Hearts)
        let lifeHtml = '';
        for (let j = 0; j < lives[pid]; j++) { lifeHtml += `<span class="life-heart life-active">❤</span>`; }
        document.getElementById((pid === 1) ? 'lives-you' : 'lives-demon').innerHTML = lifeHtml;
    };
    
    drawHP(1, 'player-hp'); // 画玩家
    drawHP(2, 'demon-hp');  // 画敌人

    // 更新道具栏的数字角标
    let showId = (gameMode === 'pve') ? 1 : currentTurn; // PvE只显示玩家道具，PvP显示当前回合者
    ITEM_LIST.forEach(k => { 
        let el = document.getElementById('n-' + k);
        if (el) {
            let count = currentItems[showId][k] || 0;
            el.innerText = count;
            // 如果数量为0，隐藏角标
            el.parentElement.style.display = count > 0 ? 'flex' : 'none'; // 这里其实控制的是整个按钮显示，或者角标显示，取决于 CSS
        }
        
        // 控制道具按钮的禁用状态
        let btn = document.getElementById('btn-item-'+k);
        if(btn) {
            btn.querySelector('.item-content').classList.remove('item-deceptive'); // 重置欺诈效果
            // 如果是俄罗斯轮盘，或者射击按钮被禁用了（非自己回合），道具也不能用
            btn.disabled = isRussianRoulette || !document.getElementById('btn-self').disabled ? false : true;
            if(gameLock) btn.disabled = true; // 动画播放中禁用
            
            // 契约：欺诈之眼 (50%概率让道具看起来像假的/灰色的)
            if (selectedPact === 'eye' && currentItems[1][k] > 0 && showId === 1 && !isRussianRoulette) {
                if (Math.random() < 0.5) btn.querySelector('.item-content').classList.add('item-deceptive');
            }
        }
    });

    // 俄罗斯轮盘模式强制禁用所有操作
    if(isRussianRoulette) {
        document.querySelectorAll('.item-btn').forEach(b => b.disabled = true);
        document.getElementById('btn-enemy').disabled = true;
    }

    // PvE 模式下，显示 Boss 的道具库存
    if (gameMode === 'pve') {
        const eContainer = document.getElementById('enemy-items-display');
        eContainer.innerHTML = '';
        
        // 🌟 新增：如果是选择模式，给容器加个高亮边框提示玩家
        if (typeof mirrorSelectionMode !== 'undefined' && mirrorSelectionMode) {
            eContainer.style.border = "1px dashed var(--accent-purple)";
            eContainer.style.backgroundColor = "rgba(165, 94, 234, 0.1)";
            eContainer.style.borderRadius = "4px";
        } else {
            eContainer.style.border = "none";
            eContainer.style.backgroundColor = "transparent";
        }

        for (let item in currentItems[2]) {
            let count = currentItems[2][item];
            if (count > 0) {
                for(let c=0; c<count; c++) {
                    let div = document.createElement('div');
                    div.className = 'enemy-item-icon';
                    div.innerHTML = `${ITEM_ICONS[item]}<div class="enemy-item-tooltip"><b>${t('i_'+item)}</b><br>${t('d_'+item)}</div>`;
                    
                    // 🌟 核心修改：如果处于选择模式，添加点击事件和样式
                    if (typeof mirrorSelectionMode !== 'undefined' && mirrorSelectionMode) {
                        div.style.cursor = 'pointer';
                        div.style.boxShadow = '0 0 10px var(--accent-purple)'; // 发光效果
                        div.style.animation = 'pulse 1s infinite'; // 跳动动画
                        
                        // 绑定点击事件，调用 engine.js 里的函数
                        div.onclick = function() {
                            window.performMirrorSteal(item);
                        };
                    }

                    eContainer.appendChild(div);
                }
            }
        }
    }
}

// 渲染玩家的道具网格 (初始化时调用)
function renderItemsGrid() {
    const area = document.getElementById('items-area'); area.innerHTML = '';
    ITEM_LIST.forEach(key => {
        let btn = document.createElement('button'); 
        btn.className = 'item-btn'; 
        btn.id = 'btn-item-'+key; 
        btn.onclick = () => useItem(key); // 绑定点击事件
        // 按钮结构：图标 + 名字 + 数量角标 + 悬浮提示
        btn.innerHTML = `<div class="item-content"><div class="item-icon">${ITEM_ICONS[key]}</div><div class="item-name">${t('i_'+key)}</div></div><div class="item-badge" id="n-${key}">0</div><div class="item-tooltip"><h4>${t('i_'+key)}</h4><p>${t('d_'+key)}</p></div>`;
        area.appendChild(btn);
    });
}

// 更新桌面上的弹药计数器
function updateAmmoTracker() {
    let live = magazine.filter(b => b === 1).length;
    let blank = magazine.filter(b => b === 0).length;
    let el = document.getElementById('ammo-tracker');
    
    // 迷雾事件：隐藏具体数值
    if (currentEvent && currentEvent.id === 'fog') {
        el.innerText = `【 ??? | Total: ${magazine.length} 】`;
        el.classList.add('fog-text');
    } else {
        el.innerText = t('ammo_fmt', { live, blank });
        el.classList.remove('fog-text');
    }
}

// 更新历史记录 (红/灰点)
function updateHistoryUI() {
    const container = document.getElementById('history-display');
    container.innerHTML = '';
    // 判断是否需要隐藏历史 (迷雾 或 PvP扑克脸天赋)
    let isHidden = (currentEvent && currentEvent.id === 'fog') || (selectedTalent === 'poker' && gameMode === 'pvp');
    if (isHidden) container.classList.add('hist-hidden'); else container.classList.remove('hist-hidden');

    historyLog.forEach(val => {
        let d = document.createElement('div'); d.className = 'hist-dot';
        if (val === 1) d.classList.add('hist-live'); // 实弹
        else if (val === 2) { d.classList.add('hist-unknown'); d.innerText = '?'; } // 被洗牌/未知
        else d.classList.add('hist-blank'); // 空弹
        container.appendChild(d);
    });
}

// 渲染弹舱状态 (用于放大镜查看后的显示)
function renderChamberUI() {
    let container = document.getElementById('chamber-display'); container.innerHTML = '';
    for(let i=0; i < magazine.length; i++) {
        let k = chamberKnowledge[i]; // 0:未知, 1:实弹, 2:空弹
        let div = document.createElement('div'); div.className = 'shell';
        if (i === magazine.length - 1) div.classList.add('next'); // 标记下一发
        if (k === 1) { div.classList.add('live'); div.innerText = '🔥'; } 
        else if (k === 2) { div.classList.add('blank'); div.innerText = '💨'; } 
        else { div.innerText = '?'; }
        container.appendChild(div);
    }
}

// 显示获得道具的通知 (Toast)
function showItemToast(itemList, pid) {
    if (pid !== 1) return; // 只显示玩家的获得提示
    const container = document.getElementById('toast-area');
    let counts = {}; itemList.forEach(i => counts[i] = (counts[i] || 0) + 1); // 统计获得数量

    for (let item in counts) {
        let card = document.createElement('div'); card.className = 'toast-card';
        card.innerHTML = `<div class="toast-icon">${ITEM_ICONS[item]}</div><div class="toast-info"><div class="toast-title">${t('toast_gain')}</div><div class="toast-name">${t('i_' + item)} x${counts[item]}</div></div>`;
        container.appendChild(card);
        // 3秒后淡出并移除 DOM
        setTimeout(() => { card.style.animation = 'toastFadeOut 0.4s ease-in forwards'; setTimeout(() => card.remove(), 400); }, 3000);
    }
}

// =========================================
// 3. 菜单与弹窗渲染
// =========================================

// 渲染天赋选择卡片 (随机取3个)
function renderTalentSelection() {
    const box = document.getElementById('talent-grid-box'); box.innerHTML = '';
    let pool = [...TALENTS].sort(() => 0.5 - Math.random()).slice(0, 3);
    pool.forEach(tal => {
        let el = document.createElement('div'); el.className = 'talent-card'; el.onclick = () => selectTalent(tal.id);
        el.innerHTML = `<div class="talent-icon">${tal.icon}</div><div class="talent-title">${t(tal.key)}</div><div class="talent-desc">${t(tal.desc)}</div>`;
        box.appendChild(el);
    });
}

// ui.js

// 渲染初始道具选择界面
function renderItemSelection() {
    const grid = document.getElementById('starter-item-grid');
    grid.innerHTML = '';
    
    // 排除掉一些不适合开局拿的道具 (比如 PvP 专用道具)
    // 这里复用 ALL_ITEM_LIST，但过滤掉 feint(假动作) 和 visor(假视镜)
    let pool = ALL_ITEM_LIST.filter(i => i !== 'feint' && i !== 'visor');

    pool.forEach(key => {
        let btn = document.createElement('div');
        btn.className = 'starter-select-btn';
        btn.id = 'starter-btn-' + key; // 给个ID方便查找
        btn.onclick = () => toggleStarterItem(key); // 点击触发选择逻辑
        
        // 内容：图标 + 名字
        btn.innerHTML = `
            <div style="font-size:1.5rem;">${ITEM_ICONS[key]}</div>
            <div style="font-size:0.5rem; color:#888;">${t('i_'+key)}</div>
        `;
        
        grid.appendChild(btn);
    });
    
    // 重置按钮状态
    updateStarterConfirmBtn();
}

// 更新确认按钮的文字 (0/2)
function updateStarterConfirmBtn() {
    const btn = document.getElementById('btn-confirm-items');
    btn.innerText = `CONFIRM (${starterItemsBuffer.length}/2)`;
    
    // 只有选了 1个 或 2个 才能开始 (如果强制必须2个，就写 === 2)
    if (starterItemsBuffer.length > 0) {
        btn.style.opacity = 1;
        btn.style.pointerEvents = 'auto';
    } else {
        btn.style.opacity = 0.5;
        btn.style.pointerEvents = 'none';
    }
}

// 渲染契约选择卡片 (随机取3个)
function renderPactSelection() {
    const box = document.getElementById('pact-grid-box'); box.innerHTML = '';
    let pool = [...PACTS].sort(() => 0.5 - Math.random()).slice(0, 3);
    pool.forEach(pact => {
        let el = document.createElement('div'); el.className = 'curse-card'; el.onclick = () => selectPact(pact.id);
        el.innerHTML = `<div class="talent-icon">${pact.icon}</div><div class="curse-title">${t(pact.key)}</div><div class="curse-desc">${t(pact.desc)}</div>`;
        box.appendChild(el);
    });
}

// 各种弹窗开关函数
function toggleLanguage() { curLang = (curLang === 'zh') ? 'en' : 'zh'; renderLanguage(); }
function openSettings() { document.getElementById('settings-screen').style.display = 'flex'; document.getElementById('sound-toggle').checked = soundEnabled; }
function closeSettings() { document.getElementById('settings-screen').style.display = 'none'; }
function updateLog(txt) { document.getElementById('info-text').innerText = txt; }
function toggleSound() { soundEnabled = document.getElementById('sound-toggle').checked; }
function showHelp() { document.getElementById('help-screen').style.display = 'flex'; }
function closeHelp() { document.getElementById('help-screen').style.display = 'none'; }
function toggleTwist() { isTwisted = !isTwisted; document.getElementById('twist-toggle').classList.toggle('active'); renderLanguage(); }
function showMenu() { document.getElementById('overlay').style.display = 'none'; document.getElementById('menu-screen').style.display = 'flex'; checkSave(); }

// =========================================
// 4. 成就系统 UI
// =========================================

function showAchievements() { document.getElementById('achieve-screen').style.display = 'flex'; updateAchievementsUI(); }
function closeAchieve() { document.getElementById('achieve-screen').style.display = 'none'; }

// 刷新成就列表显示
function updateAchievementsUI() {
    // 更新按钮上的计数 (如 5/30)
    document.getElementById('achieve-btn').innerText = `🏆 ${unlockedAchieves.length}/${ACHIEVEMENTS.length}`;
    let list = document.getElementById('achieve-list-container'); list.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
        let unlocked = unlockedAchieves.includes(a.id);
        // 如果解锁了，添加 'unlocked' 类，否则默认灰色
        let div = document.createElement('div'); div.className = `achieve-item ${unlocked?'unlocked':''}`;
        div.innerHTML = `<div class="ach-icon">🏆</div><div class="ach-info"><div>${t(a.key)}</div><div>${t(a.key.replace('ach','ad'))}</div></div>`;
        list.appendChild(div);
    });
}

// 解锁成就并在顶部弹出提示
function unlockAchievement(id) {
    if (!unlockedAchieves.includes(id)) {
        unlockedAchieves.push(id); localStorage.setItem('br_achievements', JSON.stringify(unlockedAchieves));
        // 顶部弹窗动画
        let pop = document.getElementById('achieve-popup'); let data = ACHIEVEMENTS.find(a => a.id === id);
        document.getElementById('achieve-pop-name').innerText = t(data.key); pop.style.display = 'flex'; 
        setTimeout(() => pop.style.display = 'none', 3000); 
        updateAchievementsUI();
    }
}

// 触发 Boss 嘲讽气泡
function triggerTaunt(type) {
    if (!currentBoss || gameMode === 'pvp') return;
    if (Math.random() > 0.4) return; // 只有 40% 概率触发
    const quotes = BOSS_TAUNTS[currentBoss.id][type]; if (!quotes) return;
    const txt = quotes[Math.floor(Math.random() * quotes.length)];
    const bubble = document.getElementById('boss-taunt'); 
    bubble.innerText = txt; bubble.classList.add('show'); 
    setTimeout(() => bubble.classList.remove('show'), 3000);
}

// 辅助更新接口
function updateTurnUI() { renderLanguage(); }

// 5.控制魔镜遮罩和高亮显示的辅助函数
function renderMirrorUI(active) {
    const overlay = document.getElementById('mirror-overlay');
    const enemyBox = document.getElementById('enemy-items-display');

    if (active) {
        overlay.style.display = 'block'; // 显示遮罩
        enemyBox.classList.add('mirror-active-target'); // 给敌人道具栏添加高亮类
    } else {
        overlay.style.display = 'none'; // 隐藏遮罩
        enemyBox.classList.remove('mirror-active-target'); // 移除高亮类
    }
}

// 取消魔镜模式 (HTML遮罩层的 onclick 会调用此函数)
window.cancelMirrorMode = function() {
    if (!mirrorSelectionMode) return;

    mirrorSelectionMode = false;

    // 退还刚才扣除的道具
    currentItems[1]['mirror']++; 
    itemsUsedThisTurn--; 

    updateLog("🔮 已取消窃取。");

    // 关闭 UI 效果
    renderMirrorUI(false); 
    renderUI();
};

// =========================================
// 6. 页面加载与 3D 视差效果
// =========================================
window.onload = function() {
    const gameContainer = document.getElementById('game-container');
    const gunDisplay = document.getElementById('gun-display');
    
    // 鼠标移动时计算偏移量，实现枪支和背景的伪 3D 旋转
    gameContainer.addEventListener('mousemove', (e) => {
        // 如果游戏被锁定或在菜单中，不执行
        if (gameLock || document.getElementById('menu-screen').style.display !== 'none' || document.getElementById('settings-screen').style.display !== 'none') return;
        
        const rect = gameContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // 计算鼠标距离中心的百分比
        const deltaX = (e.clientX - centerX) / (rect.width / 2);
        const deltaY = (e.clientY - centerY) / (rect.height / 2);
        
        // 应用 CSS transform
        gunDisplay.style.transform = `perspective(500px) rotateY(${deltaX * 15}deg) rotateX(${-deltaY * 10}deg)`;
    });
    
    // 鼠标离开时复位
    gameContainer.addEventListener('mouseleave', () => {
        if (!gameLock) gunDisplay.style.transform = 'perspective(500px) rotateY(0deg) rotateX(0deg)';
    });
    
    renderItemsGrid(); checkSave();
};