/**
 * engine.js - 核心游戏逻辑与状态管理
 * 负责：回合流程、伤害计算、道具效果、AI逻辑、存档管理
 */

// =========================================
// 1. 全局状态初始化 (Global State)
// =========================================
let curLang = 'zh', gameMode = 'pve', level = 1, isTwisted = false; // 语言, 模式, 关卡, 扭曲模式开关
let starterItemsBuffer = []; // 用于暂存玩家选择的初始道具
let magazine = [], chamberKnowledge = [], historyLog = []; // 弹舱数组(1实0空), 玩家已知信息(1实2空0未知), 历史记录
let hp = { 1: 4, 2: 3 }, maxHp = { 1: 4, 2: 3 }, lives = { 1: 2, 2: 2 }; // 血量与除颤器(命)
let currentItems = { 1: {}, 2: {} }; // 双方道具库存
let statusEffects = { 1: { jammed: false, mirror: false, shield: 0 }, 2: { jammed: false, mirror: false, shield: 0 } }; // 状态: 干扰, 魔镜, 护盾
let currentTurn = 1, currentBoss = null, currentEvent = null, gameLock = false; // 当前回合(1玩家2电脑), Boss数据, 事件, 游戏锁(防止动画时操作)
let selectedTalent = null, selectedPact = null, isRussianRoulette = false; // 天赋, 契约, 是否触发俄罗斯轮盘模式
let mirrorSelectionMode = false; // 是否处于魔镜选择模式

// --- 战斗临时变量 ---
let damageMultiplier = 1; // 伤害倍率 (锯子会设为 2)
let handCuffedTarget = 0; // 被手铐锁住的目标
let globalTimer = null;   // 全局定时器 (用于控制动画节奏)
let soundEnabled = true, itemsUsedThisTurn = 0, damageDealtThisTurn = false; // 音效, 本回合使用道具数, 是否已造成伤害
let ITEM_LIST = [...ALL_ITEM_LIST]; // 当前局可用的道具池
let bannedItems = []; // 被禁用的道具
let falseAlarmBuff = 0; // 天赋"虚惊一场"的伤害叠加
let feintActive = false; // "假动作"激活状态
let safetyActive = false; // "保险栓"激活状态
let beerCount = 0; // 喝啤酒计数 (成就用)
let magnifierCount = 0; // 放大镜计数 (成就用)
let delayedDamageQueue = { 1: [], 2: [] }; // 延迟伤害队列 (后效弹)
let deathChipActive = { 1: false, 2: false }; // 临终筹码激活状态
let visorActive = false; // 假视镜 (PvP)
let adrenalineDebt = { 1: false, 2: false }; // 肾上腺素债务 (下回合扣血)
let nextShotIsDelayed = false; // 下一发子弹是否带毒 (后效弹)
let tacticianTrapActive = false; // 战术家 Boss 的首个道具封锁
let isDevilDealActive = false; // 是否触发恶魔交易 (自己对自己开枪的特殊博弈)
let unlockedAchieves = JSON.parse(localStorage.getItem('br_achievements')) || []; // 成就数据
let consecutiveLiveShots = 0; // 连续实弹计数 (用于过热事件)


// engine.js

// =========================================
// AI 策略行为定义 (Strategy Pattern)
// =========================================

// 辅助函数：计算当前实弹的概率
function getLiveProbability() {
    // 如果没子弹，概率为0
    if (magazine.length === 0) return 0;
    
    let liveCount = magazine.filter(b => b === 1).length;
    
    // 检查下一发是否已被偷看 (chamberKnowledge)
    // 假设 chamberKnowledge 数组与 magazine 索引对应，且最后一个元素是下一发
    let nextIdx = magazine.length - 1; 
    let known = chamberKnowledge[nextIdx];
    
    if (known === 1) return 1.0; // 确认为实弹
    if (known === 2) return 0.0; // 确认为空弹
    
    return liveCount / magazine.length;
}

// 辅助函数：默认的基础射击逻辑 (原版 AI 逻辑)
function defaultShootingLogic() {
    let prob = getLiveProbability();
    // 100% 实弹 -> 射敌人
    if (prob === 1) {
        fire('enemy');
    } 
    // 100% 空弹 -> 射自己 (骗回合)
    else if (prob === 0) {
        fire('self');
    } 
    // 概率判断：大于50%概率射敌人，否则射自己搏一搏
    else {
        fire(prob > 0.5 ? 'enemy' : 'self');
    }
}

// AI 行为模式库
const AI_BEHAVIORS = {
    // 🔪 激进型 (Butcher): 喜欢进攻，有伤害道具必用
    aggressive: function() {
        // 优先使用锯子
        if (currentItems[2].saw > 0) { useItem('saw'); return; }
        
        // 血量极低时才考虑回血
        if (hp[2] <= 1 && currentItems[2].smoke > 0) { useItem('smoke'); return; }

        // 射击逻辑：只要实弹概率 > 40% 就敢开枪射你，非常凶
        let prob = getLiveProbability();
        if (prob >= 0.4) { fire('enemy'); } 
        else { fire('self'); }
    },

    // 🛡️ 防守型 (Doctor): 苟命要紧，优先回血和侦查
    defensive: function() {
        // 有伤就吸烟
        if (hp[2] < maxHp[2] && currentItems[2].smoke > 0) { useItem('smoke'); return; }
        // 有啤酒就喝
        if (currentItems[2].beer > 0) { useItem('beer'); return; }
        // 喜欢用放大镜确认情况
        if (currentItems[2].magnifier > 0) { useItem('magnifier'); return; }
        
        // 射击逻辑：非常保守，只有 > 60% 把握才射敌人
        let prob = getLiveProbability();
        if (prob > 0.6) { fire('enemy'); } 
        else { fire('self'); }
    },

    // 🤪 混乱型 (Gambler / Default): 随机乱用道具，行为不可预测
    chaotic: function() {
        // 50% 概率随机使用一个可用道具
        let available = Object.keys(currentItems[2]).filter(k => currentItems[2][k] > 0);
        if (available.length > 0 && Math.random() < 0.5) {
            let randomItem = available[Math.floor(Math.random() * available.length)];
            useItem(randomItem);
            return;
        }
        // 否则走默认射击逻辑
        defaultShootingLogic();
    }
};


// =========================================
// 2. 存档系统 (Save & Load)
// =========================================

// 检查是否有存档，决定菜单"继续游戏"按钮是否显示
function checkSave() {
    const btn = document.getElementById('btn-continue');
    if(btn) btn.style.display = localStorage.getItem('br_save') ? 'block' : 'none';
}

// 保存游戏状态到 LocalStorage
function saveGame() {
    // 动画播放中或游戏结束时不保存
    if (gameLock && lives[1] > 0 && lives[2] > 0) return;
    if (lives[1] <= 0 || lives[2] <= 0) return; 

    const gameState = {
        hp, maxHp, lives, currentItems, magazine, chamberKnowledge,
        level, currentTurn, currentBoss, currentEvent,
        damageMultiplier, handCuffedTarget, statusEffects,
        isTwisted, selectedTalent, selectedPact, gameMode, historyLog, soundEnabled,
        bannedItems, falseAlarmBuff, itemsUsedThisTurn, safetyActive, beerCount, magnifierCount,
        damageDealtThisTurn, delayedDamageQueue, deathChipActive, visorActive, adrenalineDebt, nextShotIsDelayed,
        isRussianRoulette
    };
    localStorage.setItem('br_save', JSON.stringify(gameState));
}

