# v0 Prompt — 跆拳道 · AI 对战（视觉升级重制版）

> 用法：整段复制下面 prompt 全文（从 "Build..." 开始）粘贴到 v0.app 输入框。

---

Build a polished, production-quality single-page fighting game web app: "跆拳道 · AI 对战" (Taekwondo × AI Fighter) — a campus event game presented by 上海理工大学跆拳道社 × 抖音校园 WowLand. ALL visible UI text must be in Simplified Chinese.

## Core architecture

One Next.js App Router page with a client component. The fight itself renders into a `<canvas>` with a requestAnimationFrame loop; all mutable game state lives in refs (never re-render React per frame). Tailwind styling for surrounding UI. No game libraries, no image assets — every visual is drawn in code. Responsive; desktop = keyboard, mobile = on-screen touch controls.

## Game mechanics (all must actually work, no stubs)

- Movement: A/D or arrows to move, W/Space to jump. Fighter always faces the opponent.
- Attacks: J = punch (WT 1 pt, body only, slow). K = roundhouse kick (2 pts). Direction+K: forward+K = side kick (2 pts, lunging), back+K = back kick (3 pts spinning). Tap K twice quickly = axe kick (3 pts, head). Airborne+K = flying kick (3 pts, head, lunges forward). Tap K three times quickly = tornado kick (4 pts, spinning, highest damage, full 360° spin with afterimages). L (hold) = block: negates all damage while grounded.
- WT scoring: punch→body 1, kick→body 2, kick→head 3, spinning technique +1. Floating "+N" popup on every clean hit; hit-stop micro freeze + screen shake + spark particles on impact.
- Each round: 60s timer, HP bars AND score shown. Round ends by knockdown (HP 0 → 8-second standing count; mashing attack keys speeds recovery; fail = KO) or by higher score at time-up.
- Match: first to 3 round wins (五局三胜). Ring-out: fully leaving the court boundary = 出界判罚, opponent +1 point, fighter bounced back in.
- Combo system: hits within 1s stack a damage multiplier (max +42%), show "连击 ×N".
- AI opponent, 5 belts increasing difficulty: 白带→黄带→蓝带→红带→黑带. Higher belts react faster, block/dodge more, and use flying/tornado kicks (red+). Winning promotes to next belt, losing stays. Belt progress persists in localStorage.
- Audio: Web Audio API synthesized SFX only (punch, kick, hit, block guard, KO, countdown beeps, win/lose jingles). No audio files.

## Visual direction (critical — this is a premium redesign, absolutely not programmer-art stick figures)

- Overall vibe: modern esports broadcast × sports arena. Deep navy hall, volumetric spotlight cones, subtly animated crowd silhouettes, glowing court boundary lines, floating ember/dust particles, glassmorphism dark UI panels, neon cyan (player) vs crimson (AI) accents, gold for scores and highlights.
- Fighters: stylized taekwondo athletes drawn with layered canvas vector shapes — white dobok, team-colored chest protector (hogu) + headgear, belt colored by rank, bare feet. Smooth procedural animation: idle breathing bob, walk cycle, anticipatory windup before strikes, leg extension arcs with motion trails, afterimages on spins, recovery. Impact sparks + hit flash on the victim.
- HUD: rounded health bars with a delayed white "damage chip" layer, round-win pips, central countdown timer, combo counter, KO overlay with huge animated count numbers, "ROUND N / 开战！" splash text with pop-in animation, brief slow-motion on the KO blow.
- Three screens:
  1. Menu/landing: bold hero with gradient display title "跆拳道 · AI 对战", subline about AI + taekwondo, three feature cards (🥋 AI 对手 / 🎮 易上手 / 🏆 段位晋级), control legend with keycaps, big CTA button "⚔ 开始挑战 AI", then a QR section: two square placeholder boxes labeled "📱 抖音校园 WowLand 活动群" and "🥋 跆拳道社微信群" (styled frames ready to swap real QR images), plus a footer note 本活动为公益实践项目，不收取任何费用.
  2. Fight screen: canvas + HUD; on touch devices show big thumb-zone buttons (◀ ▶ left, 跳/踢/挡 right). Portrait phones get a dismissible "建议横屏游玩" overlay.
  3. Result overlay: 你赢了！/ 被 AI 击败, round stats, belt-promotion celebration when advancing (animated belt badge), buttons ⚔ 再来一局 + 🏠 返回首页, and the two QR placeholders again.
- Typography: big confident numerals/display titles; Chinese via system stack (PingFang SC, Microsoft YaHei).

## Quality bar

Full working game on the first generation — every kick type, the AI, knockdown counts, ring-out, combos and sounds functioning together. 60fps target. Clean componentization (game engine hook, canvas renderer, HUD components, screens).
