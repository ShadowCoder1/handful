import test from "node:test";
import assert from "node:assert/strict";
import { PATH, ALL_NODES, buildLesson, nodeStatus, distractors, requeue, reviewPool, noRepeats } from "../js/planner.js";
import { newState, letterOf, record } from "../js/learner.js";
import { ALL_LETTERS, CONFUSABLE, WORDS } from "../js/course.js";

const rng = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const H = 3600e3;

test("every letter is on the path once, in a learn node of at most two", () => {
  const learnt = ALL_NODES.filter((n) => n.kind === "learn").flatMap((n) => n.letters);
  assert.deepEqual(learnt.slice().sort(), ALL_LETTERS.slice().sort());
  assert.ok(ALL_NODES.filter((n) => n.kind === "learn").every((n) => n.letters.length <= 2));
  assert.equal(new Set(ALL_NODES.map((n) => n.id)).size, ALL_NODES.length);
});

test("a learn lesson shows each new sign, lets you copy it, then asks for it from memory later, never straight after", () => {
  const s = newState();
  const node = PATH[0].nodes[0];
  const { items } = buildLesson(node, s, 0, rng());
  for (const l of node.letters) {
    const learn = items.findIndex((it) => it.type === "learn" && it.letter === l);
    const copy = items.findIndex((it) => it.type === "copy" && it.letter === l);
    const recall = items.findIndex((it) => it.type === "sign" && it.letter === l);
    assert.ok(learn >= 0 && copy === learn + 1, `${l}: learn then copy`);
    assert.ok(recall > copy + 1, `${l}: recall comes later`);
  }
  for (let i = 1; i < items.length; i++) {
    if (items[i].type === "copy") continue;
    assert.ok(items[i].letter !== items[i - 1].letter, `no letter twice in a row at ${i}`);
  }
});

test("letters you clearly know are left out of practice", () => {
  const s = newState();
  for (const l of ["B", "L", "Y"]) for (let i = 0; i < 5; i++) record(letterOf(s, l), { how: "recall", correct: true, now: 0 });
  record(letterOf(s, "I"), { how: "copy", correct: true, now: 0 });
  const pool = reviewPool(s, 60e3);
  assert.deepEqual(pool, ["I"]);
  // ...until time has passed and they have faded
  assert.ok(reviewPool(s, 400 * H).includes("B"));
});

test("distractors are the letters this one is confused with, the learner's own mix-up first", () => {
  const s = newState();
  record(letterOf(s, "A"), { how: "recall", correct: false, now: 0, rival: "T" });
  record(letterOf(s, "A"), { how: "recall", correct: false, now: 1, rival: "T" });
  const d = distractors(s, "A", 3, rng());
  assert.equal(d[0], "T");
  assert.ok(d.slice(1).every((x) => CONFUSABLE.A.includes(x)));
});

test("practice puts a pair you keep mixing up side by side", () => {
  const s = newState();
  for (const l of ["A", "S", "E"]) record(letterOf(s, l), { how: "copy", correct: true, now: 0 });
  record(letterOf(s, "S"), { how: "recall", correct: false, now: 1, rival: "A" });
  record(letterOf(s, "S"), { how: "recall", correct: false, now: 2, rival: "A" });
  const node = PATH[1].nodes.find((n) => n.kind === "practice");
  const { items } = buildLesson(node, s, 10, rng());
  assert.ok(items.some((it) => it.type === "pickSign" && it.letter === "S" && it.contrast === "A"));
});

test("a check asks for every letter in the unit once, from memory", () => {
  const node = PATH[0].nodes.find((n) => n.kind === "check");
  const { items } = buildLesson(node, newState(), 0, rng());
  assert.deepEqual(items.map((i) => i.letter).sort(), node.letters.slice().sort());
  assert.ok(items.every((i) => i.type === "sign" && i.check));
});

test("without a camera, every exercise is one you can do by tapping", () => {
  const { items } = buildLesson(PATH[0].nodes[0], newState(), 0, rng(), { camera: false });
  assert.ok(items.every((i) => ["learn", "pickSign", "nameIt"].includes(i.type)));
});

test("the path unlocks in order, and passing a unit's check completes it", () => {
  const s = newState();
  assert.equal(nodeStatus(s).current, PATH[0].nodes[0].id);
  s.done["u1-check"] = 1;
  assert.equal(nodeStatus(s).current, PATH[1].nodes[0].id);
});

test("a missed letter comes back a few items later, at most twice", () => {
  let items = Array.from({ length: 6 }, (_, i) => ({ type: "sign", letter: "XYZABC"[i] }));
  items = requeue(items, 0, "X");
  assert.equal(items[4].letter, "X");
  items = requeue(items, 0, "X");
  items = requeue(items, 0, "X");
  assert.equal(items.filter((i) => i.letter === "X" && i.requeued).length, 2);
});

test("spelling words never double a letter (the camera needs the hand to change)", () => {
  assert.ok(WORDS.every((w) => !/(.)\1/.test(w)));
  assert.ok(WORDS.length > 150);
});

test("noRepeats separates back-to-back letters", () => {
  const out = noRepeats([{ letter: "A" }, { letter: "A" }, { letter: "B" }]);
  assert.notEqual(out[0].letter, out[1].letter);
});
