/**
 * constants.js - 存放游戏所有静态数据与配置
 * 作用：相当于游戏的数据库，存储文本、数值、配置项，方便统一修改。
 */

// 1. 道具 ID 列表
// 引擎通过遍历这个数组来生成道具、判断道具是否合法
const ALL_ITEM_LIST = [
    'magnifier',   // 放大镜
    'beer',        // 啤酒
    'saw',         // 锯子
    'smoke',       // 香烟
    'cuffs',       // 手铐
    'inverter',    // 逆转器
    'jammer',      // 干扰器
    'mirror',      // 魔镜
    'preload',     // 预装弹
    'feint',       // 假动作
    'safety',      // 保险栓
    'hourglass',   // 缓刑沙漏
    'visor',       // 假视镜 (PvP专用)
    'delay_shell', // 后效弹
    'death_chip',  // 临终筹码
    'adrenaline',  // 肾上腺素
    'phone'        // 神秘手机
];

// 2. 道具图标映射
// UI 渲染时，通过 item ID 在这里查找对应的 Emoji 图标
const ITEM_ICONS = { 
    magnifier:'🔍', beer:'🍺', saw:'🪚', smoke:'🚬', cuffs:'🔗', inverter:'🔄', 
    jammer:'🚫', mirror:'🔮', preload:'⏳', feint:'🪤', safety:'🧷',
    hourglass:'⏳', visor:'🎭', delay_shell:'🧪', death_chip:'⚰️', adrenaline:'💉', phone:'📱'
};

