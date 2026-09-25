/* 跆拳道 · AI 对战 —— main
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 页面控制 ---------- */
function showGame(){
  $('landing').classList.add('hidden');
  $('game').classList.remove('hidden');
  audio();  // 预创建音频上下文（用户手势）
  initEmbers();
  startRound();
  checkOrientation();   // startRound 之后（state.mode 已是 fight）才检测竖屏
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
  if(roundWins>=3 || aiWins>=3) nextRank();
  else startRound();
});
$('btn-home').addEventListener('click', showHome);

/* 触屏额外：双击防缩放 */
document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});

resize();
requestAnimationFrame(loop);
