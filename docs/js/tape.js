/* Rolling timeline of motor steps and the pump. */
(function () {
  var R = window.Rover, F = window.Field;
  var canvas = document.getElementById("tape-canvas");
  var ctx = canvas.getContext("2d");
  var WINDOW = 6000;
  var presses = [];
  R.on("step", function (s) { presses.push({ t: R.now(), id: s.id, action: s.action }); if (presses.length > 60) presses.shift(); });

  var colors = {};
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ["leaf", "sky", "plum", "sun", "tomato", "ink", "ink-soft", "line", "paper", "bg"].forEach(function (k) { colors[k] = cs.getPropertyValue("--" + k).trim(); });
  }
  readColors();
  document.addEventListener("themechange", readColors);
  var KC = { forward: "leaf", backward: "sky", left: "plum", right: "sun" };

  var visible = false, W = 0, H = 150, dpr = 1;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
  else visible = true;

  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw() {
    requestAnimationFrame(draw);
    if (!visible) return;
    if (W !== canvas.clientWidth) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var now = R.now(), pad = 64, span = W - pad - 14;
    function X(t) { return pad + (1 - (now - t) / WINDOW) * span; }

    ctx.font = "700 11px 'Martian Mono', monospace";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors["ink-soft"];
    ctx.fillText("motors", 10, 46);
    ctx.fillText("pump", 10, 104);

    // second grid
    ctx.strokeStyle = colors["ink-soft"]; ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
    for (var s = 0; s <= 6; s++) {
      var gx = X(now - s * 1000);
      ctx.beginPath(); ctx.moveTo(gx, 14); ctx.lineTo(gx, H - 22); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors["ink-soft"];
    ctx.fillText("now", X(now) - 22, H - 10);
    ctx.fillText("-6 s", pad - 4, H - 10);

    // motor segments
    R.segments.forEach(function (sg) {
      var t1 = sg.t1 === null ? now : sg.t1;
      if (t1 < now - WINDOW) return;
      var x0 = Math.max(pad, X(sg.t0)), x1 = X(t1);
      if (sg.t1 === null) {
        // ghost of the scheduled stop
        var due = sg.t0 + R.STEP_DURATION;
        if (due > now) {
          ctx.setLineDash([4, 4]); ctx.strokeStyle = colors[KC[sg.kind]]; ctx.lineWidth = 2;
          rr(x0, 28, Math.max(4, X(due) - x0), 36, 8); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      ctx.fillStyle = colors[KC[sg.kind]];
      rr(x0, 28, Math.max(3, x1 - x0), 36, 8); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = colors.line; ctx.stroke();
      if (sg.handed) {
        ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x1, 20); ctx.lineTo(x1, 72); ctx.stroke(); ctx.setLineDash([]);
      }
      if (x1 - x0 > 26) {
        ctx.fillStyle = sg.kind === "right" ? "#1b1638" : "#fff";
        ctx.fillText("#" + sg.id, x0 + 7, 46);
      }
    });

    // presses
    presses.forEach(function (p) {
      if (p.t < now - WINDOW) return;
      var px = X(p.t);
      ctx.fillStyle = p.action === "stop" ? colors.tomato : colors.ink;
      ctx.beginPath(); ctx.moveTo(px, 22); ctx.lineTo(px - 5, 13); ctx.lineTo(px + 5, 13); ctx.closePath(); ctx.fill();
    });

    // pump
    R.spraySegs.forEach(function (sg) {
      var t1 = sg.t1 === null ? now : sg.t1;
      if (t1 < now - WINDOW) return;
      var x0 = Math.max(pad, X(sg.t0)), x1 = X(t1);
      ctx.fillStyle = colors.tomato;
      rr(x0, 90, Math.max(3, x1 - x0), 28, 8); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = colors.line; ctx.stroke();
    });
  }
  requestAnimationFrame(draw);

  function burst(n, gap, dir) {
    if (R.mode === "auto") { F.toast("Switch to Manual first"); return; }
    if (R.emergency) { F.toast("Emergency stop is on. Reset first"); return; }
    for (var i = 0; i < n; i++) setTimeout(function () { R.execute(dir); }, i * gap);
  }
  document.getElementById("tape-mash").addEventListener("click", function () { burst(6, 150, "left"); });
  document.getElementById("tape-slow").addEventListener("click", function () { burst(4, 600, "right"); });
})();
