# Handful

Learn the American Sign Language fingerspelling alphabet with your camera.

**Live:** https://shadowcoder1.github.io/handful/

It runs entirely in the browser. The camera picture never leaves your device,
nothing is recorded, and your progress is saved in your browser only.

## How it teaches

The hard part of a tutor isn't recognising a hand. It's deciding what to say
and what to practise next. Handful borrows from the cognitive tutors
(Anderson, Boyle & Reiser 1985; Anderson, Corbett, Koedinger & Pelletier 1995)
and from motor learning.

- **Knowledge tracing.** Each letter is a skill with a probability that it's
  learned (Corbett & Anderson 1995), updated after every answer. Signing from
  memory is strong evidence. Copying a picture is weak evidence. A sign made
  only after being shown the answer counts as practice, not proof. Mastery is
  0.95, the cognitive tutors' criterion. (`js/learner.js`)
- **Forgetting.** Each letter also has a memory half-life (as in Duolingo's
  half-life regression, Settles & Meeder 2016). A correct recall after a long
  gap makes the memory last longer than one straight after. Practice goes to
  letters that are fading or shaky, and skips the ones you clearly still know.
- **Error diagnosis and hints.** When a sign is wrong, the grader works out
  which letter it looks like instead and which part of the hand is off. Help
  comes in steps: a nudge ("check your thumb"), then the exact fix, then the
  picture to copy. You get only as much help as you need, and how much you
  needed is recorded. (`js/signer.js`)
- **Your own mix-ups.** Letters you confuse (A for S, say) are remembered and
  come back side by side.
- **Motor learning.** Two new signs at a time. The picture is guidance, and it
  fades: first you copy it, later you sign from memory, and in a unit check
  there's no picture at all. Letters are mixed rather than drilled in blocks.
  (`js/planner.js`)

## The grader

The hand tracker is Google's MediaPipe. The grader is the one built for the
CMU fingerspelling study: a statistical model per letter fitted on public,
openly licensed hand datasets (attributions are inside `tutor/model.json`),
with a hold-still detector and a counterfactual "which part to fix" analysis
(`tutor/`, `engine/`). It can be wrong.

This teaches fingerspelling handshapes, not ASL. To learn ASL, learn from Deaf
teachers.

## Running it

    python3 tools/serve.py        # http://localhost:8020/
    npm test

The mascot, Pip, and the logo come from the Handful brand sheet (`assets/mascot/`,
`assets/logo.png`). Hand pictures: public domain (CC0). Nunito: SIL Open Font License.
