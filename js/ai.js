/* 跆拳道 · AI 对战 —— ai
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- AI 大脑 ----------
   两层结构：
     战术层（Jev，每 1.4s 一次，可为空）→ 给出战术意图与「对手是否即将出腿」的预判
     反射层（本函数，每帧）      → 执行移动/出招/格挡，并把战术意图换算成行为权重偏置
   Jev 不可用时 bias 全为中性，行为与纯本地 AI 一致。 */
function aiThink(dt, t){
  const rank = R();
  const f = ai;
  const p = player;
  const dist = Math.abs(p.x - f.x);
  const skill = rank.ai;

  /* —— 战术层偏置 —— */
  const JI = (typeof jevIntent === 'function') ? jevIntent(t || 0) : null;
  const jt = JI ? JI.tactic : null;
  const jKickRisk = JI ? (JI.foeKick || 0) : 0;
  /* keep = 战术希望维持的距离；aggr/block 为进攻欲望与格挡倾向的增量 */
  const bias = ({
    rush:    { aggr: +0.30, keep:  95, block: -0.15 },   // 突进压制
    probe:   { aggr:  0.00, keep: 150, block:  0.00 },   // 游走试探
    counter: { aggr: -0.10, keep: 185, block: +0.30 },   // 后退反击
    defend:  { aggr: -0.25, keep: 215, block: +0.40 },   // 稳固防守
    feint:   { aggr: +0.05, keep: 130, block:  0.00 }    // 假动作诱敌
  })[jt] || { aggr: 0, keep: 150, block: 0 };
  const farD  = bias.keep + 60;                          // 中性时 ≈ 210（与原 200 接近）
  const nearD = Math.max(70, bias.keep - 40);            // 中性时 ≈ 110（与原一致）

  // 若玩家倒地，AI 后退保持距离（WT：读秒期间不得进攻）
  if(!p.grounded){ f.face = p.x > f.x ? 1 : -1; f.targetVx = -f.face * 90; f.vx = f.targetVx; return; }

  // 面朝玩家
  const wantFace = p.x > f.x ? 1 : -1;
  if(f.grounded && f.state==='idle' && f.cast==='') f.face = wantFace;

  // 决策冷却：难度越高反应越快
  f.thinkT = (f.thinkT||0) - dt;
  if(f.thinkT <= 0 && f.canAct()){
    f.thinkT = rand(.22, .55) / (0.45 + skill*0.65);
    const roll = Math.random();
    const aggr = clamp(0.4 + skill * 0.5 + bias.aggr, 0.05, 0.95);   // 进攻欲望：段位 + 战术偏置

    // 反击意识：玩家处于出招前摇/受击硬直 → 立即压上反击
    const counter = (p.state==='attack' || p.state==='kick' || p.freeze > .15) && dist < 160;

    if(dist > farD){       // 远：快速逼近
      f.targetVx = wantFace * rand(250, 340) * rank.speed;
    } else if(dist < nearD){ // 近身：踢法压制为主
      if(counter && skill > .4 && Math.random() < .6 + skill*.35){
        if(Math.random() < .88) tryKick(f); else tryPunch(f);
      }
      else if(roll < .15 && skill > .55){
        if(Math.random() < .5) startBackKick(f);
        else f.targetVx = -wantFace * 290;
      }
      else if(roll < .52){ if(Math.random() < .28) startAxe(f); else tryKick(f); }
      else if(roll < aggr){ if(Math.random() < .9) tryKick(f); else tryPunch(f); }
      else { f.targetVx = -wantFace * rand(40,100); }
    } else {               // 中距：突进与踢击试探
      if(roll < .28 && skill > .45){ tryKick(f); }
      else if(roll < aggr*.85){ if(Math.random() < .88) tryKick(f); else tryPunch(f); }
      else if(roll < .84){ if(Math.random() < .24) startSide(f); else f.targetVx = wantFace * rand(290, 370) * rank.speed; }
      else { f.targetVx = -wantFace * rand(60,140); }
    }
    // 格挡反应：玩家出招中，或 Jev 预判对手即将出腿
    const blockP = (skill - .25) * 1.0 + bias.block + jKickRisk * 0.35;
    const incoming = (p.state==='attack' || p.state==='kick');
    if(dist < 150 && Math.random() < blockP && (incoming || jKickRisk > .6)){
      f.state = 'block'; f.cool = Math.max(f.cool, .4);
      setTimeout(() => { if(f.state==='block') f.state='idle'; }, 350);
    }
    // 特技：旋风踢 / 飞踢
    if(f.state==='idle' && f.cast==='' && dist < 175 && dist > 40){
      const sroll = Math.random();
      if(sroll < .3 && skill > .65){
        startSpinx(f);
        f.targetVx = wantFace * 200;
      } else if(sroll < .45 && skill > .45){
        startFlyingKick(f);
        f.jumpH = wantFace * 400;
      }
    }
  }

  // 移动平滑：向目标速度连续趋近
  // 出界保护：AI 贴边时绝不允许继续向外走。
  // 否则 Jev 给的「防守/后退」战术会让 AI 把自己退出界外，每次白送对手 +1 分
  // （实测现象：玩家挂机不动，却能靠 AI 反复出界拿到 7 分）
  const EDGE = COURT + 42 - 50;
  if(Math.abs(f.x) > EDGE && Math.sign(f.targetVx || 0) === Math.sign(f.x)){
    f.targetVx = 0;
  }
  if(!f.cast) f.vx = lerp(f.vx, f.targetVx || 0, Math.min(1, dt*10));
}