// 3. 语言包 (Localization)
// 包含中文 (zh) 和 英文 (en) 两套文本
// 格式：key: "翻译文本"
const TEXT = {
    zh: {
        // --- 菜单与通用按钮 ---
        pve_btn: "💀 单人战役", pvp_btn: "⚔️ 双人对战", restart_btn: "🏠 返回主菜单",
        btn_continue: "▶ 继续游戏", 
        label_demon: "恶魔", label_p2: "P2", label_you: "你", label_p1: "P1",
        wait: "等待...", ready: "系统就绪...", reload: "弹药装填完毕",

        // --- 战斗日志文本 (支持 {placeholder} 替换) ---
        shot_live: "💥 实弹！{shooter} 造成 {dmg} 点伤害",
        shot_blank: "💨 空弹。{shooter} 运气不错",
        shot_blank_miss: "💨 空弹。{shooter} 错失机会",
        safe_bet: "赌对了！保留回合", // 对自己打空弹成功
        deal_success: "😈 契约达成！", deal_fail: "💀 契约失败！", // 恶魔交易逻辑
        item_jammed: "🚫 {item} 失效！受到干扰！", 
        mirror_steal: "🔮 魔镜窃取了 {item} 的效果！",
        tact_block: "🚫 战术家封锁了 {item}",
        ammo_fmt: "【 {live} 实弹 | {blank} 空弹 】", // 弹药计数器
        resurrect: "✨ {name} 消耗一条命复活了！", // 复活提示

        // --- 操作按钮 ---
        btn_self: "对自己", btn_enemy: "对敌人", 
        sub_self: "风险博弈", sub_enemy: "造成伤害", // 按钮下的小字说明
        twist_on: "☣ 扭曲模式 (开)", twist_off: "☣ 扭曲模式 (关)",

        // --- 道具名称 (i_) 和 描述 (d_) ---
        i_magnifier: "放大镜", d_magnifier: "确认下一发子弹。", 
        i_beer: "啤酒", d_beer: "退去当前子弹。",
        i_saw: "锯子", d_saw: "下一发伤害翻倍。", 
        i_smoke: "香烟", d_smoke: "回复 1 点生命值。",
        i_cuffs: "手铐", d_cuffs: "跳过对手回合。", 
        i_inverter: "逆转器", d_inverter: "转换子弹虚实。",
        i_jammer: "干扰器", d_jammer: "废掉对手道具。", 
        i_mirror: "魔镜", d_mirror: "窃取增益。",
        i_preload: "预装弹", d_preload: "底部塞入一发实弹。", 
        i_feint: "假动作", d_feint: "下一个道具无效但可见。",
        i_safety: "保险栓", d_safety: "抵挡一次致死自伤。",
        i_hourglass: "缓刑沙漏", d_hourglass: "当前子弹移至最底部。",
        i_visor: "假视镜", d_visor: "(PvP) 对手看到的下一次提示反转。",
        i_delay_shell: "后效弹", d_delay_shell: "实弹伤害延迟 2 回合生效。",
        i_death_chip: "临终筹码", d_death_chip: "若本轮死亡，对敌人造成 2 点伤害。",
        i_adrenaline: "肾上腺素", d_adrenaline: "再次行动，但下回合扣 1 HP。",
        i_phone: "神秘手机", d_phone: "查看未来随机一发子弹。",

        // --- 机制提示 ---
        mech_dud: "💨 哑弹！子弹受潮了，无人受伤。",
        mech_jam: "🔥 卡壳！枪管过热，强制结束回合。",
        mech_mutual: "⚖️ 同归于尽！临终筹码触发！",

        // --- 胜利/失败 ---
        win_draw: "平局", win_draw_desc: "没有人活着离开。",
        win_died: "你死了", win_vic: "胜利", 
        win_kill: "被 {name} 击杀", win_reward: "击败 {name}，选择奖励：",

        // --- Boss 信息 (b_名字, p_被动描述) ---
        b_butcher: "屠夫", p_butcher: "被动：实弹伤害 +1", 
        b_gambler: "赌徒", p_gambler: "被动：最后必为实弹",
        b_doctor: "瘟医", p_doctor: "被动：概率回血", 
        b_tactician: "战术家", p_tactician: "被动：干扰首个道具",
        b_player2: "P2", p_player2: "公平竞技",

        // --- Boss 暴走阶段 (二阶段) ---
        enrage_title: "⚠ 阶段二：暴走", 
        enrage_butcher: "伤害 +2 | 获得锯子",
        enrage_gambler: "盗取道具 | 弹药错乱", 
        enrage_doctor: "紧急治疗 +2 HP", 
        enrage_tactician: "封锁行动 | 获得手铐",

        // --- 特殊事件 (e_标题, ed_描述) ---
        e_normal: "平静", ed_normal: "无特殊规则", 
        e_overheat: "枪管过热", ed_overheat: "连续实弹伤害叠加",
        e_blood: "血债血偿", ed_blood: "自伤加倍，无保留回合", 
        e_shuffle: "空间错乱", ed_shuffle: "装填后弹舱打乱两次",
        e_vision: "全息瞄准", ed_vision: "25% 概率显示子弹虚实",
        e_fog: "迷雾回合", ed_fog: "历史失效，只显示总弹数", 
        e_fair: "公平审判", ed_fair: "无法连续行动",
        e_volatile: "不稳定弹药", ed_volatile: "空弹 30% 概率变实弹", 
        e_sacrifice: "血祭", ed_sacrifice: "使用道具扣 1 HP",

        // --- 关卡奖励 (buff_) ---
        buff_heal: "急救包", bd_heal: "HP 全回满", 
        buff_hp: "防弹衣", bd_hp: "HP 上限 +1",
        buff_box: "军火箱", bd_box: "随机道具 x4", 
        buff_tech: "黑科技", bd_tech: "干扰器 + 魔镜",

        // --- 天赋 (talent_) ---
        talent_eye: "鹰眼", td_eye: "首发子弹 30% 明牌", 
        talent_pack: "囤积者", td_pack: "初始道具 +1",
        talent_luck: "赌圣", td_luck: "空弹必保留回合",
        talent_pain: "痛觉适应", td_pain: "对自己实弹伤害-1", 
        talent_alarm: "虚惊一场", td_alarm: "自伤空弹蓄力下一次",
        talent_poker: "扑克脸", td_poker: "对手无法看历史记录", 
        talent_mis: "误导", td_mis: "放大镜50%给假情报",
        talent_ban: "禁忌", td_ban: "随机禁用2种道具", 
        talent_quick: "快枪手", td_quick: "本轮不用道具则增伤",
        talent_boom: "自爆", td_boom: "自伤空弹对敌造成伤害",

        // --- 黑暗契约 (pact_) ---
        pact_flesh: "血肉筹码", pd_flesh: "最大HP-2。对自己空弹获护盾。",
        pact_half: "半条命赌徒", pd_half: "HP上限锁定3。实弹伤害+1。",
        pact_eerie: "诡异弹仓", pd_eerie: "每轮开始随机反转一发子弹。",
        pact_echo: "回声子弹", pd_echo: "实弹 25% 概率返回弹仓。",
        pact_eye: "欺诈之眼", pd_eye: "道具 50% 假失效，成功则翻倍。",
        pact_acute: "急性死亡", pd_acute: "若回合未造成伤害 扣1生命。",
        pact_strict: "不容失误", pd_strict: "对敌开空弹跳过下回合。",
        pact_greed: "脆弱的贪婪", pd_greed: "最大HP-1。任意空弹得道具。",
        pact_power: "混乱力量", pd_power: "实弹伤害+1。任意空弹洗牌。",

        // --- 评价与 UI ---
        eval_perfect: "“外科手术般的精准。”", eval_clutch: "“死神刚才对你眨眼了。”",
        eval_lucky: "“纯粹的狗屎运。”", eval_brutal: "“你是个疯子。”",
        eval_sad: "“可怜的灵魂。”", eval_greedy: "“贪婪杀死了猫，和你。”",
        s_resume: "▶ 继续游戏", s_menu: "🏠 主菜单", s_giveup: "🏳️ 放弃", s_sound: "音效",
        toast_gain: "获得道具", toast_gain_p2: "对手获得", 
        
        // --- 成就文本 (ach_) ---
        ach_1: "第一滴血", ad_1:"在游戏中存活。", 
        ach_2: "老烟枪", ad_2:"使用香烟。", ach_3: "赌命之徒", ad_3:"对自己开空枪。",
        ach_4: "连胜", ad_4:"???", ach_5: "侦探", ad_5:"使用3次放大镜。",
        ach_6: "生死一线", ad_6:"以1点生命值获胜。", ach_7: "扭曲行者", ad_7:"在扭曲模式获胜。",
        ach_8: "屠夫猎手", ad_8:"击败屠夫。", ach_9: "战术大师", ad_9:"击败战术家或使用干扰器。",
        ach_10: "毫发无伤", ad_10:"满血获胜。", ach_11: "庸医", ad_11:"击败瘟医。",
        ach_12: "庄家通吃", ad_12:"击败赌徒。", ach_13: "酒鬼", ad_13:"单局喝掉3瓶啤酒。",
        ach_14: "???", ad_14:"???", ach_15: "以彼之道", ad_15:"使用魔镜。",
        ach_16: "死里逃生", ad_16:"保险栓挡下一次死亡。", ach_17: "作弊者", ad_17:"使用预装弹。",
        ach_18: "心理战", ad_18:"使用假动作。", ach_19: "契约者", ad_19:"在拥有契约时获胜。",
        ach_20: "盲人摸象", ad_20:"在迷雾事件中获胜。", ach_21: "自作自受", ad_21:"对自己开了一发实弹。",
        ach_22: "暴力美学", ad_22:"使用锯子。", ach_23: "禁锢", ad_23:"使用手铐。",
        ach_24: "颠倒黑白", ad_24:"使用逆转器。", ach_25: "信号屏蔽", ad_25:"使用干扰器。",
        ach_26: "囤积癖", ad_26:"持有超过6个道具。", ach_27: "过度杀伤", ad_27:"单发造成3点以上伤害并击杀。",
        ach_28: "疯子", ad_28:"在1点生命值时对自己开枪。", ach_29: "血祭", ad_29:"在血祭事件中获胜。",
        ach_30: "资深玩家", ad_30:"到达第3关。",
        
        // --- 新增 UI 文本 ---
        subtitle_fix: "俄罗斯轮盘更新", title_talent: "选择天赋", title_pact: "黑暗契约", 
        pact_desc: "高风险，高回报。", btn_nodeal: "拒绝契约", setting_paused: "暂停",
        boss_unknown: "未知",
        rr_trigger: "🎲 俄罗斯轮盘模式！", rr_desc: "1 实弹 5 空弹。轮流对自己开枪。生死有命。",
        btn_pull: "扣动扳机"
    },
    // 英文翻译 (en) 结构与 zh 完全一致，此处省略注释
    en: {
        pve_btn: "💀 Campaign", pvp_btn: "⚔️ Versus", restart_btn: "🏠 MAIN MENU",
        btn_continue: "▶ CONTINUE", label_demon: "DEMON", label_p2: "P2", label_you: "YOU", label_p1: "P1",
        wait: "Waiting...", ready: "Ready...", reload: "Reloaded",
        shot_live: "💥 LIVE! {shooter} deals {dmg} dmg", shot_blank: "💨 BLANK. {shooter} safe.",
        shot_blank_miss: "💨 BLANK. Missed.", safe_bet: "Safe!", deal_success: "😈 DEAL MET!", deal_fail: "💀 DEAL FAILED!",
        item_jammed: "🚫 {item} JAMMED!", 
        mirror_steal: "🔮 Mirror stole {item} effect!",
        tact_block: "🚫 Tactician blocked {item}!",
        ammo_fmt: "[ {live} LIVE | {blank} BLANK ]",
        resurrect: "✨ {name} consumed a life to resurrect!",
        btn_self: "SHOOT SELF", btn_enemy: "SHOOT ENEMY", sub_self: "Gamble", sub_enemy: "Deal Dmg",
        twist_on: "☣ TWISTED (ON)", twist_off: "☣ TWISTED (OFF)",
        i_magnifier: "Magnifier", d_magnifier: "Check round.", i_beer: "Beer", d_beer: "Eject round.",
        i_saw: "Hand Saw", d_saw: "2x Damage.", i_smoke: "Cigarettes", d_smoke: "Heal 1 HP.",
        i_cuffs: "Handcuffs", d_cuffs: "Skip turn.", i_inverter: "Inverter", d_inverter: "Invert round.",
        i_jammer: "Jammer", d_jammer: "Block item.", i_mirror: "Mirror", d_mirror: "Steal buff.",
        i_preload: "Preload", d_preload: "Insert Live round at bottom.", i_feint: "Feint", d_feint: "Next item is fake.",
        i_safety: "Safety", d_safety: "Prevent suicide death once.",
        i_hourglass: "Hourglass", d_hourglass: "Move round.", i_visor: "Deceptive Visor", d_visor: "Fake clues.",
        i_delay_shell: "Delayed Round", d_delay_shell: "Late Dmg.", i_death_chip: "Death Chip", d_death_chip: "Mutual destruction.",
        i_adrenaline: "Adrenaline", d_adrenaline: "Act again, hurt later.", i_phone: "Phone", d_phone: "Check future.",
        mech_dud: "💨 DUD! Wet powder.", mech_jam: "🔥 JAMMED! Overheated.", mech_mutual: "⚖️ MUTUAL DESTRUCTION!",
        win_draw: "DRAW", win_draw_desc: "No survivors.",
        b_butcher: "Butcher", p_butcher: "Passive: +1 DMG", b_gambler: "Gambler", p_gambler: "Passive: Rigged",
        b_doctor: "Doctor", p_doctor: "Passive: Regen", b_tactician: "Tactician", p_tactician: "Passive: Jam",
        b_player2: "P2", p_player2: "Fair Play",
        enrage_title: "⚠ ENRAGE", enrage_butcher: "DMG+2 | Saw", enrage_gambler: "Steal | Shuffle",
        enrage_doctor: "Heal +2 HP", enrage_tactician: "Lock | Cuffs",
        e_normal: "Calm", ed_normal: "No special rules", e_overheat: "Overheat", ed_overheat: "Live shots increase DMG",
        e_blood: "Blood Debt", ed_blood: "Self-shot: 2x DMG, No Turn Retention", e_shuffle: "Shuffle", ed_shuffle: "Chamber shuffled twice",
        e_vision: "Holo-Sight", ed_vision: "25% chance to reveal round",
        e_fog: "Fog", ed_fog: "History & Colors hidden", e_fair: "Fair Play", ed_fair: "No consecutive turns",
        e_volatile: "Volatile Ammo", ed_volatile: "30% chance Blank becomes Live", e_sacrifice: "Sacrifice", ed_sacrifice: "Use Item costs 1 HP",
        buff_heal: "Medkit", bd_heal: "Heal to Full", buff_hp: "Armor", bd_hp: "Max HP +1",
        buff_box: "Ammo Box", bd_box: "4 Items", buff_tech: "High-Tech", bd_tech: "Jammer + Mirror",
        talent_eye: "Eagle Eye", td_eye: "30% Reveal 1st Round", talent_pack: "Hoarder", td_pack: "Start +1 Item",
        talent_luck: "Saint", td_luck: "Guaranteed Turn Keep",
        talent_pain: "Adaptation", td_pain: "Self Live Dmg -1", talent_alarm: "False Alarm", td_alarm: "Self Blank boosts next Live",
        talent_poker: "Poker Face", td_poker: "Hide history", talent_mis: "Mislead", td_mis: "50% Fake Magnifier",
        talent_ban: "Embargo", td_ban: "Randomly ban 2 items", talent_quick: "Quick Draw", td_quick: "No item use = Dmg +1",
        talent_boom: "Self-Destruct", td_boom: "Self Blank deals Dmg to enemy",
        pact_flesh: "Flesh Chips", pd_flesh: "Max HP -2. Shield.", pact_half: "Half-Life", pd_half: "HP capped at 3.",
        pact_eerie: "Eerie Mag", pd_eerie: "Flip 1 bullet.", pact_echo: "Echo Bullets", pd_echo: "Return Live.",
        pact_eye: "Deceptive Eye", pd_eye: "Items 50% fake.", pact_acute: "Acute Death", pd_acute: "No Dmg = -1 HP.",
        pact_strict: "No Mistakes", pd_strict: "Miss = Skip.", pact_greed: "Greed", pd_greed: "-1 Max HP. Item on Blank.",
        pact_power: "Chaos Power", pd_power: "+1 Dmg. Shuffle on Blank.",
        eval_perfect: "“Surgical precision.”", eval_clutch: "“Death just blinked.”",
        eval_lucky: "“Pure dumb luck.”", eval_brutal: "“You are a maniac.”",
        eval_sad: "“Poor soul.”", eval_greedy: "“Greed killed you.”",
        win_died: "YOU DIED", win_vic: "VICTORY", win_kill: "Killed by {name}", win_reward: "Defeated {name}. Reward:",
        s_resume: "▶ RESUME", s_menu: "🏠 MAIN MENU", s_giveup: "🏳️ GIVE UP", s_sound: "Sound Effects",
        toast_gain: "ITEM ACQUIRED", toast_gain_p2: "ENEMY GAINED",
        ach_1: "First Blood", ad_1:"Survive the game.",
        ach_2: "Smoker", ad_2:"Use Cigarettes.", ach_3: "Risk Taker", ad_3:"Shoot self with blank.",
        ach_4: "Streak", ad_4:"???", ach_5: "Detective", ad_5:"Use Magnifier 3 times.",
        ach_6: "Clutch", ad_6:"Win with 1 HP.", ach_7: "Twisted", ad_7:"Win Twisted Mode.",
        ach_8: "Butcher Bane", ad_8:"Defeat Butcher.", ach_9: "Strategist", ad_9:"Defeat Tactician or Jam.",
        ach_10: "Flawless", ad_10:"Win with full HP.", ach_11: "Anti-Vax", ad_11:"Defeat Doctor.",
        ach_12: "House Wins", ad_12:"Defeat Gambler.", ach_13: "Alcoholic", ad_13:"Drink 3 Beers.",
        ach_14: "???", ad_14:"???", ach_15: "Reflection", ad_15:"Use Mirror.",
        ach_16: "Safe", ad_16:"Safety prevented death.", ach_17: "Cheater", ad_17:"Use Preload.",
        ach_18: "Mind Games", ad_18:"Use Feint.", ach_19: "Deal Maker", ad_19:"Win with a Pact.",
        ach_20: "Blind", ad_20:"Win in Fog.", ach_21: "Oops", ad_21:"Shot self with Live.",
        ach_22: "Brutal", ad_22:"Use Saw.", ach_23: "Lockdown", ad_23:"Use Cuffs.",
        ach_24: "Inverted", ad_24:"Use Inverter.", ach_25: "Jammed", ad_25:"Use Jammer.",
        ach_26: "Hoarder", ad_26:"Hold 6+ items.", ach_27: "Overkill", ad_27:"Deal 3+ DMG and kill.",
        ach_28: "Madman", ad_28:"Shoot self at 1 HP.", ach_29: "Sacrifice", ad_29:"Win Sacrifice event.",
        ach_30: "Veteran", ad_30:"Reach Level 3.",
        subtitle_fix: "Roulette Update", title_talent: "CHOOSE TALENT", title_pact: "DARK PACT", 
        pact_desc: "High Risk, High Reward.", btn_nodeal: "NO DEAL", setting_paused: "PAUSED",
        boss_unknown: "UNKNOWN",
        rr_trigger: "🎲 RUSSIAN ROULETTE!", rr_desc: "1 Live, 5 Blank. Pull trigger on self. Last one standing wins.",
        btn_pull: "PULL TRIGGER"
    }
};

