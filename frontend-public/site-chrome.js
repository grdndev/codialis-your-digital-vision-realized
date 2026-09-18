(function () {
  "use strict";

  var head = document.head || document.documentElement;
  if (!document.getElementById("cod-site-css")) {
    var stylesheet = document.createElement("link");
    stylesheet.id = "cod-site-css";
    stylesheet.rel = "stylesheet";
    stylesheet.href = "./site.css";
    head.appendChild(stylesheet);
  }

  var header =
    '<nav id="cod-nav" aria-label="Navigation principale" style="position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:100;display:flex;justify-content:space-between;align-items:center;gap:clamp(14px,2vw,28px);padding:9px 9px 9px 22px;border-radius:100px;background:rgba(16,24,40,.72);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);box-shadow:0 18px 50px -18px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);">' +
    '<a href="./" style="display:flex;align-items:center;gap:10px;flex-shrink:0"><img src="./assets/codialis-white.png" alt="Codialis - ingenierie logicielle sur mesure" style="height:26px;width:auto;display:block" /></a>' +
    '<div class="cod-navlinks" style="display:flex;align-items:center;gap:clamp(6px,1vw,12px);padding:0 clamp(4px,1vw,10px);border-left:1px solid rgba(255,255,255,.1);border-right:1px solid rgba(255,255,255,.1)">' +
    '<a href="/#expertises" style="font-family:Space Grotesk,sans-serif;font-weight:500;font-size:14.5px;letter-spacing:.01em;color:#b7c2d2;padding:8px 12px;border-radius:100px">Expertise</a><a href="/portfolio" style="font-family:Space Grotesk,sans-serif;font-weight:500;font-size:14.5px;letter-spacing:.01em;color:#b7c2d2;padding:8px 12px;border-radius:100px">Portfolio</a><a href="/blog" style="font-family:Space Grotesk,sans-serif;font-weight:500;font-size:14.5px;letter-spacing:.01em;color:#b7c2d2;padding:8px 12px;border-radius:100px">Blog</a><a href="/financement" style="font-family:Space Grotesk,sans-serif;font-weight:500;font-size:14.5px;letter-spacing:.01em;color:#b7c2d2;padding:8px 12px;border-radius:100px">Financement</a><a href="/partner-program" style="font-family:Space Grotesk,sans-serif;font-weight:500;font-size:14.5px;letter-spacing:.01em;color:#b7c2d2;padding:8px 12px;border-radius:100px">Partner Program</a><a href="/contact" style="font-family:Space Grotesk,sans-serif;font-weight:500;font-size:14.5px;letter-spacing:.01em;color:#b7c2d2;padding:8px 12px;border-radius:100px">Contact</a>' +
    '</div><div class="cod-navtoggle" aria-label="Langue" style="display:flex;align-items:center;background:rgba(255,255,255,.06);border-radius:100px;padding:3px;flex-shrink:0"><button type="button" data-cod-lang="fr" style="border:0;cursor:pointer;font-family:IBM Plex Mono,monospace;font-size:12px;letter-spacing:.06em;padding:5px 11px;border-radius:100px;background:transparent;color:#8fa0b5">FR</button><button type="button" data-cod-lang="en" style="border:0;cursor:pointer;font-family:IBM Plex Mono,monospace;font-size:12px;letter-spacing:.06em;padding:5px 11px;border-radius:100px;background:transparent;color:#8fa0b5">EN</button></div>' +
    '<a href="https://calendly.com/contact-codialis/30min" style="display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:100px;background:#2fed7f;color:#08111e;font-family:Space Grotesk,sans-serif;font-weight:600;font-size:14.5px;flex-shrink:0">Prendre RDV<span style="display:inline-block;font-size:15px">&rarr;</span></a></nav>';

  var footer =
    '<footer style="position:relative;padding:64px clamp(20px,5vw,64px) 40px;background:#0e1626;border-top:1px solid rgba(255,255,255,.07)">' +
    '<div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:40px;align-items:start">' +
    '<div><img src="./assets/codialis-white.png" alt="Codialis" style="height:28px;width:auto;display:block;margin-bottom:18px"><p style="font-size:14.5px;line-height:1.65;color:#8291a6;margin:0;max-width:34ch">Les plateformes digitales qui font avancer les entreprises. Architecture-first, construites pour durer.</p><a href="/portfolio" aria-label="50+ projets livrés - voir le portfolio" style="display:inline-flex;align-items:baseline;gap:8px;margin-top:20px;padding:8px 14px;border-radius:999px;background:rgba(47,237,127,.09);border:1px solid rgba(47,237,127,.3);color:#2fed7f;font-size:13.5px;font-weight:600"><span style="font-family:Space Grotesk,sans-serif;font-weight:700;font-size:16px">50+</span> projets livrés</a><div data-cod-footer-socials style="display:flex;gap:12px;margin-top:22px"><a href="https://www.linkedin.com/company/109392264/" target="_blank" rel="noopener" aria-label="LinkedIn" style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#b7c2d2"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z"></path></svg></a><a href="https://www.instagram.com/codialis.dev/" target="_blank" rel="noopener" aria-label="Instagram" style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#b7c2d2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"></circle></svg></a></div></div>' +
    '<div><h4 style="font-family:IBM Plex Mono,monospace;font-size:12px;letter-spacing:.15em;color:#eaf0f7;margin:0 0 18px">EXPERTISES</h4><div style="display:flex;flex-direction:column;gap:11px"><a href="/developpement-saas">Développement SaaS</a><a href="/application-mobile">Applications mobiles</a><a href="/agence-ia">Intelligence artificielle</a><a href="/crm-erp-api">CRM &amp; ERP sur mesure</a><a href="/#expertises">Logiciel métier sur mesure</a></div></div>' +
    '<div><h4 style="font-family:IBM Plex Mono,monospace;font-size:12px;letter-spacing:.15em;color:#eaf0f7;margin:0 0 18px">LE SITE</h4><div style="display:flex;flex-direction:column;gap:11px"><a href="/portfolio">Portfolio</a><a href="/blog">Blog</a><a href="/financement">Financement</a><a href="/partner-program">Partner Program</a></div></div>' +
    '<div><h4 style="font-family:IBM Plex Mono,monospace;font-size:12px;letter-spacing:.15em;color:#eaf0f7;margin:0 0 18px">CONTACT</h4><div style="display:flex;flex-direction:column;gap:11px"><a href="/contact">Nous contacter</a><a href="https://calendly.com/contact-codialis/30min">Prendre rendez-vous</a></div></div>' +
    '</div><div style="max-width:1200px;margin:54px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;color:#8291a6;font-family:IBM Plex Mono,monospace;font-size:13px;letter-spacing:.04em"><span>&copy; 2025 Codialis. Tous droits réservés.</span><a href="/legal" style="color:#2fed7f;font-family:IBM Plex Mono,monospace;font-size:13px;font-weight:600;letter-spacing:.04em">Mentions légales</a><span style="text-align:right">SaaS &middot; Mobile &middot; IA &middot; CRM / ERP</span></div></footer>';

  function render() {
    document.querySelectorAll("[data-cod-header]").forEach(function (node) {
      if (!node.hasAttribute("data-cod-rendered")) {
        node.innerHTML = header;
        node.setAttribute("data-cod-rendered", "");
      }
    });
    document.querySelectorAll("[data-cod-footer]").forEach(function (node) {
      if (!node.hasAttribute("data-cod-rendered")) {
        node.innerHTML = footer;
        node.setAttribute("data-cod-rendered", "");
      }
    });
    document.querySelectorAll("[data-cod-lang]").forEach(function (button) {
      if (button.hasAttribute("data-cod-bound")) return;
      var language = button.getAttribute("data-cod-lang");
      button.classList.toggle("is-active", !window.CodialisI18n || window.CodialisI18n.get() === language);
      button.addEventListener("click", function () {
        if (window.CodialisI18n) window.CodialisI18n.set(language);
      });
      button.setAttribute("data-cod-bound", "");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
  new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
})();