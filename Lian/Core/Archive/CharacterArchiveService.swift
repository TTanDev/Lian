import Foundation
import UniformTypeIdentifiers
import SwiftUI

struct LianRoleDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.data, .json] }

    var data: Data

    init(data: Data) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

enum CharacterArchiveService {
    static func export(character: CharacterProfile) throws -> LianRoleDocument {
        let repository = AppRepository.shared
        let messages = try repository.messages(characterID: character.id)
        let learningSources = try repository.learningSources().filter { $0.characterID == character.id }
        let package = try CharacterArchivePackage(
            character: character,
            avatarData: data(relativePath: character.avatarPath),
            messages: messages.map { try ArchiveMessage(message: $0) },
            learningSources: learningSources.map { try ArchiveLearningSource(source: $0) }
        )
        let data = try JSONEncoder.lian.encode(package)
        return LianRoleDocument(data: data)
    }

    static func `import`(document: LianRoleDocument) async throws {
        let package = try JSONDecoder.lian.decode(CharacterArchivePackage.self, from: document.data)
        let repository = AppRepository.shared
        let store = try AttachmentStore()
        let now = Date()
        let characterID = UUID().uuidString
        let avatarPath: String?
        if let avatarData = package.avatarData {
            avatarPath = try await store.importImageData(avatarData, attachmentID: "avatar-\(characterID)")
        } else {
            avatarPath = nil
        }

        try repository.saveCharacter(package.character.profileCopy(
            id: characterID,
            name: "\(package.character.name) 副本",
            avatarPath: avatarPath,
            createdAt: now
        ))

        var messageIDMap: [String: String] = [:]
        for message in package.messages {
            let newID = UUID().uuidString
            messageIDMap[message.id] = newID
            var paths: [String] = []
            for attachment in message.attachments {
                let path = try await store.importImageData(
                    attachment.data,
                    attachmentID: "import-\(UUID().uuidString)"
                )
                paths.append(path)
            }
            _ = try repository.addMessage(
                id: newID,
                characterID: characterID,
                role: ChatMessage.Role(rawValue: message.role) ?? .user,
                content: message.content,
                attachmentPaths: paths,
                createdAt: message.createdAt,
                replyStatus: message.replyStatus.flatMap(ChatMessage.ReplyStatus.init(rawValue:))
            )
        }

        for source in package.learningSources {
            var paths: [String] = []
            for image in source.images {
                let path = try await store.importImageData(
                    image.data,
                    attachmentID: "learning-import-\(UUID().uuidString)"
                )
                paths.append(path)
            }
            try repository.saveLearningSource(
                LearningSource(
                    id: UUID().uuidString,
                    characterID: characterID,
                    modelID: source.modelID,
                    rawText: source.rawText,
                    summary: source.summary,
                    status: LearningSource.Status(rawValue: source.status) ?? .failed,
                    imagePaths: paths,
                    errorMessage: source.errorMessage,
                    createdAt: source.createdAt,
                    updatedAt: source.updatedAt
                )
            )
        }
    }

    private static func data(relativePath: String?) throws -> Data? {
        guard let relativePath, !relativePath.isEmpty else { return nil }
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let url = support.appending(path: relativePath)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try Data(contentsOf: url)
    }
}

private struct CharacterArchivePackage: Codable {
    var version = 1
    var character: ArchiveCharacter
    var avatarData: Data?
    var messages: [ArchiveMessage]
    var learningSources: [ArchiveLearningSource]

    init(
        character: CharacterProfile,
        avatarData: Data?,
        messages: [ArchiveMessage],
        learningSources: [ArchiveLearningSource]
    ) {
        self.character = ArchiveCharacter(character: character)
        self.avatarData = avatarData
        self.messages = messages
        self.learningSources = learningSources
    }
}

private struct ArchiveCharacter: Codable {
    var name: String
    var chatBackgroundPath: String?
    var summary: String
    var mood: String
    var relationshipTemperature: Int
    var persona: String
    var sharedMemories: String
    var speechStyle: String
    var triggers: String
    var modelID: String?

    init(character: CharacterProfile) {
        name = character.name
        chatBackgroundPath = character.chatBackgroundPath
        summary = character.summary
        mood = character.mood
        relationshipTemperature = character.relationshipTemperature
        persona = character.persona
        sharedMemories = character.sharedMemories
        speechStyle = character.speechStyle
        triggers = character.triggers
        modelID = character.modelID
    }

    func profileCopy(id: String, name: String, avatarPath: String?, createdAt: Date) -> CharacterProfile {
        CharacterProfile(
            id: id,
            name: name,
            avatarPath: avatarPath,
            chatBackgroundPath: chatBackgroundPath,
            summary: summary,
            mood: mood,
            relationshipTemperature: relationshipTemperature,
            persona: persona,
            sharedMemories: sharedMemories,
            speechStyle: speechStyle,
            triggers: triggers,
            modelID: modelID,
            createdAt: createdAt,
            updatedAt: createdAt
        )
    }
}

private struct ArchiveMessage: Codable {
    var id: String
    var role: String
    var content: String
    var createdAt: Date
    var replyStatus: String?
    var attachments: [ArchiveAttachment]

    init(message: ChatMessage) throws {
        id = message.id
        role = message.role.rawValue
        content = message.content
        createdAt = message.createdAt
        replyStatus = message.replyStatus?.rawValue
        attachments = try message.attachments.map(ArchiveAttachment.init(attachment:))
    }
}

private struct ArchiveAttachment: Codable {
    var data: Data

    init(attachment: ChatAttachment) throws {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        data = try Data(contentsOf: support.appending(path: attachment.localPath))
    }
}

private struct ArchiveLearningSource: Codable {
    var modelID: String
    var rawText: String
    var summary: String
    var status: String
    var errorMessage: String?
    var createdAt: Date
    var updatedAt: Date
    var images: [ArchiveLearningImage]

    init(source: LearningSource) throws {
        modelID = source.modelID
        rawText = source.rawText
        summary = source.summary
        status = source.status.rawValue
        errorMessage = source.errorMessage
        createdAt = source.createdAt
        updatedAt = source.updatedAt
        images = try source.imagePaths.map(ArchiveLearningImage.init(path:))
    }
}

private struct ArchiveLearningImage: Codable {
    var data: Data

    init(path: String) throws {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        data = try Data(contentsOf: support.appending(path: path))
    }
}

private extension JSONEncoder {
    static var lian: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

private extension JSONDecoder {
    static var lian: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
