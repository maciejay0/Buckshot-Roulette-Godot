/**
 * assets/js/audio.js
 * 负责：音频资源管理、播放逻辑、音量控制 (BGM & SFX)
 */

// 1. 资源配置表 (确保文件名与 assets/sfx/ 下一致)
const AUDIO_SOURCES = {
    bgm: 'assets/sfx/bgm_loop.mp3',      // 背景音乐
    fire: 'assets/sfx/shotgun_fire.mp3', // 开火 (实弹)
    bang: 'assets/sfx/shotgun_impact.mp3', // 命中/处决
    click: 'assets/sfx/empty_click.mp3', // 空弹/空仓
    reload: 'assets/sfx/reload.mp3',     // 装弹
    item: 'assets/sfx/use_item.mp3',     // 使用道具
    heal: 'assets/sfx/heal.mp3',         // 治疗
    dmg: 'assets/sfx/hurt.mp3',          // 受伤
    loot: 'assets/sfx/item_get.mp3',     // 获得道具
    enrage: 'assets/sfx/boss_enrage.mp3',// Boss暴走
    win: 'assets/sfx/win.mp3',           // 胜利
    lose: 'assets/sfx/lose.mp3'          // 失败
};

// 2. 全局状态
const audioCache = {};       // SFX 缓存池
let bgmInstance = null;      // BGM 专用实例
let isAudioInitialized = false;

// 3. 全局音量变量 (0.0 ~ 1.0)
let volBgm = 0.2; // 默认 BGM 音量 20%
let volSfx = 0.8; // 默认 SFX 音量 80%

/**
 * 初始化音频系统
 * 预加载所有音频对象
 */
function initAudioSystem() {
    if (isAudioInitialized) return;
    console.log("🔊 Initializing Audio System...");

    for (let key in AUDIO_SOURCES) {
        const audio = new Audio(AUDIO_SOURCES[key]);
        audio.preload = 'auto'; // 强制预加载

        if (key === 'bgm') {
            audio.loop = true;  // BGM 开启循环
            bgmInstance = audio;
        } else {
            audioCache[key] = audio;
        }
    }

    isAudioInitialized = true;
}

/**
 * 核心播放函数
 * @param {string} type - 对应 AUDIO_SOURCES 的 key
 */
function playSound(type) {
    // 1. 检查全局静音开关 (在 engine.js 中定义 soundEnabled)
    if (typeof soundEnabled !== 'undefined' && !soundEnabled) {
        if (type === 'bgm' && bgmInstance) bgmInstance.pause();
        return;
    }

    // 2. 懒加载初始化
    if (!isAudioInitialized) initAudioSystem();

    // 3. 处理 BGM (背景音乐)
    if (type === 'bgm') {
        if (bgmInstance) {
            // 每次播放或恢复时，强制应用当前音量
            bgmInstance.volume = volBgm;
            
            if (bgmInstance.paused) {
                let playPromise = bgmInstance.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("⏳ 等待用户交互以启动 BGM...");
                        // 浏览器策略限制：添加一次性点击监听来启动音乐
                        document.addEventListener('click', startBgmOnInteraction, { once: true });
                    });
                }
            }
        }
        return;
    }

    // 4. 处理 SFX (普通音效)
    const original = audioCache[type];
    if (original) {
        // 克隆节点：允许并发播放 (例如快速连点、连续受伤)
        const clone = original.cloneNode();
        
        // 应用当前的 SFX 音量
        clone.volume = Math.max(0, Math.min(1, volSfx));
        
        // 播放
        clone.play().catch(e => { /* 忽略自动播放受限的报错 */ });
        
        // 播放结束后自动销毁，防止内存泄漏
        clone.onended = function() {
            this.remove();
        };
    } else {
        console.warn(`⚠️ 音效未找到: ${type}`);
    }
}

/**
 * 辅助函数：用户交互后启动 BGM
 */
function startBgmOnInteraction() {
    if (bgmInstance && (!typeof soundEnabled === 'undefined' || soundEnabled === true)) {
        bgmInstance.volume = volBgm;
        bgmInstance.play().catch(e => console.log("BGM Start Failed"));
    }
}

/**
 * 设置 BGM 音量 (由 UI 滑块调用)
 * @param {number} val0to100 - 0 到 100 的整数
 */
function setBgmLevel(val0to100) {
    volBgm = val0to100 / 100; // 转换为 0.0 - 1.0
    // 如果 BGM 正在播放，实时调整音量
    if (bgmInstance) {
        bgmInstance.volume = volBgm;
    }
}

/**
 * 设置 SFX 音量 (由 UI 滑块调用)
 * @param {number} val0to100 - 0 到 100 的整数
 */
function setSfxLevel(val0to100) {
    volSfx = val0to100 / 100; // 转换为 0.0 - 1.0
    // SFX 音量会在下一次 playSound 时生效
}

/**
 * 停止所有声音 (用于退出到主菜单或重置)
 */
function stopAllSounds() {
    if (bgmInstance) {
        bgmInstance.pause();
        bgmInstance.currentTime = 0; // 重置进度
    }
}

// 立即尝试初始化 (但浏览器可能会阻止直到用户点击)
initAudioSystem();