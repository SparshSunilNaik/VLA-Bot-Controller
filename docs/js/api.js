/* A fake Flask app in the tab: same routes and replies as server.py. */
(function () {
  var R = window.Rover;
  var ok = function (extra) { var o = { status: "ok" }; for (var k in extra) o[k] = extra[k]; return [200, o]; };
  var bad = function (msg) { return [400, { status: "error", message: msg }]; };

  var ROUTES = [
    { verb: "GET", path: "/", note: "Serves templates/index.html, the phone-friendly control panel with Manual and Auto modes and a live log.",
      run: function () { return [200, "<!DOCTYPE html>\n<html> ... Rover control panel ... </html>"]; } },
    { verb: "POST", path: "/api/forward", note: "One 0.3 s step forward. Send it again within 0.3 s to keep rolling.", run: function () { R.execute("forward"); return ok(); } },
    { verb: "POST", path: "/api/backward", note: "One 0.3 s step backward.", run: function () { R.execute("backward"); return ok(); } },
    { verb: "POST", path: "/api/left", note: "One 0.3 s step left. server.py actually calls move_right() here, likely to make up for how the motors are wired. Tick the quirks box to replay that.", run: function () { R.execute("left"); return ok(); } },
    { verb: "POST", path: "/api/right", note: "One 0.3 s step right, which calls move_left() in server.py.", run: function () { R.execute("right"); return ok(); } },
    { verb: "POST", path: "/api/stop", note: "Stops motors, pump and both valves at once.", run: function () { R.execute("stop"); return ok(); } },
    { verb: "POST", path: "/api/move", note: "One route for all directions. Anything outside the five names gets a 400.",
      bodies: [{ direction: "forward" }, { direction: "left" }, { direction: "stop" }, { direction: "sideways" }],
      run: function (b) {
        if (["forward", "backward", "left", "right", "stop"].indexOf(b.direction) >= 0) { R.execute(b.direction); return ok({ direction: b.direction }); }
        return bad("Invalid direction");
      } },
    { verb: "POST", path: "/api/spray", note: "No step timer here: a valve stays open until you send {\"id\": \"stop\"}, which also stops the motors.",
      bodies: [{ id: 1 }, { id: 2 }, { id: "stop" }, { id: 3 }],
      run: function (b) {
        var r = R.spray(b.id);
        if (r === null) return bad("Invalid spray ID");
        return ok({ spray_id: b.id });
      } },
    { verb: "POST", path: "/api/emergency", note: "Latches the lockout. Move and spray calls still answer 200 but do nothing until a reset.", run: function () { R.ctrl.emergency(); return ok({ message: "Emergency stop active" }); } },
    { verb: "POST", path: "/api/reset", note: "Clears the lockout. It doesn't move anything.", run: function () { R.ctrl.clear_emergency(); return ok({ message: "System reset" }); } },
    { verb: "GET", path: "/api/status", note: "The web panel polls this every second. It returns the last 20 log lines.", run: function () { return [200, R.status()]; } }
  ];

  var routesEl = document.getElementById("routes");
  var reqLine = document.getElementById("req-line"), pick = document.getElementById("body-pick");
  var reqOut = document.getElementById("req-out"), resOut = document.getElementById("res-out"), resCode = document.getElementById("res-code");
  var noteEl = document.getElementById("route-note"), curlEl = document.getElementById("curl");
  var current = null;

  var btns = ROUTES.map(function (rt) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "route";
    b.innerHTML = "<span class='verb " + rt.verb.toLowerCase() + "'>" + rt.verb + "</span><span>" + rt.path + "</span>";
    b.addEventListener("click", function () { choose(rt); send(); });
    routesEl.appendChild(b);
    return b;
  });

  function body() { return current.bodies ? current.bodies[Number(pick.value) || 0] : null; }
  function curl() {
    var b = body();
    var s = "curl" + (current.verb === "POST" ? " -X POST" : "") + " http://<pi-ip>:9999" + current.path;
    if (b) s += " -H 'Content-Type: application/json' -d '" + JSON.stringify(b) + "'";
    return s;
  }
  function render() {
    reqLine.textContent = current.verb + " " + current.path;
    var b = body();
    reqOut.textContent = current.verb + " " + current.path + " HTTP/1.1\nHost: <pi-ip>:9999" + (b ? "\nContent-Type: application/json\n\n" + JSON.stringify(b, null, 2) : "");
    noteEl.textContent = current.note;
    curlEl.textContent = curl();
  }
  function choose(rt) {
    current = rt;
    btns.forEach(function (b, i) { b.setAttribute("aria-pressed", ROUTES[i] === rt); });
    pick.innerHTML = "";
    pick.hidden = !rt.bodies;
    (rt.bodies || []).forEach(function (bd, i) {
      var o = document.createElement("option"); o.value = i; o.textContent = JSON.stringify(bd); pick.appendChild(o);
    });
    render();
    resOut.textContent = "Press Send";
    resCode.textContent = "...";
    resCode.className = "http-code";
  }
  function send() {
    var res = current.run(body() || {});
    R.log("[API] " + current.verb + " " + current.path + " " + res[0], "api");
    resCode.textContent = res[0] === 200 ? "200 OK" : "400 BAD REQUEST";
    resCode.className = "http-code " + (res[0] === 200 ? "ok" : "bad");
    resOut.textContent = typeof res[1] === "string" ? res[1] : JSON.stringify(res[1], null, 2);
  }
  pick.addEventListener("change", render);
  document.getElementById("send").addEventListener("click", send);
  choose(ROUTES[1]);
})();
