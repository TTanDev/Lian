import Foundation

final class AppRepository: @unchecked Sendable {
    static let shared = AppRepository()

    private let database = DatabaseClient.shared

    private init() {}

    func characters() throws -> [CharacterProfile] {
        try database.rows("SELECT * FROM characters ORDER BY updated_at DESC").map(mapCharacter)
    }

    func saveCharacter(_ character: CharacterProfile) throws {
        try database.run(
            """
            INSERT INTO characters (
              id, name, avatar_path, chat_background_path, summary, mood,
              relationship_temperature, persona, shared_memories, speech_style,
              triggers, model_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name, avatar_path = excluded.avatar_path,
              chat_background_path = excluded.chat_background_path, summary = excluded.summary,
              mood = excluded.mood, relationship_temperature = excluded.relationship_temperature,
              persona = excluded.persona, shared_memories = excluded.shared_memories,
              speech_style = excluded.speech_style, triggers = excluded.triggers,
              model_id = excluded.model_id, updated_at = excluded.updated_at
            """,
            values: [
                .text(character.id), .text(character.name), optionalText(character.avatarPath),
                optionalText(character.chatBackgroundPath), .text(character.summary), .text(character.mood),
                .integer(Int64(character.relationshipTemperature)), .text(character.persona),
                .text(character.sharedMemories), .text(character.speechStyle), .text(character.triggers),
                optionalText(character.modelID),
                .integer(character.createdAt.milliseconds), .integer(character.updatedAt.milliseconds)
            ]
        )
    }

    func deleteCharacter(id: String) throws {
        try database.run("DELETE FROM characters WHERE id = ?", values: [.text(id)])
    }

    func models() throws -> [APIModel] {
        try database.rows("SELECT * FROM api_models ORDER BY is_default DESC, updated_at DESC").map(mapModel)
    }

    func saveModel(_ model: APIModel) throws {
        try database.transaction {
            if model.isDefault {
                try database.run("UPDATE api_models SET is_default = 0")
            }
            try database.run(
                """
                INSERT INTO api_models (
                  id, display_name, base_url, model_name, supports_images, is_default, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  display_name = excluded.display_name, base_url = excluded.base_url,
                  model_name = excluded.model_name, supports_images = excluded.supports_images,
                  is_default = excluded.is_default, updated_at = excluded.updated_at
                """,
                values: [
                    .text(model.id), .text(model.displayName), .text(model.baseURL),
                    .text(model.modelName), .integer(model.supportsImages ? 1 : 0),
                    .integer(model.isDefault ? 1 : 0), .integer(model.createdAt.milliseconds),
                    .integer(model.updatedAt.milliseconds)
                ]
            )
        }
    }

    func deleteModel(id: String) throws {
        try database.run("DELETE FROM api_models WHERE id = ?", values: [.text(id)])
    }

    func setting(key: String) throws -> String? {
        try database.rows(
            "SELECT value FROM app_settings WHERE key = ? LIMIT 1",
            values: [.text(key)]
        ).first?["value"]?.string
    }

