import Foundation

enum TokenDisplay {
    static func ktokens(_ tokens: Int) -> String {
        String(format: "%.3fktokens", Double(tokens) / 1_000)
    }
}
