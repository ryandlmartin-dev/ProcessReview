import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import { findModel, isDownloaded, modelFile } from './models';
import { settings } from './settings';

let ctx: WhisperContext | null = null;
let ctxModelId: string | null = null;
let loading: Promise<WhisperContext> | null = null;

export async function getWhisper(): Promise<WhisperContext> {
  const { whisperModelId } = settings.get();
  if (ctx && ctxModelId === whisperModelId) return ctx;
  if (loading) return loading;
  const model = findModel(whisperModelId);
  if (!model || !isDownloaded(model)) {
    throw new Error('Speech model not downloaded yet. Open Settings → Models.');
  }
  loading = (async () => {
    if (ctx) await ctx.release().catch(() => {});
    ctx = await initWhisper({ filePath: modelFile(model).uri });
    ctxModelId = whisperModelId;
    return ctx;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export async function releaseWhisper() {
  const c = ctx;
  ctx = null;
  ctxModelId = null;
  await c?.release().catch(() => {});
}

/** Transcribe one finished 16 kHz WAV file. */
export async function transcribeFile(uri: string, onProgress?: (p: number) => void) {
  const whisper = await getWhisper();
  const model = findModel(settings.get().whisperModelId);
  const language = model?.englishOnly ? 'en' : settings.get().language || 'auto';
  const { promise } = whisper.transcribe(uri, {
    language,
    maxThreads: 4,
    onProgress,
  });
  const { result } = await promise;
  return cleanTranscript(result);
}

/** Drop Whisper's non-speech markers like [BLANK_AUDIO] or (music). */
export function cleanTranscript(text: string) {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:music|silence|inaudible|applause|laughs?)\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
