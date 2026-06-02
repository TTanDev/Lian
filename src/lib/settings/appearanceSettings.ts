import { Platform } from 'react-native';

import { getDatabase } from '@/lib/database/client';

export type ThemeMode = 'auto' | 'dark' | 'light';

let webThemeMode: ThemeMode = 'dark';

export async function getThemeMode(): Promise<ThemeMode> {
  if (Platform.OS === 'web') {
    return webThemeMode;
  }

  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'appearance.themeMode'"
  );

  return normalizeThemeMode(row?.value);
}

export async function saveThemeMode(mode: ThemeMode) {
  const normalized = normalizeThemeMode(mode);

  if (Platform.OS === 'web') {
    webThemeMode = normalized;
    return;
  }

  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ['appearance.themeMode', normalized, Date.now()]
  );
}

function normalizeThemeMode(value?: string): ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark' ? value : 'dark';
}
