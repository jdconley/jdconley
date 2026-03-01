/**
 * Shared mobile nav toggle. Works on any page with the standard
 * .navbar / .navbar-button / .nav-menu / .menu.open / .menu.close markup.
 *
 * On the homepage Webflow's IX2 handles the toggle via data-wf-* attributes.
 * On non-Webflow pages (how-this-is-built, etc.) this script provides the
 * same open/close behaviour with a matching CSS transition.
 */
(function initNavToggle() {
  var openBtn = document.querySelector(".menu.open");
  var closeBtn = document.querySelector(".menu.close");
  var navMenu = document.querySelector(".nav-menu");
  if (!openBtn || !closeBtn || !navMenu) return;

  // Skip if Webflow IX2 is managing this page's interactions.
  var html = document.documentElement;
  if (html.getAttribute("data-wf-page") && html.getAttribute("data-wf-site")) return;

  function open() {
    navMenu.style.display = "grid";
    openBtn.style.display = "none";
    closeBtn.style.display = "block";
  }

  function close() {
    navMenu.style.display = "";
    openBtn.style.display = "";
    closeBtn.style.display = "";
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  // Close nav when a link is tapped.
  navMenu.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", close);
  });
})();