    func saveSetting(key: String, value: String) throws {
        try database.run(
            """
            INSERT INTO app_settings(key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            values: [.text(key), .text(value), .integer(Date().milliseconds)]
        )
    }

    func messages(characterID: String) throws -> [ChatMessage] {
        let messageRows = try database.rows(
            "SELECT * FROM chat_messages WHERE character_id = ? ORDER BY created_at ASC",
            values: [.text(characterID)]
        )
        return try messageRows.map { row in
            let messageID = text(row, "id")
            return ChatMessage(
                id: messageID,
                characterID: text(row, "character_id"),
                role: ChatMessage.Role(rawValue: text(row, "role")) ?? .assistant,
                content: text(row, "content"),
                createdAt: date(row, "created_at"),
                delayNote: optional(row, "delay_note"),
                sticker: optional(row, "sticker"),
                attachments: try attachments(messageID: messageID)
            )
        }
    }

    func latestMessageDates() throws -> [String: Date] {
        let rows = try database.rows(
            "SELECT character_id, MAX(created_at) AS latest_at FROM chat_messages GROUP BY character_id"
        )
        return Dictionary(uniqueKeysWithValues: rows.map {
            (text($0, "character_id"), date($0, "latest_at"))
        })
    }

    func addMessage(
        characterID: String,
        role: ChatMessage.Role,
        content: String,
        attachmentPaths: [String] = []
    ) throws -> ChatMessage {
        let now = Date()
        let messageID = UUID().uuidString
        var attachments: [ChatAttachment] = []

        try database.transaction {
            try database.run(
                "INSERT INTO chat_messages (id, character_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                values: [.text(messageID), .text(characterID), .text(role.rawValue), .text(content), .integer(now.milliseconds)]
            )
            for path in attachmentPaths {
                let attachment = ChatAttachment(
                    id: UUID().uuidString,
                    messageID: messageID,
                    kind: .image,
                    localPath: path,
                    thumbnailPath: nil,
                    mimeType: nil,
                    pixelWidth: nil,
                    pixelHeight: nil,
                    fileSize: nil,
                    sha256: nil,
                    createdAt: now
                )
                try database.run(
                    "INSERT INTO chat_attachments (id, message_id, type, local_path, created_at) VALUES (?, ?, ?, ?, ?)",
                    values: [
                        .text(attachment.id), .text(messageID), .text(attachment.kind.rawValue),
                        .text(path), .integer(now.milliseconds)
                    ]
                )
                attachments.append(attachment)
            }
            try database.run(
                "UPDATE characters SET updated_at = ? WHERE id = ?",
                values: [.integer(now.milliseconds), .text(characterID)]
            )
        }

        return ChatMessage(
            id: messageID,
            characterID: characterID,
            role: role,
            content: content,
            createdAt: now,
            delayNote: nil,
            sticker: nil,
            attachments: attachments
        )
    }

    func learningSources() throws -> [LearningSource] {
        try database.rows("SELECT * FROM learning_sources ORDER BY created_at DESC").map {
            LearningSource(
                id: text($0, "id"),
                characterID: text($0, "character_id"),
                title: text($0, "title"),
                rawText: text($0, "raw_text"),
                summary: text($0, "summary"),
                status: LearningSource.Status(rawValue: text($0, "status")) ?? .pending,
                createdAt: date($0, "created_at"),
                updatedAt: date($0, "updated_at")
            )
        }
    }

    func saveLearningSource(_ source: LearningSource) throws {
        try database.run(
            """
            INSERT INTO learning_sources (
              id, character_id, type, title, raw_text, summary, status, created_at, updated_at
            ) VALUES (?, ?, 'text', ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, raw_text = excluded.raw_text,
              summary = excluded.summary, status = excluded.status, updated_at = excluded.updated_at
            """,
            values: [
                .text(source.id), .text(source.characterID), .text(source.title), .text(source.rawText),
                .text(source.summary), .text(source.status.rawValue),
                .integer(source.createdAt.milliseconds), .integer(source.updatedAt.milliseconds)
            ]
        )
    }

    func deleteLearningSource(id: String) throws {
        try database.run("DELETE FROM learning_sources WHERE id = ?", values: [.text(id)])
    }

    func proactiveMessages(characterID: String) throws -> [ProactiveMessage] {
        try database.rows(
            "SELECT * FROM proactive_messages WHERE character_id = ? ORDER BY scheduled_at ASC",
            values: [.text(characterID)]
        ).map { row in
            ProactiveMessage(
                id: text(row, "id"),
                characterID: text(row, "character_id"),
                content: text(row, "content"),
                scheduledAt: date(row, "scheduled_at"),
                notificationID: optional(row, "notification_id"),
                status: ProactiveMessage.Status(rawValue: text(row, "status")) ?? .scheduled,
                createdAt: date(row, "created_at")
            )
        }
    }

    func saveProactiveMessage(_ message: ProactiveMessage) throws {
        try database.run(
            """
            INSERT INTO proactive_messages (
              id, character_id, content, scheduled_at, notification_id, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET content = excluded.content, scheduled_at = excluded.scheduled_at,
              notification_id = excluded.notification_id, status = excluded.status
            """,
            values: [
                .text(message.id), .text(message.characterID), .text(message.content),
                .integer(message.scheduledAt.milliseconds), optionalText(message.notificationID),
                .text(message.status.rawValue), .integer(message.createdAt.milliseconds)
            ]
        )
    }

    func deleteProactiveMessage(id: String) throws {
        try database.run("DELETE FROM proactive_messages WHERE id = ?", values: [.text(id)])
    }

    func deliverDueProactiveMessages() throws {
        let now = Date().milliseconds
        let due = try database.rows(
            "SELECT * FROM proactive_messages WHERE status = 'scheduled' AND scheduled_at <= ?",
            values: [.integer(now)]
        )
        try database.transaction {
            for row in due {
                try database.run(
                    "INSERT OR IGNORE INTO chat_messages (id, character_id, role, content, source, created_at) VALUES (?, ?, 'assistant', ?, 'proactive', ?)",
                    values: [.text("message-\(text(row, "id"))"), .text(text(row, "character_id")), .text(text(row, "content")), .integer(now)]
                )
                try database.run(
                    "UPDATE proactive_messages SET status = 'delivered', delivered_at = ? WHERE id = ?",
                    values: [.integer(now), .text(text(row, "id"))]
                )
            }
        }
    }

    private func attachments(messageID: String) throws -> [ChatAttachment] {
        try database.rows(
            "SELECT * FROM chat_attachments WHERE message_id = ? ORDER BY created_at ASC",
            values: [.text(messageID)]
        ).map { row in
            ChatAttachment(
                id: text(row, "id"),
                messageID: text(row, "message_id"),
                kind: ChatAttachment.Kind(rawValue: text(row, "type")) ?? .image,
                localPath: text(row, "local_path"),
                thumbnailPath: optional(row, "thumbnail_path"),
                mimeType: optional(row, "mime_type"),
                pixelWidth: row["pixel_width"]?.int64.map(Int.init),
                pixelHeight: row["pixel_height"]?.int64.map(Int.init),
                fileSize: row["file_size"]?.int64,
                sha256: optional(row, "sha256"),
                createdAt: date(row, "created_at")
            )
        }
    }

    private func mapCharacter(_ row: [String: SQLiteValue]) -> CharacterProfile {
        CharacterProfile(
            id: text(row, "id"),
            name: text(row, "name"),
            avatarPath: optional(row, "avatar_path"),
            chatBackgroundPath: optional(row, "chat_background_path"),
            summary: text(row, "summary"),
            mood: text(row, "mood"),
            relationshipTemperature: Int(row["relationship_temperature"]?.int64 ?? 50),
            persona: text(row, "persona"),
            sharedMemories: text(row, "shared_memories"),
            speechStyle: text(row, "speech_style"),
            triggers: text(row, "triggers"),
            modelID: optional(row, "model_id"),
            createdAt: date(row, "created_at"),
            updatedAt: date(row, "updated_at")
        )
    }

    private func mapModel(_ row: [String: SQLiteValue]) -> APIModel {
        APIModel(
            id: text(row, "id"),
            displayName: text(row, "display_name"),
            baseURL: text(row, "base_url"),
            modelName: text(row, "model_name"),
            supportsImages: row["supports_images"]?.int64 == 1,
            isDefault: row["is_default"]?.int64 == 1,
            createdAt: date(row, "created_at"),
            updatedAt: date(row, "updated_at")
        )
    }

    private func text(_ row: [String: SQLiteValue], _ key: String) -> String {
        row[key]?.string ?? ""
    }

    private func optional(_ row: [String: SQLiteValue], _ key: String) -> String? {
        row[key]?.string
    }

    private func date(_ row: [String: SQLiteValue], _ key: String) -> Date {
        Date(timeIntervalSince1970: Double(row[key]?.int64 ?? 0) / 1000)
    }

    private func optionalText(_ value: String?) -> SQLiteValue {
        value.map(SQLiteValue.text) ?? .null
    }
}

private extension Date {
    var milliseconds: Int64 { Int64(timeIntervalSince1970 * 1000) }
}
