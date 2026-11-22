/* A browser port of controller.py (RoverController) and the step logic in server.py.
   Everything else on the page talks to the rover through window.Rover. */
(function () {
  var STEP_DURATION = 300; // ms, server.py STEP_DURATION = 0.3
  var listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach(function (fn) { fn(data); }); }
  function now() { return performance.now(); }
  function stamp() {
    var d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
  }

  var R = {
    STEP_DURATION: STEP_DURATION,
    motors: { left: 0, right: 0 },   // -1 backward, 0 stopped, 1 forward
    pump: false, blur: false, mold: false,
    emergency: false,
    mode: "manual",
    quirks: false,
    stepId: 0,
    logs: [],
    segments: [],      // motor timeline for the tape
    spraySegs: [],     // pump timeline
    on: on, emit: emit, now: now
  };

  function log(msg, cls) {
    var line = "[" + stamp() + "] " + msg;
    R.logs.push({ text: line, cls: cls || "" });
    if (R.logs.length > 50) R.logs.shift();
    emit("log", R.logs[R.logs.length - 1]);
  }
  R.log = log;

  function trim(list) {
    var cut = now() - 8000;
    while (list.length && list[0].t1 !== null && list[0].t1 < cut) list.shift();
  }
  function closeMotorSeg(handed) {
    var open = R.segments[R.segments.length - 1];
    if (open && open.t1 === null) { open.t1 = now(); open.handed = handed; }
  }
  function openMotorSeg(kind) {
    closeMotorSeg(true);
    R.segments.push({ kind: kind, t0: now(), t1: null, id: R.stepId, handed: false });
    trim(R.segments);
  }
  function setMotors(l, r, kind) {
    R.motors.left = l; R.motors.right = r;
    openMotorSeg(kind);
    emit("state");
  }
  function sprayOn() {
    var open = R.spraySegs[R.spraySegs.length - 1];
    if (!open || open.t1 !== null) R.spraySegs.push({ t0: now(), t1: null });
    trim(R.spraySegs);
  }
  function sprayOff() {
    var open = R.spraySegs[R.spraySegs.length - 1];
    if (open && open.t1 === null) open.t1 = now();
  }

  /* ---------- controller.py ---------- */
  var ctrl = {
    move_forward: function () { if (R.emergency) return false; setMotors(1, 1, "forward"); log("Move forward"); return true; },
    move_backward: function () { if (R.emergency) return false; setMotors(-1, -1, "backward"); log("Move backward"); return true; },
    move_left: function () { if (R.emergency) return false; setMotors(-1, 1, "left"); log("Turn left"); return true; },
    move_right: function () { if (R.emergency) return false; setMotors(1, -1, "right"); log("Turn right"); return true; },
    stop: function (quiet) {
      R.motors.left = 0; R.motors.right = 0;
      closeMotorSeg(false);
      R.pump = false; R.blur = false; R.mold = false;
      sprayOff();
      if (!quiet) log("All stopped");
      emit("state");
    },
    stop_motors_only: function () {
      R.motors.left = 0; R.motors.right = 0;
      closeMotorSeg(false);
      emit("state");
    },
    manual_spray_blur: function () {
      if (R.emergency) return false;
      R.pump = true; R.blur = true; sprayOn();
      log("Spraying Fertilizer 1 (Blight)"); emit("state"); return true;
    },
    manual_spray_mold: function () {
      if (R.emergency) return false;
      R.pump = true; R.mold = true; sprayOn();
      log("Spraying Fertilizer 2 (Mold)"); emit("state"); return true;
    },
    emergency: function () {
      R.emergency = true;
      ctrl.stop();
      log("!!! EMERGENCY STOP !!!", "warn");
      emit("state");
    },
    clear_emergency: function () {
      R.emergency = false;
      log("System reset & armed");
      emit("state");
    }
  };
  R.ctrl = ctrl;

  /* ---------- server.py execute_step ---------- */
  R.execute = function (action) {
    R.stepId += 1;
    var thisId = R.stepId;
    emit("step", { id: thisId, action: action });
    if (action === "stop") { ctrl.stop(); return true; }

    var map = R.quirks
      ? { forward: "move_forward", backward: "move_backward", left: "move_right", right: "move_left" }
      : { forward: "move_forward", backward: "move_backward", left: "move_left", right: "move_right" };
    var ran = ctrl[map[action]]();

    setTimeout(function () {
      if (R.stepId === thisId) {
        // The real delayed_stop calls ctrl.stop(), which also shuts the pump and valves.
        if (R.quirks) ctrl.stop(); else if (R.motors.left || R.motors.right) ctrl.stop_motors_only();
      }
    }, STEP_DURATION);
    return ran;
  };

  /* /api/spray */
  R.spray = function (id) {
    if (id === 1 || id === "1") return ctrl.manual_spray_blur();
    if (id === 2 || id === "2") return ctrl.manual_spray_mold();
    if (id === "stop") { ctrl.stop(); return true; }
    return null;
  };

  R.status = function () {
    return { emergency: R.emergency, logs: R.logs.slice(-20).map(function (l) { return l.text; }) };
  };

  R.setMode = function (mode) {
    R.mode = mode;
    if (mode === "auto") { ctrl.stop(); }
    emit("mode", mode);
  };

  log("Web server starting on port 9999...");
  window.Rover = R;
})();
