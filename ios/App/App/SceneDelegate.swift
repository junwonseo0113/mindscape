import UIKit
import Capacitor
import WidgetKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let controller = MindscapeBridgeViewController()
        window?.rootViewController = controller
        controller.loadViewIfNeeded()
        for context in connectionOptions.urlContexts {
            if controller.handleWidgetURL(context.url) { break }
        }
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        let controller = window?.rootViewController as? MindscapeBridgeViewController
        let remaining = URLContexts.filter { controller?.handleWidgetURL($0.url) != true }
        if !remaining.isEmpty { SceneDelegateProxy.shared.scene(scene, openURLContexts: remaining) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}


private final class MindscapeBridgeViewController: CAPBridgeViewController {
    private let widget = MindscapeWidgetPlugin()

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(widget)
    }

    func handleWidgetURL(_ url: URL) -> Bool {
        guard url.scheme == "mindscape", url.host == "widget" else { return false }
        let action: String
        switch url.path {
        case "/write": action = "write"
        case "/diary": action = "diary"
        case "/journey": action = "journey"
        default: return false
        }
        widget.notifyListeners("openWidget", data: ["action": action], retainUntilConsumed: true)
        return true
    }
}

@objc(MindscapeWidgetPlugin)
final class MindscapeWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "MindscapeWidgetPlugin"
    let jsName = "MindscapeWidget"
    let pluginMethods = [CAPPluginMethod(name: "syncJourney", returnType: CAPPluginReturnPromise)]

    @objc func syncJourney(_ call: CAPPluginCall) {
        let hasAspiration = call.getBool("hasAspiration") ?? false
        let score = call.getInt("score").flatMap { (0...100).contains($0) ? $0 : nil }
        let change = call.getInt("weekChange").flatMap { (-100...100).contains($0) ? $0 : nil }
        let snapshot = JourneyWidgetSnapshot(
            hasAspiration: hasAspiration,
            score: hasAspiration ? score : nil,
            weekChange: hasAspiration && score != nil ? change : nil
        )
        if snapshot.saveIfChanged() {
            WidgetCenter.shared.reloadTimelines(ofKind: JourneyWidgetSnapshot.kind)
        }
        call.resolve()
    }
}