// 读取存档
function loadGame() {
    const saved = localStorage.getItem('br_save');
    if(!saved) return;
    try {
        const s = JSON.parse(saved);
        // 恢复所有变量...
        hp = s.hp; maxHp = s.maxHp; currentItems = s.currentItems;
        magazine = s.magazine; chamberKnowledge = s.chamberKnowledge;
        level = s.level; currentTurn = s.currentTurn; currentBoss = s.currentBoss;
        currentEvent = s.currentEvent; damageMultiplier = s.damageMultiplier;
        handCuffedTarget = s.handCuffedTarget; statusEffects = s.statusEffects;
        isTwisted = s.isTwisted; selectedTalent = s.selectedTalent; selectedPact = s.selectedPact || null;
        historyLog = s.historyLog || []; gameMode = s.gameMode;
        isRussianRoulette = s.isRussianRoulette || false;

        // 恢复杂项状态
        if(s.soundEnabled !== undefined) soundEnabled = s.soundEnabled;
        lives = s.lives || {1:2, 2:2};
        bannedItems = s.bannedItems || [];
        falseAlarmBuff = s.falseAlarmBuff || 0;
        itemsUsedThisTurn = s.itemsUsedThisTurn || 0;
        safetyActive = s.safetyActive || false;
        beerCount = s.beerCount || 0;
        magnifierCount = s.magnifierCount || 0;
        damageDealtThisTurn = s.damageDealtThisTurn || false;
        delayedDamageQueue = s.delayedDamageQueue || { 1: [], 2: [] };
        deathChipActive = s.deathChipActive || { 1: false, 2: false };
        visorActive = s.visorActive || false;
        adrenalineDebt = s.adrenalineDebt || { 1: false, 2: false };
        nextShotIsDelayed = s.nextShotIsDelayed || false;

        // 重建道具池 (排除被 ban 的)
        ITEM_LIST = ALL_ITEM_LIST.filter(i => !bannedItems.includes(i));
        if (gameMode === 'pve') ITEM_LIST = ITEM_LIST.filter(i => i !== 'feint' && i !== 'visor'); 

        // UI 恢复
        document.getElementById('menu-screen').style.display = 'none';
        document.getElementById('event-splash').style.display = 'none'; 
        document.getElementById('overlay').style.display = 'none'; 
        document.getElementById('talent-screen').style.display = 'none';
        document.getElementById('pact-screen').style.display = 'none';
        document.getElementById('settings-screen').style.display = 'none';
        document.getElementById('dice-overlay').style.display = 'none';
        
        gameLock = false; 
        document.getElementById('gun-display').style.transform = "perspective(500px) rotate(0deg)";
        document.getElementById('game-container').classList.remove('shaking');
        
        // 俄罗斯轮盘特效开关
        if (isRussianRoulette) document.body.classList.add('rr-mode-active');
        else document.body.classList.remove('rr-mode-active');

        renderLanguage(); renderChamberUI(); updateHistoryUI();
        
        // 恢复 AI 或控制权
        if (currentTurn === 1) { setControls(true); } 
        else { setControls(false); if (gameMode === 'pve') { clearTimeout(globalTimer); globalTimer = setTimeout(aiLogic, 1000); } }
        
        updateLog("GAME RESUMED");
    } catch (e) { console.error("Save corrupted", e); clearSave(); }
}

function clearSave() { localStorage.removeItem('br_save'); checkSave(); }
function exitGame() { if(lives[1] > 0 && lives[2] > 0) saveGame(); clearTimeout(globalTimer); document.getElementById('settings-screen').style.display = 'none'; document.getElementById('menu-screen').style.display = 'flex'; checkSave(); }
function giveUpGame() { clearTimeout(globalTimer); document.getElementById('settings-screen').style.display = 'none'; lives[1] = 0; hp[1] = 0; checkDead(); }

// =========================================
// 3. 游戏初始化流程
// =========================================

// 预开始：选择模式 -> 进入天赋选择(PvE) 或 直接开始(PvP)
function preStartGame(mode) { 
    gameMode = mode; clearSave();
    if (mode === 'pve') { 
        document.getElementById('menu-screen').style.display = 'none'; 
        document.getElementById('talent-screen').style.display = 'flex'; 
        renderTalentSelection(); 
    } else { initGame(); } 
}

// 选择天赋的回调
function selectTalent(tal) { 
    selectedTalent = tal; 
    document.getElementById('talent-screen').style.display = 'none'; 
    document.getElementById('pact-screen').style.display = 'flex'; 
    renderPactSelection(); 
}


// 选择契约的回调 -> 进入道具选择
function selectPact(pact) {
    selectedPact = pact;
    document.getElementById('pact-screen').style.display = 'none';
    
    starterItemsBuffer = []; 
    document.getElementById('starter-item-screen').style.display = 'flex';
    renderItemSelection(); // 调用 ui.js 里的渲染函数
}

// 初始化一局新游戏
function initGame() {
    document.getElementById('menu-screen').style.display = 'none';

    currentItems = { 1: {}, 2: {} }; 
    //防止道具残留
    level = 1;
    bannedItems = [];

    beerCount = 0; magnifierCount = 0;
    isRussianRoulette = false;
    
    ITEM_LIST = [...ALL_ITEM_LIST];
    if (gameMode === 'pve') ITEM_LIST = ITEM_LIST.filter(i => i !== 'feint' && i !== 'visor');

    if (selectedTalent === 'ban') {
            let bannedNames = []; // ✨ 1. 用于暂存被禁用道具的名字
            
            for(let i=0; i<2; i++) {
                if (ITEM_LIST.length > 2) {
                    let r = Math.floor(Math.random() * ITEM_LIST.length);
                    let itemKey = ITEM_LIST[r]; // 获取 ID
                    
                    bannedItems.push(itemKey);
                    bannedNames.push(t('i_' + itemKey)); // ✨ 获取翻译后的名字
                    
                    ITEM_LIST.splice(r, 1); // 从池中移除
                }
            }

            // ✨ 2. 延迟显示提示 (Splash动画约2.5秒，这里设3秒确保显示)
            if (bannedNames.length > 0) {
                setTimeout(() => {
                    updateLog(`🚫 禁忌生效！已移除: ${bannedNames.join(' & ')}`);
                }, 3000);
            }
        }
    
    // 初始化血量上限
    if (gameMode === 'pvp') { maxHp = { 1: 4, 2: 4 }; } else { maxHp = { 1: 4, 2: 3 }; }
    
    // 契约对血量的修正
    if (selectedPact === 'greed') maxHp[1] = Math.max(1, maxHp[1] - 1);
    if (selectedPact === 'flesh') maxHp[1] = Math.max(1, maxHp[1] - 2);
    if (selectedPact === 'half') maxHp[1] = 3;

    hp = { 1: maxHp[1], 2: maxHp[2] };
    lives = { 1: 2, 2: 2 }; 

    // 生成 Boss
    if (gameMode === 'pve') {
        let proto = DEMON_ARCHETYPES[Math.floor(Math.random() * DEMON_ARCHETYPES.length)];
        currentBoss = JSON.parse(JSON.stringify(proto));
        currentBoss.phase2 = false;
    } else { currentBoss = {id: 'player2'}; }
    
    renderLanguage(); startRound();
}

