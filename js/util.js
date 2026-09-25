/* 跆拳道 · AI 对战 —— util
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* =====================================================================
   跆拳道 · AI 对战 —— 纯前端单文件游戏（视觉重制版）
   玩法：WT 得分制 · 一局决胜（30s）。玩家 vs AI（白→黑带难度递增）
   操控：桌面键鼠 / 移动端触屏
   音效：Web Audio 代码合成（无需素材）
   ===================================================================== */

/* ---------- 工具 ---------- */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 3);
const mixC = (a, b, k) => {   // '#rrggbb' 颜色插值（k=0→a, 1→b）
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa>>16)&255)*(1-k) + ((pb>>16)&255)*k);
  const g = Math.round(((pa>>8)&255)*(1-k) + ((pb>>8)&255)*k);
  const bl = Math.round((pa&255)*(1-k) + (pb&255)*k);
  return `rgb(${r},${g},${bl})`;
};
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
const fnt = (w, s) => `${w} ${s}px ${FONT}`;

