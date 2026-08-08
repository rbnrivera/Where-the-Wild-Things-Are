'use strict';
// Cube physics engine. Public state shape matches the tutor cards:
// { U:[9], D:[9], F:[9], B:[9], L:[9], R:[9] }, each row-major 3x3 as
// seen looking directly at that face from outside the cube.
//
// Internally, moves are precomputed as flat 54-element permutations
// (derived once from first-principles 3D coordinate geometry, the same
// approach used and validated during the live trial) so applying a move
// at solve-time is a single array remap instead of recomputing geometry
// — this is what makes searching thousands of positions per second
// practical.

const FACES = ['U', 'D', 'F', 'B', 'L', 'R'];
const NORMAL = {
  U: { x: 0, y: 1, z: 0 }, D: { x: 0, y: -1, z: 0 },
  F: { x: 0, y: 0, z: 1 }, B: { x: 0, y: 0, z: -1 },
  L: { x: -1, y: 0, z: 0 }, R: { x: 1, y: 0, z: 0 },
};
const FACE_AXIS = { U: 'y', D: 'y', F: 'z', B: 'z', L: 'x', R: 'x' };
const FACE_SIGN = { U: 1, D: -1, F: 1, B: -1, L: -1, R: 1 };

function facePos(face, row, col) {
  const a = col - 2, b = row - 2;
  switch (face) {
    case 'F': return { x: a, y: -b, z: 1 };
    case 'B': return { x: -a, y: -b, z: -1 };
    case 'U': return { x: a, y: 1, z: b };
    case 'D': return { x: a, y: -1, z: -b };
    case 'L': return { x: -1, y: -b, z: a };
    case 'R': return { x: 1, y: -b, z: -a };
  }
}
function faceRowCol(face, p) {
  let a, b;
  switch (face) {
    case 'F': a = p.x; b = -p.y; break;
    case 'B': a = -p.x; b = -p.y; break;
    case 'U': a = p.x; b = p.z; break;
    case 'D': a = p.x; b = -p.z; break;
    case 'L': a = p.z; b = -p.y; break;
    case 'R': a = -p.z; b = -p.y; break;
  }
  return { row: b + 2, col: a + 2 };
}

// Flat index (0..53): FACES order, row-major within each face.
const FACELETS = [];
for (const face of FACES) {
  for (let row = 1; row <= 3; row++) for (let col = 1; col <= 3; col++) {
    FACELETS.push({ face, row, col, pos: facePos(face, row, col) });
  }
}
function flatIndex(face, row, col) {
  return FACES.indexOf(face) * 9 + (row - 1) * 3 + (col - 1);
}

function rotate90(axis, quarterSign, p) {
  const s = quarterSign, { x, y, z } = p;
  if (axis === 'x') return { x, y: s * -z, z: s * y };
  if (axis === 'y') return { x: s * z, y, z: s * -x };
  if (axis === 'z') return { x: s * -y, y: s * x, z };
}
function findFaceByNormal(n) {
  for (const f of FACES) {
    const fn = NORMAL[f];
    if (fn.x === n.x && fn.y === n.y && fn.z === n.z) return f;
  }
  throw new Error('bad normal');
}

// Build a 54-length permutation `perm` such that applying the move sends
// old flat index perm[i] -> new flat index i (i.e. next[i] = cur[perm[i]]).
function buildPermutation(face, dir, double) {
  const axis = FACE_AXIS[face];
  const faceSign = FACE_SIGN[face];
  const quarterSign = -faceSign * (dir === 'CW' ? 1 : -1);
  const turns = double ? 2 : 1;

  // perm starts as identity; composing `turns` single-quarter permutations.
  let perm = FACELETS.map((_, i) => i);
  for (let t = 0; t < turns; t++) {
    const next = perm.slice();
    for (const fl of FACELETS) {
      const coord = axis === 'x' ? fl.pos.x : axis === 'y' ? fl.pos.y : fl.pos.z;
      if (coord !== faceSign) continue;
      const newPos = rotate90(axis, quarterSign, fl.pos);
      const newNormal = rotate90(axis, quarterSign, NORMAL[fl.face]);
      const newFace = findFaceByNormal(newNormal);
      const rc = faceRowCol(newFace, newPos);
      const from = flatIndex(fl.face, fl.row, fl.col);
      const to = flatIndex(newFace, rc.row, rc.col);
      next[to] = perm[from];
    }
    perm = next;
  }
  return perm;
}

const MOVE_DEFS = [];
for (const face of FACES) {
  MOVE_DEFS.push({ face, dir: 'CW', double: false });
  MOVE_DEFS.push({ face, dir: 'CCW', double: false });
  MOVE_DEFS.push({ face, dir: 'CW', double: true });
}
const MOVE_TABLE = new Map(); // key -> Int8Array-ish perm (array of 54 ints)
for (const m of MOVE_DEFS) {
  MOVE_TABLE.set(moveKey(m.face, m.dir, m.double), buildPermutation(m.face, m.dir, m.double));
}
function moveKey(face, dir, double) { return `${face}${dir}${double ? '2' : ''}`; }

function toFlat(state) {
  const out = new Array(54);
  for (const f of FACES) for (let i = 0; i < 9; i++) out[FACES.indexOf(f) * 9 + i] = state[f][i];
  return out;
}
function fromFlat(flat) {
  const out = {};
  for (const f of FACES) out[f] = flat.slice(FACES.indexOf(f) * 9, FACES.indexOf(f) * 9 + 9);
  return out;
}

function applyMove(state, face, dir, double) {
  const perm = MOVE_TABLE.get(moveKey(face, dir, double));
  const flat = toFlat(state);
  const next = new Array(54);
  for (let i = 0; i < 54; i++) next[i] = flat[perm[i]];
  return fromFlat(next);
}

// Fast flat-array variants for hot solver loops.
function applyMoveFlat(flat, face, dir, double) {
  const perm = MOVE_TABLE.get(moveKey(face, dir, double));
  const next = new Array(54);
  for (let i = 0; i < 54; i++) next[i] = flat[perm[i]];
  return next;
}

function statesEqual(a, b) {
  return FACES.every((f) => a[f].every((v, i) => v === b[f][i]));
}
function colorCounts(state) {
  const counts = {};
  for (const f of FACES) for (const v of state[f]) counts[v] = (counts[v] || 0) + 1;
  return counts;
}

module.exports = {
  applyMove, applyMoveFlat, toFlat, fromFlat, statesEqual, colorCounts, FACES,
  facePos, faceRowCol,
};
