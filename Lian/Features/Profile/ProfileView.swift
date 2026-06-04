import SwiftUI

struct ProfileView: View {
    @Environment(AppState.self) private var appState
    @State private var characterCount = 0
    @State private var modelCount = 0
    @State private var learningCount = 0

    var body: some View {
        @Bindable var appState = appState

        NavigationStack {
            List {
                Section("数据") {
                    LabeledContent("角色", value: "\(characterCount)")
                    LabeledContent("模型", value: "\(modelCount)")
                    LabeledContent("学习资料", value: "\(learningCount)")
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
                Section("主题") {
                    Picker("外观", selection: $appState.theme) {
                        ForEach(AppTheme.allCases) { theme in
                            Text(theme.title).tag(theme)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: appState.theme) {
                        try? AppRepository.shared.saveSetting(key: "appearance.theme", value: appState.theme.rawValue)
                    }
                }
                Section("关于") {
                    LabeledContent("应用", value: "Lian")
                    LabeledContent("原生版本", value: "1.0")
                    Text("图片功能开关只控制新图片发送，历史图片始终独立显示。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("我的")
            .task { load() }
        }
    }

    private func load() {
        characterCount = (try? AppRepository.shared.characters().count) ?? 0
        modelCount = (try? AppRepository.shared.models().count) ?? 0
        learningCount = (try? AppRepository.shared.learningSources().count) ?? 0
    }
}
