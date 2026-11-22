/* 40-pin header with every GPIO the code opens, lit live from Rover state. */
(function () {
  var R = window.Rover;
  var PHYS = { 1: "3V3", 2: "5V", 3: 2, 4: "5V", 5: 3, 6: "GND", 7: 4, 8: 14, 9: "GND", 10: 15, 11: 17, 12: 18, 13: 27, 14: "GND", 15: 22, 16: 23, 17: "3V3", 18: 24, 19: 10, 20: "GND", 21: 9, 22: 25, 23: 11, 24: 8, 25: "GND", 26: 7, 27: 0, 28: 1, 29: 5, 30: "GND", 31: 6, 32: 12, 33: 13, 34: "GND", 35: 19, 36: 16, 37: 26, 38: 20, 39: "GND", 40: 21 };

  var PARTS = [
    {
      id: "motors", name: "L298N motors", color: "leaf", file: "controller.py",
      blurb: "Two DC motors through an L298N H-bridge. gpiozero's Motor drives one pin high for forward and the other for backward.",
      pins: [
        { bcm: 16, role: "Left motor forward", live: function () { return R.motors.left === 1; } },
        { bcm: 20, role: "Left motor backward", live: function () { return R.motors.left === -1; } },
        { bcm: 5, role: "Right motor forward", live: function () { return R.motors.right === 1; } },
        { bcm: 6, role: "Right motor backward", live: function () { return R.motors.right === -1; } }
      ],
      gotcha: "<b>Pin mismatch.</b> <code>config.py</code> names IN1 to IN4 as 5, 6, 20, 16, and <code>hardware/motor_gpiozero.py</code> wires the left motor the other way round (forward 20, backward 16). The server uses <code>controller.py</code>, shown here."
    },
    {
      id: "relays", name: "Pump and valves", color: "tomato", file: "controller.py",
      blurb: "One pump and two solenoid valves on a relay board. They are active low: the pin goes LOW to switch a relay on.",
      lowActive: true,
      pins: [
        { bcm: 17, role: "Pump relay", live: function () { return R.pump; } },
        { bcm: 27, role: "Valve 1, Blight tank", live: function () { return R.blur; } },
        { bcm: 22, role: "Valve 2, Mold tank", live: function () { return R.mold; } }
      ],
      gotcha: "<b>Hold a spray button</b> and watch 17 and one of 27 or 22 drop LOW together. The code calls the blight output <code>blur</code>."
    },
    {
      id: "servos", name: "Nozzle servos", color: "plum", file: "hardware/servo_spray.py",
      blurb: "Two hobby servos aim the nozzle: X swings left and right to plus or minus 0.6, Y nods up and down. An auto sweep goes up 0.6 s, down 0.6 s, centre 0.4 s.",
      pins: [
        { bcm: 12, role: "Servo X, left and right" },
        { bcm: 13, role: "Servo Y, up and down" }
      ],
      gotcha: "<b>Two answers for servo X.</b> <code>config.py</code> says GPIO 18, <code>servo_spray.py</code> opens GPIO 12. Not used by the web server yet."
    },
    {
      id: "stepper", name: "Pan stepper", color: "sky", file: "hardware/stepper_gpiozero.py",
      blurb: "A four-coil stepper on a driver board turns the camera. It runs an 8-phase half-step sequence, 10 ms per phase, for up to 400 cycles, so one pan lasts up to 32 seconds unless stopped.",
      pins: [
        { bcm: 21, role: "Coil IN1" },
        { bcm: 26, role: "Coil IN2" },
        { bcm: 23, role: "Coil IN3" },
        { bcm: 24, role: "Coil IN4" }
      ],
      gotcha: "<b>Not wired to the server.</b> Only the hardware package uses it, through <code>pan_left()</code> and <code>pan_right()</code>."
    }
  ];

  var byBcm = {};
  PARTS.forEach(function (p) { p.pins.forEach(function (pin) { byBcm[pin.bcm] = { part: p, pin: pin }; }); });
  var selected = PARTS[0];

  /* ---------- svg ---------- */
  var NS = "http://www.w3.org/2000/svg";
  var holder = document.getElementById("header-svg");
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 700 212");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Raspberry Pi 40-pin header");
  holder.appendChild(svg);
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  el("rect", { x: 10, y: 48, width: 680, height: 100, rx: 16, fill: "var(--leaf)", stroke: "var(--line)", "stroke-width": 4, opacity: 0.18 });
  el("rect", { x: 22, y: 58, width: 656, height: 80, rx: 10, fill: "#16122b", stroke: "var(--line)", "stroke-width": 3 });
  var t1 = el("text", { x: 24, y: 172, "font-family": "Martian Mono, monospace", "font-size": 12, fill: "var(--ink-soft)" }); t1.textContent = "pin 1";
  var t2 = el("text", { x: 690, y: 18, "text-anchor": "end", "font-family": "Martian Mono, monospace", "font-size": 12, fill: "var(--ink-soft)" }); t2.textContent = "pin 40";

  var pinEls = {};
  for (var n = 1; n <= 40; n++) {
    var col = Math.floor((n - 1) / 2), odd = n % 2 === 1;
    var cx = 50 + col * 31.6, cy = odd ? 118 : 78;
    var fn = PHYS[n];
    var g = el("g", { class: "pin", tabindex: typeof fn === "number" && byBcm[fn] ? 0 : -1 });
    el("rect", { x: cx - 13, y: cy - 13, width: 26, height: 26, rx: 5, fill: "#2a2546" }, g);
    var c = el("circle", { cx: cx, cy: cy, r: 9.5, stroke: "#000", "stroke-width": 2 }, g);
    var title = el("title", {}, g);
    var info = byBcm[fn];
    title.textContent = typeof fn === "number" ? "GPIO " + fn + ", physical pin " + n + (info ? ": " + info.pin.role : "") : fn + ", physical pin " + n;
    if (typeof fn === "number" && info) {
      var lbl = el("text", { x: cx, y: odd ? 160 : 44, "text-anchor": "middle", "font-family": "Martian Mono, monospace", "font-size": 13, "font-weight": 700, fill: "var(--ink)" });
      lbl.textContent = fn;
      (function (part, g) {
        g.addEventListener("click", function () { select(part); });
        g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(part); } });
      })(info.part, g);
      pinEls[fn] = { circle: c, label: lbl, g: g };
    } else {
      c.setAttribute("fill", fn === "GND" ? "#0b0916" : fn === "5V" ? "#e0464b" : fn === "3V3" ? "#f29a38" : "#6d6890");
      c.setAttribute("opacity", 0.85);
    }
  }
  // legend for power
  [["5V", "#e0464b"], ["3V3", "#f29a38"], ["GND", "#0b0916"], ["unused", "#6d6890"]].forEach(function (l, i) {
    var x = 120 + i * 120;
    el("circle", { cx: x, cy: 200, r: 6, fill: l[1], stroke: "#000", "stroke-width": 1.5 });
    var t = el("text", { x: x + 12, y: 204, "font-family": "Martian Mono, monospace", "font-size": 11, fill: "var(--ink-soft)" });
    t.textContent = l[0];
  });

  /* ---------- part chips ---------- */
  var chipsEl = document.getElementById("parts");
  var chips = PARTS.map(function (p) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip";
    b.innerHTML = "<span style='display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--line);background:var(--" + p.color + ");margin-right:6px;vertical-align:-1px'></span>" + p.name;
    b.addEventListener("click", function () { select(p); });
    chipsEl.appendChild(b);
    return b;
  });

  var detail = document.getElementById("pin-detail");
  function select(p) {
    selected = p;
    chips.forEach(function (c, i) { c.setAttribute("aria-pressed", PARTS[i] === p); });
    var rows = p.pins.map(function (pin) {
      return "<tr><td class='mono'>GPIO " + pin.bcm + "</td><td>" + pin.role + "</td><td class='live' data-bcm='" + pin.bcm + "'></td></tr>";
    }).join("");
    detail.innerHTML = "<h3>" + p.name + "</h3><p class='fine' style='margin:0 0 6px'>from <code>" + p.file + "</code></p><p style='margin:0'>" + p.blurb + "</p>" +
      "<table class='pin-table'><thead><tr><th>Pin</th><th>Job</th><th>Level</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<div class='gotcha'>" + p.gotcha + "</div>";
    paint();
  }

  function level(part, pin) {
    if (!pin.live) return { text: "not driven", cls: "" };
    var on = pin.live();
    if (part.lowActive) return on ? { text: "LOW, on", cls: "lo" } : { text: "HIGH, off", cls: "hi" };
    return on ? { text: "HIGH", cls: "hi" } : { text: "LOW", cls: "" };
  }

  function paint() {
    Object.keys(pinEls).forEach(function (bcm) {
      var info = byBcm[bcm], pe = pinEls[bcm];
      var on = info.pin.live ? info.pin.live() : false;
      var dim = selected && info.part !== selected;
      pe.circle.setAttribute("fill", on ? "var(--sun)" : "var(--" + info.part.color + ")");
      pe.circle.setAttribute("r", on ? 12 : 9.5);
      pe.circle.setAttribute("stroke", on ? "#fff" : "#000");
      pe.g.style.opacity = dim ? 0.35 : 1;
      pe.label.style.opacity = dim ? 0.35 : 1;
    });
    detail.querySelectorAll("[data-bcm]").forEach(function (td) {
      var info = byBcm[td.dataset.bcm];
      var lv = level(info.part, info.pin);
      td.textContent = lv.text;
      td.className = "live " + lv.cls;
    });
  }
  R.on("state", paint);
  select(selected);
})();
