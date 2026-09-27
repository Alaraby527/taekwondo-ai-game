/* 跆拳道 · AI 对战 —— round
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 回合流程（WT 计分 · 三局两胜回合制） ----------
   按国际 WT 2024 竞赛规则：一场 3 回合，每回合结束时该回合得分高者拿到
   「回合优胜」，先拿到 2 个回合优胜者赢得对局；平分判优势方（游戏内判 AI）。
   分差达 12 分该回合立即结束（回合优胜者产生）；同一回合 4 次 Gam-jeom 判负。
   击倒后 10 秒读秒。段位晋级是唯一的长期进度线。 */
function WIN_NEED(){ return 2; }
const POINT_GAP = 12;      // 分差终结线（WT 规则）
const GAMJEOM_LIMIT = 4;   // 同一回合累计 4 次判罚 → 判负
let roundMsg = '', roundMsgT = 0, roundNum = 1;
let matchRecorded = false;    // 防止同一场对局被记录两次
function startRound(){
  const hp = Math.round(R().hp * .7);
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
  state.gamP = 0; state.gamA = 0;       // 本回合判罚计数（4 次判负）
  state.count = null; state.countT = 0; state.countNum = 10; state.gamT = 0;
  state.intro = 1.8;                    // 开局倒计时（双方冻结；快速节奏，1.8 秒）
  state.roundTime = R().roundTime || 30;// 各段位回合时长（正式比赛每局 2 分钟，游戏内压缩）
  hitLocks.clear();
  simClear();                           // 清掉上一局遗留的仿真时间回调
  if(typeof resetAlloc === 'function') resetAlloc();   // 清空决战增益
  sparks = []; rings = []; floats = []; flashA = 0; slowT = 0;
  sfx('bell', .35);
  roundMsg = `第 ${roundNum} 回合 · VS ${R().name} AI`; roundMsgT = 1.8;
  state.mode = STATE.fight;
}
/* 回合得分变动后统一走这里：检查 12 分分差（该回合立即结束）与 4 次判罚判负 */
function scoreCheck(leader){
  if(state.mode !== STATE.fight) return;
  if(Math.abs(scoreP - scoreA) >= POINT_GAP){
    if(scoreP > scoreA){ player.roundDone = true; roundWins++; sfx('win'); }
    else { ai.roundDone = true; aiWins++; sfx('lose'); }
    announce('分差 12 · 回合结束', 1.6, '#fbbf24');
    endRound();
    return;
  }
  if((state.gamP||0) >= GAMJEOM_LIMIT && leader === 'a'){ ai.roundDone = true; aiWins++; sfx('lose'); announce('4 次判罚 · 判负', 1.6, '#ff3b5c'); endRound(); return; }
  if((state.gamA||0) >= GAMJEOM_LIMIT && leader === 'p'){ player.roundDone = true; roundWins++; sfx('win'); announce('4 次判罚 · 判负', 1.6, '#ff3b5c'); endRound(); return; }
}
function endRound(){
  state.mode = STATE.over; state.overTimer = 0.9;   // 快速过场（摊位节奏）
  state.count = null;
  track('round_end', {
    round: roundNum, mode: 'single',
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
      ? `你击败了 ${R().name} AI。旋转踢打躯干 4 分、踢中头部 5 分，反击是得分利器。`
      : `${R().name} AI 太强了，看准它的出招前摇再反击，多用地踢和格挡！`;
  // 段位晋级徽章
  const promo = $('promoBox');
  if(canPromote){
    const nxt = RANKS[rankIdx+1];
    promo.classList.add('show');
    $('promoSwatch').style.background = nxt.color;
    $('promoSwatch').style.color = nxt.color === '#1f2937' ? '#4b5563' : nxt.color;
    $('promoName').textContent = `晋级 · ${nxt.name}`;
    $('promoDesc').textContent = `下一个对手：${nxt.name} AI · ${nxt.tag}`;
    $('btn-re').textContent = `晋级挑战 · ${nxt.name}`;
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
      win, rank: R().name, mode: 'single',
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
      /* 持久化：段位推进（家庭用户下次可「继续上次」） */
      if(typeof SAVE !== 'undefined'){ SAVE.rankIdx = rankIdx; writeSave(); }
    } else {
      /* 已是黑带宗师（最高段位）：通关后再战不该改变段位，也不能再次弹结算面板。
         原实现在这里 `gameOver(true); return;` —— 结果「再战一局」点下去只是把
         结算面板重新弹一遍，而且 roundWins 未重置，点击永远死循环。 */
      state.winStreak++;
    }
  } else {
    state.winStreak = 0;
  }
  // 胜负均已结算：留在当前段位重赛
  roundWins = 0; aiWins = 0; roundNum = 1;
  startRound();
}

/* 从引导页进入 = 新的一次游玩（摊位是共用设备，必须回到白带起） */
function resetSession(){
  rankIdx = 0;
  roundWins = 0; aiWins = 0; roundNum = 1;
  state.winStreak = 0;
}

