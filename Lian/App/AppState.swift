import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class AppState {
    var selectedSection: AppSection = .chat
    var theme: AppTheme = .system
    var startupError: String?

    func start() async {
        do {
            try DatabaseClient.shared.open()
            try await LegacyDatabaseImporter().importIfNeeded()
            try AppRepository.shared.deliverDueProactiveMessages()
            theme = AppTheme(rawValue: try AppRepository.shared.setting(key: "appearance.theme") ?? "") ?? .system
        } catch {
            startupError = error.localizedDescription
        }
    }
}

enum AppTheme: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: Self { self }

    var title: String {
        switch self {
        case .system: "系统"
        case .light: "浅色"
        case .dark: "深色"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
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
