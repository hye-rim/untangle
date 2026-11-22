'use strict';
// 오락실 튜토리얼이 '진짜로 일어난 일'을 알아채는 신호 (arcade/public/tutorial.js 가 듣는다. 튜토리얼이 아니면 아무도 안 듣는다)
const tutorialSignal = (type) => window.dispatchEvent(new CustomEvent('arcade:tutorial', { detail: { type } }));

// 줄 풀기: 화면·입력·소리. 규칙·판 만들기·힌트는 logic.js (LOGIC_UT)
(() => {
const L = LOGIC_UT;
const $ = (id) => document.getElementById(id);
const TUT = /[?&]tutorial=1/.test(location.search);
const BEST_KEY = 'untangleBest', MUTE_KEY = 'untangleMuted';
const COLORS = ['#ff5a4f', '#ff9f43', '#ffd23f', '#4cd964', '#3dc6e0', '#3d8bff', '#8a7cff', '#ff5fa2'];

// ---------- 저장소 ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};
let best = Number(store.get(BEST_KEY)) || 0;               // 가장 높이 깬 단계
let muted = store.get(MUTE_KEY) === '1';

// ---------- 소리 ----------
let audio = null;
function tone(freq, dur, type = 'sine', vol = 0.09, slide = 0) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + dur);
  } catch (_) {}
}
const seq = (notes, step, type = 'triangle', vol = 0.09) => notes.forEach((f, i) => setTimeout(() => tone(f, step * 0.0009, type, vol), i * step));
const sfx = {
  pick: () => tone(620, 0.05, 'triangle', 0.06),
  drop: () => tone(300, 0.07, 'triangle', 0.07),
  good: () => tone(760, 0.09, 'triangle', 0.07, 180),
  undo: () => tone(500, 0.08, 'triangle', 0.07, -150),
  hint: () => tone(880, 0.12, 'sine', 0.07, 260),
  win: () => seq([523, 659, 784, 1047, 1319], 100, 'triangle', 0.1),
};

// ---------- 상태 ----------
let lvl = 1, seed = 1, g = null, pts = [], moves = 0, hist = [], hintUsed = false, hintShow = null;
let drag = null, solved = false, phase = 'title', startedAt = 0, clock = 0, shownT = 0;
const cvs = $('board'), ctx = cvs.getContext('2d');
let S = 300;                                                // 판의 CSS 크기(정사각형)

