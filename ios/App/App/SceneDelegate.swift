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
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            notifyCapacitorURL(url)
        }
    }
}
