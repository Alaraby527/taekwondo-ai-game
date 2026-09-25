/* 跆拳道 · AI 对战 —— input
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 输入状态 ---------- */
const keys = {};
const touch = { left:false, right:false, kick:false, block:false, jump:false };
function isDown(dir){
  if(dir==='right') return keys['d']||keys['D']||keys['arrowright']||touch.right;
  if(dir==='left') return keys['a']||keys['A']||keys['arrowleft']||touch.left;
  if(dir==='jump') return keys['w']||keys['W']||keys['arrowup']||keys[' ']||touch.jump;
  return false;
}
const jumpBuf = { p:0, a:0 };        // 跳跃缓冲（触屏/连按）
function setJump(side){ jumpBuf[side] = .16; }
let riseTapP = 0;                    // 玩家被读秒时，按 J/K/触屏攻击键加速起身

/* 格挡需要按住：L 键 / 触屏按钮按住期间持续保持 block 状态 */
function holdBlock(v){
  if(v){
    if(player.state==='idle' && player.cast===''){ player.state='block'; player.cool = Math.max(player.cool, .3); }
    player.holdBlock = true;
  } else {
    player.holdBlock = false;
    if(player.state==='block') player.state='idle';
  }
}

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if(['a','d','w','j','k','l',' '].includes(k)) e.preventDefault();
  if(k === 'j'){ tryPunch(player); if(state.count==='p') riseTapP = Math.max(riseTapP, .25); }
  if(k === 'k' && !e.repeat){ tryKick(player); if(state.count==='p') riseTapP = Math.max(riseTapP, .3); }       // e.repeat 过滤按住连发
  if(k === ' ' || k === 'w' || k === 'arrowup') setJump('p');
  if(k === 'l') holdBlock(true);
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  if(k === 'l') holdBlock(false);
});
/* 切窗/切后台：keyup 与 touchend 可能丢失导致按键残留（角色自己跑个不停）——全量清空 */
window.addEventListener('blur', clearInputs);
document.addEventListener('visibilitychange', () => { if(document.hidden) clearInputs(); });
function clearInputs(){
  for(const k in keys) keys[k] = false;
  touch.left = touch.right = touch.jump = touch.kick = false;
  kickEdge = false;
  jumpBuf.p = 0;
  if(player.holdBlock){ holdBlock(false); }
}

/* 触屏按钮 */
let kickEdge = false;   // 踢钮边沿触发（按住不连发）
function placeTouch(){
  const show = isTouch();
  $('touch').classList.toggle('show', show);
  if(!show) return;
  const b = (id, fn) => {
    const el = $(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(true); }, {passive:false});
    el.addEventListener('touchend', e => { e.preventDefault(); fn(false); }, {passive:false});
    el.addEventListener('touchcancel', () => fn(false));
  };
  b('t-left',  v => touch.left = v);
  b('t-right', v => touch.right = v);
  b('t-kick',  v => { touch.kick = v; if(v){ if(state.count==='p'){ riseTapP = Math.max(riseTapP, .3); } else kickEdge = true; } });
  b('t-block', v => holdBlock(v));
  b('t-jump',  v => { touch.jump = v; if(v) setJump('p'); });
}
placeTouch();

/* 竖屏提示：游戏中竖屏建议横屏（每局提示一次，可跳过） */
let portraitDismissed = false;
function checkOrientation(){
  const show = state.mode !== STATE.menu
    && H > W                       // 用逻辑视口判断，与渲染保持一致
    && !portraitDismissed;
  $('rotate-tip').classList.toggle('show', show);
}
$('btn-rotate-dismiss').addEventListener('click', () => { portraitDismissed = true; checkOrientation(); });

