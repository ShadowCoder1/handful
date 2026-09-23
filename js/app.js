/* app.js: the screens, and moving between them.
 *
 *   #/welcome           first visit: who you are, which hand, a daily goal
 *   #/                  the path
 *   #/lesson/<node>     a lesson (node ids from js/planner.js; "review" and
 *                       "letter-X" are made up on the spot)
 *   #/letters           every letter and how strong it is
 *   #/settings
 *
 * Everything the app knows about you lives in this browser (js/learner.js).
 * Nothing is sent anywhere. */

import { UNITS, ALL_LETTERS, TIPS, PRAISE, PRAISE_AFTER_HELP, CONFUSABLE, hint } from "./course.js";
import { load, save, letterOf, strength, isMastered, record, finishLesson, currentStreak, dayKey, worstRival, newState } from "./learner.js";
import { PATH, ALL_NODES, nodeStatus, buildLesson, requeue, shuffle, distractors } from "./planner.js";
import { ICON, mascot, confetti } from "./art.js";
import { sfx, setSound } from "./sfx.js";
import { startCamera, attachView, cameraReady } from "./camera.js";
import { runSign } from "./signer.js";
import { pictureMirrored } from "../tutor/letters.js";
import { loadModel } from "../tutor/verifier.js";

const POSE_FOR = { think: "encourage", happy: "encourage", cheer: "excited", warn: "learning" };
const root = document.getElementById("root");
let S = load();
setSound(S.sound);
const persist = () => save(S);
const now = () => Date.now();
const pic = (l) => `assets/letters/${l}.svg`;
const flip = (l) => (pictureMirrored(l, S.hand) ? "flip" : "");
const unitColor = (l) => `c-${(UNITS.find((u) => u.letters.includes(l)) ?? UNITS[0]).color}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

let model = null;
async function getModel() {
  if (!model) model = loadModel(await (await fetch("tutor/model.json")).json());
  return model;
}

/* ---- routing ----------------------------------------------------------------- */
let cleanup = () => {};
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
window.addEventListener("hashchange", route);
function route() {
  cleanup(); cleanup = () => {};
  window.scrollTo(0, 0);
  const h = location.hash.replace(/^#\/?/, "");
  if (!S.onboarded && !h.startsWith("welcome")) return go("#/welcome");
  const [page, arg] = h.split("/");
  if (page === "welcome") return welcome();
  if (page === "lesson") return lesson(decodeURIComponent(arg ?? ""));
  if (page === "letters") return lettersPage();
  if (page === "settings") return settingsPage();
  return home();
}

/* ---- the frame around the main pages ------------------------------------------ */
function frame(active, body, aside = defaultAside()) {
  const nav = (id, href, label, icon) =>
    `<a class="nav-item ${active === id ? "on" : ""}" href="${href}">${ICON[icon]()}<span>${label}</span></a>`;
  const navs = nav("learn", "#/", "Learn", "path") + nav("practice", "#/lesson/review", "Practice", "practice") + nav("letters", "#/letters", "Letters", "letters") + nav("settings", "#/settings", "Settings", "settings");
  root.innerHTML = `
  <div class="app">
    <nav class="rail">
      <a class="brand" href="#/"><img class="brand-mark" src="assets/logo-64.png" alt=""><span>handful</span></a>
      ${navs}
    </nav>
    <main class="main"><div class="col">
      <div class="topstats">${statsHtml()}</div>
      ${body}
    </div></main>
    <aside class="aside">${aside}</aside>
    <nav class="tabbar">${navs}</nav>
  </div>`;
}

function statsHtml() {
  const streak = currentStreak(S, now());
  return `<div class="stats">
    <span class="stat flame ${streak ? "" : "out"}" title="Day streak">${ICON.flame()}${streak}</span>
    <span class="stat bolt" title="Total XP">${ICON.bolt()}<span>${S.xp}</span></span>
  </div>`;
}

function defaultAside() {
  const today = S.days[dayKey(now())] ?? { lessons: 0, xp: 0 };
  const p = Math.min(1, today.lessons / S.goal);
  const fading = ALL_LETTERS.filter((l) => isMastered(S.letters[l]) && strength(S.letters[l], now()) < 0.75);
  const minis = ALL_LETTERS.map((l) => {
    const L = S.letters[l];
    const s = L?.introduced ? strength(L, now()) : -1;
    const cls = s < 0 ? "" : s >= 0.8 ? "s3" : s >= 0.45 ? "s2" : "s1";
    return `<a class="mini ${cls}" href="#/letters" title="${l}">${l}</a>`;
  }).join("");
  return `
    <div class="stats" style="justify-content:space-between">${statsHtml()}</div>
    <div class="panel">
      <h3>Daily goal</h3>
      <div class="goal">
        <div class="ring c-forest" style="--p:${p}">${p >= 1 ? ICON.check({ size: 26 }) : ICON.target({ size: 24 })}</div>
        <div><b style="font-family:var(--display);font-size:18px">${today.lessons} of ${S.goal} ${S.goal === 1 ? "lesson" : "lessons"}</b>
        <div class="sub">${p >= 1 ? "Done for today. Nice." : "A few minutes is plenty."}</div></div>
      </div>
    </div>
    ${fading.length ? `<div class="panel">
      <h3>Keep them fresh</h3>
      <p class="sub" style="margin:0 0 14px">${fading.length === 1 ? `${fading[0]} is` : `${fading.slice(0, 3).join(", ")}${fading.length > 3 ? " and more" : ""} are`} starting to fade. A short practice brings ${fading.length === 1 ? "it" : "them"} back.</p>
      <a class="btn sky wide small" href="#/lesson/review">Practice now</a>
    </div>` : ""}
    <div class="panel">
      <h3 style="display:flex;justify-content:space-between;align-items:baseline">Your letters <a href="#/letters" style="font-size:14px;color:var(--sky-ink);text-decoration:none">See all</a></h3>
      <div class="mini-letters">${minis}</div>
    </div>`;
}

/* ---- home: the path ------------------------------------------------------------ */
const ZIG = [0, 46, 70, 46, 0, -46, -70, -46];
function home() {
  const { status } = nodeStatus(S);
  let k = 0;
  const units = PATH.map(({ unit, nodes }, ui) => {
    const done = nodes.filter((n) => status[n.id] === "done").length;
    const nodesHtml = nodes.map((n) => {
      const st = status[n.id];
      const x = ZIG[k++ % ZIG.length];
      const face = n.kind === "learn" ? `<span class="node-letters">${n.letters.join("")}</span>`
        : n.kind === "practice" ? ICON.shuffle() : n.kind === "words" ? ICON.abc() : ICON.trophy();
      const inner = st === "locked" ? ICON.lock({ size: 30 }) : face;
      return `<div class="node-wrap" style="--x:${x}px">
        ${st === "current" ? `<div class="node-halo" style="--p:${done / nodes.length}"></div><div class="start-tip">Start</div>` : ""}
        <button class="node ${st}" data-node="${n.id}" aria-label="${esc(n.title)}${st === "locked" ? ", locked" : ""}">${inner}</button>
        <div class="node-label">${esc(n.title)}</div>
      </div>`;
    }).join("");
    const side = ui % 2 ? "left" : "right";
    return `<section class="unit c-${unit.color}">
      <div class="unit-banner">
        <div><div class="eyebrow">Unit ${ui + 1}</div><h2>${esc(unit.title)}</h2><p>${esc(unit.blurb)}</p></div>
        <button class="btn" data-guide="${unit.id}">${ICON.eye({ size: 20 })}Signs</button>
      </div>
      <div class="trail">${nodesHtml}<div class="trail-mascot ${side}">${mascot(["encourage", "learning", "laptop", "proud", "rest", "excited"][ui % 6], { size: 150 })}</div></div>
    </section>`;
  }).join("");
  frame("learn", units);

  root.querySelectorAll("[data-node]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); nodePop(b); }));
  root.querySelectorAll("[data-guide]").forEach((b) => b.addEventListener("click", () => guide(b.dataset.guide)));
  const closePop = () => { root.querySelectorAll(".pop").forEach((p) => p.remove()); root.querySelectorAll(".node-wrap.open").forEach((w) => w.classList.remove("open")); };
  document.addEventListener("click", closePop);
  cleanup = () => document.removeEventListener("click", closePop);
  const cur = root.querySelector(".node.current");
  if (cur) setTimeout(() => cur.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
}

function nodePop(btn) {
  root.querySelectorAll(".pop").forEach((p) => p.remove());
  root.querySelectorAll(".node-wrap.open").forEach((w) => w.classList.remove("open"));
  btn.parentElement.classList.add("open");
  const n = ALL_NODES.find((x) => x.id === btn.dataset.node);
  const st = nodeStatus(S).status[n.id];
  const desc = {
    learn: `Meet ${n.letters.join(" and ")}, copy ${n.letters.length > 1 ? "them" : "it"}, then sign from memory.`,
    practice: "Everything in this unit, mixed together. Where you're shaky gets more turns.",
    words: "Put letters together and spell real words.",
    check: "Each sign once, from memory, with no pictures. Pass to finish the unit.",
  }[n.kind];
  const pop = document.createElement("div");
  pop.className = `pop ${st === "locked" && n.kind !== "check" ? "locked" : ""}`;
  pop.addEventListener("click", (e) => e.stopPropagation());
  if (st === "locked" && n.kind === "check") {
    pop.innerHTML = `<h3>Already know these?</h3><p>Take the check to skip ahead. Sign each letter once from memory.</p><button class="btn">Take the check</button>`;
  } else if (st === "locked") {
    pop.innerHTML = `<h3>${esc(n.title)}</h3><p style="margin:0">Finish the step before this one to unlock it.</p>`;
  } else {
    pop.innerHTML = `<h3>${esc(n.title)}</h3><p>${desc}</p><button class="btn">${st === "done" ? "Practise again" : "Start"}</button>`;
  }
  pop.querySelector(".btn")?.addEventListener("click", () => { sfx.tap(); go(`#/lesson/${n.id}`); });
  btn.parentElement.append(pop);
}

