import test from "node:test";
import assert from "node:assert/strict";
import { trace, EVIDENCE, newLetter, record, strength, isMastered, MASTERY, finishLesson, currentStreak, newState, worstRival, dayKey } from "../js/learner.js";

const H = 3600e3;

test("knowledge tracing: a right answer raises pL, a wrong one lowers it", () => {
  assert.ok(trace(0.3, true, EVIDENCE.recall) > 0.3);
  assert.ok(trace(0.6, false, { ...EVIDENCE.recall, learn: 0 }) < 0.6);
});

test("recall from memory is stronger evidence than copying a picture", () => {
  assert.ok(trace(0.2, true, EVIDENCE.recall) > trace(0.2, true, EVIDENCE.copy));
});

test("a few unaided recalls reach mastery; copying alone does not", () => {
  const a = newLetter(), b = newLetter();
  for (let i = 0; i < 4; i++) record(a, { how: "recall", correct: true, now: i * H });
  for (let i = 0; i < 4; i++) record(b, { how: "copy", correct: true, now: i * H });
  assert.ok(isMastered(a), `recall pL ${a.pL}`);
  assert.ok(!isMastered(b), `copy pL ${b.pL}`);
});

test("being shown the answer is practice, not proof", () => {
  const L = newLetter();
  record(L, { how: "assisted", correct: true, now: 0 });
  assert.ok(L.pL < 0.25);
});

test("memory fades with time, and a spaced recall makes it last longer", () => {
  const L = newLetter();
  for (let i = 0; i < 4; i++) record(L, { how: "recall", correct: true, now: i * 60e3 });
  const s0 = strength(L, 4 * 60e3), s1 = strength(L, 4 * 60e3 + 48 * H);
  assert.ok(s1 < s0 * 0.7, `${s0} -> ${s1}`);
  const h0 = L.h;
  record(L, { how: "recall", correct: true, now: 4 * 60e3 + 48 * H });
  const massed = newLetter();
  for (let i = 0; i < 4; i++) record(massed, { how: "recall", correct: true, now: i * 60e3 });
  record(massed, { how: "recall", correct: true, now: 5 * 60e3 });
  assert.ok(L.h - h0 > massed.h - h0, "the recall after a long gap grew the half-life more");
});

test("a miss shortens the half-life, and mix-ups are remembered", () => {
  const L = newLetter();
  record(L, { how: "recall", correct: true, now: 0 });
  const h = L.h;
  record(L, { how: "recall", correct: false, now: H, rival: "S" });
  record(L, { how: "recall", correct: false, now: 2 * H, rival: "S" });
  assert.ok(L.h < h);
  assert.equal(worstRival(L), "S");
});

test("an untouched letter has no strength", () => {
  assert.equal(strength(newLetter(), 0), 0);
  assert.equal(MASTERY, 0.95);
});

test("the streak counts days the goal was met and lapses after a missed day", () => {
  const s = newState();
  const day = 864e5, t0 = new Date(2026, 8, 20, 12).getTime();
  finishLesson(s, { xp: 10, now: t0 });
  finishLesson(s, { xp: 10, now: t0 + day });
  assert.equal(s.streak, 2);
  assert.equal(currentStreak(s, t0 + day), 2);
  assert.equal(currentStreak(s, t0 + 3 * day), 0);
  finishLesson(s, { xp: 10, now: t0 + 3 * day });
  assert.equal(s.streak, 1);
  assert.equal(s.days[dayKey(t0)].xp, 10);
});
