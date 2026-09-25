/* 跆拳道 · AI 对战 —— audio
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 音频（Web Audio 合成） ---------- */
let AC = null, noiseBuf = null;
function audio(){
  if(!AC){
    try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    if(AC){
      // 预生成白噪声缓冲（观众声/打击铺底）
      const len = AC.sampleRate * 1.2;
      noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    }
  }
  return AC;
}
function sfx(type, vol = 0.5){
  const ac = audio(); if(!ac) return;
  const t = ac.currentTime;
  const tone = (f0, f1, dur, wave = 'square', v = vol, delay = 0) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = wave; o.frequency.setValueAtTime(f0, t + delay);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + delay + dur);
    g.gain.setValueAtTime(v, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
    o.connect(g); g.connect(ac.destination); o.start(t + delay); o.stop(t + delay + dur + .02);
  };
  const crowd = (dur, v, freq) => {
    if(!noiseBuf) return;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = freq; bp.Q.value = .6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(v, t + dur*.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(ac.destination);
    src.start(t); src.stop(t + dur + .05);
  };
  switch(type){
    case 'punch': tone(130, 40, .12); break;               // 出拳 低频
    case 'kick':  tone(90, 30, .18); break;                // 踢腿
    case 'hit':   tone(260, 60, .16, 'sawtooth'); crowd(.25, .06, 900); break;   // 命中 + 观众轻呼
    case 'guard': tone(700, 500, .06); break;              // 格挡
    case 'ko':    tone(180, 30, .8, 'sawtooth'); crowd(1.6, .22, 700); break;    // KO + 观众沸腾
    case 'bell':  tone(880, 880, .5, 'sine', .3); tone(1174, 1174, .6, 'sine', .22, .02); break; // 开赛铃
    case 'tick':  tone(1100, 1100, .05, 'sine', .25); break;   // 读秒报数
    case 'win':   [523,659,784].forEach((f,i) => tone(f, f, .18, 'sine', .32, i*.09)); crowd(1.4, .18, 800); break;
    case 'lose':  [392,330,262].forEach((f,i) => tone(f, f, .22, 'sine', .3, i*.12)); break;
  }
}

