/* 跆拳道 · AI 对战 —— persist
   段位进度持久化（原先完全缺失：rankIdx 只是内存变量，README 却声称会存 localStorage）。

   注意一个设计张力：摊位是**共用设备**，上一个人的进度不该留给下一个人；
   但分享链接的**家庭用户**希望下次回来能接着打。
   解法：从引导页「开始挑战」＝全新开始（摊位语义）；
        引导页额外提供「继续上次 · X带」按钮＝恢复进度（家庭用户语义）。 */

const SAVE_KEY = 'tkd.save.v1';
const SAVE = { rankIdx: 0, winStreak: 0, visits: 0, played: 0, won: 0 };

function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw) Object.assign(SAVE, JSON.parse(raw) || {});
  }catch(e){ /* 隐私模式/禁用存储：静默降级为不持久化 */ }
  SAVE.visits = (SAVE.visits || 0) + 1;
  writeSave();
  return SAVE;
}

function writeSave(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); }catch(e){}
}

/* 有可恢复进度吗（非白带才算） */
const hasSave = () => (SAVE.rankIdx || 0) > 0;

/* 记录一局结果（在晋级判定之后调用，此时 rankIdx 已是新值） */
function recordResult(win, roundsWon, needWins){
  SAVE.rankIdx = rankIdx;
  SAVE.winStreak = state.winStreak || 0;
  SAVE.played = (SAVE.played || 0) + 1;
  if(win) SAVE.won = (SAVE.won || 0) + 1;
  writeSave();
  track(win ? 'match_win' : 'match_lose', {
    rank: R().name, quick: quickMode,
    roundsWon, needWins, winStreak: SAVE.winStreak,
    played: SAVE.played, won: SAVE.won
  });
}
