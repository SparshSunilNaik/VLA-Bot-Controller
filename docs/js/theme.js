(function () {
  var root = document.documentElement;
  var btn = document.getElementById("theme-btn");
  function set(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("rover-theme", t); } catch (e) {}
    document.dispatchEvent(new CustomEvent("themechange", { detail: t }));
  }
  btn.addEventListener("click", function () {
    set(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
})();
