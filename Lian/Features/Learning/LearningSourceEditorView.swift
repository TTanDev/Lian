import SwiftUI

struct LearningSourceEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let characters: [CharacterProfile]
    let onSave: () -> Void

    @State private var characterID = ""
    @State private var title = ""
    @State private var bodyText = ""
    @State private var markLearned = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Picker("角色", selection: $characterID) {
                    ForEach(characters) { character in
                        Text(character.name).tag(character.id)
                    }
                }
                TextField("资料标题", text: $title)
                TextField("资料正文", text: $bodyText, axis: .vertical)
                    .lineLimit(5...14)
                Toggle("标记为已学习", isOn: $markLearned)
            }
            .navigationTitle("添加学习资料")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(characterID.isEmpty || title.isEmpty || bodyText.isEmpty)
                }
            }
            .onAppear {
                characterID = characterID.isEmpty ? (characters.first?.id ?? "") : characterID
            }
            .alert("保存失败", isPresented: .constant(errorMessage != nil)) {
                Button("好") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func save() {
        let now = Date()
        do {
            try AppRepository.shared.saveLearningSource(
                LearningSource(
                    id: UUID().uuidString,
                    characterID: characterID,
                    title: title,
                    rawText: bodyText,
                    summary: bodyText,
                    status: markLearned ? .learned : .pending,
                    createdAt: now,
                    updatedAt: now
                )
            )
            onSave()
            title = ""
            bodyText = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
