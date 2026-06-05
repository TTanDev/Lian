import SwiftUI
import UIKit

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
    @State private var contextWindowTokens = 128_000
    @State private var testing = false
    @State private var resultMessage: String?
    @State private var original = ModelDraft.empty
    @State private var persistedID: String?
    @State private var persistedCreatedAt: Date?
    @State private var showingDiscardConfirmation = false
    @State private var showingCustomContextWindow = false
    @State private var customContextWindowText = ""

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
            Section("上下文窗口") {
                HStack {
                    Text("上下文窗口")
                    Spacer()
                    Menu {
                        ForEach(ContextWindowPreset.allCases) { preset in
                            Button {
                                contextWindowTokens = preset.tokens
                            } label: {
                                if contextWindowTokens == preset.tokens {
                                    Label(preset.title, systemImage: "checkmark")
                                } else {
                                    Text(preset.title)
                                }
                            }
                        }
                        Button("自定义") {
                            customContextWindowText = "\(contextWindowTokens)"
                            showingCustomContextWindow = true
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(contextWindowTitle)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption.bold())
                        }
                        .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            Section {
                Button(testing ? "测试中…" : "测试连接", systemImage: "network") {
                    testConnection()
                }
                .disabled(testing || !canSave)
            }
        }
        .navigationTitle(model == nil ? "添加模型" : "编辑模型")
        .toolbar {
            if model == nil {
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
                Button("保存") { save() }.disabled(!canSave || !isDirty)
            }
        }
        .onAppear(perform: populate)
        .alert("模型", isPresented: .constant(resultMessage != nil)) {
            Button("好") { resultMessage = nil }
        } message: {
            Text(resultMessage ?? "")
        }
        .confirmationDialog("确定放弃尚未保存的更改？", isPresented: $showingDiscardConfirmation, titleVisibility: .visible) {
            Button("放弃更改", role: .destructive) {
                apply(original)
            }
            Button("继续编辑", role: .cancel) {}
        }
        .alert("自定义上下文窗口", isPresented: $showingCustomContextWindow) {
            TextField("tokens", text: $customContextWindowText)
                .keyboardType(.numberPad)
            Button("取消", role: .cancel) {}
            Button("确定") {
                applyCustomContextWindow()
            }
        } message: {
            Text("请输入模型上下文窗口的 token 数。")
        }
    }

    private var canSave: Bool {
        !displayName.isEmpty && !baseURL.isEmpty && !modelName.isEmpty && contextWindowTokens > 0
    }

    private var contextWindowTitle: String {
        ContextWindowPreset.title(for: contextWindowTokens)
    }

    private var current: ModelDraft {
        ModelDraft(
            displayName: displayName,
            baseURL: baseURL,
            modelName: modelName,
            apiKey: apiKey,
            supportsImages: supportsImages,
            isDefault: isDefault,
            contextWindowTokens: contextWindowTokens
        )
    }

    private var isDirty: Bool { current != original }

    private func populate() {
        let value = model.map {
            ModelDraft(
                displayName: $0.displayName,
                baseURL: $0.baseURL,
                modelName: $0.modelName,
                apiKey: KeychainStore.apiKey(modelID: $0.id),
                supportsImages: $0.supportsImages,
                isDefault: $0.isDefault,
                contextWindowTokens: $0.contextWindowTokens
            )
        } ?? .empty
        original = value
        persistedID = model?.id
        persistedCreatedAt = model?.createdAt
        apply(value)
    }

    private func apply(_ value: ModelDraft) {
        displayName = value.displayName
        baseURL = value.baseURL
        modelName = value.modelName
        apiKey = value.apiKey
        supportsImages = value.supportsImages
        isDefault = value.isDefault
        contextWindowTokens = value.contextWindowTokens
    }

    private func draft() -> APIModel {
        let now = Date()
        return APIModel(
            id: persistedID ?? UUID().uuidString,
            displayName: displayName,
            baseURL: baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
            modelName: modelName,
            supportsImages: supportsImages,
            isDefault: isDefault,
            contextWindowTokens: contextWindowTokens <= 0 ? 128_000 : contextWindowTokens,
            createdAt: persistedCreatedAt ?? now,
            updatedAt: now
        )
    }

    private func save() {
        let value = draft()
        do {
            try AppRepository.shared.saveModel(value)
            try KeychainStore.saveAPIKey(apiKey, modelID: value.id)
            persistedID = value.id
            persistedCreatedAt = value.createdAt
            onSave()
            original = current
        } catch {
            resultMessage = error.localizedDescription
        }
    }

    private func applyCustomContextWindow() {
        let digits = customContextWindowText.filter(\.isNumber)
        guard let value = Int(digits), value > 0 else {
            resultMessage = "请输入有效的上下文 token 数"
            return
        }
        contextWindowTokens = value
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
                    latestImageData: supportsImages ? [Self.visionTestImage] : []
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

    private static var visionTestImage: Data {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 256, height: 256))
        let image = renderer.image { context in
            UIColor.systemPink.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 128, height: 256))
            UIColor.systemTeal.setFill()
            context.fill(CGRect(x: 128, y: 0, width: 128, height: 256))
            let text = "LIAN" as NSString
            text.draw(
                at: CGPoint(x: 69, y: 106),
                withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 36),
                    .foregroundColor: UIColor.white
                ]
            )
        }
        return image.jpegData(compressionQuality: 0.9)!
    }
}

private enum ContextWindowPreset: Int, CaseIterable, Identifiable {
    case k1m = 1_000_000
    case k256 = 256_000
    case k128 = 128_000

    var id: Int { rawValue }
    var tokens: Int { rawValue }

    var title: String {
        switch self {
        case .k128: "128K"
        case .k256: "256K"
        case .k1m: "1M"
        }
    }

    static func title(for tokens: Int) -> String {
        allCases.first { $0.tokens == tokens }?.title ?? TokenDisplay.ktokens(tokens)
    }
}

private struct ModelDraft: Equatable {
    var displayName: String
    var baseURL: String
    var modelName: String
    var apiKey: String
    var supportsImages: Bool
    var isDefault: Bool
    var contextWindowTokens: Int

    static let empty = ModelDraft(
        displayName: "",
        baseURL: "",
        modelName: "",
        apiKey: "",
        supportsImages: false,
        isDefault: true,
        contextWindowTokens: 128_000
    )
}
