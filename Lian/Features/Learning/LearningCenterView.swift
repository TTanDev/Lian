import SwiftUI

struct LearningCenterView: View {
    @State private var sources: [LearningSource] = []
    @State private var characters: [CharacterProfile] = []
    @State private var showingEditor = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                ForEach(sources) { source in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(source.title).font(.headline)
                        Text(source.summary.isEmpty ? source.rawText : source.summary)
                            .lineLimit(2)
                            .foregroundStyle(.secondary)
                        Text(source.status == .learned ? "已学习" : "待学习")
                            .font(.caption)
                            .foregroundStyle(source.status == .learned ? Color.green : Color.orange)
                    }
                }
                .onDelete(perform: delete)
            }
            .overlay {
                if sources.isEmpty {
                    ContentUnavailableView("还没有学习资料", systemImage: "brain.head.profile", description: Text("添加文字资料来丰富角色设定"))
                }
            }
            .navigationTitle("学习")
            .toolbar {
                Button("添加资料", systemImage: "plus") {
                    showingEditor = true
                }
                .disabled(characters.isEmpty)
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
    }

    private func load() {
        do {
            sources = try AppRepository.shared.learningSources()
            characters = try AppRepository.shared.characters()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(at offsets: IndexSet) {
        do {
            for index in offsets {
                try AppRepository.shared.deleteLearningSource(id: sources[index].id)
            }
            load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
