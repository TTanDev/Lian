import Foundation

enum MessageSanitizer {
    static func clean(_ raw: String) -> String {
        let normalized = raw
            .replacingOccurrences(of: "\r\n", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let lines = normalized.components(separatedBy: "\n")
        let labels = ["消息正文：", "回复文字：", "回复内容："]

        if let index = lines.firstIndex(where: { line in labels.contains(where: line.hasPrefix) }) {
            let first = labels.reduce(lines[index]) { result, label in
                result.replacingOccurrences(of: label, with: "")
            }
            return ([first] + Array(lines.dropFirst(index + 1)))
                .filter { !isMetadata($0) }
                .joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return lines
            .filter { !isMetadata($0) }
            .joined(separator: "\n")
            .trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"“”")))
    }

    private static func isMetadata(_ line: String) -> Bool {
        let value = line.trimmingCharacters(in: .whitespaces)
        return [
            "发送时间：", "延迟说明：", "图片数量：", "角色：", "role:",
            "Role:", "assistant:", "Assistant:", "消息正文："
        ].contains(where: value.hasPrefix)
    }
}
