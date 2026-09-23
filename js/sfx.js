/* sfx.js: small sounds, made in the browser. Soft on purpose. */

let ac = null;
let enabled = true;
export const setSound = (on) => { enabled = on; };

function ctx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === "suspended") ac.resume();
  return ac;
}

function tone(freq, start, dur, { type = "sine", gain = 0.18, bend = 0 } = {}) {
  const a = ctx();
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + start);
  if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, a.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export const sfx = {
  right() { if (!enabled) return; tone(784, 0, 0.16, { type: "triangle", gain: 0.16 }); tone(1175, 0.09, 0.28, { type: "triangle", gain: 0.14 }); },
  wrong() { if (!enabled) return; tone(220, 0, 0.22, { type: "triangle", gain: 0.13, bend: 0.8 }); },
  tap() { if (!enabled) return; tone(660, 0, 0.05, { type: "sine", gain: 0.06 }); },
  hold() { if (!enabled) return; tone(988, 0, 0.08, { type: "sine", gain: 0.05 }); },
  done() {
    if (!enabled) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.32, { type: "triangle", gain: 0.13 }));
    tone(1319, 0.4, 0.5, { type: "sine", gain: 0.08 });
  },
};
