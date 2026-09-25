/* 跆拳道 · AI 对战 —— fighter
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 角色类 ---------- */
class Fighter {
  constructor(x, side, opts){
    this.x = x; this.side = side;             // 'p' 玩家 / 'a' AI
    this.w = 52; this.h = 150;
    this.face = side==='p' ? 1 : -1;          // 朝向
    this.vx = 0;
    this.hp = 100; this.maxHp = 100;
    this.attack = opts.attack || 10;
    this.kickP = opts.kickP || 0.45;          // 出腿概率
    this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.stT = 0;        // 当前动作
    this.freeze = 0;                          // 受击硬直
    this.kd = 0; this.kdT = 0;                // 倒地
    this.kdCount = 0;                         // 本回合被击倒次数（达到 kdLimit 判负）
    this.kdLimit = 3;                         // 倒地上限（黑带超级复活后会 +1）
    this.superUsed = false;                   // 黑带「超级复活」是否已用
    this.flash = 0;                           // 受击闪白
    this.cool = 0;                            // 出招冷却
    this.particle = [];
    this.stepT = 0; this.legAng = 0; this.armAng = 0; this.bob = 0;
    this.jumpV = 0; this.jumpH = 0; this.airborne = false; this.y = 0;   // 跳跃（y=跳起高度）
    this.combo = 0; this.comboT = 0;          // 连击计数与窗口
    this.kickBuf = []; this.kickBufT = 0;     // 连按踢→旋风踢
    this.cast = ''; this.castT = 0;           // 特技状态（spinx 旋风踢）
    this.cyc = 0;                             // 旋风踢旋转角（绘制用）
    this.flyKick = false;                     // 飞踢标记
    this.rise = 0; this.riseSpeed = 0;        // 读秒起身进度 / 速率
    this.riseT = 0; this.riseBoost = 1;       // 起身已用时间 / 狂按加速倍率
    this.invuln = 0;                          // 起身后的无敌时间（秒）
    this.pops = [];                           // 命中飘分（+1/+2/+3）
    this.spinP = 0;                           // 旋风踢：已转过的角度（度）
    this.spinDir = 1;                         // 旋风踢：旋转方向（绕身体纵轴）
    this.stepBack = 0;                        // 旋风踢：撤步转身蓄力（背对对手）
    this.windup = 0;                          // 旋风踢：蓄力计时
    this.phase = 0;                           // 旋风踢：0蓄力 1转体 2踢出 3收势 4结束
    this.lastPt = 0; this.lastPtT = 0;        // 最近命中得分
    this.kickTrail = [];                      // 踢击轨迹（脚部拖尾）
  }
  reset(hp){ this.hp = hp; this.maxHp = hp; this.state='idle'; this.stT=0; this.freeze=0; this.kd=0; this.kdCount=0; this.flash=0; this.cool=0; this.particle=[]; this.holdBlock=false; this.jumpV=0; this.jumpH=0; this.airborne=false; this.y=0; this.combo=0; this.comboT=0; this.kickBuf=[]; this.kickBufT=0; this.cast=''; this.castT=0; this.flyKick=false; this.rise=0; this.riseSpeed=0; this.pops=[]; this.spinP=0; this.spinDir=1; this.stepBack=0; this.windup=0; this.phase=0; this.lastPt=0; this.lastPtT=0; this.kickTrail=[]; this._dust=false; this.riseT=0; this.riseBoost=1; this.invuln=0; this.kdLimit=3; this.superUsed=false; }
  get isBusy(){ return this.state==='attack'||this.state==='kick'||this.state==='block'||this.cast!==''; }
  get grounded(){ return this.kd<=0 && !this.airborne; }
  canAct(){ return this.kd<=0 && this.freeze<=0 && this.state==='idle' && this.cast===''; }
}

const player = new Fighter(0, 'p', { attack:14, kickP:0.5 });
const ai = new Fighter(0, 'a', { attack:8, kickP:0.55 });
const R = () => RANKS[rankIdx];

