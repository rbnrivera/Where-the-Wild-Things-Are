'use strict';
// Validate the engine ONLY against what the user actually reported from
// their physical cube during the live trial — not against my past
// hand-derived intermediate states, which turned out to contain bugs
// of their own (e.g. forgetting the D face changes after an F turn).
const { applyMove, colorCounts } = require('./engine');

const initial = {
  U: ['G','B','O', 'Y','Y','K', 'K','R','B'],
  F: ['B','G','O', 'B','G','B', 'G','R','Y'],
  L: ['K','O','R', 'O','R','O', 'Y','K','K'],
  R: ['K','O','Y', 'Y','O','R', 'B','G','R'],
  B: ['G','K','R', 'Y','B','G', 'Y','Y','B'],
  D: ['O','B','O', 'R','K','K', 'R','G','G'],
};

function check(label, actualFace, gotArr, wantStr) {
  const got = gotArr.join('');
  const ok = got === wantStr;
  console.log(`${label} (${actualFace}): ${ok ? 'PASS' : 'FAIL'}  got=${got} want=${wantStr}`);
  return ok;
}

let ok = true;
let s = initial;

s = applyMove(s, 'F', 'CW', false);
ok = check('after F CW', 'F', s.F, 'GBBRGGYBO') && ok;

s = applyMove(s, 'D', 'CW', true);
ok = check('after D2', 'F', s.F, 'GBBRGGYYB') && ok;

s = applyMove(s, 'B', 'CW', true);
ok = check('after B2', 'U', s.U, 'BYKYYKKOR') && ok;

// User reported "left face" in a way that turned out to be a 180-rotated
// presentation of the same physical state (confirmed via corner-color
// cross-check during the trial), so we validate against the U-face
// report instead, which is unambiguous. Position 4 was later argued (via
// the "no duplicate edge piece" constraint) to be R not Y — try both CW
// and CCW for L and see which one is even self-consistent with a clean
// 8/9 or 9/9 match.
for (const dir of ['CW', 'CCW']) {
  const s2 = applyMove(s, 'L', dir, false);
  const got = s2.U.join('');
  const want8 = 'GYK_YKYOR'; // '_' = disputed cell (pos4)
  let matches = 0;
  for (let i = 0; i < 9; i++) if (want8[i] === '_' || want8[i] === got[i]) matches++;
  console.log(`after L ${dir}: U=${got}  matches ${matches}/9 vs GYK?YKYOR (pos4 disputed)`);
}

console.log('\nfinal color counts (after F,D2,B2):', colorCounts(s));
console.log(ok ? 'Core replay PASSES against user-reported data.' : 'MISMATCH found.');

// Cross-check the raw user-reported "left face" (as typed, possibly
// presented in a rotated/mirrored orientation) against engine output
// for both directions, trying all 4 rotations of the 3x3 grid.
function rotateGrid90(g) { return [g[6],g[3],g[0], g[7],g[4],g[1], g[8],g[5],g[2]]; }
function allRotations(g) {
  const out = [g];
  let cur = g;
  for (let i = 0; i < 3; i++) { cur = rotateGrid90(cur); out.push(cur); }
  return out;
}
const userL = ['Y','R','O','G','R','O','R','B','O'];
console.log('\nUser-reported L face, checked against engine L-CW / L-CCW at all 4 rotations:');
for (const dir of ['CW', 'CCW']) {
  const s2 = applyMove(s, 'L', dir, false);
  for (const rot of allRotations(userL)) {
    const matches = rot.filter((v, i) => v === s2.L[i]).length;
    if (matches >= 8) console.log(`  L ${dir}: engine=${s2.L.join('')} userRot=${rot.join('')} matches=${matches}/9  <-- CANDIDATE`);
  }
}

// Full validity check on engine's L-CW result (no rotation assumed).
console.log('\n--- Full validity check: engine L CW, matched raw user data ---');
const sFinal = applyMove(s, 'L', 'CW', false);
for (const f of ['U','D','F','B','L','R']) console.log(f, sFinal[f].join(''));
console.log('color counts:', colorCounts(sFinal));

const OPP = { G:'B', B:'G', R:'O', O:'R', Y:'K', K:'Y' };
function corner(name, a, b, c) {
  const set = [a,b,c];
  const bad = set.some((x, i) => set.some((y, j) => i !== j && OPP[x] === y));
  console.log(`  corner ${name}: ${set.join(',')}  ${bad ? 'INVALID (opposite pair collision)' : 'ok'}`);
}
console.log('corners:');
corner('U-F-R', sFinal.U[8], sFinal.F[2], sFinal.R[0]);
corner('U-F-L', sFinal.U[6], sFinal.F[0], sFinal.L[2]);
corner('U-B-R', sFinal.U[2], sFinal.B[0], sFinal.R[2]);
corner('U-B-L', sFinal.U[0], sFinal.B[2], sFinal.L[0]);
corner('D-F-R', sFinal.D[2], sFinal.F[8], sFinal.R[6]);
corner('D-F-L', sFinal.D[0], sFinal.F[6], sFinal.L[8]);
corner('D-B-R', sFinal.D[8], sFinal.B[6], sFinal.R[8]);
corner('D-B-L', sFinal.D[6], sFinal.B[8], sFinal.L[6]);
