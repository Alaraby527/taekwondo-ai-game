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
  /* 读秒期间不进攻（WT 规则），此时双方已被固定在各自角落 */
  if(state.count) return;
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

  /* 出界保护（对所有分支生效，包括会提前 return 的防空分支）：
     贴边时不允许继续朝界外移动，否则会被判出界、白送对手 +1 分。
     阈值比硬上限 (COURT+42) 提前 50 单位留缓冲。 */
  const EDGE = COURT + 42 - 50;
  const edgeNear = Math.abs(f.x) > EDGE - 60;
  const guardOut = (vx) => (Math.abs(f.x) > EDGE && Math.sign(vx || 0) === Math.sign(f.x)) ? 0 : vx;

  /* 检测对手「刚落地」事件 —— 抓落地硬直（与飞踢 0.40s 落地恢复配合） */
  if(p._wasAir && !p.airborne && p.kd <= 0) f._punishT = 0.5;
  p._wasAir = p.airborne;
  if(f._punishT > 0) f._punishT -= dt;

  /* 对手倒地/读秒：后退保持距离，不进攻（WT 规则） */
  if(p.kd > 0){ f.face = p.x > f.x ? 1 : -1; f.targetVx = -f.face * 90; f.vx = f.targetVx; return; }

  // 面朝玩家
  const wantFace = p.x > f.x ? 1 : -1;
  if(f.grounded && f.state === 'idle' && f.cast === '') f.face = wantFace;

  /* —— 防空：对手腾空（跳踢/飞踢）——
     这是最容易吃亏也最容易被占便宜的时刻。按段位分两种处理：
       · 高段位（红带/黑带）：**不后退**，趁对手起跳与滞空阶段直接对拼抢伤害。
         对手在空中同样吃判定，所以先手出腿能「偷」到分，且不必离开边界。
       · 中低段位：格挡为主；贴边没有后退空间时也必须改为格挡，绝不退出边界。
     （原实现把「腾空」和「倒地」混在 !grounded 一个判断里，
       结果玩家一跳起来 AI 只会用 90 的速度慢慢后退，几乎必然被打中）
     位置：所有 targetVx 都过 guardOut()，保证不会朝界外移动 */
  if(p.airborne){
    const closing = (f.x - p.x) * Math.sign(p.vx || (f.x - p.x)) > 0 && dist < 200;
    const react = 0.35 + skill * 0.5;
    if(closing && dist < 195){
      if(skill >= 0.8){
        /* 高段位：起跳瞬间就对拼偷伤害（不再后退） */
        if(f.canAct() && dist < 178){
          f.thinkT = rand(.14, .24);
          if(Math.random() < 0.72) tryKick(f);          // 横踢迎击，判定够长
          else startBackKick(f);                        // 旋转技：头击 3 分且带额外分
          f.targetVx = guardOut(wantFace * 55);         // 微前压保证够得着，但不冒进出界
        } else {
          f.targetVx = guardOut(wantFace * 120);        // 够不着就先贴近
        }
      } else if(Math.random() < react * 0.7 || edgeNear){
        f.state = 'block'; f.holdBlock = true; f.cool = Math.max(f.cool, .3);
        setTimeout(() => { if(f.state==='block'){ f.state='idle'; f.holdBlock = false; } }, 400);
        f.targetVx = 0;
      } else {
        f.targetVx = guardOut(-wantFace * (200 + skill * 120));   // 后撤让飞踢落空
      }
    } else {
      f.targetVx = guardOut(-wantFace * 110);               // 不构成威胁，稍退观察
    }
    f.thinkT = Math.min(f.thinkT, 0.12);
    if(!f.cast) f.vx = lerp(f.vx, f.targetVx || 0, Math.min(1, dt * 12));
    return;
  }

  // 决策冷却：难度越高反应越快
  f.thinkT = (f.thinkT||0) - dt;
  if(f.thinkT <= 0 && f.canAct()){
    f.thinkT = rand(.22, .55) / (0.45 + skill*0.65);
    const roll = Math.random();
    const aggr = clamp(0.4 + skill * 0.5 + bias.aggr, 0.05, 0.95);   // 进攻欲望：段位 + 战术偏置

    /* 最高优先级：抓收招 / 抓落地 —— 对手在可惩罚窗口内就别用随机数决定 */
    const punishable = (p.cool > .18 || (f._punishT || 0) > 0 ||
                        p.state === 'attack' || p.state === 'kick' || p.freeze > .15) && dist < 175;
    if(punishable && Math.random() < 0.45 + skill * 0.5){
      f.thinkT = rand(.16, .28);                        // 惩罚窗口短，反应要更快
      if(dist < 105 && Math.random() < .30) tryPunch(f);
      else if(skill > .5 && dist > 135 && Math.random() < .35) startBackKick(f);
      else tryKick(f);
    }
    else if(dist > farD){       // 远：快速逼近
      f.targetVx = wantFace * rand(250, 340) * rank.speed;
    } else if(dist < nearD){ // 近身：踢法压制为主
      if(punishable && skill > .4){          // 近身可惩罚窗口：果断出手，不再靠随机数
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
      else if(roll < .84){
        // 双方都在中距且对手刚出过招 → 突进更积极（惩罚后摇）
        const push = punishable ? 1.25 : 1;
        if(Math.random() < .24) startSide(f);
        else f.targetVx = wantFace * rand(290, 370) * rank.speed * push;
      }
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
  f.targetVx = guardOut(f.targetVx);
  if(!f.cast) f.vx = lerp(f.vx, f.targetVx || 0, Math.min(1, dt*10));
}

