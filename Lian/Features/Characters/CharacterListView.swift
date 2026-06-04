import SwiftUI

struct CharacterListView: View {
    @State private var characters: [CharacterProfile] = []
    @State private var showingEditor = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                ForEach(characters) { character in
                    NavigationLink {
                        CharacterEditorView(character: character) {
                            load()
                        }
                    } label: {
                        CharacterRow(character: character)
                    }
                }
                .onDelete(perform: delete)
            }
            .overlay {
                if characters.isEmpty {
                    ContentUnavailableView("还没有角色", systemImage: "person.2", description: Text("创建一个角色后开始聊天"))
                }
            }
            .navigationTitle("角色")
            .toolbar {
                Button("添加", systemImage: "plus") {
                    showingEditor = true
                }
            }
            .sheet(isPresented: $showingEditor) {
                CharacterEditorView(character: nil) {
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
            characters = try AppRepository.shared.characters()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(at offsets: IndexSet) {
        do {
            for index in offsets {
                try AppRepository.shared.deleteCharacter(id: characters[index].id)
            }
            load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CharacterRow: View {
    let character: CharacterProfile

    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(.pink.gradient)
                .frame(width: 48, height: 48)
                .overlay {
                    Text(character.name.prefix(1))
                        .font(.headline)
                        .foregroundStyle(.white)
                }
            VStack(alignment: .leading, spacing: 4) {
                Text(character.name).font(.headline)
                Text("\(character.mood) · 关系温度 \(character.relationshipTemperature)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
