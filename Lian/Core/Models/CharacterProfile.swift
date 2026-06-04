import Foundation

struct CharacterProfile: Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var avatarPath: String?
    var chatBackgroundPath: String?
    var summary: String
    var mood: String
    var relationshipTemperature: Int
    var persona: String
    var sharedMemories: String
    var speechStyle: String
    var triggers: String
    var modelID: String?
    let createdAt: Date
    var updatedAt: Date
}
