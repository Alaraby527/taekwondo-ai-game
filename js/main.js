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
    // 「继续上次」＝分享链接的家庭用户：恢复段位继续打
    rankIdx = clamp(SAVE.rankIdx | 0, 0, RANKS.length - 1);
  }
  initEmbers();
  startRound();
  checkOrientation();
  track('start_game', { mode: 'single', rank: R().name, resumed: !!continueSave });
}
function showHome(){
  $('game').classList.add('hidden');
  $('landing').classList.remove('hidden');
  $('endPanel').classList.remove('show');
  /* 若在决战分配面板期间返回首页，也要把它收掉并解除冻结 */
  $('allocPanel').classList.remove('show');
  state.alloc = false;
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
$('btn-alloc-go').addEventListener('click', closeAlloc);

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

/* 触屏：仅对局进行中阻止页面滚动/回弹。
   引导页、结算面板、决战分配面板必须保留正常滚动——
   否则手机上引导页滚不动，够不到开始按钮（真机踩过的坑） */
document.addEventListener('touchmove', e => {
  if(state.mode === STATE.menu) return;
  const ep = $('endPanel'); if(ep && ep.classList.contains('show')) return;
  const ap = $('allocPanel'); if(ap && ap.classList.contains('show')) return;
  e.preventDefault();
}, {passive:false});

initLanding();
resize();
initPanel();
requestAnimationFrame(loop);
