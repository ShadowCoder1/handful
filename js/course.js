/* course.js: what there is to learn, and the words the app says about it.
 *
 * UNITS. Letters are grouped by how the hand is built, not by the alphabet,
 * and ordered so the first ones are both easy to tell apart and the ones the
 * grader is surest of (tutor/model.json, held-out accept rates 0.93-0.99).
 * Letters that are easy to confuse (A, S, E; M, N, T) arrive in the same unit
 * so they can be practised side by side once each has been seen alone.
 *
 * COPY. Written for a person, in plain words. No dashes used as commas, no
 * shouting in capitals. The hint for each part of the hand comes in two
 * strengths: a nudge that only says where to look, and the fix itself
 * (js/signer.js decides which one a learner needs). */

export const UNITS = [
  { id: "u1", title: "First signs", blurb: "Five shapes that look nothing alike.", color: "tangerine", letters: ["B", "L", "Y", "I", "V"] },
  { id: "u2", title: "Round and closed", blurb: "Fists and curves. A, S and E are close cousins.", color: "fern", letters: ["A", "S", "E", "O", "C"] },
  { id: "u3", title: "Pointing", blurb: "One or more fingers up, the rest tucked.", color: "sky", letters: ["D", "F", "W", "K", "X"] },
  { id: "u4", title: "Tucked thumbs", blurb: "Where the thumb hides is the whole difference.", color: "berry", letters: ["M", "N", "T", "U", "R"] },
  { id: "u5", title: "Sideways and down", blurb: "Same shapes, new directions.", color: "gold", letters: ["G", "H", "P", "Q"] },
  { id: "u6", title: "Letters that move", blurb: "Draw them in the air.", color: "lagoon", letters: ["J", "Z"] },
];

export const ALL_LETTERS = UNITS.flatMap((u) => u.letters);
export const unitOf = (letter) => UNITS.find((u) => u.letters.includes(letter));

/* Letters people mix up, both ways round. From the grader's own confusion
 * sets (tutor/letters.js CONFUSIONS), trimmed to the pairs that matter. */
export const CONFUSABLE = {
  A: ["S", "E"], S: ["A", "E", "T"], E: ["A", "S"], O: ["C"], C: ["O"],
  D: ["F"], F: ["D"], K: ["V", "P"], V: ["K", "U"], U: ["V", "R"], R: ["U"],
  M: ["N"], N: ["M", "T"], T: ["N", "S"], G: ["H", "Q"], H: ["G", "U"],
  P: ["K", "Q"], Q: ["G", "P"], I: ["Y", "J"], Y: ["I"], J: ["I"], Z: ["X", "D"], X: ["Z"],
};

/* One line to remember each sign by, and the parts to check. */
export const TIPS = {
  A: { gist: "A fist, with the thumb resting on the side.", look: "It's a fist, but the thumb stays on the outside, pointing up." },
  B: { gist: "Flat hand, fingers up, thumb folded in.", look: "Like a flat wall. The thumb tucks across your palm." },
  C: { gist: "Curve your hand into a C.", look: "It looks just like a C from the side." },
  D: { gist: "Index finger up, the others make a circle with your thumb.", look: "A little d: one straight line and a round belly." },
  E: { gist: "Fingertips bend down onto your thumb.", look: "Like a claw resting on your thumb. Not a fist." },
  F: { gist: "Thumb and index make a circle, three fingers up.", look: "Like the OK sign." },
  G: { gist: "Index and thumb point sideways, parallel.", look: "Like showing how small something is." },
  H: { gist: "Two fingers together, pointing sideways.", look: "A U lying on its side." },
  I: { gist: "A fist with just the pinky up.", look: "The pinky is the letter I." },
  J: { gist: "Make an I, then draw a J with your pinky.", look: "Start at the top and hook down and round." },
  K: { gist: "Index up, middle angled out, thumb between them.", look: "Like a V with the thumb resting in the middle." },
  L: { gist: "Thumb out, index up. An L.", look: "It looks just like an L." },
  M: { gist: "Thumb tucked under three fingers.", look: "Three fingers over the thumb, like the three legs of an m." },
  N: { gist: "Thumb tucked under two fingers.", look: "Two fingers over the thumb, like the two legs of an n." },
  O: { gist: "All fingertips meet the thumb in a circle.", look: "It looks just like an O." },
  P: { gist: "A K, pointed down.", look: "Make a K, then tip your hand forward." },
  Q: { gist: "A G, pointed down.", look: "Make a G, then point it at the floor." },
  R: { gist: "Cross your index and middle fingers.", look: "Like crossing your fingers for luck." },
  S: { gist: "A fist with the thumb across the front.", look: "Like holding something tight. Thumb over the fingers." },
  T: { gist: "Thumb tucked between index and middle.", look: "The thumb peeks out between the first two fingers." },
  U: { gist: "Two fingers up, pressed together.", look: "No gap between the two fingers." },
  V: { gist: "Two fingers up and apart.", look: "It looks just like a V." },
  W: { gist: "Three fingers up and apart.", look: "It looks just like a W." },
  X: { gist: "Index finger up and bent into a hook.", look: "Like a finger beckoning, frozen." },
  Y: { gist: "Thumb and pinky out, the rest curled.", look: "Like the 'hang loose' wave." },
  Z: { gist: "Point your index and draw a Z.", look: "Across, back down, across again." },
};