// 掷骰子争夺先手 (UI 动画)
function triggerDiceRoll() {
    const dOverlay = document.getElementById('dice-overlay');
    const sumP1 = document.getElementById('sum-p1');
    const sumP2 = document.getElementById('sum-p2');
    const msg = document.getElementById('dice-msg');
    
    dOverlay.style.display = 'flex';
    sumP1.innerText = ''; sumP2.innerText = ''; msg.innerText = "ROLLING...";
    
    let rolls = 0;
    let p1Val = 0, p2Val = 0;
    
    // 骰子跳动动画
    let interval = setInterval(() => {
        let r1 = Math.floor(Math.random()*6)+1, r2 = Math.floor(Math.random()*6)+1;
        let r3 = Math.floor(Math.random()*6)+1, r4 = Math.floor(Math.random()*6)+1;
        document.getElementById('d1-1').innerText = r1;
        document.getElementById('d1-2').innerText = r2;
        document.getElementById('d2-1').innerText = r3;
        document.getElementById('d2-2').innerText = r4;
        p1Val = r1+r2; p2Val = r3+r4;
        rolls++;
        if (rolls > 15) { // 动画结束
            clearInterval(interval);
            sumP1.innerText = p1Val; sumP2.innerText = p2Val;
            
            if (p1Val === p2Val) {
                msg.innerText = "DRAW! REROLLING..."; // 平局重投
                setTimeout(triggerDiceRoll, 1000);
            } else if (p1Val > p2Val) {
                msg.innerText = "YOU START!";
                setTimeout(() => {
                    dOverlay.style.display = 'none';
                    currentTurn = 1; handleTurnStart();
                }, 1500);
            } else {
                msg.innerText = "ENEMY STARTS!";
                setTimeout(() => {
                    dOverlay.style.display = 'none';
                    currentTurn = 2; handleTurnStart();
                }, 1500);
            }
        }
    }, 100);
}

// =========================================
// 4. 回合开始 (装弹阶段)
// =========================================
function startRound(isResurrection = false) {
    clearTimeout(globalTimer); 
    gameLock = false; 
    document.getElementById('event-splash').style.display = 'none';
    
    // 清理上一轮的临时状态
    historyLog = []; 
    falseAlarmBuff = 0; 
    safetyActive = false;
    itemsUsedThisTurn = 0;
    statusEffects[1].shield = 0; statusEffects[2].shield = 0; 
    damageDealtThisTurn = false;
    delayedDamageQueue = { 1: [], 2: [] };
    deathChipActive = { 1: false, 2: false };
    adrenalineDebt = { 1: false, 2: false };
    nextShotIsDelayed = false;
    visorActive = false;
    updateHistoryUI();

    // 🎲 判定是否触发俄罗斯轮盘 (双方 1命1血)
    if (!isResurrection && lives[1] === 1 && hp[1] === 1 && lives[2] === 1 && hp[2] === 1 && Math.random() < 0.1) {
        isRussianRoulette = true;
        document.body.classList.add('rr-mode-active');
    }

    // 血量重置逻辑 (Boss战每关结束不回满，复活回满)
    if (gameMode === 'pvp') { hp[1] = maxHp[1]; hp[2] = maxHp[2]; } 
    else { 
        if(level > 1 && !isRussianRoulette) { hp[1] = Math.min(hp[1], maxHp[1]); if(hp[1]<=0) hp[1]=4; }
        hp[2] = maxHp[2]; 
    }
    if (isRussianRoulette) { hp[1] = 1; hp[2] = 1; }


    // 重置状态效果
    statusEffects = { 1: { jammed: false, mirror: false, shield: 0 }, 2: { jammed: false, mirror: false, shield: 0 } };
    tacticianTrapActive = (gameMode === 'pve' && currentBoss.id === 'tactician');
    
    // Boss 阶段外观更新
    document.getElementById('boss-card').classList.remove('enraged');
    if (currentBoss && currentBoss.phase2) document.getElementById('boss-card').classList.add('enraged');

    // 随机事件
    currentEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    renderLanguage();

    // --- 弹药生成逻辑 ---
    magazine = [];
    if (isRussianRoulette) {
        magazine = [1, 0, 0, 0, 0, 0]; // 固定 1实 5空
    } else {
        let total = 6; // 固定 6 发
        let live;

        // 1. 设定 5% 的极小概率触发“噩梦时刻” (6发全实弹)
        if (Math.random() < 0.05) {
            live = 6; 
             updateLog("⚠️ 警告：检测到高能反应！"); 
        } else {
            // 2. 剩下 95% 的情况：生成 1 到 5 发实弹 (拒绝 0 发)
            live = Math.floor(Math.random() * 5) + 1; 
        }

        for(let i=0; i<live; i++) magazine.push(1);
        for(let i=0; i<(total-live); i++) magazine.push(0);
        
        // 洗牌算法 (Fisher-Yates)
        for (let i = magazine.length - 1; i > 0; i--) { 
            const j = Math.floor(Math.random() * (i + 1)); 
            [magazine[i], magazine[j]] = [magazine[j], magazine[i]]; 
        }
        
        // 特殊修正 (保持不变)
        if (gameMode === 'pve' && currentBoss.id === 'gambler') magazine[0] = 1; 
        if (currentEvent.id === 'shuffle') { for (let i = magazine.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [magazine[i], magazine[j]] = [magazine[j], magazine[i]]; } }
        if (selectedPact === 'eerie' && magazine.length > 0) { let r = Math.floor(Math.random() * magazine.length); magazine[r] = (magazine[r] === 1) ? 0 : 1; updateLog("🔫 PACT: Eerie Mag Triggered"); }
    }

    // 处理"已知信息" (鹰眼天赋等)
    chamberKnowledge = new Array(magazine.length).fill(0);
    if (selectedTalent === 'eye' && Math.random() < 0.3 && magazine.length>0 && !isRussianRoulette) chamberKnowledge[magazine.length-1] = (magazine[magazine.length-1]===1) ? 1 : 2;
    if (currentEvent.id === 'vision' && Math.random() < 0.25 && magazine.length>0 && !isRussianRoulette) { let idx = magazine.length - 1; chamberKnowledge[idx] = magazine[idx] === 1 ? 1 : 2; }

    // 迷雾效果
    if (currentEvent.id === 'fog') document.getElementById('table-area').classList.add('fog-active');
    else document.getElementById('table-area').classList.remove('fog-active');

    if (!isResurrection && !isRussianRoulette) {
        let amount = (level === 1) ? 2 : 3; 
        if (selectedTalent === 'pack') amount++; 
        lootItems(1, amount);
        lootItems(2, amount);
    }

    setControls(false); renderChamberUI(); updateAmmoTracker(); saveGame();

    // 显示开场动画 (Splash Screen)
    let splash = document.getElementById('event-splash');
    if(!isResurrection) {
         if(isRussianRoulette) {
             document.getElementById('splash-title').innerText = t('rr_trigger');
             document.getElementById('splash-desc').innerText = t('rr_desc');
             document.querySelector('.event-splash-card').innerHTML += '<div class="rr-splash">☠️</div>';
         }
         splash.style.display = 'flex';
    } else { updateLog(t('reload')); }
    
    // 动画结束后开始
    globalTimer = setTimeout(() => {
        splash.style.display = 'none';
        if(!isResurrection) updateLog(t('reload'));
        damageMultiplier = 1; handCuffedTarget = 0; gameLock = false; 
        if (isResurrection) { currentTurn = 1; handleTurnStart(); } else { triggerDiceRoll(); } // 正常模式触发掷骰子
        saveGame();
    }, isResurrection ? 1000 : 2500);

    renderUI();
}

// 玩家点击开火按钮
function activePlayerAction(targetType) { if(!gameLock) fire(targetType); }

