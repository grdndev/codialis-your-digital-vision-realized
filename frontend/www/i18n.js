// Codialis i18n runtime.
// Default language is FR (the source text baked into each page). When the
// visitor picks EN, the choice is stored in localStorage and the page is
// reloaded; on load this script walks the rendered DOM and swaps every known
// French string for its English translation (see i18n-dict.js). A
// MutationObserver keeps translating content that React (dc-runtime) mounts or
// re-renders after the initial pass.
(function () {
  "use strict";
  var KEY = "codialis-lang";
  var lang = "fr";
  try {
    lang = localStorage.getItem(KEY) === "en" ? "en" : "fr";
  } catch (e) {}

  // Exposed so the FR/EN buttons in each page component can persist the choice.
  window.CodialisI18n = {
    get: function () {
      return lang;
    },
    set: function (l) {
      l = l === "en" ? "en" : "fr";
      try {
        localStorage.setItem(KEY, l);
      } catch (e) {}
      location.reload();
    },
  };

  try {
    document.documentElement.lang = lang;
  } catch (e) {}

  // FR is the source — nothing to translate.
  if (lang !== "en") return;

  var DICT = window.__CODIALIS_I18N__ || {};
  var ATTRS = ["placeholder", "alt", "title", "aria-label"];
  // TEXTAREA is intentionally NOT skipped: it carries a translatable
  // `placeholder`. Its default text content is empty, so walking it is safe.
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1 };

  function norm(s) {
    return s.replace(/\s+/g, " ").trim();
  }

  function trText(raw) {
    var key = norm(raw);
    if (!key) return null;
    var en = DICT[key];
    if (en == null || en === key) return null;
    var lead = raw.match(/^\s*/)[0];
    var trail = raw.match(/\s*$/)[0];
    return lead + en + trail;
  }

  function walkText(node) {
    var v = node.nodeValue;
    if (!v || !/\S/.test(v)) return;
    var out = trText(v);
    if (out != null && out !== v) node.nodeValue = out;
  }

  function walkEl(el) {
    if (!el.hasAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (el.hasAttribute(a)) {
        var key = norm(el.getAttribute(a));
        var en = DICT[key];
        if (en != null && en !== key) el.setAttribute(a, en);
      }
    }
  }

  function process(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      walkText(root);
      return;
    }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    walkEl(root);
    var w = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: function (n) {
          if (n.nodeType === 1 && SKIP[n.nodeName])
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) walkText(n);
      else walkEl(n);
    }
  }

  var scheduled = false;
  var queue = [];
  function flush() {
    scheduled = false;
    var items = queue;
    queue = [];
    for (var i = 0; i < items.length; i++) process(items[i]);
  }
  function schedule(node) {
    queue.push(node);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  }

  function start() {
    process(document.body);
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "characterData" || m.type === "attributes") {
          schedule(m.target);
        } else {
          for (var j = 0; j < m.addedNodes.length; j++)
            schedule(m.addedNodes[j]);
        }
      }
    });
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
