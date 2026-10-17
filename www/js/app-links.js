/* Asteroid on iPhone: website -> app.
 *
 * In a browser on an iPhone or iPad, the home page and the concert pages (pass, lobby,
 * rooms) open the same page in the Asteroid app, keeping ?a= (the artist who shared the
 * link) and ?invite=. Other phones and computers keep the website.
 *
 *  - In-app browsers (Instagram, TikTok, Facebook...) and Chrome on iOS: the app opens
 *    automatically, once per 30 minutes. If it isn't installed, a full screen sheet links to
 *    the App Store. That tap copies the page, so the app's first launch opens it
 *    (referral-deeplink.js) and the artist who shared it still gets the credit.
 *    Coming back within 30 minutes shows a small bar instead, so the website still works.
 *  - Safari: Apple's own banner (the apple-itunes-app meta tag) shows Open or Get, and this
 *    file puts the exact page in its app-argument. Opening the app automatically in Safari
 *    would show an error to people who don't have it.
 *
 * Inside the app this file opens incoming links on the right page: asteroid://open?to=...,
 * www.asteroid8.net links (universal links) and referral links (/r/<code> -> join.html).
 */
(function () {
  var APP_ID = "6752210015";
  var APP_STORE = "https://apps.apple.com/app/id" + APP_ID;
  var OPEN = "asteroid://open?to=";
  var PAGES = /^(index|pass|lively|liveroom[1-5])\.html$/;
  var AUTO_KEY = "astAppHandoff";      // last automatic try (ms), per browser
  var WEB_KEY = "astStayOnWeb";        // "continue on the website" for this visit
  var AUTO_EVERY_MS = 30 * 60 * 1000;
  var WAIT_MS = 1600;                  // still here after this long: the app isn't installed

  var go = window.__astGoForTest || function (url) { window.location.href = url; };

  function isNative() {
    try {
      var C = window.Capacitor;
      return !!(C && typeof C.isNativePlatform === "function" && C.isNativePlatform());
    } catch (e) { return false; }
  }

  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  /** Real Safari shows Apple's app banner; in-app browsers and other iOS browsers don't. */
  function isSafari() {
    var ua = navigator.userAgent || "";
    return /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|FB_IAB|Twitter|Snapchat|TikTok|musical_ly|BytedanceWebview|Line\/|LinkedInApp|Pinterest/i.test(ua);
  }

  /** "pass.html?a=elihu" for a link to one of the pages the app has, else "". */
  function appPage(href) {
    var u;
    try { u = new URL(href, window.location.href); } catch (e) { return ""; }
    var name = u.pathname.split("/").pop() || "index.html";
    if (name.indexOf(".") === -1) name += ".html";   // GitHub Pages serves /pass for pass.html
    if (!PAGES.test(name)) return "";
    return name + u.search;
  }

  function readNum(store, k) { try { return Number(store.getItem(k) || 0); } catch (e) { return 0; } }
  function write(store, k, v) { try { store.setItem(k, v); } catch (e) {} }

  // ---- Inside the app: open incoming links on the right page --------------------------
  if (isNative()) {
    var App = ((window.Capacitor && window.Capacitor.Plugins) || {}).App;

    // Same as referral-deeplink.js, so a referral link works whichever page is open
    var referral = function (code) {
      code = String(code || "").trim();
      if (!code) return "";
      try {
        localStorage.setItem("pending_referral_code", code);
        localStorage.setItem("asteroid_ref", JSON.stringify({ ref: code, ts: Date.now() }));
      } catch (e) {}
      return "join.html?ref=" + encodeURIComponent(code);
    };

    var target = function (url) {
      url = String(url || "");
      if (/^asteroid:/i.test(url)) {
        var q = /^asteroid:\/\/open\/?(\?[^#]*)?/i.exec(url);
        return q ? appPage(new URLSearchParams(q[1] || "").get("to") || "") : "";
      }
      var u;
      try { u = new URL(url); } catch (e) { return ""; }
      if (!/^https?:$/.test(u.protocol) || !/(^|\.)asteroid8\.net$/i.test(u.hostname)) return "";
      var r = u.pathname.match(/^\/r\/([^/?#]+)/);
      if (r) { try { return referral(decodeURIComponent(r[1])); } catch (e) { return ""; } }
      var ref = u.searchParams.get("ref") || u.searchParams.get("referral");
      if (ref) return referral(ref);
      return appPage(u.pathname + u.search);
    };

    var route = function (url) {
      var to = target(url);
      if (!to) return;
      var here = (window.location.pathname.split("/").pop() || "index.html") + window.location.search;
      if (to !== here) go(to);
    };
    window.__astRouteAppLink = route;

    if (App && typeof App.addListener === "function") {
      App.addListener("appUrlOpen", function (e) { route(e && e.url); });
      if (typeof App.getLaunchUrl === "function") {
        App.getLaunchUrl().then(function (l) {
          // This is the last link that opened the app, for as long as the app runs: act on it once
          var url = l && l.url;
          if (!url) return;
          try { if (sessionStorage.getItem("astLaunchUrlDone") === url) return; sessionStorage.setItem("astLaunchUrlDone", url); } catch (e) {}
          route(url);
        }).catch(function () {});
      }
    }
    return;
  }

  // ---- iPhone and iPad browsers: hand off to the app ----------------------------------
  if (!isIOS()) return;
  var page = appPage(window.location.href);
  if (!page) return;
  var deepLink = OPEN + encodeURIComponent(page);
  var name = page.split("?")[0];
  var text = name === "pass.html"
    ? { title: "Claim your pass in the Asteroid app", bar: "Claim your pass in the app" }
    : name === "index.html"
      ? { title: "Asteroid works best in the app", bar: "Asteroid works best in the app" }
      : { title: "Watch concerts in the Asteroid app", bar: "Watch concerts in the app" };

  // Safari's banner: Open goes to this exact page, with the artist and invite
  var meta = document.querySelector('meta[name="apple-itunes-app"]');
  if (meta) meta.setAttribute("content", "app-id=" + APP_ID + ", app-argument=" + deepLink);

  /** The app reads this once on its first launch after installing (referral-deeplink.js). */
  function copyPage() {
    var value = "asteroid-open:" + page;
    var legacy = function () {
      try {
        var ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, value.length);
        document.execCommand("copy");
        ta.remove();
      } catch (e) {}
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(legacy);
        return;
      }
    } catch (e) {}
    legacy();
  }

  /** Open the app here. Still here after WAIT_MS: not installed, so notInstalled() (or the App Store). */
  function openApp(fromTap, notInstalled) {
    var left = false;
    var mark = function () { if (document.hidden) left = true; };
    var gone = function () { left = true; };
    document.addEventListener("visibilitychange", mark);
    window.addEventListener("pagehide", gone);
    if (fromTap) copyPage();
    go(deepLink);
    setTimeout(function () {
      document.removeEventListener("visibilitychange", mark);
      window.removeEventListener("pagehide", gone);
      if (left || document.hidden) return;
      if (notInstalled) notInstalled(); else go(APP_STORE);
    }, WAIT_MS);
  }
  window.__astOpenApp = openApp;

  var FONT = "Montserrat,Poppins,system-ui,-apple-system,sans-serif";
  var BTN = "border:0;border-radius:999px;background:#ff7f50;color:#fff;cursor:pointer;font-family:" + FONT + ";";

  /** Not installed: a full screen sheet with the App Store link, and the website as a choice. */
  function showSheet() {
    if (document.getElementById("astAppSheet")) return;
    var sheet = document.createElement("div");
    sheet.id = "astAppSheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "astSheetTitle");
    sheet.style.cssText = "position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;" +
      "padding:24px 16px calc(24px + env(safe-area-inset-bottom));background:rgba(9,9,13,.96);color:#fff;font-family:" + FONT + ";" +
      "-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)";
    sheet.innerHTML =
      '<div style="width:100%;max-width:360px;text-align:center">' +
        '<img src="astei.png" alt="" width="88" height="88" style="display:block;margin:0 auto 22px;border-radius:22px;box-shadow:0 10px 40px rgba(255,127,80,.35)">' +
        '<h2 id="astSheetTitle" style="margin:0 0 10px;font:800 24px/1.2 ' + FONT + ';letter-spacing:-.01em"></h2>' +
        '<p style="margin:0 0 26px;font:500 15px/1.4 ' + FONT + ';color:rgba(255,255,255,.65)">Free on the App Store.</p>' +
        '<button type="button" id="astSheetOpen" style="' + BTN + 'display:block;width:100%;min-height:54px;font-size:17px;font-weight:800;box-shadow:0 8px 26px rgba(255,127,80,.4)">Open in the app</button>' +
        '<button type="button" id="astSheetWeb" style="display:block;margin:18px auto 0;border:0;background:none;color:rgba(255,255,255,.6);font:600 14px ' + FONT + ';padding:8px 12px;cursor:pointer;text-decoration:underline;text-underline-offset:3px">Continue on the website</button>' +
      '</div>';
    sheet.querySelector("#astSheetTitle").textContent = text.title;
    document.body.appendChild(sheet);
    var overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    var openBtn = document.getElementById("astSheetOpen");
    openBtn.addEventListener("click", function () {
      openBtn.textContent = "Opening…";
      openApp(true);
      setTimeout(function () { openBtn.textContent = "Open in the app"; }, WAIT_MS + 1500);
    });
    document.getElementById("astSheetWeb").addEventListener("click", function () {
      write(sessionStorage, WEB_KEY, "1");
      sheet.remove();
      document.body.style.overflow = overflow;
    });
    sheet.setAttribute("tabindex", "-1");
    sheet.style.outline = "none";
    try { sheet.focus({ preventScroll: true }); } catch (e) {}
  }

  /** Tried recently: a small bar instead, so the website still works. */
  function showBar() {
    if (document.getElementById("astAppBar")) return;
    var bar = document.createElement("div");
    bar.id = "astAppBar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Asteroid app");
    bar.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:100000;display:flex;align-items:center;gap:10px;" +
      "padding:max(10px,env(safe-area-inset-top)) 12px 10px;background:#15161c;border-bottom:1px solid rgba(255,127,80,.45);" +
      "font:600 13px/1.3 " + FONT + ";color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.4)";
    bar.innerHTML = '<img src="astei.png" alt="" width="30" height="30" style="flex:none;border-radius:8px">' +
      '<span id="astAppBarText" style="flex:1;min-width:0"></span>' +
      '<button type="button" id="astAppOpen" style="' + BTN + 'flex:none;font-size:13px;font-weight:700;padding:8px 14px">Open the app</button>' +
      '<button type="button" id="astAppClose" aria-label="Stay on the website" style="flex:none;border:0;background:none;color:rgba(255,255,255,.6);font-size:22px;line-height:1;padding:4px 6px;cursor:pointer">&times;</button>';
    bar.querySelector("#astAppBarText").textContent = text.bar;
    document.body.appendChild(bar);
    var pushed = document.body.style.marginTop;
    document.body.style.marginTop = bar.offsetHeight + "px";   // keep the page header visible
    document.getElementById("astAppOpen").addEventListener("click", function () { openApp(true); });
    document.getElementById("astAppClose").addEventListener("click", function () {
      write(sessionStorage, WEB_KEY, "1");
      bar.remove();
      document.body.style.marginTop = pushed;
    });
  }

  var stayOnWeb = /[?&]web=1(&|$)/.test(window.location.search) || readNum(sessionStorage, WEB_KEY) > 0;
  if (isSafari() || stayOnWeb) return;   // Safari: Apple's banner does this

  function start() {
    if (Date.now() - readNum(localStorage, AUTO_KEY) >= AUTO_EVERY_MS) {
      write(localStorage, AUTO_KEY, String(Date.now()));
      openApp(false, showSheet);
    } else {
      showBar();
    }
  }
  // After the page is parsed, so trying the app never cuts the page load short
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