// =========================================
// 5. 核心射击逻辑 (最复杂的函数)
// =========================================
function fire(targetType) {
    setControls(false); gameLock = true; 
    let gun = document.getElementById('gun-display');
    gun.style.transform = "scale(1.3) rotate(-15deg)"; // 举枪动画
    playSound('fire');
    
    globalTimer = setTimeout(() => {
        let bullet = magazine.pop(); // 取出子弹
        chamberKnowledge.pop(); 
        
        if (visorActive) { visorActive = false; updateLog("🎭 VISOR EXPIRED"); }
        
        // --- 判定哑弹 (3%概率，扭曲模式除外) ---
        let isDud = (bullet === 1 && Math.random() < 0.03 && !isTwisted && !isRussianRoulette);
        if (isDud) { bullet = 0; updateLog(t('mech_dud')); } 
        renderChamberUI(); updateAmmoTracker(); 
        
        // --- 判定不稳定弹药 (空弹变实弹) ---
        let isVolatileTrigger = false;
        if (currentEvent.id === 'volatile' && bullet === 0 && Math.random() < 0.3 && !isRussianRoulette) { bullet = 1; isVolatileTrigger = true; }

        let isLive = (bullet === 1);
        let baseDmg = 1;

        // -------------------------
        // 💥 伤害计算公式
        // -------------------------
        if (!isRussianRoulette) {
            if (isTwisted && isLive) baseDmg++; // 扭曲模式+1
            if (selectedPact === 'power' && isLive) baseDmg++; 
            if (selectedPact === 'half' && isLive) baseDmg++;
            // 屠夫二阶段伤害极高
            if (gameMode === 'pve' && currentBoss.id === 'butcher' && currentTurn === 2 && isLive && currentBoss.phase2) baseDmg += 2;
            else if (gameMode === 'pve' && currentBoss.id === 'butcher' && currentTurn === 2 && isLive) baseDmg += 1;
            // 天赋叠加伤害
            if (isLive && falseAlarmBuff > 0) { baseDmg += falseAlarmBuff; falseAlarmBuff = 0; }
            if (isLive && selectedTalent === 'quick' && itemsUsedThisTurn === 0) baseDmg++;
        } else { baseDmg = 999; } // 俄罗斯轮盘一击必杀

        let dmg = baseDmg * damageMultiplier; // 乘区 (锯子)
        if (currentEvent.id === 'overheat' && isLive && !isRussianRoulette) dmg += consecutiveLiveShots++; // 过热连射加伤
        if (!isLive) consecutiveLiveShots = 0;
        
        // 减伤天赋
        if (targetType === 'self' && isLive && selectedTalent === 'pain' && !isRussianRoulette) dmg = Math.max(1, dmg - 1);
        
        // 😈 恶魔交易逻辑 (对自己开枪赌博)
        if (targetType === 'self' && isDevilDealActive) {
            if (isLive) { dmg *= 2; updateLog(t('deal_fail')); playSound('dmg'); } // 赌输了伤害翻倍
            else { lootItems(currentTurn, 2); updateLog(t('deal_success')); playSound('loot'); } // 赌赢了拿道具
            isDevilDealActive = false; 
        }
        
        // 血债血偿事件 (自伤翻倍)
        if (targetType === 'self' && currentEvent.id === 'blood' && isLive && !isRussianRoulette) dmg *= 2;
        
        // 🧪 后效弹逻辑 (伤害延迟)
        if (nextShotIsDelayed && isLive) {
            nextShotIsDelayed = false;
            delayedDamageQueue[targetType === 'self' ? currentTurn : (currentTurn===1?2:1)].push({dmg: dmg, turns: 2});
            dmg = 0; updateLog("🧪 POISON APPLIED (2 Turns)");
            document.getElementById('table-area').style.borderColor = "#2ecc71";
            setTimeout(()=>document.getElementById('table-area').style.borderColor = "#333", 500);
        }

        // 记录历史
        let historyVal = isLive ? 1 : 0;
        if (visorActive && gameMode === 'pvp') historyVal = (historyVal === 1) ? 0 : 1; // 假视镜干扰记录
        historyLog.push(historyVal);
        updateHistoryUI();

        let shooter = currentTurn;
        let opponent = (currentTurn === 1) ? 2 : 1;
        let victim = (targetType === 'self') ? shooter : opponent;
        let shooterName = getShooterName(shooter);

        // 屏幕震动
        document.getElementById('game-container').classList.add('shaking');
        globalTimer = setTimeout(()=> {
            document.getElementById('game-container').classList.remove('shaking');
            gun.style.transform = "perspective(500px) rotateY(0deg) rotateX(0deg)";
        }, 300);

        let skipTurnEffect = false;

        // ============================================
        // 🟥 分支 1: 实弹 (非哑弹)
        // ============================================
        if (isLive && !isDud) {
            // 契约：回声子弹 (实弹打完飞回弹舱)
            if (selectedPact === 'echo' && Math.random() < 0.25 && !isRussianRoulette) {
                magazine.unshift(1); chamberKnowledge.unshift(0); updateAmmoTracker(); renderChamberUI(); updateLog("🔄 ECHO BULLET RETURNED!");
            }
            // 护盾抵消
            if (statusEffects[victim].shield > 0 && dmg > 0) { statusEffects[victim].shield--; dmg = 0; updateLog(`🛡️ ${getShooterName(victim)} BLOCKED DAMAGE!`); }
            
            // 实际扣血
            if (dmg > 0) {
                if(isVolatileTrigger) updateLog("🧨 VOLATILE! " + t('shot_live', {shooter: shooterName, dmg: dmg}));
                else updateLog(t('shot_live', {shooter: shooterName, dmg: dmg}));
                playSound('bang');
                hp[victim] -= dmg;
                if(targetType === 'enemy') { document.getElementById('table-area').classList.add('flash-red'); damageDealtThisTurn = true; }
            }
            
            globalTimer = setTimeout(()=>document.getElementById('table-area').classList.remove('flash-red'), 200);
            
            // 成就解锁检查
            if (shooter === 1 && victim === 1) unlockAchievement(21);
            if (dmg >= 3 && hp[victim] <= 0 && targetType === 'enemy') unlockAchievement(27);
            
            damageMultiplier = 1; renderUI();
            if (victim === 1 && hp[1] > 0 && dmg > 0) triggerTaunt('hit');

            // Boss 暴走判定 (半血触发)
            if (gameMode === 'pve' && victim === 2 && hp[2] < maxHp[2]/2 && !currentBoss.phase2 && !isRussianRoulette) {
                triggerEnrage();
                // 暴走动画后继续流程
                globalTimer = setTimeout(() => {
                    if (!checkDead()) {
                        if (magazine.length === 0) startRound();
                        else switchTurn(opponent);
                    }
                }, 2600);
                return;
            }
            
            if (checkDead()) return; // 如果有人死了，结束函数
            if (isRussianRoulette && isLive) { return; } // 俄罗斯轮盘实弹不换人，直到死

            // 实弹射击后，通常换人
            if (magazine.length === 0) {
                globalTimer = setTimeout(startRound, 2000);
            } else {
                switchTurn(opponent); 
            }
        } 
        // ============================================
        // 🟦 分支 2: 空弹 或 哑弹
        // ============================================
        else {
            playSound('click'); damageMultiplier = 1; 
            
            // 2.1 哑弹处理 (虽然是实弹但没响)
            if (isDud) { 
                triggerTaunt('miss'); 
                if (magazine.length === 0 && !checkDead()) {
                     globalTimer = setTimeout(startRound, 2000);
                } else {
                     switchTurn(opponent); 
                }
                return; 
            }

            // 契约/天赋逻辑触发
            if (targetType === 'self' && selectedPact === 'flesh') { statusEffects[1].shield++; updateLog("🩸 FLESH PACT: SHIELD UP"); }
            if (targetType === 'enemy' && selectedPact === 'strict') { skipTurnEffect = true; updateLog("⚖️ STRICT PACT: SKIP TURN"); }
            if (selectedPact === 'greed' && !isRussianRoulette) { lootItems(currentTurn, 1); updateLog(t('c_greed_name')); }
            
            // 扭曲模式：空弹会重新洗牌
            if ((isTwisted || selectedPact === 'power') && !isRussianRoulette) {
                for (let i = magazine.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [magazine[i], magazine[j]] = [magazine[j], magazine[i]]; }
                chamberKnowledge.fill(0); renderChamberUI();
                historyLog.push(2); updateHistoryUI(); 
            }

            // 2.2 对自己射击 (空弹) -> 关键博弈点
            if (targetType === 'self') {
                unlockAchievement(3);
                if (hp[1] === 1) unlockAchievement(28);
                if (selectedTalent === 'alarm') falseAlarmBuff++;
                
                // 自爆天赋 (对自己打空弹反而扣敌人血)
                if (selectedTalent === 'boom' && !isRussianRoulette) { 
                    hp[opponent]--; updateLog("💥 SELF-DESTRUCT DMG"); 
                    damageDealtThisTurn = true; renderUI(); if(checkDead()) return; 
                }
                
                // 判断是否保留回合 (通常保留，除非特殊事件)
                if (currentEvent.id === 'blood' && selectedTalent !== 'luck' && !isRussianRoulette) { 
                    updateLog(t('shot_blank', {shooter: shooterName})); triggerTaunt('miss'); 
                    if (magazine.length === 0 && !checkDead()) { globalTimer = setTimeout(startRound, 2000); }
                    else { switchTurn(opponent); } // 血债血偿不保留回合
                } 
                else if (currentEvent.id === 'fair' && !isRussianRoulette) { 
                    // 公平模式不保留回合
                    updateLog(t('shot_blank', {shooter: shooterName}) + " (FAIR PLAY)"); 
                    if (magazine.length === 0 && !checkDead()) { globalTimer = setTimeout(startRound, 2000); }
                    else { switchTurn(opponent); }
                }
                else if (isRussianRoulette) { 
                    // 轮盘模式必须轮流开枪
                    updateLog(t('shot_blank', {shooter: shooterName}) + " (SAFE)"); 
                    if (magazine.length === 0 && !checkDead()) { globalTimer = setTimeout(startRound, 2000); }
                    else { switchTurn(opponent); }
                }
                else { 
                    // ✅ 成功保留回合 (Reward)
                    updateLog(t('shot_blank', {shooter: shooterName}) + " " + t('safe_bet')); 
                    if (magazine.length === 0 && !checkDead()) {
                        globalTimer = setTimeout(startRound, 2000);
                    } else {
                        globalTimer = setTimeout(() => handleTurnStart(), 1000); 
                    }
                }
            } 
            // 2.3 对敌人射击 (空弹) -> 错失良机
            else {
                updateLog(t('shot_blank_miss', {shooter: shooterName}));
                triggerTaunt('miss');
                if(skipTurnEffect) handCuffedTarget = shooter; 
                
                if (magazine.length === 0 && !checkDead()) {
                    globalTimer = setTimeout(startRound, 2000);
                } else {
                    switchTurn(opponent);
                }
            }
        }
    }, 500);
}

