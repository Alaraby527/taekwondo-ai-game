/* 跆拳道 · AI 对战 —— ai
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- AI 大脑 ---------- */
function aiThink(dt){
  const rank = R();
  const f = ai;
  const p = player;
  const dist = Math.abs(p.x - f.x);
  const skill = rank.ai;

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
    const aggr = 0.4 + skill * 0.5;             // 进攻欲望随段位显著提升

    // 反击意识：玩家处于出招前摇/受击硬直 → 立即压上反击
    const counter = (p.state==='attack' || p.state==='kick' || p.freeze > .15) && dist < 160;

    if(dist > 200){        // 远：快速逼近
      f.targetVx = wantFace * rand(250, 340) * rank.speed;
    } else if(dist < 110){ // 近身：踢法压制为主
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
    // 格挡反应：玩家出招时
    if((p.state==='attack'||p.state==='kick') && dist < 150 && Math.random() < (skill-.25)*1.0){
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
  if(!f.cast) f.vx = lerp(f.vx, f.targetVx || 0, Math.min(1, dt*10));
}

