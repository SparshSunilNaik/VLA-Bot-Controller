/* Leaf doctor: walk a leaf through the detector.py preprocessing and a pretend 38-way softmax. */
(function () {
  var F = window.Field;
  var CLASSES = F.CLASSES;
  var STAGES = [
    ["1", "Grab a frame", "cv2.VideoCapture(0), resized to 640 x 480"],
    ["2", "Resize", "transforms.Resize((224, 224))"],
    ["3", "To tensor", "3 x 224 x 224, values 0 to 1"],
    ["4", "Normalize", "mean [0.485, 0.456, 0.406], std [0.229, 0.224, 0.225]"],
    ["5", "ResNet-18", "convolution backbone, 512 features out"],
    ["6", "New head", "model.fc = Linear(512, 38)"],
    ["7", "Softmax", "probs.max(1) gives the label and confidence"]
  ];
  var pipe = document.getElementById("pipe");
  var stageEls = STAGES.map(function (s) {
    var d = document.createElement("div");
    d.className = "stage";
    d.innerHTML = "<b>" + s[0] + "</b><div><strong>" + s[1] + "</strong><small>" + s[2] + "</small></div>";
    pipe.appendChild(d);
    return d;
  });

  function rng(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }

  function look(label) {
    var c = label.toLowerCase();
    if (/healthy/.test(c)) return "healthy";
    if (/blight/.test(c)) return "blight";
    if (/mold|mildew/.test(c)) return "mold";
    if (/rust/.test(c)) return "rust";
    if (/virus|mosaic|curl|greening/.test(c)) return "virus";
    if (/scorch|measles|rot/.test(c)) return "scorch";
    return "spot";
  }

  var svg = document.getElementById("leaf-svg");
  function drawLeaf(label) {
    var r = rng(label), kind = look(label);
    var base = { healthy: "#3fb565", blight: "#8fa53a", mold: "#7fae86", rust: "#7fb04a", virus: "#a6c24a", scorch: "#6fa244", spot: "#58a957" }[kind];
    var s = "<defs><clipPath id='leafclip'><path d='M75 14 C118 34 132 82 75 136 C18 82 32 34 75 14Z'/></clipPath></defs>";
    s += "<path d='M75 14 C118 34 132 82 75 136 C18 82 32 34 75 14Z' fill='" + base + "' stroke='#1b1638' stroke-width='4'/>";
    s += "<g clip-path='url(#leafclip)'>";
    var i, x, y;
    if (kind === "blight") for (i = 0; i < 7; i++) { x = 45 + r() * 60; y = 35 + r() * 85; s += "<circle cx='" + x + "' cy='" + y + "' r='" + (6 + r() * 9) + "' fill='#6b3b16' opacity='.85'/><circle cx='" + x + "' cy='" + y + "' r='" + (3 + r() * 3) + "' fill='#3b200b'/>"; }
    if (kind === "mold") for (i = 0; i < 26; i++) { s += "<circle cx='" + (40 + r() * 70) + "' cy='" + (30 + r() * 95) + "' r='" + (2 + r() * 5) + "' fill='#f4f6f8' opacity='.85'/>"; }
    if (kind === "rust") for (i = 0; i < 30; i++) { s += "<circle cx='" + (40 + r() * 70) + "' cy='" + (30 + r() * 95) + "' r='" + (1.5 + r() * 3) + "' fill='#e07a1f'/>"; }
    if (kind === "virus") for (i = 0; i < 9; i++) { s += "<ellipse cx='" + (40 + r() * 70) + "' cy='" + (30 + r() * 95) + "' rx='" + (8 + r() * 12) + "' ry='" + (5 + r() * 8) + "' fill='#f3e04a' opacity='.6'/>"; }
    if (kind === "scorch") s += "<path d='M75 14 C118 34 132 82 75 136 C18 82 32 34 75 14Z' fill='none' stroke='#6b3b16' stroke-width='18' opacity='.8'/>";
    if (kind === "spot") for (i = 0; i < 16; i++) { s += "<circle cx='" + (40 + r() * 70) + "' cy='" + (30 + r() * 95) + "' r='" + (2 + r() * 3) + "' fill='#2a1d12'/>"; }
    s += "</g><path d='M75 22 V132' stroke='#1b1638' stroke-width='3' stroke-linecap='round'/>";
    for (i = 0; i < 4; i++) { y = 48 + i * 20; s += "<path d='M75 " + y + " L" + (52 + i * 2) + " " + (y - 14) + " M75 " + y + " L" + (98 - i * 2) + " " + (y - 14) + "' stroke='#1b1638' stroke-width='2' stroke-linecap='round' opacity='.6'/>"; }
    svg.innerHTML = s;
  }

  function scores(label) {
    var r = rng(label + "!"), crop = label.split("___")[0];
    var top = 0.72 + r() * 0.25, rest = 1 - top;
    var others = CLASSES.filter(function (c) { return c !== label; }).map(function (c) {
      var w = (c.split("___")[0] === crop ? 6 : 1) * (0.2 + r());
      return { c: c, w: w };
    });
    var sum = others.reduce(function (a, o) { return a + o.w; }, 0);
    var list = others.map(function (o) { return { c: o.c, p: o.w / sum * rest }; });
    list.push({ c: label, p: top });
    list.sort(function (a, b) { return b.p - a.p; });
    return list.slice(0, 4);
  }

  var topk = document.getElementById("topk"), verdict = document.getElementById("verdict");
  var timers = [];
  function analyse(label) {
    timers.forEach(clearTimeout); timers = [];
    drawLeaf(label);
    topk.innerHTML = "<span class='fine'>Thinking...</span>";
    verdict.textContent = "";
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var gap = reduce ? 0 : 170;
    stageEls.forEach(function (el, i) {
      el.classList.remove("on");
      timers.push(setTimeout(function () {
        stageEls.forEach(function (e) { e.classList.remove("on"); });
        el.classList.add("on");
      }, i * gap));
    });
    timers.push(setTimeout(function () {
      stageEls.forEach(function (e) { e.classList.remove("on"); });
      stageEls[stageEls.length - 1].classList.add("on");
      var list = scores(label);
      topk.innerHTML = list.map(function (o) {
        return "<div class='row'><span class='name' title='" + o.c + "'>" + o.c + "</span><span>" + (o.p * 100).toFixed(1) + "%</span><span class='meter'><i style='width:0'></i></span></div>";
      }).join("");
      requestAnimationFrame(function () {
        topk.querySelectorAll(".meter i").forEach(function (m, i) { m.style.width = (list[i].p * 100).toFixed(1) + "%"; });
      });
      var k = look(label), nm = F.pretty(label);
      verdict.textContent = k === "healthy" ? nm.crop + " looks healthy. Keep both valves shut."
        : k === "blight" ? nm.cond + " on " + nm.crop.toLowerCase() + ". That's a job for Spray 1, the blight tank."
        : k === "mold" ? nm.cond + " on " + nm.crop.toLowerCase() + ". Spray 2, the mold tank, covers it."
        : nm.cond + " on " + nm.crop.toLowerCase() + ". Neither tank treats this, so the rover leaves it to a human.";
    }, stageEls.length * gap));
  }

  var classesEl = document.getElementById("classes");
  var chips = CLASSES.map(function (c) {
    var b = document.createElement("button");
    var nm = F.pretty(c);
    b.type = "button";
    b.className = "chip" + (/healthy/.test(c) ? " h" : "");
    b.textContent = nm.crop + ": " + nm.cond.toLowerCase();
    b.title = c;
    b.addEventListener("click", function () {
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      analyse(c);
    });
    classesEl.appendChild(b);
    return b;
  });
  var start = CLASSES.indexOf("Tomato___Early_blight");
  chips[start].setAttribute("aria-pressed", "true");
  analyse(CLASSES[start]);
})();
