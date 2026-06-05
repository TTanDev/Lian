import PhotosUI
import SwiftUI
import UIKit

struct ConversationView: View {
    let character: CharacterProfile

    @State private var messages: [ChatMessage] = []
    @State private var models: [APIModel] = []
    @State private var learnedSources: [LearningSource] = []
    @State private var contextSnapshot: ContextSnapshot?
    @State private var draft = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var pendingImageData: [Data] = []
    @State private var showingPhotoPicker = false
    @State private var showingCamera = false
    @State private var quotedMessage: ChatMessage?
    @State private var sending = false
    @State private var previewItem: ImagePreviewItem?
    @State private var errorMessage: String?
    @FocusState private var inputFocused: Bool
    @Namespace private var previewNamespace

    var body: some View {
        ZStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 14) {
                        ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                            if shouldShowTimeHeader(at: index) {
                                TimeDivider(date: message.createdAt)
                            }
                            MessageBubble(
                                message: message,
                                namespace: previewNamespace,
                                onPreview: { attachments, index in
                                    withAnimation(.spring(response: 0.34, dampingFraction: 0.88)) {
                                        previewItem = previewItem(for: attachments, startIndex: index)
                                    }
                                },
                                onRetry: { retryReply(for: message) }
                            ) {
                                quotedMessage = message
                                inputFocused = true
                            }
                            .id(message.id)
                            if contextSnapshot?.cutoffMessageID == message.id {
                                ContextSnapshotDivider()
                            }
                        }
                        if sending {
                            HStack {
                                ProgressView()
                                Text("正在回复…").foregroundStyle(.secondary)
                                Spacer()
                            }
                            .padding(.horizontal)
                        }
                        Color.clear
                            .frame(height: 1)
                            .id("conversation-bottom")
                    }
                    .padding(.horizontal)
                    .padding(.top, 12)
                    .padding(.bottom, 8)
                    .transaction { transaction in
                        transaction.animation = nil
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .defaultScrollAnchor(.bottom)
                .onChange(of: messages.count) {
                    scrollToBottom(proxy)
                }
                .onChange(of: sending) {
                    scrollToBottom(proxy)
                }
                .onChange(of: inputFocused) {
                    guard inputFocused else { return }
                    withAnimation(.snappy(duration: 0.28)) {
                        scrollToBottom(proxy)
                    }
                }
            }
        }
        .overlay {
            if let previewItem {
                ImagePreviewView(
                    item: previewItem,
                    namespace: previewNamespace,
                    onDismiss: { self.previewItem = nil }
                )
                .zIndex(50)
            }
        }
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(previewItem == nil ? .visible : .hidden, for: .navigationBar)
        .statusBarHidden(previewItem != nil)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if previewItem == nil {
                inputBar
                    .background(.ultraThinMaterial)
            }
        }
        .sheet(isPresented: $showingCamera) {
            CameraPicker { data in
                pendingImageData.append(data)
            }
            .ignoresSafeArea()
        }
        .photosPicker(
            isPresented: $showingPhotoPicker,
            selection: $selectedPhotos,
            maxSelectionCount: 10,
            matching: .images
        )
        .task { load() }
        .onChange(of: selectedPhotos) {
            loadSelectedPhotos()
        }
        .alert("聊天失败", isPresented: .constant(errorMessage != nil)) {
            Button("好") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var selectedModel: APIModel? {
        if let modelID = character.modelID,
           let model = models.first(where: { $0.id == modelID }) {
            return model
        }
        return models.first(where: \.isDefault) ?? models.first
    }

    private var inputBar: some View {
        VStack(spacing: 8) {
            if let quotedMessage {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("引用\(quotedMessage.role == .user ? "自己" : character.name)")
                            .font(.caption.bold())
                        Text(quotedMessage.content)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Button("取消引用", systemImage: "xmark.circle.fill") {
                        self.quotedMessage = nil
                    }
                    .labelStyle(.iconOnly)
                }
                .padding(.horizontal)
            }
            if !pendingImageData.isEmpty {
                ScrollView(.horizontal) {
                    HStack {
                        ForEach(Array(pendingImageData.enumerated()), id: \.offset) { index, data in
                            if let image = UIImage(data: data) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 58, height: 58)
                                    .matchedPreview(id: "pending-\(index)", namespace: previewNamespace)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                    .onTapGesture {
                                        withAnimation(.spring(response: 0.34, dampingFraction: 0.88)) {
                                            previewItem = pendingPreviewItem(startIndex: index)
                                        }
                                    }
                                    .overlay(alignment: .topTrailing) {
                                        Button("移除", systemImage: "xmark.circle.fill") {
                                            pendingImageData.remove(at: index)
                                        }
                                        .labelStyle(.iconOnly)
                                    }
                            }
                        }
                    }
                }
                .padding(.horizontal)
            }
            HStack(alignment: .bottom, spacing: 10) {
                Menu {
                    Button("相机", systemImage: "camera.fill") {
                        showingCamera = true
                    }
                    .disabled(selectedModel?.supportsImages != true)
                    Button("照片", systemImage: "photo.on.rectangle") {
                        showingPhotoPicker = true
                    }
                    .disabled(selectedModel?.supportsImages != true)
                } label: {
                    Image(systemName: "plus")
                        .frame(width: 42, height: 42)
                        .background(.thinMaterial, in: Circle())
                }
                .accessibilityLabel("添加附件")

                ZStack(alignment: .leading) {
                    TextField("说点什么…", text: $draft, axis: .vertical)
                        .focused($inputFocused)
                        .lineLimit(1...5)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                Button("发送", systemImage: "arrow.up.circle.fill") {
                    send()
                }
                .labelStyle(.iconOnly)
                .font(.system(size: 34))
                .disabled(sending || (draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && pendingImageData.isEmpty))
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
    }

    private func shouldShowTimeHeader(at index: Int) -> Bool {
        guard index > 0 else { return true }
        let previous = messages[index - 1].createdAt
        let current = messages[index].createdAt
        return !Calendar.current.isDate(previous, inSameDayAs: current)
            || current.timeIntervalSince(previous) >= 5 * 60
    }

    private func load() {
        do {
            messages = try AppRepository.shared.messages(characterID: character.id)
            models = try AppRepository.shared.models()
            learnedSources = try AppRepository.shared.learningSources().filter { $0.characterID == character.id }
            contextSnapshot = try AppRepository.shared.latestContextSnapshot(characterID: character.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadSelectedPhotos() {
        let items = selectedPhotos
        Task {
            do {
                pendingImageData = try await items.asyncCompactMap {
                    guard let data = try await $0.loadTransferable(type: Data.self) else { return nil }
                    return try ImageDataNormalizer.jpegData(from: data)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func send() {
        guard let model = selectedModel else {
            errorMessage = "请先在模型页添加模型"
            return
        }
        sending = true
        let typedContent = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let content: String
        if let quotedMessage {
            let quote = quotedMessage.content.replacingOccurrences(of: "\n", with: " ")
            content = "回复“\(quote.prefix(48))”\n\(typedContent)"
        } else {
            content = typedContent
        }
        let imageData = pendingImageData
        let messageID = UUID().uuidString
        draft = ""
        pendingImageData = []
        selectedPhotos = []
        quotedMessage = nil

        Task {
            do {
                var paths: [String] = []
                if !imageData.isEmpty {
                    guard model.supportsImages else {
                        throw ChatAPIError.server("当前模型未开启图片功能")
                    }
                    let store = try AttachmentStore()
                    for data in imageData {
                        paths.append(try await store.importImageData(data, attachmentID: UUID().uuidString))
                    }
                }
                let userMessage = try AppRepository.shared.addMessage(
                    id: messageID,
                    characterID: character.id,
                    role: .user,
                    content: content,
                    attachmentPaths: paths
                )
                messages.append(userMessage)

                let prompt = PromptBuilder.chat(
                    character: character,
                    messages: messages,
                    learnedSources: learnedSources,
                    contextSnapshot: contextSnapshot
                )
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
                try? AppRepository.shared.updateMessageReplyStatus(id: messageID, status: .failed)
                load()
                errorMessage = error.localizedDescription
            }
            sending = false
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        Task { @MainActor in
            await Task.yield()
            try? await Task.sleep(for: .milliseconds(80))
            withAnimation(.easeOut(duration: 0.24)) {
                proxy.scrollTo("conversation-bottom", anchor: .bottom)
            }
        }
    }

    private func retryReply(for message: ChatMessage) {
        guard message.role == .user, message.replyStatus == .failed else { return }
        guard let model = selectedModel else {
            errorMessage = "请先在模型页添加模型"
            return
        }
        sending = true
        Task {
            do {
                let imageData = try message.attachments.map { attachment in
                    try Data(contentsOf: attachment.fileURL(in: applicationSupportDirectory))
                }
                let promptMessages = Array(messages.prefix { $0.id != message.id }) + [message]
                let prompt = PromptBuilder.chat(
                    character: character,
                    messages: Array(promptMessages),
                    learnedSources: learnedSources,
                    contextSnapshot: contextSnapshot
                )
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
                try AppRepository.shared.updateMessageReplyStatus(id: message.id, status: nil)
                messages.append(assistantMessage)
                load()
            } catch {
                try? AppRepository.shared.updateMessageReplyStatus(id: message.id, status: .failed)
                errorMessage = error.localizedDescription
            }
            sending = false
        }
    }

    private func previewItem(for attachments: [ChatAttachment], startIndex: Int) -> ImagePreviewItem? {
        let images = attachments.compactMap { attachment -> PreviewImage? in
            guard let image = UIImage(contentsOfFile: attachment.fileURL(in: applicationSupportDirectory).path) else {
                return nil
            }
            return PreviewImage(id: attachment.id, image: image)
        }
        guard !images.isEmpty else { return nil }
        return ImagePreviewItem(images: images, startIndex: startIndex)
    }

    private func pendingPreviewItem(startIndex: Int) -> ImagePreviewItem? {
        let images = pendingImageData.enumerated().compactMap { pair in
            UIImage(data: pair.element).map { PreviewImage(id: "pending-\(pair.offset)", image: $0) }
        }
        guard !images.isEmpty else { return nil }
        return ImagePreviewItem(images: images, startIndex: startIndex)
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

private extension Array {
    func asyncCompactMap<T>(_ transform: (Element) async throws -> T?) async rethrows -> [T] {
        var values: [T] = []
        for element in self {
            if let value = try await transform(element) {
                values.append(value)
            }
        }
        return values
    }
}

private struct TimeDivider: View {
    let date: Date

    var body: some View {
        Text(label)
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.vertical, 4)
    }

    private var label: String {
        let style: Date.FormatStyle
        if Calendar.current.isDateInToday(date) {
            style = Date.FormatStyle(date: .omitted, time: .shortened)
        } else if Calendar.current.isDateInYesterday(date) {
            return "昨天 \(date.formatted(Date.FormatStyle(date: .omitted, time: .shortened).locale(Locale(identifier: "zh_CN"))))"
        } else {
            style = Date.FormatStyle(date: .abbreviated, time: .shortened)
        }
        return date.formatted(style.locale(Locale(identifier: "zh_CN")))
    }
}

private struct ContextSnapshotDivider: View {
    var body: some View {
        Label("此前对话已压缩为上下文摘要，历史消息仍可查看", systemImage: "archivebox")
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Color(uiColor: .tertiarySystemBackground), in: Capsule())
            .padding(.vertical, 2)
    }
}

private struct MessageBubble: View {
    let message: ChatMessage
    let namespace: Namespace.ID
    let onPreview: ([ChatAttachment], Int) -> Void
    let onRetry: () -> Void
    let onReply: () -> Void

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 54) }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(message.attachments) { attachment in
                    if let index = message.attachments.firstIndex(of: attachment) {
                        AttachmentRenderer(
                            attachment: attachment,
                            applicationSupportDirectory: applicationSupportDirectory
                        )
                        .matchedPreview(id: attachment.id, namespace: namespace)
                        .onTapGesture {
                            onPreview(message.attachments, index)
                        }
                    }
                }
                if !message.content.isEmpty {
                    Text(message.content)
                        .textSelection(.enabled)
                }
                if message.replyStatus == .failed {
                    Button("回复失败，重新生成", systemImage: "arrow.clockwise", action: onRetry)
                        .font(.caption.bold())
                        .buttonStyle(.borderless)
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(isUser ? Color.pink.opacity(0.82) : Color(uiColor: .secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .contextMenu {
                Button("引用回复", systemImage: "arrowshape.turn.up.left") {
                    onReply()
                }
                Button("复制", systemImage: "doc.on.doc") {
                    UIPasteboard.general.string = message.content
                }
            }
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
