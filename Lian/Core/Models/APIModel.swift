import Foundation

struct APIModel: Identifiable, Hashable, Sendable {
    let id: String
    var displayName: String
    var baseURL: String
    var modelName: String
    var supportsImages: Bool
    var isDefault: Bool
    var contextWindowTokens: Int
    let createdAt: Date
    var updatedAt: Date

    var canSelectNewAttachments: Bool {
        supportsImages
    }
}
