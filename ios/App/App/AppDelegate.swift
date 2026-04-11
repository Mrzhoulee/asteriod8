import Foundation
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        clearStaleCapacitorWebRootIfNeeded()
        return true
    }

    /// Live Reload stores a Library snapshot path; if that folder is gone, Capacitor can fail to load the web app.
    private func clearStaleCapacitorWebRootIfNeeded() {
        guard let persisted = KeyValueStore.standard["serverBasePath", as: String.self], !persisted.isEmpty,
              let lib = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true).first else { return }
        let lastComponent = Foundation.URL(fileURLWithPath: persisted, isDirectory: true).lastPathComponent
        let snapshotDir = Foundation.URL(fileURLWithPath: lib, isDirectory: true)
            .appendingPathComponent("NoCloud", isDirectory: true)
            .appendingPathComponent("ionic_built_snapshots", isDirectory: true)
            .appendingPathComponent(lastComponent)
        var isDir: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: snapshotDir.path, isDirectory: &isDir)
        if !exists || !isDir.boolValue {
            KeyValueStore.standard["serverBasePath"] = nil as String?
        }
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        // Ensure the scene delegate is wired even if Info.plist substitution fails for UISceneDelegateClassName.
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
