import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState
    @State private var showingSplash = true

    var body: some View {
        @Bindable var appState = appState

        ZStack {
            NativeTabContainer(appState: appState)
                .ignoresSafeArea()

            if showingSplash {
                SplashView()
                    .zIndex(10)
            }
        }
        .preferredColorScheme(appState.theme.colorScheme)
        .task {
            try? await Task.sleep(for: .milliseconds(900))
            showingSplash = false
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
    var body: some View {
        VStack(spacing: 14) {
            Image("SplashIcon")
                .resizable()
                .scaledToFit()
                .frame(width: 156, height: 156)
                .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
            Text("Lian")
                .font(.title2.bold())
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemBackground))
    }
}
