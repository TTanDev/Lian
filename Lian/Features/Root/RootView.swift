import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState

        TabView(selection: $appState.selectedSection) {
            LearningCenterView()
                .tabItem { Label(AppSection.learning.title, systemImage: AppSection.learning.symbol) }
                .tag(AppSection.learning)

            CharacterListView()
                .tabItem { Label(AppSection.characters.title, systemImage: AppSection.characters.symbol) }
                .tag(AppSection.characters)

            ChatHomeView()
                .tabItem { Label(AppSection.chat.title, systemImage: AppSection.chat.symbol) }
                .tag(AppSection.chat)

            ModelListView()
                .tabItem { Label(AppSection.models.title, systemImage: AppSection.models.symbol) }
                .tag(AppSection.models)

            ProfileView()
                .tabItem { Label(AppSection.profile.title, systemImage: AppSection.profile.symbol) }
                .tag(AppSection.profile)
        }
        .tint(.pink)
        .alert(
            "数据库初始化失败",
            isPresented: Binding(
                get: { appState.startupError != nil },
                set: { isPresented in
                    if !isPresented {
                        appState.startupError = nil
                    }
                }
            )
        ) {
            Button("好", role: .cancel) {}
        } message: {
            Text(appState.startupError ?? "未知错误")
        }
    }
}
