import Foundation
import Testing
@testable import Lian

struct ChatMessageTests {
    @Test
    func userMessageCanCarryFailedReplyStatus() {
        let message = ChatMessage(
            id: "message",
            characterID: "character",
            role: .user,
            content: "你好",
            createdAt: .now,
            delayNote: nil,
            sticker: nil,
            replyStatus: .failed,
            attachments: []
        )

        #expect(message.replyStatus == .failed)
    }
}
