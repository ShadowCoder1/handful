/* learner.js: what the app believes you know, and how sure it is.
 *
 * Two ideas, both from the tutoring literature, combined per letter:
 *
 * 1. KNOWLEDGE TRACING (Corbett & Anderson 1995). Each letter is a skill that
 *    is either learned or not. `pL` is the probability it is learned. Every
 *    time you sign it, pL is updated by Bayes' rule with a guess rate (right
 *    without knowing it) and a slip rate (wrong while knowing it), then nudged
 *    up by `learn` for having practised. A letter is mastered at pL >= 0.95,
 *    the cognitive tutors' mastery criterion.
 *
 *    How much an answer tells us depends on how it was given. Signing from
 *    memory is strong evidence. Copying a picture is weak evidence (anyone
 *    can copy), and an answer reached only after the fix was spelled out is
 *    practice, not evidence: it helps learning but cannot prove it.
 *
 * 2. FORGETTING (half-life regression, Settles & Meeder 2016). Learned is not
 *    forever. Each letter has a memory half-life `h` in hours; the chance you
 *    still have it after t hours is 2^(-t/h). A correct recall after a gap
 *    makes the memory last longer, more so the longer the gap was (spaced
 *    retrieval), and a miss shortens it. Practice picks letters whose
 *    predicted strength has dropped, and skips the ones you clearly still
 *    know, instead of drilling everything.
 *
 * It also keeps a bug catalogue: which letter you made instead (the grader's
 * rival) and which part of the hand was wrong, so the planner can set up
 * side-by-side practice for the pairs you personally mix up.
 *
 * Pure except for load/save, so it runs under node --test. */

export const MASTERY = 0.95;
const HOUR = 3600e3;

/* Evidence strength by how the answer was produced. g = guess, s = slip. */
export const EVIDENCE = {
  recall: { g: 0.12, s: 0.1, learn: 0.22 },        // signed from memory, no help
  nudged: { g: 0.35, s: 0.1, learn: 0.2 },         // right after "check your thumb"
  copy: { g: 0.7, s: 0.12, learn: 0.18 },          // picture on screen
  recognise: { g: 0.33, s: 0.05, learn: 0.1 },     // picked the right picture
};

export function newLetter() {
  return { pL: 0.08, h: 10, lastT: null, seen: 0, right: 0, streak: 0, lapses: 0, confusions: {}, parts: {}, introduced: false, recog: 0.2 };
}

/* Bayes on one answer, then the chance of having learned from the practice. */
export function trace(pL, correct, { g, s, learn }) {
  const post = correct
    ? (pL * (1 - s)) / (pL * (1 - s) + (1 - pL) * g)
    : (pL * s) / (pL * s + (1 - pL) * (1 - g));
  return post + (1 - post) * learn;
}

/* How likely you still know it right now: learned, times not yet forgotten. */
export function strength(L, now) {
  if (!L || !L.introduced || L.lastT === null) return 0;
  const hours = Math.max(0, (now - L.lastT) / HOUR);
  return L.pL * Math.pow(2, -hours / L.h);
}

export const isMastered = (L) => !!L && L.pL >= MASTERY;

/**
 * Record one answer.
 * @param {object} L          the letter's record (mutated and returned)
 * @param {object} a
 * @param {"recall"|"nudged"|"copy"|"recognise"|"assisted"} a.how
 * @param {boolean} a.correct
 * @param {number} a.now
 * @param {string|null} [a.rival]   the letter the grader saw instead
 * @param {string|null} [a.part]    the part of the hand it blamed
 */
export function record(L, { how, correct, now, rival = null, part = null }) {
  L.introduced = true;
  L.seen++;
  if (rival) L.confusions[rival] = (L.confusions[rival] ?? 0) + 1;
  if (part) L.parts[part] = (L.parts[part] ?? 0) + 1;

  if (how === "recognise") {
    // Knowing which picture is which is a different, easier skill; it is
    // tracked on its own and moves the hand skill only a little.
    L.recog = trace(L.recog, correct, EVIDENCE.recognise);
    if (correct) L.pL = L.pL + (1 - L.pL) * 0.03;
    return L;
  }

  const gapH = L.lastT === null ? 0 : (now - L.lastT) / HOUR;
  if (how === "assisted") {
    // Shown the answer: counts as practice, not as proof.
    L.pL = L.pL + (1 - L.pL) * 0.1;
  } else {
    L.pL = trace(L.pL, correct, EVIDENCE[how]);
  }

  if (how === "recall" && correct) {
    L.right++;
    L.streak++;
    // A recall that had to reach further back strengthens the memory more.
    const reach = Math.min(1, gapH / L.h);
    L.h = Math.min(24 * 120, L.h * (1.4 + 1.6 * reach));
  } else if (!correct && (how === "recall" || how === "nudged")) {
    L.streak = 0;
    if (L.pL < MASTERY) L.lapses++;
    L.h = Math.max(4, L.h * 0.5);
  }
  L.lastT = now;
  return L;
}

/* The letter this learner most often makes instead of `letter`, if any has
 * happened at least twice. */
export function worstRival(L) {
  const best = Object.entries(L?.confusions ?? {}).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

/* ---- the whole learner, and keeping it on this device ------------------- */

const KEY = "handful.v1";

export function newState() {
  return {
    v: 1,
    created: Date.now(),
    name: "",
    hand: "right",
    goal: 1,                 // lessons a day
    sound: true,
    onboarded: false,
    xp: 0,
    days: {},                // "2026-09-24": { xp, lessons }
    streak: 0,
    lastActive: null,        // day key
    letters: {},             // letter -> record
    done: {},                // node id -> times completed
    cameraOffUntil: 0,
  };
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return newState();
    const s = JSON.parse(raw);
    return s && s.v === 1 ? { ...newState(), ...s } : newState();
  } catch {
    return newState();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: progress lasts this visit */ }
}

export const letterOf = (state, l) => (state.letters[l] ??= newLetter());

export const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* A lesson finished: XP, today's total, and the streak (a day counts once
 * the day's goal is met; a missed day starts it again). */
export function finishLesson(state, { xp, now, nodeId }) {
  const today = dayKey(now);
  const day = (state.days[today] ??= { xp: 0, lessons: 0 });
  day.xp += xp;
  day.lessons += 1;
  state.xp += xp;
  if (nodeId) state.done[nodeId] = (state.done[nodeId] ?? 0) + 1;
  if (day.lessons === state.goal) {
    const yesterday = dayKey(now - 864e5);
    state.streak = state.lastActive === yesterday || state.lastActive === today ? state.streak + 1 : 1;
    state.lastActive = today;
  }
  return state;
}

/* The streak as it stands today: it lapses if yesterday's goal was missed. */
export function currentStreak(state, now) {
  const today = dayKey(now), yesterday = dayKey(now - 864e5);
  return state.lastActive === today || state.lastActive === yesterday ? state.streak : 0;
}
