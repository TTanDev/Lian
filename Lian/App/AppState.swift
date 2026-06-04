import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    var selectedSection: AppSection = .chat
    var startupError: String?

    func start() async {
        do {
            try DatabaseClient.shared.open()
            try await LegacyDatabaseImporter().importIfNeeded()
            try AppRepository.shared.deliverDueProactiveMessages()
        } catch {
            startupError = error.localizedDescription
        }
    }
}

enum AppSection: String, CaseIterable, Identifiable {
    case learning
    case characters
    case chat
    case models
    case profile

    var id: Self { self }

    var title: String {
        switch self {
        case .learning: "学习"
        case .characters: "角色"
        case .chat: "聊天"
        case .models: "模型"
        case .profile: "我的"
        }
    }

    var symbol: String {
        switch self {
        case .learning: "brain.head.profile"
        case .characters: "person.2"
        case .chat: "bubble.left.and.bubble.right"
        case .models: "cpu"
        case .profile: "person.crop.circle"
        }
    }
}
