import Foundation

actor LegacyDatabaseImporter {
    private let database = DatabaseClient.shared
    private let repository = AppRepository.shared

    func importIfNeeded() async throws {
        guard try !hasImported() else { return }
        guard let legacyURL = legacyDatabaseURL() else {
            try markImported()
            return
        }

        let escapedPath = legacyURL.path.replacingOccurrences(of: "'", with: "''")
        try database.execute("ATTACH DATABASE '\(escapedPath)' AS legacy;")
        defer { try? database.execute("DETACH DATABASE legacy;") }

        try importCharacters()
        try await importMessagesAndAttachments()
        try importLearningData()
        try markImported()
    }

    private func hasImported() throws -> Bool {
        try database.rows(
            "SELECT value FROM app_settings WHERE key = 'migration.expo.completed' LIMIT 1"
        ).first?["value"]?.string == "true"
    }

    private func markImported() throws {
        try database.run(
            """
            INSERT INTO app_settings(key, value, updated_at) VALUES ('migration.expo.completed', 'true', ?)
            ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at
            """,
            values: [.integer(Int64(Date().timeIntervalSince1970 * 1000))]
        )
    }

    private func legacyDatabaseURL() -> URL? {
        let manager = FileManager.default
        let library = manager.urls(for: .libraryDirectory, in: .userDomainMask).first
        let documents = manager.urls(for: .documentDirectory, in: .userDomainMask).first
        let candidates = [
            library?.appending(path: "LocalDatabase/lian.db"),
            documents?.appending(path: "SQLite/lian.db"),
            documents?.appending(path: "lian.db")
        ].compactMap { $0 }
        return candidates.first(where: { manager.fileExists(atPath: $0.path) })
    }

    private func importCharacters() throws {
        let rows = try database.rows("SELECT * FROM legacy.ex_profiles")
        for row in rows {
            let now = Date()
            try repository.saveCharacter(
                CharacterProfile(
                    id: row.text("id"),
                    name: row.text("name"),
                    avatarPath: row.optionalText("avatar_uri"),
                    chatBackgroundPath: row.optionalText("chat_background_uri"),
                    summary: row.text("description"),
                    mood: row.text("mood"),
                    relationshipTemperature: Int(row.int64("temperature") ?? 50),
                    persona: row.text("persona"),
                    sharedMemories: row.text("shared_memories"),
                    speechStyle: row.text("speech_style"),
                    triggers: row.text("triggers"),
                    createdAt: row.date("created_at") ?? now,
                    updatedAt: row.date("updated_at") ?? now
                )
            )
        }
    }

    private func importMessagesAndAttachments() async throws {
        let rows = try database.rows("SELECT * FROM legacy.messages ORDER BY created_at ASC")
        let attachmentStore = try AttachmentStore()

        for row in rows {
            let messageID = row.text("id")
            try database.run(
                """
                INSERT OR IGNORE INTO chat_messages (
                  id, character_id, role, content, source, delay_note, sticker, created_at, delivered_at, read_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                values: [
                    .text(messageID), .text(row.text("ex_id")), .text(row.text("role")),
                    .text(row.text("content")), .text(row.text("source")), row.sqlite("delay_note"),
                    row.sqlite("sticker"), .integer(row.int64("created_at") ?? 0),
                    row.sqlite("delivered_at"), row.sqlite("read_at")
                ]
            )

            guard let encoded = row.optionalText("image_uris"),
                  let data = encoded.data(using: .utf8),
                  let paths = try? JSONDecoder().decode([String].self, from: data) else {
                continue
            }
            for source in paths {
                guard let sourceURL = URL(string: source), sourceURL.isFileURL,
                      FileManager.default.fileExists(atPath: sourceURL.path) else {
                    continue
                }
                let attachmentID = UUID().uuidString
                let relativePath = try await attachmentStore.importImage(from: sourceURL, attachmentID: attachmentID)
                try database.run(
                    """
                    INSERT INTO chat_attachments (id, message_id, type, local_path, created_at)
                    VALUES (?, ?, 'image', ?, ?)
                    """,
                    values: [
                        .text(attachmentID), .text(messageID), .text(relativePath),
                        .integer(row.int64("created_at") ?? 0)
                    ]
                )
            }
        }
    }

    private func importLearningData() throws {
        try database.execute(
            """
            INSERT OR IGNORE INTO learning_sources (
              id, character_id, type, title, local_path, raw_text, summary, status, created_at, updated_at
            )
            SELECT id, ex_id, type, title, local_uri, raw_text, summary, status, created_at, updated_at
            FROM legacy.learning_sources;

            INSERT OR IGNORE INTO memories (
              id, character_id, type, title, body, importance, source, created_at, updated_at
            )
            SELECT id, ex_id, type, title, body, importance, source, created_at, updated_at
            FROM legacy.memories;

            INSERT OR IGNORE INTO proactive_messages (
              id, character_id, content, scheduled_at, delivered_at, notification_id, status, created_at
            )
            SELECT id, ex_id, content, scheduled_at, delivered_at, notification_id, status, created_at
            FROM legacy.proactive_messages;
            """
        )
    }
}

private extension Dictionary where Key == String, Value == SQLiteValue {
    func text(_ key: String) -> String { self[key]?.string ?? "" }
    func optionalText(_ key: String) -> String? { self[key]?.string }
    func int64(_ key: String) -> Int64? { self[key]?.int64 }
    func date(_ key: String) -> Date? {
        int64(key).map { Date(timeIntervalSince1970: Double($0) / 1000) }
    }
    func sqlite(_ key: String) -> SQLiteValue { self[key] ?? .null }
}
