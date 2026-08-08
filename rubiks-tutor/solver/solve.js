'use strict';
const { applyMoveFlat, toFlat, fromFlat, FACES } = require('./engine');

const MOVES = [];
for (const face of FACES) {
  MOVES.push({ face, dir: 'CW', double: false });
  MOVES.push({ face, dir: 'CCW', double: false });
  MOVES.push({ face, dir: 'CW', double: true });
}
function mvStr(m) { return m.face + (m.double ? '2' : m.dir === 'CCW' ? "'" : ''); }
function flatIdx(face, idx) { return FACES.indexOf(face) * 9 + idx; }

// Unified IDA* search over flat 54-arrays. `goalConstraints` drives the
// heuristic (kept small/tight on purpose — e.g. just the 4 facelets for
// "last-layer edges oriented" — so it prunes hard toward that subgoal);
// `mustAlsoHold` (typically the much larger "don't disturb what's
// already solved" set) gates final acceptance but is NOT part of the
// heuristic, since "disturb temporarily, restore by the end" is exactly
// how real cube algorithms work and a heuristic that penalizes every
// intermediate disturbance makes IDA* pathologically slow to find them.
function idaSearch(startFlat, goalConstraints, mustAlsoHold, maxBound) {
  const wrongCount = (flat, cons) => {
    let n = 0;
    for (const [i, c] of cons) if (flat[i] !== c) n++;
    return n;
  };
  const goalMet = (flat) => wrongCount(flat, goalConstraints) === 0;
  const fullyDone = (flat) => goalMet(flat) && (!mustAlsoHold || wrongCount(flat, mustAlsoHold) === 0);
  const h = (flat) => Math.ceil(wrongCount(flat, goalConstraints) / 2);
  if (fullyDone(startFlat)) return [];

  for (let bound = Math.max(1, h(startFlat)); bound <= maxBound; bound++) {
    function dfs(flat, g, lastFace, path) {
      const f = g + h(flat);
      if (f > bound) return null;
      if (g === bound) return fullyDone(flat) ? path : null;
      for (const m of MOVES) {
        if (m.face === lastFace) continue;
        const nf = applyMoveFlat(flat, m.face, m.dir, m.double);
        if (fullyDone(nf)) return path.concat([m]);
        const r = dfs(nf, g + 1, m.face, path.concat([m]));
        if (r) return r;
      }
      return null;
    }
    const res = dfs(startFlat, 0, null, []);
    if (res) return res;
  }
  return null;
}

function centerColors(state) {
  return { U: state.U[4], D: state.D[4], F: state.F[4], B: state.B[4], L: state.L[4], R: state.R[4] };
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
const SECOND_LAYER_EDGES = [
  { faces: ['F', 'R'], aIdx: 5, bIdx: 3 },
  { faces: ['R', 'B'], aIdx: 5, bIdx: 3 },
  { faces: ['B', 'L'], aIdx: 5, bIdx: 3 },
  { faces: ['L', 'F'], aIdx: 5, bIdx: 3 },
];

function solve(initialState, log) {
  const C = centerColors(initialState);
  let flat = toFlat(initialState);
  const allMoves = [];
  const lockedConstraints = []; // grows as pieces get placed; always preserved

  function run(label, newConstraints, maxBound) {
    const t0 = Date.now();
    const moves = idaSearch(flat, newConstraints, lockedConstraints, maxBound);
    if (!moves) throw new Error(`${label}: no solution within bound ${maxBound}`);
    for (const m of moves) flat = applyMoveFlat(flat, m.face, m.dir, m.double);
    allMoves.push(...moves.map((m) => ({ ...m, label })));
    log && log(`${label}: ${moves.map(mvStr).join(' ') || '(already there)'}  [${Date.now() - t0}ms]`);
    lockedConstraints.push(...newConstraints);
  }

  for (const e of CROSS_EDGES) {
    run(`cross-${e.side}`, [
      [flatIdx('U', e.uIdx), C.U], [flatIdx(e.side, e.sIdx), C[e.side]],
    ], 10);
  }
  for (const c of FIRST_LAYER_CORNERS) {
    const [fa, fb] = c.faces;
    run(`corner-${c.faces.join('')}`, [
      [flatIdx('U', c.uIdx), C.U], [flatIdx(fa, c.aIdx), C[fa]], [flatIdx(fb, c.bIdx), C[fb]],
    ], 10);
  }
  for (const e of SECOND_LAYER_EDGES) {
    const [fa, fb] = e.faces;
    run(`edge2-${e.faces.join('')}`, [
      [flatIdx(fa, e.aIdx), C[fa]], [flatIdx(fb, e.bIdx), C[fb]],
    ], 10);
  }

  // Last layer, staged (classic orient-edges / orient-corners /
  // permute-corners / permute-edges breakdown) — each stage's goal is
  // small, which keeps the search fast; a single flat "solve everything"
  // search is combinatorially much harder.
  const DL_EDGES = [['D', 1, 'F', 7], ['D', 3, 'L', 7], ['D', 5, 'R', 7], ['D', 7, 'B', 7]];
  const DL_CORNERS = [
    ['D', 0, 'F', 6, 'L', 8], ['D', 2, 'F', 8, 'R', 6],
    ['D', 6, 'B', 8, 'L', 6], ['D', 8, 'B', 6, 'R', 8],
  ];
  run('LL-orient-edges', DL_EDGES.map(([f, i]) => [flatIdx(f, i), C[f]]), 12);
  run('LL-orient-corners', DL_CORNERS.map(([f, i]) => [flatIdx(f, i), C[f]]), 12);
  run('LL-permute-corners', DL_CORNERS.flatMap(([f1, i1, f2, i2, f3, i3]) => [
    [flatIdx(f1, i1), C[f1]], [flatIdx(f2, i2), C[f2]], [flatIdx(f3, i3), C[f3]],
  ]), 14);
  const lastLayerConstraints = [];
  for (const f of FACES) for (let i = 0; i < 9; i++) lastLayerConstraints.push([flatIdx(f, i), C[f]]);
  run('LL-permute-edges', lastLayerConstraints, 14);

  return { state: fromFlat(flat), moves: allMoves };
}

module.exports = { solve, idaSearch, centerColors, mvStr };
