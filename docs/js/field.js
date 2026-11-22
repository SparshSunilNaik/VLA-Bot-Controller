/* Top-down tiled room. Differential drive from Rover.motors, furniture to bump into, a dock to reach. */
(function () {
  var R = window.Rover;
  var canvas = document.getElementById("field");
  var ctx = canvas.getContext("2d");
  var sim = document.getElementById("sim");
  var COLS = 16, ROWS = 10, WALL = 0.2;
  var SPEED = 1.7;      // tiles per second at full forward
  var TURN = 2.6;       // rad per second spinning in place (one 0.3 s step is about 45 degrees)
  var BOT_R = 0.5;      // collision radius in tiles

  /* ---------- the room ---------- */
  var RUG = { x: 2.2, y: 4.6, w: 3.0, h: 2.5 };
  var THINGS = [
    { t: "lamp", name: "floor lamp", x: 0.5, y: 0.5, w: 0.7, h: 0.7 },
    { t: "table", name: "dining table", x: 3.0, y: 1.0, w: 2.6, h: 1.4 },
    { t: "chair", name: "chair", x: 3.3, y: 0.3, w: 0.7, h: 0.6, back: "top" },
    { t: "chair", name: "chair", x: 4.6, y: 0.3, w: 0.7, h: 0.6, back: "top" },
    { t: "chair", name: "chair", x: 3.3, y: 2.5, w: 0.7, h: 0.6, back: "bottom" },
    { t: "chair", name: "chair", x: 4.6, y: 2.5, w: 0.7, h: 0.6, back: "bottom" },
    { t: "sofa", name: "sofa", x: 0.3, y: 4.5, w: 1.0, h: 2.7, back: "left" },
    { t: "coffee", name: "coffee table", x: 2.9, y: 5.3, w: 1.6, h: 1.0 },
    { t: "side", name: "side table", x: 11.0, y: 8.7, w: 0.7, h: 0.7 },
    { t: "sofa", name: "couch", x: 7.2, y: 3.6, w: 1.0, h: 3.2, back: "right" },
    { t: "shelf", name: "bookshelf", x: 10.2, y: 0.2, w: 0.6, h: 3.2 },
    { t: "desk", name: "desk", x: 12.8, y: 2.4, w: 2.2, h: 1.0 },
    { t: "chair", name: "desk chair", x: 13.5, y: 3.6, w: 0.7, h: 0.7, back: "bottom" },
    { t: "box", name: "box", x: 11.6, y: 6.0, w: 0.9, h: 0.9 },
    { t: "box", name: "box", x: 12.6, y: 6.5, w: 0.8, h: 0.8 },
    { t: "box", name: "box", x: 5.4, y: 8.0, w: 0.9, h: 0.9 },
    { t: "arm", name: "armchair", x: 9.4, y: 7.4, w: 1.2, h: 1.2 }
  ];
  var DOCKS = [{ x: 14.9, y: 1.0 }, { x: 14.8, y: 8.8 }, { x: 8.9, y: 1.2 }, { x: 6.3, y: 6.6 }, { x: 3.6, y: 8.9 }, { x: 9.4, y: 5.0 }, { x: 15.0, y: 5.0 }];

  var colors = {};
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ["floor-a", "floor-b", "grout", "wood", "wall", "leaf", "sun", "tomato", "sky", "ink", "line", "paper", "plum", "danger"].forEach(function (k) {
      colors[k] = cs.getPropertyValue("--" + k).trim();
    });
    colors.dark = document.documentElement.getAttribute("data-theme") === "dark";
  }
  readColors();
  document.addEventListener("themechange", readColors);

  var bot = { x: 1.1, y: 8.7, h: 0 };
  var trail = [];
  var dockIdx = 0, docks = 0, bumps = 0;
  var bumpCool = 0, bumpFlash = 0, dockFlash = 0;
  var plan = null, autoBumped = false;

  /* ---------- hud + toast ---------- */
  var hudDocks = document.getElementById("hud-docks");
  var hudBumps = document.getElementById("hud-bumps");
  var hudMotor = document.getElementById("hud-motor");
  var hudStep = document.getElementById("hud-step");
  function hud() {
    hudDocks.innerHTML = "Docked <b>" + docks + "</b>";
    hudBumps.innerHTML = "Bumps <b>" + bumps + "</b>";
  }
  function motorHud() {
    function f(v) { return v > 0 ? "+1" : v < 0 ? "-1" : "0"; }
    hudMotor.textContent = "L " + f(R.motors.left) + "  R " + f(R.motors.right);
  }
  R.on("state", motorHud);
  R.on("step", function (s) { hudStep.textContent = "step #" + s.id; });

  var toastEl = document.getElementById("toast"), toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }

  /* ---------- geometry ---------- */
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function hits(x, y, r) {
    if (x - r < WALL || y - r < WALL || x + r > COLS - WALL || y + r > ROWS - WALL) return { name: "wall" };
    for (var i = 0; i < THINGS.length; i++) {
      var o = THINGS[i];
      var cx = Math.max(o.x, Math.min(x, o.x + o.w)), cy = Math.max(o.y, Math.min(y, o.y + o.h));
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return o;
    }
    return null;
  }

  /* ---------- path planning for the autopilot (A* on a quarter-tile grid) ---------- */
  var RES = 4, GW = COLS * RES, GH = ROWS * RES, free = [];
  for (var gy = 0; gy < GH; gy++) for (var gx = 0; gx < GW; gx++) free[gy * GW + gx] = !hits((gx + 0.5) / RES, (gy + 0.5) / RES, BOT_R + 0.15);
  function cellOf(x, y) { return [Math.max(0, Math.min(GW - 1, Math.floor(x * RES))), Math.max(0, Math.min(GH - 1, Math.floor(y * RES)))]; }
  function nearestFree(c) {
    if (free[c[1] * GW + c[0]]) return c;
    for (var rad = 1; rad < 8; rad++) for (var dy = -rad; dy <= rad; dy++) for (var dx = -rad; dx <= rad; dx++) {
      var x = c[0] + dx, y = c[1] + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH && free[y * GW + x]) return [x, y];
    }
    return c;
  }
  function astar(sx, sy, tx, ty) {
    var s = nearestFree(cellOf(sx, sy)), t = nearestFree(cellOf(tx, ty));
    var start = s[1] * GW + s[0], goal = t[1] * GW + t[0];
    var g = new Float32Array(GW * GH).fill(Infinity), came = new Int32Array(GW * GH).fill(-1), closed = new Uint8Array(GW * GH);
    var open = [start]; g[start] = 0;
    function h(i) { return Math.hypot(i % GW - t[0], Math.floor(i / GW) - t[1]); }
    while (open.length) {
      var bi = 0, bf = Infinity;
      for (var k = 0; k < open.length; k++) { var f = g[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k; } }
      var cur = open.splice(bi, 1)[0];
      if (cur === goal) {
        var path = [];
        while (cur !== -1) { path.unshift({ x: (cur % GW + 0.5) / RES, y: (Math.floor(cur / GW) + 0.5) / RES }); cur = came[cur]; }
        return path;
      }
      closed[cur] = 1;
      var cx = cur % GW, cy = Math.floor(cur / GW);
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        var ni = ny * GW + nx;
        if (!free[ni] || closed[ni]) continue;
        if (dx && dy && (!free[cy * GW + nx] || !free[ny * GW + cx])) continue;
        var ng = g[cur] + (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) { if (g[ni] === Infinity) open.push(ni); g[ni] = ng; came[ni] = cur; }
      }
    }
    return null;
  }

  function lineClear(a, b) {
    var n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.1);
    for (var i = 1; i <= n; i++) if (hits(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, BOT_R + 0.05)) return false;
    return true;
  }

  /* ---------- docking ---------- */
  function dock() { return DOCKS[dockIdx]; }
  function checkDock() {
    var d = dock();
    if (Math.hypot(bot.x - d.x, bot.y - d.y) > 0.5) return;
    docks++; hud(); dockFlash = 1;
    toast(docks === 1 ? "Docked! A new dock just lit up" : "Docked again! " + docks + " so far");
    R.log("[SIM] reached the charging dock", "vis");
    var next;
    do { next = Math.floor(Math.random() * DOCKS.length); } while (next === dockIdx);
    dockIdx = next;
    plan = null;
  }

  /* ---------- autopilot (demo only: the repo's Auto mode just locks the pad) ---------- */
  function autoTick() {
    if (R.mode !== "auto" || R.emergency) { plan = null; return; }
    var d = dock();
    plan = astar(bot.x, bot.y, d.x, d.y);
    if (!plan) return;
    if (autoBumped) { autoBumped = false; R.execute("backward"); return; }
    // aim at the farthest point on the path the bot can reach in a straight line
    var target = plan[Math.min(1, plan.length - 1)];
    for (var i = Math.min(plan.length - 1, 12); i >= 1; i--) if (lineClear(bot, plan[i])) { target = plan[i]; break; }
    if (lineClear(bot, d) && Math.hypot(d.x - bot.x, d.y - bot.y) < 3) target = d;
    var dist = Math.hypot(target.x - bot.x, target.y - bot.y);
    var diff = angDiff(Math.atan2(target.y - bot.y, target.x - bot.x), bot.h);
    var route = function (dir) {
      if (R.quirks && (dir === "left" || dir === "right")) dir = dir === "left" ? "right" : "left";
      R.execute(dir);
    };
    if (Math.abs(diff) > 0.3) {
      route(diff < 0 ? "left" : "right");
      // a full step turns about 0.78 rad, so cut small turns short to avoid see-sawing
      var need = Math.abs(diff) / TURN * 1000;
      if (need < R.STEP_DURATION - 20) setTimeout(function () { if (R.mode === "auto") R.execute("stop"); }, need);
    } else {
      route("forward");
      var stopAt = dist / SPEED * 1000;
      if (target === d && stopAt < R.STEP_DURATION - 20) setTimeout(function () { if (R.mode === "auto") R.execute("stop"); }, stopAt);
    }
  }

  /* ---------- drawing ---------- */
  var W = 0, H = 0, T = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = W * ROWS / COLS;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    T = W / COLS;
  }
  window.addEventListener("resize", resize);

  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function box(x, y, w, h, r, fill) {
    ctx.fillStyle = "rgba(0,0,0,.22)"; rr(x + T * 0.07, y + T * 0.07, w, h, r); ctx.fill();
    ctx.fillStyle = fill; rr(x, y, w, h, r); ctx.fill(); ctx.stroke();
  }

  function drawFloor() {
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? colors["floor-b"] : colors["floor-a"];
      ctx.fillRect(x * T, y * T, T, T);
    }
    ctx.strokeStyle = colors.grout; ctx.lineWidth = Math.max(1, T * 0.03);
    for (var i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * T, 0); ctx.lineTo(i * T, H); ctx.stroke(); }
    for (var j = 1; j < ROWS; j++) { ctx.beginPath(); ctx.moveTo(0, j * T); ctx.lineTo(W, j * T); ctx.stroke(); }
    // rug
    ctx.fillStyle = colors.dark ? "rgba(165,123,255,.28)" : "rgba(123,63,228,.16)";
    rr(RUG.x * T, RUG.y * T, RUG.w * T, RUG.h * T, T * 0.2); ctx.fill();
    ctx.setLineDash([T * 0.1, T * 0.08]); ctx.strokeStyle = colors.plum; ctx.lineWidth = T * 0.04;
    rr((RUG.x + 0.15) * T, (RUG.y + 0.15) * T, (RUG.w - 0.3) * T, (RUG.h - 0.3) * T, T * 0.12); ctx.stroke(); ctx.setLineDash([]);
    // wheel marks
    if (trail.length > 1) {
      ctx.strokeStyle = colors.dark ? "rgba(255,255,255,.07)" : "rgba(27,22,56,.08)";
      ctx.lineWidth = T * 0.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(trail[0].x * T, trail[0].y * T);
      for (var k = 1; k < trail.length; k++) ctx.lineTo(trail[k].x * T, trail[k].y * T);
      ctx.stroke();
    }
    // walls
    ctx.fillStyle = colors.wall;
    ctx.fillRect(0, 0, W, WALL * T); ctx.fillRect(0, H - WALL * T, W, WALL * T);
    ctx.fillRect(0, 0, WALL * T, H); ctx.fillRect(W - WALL * T, 0, WALL * T, H);
  }

  function drawThing(o) {
    var x = o.x * T, y = o.y * T, w = o.w * T, h = o.h * T;
    ctx.lineWidth = Math.max(2, T * 0.045); ctx.strokeStyle = colors.line;
    if (o.t === "table" || o.t === "desk" || o.t === "coffee") {
      box(x, y, w, h, T * 0.1, colors.wood);
      ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1.5;
      for (var p = 1; p < 4; p++) { ctx.beginPath(); ctx.moveTo(x + T * 0.12, y + h * p / 4); ctx.lineTo(x + w - T * 0.12, y + h * p / 4); ctx.stroke(); }
      ctx.strokeStyle = colors.line; ctx.lineWidth = Math.max(2, T * 0.045);
      if (o.t === "desk") { ctx.fillStyle = "#2a2546"; rr(x + w * 0.35, y + h * 0.2, w * 0.3, h * 0.45, T * 0.04); ctx.fill(); ctx.stroke(); ctx.fillStyle = colors.sky; ctx.fillRect(x + w * 0.38, y + h * 0.26, w * 0.24, h * 0.3); }
      if (o.t === "table") { ctx.fillStyle = colors.leaf; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, T * 0.2, 0, 7); ctx.fill(); ctx.stroke(); }
      if (o.t === "coffee") { ctx.fillStyle = colors.paper; ctx.beginPath(); ctx.arc(x + w * 0.3, y + h * 0.5, T * 0.13, 0, 7); ctx.fill(); ctx.stroke(); }
    } else if (o.t === "chair") {
      box(x, y, w, h, T * 0.12, colors.sky);
      ctx.fillStyle = colors.dark ? "#3c63c9" : "#2d5fd6";
      var bt = T * 0.16;
      if (o.back === "top") rr(x, y, w, bt, T * 0.06);
      else if (o.back === "bottom") rr(x, y + h - bt, w, bt, T * 0.06);
      ctx.fill(); ctx.stroke();
    } else if (o.t === "sofa" || o.t === "arm") {
      box(x, y, w, h, T * 0.16, colors.plum);
      ctx.fillStyle = colors.dark ? "#8a5fe0" : "#9767f0";
      var b2 = T * 0.25;
      if (o.back === "left") rr(x, y, b2, h, T * 0.1);
      else if (o.back === "right") rr(x + w - b2, y, b2, h, T * 0.1);
      else rr(x, y, w, b2, T * 0.1);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5;
      if (o.t === "sofa") for (var c = 1; c < 3; c++) { ctx.beginPath(); ctx.moveTo(x + T * 0.3, y + h * c / 3); ctx.lineTo(x + w - T * 0.3, y + h * c / 3); ctx.stroke(); }
    } else if (o.t === "shelf") {
      box(x, y, w, h, T * 0.06, colors.wood);
      var books = [colors.tomato, colors.sun, colors.leaf, colors.sky, colors.plum];
      for (var bk = 0; bk < 9; bk++) { ctx.fillStyle = books[bk % 5]; ctx.fillRect(x + w * 0.18, y + T * 0.12 + bk * (h - T * 0.24) / 9, w * 0.64, (h - T * 0.24) / 9 - 2); }
    } else if (o.t === "box") {
      box(x, y, w, h, T * 0.05, "#c9955c");
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = T * 0.1;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2, y + h - 2); ctx.stroke();
    } else if (o.t === "side" || o.t === "lamp") {
      ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.arc(x + w / 2 + T * 0.07, y + h / 2 + T * 0.07, w / 2, 0, 7); ctx.fill();
      ctx.fillStyle = o.t === "lamp" ? colors.sun : colors.wood;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2, 0, 7); ctx.fill(); ctx.stroke();
      if (o.t === "lamp") { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.15, 0, 7); ctx.fill(); }
    }
    if (o.hit > 0) {
      ctx.globalAlpha = o.hit; ctx.strokeStyle = colors.danger; ctx.lineWidth = T * 0.08;
      rr(x - T * 0.06, y - T * 0.06, w + T * 0.12, h + T * 0.12, T * 0.15); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function drawDock(t) {
    var d = dock(), x = d.x * T, y = d.y * T, s = T * 0.8;
    var pulse = (t * 0.9) % 1;
    ctx.strokeStyle = colors.leaf; ctx.lineWidth = T * 0.06; ctx.globalAlpha = 1 - pulse;
    ctx.beginPath(); ctx.arc(x, y, s * (0.6 + pulse * 0.6), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2, T * 0.045); ctx.strokeStyle = colors.line;
    ctx.fillStyle = colors.leaf; rr(x - s / 2, y - s / 2, s, s, T * 0.16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.sun;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.06, y - s * 0.34); ctx.lineTo(x - s * 0.18, y + s * 0.04); ctx.lineTo(x - s * 0.01, y + s * 0.04);
    ctx.lineTo(x - s * 0.08, y + s * 0.34); ctx.lineTo(x + s * 0.2, y - s * 0.06); ctx.lineTo(x + s * 0.02, y - s * 0.06); ctx.closePath();
    ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    if (dockFlash > 0) {
      ctx.globalAlpha = dockFlash; ctx.strokeStyle = colors.sun; ctx.lineWidth = T * 0.07;
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2, r1 = s * (0.7 + (1 - dockFlash)), r2 = r1 + T * 0.25;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPlan() {
    if (!plan || R.mode !== "auto") return;
    ctx.fillStyle = colors.plum;
    for (var i = 2; i < plan.length; i += 3) { ctx.beginPath(); ctx.arc(plan[i].x * T, plan[i].y * T, T * 0.05, 0, 7); ctx.fill(); }
  }

  function star(x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function drawBot(t) {
    ctx.save();
    var shake = bumpFlash > 0 ? (Math.random() - 0.5) * T * 0.08 * bumpFlash : 0;
    ctx.translate(bot.x * T + shake, bot.y * T + shake); ctx.rotate(bot.h);
    var L = T * 1.15, Wd = T * 0.88, lw = Math.max(2, T * 0.05);
    ctx.lineWidth = lw; ctx.strokeStyle = colors.line;
    var spinL = R.motors.left, spinR = R.motors.right;
    [[-L * 0.3, -Wd / 2 - T * 0.08, spinL], [L * 0.3, -Wd / 2 - T * 0.08, spinL], [-L * 0.3, Wd / 2 + T * 0.08, spinR], [L * 0.3, Wd / 2 + T * 0.08, spinR]].forEach(function (w) {
      ctx.fillStyle = "#2a2540";
      rr(w[0] - T * 0.17, w[1] - T * 0.08, T * 0.34, T * 0.16, T * 0.05); ctx.fill(); ctx.stroke();
      if (w[2]) {
        ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5;
        var off = ((t * 8 * w[2]) % 1) * T * 0.11;
        for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(w[0] + i * T * 0.11 + off - T * 0.05, w[1] - T * 0.06); ctx.lineTo(w[0] + i * T * 0.11 + off - T * 0.05, w[1] + T * 0.06); ctx.stroke(); }
        ctx.strokeStyle = colors.line; ctx.lineWidth = lw;
      }
    });
    ctx.fillStyle = "rgba(0,0,0,.22)"; rr(-L / 2 + T * 0.06, -Wd / 2 + T * 0.06, L, Wd, T * 0.16); ctx.fill();
    ctx.fillStyle = R.emergency || bumpFlash > 0.5 ? colors.danger : colors.sun;
    rr(-L / 2, -Wd / 2, L, Wd, T * 0.16); ctx.fill(); ctx.stroke();
    // the Pi on its back
    ctx.fillStyle = colors.leaf; rr(-L * 0.4, -Wd * 0.3, L * 0.34, Wd * 0.6, T * 0.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1b1638"; ctx.fillRect(-L * 0.3, -Wd * 0.12, L * 0.12, Wd * 0.24);
    // face
    var blink = (Math.sin(t * 1.3) > 0.985) ? 0.2 : 1;
    var squint = bumpFlash > 0.3;
    [-1, 1].forEach(function (s) {
      ctx.fillStyle = "#1b1638";
      if (squint) {
        ctx.lineWidth = T * 0.05; ctx.strokeStyle = "#1b1638";
        ctx.beginPath(); ctx.moveTo(L * 0.16, s * Wd * 0.2 - T * 0.07); ctx.lineTo(L * 0.28, s * Wd * 0.2); ctx.lineTo(L * 0.16, s * Wd * 0.2 + T * 0.07); ctx.stroke();
        ctx.lineWidth = lw; ctx.strokeStyle = colors.line;
      } else {
        ctx.beginPath(); ctx.ellipse(L * 0.22, s * Wd * 0.2, T * 0.09, T * 0.09 * blink, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(L * 0.25, s * Wd * 0.2 - T * 0.03, T * 0.03 * blink, 0, 7); ctx.fill();
      }
    });
    // camera
    ctx.fillStyle = colors.plum; rr(L * 0.43, -T * 0.1, T * 0.16, T * 0.2, T * 0.05); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (bumpFlash > 0) {
      ctx.fillStyle = colors.sun; ctx.strokeStyle = colors.line; ctx.lineWidth = 1.5;
      for (var k = 0; k < 3; k++) {
        var a = t * 5 + k * 2.1;
        star(bot.x * T + Math.cos(a) * T * 0.75, bot.y * T - T * 0.5 + Math.sin(a) * T * 0.2, T * 0.13);
      }
    }
  }

  /* ---------- loop ---------- */
  var visible = true, last = performance.now(), trailT = 0, autoAcc = 0;
  function step(dt) {
    var l = R.motors.left, r = R.motors.right;
    var v = (l + r) / 2 * SPEED, w = (r - l) / 2 * TURN;
    bot.h -= w * dt;
    if (v) {
      var nx = bot.x + Math.cos(bot.h) * v * dt, ny = bot.y + Math.sin(bot.h) * v * dt;
      var hit = hits(nx, ny, BOT_R);
      if (hit) {
        if (bumpCool <= 0) {
          bumps++; hud(); bumpCool = 0.6; bumpFlash = 1; hit.hit = 1; autoBumped = R.mode === "auto";
          toast(hit.name === "wall" ? "Bonk! That's the wall" : "Bonk! You hit the " + hit.name);
          R.log("[SIM] bumped the " + hit.name, "warn");
          sim.classList.remove("is-bump"); void sim.offsetWidth; sim.classList.add("is-bump");
        }
      } else {
        bot.x = nx; bot.y = ny;
        trailT += dt;
        if (trailT > 0.05) { trailT = 0; trail.push({ x: bot.x, y: bot.y }); if (trail.length > 160) trail.shift(); }
      }
    }
    bumpCool -= dt; bumpFlash = Math.max(0, bumpFlash - dt * 2.2); dockFlash = Math.max(0, dockFlash - dt * 0.9);
    THINGS.forEach(function (o) { if (o.hit) o.hit = Math.max(0, o.hit - dt * 1.5); });
    checkDock();
    autoAcc += dt;
    if (autoAcc > 0.33) { autoAcc = 0; autoTick(); }
  }
  function frame(nowT) {
    var dt = Math.min(0.05, (nowT - last) / 1000); last = nowT;
    if (W !== canvas.clientWidth) resize();
    step(dt);
    if (visible) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var t = nowT / 1000;
      drawFloor();
      drawDock(t);
      drawPlan();
      THINGS.forEach(drawThing);
      drawBot(t);
    }
    requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);

  hud(); resize(); motorHud();
  requestAnimationFrame(frame);

  window.Field = {
    toast: toast, bot: bot, things: THINGS, docks: DOCKS, hits: hits, astar: astar, BOT_R: BOT_R,
    stats: function () { return { docks: docks, bumps: bumps, dock: dock() }; }
  };
})();