function guide(unitId) {
  const u = UNITS.find((x) => x.id === unitId);
  const rows = u.letters.map((l) => `<div style="display:flex;gap:14px;align-items:center;padding:10px 0;border-top:2px solid var(--line)">
      <img src="${pic(l)}" class="${flip(l)}" alt="" style="width:64px;height:64px;border:2px solid var(--line);border-radius:12px;padding:5px;background:#fff">
      <div><b style="font:600 26px/1 var(--display);color:var(--c)">${l}</b><div style="color:var(--ink-2);font-size:15px">${esc(TIPS[l].gist)}</div></div></div>`).join("");
  modal(`<div class="c-${u.color}"><h2 style="margin-bottom:6px">${esc(u.title)}</h2><p>${esc(u.blurb)}</p>${rows}
    <div class="row"><button class="btn" data-close>Close</button></div></div>`);
}

function modal(html) {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.innerHTML = `<div class="modal" role="dialog">${html}</div>`;
  document.body.append(scrim);
  const close = () => { scrim.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  scrim.addEventListener("click", (e) => { if (e.target === scrim || e.target.closest("[data-close]")) close(); });
  return { el: scrim, close };
}

/* ---- welcome -------------------------------------------------------------------- */
function welcome() {
  let step = 0;
  const draft = { name: S.name, hand: S.hand, goal: S.goal };
  const steps = [
    () => `<div class="hero">
      ${mascot("wave", { size: 300, anim: "float" })}
      <div>
        <h1>Learn to fingerspell with <em>your own hands.</em></h1>
        <p>Your camera watches your hand and tells you what to fix. A few minutes a day and you'll know the whole alphabet.</p>
        <div class="cta"><button class="btn wide" data-next>Get started</button><button class="btn ghost wide" data-knows>I know some letters already</button></div>
      </div></div>`,
    () => `<div class="say">${mascot("encourage", { size: 120 })}<div class="bubble">Hi, I'm Pip! Which hand do you write with?</div></div>
      <div class="opts two">
        <button class="opt big ${draft.hand === "right" ? "sel" : ""}" data-hand="right">${ICON.hand()}<b>Right hand</b><span>You'll sign with your right</span></button>
        <button class="opt big ${draft.hand === "left" ? "sel" : ""}" data-hand="left"><span class="flip" style="display:block">${ICON.hand()}</span><b>Left hand</b><span>You'll sign with your left</span></button>
      </div>`,
    () => `<div class="say">${mascot("learning", { size: 120 })}<div class="bubble">What should I call you?</div></div>
      <input class="field" id="name" maxlength="20" autocomplete="given-name" placeholder="Your first name" value="${esc(draft.name)}">
      <div class="note">${ICON.abc({ size: 26 })}<span>Once you've learned its letters, you'll get to spell it.</span></div>`,
    () => `<div class="say">${mascot("proud", { size: 120 })}<div class="bubble">How much a day sounds good?</div></div>
      <div class="opts">
        ${[[1, "Easy going", "One lesson"], [2, "Steady", "Two lessons"], [3, "Keen", "Three lessons"]].map(([g, a, b]) =>
          `<button class="opt ${draft.goal === g ? "sel" : ""}" data-goal="${g}">${ICON.target()}<div><b>${a}</b><span>${b} a day, about ${g * 4} minutes</span></div></button>`).join("")}
      </div>`,
    () => `<div class="say">${mascot("laptop", { size: 120 })}<div class="bubble">Last thing. I need your camera to see your hand.</div></div>
      <div class="note">${ICON.eye({ size: 26 })}<span>The video never leaves your device. Nothing is recorded or sent anywhere, and your progress is saved in this browser only.</span></div>`,
  ];
  const draw = () => {
    const last = step === steps.length - 1;
    root.innerHTML = `<div class="ob">
      <div class="ob-top">${step ? `<button class="icon-btn" data-back aria-label="Back">${ICON.arrow({ size: 26 }).replace("<svg", '<svg style="transform:scaleX(-1)"')}</button>` : ""}
        ${step ? `<div class="bar"><div class="bar-fill" style="width:${(step / (steps.length - 1)) * 100}%"></div></div>` : ""}</div>
      <div class="ob-body ex-enter">${steps[step]()}</div>
      ${step ? `<div class="foot"><div class="foot-in"><span></span><button class="btn" data-next>${last ? "Let's go" : "Continue"}</button></div></div>` : ""}
    </div>`;
    root.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", next));
    root.querySelector("[data-knows]")?.addEventListener("click", () => { draft.placement = true; next(); });
    root.querySelector("[data-back]")?.addEventListener("click", () => { step--; draw(); });
    root.querySelectorAll("[data-hand]").forEach((b) => b.addEventListener("click", () => { sfx.tap(); draft.hand = b.dataset.hand; draw(); }));
    root.querySelectorAll("[data-goal]").forEach((b) => b.addEventListener("click", () => { sfx.tap(); draft.goal = +b.dataset.goal; draw(); }));
    const name = root.querySelector("#name");
    if (name) { name.focus(); name.addEventListener("input", () => { draft.name = name.value.replace(/[^A-Za-z]/g, ""); }); name.addEventListener("keydown", (e) => e.key === "Enter" && next()); }
  };
  const next = () => {
    sfx.tap();
    if (step < steps.length - 1) { step++; draw(); return; }
    const placement = draft.placement;
    delete draft.placement;
    Object.assign(S, draft, { onboarded: true });
    persist();
    go(placement ? "#/lesson/u1-check" : "#/");
  };
  draw();
}

/* ---- the lesson ---------------------------------------------------------------- */
async function lesson(id) {
  let node = ALL_NODES.find((n) => n.id === id);
  if (id === "review") node = { id: "review", kind: "review", title: "Practice" };
  else if (id.startsWith("letter-")) {
    const l = id.slice(7);
    node = { id, kind: "review", title: `Practice ${l}`, only: [l, ...(CONFUSABLE[l] ?? []).filter((x) => S.letters[x]?.introduced)] };
  }
  if (!node) return go("#/");
  const camOK = now() > (S.cameraOffUntil ?? 0);
  let plan;
  if (node.only) {
    const l = node.only[0];
    plan = { title: node.title, camera: camOK, items: shuffle([...Array(5)].map((_, i) => (camOK && i % 2 === 0 ? { type: "sign", letter: l } : { type: "nameIt", letter: node.only[i % node.only.length], options: shuffle([node.only[i % node.only.length], ...distractors(S, node.only[i % node.only.length], 3, Math.random)]) }))) };
  } else {
    plan = buildLesson(node, S, now(), Math.random, { camera: camOK });
  }
  if (!plan.items.length) {
    frame("practice", `<div style="text-align:center;padding:60px 0">${mascot("rest", { size: 190 })}<h2 style="margin:18px 0 8px">Nothing to practise yet</h2><p style="color:var(--muted)">Learn a few letters first, then come back here.</p><a class="btn" href="#/">Go to the path</a></div>`);
    return;
  }
  const L = { node, items: plan.items, i: 0, camera: plan.camera, right: 0, total: 0, combo: 0, best: 0, t0: now(), touched: new Set(), before: {} };
  for (const it of L.items) for (const c of it.word ? [...it.word] : [it.letter]) if (c) L.before[c] ??= strength(S.letters[c], now());

  root.innerHTML = `<div class="lesson">
    <div class="lesson-top">
      <button class="icon-btn" data-quit aria-label="Quit lesson">${ICON.close({ size: 28 })}</button>
      <div class="bar" role="progressbar" aria-label="Lesson progress"><div class="bar-fill"></div></div>
      <div class="combo cold">${ICON.flame()}<span>0</span></div>
    </div>
    <div class="stage" id="stage"></div>
    <div class="foot" id="foot"><div class="foot-in" id="footin"></div></div>
  </div>`;
  const stage = root.querySelector("#stage"), foot = root.querySelector("#foot"), footin = root.querySelector("#footin");
  root.querySelector("[data-quit]").addEventListener("click", () => {
    const m = modal(`<div style="text-align:center">${mascot("learning", { size: 130 })}<h2 style="margin:10px 0 8px">Leave this lesson?</h2><p>You'll lose your progress in it.</p>
      <div class="row"><button class="btn ghost" data-close>Keep going</button><button class="btn bad" data-leave>Leave</button></div></div>`);
    m.el.querySelector("[data-leave]").addEventListener("click", () => { m.close(); go("#/"); });
  });

  let current = null;   // the running exercise's teardown
  let onEnter = null;
  const keys = (e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } else current?.key?.(e); };
  document.addEventListener("keydown", keys);
  let autoTimer = null;
  cleanup = () => { document.removeEventListener("keydown", keys); current?.stop?.(); clearTimeout(autoTimer); };

  const needsCam = L.items.some((it) => ["copy", "sign", "spell"].includes(it.type));
  let camPromise = null;
  if (needsCam) camPromise = Promise.all([startCamera({ hand: S.hand }), getModel()]).catch((err) => { console.warn(err); return null; });

  const progress = () => { const b = root.querySelector(".bar-fill"); if (b) b.style.width = `${(L.i / L.items.length) * 100}%`; };
  const comboEl = root.querySelector(".combo");
  const setCombo = () => { comboEl.classList.toggle("cold", L.combo < 2); comboEl.querySelector("span").textContent = L.combo; };

  function footer({ left = "", button = "Check", disabled = false, tone = "", verdict = null, auto = 0, onClick }) {
    foot.className = `foot ${tone}`;
    footin.innerHTML = `${verdict ? `<div class="verdict"><div class="badge">${tone === "good" ? ICON.check({ size: 40 }) : ICON.close({ size: 40 })}</div><div><h3>${esc(verdict.title)}</h3>${verdict.text ? `<p>${esc(verdict.text)}</p>` : ""}</div></div>` : left || "<span></span>"}
      <button class="btn ${tone === "good" ? "good" : tone === "bad" ? "bad" : ""} ${auto ? "autobar" : ""}" style="${auto ? `--auto:${auto}ms` : ""}" ${disabled ? "disabled" : ""}>${esc(button)}</button>`;
    const btn = footin.querySelector(".btn:last-child");
    btn.addEventListener("click", () => onClick?.());
    onEnter = disabled ? null : () => btn.click();
    clearTimeout(autoTimer);
    if (auto) autoTimer = setTimeout(() => btn.isConnected && btn.click(), auto);
    btn.addEventListener("click", () => clearTimeout(autoTimer), { once: true });
    return { btn, enable() { btn.disabled = false; onEnter = () => btn.click(); } };
  }

  /* One answer in: update the learner, the combo, and show the verdict. */
  function answered({ correct, letter, how, rival, part, text, auto = 0, helped = false, again = true }) {
    L.total++;
    if (letter) {
      record(letterOf(S, letter), { how, correct, now: now(), rival, part });
      L.touched.add(letter);
    }
    if (correct) { L.right++; L.combo++; L.best = Math.max(L.best, L.combo); sfx.right(); }
    else { L.combo = 0; sfx.wrong(); if (letter && again) L.items = requeue(L.items, L.i, letter, { camera: L.camera }); }
    setCombo();
    persist();
    const title = correct ? pickOne(helped ? PRAISE_AFTER_HELP : PRAISE) : "Not this time";
    footer({ tone: correct ? "good" : "bad", verdict: { title, text }, button: "Continue", auto, onClick: nextItem });
  }

  function nextItem() {
    current?.stop?.(); current = null;
    L.i++;
    progress();
    if (L.i >= L.items.length) return finishScreen();
    show(L.items[L.i]);
  }

  function show(it) {
    foot.className = "foot";
    const col = unitColor(it.letter ?? it.word?.[0] ?? "B");
    stage.className = `stage ${col}`;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "ex-enter";
    stage.append(box);
    const X = { learn: exLearn, copy: exSign, sign: exSign, pickSign: exPickSign, nameIt: exNameIt, spell: exSpell }[it.type];
    current = X(box, it) ?? null;
  }

  /* -- exercises -- */
  function exLearn(box, it) {
    const l = it.letter, t = TIPS[l];
    box.innerHTML = `<div class="ex-head"><div class="ex-kind">${ICON.star({ size: 20 })}New sign</div></div>
      <div class="learn">
        <div class="learn-pic"><img class="${flip(l)}" src="${pic(l)}" alt="The handshape for ${l}"></div>
        <div class="learn-copy"><div class="big">${l}</div><div class="gist">${esc(t.gist)}</div><p class="look">${esc(t.look)}</p>
        ${S.hand === "left" ? `<div class="mn">${ICON.hand({ size: 18 })}Shown for your left hand</div>` : ""}</div>
      </div>`;
    footer({ left: `<span style="color:var(--muted);font-weight:700">Take a good look. You'll make it next.</span>`, button: "Got it", onClick: () => { sfx.tap(); L.i++; progress(); L.i >= L.items.length ? finishScreen() : show(L.items[L.i]); } });
  }

  function camBox(el) {
    el.innerHTML = `<div class="cam-wait"><div><div class="spin"></div>Starting your camera…</div></div>`;
    let detach = () => {};
    const ready = camPromise?.then((ok) => {
      if (!ok || !cameraReady()) {
        el.innerHTML = `<div class="cam-wait"><div>${ICON.camera({ size: 40 })}<p style="margin:10px 0 0">I can't reach your camera. Check the browser's permission, or skip camera exercises for now.</p></div></div>`;
        return false;
      }
      el.innerHTML = "";
      detach = attachView(el);
      return true;
    });
    return { ready: ready ?? Promise.resolve(false), detach: () => detach() };
  }

  function exSign(box, it) {
    const l = it.letter, copy = it.type === "copy", check = !!it.check;
    const kind = copy ? "Copy the sign" : check ? "Check" : "From memory";
    box.innerHTML = `<div class="ex-head"><div class="ex-kind">${copy ? ICON.eye({ size: 20 }) : ICON.hand({ size: 20 })}${kind}</div>
        <h2 class="ex-title">${copy ? `Make the sign for ${l}` : "Sign this letter"}</h2></div>
      <div class="sign">
        <div class="sign-left"><div class="target"><div class="hold"><svg viewBox="0 0 196 196"><circle class="track" cx="98" cy="98" r="92"/><circle class="fill" cx="98" cy="98" r="92"/></svg><div class="glyph">${l}</div></div>
          <div class="picwrap">${copy ? `<img class="pic ${flip(l)}" src="${pic(l)}" alt="">` : ""}</div></div>
          <div class="coach">${mascot("encourage", { size: 84 })}<div class="bubble">${copy ? "Copy the picture, then hold still until the circle fills." : check ? "No help on this one. Hold it still when you're ready." : "Make the sign, then hold still."}</div></div></div>
        <div class="cam"></div>
      </div>`;
    const hold = box.querySelector(".hold"), cam = box.querySelector(".cam"), coach = box.querySelector(".coach"), picwrap = box.querySelector(".picwrap");
    const say = (text, tone = "", mood = "think") => { coach.innerHTML = `${mascot(POSE_FOR[tone === "warn" ? "warn" : mood], { size: 84, anim: mood === "cheer" ? "bounce" : "pop" })}<div class="bubble ${tone}">${esc(text)}</div>`; };
    const cb = camBox(cam);
    let run = null, stopped = false;
    footer({ left: `<button class="btn text" data-nocam>Can't use the camera now</button>`, button: "Skip", onClick: () => run?.skip() ?? nextItem() });
    footin.querySelector("[data-nocam]").addEventListener("click", noCamera);
    cb.ready.then(async (ok) => {
      if (!ok || stopped) return;
      run = runSign({
        model: await getModel(), hand: S.hand, letter: l, mode: copy ? "copy" : check ? "check" : "recall",
        onProgress: (p) => { hold.style.setProperty("--p", p); cam.classList.toggle("holding", p > 0.05); },
        onHint: (h) => {
          sfx.wrong();
          say(h.text, "warn");
          if (h.showPicture && !picwrap.innerHTML) picwrap.innerHTML = `<img class="pic ${flip(l)}" src="${pic(l)}" alt=""><div class="caption">Copy this</div>`;
        },
        onStatus: (s) => say(s, "", "think"),
        onDone: (r) => {
          if (r.skipped) { nextItem(); return; }
          hold.classList.toggle("win", r.correct);
          if (r.correct) say(r.misses ? "There it is." : "Perfect.", "", "cheer");
          if (!r.correct && !picwrap.innerHTML) picwrap.innerHTML = `<img class="pic ${flip(l)}" src="${pic(l)}" alt="">`;
          answered({ correct: r.correct, letter: l, how: r.how, rival: r.rival, part: r.part, helped: r.misses > 0,
            text: r.correct ? (copy ? `That's ${l}. Next time, from memory.` : r.misses ? "You fixed it." : `That's ${l}.`) : `This is ${l}. ${TIPS[l].gist}`,
            auto: r.correct ? 1500 : 0, again: !check });
        },
      });
    });
    return { stop() { stopped = true; run?.stop(); cb.detach(); } };
  }

  function exSpell(box, it) {
    const word = it.word;
    let k = 0, missesTotal = 0, run = null, stopped = false;
    box.innerHTML = `<div class="ex-head"><div class="ex-kind">${ICON.abc({ size: 20 })}Spell it</div><h2 class="ex-title">Fingerspell “${word.toLowerCase()}”</h2></div>
      <div class="word">${[...word].map((c, i) => `<div class="tile ${i === 0 ? "now" : ""}">${c}</div>`).join("")}</div>
      <div class="sign"><div class="sign-left"><div class="target"><div class="hold"><svg viewBox="0 0 196 196"><circle class="track" cx="98" cy="98" r="92"/><circle class="fill" cx="98" cy="98" r="92"/></svg><div class="glyph">${word[0]}</div></div><div class="picwrap"></div></div>
        <div class="coach">${mascot("encourage", { size: 84 })}<div class="bubble">One letter at a time. Hold each one until the circle fills.</div></div></div>
        <div class="cam"></div></div>`;
    const tiles = [...box.querySelectorAll(".tile")], hold = box.querySelector(".hold"), glyph = box.querySelector(".glyph"), cam = box.querySelector(".cam"), coach = box.querySelector(".coach"), picwrap = box.querySelector(".picwrap");
    const say = (text, tone = "", mood = "think") => { coach.innerHTML = `${mascot(POSE_FOR[tone === "warn" ? "warn" : mood], { size: 84, anim: mood === "cheer" ? "bounce" : "pop" })}<div class="bubble ${tone}">${esc(text)}</div>`; };
    const cb = camBox(cam);
    footer({ left: `<button class="btn text" data-nocam>Can't use the camera now</button>`, button: "Skip", onClick: () => { run?.stop(); nextItem(); } });
    footin.querySelector("[data-nocam]").addEventListener("click", noCamera);
    const letterRun = async () => {
      const l = word[k];
      glyph.textContent = l; picwrap.innerHTML = ""; hold.classList.remove("win");
      run = runSign({
        model: await getModel(), hand: S.hand, letter: l, mode: "recall",
        onProgress: (p) => hold.style.setProperty("--p", p),
        onHint: (h) => { sfx.wrong(); say(h.text, "warn"); if (h.showPicture) picwrap.innerHTML = `<img class="pic ${flip(l)}" src="${pic(l)}" alt="">`; },
        onStatus: (s) => say(s),
        onDone: (r) => {
          missesTotal += r.misses;
          record(letterOf(S, l), { how: r.how, correct: r.correct, now: now(), rival: r.rival, part: r.part });
          L.touched.add(l);
          tiles[k].classList.remove("now"); tiles[k].classList.add("ok"); sfx.hold();
          k++;
          if (k < word.length) { tiles[k].classList.add("now"); say("Next letter.", "", "happy"); letterRun(); }
          else {
            say("You spelled it!", "", "cheer");
            L.total++; L.right += missesTotal === 0 ? 1 : 0; if (missesTotal === 0) { L.combo++; L.best = Math.max(L.best, L.combo); } setCombo();
            sfx.right(); persist();
            footer({ tone: "good", verdict: { title: missesTotal ? "Spelled!" : "Beautiful spelling!", text: `${word.toLowerCase()}, one letter at a time.` }, button: "Continue", auto: 1800, onClick: nextItem });
          }
        },
      });
    };
    cb.ready.then((ok) => { if (ok && !stopped) letterRun(); });
    return { stop() { stopped = true; run?.stop(); cb.detach(); } };
  }

  function choiceEx(box, it, { title, kind, options, render, cls, before = "" }) {
    let chosen = null, locked = false;
    box.innerHTML = `<div class="ex-head"><div class="ex-kind">${ICON.eye({ size: 20 })}${kind}</div><h2 class="ex-title">${title}</h2></div>
      ${before}<div class="choices ${cls}">${options.map((o, i) => `<button class="choice" data-o="${o}"><span class="key">${i + 1}</span>${render(o)}</button>`).join("")}</div>`;
    const btns = [...box.querySelectorAll(".choice")];
    const f = footer({ button: "Check", disabled: true, onClick: check });
    const pick = (b) => { if (locked) return; sfx.tap(); btns.forEach((x) => x.classList.toggle("sel", x === b)); chosen = b.dataset.o; f.enable(); };
    btns.forEach((b) => b.addEventListener("click", () => pick(b)));
    function check() {
      if (!chosen || locked) return;
      locked = true;
      const right = chosen === it.letter;
      btns.forEach((b) => { b.disabled = true; b.classList.remove("sel"); if (b.dataset.o === it.letter) b.classList.add("right"); else if (b.dataset.o === chosen) b.classList.add("wrong"); });
      answered({ correct: right, letter: it.letter, how: "recognise", rival: right ? null : chosen,
        text: right ? (it.contrast ? `${it.letter} and ${it.contrast} are easy to mix up. You didn't.` : "") : `That one is ${chosen}. ${it.letter}: ${TIPS[it.letter].gist}` });
    }
    return { key(e) { const n = +e.key; if (n >= 1 && n <= btns.length) pick(btns[n - 1]); } };
  }

  function exPickSign(box, it) {
    return choiceEx(box, it, {
      kind: it.contrast ? "Easy to mix up" : "Pick the sign", title: `Which one is ${it.letter}?`, options: it.options, cls: "pics",
      render: (o) => `<img class="${flip(o)}" src="${pic(o)}" alt="Handshape option">`,
    });
  }

  function exNameIt(box, it) {
    const options = it.options ?? shuffle([it.letter, ...distractors(S, it.letter, 3, Math.random)]);
    return choiceEx(box, it, {
      kind: "Name the sign", title: "Which letter is this?", options, cls: "letters",
      before: `<img class="name-pic ${flip(it.letter)}" src="${pic(it.letter)}" alt="A handshape">`,
      render: (o) => `<span class="l">${o}</span>`,
    });
  }

  function noCamera() {
    S.cameraOffUntil = now() + 3600e3; persist();
    current?.stop?.(); current = null;
    L.camera = false;
    L.items = L.items.map((x, j) => (j < L.i || !["copy", "sign", "spell"].includes(x.type) ? x
      : x.type === "spell" ? { type: "nameIt", letter: x.word[0] } : { type: Math.random() < 0.5 ? "nameIt" : "pickSign", letter: x.letter, options: shuffle([x.letter, ...distractors(S, x.letter, 2, Math.random)]) }));
    show(L.items[L.i]);
  }

  /* -- the end -- */
  function finishScreen() {
    cleanup();
    const secs = Math.round((now() - L.t0) / 1000);
    const acc = L.total ? L.right / L.total : 1;
    const isCheck = node.kind === "check";
    const passed = !isCheck || acc >= 0.8;
    if (isCheck && passed) for (const l of node.letters) { const R = letterOf(S, l); R.introduced = true; R.pL = Math.max(R.pL, 0.9); R.lastT ??= now(); R.h = Math.max(R.h, 48); }
    const xp = passed ? 10 + Math.round(acc * 5) + (L.best >= 5 ? 3 : 0) : 5;
    if (passed) finishLesson(S, { xp, now: now(), nodeId: ALL_NODES.some((n) => n.id === node.id) ? node.id : null });
    else { S.xp += xp; }
    persist();
    sfx.done();
    const skills = [...L.touched].map((l) => {
      const v = strength(S.letters[l], now());
      return `<div class="skill ${unitColor(l)}"><div class="k">${l}</div><div class="meter"><i style="--v:${L.before[l] ?? 0}"></i></div><div class="lab">${isMastered(S.letters[l]) ? "Learned" : v > (L.before[l] ?? 0) + 0.02 ? "Stronger" : "Practised"}</div></div>`;
    }).join("");
    const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    const ui = UNITS.findIndex((u) => u.id === node.unit);
    const nextCheck = isCheck && ui >= 0 && UNITS[ui + 1] ? `${UNITS[ui + 1].id}-check` : null;
    root.innerHTML = `<div class="lesson"><div></div><div class="finish">
      ${mascot(passed ? "jump" : "encourage", { size: 220, anim: passed ? "bounce" : "idle" })}
      <h1>${passed ? (isCheck ? "Unit complete!" : "Lesson complete!") : "Nearly there"}</h1>
      <p class="lede">${passed ? (L.best >= 5 ? `${L.best} in a row. You're on a roll.` : acc < 0.6 ? "Some of those were tricky. They'll come back soon, and they'll get easier." : "Every rep counts. See you tomorrow?") : "You need 4 out of 5 to pass the check. The practice before it will get you there."}</p>
      <div class="tiles3">
        <div class="tally" style="--t:var(--gold)"><div class="th">XP</div><div class="tb">${ICON.bolt()}${xp}</div></div>
        <div class="tally" style="--t:var(--good)"><div class="th">${acc >= 0.9 ? "Amazing" : "Accuracy"}</div><div class="tb">${ICON.target()}${Math.round(acc * 100)}%</div></div>
        <div class="tally" style="--t:var(--sky)"><div class="th">Time</div><div class="tb">${ICON.clock()}${mm}</div></div>
      </div>
      ${skills ? `<div class="skills"><h3 style="margin-bottom:6px">Letters you worked on</h3>${skills}</div>` : ""}
      <button class="btn wide" data-done>Continue</button>
      ${isCheck && passed && nextCheck ? `<button class="btn ghost wide" data-next-check style="margin-top:14px">Know the next unit too? Take its check</button>` : ""}
    </div><div></div></div>`;
    if (passed) confetti(document.body);
    requestAnimationFrame(() => setTimeout(() => {
      root.querySelectorAll(".skill").forEach((row) => { const l = row.querySelector(".k").textContent; row.querySelector("i").style.setProperty("--v", strength(S.letters[l], now())); });
    }, 250));
    const done = () => go("#/");
    root.querySelector("[data-done]").addEventListener("click", done);
    root.querySelector("[data-next-check]")?.addEventListener("click", () => go(`#/lesson/${nextCheck}`));
    const k = (e) => e.key === "Enter" && done();
    document.addEventListener("keydown", k);
    cleanup = () => document.removeEventListener("keydown", k);
  }

  progress();
  show(L.items[0]);
}

