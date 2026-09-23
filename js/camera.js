/* camera.js: the webcam, the hand tracker, and the dots drawn on your hand.
 *
 * One camera for the whole app, started once and kept running between
 * exercises, so a lesson never waits on it twice. Frames go to whoever is
 * listening (js/signer.js) as the flattened landmarks the grader expects.
 *
 * Two hands can be in view; the one you sign with is kept (tutor/pick-hand.js)
 * and the other is ignored, not drawn and not graded. Nothing leaves the
 * browser: no video, no landmarks. */

import { flattenRounded, DECIMALS } from "../tutor/landmarks.js";
import { createHandPicker } from "../tutor/pick-hand.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

let state = null;   // { video, landmarker, listeners, picker, running, aspect }

export const cameraReady = () => !!state?.running;

export async function startCamera({ hand = "right" } = {}) {
  if (state?.running) { state.picker = createHandPicker(hand); return state; }
  const video = document.createElement("video");
  video.playsInline = true; video.muted = true; video.autoplay = true;
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
  video.srcObject = stream;
  await video.play();
  const vision = await import(`${MP}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
  let landmarker = null;
  for (const delegate of ["GPU", "CPU"]) {
    try {
      landmarker = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numHands: 2,
      });
      break;
    } catch { /* try the next */ }
  }
  if (!landmarker) throw new Error("The hand tracker could not start in this browser.");
  state = { video, stream, landmarker, listeners: new Set(), picker: createHandPicker(hand), running: true, aspect: video.videoWidth / video.videoHeight, height: video.videoHeight, lastT: -1 };
  loop();
  return state;
}

export function stopCamera() {
  if (!state) return;
  state.running = false;
  state.stream.getTracks().forEach((t) => t.stop());
  state = null;
}

/* Put the live picture in a container, mirrored like a mirror, with a canvas
 * on top for the dots. Returns a function that takes it out again. */
export function attachView(container) {
  if (!state) return () => {};
  const canvas = document.createElement("canvas");
  canvas.className = "cam-dots";
  container.append(state.video, canvas);
  state.video.className = "cam-video";
  // Moving the video to a new exercise takes it out of the page for a moment,
  // and a browser pauses any video removed from the page (the HTML spec says
  // it must). Paused, it shows black and gives the tracker no new frames, so
  // it is started again every time it is placed.
  resume(state.video);
  const view = { container, canvas, ctx: canvas.getContext("2d") };
  state.view = view;
  return () => { if (state?.view === view) state.view = null; canvas.remove(); };
}

function resume(video) {
  if (!video.paused) return;
  video.play().catch(() => {});
  // Safari can refuse the first call while the element is still settling in
  // its new place; try again on the next frames until it runs.
  let tries = 0;
  const again = () => { if (video.paused && tries++ < 30) { video.play().catch(() => {}); requestAnimationFrame(again); } };
  requestAnimationFrame(again);
}

export function onFrame(fn) {
  state?.listeners.add(fn);
  return () => state?.listeners.delete(fn);
}

function loop() {
  if (!state?.running) return;
  const s = state;
  const v = s.video;
  if (v.readyState >= 2 && v.currentTime !== s.lastT) {
    s.lastT = v.currentTime;
    const t = performance.now();
    let res = null;
    try { res = s.landmarker.detectForVideo(v, t); } catch { res = null; }
    const landmarks = res?.landmarks ?? [];
    const handedness = (res?.handedness ?? []).map((h) => h[0]?.categoryName ?? "?");
    const k = landmarks.length ? s.picker({ landmarks, handedness }, s.aspect) : -1;
    const lm = k >= 0 ? landmarks[k] : null;
    draw(s, lm);
    const frame = { t, flat: lm ? flattenRounded(lm, DECIMALS) : null, aspect: s.aspect, videoHeight: s.height, handedness: k >= 0 ? handedness[k] : null };
    for (const fn of s.listeners) fn(frame);
  }
  requestAnimationFrame(loop);
}

function draw(s, lm) {
  const view = s.view;
  if (!view) return;
  const { canvas, ctx, container } = view;
  const w = container.clientWidth, h = container.clientHeight, dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!lm) return;
  // the picture is cropped to fill the box (object-fit: cover) and mirrored
  const vw = s.video.videoWidth, vh = s.video.videoHeight;
  const scale = Math.max(w / vw, h / vh);
  const ox = (w - vw * scale) / 2, oy = (h - vh * scale) / 2;
  const P = (p) => [w - (ox + p.x * vw * scale), oy + p.y * vh * scale];
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2.5;
  for (const [a, b] of BONES) { const A = P(lm[a]), B = P(lm[b]); ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); }
  for (let i = 0; i < 21; i++) {
    const [x, y] = P(lm[i]);
    ctx.fillStyle = [4, 8, 12, 16, 20].includes(i) ? "#f5a04a" : "#ffffff";
    ctx.beginPath(); ctx.arc(x, y, [4, 8, 12, 16, 20].includes(i) ? 4.5 : 3.2, 0, Math.PI * 2); ctx.fill();
  }
}
