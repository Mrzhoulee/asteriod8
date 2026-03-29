import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    private func notifyCapacitorURL(_ url: URL) {
        NotificationCenter.default.post(
            name: Notification.Name("CapacitorOpenURLNotification"),
            object: ["url": url, "options": [:] as [UIApplication.OpenURLOptionsKey: Any]]
        )
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let _ = (scene as? UIWindowScene) else { return }
        if let urlContext = connectionOptions.urlContexts.first {
            notifyCapacitorURL(urlContext.url)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            notifyCapacitorURL(url)
        }
    }
}
