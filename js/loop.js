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

    /* 黑边底：竖屏时底部 BAR_B 是留给触屏按键的控制条（横屏 BAR_B=0，等价于清屏） */
    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, SW, SH);

    /* —— 游戏区（竖屏＝黑边内的 band；原点在 (0,0)，与屏幕同宽，无需平移）—— */
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

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
    // ④ HUD（游戏区顶部，屏幕空间）
    drawHUD(t);
    // KO 白闪（游戏区内，HUD 之下）
    if(flashA > 0){
      ctx.fillStyle = `rgba(255,240,244,${flashA*.55})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();   // 解除 band 裁剪

    /* 游戏区底边：渐隐 + 一道细线，让「band」看起来是有意为之 */
    if(BAR_B > 0){
      const edge = ctx.createLinearGradient(0, H - 30, 0, H);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(0,0,0,.60)');
      ctx.fillStyle = edge;
      ctx.fillRect(0, H - 30, W, 30);
      ctx.strokeStyle = 'rgba(126,156,220,.20)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H + .5); ctx.lineTo(W, H + .5); ctx.stroke();
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
