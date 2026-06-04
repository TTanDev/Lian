import SwiftUI

struct ProactiveMessageSchedulerView: View {
    let character: CharacterProfile

    @State private var messages: [ProactiveMessage] = []
    @State private var content = ""
    @State private var scheduledAt = Date().addingTimeInterval(300)
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section("安排一条主动消息") {
                TextField("消息内容", text: $content, axis: .vertical)
                DatePicker("发送时间", selection: $scheduledAt, in: Date()...)
                Button("安排通知", systemImage: "bell.badge") {
                    schedule()
                }
                .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Section("已安排") {
                ForEach(messages) { message in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(message.content)
                        Text(message.scheduledAt, style: .date)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(message.scheduledAt, style: .time)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete(perform: delete)
            }
        }
        .navigationTitle("主动消息")
        .task { load() }
        .alert("操作失败", isPresented: .constant(errorMessage != nil)) {
            Button("好") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() {
        do {
            messages = try AppRepository.shared.proactiveMessages(characterID: character.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func schedule() {
        Task {
            do {
                guard try await NotificationScheduler.requestAuthorization() else {
                    throw ChatAPIError.server("未获得通知权限")
                }
                var message = ProactiveMessage(
                    id: UUID().uuidString,
                    characterID: character.id,
                    content: content,
                    scheduledAt: scheduledAt,
                    notificationID: nil,
                    status: .scheduled,
                    createdAt: .now
                )
                message.notificationID = try await NotificationScheduler.schedule(message, characterName: character.name)
                try AppRepository.shared.saveProactiveMessage(message)
                content = ""
                scheduledAt = Date().addingTimeInterval(300)
                load()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        do {
            for index in offsets {
                let message = messages[index]
                if let notificationID = message.notificationID {
                    NotificationScheduler.cancel(notificationID: notificationID)
                }
                try AppRepository.shared.deleteProactiveMessage(id: message.id)
            }
            load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
