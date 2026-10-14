// PROWORLD site — the page strip: one menu across every page of the site.
// Include after shared/pages.js:  <script src="../shared/menu.js" data-root="../"></script>
// data-root is the path back to the site root from the page that includes it ("./" on the Dashboard, "../" under /marketing/).
(function () {
  "use strict";
  const me = document.currentScript; const root = (me && me.getAttribute("data-root")) || "./";
  const P = window.PW_PAGES; if (!P) return;
  const css = [
    ".pw-strip{background:#000;color:#fff;border-bottom:1px solid #222;font-family:\"Aeonik Pro\",\"Helvetica Neue\",Arial,sans-serif;-webkit-font-smoothing:antialiased}",
    ".pw-strip .in{max-width:1380px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:4px;height:40px;overflow-x:auto;scrollbar-width:none}",
    ".pw-strip .in::-webkit-scrollbar{display:none}",
    "@media(max-width:640px){.pw-strip .in{padding:0 16px}}",
    ".pw-strip .mark{font-family:\"Review Condensed\",\"Barlow Condensed\",\"Arial Narrow\",Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:17px;letter-spacing:.5px;color:#E2FE78;text-decoration:none;margin-right:14px;white-space:nowrap;line-height:1;padding-top:2px}",
    ".pw-strip a.it{color:#c9cbc2;text-decoration:none;font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;padding:0 10px;height:40px;display:inline-flex;align-items:center;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-1px}",
    ".pw-strip a.it:hover{color:#fff}",
    ".pw-strip a.it.on{color:#fff;border-bottom-color:#E2FE78}",
    ".pw-strip .sp{flex:1}",
    ".pw-strip a.all{color:#E2FE78;text-decoration:none;font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;white-space:nowrap;padding-left:10px}",
    ".pw-strip a.all:hover{text-decoration:underline}"
  ].join("");
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const here = location.pathname.replace(/index\.html$/, "");
  const siteRoot = new URL(root, location.href).pathname;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const items = [{ name: "Dashboard", href: root, on: here === siteRoot }].concat(
    P.PAGES.filter((p) => p.menu).map((p) => ({
      name: p.id === "mkt" ? "Marketing" : p.id === "coach-portal" ? "Coach Portal" : p.name,
      href: p.self ? root + p.url : p.url, ext: !p.self,
      on: p.self && here === new URL(root + p.url, location.href).pathname
    }))
  );
  const el = document.createElement("div"); el.className = "pw-strip"; el.setAttribute("role", "navigation"); el.setAttribute("aria-label", "PROWORLD pages");
  el.innerHTML = '<div class="in"><a class="mark" href="' + esc(root) + '">PROWORLD</a>' + items.map((i) => '<a class="it' + (i.on ? " on" : "") + '" href="' + esc(i.href) + '"' + (i.ext ? ' target="_blank" rel="noopener"' : "") + (i.on ? ' aria-current="page"' : "") + ">" + esc(i.name) + "</a>").join("") + '<span class="sp"></span><a class="all" href="' + esc(root) + '">All pages →</a></div>';
  const mount = () => { document.body.insertBefore(el, document.body.firstChild); };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
