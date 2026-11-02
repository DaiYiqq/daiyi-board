/* DY Board — 轻量交互：移动端菜单 + FAQ 手风琴 + 版本注入 */
(function () {
  // 版本单一来源：未来在 GitHub 发布新版本时，只改这一处即可全站同步
  var APP_VERSION = "2.2.1";

  function injectVersion() {
    document.querySelectorAll("[data-version]").forEach(function (el) {
      var mode = el.getAttribute("data-version");
      el.textContent = mode === "bare" ? APP_VERSION : "v" + APP_VERSION;
    });
  }

  var menuBtn = document.querySelector("[data-menu-btn]");
  var navLinks = document.querySelector("[data-nav-links]");
  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      navLinks.style.display = open ? "flex" : "";
    });
  }

  var faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(function (item) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    if (!q || !a) return;
    q.addEventListener("click", function () {
      var isOpen = item.classList.toggle("open");
      a.style.maxHeight = isOpen ? a.scrollHeight + "px" : null;
    });
  });

  injectVersion();
})();
