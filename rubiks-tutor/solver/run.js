'use strict';
const { applyMove } = require('./engine');
const { solve, mvStr } = require('./solve');

const initial = {
  U: ['G','B','O', 'Y','Y','K', 'K','R','B'],
  F: ['B','G','O', 'B','G','B', 'G','R','Y'],
  L: ['K','O','R', 'O','R','O', 'Y','K','K'],
  R: ['K','O','Y', 'Y','O','R', 'B','G','R'],
  B: ['G','K','R', 'Y','B','G', 'Y','Y','B'],
  D: ['O','B','O', 'R','K','K', 'R','G','G'],
};

console.time('total');
const { state, moves } = solve(initial, (line) => console.log(line));
console.timeEnd('total');

console.log('\nTotal moves:', moves.length);
console.log(moves.map(mvStr).join(' '));
console.log('\nFinal state:');
for (const f of ['U','D','F','B','L','R']) console.log(f, state[f].join(''));
