/* 跆拳道 · AI 对战 —— main
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 页面控制 ---------- */
function showGame(){
  $('landing').classList.add('hidden');
  $('game').classList.remove('hidden');
  audio();  // 预创建音频上下文（用户手势）
  resetSession();   // 每次从引导页进入都是新的一局（共用设备 → 速战 + 白带起）
  initJev();        // 换新的 fightId（代理按它计每局预算）
  initEmbers();
  startRound();
  checkOrientation();
}
function showHome(){
  $('game').classList.add('hidden');
  $('landing').classList.remove('hidden');
  $('endPanel').classList.remove('show');
  state.mode = STATE.menu;
}
$('btn-start').addEventListener('click', showGame);
$('btn-re').addEventListener('click', () => {
  $('endPanel').classList.remove('show');
  if(roundWins >= WIN_NEED() || aiWins >= WIN_NEED()) nextRank();
  else startRound();
});
$('btn-home').addEventListener('click', showHome);

/* 触屏额外：双击防缩放 */
document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});

resize();
requestAnimationFrame(loop);