/* 粒子特效 */
function burst(f, n, color, spd=5){
  for(let i=0;i<n;i++){
    const a = rand(0, Math.PI*2), s = rand(spd*.4, spd);
    f.particle.push({ x:f.x + f.face*20, y:(f.y||0) + f.h*.58,   // 世界高度：躯干上部
      vx:Math.cos(a)*s, vy:Math.sin(a)*s - 2, life:rand(.3,.7), max:0.7, r:rand(2,4.5), color });
  }
}

/* 战斗逻辑 */
/* WT 规则：正拳为单发直拳，仅可击打躯干（1 分）。实战中拳法罕见，出招间隔长（1.4s） */
function tryPunch(f){
  if(!f.canAct() || f.cool>0) return;
  if(f.state==='block') f.holdBlock = false;
  f.state = 'attack'; f.stT = 0; f.anim = 1; f.cool = 1.4;
  sfx('punch', .2);
  simLater(() => { if(f.state==='attack') f.state='idle'; }, .34);
}
function tryKick(f){
  // 连按踢序列（0.5s 窗口）：第 1 下=横踢 → 第 2 下=下劈 → 第 3 下=旋风踢（实战连招，可打断当前踢）
  /* 连按踢序列（0.5s 窗口）：第 1 下=横踢 → 第 2 下=下劈 → 第 3 下=旋风踢（实战连招，可打断当前踢）
     注：用仿真时间 SIM_T 而不是 performance.now()，否则连招窗口在低帧率下会失真 */
  const now = SIM_T;
  if(f.kickBuf.length>0 && now - f.kickBuf[f.kickBuf.length-1] < .5){
    f.kickBuf.push(now); f.kickBufT = .5;
    const n = f.kickBuf.length;
    if(f.state==='kick' || f.canAct()){
      if(n >= 3){ f.kickBuf = []; f.kickBufT = 0; startSpinx(f); }
      else startAxe(f);
    }
    return;
  }
  if(!f.canAct() || f.cool>0) return;
  // 空中出腿 → 飞踢（前冲）
  if(f.airborne){ startFlyingKick(f); return; }
  if(f.side==='p'){
    const toward = ai.x > f.x ? 1 : -1;
    // 后退中按踢 → 后踢（dwit chagi：转身后蹬，旋转技 3 分）
    if((toward===1 && isDown('left')) || (toward===-1 && isDown('right'))){
      startBackKick(f); return;
    }
    // 前进中按踢 → 侧踢（yop chagi：前冲直线踹）
    if((toward===1 && isDown('right')) || (toward===-1 && isDown('left'))){
      startSide(f); return;
    }
  }
  // 横踢（dollyo chagi）：比赛主力技术（弧线横扫），提膝→转髋弧线弹腿
  f.kickBuf.push(now);
  f.kickBufT = .5;
  if(f.state==='block') f.holdBlock = false;
  f.state = 'kick'; f.stT = 0; f.anim = 1.6; f.cool = 0.85;
  sfx('kick', .3);
  simLater(() => { if(f.state==='kick' && !['spinx','back','axe','side'].includes(f.cast)) f.state='idle'; }, .5);
}
function startAxe(f){
  // 下劈（naeryo chagi）：直腿从头上方弧线劈下，主打头部（3 分）
  if(f.state==='block') f.holdBlock = false;
  f.cast = 'axe'; f.castT = 0; f.state = 'kick'; f.stT = 0; f.cool = 1.05; f.phase = 0;
  f.face = f.side==='p' ? (ai.x > f.x ? 1 : -1) : (player.x > f.x ? 1 : -1);
  hitLocks.delete(f);
  sfx('kick', .35);
  simLater(() => { if(f.cast==='axe'){ f.cast=''; if(f.state==='kick') f.state='idle'; } }, .72);
}
function startSide(f){
  // 侧踢（yop chagi）：翻髋折叠 → 前冲直线踹（脚跟领先）
  if(f.state==='block') f.holdBlock = false;
  f.cast = 'side'; f.castT = 0; f.state = 'kick'; f.stT = 0; f.cool = 1.0; f.phase = 0;
  f.face = f.side==='p' ? (ai.x > f.x ? 1 : -1) : (player.x > f.x ? 1 : -1);
  hitLocks.delete(f);
  sfx('kick', .3);
  simLater(() => { if(f.cast==='side'){ f.cast=''; if(f.state==='kick') f.state='idle'; } }, .64);
}
function startBackKick(f){
  // 后踢（dwit chagi）：转身背对瞬间以脚跟蹬击躯干——旋转技术，3 分
  if(f.state==='block') f.holdBlock = false;
  f.cast = 'back'; f.state = 'kick'; f.stT = 0; f.cool = 1.15;
  f.face = f.side==='p' ? (ai.x > f.x ? 1 : -1) : (player.x > f.x ? 1 : -1);  // 踢向对手方向
  f.kickBuf = []; f.kickBufT = 0;
  hitLocks.delete(f);   // 独立动作，允许重新判定命中
  sfx('kick', .35);
  simLater(() => { if(f.cast==='back'){ f.cast=''; if(f.state==='kick') f.state='idle'; } }, .48);
}
function startFlyingKick(f){
  // 飞踢：助跑起跳 → 腾空屈膝上提 → 空中出腿前伸 → 落地
  // 注意：滞空约 1s，落地硬直与惩罚窗口在 update.js 的落地分支里设置
  f.state = 'kick'; f.stT = 0; f.anim = 1.9; f.cool = 1.1;
  f.jumpV = 460; f.jumpH = f.face * 400; f.airborne = true;   // 跃起前冲（弧线更高）
  f.flyKick = true;   // 标记飞踢
  sfx('kick', .4);
  simLater(() => { if(f.state==='kick' && !f.flyKick) f.state='idle'; }, .46);
}
function startSpinx(f){
  // 旋风踢（标准动作）：撤步转身蓄力（背对对手）→ 转体 360° 后腿横扫前旋踢 → 落地
  f.cast = 'spinx'; f.castT = 0;          // 分阶段：0蓄力 → 1旋转 → 2踢出
  f.state = 'kick'; f.stT = 0;            // 视为踢击（得分按踢算）
  f.cyc = 0; f.spinP = 0;
  f.phase = 0;                            // 阶段归零（连招打断后残留会跳阶段）
  f.stepBack = 40;                        // 撤步距离（先向后退半步）
  f.windup = 0;                           // 蓄力计时
  f.spinDir = f.face;                     // 旋转方向 = 朝向
  f.cool = 1.1;
  hitLocks.delete(f);   // 旋风踢是独立新动作，允许重新判定命中
  sfx('kick', .4);
}
function tryBlock(f, dur=0.5){
  if(!f.canAct()) return;
  f.state = 'block'; f.stT = 0; f.cool = 0.4;
  simLater(() => { if(f.state==='block') f.state='idle'; }, dur);
}

