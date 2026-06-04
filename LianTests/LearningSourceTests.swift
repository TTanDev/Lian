import Foundation
import Testing
@testable import Lian

struct LearningSourceTests {
    @Test
    func onlyCompletedLearningIsAddedToChatPrompt() {
        let character = CharacterProfile(
            id: "character",
            name: "林雨",
            avatarPath: nil,
            chatBackgroundPath: nil,
            summary: "",
            mood: "平静",
            relationshipTemperature: 50,
            persona: "",
            sharedMemories: "",
            speechStyle: "",
            triggers: "",
            modelID: nil,
            createdAt: .now,
            updatedAt: .now
        )
        let completed = source(id: "completed", summary: "喜欢桂花", status: .learned)
        let failed = source(id: "failed", summary: "不应注入", status: .failed)

        let prompt = PromptBuilder.chat(
            character: character,
            messages: [],
            learnedSources: [completed, failed]
        )

        #expect(prompt.first?.content.contains("喜欢桂花") == true)
        #expect(prompt.first?.content.contains("不应注入") == false)
    }

    private func source(id: String, summary: String, status: LearningSource.Status) -> LearningSource {
        LearningSource(
            id: id,
            characterID: "character",
            modelID: "model",
            rawText: "",
            summary: summary,
            status: status,
            imagePaths: [],
            errorMessage: nil,
            createdAt: .now,
            updatedAt: .now
        )
    }
}
