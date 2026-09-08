// Réseaux sociaux du pied de page, alimentés par le back-office
// (settings contact_socials). S'applique à tout conteneur marqué
// `data-cod-footer-socials`. Si la clé n'a jamais été configurée, on garde
// le contenu HTML de secours ; si elle est configurée (même vide), elle fait foi.
(function () {
  var ICONS = {
    linkedin:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z"></path></svg>',
    instagram:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"></circle></svg>',
    facebook:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"></path></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.97 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.01 4.13H5.05z"></path></svg>',
    youtube:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.8-.48-5.6a2.9 2.9 0 0 0-2-2C18.7 3.9 12 3.9 12 3.9s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2c1.8.5 8.5.5 8.5.5s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12zM9.8 15.3V8.7l5.7 3.3z"></path></svg>',
    tiktok:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.1v12.4a2.52 2.52 0 1 1-2.5-2.52c.26 0 .5.04.74.11V9.8a5.6 5.6 0 0 0-.74-.05A5.6 5.6 0 1 0 15.54 15.4V9.1a7.3 7.3 0 0 0 4.28 1.37V7.4a4.28 4.28 0 0 1-3.22-1.58z"></path></svg>',
    github:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.57.67.48A10 10 0 0 0 12 2z"></path></svg>',
  };
  var BASE =
    "width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#b7c2d2;transition:color .2s,background .2s,border-color .2s,transform .2s;";

  function build(container, items) {
    container.innerHTML = "";
    container.setAttribute("data-cod-socials-done", "1");
    items.forEach(function (s) {
      if (!s || !s.href || !ICONS[s.icon]) return;
      var a = document.createElement("a");
      a.href = s.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", s.name || s.icon);
      a.style.cssText = BASE;
      a.innerHTML = ICONS[s.icon];
      a.addEventListener("mouseenter", function () {
        a.style.color = "#08111E";
        a.style.background = "#2FED7F";
        a.style.borderColor = "#2FED7F";
        a.style.transform = "translateY(-2px)";
      });
      a.addEventListener("mouseleave", function () {
        a.style.color = "#b7c2d2";
        a.style.background = "rgba(255,255,255,0.05)";
        a.style.borderColor = "rgba(255,255,255,0.1)";
        a.style.transform = "none";
      });
      container.appendChild(a);
    });
  }

  var cachedItems = null; // null = pas encore de config connue

  // Peint les conteneurs pas encore traités. Ré-appelé car le runtime DC peut
  // re-rendre le pied de page après nous (nouveau nœud = attribut perdu).
  function apply() {
    if (!cachedItems) return;
    var nodes = document.querySelectorAll(
      "[data-cod-footer-socials]:not([data-cod-socials-done])",
    );
    for (var i = 0; i < nodes.length; i++) build(nodes[i], cachedItems);
  }

  function run() {
    if (!document.querySelector("[data-cod-footer-socials]")) return;
    var apiBase =
      location.port === "3001" ? "" : "https://landingback.codialis.com";
    fetch(apiBase + "/api/settings/contact_socials")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        // Pas de clé `items` = jamais configuré : on garde le fallback HTML.
        if (!data || !Array.isArray(data.items)) return;
        cachedItems = data.items.filter(function (s) {
          return s && s.href && s.icon;
        });
        apply();
        [200, 600, 1200].forEach(function (d) {
          setTimeout(apply, d);
        });
        // Repeint si le runtime remplace le nœud plus tard.
        if (window.MutationObserver) {
          new MutationObserver(apply).observe(document.body, {
            childList: true,
            subtree: true,
          });
        }
      })
      .catch(function () {});
  }

  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run);
})();