/* ---- letters: the skill meter --------------------------------------------------- */
function letterState(l) {
  const R = S.letters[l];
  if (!R?.introduced) return { key: "new", label: "New", v: 0 };
  const v = strength(R, now());
  if (isMastered(R)) return v >= 0.75 ? { key: "strong", label: "Strong", v } : { key: "fading", label: "Fading", v };
  return { key: "learning", label: "Learning", v };
}

function lettersPage() {
  const tiles = ALL_LETTERS.slice().sort().map((l) => {
    const st = letterState(l);
    return `<button class="lt ${st.key === "new" ? "new" : ""} ${unitColor(l)}" data-l="${l}">
      <span class="g">${l}</span><img class="${flip(l)}" src="${pic(l)}" alt="">
      <span class="meter"><i style="--v:${st.v}"></i></span><span class="st">${st.label}</span></button>`;
  }).join("");
  const learned = ALL_LETTERS.filter((l) => isMastered(S.letters[l])).length;
  frame("letters", `<h1 class="page-title">Your letters</h1>
    <p class="page-sub">${learned ? `${learned} of 26 learned.` : "Nothing learned yet. The first lesson takes about four minutes."} The bar is how likely you are to remember each one right now, and it drops if you leave a letter alone for a while.</p>
    <div class="grid26">${tiles}</div>`);
  root.querySelectorAll("[data-l]").forEach((b) => b.addEventListener("click", () => letterModal(b.dataset.l)));
}

