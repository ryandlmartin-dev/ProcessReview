import * as SecureStore from 'expo-secure-store';
import { getSetting, setSetting } from './db';
import { Observable } from './observable';

export type CloudModel = 'claude-opus-5-5' | 'claude-sonnet-5-5';

export type Settings = {
  whisperModelId: string;
  llmModelId: string;
  /** Whisper language code, or 'auto' to detect. English-only models ignore this. */
  language: string;
  keepAudio: boolean;
  cloudModel: CloudModel;
  /** Optional user-supplied GGUF download URL (overrides catalog choice when selected). */
  customLlmUrl: string;
};

export const defaultSettings: Settings = {
  whisperModelId: 'whisper-base-en',
  llmModelId: 'qwen3-1.7b',
  language: 'en',
  keepAudio: true,
  cloudModel: 'claude-opus-5-5',
  customLlmUrl: '',
};

export const settings = new Observable<Settings>(defaultSettings);
export const hasClaudeKey = new Observable(false);

const SETTINGS_KEY = 'settings.v1';
const CLAUDE_KEY = 'claude_api_key';

export async function loadSettings() {
  const raw = await getSetting(SETTINGS_KEY);
  if (raw) {
    try {
      settings.set({ ...defaultSettings, ...JSON.parse(raw) });
    } catch {
      // Corrupt settings: fall back to defaults.
    }
  }
  hasClaudeKey.set(!!(await SecureStore.getItemAsync(CLAUDE_KEY)));
}

export async function updateSettings(patch: Partial<Settings>) {
  settings.set((s) => ({ ...s, ...patch }));
  await setSetting(SETTINGS_KEY, JSON.stringify(settings.get()));
}

export const getClaudeKey = () => SecureStore.getItemAsync(CLAUDE_KEY);

export async function setClaudeKey(key: string) {
  const trimmed = key.trim();
  if (trimmed) await SecureStore.setItemAsync(CLAUDE_KEY, trimmed);
  else await SecureStore.deleteItemAsync(CLAUDE_KEY);
  hasClaudeKey.set(!!trimmed);
}
