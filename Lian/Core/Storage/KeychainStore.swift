import Foundation
import Security

enum KeychainStore {
    static func apiKey(modelID: String) -> String {
        read(account: "api.\(modelID)") ?? ""
    }

    static func saveAPIKey(_ value: String, modelID: String) throws {
        let account = "api.\(modelID)"
        SecItemDelete(query(account: account) as CFDictionary)
        guard !value.isEmpty else { return }

        var item = query(account: account)
        item[kSecValueData as String] = Data(value.utf8)
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    private static func read(account: String) -> String? {
        var item = query(account: account)
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(item as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private static func query(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecService as String: "com.ttan.exchat.native",
            kSecAccount as String: account
        ]
    }
}
