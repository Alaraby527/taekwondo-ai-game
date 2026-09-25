/* 跆拳道 · AI 对战 —— main
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 页面控制 ---------- */
function showGame(continueSave){
  $('landing').classList.add('hidden');
  $('game').classList.remove('hidden');
  audio();          // 预创建音频上下文（用户手势）
  initJev();        // 换新的 fightId（代理按它计每局预算）
  resetSession();   // 默认：全新一局（摊位＝共用设备，进度不留给下一个人）
  if(continueSave){
    // 「继续上次」＝分享链接的家庭用户：恢复段位，并直接进入正式赛
    rankIdx = clamp(SAVE.rankIdx | 0, 0, RANKS.length - 1);
    quickMode = false;
  }
  initEmbers();
  startRound();
  checkOrientation();
  track('start_game', { mode: quickMode ? 'quick' : 'match', rank: R().name, resumed: !!continueSave });
}
function showHome(){
  $('game').classList.add('hidden');
  $('landing').classList.remove('hidden');
  $('endPanel').classList.remove('show');
  state.mode = STATE.menu;
  refreshContinue();          // 刚打完可能已晋级，按钮要跟着刷新
  track('return_home', { rank: R().name, saveRank: SAVE.rankIdx });
}
$('btn-start').addEventListener('click', () => showGame(false));
$('btn-continue').addEventListener('click', () => showGame(true));
$('btn-re').addEventListener('click', () => {
  $('endPanel').classList.remove('show');
  if(roundWins >= WIN_NEED() || aiWins >= WIN_NEED()) nextRank();
  else startRound();
});
$('btn-home').addEventListener('click', showHome);

/* 「继续上次」按钮：有存档才露出。引导页加载与每次返回首页都要刷新 */
function refreshContinue(){
  const b = $('btn-continue');
  if(hasSave()){
    const r = RANKS[clamp(SAVE.rankIdx | 0, 0, RANKS.length - 1)];
    b.textContent = `继续上次 · ${r ? r.name : ''}`;
    b.classList.remove('hidden');
  } else {
    b.classList.add('hidden');
  }
}

/* 引导页初始化：恢复存档 + 埋一次曝光 + 决定要不要露出「继续上次」 */
function initLanding(){
  loadSave();
  track('landing_view', { visits: SAVE.visits || 1, returning: hasSave() });
  refreshContinue();
}

/* 触屏额外：双击防缩放 */
document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});

initLanding();
resize();
requestAnimationFrame(loop);
