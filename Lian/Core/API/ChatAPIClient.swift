import Foundation

struct PromptMessage: Sendable {
    let role: String
    let content: String
}

enum ChatAPIError: LocalizedError {
    case invalidURL
    case missingKey
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: "API 地址无效"
        case .missingKey: "请先填写 API Key"
        case .invalidResponse: "模型返回的数据无法读取"
        case let .server(message): message
        }
    }
}

struct ChatAPIClient {
    func reply(
        model: APIModel,
        apiKey: String,
        messages: [PromptMessage],
        latestImageData: Data? = nil
    ) async throws -> String {
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ChatAPIError.missingKey
        }
        let endpoint = model.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/chat/completions"
        guard let url = URL(string: endpoint) else {
            throw ChatAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 90
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let encodedMessages: [[String: Any]] = messages.enumerated().map { index, message in
            guard index == messages.indices.last,
                  message.role == "user",
                  model.supportsImages,
                  let latestImageData else {
                return ["role": message.role, "content": message.content]
            }
            return [
                "role": message.role,
                "content": [
                    ["type": "text", "text": message.content],
                    [
                        "type": "image_url",
                        "image_url": ["url": "data:image/jpeg;base64,\(latestImageData.base64EncodedString())"]
                    ]
                ]
            ]
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "model": model.modelName,
            "temperature": 0.7,
            "messages": encodedMessages
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatAPIError.invalidResponse
        }
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard (200..<300).contains(httpResponse.statusCode) else {
            let error = payload?["error"] as? [String: Any]
            throw ChatAPIError.server(error?["message"] as? String ?? "HTTP \(httpResponse.statusCode)")
        }
        let choices = payload?["choices"] as? [[String: Any]]
        let message = choices?.first?["message"] as? [String: Any]
        guard let content = message?["content"] as? String else {
            throw ChatAPIError.invalidResponse
        }
        return content
    }
}
