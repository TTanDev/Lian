import SwiftUI

struct CharacterListView: View {
    @State private var characters: [CharacterProfile] = []
    @State private var showingEditor = false
    @State private var errorMessage: String?

    private let columns = [GridItem(.adaptive(minimum: 156), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(characters) { character in
                        NavigationLink {
                            CharacterEditorView(character: character) { load() }
                        } label: {
                            CharacterCard(character: character)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button("删除角色", systemImage: "trash", role: .destructive) {
                                delete(character)
                            }
                        }
                    }
                }
                .padding()
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
                NavigationStack {
                    CharacterEditorView(character: nil) { load() }
                }
            }
            .task { load() }
            .alert("操作失败", isPresented: .constant(errorMessage != nil)) {
                Button("好") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .background(NavigationTabBarCoordinator().frame(width: 0, height: 0))
    }

    private func load() {
        do {
            characters = try AppRepository.shared.characters()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func delete(_ character: CharacterProfile) {
        do {
            try AppRepository.shared.deleteCharacter(id: character.id)
            load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CharacterCard: View {
    let character: CharacterProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                CharacterAvatar(character: character, size: 58)
                Spacer()
                Image(systemName: "slider.horizontal.3")
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 2)
            Text(character.name)
                .font(.title3.bold())
                .foregroundStyle(.primary)
            Text(character.summary.isEmpty ? "还没有角色简介" : character.summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            HStack {
                Label(character.mood, systemImage: "heart.text.square")
                Spacer()
                Text("\(character.relationshipTemperature)°")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 190, alignment: .leading)
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
