/* Referral deep-link handler (Capacitor native only).
 *
 * Two sources, one destination - join.html?ref=<slug>:
 *   1. Branch - handles BOTH the installed-app tap AND the deferred case
 *      (tap link -> App Store -> install -> first launch still gets the code).
 *      Requires the Branch native plugin; no-ops gracefully until it's added.
 *   2. Your own /r/<slug> universal links via the Capacitor App plugin - 
 *      a fallback for the already-installed case.
 *
 * The web (non-native) path is untouched: referral-system.js already reads
 * ?ref= from the URL there.
 */
(function () {
  function isNative() {
    try {
      return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
    } catch (_) { return false; }
  }
  if (!isNative()) return;

  function applyReferral(slug) {
    slug = (slug == null ? "" : String(slug)).trim();
    if (!slug) return false;
    try {
      localStorage.setItem("pending_referral_code", slug);
      localStorage.setItem("asteroid_ref", JSON.stringify({ ref: slug, ts: Date.now() }));
    } catch (_) {}
    // Avoid a pointless reload if we're already on the join page with this ref.
    var onJoin = /\/join(\.html)?$/i.test(location.pathname);
    var current = new URLSearchParams(location.search).get("ref");
    if (!(onJoin && current === slug)) {
      location.href = "join.html?ref=" + encodeURIComponent(slug);
    }
    return true;
  }

  function refFromParams(p) {
    if (!p || typeof p !== "object") return "";
    return p.ref || p.referral || p.referralCode || p.referral_code || "";
  }
  function refFromUrl(url) {
    if (!url) return "";
    try {
      var u = new URL(url);
      var m = u.pathname.match(/^\/r\/([^/?#]+)/);
      if (m) return decodeURIComponent(m[1]);
      return u.searchParams.get("ref") || u.searchParams.get("referral") || "";
    } catch (_) { return ""; }
  }

  var P = (window.Capacitor && window.Capacitor.Plugins) || {};

  // 1) Branch: installed + deferred deep links.
  var Branch = P.BranchDeepLinks;
  if (Branch && typeof Branch.addListener === "function") {
    Branch.addListener("init", function (e) {
      var p = (e && e.referringParams) || {};
      // Act only on a real Branch link click / deferred install.
      if (p["+clicked_branch_link"] === true || refFromParams(p)) {
        applyReferral(refFromParams(p));
      }
    });
    Branch.addListener("initError", function (e) {
      try { console.warn("[referral-deeplink] Branch init error:", e); } catch (_) {}
    });
  }

  // 2) Fallback: your own /r/<slug> universal links via the App plugin.
  var App = P.App;
  if (App && typeof App.addListener === "function") {
    App.addListener("appUrlOpen", function (e) { applyReferral(refFromUrl(e && e.url)); });
    if (typeof App.getLaunchUrl === "function") {
      App.getLaunchUrl().then(function (l) { if (l && l.url) applyReferral(refFromUrl(l.url)); }).catch(function () {});
    }
  }

  // 3) Deferred deep link via clipboard (free, for fresh App Store installs).
  //    Read once on a likely-fresh install, to limit the iOS paste banner.
  var Clipboard = P.Clipboard;
  if (Clipboard && typeof Clipboard.read === "function") {
    var skip = false;
    try {
      skip = localStorage.getItem("_deferredRefChecked") === "1"
          || !!localStorage.getItem("pending_referral_code")
          || localStorage.getItem("asteroidSignedInBefore") === "true"
          || localStorage.getItem("isLoggedIn") === "true";
    } catch (_) {}
    if (!skip) {
      try { localStorage.setItem("_deferredRefChecked", "1"); } catch (_) {}
      Clipboard.read().then(function (res) {
        var m = String((res && res.value) || "").match(/^asteroid-ref:([A-Za-z0-9_-]+)$/);
        if (m) {
          try { if (typeof Clipboard.write === "function") Clipboard.write({ string: "" }); } catch (_) {}
          applyReferral(m[1]);
        }
      }).catch(function () {});
    }
  }
})();
