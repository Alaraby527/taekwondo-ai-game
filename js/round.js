/* 跆拳道 · AI 对战 —— round
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 回合流程（WT 五局三胜） ---------- */
let roundMsg = '', roundMsgT = 0, roundNum = 1;
function startRound(){
  const hp = R().hp;
  player.reset(hp); ai.reset(hp);
  player.hpDisp = hp; ai.hpDisp = hp;
  const off = clamp(COURT * .5, 80, 150);   // 开局站位（世界坐标，对称于场地中心）
  player.x = -off; ai.x = off;
  player.face = 1; ai.face = -1;
  player.roundDone = false; ai.roundDone = false;
  scoreP = 0; scoreA = 0;               // 回合得分清零
  state.count = null; state.countT = 0; state.countNum = 8; state.gamT = 0;
  state.intro = 3.2;                    // 开局倒计时（双方冻结）
  state.roundTime = 60;                 // WT 单回合 2 分钟，游戏内 60 秒
  hitLocks.clear();
  sparks = []; rings = []; floats = []; flashA = 0; slowT = 0;
  sfx('bell', .35);
  roundMsg = `第 ${roundNum} 回合 · VS ${R().name} AI`; roundMsgT = 1.8;
  state.mode = STATE.fight;
}
function endRound(){
  state.mode = STATE.over; state.overTimer = 1.6;
  state.count = null;
}
function afterRound(){
  if(roundWins >= 3){ gameOver(true); return; }   // 五局三胜
  if(aiWins >= 3){ gameOver(false); return; }
  roundNum++;
  startRound();
}
function gameOver(win){
  state.mode = STATE.over; state.overTimer = 0;
  const panel = $('endPanel');
  const canPromote = win && roundWins >= 3 && rankIdx < RANKS.length-1;
  const isFinal = win && roundWins >= 3 && rankIdx >= RANKS.length-1;
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
}
function nextRank(){
  if(roundWins>=3){   // 胜利：晋级下一段位（五局三胜）
    if(rankIdx < RANKS.length-1){
      rankIdx++;
      state.winStreak++;
    } else {
      gameOver(true);   // 已通关全部段位
      return;
    }
  } else {
    state.winStreak = 0;
  }
  // 失败（或通关后再玩）：留在当前段位重赛
  roundWins = 0; aiWins = 0; roundNum = 1;
  startRound();
}

