import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class NavigationRouter {
    weak var navigationController: UINavigationController?
    private let appState: AppState

    init(appState: AppState) {
        self.appState = appState
    }

    func push<Content: View>(_ content: Content) {
        let controller = UIHostingController(
            rootView: AnyView(content.environment(self).environment(appState))
        )
        controller.hidesBottomBarWhenPushed = true
        navigationController?.pushViewController(controller, animated: true)
    }
}

struct NativeTabContainer: UIViewControllerRepresentable {
    let appState: AppState

    func makeCoordinator() -> Coordinator {
        Coordinator(appState: appState)
    }

    func makeUIViewController(context: Context) -> UITabBarController {
        let tabController = UITabBarController()
        tabController.delegate = context.coordinator
        tabController.viewControllers = AppSection.allCases.map { section in
            let router = NavigationRouter(appState: appState)
            let root = rootView(section: section, router: router)
            let hostingController = UIHostingController(rootView: root)
            hostingController.title = section.title
            let navigationController = CoordinatedNavigationController(rootViewController: hostingController)
            navigationController.tabBarItem = UITabBarItem(
                title: section.title,
                image: UIImage(systemName: section.symbol),
                selectedImage: UIImage(systemName: section.symbol)
            )
            router.navigationController = navigationController
            context.coordinator.routers[section] = router
            return navigationController
        }
        tabController.selectedIndex = AppSection.allCases.firstIndex(of: appState.selectedSection) ?? 2
        applyTheme(to: tabController)
        return tabController
    }

    func updateUIViewController(_ tabController: UITabBarController, context: Context) {
        let index = AppSection.allCases.firstIndex(of: appState.selectedSection) ?? 2
        if tabController.selectedIndex != index {
            tabController.selectedIndex = index
        }
        applyTheme(to: tabController)
    }

    private func rootView(section: AppSection, router: NavigationRouter) -> AnyView {
        let content: AnyView
        switch section {
        case .learning: content = AnyView(LearningCenterView())
        case .characters: content = AnyView(CharacterListView())
        case .chat: content = AnyView(ChatHomeView())
        case .models: content = AnyView(ModelListView())
        case .profile: content = AnyView(ProfileView())
        }
        return AnyView(content.environment(router).environment(appState))
    }

    private func applyTheme(to controller: UIViewController) {
        controller.overrideUserInterfaceStyle = switch appState.theme {
        case .system: .unspecified
        case .light: .light
        case .dark: .dark
        }
    }

    @MainActor
    final class Coordinator: NSObject, UITabBarControllerDelegate {
        let appState: AppState
        var routers: [AppSection: NavigationRouter] = [:]

        init(appState: AppState) {
            self.appState = appState
        }

        func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
            guard AppSection.allCases.indices.contains(tabBarController.selectedIndex) else { return }
            appState.selectedSection = AppSection.allCases[tabBarController.selectedIndex]
        }
    }
}

private final class CoordinatedNavigationController: UINavigationController, UINavigationControllerDelegate {
    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
    }

    override func pushViewController(_ viewController: UIViewController, animated: Bool) {
        viewController.hidesBottomBarWhenPushed = !viewControllers.isEmpty
        super.pushViewController(viewController, animated: animated)
    }

    func navigationController(
        _ navigationController: UINavigationController,
        willShow viewController: UIViewController,
        animated: Bool
    ) {
        viewController.hidesBottomBarWhenPushed = viewController !== viewControllers.first
    }
}