// =========================================
// 6. 回合管理
// =========================================

function switchTurn(nextPlayer) {
    // 急性死亡契约检测
    if (currentTurn === 1 && selectedPact === 'acute' && !damageDealtThisTurn && !isRussianRoulette) { hp[1]--; updateLog("⌛ ACUTE DEATH: -1 HP"); renderUI(); if(checkDead()) return; }
    // 手铐跳过检测
    if (handCuffedTarget === nextPlayer && !isRussianRoulette) { let name = getShooterName(nextPlayer); updateLog(`🔗 ${name} (SKIP)`); handCuffedTarget = 0; switchTurn((nextPlayer===1)?2:1); return; }
    currentTurn = nextPlayer;
    handleTurnStart();
}

function handleTurnStart() {
    gameLock = false; 
    itemsUsedThisTurn = 0; 
    damageDealtThisTurn = false;
    updateTurnUI();

    // 肾上腺素扣血
    if (adrenalineDebt[currentTurn]) { hp[currentTurn]--; adrenalineDebt[currentTurn] = false; updateLog("💉 ADRENALINE CRASH: -1 HP"); renderUI(); if (checkDead()) return; }
    
    // 毒伤结算
    let queue = delayedDamageQueue[currentTurn];
    if (queue.length > 0) {
        for (let i = queue.length - 1; i >= 0; i--) {
            queue[i].turns--;
            if (queue[i].turns <= 0) { hp[currentTurn] -= queue[i].dmg; updateLog(`🧪 POISON: -${queue[i].dmg} HP`); queue.splice(i, 1); }
        }
        renderUI(); if (checkDead()) return;
    }

    // 瘟医回血
    if (gameMode === 'pve' && currentBoss.id === 'doctor' && currentTurn === 2 && !isRussianRoulette) { if (hp[2] < maxHp[2] && Math.random() < 0.3) { hp[2]++; updateLog("💊 Doctor Heals"); renderUI(); playSound('heal'); } }
    
    // 激活恶魔交易按钮特效
    isDevilDealActive = false;
    let btnSelf = document.getElementById('btn-self');
    btnSelf.classList.remove('cursed-btn'); 
    if (currentTurn === 1 && Math.random() < 0.3 && !isRussianRoulette) { isDevilDealActive = true; btnSelf.classList.add('cursed-btn'); }
    
    // 交出控制权
    if (gameMode === 'pve') { if (currentTurn === 1) setControls(true); else { setControls(false); globalTimer = setTimeout(aiLogic, 1500); } } else { setControls(true); }
    saveGame();
}

