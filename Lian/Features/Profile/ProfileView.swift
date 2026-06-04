import SwiftUI

struct ProfileView: View {
    @Environment(AppState.self) private var appState
    @Environment(NavigationRouter.self) private var router
    @State private var characterCount = 0
    @State private var modelCount = 0
    @State private var learningCount = 0

    var body: some View {
        @Bindable var appState = appState

        List {
            Section {
                HStack {
                    Label("主题", systemImage: "circle.lefthalf.filled")
                    Spacer()
                    Menu {
                        Picker("主题", selection: $appState.theme) {
                            ForEach(AppTheme.allCases) { theme in
                                Text(theme.title).tag(theme)
                            }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Text(appState.theme.title)
                            Image(systemName: "chevron.up.chevron.down")
                        }
                        .foregroundStyle(.secondary)
                    }
                }
                .onChange(of: appState.theme) {
                    try? AppRepository.shared.saveSetting(key: "appearance.theme", value: appState.theme.rawValue)
                }
            }

            Section("数据") {
                LabeledContent("角色", value: "\(characterCount)")
                LabeledContent("模型", value: "\(modelCount)")
                LabeledContent("学习资料", value: "\(learningCount)")
            }

            Section("关于") {
                Button {
                    router.push(AboutAppView())
                } label: {
                    HStack {
                        Label("应用", systemImage: "info.circle")
                        Spacer()
                        Text("Lian")
                            .foregroundStyle(.secondary)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                .foregroundStyle(.primary)
            }
        }
        .navigationTitle("我的")
        .task { load() }
    }

    private func load() {
        characterCount = (try? AppRepository.shared.characters().count) ?? 0
        modelCount = (try? AppRepository.shared.models().count) ?? 0
        learningCount = (try? AppRepository.shared.learningSources().count) ?? 0
    }
}

private struct AboutAppView: View {
    var body: some View {
        List {
            Section("应用") {
                LabeledContent("名称", value: "Lian")
                LabeledContent("原生版本", value: "1.0")
            }
            Section("存储") {
                LabeledContent("数据库", value: "SQLite")
                LabeledContent("图片附件", value: "Application Support")
                LabeledContent("API Key", value: "Keychain")
                if let databaseURL = DatabaseClient.shared.databaseURL {
                    ShareLink(item: databaseURL) {
                        Label("导出 SQLite 备份", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
        .navigationTitle("应用")
        .navigationBarTitleDisplayMode(.inline)
    }
}
