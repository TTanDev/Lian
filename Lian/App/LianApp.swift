import SwiftUI

@main
struct LianApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .task {
                    await appState.start()
                }
        }
    }
}
