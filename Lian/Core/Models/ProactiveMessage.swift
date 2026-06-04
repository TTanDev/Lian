import Foundation

struct ProactiveMessage: Identifiable, Hashable, Sendable {
    enum Status: String, Sendable {
        case scheduled
        case delivered
        case cancelled
    }

    let id: String
    let characterID: String
    var content: String
    var scheduledAt: Date
    var notificationID: String?
    var status: Status
    let createdAt: Date
}
