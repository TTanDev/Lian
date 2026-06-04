import SwiftUI

struct ModelEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let model: APIModel?
    let onSave: () -> Void

    @State private var displayName = ""
    @State private var baseURL = ""
    @State private var modelName = ""
    @State private var apiKey = ""
    @State private var supportsImages = false
    @State private var isDefault = true
    @State private var testing = false
    @State private var resultMessage: String?

    var body: some View {
        Form {
            Section("接口") {
                TextField("显示名称", text: $displayName)
                TextField("Base URL，例如 https://api.example.com/v1", text: $baseURL)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                TextField("模型名称", text: $modelName)
                    .textInputAutocapitalization(.never)
                SecureField("API Key", text: $apiKey)
            }
            Section {
                Toggle("支持图片", isOn: $supportsImages)
                Toggle("设为默认模型", isOn: $isDefault)
            } header: {
                Text("能力")
            } footer: {
                Text("图片开关只控制新图片的选择与发送，不影响历史图片显示。")
            }
            Section {
                Button(testing ? "测试中…" : "测试连接", systemImage: "network") {
                    testConnection()
                }
                .disabled(testing || !canSave)
            }
        }
        .navigationTitle(model == nil ? "添加模型" : "编辑模型")
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("保存") { save() }.disabled(!canSave)
            }
        }
        .onAppear(perform: populate)
        .alert("模型", isPresented: .constant(resultMessage != nil)) {
            Button("好") { resultMessage = nil }
        } message: {
            Text(resultMessage ?? "")
        }
    }

    private var canSave: Bool {
        !displayName.isEmpty && !baseURL.isEmpty && !modelName.isEmpty
    }

    private func populate() {
        guard let model else { return }
        displayName = model.displayName
        baseURL = model.baseURL
        modelName = model.modelName
        apiKey = KeychainStore.apiKey(modelID: model.id)
        supportsImages = model.supportsImages
        isDefault = model.isDefault
    }

    private func draft() -> APIModel {
        let now = Date()
        return APIModel(
            id: model?.id ?? UUID().uuidString,
            displayName: displayName,
            baseURL: baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
            modelName: modelName,
            supportsImages: supportsImages,
            isDefault: isDefault,
            createdAt: model?.createdAt ?? now,
            updatedAt: now
        )
    }

    private func save() {
        let value = draft()
        do {
            try AppRepository.shared.saveModel(value)
            try KeychainStore.saveAPIKey(apiKey, modelID: value.id)
            onSave()
            dismiss()
        } catch {
            resultMessage = error.localizedDescription
        }
    }

    private func testConnection() {
        testing = true
        Task {
            do {
                let response = try await ChatAPIClient().reply(
                    model: draft(),
                    apiKey: apiKey,
                    messages: [
                        PromptMessage(
                            role: "user",
                            content: supportsImages ? "请识别这张测试图片，并只回复“图片测试成功”" : "只回复 OK"
                        )
                    ],
                    latestImageData: supportsImages ? Self.visionTestImage : nil
                )
                resultMessage = supportsImages
                    ? "连接与图片发送成功：\(MessageSanitizer.clean(response))"
                    : "连接成功：\(MessageSanitizer.clean(response))"
            } catch {
                resultMessage = error.localizedDescription
            }
            testing = false
        }
    }

    private static let visionTestImage = Data(base64Encoded:
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k="
    )!
}
