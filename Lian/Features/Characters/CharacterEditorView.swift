import PhotosUI
import SwiftUI
import UIKit

struct CharacterEditorView: View {
    @Environment(NavigationRouter.self) private var router
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
    @State private var modelID = ""
    @State private var avatarPath: String?
    @State private var avatarImage: UIImage?
    @State private var avatarItem: PhotosPickerItem?
    @State private var models: [APIModel] = []
    @State private var original = Draft.empty
    @State private var persistedID: String?
    @State private var persistedCreatedAt: Date?
    @State private var showingDiscardConfirmation = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("头像") {
                HStack(spacing: 16) {
                    Group {
                        if let avatarImage {
                            Image(uiImage: avatarImage)
                                .resizable()
                                .scaledToFill()
                        } else {
                            Circle()
                                .fill(.pink.gradient)
                                .overlay {
                                    Text(name.isEmpty ? "角" : String(name.prefix(1)))
                                        .font(.title.bold())
                                        .foregroundStyle(.white)
                                }
                        }
                    }
                    .frame(width: 72, height: 72)
                    .clipShape(Circle())
                    PhotosPicker(selection: $avatarItem, matching: .images) {
                        Label("选择头像", systemImage: "photo")
                    }
                    if avatarPath != nil {
                        Button("恢复默认", role: .destructive) {
                            avatarPath = nil
                            avatarImage = nil
                        }
                    }
                }
            }
            Section("基本信息") {
                TextField("名字", text: $name)
                TextField("简介", text: $summary, axis: .vertical)
                TextField("当前情绪", text: $mood)
                LabeledContent("关系温度", value: "\(Int(temperature))")
                Slider(value: $temperature, in: 0...100, step: 1)
            }
            Section {
                Picker("专属模型", selection: $modelID) {
                    Text("跟随默认模型").tag("")
                    ForEach(models) { model in
                        Text(model.displayName).tag(model.id)
                    }
                }
            } header: {
                Text("聊天模型")
            } footer: {
                Text("角色配置专属模型后，不受默认模型切换影响。")
            }
            Section("角色人格") {
                TextField("Persona", text: $persona, axis: .vertical)
                TextField("共同记忆", text: $memories, axis: .vertical)
                TextField("说话习惯", text: $speechStyle, axis: .vertical)
                TextField("雷点与边界", text: $triggers, axis: .vertical)
            }
            if let character {
                Section("主动消息") {
                    Button("定时主动消息") {
                        router.push(ProactiveMessageSchedulerView(character: character))
                    }
                }
            }
        }
        .navigationTitle(character == nil ? "新角色" : "编辑角色")
        .toolbar {
            if character == nil {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
            }
            ToolbarItemGroup(placement: .confirmationAction) {
                if isDirty {
                    Button("取消更改") {
                        showingDiscardConfirmation = true
                    }
                }
                Button("保存") { save() }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || !isDirty)
            }
        }
        .onAppear(perform: populate)
        .onChange(of: avatarItem) {
            loadAvatar()
        }
        .confirmationDialog("确定放弃尚未保存的更改？", isPresented: $showingDiscardConfirmation, titleVisibility: .visible) {
            Button("放弃更改", role: .destructive) {
                apply(original)
            }
            Button("继续编辑", role: .cancel) {}
        }
        .alert("保存失败", isPresented: .constant(errorMessage != nil)) {
            Button("好") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var current: Draft {
        Draft(
            name: name,
            summary: summary,
            mood: mood,
            temperature: Int(temperature),
            persona: persona,
            memories: memories,
            speechStyle: speechStyle,
            triggers: triggers,
            modelID: modelID,
            avatarPath: avatarPath
        )
    }

    private var isDirty: Bool { current != original }

    private func populate() {
        do {
            models = try AppRepository.shared.models()
        } catch {
            errorMessage = error.localizedDescription
        }
        let value = character.map {
            Draft(
                name: $0.name,
                summary: $0.summary,
                mood: $0.mood,
                temperature: $0.relationshipTemperature,
                persona: $0.persona,
                memories: $0.sharedMemories,
                speechStyle: $0.speechStyle,
                triggers: $0.triggers,
                modelID: $0.modelID ?? "",
                avatarPath: $0.avatarPath
            )
        } ?? .empty
        original = value
        persistedID = character?.id
        persistedCreatedAt = character?.createdAt
        apply(value)
    }

    private func apply(_ value: Draft) {
        name = value.name
        summary = value.summary
        mood = value.mood
        temperature = Double(value.temperature)
        persona = value.persona
        memories = value.memories
        speechStyle = value.speechStyle
        triggers = value.triggers
        modelID = value.modelID
        avatarPath = value.avatarPath
        avatarImage = loadImage(path: value.avatarPath)
    }

    private func save() {
        let now = Date()
        let id = persistedID ?? UUID().uuidString
        let createdAt = persistedCreatedAt ?? now
        do {
            try AppRepository.shared.saveCharacter(
                CharacterProfile(
                    id: id,
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    avatarPath: avatarPath,
                    chatBackgroundPath: character?.chatBackgroundPath,
                    summary: summary,
                    mood: mood,
                    relationshipTemperature: Int(temperature),
                    persona: persona,
                    sharedMemories: memories,
                    speechStyle: speechStyle,
                    triggers: triggers,
                    modelID: modelID.isEmpty ? nil : modelID,
                    createdAt: createdAt,
                    updatedAt: now
                )
            )
            persistedID = id
            persistedCreatedAt = createdAt
            onSave()
            original = current
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadAvatar() {
        guard let avatarItem else { return }
        Task {
            do {
                guard let data = try await avatarItem.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    throw ChatAPIError.server("无法读取所选头像")
                }
                let store = try AttachmentStore()
                avatarPath = try await store.importImageData(
                    data,
                    attachmentID: "avatar-\(character?.id ?? UUID().uuidString)"
                )
                avatarImage = image
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func loadImage(path: String?) -> UIImage? {
        guard let path, !path.isEmpty else { return nil }
        if let url = URL(string: path), url.isFileURL {
            return UIImage(contentsOfFile: url.path)
        }
        guard let support = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ) else {
            return nil
        }
        return UIImage(contentsOfFile: support.appending(path: path).path)
    }
}

private struct Draft: Equatable {
    var name: String
    var summary: String
    var mood: String
    var temperature: Int
    var persona: String
    var memories: String
    var speechStyle: String
    var triggers: String
    var modelID: String
    var avatarPath: String?

    static let empty = Draft(
        name: "",
        summary: "",
        mood: "平静",
        temperature: 50,
        persona: "",
        memories: "",
        speechStyle: "",
        triggers: "",
        modelID: "",
        avatarPath: nil
    )
}
