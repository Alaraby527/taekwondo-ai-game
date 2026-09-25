/* 跆拳道 · AI 对战 —— render-fx
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 绘制 · 世界特效 ---------- */
function drawFx(){
  const s = SCALE();
  // 冲击波环
  for(const r of rings){
    const k = 1 - r.life/r.dur;
    ctx.globalAlpha = (1-k)*.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.lw*s*(1-k*.6);
    ctx.beginPath();
    ctx.ellipse(r.x, -r.y, (r.r0 + (r.r1-r.r0)*ease(k))*s, (r.r0 + (r.r1-r.r0)*ease(k))*.62*s, 0, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 命中星芒
  for(const sp of sparks){
    const k = sp.life/sp.dur;
    const R0 = (sp.big ? 34 : 20) * (0.4 + 0.6*k) * s;
    ctx.save();
    ctx.translate(sp.x, -sp.y);   // 世界坐标：高度向上
    ctx.rotate(sp.ang);
    ctx.globalAlpha = k;
    // 放射细线
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6*s;
    for(let i=0;i<6;i++){
      const a = i*Math.PI/3 + .3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*R0*.4, Math.sin(a)*R0*.4);
      ctx.lineTo(Math.cos(a)*R0*1.5, Math.sin(a)*R0*1.5);
      ctx.stroke();
    }
    // 四角星核
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    const n = 8, out = R0, inn = R0*.36;
    for(let i=0;i<n*2;i++){
      const a = i*Math.PI/n - Math.PI/2;
      const rr = i%2===0 ? out : inn;
      i===0 ? ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr) : ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, R0*.22, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