// =========================================
// 7. 道具逻辑 (Item Logic)
// =========================================
function useItem(name) {
    // --- 1. 基础检查 ---
    if (gameLock) return;
    if (isRussianRoulette) return; 
    // PvE 玩家回合且按钮被禁用时防止触发
    if (gameMode === 'pve' && currentTurn === 1 && document.getElementById('btn-self').disabled) return;
    if (currentItems[currentTurn][name] <= 0) return;

    // 血祭事件检查 (使用道具扣血)
    if (currentEvent.id === 'sacrifice') { 
            if (hp[currentTurn] > 1) { 
                // 情况 A：血量充足，正常扣 1 血
                hp[currentTurn]--; 
                renderUI(); 
                updateLog("🩸 献祭：失去 1 点生命值");
            } 
            else { 
                // 情况 B：只剩 1 血 (濒死状态)
                // 不扣血，也不 return，直接通过！
                // 给玩家一个正向反馈的提示
                updateLog("🩸 濒死特权：免除了献祭代价！");
                playSound('loot'); // 给个正反馈音效
            } 
        }

    // --- 2. 消耗道具 ---
    currentItems[currentTurn][name]--;

    // 欺诈之眼契约检测 (50%概率假装使用但无效)
    let isFakeFail = false; let isDoubleEffect = false;
    if (currentTurn === 1 && selectedPact === 'eye') { 
        if (Math.random() < 0.5) { isFakeFail = true; isDoubleEffect = true; } 
    }
    
    // 假动作检测 (Feint) - 抵消下一次道具使用
    if (feintActive) { 
        feintActive = false; 
        updateLog(`🎭 ${getShooterName(currentTurn)} FEINTS ${t('i_'+name)}`); 
        if (currentTurn === 1) unlockAchievement(18); 
        renderUI(); return; 
    }

    // 统计数据与音效
    itemsUsedThisTurn++; 
    playSound('item');
    
    // 玩家成就统计
    if (currentTurn === 1) {
        if(name==='smoke') unlockAchievement(2); 
        if(name==='magnifier') { magnifierCount++; if(magnifierCount>=3) unlockAchievement(5); }
        if(name==='beer') { beerCount++; if(beerCount>=3) unlockAchievement(13); } 
        if(name==='mirror') unlockAchievement(15);
        if(name==='preload') unlockAchievement(17); 
        if(name==='saw') unlockAchievement(22); 
        if(name==='cuffs') unlockAchievement(23);
        if(name==='inverter') unlockAchievement(24); 
        if(name==='jammer') unlockAchievement(25);
        let totalItems = 0; ITEM_LIST.forEach(k=> totalItems += currentItems[1][k]); 
        if(totalItems >= 6) unlockAchievement(26);
    }

    // 战术家 Boss 封锁首个道具 (被动技能)
    if (gameMode === 'pve' && currentBoss.id === 'tactician' && currentTurn === 1 && tacticianTrapActive) { 
        tacticianTrapActive = false; 
        updateLog(t('tact_block', {item: t('i_'+name)})); 
        renderUI(); return; 
    }

    // 定义对手和显示名称
    let opponent = (currentTurn === 1) ? 2 : 1; 
    let effectiveUser = currentTurn; 
    let userName = getShooterName(currentTurn);

    // 干扰器 (Jammer) 检查：如果被干扰，道具直接失效
    if (statusEffects[currentTurn].jammed) { 
        statusEffects[currentTurn].jammed = false; 
        updateLog(t('item_jammed', {item: t('i_'+name)})); 
        renderUI(); 
        if (gameMode === 'pve' && currentTurn === 2) globalTimer = setTimeout(aiLogic, 1000); 
        return; 
    }

    // ❌ [已删除] 旧的魔镜被动偷取代码
    // 原本这里的 if (statusEffects[opponent].mirror ...) 已被移除，
    // 因为新版魔镜是“主动选择并偷过来”，不再是被动触发。

    let eName = getShooterName(effectiveUser); 

    // --- 3. 道具具体效果分支 ---

    if (name === 'magnifier') { // 放大镜
        let idx = magazine.length - 1; 
        let isFake = (selectedTalent === 'mis' && Math.random() < 0.5); 
        let realState = magazine[idx]; 
        let shownState = isFake ? (realState===1?0:1) : realState;
        
        if (effectiveUser === 1) { 
            chamberKnowledge[idx] = (shownState === 1) ? 1 : 2; 
            renderChamberUI(); 
            updateLog(`🔍 ${shownState===1 ? "LIVE" : "BLANK"}`); 
        } else updateLog(`🔍 ${eName} checked...`);
    } 
    else if (name === 'beer') { // 啤酒
        let b = magazine.pop(); 
        chamberKnowledge.pop(); 
        renderChamberUI(); updateAmmoTracker(); 
        historyLog.push(b===1?1:0); updateHistoryUI(); 
        updateLog(`🍺 ${eName}: ${b===1?"LIVE":"BLANK"}`); 
        if (magazine.length===0) globalTimer = setTimeout(startRound, 1500); 
    }
    else if (name === 'saw') { // 锯子
        damageMultiplier = isDoubleEffect ? 4 : 2; 
        updateLog(`🪚 ${eName} SAW ${isDoubleEffect?'(x4!)':''}`); 
    }
    else if (name === 'smoke') { // 香烟
        let healAmt = isDoubleEffect ? 2 : 1; 
        if (hp[effectiveUser] < maxHp[effectiveUser]) hp[effectiveUser] = Math.min(maxHp[effectiveUser], hp[effectiveUser]+healAmt); 
        updateLog(`🚬 ${eName} +${healAmt} HP`); 
    }
    else if (name === 'cuffs') { // 手铐
        handCuffedTarget = opponent; 
        updateLog(`🔗 ${eName} CUFFS`); 
    }
    else if (name === 'inverter') { // 逆转器
        let v = magazine.pop(); magazine.push(v===1?0:1); 
        let idx = magazine.length-1; 
        if (chamberKnowledge[idx] === 1) chamberKnowledge[idx] = 2; 
        else if (chamberKnowledge[idx] === 2) chamberKnowledge[idx] = 1; 
        renderChamberUI(); 
        updateLog(`🔄 ${eName} INVERT`); 
        historyLog.push(2); updateHistoryUI(); 
    }
    else if (name === 'jammer') { // 干扰器
        statusEffects[opponent].jammed = true; 
        updateLog(`🚫 ${eName} JAMMER`); 
        if(effectiveUser===1) unlockAchievement(9); 
    }
    // 🌟🌟🌟 修改部分：新版魔镜逻辑 (主动窃取) 🌟🌟🌟
    // engine.js -> useItem 函数内部

    else if (name === 'mirror') { // 魔镜
        if (currentTurn === 1) {
            // --- 玩家使用逻辑 ---

            // 1. 检查敌人是否有道具可偷
            let enemyTotal = 0;
            for(let k in currentItems[2]) enemyTotal += currentItems[2][k];

            if (enemyTotal <= 0) {
                updateLog("🔮 对手空空如也，无法窃取！");
                // 没东西偷，退还道具
                currentItems[1]['mirror']++; 
                itemsUsedThisTurn--; 
                return;
            }

            // 2. 切换选择模式
            if (mirrorSelectionMode) {
                // 如果已经是开启状态，再次点击则“取消”
                window.cancelMirrorMode();
            } else {
                // 开启选择模式
                mirrorSelectionMode = true;
                updateLog("🔮 请点击敌人的道具进行窃取...");

                // 暂时扣除道具 (如果取消会退还)
                currentItems[1]['mirror']--; 
                itemsUsedThisTurn++; 

                // ✨ 开启遮罩和高亮效果
                renderMirrorUI(true);
            }
        } else {
            // --- AI 使用逻辑 (保持不变) ---
            let pItems = Object.keys(currentItems[1]).filter(k => currentItems[1][k] > 0);
            if (pItems.length > 0) {
                let stolen = pItems[Math.floor(Math.random() * pItems.length)];
                currentItems[1][stolen]--; 
                currentItems[2][stolen]++; 
                updateLog(`🔮 AI 窃取了你的 ${t('i_'+stolen)}!`);
            } else {
                updateLog(`🔮 AI 浪费了魔镜...`);
            }
        }
        renderUI(); // 刷新界面
        return; // 结束函数
    }
    // 🌟🌟🌟 修改结束 🌟🌟🌟
    else if (name === 'preload') { // 预装弹
        magazine.unshift(1); chamberKnowledge.unshift(0); 
        updateAmmoTracker(); renderChamberUI(); 
        updateLog(`⏳ ${eName} PRELOAD`); 
    }
    else if (name === 'feint') { // 假动作
        feintActive = true; 
        updateLog(`🪤 ${eName} FEINT READY`); 
    }
    else if (name === 'safety') { // 保险栓
        safetyActive = true; 
        updateLog(`🧷 ${eName} SAFETY ON`); 
    }
    else if (name === 'hourglass') { // 缓刑沙漏
        if (magazine.length > 1) { 
            let shell = magazine.pop(); let know = chamberKnowledge.pop(); 
            magazine.unshift(shell); chamberKnowledge.unshift(know); 
            updateLog(`⏳ ${eName} HOURGLASS`); 
            renderChamberUI(); 
        } else { updateLog("⏳ USELESS NOW..."); } 
    }
    else if (name === 'visor') { // 假视镜
        visorActive = true; 
        updateLog(`🎭 ${eName} VISOR ON`); 
    }
    else if (name === 'delay_shell') { // 后效弹
        nextShotIsDelayed = true; 
        updateLog(`🧪 ${eName} COATS BULLET`); 
    }
    else if (name === 'death_chip') { // 临终筹码
        deathChipActive[currentTurn] = true; 
        updateLog(`⚰️ ${eName} DEATH BARGAIN`); 
    }
    else if (name === 'adrenaline') { // 肾上腺素
        adrenalineDebt[currentTurn] = true; 
        itemsUsedThisTurn = -1; 
        updateLog(`💉 ${eName} RUSH! (-1 HP NEXT)`); 
        handCuffedTarget = opponent; 
    }
    else if (name === 'phone') { // 神秘手机
        let unknownIndices = []; 
        for(let i=0; i<magazine.length; i++) { if(chamberKnowledge[i] === 0) unknownIndices.push(i); } 
        if(unknownIndices.length > 0) { 
            let idx = unknownIndices[Math.floor(Math.random() * unknownIndices.length)]; 
            let state = magazine[idx]; 
            if(effectiveUser === 1) { 
                chamberKnowledge[idx] = (state === 1) ? 1 : 2; 
                renderChamberUI(); 
                updateLog(`📱 FUTURE: #${magazine.length - idx} is ${state===1?'LIVE':'BLANK'}`); 
            } else { 
                updateLog(`📱 ${eName} HACKED FUTURE...`); 
            } 
        } else { updateLog(`📱 NO SIGNAL...`); } 
    }

    renderUI(); 
    saveGame();
    if (isFakeFail) { updateLog("👁️ DECEPTIVE EYE: CRITICAL SUCCESS!"); }
    if (gameMode === 'pve' && currentTurn === 2 && magazine.length > 0) globalTimer = setTimeout(aiLogic, 1500);
}
// 执行魔镜窃取 (暴露给全局以便 ui.js 调用)
window.performMirrorSteal = function(targetItemKey) {
    if (!mirrorSelectionMode || gameLock) return;
    
    // 检查敌人是否还有这个道具 (防止连点bug)
    if (currentItems[2][targetItemKey] <= 0) return;

    // 1. 消耗玩家的魔镜
    if (currentItems[1]['mirror'] > 0) {
        currentItems[1]['mirror']--;
        itemsUsedThisTurn++; // 统计使用次数
        unlockAchievement(15); // 解锁魔镜成就
    } else {
        return; // 没有魔镜了（异常情况）
    }

    // 2. 执行转移：敌人-1，玩家+1
    currentItems[2][targetItemKey]--;
    currentItems[1][targetItemKey] = (currentItems[1][targetItemKey] || 0) + 1;

    // 3. 播放特效和日志
    playSound('loot'); // 或者 'item'
    updateLog(`🔮 STOLE ${t('i_' + targetItemKey)}!`);
    showItemToast([targetItemKey], 1); // 弹窗提示获得道具

    // 4. 重置状态
    mirrorSelectionMode = false;
    renderUI();
    saveGame();
};

