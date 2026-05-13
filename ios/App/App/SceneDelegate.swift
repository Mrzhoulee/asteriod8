import UIKit
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    private func notifyCapacitorURL(_ url: URL) {
        NotificationCenter.default.post(
            name: Notification.Name("CapacitorOpenURLNotification"),
            object: ["url": url, "options": [:] as [UIApplication.OpenURLOptionsKey: Any]]
        )
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        if window == nil {
            window = windowScene.windows.first
        }
        if window == nil {
            let storyboard = UIStoryboard(name: "Main", bundle: nil)
            let window = UIWindow(windowScene: windowScene)
            window.rootViewController = storyboard.instantiateInitialViewController()
            window.makeKeyAndVisible()
            self.window = window
         } else {
            window?.windowScene = windowScene
            window?.makeKeyAndVisible()
        }

        if let urlContext = connectionOptions.urlContexts.first {
            notifyCapacitorURL(urlContext.url)
        }

        // iOS 16.4+: WKWebView is not Safari-inspectable unless isInspectable is true ("No inspectable applications").
        for delay in [0.8, 2.5] as [Double] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                Self.setCapacitorWebViewInspectable(self?.window)
            }
        }
    }

    private static func findWKWebView(in view: UIView?) -> WKWebView? {
        guard let view = view else { return nil }
        if let wk = view as? WKWebView { return wk }
        for sub in view.subviews {
            if let found = findWKWebView(in: sub) { return found }
        }
        return nil
    }

    private static func setCapacitorWebViewInspectable(_ window: UIWindow?) {
        guard let root = window?.rootViewController else { return }
        guard let webView = findWKWebView(in: root.view) else { return }
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            notifyCapacitorURL(url)
        }
    }

    // Universal links (https://www.asteroid8.net/r/*, /t/*, /u/*) arrive via
    // NSUserActivity.browsingWeb. Route the WKWebView to the matching in-app path.
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
              let url = userActivity.webpageURL else { return }
        routeUniversalLink(url)
    }

    private func routeUniversalLink(_ url: URL) {
        guard let host = url.host, host.hasSuffix("asteroid8.net") else {
            notifyCapacitorURL(url)
            return
        }
        let path = url.path
        let known = ["/r/", "/t/", "/u/"]
        guard known.contains(where: { path.hasPrefix($0) }) else {
            notifyCapacitorURL(url)
            return
        }
        // Hand to Capacitor — the web layer will navigate via its router or
        // by calling window.location with the same URL.
        if let webView = Self.findWKWebView(in: window?.rootViewController?.view) {
            let request = URLRequest(url: url)
            webView.load(request)
        } else {
            // WKWebView not yet attached — buffer until launch finishes
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                if let webView = Self.findWKWebView(in: self?.window?.rootViewController?.view) {
                    webView.load(URLRequest(url: url))
                } else {
                    self?.notifyCapacitorURL(url)
                }
            }
        }
    }
}