// 4. Boss 嘲讽台词库
// 根据不同情况 (miss=对手空弹, hit=被击中, win=Boss胜利, taunt=普通嘲讽) 随机播放
const BOSS_TAUNTS = {
    butcher: { miss: ["Too weak.", "Is that it?", "Pathetic."], hit: ["I bleed...", "Again!", "Harder."], win: ["Next time.", "You got lucky."], taunt: ["I smell fear.", "Shoot. Now."] },
    gambler: { miss: ["Bad luck?", "House wins.", "Did you count?"], hit: ["A lucky guess.", "Hey, watch the suit!"], win: ["I want a rematch.", "You cheated."], taunt: ["Feeling lucky?", "Odds are against you."] },
    doctor: { miss: ["Missed diagnosis.", "Steady your hand.", "Pulse rising."], hit: ["Critical condition.", "I need a medic."], win: ["Flatline.", "Procedure failed."], taunt: ["This will hurt.", "Open wide."] },
    tactician: { miss: ["Calculated.", "Predicted.", "Waste of ammo."], hit: ["Error in judgment.", "Adjusting..."], win: ["Impossible.", "Data corrupted."], taunt: ["Checkmate soon.", "Your move."] },
    player2: { miss: ["LOL", ":)"], hit: ["Ouch", ":("], win: ["GG", "EZ"], taunt: ["..."] }
};

