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
    @State private var showingAttachmentMenu = false
    @State private var showingCamera = false
    @State private var sending = false
    @State private var errorMessage: String?
    @FocusState private var inputFocused: Bool

    private let presetEmoji = ["😊", "🥺", "❤️", "😂", "抱抱", "晚安"]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 14) {
                    ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                        if shouldShowDateHeader(at: index) {
                            DateDivider(date: message.createdAt)
                        }
                        MessageBubble(message: message)
                            .id(message.id)
                            .transition(
                                .offset(y: 72)
                                    .combined(with: .scale(scale: 0.88, anchor: .bottomTrailing))
                                    .combined(with: .opacity)
                            )
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
                .animation(.spring(response: 0.42, dampingFraction: 0.82), value: messages.count)
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
        .toolbar(.hidden, for: .tabBar)
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
            if showingAttachmentMenu {
                attachmentMenu
                    .transition(.move(edge: .bottom).combined(with: .opacity))
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
                Button("更多", systemImage: showingAttachmentMenu ? "xmark" : "plus") {
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.84)) {
                        showingAttachmentMenu.toggle()
                    }
                }
                .labelStyle(.iconOnly)
                .frame(width: 42, height: 42)
                .background(.thinMaterial, in: Circle())

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

    private var attachmentMenu: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                AttachmentAction(title: "相机", symbol: "camera.fill", enabled: selectedModel?.supportsImages == true) {
                    showingCamera = true
                    showingAttachmentMenu = false
                }
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    AttachmentActionLabel(title: "照片", symbol: "photo.on.rectangle", enabled: selectedModel?.supportsImages == true)
                }
                .disabled(selectedModel?.supportsImages != true)
            }
            Divider()
            Text("快捷表情")
                .font(.caption)
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(presetEmoji, id: \.self) { emoji in
                        Button(emoji) {
                            draft += emoji
                            showingAttachmentMenu = false
                            inputFocused = true
                        }
                        .font(emoji.count == 1 ? .title2 : .subheadline)
                        .padding(.horizontal, 12)
                        .frame(height: 40)
                        .background(.quaternary, in: Capsule())
                    }
                }
            }
            if selectedModel?.supportsImages != true {
                Label("当前角色使用的模型未开启图片能力", systemImage: "info.circle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 20, y: 8)
        .padding(.horizontal)
    }

    private func shouldShowDateHeader(at index: Int) -> Bool {
        guard index > 0 else { return true }
        return !Calendar.current.isDate(messages[index - 1].createdAt, inSameDayAs: messages[index].createdAt)
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
        showingAttachmentMenu = false
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
        showingAttachmentMenu = false
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let imageData = pendingImageData
        withAnimation(.easeOut(duration: 0.18)) {
            draft = ""
            pendingImageData = nil
            selectedPhoto = nil
        }

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
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
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
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    messages.append(assistantMessage)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            sending = false
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        guard let id = messages.last?.id else { return }
        withAnimation(.snappy(duration: 0.28)) {
            proxy.scrollTo(id, anchor: .bottom)
        }
    }
}

private struct AttachmentAction: View {
    let title: String
    let symbol: String
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            AttachmentActionLabel(title: title, symbol: symbol, enabled: enabled)
        }
        .disabled(!enabled)
    }
}

private struct AttachmentActionLabel: View {
    let title: String
    let symbol: String
    let enabled: Bool

    var body: some View {
        Label(title, systemImage: symbol)
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .opacity(enabled ? 1 : 0.4)
    }
}

private struct DateDivider: View {
    let date: Date

    var body: some View {
        Text(date.formatted(
            Date.FormatStyle(date: .long)
                .locale(Locale(identifier: "zh_CN"))
        ))
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.vertical, 4)
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
                Text(message.createdAt.formatted(
                    Date.FormatStyle(date: .abbreviated, time: .shortened)
                        .locale(Locale(identifier: "zh_CN"))
                ))
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
