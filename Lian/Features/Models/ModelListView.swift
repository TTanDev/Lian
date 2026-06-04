import SwiftUI

struct ModelListView: View {
    @State private var models: [APIModel] = []
    @State private var showingEditor = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                ForEach(models) { model in
                    NavigationLink {
                        ModelEditorView(model: model) { load() }
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(model.displayName).font(.headline)
                                if model.isDefault {
                                    Text("默认")
                                        .font(.caption)
                                        .foregroundStyle(.tint)
                                }
                            }
                            Text(model.modelName).font(.subheadline).foregroundStyle(.secondary)
                            Label(model.supportsImages ? "支持图片" : "仅文字", systemImage: model.supportsImages ? "photo" : "text.bubble")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete(perform: delete)
            }
            .overlay {
                if models.isEmpty {
                    ContentUnavailableView("还没有模型", systemImage: "cpu", description: Text("添加 OpenAI 兼容接口后开始聊天"))
                }
            }
            .navigationTitle("模型")
            .toolbar(.visible, for: .tabBar)
            .toolbar {
                Button("添加", systemImage: "plus") { showingEditor = true }
            }
            .sheet(isPresented: $showingEditor) {
                NavigationStack {
                    ModelEditorView(model: nil) { load() }
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
            models = try AppRepository.shared.models()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(at offsets: IndexSet) {
        do {
            for index in offsets {
                try AppRepository.shared.deleteModel(id: models[index].id)
            }
            load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
