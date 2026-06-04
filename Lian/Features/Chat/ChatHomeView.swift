import SwiftUI

struct ChatHomeView: View {
    @State private var characters: [CharacterProfile] = []
    @State private var latestMessageDates: [String: Date] = [:]
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List(characters) { character in
                NavigationLink {
                    ConversationView(character: character)
                } label: {
                    HStack(spacing: 14) {
                        CharacterAvatar(character: character, size: 52)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(character.name).font(.headline)
                            Text(lastChatText(character))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .overlay {
                if characters.isEmpty {
                    ContentUnavailableView(
                        "还没有聊天",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("先在角色页创建一个角色")
                    )
                }
            }
            .navigationTitle("聊天")
            .toolbar(.visible, for: .tabBar)
            .task { load() }
            .refreshable { load() }
            .alert("读取失败", isPresented: .constant(errorMessage != nil)) {
                Button("好") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func lastChatText(_ character: CharacterProfile) -> String {
        guard let date = latestMessageDates[character.id] else { return "还没有开始聊天" }
        return date.formatted(
            Date.FormatStyle(date: .abbreviated, time: .shortened)
                .locale(Locale(identifier: "zh_CN"))
        )
    }

    private func load() {
        do {
            characters = try AppRepository.shared.characters()
            latestMessageDates = try AppRepository.shared.latestMessageDates()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
