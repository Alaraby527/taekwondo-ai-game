/* 跆拳道 · AI 对战 —— round
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 回合流程（WT 计分；速战单局 / 正式赛五局三胜） ----------
   quickMode=true  ：首战速战——单局决胜、30 秒、血量 ×0.65，摊位排队 90 秒内出结果
   quickMode=false ：正式赛——五局三胜、60 秒、原血量（速战获胜后解锁） */
function WIN_NEED(){ return quickMode ? 1 : 3; }
let roundMsg = '', roundMsgT = 0, roundNum = 1;
let matchRecorded = false;    // 防止同一场对局被记录两次（末段位胜利会二次进入 gameOver）
function startRound(){
  const hp = Math.round(R().hp * (quickMode ? .65 : 1));
  player.reset(hp); ai.reset(hp);
  /* Jev 战术层的行为统计按回合清零 */
  for(const g of [player, ai]){ g.recentActs=[]; g.defendT=0; g.aliveT=0; g._lastKind=null; }
  player.hpDisp = hp; ai.hpDisp = hp;
  const off = clamp(COURT * .5, 80, 150);   // 开局站位（世界坐标，对称于场地中心）
  player.x = -off; ai.x = off;
  player.face = 1; ai.face = -1;
  player.roundDone = false; ai.roundDone = false;
  matchRecorded = false;
  scoreP = 0; scoreA = 0;               // 回合得分清零
  state.count = null; state.countT = 0; state.countNum = 8; state.gamT = 0;
  state.intro = quickMode ? 2.4 : 3.2;  // 开局倒计时（双方冻结）
  state.roundTime = quickMode ? 30 : 60;// 速战 30 秒 / 正式赛 60 秒
  hitLocks.clear();
  sparks = []; rings = []; floats = []; flashA = 0; slowT = 0;
  sfx('bell', .35);
  roundMsg = `第 ${roundNum} 回合 · VS ${R().name} AI`; roundMsgT = 1.8;
  state.mode = STATE.fight;
}
function endRound(){
  state.mode = STATE.over; state.overTimer = 1.6;
  state.count = null;
  track('round_end', {
    round: roundNum, mode: quickMode ? 'quick' : 'match',
    scoreP, scoreA, roundWins, aiWins, timeLeft: Math.round(state.roundTime)
  });
}
function afterRound(){
  if(roundWins >= WIN_NEED()){ gameOver(true); return; }
  if(aiWins >= WIN_NEED()){ gameOver(false); return; }
  roundNum++;
  startRound();
}
function gameOver(win){
  state.mode = STATE.over; state.overTimer = 0;
  const panel = $('endPanel');
  const need = WIN_NEED();
  const canPromote = win && roundWins >= need && rankIdx < RANKS.length-1;
  const isFinal = win && roundWins >= need && rankIdx >= RANKS.length-1;
  $('endKicker').textContent = 'MATCH RESULT · 对局结算';
  $('endTitle').textContent = isFinal ? '黑带宗师！' : (win ? '你赢了！' : '被 AI 击败');
  $('endTitle').className = 'op-title ' + (win ? 'win' : 'lose');
  $('endSub').textContent = isFinal
    ? '你击败了全部段位的 AI，加冕黑带宗师！到跆拳道社练真功夫吧。'
    : win
      ? `你击败了 ${R().name} AI。后踢与旋风踢是反击利器，踢头一次 3 分。`
      : `${R().name} AI 太强了，看准它的出招前摇再反击，多用地踢和格挡！`;
  // 段位晋级徽章
  const promo = $('promoBox');
  if(canPromote){
    const nxt = RANKS[rankIdx+1];
    promo.classList.add('show');
    $('promoSwatch').style.background = nxt.color;
    $('promoSwatch').style.color = nxt.color === '#1f2937' ? '#4b5563' : nxt.color;
    $('promoName').textContent = `晋级 · ${nxt.name}`;
    if(quickMode){
      // 速战获胜 → 解锁正式赛（下一次“再来一局”就是五局三胜）
      $('promoDesc').textContent = `速战告捷！下一场解锁五局三胜正式赛 · 对手 ${nxt.name} AI`;
      $('btn-re').textContent = '进入正式赛 · 五局三胜';
    } else {
      $('promoDesc').textContent = `下一个对手：${nxt.name} AI · ${nxt.tag}`;
      $('btn-re').textContent = `晋级挑战 · ${nxt.name}`;
    }
  } else if(isFinal){
    promo.classList.add('show');
    $('promoSwatch').style.background = 'linear-gradient(90deg,#e8eefc,#facc15,#38bdf8,#f97316,#111827)';
    $('promoSwatch').style.color = '#fbbf24';
    $('promoName').textContent = '段位制霸';
    $('promoDesc').textContent = '白带 → 黑带全部通关！';
    $('btn-re').textContent = '再战一局';
  } else {
    promo.classList.remove('show');
    $('btn-re').textContent = win ? '再战一局' : '再试一次';
  }
  $('stP').textContent = roundWins; $('stA').textContent = aiWins;
  $('stW').textContent = state.winStreak;
  panel.classList.add('show');
  sfx(win ? 'win' : 'lose', .5);
  /* 记录对局结果 + 持久化段位（只记一次；末段位胜利会二次进入 gameOver） */
  if(!matchRecorded){
    matchRecorded = true;
    track('match_end', {
      win, rank: R().name, mode: quickMode ? 'quick' : 'match',
      roundWins, aiWins, need, promoted: canPromote, final: isFinal
    });
    if(typeof recordResult === 'function') recordResult(win, roundWins, need);
  }
}
function nextRank(){
  const won = roundWins >= WIN_NEED();
  if(won){   // 胜利：晋级下一段位
    if(rankIdx < RANKS.length-1){
      rankIdx++;
      state.winStreak++;
    } else {
      gameOver(true);   // 已通关全部段位
      return;
    }
    /* 速战获胜 → 解锁正式赛（五局三胜） */
    quickMode = false;
    /* 持久化：段位推进（家庭用户下次可「继续上次」） */
    if(typeof SAVE !== 'undefined'){ SAVE.rankIdx = rankIdx; writeSave(); }
  } else {
    state.winStreak = 0;
  }
  // 失败（或通关后再玩）：留在当前段位重赛
  roundWins = 0; aiWins = 0; roundNum = 1;
  startRound();
}

/* 从引导页进入 = 新的一次游玩（摊位是共用设备，必须回到速战 + 白带起） */
function resetSession(){
  quickMode = true;
  rankIdx = 0;
  roundWins = 0; aiWins = 0; roundNum = 1;
  state.winStreak = 0;
}

