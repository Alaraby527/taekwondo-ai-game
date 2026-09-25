/* 跆拳道 · AI 对战 —— render-fighter
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 绘制 · 选手 ---------- */
function drawFighter(f, t, dt){
  const s = SCALE();
  ctx.save();
  ctx.translate(f.x, -(f.y||0));   // 世界坐标：高度向上 → 画布 y 减小；落地投影统一由 drawShadows 处理
  // 受击反馈：整体变白一瞬
  const isPlayer = f.side==='p';
  const fw = f.flash > .08 ? 1 : f.flash / .08;
  // WT 比赛装：白道服 + 红/蓝护具（护头/护甲/拳套）
  const gear    = mixC(isPlayer ? '#25aae4' : '#ff4257', '#ffffff', fw);
  const gearDk  = mixC(isPlayer ? '#136a99' : '#c22840', '#e2e8f0', fw);
  const gearHi  = mixC(isPlayer ? '#7ddcff' : '#ff8f9e', '#ffffff', fw);
  const cloth   = mixC('#f4f7fc', '#ffffff', fw);
  const clothDk = mixC('#d4deeb', '#e2e8f0', fw);
  const clothFar= mixC('#c2cede', '#eef2f7', fw);   // 远端肢体（暗一档，分层感）
  const skin    = mixC('#ffd9b3', '#ffffff', fw);
  const skinFar = mixC('#eac79e', '#f2f6fb', fw);
  const lineC   = mixC('#151d2c', '#e8edf4', fw);
  const beltC   = isPlayer ? '#dbe7f5' : R().color;
  const beltDk  = isPlayer ? '#b9c9dd' : mixC(R().color==='#1f2937' ? '#1f2937' : R().color, '#000000', .35);
  const colorGlow = isPlayer ? 'rgba(56,189,248,' : 'rgba(255,80,100,';

  // 旋风踢：绕纵轴「连续旋转」（正面→侧面压扁→背面→回正）
  const isSpinx = f.cast==='spinx';
  if(isSpinx){
    if(f.phase <= 2){
      const rotX = Math.abs(Math.cos(f.cyc * Math.PI * 2)) < .04 ? .04*Math.sign(Math.cos(f.cyc*Math.PI*2)||1) : Math.cos(f.cyc * Math.PI * 2);
      ctx.scale(rotX, 1);
    }
    if(f.phase === 1) ctx.rotate(-f.face * .18);
    if(f.phase === 2) ctx.rotate(f.face * .18);
    // 多重残影（转体轨迹）
    ctx.save();
    ctx.globalAlpha = .14;
    for(let i=1;i<=4;i++){
      ctx.save();
      ctx.translate(-f.face*i*8*s, 0);
      ctx.rotate(-f.cyc*0.9 - i*.55);
      ctx.fillStyle = colorGlow + '.35)';
      roundRect(-10*s, -96*s, 20*s, 96*s, 9*s);
      ctx.beginPath(); ctx.arc(0, -108*s, 12*s, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 后踢：转身残影
  if(f.cast==='back'){
    const bp = clamp(f.stT/.14, 0, 1);
    ctx.save();
    ctx.globalAlpha = .14;
    for(let i=1;i<=2;i++){
      ctx.save();
      ctx.translate(-f.face*i*5*s, 0);
      ctx.rotate(f.face*.3*bp - i*.4);
      ctx.fillStyle = colorGlow + '.35)';
      roundRect(-10*s, -96*s, 20*s, 96*s, 9*s);
      ctx.beginPath(); ctx.arc(0, -108*s, 12*s, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 倒地/读秒：身体倒下，读秒时随 rise 缓慢半起身
  if(f.kd>0 || f.rise>0){
    const prog = f.rise>0 ? (f.rise) : ease(Math.min(1, f.kdT/.25));
    ctx.translate(f.face * (1-prog) * 10*s, 0);
    ctx.rotate(-f.face * (1-prog) * 1.4);
    if(f.rise>0) ctx.translate(0, -prog * 20*s);
  }

  const bob = Math.sin(t*4 + (f.side==='p' ? 0 : 2.1)) * 1.4 * s * (f.bobAmp || 0);
  ctx.translate(0, bob);   // 呼吸浮动（整身）

  // 朝向镜像：以下身体部件统一按 face 水平翻转
  ctx.save();
  ctx.scale(f.face, 1);

  // 踢腿姿态：按 WT 标准五阶段
  let kickPose = null;   // { kneeA, shinA, lean }
  if(f.state==='kick' && !isSpinx){
    if(f.flyKick){
      kickPose = { kneeA: -1.15, shinA: -.35, lean: -.1 };
    } else if(f.cast==='back'){
      kickPose = { kneeA: -1.35, shinA: -.05, lean: .24 };
    } else if(f.cast==='axe'){
      const p1 = clamp(f.stT/.24, 0, 1);
      const p2 = clamp((f.stT-.24)/.12, 0, 1);
      const p3 = clamp((f.stT-.36)/.24, 0, 1);
      const kneeA = -2.55*p1 + 1.4*p2 + .45*p3;
      const shinA = .9*p3;
      const lean  = -.14*p1 + .1*p3;
      kickPose = { kneeA, shinA, lean };
    } else if(f.cast==='side'){
      const p1 = clamp(f.stT/.18, 0, 1);
      const p2 = clamp((f.stT-.18)/.12, 0, 1);
      const p3 = clamp((f.stT-.3)/.25, 0, 1);
      const kneeA = -1.5*p1 + .55*p3;
      const shinA = 2.1*p1 - 2.3*p2 + .55*p3;
      const lean  = -.3*p1 + .22*p3;
      kickPose = { kneeA, shinA, lean };
    } else {
      const p1 = clamp(f.stT/.15, 0, 1);
      const p2 = clamp((f.stT-.15)/.1, 0, 1);
      const p3 = clamp((f.stT-.25)/.25, 0, 1);
      const kneeA = -1.7*p1 - .2*p2 + .62*p3;
      const shinA = 2.3*p1 - 2.6*p2 + .55*p3;
      const lean  = -.24*p1 + .2*p3;
      kickPose = { kneeA, shinA, lean };
    }
  }
  // 旋风踢：后腿画弧横扫
  let spinLeg = 0;
  if(isSpinx && f.phase >= 1){
    const p = clamp((f.spinP) / 360, 0, 1);
    if(f.phase === 1){
      spinLeg = 1.4 * Math.sin(p * Math.PI);
    } else if(f.phase === 2){
      spinLeg = 1.35;
    } else {
      spinLeg = 1.35 - clamp(f.stT, 0, .3) * 4;
    }
    kickPose = { kneeA: spinLeg, shinA: .12, lean: -.18 };
  }
  const swing = Math.sin(f.stepT*8) * .35 * (f.swingAmp || 0);   // 行走摆腿

  // —— 人体基准（世界单位；脚底 y=0，向上为负）——
  const HIP_Y = -54*s, SHO_Y = -98*s;         // 髋、肩
  const HEAD_Y = -115*s, HEAD_RX = 7.6*s, HEAD_RY = 8.6*s;
  const SHO_HW = 16.5*s, HIP_HW = 11*s;       // 肩半宽 / 髋半宽

  // 明暗工具：兼容 '#rrggbb' 与 'rgb(r,g,b)'（外层配色经 mixC 处理后是后者）
  const parseC = (c) => {
    if(c[0] === '#'){
      const p = parseInt(c.slice(1), 16);
      return [(p>>16)&255, (p>>8)&255, p&255];
    }
    const m = c.match(/\d+/g);
    return [+m[0], +m[1], +m[2]];
  };
  const shade = (c, k, toWhite) => {
    const [r, g, b] = parseC(c);
    const f = v => Math.round(toWhite ? v + (255 - v) * k : v * (1 - k));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  };
  const dk = (c, k) => shade(c, k, false);
  const lt = (c, k) => shade(c, k, true);

  /* 锥形肢体：根粗末细 + 描边 + 沿轴向的圆柱渐变（核心体积感来源） */
  const limb = (x1, y1, x2, y2, w1, w2, fill, shadowK) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const nx = Math.cos(a + Math.PI/2), ny = Math.sin(a + Math.PI/2);
    const path = (o) => {
      ctx.beginPath();
      ctx.moveTo(x1 + nx*(w1/2 + o), y1 + ny*(w1/2 + o));
      ctx.lineTo(x2 + nx*(w2/2 + o), y2 + ny*(w2/2 + o));
      ctx.arc(x2, y2, w2/2 + o, a + Math.PI/2, a - Math.PI/2, true);
      ctx.lineTo(x1 - nx*(w1/2 + o), y1 - ny*(w1/2 + o));
      ctx.arc(x1, y1, w1/2 + o, a - Math.PI/2, a + Math.PI/2, true);
      ctx.closePath();
    };
    path(1.5*s); ctx.fillStyle = lineC; ctx.fill();          // 描边
    path(0);
    const g = ctx.createLinearGradient(x1 + nx*w1/2, y1 + ny*w1/2, x1 - nx*w1/2, y1 - ny*w1/2);
    g.addColorStop(0,   lt(fill, .20));                       // 受光面
    g.addColorStop(.45, fill);
    g.addColorStop(1,   dk(fill, shadowK === undefined ? .30 : shadowK));
    ctx.fillStyle = g; ctx.fill();
  };

  /* 关节（膝/肘）：球体 + 高光（不描边，避免与肢体描边叠成黑环） */
  const joint = (x, y, r, fill) => {
    const g = ctx.createRadialGradient(x - r*.4, y - r*.45, r*.1, x, y, r);
    g.addColorStop(0, lt(fill, .30));
    g.addColorStop(1, dk(fill, .18));
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = g; ctx.fill();
  };

  /* 腿：髋 → 膝 → 踝；道裤宽松、护胫、脚背护垫、赤足趾 */
  const drawLeg = (hipX, kneeA, shinA, cIn, skinC, far) => {
    const THIGH = 24*s, SHIN = 23*s;
    const kx = hipX*s - Math.sin(kneeA)*THIGH, ky = HIP_Y + Math.cos(kneeA)*THIGH;
    const fa = kneeA + shinA;
    const ax = kx - Math.sin(fa)*SHIN, ay = ky + Math.cos(fa)*SHIN;

    // 大腿（道裤，宽松 → 末端更宽）
    limb(hipX*s, HIP_Y + 2*s, kx, ky, (far?11.4:12.6)*s, (far?9.0:9.8)*s, cIn, .26);
    // 小腿（道裤下露出的腿）
    limb(kx, ky, ax, ay, (far?8.6:9.4)*s, (far?6.4:7.0)*s, skinC, .30);
    joint(kx, ky, 3.0*s, cIn);
    // 护胫（主色，包住小腿中段）
    limb(kx*0.72 + ax*0.28, ky*0.72 + ay*0.28, kx*0.28 + ax*0.72, ky*0.28 + ay*0.72,
         (far?7.6:8.3)*s, (far?6.9:7.6)*s, far ? gearDk : gear, .22);

    // 脚：脚踝 → 脚跟 → 脚掌（带脚尖）
    const ang = fa * .55;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-3.8*s, -2.1*s);
    ctx.quadraticCurveTo(-5.4*s, 2.3*s, -1.9*s, 3.1*s);   // 脚跟
    ctx.lineTo(6.5*s, 2.9*s);
    ctx.quadraticCurveTo(8.4*s, 2.6*s, 8.2*s, 1.2*s);     // 脚尖
    ctx.quadraticCurveTo(7.9*s, -1.0*s, 4.0*s, -2.1*s);
    ctx.closePath();
    ctx.fillStyle = skinC; ctx.fill();
    ctx.strokeStyle = lineC; ctx.lineWidth = 1.4*s; ctx.stroke();
    // 脚背护垫
    ctx.beginPath();
    ctx.ellipse(2.2*s, -1.4*s, 4.0*s, 2.1*s, -.1, 0, Math.PI*2);
    ctx.fillStyle = far ? gearDk : gear; ctx.fill();
    ctx.strokeStyle = lineC; ctx.lineWidth = 1*s; ctx.stroke();
    // 脚趾分隔
    ctx.strokeStyle = dk(skinC, .3); ctx.lineWidth = .7*s;
    ctx.beginPath(); ctx.moveTo(5.5*s, 2.2*s); ctx.lineTo(6.0*s, -0.3*s); ctx.stroke();
    ctx.restore();
    return [ax, ay];
  };

  /* 臂：肩 → 肘 → 拳；三角肌、前臂护具、握拳 */
  const drawArm = (shX, upperA, foreA, cIn, fistC, far) => {
    const UPPER = 13*s, FORE = 13*s;
    const ex = shX*s - Math.sin(upperA)*UPPER, ey = SHO_Y + 3*s + Math.cos(upperA)*UPPER;
    const fx2 = ex - Math.sin(foreA)*FORE, fy2 = ey + Math.cos(foreA)*FORE;

    // 上臂（道服短袖 → 稍宽）
    limb(shX*s, SHO_Y + 1*s, ex, ey, (far?8.4:9.2)*s, (far?6.1:6.7)*s, cIn, .28);
    // 三角肌（肩帽）
    ctx.beginPath(); ctx.arc(shX*s, SHO_Y + 2*s, (far?4.8:5.3)*s, 0, Math.PI*2);
    ctx.fillStyle = dk(cIn, .12); ctx.fill();
    // 前臂
    limb(ex, ey, fx2, fy2, (far?6.4:7.1)*s, (far?4.9:5.4)*s, (far ? skinFar : skin), .30);
    joint(ex, ey, 2.4*s, cIn);
    // 前臂护具
    limb(ex*0.7 + fx2*0.3, ey*0.7 + fy2*0.3, ex*0.35 + fx2*0.65, ey*0.35 + fy2*0.65,
         (far?5.8:6.5)*s, (far?5.1:5.7)*s, far ? gearDk : gear, .22);
    // 握拳
    const fa2 = Math.atan2(fy2 - ey, fx2 - ex);
    ctx.save();
    ctx.translate(fx2, fy2);
    ctx.rotate(fa2 - Math.PI/2);
    ctx.beginPath();
    ctx.moveTo(-2.9*s, -3.0*s);
    ctx.quadraticCurveTo(3.2*s, -4.0*s, 3.6*s, 0);
    ctx.quadraticCurveTo(3.2*s, 4.0*s, -2.9*s, 3.0*s);
    ctx.closePath();
    ctx.fillStyle = fistC; ctx.fill();
    ctx.strokeStyle = lineC; ctx.lineWidth = 1.35*s; ctx.stroke();
    // 指节
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1*s;
    ctx.beginPath(); ctx.moveTo(-1.2*s, -2.7*s); ctx.lineTo(2.2*s, -3.0*s); ctx.stroke();
    ctx.restore();
  };

  // —— 手臂姿态（跆拳道实战架：肘内收、双拳护脸；踢击时摆臂平衡）——
  let backArm, frontArm;
  if(isSpinx){
    backArm = { u: 0.9, f: -2.1 };
    const armA = f.phase===0 ? 1.1 : (f.phase>=2 ? -0.4 : 1.6);
    frontArm = { u: armA, f: -1.9 };
  } else if(f.state==='block'){
    backArm = { u: 0.4, f: -2.7 };
    frontArm = { u: -0.35, f: -2.85 };
  } else if(f.state==='attack'){
    const punch = f.stT >= .12;
    frontArm = punch ? { u: -1.3, f: -1.35 } : { u: -0.5, f: -2.6 };
    backArm = { u: 0.45, f: -2.75 };
  } else if(f.state==='kick'){
    backArm = { u: 0.35, f: -2.8 };
    frontArm = { u: 0.55, f: -2.0 };
  } else {
    backArm = { u: 0.45 + swing*.15, f: -2.75 };
    frontArm = { u: -0.05 + swing*.12, f: -2.2 };
  }

  // —— 绘制（踢击躯干倾斜 → 远端肢体 → 躯干 → 近端肢体，分层）——
  if(kickPose && kickPose.lean){
    ctx.translate(0, HIP_Y); ctx.rotate(kickPose.lean); ctx.translate(0, -HIP_Y);
  }

  // 远端臂 / 远端腿（后侧，整体压暗一档制造纵深）
  drawArm(-6, backArm.u, backArm.f, clothFar, gearDk, true);
  const support = kickPose ? 1 : 0;
  drawLeg(-7, 0.30 - support*.18 - swing*.5, -0.52 + support*.35 + swing*.2, clothFar, skinFar, true);

  /* ---------- 躯干：道服 + 护甲 hogu ---------- */
  // 躯干主体（从肩到髋的梯形，肩宽 > 髋宽）
  ctx.beginPath();
  ctx.moveTo(-SHO_HW, SHO_Y + 1*s);
  ctx.quadraticCurveTo(-SHO_HW - 1.5*s, SHO_Y + 9*s, -HIP_HW - 1*s, HIP_Y - 1*s);
  ctx.lineTo(HIP_HW + 1*s, HIP_Y - 1*s);
  ctx.quadraticCurveTo(SHO_HW + 1.5*s, SHO_Y + 9*s, SHO_HW, SHO_Y + 1*s);
  ctx.quadraticCurveTo(0, SHO_Y - 3*s, -SHO_HW, SHO_Y + 1*s);
  ctx.closePath();
  const tg = ctx.createLinearGradient(-SHO_HW, 0, SHO_HW, 0);
  tg.addColorStop(0,   lt(cloth, .16));      // 受光侧
  tg.addColorStop(.40, cloth);
  tg.addColorStop(1,   dk(cloth, .26));      // 背光侧
  ctx.fillStyle = tg; ctx.fill();
  ctx.strokeStyle = lineC; ctx.lineWidth = 1.6*s; ctx.stroke();

  // 道服门襟（交叠 V 领）
  ctx.strokeStyle = dk(cloth, .22); ctx.lineWidth = 2.0*s;
  ctx.beginPath();
  ctx.moveTo(-4.4*s, SHO_Y + 2*s);
  ctx.lineTo(0.4*s, SHO_Y + 16*s);
  ctx.lineTo(5.6*s, SHO_Y + 2*s);
  ctx.stroke();
  ctx.strokeStyle = lt(cloth, .55); ctx.lineWidth = 1*s;
  ctx.beginPath();
  ctx.moveTo(-2.6*s, SHO_Y + 4*s);
  ctx.lineTo(0.6*s, SHO_Y + 14*s);
  ctx.stroke();

  // 护甲 hogu（前片：包住躯干，上下有包边 + 中缝）
  ctx.beginPath();
  ctx.moveTo(0.2*s, SHO_Y + 6*s);
  ctx.quadraticCurveTo(14.6*s, SHO_Y + 10*s, 13.6*s, SHO_Y + 27*s);
  ctx.lineTo(11.4*s, HIP_Y - 8*s);
  ctx.quadraticCurveTo(4.5*s, HIP_Y - 4*s, -0.6*s, HIP_Y - 7*s);
  ctx.closePath();
  const hg = ctx.createLinearGradient(0, SHO_Y + 6*s, 13*s, HIP_Y - 8*s);
  hg.addColorStop(0, lt(gear, .24));
  hg.addColorStop(.5, gear);
  hg.addColorStop(1, dk(gear, .26));
  ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = lineC; ctx.lineWidth = 1.5*s; ctx.stroke();
  // hogu 包边
  ctx.strokeStyle = lt(gear, .5); ctx.lineWidth = 2.2*s;
  ctx.beginPath();
  ctx.moveTo(1.6*s, SHO_Y + 8.5*s);
  ctx.quadraticCurveTo(13.4*s, SHO_Y + 12*s, 12.4*s, SHO_Y + 26*s);
  ctx.stroke();
  // 中缝与压线
  ctx.strokeStyle = dk(gear, .22); ctx.lineWidth = 1.1*s;
  ctx.beginPath();
  ctx.moveTo(6.6*s, SHO_Y + 9*s); ctx.lineTo(5.6*s, HIP_Y - 8*s);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.30)'; ctx.lineWidth = .9*s;
  ctx.beginPath();
  ctx.moveTo(8.4*s, SHO_Y + 24*s); ctx.lineTo(7.4*s, HIP_Y - 8.5*s);
  ctx.stroke();

  // 腰带 + 结 + 两条垂带（随呼吸摆动）
  ctx.fillStyle = beltC;
  ctx.beginPath();
  ctx.moveTo(-HIP_HW - 1*s, HIP_Y - 4.6*s);
  ctx.lineTo(HIP_HW + 1*s, HIP_Y - 4.6*s);
  ctx.lineTo(HIP_HW + 1*s, HIP_Y + 0.6*s);
  ctx.lineTo(-HIP_HW - 1*s, HIP_Y + 0.6*s);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = lineC; ctx.lineWidth = 1*s; ctx.stroke();
  ctx.fillStyle = lt(beltC, .35);
  ctx.fillRect(-HIP_HW - 1*s, HIP_Y - 4.6*s, 2*(HIP_HW + 1*s), 1.1*s);
  // 结
  ctx.beginPath(); ctx.arc(1.5*s, HIP_Y - 2*s, 3.1*s, 0, Math.PI*2);
  ctx.fillStyle = beltC; ctx.fill();
  ctx.strokeStyle = lineC; ctx.lineWidth = .9*s; ctx.stroke();
  const knotSw = Math.sin(t*3 + (f.side==='p'?0:1.4)) * .12;
  for(const [bx, ba, len, col] of [[-5.5, .45, 16, beltDk], [-3.0, .95, 12.5, beltC]]){
    ctx.save();
    ctx.translate(bx*s, HIP_Y - 1*s);
    ctx.rotate(ba + knotSw * (ba > .7 ? .7 : 1));
    ctx.beginPath();
    ctx.moveTo(-1.7*s, 0); ctx.lineTo(1.7*s, 0);
    ctx.lineTo(1.2*s, len*s); ctx.lineTo(-1.2*s, len*s);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = lineC; ctx.lineWidth = .8*s; ctx.stroke();
    ctx.restore();
  }

  /* ---------- 近端腿 ---------- */
  if(kickPose){
    const foot = drawLeg(5, kickPose.kneeA, kickPose.shinA, cloth, skin, false);
    if(f.state==='kick'){
      const trail = (f.kickTrail = f.kickTrail || []);
      trail.push({ x: f.x + foot[0]*f.face, y: (f.y||0) - foot[1], life: .38 });
      if(trail.length > 26) trail.shift();
    }
  }
  else drawLeg(6, -0.22 + swing*.6, 0.30 - swing*.25, cloth, skin, false);

  /* ---------- 脖子（短而结实） ---------- */
  limb(0.2*s, SHO_Y + 3*s, 0.6*s, HEAD_Y + HEAD_RY - 1.4*s, 8.4*s, 7.6*s, skinFar, .40);

  /* ---------- 头：颅骨 + 发 + 帽式护头 + 五官（3/4 侧脸） ---------- */
  // 颅骨（后脑饱满、前脸略平）
  ctx.beginPath();
  ctx.ellipse(0.6*s, HEAD_Y, HEAD_RX*s, HEAD_RY*s, 0, 0, Math.PI*2);
  ctx.fillStyle = skin; ctx.fill();
  ctx.strokeStyle = lineC; ctx.lineWidth = 1.5*s; ctx.stroke();

  // 头发：后脑到头顶一圈，护头下缘露出一截
  ctx.beginPath();
  ctx.ellipse(0.6*s, HEAD_Y, (HEAD_RX + 0.1)*s, (HEAD_RY + 0.1)*s, 0, Math.PI*1.06, Math.PI*1.94);
  ctx.ellipse(0.6*s, HEAD_Y, (HEAD_RX - 2.4)*s, (HEAD_RY - 2.4)*s, 0, Math.PI*1.94, Math.PI*1.06, true);
  ctx.closePath();
  ctx.fillStyle = '#2b3444'; ctx.fill();

  // 下颌线（拉出下巴）
  ctx.beginPath();
  ctx.moveTo(HEAD_RX*0.40*s, HEAD_Y + HEAD_RY*0.54*s);
  ctx.quadraticCurveTo(HEAD_RX*1.02*s, HEAD_Y + HEAD_RY*0.86*s, HEAD_RX*0.14*s, HEAD_Y + HEAD_RY*1.0*s);
  ctx.quadraticCurveTo(-HEAD_RX*0.72*s, HEAD_Y + HEAD_RY*0.86*s, -HEAD_RX*0.94*s, HEAD_Y + HEAD_RY*0.38*s);
  ctx.strokeStyle = dk(skin, .24); ctx.lineWidth = 1.2*s; ctx.stroke();

  /* 帽式护头：整圈外壳用 evenodd 挖出「脸部开口」，得到正面敞开、头顶与后脑全覆盖的帽壳
     （比环带更耐看：小尺寸下也能读出「戴着头盔」而不是一圈光环） */
  const OPEN_CX = (HEAD_RX*0.75)*s, OPEN_CY = HEAD_Y + HEAD_RY*0.45*s;
  const OPEN_RX = HEAD_RX*0.78*s,  OPEN_RY = HEAD_RY*0.68*s;
  const capOuter = () => ctx.ellipse(0.6*s, HEAD_Y, (HEAD_RX + 2.4)*s, (HEAD_RY + 2.4)*s, 0, 0, Math.PI*2);
  const capHole  = () => ctx.ellipse(OPEN_CX, OPEN_CY, OPEN_RX, OPEN_RY, 0, 0, Math.PI*2);
  const hgg = ctx.createLinearGradient(-HEAD_RX*s, HEAD_Y - HEAD_RY*s, HEAD_RX*s, HEAD_Y + HEAD_RY*s);
  hgg.addColorStop(0, lt(gear, .36));
  hgg.addColorStop(.5, gear);
  hgg.addColorStop(1, dk(gear, .30));
  ctx.beginPath(); capOuter(); capHole();
  ctx.fillStyle = hgg; ctx.fill('evenodd');
  // 外壳描边 + 开口包边
  ctx.strokeStyle = lineC; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); capOuter(); ctx.stroke();
  ctx.beginPath(); capHole(); ctx.stroke();
  // 帽壳受光压线
  ctx.strokeStyle = lt(gear, .5); ctx.lineWidth = 1.6*s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(0.6*s, HEAD_Y, (HEAD_RX + 1.5)*s, (HEAD_RY + 1.5)*s, 0, -0.46*Math.PI, -0.86*Math.PI);
  ctx.stroke();
  // 开口上沿高光（强调「开脸」）
  ctx.strokeStyle = lt(gear, .30); ctx.lineWidth = 1.1*s;
  ctx.beginPath();
  ctx.ellipse(OPEN_CX, OPEN_CY, OPEN_RX, OPEN_RY, 0, Math.PI*1.10, Math.PI*1.62);
  ctx.stroke();

  // 耳罩（贴颅骨，略暗，避免读成“耳机”）
  ctx.beginPath();
  ctx.ellipse((-HEAD_RX + 1.5)*s, HEAD_Y + 1.2*s, 2.4*s, 3.3*s, -.14, 0, Math.PI*2);
  ctx.fillStyle = dk(gear, .22); ctx.fill();
  ctx.strokeStyle = lineC; ctx.lineWidth = 1.1*s; ctx.stroke();
  ctx.beginPath();
  ctx.ellipse((-HEAD_RX + 1.5)*s, HEAD_Y + 1.2*s, 1.0*s, 1.6*s, -.14, 0, Math.PI*2);
  ctx.strokeStyle = lt(gear, .28); ctx.lineWidth = .9*s; ctx.stroke();
  // 下颌带：从耳罩下方绕到下巴底（走下巴之下，不横穿脸）
  ctx.strokeStyle = dk(gear, .24); ctx.lineWidth = 1.7*s;
  ctx.beginPath();
  ctx.moveTo((-HEAD_RX + 2.8)*s, HEAD_Y + 4.2*s);
  ctx.quadraticCurveTo(-0.6*s, HEAD_Y + (HEAD_RY + 2.2)*s, HEAD_RX*0.66*s, HEAD_Y + HEAD_RY*0.84*s);
  ctx.stroke();

  // —— 五官（全部落在脸部开口内） ——
  const rage = (f.state==='kick' || f.state==='attack' || f.freeze>0) ? 1 : 0;
  const kdFace = f.kd > 0;
  // 远眼
  ctx.beginPath(); ctx.ellipse(1.35*s, HEAD_Y + 1.4*s, 1.05*s, .85*s, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.60)'; ctx.fill();
  ctx.beginPath(); ctx.arc(1.7*s, HEAD_Y + 1.5*s, .6*s, 0, Math.PI*2);
  ctx.fillStyle = '#2b3a50'; ctx.fill();
  // 近眼
  ctx.beginPath();
  if(kdFace){ ctx.moveTo(3.1*s, HEAD_Y + .8*s); ctx.lineTo(5.9*s, HEAD_Y + 2.0*s); ctx.lineTo(3.2*s, HEAD_Y + 2.6*s); ctx.closePath(); }
  else ctx.ellipse(4.3*s, HEAD_Y + 1.5*s, 1.45*s, 1.15*s, 0, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = lineC; ctx.lineWidth = .7*s; ctx.stroke();
  if(!kdFace){
    ctx.beginPath(); ctx.arc(4.6*s, HEAD_Y + 1.6*s, .72*s, 0, Math.PI*2);
    ctx.fillStyle = '#16233a'; ctx.fill();
    ctx.beginPath(); ctx.arc(4.36*s, HEAD_Y + 1.3*s, .27*s, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
  }
  // 眉（出招/受击更凶）
  ctx.strokeStyle = '#2b3444'; ctx.lineWidth = 1.25*s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2.5*s, HEAD_Y + 0.1*s + rage*.7*s);
  ctx.lineTo(5.6*s, HEAD_Y + 0.7*s - rage*.35*s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.4*s, HEAD_Y + 0.5*s + rage*.6*s);
  ctx.lineTo(2.1*s, HEAD_Y + 1.0*s);
  ctx.stroke();
  // 鼻（前缘小三角）
  ctx.beginPath();
  ctx.moveTo((HEAD_RX - 1.3)*s, HEAD_Y + 2.6*s);
  ctx.lineTo((HEAD_RX - 2.5)*s, HEAD_Y + 4.0*s);
  ctx.lineTo((HEAD_RX - 0.9)*s, HEAD_Y + 4.1*s);
  ctx.closePath();
  ctx.fillStyle = dk(skin, .22); ctx.fill();
  // 嘴
  ctx.strokeStyle = dk(skin, .48); ctx.lineWidth = 1.1*s;
  ctx.beginPath();
  if(kdFace || f.freeze > .12){
    ctx.ellipse(3.5*s, HEAD_Y + 5.4*s, 1.4*s, 1.1*s, 0, 0, Math.PI*2);
    ctx.fillStyle = '#8a2135'; ctx.fill(); ctx.stroke();
  } else {
    ctx.moveTo(2.5*s, HEAD_Y + 5.2*s);
    ctx.quadraticCurveTo(3.8*s, HEAD_Y + 5.9*s, 5.1*s, HEAD_Y + 5.1*s);
    ctx.stroke();
  }


  /* ---------- 近端臂 ---------- */
  drawArm(6, frontArm.u, frontArm.f, cloth, gear, false);

  /* ---------- 轮廓光：统一给受光侧补一道冷光边缘 ---------- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = isPlayer ? 'rgba(120,215,255,.30)' : 'rgba(255,150,170,.28)';
  ctx.lineWidth = 2.1*s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0.6*s, HEAD_Y, HEAD_RX + 1.2*s, Math.PI*1.16, Math.PI*1.86);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-SHO_HW*0.86, SHO_Y + 2.5*s);
  ctx.quadraticCurveTo(-SHO_HW - 1.2*s, SHO_Y + 10*s, -HIP_HW - 0.6*s, HIP_Y - 1.5*s);
  ctx.stroke();
  ctx.restore();

  // 旋风踢：脚下旋转光弧
  if(isSpinx){
    const arcStart = f.phase===0 ? -f.cyc*1.5 : (f.phase===1 ? -1.5 - f.spinP/40 : 2.2 - f.spinP/40*0.3);
    ctx.strokeStyle = 'rgba(251,191,36,.85)';
    ctx.lineWidth = 3.5*s; ctx.lineCap='round';
    ctx.beginPath();
    ctx.arc(0, 0, 48*s, arcStart, arcStart + 2.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(251,191,36,.3)';
    ctx.lineWidth = 7*s;
    ctx.beginPath();
    ctx.arc(0, 0, 48*s, arcStart, arcStart + 1.4);
    ctx.stroke();
  }
  // 飞踢：空中前冲拖尾
  if(f.flyKick && f.airborne){
    ctx.strokeStyle = 'rgba(251,191,36,.55)';
    ctx.lineWidth = 3*s; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-34*s, -6*s); ctx.lineTo(0, 0);
    ctx.stroke();
  }
  ctx.restore();   // 结束朝向镜像

  // 踢击轨迹（世界坐标拖尾，渲染在镜像 restore 后）
  if(f.kickTrail && f.kickTrail.length){
    ctx.lineCap = 'round';
    for(let i=1;i<f.kickTrail.length;i++){
      const tp = f.kickTrail[i], tp0 = f.kickTrail[i-1];
      const k = tp.life/.38;
      ctx.globalAlpha = k*.7;
      ctx.strokeStyle = f.side==='p' ? 'rgba(125,237,255,1)' : 'rgba(255,157,176,1)';
      ctx.lineWidth = (1 + 4.5*k)*s;
      ctx.beginPath();
      ctx.moveTo(tp0.x - f.x, (f.y||0) - tp0.y);
      ctx.lineTo(tp.x - f.x, (f.y||0) - tp.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 粒子
  for(const pt of f.particle){
    ctx.globalAlpha = clamp(pt.life/pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x - f.x, (f.y||0) - pt.y, pt.r*s, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

