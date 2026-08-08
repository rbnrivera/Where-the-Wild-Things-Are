'use strict';
const { applyMove, FACES } = require('./engine');

const MOVES = [];
for (const face of FACES) {
  MOVES.push({ face, dir: 'CW', double: false });
  MOVES.push({ face, dir: 'CCW', double: false });
  MOVES.push({ face, dir: 'CW', double: true });
}
function mvStr(m) { return m.face + (m.double ? '2' : m.dir === 'CCW' ? "'" : ''); }
function key(state) { return FACES.map((f) => state[f].join('')).join('|'); }

// Note: `preserve` is only checked at the SUCCESS condition, not used to
// prune intermediate states — a valid short solution may legitimately
// pass through states that temporarily "disturb" already-placed pieces
// (classic commutator-style moves) before restoring them by the end.
function bfs(start, goal, preserve, maxDepth) {
  const success = (s) => goal(s) && (!preserve || preserve(s));
  if (success(start)) return { state: start, moves: [] };
  let frontier = [{ state: start, moves: [] }];
  const seen = new Set([key(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const m of MOVES) {
        const ns = applyMove(node.state, m.face, m.dir, m.double);
        const k = key(ns);
        if (seen.has(k)) continue;
        seen.add(k);
        const nmoves = node.moves.concat([m]);
        if (success(ns)) return { state: ns, moves: nmoves };
        next.push({ state: ns, moves: nmoves });
      }
    }
    frontier = next;
    if (frontier.length === 0) return null;
  }
  return null;
}

function centerColors(state) {
  return { U: state.U[4], D: state.D[4], F: state.F[4], B: state.B[4], L: state.L[4], R: state.R[4] };
}

// Checks reusable across phases: "is this specific edge/corner slot
// showing its solved colors right now?"
function edgeCheck(topFace, topIdx, sideFace, sideIdx, C) {
  return (s) => s[topFace][topIdx] === C[topFace] && s[sideFace][sideIdx] === C[sideFace];
}
function cornerCheck(f1, i1, f2, i2, f3, i3, C) {
  return (s) => s[f1][i1] === C[f1] && s[f2][i2] === C[f2] && s[f3][i3] === C[f3];
}

const CROSS_EDGES = [
  { side: 'F', uIdx: 7, sIdx: 1 }, { side: 'R', uIdx: 5, sIdx: 1 },
  { side: 'B', uIdx: 1, sIdx: 1 }, { side: 'L', uIdx: 3, sIdx: 1 },
];
const FIRST_LAYER_CORNERS = [
  { faces: ['F', 'R'], uIdx: 8, aIdx: 2, bIdx: 0 },
  { faces: ['R', 'B'], uIdx: 2, aIdx: 2, bIdx: 0 },
  { faces: ['B', 'L'], uIdx: 0, aIdx: 2, bIdx: 0 },
  { faces: ['L', 'F'], uIdx: 6, aIdx: 2, bIdx: 0 },
];
// Second layer edges, between F/R/B/L pairs (middle row of each side face).
const SECOND_LAYER_EDGES = [
  { faces: ['F', 'R'], aIdx: 5, bIdx: 3 },
  { faces: ['R', 'B'], aIdx: 5, bIdx: 3 },
  { faces: ['B', 'L'], aIdx: 5, bIdx: 3 },
  { faces: ['L', 'F'], aIdx: 5, bIdx: 3 },
];

function solve(initialState, log) {
  const C = centerColors(initialState);
  let cur = initialState;
  const allMoves = [];
  const record = (label, res) => {
    cur = res.state;
    allMoves.push(...res.moves.map((m) => ({ ...m, label })));
    log && log(`${label}: ${res.moves.map(mvStr).join(' ') || '(already there)'}`);
  };

  // Phase 1: cross
  const placedCrossChecks = [];
  for (const e of CROSS_EDGES) {
    const check = edgeCheck('U', e.uIdx, e.side, e.sIdx, C);
    const preserve = (s) => placedCrossChecks.every((c) => c(s));
    const res = bfs(cur, check, preserve, 8);
    if (!res) throw new Error('cross failed for ' + e.side);
    record(`cross-${e.side}`, res);
    placedCrossChecks.push(check);
  }

  // Phase 2: first layer corners
  const placedCornerChecks = [];
  for (const c of FIRST_LAYER_CORNERS) {
    const [fa, fb] = c.faces;
    const check = cornerCheck('U', c.uIdx, fa, c.aIdx, fb, c.bIdx, C);
    const preserve = (s) => placedCrossChecks.every((pc) => pc(s)) && placedCornerChecks.every((pc) => pc(s));
    const res = bfs(cur, check, preserve, 6);
    if (!res) throw new Error('corner failed for ' + c.faces.join(''));
    record(`corner-${c.faces.join('')}`, res);
    placedCornerChecks.push(check);
  }

  // Phase 3: second layer edges
  const placedSLEChecks = [];
  for (const e of SECOND_LAYER_EDGES) {
    const [fa, fb] = e.faces;
    const check = edgeCheck(fa, e.aIdx, fb, e.bIdx, C);
    const preserve = (s) => placedCrossChecks.every((pc) => pc(s)) && placedCornerChecks.every((pc) => pc(s)) && placedSLEChecks.every((pc) => pc(s));
    const res = bfs(cur, check, preserve, 8);
    if (!res) throw new Error('2nd layer edge failed for ' + e.faces.join(''));
    record(`edge2-${e.faces.join('')}`, res);
    placedSLEChecks.push(check);
  }

  // Phase 4: last layer — full search to fully solved (no preserve needed,
  // since the goal itself requires F2L to remain/return to solved).
  const solved = (s) => FACES.every((f) => s[f].every((v) => v === C[f]));
  const res = bfs(cur, solved, null, 7);
  if (!res) throw new Error('last layer search exceeded depth cap');
  record('last-layer', res);

  return { state: cur, moves: allMoves };
}

module.exports = { solve, bfs, centerColors, mvStr, key, MOVES };
