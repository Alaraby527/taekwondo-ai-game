# 跆拳道 · AI 对战（抖音校园 WowLand）

上海理工大学跆拳道社 × 抖音校园联合活动引导页 + 单人小游戏。

**一句话卖点**：操控小人，挑战会攻防、会闪避的 AI 跆拳道高手。三局两胜 KO 制，从白带到黑带逐个晋级 —— 让同学在打斗中同时感受 **AI 的魅力** 和 **跆拳道的魅力**，最后引导关注抖音校园官方号。

---

## 功能一览

| 模块 | 说明 |
|---|---|
| 引导页 | 活动介绍、三大福利（AI 对手/易上手/段位晋级）、操作说明、抖音官方号二维码 |
| 游戏 | 单文件 Canvas 对战：玩家 vs AI，键盘/触屏双操控 |
| AI 对手 | 5 个段位（白/黄/蓝/红/黑带），难度递增，会追击、出拳/踢腿、格挡、闪避 |
| 对战规则 | 三局两胜 KO：一回合先 KO 对方者得 1 分，先得 2 分者胜 |
| 音效 | Web Audio 实时合成（出拳/踢腿/命中/格挡/KO/胜负音），零素材零版权问题 |
| 结束面板 | 胜/负结算 + 段位晋级/重赛 + 二维码二次曝光 |

## 目录结构

```
taekwondo-ai-game/
├── index.html   # 全部代码（引导页 + 游戏 + AI + 音效），无任何外部依赖
└── README.md
```

> 纯前端、零后端、零依赖，任何静态托管都能跑。二维码用占位框，**替换成你的官方二维码图片即可**（见下）。

## 本机预览

```bash
cd taekwondo-ai-game
python3 -m http.server 8777
# 浏览器打开 http://localhost:8777
```

## 替换二维码（上线前必做）

页面共有 **两处二维码区**（引导页 + 游戏结束面板），每处各含 **两个二维码**：抖音校园官方号 + 跆拳道社。上线前把占位框替换成真实二维码图片：

1. 准备两张二维码图片放到同目录（建议白底、正方形、边长 500px 以上）：
   - `douyin-qrcode.png` —— 抖音校园官方号
   - `tkd-qrcode.png` —— 跆拳道社
2. 打开 `index.html`，找到 **四处** 注释（引导页 2 处 + 结束面板 2 处）：

```html
<!-- 替换为抖音校园官方二维码图片：<img src="douyin-qrcode.png" alt="抖音校园官方号二维码"> -->
<!-- 替换为跆拳道社二维码图片：<img src="tkd-qrcode.png" alt="跆拳道社二维码"> -->
```

3. 把每个注释替换成对应的 `<img>` 标签（引导页和结束面板各 2 处）：

```html
<img src="douyin-qrcode.png" alt="抖音校园官方号二维码">
<img src="tkd-qrcode.png" alt="跆拳道社二维码">
```

4. 刷新页面确认引导页和胜利/失败面板都显示两个二维码。

## 游戏操作

| 平台 | 操作 |
|---|---|
| 电脑键盘 | `A`/`D` 左右移动 · `J` 出拳 · `K` 踢腿 · `L` 格挡（按住） |
| 手机/平板 | 屏幕左下 ◀ ▶ 移动 · 右下 🦵 踢 🛡 挡 |

**小技巧**：格挡能完全挡下对手攻击（不扣血）；AI 出手有前摇，看准时机反击。段位越高 AI 越会预判格挡和闪避，先练白带、再冲黑带。

## 部署成可分享链接（GitHub Pages，免费）

### 方式一：命令行（推荐，需 gh CLI）

```bash
cd taekwondo-ai-game
gh repo create taekwondo-ai-game --public --source=. --push
gh api -X POST repos/Alaraby527/taekwondo-ai-game/pages \
  -f "source[branch]=main" -f "source[path]=/"
```

几分钟后访问：`https://alaraby527.github.io/taekwondo-ai-game/`

### 方式二：网页手动操作

1. 在 [github.com/new](https://github.com/new) 新建公开仓库，把本目录代码推上去。
2. 仓库 Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main` → 目录 `/` → Save。
3. 等 1–2 分钟，`https://<你的用户名>.github.io/<仓库名>/` 即可访问。

## 自定义调整（可选）

打开 `index.html`，顶部 `RANKS` 数组可调每个段位的 AI：

```js
{ name:'白带', color:'#e8eefc', ai:0.32, speed:0.9, hp:90, tag:'新手 AI' }
```

- `ai`：AI 智能度（0~1，越高越会攻防/闪避/预判格挡）
- `speed`：移动速度倍率
- `hp`：每回合血量
- `name` / `color` / `tag`：段位名称、腰带颜色、简介

玩家/AI 攻击力在 `player` / `ai` 构造处调整（`attack`、`kickP` 出腿概率）。改完刷新即可。

## 已知事项

- 音效需用户与页面交互后（点击"开始挑战"）才会初始化，符合浏览器自动播放策略。
- 手机端建议竖屏使用；触屏按钮仅在触屏设备显示。
- 部署后若微信内打开，长按二维码即可识别（前提：二维码图片已替换）。
