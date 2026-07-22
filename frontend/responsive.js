/*
 * Codialis — shared responsive layer (loaded on every public page).
 *   1. Injects tablet/mobile CSS: grids stack, no horizontal overflow.
 *   2. On <=900px hides the desktop nav pill and shows a full-width mobile top
 *      bar (logo + language toggle + hamburger) built in <body>, so it is
 *      immune to DCLogic re-renders that wipe the pill's children.
 * Pure DOM + CSS; works regardless of when DCLogic mounts the nav.
 */
(function () {
  "use strict";

  var MOBILE = 900;

  // ---- 1. Responsive CSS -------------------------------------------------
  var css = [
    "html,body{overflow-x:hidden;}",
    "img,video,canvas{max-width:100%;height:auto;}",

    /* Tablet & down: fixed two-column grids collapse to one column. */
    "@media (max-width:900px){",
    "  #cod-espacegrid,#cod-soldesgrid,#cod-contentgrid,",
    '  [style*="1fr 1.15fr"],[style*="1.2fr 1fr"],[style*="1.35fr 1fr"],',
    '  [style*="1.15fr 1fr"]{grid-template-columns:1fr !important;}',
    "  #cod-nav{display:none !important;}" /* hide the desktop pill */,
    "  .cod-mobilebar{display:flex !important;}",
    "}",

    /* Desktop pill: keep the SAME look as the 16" version on every computer
       screen, and guarantee the "Prendre RDV" CTA never leaves the pill.
       The pill is centered and uniformly scaled down (--codnav-scale, set in
       JS) to fit the viewport. !important so the scale survives DCLogic
       re-rendering the nav's inline style. */
    "#cod-nav{left:50% !important;transform:translateX(-50%) scale(var(--codnav-scale,1)) !important;",
    "  transform-origin:50% 0 !important;max-width:none !important;width:max-content !important;}",

    /* Phone: auto-fit grids and small form pairs go single column. */
    "@media (max-width:600px){",
    '  [style*="minmax("]{grid-template-columns:1fr !important;}',
    '  [style*="grid-template-columns: 1fr 1fr"],',
    '  [style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr !important;}',
    "}",

    /* Mobile top bar. */
    ".cod-mobilebar{display:none;position:fixed;top:0;left:0;right:0;z-index:100;",
    "  align-items:center;gap:12px;padding:11px 16px;",
    "  background:rgba(12,19,32,.94);border-bottom:1px solid rgba(255,255,255,.08);",
    "  backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);}",
    ".cod-mobilebar .cod-mb-logo{height:24px;width:auto;display:block;flex-shrink:0;}",
    ".cod-mobilebar .cod-mb-spacer{flex:1;}",
    ".cod-mb-lang{display:flex;background:rgba(255,255,255,.06);border-radius:100px;padding:3px;flex-shrink:0;}",
    '.cod-mb-lang button{border:0;cursor:pointer;font-family:"IBM Plex Mono",monospace;',
    "  font-size:12px;letter-spacing:.06em;padding:6px 11px;border-radius:100px;",
    "  background:transparent;color:#8FA0B5;transition:background .2s,color .2s;}",
    ".cod-mb-lang button.active{background:#2FED7F;color:#08111E;}",
    ".cod-mb-burger{display:inline-flex;align-items:center;justify-content:center;",
    "  width:42px;height:42px;flex-shrink:0;border-radius:100px;cursor:pointer;padding:0;",
    "  border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#EAF0F7;}",
    ".cod-mb-burger:hover{border-color:#2FED7F;color:#2FED7F;}",

    /* Slide-down menu panel. */
    ".cod-mobilemenu{position:fixed;top:64px;left:12px;right:12px;z-index:99;",
    "  display:none;flex-direction:column;gap:4px;padding:10px;",
    "  border-radius:16px;background:rgba(12,19,32,.98);",
    "  border:1px solid rgba(255,255,255,.12);",
    "  box-shadow:0 24px 60px -20px rgba(0,0,0,.85);",
    "  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);}",
    ".cod-mobilemenu.open{display:flex;}",
    ".cod-mobilemenu a{display:block;padding:13px 16px;border-radius:10px;",
    '  font-family:"Space Grotesk",sans-serif;font-weight:500;font-size:16px;',
    "  color:#EAF0F7;text-decoration:none;}",
    ".cod-mobilemenu a:hover{background:rgba(255,255,255,.07);color:#2FED7F;}",
  ].join("\n");

  var style = document.createElement("style");
  style.id = "cod-responsive";
  style.textContent = css;
  document.head.appendChild(style);

  // ---- 2. Mobile bar + menu ----------------------------------------------
  function realLangButtons() {
    return [].slice.call(
      document.querySelectorAll("#cod-nav .cod-navtoggle button"),
    );
  }

  function build() {
    var nav = document.getElementById("cod-nav");
    if (!nav) return false; // page has no pill nav (e.g. Admin)
    if (document.querySelector(".cod-mobilebar")) return true;

    // --- panel (links) ---
    var panel = document.createElement("nav");
    panel.className = "cod-mobilemenu";
    function close() {
      panel.classList.remove("open");
    }
    function fillPanel() {
      panel.innerHTML = "";
      var seen = {};
      function add(href, label, accent) {
        if (!href || seen[href] || !label) return;
        seen[href] = true;
        var a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        if (accent) a.style.color = "#2FED7F";
        a.addEventListener("click", close);
        panel.appendChild(a);
      }
      document
        .querySelectorAll("#cod-nav .cod-navlinks a")
        .forEach(function (a) {
          add(a.getAttribute("href"), a.textContent.trim());
        });
      // the CTA is the last top-level link in the pill (RDV / Contact)
      var tops = document.querySelectorAll("#cod-nav > a");
      var cta = tops[tops.length - 1];
      if (cta) add(cta.getAttribute("href"), cta.textContent.trim(), true);
    }

    // --- bar ---
    var bar = document.createElement("div");
    bar.className = "cod-mobilebar";

    var logo = document.createElement("img");
    logo.className = "cod-mb-logo";
    logo.alt = "Codialis";
    var existing = nav.querySelector("img");
    logo.src = existing
      ? existing.getAttribute("src")
      : "/assets/codialis-white.png";
    var logoLink = document.createElement("a");
    logoLink.href = "index.html";
    logoLink.appendChild(logo);

    var spacer = document.createElement("div");
    spacer.className = "cod-mb-spacer";

    // language toggle proxies clicks to the real (hidden) DCLogic buttons
    var lang = document.createElement("div");
    lang.className = "cod-mb-lang";
    var myLang = {};
    ["FR", "EN"].forEach(function (code) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = code;
      b.addEventListener("click", function () {
        var real = realLangButtons().filter(function (r) {
          return r.textContent.trim() === code;
        })[0];
        if (real) real.click();
        setTimeout(syncLang, 60);
      });
      myLang[code] = b;
      lang.appendChild(b);
    });
    function syncLang() {
      realLangButtons().forEach(function (r) {
        var code = r.textContent.trim();
        if (!myLang[code]) return;
        var active =
          getComputedStyle(r).backgroundColor.replace(/\s/g, "") ===
          "rgb(47,237,127)";
        myLang[code].classList.toggle("active", active);
      });
    }

    var burger = document.createElement("button");
    burger.type = "button";
    burger.className = "cod-mb-burger";
    burger.setAttribute("aria-label", "Menu");
    burger.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>';
    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (panel.classList.contains("open")) close();
      else {
        fillPanel();
        panel.classList.add("open");
      }
    });

    bar.appendChild(logoLink);
    bar.appendChild(spacer);
    bar.appendChild(lang);
    bar.appendChild(burger);

    document.body.appendChild(bar);
    document.body.appendChild(panel);

    document.addEventListener("click", function (e) {
      if (!panel.contains(e.target) && !bar.contains(e.target)) close();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > MOBILE) close();
    });

    setTimeout(syncLang, 200);
    return true;
  }

  // ---- 3. Fit the desktop pill (scale-to-fit, identical look everywhere) --
  // offsetWidth ignores CSS transforms, so it always reports the pill's true
  // (unscaled) content width. We derive the scale that makes it fit the
  // viewport minus 16px gutters each side, capped at 1 (never enlarge), so
  // the CTA can never spill outside the pill.
  var fitScheduled = false;
  function fitNav() {
    var nav = document.getElementById("cod-nav");
    if (!nav || window.innerWidth <= MOBILE) return; // pill hidden on mobile
    var natural = nav.offsetWidth;
    if (!natural) return;
    var avail = window.innerWidth - 16;
    var s = natural > avail ? Math.round((avail / natural) * 1000) / 1000 : 1;
    document.documentElement.style.setProperty("--codnav-scale", s);
  }
  function scheduleFit() {
    if (fitScheduled) return;
    fitScheduled = true;
    requestAnimationFrame(function () {
      fitScheduled = false;
      fitNav();
    });
  }

  function initFit() {
    var nav = document.getElementById("cod-nav");
    if (!nav) return false;
    fitNav();
    // Recompute when the nav's contents change (the FR/EN toggle changes the
    // link labels, hence the natural width). We only mutate :root's custom
    // property, never the nav, so this observer cannot loop.
    new MutationObserver(scheduleFit).observe(nav, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("resize", scheduleFit);
    // Web fonts load after first paint and widen the text; recompute then.
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(scheduleFit);
    return true;
  }

  function init() {
    var built = build();
    var fitted = initFit();
    if (built && fitted) return;
    var tries = 0;
    var t = setInterval(function () {
      built = built || build();
      fitted = fitted || initFit();
      if ((built && fitted) || ++tries > 40) clearInterval(t);
    }, 150);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
