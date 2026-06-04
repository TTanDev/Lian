import Foundation

struct ChatAttachment: Identifiable, Hashable, Sendable {
    enum Kind: String, Sendable {
        case image
    }

    let id: String
    let messageID: String
    let kind: Kind
    let localPath: String
    let thumbnailPath: String?
    let mimeType: String?
    let pixelWidth: Int?
    let pixelHeight: Int?
    let fileSize: Int64?
    let sha256: String?
    let createdAt: Date

    func fileURL(in applicationSupportDirectory: URL) -> URL {
        applicationSupportDirectory.appending(path: localPath)
    }

    func isAvailable(in applicationSupportDirectory: URL) -> Bool {
        FileManager.default.fileExists(atPath: fileURL(in: applicationSupportDirectory).path)
    }
}
