/* 跆拳道 · AI 对战 —— alloc
   决战前的「底牌分配」。

   规则：黑带第一阶段（Boss 超级复活之前）打出的 WT 得分，按 **10 分 = 1 张底牌**
   折算；Boss 复活、进入最终决战前弹出面板，用底牌兑换增益。

   设计意图：让第一阶段的发挥真正影响决战难度 —— 打得好，手里就有底牌。 */

const ALLOC_PTS_PER = 10;     // 每 10 分 = 1 张底牌

/* 底牌表。cost 为所需底牌数；可重复选取（点数多于选项数时不浪费）。 */
const ALLOC_BUFFS = [
  { id:'hp',    name:'铁壁', desc:'血量上限 +30%（立即回满）', cost:1,
    apply(p){ p.maxHp = Math.round(p.maxHp * 1.3); p.hp = p.maxHp; p.hpDisp = p.maxHp; } },
  { id:'dmg',   name:'重击', desc:'造成的伤害 +25%', cost:1,
    apply(p){ p.dmgMul = (p.dmgMul || 1) * 1.25; } },
  { id:'life',  name:'不倒', desc:'额外获得一次倒地机会', cost:1,
    apply(p){ p.kdLimit += 1; } },
  { id:'rise',  name:'坚韧', desc:'起身更快（起身耗时 −40%）', cost:1,
    apply(p){ p.riseMul = (p.riseMul || 1) * 0.6; } },
  { id:'fly',   name:'飞踢无僵直', desc:'飞踢落地不再有收招硬直，落地即可续招', cost:2,
    apply(p){ p.flyKickFree = true; } },
];

const ALLOC = { pts:0, left:0, taken:{} };

/* 可分配的底牌数（按当前回合得分折算） */
function allocPoints(){ return Math.floor(Math.max(0, scoreP) / ALLOC_PTS_PER); }

function openAlloc(){
  ALLOC.pts = allocPoints();
  ALLOC.left = ALLOC.pts;
  ALLOC.taken = {};
  state.alloc = true;                     // 冻结模拟（update() 会提前返回）
  // 致命一击遗留的震屏/白闪/慢动作也必须暂停：frame() 在冻结期间仍会
  // 调用 updateCam() 和绘制世界层，否则面板会跟着随机震屏持续抖动。
  shakeT = 0; shakeAmp = 0;
  CAM.shakeX = 0; CAM.shakeY = 0;
  flashA = 0; slowT = 0;
  clearInputs();                          // 丢掉冻结瞬间可能按住的键，避免残留
  const k = $('allocKicker');
  if(k) k.textContent = 'SUPER REVIVAL · 最终决战准备';
  $('allocScore').textContent = scoreP;
  renderAlloc();
  $('allocPanel').classList.add('show');
  track('alloc_open', { scoreP, pts: ALLOC.pts, rank: R().name });
}

function renderAlloc(){
  const list = $('allocList');
  list.innerHTML = '';
  for(const b of ALLOC_BUFFS){
    const n = ALLOC.taken[b.id] || 0;
    const cost = b.cost || 1;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'alloc-card';
    el.disabled = ALLOC.left < cost || (b.id === 'fly' && n > 0);
    el.innerHTML = '<b>' + b.name + (n ? ' ×' + n : '') +
                   '<i class="alloc-cost">' + cost + ' 底牌</i></b><span>' + b.desc + '</span>';
    el.addEventListener('click', () => spendBuff(b));
    list.appendChild(el);
  }
  $('allocPts').textContent = ALLOC.left;
}

function spendBuff(b){
  const cost = b.cost || 1;
  if(ALLOC.left < cost) return;
  ALLOC.left -= cost;
  ALLOC.taken[b.id] = (ALLOC.taken[b.id] || 0) + 1;
  b.apply(player);
  sfx('tick', .4);
  renderAlloc();
}

function closeAlloc(){
  if(!state.alloc) return;
  $('allocPanel').classList.remove('show');
  state.alloc = false;
  clearInputs();                          // 清掉面板期间可能的残留输入
  track('alloc_confirm', { taken: ALLOC.taken, spent: ALLOC.pts - ALLOC.left, scoreP });
  /* 演出放在「确认开战」这一刻：冻结期间 update 不推进，
     放在复活瞬间只会定格成一帧静止画面（白闪还会一直挂着） */
  announce('最终决战！', 1.8, '#fbbf24');
  flashA = 1.0; slowT = 1.0; shake(18, .8);
  burst(player, 24, '#9beaff', 9);
  burst(ai, 64, '#fbbf24', 15);
  rings.push({ x:ai.x, y:ai.h*.55, dur:1.0, life:1.0, r0:20, r1:360, color:'#fde047', lw:7 });
  rings.push({ x:player.x, y:player.h*.55, dur:.8, life:.8, r0:14, r1:260, color:'#9beaff', lw:5 });
  sfx('bell', .5);
}

/* 每局重置底牌增益（血量/kdLimit 由 Fighter.reset 负责，这里清倍率与开关） */
function resetAlloc(){
  player.dmgMul = 1;
  player.riseMul = 1;
  player.flyKickFree = false;
  ALLOC.pts = 0; ALLOC.left = 0; ALLOC.taken = {};
}
