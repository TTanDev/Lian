import Foundation

actor AttachmentStore {
    enum AttachmentError: Error {
        case invalidSource
    }

    private let rootDirectory: URL
    private let fileManager: FileManager

    init(fileManager: FileManager = .default) throws {
        self.fileManager = fileManager
        let applicationSupport = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        rootDirectory = applicationSupport.appending(path: "Attachments", directoryHint: .isDirectory)
        try fileManager.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
    }

    func importImage(from sourceURL: URL, attachmentID: String) throws -> String {
        guard sourceURL.isFileURL else {
            throw AttachmentError.invalidSource
        }

        let extensionName = sourceURL.pathExtension.isEmpty ? "jpg" : sourceURL.pathExtension
        let relativePath = "\(attachmentID).\(extensionName)"
        let destinationURL = rootDirectory.appending(path: relativePath)

        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }
        try fileManager.copyItem(at: sourceURL, to: destinationURL)
        return "Attachments/\(relativePath)"
    }

    func importImageData(_ data: Data, attachmentID: String, fileExtension: String = "jpg") throws -> String {
        let relativePath = "\(attachmentID).\(fileExtension)"
        let destinationURL = rootDirectory.appending(path: relativePath)
        try data.write(to: destinationURL, options: .atomic)
        return "Attachments/\(relativePath)"
    }
}
