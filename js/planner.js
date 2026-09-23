/* planner.js: the path, and what goes into each lesson.
 *
 * The rules, and where they come from:
 *
 *  - Two new signs at a time, at most (cognitive tutors: keep working memory
 *    load low; each new skill is introduced in the task, not in a lecture).
 *  - A new sign is shown, then copied with the picture up, then asked for
 *    from memory later in the same lesson, never straight after (retrieval
 *    practice needs a gap to be retrieval).
 *  - The picture is guidance and it fades (the guidance hypothesis in motor
 *    learning: feedback you lean on while learning hurts you once it's gone).
 *    Copy first, then recall, and in checks, nothing but the letter.
 *  - Mixed, not blocked: letters are interleaved (contextual interference),
 *    and no letter comes twice in a row.
 *  - Practice goes where the need is. Letters are chosen by predicted
 *    strength (learner.js), so what you clearly know is skipped and what is
 *    fading or shaky comes back.
 *  - Mix-ups get their own practice: a pair you confuse is put side by side.
 *
 * Pure: a random source is passed in, so tests can fix it. */

import { UNITS, CONFUSABLE, WORDS, spellable, ALL_LETTERS } from "./course.js";
import { strength, isMastered, worstRival } from "./learner.js";

/* ---- the path ------------------------------------------------------------ */

export function unitNodes(unit) {
  const L = unit.letters;
  const nodes = [];
  for (let i = 0; i < L.length; i += 2) {
    const fresh = L.slice(i, i + 2);
    nodes.push({ id: `${unit.id}-learn-${i / 2 + 1}`, unit: unit.id, kind: "learn", letters: fresh, title: `Learn ${fresh.join(" and ")}` });
  }
  nodes.push({ id: `${unit.id}-practice`, unit: unit.id, kind: "practice", letters: L, title: "Mix it up" });
  if (unit.id !== "u6") nodes.push({ id: `${unit.id}-words`, unit: unit.id, kind: "words", letters: L, title: "Spell words" });
  nodes.push({ id: `${unit.id}-check`, unit: unit.id, kind: "check", letters: L, title: `${unit.title}: check` });
  return nodes;
}

export const PATH = UNITS.map((u) => ({ unit: u, nodes: unitNodes(u) }));
export const ALL_NODES = PATH.flatMap((p) => p.nodes);

/* Where you are: the first node not yet done. A unit whose check was passed
 * counts as done throughout (you tested out of it). */
export function nodeStatus(state) {
  const passedUnits = new Set(UNITS.filter((u) => state.done[`${u.id}-check`]).map((u) => u.id));
  const status = {};
  let current = null;
  for (const n of ALL_NODES) {
    const done = (state.done[n.id] ?? 0) > 0 || passedUnits.has(n.unit);
    if (done) status[n.id] = "done";
    else if (current === null) { status[n.id] = "current"; current = n.id; }
    else status[n.id] = "locked";
  }
  return { status, current };
}

/* ---- choosing letters ------------------------------------------------------ */

const introduced = (state) => ALL_LETTERS.filter((l) => state.letters[l]?.introduced);

/* Need: how much practising this letter now would help. Low strength is
 * high need; a letter with a known mix-up gets a little more. */
export function need(state, l, now) {
  const L = state.letters[l];
  if (!L?.introduced) return 0;
  return 1 - strength(L, now) + (worstRival(L) ? 0.1 : 0);
}

/* Letters worth reviewing, neediest first; ones you clearly know are left out. */
export function reviewPool(state, now, { among = null, knownAbove = 0.9 } = {}) {
  return introduced(state)
    .filter((l) => !among || among.includes(l))
    .filter((l) => strength(state.letters[l], now) < knownAbove)
    .sort((a, b) => need(state, b, now) - need(state, a, now));
}

/* Distractors: the letters most like this one first (the confusions that
 * matter), then others the learner has seen, then the rest of the unit. */
export function distractors(state, letter, n, rng) {
  const out = [];
  const add = (l) => { if (l && l !== letter && !out.includes(l) && out.length < n) out.push(l); };
  add(worstRival(state.letters[letter]));
  for (const l of shuffle(CONFUSABLE[letter] ?? [], rng)) add(l);
  for (const l of shuffle(introduced(state), rng)) add(l);
  for (const u of UNITS) if (u.letters.includes(letter)) for (const l of shuffle(u.letters, rng)) add(l);
  for (const l of shuffle(ALL_LETTERS.filter((x) => x !== "J" && x !== "Z"), rng)) add(l);
  return out;
}

/* ---- building a lesson ------------------------------------------------------ */