/* What to fix, by the part of the hand the grader blames (tutor/blame.js
 * blocks). `nudge` only says where to look; `fix` says what to do. A letter
 * with its own line for a part uses it; otherwise the generic one. */
const NUDGE = {
  thumb: "Check your thumb.",
  index: "Check your index finger.",
  middle: "Check your middle finger.",
  ring: "Check your ring finger.",
  pinky: "Check your pinky.",
  spread: "Check the gaps between your fingers.",
  orientation: "Check which way your palm faces.",
};
const FIX = {
  A: { thumb: "Rest your thumb on the side of your index finger, not across the front.", fingers: "Curl all four fingers into a fist.", orientation: "Face your palm forward." },
  B: { thumb: "Fold your thumb across your palm.", fingers: "Keep all four fingers straight and together.", orientation: "Palm forward, fingers pointing up." },
  C: { thumb: "Curve your thumb to match your fingers.", fingers: "Curve your fingers. Not flat, not a fist.", orientation: "Turn your hand so the C opens to the side." },
  D: { thumb: "Touch your thumb to your middle fingertip.", fingers: "Only the index stays straight. Curl the others to your thumb.", orientation: "Face your palm forward." },
  E: { thumb: "Tuck your thumb under your fingertips.", fingers: "Bend your fingers down to the thumb. Don't make a fist.", orientation: "Face your palm forward." },
  F: { thumb: "Touch your thumb tip to your index tip.", fingers: "Keep the other three fingers straight and apart.", orientation: "Face your palm forward." },
  G: { thumb: "Hold your thumb parallel to your index finger.", fingers: "Only the index is straight. Curl the rest.", orientation: "Point your index finger sideways." },
  H: { thumb: "Tuck your thumb against your curled fingers.", fingers: "Index and middle straight and together. Curl the others.", orientation: "Point the two fingers sideways." },
  I: { thumb: "Fold your thumb over your curled fingers.", fingers: "Only your pinky is straight.", orientation: "Face your palm forward." },
  J: { thumb: "Fold your thumb over your curled fingers.", fingers: "Only your pinky is straight.", orientation: "Draw the hook of a J with your pinky." },
  K: { thumb: "Put your thumb tip on your middle finger.", fingers: "Index up, middle angled forward. Curl the others.", orientation: "Palm forward, fingers up." },
  L: { thumb: "Stick your thumb straight out to the side.", fingers: "Only your index finger is straight.", orientation: "Face your palm forward." },
  M: { thumb: "Tuck your thumb under three fingers.", fingers: "Fold three fingers down over your thumb.", orientation: "Face your palm forward." },
  N: { thumb: "Tuck your thumb under two fingers.", fingers: "Fold two fingers down over your thumb.", orientation: "Face your palm forward." },
  O: { thumb: "Bring your thumb tip up to your fingertips.", fingers: "Curve your fingers so all the tips meet the thumb.", orientation: "Turn so the O opens to the side." },
  P: { thumb: "Put your thumb tip on your middle finger.", fingers: "Index straight, middle angled. Curl the others.", orientation: "Tip your hand so your fingers point down." },
  Q: { thumb: "Hold your thumb parallel to your index.", fingers: "Only your index finger is straight.", orientation: "Point your index and thumb at the floor." },
  R: { thumb: "Fold your thumb over your curled fingers.", fingers: "Cross your index over your middle finger.", orientation: "Palm forward, fingers up." },
  S: { thumb: "Wrap your thumb across the front of your fingers.", fingers: "Curl all four fingers into a fist.", orientation: "Face your palm forward." },
  T: { thumb: "Tuck your thumb between your index and middle fingers.", fingers: "Curl your fingers. The index folds over the thumb.", orientation: "Face your palm forward." },
  U: { thumb: "Fold your thumb over your curled fingers.", fingers: "Index and middle straight, with no gap between them.", orientation: "Palm forward, fingers up." },
  V: { thumb: "Fold your thumb over your curled fingers.", fingers: "Spread your index and middle fingers apart.", orientation: "Palm forward, fingers up." },
  W: { thumb: "Hold your pinky down with your thumb.", fingers: "Three fingers straight and apart.", orientation: "Palm forward, fingers up." },
  X: { thumb: "Fold your thumb over your curled fingers.", fingers: "Raise your index and bend it into a hook.", orientation: "Turn your palm to the side." },
  Y: { thumb: "Stick your thumb straight out.", fingers: "Pinky out. Curl the three middle fingers.", orientation: "Face your palm forward." },
  Z: { thumb: "Fold your thumb over your curled fingers.", fingers: "Only your index finger is straight.", orientation: "Draw a Z with your fingertip." },
};
const FINGER_PARTS = ["index", "middle", "ring", "pinky", "spread"];

