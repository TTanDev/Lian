import * as SQLite from 'expo-sqlite';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initialized = false;

export async function getDatabase() {
  databasePromise ??= SQLite.openDatabaseAsync('lian.db');
  const database = await databasePromise;

  if (!initialized) {
    await initializeDatabase(database);
    initialized = true;
  }

  return database;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS ex_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      description TEXT NOT NULL,
      mood TEXT NOT NULL,
      temperature INTEGER NOT NULL,
      persona TEXT NOT NULL DEFAULT '',
      shared_memories TEXT NOT NULL DEFAULT '',
      speech_style TEXT NOT NULL DEFAULT '',
      triggers TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      ex_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('assistant', 'user', 'system', 'imported')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      read_at INTEGER,
      source TEXT NOT NULL DEFAULT 'normal',
      delay_note TEXT,
      sticker TEXT,
      FOREIGN KEY (ex_id) REFERENCES ex_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY NOT NULL,
      ex_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (ex_id) REFERENCES ex_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      ex_id TEXT NOT NULL,
      type TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      mood_tags TEXT NOT NULL DEFAULT '',
      usage_context TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'imported',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (ex_id) REFERENCES ex_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_sources (
      id TEXT PRIMARY KEY NOT NULL,
      ex_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      local_uri TEXT,
      raw_text TEXT,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (ex_id) REFERENCES ex_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS proactive_messages (
      id TEXT PRIMARY KEY NOT NULL,
      ex_id TEXT NOT NULL,
      content TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      delivered_at INTEGER,
      notification_id TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (ex_id) REFERENCES ex_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await ensureColumn(database, 'proactive_messages', 'notification_id', 'TEXT');

  const profileCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ex_profiles'
  );

  if (!profileCount?.count) {
    await seedDatabase(database);
  }
}

async function ensureColumn(
  database: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  columnType: string
) {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    await database.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
  }
}

async function seedDatabase(database: SQLite.SQLiteDatabase) {
  const now = Date.now();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO ex_profiles
        (id, name, avatar, description, mood, temperature, persona, shared_memories, speech_style, triggers, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'rain',
        '林雨',
        '林',
        '会嘴硬，但很在意回复速度。生气时会先冷下来，再用很短的话试探。',
        '有点委屈',
        62,
        '嘴硬、敏感、在意被忽略。她不会每次都发脾气，但会记住对方是不是用心。',
        '你们曾经因为回复太慢吵过几次，她表面说没事，其实会在意。',
        '短句偏多，偶尔阴阳怪气。委屈时会说“算了”。',
        '长时间不回复、敷衍解释、临睡前突然消失。',
        now - 86400000,
        now
      ]
    );

    await database.runAsync(
      `INSERT INTO ex_profiles
        (id, name, avatar, description, mood, temperature, persona, shared_memories, speech_style, triggers, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'moon',
        '许月',
        '月',
        '平时温柔，吵架时会沉默。喜欢用表情包缓和气氛。',
        '冷淡',
        48,
        '温柔但会回避冲突，不喜欢把话说太重。',
        '你们常用表情包缓和尴尬，很多话不会直接讲破。',
        '语气轻，常用省略号。生气时会变得很客气。',
        '逼问、反复解释、在她冷静时继续追问。',
        now - 172800000,
        now
      ]
    );

    await database.runAsync(
      `INSERT INTO messages (id, ex_id, role, content, created_at, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['rain-m1', 'rain', 'assistant', '你在干嘛', now - 12900000, 'normal']
    );
    await database.runAsync(
      `INSERT INTO messages (id, ex_id, role, content, created_at, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['rain-m2', 'rain', 'user', '刚忙完，今天事情有点多', now - 540000, 'normal']
    );
    await database.runAsync(
      `INSERT INTO messages (id, ex_id, role, content, created_at, source, delay_note, sticker)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'rain-m3',
        'rain',
        'assistant',
        '三小时三十四分钟。你是真的忙，还是现在连回我都要排队了？',
        now - 480000,
        'normal',
        '你 3 小时 34 分钟后回复',
        '🙂'
      ]
    );

    await database.runAsync(
      `INSERT INTO messages (id, ex_id, role, content, created_at, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['moon-m1', 'moon', 'assistant', '算了，你忙吧。', now - 86400000, 'normal']
    );

    await database.runAsync(
      `INSERT INTO memories (id, ex_id, type, title, body, importance, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'rain-memory-reply',
        'rain',
        'relationship',
        '回复延迟',
        '她对长时间不回复很敏感，但不会每次直接发火。',
        5,
        'seed',
        now,
        now
      ]
    );
  });
}