/* 检测攻击命中：f 攻击方，t 防守方 */
function resolveHit(f, t){
  if(t.invuln > 0) return;   // 起身后 1 秒无敌：刚站起来不该连吃第二下
  const r = f.cast==='spinx' ? 130 : (f.cast==='back' ? 96 : (f.cast==='side' ? 105 : (f.cast==='axe' ? 88 : (f.state==='kick' ? 100 : 70))));
  const dist = Math.abs(t.x - f.x) - (f.w + t.w)/2;
  const inRange = dist < r;
  const facing = Math.sign(t.x - f.x) === f.face;
  if(!inRange || !facing) return;

  // 连击：窗口内连续命中 → 伤害递增
  let combo = f.combo;
  if(f.comboT <= 0) combo = 0;          // 窗口过期重置
  combo++;
  f.combo = combo; f.comboT = 1.0;

  // ---- WT 竞技得分规则（按技术类型） ----
  const isKick = f.state==='kick';
  const isSpinning = f.cast==='spinx' || f.cast==='back';
  const toHead = isKick && ((f.flyKick && f.airborne) || f.cast==='spinx' || f.cast==='axe');
  let pt = 0;
  if(isKick){
    pt = toHead ? 3 : 2;
    if(isSpinning) pt += 1;            // 旋转技术 +1
  } else {
    pt = 1;                            // 正拳（仅躯干）
  }

  const base = f.state==='kick' ? f.attack*1.6 : f.attack;
  let dmg = base * (1 + Math.min(combo-1, 3) * 0.14);   // 最多叠 3 段
  if(f.cast==='spinx') dmg = base * 1.9;                 // 旋风踢高伤
  if(f.flyKick) dmg = base * 1.15;                       // 飞踢加成（同时它有 0.4s 落地硬直可被反击）

  const hitX = t.x - t.face*10, hitY = t.h*.62;   // 世界高度（命中点在头部附近）

  if(t.state === 'block' && t.grounded){
    // 格挡成功（连击重置，不算分）
    f.combo = 0; f.comboT = 0;
    sfx('guard', .3);
    hitSpark(hitX, hitY, '#fbbf24', false);
    addFloat(hitX, hitY + 26, '格挡', '#fde68a', 15);
    burst(t, 8, '#fbbf24', 4);
    t.freeze = Math.max(t.freeze, .18);
    return;
  }
  // 命中
  if(f.side==='p') scoreP += pt; else scoreA += pt;
  t.freeze = .32;
  t.flash = .2;
  t.hp -= dmg;
  sfx('hit', .45);
  const heavy = f.cast==='spinx' || pt >= 3;
  shake(heavy ? 11 : 4.5, heavy ? .3 : .16);
  hitStopT = heavy ? .09 : .05;   // 命中定格（打击感）
  hitSpark(hitX, hitY, f.side==='p' ? '#9beaff' : '#ff9db0', heavy);
  addFloat(hitX + rand(-8,8), hitY + 30, `+${pt}`, f.side==='p' ? '#fde047' : '#fda4af', heavy ? 26 : 21);
  burst(t, heavy ? 26 : 14, f.side==='p' ? '#ff3b5c' : '#22d3ee', heavy ? 8 : 6);
  // 击退
  t.vx = f.face * (f.cast==='spinx' ? 9 : 6);
  if(f.cast==='spinx') t.vx += f.face * 2;
  if(t.hp <= 0) knockdown(t, f);
}

