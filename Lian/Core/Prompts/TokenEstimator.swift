import Foundation

enum TokenEstimator {
    static func estimate(_ text: String) -> Int {
        let scalarCount = text.unicodeScalars.count
        let asciiCount = text.unicodeScalars.filter { $0.isASCII }.count
        let nonASCII = scalarCount - asciiCount
        return max(1, asciiCount / 4 + nonASCII)
    }

    static func estimate(messages: [ChatMessage]) -> Int {
        messages.reduce(0) { total, message in
            total + estimate(message.content) + message.attachments.count * 768 + 12
        }
    }
}
