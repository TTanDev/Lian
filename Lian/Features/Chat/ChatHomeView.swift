import SwiftUI

struct ChatHomeView: View {
    @State private var characters: [CharacterProfile] = []
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List(characters) { character in
                NavigationLink {
                    ConversationView(character: character)
                } label: {
                    HStack(spacing: 14) {
                        Circle()
                            .fill(.pink.gradient)
                            .frame(width: 52, height: 52)
                            .overlay {
                                Text(character.name.prefix(1))
                                    .font(.title3.bold())
                                    .foregroundStyle(.white)
                            }
                        VStack(alignment: .leading, spacing: 5) {
                            Text(character.name).font(.headline)
                            Text("\(character.mood) · 关系温度 \(character.relationshipTemperature)")
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
            .task { load() }
            .refreshable { load() }
            .alert("读取失败", isPresented: .constant(errorMessage != nil)) {
                Button("好") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func load() {
        do {
            characters = try AppRepository.shared.characters()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
