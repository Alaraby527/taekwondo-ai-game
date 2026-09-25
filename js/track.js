/* 跆拳道 · AI 对战 —— track
   招新转化漏斗埋点。复用 Jev 代理的 /track 端点，不需要额外后端。

   两个关键设计：
   1) 用 text/plain 发送 —— 这是 CORS 安全列表内的类型，可完全绕开预检，
      既省一次往返，也不依赖服务端正确实现 OPTIONS
   2) 任何失败都静默忽略 —— 埋点绝不允许影响游戏 */

const TRACK_BASE = (() => {
  const meta = document.querySelector('meta[name="track-base"]');
  const m = meta && meta.getAttribute('content');
  const raw = (m || (typeof JEV_BASE !== 'undefined' ? JEV_BASE : '') ||
               (location.protocol.startsWith('http') ? location.origin : '')).trim();
  return raw.replace(/\/+$/, '');
})();

const SID_KEY = 'tkd.sid';
function trackSid(){
  try{
    let s = localStorage.getItem(SID_KEY);
    if(!s){
      s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem(SID_KEY, s);
    }
    return s;
  }catch(e){ return 'anon'; }
}

const TRACK = { sent: 0, failed: 0, recent: [] };

/* 发送一个漏斗事件。props 只是附加信息，不要塞个人信息。 */
function track(event, props){
  const evt = Object.assign({ event, sid: trackSid(), v: 1 }, props || {});
  TRACK.recent.push(event);
  if(TRACK.recent.length > 40) TRACK.recent.shift();
  if(!TRACK_BASE) return;
  const body = JSON.stringify(evt);
  try{
    /* sendBeacon 在页面卸载时也能发出；text/plain 属于安全列表类型，不触发预检 */
    if(navigator.sendBeacon){
      const ok = navigator.sendBeacon(TRACK_BASE + '/track', new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      if(ok){ TRACK.sent++; return; }
    }
    fetch(TRACK_BASE + '/track', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body, keepalive: true
    }).then(() => TRACK.sent++).catch(() => TRACK.failed++);
  }catch(e){ TRACK.failed++; }
}
