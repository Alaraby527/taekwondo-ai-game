/* 跆拳道 · AI 对战 —— scene
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 绘制 · 赛场 ---------- */
/* 背景静态层缓存：观众席/LED/地面全部静态，只绘一次（离屏），每帧 drawImage */
/* =====================================================================
   绘制 · 场景（视觉底座）
   分层：远景场馆（屏幕空间＋视差）→ 地面基色（屏幕空间）
        → 世界层（相机：擂台／影子／选手／特效）→ HUD
   ===================================================================== */
let bgCache = null, bgLed = null, BG_PAD = 300;

/* 场馆远景：静态部分只画一次并缓存成比屏幕更宽的画布，支持视差平移 */
function buildBg(){
  BG_PAD = Math.max(260, Math.round((W + 560) * 0.18));
  const CW = W + BG_PAD * 2;
  bgCache = document.createElement('canvas');
  bgCache.width  = Math.max(1, Math.round(CW * DPR));
  bgCache.height = Math.max(1, Math.round(H  * DPR));
  const c = bgCache.getContext('2d');
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cxs = BG_PAD + CX;            // 缓存内的画面中心

  /* 1) 场馆纵深：顶部近黑 → 远处幕墙微亮 */
  const hall = c.createLinearGradient(0, 0, 0, H);
  hall.addColorStop(0,   '#03050a');
  hall.addColorStop(.30, '#070c18');
  hall.addColorStop(.62, '#0d1526');
  hall.addColorStop(.86, '#111c33');
  hall.addColorStop(1,   '#0a1120');
  c.fillStyle = hall;
  c.fillRect(0, 0, CW, H);

  /* 2) 擂台正上方的主光晕：把视线压向擂台 */
  const halo = c.createRadialGradient(cxs, GROUND - H*.10, 20, cxs, GROUND - H*.10, Math.max(W, H)*.62);
  halo.addColorStop(0,   'rgba(104,150,235,.18)');
  halo.addColorStop(.45, 'rgba(70,112,196,.07)');
  halo.addColorStop(1,   'rgba(0,0,0,0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, CW, H);

  /* 3) 顶部桁架 + 灯组 */
  const trussY = Math.max(14, H * .05);
  c.strokeStyle = 'rgba(126,156,220,.16)'; c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, trussY); c.lineTo(CW, trussY);
  c.moveTo(0, trussY + 13); c.lineTo(CW, trussY + 13);
  c.stroke();
  c.strokeStyle = 'rgba(126,156,220,.09)'; c.lineWidth = 1.5;
  for(let x = -20; x < CW + 20; x += 46){
    c.beginPath(); c.moveTo(x, trussY); c.lineTo(x + 23, trussY + 13); c.stroke();
  }
  for(let i = 0; i < 3; i++){
    const lx = cxs + (i - 1) * W * .30, main = (i === 1);
    c.fillStyle = main ? 'rgba(198,228,255,.95)' : 'rgba(178,208,246,.70)';
    roundRectOn(c, lx - 34, trussY + 13, 68, 7, 3); c.fill();
    c.fillStyle = main ? 'rgba(212,238,255,.95)' : 'rgba(186,214,248,.78)';
    for(const dx of [-24, -8, 8, 24]){ roundRectOn(c, lx + dx - 5, trussY + 20, 10, 11, 2); c.fill(); }
    const lg = c.createRadialGradient(lx, trussY + 34, 2, lx, trussY + 34, 58);
    lg.addColorStop(0, main ? 'rgba(190,225,255,.30)' : 'rgba(180,215,255,.17)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = lg;
    c.fillRect(lx - 70, trussY + 20, 140, 90);
  }

  /* 4) 观众席：四排剪影（远排小暗、近排大亮），带肩线起伏 */
  const rows = [
    { dy: 236, sp: 21, hr: 6.2, a: .34 },
    { dy: 212, sp: 25, hr: 7.8, a: .45 },
    { dy: 185, sp: 30, hr: 9.4, a: .57 },
    { dy: 154, sp: 37, hr: 11.4, a: .70 }
  ];
  for(const row of rows){
    const baseY = GROUND - row.dy;
    c.fillStyle = `rgba(4,7,15,${row.a})`;
    for(let i = 0, n = Math.ceil(CW / row.sp) + 2; i < n; i++){
      const hx = i * row.sp + ((row.hr * 137) % row.sp);
      const wob = Math.abs(Math.sin(i * 1.77 + row.dy));
      const hr = row.hr * (0.82 + wob * 0.42);
      const hy = baseY - wob * 7;
      c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI*2); c.fill();
      c.beginPath();
      c.moveTo(hx - hr*1.5, hy + hr*3.4);
      c.quadraticCurveTo(hx, hy + hr*.4, hx + hr*1.5, hy + hr*3.4);
      c.closePath(); c.fill();
    }
  }
  /* 观众席零星反光（手机屏／相机灯） */
  for(let i = 0; i < 52; i++){
    const rx = (Math.sin(i * 91.7) * .5 + .5) * CW;
    const ry = GROUND - (152 + (i % 4) * 26) - (Math.sin(i * 3.3) + 1) * 5;
    const a = .10 + ((i * 37) % 13) / 44;
    c.fillStyle = i % 3 === 0 ? `rgba(186,230,253,${a*.5})` : `rgba(255,247,214,${a*.45})`;
    c.beginPath(); c.arc(rx, ry, 1.5, 0, Math.PI*2); c.fill();
  }

  /* 5) 环形 LED 广告板（远端），滚动文字在动态层绘制 */
  const ledH = 30;
  const ledW = Math.min(W * .92, 1240);
  const ledX = cxs - ledW / 2;
  const ledY = GROUND - 150 - ledH;
  c.fillStyle = 'rgba(7,11,22,.94)';
  roundRectOn(c, ledX, ledY, ledW, ledH, 6); c.fill();
  const lg2 = c.createLinearGradient(0, ledY, 0, ledY + ledH);
  lg2.addColorStop(0, 'rgba(34,211,238,.10)');
  lg2.addColorStop(.5, 'rgba(34,211,238,.03)');
  lg2.addColorStop(1, 'rgba(139,92,246,.10)');
  c.fillStyle = lg2;
  roundRectOn(c, ledX, ledY, ledW, ledH, 6); c.fill();
  c.strokeStyle = 'rgba(126,156,220,.30)'; c.lineWidth = 1;
  roundRectOn(c, ledX, ledY, ledW, ledH, 6); c.stroke();
  for(const px of [ledX - 8, ledX + ledW + 8]){
    c.fillStyle = 'rgba(10,16,30,.95)';
    roundRectOn(c, px - 5, ledY - 18, 10, ledH + 62, 4); c.fill();
    c.fillStyle = 'rgba(103,232,249,.5)';
    roundRectOn(c, px - 2, ledY - 13, 4, 8, 2); c.fill();
  }
  bgLed = { x: ledX - BG_PAD, y: ledY, w: ledW, h: ledH };   // 存屏幕坐标（扣除缓存内边距）
}

