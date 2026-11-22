'use strict';

// 줄 풀기 규칙 시험. 실행: node --test (디렉터리)
const test = require('node:test');
const assert = require('node:assert');
const L = require('../logic.js');

test('segment crossing: crossing lines, shared end points and separate lines', () => {
  assert.ok(L.segCross([0, 0], [1, 1], [0, 1], [1, 0]), 'an X crosses');
  assert.ok(!L.segCross([0, 0], [1, 0], [0, 1], [1, 1]), 'parallel lines do not');
  assert.ok(!L.segCross([0, 0], [1, 1], [1, 1], [2, 0]), 'lines sharing an end point do not count');
  assert.ok(!L.segCross([0, 0], [1, 0], [2, 0], [3, 0]), 'collinear but apart');
  assert.ok(L.segCross([0, 0], [2, 0], [1, 0], [3, 0]), 'collinear and overlapping');
  assert.ok(!L.segCross([0, 0], [1, 1], [2, 0], [3, 1]), 'far apart');
});

test('crossings skips edges that share a vertex and counts the rest', () => {
  const pts = [[0, 0], [1, 1], [0, 1], [1, 0], [0.5, 2]];
  assert.strictEqual(L.crossCount(pts, [[0, 1], [2, 3]]), 1);
  assert.strictEqual(L.crossCount(pts, [[0, 1], [1, 4]]), 0, 'sharing vertex 1');
  assert.strictEqual(L.crossedEdges(pts, [[0, 1], [2, 3], [0, 3]]).size, 2);
  assert.ok(L.isSolved(pts, [[0, 3], [3, 1]]));
});

test('level size grows with the level and stays within the limit', () => {
  let prev = 0;
  for (let lv = 1; lv <= 30; lv++) { const n = L.sizeFor(lv); assert.ok(n >= prev && n <= L.MAX_N); prev = n; }
  assert.strictEqual(L.sizeFor(1), 6);
  assert.strictEqual(L.sizeFor(30), L.MAX_N);
});

test('every level is solvable: the hidden drawing has no crossings, the start is tangled, and the graph is connected', () => {
  for (let lv = 1; lv <= 30; lv++) for (const seed of [1, 2, 3]) {
    const g = L.makeLevel(lv, seed);
    assert.strictEqual(g.n, L.sizeFor(lv));
    assert.strictEqual(g.sol.length, g.n); assert.strictEqual(g.start.length, g.n);
    assert.strictEqual(L.crossCount(g.sol, g.edges), 0, `level ${lv}/${seed} solution has no crossings`);
    assert.ok(L.crossCount(g.start, g.edges) >= Math.max(2, Math.floor(g.n / 2)), `level ${lv}/${seed} start is tangled`);
    assert.ok(L.connected(g.n, g.edges), `level ${lv}/${seed} connected`);
    const seen = new Set();
    for (const [a, b] of g.edges) { assert.ok(a !== b && a >= 0 && b >= 0 && a < g.n && b < g.n); const k = Math.min(a, b) + ',' + Math.max(a, b); assert.ok(!seen.has(k), 'no duplicate edge'); seen.add(k); }
    for (const p of g.sol.concat(g.start)) assert.ok(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1, 'inside the board');
    assert.ok(g.edges.length >= g.n, 'at least a loop worth of edges');
  }
});

test('points in the hidden drawing are not too close, so balls do not overlap', () => {
  for (let lv = 1; lv <= 30; lv += 3) {
    const g = L.makeLevel(lv, 5);
    for (let a = 0; a < g.n; a++) for (let b = a + 1; b < g.n; b++) assert.ok(Math.hypot(g.sol[a][0] - g.sol[b][0], g.sol[a][1] - g.sol[b][1]) > L.R * 2.2, `level ${lv}`);
  }
});

test('the same level and seed make the same board; another seed makes another one', () => {
  const a = L.makeLevel(7, 4), b = L.makeLevel(7, 4), c = L.makeLevel(7, 5);
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a.sol, c.sol);
});

test('later levels have more edges per point', () => {
  const lo = L.makeLevel(2, 1), hi = L.makeLevel(20, 1);
  assert.ok(hi.edges.length / hi.n >= lo.edges.length / lo.n - 0.05);
  assert.ok(L.edgeTarget(10, 1) < L.edgeTarget(10, 20));
});

test('following the hints always solves the board, one point at a time', () => {
  for (const lv of [1, 4, 9, 15, 22]) for (const seed of [1, 2]) {
    const g = L.makeLevel(lv, seed);
    let pts = g.start.map((p) => p.slice()), steps = 0;
    while (!L.isSolved(pts, g.edges) && steps <= g.n) {
      const h = L.hint(pts, g); assert.ok(h, 'a hint exists while unsolved');
      pts = pts.slice(); pts[h.v] = h.to.slice(); steps++;
    }
    assert.ok(L.isSolved(pts, g.edges), `level ${lv}/${seed} solved by hints`);
    assert.ok(steps <= g.n, 'within one move per point');
  }
});

test('a hint picks the point whose move leaves the fewest crossings', () => {
  const g = L.makeLevel(6, 2);
  const h = L.hint(g.start, g);
  for (let v = 0; v < g.n; v++) {
    const t = g.start.slice(); t[v] = g.sol[v];
    assert.ok(L.crossCount(t, g.edges) >= h.after, `point ${v} would not do better`);
  }
});

test('no hint once everything is at its place', () => {
  const g = L.makeLevel(3, 1);
  assert.strictEqual(L.hint(g.sol, g), null);
});

test('stars: few moves give three, hints cap at two', () => {
  const g = L.makeLevel(5, 1);
  assert.strictEqual(L.stars(g, g.par, false), 3);
  assert.strictEqual(L.stars(g, Math.ceil(g.par * 1.5), false), 2);
  assert.strictEqual(L.stars(g, g.par * 3, false), 1);
  assert.strictEqual(L.stars(g, 1, true), 2);
});
