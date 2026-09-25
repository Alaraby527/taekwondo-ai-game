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
  const keepRaw = bias.keep;                             // 战术层希望的间距
  /* 高段位主动维持更长的作战距离：既符合「会控距」的高手形象，
     也让飞踢/横踢的射程真正用得上（实测不这么做时黑带平均距离只有 65~96） */
  const keepEff = (skill >= .8) ? Math.max(keepRaw, 180) : keepRaw;
  const farD  = keepEff + 60;                            // 中性时 ≈ 210
  const nearD = Math.max(70, keepEff - 40);              // 中性时 ≈ 110

  /* 出界保护（对所有分支生效，包括会提前 return 的防空分支）：
     贴边时不允许继续朝界外移动，否则会被判出界、白送对手 +1 分。
     阈值比硬上限 (COURT+42) 提前 50 单位留缓冲。 */
  const EDGE = COURT + 42 - 50;
  const edgeNear = Math.abs(f.x) > EDGE - 60;
  const guardOut = (vx) => (Math.abs(f.x) > EDGE && Math.sign(vx || 0) === Math.sign(f.x)) ? 0 : vx;

  /* —— 防「推土机」 ——
     碰撞解算推的是【玩家】：`if(Math.abs(f.x-p.x) < gap) p.x = f.x ± gap`。
     所以 AI 持续前压 = 把玩家一路顶到墙角卡死（场地只有 ±342，夹取间隙约 64）。
     这里用两个判据约束：
       contact  —— 已经贴身（比夹取间隙略大）
       pCorner  —— 对手已经被逼到界边
     贴身且没在出招时不再朝对手加力；对手贴边时主动退到踢击射程外再打。 */
  const contact = dist < (p.w + f.w) / 2 + 26;
  const pCorner = Math.abs(p.x) > COURT + 42 - 100;

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
  if(p.airborne && !f.airborne){
    /* 先区分「真有威胁的空中攻击」与「原地跳」：
       · 空中出腿（flyKick / state==='kick'）且带前冲 —— 才是威胁，按段位应对
       · 原地跳：jumpH≈0、没出腿，且在空中的一方无法格挡 —— 应该反过来打它。
         原来这里一律后撤 110，导致玩家只要连续跳跃就能把 AI 一路逼到角落。 */
    const airThreat = p.flyKick || p.state === 'kick';
    const incoming = Math.abs(p.jumpH || 0) > 60 || Math.abs(p.vx || 0) > 120;
    const react = 0.35 + skill * 0.5;

    if(airThreat && incoming && dist < 220){
      if(skill >= 0.8){
        /* 高段位：不与后撤，起跳阶段直接对拼偷伤害 */
        if(f.canAct() && dist < 185){
          f.thinkT = rand(.14, .24);
          if(Math.random() < 0.72) tryKick(f);          // 横踢迎击，判定够长
          else startBackKick(f);                        // 旋转技：头击 3 分且带额外分
          f.targetVx = guardOut(wantFace * 55);         // 微前压保证够得着，但不冒进出界
        } else {
          f.targetVx = guardOut(wantFace * 120);        // 够不着就先贴近
        }
      } else if(Math.random() < react * 0.7 || edgeNear){
        f.state = 'block'; f.holdBlock = true; f.cool = Math.max(f.cool, .3);
        simLater(() => { if(f.state==='block'){ f.state='idle'; f.holdBlock = false; } }, .4);
        f.targetVx = 0;
      } else {
        f.targetVx = guardOut(-wantFace * (200 + skill * 120));   // 后撤让飞踢落空
      }
    } else {
      /* 原地跳 / 空中不出腿：不构成威胁，反而是破绽 —— 压上去打。
         中低段位也打，只是打得没高段位果断；只有贴边时才不乱冲。 */
      if(f.canAct() && dist < 175 && !edgeNear){
        f.thinkT = rand(.18, .30);
        if(Math.random() < 0.45 + skill * 0.45) tryKick(f);
        else f.targetVx = guardOut(wantFace * 150);
      } else {
        f.targetVx = guardOut(wantFace * 90);         // 逼近而不是后退
      }
    }
    f.thinkT = Math.min(f.thinkT, 0.12);
    if(!f.cast) f.vx = lerp(f.vx, f.targetVx || 0, Math.min(1, dt * 12));
    return;
  }

  /* —— 自己腾空：高段位两段式飞踢的「滞空段」——
     起跳后不立刻出腿，而是按两者距离滞空：进入衔接窗口、或滞空超时、或快落地时
     再衔接飞踢。startFlyingKick 会重置 jumpV，所以衔接时会再拿一段滞空并前冲。 */
  if(f.airborne){
    if(f._flyArmed){
      f._flyHang = (f._flyHang || 0) + dt;
      const gapOk = dist > 95 && dist < 205;        // 衔接窗口：出腿后能打到对手
      const minHang = 0.18;                         // 最短滞空 —— 必须看得出「滞空」这一段
      const falling = f.jumpV < 0 && (f.y || 0) < 45;
      /* 注意别用「y 很小」判断快落地：刚起跳时 y 也是 0，会导致衔接被瞬间触发、
         等于没有滞空。要用「正在下落」来区分。 */
      if((f._flyHang >= minHang && gapOk) || f._flyHang >= 0.50 || falling){
        f._flyArmed = false;
        f.face = wantFace;
        startFlyingKick(f);                         // 重置 jumpV → 衔接时再获得一段滞空并前冲
        /* 抬高上限：已经飞得高时不再给满额上抬，避免整体峰值过高 */
        f.jumpV = Math.min(f.jumpV, Math.max(180, 460 - (f.y || 0) * 0.8));
        f.targetVx = 0;
      } else {
        f.targetVx = guardOut(wantFace * 70);       // 滞空期间微调接近
      }
    }
    if(!f.cast) f.vx = lerp(f.vx, f.targetVx || 0, Math.min(1, dt * 8));
    return;
  }
  f._flyArmed = false;      // 已落地：清掉未完成的衔接计划

    // 决策冷却：难度越高反应越快（低段位放宽思考间隙，给玩家更多操作窗口）
    f.thinkT = (f.thinkT||0) - dt;
    if(f.thinkT <= 0 && f.canAct()){
      f.thinkT = rand(.28, .68) / (0.35 + skill*0.75);
      const roll = Math.random();
      const aggr = clamp(0.25 + skill * 0.65 + bias.aggr, 0.05, 0.95);   // 进攻欲望：低段位更温和，黑带依然满欲望

    /* 对手是否处于可惩罚窗口（抓收招 / 抓落地） */
    const punishable = (p.cool > .18 || (f._punishT || 0) > 0 ||
                        p.state === 'attack' || p.state === 'kick' || p.freeze > .15) && dist < 175;

    /* 最高优先级①：飞踢 —— 高段位的标志性接近技。
       仅红带与黑带拥有飞踢威胁，中低段位专注打基本功，新手体验更清晰平缓。 */
    const twoPhase = skill >= .9;                  // 黑带走两段式
    const flyP = skill >= .95 ? .55 : (skill >= .8 ? .32 : 0);
    /* 出界保护：按最远的「起跳 + 衔接」总位移保守估算落点 */
    const flyDest = f.x + wantFace * (twoPhase ? 300 : 200);
    const canFly = flyP > 0 && dist > 110 && dist < 340 && Math.abs(flyDest) < EDGE;
    if(canFly && !punishable && Math.random() < flyP){
      f.thinkT = rand(.6, 1.0);                    // 起飞后一段时间无需重新决策
      if(twoPhase){
        /* 第一段：低跳起步（不是满高跳），留出滞空空间再衔接。
           满高跳(520)再叠加衔接的 460 会让最高点冲到 ~272，比玩家飞踢(约117)高一倍多，
           既不符合观感也会顶到取景框上沿。用 300 → 峰值约 50，衔接后总峰值约 167。 */
        f.airborne = true; f.y = 0; f.jumpV = 300;
        f.jumpH = wantFace * (190 + Math.random() * 130);
        f._flyArmed = true; f._flyHang = 0;
        f.targetVx = 0;
      } else {
        startFlyingKick(f);                        // 中段位：直接起飞，不做滞空
        f.targetVx = 0;                            // 不叠加地面速度，位移回到纯起跳冲量
      }
    }
    /* 最高优先级②：抓收招 / 抓落地 —— 对手在可惩罚窗口内就别用随机数决定 */
    else if(punishable && Math.random() < 0.45 + skill * 0.5){
      f.thinkT = rand(.16, .28);                        // 惩罚窗口短，反应要更快
      if(dist < 105 && Math.random() < .30) tryPunch(f);
      else if(skill > .5 && dist > 135 && Math.random() < .35) startBackKick(f);
      else tryKick(f);
    }
    else if(dist > farD){       // 远：快速逼近
      f.targetVx = wantFace * rand(250, 340) * rank.speed;
    } else if(dist < nearD){ // 近身：踢法压制为主
      /* 对手已被逼到界边：主动退到踢击射程外再打，不要继续压身体把人锁在墙角 */
      if(pCorner){
        f.targetVx = guardOut(-Math.sign(p.x) * rand(140, 230));
        f.thinkT = rand(.18, .28);
        if(f.canAct() && Math.random() < .5) tryKick(f);   // 边退边打，保持压力
      }
      /* AI 自己贴边时先回场内：既避免被判出界，也为飞踢腾出前冲空间 */
      else if(edgeNear){
        f.targetVx = -Math.sign(f.x) * rand(180, 260);
        f.thinkT = rand(.18, .30);
      }
      /* 高段位：贴身太久就主动拉开距离重置间距。
         实测黑带平均距离只有 65~96，几乎全程贴脸 —— 而飞踢/横踢都需要射程，
         贴脸时飞踢只有约 7% 的时间可用。会拉开距离才是高段位该有的间距控制。 */
      else if(skill >= .8 && Math.random() < .38){
        f.targetVx = -wantFace * rand(170, 260);
        f.thinkT = rand(.18, .30);
      }
      else if(punishable && skill > .4){          // 近身可惩罚窗口：果断出手，不再靠随机数
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
    // 仅高段位具备高概率预判格挡，低段位格挡率大幅降低（给新手破防成就感）
    const baseBlockSkill = Math.max(0, skill - 0.35);
    const blockP = baseBlockSkill * 0.85 + bias.block + jKickRisk * (skill >= 0.7 ? 0.35 : 0.15);
    const incoming = (p.state==='attack' || p.state==='kick');
    if(dist < 150 && Math.random() < blockP && (incoming || (skill >= 0.7 && jKickRisk > .6))){
      f.state = 'block'; f.cool = Math.max(f.cool, .4);
      simLater(() => { if(f.state==='block') f.state='idle'; }, .35);
    }
    // 特技：旋风踢（飞踢已提到上面的独立优先级分支，这里不再重复抽取，否则会叠加）
    if(f.state==='idle' && f.cast==='' && dist < 175 && dist > 40){
      if(Math.random() < .3 && skill > .65){
        startSpinx(f);
        f.targetVx = wantFace * 200;
      }
    }
  }

  // 移动平滑：向目标速度连续趋近
  /* 防推土机：贴身且没在出招时，不再朝对手方向加力 ——
     碰撞解算推的是玩家，持续前压会把人一路顶到墙角卡死。 */
  if(contact && f.state === 'idle' && Math.sign(f.targetVx || 0) === wantFace){
    f.targetVx = 0;
  }
  f.targetVx = guardOut(f.targetVx);
  if(!f.cast) f.vx = lerp(f.vx, f.targetVx || 0, Math.min(1, dt*10));
}

