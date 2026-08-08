# Rubik's Cube Tutor — for six-year-olds

## Status (read this first)

**Works today, fully verified against a real physical cube:**
- `cube-step-template.html` — the one-step instruction card (net diagram
  + arrow-free overview, plus a big arrow'd close-up of the face to
  turn, plus a hidden "why" toggle). This is what actually ran the live
  trial below.
- `solver/engine.js` — a cube-physics engine (given a state + one move,
  returns the new state). Cross-checked against **four real moves**
  performed on an actual physical cube during the trial (see "Trial
  data" below) — every prediction matched exactly.
- `solver/solve.js` — automated solving via search (IDA*). The **cross
  and first-layer corners solve reliably in under a second.** Second-
  layer edges usually do too, but **one case in the trial run
  repeatedly failed to finish even after several minutes of tuning**
  (see "Known issue" below) — that's where work stopped.

**Not working yet / in progress:**
- Second-layer edges: fast most of the time, but not reliably fast for
  every configuration. Needs a fix before it can be trusted to run
  unattended.
- Last layer (orient edges → orient corners → permute corners → permute
  edges): two approaches were started and neither is finished —
  `idaSearch` (in `solve.js`, times out / needs too much depth for this
  subproblem as currently written) and a known-algorithm approach (in
  `solver/lastlayer.js`, scaffolded but not yet verified against a real
  state).
- `solver/generate-viewer.js` + `solver/viewer-template.html` — a
  multi-step, click-through viewer (Next/Back buttons, one page for the
  *whole* solve instead of republishing a card every turn) built to fix
  the "3+ minutes per turn" problem from doing this conversationally.
  The rendering side is done; it's wired up to read a solver-generated
  move list but hasn't run end-to-end since the solver isn't finished.

## Known issue: last-layer / hard-piece search performance

`solve.js`'s `idaSearch` uses a heuristic based only on the *current*
subgoal (e.g. "these 2 facelets need to match"), deliberately decoupled
from the "don't disturb what's already solved" constraint — because real
disturb-then-restore algorithms are how cube solving actually works, and
penalizing every intermediate disturbance in the heuristic makes IDA*
pathologically slow to find them. That fixed *some* slow cases but not
all: at least one second-layer-edge placement in the trial's actual
scramble still didn't finish in under 150 seconds even with a
transposition table and move-order pruning added. Budgets in `solve.js`
are currently capped at 20s per phase so a re-run fails fast instead of
hanging — expect it to throw on hard configurations right now.

**Most promising next step:** finish the `solver/lastlayer.js` approach
(well-known, standard last-layer algorithms, translated from the usual
"last layer on U" convention to this project's "last layer on D" setup,
and *verified* against real engine output rather than trusted from
memory) — this sidesteps search entirely and should be both fast and
reliable. It was scaffolded but not yet tested against a live state
when work paused. The same technique (a small library of known
algorithms + verification, instead of open-ended search) would likely
also fix the flaky second-layer-edge case.

## Trial data (ground truth — reuse this, don't re-derive it)

This exact state and move sequence were **physically performed and
independently confirmed** against a real cube during the live trial.
Treat it as ground truth for testing the solver — no need to re-verify
the engine against a physical cube again.

Colors on this particular cube: orange, green, red, blue, yellow, black
(no white; opposite pairs are Yellow↔Black, Green↔Blue, Red↔Orange).

Initial scrambled state:
```js
{
  U: ["G","B","O", "Y","Y","K", "K","R","B"],
  F: ["B","G","O", "B","G","B", "G","R","Y"],
  L: ["K","O","R", "O","R","O", "Y","K","K"],
  R: ["K","O","Y", "Y","O","R", "B","G","R"],
  B: ["G","K","R", "Y","B","G", "Y","Y","B"],
  D: ["O","B","O", "R","K","K", "R","G","G"],
}
```

Four moves physically performed and confirmed (in this order): `F`
(clockwise), `D2`, `B2`, `L` (clockwise, in this engine's convention —
see `solver/test-engine.js` for how that was pinned down against a
transcription that initially looked rotated/ambiguous). Run
`node solver/test-engine.js` to see all of this re-verified from
scratch.

## Why a template instead of a live API-calling app

There is still no backend and no runtime API calls — the solver is a
**batch computation that runs once, offline**, producing a fixed list of
steps that get baked into a static page (or a set of cards). The
original plan was to have the tutor (Claude) work out each move live in
conversation, one turn at a time — that turned out to be far too slow in
practice (multiple minutes per turn, with real mistakes from doing the
cube math by hand). Precomputing the whole solve keeps the "no live
API" constraint while fixing the speed problem.

## How a tutoring session works (once the solver is finished)

1. **Capture the cube.** Read off all 6 faces (see the face-by-face
   protocol that was used in the trial — center color, the color on top
   of that face as held, then the 9 stickers). Cross-validate: every
   color must appear exactly 9 times, and no corner may show two colors
   from the same opposite pair.
2. **Run the solver once** to get the full move list up front.
3. **Generate the viewer** (`generate-viewer.js`) — one page, Next/Back
   through every step, no more waiting on a live turn.
4. **Two passes, one toggle.** Every step ships with the reasoning
   hidden behind a "Why this move?" button, off by default — first pass
   is just following arrows, second pass (or anytime) reveals why.

## `CUBE_STATE` / `MOVE` schema

Six faces, each a 3×3 grid, row-major, top-left to bottom-right, as seen
looking directly at that face from outside the cube. Colors are single
letters (swap the set to match whatever cube you're rendering).

```js
const MOVE = { face: "R", direction: "CW", double: false }; // direction: "CW"|"CCW"
```

`direction` is "viewed from outside the cube, looking straight at that
face" — exactly how the close-up diagram draws it. `double: true` means
a 180° turn (direction is then irrelevant).

## Why the diagram is split into two SVGs

An early version drew the rotation arrow directly on the full unfolded
net, centered on the face being turned — until the arrow's stroke width
overlapped a sticker letter (`R` became misreadable as `P`), which is
exactly the kind of ambiguity this project exists to avoid. Now the full
net shows all six faces with the target face only outlined — no arrow —
and a separate, larger close-up shows just that face with the arrow
orbiting entirely outside the stickers.