function fit() {
  const r = $('boardBox').getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  S = Math.max(160, Math.floor(r.width - 8));
  cvs.width = Math.round(S * dpr); cvs.height = Math.round(S * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', fit);

function newBoard() {
  g = L.makeLevel(lvl, seed);
  pts = g.start.map((p) => p.slice());
  moves = 0; hist = []; hintUsed = false; hintShow = null; drag = null; solved = false; startedAt = performance.now();
  hud(); $('msg').textContent = TUT ? '' : '동그라미를 끌어서 줄이 겹치지 않게 해요';
}

function startLevel(n, keepSeed) {
  lvl = n; if (!keepSeed) seed = TUT ? 1 : (Date.now() % 9973) + 1;
  phase = 'play'; $('overlay').classList.add('hidden'); newBoard();
}

// ---------- 화면 값 ----------
function hud() {
  const c = g ? L.crossCount(pts, g.edges) : 0;
  $('lvl').textContent = TUT ? '연습' : lvl;
  $('crossN').textContent = c; $('movesN').textContent = moves;
  $('crossBox').className = 'item ' + (c === 0 && g ? 'good' : c > 0 ? 'bad' : '');
  $('undoBtn').disabled = !hist.length || solved; $('hintBtn').disabled = solved || phase !== 'play'; $('restartBtn').disabled = phase !== 'play';
}

// ---------- 그리기 ----------
const px = (p) => [p[0] * S, p[1] * S];
const ballR = () => Math.max(11, L.R * S * (1 - Math.max(0, (g ? g.n : 0) - 14) * 0.014));       // 점이 많은 판은 공을 조금 작게
function draw() {
  clock += 1 / 60;
  ctx.clearRect(0, 0, S, S);
  // 모눈종이
  ctx.strokeStyle = 'rgba(43,29,82,.08)'; ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) { const p = Math.round(i * S / 12) + 0.5; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke(); }
  if (!g) return;
  const crossed = L.crossedEdges(pts, g.edges), R = ballR();
  const grabbedEdges = (e) => drag && (e[0] === drag.v || e[1] === drag.v);
  ctx.lineCap = 'round';
  g.edges.forEach((e, i) => {
    const a = px(pts[e[0]]), b = px(pts[e[1]]), bad = crossed.has(i);
    ctx.strokeStyle = solved ? '#3fbf5a' : bad ? `rgba(230,57,70,${0.75 + 0.25 * Math.sin(clock * 8)})` : '#3d8bff';
    ctx.lineWidth = bad ? 5 : 4;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    if (grabbedEdges(e)) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  });
  // 힌트: 옮길 점과 놓을 자리
  if (hintShow && hintShow.t > 0) {
    const a = px(pts[hintShow.v]), b = px(hintShow.to), pulse = 0.6 + 0.4 * Math.sin(clock * 9);
    ctx.setLineDash([6, 6]); ctx.strokeStyle = `rgba(255,95,162,${pulse})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(b[0], b[1], R + 3 + 2 * Math.sin(clock * 9), 0, Math.PI * 2); ctx.strokeStyle = '#ff5fa2'; ctx.lineWidth = 4; ctx.stroke();
  }
  // 털실 공
  pts.forEach((p, v) => {
    const [x, y] = px(p), lifted = drag && drag.v === v, hinted = hintShow && hintShow.t > 0 && hintShow.v === v;
    const bounce = solved ? Math.abs(Math.sin(clock * 5 + v)) * 4 : 0;
    const cy = y - (lifted ? 6 : 0) - bounce;
    ctx.fillStyle = 'rgba(43,29,82,.28)'; ctx.beginPath(); ctx.ellipse(x, y + R * 0.8, R * 0.9, R * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS[v % COLORS.length]; ctx.strokeStyle = '#2b1d52'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6;                      // 털실 감긴 무늬
    ctx.beginPath(); ctx.arc(x, cy, R * 0.62, -0.9, 1.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, cy, R * 0.62, 2.3, 4.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - R * 0.7, cy - R * 0.2); ctx.quadraticCurveTo(x, cy + R * 0.5, x + R * 0.7, cy - R * 0.3); ctx.stroke();
    if (lifted || hinted) { ctx.strokeStyle = '#ff5fa2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy, R + 4, 0, Math.PI * 2); ctx.stroke(); }
  });
}
let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  if (hintShow && hintShow.t > 0) hintShow.t -= dt;
  draw();
  requestAnimationFrame(loop);
}

// ---------- 입력 ----------
function localPos(e) {
  const r = cvs.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
}
function pick(pos) {
  const hit = Math.max(30, L.R * S * 1.7) / S;
  let bestV = -1, bestD = hit;
  pts.forEach((p, v) => { const d = Math.hypot(p[0] - pos[0], p[1] - pos[1]); if (d < bestD) { bestD = d; bestV = v; } });
  return bestV;
}
cvs.addEventListener('pointerdown', (e) => {
  if (phase !== 'play' || solved || drag) return;
  e.preventDefault();
  const pos = localPos(e), v = pick(pos);
  if (v < 0) return;
  try { cvs.setPointerCapture(e.pointerId); } catch (_) {}
  drag = { v, id: e.pointerId, dx: pts[v][0] - pos[0], dy: pts[v][1] - pos[1], from: pts[v].slice(), before: L.crossCount(pts, g.edges), moved: false };
  hintShow = null; sfx.pick(); tutorialSignal('grab');
});
cvs.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const pos = localPos(e), m = 0.035;
  const np = [Math.min(1 - m, Math.max(m, pos[0] + drag.dx)), Math.min(1 - m, Math.max(m, pos[1] + drag.dy))];
  pts[drag.v] = np;
  if (Math.hypot(np[0] - drag.from[0], np[1] - drag.from[1]) > 0.01) drag.moved = true;
  hud();
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag; drag = null;
  if (!d.moved) { pts[d.v] = d.from; hud(); return; }
  moves++; hist.push({ v: d.v, from: d.from });
  const after = L.crossCount(pts, g.edges);
  hud(); tutorialSignal('drop');
  if (after < d.before) { sfx.good(); tutorialSignal('fewer'); } else sfx.drop();
  if (after === 0) win();
}
cvs.addEventListener('pointerup', endDrag);
cvs.addEventListener('pointercancel', endDrag);
cvs.addEventListener('lostpointercapture', endDrag);

function undo() {
  if (phase !== 'play' || solved || !hist.length) return;
  const h = hist.pop(); pts[h.v] = h.from; hintShow = null; sfx.undo(); hud(); tutorialSignal('undo');
}
function restart() { if (phase !== 'play') return; startLevel(lvl, true); }
function hint() {
  if (phase !== 'play' || solved) return;
  const h = L.hint(pts, g); if (!h) return;
  hintShow = { v: h.v, to: h.to, t: 4 }; hintUsed = true; sfx.hint(); tutorialSignal('hint');
  $('msg').textContent = '분홍 동그라미 자리로 옮겨 보세요';
}
$('undoBtn').onclick = undo; $('restartBtn').onclick = restart; $('hintBtn').onclick = hint;
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'z') undo(); else if (k === 'r') restart(); else if (k === 'h') hint(); else if (k === 'm') toggleMute();
  else if ((k === ' ' || k === 'enter') && phase !== 'play') { const b = document.querySelector('#overlay button'); if (b) b.click(); }
});
function toggleMute() { muted = !muted; store.set(MUTE_KEY, muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; }
$('muteBtn').onclick = toggleMute; $('muteBtn').textContent = muted ? '🔇' : '🔊';

// ---------- 끝 ----------
function win() {
  solved = true; hintShow = null; phase = 'win'; hud(); sfx.win(); tutorialSignal('solve');
  const secs = Math.round((performance.now() - startedAt) / 1000), st = L.stars(g, moves, hintUsed), prev = best;
  if (!TUT && lvl > best) { best = lvl; store.set(BEST_KEY, String(best)); }
  $('msg').textContent = '';
  setTimeout(() => {
    if (phase !== 'win') return;
    showOverlay(`<h2>풀었어요!</h2><p>${lvl}단계 · 점 ${g.n}개</p><div class="stars">${'⭐'.repeat(st)}${'☆'.repeat(3 - st)}</div>`
      + `<dl class="stats"><dt>이동</dt><dd>${moves}번 <small>(별 3개는 ${g.par}번 이하)</small></dd><dt>시간</dt><dd>${secs}초</dd><dt>힌트</dt><dd>${hintUsed ? '썼어요' : '안 썼어요'}</dd>${!TUT && lvl > prev ? '<dt>기록</dt><dd>새 최고 단계!</dd>' : ''}</dl>`
      + `<div class="col"><button id="btnNext">${TUT ? '확인' : '다음 단계'}</button><button class="sub" id="btnAgain">같은 판 다시</button></div>`);
    $('btnNext').onclick = () => (TUT ? showTitle() : startLevel(lvl + 1));
    $('btnAgain').onclick = () => startLevel(lvl, true);
  }, 900);
}
function showOverlay(html) { const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden'); }
function showTitle() {
  phase = 'title'; hud();
  const cont = !TUT && best > 0;
  showOverlay(`<h1>줄 풀기 🧶</h1><p>엉킨 줄의 <b>동그라미를 끌어서</b><br>줄이 <b>하나도 겹치지 않게</b> 풀어요!<br>단계가 오를수록 점이 늘어나요.</p>`
    + `<div class="col"><button id="btnStart">${cont ? `이어서 하기 (${best + 1}단계)` : '시작하기'}</button>${cont ? '<button class="sub" id="btnFirst">처음부터</button>' : ''}</div>${!TUT && best ? `<p>가장 높이 푼 단계 <b>${best}</b></p>` : ''}`);
  $('btnStart').onclick = () => startLevel(TUT ? 3 : cont ? best + 1 : 1);       // 연습은 점 8개짜리 판(겹침이 충분히 많아 힌트·되돌리기를 해 볼 수 있다)
  if ($('btnFirst')) $('btnFirst').onclick = () => startLevel(1);
}

fit(); newBoard(); phase = 'title'; showTitle(); requestAnimationFrame(loop);
document.addEventListener('visibilitychange', () => { if (document.hidden) drag = null; });
/* @test-hooks:start */
window.__ut = { get pts() { return pts; }, get g() { return g; }, get moves() { return moves; }, get phase() { return phase; }, get S() { return S; }, startLevel, setPts(p) { pts = p; hud(); }, endDrag, undo, hint, win };
/* @test-hooks:end */
})();
