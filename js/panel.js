/* 跆拳道 · AI 对战 —— panel
   右侧「实时决策」面板：把双方当前动作、以及 AI 战术层（Jev）的决策可视化。

   为什么值得做：项目的第二个目标是「展示 AI」，但玩家在画面里只看到对手在动，
   感知不到「对面是 AI」。把战术选择与预判概率摊开，AI 的能力才真正可见。 */

const TACTIC_CN = {
  rush:'突进压制', probe:'游走试探', counter:'后退反击', defend:'稳固防守', feint:'假动作诱敌'
};
const SKILL_CN = {
  punch:'正拳', kick:'横踢', spinx:'旋风踢', axe:'下劈', side:'侧踢',
  back:'后踢', flying:'飞踢'
};

const PANEL = { on: true, last: -99, interval: 0.1 };   // 10Hz 刷新，避免 DOM 抖动

/* 把一个选手的当前状态翻译成可读动作名 */
function panelAction(g){
  if(g.kd > 0) return '倒地读秒';
  if(g.rise > 0) return '起身中';
  if(g._flyArmed) return '起跳 · 蓄势飞踢';
  if(g.state === 'block') return '格挡';
  if(g.state === 'attack') return '正拳';
  if(g.state === 'kick'){
    if(g.flyKick) return '飞踢 · 滞空';
    if(g.cast === 'spinx') return '旋风踢 · 转体';
    if(g.cast === 'axe')   return '下劈';
    if(g.cast === 'side')  return '侧踢';
    if(g.cast === 'back')  return '后踢 · 转身';
    return '横踢';
  }
  if(g.airborne) return '腾空';
  if(Math.abs(g.vx) > 40) return '移动';
  return '待机';
}

function panelRecent(g){
  const recent = g.recentActs || [];
  return recent.length ? (SKILL_CN[recent[recent.length - 1]] || recent[recent.length - 1]) : '—';
}

const pct = v => Math.round((v || 0) * 100) + '%';

function updatePanel(){
  const p = player, f = ai;
  $('dpPAction').textContent = panelAction(p);
  $('dpPRecent').textContent = panelRecent(p);
  $('dpPCombo').textContent  = p.combo > 1 ? '×' + p.combo : '—';
  $('dpPHP').textContent     = pct(p.hp / Math.max(1, p.maxHp));
  $('dpARank').textContent   = R().name + ' AI';
  $('dpAAction').textContent = panelAction(f);
  $('dpARecent').textContent = panelRecent(f);
  $('dpAHP').textContent     = pct(f.hp / Math.max(1, f.maxHp));

  // Jev 的 at 来自 frame(ts) 的页面时间（秒），不能用 SIM_T 判断新鲜度；
  // 后台节流或慢动作会让两套时钟逐渐偏离。
  const JI = (typeof jevIntent === 'function') ? jevIntent(performance.now() / 1000) : null;
  if(JI){
    $('dpTactic').textContent = TACTIC_CN[JI.tactic] || JI.tactic || '—';
    const pr = (JI.tactics && JI.tactics[JI.tactic]) || 0;
    $('dpProb').style.width = pct(pr);
    $('dpProbTxt').textContent = pct(pr);
    $('dpPredict').textContent = pct(JI.foeKick);
    $('dpSrc').textContent = (JEV.lastSrc === 'cache') ? '缓存' : (JEV.lastSrc === 'jev' ? 'Jev' : '');
  } else {
    $('dpTactic').textContent = '纯本地 AI';
    $('dpProb').style.width = '0%';
    $('dpProbTxt').textContent = '—';
    $('dpPredict').textContent = '—';
    $('dpSrc').textContent = JEV.errors ? '降级' : '本地';
  }
}

/* 由 frame() 调用；用仿真时间节流 */
function tickPanel(){
  if(!PANEL.on) return;
  if(SIM_T - PANEL.last < PANEL.interval) return;
  PANEL.last = SIM_T;
  updatePanel();
}

function togglePanel(){
  PANEL.on = !PANEL.on;
  $('dp').classList.toggle('show', PANEL.on);
  $('dpToggle').textContent = PANEL.on ? '收起决策' : '查看决策';
  $('dpToggle').setAttribute('aria-expanded', String(PANEL.on));
  if(PANEL.on){ PANEL.last = -99; updatePanel(); }
  track('panel_toggle', { on: PANEL.on });
}

function refreshPanelOrientation(){
  const el = $('dp');
  if(el) el.classList.toggle('portrait', PORTRAIT);
}

function initPanel(){
  const off = new URLSearchParams(location.search).get('panel') === 'off';
  // 手机竖屏的赛场仅 414px 宽，面板默认收起，以免遮住人物。
  PANEL.on = !off && !PORTRAIT;
  $('dp').classList.toggle('show', PANEL.on);
  $('dpToggle').textContent = PANEL.on ? '收起决策' : '查看决策';
  $('dpToggle').setAttribute('aria-expanded', String(PANEL.on));
  refreshPanelOrientation();     // 竖屏空间紧张 → 收敛为更窄的形态
  updatePanel();
  $('dpToggle').addEventListener('click', togglePanel);
}