function knockdown(t, f){
  // 倒地判负（职业踢拳规则）：同一回合被击倒达到 kdLimit 次即输掉该回合（默认 3 次）
  t.kdCount = (t.kdCount || 0) + 1;

  /* —— 黑带宗师的「超级复活」——
     黑带 AI 达到倒地上限时不死，而是满血复活并【额外获得一次倒地机会】
     （kdLimit += 1），因此它要被打倒 4 次才会真正判负。
     只对黑带 AI 生效，玩家规则完全不变。每回合只触发一次。 */
  const isBoss = (t.side === 'a') && rankIdx >= RANKS.length - 1;
  if(isBoss && !t.superUsed && t.kdCount >= t.kdLimit){
    t.superUsed = true;
    t.kdLimit += 1;                       // 额外增加一次倒地次数
    t.hp = t.maxHp; t.hpDisp = t.maxHp;   // 满血
    t.kd = 0; t.kdT = 0; t.state = 'idle';
    t.airborne = false; t.jumpV = 0; t.jumpH = 0; t.y = 0;
    t.cast = ''; t.castT = 0; t.flyKick = false;
    t.rise = 0; t.riseT = 0; t.riseBoost = 1;
    t.invuln = 2.0;                       // 复活瞬间无敌，避免刚站起来又被连击
    t.freeze = .6;
    t.vx = 0; t.targetVx = 0;
    if(state.count === t.side) state.count = null;   // 取消本次读秒

    /* —— 二阶段：双方重置位置 + 时间恢复 60 秒 ——
       曾经这里还把场地翻倍（COURT 300→600）。但实测那是「纯缩放」而非玩法变化：
       踢击判定距离约 152，而移动速度/攻击距离/出界余量都没变，
       于是多出来的场地无人使用 —— 翻倍后两人占用半径反而从 76% 掉到 34%，
       镜头也只框住两人，玩家根本感受不到。已回退。 */
    const off = clamp(COURT * .5, 80, 150);           // 重置到开局站位（对称于场地中心）
    player.x = -off; ai.x = off;
    player.face = 1; ai.face = -1;
    for(const g of [player, ai]){ g.vx = 0; g.targetVx = 0; g.stepT = 0; }
    state.roundTime = 60;
    state.countNum = 8;
    state.countT = 0;

    // —— 特效：大横幅 + 全屏白闪 + 双冲击环 + 金色爆发 + 慢动作 + 震屏 ——
    announce('超级复活！', 2.4, '#fbbf24');
    flashA = 1.0; slowT = 1.2; shake(20, .9);
    burst(t, 64, '#fbbf24', 15);
    burst(t, 28, '#ffffff', 9);
    rings.push({ x:t.x, y:t.h*.55, dur:1.0, life:1.0, r0:20, r1:360, color:'#fde047', lw:7 });
    rings.push({ x:t.x, y:t.h*.55, dur:.7,  life:.7,  r0:10, r1:250, color:'#ffffff', lw:4 });
    sfx('win', .65);
    return;
  }

  if(t.kdCount >= t.kdLimit){
    t.hp = 0;
    t.kd = 8; t.kdT = 0; t.state = 'idle'; t.airborne = false; t.jumpV = 0; t.jumpH = 0; t.y = 0; t.cast=''; t.castT=0;
    burst(t, 30, '#ff3b5c', 8);
    sfx('ko', .6);
    shake(14, .55);
    flashA = .9; slowT = 1.0;
    rings.push({ x:t.x, y:t.h*.55, dur:.6, life:.6, r0:16, r1:230, color:'#ffd7de', lw:5 });
    announce('倒地判负', 1.8, '#ff3b5c');
    t.roundDone = true;
    if(t.side==='p'){ aiWins++; sfx('lose', .5); } else { roundWins++; sfx('win', .5); }
    endRound();
    return;
  }
  t.hp = 0;
  t.kd = 8; t.kdT = 0; t.state = 'idle'; t.airborne = false; t.jumpV = 0; t.jumpH = 0; t.y = 0; t.cast=''; t.castT=0;
  t.rise = 0; t.riseSpeed = 0;
  burst(t, 30, '#ff3b5c', 8);
  sfx('ko', .6);
  shake(14, .55);
  flashA = .9;            // 全屏白闪
  slowT = 1.0;            // KO 慢动作
  rings.push({ x:t.x, y:t.h*.55, dur:.6, life:.6, r0:16, r1:230, color:'#ffd7de', lw:5 });
  announce('K.O.!', 1.8, '#ff3b5c');
  t.vx = f.face * 9;
  // 进入 8 秒读秒（WT 规则：被击倒后裁判读秒，数到 8 未起身即 KO 判负）
  state.count = t.side;      // 'p' 玩家被读秒 / 'a' AI 被读秒
  state.countNum = 8;
  state.countT = 0;
  t.riseT = 0; t.riseBoost = 1; t.invuln = 0;   // 重新开始计时（起身曲线按已用时间走）
  // 读秒期间对方回到角落
  const winner = (t.side==='p') ? ai : player;
  winner.vx = -winner.face * 40;
}

