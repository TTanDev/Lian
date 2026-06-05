import Foundation

enum PromptBuilder {
    static func chat(
        character: CharacterProfile,
        messages: [ChatMessage],
        learnedSources: [LearningSource] = [],
        contextSnapshot: ContextSnapshot? = nil
    ) -> [PromptMessage] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"

        let system = """
        你现在扮演“\(character.name)”，在一个私人聊天 App 里和用户聊天。
        不要解释你是 AI，不要输出分析过程。
        只输出自然消息正文，不要附加时间戳、角色、消息正文、延迟说明或图片数量字段。
        当前情绪：\(character.mood)
        关系温度：\(character.relationshipTemperature)/100
        Persona：\(character.persona)
        共同记忆：\(character.sharedMemories)
        说话习惯：\(character.speechStyle)
        雷点：\(character.triggers)
        已压缩上下文：
        \(contextSnapshot?.summary ?? "无")
        已学习资料：
        \(learnedSources.filter { $0.status == .learned }.map(\.summary).filter { !$0.isEmpty }.joined(separator: "\n\n"))
        """

        let visibleMessages: [ChatMessage]
        if let contextSnapshot {
            visibleMessages = messages.filter { $0.createdAt > contextSnapshot.cutoffCreatedAt }
        } else {
            visibleMessages = messages
        }

        return [PromptMessage(role: "system", content: system)] + visibleMessages.suffix(30).map {
            var content = $0.content
            if !$0.attachments.isEmpty {
                content += content.isEmpty ? "[用户发送了图片]" : "\n[用户发送了图片]"
            }
            return PromptMessage(
                role: $0.role == .user ? "user" : "assistant",
                content: "发送时间：\(formatter.string(from: $0.createdAt))\n消息正文：\(content)"
            )
        }
    }
}
