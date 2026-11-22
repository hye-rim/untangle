'use strict';
// 줄 풀기: 엉킨 줄(그래프)의 점을 옮겨 줄이 하나도 겹치지 않게 만든다. 규칙·판 만들기·힌트는 화면 없이 여기서 (LOGIC_UT).
// 판은 먼저 겹치지 않는 그림(sol)을 만들고, 점들을 원 위에 뒤섞어 놓아(start) 반드시 풀 수 있다. 좌표는 0~1 안의 상대 좌표.
const LOGIC_UT = (() => {
  const MAX_N = 26, R = 0.045, EPS = 1e-9;              // 점 수 최대 · 점 반지름(상대 좌표)

  function rng(seed) {
    let t = (seed >>> 0) || 1;
    return () => {
      t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const onSeg = (p, q, r) => Math.min(p[0], r[0]) - EPS <= q[0] && q[0] <= Math.max(p[0], r[0]) + EPS && Math.min(p[1], r[1]) - EPS <= q[1] && q[1] <= Math.max(p[1], r[1]) + EPS;

  // 선분 ab 와 cd 가 겹치는가 (끝점을 같이 쓰는 두 줄은 만나도 겹친 것이 아니다. 한 줄 위에 포개진 경우는 겹친 것)
  function segCross(a, b, c, d) {
    const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
    if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true;
    if (Math.abs(d1) <= EPS && onSeg(a, c, b) && dist(c, a) > EPS && dist(c, b) > EPS) return true;
    if (Math.abs(d2) <= EPS && onSeg(a, d, b) && dist(d, a) > EPS && dist(d, b) > EPS) return true;
    if (Math.abs(d3) <= EPS && onSeg(c, a, d) && dist(a, c) > EPS && dist(a, d) > EPS) return true;
    if (Math.abs(d4) <= EPS && onSeg(c, b, d) && dist(b, c) > EPS && dist(b, d) > EPS) return true;
    return false;
  }

  // 겹친 줄의 짝 목록 [[줄 i, 줄 j], ...]
  function crossings(pts, edges) {
    const out = [];
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segCross(pts[a], pts[b], pts[c], pts[d])) out.push([i, j]);
    }
    return out;
  }
  const crossCount = (pts, edges) => crossings(pts, edges).length;
  const crossedEdges = (pts, edges) => { const s = new Set(); for (const [i, j] of crossings(pts, edges)) { s.add(i); s.add(j); } return s; };
  const isSolved = (pts, edges) => crossCount(pts, edges) === 0;

  // 점 수와 줄 수: 단계가 오를수록 점이 늘고 줄도 촘촘해진다
  const sizeFor = (level) => Math.min(MAX_N, 5 + level);
  const edgeTarget = (n, level) => Math.round(n * (1.25 + Math.min(0.55, level * 0.025)));

  function connected(n, edges) {
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    const seen = new Set([0]), st = [0];
    while (st.length) for (const v of adj[st.pop()]) if (!seen.has(v)) { seen.add(v); st.push(v); }
    return seen.size === n;
  }

  // 겹치지 않는 그림에서 줄 고르기: 가까운 쌍부터 겹치지 않으면 놓아 가며(평면 그래프) 가장 짧은 줄 묶음(MST)은 꼭 넣고 나머지는 무작위로 목표 수까지
  function planarEdges(pts, target, rand) {
    const n = pts.length, pairs = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b, dist(pts[a], pts[b])]);
    pairs.sort((p, q) => p[2] - q[2]);
    const all = [];
    for (const [a, b] of pairs) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) if (k !== a && k !== b && Math.abs(cross(pts[a], pts[b], pts[k])) / Math.max(EPS, dist(pts[a], pts[b])) < R * 1.1 && onSeg(pts[a], pts[k], pts[b])) ok = false;   // 다른 점 위를 지나는 줄은 안 놓는다
      for (const [c, d] of all) { if (!ok) break; if (a !== c && a !== d && b !== c && b !== d && segCross(pts[a], pts[b], pts[c], pts[d])) ok = false; }
      if (ok) all.push([a, b]);
    }
    const parent = Array.from({ length: n }, (_, i) => i), find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const keep = [], rest = [];
    for (const e of all) { const ra = find(e[0]), rb = find(e[1]); if (ra !== rb) { parent[ra] = rb; keep.push(e); } else rest.push(e); }
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    return keep.concat(rest.slice(0, Math.max(0, target - keep.length)));
  }

  // 단계 만들기. 같은 (단계, 시드)면 늘 같은 판
  function makeLevel(level, seed = 1) {
    const n = sizeFor(level);
    for (let attempt = 0; attempt < 60; attempt++) {
      const rand = rng((seed * 7919 + level * 104729 + attempt * 31) >>> 0);
      const sol = [], minD = 0.62 / Math.sqrt(n) * 1.0;
      for (let tries = 0; sol.length < n && tries < 4000; tries++) {
        const p = [0.08 + rand() * 0.84, 0.08 + rand() * 0.84];
        if (sol.every((q) => dist(p, q) >= minD)) sol.push(p);
      }
      if (sol.length < n) continue;
      const edges = planarEdges(sol, edgeTarget(n, level), rand);
      if (!connected(n, edges) || edges.length < n) continue;
      // 점들을 원 위에 무작위 순서로 늘어놓는다 → 줄이 엉킨다
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const start = new Array(n);
      order.forEach((v, k) => { const ang = (k / n) * Math.PI * 2 - Math.PI / 2; start[v] = [0.5 + 0.4 * Math.cos(ang), 0.5 + 0.4 * Math.sin(ang)]; });
      if (crossCount(start, edges) < Math.max(2, Math.floor(n / 2))) continue;
      return { level, n, edges, sol, start, par: Math.ceil(n * 0.8) };
    }
    throw new Error('level generation failed ' + level + '/' + seed);
  }

  // 힌트: 정답 그림 자리로 옮기면 겹침이 가장 적어지는 점 하나를 알려 준다(이미 정답 자리에 있는 점은 빼므로, 힌트를 따라가면 점 수만큼 안에 반드시 풀린다)
  function hint(pts, level) {
    let best = null;
    for (let v = 0; v < pts.length; v++) {
      if (dist(pts[v], level.sol[v]) < 0.02) continue;
      const trial = pts.slice(); trial[v] = level.sol[v];
      const c = crossCount(trial, level.edges), inc = level.edges.filter((e) => e[0] === v || e[1] === v).length;
      if (!best || c < best.c || (c === best.c && inc > best.inc)) best = { v, to: level.sol[v], c, inc };
    }
    return best ? { v: best.v, to: best.to, after: best.c } : null;
  }

  // 별: 점을 옮긴 횟수가 기준(par) 이내면 3개, 1.6배 이내면 2개, 그 밖은 1개. 힌트를 쓰면 최대 2개
  function stars(level, moves, hintUsed) {
    const s = moves <= level.par ? 3 : moves <= Math.ceil(level.par * 1.6) ? 2 : 1;
    return hintUsed ? Math.min(2, s) : s;
  }

  return { MAX_N, R, rng, segCross, crossings, crossCount, crossedEdges, isSolved, sizeFor, edgeTarget, connected, makeLevel, hint, stars };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LOGIC_UT;
