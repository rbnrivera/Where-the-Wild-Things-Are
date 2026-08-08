'use strict';
// Cube physics engine. Represents state exactly like the tutor cards:
// { U:[9], D:[9], F:[9], B:[9], L:[9], R:[9] }, each a row-major 3x3
// grid as seen looking directly at that face from outside the cube.
//
// Internally works in 3D coordinates (x,y,z each in {-1,0,1}) so a
// single generic rotation formula handles all six faces, instead of
// hand-deriving each face's ring cycle separately by hand (that's what
// caused real bugs when done manually during the live trial).

const NORMAL = {
  U: { x: 0, y: 1, z: 0 }, D: { x: 0, y: -1, z: 0 },
  F: { x: 0, y: 0, z: 1 }, B: { x: 0, y: 0, z: -1 },
  L: { x: -1, y: 0, z: 0 }, R: { x: 1, y: 0, z: 0 },
};
const FACE_AXIS = { U: 'y', D: 'y', F: 'z', B: 'z', L: 'x', R: 'x' };
const FACE_SIGN = { U: 1, D: -1, F: 1, B: -1, L: -1, R: 1 };
const FACES = ['U', 'D', 'F', 'B', 'L', 'R'];

// (row,col) [1-indexed] <-> the two non-fixed coordinates of a face,
// matching the conventions established (and, for U/F, empirically
// validated against the physical cube during the trial).
function facePos(face, row, col) {
  const a = col - 2; // -1,0,1 across columns 1..3
  const b = row - 2; // -1,0,1 across rows 1..3
  switch (face) {
    case 'F': return { x: a, y: -b, z: 1 };
    case 'B': return { x: -a, y: -b, z: -1 };
    case 'U': return { x: a, y: 1, z: b };
    case 'D': return { x: a, y: -1, z: -b };
    case 'L': return { x: -1, y: -b, z: a };
    case 'R': return { x: 1, y: -b, z: -a };
  }
}

// Inverse of facePos: given a face and its two free coordinates, return {row,col}.
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

function allFacelets() {
  const out = [];
  for (const face of FACES) {
    for (let row = 1; row <= 3; row++) {
      for (let col = 1; col <= 3; col++) {
        out.push({ face, row, col, pos: facePos(face, row, col) });
      }
    }
  }
  return out;
}
const FACELETS = allFacelets();

// Rotate a point/vector by 90*quarterSign degrees about the given axis,
// using the standard right-hand rule (x->y->z->x positive direction).
function rotate90(axis, quarterSign, p) {
  const s = quarterSign;
  const { x, y, z } = p;
  if (axis === 'x') return { x, y: s * -z, z: s * y };
  if (axis === 'y') return { x: s * z, y, z: s * -x };
  if (axis === 'z') return { x: s * -y, y: s * x, z };
}

function findFaceByNormal(n) {
  for (const f of FACES) {
    const fn = NORMAL[f];
    if (fn.x === n.x && fn.y === n.y && fn.z === n.z) return f;
  }
  throw new Error('no face matches normal ' + JSON.stringify(n));
}

function cloneState(state) {
  return {
    U: state.U.slice(), D: state.D.slice(), F: state.F.slice(),
    B: state.B.slice(), L: state.L.slice(), R: state.R.slice(),
  };
}
function getSticker(state, face, row, col) {
  return state[face][(row - 1) * 3 + (col - 1)];
}
function setSticker(state, face, row, col, val) {
  state[face][(row - 1) * 3 + (col - 1)] = val;
}

// Apply one move. face: U/D/F/B/L/R. dir: 'CW'|'CCW', meaning "viewed
// from outside that face" in the standard cube-notation sense. double:
// true for a 180 turn.
function applyMove(state, face, dir, double) {
  const axis = FACE_AXIS[face];
  const faceSign = FACE_SIGN[face];
  // Standard notation: a clockwise turn (viewed from outside the face)
  // is a right-hand rotation of -faceSign*90 about the face's axis.
  const quarterSign = -faceSign * (dir === 'CW' ? 1 : -1);
  const turns = double ? 2 : 1;

  let cur = state;
  for (let t = 0; t < turns; t++) {
    const next = cloneState(cur);
    for (const fl of FACELETS) {
      const coord = axis === 'x' ? fl.pos.x : axis === 'y' ? fl.pos.y : fl.pos.z;
      if (coord !== faceSign) continue; // not part of the turning layer

      const newPos = rotate90(axis, quarterSign, fl.pos);
      const newNormal = rotate90(axis, quarterSign, NORMAL[fl.face]);
      const newFace = findFaceByNormal(newNormal);
      const rc = faceRowCol(newFace, newPos);
      setSticker(next, newFace, rc.row, rc.col, getSticker(cur, fl.face, fl.row, fl.col));
    }
    cur = next;
  }
  return cur;
}

function statesEqual(a, b) {
  return FACES.every((f) => a[f].every((v, i) => v === b[f][i]));
}

function colorCounts(state) {
  const counts = {};
  for (const f of FACES) for (const v of state[f]) counts[v] = (counts[v] || 0) + 1;
  return counts;
}

module.exports = { applyMove, facePos, faceRowCol, statesEqual, colorCounts, cloneState, FACES };
