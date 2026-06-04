import Foundation

enum LearningService {
    static func learn(source: LearningSource, model: APIModel) async throws -> String {
        let imageData = try source.imagePaths.map(loadImageData)
        guard imageData.isEmpty || model.supportsImages else {
            throw ChatAPIError.server("所选模型不支持图片理解")
        }

        let instruction = """
        请学习下面的资料，并整理成一份准确、紧凑、适合长期记忆的中文知识。
        保留关键事实、人物关系、偏好、约束和图片中的有效信息。
        不要描述学习过程，不要添加资料中不存在的事实，只输出学习结果。

        资料正文：
        \(source.rawText.isEmpty ? "（无文字资料，请理解所附图片）" : source.rawText)
        """
        return try await ChatAPIClient().reply(
            model: model,
            apiKey: KeychainStore.apiKey(modelID: model.id),
            messages: [PromptMessage(role: "user", content: instruction)],
            latestImageData: imageData
        ).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func loadImageData(path: String) throws -> Data {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return try Data(contentsOf: support.appending(path: path))
    }
}