/** @returns {{title:string, items:object[], camera:boolean}} */
export function buildLesson(node, state, now, rng = Math.random, { camera = true } = {}) {
  const sign = (letter, extra = {}) => (camera ? { type: "sign", letter, ...extra } : pickOrName(letter));
  const pickOrName = (letter) => (rng() < 0.5
    ? { type: "pickSign", letter, options: shuffle([letter, ...distractors(state, letter, 2, rng)], rng) }
    : { type: "nameIt", letter, options: shuffle([letter, ...distractors(state, letter, 3, rng)], rng) });

  let items = [];
  if (node.kind === "learn") {
    const fresh = node.letters.filter((l) => !isMastered(state.letters[l]));
    const review = reviewPool(state, now).filter((l) => !node.letters.includes(l)).slice(0, 3);
    for (const l of fresh) {
      items.push({ type: "learn", letter: l });
      items.push(camera ? { type: "copy", letter: l } : { type: "pickSign", letter: l, options: shuffle([l, ...distractors(state, l, 2, rng)], rng) });
    }
    // Then recall, spaced out and mixed with review.
    const recallA = fresh.map((l) => pickOrName(l));
    const recallB = fresh.map((l) => sign(l));
    const recallC = fresh.map((l) => sign(l));
    items.push(...interleave([recallA, review.slice(0, 1).map((l) => sign(l)), recallB, review.slice(1).map((l) => sign(l)), recallC]));
    if (!fresh.length) items.push(...node.letters.map((l) => sign(l)));
  } else if (node.kind === "practice") {
    items = practiceItems(state, now, rng, node.letters, 10, sign, pickOrName);
  } else if (node.kind === "words") {
    const known = introduced(state);
    const words = shuffle(WORDS.filter((w) => w.length <= 5 && spellable(w, known) && [...w.toUpperCase()].some((c) => node.letters.includes(c))), rng).slice(0, 3);
    const name = state.name && !/(.)\1/i.test(state.name) && spellable(state.name, known) ? [state.name.toLowerCase()] : [];
    const list = [...name, ...words].slice(0, 3);
    items = camera ? list.map((w) => ({ type: "spell", word: w.toUpperCase() })) : list.flatMap((w) => [...w.toUpperCase()].slice(0, 2).map(pickOrName));
    const weak = reviewPool(state, now, { among: node.letters }).slice(0, 3);
    items = interleave([items, weak.map((l) => sign(l))]);
    if (!items.length) items = practiceItems(state, now, rng, node.letters, 8, sign, pickOrName);
  } else if (node.kind === "check") {
    items = shuffle(node.letters, rng).map((l) => (camera ? { type: "sign", letter: l, check: true } : pickOrName(l)));
  } else if (node.kind === "review") {
    items = practiceItems(state, now, rng, null, 10, sign, pickOrName);
  }
  return { title: node.title, items: noRepeats(items), camera };
}

function practiceItems(state, now, rng, among, count, sign, pickOrName) {
  const pool = reviewPool(state, now, { among });
  const base = pool.length ? pool : introduced(state).filter((l) => !among || among.includes(l));
  if (!base.length) return [];
  const items = [];
  // Your own mix-ups first, as side-by-side choices.
  for (const l of base.slice(0, 4)) {
    const r = worstRival(state.letters[l]);
    if (r) items.push({ type: "pickSign", letter: l, options: shuffle([l, r], rng), contrast: r });
  }
  // Then the neediest letters, weighted toward the top, spread through.
  let i = 0;
  while (items.length < count) {
    const l = base[Math.min(base.length - 1, Math.floor(Math.pow(rng(), 1.6) * base.length))] ?? base[i++ % base.length];
    items.push(items.length % 4 === 3 ? pickOrName(l) : sign(l));
  }
  return shuffle(items, rng);
}

/* After a miss, the same letter comes back a few items later (at most twice). */
export function requeue(items, index, letter, { gap = 3, camera = true } = {}) {
  const already = items.slice(index + 1).filter((it) => it.letter === letter && it.requeued).length;
  if (already >= 2) return items;
  const at = Math.min(items.length, index + 1 + gap);
  const it = camera ? { type: "sign", letter, requeued: true } : { type: "nameIt", letter, requeued: true, options: null };
  return [...items.slice(0, at), it, ...items.slice(at)];
}

/* ---- small helpers ------------------------------------------------------------ */

export function shuffle(a, rng = Math.random) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function interleave(groups) {
  const out = [];
  for (const g of groups) out.push(...g);
  return out;
}

/* No letter twice in a row: swap a repeat with the next different item. */
export function noRepeats(items) {
  const a = items.slice();
  const key = (it) => it.letter ?? it.word;
  for (let i = 1; i < a.length; i++) {
    if (key(a[i]) && key(a[i]) === key(a[i - 1]) && a[i].type !== "copy" && a[i - 1].type !== "learn") {
      const j = a.findIndex((it, k) => k > i && key(it) !== key(a[i - 1]));
      if (j > 0) [a[i], a[j]] = [a[j], a[i]];
    }
  }
  return a;
}
