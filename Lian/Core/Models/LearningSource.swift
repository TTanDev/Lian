import Foundation

struct LearningSource: Identifiable, Hashable, Sendable {
    enum Status: String, Sendable {
        case learning
        case learned
        case failed
    }

    let id: String
    let characterID: String
    var modelID: String
    var rawText: String
    var summary: String
    var status: Status
    var imagePaths: [String]
    var errorMessage: String?
    let createdAt: Date
    var updatedAt: Date
}
