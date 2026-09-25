/* 跆拳道 · AI 对战 —— hud
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- HUD ---------- */
let comboPopT = 0, lastCombo = 0;
function drawHUD(t){
  const rank = R();
  const s = UI();   // HUD 用视口比例，不受相机推拉影响
  const barW = Math.min(W*.36, 430), barH = 21, y = 26;
  const skew = 12;

  // ---- 玩家血条（右侧锚定，向左填充） ----
  hpBar(CX - 44 - barW, y, barW, barH, player, true, skew);
  // ---- AI 血条（左侧锚定，向左排空） ----
  hpBar(CX + 44, y, barW, barH, ai, false, skew);

  // 名字 + 段位
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign='left';
  ctx.font = fnt(900, 15*s);
  ctx.fillStyle = '#7dedff';
  ctx.fillText('你 · 挑战者', CX - 44 - barW + 8, y - 9);
  ctx.textAlign='right';
  ctx.font = fnt(900, 15*s);
  ctx.fillStyle = '#ff9db0';
  ctx.fillText('AI', CX + 44 + barW - 8, y - 9);
  ctx.font = fnt(800, 11*s);
  ctx.fillStyle = rank.color==='#1f2937' ? '#9ca3af' : rank.color;
  ctx.fillText(rank.name, CX + 44 + barW - 30*s, y - 9);

  // ---- 中央计时 ----
  const secs = Math.ceil(state.roundTime);
  const urgent = state.roundTime < 10;
  ctx.save();
  ctx.translate(CX, y + 10);
  // 六边形表框
  ctx.fillStyle = 'rgba(8,12,26,.85)';
  ctx.strokeStyle = urgent ? 'rgba(248,113,113,.8)' : 'rgba(126,156,220,.4)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const hw = 34, hh = 25;
  ctx.moveTo(-hw, -hh+6); ctx.lineTo(-hw+6, -hh); ctx.lineTo(hw-6, -hh); ctx.lineTo(hw, -hh+6);
  ctx.lineTo(hw, hh-6); ctx.lineTo(hw-6, hh); ctx.lineTo(-hw+6, hh); ctx.lineTo(-hw, hh-6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if(urgent){
    const pk = .5 + .5*Math.sin(t*10);
    ctx.strokeStyle = `rgba(248,113,113,${.4*pk})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = urgent ? '#f87171' : '#eaf2ff';
  ctx.font = fnt(900, 19);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${secs}`, 0, 1);
  ctx.font = fnt(700, 8);
  ctx.fillStyle = 'rgba(143,163,200,.8)';
  ctx.fillText('SEC', 0, 14);
  ctx.restore();

  // 回合数 + 大比分（菱形 pip）
  ctx.textAlign='center';
  ctx.font = fnt(800, 11*s);
  ctx.fillStyle = 'rgba(143,163,200,.9)';
  ctx.fillText(`第 ${roundNum} 回合 · ${quickMode ? '速战单局' : '五局三胜'}`, CX, y + hh2(46, s));
  const dotY = y + hh2(62, s);
  const need = WIN_NEED();
  for(let i=0;i<need;i++){
    drawPip(CX - 34 - i*17, dotY, i < roundWins, '#fbbf24');
    drawPip(CX + 34 + i*17, dotY, i < aiWins, '#ff6d89');
  }

  // WT 得分（血条下方）
  drawScoreChip(CX - 44 - barW + barW/2, y + barH + 14, scoreP, '#fde047');
  drawScoreChip(CX + 44 + barW/2, y + barH + 14, scoreA, '#fda4af');

  // 提示（触屏设备不显示键盘提示）
  if(!isTouch()){
    ctx.font = fnt(500, 11*s);
    ctx.fillStyle = 'rgba(143,163,200,.55)';
    ctx.fillText('A/D 移动 · W/空格 跳 · J 拳 · K 踢 · L 挡 · 连点K=下劈→旋风踢 · 前进+K=侧踢 · 后退+K=后踢 · 空中K=飞踢', CX, H - 14);
  }

  // 连击（玩家）
  if(player.combo >= 2 && player.comboT > 0){
    if(player.combo !== lastCombo){ comboPopT = .22; lastCombo = player.combo; }
    comboPopT = Math.max(0, comboPopT - 1/60);
    const pop = 1 + comboPopT*1.6;
    ctx.save();
    ctx.globalAlpha = clamp(player.comboT*2, 0, 1);
    ctx.translate(CX - 44 - barW/2, y + 108*s);
    ctx.scale(pop, pop);
    ctx.font = fnt(900, 24*s);
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(120,53,15,.9)'; ctx.lineWidth = 4*s;
    ctx.strokeText(`×${player.combo}`, 0, 0);
    ctx.fillText(`×${player.combo}`, 0, 0);
    ctx.font = fnt(800, 11*s);
    ctx.fillStyle = 'rgba(253,224,71,.85)';
    ctx.strokeText('连击 COMBO', 0, 16*s);
    ctx.fillText('连击 COMBO', 0, 16*s);
    ctx.restore();
  }

  // KO 读秒（裁判读秒）
  if(state.count){
    const vic = state.count==='p' ? player : ai;
    ctx.save();
    // 压暗四周
    ctx.fillStyle = 'rgba(4,6,12,.42)';
    ctx.fillRect(0, 0, W, H);
    const cxr = CX, cyr = H*.34, rr0 = 56*s;
    // 圆环进度（8 秒）
    const prog = clamp(vic.kdT/8, 0, 1);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 6*s;
    ctx.beginPath(); ctx.arc(cxr, cyr, rr0, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = state.countNum<=3 ? '#ff5470' : '#fbbf24';
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cxr, cyr, rr0, -Math.PI/2, -Math.PI/2 + (1-prog)*Math.PI*2); ctx.stroke();
    // 大数字
    const pk = 1 + Math.max(0, (state.countT%1) - .82) * .9;
    ctx.translate(cxr, cyr); ctx.scale(pk, pk);
    ctx.fillStyle = state.countNum<=3 ? '#ff5470' : '#fde047';
    ctx.font = fnt(900, 58*s);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(7,10,20,.7)'; ctx.lineWidth = 6*s;
    ctx.strokeText(`${state.countNum}`, 0, 2);
    ctx.fillText(`${state.countNum}`, 0, 2);
    ctx.restore();
    ctx.font = fnt(800, 14*s);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(234,242,255,.92)';
    ctx.fillText(state.count==='p' ? '快速连按 J / K 起身！' : 'AI 正在起身…', CX, H*.34 + 88*s);
  }

  // 开局倒计时（3 · 2 · 1 · 开战！）
  if(state.intro > 0 && state.mode===STATE.fight){
    ctx.textAlign = 'center';
    const n = state.intro > 2.2 ? '3' : (state.intro > 1.2 ? '2' : (state.intro > .2 ? '1' : null));
    ctx.save();
    ctx.translate(CX, H*.42);
    if(n){
      const frac = state.intro % 1;
      const pop = 1 + Math.max(0, frac - .72) * 2.2;
      ctx.scale(pop, pop);
      ctx.globalAlpha = clamp(frac*4 + .3, 0, 1);
      ctx.font = fnt(900, 66*s);
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = 'rgba(120,53,15,.85)'; ctx.lineWidth = 7*s;
      ctx.strokeText(n, 0, 0);
      ctx.shadowColor = 'rgba(251,191,36,.65)'; ctx.shadowBlur = 26;
      ctx.fillText(n, 0, 0);
    } else {
      ctx.font = fnt(900, 44*s);
      ctx.fillStyle = '#7dedff';
      ctx.strokeStyle = 'rgba(8,51,68,.9)'; ctx.lineWidth = 6*s;
      ctx.strokeText('开战！', 0, 0);
      ctx.shadowColor = 'rgba(103,232,249,.7)'; ctx.shadowBlur = 26;
      ctx.fillText('开战！', 0, 0);
    }
    ctx.restore();
    // VS 信息条
    ctx.font = fnt(800, 13*s);
    ctx.fillStyle = 'rgba(234,242,255,.85)';
    ctx.fillText(`你　·VS·　${rank.name} AI`, CX, H*.42 + 52*s);
  }

  // 中央提示文字（回合开始）
  if(roundMsgT>0){
    ctx.globalAlpha = clamp(roundMsgT, 0, 1);
    ctx.font = fnt(900, 26*s);
    ctx.fillStyle = '#eaf2ff';
    ctx.strokeStyle = 'rgba(7,10,20,.7)'; ctx.lineWidth = 5*s;
    ctx.textAlign='center';
    ctx.strokeText(roundMsg, CX, H*.32);
    ctx.fillText(roundMsg, CX, H*.32);
    ctx.globalAlpha = 1;
  }

  // 大字播报（K.O.! / 时间到）
  if(bigMsg){
    const k = 1 - bigMsg.t / bigMsg.dur;
    const pop = k < .15 ? .4 + ease(k/.15)*.75 : 1.15 - Math.min(.15, (k-.15))*.5;
    ctx.save();
    ctx.translate(CX, H*.24);
    ctx.scale(pop, pop);
    ctx.rotate(-.04);
    ctx.globalAlpha = bigMsg.t < .3 ? clamp(bigMsg.t/.3, 0, 1) : 1;
    ctx.font = `italic 900 ${64*s}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 8*s;
    ctx.strokeStyle = 'rgba(7,10,20,.75)';
    ctx.strokeText(bigMsg.text, 0, 0);
    const gr = ctx.createLinearGradient(0, -40*s, 0, 24*s);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(.45, bigMsg.color);
    gr.addColorStop(1, bigMsg.color);
    ctx.fillStyle = gr;
    ctx.shadowColor = bigMsg.color;
    ctx.shadowBlur = 34;
    ctx.fillText(bigMsg.text, 0, 0);
    ctx.restore();
  }

  // 世界层特效（飘分等，投影到屏幕后绘制，保证在最上层且清晰）
  for(const ft of floats){
    const k = clamp(ft.life/ft.dur, 0, 1);
    ctx.globalAlpha = Math.min(1, k*2.2);
    ctx.font = fnt(900, ft.size*s);
    ctx.textAlign='center';
    ctx.strokeStyle = 'rgba(7,10,20,.75)'; ctx.lineWidth = 4*s;
    ctx.strokeText(ft.text, projX(ft.x), projY(ft.y));
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, projX(ft.x), projY(ft.y));
  }
  ctx.globalAlpha = 1;
}
function hh2(v, s){ return v * Math.max(.8, Math.min(s, 1.2)); }
function drawPip(x, y, on, color){
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI/4);
  ctx.beginPath(); ctx.rect(-4.5, -4.5, 9, 9);
  if(on){
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}
function drawScoreChip(x, y, score, color){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(8,12,26,.78)';
  ctx.strokeStyle = 'rgba(126,156,220,.3)';
  ctx.lineWidth = 1.2;
  roundRect(-30, -14, 60, 28, 9);
  ctx.fill(); ctx.stroke();
  ctx.font = fnt(900, 17);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(`${score}`, -4, 1);
  ctx.font = fnt(700, 8.5);
  ctx.fillStyle = 'rgba(143,163,200,.85)';
  ctx.textAlign = 'left';
  ctx.fillText('WT', 12, -2);
  ctx.fillText('得分', 12, 8);
  ctx.restore();
}

function hpBar(x, y, w, h, f, isP, skew){
  const pct = clamp(f.hp / f.maxHp, 0, 1);
  const disp = clamp((f.hpDisp === undefined ? f.hp : f.hpDisp) / f.maxHp, 0, 1);
  // 斜切平行四边形（格斗游戏血条）：外侧端斜切；剩余血量贴外侧、掉血从中央侧开始
  const barPath = () => {
    ctx.beginPath();
    if(isP){
      ctx.moveTo(x + skew, y);      // 外端（左）斜切
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w - skew, y);  // 外端（右）斜切
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
    }
    ctx.closePath();
  };
  const fillRect = (fillW) => {
    // 填充锚定外端：玩家从左端向右、AI 从右端向左（配合裁剪自然吃掉斜角）
    if(isP) ctx.fillRect(x - 2, y, fillW + 2, h);
    else ctx.fillRect(x + w - fillW, y, fillW + 2, h);
  };
  // 底槽（深色 + 描边）
  ctx.fillStyle = 'rgba(8,12,26,.82)';
  barPath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(126,156,220,.35)';
  ctx.lineWidth = 1.4;
  barPath();
  ctx.stroke();
  // 当前血量 + 损伤延迟层（裁剪在血条形状内）
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  if(isP){ grad.addColorStop(0, '#7dedff'); grad.addColorStop(1, '#0891b2'); }
  else { grad.addColorStop(0, '#ff9db0'); grad.addColorStop(1, '#e11d48'); }
  ctx.save();
  barPath();
  ctx.clip();
  // 损伤延迟条（白色：缓动显示刚掉的部分）
  if(disp > pct + .005){
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    fillRect(Math.max(0, w*disp));
  }
  // 当前血量渐变
  ctx.fillStyle = grad;
  fillRect(Math.max(0, w*pct));
  // 顶部高光
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.fillRect(x - 2, y + 2, w + 4, h*.26);
  // 分段刻度
  ctx.strokeStyle = 'rgba(7,10,20,.45)'; ctx.lineWidth = 1;
  for(let i=1;i<4;i++){
    ctx.beginPath(); ctx.moveTo(x + w*i/4, y + 1); ctx.lineTo(x + w*i/4, y + h - 1); ctx.stroke();
  }
  ctx.restore();
  if(pct > 0){
    ctx.save();
    barPath();
    ctx.shadowColor = isP ? '#22d3ee' : '#ff3b5c';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = isP ? 'rgba(125,237,255,.8)' : 'rgba(255,157,176,.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}

