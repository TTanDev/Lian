import PhotosUI
import SwiftUI
import UIKit

struct ConversationView: View {
    let character: CharacterProfile

    @State private var messages: [ChatMessage] = []
    @State private var models: [APIModel] = []
    @State private var draft = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var pendingImageData: Data?
    @State private var showingCamera = false
    @State private var quotedMessage: ChatMessage?
    @State private var sending = false
    @State private var matchedMessageID: String?
    @State private var matchedText = ""
    @State private var errorMessage: String?
    @FocusState private var inputFocused: Bool
    @Namespace private var sendNamespace

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 14) {
                    ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                        if shouldShowTimeHeader(at: index) {
                            TimeDivider(date: message.createdAt)
                        }
                        MessageBubble(
                            message: message,
                            matchedMessageID: matchedMessageID,
                            namespace: sendNamespace
                        ) {
                            quotedMessage = message
                            inputFocused = true
                        }
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
                    Color.clear
                        .frame(height: 1)
                        .id("conversation-bottom")
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
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            inputBar
                .background(.ultraThinMaterial)
        }
        .sheet(isPresented: $showingCamera) {
            CameraPicker { data in
                pendingImageData = data
            }
            .ignoresSafeArea()
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
            if let pendingImageData, let image = UIImage(data: pendingImageData) {
                HStack {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 54, height: 54)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    Text("图片已准备发送")
                        .font(.subheadline)
                    Spacer()
                    Button("移除", systemImage: "xmark.circle.fill") {
                        self.pendingImageData = nil
                        selectedPhoto = nil
                    }
                    .labelStyle(.iconOnly)
                }
                .padding(.horizontal)
            }
            HStack(alignment: .bottom, spacing: 10) {
                Menu {
                    Button("相机", systemImage: "camera.fill") {
                        showingCamera = true
                    }
                    .disabled(selectedModel?.supportsImages != true)
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Label("照片", systemImage: "photo.on.rectangle")
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
                    if let matchedMessageID, !matchedText.isEmpty {
                        Text(matchedText)
                            .lineLimit(1)
                            .padding(.horizontal, 14)
                            .matchedGeometryEffect(
                                id: matchedMessageID,
                                in: sendNamespace,
                                properties: .position,
                                anchor: .leading,
                                isSource: true
                            )
                            .allowsHitTesting(false)
                    }
                }
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
        if !typedContent.isEmpty {
            matchedMessageID = messageID
            matchedText = typedContent
        }
        draft = ""
        pendingImageData = nil
        selectedPhoto = nil
        quotedMessage = nil

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
                    id: messageID,
                    characterID: character.id,
                    role: .user,
                    content: content,
                    attachmentPaths: paths
                )
                if !typedContent.isEmpty {
                    await Task.yield()
                    withAnimation(.easeOut(duration: 0.34)) {
                        messages.append(userMessage)
                    }
                    try? await Task.sleep(for: .milliseconds(360))
                    matchedMessageID = nil
                    matchedText = ""
                } else {
                    messages.append(userMessage)
                }

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
                matchedMessageID = nil
                matchedText = ""
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

private struct MessageBubble: View {
    let message: ChatMessage
    let matchedMessageID: String?
    let namespace: Namespace.ID
    let onReply: () -> Void

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
                        .modifier(
                            SendTextGeometry(
                                active: matchedMessageID == message.id,
                                id: message.id,
                                namespace: namespace
                            )
                        )
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

private struct SendTextGeometry: ViewModifier {
    let active: Bool
    let id: String
    let namespace: Namespace.ID

    @ViewBuilder
    func body(content: Content) -> some View {
        if active {
            content.matchedGeometryEffect(
                id: id,
                in: namespace,
                properties: .position,
                anchor: .leading,
                isSource: false
            )
        } else {
            content
        }
    }
}
