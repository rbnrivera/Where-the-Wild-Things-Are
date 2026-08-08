'use strict';
const fs = require('fs');
const { applyMove } = require('./engine');
const {
  parseAlg, applyAlg, mvStr, DL_EDGES, DL_CORNERS,
  edgesOriented, cornersOriented, cornersPermuted, fullySolved, f2lIntact,
} = require('./lastlayer');

const { state, centers: C } = JSON.parse(fs.readFileSync(__dirname + '/f2l-state.json', 'utf8'));
console.log('Loaded F2L state. Centers:', C);

// Two candidate translations of the classic "F R U R' U' F'" OLL-edges
// algorithm from "last layer = U" to "last layer = D":
//  (a) naive: just relabel U -> D, keep every direction as written.
//  (b) mirrored: U -> D AND every move's direction reversed (this is
//      the geometrically-correct translation under a U/D reflection).
const CANDIDATES_ORIENT_EDGES = [
  "F D R D' R' F'",      // naive
  "F' D' R' D R F",      // mirrored
  "F R D R' D' F'",      // naive, D in R's slot too just in case
  "F' R' D' R D F'",
];

function tryOnce(alg, preD) {
  let s = state;
  for (let i = 0; i < preD; i++) s = applyMove(s, 'D', 'CW', false);
  const before = s;
  s = applyAlg(s, parseAlg(alg));
  return { after: s, ok: edgesOriented(s, C), intact: f2lIntact(s, before, C) };
}

console.log('\n--- Testing OLL-edge candidates ---');
for (const alg of CANDIDATES_ORIENT_EDGES) {
  for (let pre = 0; pre < 4; pre++) {
    const r = tryOnce(alg, pre);
    if (r.ok && r.intact) {
      console.log(`MATCH: preD=${pre} alg="${alg}" -> edges oriented, F2L intact`);
    }
  }
}
console.log('(if nothing printed above, trying repeated application with D realignment between tries)');

// Try repeated application (common for OLL: dot -> line/L -> cross)
for (const alg of CANDIDATES_ORIENT_EDGES) {
  let s = state;
  let ok = false;
  const before = state;
  const trace = [];
  for (let attempt = 0; attempt < 6 && !ok; attempt++) {
    for (let pre = 0; pre < 4 && !ok; pre++) {
      let s2 = s;
      for (let i = 0; i < pre; i++) s2 = applyMove(s2, 'D', 'CW', false);
      const after = applyAlg(s2, parseAlg(alg));
      if (f2lIntact(after, before, C)) {
        s = after;
        trace.push(`D*${pre} ${alg}`);
        if (edgesOriented(s, C)) { ok = true; }
        break;
      }
    }
  }
  if (ok) console.log(`REPEATED MATCH alg="${alg}" trace=`, trace);
}
