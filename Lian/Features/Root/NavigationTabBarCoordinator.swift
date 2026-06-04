import SwiftUI
import UIKit

struct NavigationTabBarCoordinator: UIViewControllerRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> ProbeViewController {
        let controller = ProbeViewController()
        controller.onNavigationController = { navigationController in
            context.coordinator.install(on: navigationController)
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: ProbeViewController, context: Context) {
        uiViewController.onNavigationController = { navigationController in
            context.coordinator.install(on: navigationController)
        }
        uiViewController.resolveNavigationController()
    }

    final class Coordinator: NSObject, UINavigationControllerDelegate {
        private weak var navigationController: UINavigationController?
        private var previousDelegate: UINavigationControllerDelegate?

        func install(on navigationController: UINavigationController) {
            guard self.navigationController !== navigationController else { return }
            self.navigationController = navigationController
            previousDelegate = navigationController.delegate
            navigationController.delegate = self
        }

        override func responds(to aSelector: Selector!) -> Bool {
            super.responds(to: aSelector) || previousDelegate?.responds(to: aSelector) == true
        }

        override func forwardingTarget(for aSelector: Selector!) -> Any? {
            if previousDelegate?.responds(to: aSelector) == true {
                return previousDelegate
            }
            return super.forwardingTarget(for: aSelector)
        }

        func navigationController(
            _ navigationController: UINavigationController,
            willShow viewController: UIViewController,
            animated: Bool
        ) {
            let isRoot = navigationController.viewControllers.first === viewController
            viewController.hidesBottomBarWhenPushed = !isRoot

            guard let tabBar = navigationController.tabBarController?.tabBar else { return }
            let changes = {
                tabBar.alpha = isRoot ? 1 : 0
                tabBar.superview?.layoutIfNeeded()
            }
            if let coordinator = navigationController.transitionCoordinator {
                coordinator.animate(alongsideTransition: { _ in changes() }) { context in
                    if context.isCancelled {
                        tabBar.alpha = isRoot ? 0 : 1
                    }
                }
            } else {
                changes()
            }
            previousDelegate?.navigationController?(
                navigationController,
                willShow: viewController,
                animated: animated
            )
        }
    }
}

final class ProbeViewController: UIViewController {
    var onNavigationController: ((UINavigationController) -> Void)?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        resolveNavigationController()
    }

    override func didMove(toParent parent: UIViewController?) {
        super.didMove(toParent: parent)
        resolveNavigationController()
    }

    func resolveNavigationController() {
        DispatchQueue.main.async { [weak self] in
            guard let navigationController = self?.navigationController else { return }
            self?.onNavigationController?(navigationController)
        }
    }
}
