# Jev 战术代理

给「跆拳道 · AI 对战」的 **AI 对手**提供战术决策层。密钥只存在服务端，前端永远拿不到。

## 为什么要分两层 AI

格斗游戏 60fps 需要每 **16ms** 决策一次，而 Jev 实测 **236~698ms/次**，做不到逐帧。所以：

| 层 | 位置 | 职责 | 频率 |
|---|---|---|---|
| **战术层** | 本服务（调 Jev） | 决定「打什么战术」：突进 / 游走 / 反击 / 防守 / 假动作；预判「对手是否即将出腿」 | 每 **1.4 秒**一次（约 20~40 次/局） |
| **反射层** | 游戏前端 `js/ai.js` | 执行：移动、出招时机、前后摇、命中判定、格挡 | 每帧 |

关键约束：**反射层就是降级方案**。前端在没网 / 本服务不可用 / 超预算 / 超时的情况下会静默退回纯本地 AI，**游戏永远能玩**——本地 AI 本来就是独立完整的。

Jev 的返回是**完整概率分布**（不只是一个选择），前端把它当作**行为混合权重**而不是硬切换，动作因此更平滑。注意实测 `confidence` 往往只有 0.28~0.49，所以**不要拿 confidence 当降级开关**。

## 接口

### `POST /decide`

请求（前端视角是「AI 我方 / 玩家对手」）：

```json
{
  "fightId": "fmuh9f2944x6k",
  "rank": "蓝带", "style": "激进压迫",
  "dist": 180,
  "hp": 62, "foeHp": 81,
  "scoreMine": 3, "scoreFoe": 5,
  "timeLeft": 22,
  "foeRecent": ["kick", "kick", "punch"],
  "foeDefend": 0.18,
  "myKnocked": 1, "foeKnocked": 0,
  "round": 1, "needWins": 3
}
```

响应（**始终 HTTP 200**，靠 `src` 区分来源，前端逻辑因此很简单）：

```json
{
  "src": "jev",
  "tactic": "rush",
  "tactics": { "rush": 0.43, "counter": 0.30, "defend": 0.15, "feint": 0.08, "probe": 0.04 },
  "confidence": 0.28,
  "foeKick": 0.59,
  "ms": 236
}
```

`src` 取值：

| src | 含义 | 前端行为 |
|---|---|---|
| `jev` | 真实调用成功 | 采用战术 |
| `cache` | 命中局面缓存（同局面已问过） | 采用战术 |
| `degraded` | 未就绪 / 超时 / 异常 / 超预算 | 退回纯本地 AI |

### `GET /health`

```json
{ "ok": true, "ready": true, "calls": 37, "cache": 12,
  "budgetPerFight": 40, "day": {"day":"2026-09-25","used":37}, "maxCallsPerDay": 3000,
  "allowedOrigins": "any", "lastError": null, "tactics": ["rush","probe","counter","defend","feint"] }
```

### `GET /`（可选）

`SERVE_SITE=1` 时本服务同时把游戏静态文件同源托管在 `/`。这样前端与 `/decide` **同源**，既无 CORS 也不会触发 mixed content 拦截，摊位只需要一个地址、一个端口。

## 部署

```bash
# 1) 放密钥（.env 已被 .gitignore 忽略，不要提交）
cp /vol1/1000/docker/opencode-v2/workspaces/taekwondo-ai-game/server/jev-proxy/.env.example \
   /vol1/1000/docker/opencode-v2/workspaces/taekwondo-ai-game/server/jev-proxy/.env
vi /vol1/1000/docker/opencode-v2/workspaces/taekwondo-ai-game/server/jev-proxy/.env   # 填 JEV_API_KEY

# 2) 起容器
cd /vol1/1000/docker/opencode-v2/workspaces/taekwondo-ai-game/server/jev-proxy
/cli/docker compose -f compose.yml -p taekwondo-jev up -d --build

# 3) 自检
/cli/docker exec second-eye python -c "import urllib.request,json;print(json.load(urllib.request.urlopen('http://192.168.5.21:15810/health')))"
```

> `compose.yml` 里的 `build.context` / `volumes` / `env_file` 都由**宿主机 Docker daemon** 解析，因此必须是宿主机绝对路径 `/vol1/...`；容器内的 `/nas/vol1/...` 在这里无效。

## 配置项

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `JEV_API_KEY` | — | **必填**，TypeSafe Jev 密钥 |
| `PORT` | `15810` | 监听端口 |
| `JEV_TIMEOUT` | `6` | 单次调用超时（秒） |
| `JEV_MODEL` | 空 | 可选，指定模型 |
| `BUDGET_PER_FIGHT` | `40` | **每局**调用上限，超了返回 `degraded` |
| `MAX_CALLS_PER_DAY` | `3000` | **全局每日**调用上限（成本硬闸门，公开域名必备） |
| `CACHE_SIZE` | `512` | 局面缓存条数（状态量化后命中） |
| `ALLOWED_ORIGINS` | 空 | 逗号分隔的来源白名单；留空＝不限。公开部署建议填上页面域名 |
| `ALLOW_ORIGIN` | `*` | CORS 响应头值 |
| `SERVE_SITE` / `SITE_DIR` | `1` / `/site` | 是否同源托管游戏静态文件及目录 |

## 成本控制（重要）

若每 250ms 调一次，90 秒一局 = **360 次调用**，摊位一天几百人玩会非常贵。本服务用四层闸门压下来：

1. **决策降频**：前端每 1.4 秒才问一次 → 约 **20~40 次/局**
2. **局面缓存**：状态量化（距离 40 单位、血量 20%、得分 2 分、时间 8 秒…）后命中同一条
3. **每局预算** `BUDGET_PER_FIGHT`：默认 40 次，超了立刻降级
4. **每日上限** `MAX_CALLS_PER_DAY`：默认 3000 次，公开部署的硬止损

## 性能：连接复用是关键

实测同一台机器上调用 Jev：

| 场景 | 耗时 |
|---|---|
| 新建客户端后的第一次（冷启动，含 DNS + TLS 握手） | **约 1300ms** |
| 复用常驻客户端的后续调用 | **约 236~250ms** |
| 走 3755 代理 | **不更快**（稳定态同为约 250ms，差异在噪声范围） |

所以本服务**进程内常驻一个 `TypeSafeClient`**，并串行化调用。这比"换代理线路"重要 5 倍。

## 前端接入

前端地址解析顺序（`js/jev.js`）：

1. `?jev=https://...`（联调用，便于临时切换）
2. `<meta name="jev-base" content="https://...">`（**反代配好后填这里**）
3. 同源（默认）

反代有两种接法：

- **同域名同源**（推荐）：把 `/` 指到本服务，页面与 `/decide` 同源 → 无需 CORS
- **独立域名**：本服务已带 CORS 响应头与 `OPTIONS` 预检支持；此时建议设置 `ALLOWED_ORIGINS` 为页面域名

> 注意：如果游戏页面是 **HTTPS** 而代理是 **HTTP**，浏览器会按 mixed content 直接拦截。反代是 HTTPS 就没有这个问题；如果是 HTTP 代理，请让本服务用 `SERVE_SITE=1` 同源托管页面，或给代理也套上 HTTPS。
