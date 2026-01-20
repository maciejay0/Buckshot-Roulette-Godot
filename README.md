# 🔫 Buckshot Reborn - Web Edition

> **"High Risk, High Reward."**
>
> A web-based strategic reconstruction of the cult classic "Buckshot Roulette", expanded with Roguelite elements, unique boss mechanics, and multiplayer support.

## 📖 简介 (Introduction)

**Buckshot Reborn** 是对《Buckshot Roulette》核心玩法的深度重构与扩展。本项目不再局限于单纯的“记牌与概率计算”，而是引入了 **Roguelite (肉鸽)** 元素、角色构建（Build）以及动态环境系统。

游戏使用原生 **HTML/CSS/JavaScript** 开发，实现了伪 3D 视差效果，无需下载引擎，浏览器即可流畅运行。

## ✨ 核心差异与特色 (Key Features)

与原版游戏相比，本版本增加了极大的策略深度：

### 1. Roguelite 角色构建
不再是白板开局！玩家在每一局开始前可以定制策略：
* **天赋系统 (Talents):** 选择“鹰眼”（开局看牌）、“快枪手”（不用道具增伤）等被动技能。
* **黑暗契约 (Dark Pacts):** *高风险高回报*。例如“半条命赌徒”（血量上限锁定为3，但伤害+1）。
* **初始物资 (Supply Drop):** 自选开局携带的 2 件道具。

### 2. 多样化的 Boss 机制
除了经典的庄家，增加了 4 种具有独立 AI 行为和被动技能的 Boss：
* **🩸 屠夫 (The Butcher):** 拥有厚实脂肪（单次受击伤害上限锁定为2），风格激进。
* **🃏 赌徒 (The Gambler):** 每回合大概率偷取你的道具，死亡时会触发“死亡骰宝”小游戏。
* **🦠 瘟医 (The Doctor):** 实弹附带“延时毒素”，并能自我治疗。
* **🧠 战术家 (The Tactician):** 会封锁你的道具，并能干扰你的侦查设备（放大镜显示假情报）。

### 3. 动态环境事件 (Events)
每轮游戏都会随机触发一种环境状态，改变底层规则：
* **🌫️ 浓雾 (The Mist):** 隐藏历史记录板，无法记牌。
* **🌑 血月 (Blood Moon):** 治疗物品（香烟、过期药）失效。
* **⚡ 静电 (Static):** 开火有 25% 概率触发连射且不消耗回合。

### 4. 扩展道具池 (Item Expansion)
新增至 18 种道具，不仅是辅助，更是博弈工具：
* **🔮 魔镜:** 窃取对手的一个道具效果。
* **💊 过期药:** 50% 回血，50% 扣血。
* **🔗 干扰器:** 让对手的下一个道具失效。
* **⚰️ 临终筹码:** 如果本回合死亡，对敌人造成反噬伤害（同归于尽）。

### 5. 多种游戏模式
* **PvE 战役:** 闯关模式，挑战随机 Boss。
* **PvP 对战:** 本地双人同屏博弈（包含特有的“假动作”和“假视镜”心理战道具）。
* **俄罗斯轮盘模式:** 1HP，1实弹5空弹，纯粹的运气对决。

## 🛠️ 技术栈 (Tech Stack)

* **Core:** Vanilla JavaScript (ES6+)
* **UI:** HTML5 + CSS3 (Flexbox/Grid)
* **Visuals:** CSS3 Transforms (用于实现枪支和背景的视差伪 3D 效果)
* **Audio:** Native Web Audio API

## 🚀 如何运行 (How to Run)

本项目无需复杂的构建工具（如 Webpack/Vite），开箱即用：

1.  克隆仓库：
    ```bash
    git clone [https://github.com/your-username/buckshot-reborn.git](https://github.com/your-username/buckshot-reborn.git)
    ```
2.  直接在浏览器中打开 `index.html`。
3.  (可选) 使用 VS Code 的 "Live Server" 插件运行以获得更好的体验。

## 💡 设计思路与构想 (Design Philosophy)

### 为什么要做这个重制版？
原版游戏非常出色，但其核心体验偏向于一次性的惊悚体验。我想通过 **Web 化的轻量级重构**，探索这个玩法的策略上限。

### 1. 从“运气”到“风险管理”
原版中，如果你运气不好（空弹连发），你几乎无法翻盘。
在 **Reborn** 中，我引入了 **Token 系统（天赋与契约）**。例如，如果你选择了“痛觉适应”天赋，你可以故意对自己开枪来积攒优势；或者利用“过期药”进行极限翻盘。这让游戏从单纯的“赌命”变成了“资源管理”。

### 2. 信息博弈 (Information Warfare)
在 PvP 模式和对战“战术家”Boss 时，我引入了**信息干扰**的概念。
* 原版：放大镜 = 绝对真理。
* Reborn：引入了“干扰器”、“假动作”和“战术家被动”。你看到的“实弹”可能是假的，这增加了心理博弈的层级。

### 3. 代码架构 (Engine & State)
为了支持复杂的道具交互，重写了状态机：
* **Turn-Based Logic:** 严格的回合制状态管理，支持“跳过回合”、“额外回合”、“伤害延迟结算”等复杂逻辑。
* **Modular Items:** 道具系统被设计为模块化，可以轻松添加新道具（只需在 `constants.js` 添加配置并在 `engine.js` 添加逻辑）。

---

*Based on the game "Buckshot Roulette" by Mike Klubnika.*