function letterModal(l) {
  const R = S.letters[l], st = letterState(l), rival = worstRival(R);
  const worstPart = R ? Object.entries(R.parts).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
  const m = modal(`<div class="${unitColor(l)}">
    <div class="head"><img class="${flip(l)}" src="${pic(l)}" alt=""><div><div class="g" style="color:var(--c)">${l}</div><div style="font:600 15px/1 var(--display);color:var(--muted)">${st.label}</div></div></div>
    <p style="font-weight:700;color:var(--ink)">${esc(TIPS[l].gist)}</p><p>${esc(TIPS[l].look)}</p>
    ${rival ? `<div class="mix">You sometimes make ${rival} instead. ${esc(TIPS[rival].gist)}</div>` : ""}
    ${worstPart && !rival ? `<div class="mix">What usually needs fixing: ${esc(hint(l, worstPart, 2))}</div>` : ""}
    ${R?.introduced ? `<div class="meter" style="margin:14px 0 4px"><i style="--v:${st.v}"></i></div>` : ""}
    <div class="row"><button class="btn ghost" data-close>Close</button>${R?.introduced ? `<button class="btn" data-practise>Practise ${l}</button>` : ""}</div></div>`);
  m.el.querySelector("[data-practise]")?.addEventListener("click", () => { m.close(); go(`#/lesson/letter-${l}`); });
}

