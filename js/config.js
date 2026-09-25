/* 跆拳道 · AI 对战 —— config
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 游戏常量 ---------- */
const STATE = { menu:'menu', fight:'fight', over:'over' };
const state = { mode:STATE.menu, overTimer:0, winStreak:0, roundTime:60, count:null, countNum:8, countT:0, intro:0 };

/* 玩家从读秒站起所需时间（秒）。起身速度在过程中逐渐加快，狂按可大幅缩短。
   取 7.0s 是刻意贴着 8 秒读秒：既有紧张感，又不会因为不懂操作而被判 KO。
   AI 的起身时间按段位走 RANKS[].riseTime（黑带 0.5s）。 */
const RISE_TIME_PLAYER = 7.0;

/* WT 级位体系（国技院）：白→黄→绿→蓝→红→黑，六个主色段位，难度递增
   riseTime = 被读秒后站起来的耗时（秒）。段位越高起身越快，黑带 0.5s
   黑带血量为其余段位曲线的 1.5 倍（195 → 293），做成「宗师」的耐久感。
   注意：startRound() 给双方同一个 R().hp，所以这 1.5 倍对玩家和 AI 同时生效。 */
const RANKS = [
  { name:'白带', color:'#e8eefc', ai:0.46, speed:1.0,  hp:90,  riseTime:4.5, tag:'新手 AI' },
  { name:'黄带', color:'#facc15', ai:0.58, speed:1.12, hp:110, riseTime:3.6, tag:'入门 AI' },
  { name:'绿带', color:'#22c55e', ai:0.70, speed:1.24, hp:130, riseTime:2.8, tag:'进阶 AI' },
  { name:'蓝带', color:'#38bdf8', ai:0.82, speed:1.38, hp:150, riseTime:2.0, tag:'高手 AI' },
  { name:'红带', color:'#f97316', ai:0.93, speed:1.55, hp:172, riseTime:1.2, tag:'精英 AI' },
  { name:'黑带', color:'#1f2937', ai:1.0,  speed:1.75, hp:293, riseTime:0.5, tag:'宗师 AI' },  // 195 × 1.5
];
let rankIdx = 0;
let roundWins = 0, aiWins = 0;   // 一局决胜：0/1
let scoreP = 0, scoreA = 0;      // 回合内得分（WT 竞技规则）

