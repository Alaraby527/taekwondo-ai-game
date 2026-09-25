#!/usr/bin/env python3
"""Jev 战术代理 —— 为「跆拳道 · AI 对战」提供 AI 对手的「战术层」决策。

为什么需要这一层
  格斗游戏 60fps 需要每 16ms 决策，Jev 实测约 236~698ms/次，做不到逐帧。
  所以 AI 分成两层：
    · 战术层（本服务）  ：每 1~2 秒决定「打什么战术」（突进/游走/反击/防守/假动作）
    · 反射层（游戏前端）：每帧执行（移动、出招时机、前后摇、命中判定）—— 已有本地实现
  没有本服务或本服务不可用时，前端自动退回纯本地 AI，游戏永远能玩。

设计要点
  · 密钥只存在于服务端（环境变量 JEV_API_KEY），前端永远拿不到
  · 进程内常驻一个 TypeSafeClient 复用 HTTPS 长连接
    （实测 冷启动 ~1300ms vs 复用 ~236ms，差 5 倍，这是本服务最重要的优化）
  · 状态量化后做缓存：同一局面直接命中，既降延迟又降成本
  · 每局调用预算（默认 40 次）：超预算返回 degraded，前端退回本地 AI —— 成本可控
  · 任何超时/异常都返回 200 + src=degraded，前端逻辑保持简单且永不阻塞
"""

import json
import os
import threading
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---------------------------------------------------------------- 配置
PORT = int(os.environ.get("PORT", "15810"))
JEV_API_KEY = os.environ.get("JEV_API_KEY", "")
JEV_TIMEOUT = float(os.environ.get("JEV_TIMEOUT", "6"))      # 单次调用超时（秒）
JEV_MODEL = os.environ.get("JEV_MODEL") or None              # 可选：指定模型
CACHE_SIZE = int(os.environ.get("CACHE_SIZE", "512"))        # 局面缓存条数
BUDGET_PER_FIGHT = int(os.environ.get("BUDGET_PER_FIGHT", "120"))  # 每局「真实调用」上限
ALLOW_ORIGIN = os.environ.get("ALLOW_ORIGIN", "*")           # CORS 允许来源
LOG = os.environ.get("LOG_LEVEL", "info").lower() == "info"

# 公开部署（HTTPS 域名）时的成本保护
MAX_CALLS_PER_DAY = int(os.environ.get("MAX_CALLS_PER_DAY", "3000"))   # 全局每日调用上限
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

# 同源托管游戏静态文件：这样前端与 /decide 同源，
# 既没有 CORS 问题，也不会有「HTTPS 页面调用 HTTP 接口」的 mixed content 拦截。
SITE_DIR = os.environ.get("SITE_DIR", "/site")
SERVE_SITE = os.environ.get("SERVE_SITE", "1") == "1"

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".webp": "image/webp",
}

# 战术选项：key 供程序使用，描述供 Jev 判断
TACTICS = OrderedDict([
    ("rush",    "突进压制：主动逼近，用横踢/侧踢抢分"),
    ("probe",   "游走试探：保持中距离，小步进退，观察对手习惯"),
    ("counter", "后退反击：诱使对手先出招，用后踢/旋风踢反击"),
    ("defend",  "稳固防守：拉开距离，举拳格挡，等对手露出破绽"),
    ("feint",   "假动作诱敌：佯攻后收招，骗对手格挡或出腿再打空档"),
])

# ---------------------------------------------------------------- Jev 客户端（常驻 + 复用长连接）
_client = None
_client_lock = threading.Lock()
_ready = threading.Event()
_last_error = None
_call_count = 0
_cache = OrderedDict()          # 缓存：state_key -> response
_cache_lock = threading.Lock()
_budget = {}                    # fightId -> 已用次数
_budget_lock = threading.Lock()
_day = {"day": "", "used": 0}   # 全局每日用量（成本硬闸门）
_day_lock = threading.Lock()


def init_client():
    """启动时预热客户端（一次空跑不成，但建立连接池与 TLS）。"""
    global _client, _last_error
    if not JEV_API_KEY:
        _last_error = "JEV_API_KEY 未配置"
        return
    try:
        from typesafe_sdk import TypeSafeClient
        _client = TypeSafeClient(api_key=JEV_API_KEY, timeout=JEV_TIMEOUT, model=JEV_MODEL)
        _ready.set()
        log("TypeSafeClient 就绪（连接池常驻）")
    except Exception as exc:                      # noqa: BLE001
        _last_error = f"客户端初始化失败: {exc}"
        log(_last_error)


