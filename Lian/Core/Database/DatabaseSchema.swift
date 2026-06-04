import Foundation

enum DatabaseSchema {
    static let version = 3

    static let migrationV1 = """
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      avatar_path TEXT,
      chat_background_path TEXT,
      summary TEXT NOT NULL DEFAULT '',
      mood TEXT NOT NULL DEFAULT '',
      relationship_temperature INTEGER NOT NULL DEFAULT 50,
      persona TEXT NOT NULL DEFAULT '',
      shared_memories TEXT NOT NULL DEFAULT '',
      speech_style TEXT NOT NULL DEFAULT '',
      triggers TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      character_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('assistant', 'user', 'system', 'imported')),
      content TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'normal',
      delay_note TEXT,
      sticker TEXT,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      read_at INTEGER,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('image')),
      local_path TEXT NOT NULL,
      thumbnail_path TEXT,
      mime_type TEXT,
      pixel_width INTEGER,
      pixel_height INTEGER,
      file_size INTEGER,
      sha256 TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_character_created
      ON chat_messages(character_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_message
      ON chat_attachments(message_id);

    CREATE TABLE IF NOT EXISTS api_models (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model_name TEXT NOT NULL,
      supports_images INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY NOT NULL,
      character_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_sources (
      id TEXT PRIMARY KEY NOT NULL,
      character_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      local_path TEXT,
      raw_text TEXT,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'failed',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS proactive_messages (
      id TEXT PRIMARY KEY NOT NULL,
      character_id TEXT NOT NULL,
      content TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      delivered_at INTEGER,
      notification_id TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );
    """

    static let migrationV2 = """
    ALTER TABLE characters ADD COLUMN model_id TEXT REFERENCES api_models(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_characters_model ON characters(model_id);
    """

    static let migrationV3 = """
    ALTER TABLE learning_sources ADD COLUMN model_id TEXT REFERENCES api_models(id) ON DELETE SET NULL;
    ALTER TABLE learning_sources ADD COLUMN error_message TEXT;

    CREATE TABLE IF NOT EXISTS learning_source_images (
      id TEXT PRIMARY KEY NOT NULL,
      learning_source_id TEXT NOT NULL,
      local_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (learning_source_id) REFERENCES learning_sources(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_learning_source_images_source
      ON learning_source_images(learning_source_id);

    INSERT INTO learning_source_images(id, learning_source_id, local_path, created_at)
      SELECT lower(hex(randomblob(16))), id, local_path, created_at
      FROM learning_sources
      WHERE local_path IS NOT NULL AND local_path != '';

    UPDATE learning_sources SET status = 'failed' WHERE status = 'pending';
    """
}
