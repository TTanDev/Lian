import Foundation
import SQLite3

final class DatabaseClient: @unchecked Sendable {
    enum DatabaseError: Error {
        case openFailed(String)
        case executionFailed(String)
    }

    static let shared = DatabaseClient()

    private var database: OpaquePointer?
    private(set) var databaseURL: URL?
    private let lock = NSLock()

    private init() {}

    deinit {
        sqlite3_close(database)
    }

    func open() throws {
        lock.lock()
        defer { lock.unlock() }

        guard database == nil else { return }
        let fileManager = FileManager.default
        let supportDirectory = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let databaseURL = supportDirectory.appending(path: "lian.sqlite3")
        self.databaseURL = databaseURL

        guard sqlite3_open(databaseURL.path, &database) == SQLITE_OK else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "Unknown SQLite error"
            throw DatabaseError.openFailed(message)
        }

        try execute(DatabaseSchema.migrationV1)
        try execute(
            "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (\(DatabaseSchema.version), \(Int(Date().timeIntervalSince1970 * 1000)));"
        )
    }

    func execute(_ sql: String) throws {
        guard let database else {
            throw DatabaseError.executionFailed("Database is not open")
        }

        var errorMessage: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(database, sql, nil, nil, &errorMessage) == SQLITE_OK else {
            let message = errorMessage.map { String(cString: $0) } ?? "Unknown SQLite error"
            sqlite3_free(errorMessage)
            throw DatabaseError.executionFailed(message)
        }
    }

    func run(_ sql: String, values: [SQLiteValue] = []) throws {
        try withStatement(sql) { statement in
            try bind(values, to: statement)
            guard sqlite3_step(statement) == SQLITE_DONE else {
                throw DatabaseError.executionFailed(errorMessage)
            }
        }
    }

    func rows(_ sql: String, values: [SQLiteValue] = []) throws -> [[String: SQLiteValue]] {
        try withStatement(sql) { statement in
            try bind(values, to: statement)
            var result: [[String: SQLiteValue]] = []

            while sqlite3_step(statement) == SQLITE_ROW {
                var row: [String: SQLiteValue] = [:]
                for index in 0..<sqlite3_column_count(statement) {
                    let name = String(cString: sqlite3_column_name(statement, index))
                    row[name] = columnValue(statement, index: index)
                }
                result.append(row)
            }
            return result
        }
    }

    func transaction(_ work: () throws -> Void) throws {
        try run("BEGIN IMMEDIATE TRANSACTION")
        do {
            try work()
            try run("COMMIT")
        } catch {
            try? run("ROLLBACK")
            throw error
        }
    }

    private var errorMessage: String {
        database.map { String(cString: sqlite3_errmsg($0)) } ?? "Unknown SQLite error"
    }

    private func withStatement<T>(_ sql: String, work: (OpaquePointer) throws -> T) throws -> T {
        guard let database else {
            throw DatabaseError.executionFailed("Database is not open")
        }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else {
            throw DatabaseError.executionFailed(errorMessage)
        }
        defer { sqlite3_finalize(statement) }
        return try work(statement)
    }

    private func bind(_ values: [SQLiteValue], to statement: OpaquePointer) throws {
        for (offset, value) in values.enumerated() {
            let index = Int32(offset + 1)
            let result: Int32
            switch value {
            case .null:
                result = sqlite3_bind_null(statement, index)
            case let .integer(value):
                result = sqlite3_bind_int64(statement, index, value)
            case let .real(value):
                result = sqlite3_bind_double(statement, index, value)
            case let .text(value):
                result = sqlite3_bind_text(statement, index, value, -1, sqliteTransient)
            }
            guard result == SQLITE_OK else {
                throw DatabaseError.executionFailed(errorMessage)
            }
        }
    }

    private func columnValue(_ statement: OpaquePointer, index: Int32) -> SQLiteValue {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_INTEGER:
            return .integer(sqlite3_column_int64(statement, index))
        case SQLITE_FLOAT:
            return .real(sqlite3_column_double(statement, index))
        case SQLITE_TEXT:
            return .text(String(cString: sqlite3_column_text(statement, index)))
        default:
            return .null
        }
    }
}

enum SQLiteValue: Equatable {
    case null
    case integer(Int64)
    case real(Double)
    case text(String)

    var string: String? {
        if case let .text(value) = self { return value }
        return nil
    }

    var int64: Int64? {
        if case let .integer(value) = self { return value }
        return nil
    }
}

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
