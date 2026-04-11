(function () {
  function sanitizeKey(s) {
    return String(s || "")
      .trim()
      .replace(/[.#$[\]]/g, "_");
  }

  function authActiveUserId() {
    var u =
      localStorage.getItem("userEmail") ||
      localStorage.getItem("email") ||
      localStorage.getItem("CurrentUser") ||
      "";
    return sanitizeKey(u) || "guest";
  }

  /** Prefix a localStorage name with the active user id (safe for keys). */
  function authScopedKey(name) {
    return name + "_" + authActiveUserId();
  }

  /**
   * Same idea as authScopedKey; matches the requested pattern base + "_" + user.
   * Example: songs_<userId> → use authUserStorageKey("songs")
   */
  function authUserStorageKey(base) {
    return base + "_" + authActiveUserId();
  }

  function storedSessionUserId() {
    var id = (
      localStorage.getItem("CurrentUser") ||
      localStorage.getItem("email") ||
      localStorage.getItem("userEmail") ||
      localStorage.getItem("artemail") ||
      ""
    ).trim();
    if (id === "null" || id === "undefined") return "";
    return id;
  }

  function isSessionValid() {
    if (localStorage.getItem("isLoggedIn") === "true") return true;
    if (localStorage.getItem("localAuthOnly") === "1" && storedSessionUserId()) return true;
    if (localStorage.getItem("asteroidSignedInBefore") === "true") {
      return !!storedSessionUserId();
    }
    return false;
  }

  function requireAuth() {
    if (!isSessionValid()) {
      window.location.replace("login.html");
    }
  }

  function authLogout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    if (localStorage.getItem("localAuthOnly") === "1") {
      localStorage.removeItem("localAuthOnly");
      ["email", "CurrentUser", "fullName", "asteroidSignedInBefore", "emailKey", "pfp", "name"].forEach(function (k) {
        localStorage.removeItem(k);
      });
    }
    window.location.replace("login.html");
  }

  window.authScopedKey = authScopedKey;
  window.authUserStorageKey = authUserStorageKey;
  window.authActiveUserId = authActiveUserId;
  window.isSessionValid = isSessionValid;
  window.requireAuth = requireAuth;
  window.authLogout = authLogout;
})();
