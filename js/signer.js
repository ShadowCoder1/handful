/* signer.js: one "make this sign" exercise, from the camera to a verdict.
 *
 * The grading itself is the study's engine (engine/engine.js): it decides
 * when a hand is being held as an answer, whether it is this letter, and if
 * not, which letter it looks like and which part of the hand is off. What
 * this file adds is the tutoring on top, in the cognitive tutors' style:
 *
 *   A hint ladder. First miss: a nudge that only says where to look (or which
 *   letter you made instead). Second: the exact fix. Third: the picture, to
 *   copy. Help is given only as it's needed, and the answer records how much
 *   help it took, because a sign made after being shown is practice, not
 *   proof (js/learner.js).
 *
 *   In a check there is no ladder: two tries, a nudge between, and then it
 *   moves on. A check measures, it doesn't teach.
 *
 * Nothing here touches the page; it reports to callbacks. */

import { createEngine } from "../engine/engine.js";
import { LETTERS } from "../tutor/letters.js";
import { hint, madeInstead, TIPS } from "./course.js";
import { onFrame } from "./camera.js";

let engine = null, engineHand = null;
export function getEngine(model, hand) {
  if (!engine || engineHand !== hand) {
    engine = createEngine({ model, letters: LETTERS, hintPolicy: "strict", gradeAll: true, hand });
    engineHand = hand;
  }
  return engine;
}

/**
 * @param {object} o
 * @param {object} o.model          loaded grader model
 * @param {"right"|"left"} o.hand
 * @param {string} o.letter
 * @param {"copy"|"recall"|"check"} o.mode
 * @param {(p:number)=>void} o.onProgress        hold ring, 0..1
 * @param {(h:object)=>void} o.onHint            { level, text, showPicture }
 * @param {(s:string)=>void} o.onStatus          camera trouble, gentle
 * @param {(r:object)=>void} o.onDone            { correct, how, rival, part, misses }
 * @param {Function} [o.subscribe]              frame source (tests feed recorded frames)
 */
export function runSign({ model, hand, letter, mode, onProgress, onHint, onStatus, onDone, subscribe = onFrame }) {
  const eng = getEngine(model, hand);
  let trial = 0, misses = 0, finished = false, lastRival = null, lastPart = null, helped = 0;
  const start = () => eng.startTrial({ id: `h${Date.now()}_${trial++}`, letter, kind: "teach" });
  start();
  let t0 = null;

  const off = subscribe((f) => {
    if (finished) return;
    if (t0 === null) t0 = f.t;
    const out = eng.frame({ tMs: Math.round(f.t - t0), flat: f.flat, aspect: f.aspect, videoHeight: f.videoHeight, handedness: f.handedness });
    onProgress(out.paused ? 0 : out.progress);
    for (const e of out.effects) {
      if (e.kind === "log" && e.event === "attempt") handleAttempt(e.data);
      if (e.kind === "end-trial" && !finished) { t0 = null; start(); }   // the engine gave up on its trial; we haven't
    }
  });

  function handleAttempt(a) {
    if (finished) return;
    if (a.wrongHand) { onHint({ level: 0, text: `Use your ${hand} hand.`, tone: "info" }); return; }
    if (a.outcome === "abstain") {
      onStatus(a.reason === "borderline" ? "Almost. Hold it a little clearer." : "Move your hand to the middle so I can see all of it.");
      return;
    }
    if (a.outcome === "accept") {
      const how = mode === "copy" ? "copy" : helped === 0 ? "recall" : helped === 1 ? "nudged" : "assisted";
      finish({ correct: true, how, misses });
      return;
    }
    if (a.repeat) { onStatus("Same shape as before. Change something and hold again."); return; }
    misses++;
    lastRival = a.triage === "retrieval" && a.rival && a.rival !== letter ? a.rival : null;
    lastPart = a.hintId ? a.hintId.split(".")[1] : lastPart;

    if (mode === "check") {
      if (misses >= 2) { finish({ correct: false, how: "recall", misses, reveal: true }); return; }
      helped = 1;
      onHint({ level: 1, text: lastRival ? `That looks like ${lastRival}. Try again.` : lastPart ? hint(letter, lastPart, 1) : "Not quite. Try again.", tone: "warn" });
      return;
    }
    const level = Math.min(3, misses);
    helped = Math.max(helped, level);
    if (level === 1) {
      onHint({ level, tone: "warn", text: lastRival ? madeInstead(letter, lastRival) : lastPart ? hint(letter, lastPart, 1) : "Not quite. Look again and hold it still." });
    } else if (level === 2) {
      onHint({ level, tone: "warn", text: lastPart ? hint(letter, lastPart, 2) : TIPS[letter].gist });
    } else {
      onHint({ level, tone: "warn", text: "Here it is. Copy the picture.", showPicture: true });
      if (misses >= 6) finish({ correct: false, how: "assisted", misses, reveal: true });
    }
  }

  function finish(r) {
    finished = true;
    off();
    onProgress(0);
    onDone({ ...r, rival: lastRival, part: lastPart });
  }

  return {
    stop() { finished = true; off(); },
    skip() { if (!finished) finish({ correct: false, how: "assisted", misses, skipped: true }); },
  };
}
