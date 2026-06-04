import Foundation

struct LearningSource: Identifiable, Hashable, Sendable {
    enum Status: String, Sendable {
        case pending
        case learned
        case failed
    }

    let id: String
    let characterID: String
    var title: String
    var rawText: String
    var summary: String
    var status: Status
    let createdAt: Date
    var updatedAt: Date
}
