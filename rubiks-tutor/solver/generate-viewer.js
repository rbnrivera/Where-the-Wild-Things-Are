'use strict';
const fs = require('fs');
const path = require('path');
const { applyMove } = require('./engine');
const { solve } = require('./solve');

const COLOR_META = {
  K: { fill: '#1b1b1f', text: '#ffffff', name: 'Black' },
  Y: { fill: '#ffd400', text: '#1b1b1f', name: 'Yellow' },
  R: { fill: '#d7263d', text: '#ffffff', name: 'Red' },
  O: { fill: '#ff8a00', text: '#1b1b1f', name: 'Orange' },
  G: { fill: '#009e60', text: '#ffffff', name: 'Green' },
  B: { fill: '#0056d6', text: '#ffffff', name: 'Blue' },
};

const PHASE_INFO = {
  cross: { name: 'Cross', why: (m) => `Placing one of the four cross pieces on top, matching it up with the ${m.sideName || ''} center.` },
  corner: { name: 'First-Layer Corners', why: () => `Slotting a corner piece into the top layer to finish the first layer.` },
  edge2: { name: 'Second-Layer Edges', why: () => `Placing an edge piece into the middle layer, between two side centers.` },
  'LL-orient-edges': { name: 'Last Layer: Match the Bottom Edges', why: () => `Flipping bottom-layer edges so they all show the same color on the bottom face — like making a cross down there.` },
  'LL-orient-corners': { name: 'Last Layer: Match the Bottom Corners', why: () => `Twisting bottom-layer corners in place so they all show the right color on the bottom face.` },
  'LL-permute-corners': { name: 'Last Layer: Swap Corners Into Place', why: () => `Moving bottom corners around (without flipping them) so each one lands in its correct spot.` },
  'LL-permute-edges': { name: 'Last Layer: Swap Edges Into Place', why: () => `Moving the last few bottom edges around so everything lines up — the final piece of the puzzle.` },
};

function phaseKeyFromLabel(label) {
  if (label.startsWith('LL-')) return label;
  return label.split('-')[0];
}

function buildSteps(initialState, solveMoves) {
  const steps = [];
  let state = initialState;
  for (const m of solveMoves) {
    steps.push({
      state,
      move: { face: m.face, direction: m.dir, double: m.double },
      phase: PHASE_INFO[phaseKeyFromLabel(m.label)].name,
      why: PHASE_INFO[phaseKeyFromLabel(m.label)].why(m),
    });
    state = applyMove(state, m.face, m.dir, m.double);
  }
  return { steps, finalState: state };
}

function main() {
  const initial = {
    U: ['G','B','O', 'Y','Y','K', 'K','R','B'],
    F: ['B','G','O', 'B','G','B', 'G','R','Y'],
    L: ['K','O','R', 'O','R','O', 'Y','K','K'],
    R: ['K','O','Y', 'Y','O','R', 'B','G','R'],
    B: ['G','K','R', 'Y','B','G', 'Y','Y','B'],
    D: ['O','B','O', 'R','K','K', 'R','G','G'],
  };

  console.log('Solving...');
  const t0 = Date.now();
  const { moves } = solve(initial, (line) => console.log(' ', line));
  console.log(`Solved in ${moves.length} moves, ${Date.now() - t0}ms total.`);

  const { steps, finalState } = buildSteps(initial, moves);
  const solvedOk = Object.entries(finalState).every(([f, arr]) => arr.every((v) => v === finalState[f][4]));
  console.log('Final state fully solved:', solvedOk);
  if (!solvedOk) { console.error('NOT SOLVED — aborting viewer generation.'); process.exit(1); }

  const templatePath = path.join(__dirname, 'viewer-template.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  html = html.replace('__COLORS__', JSON.stringify(COLOR_META));
  html = html.replace('__ORIENTATION__', JSON.stringify('Yellow on top, Green facing you'));
  html = html.replace('__STEPS__', JSON.stringify(steps));

  const outPath = path.join(__dirname, '..', 'cube-solve-viewer.html');
  fs.writeFileSync(outPath, html);
  console.log('Wrote', outPath, `(${steps.length} steps)`);
}

main();