// 5. 事件 ID 列表
const EVENTS = [
    { id: 'normal'}, { id: 'overheat'}, { id: 'blood'}, { id: 'shuffle'}, { id: 'vision'},
    { id: 'fog'}, { id: 'fair'}, { id: 'volatile'}, { id: 'sacrifice'}
];

// 6. 恶魔 (Boss) 原型数据
// style: 影响 AI 逻辑 (engine.js 中目前主要是随机，后续可扩展不同策略)
// loadout: Boss 初始携带的道具
const DEMON_ARCHETYPES = [
    { id: 'butcher', style: 'aggressive', loadout: { saw: 2, beer: 1, mirror: 1 }, phase2: false },
    { id: 'gambler', style: 'chaotic', loadout: { inverter: 2, magnifier: 1, jammer: 1 }, phase2: false },
    { id: 'doctor', style: 'defensive', loadout: { smoke: 2, cuffs: 1, mirror: 1 }, phase2: false },
    { id: 'tactician', style: 'standard', loadout: { jammer: 2, mirror: 1 }, phase2: false }
];

// 7. 玩家开局天赋列表
const TALENTS = [
    { id: 'eye', key: 'talent_eye', desc: 'td_eye', icon: '👁️' },
    { id: 'pack', key: 'talent_pack', desc: 'td_pack', icon: '🎒' },
    { id: 'luck', key: 'talent_luck', desc: 'td_luck', icon: '🎲' },
    { id: 'pain', key: 'talent_pain', desc: 'td_pain', icon: '🔥' },
    { id: 'alarm', key: 'talent_alarm', desc: 'td_alarm', icon: '🎭' },
    { id: 'poker', key: 'talent_poker', desc: 'td_poker', icon: '🃏' },
    { id: 'mis', key: 'talent_mis', desc: 'td_mis', icon: '👁️‍🗨️' },
    { id: 'ban', key: 'talent_ban', desc: 'td_ban', icon: '🚫' },
    { id: 'quick', key: 'talent_quick', desc: 'td_quick', icon: '⛓️' },
    { id: 'boom', key: 'talent_boom', desc: 'td_boom', icon: '💥' }
];