// 核心 AI 决策入口
function aiLogic() {
    // 基础状态检查：没子弹、AI已死、或处于动画锁定中，则不行动
    if (magazine.length === 0 || hp[2] <= 0 || gameLock) return;
    
    // 俄罗斯轮盘模式下的特殊 AI：无脑射自己
    if (isRussianRoulette) { 
        globalTimer = setTimeout(() => fire('self'), 1000); 
        return; 
    }

    // 1. 获取当前 Boss 的风格 (在 constants.js 的 DEMON_ARCHETYPES 里定义)
    // 如果没有定义风格，默认使用 'chaotic'
    let style = currentBoss && currentBoss.style ? currentBoss.style : 'chaotic';
    
    // 2. 从策略库中匹配对应的函数
    let strategy = AI_BEHAVIORS[style] || AI_BEHAVIORS.chaotic;

    // 3. 延迟执行策略 (模拟思考时间，避免操作太快玩家看不清)
    globalTimer = setTimeout(() => {
        strategy(); 
    }, 1000);
}
// 触发 Boss 暴走
function triggerEnrage() {
    if (!currentBoss || currentBoss.phase2) return;
    currentBoss.phase2 = true; gameLock = true;
    document.getElementById('boss-card').classList.add('enraged');
    let splash = document.getElementById('event-splash');
    let card = document.querySelector('.event-splash-card');
    card.classList.add('enrage-mode');
    document.getElementById('splash-title').innerText = t('enrage_title');
    document.getElementById('splash-desc').innerText = t('enrage_' + currentBoss.id);
    splash.style.display = 'flex';
    playSound('enrage');
    
    // 暴走奖励
    let gainedItems = [];
    if (currentBoss.id === 'butcher') { currentItems[2].saw++; gainedItems.push('saw'); }
    if (currentBoss.id === 'doctor') { hp[2] = Math.min(hp[2]+2, maxHp[2]); renderUI(); }
    if (currentBoss.id === 'tactician') { currentItems[2].cuffs++; handCuffedTarget = 1; gainedItems.push('cuffs'); }
    if (currentBoss.id === 'gambler') { let p1Items = Object.keys(currentItems[1]).filter(k => currentItems[1][k] > 0); if(p1Items.length > 0) { let stolen = p1Items[Math.floor(Math.random()*p1Items.length)]; currentItems[1][stolen]--; currentItems[2][stolen]++; gainedItems.push(stolen); } }
    if(gainedItems.length > 0) showItemToast(gainedItems, 2);
    setTimeout(() => { splash.style.display = 'none'; card.classList.remove('enrage-mode'); gameLock = false; }, 2500);
}

// 检查死亡 / 游戏结束条件
function checkDead() {
    // 保险栓救命
    if (hp[1] <= 0 && safetyActive && !isRussianRoulette) { hp[1] = 1; safetyActive = false; updateLog("🧷 SAFETY SAVED YOU!"); unlockAchievement(16); renderUI(); return false; }
    // 临终筹码反伤
    for (let pid = 1; pid <= 2; pid++) { if (hp[pid] <= 0 && deathChipActive[pid]) { let enemy = (pid === 1) ? 2 : 1; hp[enemy] -= 2; deathChipActive[pid] = false; updateLog(t('mech_mutual')); renderUI(); } }
    // 消耗生命(Lives)复活
    for (let pid = 1; pid <= 2; pid++) { if (hp[pid] <= 0) { if (lives[pid] > 1) { lives[pid]--; hp[pid] = maxHp[pid]; updateLog(t('resurrect', {name: getShooterName(pid)})); startRound(true); return false; } } }

    let p1Dead = hp[1] <= 0; let p2Dead = hp[2] <= 0;
    if (p1Dead || p2Dead) {
        setControls(false); gameLock = true; clearSave(); playSound('win');
        setTimeout(() => {
            let overlay = document.getElementById('overlay'); let title = document.getElementById('win-title'); let desc = document.getElementById('win-desc'); let comment = document.getElementById('win-comment'); let cardBox = document.getElementById('card-display'); let restartBtn = document.getElementById('restart-btn');
            overlay.style.display = 'flex'; requestAnimationFrame(() => overlay.style.opacity = 1); cardBox.innerHTML = '';
            
            // 结算画面：平局 / 死亡 / 胜利
            if (p1Dead && p2Dead) { title.innerText = t('win_draw'); title.style.color = "#7f8c8d"; desc.innerText = t('win_draw_desc'); comment.innerText = "“...”"; restartBtn.style.display = 'block'; }
            else if (p1Dead) { title.innerText = t('win_died'); title.style.color = "#ff4757"; desc.innerText = t('win_kill', {name: getShooterName(2)}); restartBtn.style.display = 'block'; if(selectedPact) comment.innerText = t('eval_greedy'); else comment.innerText = t('eval_sad'); triggerTaunt('win'); } else {
                title.innerText = t('win_vic'); title.style.color = "var(--accent-gold)"; desc.innerText = t('win_reward', {name: getShooterName(2)}); restartBtn.style.display = 'none'; 
                // 胜利评价与成就
                if (hp[1] === maxHp[1]) comment.innerText = t('eval_perfect'); else if (hp[1] === 1) comment.innerText = t('eval_clutch'); else if (historyLog.filter(x=>x===1).length > historyLog.filter(x=>x===0).length) comment.innerText = t('eval_brutal'); else comment.innerText = t('eval_lucky');
                if (hp[1] === 1) unlockAchievement(6); if (hp[1] === maxHp[1]) unlockAchievement(10); if (isTwisted) unlockAchievement(7);
                if (currentBoss.id === 'butcher') unlockAchievement(8); if (currentBoss.id === 'tactician') unlockAchievement(9); if (currentBoss.id === 'doctor') unlockAchievement(11);
                if (currentBoss.id === 'gambler') unlockAchievement(12); if (selectedPact) unlockAchievement(19); if (currentEvent.id === 'fog') unlockAchievement(20);
                if (currentEvent.id === 'sacrifice') unlockAchievement(29); if (level >= 3) unlockAchievement(30);

                // 生成奖励卡片
                buffPool.forEach(b => {
                    let div = document.createElement('div'); div.className = 'card'; div.innerHTML = `<h3 style="margin:0 0 5px 0; color:#fff">${t(b.key)}</h3><div style="font-size:0.8rem;color:#888">${t(b.descKey)}</div>`;
                    div.onclick = () => { if(b.id==='heal') hp[1]=maxHp[1]; if(b.id==='hp_up') {maxHp[1]++; hp[1]=maxHp[1];} if(b.id==='supplies') lootItems(1, 4); if(b.id==='tech') { currentItems[1].jammer++; currentItems[1].mirror++; } level++; maxHp[2]++; currentBoss = DEMON_ARCHETYPES[Math.floor(Math.random() * DEMON_ARCHETYPES.length)]; renderLanguage(); overlay.style.opacity = 0; setTimeout(() => { overlay.style.display = 'none'; startRound(); }, 500); };
                    cardBox.appendChild(div);
                });
            }
        }, 1000);
        return true;
    }
    return false;
}

