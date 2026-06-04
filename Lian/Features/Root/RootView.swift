import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState
    @State private var showingSplash = true

    var body: some View {
        @Bindable var appState = appState

        ZStack {
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

            if showingSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(10)
            }
        }
        .preferredColorScheme(appState.theme.colorScheme)
        .task {
            try? await Task.sleep(for: .milliseconds(1250))
            withAnimation(.easeOut(duration: 0.3)) {
                showingSplash = false
            }
        }
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

private struct SplashView: View {
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()
            Image("SplashIcon")
                .resizable()
                .scaledToFit()
                .frame(width: 150, height: 150)
                .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
                .shadow(color: .pink.opacity(appeared ? 0.24 : 0), radius: appeared ? 26 : 4)
                .scaleEffect(appeared ? 1 : 0.9)
                .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.55)) {
                appeared = true
            }
        }
    }
}
