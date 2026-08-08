# Rubik's Cube Tutor — for six-year-olds

This is **not an app**. There is no solver, no backend, no API calls, and
nothing here runs unattended. It is one self-contained HTML template
(`cube-step-template.html`) that draws a single, unambiguous instruction
card: the cube's current state, the one face to turn, and which way.

The actual tutoring — reading the child's cube, working out the beginner
method solve, deciding what the next move should be, writing the "why" —
is done by an AI (Claude) live in conversation with the child (or their
adult). The template's only job is to guarantee that picture is drawn
**exactly the same way every time**, so the person on the other end of
the conversation is always looking at the same thing the AI is describing.

## Why a template instead of an app

The alternative — a real web app with a built-in solving engine — would
mean either shipping a cube-solving algorithm (a fixed, un-adaptive
"expert system") or wiring the page up to call an LLM API on every move,
which costs tokens and adds infrastructure for no real benefit. Since the
tutoring already happens inside a conversation with an AI, the AI can
just *be* the solver each turn. The template exists only to remove
drawing/labeling drift between turns — the one place a plain chat
response is genuinely worse than a picture.

## How a session works

1. **Capture the cube.** The child (or adult) describes the cube in
   plain language — colors and where they sit. The tutor translates this
   into the `CUBE_STATE` schema below.
2. **Pick an orientation and stick to it for the whole solve** — e.g.
   "white on top, green facing you." Every instruction is relative to
   this fixed orientation so "turn the right layer" always means the
   same physical thing.
3. **Solve using the beginner layer-by-layer method**, broken into
   single quarter-turns — never a multi-move algorithm bundled into one
   step. Phases, in order:
   1. White cross
   2. White corners (finishes the first layer)
   3. Second-layer edges
   4. Yellow cross
   5. Yellow edges (orient the last layer)
   6. Position yellow corners
   7. Orient yellow corners (solved!)
4. **One step, one card.** For each quarter-turn, fill in the `CONFIG`
   block in `cube-step-template.html` (current state, the move, the
   instruction, the why) and publish it as a one-off Artifact/picture.
5. **Confirm before advancing.** After the child turns the cube, the
   tutor asks what they see (or the child reports it) before generating
   the next card — this catches a wrong turn immediately instead of
   compounding it.
6. **Two passes, one toggle.** Every card ships with the reasoning
   hidden behind a "Why this move?" button, off by default. First time
   through a solve, the child just follows the arrows to get the feel of
   it. On a second pass (or anytime, if they're curious), they tap the
   button to see why that move was the right one. This is a single
   card design serving both of the user's stated goals — "solve first,
   explain second" — rather than generating two different artifacts.

## `CUBE_STATE` schema

Six faces, each a 3×3 grid, **row-major, top-left to bottom-right, as
seen looking straight at that face from outside the cube**:

```js
const CUBE_STATE = {
  U: [ /* 9 colors */ ],  // up
  D: [ /* 9 colors */ ],  // down
  F: [ /* 9 colors */ ],  // front
  B: [ /* 9 colors */ ],  // back
  L: [ /* 9 colors */ ],  // left
  R: [ /* 9 colors */ ],  // right
};
```

Colors are single letters: `W` `Y` `R` `O` `G` `B` (white, yellow, red,
orange, green, blue).

## `MOVE` schema

```js
const MOVE = { face: "R", direction: "CW" }; // or "CCW"
```

`direction` is always "viewed from outside the cube, looking straight at
that face" — exactly how the close-up diagram draws it, so there's no
mental mirroring required.

## Why the diagram is split into two SVGs

The first version of this drew the rotation arrow directly on the full
unfolded net, centered on the face being turned. It looked fine until
the arrow's own stroke width overlapped the sticker letters underneath
(an `R` sticker became misreadable as a `P` under the arrowhead) — the
exact kind of ambiguity this project exists to avoid, so it was reworked. Now the full net (top)
shows all six faces with the target face only outlined in pink — no
arrow, so nothing is ever covered. A second, larger close-up (below)
shows just that one face, big enough that the rotation arrow orbits
entirely outside the stickers. Verified in both light and dark themes,
and for both turn directions, by rendering with headless Chromium during
development.
