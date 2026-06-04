import PhotosUI
import SwiftUI

struct ConversationView: View {
    let character: CharacterProfile

    @State private var messages: [ChatMessage] = []
    @State private var models: [APIModel] = []
    @State private var draft = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var pendingImageData: Data?
    @State private var sending = false
    @State private var errorMessage: String?
    @FocusState private var inputFocused: Bool

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 14) {
                    ForEach(messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                    if sending {
                        HStack {
                            ProgressView()
                            Text("正在回复…").foregroundStyle(.secondary)
                            Spacer()
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: messages.count) {
                scrollToBottom(proxy)
            }
            .onChange(of: inputFocused) {
                guard inputFocused else { return }
                withAnimation(.snappy(duration: 0.28)) {
                    scrollToBottom(proxy)
                }
            }
        }
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            inputBar
                .background(.ultraThinMaterial)
        }
        .task { load() }
        .onChange(of: selectedPhoto) {
            loadSelectedPhoto()
        }
        .alert("聊天失败", isPresented: .constant(errorMessage != nil)) {
            Button("好") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var defaultModel: APIModel? {
        models.first(where: \.isDefault) ?? models.first
    }

    private var inputBar: some View {
        VStack(spacing: 8) {
            if pendingImageData != nil {
                HStack {
                    Label("已选择图片", systemImage: "photo")
                    Spacer()
                    Button("移除", systemImage: "xmark.circle.fill") {
                        pendingImageData = nil
                        selectedPhoto = nil
                    }
                    .labelStyle(.iconOnly)
                }
                .padding(.horizontal)
            }
            HStack(alignment: .bottom, spacing: 10) {
                if defaultModel?.canSelectNewAttachments == true {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Image(systemName: "plus")
                            .frame(width: 42, height: 42)
                            .background(.thinMaterial, in: Circle())
                    }
                    .accessibilityLabel("选择图片")
                }
                TextField("说点什么…", text: $draft, axis: .vertical)
                    .focused($inputFocused)
                    .lineLimit(1...5)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                Button("发送", systemImage: "arrow.up.circle.fill") {
                    send()
                }
                .labelStyle(.iconOnly)
                .font(.system(size: 34))
                .disabled(sending || (draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && pendingImageData == nil))
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
    }

    private func load() {
        do {
            messages = try AppRepository.shared.messages(characterID: character.id)
            models = try AppRepository.shared.models()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadSelectedPhoto() {
        guard let selectedPhoto else { return }
        Task {
            do {
                pendingImageData = try await selectedPhoto.loadTransferable(type: Data.self)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func send() {
        guard let model = defaultModel else {
            errorMessage = "请先在模型页添加模型"
            return
        }
        sending = true
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let imageData = pendingImageData
        draft = ""
        pendingImageData = nil
        selectedPhoto = nil

        Task {
            do {
                var paths: [String] = []
                if let imageData {
                    guard model.supportsImages else {
                        throw ChatAPIError.server("当前模型未开启图片功能")
                    }
                    let store = try AttachmentStore()
                    paths = [try await store.importImageData(imageData, attachmentID: UUID().uuidString)]
                }
                let userMessage = try AppRepository.shared.addMessage(
                    characterID: character.id,
                    role: .user,
                    content: content,
                    attachmentPaths: paths
                )
                messages.append(userMessage)

                let prompt = PromptBuilder.chat(character: character, messages: messages)
                let rawReply = try await ChatAPIClient().reply(
                    model: model,
                    apiKey: KeychainStore.apiKey(modelID: model.id),
                    messages: prompt,
                    latestImageData: imageData
                )
                let cleanReply = MessageSanitizer.clean(rawReply)
                let assistantMessage = try AppRepository.shared.addMessage(
                    characterID: character.id,
                    role: .assistant,
                    content: cleanReply.isEmpty ? "我不知道该怎么回你。" : cleanReply
                )
                messages.append(assistantMessage)
            } catch {
                errorMessage = error.localizedDescription
            }
            sending = false
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        guard let id = messages.last?.id else { return }
        proxy.scrollTo(id, anchor: .bottom)
    }
}

private struct MessageBubble: View {
    let message: ChatMessage

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 54) }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(message.attachments) { attachment in
                    AttachmentRenderer(
                        attachment: attachment,
                        applicationSupportDirectory: applicationSupportDirectory
                    )
                }
                if !message.content.isEmpty {
                    Text(message.content)
                        .textSelection(.enabled)
                }
                Text(message.createdAt, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(isUser ? Color.pink.opacity(0.82) : Color(uiColor: .secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            if !isUser { Spacer(minLength: 54) }
        }
    }

    private var applicationSupportDirectory: URL {
        (try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? FileManager.default.temporaryDirectory
    }
}
