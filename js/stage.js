/* 跆拳道 · AI 对战 —— stage
   从单文件 index.html 拆出；所有脚本共享同一全局作用域（classic script，无模块、无构建）。 */
"use strict";

/* ---------- 画布 ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, CX = 0, GROUND = 0;

/* =====================================================================
   世界坐标约定
   ---------------------------------------------------------------------
   · 世界原点 = 比赛区中心的地面点
   · wx 为场地横向（与旧版 f.x 同义，逻辑层无需改动）
   · wy 为「离地高度」，向上为正（与旧版 f.y 同义）
   · 绘制世界物体时一律用 local y = -wy（即高度向上 → 画布 y 减小）
   · 屏幕映射全部经由 CAM，见 camApply() / projX() / projY()
   ===================================================================== */
const COURT   = 300;    // WT 比赛区半径（世界单位）
const RING_OUT = 384;   // 出界线半径（越出即判罚）
const ART_H   = 118;    // 角色美术基准身高（世界单位），相机取景以此为参照

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
  W = FORCE_VW || window.innerWidth; H = FORCE_VH || window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  if(FORCE_VW || FORCE_VH){
    const k = Math.min(window.innerWidth / W, window.innerHeight / H);
    cv.style.transformOrigin = '0 0';
    cv.style.transform = 'scale(' + k + ')';
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  CX = W / 2;
  /* 地面线：横屏压在画面下方约 1/5；竖屏上提，给底部触屏按键留出空间 */
  GROUND = H - clamp(H * (W > H ? 0.20 : 0.30), 92, 300);
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
  const land = W > H;
  const MARGIN = land ? 200 : 75;
  const need = spread + MARGIN * 2;
  /* 横屏以宽度取景为主；竖屏以高度取景为主，横向允许贴边 */
  let z = Math.min(W / need, H / (ART_H * (land ? 2.4 : 2.1)));
  z = clamp(z, land ? 0.85 : 0.95, 3.4);
  z *= (1 + CAM.hitZoom * 0.07 + CAM.koZoom * 0.28);
  CAM.tzoom = z;

  /* 横向限制在场地内，避免镜头长时间对着空场 */
  CAM.tx = clamp(midX, -COURT * 0.5, COURT * 0.5);
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

