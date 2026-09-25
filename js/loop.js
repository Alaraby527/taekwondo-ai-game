/* 跆拳道 · AI 对战 —— loop
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 主循环 ---------- */
/* rAF 为主驱动；setInterval 兜底：rAF 暂停（如切后台）时保证游戏继续跑。 */
let tick = 0, framePending = false;
function frame(ts){
  let dt = Math.min(.033, (ts - last)/1000 || .016);
  last = ts;
  const t = ts/1000;
  // KO 慢动作
  let dtSim = dt;
  if(slowT > 0){ slowT -= dt; dtSim = dt * .35; }
  try {
    update(dtSim, t);
    updateCam(dt);

    // ① 远景场馆（屏幕空间 + 视差 + 体积光锥）
    drawHall(t);
    // ② 地面基色（纯竖直渐变，屏幕空间）
    drawFloorBase(t);
    // ③ 世界层：统一经相机变换（震屏已并入 CAM，HUD 不受影响）
    ctx.save();
    camApply();
    drawArena(t);
    drawShadows();
    // 绘制顺序：AI 在前、玩家在后（保证视觉层次）
    if(ai.x > player.x){ drawFighter(player, t, dt); drawFighter(ai, t, dt); }
    else { drawFighter(ai, t, dt); drawFighter(player, t, dt); }
    drawFx();
    ctx.restore();
    // ④ HUD（屏幕空间）
    drawHUD(t);
    // KO 白闪（全屏，HUD 之下）
    if(flashA > 0){
      ctx.fillStyle = `rgba(255,240,244,${flashA*.55})`;
      ctx.fillRect(0, 0, W, H);
    }
    // 结束延时后切换
    if(state.mode===STATE.over && state.overTimer>0){
      state.overTimer -= dt;
      if(state.overTimer<=0){ state.overTimer=0; afterRound(); }
    }
  } catch(e){ window.__lastErr = (e && e.stack) || String(e); }
}
let lastRafT = 0;
function loop(ts){
  lastRafT = performance.now();
  if(!framePending){ framePending = true; frame(ts); framePending = false; }
  requestAnimationFrame(loop);
}
/* 兜底驱动：仅在 rAF 停转（后台标签页）时接管 */
setInterval(() => {
  if(performance.now() - lastRafT < 200) return;
  if(!framePending){ framePending = true; frame(performance.now()); framePending = false; }
}, 120);
