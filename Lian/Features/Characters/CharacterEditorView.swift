import SwiftUI

struct CharacterEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let character: CharacterProfile?
    let onSave: () -> Void

    @State private var name = ""
    @State private var summary = ""
    @State private var mood = "平静"
    @State private var temperature = 50.0
    @State private var persona = ""
    @State private var memories = ""
    @State private var speechStyle = ""
    @State private var triggers = ""
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("基本信息") {
                    TextField("名字", text: $name)
                    TextField("简介", text: $summary, axis: .vertical)
                    TextField("当前情绪", text: $mood)
                    LabeledContent("关系温度", value: "\(Int(temperature))")
                    Slider(value: $temperature, in: 0...100, step: 1)
                }
                Section("角色人格") {
                    TextField("Persona", text: $persona, axis: .vertical)
                    TextField("共同记忆", text: $memories, axis: .vertical)
                    TextField("说话习惯", text: $speechStyle, axis: .vertical)
                    TextField("雷点与边界", text: $triggers, axis: .vertical)
                }
                if let character {
                    Section("主动消息") {
                        NavigationLink("定时主动消息") {
                            ProactiveMessageSchedulerView(character: character)
                        }
                    }
                }
            }
            .navigationTitle(character == nil ? "新角色" : "编辑角色")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear(perform: populate)
            .alert("保存失败", isPresented: .constant(errorMessage != nil)) {
                Button("好") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func populate() {
        guard let character else { return }
        name = character.name
        summary = character.summary
        mood = character.mood
        temperature = Double(character.relationshipTemperature)
        persona = character.persona
        memories = character.sharedMemories
        speechStyle = character.speechStyle
        triggers = character.triggers
    }

    private func save() {
        let now = Date()
        do {
            try AppRepository.shared.saveCharacter(
                CharacterProfile(
                    id: character?.id ?? UUID().uuidString,
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    avatarPath: character?.avatarPath,
                    chatBackgroundPath: character?.chatBackgroundPath,
                    summary: summary,
                    mood: mood,
                    relationshipTemperature: Int(temperature),
                    persona: persona,
                    sharedMemories: memories,
                    speechStyle: speechStyle,
                    triggers: triggers,
                    createdAt: character?.createdAt ?? now,
                    updatedAt: now
                )
            )
            onSave()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
