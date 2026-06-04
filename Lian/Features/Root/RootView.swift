import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState
    @State private var showingSplash = true

    var body: some View {
        @Bindable var appState = appState

        ZStack {
            selectedView
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if !appState.isDockHidden {
                        LianDock(selection: $appState.selectedSection)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }

            if showingSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(10)
            }
        }
        .preferredColorScheme(appState.theme.colorScheme)
        .task {
            try? await Task.sleep(for: .milliseconds(1450))
            withAnimation(.easeOut(duration: 0.35)) {
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

    @ViewBuilder
    private var selectedView: some View {
        switch appState.selectedSection {
        case .learning: LearningCenterView()
        case .characters: CharacterListView()
        case .chat: ChatHomeView()
        case .models: ModelListView()
        case .profile: ProfileView()
        }
    }
}

private struct LianDock: View {
    @Environment(AppState.self) private var appState
    @Binding var selection: AppSection

    var body: some View {
        HStack(spacing: 4) {
            ForEach(AppSection.allCases) { section in
                Button {
                    appState.isDockHidden = false
                    selection = section
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 21, weight: .semibold))
                        Text(section.title)
                            .font(.caption2.weight(.semibold))
                    }
                    .foregroundStyle(selection == section ? Color.pink : Color.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background {
                        if selection == section {
                            Capsule().fill(.quaternary)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(7)
        .background(.regularMaterial, in: Capsule())
        .padding(.horizontal, 18)
        .padding(.vertical, 7)
    }
}

private struct SplashView: View {
    @State private var animated = false

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()
            ZStack {
                RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .stroke(Color.pink.opacity(0.9), lineWidth: 22)
                    .frame(width: 128, height: 78)
                    .rotationEffect(.degrees(animated ? 35 : -15))
                    .offset(x: animated ? -14 : -25, y: -12)
                RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .stroke(Color.teal.opacity(0.9), lineWidth: 22)
                    .frame(width: 128, height: 78)
                    .rotationEffect(.degrees(animated ? -35 : 15))
                    .offset(x: animated ? 14 : 25, y: 12)
            }
            .scaleEffect(animated ? 1 : 0.72)
            .opacity(animated ? 1 : 0)
            .blur(radius: animated ? 0 : 8)
        }
        .onAppear {
            withAnimation(.spring(response: 0.75, dampingFraction: 0.72)) {
                animated = true
            }
        }
    }
}
