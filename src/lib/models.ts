import { Directory, File, Paths } from 'expo-file-system';
import { Observable } from './observable';
import { settings } from './settings';

export type ModelKind = 'whisper' | 'llm';

export type ModelInfo = {
  id: string;
  kind: ModelKind;
  name: string;
  description: string;
  sizeMb: number;
  url: string;
  fileName: string;
  /** For Whisper: true when the model only understands English. */
  englishOnly?: boolean;
  /** For LLMs: whether the chat template supports Qwen3-style thinking toggles. */
  thinkingToggle?: boolean;
};

const HF = 'https://huggingface.co';

export const MODELS: ModelInfo[] = [
  {
    id: 'whisper-base-en',
    kind: 'whisper',
    name: 'Whisper Base (English)',
    description: 'Fast, good accuracy. Recommended to start.',
    sizeMb: 148,
    url: `${HF}/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`,
    fileName: 'ggml-base.en.bin',
    englishOnly: true,
  },
  {
    id: 'whisper-small-en',
    kind: 'whisper',
    name: 'Whisper Small (English)',
    description: 'Noticeably more accurate, ~3x slower.',
    sizeMb: 488,
    url: `${HF}/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin`,
    fileName: 'ggml-small.en.bin',
    englishOnly: true,
  },
  {
    id: 'whisper-base',
    kind: 'whisper',
    name: 'Whisper Base (multilingual)',
    description: '99 languages, auto-detects.',
    sizeMb: 148,
    url: `${HF}/ggerganov/whisper.cpp/resolve/main/ggml-base.bin`,
    fileName: 'ggml-base.bin',
  },
  {
    id: 'qwen3-1.7b',
    kind: 'llm',
    name: 'Qwen3 1.7B',
    description: 'Fast summaries and action items. Works on most phones (4 GB+ RAM).',
    sizeMb: 1100,
    url: `${HF}/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf`,
    fileName: 'Qwen3-1.7B-Q4_K_M.gguf',
    thinkingToggle: true,
  },
  {
    id: 'qwen3-4b',
    kind: 'llm',
    name: 'Qwen3 4B',
    description: 'Much better reports. Needs a recent phone (8 GB+ RAM).',
    sizeMb: 2500,
    url: `${HF}/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf`,
    fileName: 'Qwen3-4B-Q4_K_M.gguf',
    thinkingToggle: true,
  },
  {
    id: 'llama3.2-3b',
    kind: 'llm',
    name: 'Llama 3.2 3B',
    description: 'Solid all-rounder (6 GB+ RAM).',
    sizeMb: 2000,
    url: `${HF}/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf`,
    fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  },
];

export const CUSTOM_LLM_ID = 'custom-llm';

export function customLlmModel(url: string): ModelInfo {
  const fileName = decodeURIComponent(url.split('?')[0].split('/').pop() || 'custom.gguf');
  return {
    id: CUSTOM_LLM_ID,
    kind: 'llm',
    name: 'Custom GGUF',
    description: fileName,
    sizeMb: 0,
    url,
    fileName: fileName.endsWith('.gguf') ? fileName : `${fileName}.gguf`,
  };
}

export function findModel(id: string): ModelInfo | undefined {
  if (id === CUSTOM_LLM_ID) {
    const url = settings.get().customLlmUrl;
    return url ? customLlmModel(url) : undefined;
  }
  return MODELS.find((m) => m.id === id);
}

const modelsDir = () => {
  const dir = new Directory(Paths.document, 'models');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

export const modelFile = (m: ModelInfo) => new File(modelsDir(), m.fileName);

export const isDownloaded = (m: ModelInfo) => {
  const f = modelFile(m);
  return f.exists && f.size > 1024 * 1024;
};

export type DownloadState = Record<string, { progress: number; error?: string }>;
export const downloads = new Observable<DownloadState>({});
/** Bumped when files change on disk, so UI re-checks isDownloaded. */
export const modelFilesVersion = new Observable(0);

const controllers = new Map<string, AbortController>();

export async function downloadModel(m: ModelInfo) {
  if (controllers.has(m.id)) return;
  const controller = new AbortController();
  controllers.set(m.id, controller);
  downloads.set((d) => ({ ...d, [m.id]: { progress: 0 } }));
  const partial = new File(modelsDir(), `${m.fileName}.part`);
  try {
    if (partial.exists) partial.delete();
    await File.downloadFileAsync(m.url, partial, {
      idempotent: true,
      signal: controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : m.sizeMb * 1024 * 1024;
        downloads.set((d) => ({ ...d, [m.id]: { progress: Math.min(bytesWritten / total, 1) } }));
      },
    });
    const target = modelFile(m);
    if (target.exists) target.delete();
    await partial.move(target);
    downloads.set((d) => {
      const { [m.id]: _, ...rest } = d;
      return rest;
    });
  } catch (e) {
    if (partial.exists) partial.delete();
    const aborted = controller.signal.aborted;
    downloads.set((d) => {
      const { [m.id]: _, ...rest } = d;
      return aborted ? rest : { ...rest, [m.id]: { progress: 0, error: errorMessage(e) } };
    });
  } finally {
    controllers.delete(m.id);
    modelFilesVersion.set((v) => v + 1);
  }
}

export function cancelDownload(id: string) {
  controllers.get(id)?.abort();
}

export function deleteModel(m: ModelInfo) {
  const f = modelFile(m);
  if (f.exists) f.delete();
  modelFilesVersion.set((v) => v + 1);
}

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