export function hint(letter, part, level) {
  if (level <= 1) return NUDGE[part] ?? "Look at the picture again.";
  const row = FIX[letter] ?? {};
  const key = FINGER_PARTS.includes(part) ? "fingers" : part;
  return row[key] ?? TIPS[letter].gist;
}

/* When the grader says the hand is a different letter we know. */
export const madeInstead = (letter, rival) => `That looks like ${rival}. For ${letter}, ${lowerFirst(TIPS[letter].gist)}`;
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/* Praise, varied so it doesn't read like a machine. */
export const PRAISE = ["Nice!", "Yes!", "Great job!", "That's it!", "Spot on!", "Nailed it!", "Lovely!"];
export const PRAISE_AFTER_HELP = ["Got it!", "There you go.", "That's the one.", "Much better."];
export const ENCOURAGE = ["Almost.", "Close.", "Not quite.", "So close."];

/* Short, common words for spelling. No letter twice in a row: the camera
 * needs the hand to change between letters, and a doubled letter doesn't. */
export const WORDS = `
bay bye lay lily ivy lab bib ail
able also base bail bale basil boil bold cab call calve case cave
clay coal coil cola cold cool cove
loaf lobe love oval salve save sale sole silo slab sly soil solve vase veil vibe vole yes
bad bed bid bod cod dab deal dial dice dive dove due fad fed fib fig fix fly fold fox kid kind kiwi
lake leak like lick disk desk dock deck duck wax web wed wide wife wise wolf work wove wax
aim ant arm art bat bet bit bone born burn camp cart coat cut dart dent dirt dust east fact farm fast
fist fort from game gate girl goat gold good grid gum ham hand hat have heat help herb hint home hope
hug hum hunt jam jar jet job jog joke jump just kept king lamp land last lemon line lion list lock
many map mask melt milk mind mint moth mud nest net news note nut open pad pan park path peak pen pet
pie pig pin pink plan plum poem pond pot quiz quit rain ramp rat red rent rice ride ring road rock
room rope rose run rust sand seat send sent ship shop sign silk sink skin soap sock song soup spin
star step stir stop sun swim tag tan tax team tent tide time tin tip toad toe tone top toy tree tub
tune van vent verb vote warm wax went west wet whip wig win wind wink wish yam yard yarn yawn yet
zap zero zinc zip zone
`.trim().split(/\s+/).filter((w, i, a) => a.indexOf(w) === i && !/(.)\1/.test(w));

export function spellable(word, known) {
  const set = new Set(known);
  return [...word.toUpperCase()].every((c) => set.has(c));
}