/* 远景层：缓存贴图 + 视差 + 动态 LED 滚动 + 体积光锥 */
function drawHall(t){
  const par = CAM.x * CAM.zoom;                 // 相机横向位移的像素量
  const off1 = -par * 0.10;
  if(bgCache) ctx.drawImage(bgCache, -BG_PAD + off1, 0, W + BG_PAD * 2, H);
  else { ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H); }

  /* LED 滚动文字（视差略大，贴住场馆中景） */
  if(bgLed){
    const ox = bgLed.x - par * 0.16, oy = bgLed.y;
    ctx.save();
    roundRect(ox, oy, bgLed.w, bgLed.h, 6);
    ctx.clip();
    ctx.font = fnt(800, 15);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const ledText = '跆拳道 × AI 对战　·　WT 竞技规则　·　上海理工大学跆拳道社　·　AI 校园招新　·　五局三胜 · KO 制　·　';
    const tw = ctx.measureText(ledText).width;
    const scroll = (t * 40) % tw;
    ctx.fillStyle = 'rgba(103,232,249,.42)';
    for(let x = ox - scroll; x < ox + bgLed.w; x += tw) ctx.fillText(ledText, x, oy + bgLed.h/2 + 1);
    ctx.globalAlpha = .10; ctx.fillStyle = '#67e8f9';
    for(let sy = oy; sy < oy + bgLed.h; sy += 3) ctx.fillRect(ox, sy, bgLed.w, 1);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawBeams(t);
}

