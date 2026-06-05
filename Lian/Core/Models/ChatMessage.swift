import Foundation

struct ChatMessage: Identifiable, Hashable, Sendable {
    enum Role: String, Sendable {
        case assistant
        case user
        case system
        case imported
    }

    enum ReplyStatus: String, Sendable {
        case failed
    }

    let id: String
    let characterID: String
    let role: Role
    let content: String
    let createdAt: Date
    let delayNote: String?
    let sticker: String?
    let replyStatus: ReplyStatus?
    let attachments: [ChatAttachment]
}
