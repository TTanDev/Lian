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
    @State private var curtainsMeet = false
    @State private var iconAppeared = false

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()
            WaterCurtain(colors: [.pink.opacity(0.08), .pink.opacity(0.9), .white.opacity(0.8)])
                .rotationEffect(.degrees(curtainsMeet ? 42 : 8))
                .offset(x: curtainsMeet ? -26 : -320, y: curtainsMeet ? -12 : -180)
                .blur(radius: curtainsMeet ? 3 : 14)
                .opacity(iconAppeared ? 0 : 1)
            WaterCurtain(colors: [.teal.opacity(0.08), .teal.opacity(0.9), .white.opacity(0.8)])
                .rotationEffect(.degrees(curtainsMeet ? -42 : -8))
                .offset(x: curtainsMeet ? 26 : 320, y: curtainsMeet ? 12 : 180)
                .blur(radius: curtainsMeet ? 3 : 14)
                .opacity(iconAppeared ? 0 : 1)
            Image("SplashIcon")
                .resizable()
                .scaledToFit()
                .frame(width: 190, height: 190)
                .clipShape(RoundedRectangle(cornerRadius: 42, style: .continuous))
                .shadow(color: .pink.opacity(iconAppeared ? 0.18 : 0), radius: 24)
                .scaleEffect(iconAppeared ? 1 : 0.78)
                .opacity(iconAppeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.78, dampingFraction: 0.82)) {
                curtainsMeet = true
            }
            Task {
                try? await Task.sleep(for: .milliseconds(620))
                withAnimation(.easeInOut(duration: 0.32)) {
                    iconAppeared = true
                }
            }
        }
    }
}

private struct WaterCurtain: View {
    let colors: [Color]

    var body: some View {
        Capsule()
            .fill(
                LinearGradient(
                    colors: colors,
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: 410, height: 92)
            .overlay {
                Capsule()
                    .stroke(.white.opacity(0.55), lineWidth: 2)
                    .blur(radius: 1)
            }
            .shadow(color: colors[1].opacity(0.35), radius: 22)
    }
}
