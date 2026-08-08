'use strict';
// Last-layer solving via known, verified algorithms instead of open-
// ended search — the last layer is on D for us (first two layers built
// on U+middle), so standard "last layer on U" algorithms are adapted by
// swapping U<->D, then EMPIRICALLY VERIFIED against the real cube state
// with the engine before being trusted (never assumed correct from
// memory alone).
const { applyMove, toFlat, fromFlat, FACES } = require('./engine');

function parseAlg(str) {
  return str.trim().split(/\s+/).map((tok) => {
    const face = tok[0];
    const double = tok.includes('2');
    const dir = tok.includes("'") ? 'CCW' : 'CW';
    return { face, dir, double };
  });
}
function applyAlg(state, alg) {
  let s = state;
  for (const m of alg) s = applyMove(s, m.face, m.dir, m.double);
  return s;
}
function mvStr(m) { return m.face + (m.double ? '2' : m.dir === 'CCW' ? "'" : ''); }

function centerColors(state) {
  return { U: state.U[4], D: state.D[4], F: state.F[4], B: state.B[4], L: state.L[4], R: state.R[4] };
}

const DL_EDGES = [['D', 1, 'F', 7], ['D', 3, 'L', 7], ['D', 5, 'R', 7], ['D', 7, 'B', 7]];
const DL_CORNERS = [
  ['D', 0, 'F', 6, 'L', 8], ['D', 2, 'F', 8, 'R', 6],
  ['D', 6, 'B', 8, 'L', 6], ['D', 8, 'B', 6, 'R', 8],
];

function edgesOriented(s, C) { return DL_EDGES.every(([f, i]) => s[f][i] === C[f]); }
function cornersOriented(s, C) { return DL_CORNERS.every(([f, i]) => s[f][i] === C[f]); }
function cornersPermuted(s, C) {
  return DL_CORNERS.every(([f1, i1, f2, i2, f3, i3]) => s[f1][i1] === C[f1] && s[f2][i2] === C[f2] && s[f3][i3] === C[f3]);
}
function fullySolved(s, C) {
  return FACES.every((f) => s[f].every((v) => v === C[f]));
}
function f2lIntact(s, before, C) {
  // everything except D and the D-touching rows of F/R/B/L must be unchanged from `before`
  for (let i = 0; i < 9; i++) if (s.U[i] !== before.U[i]) return false;
  for (const f of ['F', 'B', 'L', 'R']) for (let i = 0; i < 6; i++) if (s[f][i] !== before[f][i]) return false;
  return true;
}

// Try each algorithm variant preceded by 0..3 D-turns (AUF-equivalent,
// since our last layer is D) until `test` passes and F2L stays intact.
function tryVariants(state, before, C, algStrs, test) {
  for (const algStr of algStrs) {
    const alg = parseAlg(algStr);
    for (let pre = 0; pre < 4; pre++) {
      const preAlg = pre === 0 ? [] : [{ face: 'D', dir: 'CW', double: false }].map(() => ({ face: 'D', dir: 'CW', double: false }));
      let s = state;
      for (let k = 0; k < pre; k++) s = applyMove(s, 'D', 'CW', false);
      const after = applyAlg(s, alg);
      if (test(after, C) && f2lIntact(after, before, C)) {
        const full = [];
        for (let k = 0; k < pre; k++) full.push({ face: 'D', dir: 'CW', double: false });
        full.push(...alg);
        return { state: after, moves: full };
      }
    }
  }
  return null;
}

// Repeatedly apply an algorithm (with realignment) up to `maxTries` times
// until `test` passes — used for edge/corner orientation, which some
// single applications only partially solve.
function repeatUntil(state, before, C, algStrs, test, maxTries) {
  let s = state;
  const allMoves = [];
  for (let t = 0; t < maxTries; t++) {
    if (test(s, C)) return { state: s, moves: allMoves };
    const res = tryVariants(s, before, C, algStrs, () => true); // just apply, check progress
    // Instead of requiring immediate success, apply first variant that doesn't break F2L and re-test.
    let applied = false;
    for (const algStr of algStrs) {
      const alg = parseAlg(algStr);
      for (let pre = 0; pre < 4; pre++) {
        let s2 = s;
        for (let k = 0; k < pre; k++) s2 = applyMove(s2, 'D', 'CW', false);
        const after = applyAlg(s2, alg);
        if (f2lIntact(after, before, C)) {
          const full = [];
          for (let k = 0; k < pre; k++) full.push({ face: 'D', dir: 'CW', double: false });
          full.push(...alg);
          s = after;
          allMoves.push(...full);
          applied = true;
          break;
        }
      }
      if (applied) break;
    }
    if (!applied) return null;
  }
  return test(s, C) ? { state: s, moves: allMoves } : null;
}

module.exports = {
  parseAlg, applyAlg, mvStr, centerColors, DL_EDGES, DL_CORNERS,
  edgesOriented, cornersOriented, cornersPermuted, fullySolved, f2lIntact,
  tryVariants, repeatUntil,
};
