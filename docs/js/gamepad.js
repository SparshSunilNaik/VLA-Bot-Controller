/* ps5_controller.py, played through the browser Gamepad API. */
(function () {
  var R = window.Rover, F = window.Field;
  var svg = document.getElementById("ps-svg");
  svg.innerHTML =
    "<g stroke='var(--line)' stroke-width='4' stroke-linejoin='round'>" +
    "<rect id='g-l2' x='104' y='16' width='72' height='26' rx='10' fill='#cfcbe3'/>" +
    "<rect x='344' y='16' width='72' height='26' rx='10' fill='#cfcbe3'/>" +
    "<rect id='g-l1' x='98' y='46' width='82' height='22' rx='9' fill='#cfcbe3'/>" +
    "<rect x='340' y='46' width='82' height='22' rx='9' fill='#cfcbe3'/>" +
    "<path d='M120 72 Q260 44 400 72 Q470 84 490 170 Q505 250 450 264 Q410 272 380 222 L140 222 Q110 272 70 264 Q15 250 30 170 Q50 84 120 72Z' fill='#f4f2fb'/>" +
    "<rect x='205' y='80' width='110' height='66' rx='12' fill='#1b1638'/>" +
    "<g fill='#d9d6ea'><rect x='118' y='122' width='22' height='60' rx='5'/><rect x='99' y='141' width='60' height='22' rx='5'/>" +
    "<circle cx='396' cy='120' r='12'/><circle cx='396' cy='172' r='12'/><circle cx='370' cy='146' r='12'/><circle cx='422' cy='146' r='12'/>" +
    "<circle cx='325' cy='200' r='28'/><rect x='176' y='86' width='12' height='22' rx='5'/></g>" +
    "<rect id='g-opt' class='hit' x='332' y='86' width='12' height='22' rx='5' fill='var(--danger)'/>" +
    "<circle id='g-ps' class='hit' cx='260' cy='176' r='13' fill='var(--plum)'/>" +
    "<circle id='g-ls' cx='195' cy='200' r='30' fill='var(--leaf)'/>" +
    "<circle id='g-knob' cx='195' cy='200' r='14' fill='#1b1638' stroke-width='3'/>" +
    "</g>" +
    "<g font-family='Martian Mono, monospace' font-size='12' font-weight='700' fill='var(--ink)'>" +
    "" +
    "</g><g font-family='Martian Mono, monospace' font-size='12' font-weight='700' fill='#1b1638'>" +
    "<text x='338' y='124' text-anchor='middle'>OPT</text><text x='260' y='206' text-anchor='middle'>PS</text></g>" +
    "<text x='260' y='252' text-anchor='middle' font-family='Martian Mono, monospace' font-size='12' font-weight='700' fill='var(--ink)'>LEFT STICK DRIVES</text>";

  var MAP = [
    { id: "ls", key: "Left stick", txt: "Up or down drives, left or right spins. Deadzone 0.2, acts past 0.5, up and down win." },
    { id: "opt", key: "Options", txt: "Emergency stop, once per press (button 9)" },
    { id: "ps", key: "PS", txt: "Stop everything and re-arm (pygame 12, browser 16)" }
  ];
  var list = document.getElementById("map-list");
  var items = {};
  MAP.forEach(function (m) {
    var li = document.createElement("li");
    li.innerHTML = "<b>" + m.key + "</b><span>" + m.txt + "</span>";
    list.appendChild(li);
    items[m.id] = li;
  });
  function light(id, on) {
    if (items[id]) items[id].classList.toggle("on", !!on);
    var g = document.getElementById("g-" + id);
    if (g && g.classList.contains("hit")) g.classList.toggle("on", !!on);
  }

  var knob = document.getElementById("g-knob");
  var statusEl = document.getElementById("pad-status"), statusText = document.getElementById("pad-text");
  var prev = {}, lastDir = null, polling = false, lastPoll = 0;

  function pressedOnce(id, now) { var was = prev[id]; prev[id] = now; return now && !was; }
  function btn(gp, i) { var b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); }

  function poll(t) {
    requestAnimationFrame(poll);
    if (t - lastPoll < 50) return; // ps5_controller.py sleeps 0.05 s per loop
    lastPoll = t;
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = null;
    for (var i = 0; i < pads.length; i++) if (pads[i]) { gp = pads[i]; break; }
    if (!gp) { statusEl.classList.remove("live"); return; }
    statusEl.classList.add("live");
    statusText.textContent = "Connected: " + gp.id.replace(/\s*\(.*\)\s*/g, " ").trim().slice(0, 48);

    var x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (Math.abs(x) < 0.2) x = 0;
    if (Math.abs(y) < 0.2) y = 0;
    knob.setAttribute("cx", 195 + x * 16); knob.setAttribute("cy", 200 + y * 16);
    var dir = y < -0.5 ? "forward" : y > 0.5 ? "backward" : x < -0.5 ? "left" : x > 0.5 ? "right" : null;
    light("ls", !!dir);

    // The real loop calls move_*() or stop() on every poll. Calling only on change gives the same motion without 20 log lines a second.
    if (dir !== lastDir) {
      if (dir) R.ctrl["move_" + dir]();
      else R.ctrl.stop();
      lastDir = dir;
    }

    var opt = btn(gp, 9), ps = btn(gp, 16);
    light("opt", opt); light("ps", ps);
    if (pressedOnce("opt", opt)) R.ctrl.emergency();
    if (pressedOnce("ps", ps)) { R.ctrl.stop(); R.ctrl.clear_emergency(); }
  }

  function startPolling() { if (polling) return; polling = true; requestAnimationFrame(poll); }
  window.addEventListener("gamepadconnected", function (e) {
    startPolling();
    F.toast("Gamepad connected. Left stick drives!");
    R.log("PS5 controller started", "api");
  });
  window.addEventListener("gamepaddisconnected", function () {
    if (lastDir) R.ctrl.stop();
    lastDir = null;
    statusText.textContent = "Gamepad unplugged. Plug one in and press any button.";
  });
  if (navigator.getGamepads && [].some.call(navigator.getGamepads(), Boolean)) startPolling();

  // Hovering a row previews which control it means
  MAP.forEach(function (m) {
    items[m.id].addEventListener("mouseenter", function () { light(m.id, true); });
    items[m.id].addEventListener("mouseleave", function () { light(m.id, false); });
  });
})();
