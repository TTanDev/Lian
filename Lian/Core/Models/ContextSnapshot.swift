import Foundation

struct ContextSnapshot: Identifiable, Hashable, Sendable {
    let id: String
    let characterID: String
    var modelID: String
    var cutoffMessageID: String
    var cutoffCreatedAt: Date
    var summary: String
    var estimatedOriginalTokens: Int
    var estimatedSummaryTokens: Int
    let createdAt: Date
}
