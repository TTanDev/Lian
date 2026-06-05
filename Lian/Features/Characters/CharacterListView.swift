import SwiftUI
import UniformTypeIdentifiers

struct CharacterListView: View {
    @Environment(NavigationRouter.self) private var router
    @State private var characters: [CharacterProfile] = []
    @State private var showingEditor = false
    @State private var exportingDocument: LianRoleDocument?
    @State private var exportName = "LianRole"
    @State private var importing = false
    @State private var errorMessage: String?

    private let columns = [GridItem(.adaptive(minimum: 156), spacing: 14)]

    var body: some View {
        Group {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(characters) { character in
                        Button {
                            router.push(CharacterEditorView(character: character) { load() })
                        } label: {
                            CharacterCard(character: character)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button("导出角色", systemImage: "square.and.arrow.up") {
                                export(character)
                            }
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
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("添加角色", systemImage: "plus") {
                            showingEditor = true
                        }
                        Button("导入角色", systemImage: "square.and.arrow.down") {
                            importing = true
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingEditor) {
                NavigationStack {
                    CharacterEditorView(character: nil) { load() }
                }
            }
            .task { load() }
            .fileExporter(
                isPresented: Binding(
                    get: { exportingDocument != nil },
                    set: { if !$0 { exportingDocument = nil } }
                ),
                document: exportingDocument,
                contentType: .data,
                defaultFilename: "\(exportName).lianrole"
            ) { result in
                if case let .failure(error) = result {
                    errorMessage = error.localizedDescription
                }
            }
            .fileImporter(
                isPresented: $importing,
                allowedContentTypes: [.data, .json],
                allowsMultipleSelection: false
            ) { result in
                importRole(result)
            }
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

    private func delete(_ character: CharacterProfile) {
        do {
            try AppRepository.shared.deleteCharacter(id: character.id)
            load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func export(_ character: CharacterProfile) {
        do {
            exportingDocument = try CharacterArchiveService.export(character: character)
            exportName = character.name.isEmpty ? "LianRole" : character.name
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func importRole(_ result: Result<[URL], Error>) {
        Task {
            do {
                let url = try result.get().first
                guard let url else { return }
                let access = url.startAccessingSecurityScopedResource()
                defer {
                    if access {
                        url.stopAccessingSecurityScopedResource()
                    }
                }
                let document = LianRoleDocument(data: try Data(contentsOf: url))
                try await CharacterArchiveService.import(document: document)
                load()
            } catch {
                errorMessage = error.localizedDescription
            }
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
