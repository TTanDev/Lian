import PhotosUI
import SwiftUI
import UIKit

struct LearningSourceEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let characters: [CharacterProfile]
    let onSave: () -> Void

    @State private var models: [APIModel] = []
    @State private var characterID = ""
    @State private var modelID = ""
    @State private var bodyText = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var imageData: [Data] = []
    @State private var showingPhotoPicker = false
    @State private var learning = false
    @State private var statusMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("学习对象") {
                    Picker("角色", selection: $characterID) {
                        ForEach(characters) { character in
                            Text(character.name).tag(character.id)
                        }
                    }
                    Picker("学习模型", selection: $modelID) {
                        ForEach(selectableModels) { model in
                            Text(model.displayName).tag(model.id)
                        }
                    }
                }

                Section("资料正文") {
                    TextField("输入需要角色学习的资料", text: $bodyText, axis: .vertical)
                        .lineLimit(6...16)
                }

                Section {
                    Button("选择图片", systemImage: "photo.on.rectangle.angled") {
                        showingPhotoPicker = true
                    }
                    .disabled(imageCapableModels.isEmpty)

                    if !imageData.isEmpty {
                        ScrollView(.horizontal) {
                            HStack(spacing: 10) {
                                ForEach(Array(imageData.enumerated()), id: \.offset) { index, data in
                                    if let image = UIImage(data: data) {
                                        Image(uiImage: image)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 86, height: 86)
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                            .overlay(alignment: .topTrailing) {
                                                Button("移除", systemImage: "xmark.circle.fill") {
                                                    imageData.remove(at: index)
                                                    selectedPhotos = []
                                                    ensureValidModelSelection()
                                                }
                                                .labelStyle(.iconOnly)
                                            }
                                    }
                                }
                            }
                        }
                    }
                } header: {
                    Text("图片资料")
                } footer: {
                    Text(imageCapableModels.isEmpty ? "请先添加并启用一个支持图片理解的模型。" : "可一次选择多张图片；包含图片时只能使用支持图片理解的模型。")
                }

                if let statusMessage {
                    Section {
                        Label(statusMessage, systemImage: learning ? "brain.head.profile" : "checkmark.circle.fill")
                            .foregroundStyle(learning ? Color.orange : Color.green)
                    }
                }
            }
            .navigationTitle("添加学习资料")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存并学习") { saveAndLearn() }
                        .disabled(!canLearn)
                }
            }
            .photosPicker(
                isPresented: $showingPhotoPicker,
                selection: $selectedPhotos,
                maxSelectionCount: 10,
                matching: .images
            )
            .onAppear(perform: load)
            .onChange(of: selectedPhotos) {
                loadSelectedPhotos()
            }
            .alert("学习失败", isPresented: .constant(errorMessage != nil)) {
                Button("好") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var imageCapableModels: [APIModel] {
        models.filter(\.supportsImages)
    }

    private var selectableModels: [APIModel] {
        imageData.isEmpty ? models : imageCapableModels
    }

    private var selectedModel: APIModel? {
        selectableModels.first { $0.id == modelID }
    }

    private var canLearn: Bool {
        !learning
            && !characterID.isEmpty
            && selectedModel != nil
            && (!bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !imageData.isEmpty)
    }

    private func load() {
        do {
            models = try AppRepository.shared.models()
            characterID = characterID.isEmpty ? (characters.first?.id ?? "") : characterID
            modelID = modelID.isEmpty ? (models.first(where: \.isDefault)?.id ?? models.first?.id ?? "") : modelID
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func ensureValidModelSelection() {
        guard selectableModels.contains(where: { $0.id == modelID }) else {
            modelID = selectableModels.first(where: \.isDefault)?.id ?? selectableModels.first?.id ?? ""
            return
        }
    }

    private func loadSelectedPhotos() {
        let items = selectedPhotos
        Task {
            do {
                var loaded: [Data] = []
                for item in items {
                    if let data = try await item.loadTransferable(type: Data.self) {
                        loaded.append(try ImageDataNormalizer.jpegData(from: data))
                    }
                }
                imageData = loaded
                ensureValidModelSelection()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func saveAndLearn() {
        guard let model = selectedModel else { return }
        learning = true
        statusMessage = "正在学习中，请保持前台运行"

        Task {
            let now = Date()
            let sourceID = UUID().uuidString
            do {
                let store = try AttachmentStore()
                var paths: [String] = []
                for data in imageData {
                    paths.append(try await store.importImageData(data, attachmentID: "learning-\(UUID().uuidString)"))
                }
                let source = LearningSource(
                    id: sourceID,
                    characterID: characterID,
                    modelID: model.id,
                    rawText: bodyText.trimmingCharacters(in: .whitespacesAndNewlines),
                    summary: "",
                    status: .learning,
                    imagePaths: paths,
                    errorMessage: nil,
                    createdAt: now,
                    updatedAt: now
                )
                try AppRepository.shared.saveLearningSource(source)
                onSave()

                let summary = try await LearningService.learn(source: source, model: model)
                guard !summary.isEmpty else {
                    throw ChatAPIError.invalidResponse
                }
                try AppRepository.shared.updateLearningSourceStatus(
                    id: sourceID,
                    status: .learned,
                    summary: summary
                )
                statusMessage = "学习完成"
                bodyText = ""
                imageData = []
                selectedPhotos = []
                onSave()
            } catch {
                try? AppRepository.shared.updateLearningSourceStatus(
                    id: sourceID,
                    status: .failed,
                    errorMessage: error.localizedDescription
                )
                statusMessage = nil
                errorMessage = error.localizedDescription
                onSave()
            }
            learning = false
        }
    }
}
