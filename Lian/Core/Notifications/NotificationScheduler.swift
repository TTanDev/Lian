import Foundation
import UserNotifications

enum NotificationScheduler {
    static func requestAuthorization() async throws -> Bool {
        try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
    }

    static func schedule(_ message: ProactiveMessage, characterName: String) async throws -> String {
        let identifier = "proactive.\(message.id)"
        let content = UNMutableNotificationContent()
        content.title = characterName
        content.body = message.content
        content.sound = .default
        content.userInfo = ["proactiveMessageID": message.id, "characterID": message.characterID]

        let interval = max(1, message.scheduledAt.timeIntervalSinceNow)
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        )
        try await UNUserNotificationCenter.current().add(request)
        return identifier
    }

    static func cancel(notificationID: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationID])
    }
}
