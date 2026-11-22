/* The control panel: same behaviour as static/script.js, plus keyboard hold-to-repeat. */
(function () {
  var R = window.Rover, F = window.Field;
  var sim = document.getElementById("sim");
  var logEl = document.getElementById("log");
  var statusText = document.getElementById("status-text");
  var REPEAT = 250; // ms between repeat steps while held, shorter than the 0.3 s step so motion is continuous

  /* ---------- log ---------- */
  function addLine(l) {
    var d = document.createElement("div");
    d.textContent = l.text;
    if (l.cls) d.className = l.cls;
    logEl.appendChild(d);
    while (logEl.children.length > 50) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }
  R.logs.forEach(addLine);
  R.on("log", addLine);

  /* ---------- status ---------- */
  var dirBtns = [].slice.call(document.querySelectorAll(".pad-grid .btn"));
  function paint() {
    sim.classList.toggle("is-estop", R.emergency);
    statusText.textContent = R.emergency ? "System emergency" : "System armed";
    var dir = R.motors.left === 1 && R.motors.right === 1 ? "forward"
      : R.motors.left === -1 && R.motors.right === -1 ? "backward"
      : R.motors.left === -1 && R.motors.right === 1 ? "left"
      : R.motors.left === 1 && R.motors.right === -1 ? "right" : null;
    dirBtns.forEach(function (b) { b.classList.toggle("is-active", b.dataset.dir === dir); });
    document.querySelectorAll(".spray-btn").forEach(function (b) {
      b.classList.toggle("is-active", (b.dataset.spray === "1" && R.blur) || (b.dataset.spray === "2" && R.mold));
    });
  }
  R.on("state", paint);

  /* ---------- hold-to-repeat movement ---------- */
  var holds = {};
  function startHold(key, dir) {
    if (holds[key] || R.mode === "auto") return;
    R.execute(dir);
    if (dir === "stop") return;
    holds[key] = setInterval(function () { R.execute(dir); }, REPEAT);
  }
  function endHold(key) { clearInterval(holds[key]); delete holds[key]; }
  function endAll() { Object.keys(holds).forEach(endHold); }

  dirBtns.forEach(function (b) {
    var key = "btn-" + b.dataset.dir;
    b.addEventListener("pointerdown", function (e) { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); startHold(key, b.dataset.dir); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (ev) { b.addEventListener(ev, function () { endHold(key); }); });
    b.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); e.stopPropagation(); R.mode !== "auto" && R.execute(b.dataset.dir); } });
  });

  /* ---------- spray: press sends {id}, release sends {id: "stop"} ---------- */
  var activeSpray = {};
  function sprayDown(id) { if (activeSpray[id]) return; activeSpray[id] = true; R.spray(id); }
  function sprayUp(id) { if (!activeSpray[id]) return; delete activeSpray[id]; R.spray("stop"); }
  document.querySelectorAll(".spray-btn").forEach(function (b) {
    var id = Number(b.dataset.spray);
    b.addEventListener("pointerdown", function (e) { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); sprayDown(id); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (ev) { b.addEventListener(ev, function () { sprayUp(id); }); });
    b.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); e.stopPropagation(); sprayDown(id); } });
    b.addEventListener("keyup", function (e) { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); sprayUp(id); } });
  });

  document.getElementById("btn-scan").addEventListener("click", function () { F.scan(); });
  document.getElementById("btn-estop").addEventListener("click", function () { endAll(); R.execute("stop"); R.ctrl.emergency(); });
  document.getElementById("btn-reset").addEventListener("click", function () { R.ctrl.clear_emergency(); });
  document.getElementById("quirks").addEventListener("change", function (e) {
    R.quirks = e.target.checked;
    R.log(R.quirks ? "[SIM] replaying server.py quirks" : "[SIM] quirks off", "api");
  });

  /* ---------- mode ---------- */
  var mBtn = document.getElementById("mode-manual"), aBtn = document.getElementById("mode-auto");
  function setMode(m) {
    endAll();
    R.setMode(m);
    mBtn.setAttribute("aria-pressed", m === "manual");
    aBtn.setAttribute("aria-pressed", m === "auto");
    dirBtns.forEach(function (b) { b.disabled = m === "auto"; });
    if (m === "auto") F.toast("Autopilot demo: it hunts sick plants on its own");
  }
  mBtn.addEventListener("click", function () { setMode("manual"); });
  aBtn.addEventListener("click", function () { setMode("auto"); });

  /* ---------- keyboard ---------- */
  var simVisible = true;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { simVisible = es[0].isIntersecting; }).observe(sim);
  var KEYS = { w: "forward", arrowup: "forward", s: "backward", arrowdown: "backward", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
  function typing(e) { var t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable); }
  document.addEventListener("keydown", function (e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    var isArrow = k.indexOf("arrow") === 0;
    if (KEYS[k]) {
      if (isArrow && !simVisible) return;
      e.preventDefault();
      if (!e.repeat) startHold("key-" + k, KEYS[k]);
    } else if (k === "1" || k === "2") { if (!e.repeat) sprayDown(Number(k)); }
    else if (k === "q") { if (!e.repeat) F.scan(); }
    else if (k === "x") { if (R.mode !== "auto") R.execute("stop"); }
    else if (k === "escape") { endAll(); R.execute("stop"); R.ctrl.emergency(); }
    else if (k === "r") { R.ctrl.clear_emergency(); }
  });
  document.addEventListener("keyup", function (e) {
    var k = e.key.toLowerCase();
    if (KEYS[k]) endHold("key-" + k);
    if (k === "1" || k === "2") sprayUp(Number(k));
  });
  window.addEventListener("blur", function () { endAll(); Object.keys(activeSpray).forEach(function (id) { sprayUp(Number(id)); }); });

  paint();
})();
