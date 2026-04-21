import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const SETTINGS_FILE = './data/settings.json';

export interface AppSettings {
  user_name: string;
  kimi_api_key: string;
  kimi_base_url: string;
}

const DEFAULT_BASE_URL = 'https://api.moonshot.cn/v1';

export function readSettings(): AppSettings {
  if (!existsSync(SETTINGS_FILE)) return { user_name: '', kimi_api_key: '', kimi_base_url: DEFAULT_BASE_URL };
  try {
    const data = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
    return {
      user_name: data.user_name || '',
      kimi_api_key: data.kimi_api_key || '',
      kimi_base_url: data.kimi_base_url || DEFAULT_BASE_URL,
    };
  } catch { return { user_name: '', kimi_api_key: '', kimi_base_url: DEFAULT_BASE_URL }; }
}

export function writeSettings(data: Partial<AppSettings>): AppSettings {
  mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  const current = readSettings();
  const updated = { ...current, ...data };
  writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

export function getUserName(): string { return readSettings().user_name; }
export function getKimiApiKey(): string {
  const fromSettings = readSettings().kimi_api_key;
  return fromSettings || process.env.KIMI_API_KEY || '';
}
export function getKimiBaseUrl(): string {
  const fromSettings = readSettings().kimi_base_url;
  return fromSettings || process.env.KIMI_BASE_URL || DEFAULT_BASE_URL;
}