/* ---- settings ----------------------------------------------------------------- */
function settingsPage() {
  const opt = (name, val, label, cur) => `<button class="opt ${cur === val ? "sel" : ""}" data-set="${name}" data-val="${val}"><div><b>${label}</b></div></button>`;
  frame("settings", `<h1 class="page-title">Settings</h1><p class="page-sub">Saved in this browser.</p>
    <div class="panel" style="margin-bottom:16px"><h3>Signing hand</h3><div class="opts two">${opt("hand", "right", "Right hand", S.hand)}${opt("hand", "left", "Left hand", S.hand)}</div></div>
    <div class="panel" style="margin-bottom:16px"><h3>Daily goal</h3><div class="opts">${opt("goal", 1, "One lesson a day", S.goal)}${opt("goal", 2, "Two lessons a day", S.goal)}${opt("goal", 3, "Three lessons a day", S.goal)}</div></div>
    <div class="panel" style="margin-bottom:16px"><h3>Sound</h3><div class="opts two">${opt("sound", "on", "On", S.sound ? "on" : "off")}${opt("sound", "off", "Off", S.sound ? "on" : "off")}</div></div>
    <div class="panel" style="margin-bottom:16px"><h3>Your name</h3><input class="field" id="nm" maxlength="20" value="${esc(S.name)}" placeholder="First name"></div>
    <div class="panel"><h3>Start over</h3><p class="sub" style="margin:0 0 14px">Forget every letter and begin again from the welcome screen.</p><button class="btn bad small" data-reset>Reset my progress</button></div>
    <p class="sub" style="margin:24px 4px;color:var(--muted);font-size:14px">Grading comes from a model trained on public hand data and can be wrong. Hand pictures: public domain.</p>`);
  root.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => {
    const { set, val } = b.dataset;
    if (set === "hand") S.hand = val;
    if (set === "goal") S.goal = +val;
    if (set === "sound") { S.sound = val === "on"; setSound(S.sound); }
    sfx.tap(); persist(); settingsPage();
  }));
  root.querySelector("#nm").addEventListener("change", (e) => { S.name = e.target.value.replace(/[^A-Za-z]/g, ""); persist(); });
  root.querySelector("[data-reset]").addEventListener("click", () => {
    const m = modal(`<h2 style="margin-bottom:8px">Reset everything?</h2><p>All your letters, XP and your streak will be gone. This can't be undone.</p><div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn bad" data-yes>Reset</button></div>`);
    m.el.querySelector("[data-yes]").addEventListener("click", () => { m.close(); S = newState(); persist(); go("#/welcome"); });
  });
}

route();
