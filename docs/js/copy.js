(function () {
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy-from]");
    if (!b) return;
    var src = document.getElementById(b.getAttribute("data-copy-from"));
    var text = src.textContent;
    function done(ok) {
      b.textContent = ok ? "Copied!" : "Select it";
      setTimeout(function () { b.textContent = "Copy"; }, 1400);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { done(document.execCommand("copy")); } catch (err) { done(false); }
      ta.remove();
    }
  });
})();