/* 体积光锥：两束跟随双方选手，随呼吸轻微摆动 */
function drawBeams(t){
  const topY = Math.max(20, H * .05) + 34;
  const src = [[CX - W*.30, topY], [CX + W*.30, topY]];
  const tgt = [projX(player.x), projX(ai.x)];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i = 0; i < 2; i++){
    const sx0 = src[i][0], sy0 = src[i][1], tx = tgt[i];
    const sway = Math.sin(t * .45 + i * 1.7) * 14;
    const spreadTop = 26, spreadBot = 96 * CAM.zoom;
    const g = ctx.createLinearGradient(sx0, sy0, tx, GROUND);
    g.addColorStop(0,   'rgba(172,212,255,.17)');
    g.addColorStop(.55, 'rgba(150,195,255,.07)');
    g.addColorStop(1,   'rgba(150,195,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx0 - spreadTop + sway, sy0);
    ctx.lineTo(sx0 + spreadTop + sway, sy0);
    ctx.lineTo(tx + spreadBot, GROUND + 30);
    ctx.lineTo(tx - spreadBot, GROUND + 30);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* 地面基色（纯竖直渐变，不随相机横移，故可在屏幕空间绘制） */
function drawFloorBase(t){
  const fl = ctx.createLinearGradient(0, GROUND - 4, 0, H);
  fl.addColorStop(0,   '#17243f');
  fl.addColorStop(.10, '#111b31');
  fl.addColorStop(.42, '#0a1122');
  fl.addColorStop(1,   '#05080f');
  ctx.fillStyle = fl;
  ctx.fillRect(0, GROUND - 4, W, H - GROUND + 4);

  /* 地平线雾：让地面与场馆衔接自然 */
  const hz = ctx.createLinearGradient(0, GROUND - 30, 0, GROUND + 44);
  hz.addColorStop(0,  'rgba(120,165,240,0)');
  hz.addColorStop(.45,'rgba(120,165,240,.10)');
  hz.addColorStop(1,  'rgba(120,165,240,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, GROUND - 30, W, 74);

  /* 赛场浮尘 */
  ctx.save();
  for(const em of embers){
    ctx.globalAlpha = em.a * (0.6 + 0.4 * Math.sin(em.ph * 2));
    ctx.fillStyle = '#9ec5ff';
    ctx.beginPath(); ctx.arc(em.x, em.y, em.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* 擂台（世界空间，经相机变换）：垫子分区 / 出界警戒带 / 徽记 / 灯池 */
function drawArena(t){
  const SQ = 0.30;                       // 地面椭圆压缩比（2.5D 视角）
  const ring = (r, color, lw) => {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * SQ, 0, 0, Math.PI*2); ctx.stroke();
  };

  /* 灯光落在垫子上的亮池 */
  ctx.save();
  ctx.scale(1, SQ);
  const pool = ctx.createRadialGradient(0, 0, 20, 0, 0, COURT * 1.55);
  pool.addColorStop(0,   'rgba(124,172,255,.15)');
  pool.addColorStop(.55, 'rgba(90,135,220,.055)');
  pool.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(0, 0, COURT * 1.55, 0, Math.PI*2);
  ctx.fillStyle = pool; ctx.fill();
  ctx.restore();

  /* 出界警戒带：COURT → RING_OUT，斜纹填充 */
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, RING_OUT, RING_OUT * SQ, 0, 0, Math.PI*2);
  ctx.ellipse(0, 0, COURT,   COURT   * SQ, 0, 0, Math.PI*2, true);
  ctx.clip();
  ctx.globalAlpha = .11;
  ctx.strokeStyle = '#ff5a73';
  ctx.lineWidth = 9;
  for(let i = -RING_OUT - 40; i < RING_OUT + 40; i += 24){
    ctx.beginPath();
    ctx.moveTo(i, -RING_OUT * SQ * 1.6);
    ctx.lineTo(i + RING_OUT * SQ * 3.2, RING_OUT * SQ * 1.6);
    ctx.stroke();
  }
  ctx.restore();

  /* 垫子分区同心环 + 出界线 */
  ring(RING_OUT,    'rgba(255,90,115,.55)', 3);
  ring(COURT,       'rgba(103,232,249,.32)', 3);
  ring(COURT * .66, 'rgba(103,232,249,.15)', 2);
  ring(COURT * .33, 'rgba(103,232,249,.10)', 1.5);

  /* 中心徽记 */
  ctx.save();
  ctx.scale(1, SQ);
  ctx.beginPath(); ctx.arc(0, 0, COURT * .13, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(147,197,253,.34)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  ctx.font = fnt(900, 19);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(147,197,253,.34)';
  ctx.fillText('TKD × AI', 0, -2);

  /* 出界线端标（贴在界线上，随相机移动） */
  for(const bx of [-COURT, COURT]){
    ctx.save();
    ctx.translate(bx, 0);
    ctx.fillStyle = 'rgba(255,90,115,.75)';
    ctx.beginPath();
    ctx.moveTo(0, 2); ctx.lineTo(-7, 15); ctx.lineTo(7, 15);
    ctx.closePath(); ctx.fill();
    ctx.font = fnt(700, 12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,120,140,.60)';
    ctx.fillText('出界线', 0, -6);
    ctx.restore();
  }

  /* 四分位刻度：给垫子一点可读的方位感 */
  ctx.strokeStyle = 'rgba(147,197,253,.16)';
  ctx.lineWidth = 2;
  for(let i = 0; i < 8; i++){
    const a = i * Math.PI / 4;
    const x0 = Math.cos(a) * COURT * .92, y0 = Math.sin(a) * COURT * .92 * SQ;
    const x1 = Math.cos(a) * COURT * 1.04, y1 = Math.sin(a) * COURT * 1.04 * SQ;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
}

/* 接触阴影：单独一遍，保证在所有角色之下且不互相覆盖 */
function drawShadows(){
  const list = [player, ai];
  for(const f of list){
    const air = f.y || 0;
    const k = clamp(1 - air / 230, .32, 1);
    const rx = 44 * (0.72 + k * 0.28);
    ctx.save();
    ctx.translate(f.x, 0);
    ctx.scale(1, 0.30);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
    g.addColorStop(0,   `rgba(0,0,0,${.66 * k})`);
    g.addColorStop(.55, `rgba(0,0,0,${.28 * k})`);
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function roundRectOn(c, x, y, w, h, r){
  c.beginPath();
  c.moveTo(x+r, y); c.arcTo(x+w, y, x+w, y+h, r); c.arcTo(x+w, y+h, x, y+h, r);
  c.arcTo(x, y+h, x, y, r); c.arcTo(x, y, x+w, y, r); c.closePath();
}
function roundRect(x,y,w,h,r){ roundRectOn(ctx, x,y,w,h,r); }

