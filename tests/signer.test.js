/* The exercise controller on real recorded hands: the owner's own L and Y,
 * mirrored into a right hand. The engine is the study's; this checks the
 * tutoring on top of it. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadModel } from "../tutor/verifier.js";
import { runSign } from "../js/signer.js";

const model = loadModel(JSON.parse(readFileSync(new URL("../tutor/model.json", import.meta.url))));
const fx = JSON.parse(readFileSync(new URL("./fixtures/holds.json", import.meta.url)));

function play(clip, letter, mode, hand = "right", loops = 3) {
  const hints = [], statuses = [];
  let done = null;
  let fn = null;
  const r = runSign({ model, hand, letter, mode, subscribe: (f) => { fn = f; return () => { fn = null; }; },
    onProgress: () => {}, onHint: (h) => hints.push(h), onStatus: (s) => statuses.push(s), onDone: (d) => { done = d; } });
  let t = 0;
  for (let k = 0; k < loops && !done; k++) {
    for (const f of fx.clips[clip]) {
      if (!fn) break;
      fn({ t: t + f.t, flat: f.lm, aspect: fx.aspect, videoHeight: fx.height, handedness: f.h });
    }
    t += 8000;
    // between loops the hand drops out of view, as a person would reset
    for (let i = 0; i < 30 && fn; i++) fn({ t: t + i * 33, flat: null, aspect: fx.aspect, videoHeight: fx.height, handedness: null });
    t += 2000;
  }
  r.stop();
  return { done, hints, statuses };
}

test("a real L signed from memory is accepted, as unaided recall", () => {
  const { done, hints } = play("L", "L", "recall");
  assert.ok(done?.correct, JSON.stringify({ done, hints }));
  assert.equal(done.how, "recall");
  assert.equal(hints.length, 0);
});

test("the same L while copying counts as a copy", () => {
  const { done } = play("L", "L", "copy");
  assert.equal(done?.how, "copy");
});

test("a Y held when the answer is L gets a hint, and the hints climb the ladder", () => {
  const { done, hints } = play("Y", "L", "recall", "right", 4);
  assert.ok(hints.length >= 2, JSON.stringify(hints));
  assert.equal(hints[0].level, 1);
  assert.ok(hints[1].level >= 2);
  assert.ok(!done?.correct);
});

test("in a check a wrong sign gets one nudge and then moves on, marked wrong", () => {
  const { done, hints } = play("Y", "L", "check", "right", 4);
  assert.equal(done?.correct, false);
  assert.ok(hints.length <= 1);
});

test("signing with the other hand is not counted against you", () => {
  const { done, hints } = play("L", "L", "recall", "left");
  assert.ok(hints.some((h) => /left hand/.test(h.text)), JSON.stringify(hints));
  assert.ok(!done?.correct);
});
