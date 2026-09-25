/* 跆拳道 · AI 对战 —— config
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 游戏常量 ---------- */
const STATE = { menu:'menu', fight:'fight', over:'over' };
const state = { mode:STATE.menu, overTimer:0, winStreak:0, roundTime:60, count:null, countNum:8, countT:0, intro:0 };

/* WT 级位体系（国技院）：白→黄→绿→蓝→红→黑，六个主色段位，难度递增 */
const RANKS = [
  { name:'白带', color:'#e8eefc', ai:0.46, speed:1.0,  hp:90,  tag:'新手 AI' },
  { name:'黄带', color:'#facc15', ai:0.58, speed:1.12, hp:110, tag:'入门 AI' },
  { name:'绿带', color:'#22c55e', ai:0.70, speed:1.24, hp:130, tag:'进阶 AI' },
  { name:'蓝带', color:'#38bdf8', ai:0.82, speed:1.38, hp:150, tag:'高手 AI' },
  { name:'红带', color:'#f97316', ai:0.93, speed:1.55, hp:172, tag:'精英 AI' },
  { name:'黑带', color:'#1f2937', ai:1.0,  speed:1.75, hp:195, tag:'宗师 AI' },
];
let rankIdx = 0;
let roundWins = 0, aiWins = 0;   // 大比分（速战单局 / 正式赛五局三胜）
let quickMode = true;            // true=首战速战（单局·30s）；false=正式赛（五局三胜·60s）
let scoreP = 0, scoreA = 0;      // 回合内得分（WT 竞技规则）