// 8. 黑暗契约列表 (高难度修饰符)
const PACTS = [
    { id: 'greed', key: 'pact_greed', desc: 'pd_greed', icon: '💰' },
    { id: 'power', key: 'pact_power', desc: 'pd_power', icon: '🌩️' },
    { id: 'flesh', key: 'pact_flesh', desc: 'pd_flesh', icon: '🩸' },
    { id: 'half', key: 'pact_half', desc: 'pd_half', icon: '☠️' },
    { id: 'eerie', key: 'pact_eerie', desc: 'pd_eerie', icon: '🔫' },
    { id: 'echo', key: 'pact_echo', desc: 'pd_echo', icon: '🔄' },
    { id: 'eye', key: 'pact_eye', desc: 'pd_eye', icon: '👁️' },
    { id: 'acute', key: 'pact_acute', desc: 'pd_acute', icon: '⌛' },
    { id: 'strict', key: 'pact_strict', desc: 'pd_strict', icon: '⚖️' }
];

// 9. 获胜奖励池 (PvE 模式每关结束后选择)
const buffPool = [
    { id: 'heal', key: 'buff_heal', descKey: 'bd_heal' }, // 回满血
    { id: 'hp_up', key: 'buff_hp', descKey: 'bd_hp' },    // 加血上限
    { id: 'supplies', key: 'buff_box', descKey: 'bd_box' },// 拿4个道具
    { id: 'tech', key: 'buff_tech', descKey: 'bd_tech' }  // 拿高级道具
];

// 10. 生成成就列表 (1-30)
const ACHIEVEMENTS = [];
for(let i=1; i<=30; i++) ACHIEVEMENTS.push({ id: i, key: `ach_${i}` });