/**
 * engine.js - 核心游戏逻辑与状态管理
 * 负责：回合流程、伤害计算、道具效果、AI逻辑、存档管理
 */

// =========================================
// 1. 全局状态初始化 (Global State)
// =========================================
let curLang = 'zh', gameMode = 'pve', level = 1, isTwisted = false; 
let starterItemsBuffer = []; 
let magazine = [], chamberKnowledge = [], historyLog = []; 
let hp = { 1: 4, 2: 3 }, maxHp = { 1: 4, 2: 3 }, lives = { 1: 2, 2: 2 }; 
let currentItems = { 1: {}, 2: {} }; 
let statusEffects = { 1: { jammed: false, mirror: false, shield: 0 }, 2: { jammed: false, mirror: false, shield: 0 } }; 
let currentTurn = 1, currentBoss = null, currentEvent = null, gameLock = false; 
let selectedTalent = null, selectedPact = null, isRussianRoulette = false; 
let mirrorSelectionMode = false; 

// --- 战斗临时变量 ---
let damageMultiplier = 1; 
let handCuffedTarget = 0; 
let globalTimer = null;   
let soundEnabled = true, itemsUsedThisTurn = 0, damageDealtThisTurn = false; 
let ITEM_LIST = [...ALL_ITEM_LIST]; 
let bannedItems = []; 
let falseAlarmBuff = 0; 
let feintActive = false; 
let safetyActive = false; 
let beerCount = 0; 
let magnifierCount = 0; 
let delayedDamageQueue = { 1: [], 2: [] }; 
let deathChipActive = { 1: false, 2: false }; 
let visorActive = false; 
let adrenalineDebt = { 1: false, 2: false }; 
let nextShotIsDelayed = false; 
let tacticianTrapActive = false; 
let isDevilDealActive = false; 
let unlockedAchieves = JSON.parse(localStorage.getItem('br_achievements')) || []; 
let consecutiveLiveShots = 0; 

// ✨ 道具权重定义 (包含新道具过期药)
const MAX_ITEMS = 8;
const ITEM_WEIGHTS = {
    // T3 Common (权重 4)
    'magnifier': 4, 'beer': 4, 'smoke': 4, 'expired_med': 4, 
    // T2 Uncommon (权重 3)
    'inverter': 3, 'safety': 3, 'hourglass': 3, 'phone': 3, 'feint': 3,
    // T1 Rare (权重 2)
    'saw': 2, 'jammer': 2, 'preload': 2, 'visor': 2, 'delay_shell': 2,
    // T0 Legendary (权重 1)
    'cuffs': 1, 'mirror': 1, 'adrenaline': 1, 'death_chip': 1
};

// =========================================
// AI 策略行为定义
// =========================================
function getLiveProbability() {
    if (magazine.length === 0) return 0;
    let liveCount = magazine.filter(b => b === 1).length;
    let nextIdx = magazine.length - 1; 
    let known = chamberKnowledge[nextIdx];
    if (known === 1) return 1.0; 
    if (known === 2) return 0.0; 
    return liveCount / magazine.length;
}

function defaultShootingLogic() {
    let prob = getLiveProbability();
    if (prob === 1) fire('enemy');
    else if (prob === 0) fire('self');
    else fire(prob > 0.5 ? 'enemy' : 'self');
}

const AI_BEHAVIORS = {
    aggressive: function() { // 屠夫
        let prob = getLiveProbability();
        if (hp[1] <= 1 && prob > 0) { 
             if (currentItems[2].saw > 0) { useItem('saw'); return; }
             fire('enemy'); return; 
        }
        if (currentItems[2].saw > 0 && prob > 0.5) { useItem('saw'); return; }
        if (currentItems[2].handcuffs > 0 && prob > 0.6) { useItem('handcuffs'); return; }
        if (prob >= 0.4) { fire('enemy'); } else { fire('self'); }
    },
    defensive: function() { // 瘟医
        if (hp[2] < maxHp[2] && currentItems[2].smoke > 0) { useItem('smoke'); return; }
        let prob = getLiveProbability();
        if (currentItems[2].beer > 0 && prob < 0.3) { useItem('beer'); return; }
        if (currentItems[2].cuffs > 0 && hp[2] > 2) { useItem('cuffs'); return; }
        if (prob > 0.55) { fire('enemy'); } else { fire('self'); }
    },
    chaotic: function() { // 战术家/赌徒
        let prob = getLiveProbability();
        if (currentItems[2].inverter > 0 && prob < 0.3) { useItem('inverter'); return; }
        if (currentItems[2].magnifier > 0) { useItem('magnifier'); return; }
        if (currentItems[2].mirror > 0) { useItem('mirror'); return; }
        defaultShootingLogic();
    }
};

// =========================================
// 2. 存档与初始化
// =========================================

