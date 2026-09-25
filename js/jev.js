/* 跆拳道 · AI 对战 —— jev
   Jev 战术层客户端：把「打什么战术」交给真实 AI 服务，
   反射动作（移动/出招时机/前后摇/命中判定）仍由本地 aiThink 执行。

   为什么分两层：Jev 实测约 236~698ms/次，做不到 60fps 逐帧决策。
   因此每 1.4 秒问一次「打什么战术」，中间由本地层插值执行。

   不可用时（没网 / 反代未配 / 超预算 / 超时）自动退回纯本地 AI，游戏永远能玩。 */

/* 代理地址解析顺序：?jev=<url> → <meta name="jev-base"> → 同源
   反代配好后，把地址填到 index.html 的 <meta name="jev-base"> 即可。
   特例：?jev=off 显式关闭战术层，用于 A/B 对比（不依赖"请求失败"来降级） */
const JEV_BASE = (() => {
  const q = new URLSearchParams(location.search).get('jev');
  if(q === 'off') return '';
  const meta = document.querySelector('meta[name="jev-base"]');
  const m = meta && meta.getAttribute('content');
  const raw = (q || m || (location.protocol.startsWith('http') ? location.origin : '')).trim();
  return raw.replace(/\/+$/, '');
})();

const JEV = {
  enabled: false,      // 是否曾成功拿到过决策
  intent: null,        // { tactic, tactics, foeKick, confidence, at }
  pending: false,
  calls: 0, errors: 0, lastMs: 0, lastSrc: '',
  interval: 1.4,       // 决策间隔（秒）：兼顾成本与「像在思考」的节奏
  timeoutMs: 5000,
  lastAt: -99,
  fightId: ''
};

/* 每次从引导页开始＝新的一局：重置并换一个新的 fightId（代理按它计预算） */
function initJev(){
  JEV.fightId = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  JEV.enabled = false; JEV.intent = null; JEV.pending = false;
  JEV.calls = 0; JEV.errors = 0; JEV.lastMs = 0; JEV.lastSrc = '';
  JEV.interval = 1.4; JEV.lastAt = -99;
}

/* 记录选手最近动作（供 Jev 判断习惯，很轻量） */
function noteAct(f, kind){
  (f.recentActs = f.recentActs || []).push(kind);
  if(f.recentActs.length > 4) f.recentActs.shift();
}

/* 每帧调用：到点就异步问一次 Jev（单次在途，绝不阻塞主循环） */
function jevTick(t){
  if(!JEV_BASE) return;
  if(state.mode !== STATE.fight || state.count) return;
  if(JEV.pending) return;
  if(t - JEV.lastAt < JEV.interval) return;
  JEV.lastAt = t;

  const p = player, a = ai;
  const body = {
    fightId: JEV.fightId,
    /* 注意视角：Jev 决策的是 AI，所以「我方」= AI，「对手」= 玩家 */
    rank: R().name,
    style: R().ai >= .8 ? '激进压迫' : (R().ai >= .6 ? '攻守均衡' : '稳健保守'),
    dist: Math.round(Math.abs(a.x - p.x)),
    hp: Math.round(a.hp / Math.max(1, a.maxHp) * 100),
    foeHp: Math.round(p.hp / Math.max(1, p.maxHp) * 100),
    scoreMine: scoreA, scoreFoe: scoreP,
    timeLeft: Math.round(state.roundTime),
    foeRecent: (p.recentActs || []).slice(-3),
    foeDefend: p.aliveT > 0 ? +(p.defendT / p.aliveT).toFixed(3) : 0,
    myKnocked: a.kdCount, foeKnocked: p.kdCount,
    round: roundNum, needWins: WIN_NEED()
  };

  JEV.pending = true;
  const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), JEV.timeoutMs) : null;
  const done = () => { JEV.pending = false; if(timer) clearTimeout(timer); };

  fetch(JEV_BASE + '/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ctl ? ctl.signal : undefined
  })
    .then(r => r.json())
    .then(d => {
      done();
      JEV.calls++;
      JEV.lastSrc = d.src || '?';
      if(d.src === 'jev' || d.src === 'cache'){
        JEV.enabled = true;
        JEV.lastMs = d.ms || 0;
        JEV.intent = {
          tactic: d.tactic, tactics: d.tactics || {},
          foeKick: d.foeKick || 0, confidence: d.confidence || 0, at: t
        };
        JEV.interval = 1.4;
      } else {
        // 代理明确说降级（没预算/未就绪）→ 拉长间隔，别白发请求
        JEV.errors++;
        if(JEV.errors >= 3) JEV.interval = 12;
      }
    })
    .catch(() => {
      done();
      JEV.errors++;
      if(JEV.errors >= 3) JEV.interval = 12;   // 连续失败就退避，回到纯本地 AI
    });
}

/* 给 aiThink 与 panel 用：只要最近成功拿到过战术，就保持该战术指导，
   避免因网络波动或间隔微差瞬间闪退回「纯本地 AI」；只有在长期未更新(>15s)时才降级 */
function jevIntent(t){
  const it = JEV.intent;
  if(!it) return null;
  if(t && it.at && (t - it.at > 15)) return null;
  return it;
}
