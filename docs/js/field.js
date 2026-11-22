/* Top-down crop field. Differential drive from Rover.motors, scanning and spraying. */
(function () {
  var R = window.Rover;
  var canvas = document.getElementById("field");
  var ctx = canvas.getContext("2d");
  var COLS = 16, ROWS = 10;
  var SPEED = 1.7;      // tiles per second at full forward
  var TURN = 2.6;       // rad per second when spinning in place (0.3 s step is about 45 degrees)

  var CLASSES = ["Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy", "Blueberry___healthy", "Cherry_(including_sour)___Powdery_mildew", "Cherry_(including_sour)___healthy", "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Corn_(maize)___Common_rust_", "Corn_(maize)___Northern_Leaf_Blight", "Corn_(maize)___healthy", "Grape___Black_rot", "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Grape___healthy", "Orange___Haunglongbing_(Citrus_greening)", "Peach___Bacterial_spot", "Peach___healthy", "Pepper,_bell___Bacterial_spot", "Pepper,_bell___healthy", "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy", "Raspberry___healthy", "Soybean___healthy", "Squash___Powdery_mildew", "Strawberry___Leaf_scorch", "Strawberry___healthy", "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___Late_blight", "Tomato___Leaf_Mold", "Tomato___Septoria_leaf_spot", "Tomato___Spider_mites Two-spotted_spider_mite", "Tomato___Target_Spot", "Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato___Tomato_mosaic_virus", "Tomato___healthy"];
  function kindOf(label) {
    if (/healthy/.test(label)) return "healthy";
    if (/blight/i.test(label)) return "blight";
    if (/Mold|mildew/.test(label)) return "mold";
    return "other";
  }
  function pretty(label) {
    var parts = label.split("___");
    var crop = parts[0].replace(/_/g, " ").replace(/\s*\(.*\)/, "").replace(/,/g, "");
    var cond = (parts[1] || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return { crop: crop, cond: cond.charAt(0).toUpperCase() + cond.slice(1) };
  }
  var byKind = { healthy: [], blight: [], mold: [] };
  CLASSES.forEach(function (c) {
    var k = kindOf(c);
    // only seed sick crops that also have a healthy class, so a cured plant keeps its crop
    if (k !== "healthy" && CLASSES.indexOf(c.split("___")[0] + "___healthy") < 0) return;
    if (byKind[k]) byKind[k].push(c);
  });

  var colors = {};
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ["soil", "soil-dark", "furrow", "leaf", "blight", "mold", "sun", "tomato", "sky", "ink", "line", "paper", "plum", "danger"].forEach(function (k) {
      colors[k] = cs.getPropertyValue("--" + k).trim();
    });
    colors.dark = document.documentElement.getAttribute("data-theme") === "dark";
  }
  readColors();
  document.addEventListener("themechange", function () { readColors(); });

  var rover = { x: 1.2, y: 5, h: 0 };
  var plants = [];
  var particles = [];
  var trail = [];
  var scanFx = null;
  var cured = 0;
  var reseedTimer = null;

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function seed() {
    plants = [];
    var rowsY = [1.5, 3.7, 6.3, 8.5];
    rowsY.forEach(function (y) {
      for (var i = 0; i < 8; i++) {
        var x = 2.6 + i * 1.7 + (Math.random() - 0.5) * 0.25;
        plants.push({ x: x, y: y + (Math.random() - 0.5) * 0.2, kind: "healthy", label: pick(byKind.healthy), heal: 0, wrong: 0, scanned: false, cured: 0, conf: 0.8 + Math.random() * 0.19, wob: Math.random() * 6 });
      }
    });
    var sick = 9;
    var idx = plants.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; }).slice(0, sick);
    idx.forEach(function (i, n) {
      var k = n % 3 === 2 ? "mold" : "blight";
      plants[i].kind = k;
      plants[i].label = pick(byKind[k]);
    });
    cured = 0;
    hud();
  }

  function sickLeft() { return plants.filter(function (p) { return p.kind !== "healthy"; }).length; }
  var hudCured = document.getElementById("hud-cured");
  var hudMotor = document.getElementById("hud-motor");
  var hudStep = document.getElementById("hud-step");
  function hud() {
    hudCured.innerHTML = "Cured <b>" + cured + "</b>/" + (cured + sickLeft());
  }
  function motorHud() {
    function f(v) { return v > 0 ? "+1" : v < 0 ? "-1" : "0"; }
    hudMotor.textContent = "L " + f(R.motors.left) + "  R " + f(R.motors.right) + (R.pump ? "  pump ON" : "");
  }
  R.on("state", motorHud);
  R.on("step", function (s) { hudStep.textContent = "step #" + s.id; });

  /* ---------- toast ---------- */
  var toastEl = document.getElementById("toast"), toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  /* ---------- geometry ---------- */
  function front(d) { return { x: rover.x + Math.cos(rover.h) * d, y: rover.y + Math.sin(rover.h) * d }; }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  /* ---------- scan ---------- */
  var scanCard = document.getElementById("scan-card"), scanT;
  function nearestToCamera(maxD) {
    var cam = front(0.75), best = null, bd = maxD;
    plants.forEach(function (p) {
      var d = Math.hypot(p.x - cam.x, p.y - cam.y);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }
  function scan() {
    var p = nearestToCamera(1.35);
    clearTimeout(scanT);
    if (!p) {
      scanCard.innerHTML = "<strong>No leaf in view.</strong> Point the camera at a plant.";
    } else {
      p.scanned = true;
      var nm = pretty(p.label);
      var tank = p.kind === "blight" ? "Spray 1 (Blight tank)" : p.kind === "mold" ? "Spray 2 (Mold tank)" : "Nothing to spray";
      var pct = (p.conf * 100).toFixed(1);
      scanCard.innerHTML = "<strong>" + nm.crop + ": " + nm.cond + "</strong><div class='bar'><i style='width:" + pct + "%'></i></div>" +
        "<span class='lbl'>" + p.label + " " + pct + "%</span><br>" + tank;
      scanFx = { p: p, t: 0 };
      R.log("[VISION] " + p.label + " (" + pct + "%)", "vis");
    }
    scanCard.classList.add("show");
    scanT = setTimeout(function () { scanCard.classList.remove("show"); }, 3800);
    return p;
  }

  /* ---------- spray ---------- */
  function sprayTick(dt) {
    if (!R.pump || !(R.blur || R.mold)) return;
    var tank = R.blur ? "blight" : "mold";
    var noz = front(0.55);
    var n = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 4;
    for (var i = 0; i < n; i++) {
      var a = rover.h + (Math.random() - 0.5) * 0.9;
      var s = 2.4 + Math.random() * 1.6;
      particles.push({ x: noz.x, y: noz.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45 + Math.random() * 0.2, c: tank === "blight" ? colors.tomato : colors.sky });
    }
    plants.forEach(function (p) {
      if (p.kind === "healthy") return;
      var d = Math.hypot(p.x - noz.x, p.y - noz.y);
      var ang = Math.abs(angDiff(Math.atan2(p.y - noz.y, p.x - noz.x), rover.h));
      if (d > 1.5 || ang > 0.6) return;
      if (p.kind === tank) {
        p.heal += dt;
        if (p.heal >= 0.8) {
          var nm = pretty(p.label);
          p.kind = "healthy"; p.cured = 1; p.label = p.label.split("___")[0] + "___healthy";
          cured++; hud();
          toast("Cured " + nm.crop.toLowerCase() + " " + nm.cond.toLowerCase() + "!");
          R.log("[FIELD] plant cured", "vis");
          if (!sickLeft()) {
            toast("Field clean! New outbreak in 4 seconds");
            clearTimeout(reseedTimer);
            reseedTimer = setTimeout(seed, 4000);
          }
        }
      } else {
        p.wrong += dt;
        if (p.wrong > 0.5 && !p.warned) {
          p.warned = true;
          toast("Wrong tank! That one needs " + (p.kind === "blight" ? "Spray 1" : "Spray 2"));
        }
      }
    });
  }

  /* ---------- autopilot (demo only: the repo's Auto mode just locks the pad) ---------- */
  var autoT = 0, autoSpray = null;
  function autoTick() {
    if (R.mode !== "auto" || R.emergency) return;
    var targets = plants.filter(function (p) { return p.kind !== "healthy"; });
    if (!targets.length) { if (autoSpray) { R.spray("stop"); autoSpray = null; } return; }
    targets.sort(function (a, b) { return Math.hypot(a.x - rover.x, a.y - rover.y) - Math.hypot(b.x - rover.x, b.y - rover.y); });
    var t = targets[0];
    var dist = Math.hypot(t.x - rover.x, t.y - rover.y);
    var diff = angDiff(Math.atan2(t.y - rover.y, t.x - rover.x), rover.h);
    var route = function (dir) {
      if (R.quirks && (dir === "left" || dir === "right")) dir = dir === "left" ? "right" : "left";
      R.execute(dir);
    };
    if (dist < 1.25 && Math.abs(diff) < 0.4) {
      if (!t.scanned) { scan(); return; }
      var want = t.kind === "blight" ? 1 : 2;
      if (autoSpray !== want) { if (autoSpray) R.spray("stop"); R.spray(want); autoSpray = want; }
      return;
    }
    if (autoSpray) { R.spray("stop"); autoSpray = null; }
    if (Math.abs(diff) > 0.3) route(diff < 0 ? "left" : "right");
    else route(dist < 0.9 ? "backward" : "forward");
  }
  R.on("mode", function (m) { if (m !== "auto") autoSpray = null; });

  /* ---------- drawing ---------- */
  var W = 0, H = 0, T = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth;
    W = w; H = w * ROWS / COLS;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    T = W / COLS;
  }
  window.addEventListener("resize", resize);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawGround() {
    ctx.fillStyle = colors.soil; ctx.fillRect(0, 0, W, H);
    [1.5, 3.7, 6.3, 8.5].forEach(function (y) {
      ctx.fillStyle = colors.furrow;
      rr(0.9 * T, (y - 0.55) * T, 14.3 * T, 1.1 * T, 0.55 * T); ctx.fill();
    });
    ctx.fillStyle = colors["soil-dark"];
    for (var i = 0; i < 70; i++) {
      var x = ((i * 137.5) % COLS) * T, y = ((i * 71.3) % ROWS) * T;
      ctx.beginPath(); ctx.arc(x, y, T * 0.04, 0, 7); ctx.fill();
    }
    if (trail.length > 1) {
      ctx.strokeStyle = colors.dark ? "rgba(0,0,0,.35)" : "rgba(80,45,20,.22)";
      ctx.lineWidth = T * 0.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(trail[0].x * T, trail[0].y * T);
      for (var j = 1; j < trail.length; j++) ctx.lineTo(trail[j].x * T, trail[j].y * T);
      ctx.stroke();
    }
  }

  function drawPlant(p, t) {
    var x = p.x * T, y = p.y * T, r = T * 0.3;
    var sway = Math.sin(t * 1.5 + p.wob) * 0.06;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
    var base = colors.leaf;
    if (p.kind === "blight") base = colors.dark ? "#a2a83a" : "#9a9a2a";
    if (p.kind === "mold") base = colors.dark ? "#6e9b7a" : "#7fa088";
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.62, r * 0.4, a, 0, 7);
      ctx.fillStyle = base; ctx.fill();
      ctx.lineWidth = Math.max(1.5, T * 0.035); ctx.strokeStyle = colors.line; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, 7); ctx.fillStyle = colors.dark ? "#2a7a46" : "#1c7a3e"; ctx.fill(); ctx.stroke();
    if (p.kind === "blight") {
      ctx.fillStyle = colors.blight;
      [[-.5, -.3], [.45, .2], [.1, .6], [-.3, .45], [.55, -.45]].forEach(function (s) { ctx.beginPath(); ctx.arc(s[0] * r, s[1] * r, r * 0.17, 0, 7); ctx.fill(); });
    } else if (p.kind === "mold") {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (var k = 0; k < 9; k++) { var aa = k * 2.4, rad = r * (0.3 + (k % 3) * 0.25); ctx.beginPath(); ctx.arc(Math.cos(aa) * rad, Math.sin(aa) * rad, r * 0.11, 0, 7); ctx.fill(); }
    }
    ctx.restore();
    if (p.heal > 0 && p.kind !== "healthy") {
      ctx.beginPath(); ctx.arc(x, y, r * 1.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.heal / 0.8));
      ctx.strokeStyle = colors.sun; ctx.lineWidth = T * 0.09; ctx.stroke();
    }
    if (p.cured > 0) {
      ctx.globalAlpha = p.cured;
      ctx.strokeStyle = colors.sun; ctx.lineWidth = T * 0.06;
      for (var s = 0; s < 6; s++) {
        var a2 = s / 6 * Math.PI * 2, r1 = r * (1.4 + (1 - p.cured)), r2 = r1 + T * 0.2;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a2) * r1, y + Math.sin(a2) * r1); ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (p.scanned) {
      var tag = p.kind === "healthy" ? "OK" : p.kind === "blight" ? "BLIGHT" : "MOLD";
      ctx.font = "700 " + Math.max(9, T * 0.2) + "px 'Martian Mono', monospace";
      var tw = ctx.measureText(tag).width + T * 0.2;
      ctx.fillStyle = p.kind === "healthy" ? colors.leaf : p.kind === "blight" ? colors.tomato : colors.sky;
      rr(x - tw / 2, y - r * 2.15, tw, T * 0.3, T * 0.08); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = colors.line; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(tag, x, y - r * 2.15 + T * 0.155);
    }
  }

  function drawRover(t) {
    ctx.save();
    ctx.translate(rover.x * T, rover.y * T); ctx.rotate(rover.h);
    var L = T * 1.15, Wd = T * 0.88, lw = Math.max(2, T * 0.05);
    ctx.lineWidth = lw; ctx.strokeStyle = colors.line;
    // wheels
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
    // shadow + body
    ctx.fillStyle = "rgba(0,0,0,.22)"; rr(-L / 2 + T * 0.06, -Wd / 2 + T * 0.06, L, Wd, T * 0.16); ctx.fill();
    ctx.fillStyle = R.emergency ? colors.danger : colors.sun;
    rr(-L / 2, -Wd / 2, L, Wd, T * 0.16); ctx.fill(); ctx.stroke();
    // tanks
    ctx.fillStyle = colors.tomato; rr(-L * 0.38, -Wd * 0.36, L * 0.3, Wd * 0.3, T * 0.06); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.sky; rr(-L * 0.38, Wd * 0.06, L * 0.3, Wd * 0.3, T * 0.06); ctx.fill(); ctx.stroke();
    // face
    ctx.fillStyle = "#1b1638";
    var blink = (Math.sin(t * 1.3) > 0.985) ? 0.2 : 1;
    [-1, 1].forEach(function (s) {
      ctx.beginPath(); ctx.ellipse(L * 0.22, s * Wd * 0.2, T * 0.09, T * 0.09 * blink, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(L * 0.25, s * Wd * 0.2 - T * 0.03, T * 0.03 * blink, 0, 7); ctx.fill(); ctx.fillStyle = "#1b1638";
    });
    // camera + nozzle
    ctx.fillStyle = colors.plum; rr(L * 0.43, -T * 0.1, T * 0.16, T * 0.2, T * 0.05); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      ctx.globalAlpha = Math.min(1, p.life * 2.2);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x * T, p.y * T, T * 0.06, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawScan(dt) {
    if (!scanFx) return;
    scanFx.t += dt;
    if (scanFx.t > 1) { scanFx = null; return; }
    var p = scanFx.p, k = scanFx.t;
    ctx.save();
    ctx.strokeStyle = colors.plum; ctx.lineWidth = T * 0.06; ctx.setLineDash([T * 0.12, T * 0.08]);
    ctx.globalAlpha = 1 - k;
    ctx.beginPath(); ctx.arc(p.x * T, p.y * T, T * (0.55 + k * 0.5), 0, 7); ctx.stroke();
    var c = front(0.75);
    ctx.setLineDash([]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x * T, c.y * T); ctx.lineTo(p.x * T, p.y * T); ctx.stroke();
    ctx.restore();
  }

  var visible = true, last = performance.now(), trailT = 0, autoAcc = 0;
  function frame(nowT) {
    var dt = Math.min(0.05, (nowT - last) / 1000); last = nowT;
    if (W !== canvas.clientWidth) resize();
    // physics
    var l = R.motors.left, r = R.motors.right;
    var v = (l + r) / 2 * SPEED, w = (r - l) / 2 * TURN;
    rover.h -= w * dt;
    rover.x = Math.max(0.6, Math.min(COLS - 0.6, rover.x + Math.cos(rover.h) * v * dt));
    rover.y = Math.max(0.6, Math.min(ROWS - 0.6, rover.y + Math.sin(rover.h) * v * dt));
    if (v) { trailT += dt; if (trailT > 0.05) { trailT = 0; trail.push({ x: rover.x, y: rover.y }); if (trail.length > 160) trail.shift(); } }
    sprayTick(dt);
    plants.forEach(function (p) { if (p.cured > 0) p.cured = Math.max(0, p.cured - dt * 0.8); });
    autoAcc += dt;
    if (autoAcc > 0.33) { autoAcc = 0; autoTick(); }

    if (visible) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var t = nowT / 1000;
      drawGround();
      plants.forEach(function (p) { drawPlant(p, t); });
      drawScan(dt);
      drawParticles(dt);
      drawRover(t);
    }
    requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
  }

  seed(); resize(); motorHud();
  requestAnimationFrame(frame);

  window.Field = { scan: scan, toast: toast, plants: function () { return plants; }, rover: rover, reseed: seed, CLASSES: CLASSES, kindOf: kindOf, pretty: pretty };
})();
