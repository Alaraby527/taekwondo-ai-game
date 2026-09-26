/* 跆拳道 · AI 对战 —— update
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 更新 ---------- */
let last = 0, hitLocks = new Set();
/* 特效：震屏 / 大字播报 / 命中定格 */
let shakeT = 0, shakeDur = 1, shakeAmp = 0, bigMsg = null, hitStopT = 0;
function shake(amp, dur){ shakeAmp = Math.max(shakeAmp, amp); shakeDur = dur; shakeT = dur; }
function announce(text, dur=1.4, color='#fbbf24'){ bigMsg = { text, t: dur, dur, color }; }
/* 落地尘环（收势砸地扬尘） */
function dustRing(f, n=12){
  for(let i=0;i<n;i++){
    const a = (i/n)*Math.PI*2;
    f.particle.push({ x:f.x + Math.cos(a)*12, y:(f.y||0) + 1,   // 世界高度：脚边扬尘
      vx:Math.cos(a)*rand(2,4.5), vy:-rand(.4,2), life:rand(.3,.5), max:.5,
      r:rand(1.5,3.2), color:'rgba(150,165,190,.65)' });
  }
}
function update(dt, t){
  if(window.__pause) return;   // 调试暂停（浏览器自动化用）
  if(state.alloc) return;     // 决战前的增益分配面板期间：冻结整场模拟
  simTick(dt);                 // 推进仿真时间调度（所有状态切换都挂在它上面）
  const p = player, f = ai;

  // 命中定格：击中瞬间全局子弹时间（打击感）
  if(hitStopT > 0){ hitStopT -= dt; dt *= .12; }

  // 特效计时衰减
  shakeT = Math.max(0, shakeT - dt);
  if(bigMsg){ bigMsg.t -= dt; if(bigMsg.t <= 0) bigMsg = null; }
  roundMsgT = Math.max(0, roundMsgT - dt);
  flashA = Math.max(0, flashA - dt*1.8);
  // 世界特效推进
  for(let i=sparks.length-1;i>=0;i--){ sparks[i].life -= dt; if(sparks[i].life<=0) sparks.splice(i,1); }
  for(let i=rings.length-1;i>=0;i--){ rings[i].life -= dt; if(rings[i].life<=0) rings.splice(i,1); }
  for(let i=floats.length-1;i>=0;i--){
    const ft = floats[i]; ft.life -= dt; ft.y += ft.vy*dt; ft.vy *= (1 - dt*1.6);
    if(ft.life<=0) floats.splice(i,1);
  }
  // 赛场浮尘
  for(const em of embers){
    em.x += em.vx*dt; em.y += em.vy*dt; em.ph += dt;
    if(em.y < -8 || em.x < -8 || em.x > W+8){ em.x = rand(0,W); em.y = H + 8; }
  }

  // 开局倒计时：双方冻结（输入/AI/命中暂停，回合计时不走）
  if(state.intro > 0){
    state.intro -= dt;
    p.vx = f.vx = 0; p.stepT = f.stepT = 0;
    p.state = f.state = 'idle';
    jumpBuf.p = 0; kickEdge = false;
  }
  const introHold = state.intro > 0;

  // 通用物理（倒地角色只计时不行动）
  for(const g of [p, f]){
    if(g.kd>0){
      g.kdT += dt;
      /* 读秒期间：双方都固定在各自角落（WT 规则：回角落再继续）。
         位置每帧硬锁，所以既不会被推挤、也不会漂移，画面稳定可读。 */
      if(state.count){
        for(const h of [p, f]){
          h.x = (h.side === 'p') ? -CORNER_X : CORNER_X;
          h.vx = 0; h.targetVx = 0; h.stepT = 0;
          h.face = (h.side === 'p') ? 1 : -1;
        }
      }
      if(g.rise < 1){
        /* 起身：用「已用时间 / 目标起身时间」的加速曲线 —— 前期慢、越到后面越快（速度逐渐增加）。
           目标时间：玩家 7.0s（狂按可大幅加速）；AI 按段位递减，黑带 0.5s。
           因为目标时间都小于 8 秒读秒，所以认真站起来不会被判 KO；
           击败对手要靠比分或「三倒判负」。 */
        const target = (g.side === 'p') ? (RISE_TIME_PLAYER * (g.riseMul || 1)) : (R().riseTime || 4.5);
        /* 狂按加速：把点击转成倍率，而不是直接加进度，这样「逐渐增加」的手感才成立 */
        if(g.side === 'p' && riseTapP > 0){ g.riseBoost = Math.min(6, (g.riseBoost || 1) + riseTapP * 2.2); riseTapP = 0; }
        g.riseBoost = Math.max(1, lerp(g.riseBoost || 1, 1, dt * 0.9));   // 倍率慢慢回落到 1
        /* AI 不加额外倍率：RANKS[].riseTime 本身已编码段位速度（黑带 0.5s），
           再叠乘一次会让它快于设计值 */
        g.riseT = (g.riseT || 0) + dt * (g.riseBoost || 1);
        g.rise = Math.min(1, Math.pow(Math.min(1, g.riseT / target), 1.8));
        // 读秒报数
        const newNum = Math.ceil(8 - g.kdT);
        if(newNum < state.countNum && newNum >= 1){ state.countNum = newNum; sfx('tick', .3); }
        if(g.rise >= 1){
          g.kd = 0; g.kdT = 0; g.state='idle'; g.freeze=.5; g.rise=0; g.riseT=0; g.riseBoost=1;
          g.y = 0; g.airborne=false; g.jumpV=0; g.jumpH=0;   // 必须归零 y，否则空中被击倒会永久浮空
          g.invuln = 1.0;                    // 起身后 1 秒无敌，避免刚站起来就连吃第二下
          // 读秒起身：恢复 30% 体能继续比赛（否则空血条打到底，一碰就再倒）
          g.hp = Math.max(g.hp, Math.round(g.maxHp * .3));
          g.hpDisp = g.hp;
          if(state.count === g.side) state.count = null;   // 读秒结束
        } else if(g.kdT >= 8){
          g.kd = 0; g.kdT = 0; g.state='kd'; g.rise = 1;
          announce('KO 判负', 1.6, '#ff3b5c');
          if(state.count === g.side) state.count = null;
        }
      }
      if(g.kd <= 0) continue;
    }

    // 跳跃物理
    /* 保险丝：非滞空状态绝不能残留高度 —— 否则空中被击倒会让角色永久浮空 */
    if(!g.airborne && g.y) g.y = 0;
    if(g.airborne){
      g.y = (g.y||0) + g.jumpV*dt;
      g.jumpV -= 900*dt;                 // 重力
      g.x += g.jumpH*dt;
      g.jumpH = lerp(g.jumpH, 0, dt*2);
      if(g.y <= 0){
        g.y = 0; g.airborne = false; g.jumpV = 0; g.jumpH = 0;
        sfx('punch', .12);
        const landedFlyKick = g.flyKick;
        if(landedFlyKick){
          g.flyKick = false;
          if(g.state==='kick') g.state='idle';
          /* 飞踢落地硬直 —— 这里正是它「赖皮」的根源：
             原来只有 0.08s，而 1.1s 冷却在约 1s 的滞空里已经走完，
             落地即可再起跳，对手几乎无法惩罚。现在给一段真实的收招后可被反击的窗口。
             底牌「飞踢无僵直」可以免掉这段硬直（flyKickFree）。 */
          if(g.flyKickFree){
            // 底牌只免飞踢落地后摇；滞空未耗完的冷却和连按缓存也要清掉，
            // 否则看似站稳却不能出招，或下一次踢误触发下劈。
            g.cool = 0;
            g.kickBuf = []; g.kickBufT = 0;
            g.freeze = 0;
          } else {
            g.freeze = Math.max(g.freeze, .40);
            g.cool   = Math.max(g.cool, .55);
          }
        }
        if(g.cast==='spinx'){ g.cast=''; g.castT=0; }
        if(!landedFlyKick || !g.flyKickFree) g.freeze = Math.max(g.freeze, .08);
      }
    }
    g.x += g.vx * dt;
    g.vx = lerp(g.vx, 0, dt * 5);
    if(g.state==='idle' && g.freeze>0) g.freeze -= dt;
    g.cool = Math.max(0, g.cool - dt);
    g.invuln = Math.max(0, (g.invuln || 0) - dt);   // 起身无敌倒计时
    g.flash = Math.max(0, g.flash - dt);
    // 连击窗口
    g.comboT = Math.max(0, g.comboT - dt);
    // 血条损伤延迟（视觉缓动）
    g.hpDisp = (g.hpDisp === undefined) ? g.hp : lerp(g.hpDisp, g.hp, Math.min(1, dt*2.5));
    // ——失控保险丝：任何路径卡死的动作状态强制恢复——
    if(g.cast){
      g.castT = (g.castT||0) + dt;
      if(g.castT > 2){ g.cast=''; g.castT=0; g.phase=0; g.cyc=0; g.spinP=0; g.flyKick=false; if(g.state==='kick') g.state='idle'; }
    } else if(g.castT){ g.castT = 0; }
    if(g.state==='kick' && g.stT > 2.0){ g.state='idle'; g.cast=''; g.flyKick=false; g.phase=0; hitLocks.delete(g); }
    if(g.state==='attack' && g.stT > 0.6){ g.state='idle'; }
    // 踢击轨迹衰减
    if(g.kickTrail && g.kickTrail.length){
      for(let i=g.kickTrail.length-1;i>=0;i--){ g.kickTrail[i].life -= dt; if(g.kickTrail[i].life <= 0) g.kickTrail.splice(i,1); }
    }
    // 落地尘环：下劈收腿砸地（一次性）
    if(g.cast==='axe' && g.stT > .38 && !g._dust){ g._dust = true; dustRing(g); }
    if(g.cast!=='axe' && g._dust) g._dust = false;
    // 步态/呼吸幅度缓动
    const moving = Math.abs(g.vx) > 40 && g.grounded && g.kd<=0;
    if(moving){
      g.stepT += dt;
      g.swingAmp = Math.min(1, (g.swingAmp||0) + dt*7);
    } else {
      g.swingAmp = Math.max(0, (g.swingAmp||0) - dt*7);
      if((g.swingAmp||0) === 0) g.stepT = 0;
    }
    g.bobAmp = lerp(g.bobAmp || 0, (g.state==='idle' && g.cast==='' && g.grounded && g.kd<=0) ? 1 : 0, Math.min(1, dt*12));
    // 踢击缓冲（连按→旋风踢）
    g.kickBufT -= dt;
    if(g.kickBufT <= 0) g.kickBuf = [];
    // 旋风踢分阶段推进：0 蓄力撤步转身 → 1 转体 360° → 2 后腿横扫踢出 → 3 收势
    if(g.cast==='spinx'){
      if(g.phase === undefined) g.phase = 0;
      if(g.phase === 0){
        g.windup += dt;
        g.cyc = g.windup / .22 * .5;
        g.vx = lerp(g.vx, -g.face * 120, dt*6);   // 向后撤步
        if(g.windup > .22){ g.phase = 1; }
      } else if(g.phase === 1){
        g.cyc += dt * (0.5 / .4);
        g.spinP += dt * (360 / .4);                // 记录转体角度（得分判定用）
        g.vx = g.face * 40;
        if(g.cyc >= 1){ g.cyc = 1; g.phase = 2; g.stT = 0; }
      } else if(g.phase === 2){
        // 后腿横扫踢出（前旋踢）——命中窗口
        g.stT += dt;
        g.vx = g.face * 300;                       // 前冲踢出
        if(g.stT > .22){ g.phase = 3; dustRing(g); }
      } else if(g.phase === 3){
        g.vx = lerp(g.vx, 0, dt*4);
        g.phase = 4;
      } else {
        g.cyc = lerp(g.cyc, 0, dt*6);
        if(Math.abs(g.cyc) < .06){ g.cast=''; g.castT=0; g.phase=0; g.spinP=0; g.state='idle'; }
      }
    }
    // 侧踢前冲踹（yop chagi：踹出的同时身体推进）
    if(g.cast==='side' && g.stT < .3 && g.state==='kick') g.vx = g.face * 190;
    // 粒子
    for(let i=g.particle.length-1;i>=0;i--){
      const pt = g.particle[i];
      pt.life -= dt; pt.x += pt.vx*dt; pt.y += pt.vy*dt; pt.vy += 15*dt;
      if(pt.life<=0) g.particle.splice(i,1);
    }
  }

  // KO 读秒流程（在通用物理后统一处理）
  if(state.mode===STATE.fight && state.count){
    state.countT += dt;
    const vic = (state.count==='p') ? p : f;
    if(vic.rise >= 1 && vic.kd <= 0){
      state.count = null;
    }
  }

  // 回合判定：分数制 + KO（读秒结束未起身即判负）
  if(state.mode===STATE.fight && !state.count){
    if(f.kd>0 || f.rise>=1){ if(!f.roundDone){ f.roundDone = true; roundWins++; sfx('win'); endRound(); } }
    else if(p.kd>0 || p.rise>=1){ if(!p.roundDone){ p.roundDone = true; aiWins++; sfx('lose'); endRound(); } }
  }

  // 玩家输入（仅可行动时；开局倒计时与面板/结算期间冻结）
  if(p.canAct() && !introHold && !inputLocked()){
    if(p.holdBlock){
      if(p.state==='idle') p.state='block';
      p.cool = Math.max(p.cool, .25);
    }
    const mv = isDown('right') - isDown('left');
    if(mv !== 0){ p.vx = mv * 230; }
    // 始终面向对手（格斗惯例：移动只分前进步/后退步，不随移动方向翻面）
    p.face = ai.x > p.x ? 1 : -1;
    if(kickEdge){ kickEdge = false; tryKick(player); }
    if(jumpBuf.p > 0){
      jumpBuf.p -= dt;
      if(!p.airborne){ p.airborne = true; p.y = 0; p.jumpV = 520; }
    }
  } else {
    jumpBuf.p = 0;
  }

  // 出招命中判定（读秒期间不判定，WT 规则：击倒后读秒，对方不得进攻）
  const checks = [
    { f:p, t:f }, { f:f, t:p }
  ];
  for(const c of checks){
    if(state.count || introHold) break;
    const g = c.f;
    const spinxHit = g.cast==='spinx' && g.phase === 2;
    const hitting = spinxHit || g.state==='attack' || g.state==='kick';
    if(hitting && !hitLocks.has(g)){
      // 后踢(back)前摇延后：由 0.14s 放宽至 0.22s（留出清晰的转身蓄力前摇，给玩家/AI 充足的格挡反应时间）
      const delay = g.cast==='spinx' ? .04 : (g.cast==='back' ? .22 : (g.cast==='axe' ? .3 : (g.cast==='side' ? .2 : (g.state==='kick' ? (g.flyKick ? .18 : .24) : .05))));
      if(g.stT > delay){
        resolveHit(g, c.t);
        hitLocks.add(g);
      }
    }
    if(!hitting) hitLocks.delete(g);
  }
  for(const g of [p,f]) g.stT += dt;

  /* 行为统计（供 Jev 战术层判断习惯）：最近动作序列 + 防守时长占比 */
  if(state.mode===STATE.fight && !state.count){
    for(const g of [p,f]){
      g.aliveT = (g.aliveT||0) + dt;
      if(g.state==='block') g.defendT = (g.defendT||0) + dt;
      const kind = g.state==='kick' ? (g.cast || 'kick') : (g.state==='attack' ? 'punch' : null);
      if(kind){ if(g._lastKind !== kind) noteAct(g, kind); }
      g._lastKind = kind;
    }
  }

  // WT 场地规则：出界判罚（gam-jeom：对方 +1 分，拉回场内）；出界余量随场地宽度收缩
  const obGrace = clamp(COURT * .18, 18, 42);
  const RING_LIMIT = COURT + obGrace;
  if(state.mode===STATE.fight && !state.count){
    state.gamT = Math.max(0, (state.gamT||0) - dt);
    for(const g of [p,f]){
      if(g.kd>0) continue;
      const over = Math.abs(g.x) - COURT;    // 世界坐标：场地中心为 0
      if(over > obGrace && state.gamT <= 0){
        if(g.side==='p') scoreA += 1; else scoreP += 1;
        addFloat(g.x, g.h + 30, '出界判罚', '#ff8fa3', 16);
        addFloat(g.x, g.h + 4, '对方 +1', '#ffb3c0', 14);
        g.vx = -Math.sign(g.x) * 430;       // 朝场内弹回（速度自然衰减滑回）
        state.gamT = .6;                          // 判罚防抖（弹回期间不再判）
        sfx('guard', .5);
      }
      g.x = clamp(g.x, -(RING_LIMIT + 20), RING_LIMIT + 20);
    }
  } else {
    p.x = clamp(p.x, -RING_LIMIT, RING_LIMIT);
    f.x = clamp(f.x, -RING_LIMIT, RING_LIMIT);
  }
  /* 面对面推挤：按「谁在往对方方向动」分摊位移。
     原实现只移动玩家（p.x = f.x ± gap），于是 AI 只要朝前压，
     碰撞就把【玩家】一路推到墙角卡死 —— 出招时的前冲（尤其飞踢 175 单位）更明显。
     现在主动前压的一方承担更多位移：双方都不动时才平分。 */
  const gap = (p.w + f.w)/2 + 12;
  const dx = f.x - p.x;
  if(Math.abs(dx) < gap){
    const overlap = gap - Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;                 // 从玩家指向 AI 的方向
    const pToward = Math.max(0,  p.vx * dir);     // 玩家朝 AI 的速度分量
    const fToward = Math.max(0, -f.vx * dir);     // AI 朝玩家的速度分量
    const tot = pToward + fToward;
    const pShare = tot > 1 ? pToward / tot : 0.5; // 谁在动，谁多担
    p.x -= dir * overlap * pShare;
    f.x += dir * overlap * (1 - pShare);
  }
  p.x = clamp(p.x, -RING_LIMIT, RING_LIMIT);
  f.x = clamp(f.x, -RING_LIMIT, RING_LIMIT);

  // 回合计时（WT：每回合限时，时间到按得分判胜负；开局倒计时期间不走表）
  if(state.mode===STATE.fight && !state.count && !f.roundDone && !p.roundDone && !introHold){
    state.roundTime -= dt;
    if(state.roundTime <= 0){
      state.roundTime = 0;
      if(scoreP > scoreA){ p.roundDone = true; roundWins++; sfx('win'); }
      else { f.roundDone = true; aiWins++; sfx('lose'); }
      announce('时间到', 1.3, '#fbbf24');
      endRound();
    }
  }

  // AI 思考
  if(state.mode===STATE.fight && !introHold) aiThink(dt, t);
  /* Jev 战术层：到点就异步问一次（单次在途，不阻塞主循环） */
  if(typeof jevTick === 'function') jevTick(t);
}
