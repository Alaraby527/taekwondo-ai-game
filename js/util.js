/* 跆拳道 · AI 对战 —— util
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* =====================================================================
   跆拳道 · AI 对战 —— 纯前端单文件游戏（视觉重制版）
   玩法：WT 得分制 · 一局决胜（30s）。玩家 vs AI（白→黑带难度递增）
   操控：桌面键鼠 / 移动端触屏
   音效：Web Audio 代码合成（无需素材）
   ===================================================================== */

/* ---------- 工具 ---------- */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 3);
const mixC = (a, b, k) => {   // '#rrggbb' 颜色插值（k=0→a, 1→b）
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa>>16)&255)*(1-k) + ((pb>>16)&255)*k);
  const g = Math.round(((pa>>8)&255)*(1-k) + ((pb>>8)&255)*k);
  const bl = Math.round((pa&255)*(1-k) + (pb&255)*k);
  return `rgb(${r},${g},${bl})`;
};
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
const fnt = (w, s) => `${w} ${s}px ${FONT}`;

/* ---------- 仿真时间调度 ----------
   状态切换必须用「仿真时间」，不能混用「真实时间」：
   原实现用 setTimeout(真实时间) 清除出招状态，而命中判定用 stT(仿真时间)。
   帧率低、或标签页被浏览器节流时两者会脱节 —— 状态先被真实时间清掉，
   而命中窗口（stT > 0.24）还没打开，攻击就静默落空。
   实测：当仿真只有真实时间的 0.25 倍时，攻击 100% 打不中。
   低端手机上同理（dt 封顶会让仿真慢于真实），摊位用的正是低端机，因此统一到仿真时间。 */
let SIM_T = 0;
const _simTimers = [];
function simLater(fn, delay){ _simTimers.push({ fn, at: SIM_T + Math.max(0, delay) }); }
function simClear(){ _simTimers.length = 0; }
function simTick(dt){
  SIM_T += dt;
  for(let i = _simTimers.length - 1; i >= 0; i--){
    if(_simTimers[i].at <= SIM_T){
      const job = _simTimers.splice(i, 1)[0];
      try{ job.fn(); }catch(e){ /* 单个回调异常不影响其它调度 */ }
    }
  }
}