function checkSave() { const btn = document.getElementById('btn-continue'); if(btn) btn.style.display = localStorage.getItem('br_save') ? 'block' : 'none'; }
function saveGame() {
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
function loadGame() {
    const saved = localStorage.getItem('br_save');
    if(!saved) return;
    try {
        const s = JSON.parse(saved);
        hp = s.hp; maxHp = s.maxHp; currentItems = s.currentItems;
        magazine = s.magazine; chamberKnowledge = s.chamberKnowledge;
        level = s.level; currentTurn = s.currentTurn; currentBoss = s.currentBoss;
        currentEvent = s.currentEvent; damageMultiplier = s.damageMultiplier;
        handCuffedTarget = s.handCuffedTarget; statusEffects = s.statusEffects;
        isTwisted = s.isTwisted; selectedTalent = s.selectedTalent; selectedPact = s.selectedPact || null;
        historyLog = s.historyLog || []; gameMode = s.gameMode;
        isRussianRoulette = s.isRussianRoulette || false;
        if(s.soundEnabled !== undefined) soundEnabled = s.soundEnabled;
        lives = s.lives || {1:2, 2:2}; bannedItems = s.bannedItems || [];
        falseAlarmBuff = s.falseAlarmBuff || 0; itemsUsedThisTurn = s.itemsUsedThisTurn || 0;
        safetyActive = s.safetyActive || false; beerCount = s.beerCount || 0; magnifierCount = s.magnifierCount || 0;
        damageDealtThisTurn = s.damageDealtThisTurn || false; delayedDamageQueue = s.delayedDamageQueue || { 1: [], 2: [] };
        deathChipActive = s.deathChipActive || { 1: false, 2: false }; visorActive = s.visorActive || false;
        adrenalineDebt = s.adrenalineDebt || { 1: false, 2: false }; nextShotIsDelayed = s.nextShotIsDelayed || false;

        ITEM_LIST = ALL_ITEM_LIST.filter(i => !bannedItems.includes(i));
        if (gameMode === 'pve') ITEM_LIST = ITEM_LIST.filter(i => i !== 'feint' && i !== 'visor'); 

        document.getElementById('menu-screen').style.display = 'none';
        document.getElementById('event-splash').style.display = 'none'; document.getElementById('overlay').style.display = 'none'; document.getElementById('talent-screen').style.display = 'none'; document.getElementById('pact-screen').style.display = 'none'; document.getElementById('settings-screen').style.display = 'none'; document.getElementById('dice-overlay').style.display = 'none';
        
        gameLock = false; 
        document.getElementById('gun-display').style.transform = "perspective(500px) rotate(0deg)";
        document.getElementById('game-container').classList.remove('shaking');
        if (isRussianRoulette) document.body.classList.add('rr-mode-active'); else document.body.classList.remove('rr-mode-active');
        renderLanguage(); renderChamberUI(); updateHistoryUI();
        if (currentTurn === 1) { setControls(true); } else { setControls(false); if (gameMode === 'pve') { clearTimeout(globalTimer); globalTimer = setTimeout(aiLogic, 1000); } }
        
        // ✅ 修复：读取存档时播放 BGM
        if (typeof playSound === 'function') playSound('bgm');

        updateLog("GAME RESUMED");
    } catch (e) { console.error("Save corrupted", e); clearSave(); }
}
function clearSave() { localStorage.removeItem('br_save'); checkSave(); }

function exitGame() { 
    if(lives[1] > 0 && lives[2] > 0) saveGame(); 
    
    // ✅ 修复：回到主菜单时停止所有声音
    if (typeof stopAllSounds === 'function') stopAllSounds();
    
    clearTimeout(globalTimer); 
    document.getElementById('settings-screen').style.display = 'none'; 
    document.getElementById('menu-screen').style.display = 'flex'; 
    checkSave(); 
}

function giveUpGame() { clearTimeout(globalTimer); document.getElementById('settings-screen').style.display = 'none'; lives[1] = 0; hp[1] = 0; checkDead(); }

function preStartGame(mode) { 
    gameMode = mode; clearSave();
    if (mode === 'pve') { document.getElementById('menu-screen').style.display = 'none'; document.getElementById('talent-screen').style.display = 'flex'; renderTalentSelection(); } 
    else { initGame(); } 
}
function selectTalent(tal) { selectedTalent = tal; document.getElementById('talent-screen').style.display = 'none'; document.getElementById('pact-screen').style.display = 'flex'; renderPactSelection(); }
function selectPact(pact) { selectedPact = pact; document.getElementById('pact-screen').style.display = 'none'; starterItemsBuffer = []; document.getElementById('starter-item-screen').style.display = 'flex'; renderItemSelection(); }

function initGame() {
    // 读取保存的音量设置
    let savedBgm = localStorage.getItem('br_vol_bgm');
    let savedSfx = localStorage.getItem('br_vol_sfx');

    if (savedBgm !== null) {
        if (typeof setBgmLevel === 'function') setBgmLevel(savedBgm);
    }
    if (savedSfx !== null) {
        if (typeof setSfxLevel === 'function') setSfxLevel(savedSfx);
    }
    document.getElementById('menu-screen').style.display = 'none';
    currentItems = { 1: {}, 2: {} }; level = 1; bannedItems = [];
    beerCount = 0; magnifierCount = 0; isRussianRoulette = false;
    ITEM_LIST = [...ALL_ITEM_LIST];
    if (gameMode === 'pve') ITEM_LIST = ITEM_LIST.filter(i => i !== 'feint' && i !== 'visor');

    if (selectedTalent === 'ban') {
        let bannedNames = []; 
        for(let i=0; i<2; i++) { if (ITEM_LIST.length > 2) { let r = Math.floor(Math.random() * ITEM_LIST.length); let itemKey = ITEM_LIST[r]; bannedItems.push(itemKey); bannedNames.push(t('i_' + itemKey)); ITEM_LIST.splice(r, 1); } }
        if (bannedNames.length > 0) { setTimeout(() => { updateLog(`🚫 禁忌生效！已移除: ${bannedNames.join(' & ')}`); }, 3000); }
    }
    
    if (gameMode === 'pvp') { maxHp = { 1: 4, 2: 4 }; } else { let bossHp = 3 + level; maxHp = { 1: 4, 2: bossHp }; }
    if (selectedPact === 'greed') maxHp[1] = Math.max(1, maxHp[1] - 1);
    if (selectedPact === 'flesh') maxHp[1] = Math.max(1, maxHp[1] - 2);
    if (selectedPact === 'half') maxHp[1] = 3;
    hp = { 1: maxHp[1], 2: maxHp[2] }; lives = { 1: 2, 2: 2 }; 

    if (gameMode === 'pve') { let proto = DEMON_ARCHETYPES[Math.floor(Math.random() * DEMON_ARCHETYPES.length)]; currentBoss = JSON.parse(JSON.stringify(proto)); currentBoss.phase2 = false; } 
    else { currentBoss = {id: 'player2'}; }

    let totalW = 0;
    EVENTS.forEach(e => totalW += e.weight);
    let r = Math.random() * totalW;
    currentEvent = EVENTS[0]; // 保底
    for(let e of EVENTS) {
        if (r < e.weight) { currentEvent = e; break; }
        r -= e.weight;
    }
    updateLog(`⛈️ 当前环境: ${t('e_' + currentEvent.id)}`);
    
    // ✅ 修复：开始游戏时播放 BGM
    if (typeof playSound === 'function') playSound('bgm');

    window.gameJustStarted = true;

    renderLanguage(); startRound();
}

function triggerDiceRoll() {
    const dOverlay = document.getElementById('dice-overlay'); const sumP1 = document.getElementById('sum-p1'); const sumP2 = document.getElementById('sum-p2'); const msg = document.getElementById('dice-msg');
    dOverlay.style.display = 'flex'; sumP1.innerText = ''; sumP2.innerText = ''; msg.innerText = "ROLLING...";
    let rolls = 0, p1Val = 0, p2Val = 0;
    let interval = setInterval(() => {
        let r1 = Math.floor(Math.random()*6)+1, r2 = Math.floor(Math.random()*6)+1, r3 = Math.floor(Math.random()*6)+1, r4 = Math.floor(Math.random()*6)+1;
        document.getElementById('d1-1').innerText = r1; document.getElementById('d1-2').innerText = r2; document.getElementById('d2-1').innerText = r3; document.getElementById('d2-2').innerText = r4;
        p1Val = r1+r2; p2Val = r3+r4; rolls++;
        if (rolls > 15) { clearInterval(interval); sumP1.innerText = p1Val; sumP2.innerText = p2Val;
            if (p1Val === p2Val) { msg.innerText = "DRAW! REROLLING..."; setTimeout(triggerDiceRoll, 1000); } 
            else if (p1Val > p2Val) { msg.innerText = "YOU START!"; setTimeout(() => { dOverlay.style.display = 'none'; currentTurn = 1; handleTurnStart(); }, 1500); } 
            else { msg.innerText = "ENEMY STARTS!"; setTimeout(() => { dOverlay.style.display = 'none'; currentTurn = 2; handleTurnStart(); }, 1500); }
        }
    }, 100);
}

// =========================================
// 4. 回合开始 (startRound)
// =========================================
function startRound(isResurrection = false) {
    clearTimeout(globalTimer); 
    gameLock = false; 
    document.getElementById('event-splash').style.display = 'none';

    // 重置回合临时变量
    historyLog = []; falseAlarmBuff = 0; safetyActive = false; itemsUsedThisTurn = 0;
    statusEffects[1].shield = 0; statusEffects[2].shield = 0; damageDealtThisTurn = false;
    delayedDamageQueue = { 1: [], 2: [] }; deathChipActive = { 1: false, 2: false };
    adrenalineDebt = { 1: false, 2: false }; nextShotIsDelayed = false; visorActive = false;
    updateHistoryUI();

    // 俄罗斯轮盘模式判定 (1血对决)
    if (!isResurrection && lives[1] === 1 && hp[1] === 1 && lives[2] === 1 && hp[2] === 1 && Math.random() < 0.1) {
        isRussianRoulette = true; document.body.classList.add('rr-mode-active');
    }

    // 血量重置逻辑
    if (gameMode === 'pvp') { hp[1] = maxHp[1]; hp[2] = maxHp[2]; } 
    else { 
        if(level > 1 && !isRussianRoulette) { 
            hp[1] = Math.min(hp[1], maxHp[1]); 
            if(hp[1]<=0) hp[1]=4; 
        } 
        hp[2] = maxHp[2]; 
    }
    if (isRussianRoulette) { hp[1] = 1; hp[2] = 1; }

    // 状态清除
    statusEffects = { 1: { jammed: false, mirror: false, shield: 0 }, 2: { jammed: false, mirror: false, shield: 0 } };
    tacticianTrapActive = (gameMode === 'pve' && currentBoss.id === 'tactician');
    
    document.getElementById('boss-card').classList.remove('enraged'); 
    if (currentBoss && currentBoss.phase2) document.getElementById('boss-card').classList.add('enraged');

    renderLanguage();

    // --- 装填弹药逻辑 ---
    magazine = [];
    if (isRussianRoulette) { 
        magazine = [1, 0, 0, 0, 0, 0]; 
    } else {
        let total = 6; let live;
        if (Math.random() < 0.05) { live = 6; updateLog("⚠️ 警告：检测到高能反应！"); } 
        else { live = Math.floor(Math.random() * 5) + 1; }
        
        for(let i=0; i<live; i++) magazine.push(1); 
        for(let i=0; i<(total-live); i++) magazine.push(0);
        
        // 洗牌
        for (let i = magazine.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [magazine[i], magazine[j]] = [magazine[j], magazine[i]]; }
        
        // 特殊Boss/事件处理
        if (gameMode === 'pve' && currentBoss.id === 'gambler') magazine[0] = 1; 
        if (currentEvent.id === 'shuffle') { for (let i = magazine.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [magazine[i], magazine[j]] = [magazine[j], magazine[i]]; } }
        if (selectedPact === 'eerie' && magazine.length > 0) { let r = Math.floor(Math.random() * magazine.length); magazine[r] = (magazine[r] === 1) ? 0 : 1; updateLog("🔫 PACT: Eerie Mag Triggered"); }
    }

    // 初始化弹舱知识 (用于显示)
    chamberKnowledge = new Array(magazine.length).fill(0);
    if (selectedTalent === 'eye' && Math.random() < 0.3 && magazine.length>0 && !isRussianRoulette) chamberKnowledge[magazine.length-1] = (magazine[magazine.length-1]===1) ? 1 : 2;
    if (currentEvent.id === 'vision' && Math.random() < 0.25 && magazine.length>0 && !isRussianRoulette) { let idx = magazine.length - 1; chamberKnowledge[idx] = magazine[idx] === 1 ? 1 : 2; }

    // 迷雾视觉效果
    if (currentEvent.id === 'fog' || currentEvent.id === 'mist') document.getElementById('table-area').classList.add('fog-active');
    else document.getElementById('table-area').classList.remove('fog-active');

    // --- 道具掉落逻辑 ---
    if (!isResurrection && !isRussianRoulette) {
        let baseAmount = (level === 1) ? 2 : 3; 
        if (selectedTalent === 'pack') baseAmount++; 
        // 【干旱】
        if (currentEvent.id === 'drought') baseAmount = Math.max(1, baseAmount - 1);
        // 【狂欢】
        let multiplier = (currentEvent.id === 'carnival') ? 2 : 1;

        lootItems(1, baseAmount * multiplier);
        lootItems(2, (baseAmount + 1) * multiplier);
    }

    setControls(false); 
    renderChamberUI(); 
    updateAmmoTracker(); 
    saveGame();

    // --- 弹窗显示控制 ---
    let splash = document.getElementById('event-splash');
    
    // 判断是否显示全屏介绍：必须是整局刚开始(gameJustStarted 为 true)，且不是复活重开
    let showIntro = (window.gameJustStarted === true) && !isResurrection;

    if (showIntro) {
        // 如果是俄罗斯轮盘模式，覆盖文本
        if(isRussianRoulette) { 
            document.getElementById('splash-title').innerText = t('rr_trigger'); 
            document.getElementById('splash-desc').innerText = t('rr_desc'); 
            let card = document.querySelector('.event-splash-card');
            if(!card.querySelector('.rr-splash')) card.innerHTML += '<div class="rr-splash">☠️</div>'; 
        }
        
        // 显示全屏弹窗
        splash.style.display = 'flex';
        
        // 标记使用完毕，下次换弹不再显示
        window.gameJustStarted = false; 
    } else {
        // 普通换弹，仅在底部显示文字
        updateLog(t('reload'));
    }
    
    // 动态调整等待时间：如果有全屏弹窗等2.5秒，否则等1秒
    let waitTime = showIntro ? 2500 : 1000;
    if (isResurrection) waitTime = 1000; // 复活总是快的

    globalTimer = setTimeout(() => {
        splash.style.display = 'none'; 
        
        damageMultiplier = 1; 
        handCuffedTarget = 0; 
        gameLock = false; 
        
        if (isResurrection) { 
            currentTurn = 1; 
            handleTurnStart(); 
        } else { 
            triggerDiceRoll(); 
        }
        saveGame();
    }, waitTime);
    
    renderUI();
}

function activePlayerAction(targetType) { if(!gameLock) fire(targetType); }

// =========================================
// 5. 核心射击逻辑
// =========================================
function fire(targetType) {
    setControls(false); gameLock = true; 
    let gun = document.getElementById('gun-display'); 
    gun.style.transform = "scale(1.3) rotate(-15deg)"; 
    // ✅ 修复：这里删除 playSound('fire')，防止空弹也响
    
    globalTimer = setTimeout(() => {
        let bullet = magazine.pop(); chamberKnowledge.pop(); 
        if (visorActive) { visorActive = false; updateLog("🎭 VISOR EXPIRED"); }
        
        let isDud = (bullet === 1 && Math.random() < 0.03 && !isTwisted && !isRussianRoulette);
        if (isDud) { bullet = 0; updateLog(t('mech_dud')); } 
        renderChamberUI(); updateAmmoTracker(); 
        
        let isVolatileTrigger = false;
        if (currentEvent.id === 'volatile' && bullet === 0 && Math.random() < 0.3 && !isRussianRoulette) { bullet = 1; isVolatileTrigger = true; }

        let isLive = (bullet === 1); let baseDmg = 1;

        if (!isRussianRoulette) {
            if (isTwisted && isLive) baseDmg++; 
            if (selectedPact === 'power' && isLive) baseDmg++; 
            if (selectedPact === 'half' && isLive) baseDmg++;
            if (gameMode === 'pve' && currentBoss.id === 'butcher' && currentTurn === 2 && isLive && currentBoss.phase2) baseDmg += 2;
            else if (gameMode === 'pve' && currentBoss.id === 'butcher' && currentTurn === 2 && isLive) baseDmg += 1;
            if (isLive && falseAlarmBuff > 0) { baseDmg += falseAlarmBuff; falseAlarmBuff = 0; }
            if (isLive && selectedTalent === 'quick' && itemsUsedThisTurn === 0) baseDmg++;
        } else { baseDmg = 999; }

        let dmg = baseDmg * damageMultiplier; 
        if (currentEvent.id === 'overheat' && isLive && !isRussianRoulette) dmg += consecutiveLiveShots++; 
        if (!isLive) consecutiveLiveShots = 0;
        if (targetType === 'self' && isLive && selectedTalent === 'pain' && !isRussianRoulette) dmg = Math.max(1, dmg - 1);
        
        if (targetType === 'self' && isDevilDealActive) {
            if (isLive) { dmg *= 2; updateLog(t('deal_fail')); playSound('dmg'); } else { lootItems(currentTurn, 2); updateLog(t('deal_success')); playSound('loot'); }
            isDevilDealActive = false; 
        }
        
        if (targetType === 'self' && currentEvent.id === 'blood' && isLive && !isRussianRoulette) dmg *= 2;
        
        if (nextShotIsDelayed && isLive) {
            nextShotIsDelayed = false; delayedDamageQueue[targetType === 'self' ? currentTurn : (currentTurn===1?2:1)].push({dmg: dmg, turns: 2});
            dmg = 0; updateLog("🧪 POISON APPLIED (2 Turns)"); document.getElementById('table-area').style.borderColor = "#2ecc71"; setTimeout(()=>document.getElementById('table-area').style.borderColor = "#333", 500);
        }

        let historyVal = isLive ? 1 : 0; if (visorActive && gameMode === 'pvp') historyVal = (historyVal === 1) ? 0 : 1; 
        historyLog.push(historyVal); updateHistoryUI();

        let shooter = currentTurn; let opponent = (currentTurn === 1) ? 2 : 1; let victim = (targetType === 'self') ? shooter : opponent; let shooterName = getShooterName(shooter);

        document.getElementById('game-container').classList.add('shaking');
        globalTimer = setTimeout(()=> { document.getElementById('game-container').classList.remove('shaking'); gun.style.transform = "perspective(500px) rotateY(0deg) rotateX(0deg)"; }, 300);

        let skipTurnEffect = false;

        // ============================================
        // 🟥 实弹 (非哑弹)
        // ============================================
        if (isLive && !isDud) {
            // ✅ 修复：在这里播放开火声！
            playSound('fire');

            // 瘟医带毒
            if (gameMode === 'pve' && currentBoss.id === 'doctor' && shooter === 2 && targetType === 'enemy') {
                delayedDamageQueue[1].push({dmg: 1, turns: 2}); updateLog("🦠 瘟医的子弹带有剧毒！(2回合后发作)");
                document.getElementById('table-area').style.borderColor = "#2ecc71"; setTimeout(()=>document.getElementById('table-area').style.borderColor = "#333", 500);
            }
            if (selectedPact === 'echo' && Math.random() < 0.25 && !isRussianRoulette) { magazine.unshift(1); chamberKnowledge.unshift(0); updateAmmoTracker(); renderChamberUI(); updateLog("🔄 ECHO BULLET RETURNED!"); }
            if (statusEffects[victim].shield > 0 && dmg > 0) { statusEffects[victim].shield--; dmg = 0; updateLog(`🛡️ ${getShooterName(victim)} BLOCKED DAMAGE!`); }
            
            // 屠夫被动锁伤
            if (gameMode === 'pve' && victim === 2 && currentBoss.id === 'butcher' && dmg > 2) { dmg = 2; updateLog("🛡️ 屠夫的厚实脂肪缓冲了伤害！(Max 2)"); }
            
            if (dmg > 0) {
                if(isVolatileTrigger) updateLog("🧨 VOLATILE! " + t('shot_live', {shooter: shooterName, dmg: dmg})); else updateLog(t('shot_live', {shooter: shooterName, dmg: dmg}));
                playSound('bang'); hp[victim] -= dmg; if(targetType === 'enemy') { document.getElementById('table-area').classList.add('flash-red'); damageDealtThisTurn = true; }
            }
            globalTimer = setTimeout(()=>document.getElementById('table-area').classList.remove('flash-red'), 200);
            
            if (shooter === 1 && victim === 1) unlockAchievement(21); if (dmg >= 3 && hp[victim] <= 0 && targetType === 'enemy') unlockAchievement(27);
            damageMultiplier = 1; renderUI(); if (victim === 1 && hp[1] > 0 && dmg > 0) triggerTaunt('hit');

            if (gameMode === 'pve' && victim === 2 && hp[2] < maxHp[2]/2 && !currentBoss.phase2 && !isRussianRoulette) {
                triggerEnrage(); globalTimer = setTimeout(() => { if (!checkDead()) { if (magazine.length === 0) startRound(); else switchTurn(opponent); } }, 2600); return;
            }
            if (checkDead()) return; 
            if (isRussianRoulette && isLive) { return; } 

            // ✨✨✨ 【静电】逻辑 (Static) ✨✨✨
            if (currentEvent.id === 'static' && Math.random() < 0.25) {
                updateLog(t('static_trigger'));
                // 保持回合，不切换
                if (magazine.length === 0) globalTimer = setTimeout(startRound, 2000);
                else globalTimer = setTimeout(() => handleTurnStart(), 1500);
                return;
            }

            if (magazine.length === 0) globalTimer = setTimeout(startRound, 2000); else switchTurn(opponent); 
        } 
        // ============================================
        // 🟦 空弹 或 哑弹
        // ============================================
        else {
            playSound('click'); damageMultiplier = 1; 
            if (isDud) { 
                triggerTaunt('miss'); if (magazine.length === 0 && !checkDead()) { globalTimer = setTimeout(startRound, 2000); } else { switchTurn(opponent); } return; 
            }
            if (targetType === 'self' && selectedPact === 'flesh') { statusEffects[1].shield++; updateLog("🩸 FLESH PACT: SHIELD UP"); }
            if (targetType === 'enemy' && selectedPact === 'strict') { skipTurnEffect = true; updateLog("⚖️ STRICT PACT: SKIP TURN"); }
            if (selectedPact === 'greed' && !isRussianRoulette) { lootItems(currentTurn, 1); updateLog(t('c_greed_name')); }
            
            if ((isTwisted || selectedPact === 'power') && !isRussianRoulette) {
                for (let i = magazine.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [magazine[i], magazine[j]] = [magazine[j], magazine[i]]; }
                chamberKnowledge.fill(0); renderChamberUI(); historyLog.push(2); updateHistoryUI(); 
            }

            // 对自己射击 (空弹)
            if (targetType === 'self') {
                unlockAchievement(3); if (hp[1] === 1) unlockAchievement(28); if (selectedTalent === 'alarm') falseAlarmBuff++;
                if (selectedTalent === 'boom' && !isRussianRoulette) { hp[opponent]--; updateLog("💥 SELF-DESTRUCT DMG"); damageDealtThisTurn = true; renderUI(); if(checkDead()) return; }
                
                let keepTurn = true;
                if (currentEvent.id === 'blood' && selectedTalent !== 'luck' && !isRussianRoulette) keepTurn = false;
                if (currentEvent.id === 'fair' && !isRussianRoulette) keepTurn = false;
                if (isRussianRoulette) keepTurn = false;

                if (!keepTurn) { updateLog(t('shot_blank', {shooter: shooterName})); triggerTaunt('miss'); if (magazine.length === 0 && !checkDead()) globalTimer = setTimeout(startRound, 2000); else switchTurn(opponent); }
                else { 
                    updateLog(t('shot_blank', {shooter: shooterName}) + " " + t('safe_bet')); 
                    
                    // ✨✨✨ 【静电】逻辑也会在空弹时生效 (连射) ✨✨✨
                    if (currentEvent.id === 'static' && Math.random() < 0.25) updateLog(t('static_trigger'));

                    if (magazine.length === 0 && !checkDead()) globalTimer = setTimeout(startRound, 2000); else globalTimer = setTimeout(() => handleTurnStart(), 1000); 
                }
            } 
            // 对敌人射击 (空弹)
            else {
                updateLog(t('shot_blank_miss', {shooter: shooterName})); triggerTaunt('miss'); if(skipTurnEffect) handCuffedTarget = shooter; 
                
                // ✨✨✨ 【静电】逻辑 ✨✨✨
                if (currentEvent.id === 'static' && Math.random() < 0.25) {
                     updateLog(t('static_trigger'));
                     if (magazine.length === 0 && !checkDead()) globalTimer = setTimeout(startRound, 2000); 
                     else globalTimer = setTimeout(() => handleTurnStart(), 1500); 
                     return;
                }

                if (magazine.length === 0 && !checkDead()) globalTimer = setTimeout(startRound, 2000); else switchTurn(opponent);
            }
        }
    }, 500);
}

function switchTurn(nextPlayer) {
    if (currentTurn === 1 && selectedPact === 'acute' && !damageDealtThisTurn && !isRussianRoulette) { hp[1]--; updateLog("⌛ ACUTE DEATH: -1 HP"); renderUI(); if(checkDead()) return; }
    if (handCuffedTarget === nextPlayer && !isRussianRoulette) { let name = getShooterName(nextPlayer); updateLog(`🔗 ${name} (SKIP)`); handCuffedTarget = 0; switchTurn((nextPlayer===1)?2:1); return; }
    currentTurn = nextPlayer; handleTurnStart();
}

function handleTurnStart() {
    gameLock = false; itemsUsedThisTurn = 0; damageDealtThisTurn = false; updateTurnUI();
    // 赌徒偷窃
    if (currentTurn === 2 && gameMode === 'pve' && currentBoss.id === 'gambler') {
        let pItems = Object.keys(currentItems[1]).filter(k => currentItems[1][k] > 0);
        if (pItems.length > 0 && Math.random() < 0.6) { 
            let stolen = pItems[Math.floor(Math.random() * pItems.length)]; 
            currentItems[1][stolen]--; currentItems[2][stolen] = (currentItems[2][stolen] || 0) + 1; 
            updateLog(`🃏 赌徒顺手牵羊拿走了你的 ${t('i_'+stolen)}!`); renderUI(); 
        }
    }
    if (adrenalineDebt[currentTurn]) { hp[currentTurn]--; adrenalineDebt[currentTurn] = false; updateLog("💉 ADRENALINE CRASH: -1 HP"); renderUI(); if (checkDead()) return; }
    
    let queue = delayedDamageQueue[currentTurn];
    if (queue.length > 0) {
        for (let i = queue.length - 1; i >= 0; i--) { queue[i].turns--; if (queue[i].turns <= 0) { hp[currentTurn] -= queue[i].dmg; updateLog(`🧪 POISON: -${queue[i].dmg} HP`); queue.splice(i, 1); } }
        renderUI(); if (checkDead()) return;
    }
    if (gameMode === 'pve' && currentBoss.id === 'doctor' && currentTurn === 2 && !isRussianRoulette) { if (hp[2] < maxHp[2] && Math.random() < 0.3) { hp[2]++; updateLog("💊 Doctor Heals"); renderUI(); playSound('heal'); } }
    
    isDevilDealActive = false; let btnSelf = document.getElementById('btn-self'); btnSelf.classList.remove('cursed-btn'); 
    if (currentTurn === 1 && Math.random() < 0.3 && !isRussianRoulette) { isDevilDealActive = true; btnSelf.classList.add('cursed-btn'); }
    
    if (gameMode === 'pve') { if (currentTurn === 1) setControls(true); else { setControls(false); globalTimer = setTimeout(aiLogic, 1500); } } else { setControls(true); }
    saveGame();
}

// =========================================
// 7. 道具逻辑
// =========================================
function useItem(name) {
    if (gameLock) return; if (isRussianRoulette) return; 
    if (gameMode === 'pve' && currentTurn === 1 && document.getElementById('btn-self').disabled) return;
    if (currentItems[currentTurn][name] <= 0) return;

    // ✨✨✨ 【锈蚀】判定 ✨✨✨
    if (currentEvent.id === 'rust' && Math.random() < 0.3) {
        currentItems[currentTurn][name]--; itemsUsedThisTurn++; playSound('click'); 
        updateLog(t('rust_fail')); renderUI();
        if (gameMode === 'pve' && currentTurn === 2) globalTimer = setTimeout(aiLogic, 1000);
        return; 
    }

    if (currentEvent.id === 'sacrifice') { 
        if (hp[currentTurn] > 1) { hp[currentTurn]--; renderUI(); updateLog("🩸 献祭：失去 1 点生命值"); } 
        else { updateLog("🩸 濒死特权：免除了献祭代价！"); playSound('loot'); } 
    }

    currentItems[currentTurn][name]--;
    let isFakeFail = false; let isDoubleEffect = false;
    if (currentTurn === 1 && selectedPact === 'eye') { if (Math.random() < 0.5) { isFakeFail = true; isDoubleEffect = true; } }
    
    if (feintActive) { feintActive = false; updateLog(`🎭 ${getShooterName(currentTurn)} FEINTS ${t('i_'+name)}`); if (currentTurn === 1) unlockAchievement(18); renderUI(); return; }

    itemsUsedThisTurn++; playSound('item');
    if (currentTurn === 1) {
        if(name==='smoke') unlockAchievement(2); if(name==='magnifier') { magnifierCount++; if(magnifierCount>=3) unlockAchievement(5); }
        if(name==='beer') { beerCount++; if(beerCount>=3) unlockAchievement(13); } if(name==='mirror') unlockAchievement(15);
        if(name==='preload') unlockAchievement(17); if(name==='saw') unlockAchievement(22); if(name==='cuffs') unlockAchievement(23);
        if(name==='inverter') unlockAchievement(24); if(name==='jammer') unlockAchievement(25);
        let totalItems = 0; ITEM_LIST.forEach(k=> totalItems += currentItems[1][k]); if(totalItems >= 6) unlockAchievement(26);
    }

    if (gameMode === 'pve' && currentBoss.id === 'tactician' && currentTurn === 1 && tacticianTrapActive) { tacticianTrapActive = false; updateLog(t('tact_block', {item: t('i_'+name)})); renderUI(); return; }

    let opponent = (currentTurn === 1) ? 2 : 1; let effectiveUser = currentTurn; let userName = getShooterName(currentTurn);
    if (statusEffects[currentTurn].jammed) { statusEffects[currentTurn].jammed = false; updateLog(t('item_jammed', {item: t('i_'+name)})); renderUI(); if (gameMode === 'pve' && currentTurn === 2) globalTimer = setTimeout(aiLogic, 1000); return; }
    let eName = getShooterName(effectiveUser); 

    if (name === 'magnifier') { 
        let idx = magazine.length - 1; let isFake = (selectedTalent === 'mis' && Math.random() < 0.5); 
        if (gameMode === 'pve' && currentBoss.id === 'tactician' && currentTurn === 1 && Math.random() < 0.5) { isFake = true; updateLog("📡 战术家干扰了你的侦查设备！"); }
        let realState = magazine[idx]; let shownState = isFake ? (realState===1?0:1) : realState;
        if (effectiveUser === 1) { chamberKnowledge[idx] = (shownState === 1) ? 1 : 2; renderChamberUI(); updateLog(`🔍 ${shownState===1 ? "LIVE" : "BLANK"}`); } else updateLog(`🔍 ${eName} checked...`);
    } 
    else if (name === 'beer') { let b = magazine.pop(); chamberKnowledge.pop(); renderChamberUI(); updateAmmoTracker(); historyLog.push(b===1?1:0); updateHistoryUI(); updateLog(`🍺 ${eName}: ${b===1?"LIVE":"BLANK"}`); if (magazine.length===0) globalTimer = setTimeout(startRound, 1500); }
    else if (name === 'saw') { damageMultiplier = isDoubleEffect ? 4 : 2; updateLog(`🪚 ${eName} SAW ${isDoubleEffect?'(x4!)':''}`); }
    else if (name === 'smoke') { 
        // ✨✨✨ 修改：血月下无效 ✨✨✨
        if (currentEvent.id === 'blood_moon') { updateLog(t('no_heal_blood')); } else {
            let healAmt = isDoubleEffect ? 2 : 1; if (hp[effectiveUser] < maxHp[effectiveUser]) hp[effectiveUser] = Math.min(maxHp[effectiveUser], hp[effectiveUser]+healAmt); updateLog(`🚬 ${eName} +${healAmt} HP`); 
        }
    }
    // ✨✨✨ 新增：过期药逻辑 ✨✨✨
    else if (name === 'expired_med') {
        let roll = Math.random();
        if (currentEvent.id === 'blood_moon') {
            if (roll < 0.5) updateLog(t('no_heal_blood'));
            else { hp[effectiveUser]--; updateLog(t('med_hurt')); damageDealtThisTurn = true; }
        } else {
            if (roll < 0.5) { if (hp[effectiveUser] < maxHp[effectiveUser]) { hp[effectiveUser]++; updateLog(t('med_heal')); playSound('heal'); } else updateLog(t('med_heal') + " (MAX)"); } 
            else { hp[effectiveUser]--; updateLog(t('med_hurt')); playSound('dmg'); damageDealtThisTurn = true; }
        }
    }
    else if (name === 'cuffs') { handCuffedTarget = opponent; updateLog(`🔗 ${eName} CUFFS`); }
    else if (name === 'inverter') { let v = magazine.pop(); magazine.push(v===1?0:1); let idx = magazine.length-1; if (chamberKnowledge[idx] === 1) chamberKnowledge[idx] = 2; else if (chamberKnowledge[idx] === 2) chamberKnowledge[idx] = 1; renderChamberUI(); updateLog(`🔄 ${eName} INVERT`); historyLog.push(2); updateHistoryUI(); }
    else if (name === 'jammer') { statusEffects[opponent].jammed = true; updateLog(`🚫 ${eName} JAMMER`); if(effectiveUser===1) unlockAchievement(9); }
    else if (name === 'mirror') { 
        if (currentTurn === 1) {
            let enemyTotal = 0; for(let k in currentItems[2]) enemyTotal += currentItems[2][k];
            if (enemyTotal <= 0) { updateLog("🔮 对手空空如也，无法窃取！"); currentItems[1]['mirror']++; itemsUsedThisTurn--; return; }
            if (mirrorSelectionMode) { window.cancelMirrorMode(); } else { mirrorSelectionMode = true; updateLog("🔮 请点击敌人的道具进行窃取..."); currentItems[1]['mirror']--; itemsUsedThisTurn++; renderMirrorUI(true); }
        } else {
            let pItems = Object.keys(currentItems[1]).filter(k => currentItems[1][k] > 0);
            if (pItems.length > 0) { let stolen = pItems[Math.floor(Math.random() * pItems.length)]; currentItems[1][stolen]--; currentItems[2][stolen] = (currentItems[2][stolen] || 0) + 1; updateLog(`🔮 AI 窃取了你的 ${t('i_'+stolen)}!`); } else { updateLog(`🔮 AI 浪费了魔镜...`); }
        }
        renderUI(); return; 
    }
    else if (name === 'preload') { magazine.unshift(1); chamberKnowledge.unshift(0); updateAmmoTracker(); renderChamberUI(); updateLog(`⏳ ${eName} PRELOAD`); }
    else if (name === 'feint') { feintActive = true; updateLog(`🪤 ${eName} FEINT READY`); }
    else if (name === 'safety') { safetyActive = true; updateLog(`🧷 ${eName} SAFETY ON`); }
    else if (name === 'hourglass') { if (magazine.length > 1) { let shell = magazine.pop(); let know = chamberKnowledge.pop(); magazine.unshift(shell); chamberKnowledge.unshift(know); updateLog(`⏳ ${eName} HOURGLASS`); renderChamberUI(); } else { updateLog("⏳ USELESS NOW..."); } }
    else if (name === 'visor') { visorActive = true; updateLog(`🎭 ${eName} VISOR ON`); }
    else if (name === 'delay_shell') { nextShotIsDelayed = true; updateLog(`🧪 ${eName} COATS BULLET`); }
    else if (name === 'death_chip') { deathChipActive[currentTurn] = true; updateLog(`⚰️ ${eName} DEATH BARGAIN`); }
    else if (name === 'adrenaline') { adrenalineDebt[currentTurn] = true; itemsUsedThisTurn = -1; updateLog(`💉 ${eName} RUSH! (-1 HP NEXT)`); handCuffedTarget = opponent; }
    else if (name === 'phone') { let unknownIndices = []; for(let i=0; i<magazine.length; i++) { if(chamberKnowledge[i] === 0) unknownIndices.push(i); } if(unknownIndices.length > 0) { let idx = unknownIndices[Math.floor(Math.random() * unknownIndices.length)]; let state = magazine[idx]; if(effectiveUser === 1) { chamberKnowledge[idx] = (state === 1) ? 1 : 2; renderChamberUI(); updateLog(`📱 FUTURE: #${magazine.length - idx} is ${state===1?'LIVE':'BLANK'}`); } else { updateLog(`📱 ${eName} HACKED FUTURE...`); } } else { updateLog(`📱 NO SIGNAL...`); } }

    renderUI(); saveGame();
    if (isFakeFail) { updateLog("👁️ DECEPTIVE EYE: CRITICAL SUCCESS!"); }
    if (gameMode === 'pve' && currentTurn === 2 && magazine.length > 0) globalTimer = setTimeout(aiLogic, 1500);
}

// ✅ 修复：魔镜窃取核心函数
window.performMirrorSteal = function(targetItemKey) {
    // 1. 基础检查
    if (!mirrorSelectionMode || gameLock) return;
    if (currentItems[2][targetItemKey] <= 0) return;

    // 2. 解锁成就
    unlockAchievement(15); 

    // 3. 执行窃取数据交换
    currentItems[2][targetItemKey]--; 
    currentItems[1][targetItemKey] = (currentItems[1][targetItemKey] || 0) + 1;

    // 4. 播放音效与提示
    playSound('loot'); 
    updateLog(`🔮 STOLE ${t('i_' + targetItemKey)}!`); 
    showItemToast([targetItemKey], 1); // 弹出获得物品提示

    // 5. 关闭模式并保存
    mirrorSelectionMode = false; 
    renderMirrorUI(false); 
    renderUI(); 
    saveGame();
};

function aiLogic() {
    if (magazine.length === 0 || hp[2] <= 0 || gameLock) return;
    if (isRussianRoulette) { globalTimer = setTimeout(() => fire('self'), 1000); return; }
    let style = currentBoss && currentBoss.style ? currentBoss.style : 'chaotic';
    let strategy = AI_BEHAVIORS[style] || AI_BEHAVIORS.chaotic;
    globalTimer = setTimeout(() => { strategy(); }, 1000);
}

function triggerEnrage() {
    if (!currentBoss || currentBoss.phase2) return;
    currentBoss.phase2 = true; gameLock = true; document.getElementById('boss-card').classList.add('enraged');
    let splash = document.getElementById('event-splash'); let card = document.querySelector('.event-splash-card'); card.classList.add('enrage-mode');
    document.getElementById('splash-title').innerText = t('enrage_title'); document.getElementById('splash-desc').innerText = t('enrage_' + currentBoss.id);
    splash.style.display = 'flex'; playSound('enrage');
    
    let gainedItems = [];
    if (currentBoss.id === 'butcher') { currentItems[2].saw++; gainedItems.push('saw'); }
    if (currentBoss.id === 'doctor') { hp[2] = Math.min(hp[2]+2, maxHp[2]); renderUI(); }
    if (currentBoss.id === 'tactician') { currentItems[2].cuffs++; handCuffedTarget = 1; gainedItems.push('cuffs'); }
    if (currentBoss.id === 'gambler') { 
        let p1Items = Object.keys(currentItems[1]).filter(k => currentItems[1][k] > 0); 
        if(p1Items.length > 0) { let stolen = p1Items[Math.floor(Math.random()*p1Items.length)]; currentItems[1][stolen]--; currentItems[2][stolen] = (currentItems[2][stolen] || 0) + 1; gainedItems.push(stolen); } 
    }
    if(gainedItems.length > 0) showItemToast(gainedItems, 2);
    setTimeout(() => { splash.style.display = 'none'; card.classList.remove('enrage-mode'); gameLock = false; }, 2500);
}

function checkDead() {
    if (hp[1] <= 0 && safetyActive && !isRussianRoulette) { hp[1] = 1; safetyActive = false; updateLog("🧷 SAFETY SAVED YOU!"); unlockAchievement(16); renderUI(); return false; }
    for (let pid = 1; pid <= 2; pid++) { if (hp[pid] <= 0 && deathChipActive[pid]) { let enemy = (pid === 1) ? 2 : 1; hp[enemy] -= 2; deathChipActive[pid] = false; updateLog(t('mech_mutual')); renderUI(); } }
    for (let pid = 1; pid <= 2; pid++) {
        if (hp[pid] <= 0) {
            if (lives[pid] > 1) {
                if (pid === 2 && currentBoss.id === 'gambler') { triggerSicBo(); return false; } // 赌徒死亡触发骰宝
                lives[pid]--; hp[pid] = maxHp[pid]; updateLog(t('resurrect', {name: getShooterName(pid)})); startRound(true); return false; 
            }
        }
    }
    let p1Dead = hp[1] <= 0; let p2Dead = hp[2] <= 0;
    if (p1Dead || p2Dead) {
        setControls(false); gameLock = true; clearSave(); 
        if (p1Dead) {
            playSound('lose'); // 如果玩家死了（包括放弃），播放失败音效
        } else {
            playSound('win');  // 只有玩家活着且敌人死了，才播放胜利音效
        }
        setTimeout(() => {
            let overlay = document.getElementById('overlay'); let title = document.getElementById('win-title'); let desc = document.getElementById('win-desc'); let comment = document.getElementById('win-comment'); let cardBox = document.getElementById('card-display'); let restartBtn = document.getElementById('restart-btn');
            overlay.style.display = 'flex'; requestAnimationFrame(() => overlay.style.opacity = 1); cardBox.innerHTML = '';
            if (p1Dead && p2Dead) { title.innerText = t('win_draw'); title.style.color = "#7f8c8d"; desc.innerText = t('win_draw_desc'); comment.innerText = "“...”"; restartBtn.style.display = 'block'; }
            else if (p1Dead) { title.innerText = t('win_died'); title.style.color = "#ff4757"; desc.innerText = t('win_kill', {name: getShooterName(2)}); restartBtn.style.display = 'block'; if(selectedPact) comment.innerText = t('eval_greedy'); else comment.innerText = t('eval_sad'); triggerTaunt('win'); } 
            else {
                title.innerText = t('win_vic'); title.style.color = "var(--accent-gold)"; desc.innerText = t('win_reward', {name: getShooterName(2)}); restartBtn.style.display = 'none'; 
                if (hp[1] === maxHp[1]) comment.innerText = t('eval_perfect'); else if (hp[1] === 1) comment.innerText = t('eval_clutch'); else if (historyLog.filter(x=>x===1).length > historyLog.filter(x=>x===0).length) comment.innerText = t('eval_brutal'); else comment.innerText = t('eval_lucky');
                if (hp[1] === 1) unlockAchievement(6); if (hp[1] === maxHp[1]) unlockAchievement(10); if (isTwisted) unlockAchievement(7);
                if (currentBoss.id === 'butcher') unlockAchievement(8); if (currentBoss.id === 'tactician') unlockAchievement(9); if (currentBoss.id === 'doctor') unlockAchievement(11);
                if (currentBoss.id === 'gambler') unlockAchievement(12); if (selectedPact) unlockAchievement(19); if (currentEvent.id === 'fog') unlockAchievement(20);
                if (currentEvent.id === 'sacrifice') unlockAchievement(29); if (level >= 3) unlockAchievement(30);
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

function getWeightedRandomItem() {
    let validItems = ITEM_LIST.filter(key => ITEM_WEIGHTS[key] !== undefined);
    let totalWeight = 0; validItems.forEach(key => totalWeight += ITEM_WEIGHTS[key]);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < validItems.length; i++) {
        let key = validItems[i]; let weight = ITEM_WEIGHTS[key];
        if (random < weight) { return key; } random -= weight;
    }
    return validItems[0];
}

function lootItems(pid, count) {
    let gained = []; let currentTotal = 0; for (let k in currentItems[pid]) currentTotal += currentItems[pid][k];
    for(let i = 0; i < count; i++) {
        if (currentTotal >= MAX_ITEMS) { if (pid === 1) updateLog("🎒 背包已满！"); break; }
        let item = getWeightedRandomItem();
        currentItems[pid][item] = (currentItems[pid][item] || 0) + 1; gained.push(item); currentTotal++;
    }
    if(gained.length > 0) showItemToast(gained, pid);
}

function toggleStarterItem(key) {
    const idx = starterItemsBuffer.indexOf(key);
    if (idx > -1) { starterItemsBuffer.splice(idx, 1); document.getElementById('starter-btn-' + key).classList.remove('selected'); } 
    else { if (starterItemsBuffer.length < 2) { starterItemsBuffer.push(key); document.getElementById('starter-btn-' + key).classList.add('selected'); } else { playSound('click'); return; } }
    const allBtns = document.querySelectorAll('.starter-select-btn');
    allBtns.forEach(b => { if (starterItemsBuffer.length >= 2 && !b.classList.contains('selected')) b.classList.add('dimmed'); else b.classList.remove('dimmed'); });
    updateStarterConfirmBtn(); playSound('click');
}

function confirmStarterItems() {
    document.getElementById('starter-item-screen').style.display = 'none'; initGame(); 
    starterItemsBuffer.forEach(item => { currentItems[1][item] = (currentItems[1][item] || 0) + 1; });
    renderItemsGrid(); renderUI(); if(starterItemsBuffer.length > 0) showItemToast(starterItemsBuffer, 1);
}

function randomizeStarterItems() {
    starterItemsBuffer = []; const allBtns = document.querySelectorAll('.starter-select-btn');
    allBtns.forEach(b => { b.classList.remove('selected'); b.classList.remove('dimmed'); });
    let pool = ALL_ITEM_LIST.filter(i => i !== 'feint' && i !== 'visor');
    while (starterItemsBuffer.length < 2) { let r = Math.floor(Math.random() * pool.length); let item = pool[r]; if (!starterItemsBuffer.includes(item)) starterItemsBuffer.push(item); }
    starterItemsBuffer.forEach(key => { let btn = document.getElementById('starter-btn-' + key); if (btn) btn.classList.add('selected'); });
    allBtns.forEach(b => { if (!b.classList.contains('selected')) b.classList.add('dimmed'); });
    updateStarterConfirmBtn(); playSound('click');
}

function setControls(enable) { document.getElementById('btn-self').disabled = !enable; document.getElementById('btn-enemy').disabled = isRussianRoulette ? true : !enable; document.querySelectorAll('.item-btn').forEach(b => b.disabled = isRussianRoulette ? true : !enable); }

// 骰宝逻辑
function triggerSicBo() {
    gameLock = true; document.getElementById('sicbo-screen').style.display = 'flex'; document.getElementById('sicbo-btn-group').style.display = 'flex'; 
    document.getElementById('sicbo-result').innerText = ""; document.getElementById('sb-d1').innerText = "?"; document.getElementById('sb-d2').innerText = "?"; document.getElementById('sb-d3').innerText = "?"; playSound('click');
}
window.resolveSicBo = function(choice) {
    document.getElementById('sicbo-btn-group').style.display = 'none';
    let d1 = Math.floor(Math.random() * 6) + 1; let d2 = Math.floor(Math.random() * 6) + 1; let d3 = Math.floor(Math.random() * 6) + 1; let sum = d1 + d2 + d3;
    document.getElementById('sb-d1').innerText = d1; document.getElementById('sb-d2').innerText = d2; document.getElementById('sb-d3').innerText = d3;
    let isTriple = (d1 === d2 && d2 === d3); let resultType = (sum >= 11 && sum <= 17) ? 'big' : 'small'; let msgEl = document.getElementById('sicbo-result');

    if (isTriple) {
        msgEl.innerText = `⚠ 围骰 (TRIPLE) ${d1}-${d2}-${d3}！`; msgEl.style.color = "var(--accent-red)"; document.querySelector('.sicbo-content').classList.add('triple-kill'); playSound('bang');
        setTimeout(() => {
            document.getElementById('sicbo-screen').style.display = 'none'; document.querySelector('.sicbo-content').classList.remove('triple-kill');
            lives[1]--; hp[1] = 0; lives[2]--; hp[2] = maxHp[2]; updateLog("☠️ 围骰！你失去了一条命！");
            if (lives[1] <= 0) { checkDead(); } else { hp[1] = maxHp[1]; startRound(true); }
        }, 2000); return;
    }
    let playerWin = (choice === resultType);
    msgEl.innerText = `${sum} 点 (${resultType.toUpperCase()}) - ${playerWin ? "WIN" : "LOSE"}`; msgEl.style.color = playerWin ? "var(--accent-green)" : "var(--accent-red)"; playSound(playerWin ? 'loot' : 'dmg');
    setTimeout(() => {
        document.getElementById('sicbo-screen').style.display = 'none'; lives[2]--;
        if (playerWin) { updateLog("🎲 赌赢了！赌徒家徒四壁！"); currentItems[2] = {}; hp[2] = Math.floor(maxHp[2] / 2); } 
        else { updateLog("🎲 赌输了！你失去了一切！"); currentItems[1] = {}; hp[2] = maxHp[2]; hp[1] = Math.max(1, Math.floor(hp[1] / 2)); }
        renderUI(); startRound(true);
    }, 2000);
};

function getShooterName(pid) {
    if (pid === 1) return t('label_you');
    if (gameMode === 'pvp') return t('label_p2');
    if (currentBoss && currentBoss.id) return t('b_' + currentBoss.id);
    return "UNKNOWN";
}