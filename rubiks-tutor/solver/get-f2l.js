const fs = require('fs');
const { applyMoveFlat, toFlat, fromFlat, FACES } = require('./engine');

const MOVES = [];
for (const face of FACES) { MOVES.push({face,dir:'CW',double:false}); MOVES.push({face,dir:'CCW',double:false}); MOVES.push({face,dir:'CW',double:true}); }
function flatIdx(face, idx) { return FACES.indexOf(face) * 9 + idx; }
const OPPOSITE = { U: 'D', D: 'U', F: 'B', B: 'F', L: 'R', R: 'L' };
const AXIS_ORDER = { U: 0, D: 0, F: 1, B: 1, L: 2, R: 2 };
const CANONICAL_FIRST = { U: true, F: true, L: true };

function idaSearch(startFlat, goalConstraints, mustAlsoHold, maxBound, timeBudgetMs) {
  const wrongCount = (flat, cons) => { let n=0; for (const [i,c] of cons) if (flat[i]!==c) n++; return n; };
  const fullyDone = (flat) => wrongCount(flat,goalConstraints)===0 && (!mustAlsoHold || wrongCount(flat,mustAlsoHold)===0);
  const h = (flat) => Math.ceil(wrongCount(flat, goalConstraints) / 2);
  if (fullyDone(startFlat)) return [];
  const deadline = timeBudgetMs ? Date.now()+timeBudgetMs : Infinity;
  for (let bound = Math.max(1,h(startFlat)); bound <= maxBound; bound++) {
    const seenAtDepth = new Map();
    function dfs(flat, g, lastFace, path) {
      if (Date.now() > deadline) throw {timedOut:true};
      const f = g + h(flat);
      if (f > bound) return null;
      if (g === bound) return fullyDone(flat) ? path : null;
      const k = flat.join('');
      const seen = seenAtDepth.get(k);
      if (seen !== undefined && seen <= g) return null;
      seenAtDepth.set(k, g);
      for (const m of MOVES) {
        if (m.face === lastFace) continue;
        if (lastFace && AXIS_ORDER[m.face]===AXIS_ORDER[lastFace] && m.face!==lastFace) { if (!CANONICAL_FIRST[lastFace]) continue; }
        const nf = applyMoveFlat(flat, m.face, m.dir, m.double);
        if (fullyDone(nf)) return path.concat([m]);
        const r = dfs(nf, g+1, m.face, path.concat([m]));
        if (r) return r;
      }
      return null;
    }
    try { const res = dfs(startFlat,0,null,[]); if (res) return res; } catch(e) { if (e&&e.timedOut) return null; throw e; }
  }
  return null;
}

const initial = {
  U: ['G','B','O', 'Y','Y','K', 'K','R','B'],
  F: ['B','G','O', 'B','G','B', 'G','R','Y'],
  L: ['K','O','R', 'O','R','O', 'Y','K','K'],
  R: ['K','O','Y', 'Y','O','R', 'B','G','R'],
  B: ['G','K','R', 'Y','B','G', 'Y','Y','B'],
  D: ['O','B','O', 'R','K','K', 'R','G','G'],
};
const C = { U: initial.U[4], D: initial.D[4], F: initial.F[4], B: initial.B[4], L: initial.L[4], R: initial.R[4] };
let flat = toFlat(initial);
const locked = [];
const allMoves = [];
function run(label, cons, maxBound, budget) {
  const t0 = Date.now();
  const moves = idaSearch(flat, cons, locked, maxBound, budget);
  if (!moves) throw new Error(label + ' failed');
  for (const m of moves) flat = applyMoveFlat(flat, m.face, m.dir, m.double);
  allMoves.push(...moves);
  console.log(label, moves.map(m=>m.face+(m.double?'2':m.dir==='CCW'?"'":'')).join(' '), (Date.now()-t0)+'ms');
  locked.push(...cons);
}
const CROSS = [{side:'F',uIdx:7,sIdx:1},{side:'R',uIdx:5,sIdx:1},{side:'B',uIdx:1,sIdx:1},{side:'L',uIdx:3,sIdx:1}];
const CORNERS = [{faces:['F','R'],uIdx:8,aIdx:2,bIdx:0},{faces:['R','B'],uIdx:2,aIdx:2,bIdx:0},{faces:['B','L'],uIdx:0,aIdx:2,bIdx:0},{faces:['L','F'],uIdx:6,aIdx:2,bIdx:0}];
const EDGES2 = [{faces:['F','R'],aIdx:5,bIdx:3},{faces:['R','B'],aIdx:5,bIdx:3},{faces:['B','L'],aIdx:5,bIdx:3},{faces:['L','F'],aIdx:5,bIdx:3}];
for (const e of CROSS) run('cross-'+e.side, [[flatIdx('U',e.uIdx),C.U],[flatIdx(e.side,e.sIdx),C[e.side]]], 10, 60000);
for (const c of CORNERS) { const [fa,fb]=c.faces; run('corner-'+c.faces.join(''), [[flatIdx('U',c.uIdx),C.U],[flatIdx(fa,c.aIdx),C[fa]],[flatIdx(fb,c.bIdx),C[fb]]], 10, 60000); }
for (const e of EDGES2) { const [fa,fb]=e.faces; run('edge2-'+e.faces.join(''), [[flatIdx(fa,e.aIdx),C[fa]],[flatIdx(fb,e.bIdx),C[fb]]], 14, 150000); }

const state = fromFlat(flat);
fs.writeFileSync('f2l-state.json', JSON.stringify({ state, moves: allMoves, centers: C }, null, 2));
console.log('saved f2l-state.json');
