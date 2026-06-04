import SwiftUI

struct LearningCenterView: View {
    @State private var sources: [LearningSource] = []
    @State private var characters: [CharacterProfile] = []
    @State private var models: [APIModel] = []
    @State private var showingEditor = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            ForEach(charactersWithSources) { character in
                Section {
                    ForEach(sources.filter { $0.characterID == character.id }) { source in
                        LearningSourceRow(
                            source: source,
                            modelName: models.first(where: { $0.id == source.modelID })?.displayName,
                            onRetry: { retry(source) }
                        )
                        .swipeActions {
                            Button("删除", systemImage: "trash", role: .destructive) {
                                delete(source)
                            }
                        }
                    }
                } header: {
                    Label(character.name, systemImage: "person.crop.circle")
                }
            }
        }
        .overlay {
            if sources.isEmpty {
                ContentUnavailableView("还没有学习资料", systemImage: "brain.head.profile", description: Text("添加文字或图片，让角色真正学会新资料"))
            }
        }
        .navigationTitle("学习")
        .toolbar {
            Button("添加资料", systemImage: "plus") {
                showingEditor = true
            }
            .disabled(characters.isEmpty || models.isEmpty)
        }
        .sheet(isPresented: $showingEditor) {
            LearningSourceEditorView(characters: characters) {
                load()
            }
        }
        .task { load() }
        .alert("操作失败", isPresented: .constant(errorMessage != nil)) {
            Button("好") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var charactersWithSources: [CharacterProfile] {
        characters.filter { character in
            sources.contains { $0.characterID == character.id }
        }
    }

    private func load() {
        do {
            sources = try AppRepository.shared.learningSources()
            characters = try AppRepository.shared.characters()
            models = try AppRepository.shared.models()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func retry(_ source: LearningSource) {
        guard let model = models.first(where: { $0.id == source.modelID }) else {
            errorMessage = "原学习模型已被删除，请重新添加资料并选择模型"
            return
        }
        guard source.imagePaths.isEmpty || model.supportsImages else {
            errorMessage = "原学习模型当前未开启图片理解"
            return
        }
        do {
            try AppRepository.shared.updateLearningSourceStatus(id: source.id, status: .learning)
            load()
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        Task {
            do {
                let summary = try await LearningService.learn(source: source, model: model)
                guard !summary.isEmpty else { throw ChatAPIError.invalidResponse }
                try AppRepository.shared.updateLearningSourceStatus(
                    id: source.id,
                    status: .learned,
                    summary: summary
                )
            } catch {
                try? AppRepository.shared.updateLearningSourceStatus(
                    id: source.id,
                    status: .failed,
                    errorMessage: error.localizedDescription
                )
            }
            load()
        }
    }

    private func delete(_ source: LearningSource) {
        do {
            try AppRepository.shared.deleteLearningSource(id: source.id)
            load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct LearningSourceRow: View {
    let source: LearningSource
    let modelName: String?
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(statusText, systemImage: statusIcon)
                    .foregroundStyle(statusColor)
                Spacer()
                if source.status == .failed {
                    Button("重新学习", systemImage: "arrow.clockwise", action: onRetry)
                        .buttonStyle(.borderless)
                }
            }
            if !source.summary.isEmpty {
                Text(source.summary)
                    .lineLimit(3)
            } else if !source.rawText.isEmpty {
                Text(source.rawText)
                    .lineLimit(3)
            }
            HStack(spacing: 12) {
                if let modelName {
                    Label(modelName, systemImage: "cpu")
                }
                if !source.imagePaths.isEmpty {
                    Label("\(source.imagePaths.count) 张图片", systemImage: "photo.on.rectangle")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            if let error = source.errorMessage, source.status == .failed {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }

    private var statusText: String {
        switch source.status {
        case .learning: "正在学习中，请保持前台运行"
        case .failed: "学习失败"
        case .learned: "学习完成"
        }
    }

    private var statusIcon: String {
        switch source.status {
        case .learning: "brain.head.profile"
        case .failed: "exclamationmark.triangle.fill"
        case .learned: "checkmark.circle.fill"
        }
    }

    private var statusColor: Color {
        switch source.status {
        case .learning: .orange
        case .failed: .red
        case .learned: .green
        }
    }
}
