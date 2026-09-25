/* 跆拳道 · AI 对战 —— fx
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 特效池（世界坐标） ---------- */
let sparks = [];      // 命中星芒 {x,y,dur,life,color,big,ang}
let rings = [];       // 冲击波环 {x,y,dur,life,r0,r1,color,lw}
let floats = [];      // 飘分 {x,y,vy,dur,life,text,color,size}
let embers = [];      // 赛场浮尘
let flashA = 0;       // 全屏白闪（KO）
let slowT = 0;        // KO 慢动作计时
function hitSpark(x, y, color, big){
  sparks.push({ x, y, dur: big?.34:.22, life: big?.34:.22, color, big: !!big, ang: rand(0, Math.PI) });
  if(big) rings.push({ x, y, dur:.4, life:.4, r0:10, r1:120, color, lw:3.5 });
}
function addFloat(x, y, text, color, size){
  // x 为世界横向、y 为世界高度（向上为正）；渲染时经 projX/projY 投影
  floats.push({ x: clamp(x, -COURT*1.7, COURT*1.7), y, vy:56, dur:1.0, life:1.0, text, color, size:size||22 });
}
function initEmbers(){
  embers = [];
  const n = Math.round(clamp(W/46, 16, 34));
  for(let i=0;i<n;i++){
    embers.push({ x:rand(0,W), y:rand(0,H), vx:rand(-6,6), vy:rand(-14,-5), ph:rand(0,7), r:rand(.8,2.1), a:rand(.08,.3) });
  }
}

