import { Platform } from 'react-native';

import { getDatabase } from '@/lib/database/client';

const API_KEY_STORAGE_KEY = 'lian.api.key';
const WEB_API_KEY_STORAGE_KEY = 'lian.web.api.key';

export type ApiSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsImages: boolean;
};

const defaultSettings: ApiSettings = {
  apiKey: '',
  baseUrl: '',
  model: 'mimo2.5',
  supportsImages: false,
};

const webSettings: ApiSettings = { ...defaultSettings };

export async function getApiSettings(): Promise<ApiSettings> {
  if (Platform.OS === 'web') {
    return {
      ...webSettings,
      apiKey: localStorage.getItem(WEB_API_KEY_STORAGE_KEY) ?? '',
    };
  }

  const database = await getDatabase();
  const SecureStore = await import('expo-secure-store');
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings WHERE key IN ('api.baseUrl', 'api.model', 'api.supportsImages')"
  );
  const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
  const settings = rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});

  return {
    apiKey: apiKey ?? '',
    baseUrl: settings['api.baseUrl'] ?? '',
    model: settings['api.model'] ?? defaultSettings.model,
    supportsImages: settings['api.supportsImages'] === 'true',
  };
}

export async function saveApiSettings(settings: ApiSettings) {
  const normalized = normalizeApiSettings(settings);

  if (Platform.OS === 'web') {
    webSettings.baseUrl = normalized.baseUrl;
    webSettings.model = normalized.model;
    webSettings.apiKey = normalized.apiKey;
    localStorage.setItem(WEB_API_KEY_STORAGE_KEY, normalized.apiKey);
    return;
  }

  const database = await getDatabase();
  const SecureStore = await import('expo-secure-store');
  const now = Date.now();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ['api.baseUrl', normalized.baseUrl, now]
    );
    await database.runAsync(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ['api.model', normalized.model, now]
    );
    await database.runAsync(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ['api.supportsImages', normalized.supportsImages ? 'true' : 'false', now]
    );
  });

  if (normalized.apiKey) {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, normalized.apiKey);
  } else {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
  }
}

function normalizeApiSettings(settings: ApiSettings): ApiSettings {
  return {
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''),
    model: settings.model.trim() || defaultSettings.model,
    supportsImages: Boolean(settings.supportsImages),
  };
}
