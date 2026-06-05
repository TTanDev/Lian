import Foundation

enum ContextCompressionService {
    struct CompressionPlan {
        let messagesToCompress: [ChatMessage]
        let cutoffMessage: ChatMessage
        let existingSnapshot: ContextSnapshot?
        let estimatedOriginalTokens: Int
    }

    static func makePlan(messages: [ChatMessage], existingSnapshot: ContextSnapshot?) -> CompressionPlan? {
        let candidates: [ChatMessage]
        if let existingSnapshot {
            candidates = messages.filter { $0.createdAt > existingSnapshot.cutoffCreatedAt }
        } else {
            candidates = messages
        }
        guard candidates.count > 30 else { return nil }
        let messagesToCompress = Array(candidates.dropLast(30))
        guard let cutoff = messagesToCompress.last else { return nil }
        let originalTokens = TokenEstimator.estimate(messages: messagesToCompress)
        return CompressionPlan(
            messagesToCompress: messagesToCompress,
            cutoffMessage: cutoff,
            existingSnapshot: existingSnapshot,
            estimatedOriginalTokens: originalTokens
        )
    }

    static func compress(
        character: CharacterProfile,
        model: APIModel,
        messages: [ChatMessage],
        existingSnapshot: ContextSnapshot?
    ) async throws -> ContextSnapshot {
        guard let plan = makePlan(messages: messages, existingSnapshot: existingSnapshot) else {
            throw ChatAPIError.server("当前聊天记录还不需要压缩")
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        let transcript = plan.messagesToCompress.map { message in
            let speaker = message.role == .user ? "用户" : character.name
            let imageNote = message.attachments.isEmpty ? "" : " [图片 \(message.attachments.count) 张]"
            return "\(speaker) \(formatter.string(from: message.createdAt))\(imageNote)：\(message.content)"
        }.joined(separator: "\n")

        let prompt = """
        请为角色“\(character.name)”压缩聊天上下文。
        目标：保留关系进展、承诺、重要事实、用户偏好、角色偏好、未完成事项、情绪变化，以及对后续聊天有用的细节。
        不要编造，不要输出过程，只输出新的上下文摘要。

        既有压缩摘要：
        \(existingSnapshot?.summary ?? "无")

        本次需要压缩的旧聊天：
        \(transcript)
        """

        let summary = try await ChatAPIClient().reply(
            model: model,
            apiKey: KeychainStore.apiKey(modelID: model.id),
            messages: [PromptMessage(role: "user", content: prompt)]
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !summary.isEmpty else { throw ChatAPIError.invalidResponse }
        return ContextSnapshot(
            id: UUID().uuidString,
            characterID: character.id,
            modelID: model.id,
            cutoffMessageID: plan.cutoffMessage.id,
            cutoffCreatedAt: plan.cutoffMessage.createdAt,
            summary: summary,
            estimatedOriginalTokens: plan.estimatedOriginalTokens,
            estimatedSummaryTokens: TokenEstimator.estimate(summary),
            createdAt: Date()
        )
    }
}
