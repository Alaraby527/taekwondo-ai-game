/* 跆拳道 · AI 对战 —— stage
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 画布 ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, CX = 0, GROUND = 0;
/* 屏幕逻辑尺寸 与 游戏区（band）
   竖屏时游戏区被限制在「电影黑边」内：底部黑边 BAR_B 留给触屏按键。
   游戏区原点仍在 (0,0) 且与屏幕同宽，所以无需平移，只需收窄逻辑高度 H。 */
let SW = 0, SH = 0, BAR_B = 0, PORTRAIT = false;

/* =====================================================================
   世界坐标约定
   ---------------------------------------------------------------------
   · 世界原点 = 比赛区中心的地面点
   · wx 为场地横向（与旧版 f.x 同义，逻辑层无需改动）
   · wy 为「离地高度」，向上为正（与旧版 f.y 同义）
   · 绘制世界物体时一律用 local y = -wy（即高度向上 → 画布 y 减小）
   · 屏幕映射全部经由 CAM，见 camApply() / projX() / projY()
   ===================================================================== */
const COURT    = 300;   // WT 比赛区半径（世界单位）
const RING_OUT = 384;   // 出界线半径（越出即判罚）
const CORNER_X = COURT * 0.78;  // 读秒时双方各自回到的角落位置（WT：回角落再继续）
const ART_H    = 118;   // 角色美术基准身高（世界单位），相机取景以此为参照

/* 相机：跟随双方中点、按间距自适应推拉，含震屏与打击瞬间推近 */
const CAM = {
  x: 0,  tx: 0,        // 横向跟随（缓动）
  y: 0,  ty: 0,        // 纵向（世界高度，通常 0 = 盯住地面）
  zoom: 1.2, tzoom: 1.2,
  shakeX: 0, shakeY: 0,
  hitZoom: 0,          // 命中瞬间的额外推近（0~1，自动衰减）
  koZoom: 0            // KO 慢推
};

/* 把相机变换压进 ctx；之后所有绘制都在世界坐标里 */
function camApply(){
  ctx.translate(CX + CAM.shakeX, GROUND + CAM.shakeY);
  ctx.scale(CAM.zoom, CAM.zoom);
  ctx.translate(-CAM.x, CAM.y);
}
/* 世界坐标 → 屏幕坐标（给 HUD 层叠加飘字用） */
const projX = wx => CX + CAM.shakeX + (wx - CAM.x) * CAM.zoom;
const projY = wy => GROUND + CAM.shakeY - (wy - CAM.y) * CAM.zoom;

/* 兼容旧绘制代码：世界单位即像素，放大交给相机 */
const SCALE = () => 1;
/* UI/HUD 专用比例：跟随视口，不受相机影响 */
const UI = () => clamp(Math.min(W / 1280, H / 720), .70, 1.45);
const isTouch = () => matchMedia('(pointer: coarse)').matches;

/* 调试用：?vw=1280&vh=720 可强制视口尺寸并按比例缩放到窗口（仅用于本地排版/取景校验） */
const QS = new URLSearchParams(location.search);
const FORCE_VW = +QS.get('vw') || 0, FORCE_VH = +QS.get('vh') || 0;

function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  SW = FORCE_VW || window.innerWidth;
  SH = FORCE_VH || window.innerHeight;
  cv.width = SW * DPR; cv.height = SH * DPR;
  cv.style.width = SW + 'px'; cv.style.height = SH + 'px';
  if(FORCE_VW || FORCE_VH){
    const k = Math.min(window.innerWidth / SW, window.innerHeight / SH);
    cv.style.transformOrigin = '0 0';
    cv.style.transform = 'scale(' + k + ')';
  }

  /* 竖屏 = 电影黑边 band：底部黑边放触屏按键，游戏区收窄到剩余高度 */
  PORTRAIT = SH > SW;
  BAR_B = PORTRAIT ? Math.round(clamp(SH * 0.30, 150, 320)) : 0;
  W = SW;
  H = SH - BAR_B;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  CX = W / 2;
  /* 地面线：横屏压在游戏区下方约 1/5；竖屏略上提，给近端擂台留出纵深 */
  GROUND = H - clamp(H * (PORTRAIT ? 0.26 : 0.20), 92, 300);
  buildBg();
  placeTouch();
  if(typeof checkOrientation === 'function') checkOrientation();
}

/* 相机每帧推进：取景 = 双方 + 边距 */
function updateCam(dt){
  /* 调试/取景用：window.__camOverride = {x, y, z} 可锁定相机 */
  if(window.__camOverride){
    CAM.x = CAM.tx = window.__camOverride.x || 0;
    CAM.y = CAM.ty = window.__camOverride.y || 0;
    CAM.zoom = CAM.tzoom = window.__camOverride.z;
    CAM.shakeX = CAM.shakeY = 0;
    return;
  }
  const alive = (state.mode === STATE.fight || state.mode === STATE.over);
  const midX = alive ? (player.x + ai.x) / 2 : 0;
  const spread = alive ? Math.abs(player.x - ai.x) : 0;

  /* 需要容纳的世界宽度：双方间距 + 两侧边距（竖屏留窄边距，靠相机跟随） */
  const land = !PORTRAIT;
  const MARGIN = land ? 200 : 55;
  const need = spread + MARGIN * 2;
  /* 横屏以宽度取景为主；竖屏以高度取景为主，横向允许贴边 */
  let z = Math.min(W / need, H / (ART_H * (land ? 2.4 : 2.1)));
  /* 下限压到 0.2：间距大时必须能真正拉到「装得下两个人」。
     原来的 0.85 / 1.0 会在墙角对峙或场地翻倍后把镜头卡住，导致一个人出画。
     竖屏 + 场地翻倍 + 两人分处两端是最极端的情形（需要 ≈0.30），所以留足余量。 */
  z = clamp(z, 0.2, 3.4);
  z *= (1 + CAM.hitZoom * 0.07 + CAM.koZoom * 0.28);
  CAM.tzoom = z;

  /* 相机必须居中于双方中点 —— 这是「两个人都看得见」的唯一保证。
     原实现这里是 clamp(midX, ±COURT*0.5)：一旦两人都在墙角（中点可达 ±642），
     镜头被夹在中场，于是有一个人直接跑出画面（场地翻倍后更明显）。
     中点本身必然落在场地内，所以不需要额外限制。 */
  CAM.tx = midX;
  CAM.ty = 0;

  /* 指数缓动：帧率无关 */
  const k = 1 - Math.pow(0.0016, dt);
  CAM.zoom = lerp(CAM.zoom, CAM.tzoom, k);
  CAM.x    = lerp(CAM.x,    CAM.tx,    k);
  CAM.y    = lerp(CAM.y,    CAM.ty,    k);

  /* 震屏（HUD 不受影响，只震世界层） */
  if(shakeT > 0){
    const a = shakeAmp * (shakeT / shakeDur);
    CAM.shakeX = rand(-1, 1) * a;
    CAM.shakeY = rand(-1, 1) * a;
  } else { CAM.shakeX = 0; CAM.shakeY = 0; }

  /* 打击推近与 KO 推进的衰减 */
  CAM.hitZoom = Math.max(0, CAM.hitZoom - dt * 3.6);
  if(state.mode === STATE.over || state.count) CAM.koZoom = Math.min(1, CAM.koZoom + dt * 0.8);
  else CAM.koZoom = Math.max(0, CAM.koZoom - dt * 1.2);
}
window.addEventListener('resize', resize);