def log(msg):
    if LOG:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ---------------------------------------------------------------- 状态 → 提示词
def build_state_text(s):
    foe = "、".join(s.get("foeRecent") or []) or "无记录"
    defend = s.get("foeDefend")
    defend_txt = f"{round(defend * 100)}%" if isinstance(defend, (int, float)) else "未知"
    return (
        f"跆拳道对局战术状态：\n"
        f"对手段位={s.get('rank', '未知')}；双方距离={s.get('dist', '?')}（世界单位，越小越近）；\n"
        f"我方血量={s.get('hp', '?')}%；对手血量={s.get('foeHp', '?')}%；\n"
        f"本回合比分 我方={s.get('scoreMine', 0)} 对手={s.get('scoreFoe', 0)}；\n"
        f"本回合剩余={s.get('timeLeft', '?')}秒；第{s.get('round', 1)}回合，先赢{s.get('needWins', 3)}局者胜；\n"
        f"对手最近出招序列：{foe}；对手防守时长占比={defend_txt}；\n"
        f"我方被击倒={s.get('myKnocked', 0)}次，对手被击倒={s.get('foeKnocked', 0)}次。"
        + (f"\n我方 AI 风格倾向：{s['style']}。" if s.get("style") else "")
    )


def quantize(s):
    """把连续量量化，让相近局面命中同一条缓存。"""
    def q(v, step, default=0):
        try:
            return int(round(float(v) / step)) * step
        except (TypeError, ValueError):
            return default
    def b(v, step):
        try:
            return int(float(v) // step)
        except (TypeError, ValueError):
            return 0
    return (
        str(s.get("rank", "")),
        q(s.get("dist"), 40),
        b(s.get("hp"), 20), b(s.get("foeHp"), 20),
        q(s.get("scoreMine"), 2), q(s.get("scoreFoe"), 2),
        b(s.get("timeLeft"), 8),
        b(s.get("foeDefend"), 0.25),
        b(s.get("myKnocked"), 1), b(s.get("foeKnocked"), 1),
        ",".join((s.get("foeRecent") or [])[-3:]),
    )


# ---------------------------------------------------------------- 每局预算
def take_budget(fight_id):
    """本局是否还有预算 + 全局每日上限（成本硬闸门）。"""
    today = time.strftime("%Y-%m-%d")
    with _day_lock:
        if _day["day"] != today:
            _day["day"], _day["used"] = today, 0
        if _day["used"] >= MAX_CALLS_PER_DAY:
            return "daily"
    if not fight_id:
        return True
    with _budget_lock:
        used = _budget.get(fight_id, 0)
        if used >= BUDGET_PER_FIGHT:
            return "fight"
        _budget[fight_id] = used + 1
        if len(_budget) > 200:
            for k in list(_budget)[:100]:
                _budget.pop(k, None)
    with _day_lock:
        _day["used"] += 1
    return True


# ---------------------------------------------------------------- 真正调用 Jev
def call_jev(s):
    from typesafe_sdk import Choice, Noul
    questions = {
        "tactic": Choice(
            instructions=(
                "选择接下来 1~2 秒最合适的战术（只选一个）。"
                "注意：若我方血量明显低于对手、或所剩时间不多且已经领先，应偏向保守的战术。"
            ),
            criteria={k: v for k, v in TACTICS.items()},
        ),
        "foe_kick": Noul(instructions="对手是否即将出腿攻击？"),
    }
    resp = _client.system_one(state=build_state_text(s), questions=questions)
    t = resp.answers["tactic"]
    k = resp.answers["foe_kick"]
    return {
        "tactic": t.choice,
        "tactics": {kk: round(float(vv), 4) for kk, vv in (t.probabilities or {}).items()},
        "confidence": round(float(getattr(t, "confidence", 0.0)), 4),
        "foeKick": round(float(getattr(k, "noul", 0.0)), 4),
    }


def decide(s):
    """返回 (payload, source)。任何失败都不抛异常，交给前端降级。"""
    global _call_count, _last_error

    if not _ready.is_set():
        return {"src": "degraded", "reason": _last_error or "Jev 未就绪"}, "degraded"

    # 1) 先查缓存：命中零成本，因此【不消耗预算】、也不受闸门限制。
    #    （顺序很重要：若先扣预算，一场五局三胜约 214 次请求会在第一局就把预算耗光）
    key = quantize(s)
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return {"src": "cache", **_cache[key]}, "cache"

    # 2) 只有真正要调用 Jev 时，才消耗成本预算
    budget = take_budget(s.get("fightId"))
    if budget == "daily":
        return {"src": "degraded", "reason": f"已达每日调用上限({MAX_CALLS_PER_DAY})"}, "daily"
    if budget == "fight":
        return {"src": "degraded", "reason": f"本局调用预算已用尽({BUDGET_PER_FIGHT}次)"}, "budget"

    t0 = time.time()
    try:
        with _client_lock:                 # 单客户端串行化，避免连接池竞争
            out = call_jev(s)
    except Exception as exc:               # noqa: BLE001
        _last_error = f"{type(exc).__name__}: {exc}"
        log(f"调用失败（前端将降级）：{_last_error}")
        return {"src": "degraded", "reason": _last_error[:200]}, "error"

    ms = int((time.time() - t0) * 1000)
    _call_count += 1
    out["ms"] = ms
    with _cache_lock:
        _cache[key] = {k: v for k, v in out.items() if k != "ms"}
        _cache.move_to_end(key)
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    log(f"决定 tactic={out['tactic']}({out['confidence']:.2f}) foeKick={out['foeKick']:.2f} {ms}ms")
    return {"src": "jev", **out}, "jev"


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_bytes(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        # 204/304 按 RFC 不得带消息体，也不能带 Content-Length，
        # 否则浏览器会判为协议错误（表现为 ERR_EMPTY_RESPONSE，preflight 直接被拒）
        if code not in (204, 304):
            self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", ALLOW_ORIGIN)
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if code not in (204, 304):
            self.wfile.write(body)

    def _send(self, code, payload):
        self._send_bytes(code, json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                         "application/json; charset=utf-8")

    def _serve_site(self):
        """把游戏静态文件同源托管（含路径穿越防护）。"""
        path = self.path.split("?", 1)[0]
        if path in ("/", ""):
            path = "/index.html"
        rel = os.path.normpath(path).lstrip("/")
        if rel.startswith(".."):
            self._send(403, {"error": "forbidden"})
            return
        full = os.path.join(SITE_DIR, rel)
        if not os.path.isfile(full):
            self._send(404, {"error": f"not found: {path}"})
            return
        ext = os.path.splitext(full)[1].lower()
        try:
            with open(full, "rb") as fh:
                body = fh.read()
        except OSError as exc:
            self._send(500, {"error": str(exc)})
            return
        self._send_bytes(200, body, MIME.get(ext, "application/octet-stream"))

    def do_OPTIONS(self):                                   # noqa: N802
        self._send(204, {})

    def do_GET(self):                                       # noqa: N802
        if self.path.startswith("/health"):
            with _cache_lock:
                cache_n = len(_cache)
            self._send(200, {
                "ok": _ready.is_set(),
                "ready": _ready.is_set(),
                "calls": _call_count,
                "cache": cache_n,
                "budgetPerFight": BUDGET_PER_FIGHT,
                "day": {**_day},
                "maxCallsPerDay": MAX_CALLS_PER_DAY,
                "allowedOrigins": ALLOWED_ORIGINS or "any",
                "lastError": _last_error,
                "tactics": list(TACTICS),
                "site": SITE_DIR if SERVE_SITE else None,
            })
        elif SERVE_SITE and not self.path.startswith("/decide"):
            self._serve_site()
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):                                      # noqa: N802
        if not self.path.startswith("/decide"):
            self._send(404, {"error": "not found"})
            return
        # 来源白名单（可选）：公开部署时防止被第三方网页直接刷
        if ALLOWED_ORIGINS:
            origin = (self.headers.get("Origin") or "").rstrip("/")
            if origin not in ALLOWED_ORIGINS:
                log(f"拒绝来源: {origin!r}")
                self._send(403, {"error": "origin not allowed"})
                return
        try:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            state = json.loads(raw.decode("utf-8") or "{}")
        except Exception as exc:                            # noqa: BLE001
            self._send(400, {"error": f"bad json: {exc}"})
            return
        payload, _src = decide(state)
        self._send(200, payload)                            # 始终 200：降级也走正常响应

    def log_message(self, *args):                           # 静默默认访问日志
        pass


def main():
    init_client()
    log(f"Jev 战术代理监听 0.0.0.0:{PORT}（预算 {BUDGET_PER_FIGHT} 次/局，超时 {JEV_TIMEOUT}s）")
    if not JEV_API_KEY:
        log("警告：JEV_API_KEY 未配置，所有 /decide 都会返回 degraded")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
