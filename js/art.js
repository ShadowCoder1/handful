/* art.js: the app's own drawings. Icons, the mascot, confetti.
 *
 * Drawn here rather than taken from an icon set, so the app looks like
 * itself: round ends, a 2.4px stroke, slightly chunky, the same hand
 * everywhere. */

const svg = (body, { size = 24, stroke = "currentColor", fill = "none", sw = 2.4, vb = "0 0 24 24" } = {}) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="${vb}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  path: (o) => svg(`<path d="M12 21c-3.5-2.4-7-5.6-7-10a7 7 0 0 1 14 0c0 4.4-3.5 7.6-7 10Z"/><circle cx="12" cy="11" r="2.6"/>`, o),
  practice: (o) => svg(`<path d="M4 9v6M7.5 6.5v11M16.5 6.5v11M20 9v6M7.5 12h9"/>`, o),
  letters: (o) => svg(`<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>`, o),
  settings: (o) => svg(`<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>`, o),
  close: (o) => svg(`<path d="M6 6l12 12M18 6 6 18"/>`, o),
  check: (o) => svg(`<path d="M5 12.5l4.5 4.5L19 7.5"/>`, o),
  lock: (o) => svg(`<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>`, o),
  star: (o) => svg(`<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.5l-5.1 2.7 1-5.6-4.1-4 5.7-.8Z"/>`, o),
  shuffle: (o) => svg(`<path d="M4 7h3.5c4.5 0 5 10 9.5 10H20M4 17h3.5c1.6 0 2.7-1.3 3.6-3M16.9 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5M13 10c1-1.7 2.2-3 3.9-3"/>`, o),
  abc: (o) => svg(`<path d="M3.5 17l2.8-9 2.8 9M4.4 14.2h3.8M12 8v9h2.6a2.3 2.3 0 0 0 0-4.6H12M12 12.4h2.2a2.2 2.2 0 0 0 0-4.4H12M21 9.2a3.5 3.5 0 1 0 0 6.6"/>`, { ...o, sw: 2.1 }),
  trophy: (o) => svg(`<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5.5a2.5 2.5 0 0 0 2.6 3.4M16 5.5h2.5a2.5 2.5 0 0 1-2.6 3.4M12 13v3.5M8.5 20h7M9.5 20c0-2 1.1-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/>`, o),
  flame: (o) => svg(`<path d="M12 21.2c-3.9 0-6.6-2.7-6.6-6.3 0-3.2 2.1-5.1 3.6-6.9.5 1.5 1.3 2.3 2.2 2.6-.2-3.1 1-5.5 3.3-7.3.4 2.8 1.6 4.3 2.8 5.8 1.2 1.6 1.9 3.2 1.9 5.7 0 3.6-2.9 6.4-7.2 6.4Z" fill="currentColor" stroke="none"/><path d="M12.2 20.3c-1.7 0-2.9-1.2-2.9-2.8 0-1.8 1.4-2.8 2.4-4.3.6 1.4 2.4 2.1 2.9 3.7.5 1.8-.6 3.4-2.4 3.4Z" fill="#fff3c4" stroke="none"/>`, o),
  bolt: (o) => svg(`<path d="M13.5 2.8 5.3 13.4h6l-1 7.8 8.4-10.8h-6.1Z" fill="currentColor" stroke="none"/>`, o),
  camera: (o) => svg(`<rect x="3" y="6.5" width="13" height="11" rx="3"/><path d="M16 10.5l5-2.8v8.6l-5-2.8"/>`, o),
  speaker: (o) => svg(`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11"/>`, o),
  mute: (o) => svg(`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>`, o),
  eye: (o) => svg(`<path d="M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.8"/>`, o),
  arrow: (o) => svg(`<path d="M5 12h14M13 6l6 6-6 6"/>`, o),
  target: (o) => svg(`<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`, o),
  clock: (o) => svg(`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`, o),
  hand: (o) => svg(`<path d="M8 12V5.8a1.6 1.6 0 0 1 3.2 0V11M11.2 10.5V4.4a1.6 1.6 0 0 1 3.2 0v6.1M14.4 10.8V6a1.6 1.6 0 0 1 3.2 0v7.5c0 4.2-2.6 7.2-6.3 7.2-2.6 0-4.1-1.3-5.3-3.2l-2.2-3.6a1.5 1.5 0 0 1 2.4-1.8L8 14"/>`, o),
};

/* ---- the mascot: Pip ------------------------------------------------------------
 * A friendly hand with a satchel, from the Handful brand sheet. Each mood is
 * its own drawing (assets/mascot/*.webp); the life comes from CSS: a slow
 * breath while idle, a squash-and-stretch pop whenever the pose changes, and
 * a bounce when there's something to celebrate.
 *
 *   wave       hello, the welcome screen
 *   encourage  pointing the way: instructions and hints
 *   learning   reading a book: thinking, new material
 *   excited    hands clasped: a right answer
 *   proud      a wink and a star
 *   jump       celebrating the end of a lesson
 *   laptop     at the computer: the camera
 *   rest       lying down: nothing to do yet */
export const POSES = ["wave", "encourage", "learning", "excited", "proud", "jump", "laptop", "rest"];

export function mascot(pose = "encourage", { size = 120, anim = "idle" } = {}) {
  return `<span class="mascot anim-${anim}" style="--s:${size}px" aria-hidden="true"><img src="assets/mascot/${pose}.webp" alt="" draggable="false"></span>`;
}

/* ---- confetti ---------------------------------------------------------------- */
export function confetti(host, { count = 110, colors = ["#2e5a41", "#8ea762", "#f5a04a", "#5d8fb5", "#d7775b", "#d7ae45"] } = {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.className = "confetti";
  host.append(c);
  const dpr = devicePixelRatio || 1;
  const W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr);
  const g = c.getContext("2d");
  const bits = Array.from({ length: count }, () => ({
    x: W * (0.2 + Math.random() * 0.6), y: H * 0.35, vx: (Math.random() - 0.5) * 22 * dpr, vy: (-10 - Math.random() * 16) * dpr,
    r: (4 + Math.random() * 5) * dpr, a: Math.random() * 6.3, va: (Math.random() - 0.5) * 0.35, col: colors[Math.floor(Math.random() * colors.length)],
    shape: Math.random() < 0.5 ? 0 : 1,
  }));
  const t0 = performance.now();
  (function step(t) {
    const k = (t - t0) / 1000;
    g.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.vy += 0.55 * dpr; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.a += b.va;
      g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 1.6));
      g.fillStyle = b.col;
      if (b.shape) g.fillRect(-b.r, -b.r * 0.45, b.r * 2, b.r * 0.9); else { g.beginPath(); g.arc(0, 0, b.r * 0.7, 0, 6.3); g.fill(); }
      g.restore();
    }
    if (k < 2.8) requestAnimationFrame(step); else c.remove();
  })(t0);
}