// 辅助函数
function getShooterName(pid) { return pid === 1 ? t('label_you') : (gameMode === 'pvp' ? t('b_player2') : (currentBoss ? t('b_'+currentBoss.id) : t('label_demon'))); }
function resetItems(pid) { ALL_ITEM_LIST.forEach(k => currentItems[pid][k] = 0); }
// engine.js

const MAX_ITEMS = 8; // ✨ 定义最大手牌上限

// ✨ 1. 定义道具权重 (权重越大，掉率越高)
const ITEM_WEIGHTS = {
    // T3 Common (权重 4) - 基础三件套
    'magnifier': 4, 'beer': 4, 'smoke': 4,
    
    // T2 Uncommon (权重 3) - 策略类
    'inverter': 3, 'safety': 3, 'hourglass': 3, 'phone': 3, 'feint': 3,
    
    // T1 Rare (权重 2) - 强力类
    'saw': 2, 'jammer': 2, 'preload': 2, 'visor': 2, 'delay_shell': 2,
    
    // T0 Legendary (权重 1) - 神器类 (很难获得)
    'cuffs': 1, 'mirror': 1, 'adrenaline': 1, 'death_chip': 1
};

// ✨ 2. 加权随机辅助函数
function getWeightedRandomItem() {
    // 过滤掉当前被禁用的道具 (bannedItems) 和当前模式不支持的道具
    // 这一点很重要，否则会报错
    let validItems = ITEM_LIST.filter(key => ITEM_WEIGHTS[key] !== undefined);
    
    // 计算总权重
    let totalWeight = 0;
    validItems.forEach(key => {
        totalWeight += ITEM_WEIGHTS[key];
    });

    // 生成随机数 (0 到 totalWeight 之间)
    let random = Math.random() * totalWeight;
    
    // 遍历寻找命中的道具
    for (let i = 0; i < validItems.length; i++) {
        let key = validItems[i];
        let weight = ITEM_WEIGHTS[key];
        
        if (random < weight) {
            return key;
        }
        random -= weight;
    }
    
    //以此为保底 (理论上不会运行到这)
    return validItems[0];
}

// ✨ 3. 修改后的发放道具函数
function lootItems(pid, count) {
    let gained = []; // 记录本次获得的道具
    
    // 计算当前持有总量
    let currentTotal = 0;
    for (let k in currentItems[pid]) {
        currentTotal += currentItems[pid][k];
    }

    for(let i = 0; i < count; i++) {
        // 检查上限
        if (currentTotal >= MAX_ITEMS) {
            if (pid === 1) {
                updateLog("🎒 背包已满！无法携带更多道具！");
                if (typeof showToast === 'function') showToast("INVENTORY FULL", "已达携带上限");
            }
            break;
        }

        // 🟢 使用加权随机获取道具
        let item = getWeightedRandomItem();
        
        // 增加库存
        currentItems[pid][item] = (currentItems[pid][item] || 0) + 1;
        gained.push(item);
        currentTotal++;
    }
    
    // 弹窗提示
    if(gained.length > 0) showItemToast(gained, pid);
}

// 玩家点击某个初始道具
function toggleStarterItem(key) {
    const idx = starterItemsBuffer.indexOf(key);
    
    if (idx > -1) {
        // 如果已经选了，就取消选择
        starterItemsBuffer.splice(idx, 1);
        document.getElementById('starter-btn-' + key).classList.remove('selected');
    } else {
        // 如果没选，且还没满 2 个，就添加
        if (starterItemsBuffer.length < 2) {
            starterItemsBuffer.push(key);
            document.getElementById('starter-btn-' + key).classList.add('selected');
        } else {
            // 如果已经满 2 个了，可以选择替换掉第一个，或者直接不让选
            // 这里我们做一个简单的震动反馈，提示满了
            playSound('click'); 
            return; 
        }
    }
    
    // UI 更新：如果满 2 个，让其他未选中的变暗
    const allBtns = document.querySelectorAll('.starter-select-btn');
    allBtns.forEach(b => {
        if (starterItemsBuffer.length >= 2 && !b.classList.contains('selected')) {
            b.classList.add('dimmed');
        } else {
            b.classList.remove('dimmed');
        }
    });

    updateStarterConfirmBtn(); // 更新按钮文字
    playSound('click');
}

// 确认选择 -> 正式开始游戏
function confirmStarterItems() {
    document.getElementById('starter-item-screen').style.display = 'none';
    
    initGame(); // 1. 初始化游戏（这会重置 currentItems）
    
    // 2. ✨ 将选好的道具塞进玩家背包
    starterItemsBuffer.forEach(item => {
        currentItems[1][item] = (currentItems[1][item] || 0) + 1;
    });
    
    // 3. 刷新 UI 显示道具
    renderItemsGrid();
    renderUI();
    
    // 给个提示
    if(starterItemsBuffer.length > 0) showItemToast(starterItemsBuffer, 1);
}

// engine.js

// 随机选择2个初始道具
function randomizeStarterItems() {
    // 1. 清空当前选择
    starterItemsBuffer = [];
    const allBtns = document.querySelectorAll('.starter-select-btn');
    
    // 重置所有按钮样式 (移除高亮和变暗)
    allBtns.forEach(b => {
        b.classList.remove('selected');
        b.classList.remove('dimmed');
    });

    // 2. 准备道具池 (排除不适合开局的道具)
    let pool = ALL_ITEM_LIST.filter(i => i !== 'feint' && i !== 'visor');
    
    // 3. 随机抽取 2 个不重复的
    while (starterItemsBuffer.length < 2) {
        let r = Math.floor(Math.random() * pool.length);
        let item = pool[r];
        
        // 防止重复添加
        if (!starterItemsBuffer.includes(item)) {
            starterItemsBuffer.push(item);
        }
    }

    // 4. 更新 UI 状态
    starterItemsBuffer.forEach(key => {
        let btn = document.getElementById('starter-btn-' + key);
        if (btn) btn.classList.add('selected');
    });

    // 让未选中的变暗 (复用之前的逻辑)
    allBtns.forEach(b => {
        if (!b.classList.contains('selected')) b.classList.add('dimmed');
    });

    // 5. 更新确认按钮文本并播放音效
    updateStarterConfirmBtn();
    playSound('click'); // 或者用 'load' 音效听起来更像装填
}

function setControls(enable) { document.getElementById('btn-self').disabled = !enable; document.getElementById('btn-enemy').disabled = isRussianRoulette ? true : !enable; document.querySelectorAll('.item-btn').forEach(b => b.disabled = isRussianRoulette ? true : !enable); }

function playSound(type) { if (!soundEnabled) return; } // 这里可以结束文件，不要再加额外的 } 了