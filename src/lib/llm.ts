import { initLlama, type LlamaContext } from 'llama.rn';
import type { ActionItem, Note } from './db';
import { findModel, isDownloaded, modelFile } from './models';
import {
  EXTRACT_SYSTEM,
  MERGE_SCHEMA,
  MERGE_SYSTEM,
  NOTE_SCHEMA,
  REPORT_SYSTEM,
  noteDigest,
  type ExtractedNote,
} from './prompts';
import { settings } from './settings';
import { CHUNK_CHARS, chunkText, parseJson, uniq } from './text';

const N_CTX = 8192;

let ctx: LlamaContext | null = null;
let ctxModelId: string | null = null;
let loading: Promise<LlamaContext> | null = null;

/** llama.cpp contexts run one completion at a time; queue callers. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export function llmReady() {
  const m = findModel(settings.get().llmModelId);
  return !!m && isDownloaded(m);
}

async function getLlm(onLoadProgress?: (p: number) => void): Promise<LlamaContext> {
  const { llmModelId } = settings.get();
  if (ctx && ctxModelId === llmModelId) return ctx;
  if (loading) return loading;
  const model = findModel(llmModelId);
  if (!model || !isDownloaded(model)) {
    throw new Error('AI model not downloaded yet. Open Settings → Models.');
  }
  loading = (async () => {
    if (ctx) await ctx.release().catch(() => {});
    ctx = null;
    ctx = await initLlama(
      {
        model: modelFile(model).uri,
        n_ctx: N_CTX,
        n_batch: 512,
        n_gpu_layers: 99, // uses the GPU (OpenCL) where supported, CPU otherwise
        use_mlock: false,
      },
      onLoadProgress
    );
    ctxModelId = llmModelId;
    return ctx;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export async function releaseLlm() {
  const c = ctx;
  ctx = null;
  ctxModelId = null;
  await c?.release().catch(() => {});
}

function thinkingOff() {
  return !!findModel(settings.get().llmModelId)?.thinkingToggle;
}

async function jsonCompletion<T>(system: string, user: string, schema: object, nPredict = 1200): Promise<T> {
  return serial(async () => {
    const llm = await getLlm();
    const result = await llm.completion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      jinja: true,
      enable_thinking: thinkingOff() ? false : undefined,
      response_format: { type: 'json_schema', json_schema: { strict: true, schema } },
      n_predict: nPredict,
      temperature: 0.2,
    });
    return parseJson<T>(result.content || result.text);
  });
}

/**
 * Transcript -> structured note. Long recordings are processed in chunks
 * (map), then the partial notes are merged (reduce).
 */
export async function extractNote(
  transcript: string,
  recordedAt: Date,
  onStep?: (msg: string) => void
): Promise<ExtractedNote> {
  const chunks = chunkText(transcript);
  const partials: ExtractedNote[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onStep?.(chunks.length > 1 ? `Reading part ${i + 1} of ${chunks.length}…` : 'Organising your note…');
    const user =
      chunks.length > 1
        ? `This is part ${i + 1} of ${chunks.length} of a longer recording.\n\nTranscript:\n${chunks[i]}`
        : `Transcript:\n${chunks[i]}`;
    partials.push(await jsonCompletion<ExtractedNote>(EXTRACT_SYSTEM(recordedAt), user, NOTE_SCHEMA));
  }
  if (partials.length === 1) return normalise(partials[0]);

  onStep?.('Combining parts…');
  const merged = await jsonCompletion<Pick<ExtractedNote, 'title' | 'summary' | 'key_points' | 'tags'>>(
    MERGE_SYSTEM,
    partials
      .map(
        (p, i) =>
          `Part ${i + 1}\nTitle: ${p.title}\nSummary: ${p.summary}\nKey points:\n${(p.key_points ?? [])
            .map((k) => `- ${k}`)
            .join('\n')}`
      )
      .join('\n\n'),
    MERGE_SCHEMA
  );
  return normalise({
    ...merged,
    action_items: partials.flatMap((p) => p.action_items ?? []),
    decisions: partials.flatMap((p) => p.decisions ?? []),
  });
}

function normalise(n: Partial<ExtractedNote>): ExtractedNote {
  const seenTasks = new Set<string>();
  return {
    title: (n.title || 'Untitled note').trim(),
    summary: (n.summary || '').trim(),
    key_points: uniq(n.key_points ?? []),
    decisions: uniq(n.decisions ?? []),
    tags: uniq((n.tags ?? []).map((t) => t.toLowerCase().replace(/^#/, ''))).slice(0, 4),
    action_items: (n.action_items ?? []).filter((a) => {
      const k = a.task?.trim().toLowerCase();
      if (!k || seenTasks.has(k)) return false;
      seenTasks.add(k);
      return true;
    }),
  };
}

/** Generate a free-form report on-device. Streams tokens through onToken. */
export async function localReport(
  note: Note,
  actions: ActionItem[],
  instruction: string,
  onToken?: (textSoFar: string) => void
) {
  // Small models do better with the full transcript when it fits, otherwise the structured digest.
  const source =
    note.transcript.length <= CHUNK_CHARS
      ? `Notes:\n${noteDigest(note, actions)}\n\nFull transcript:\n${note.transcript}`
      : `Notes (from a long recording):\n${noteDigest(note, actions)}`;
  return serial(async () => {
    const llm = await getLlm();
    let text = '';
    const result = await llm.completion(
      {
        messages: [
          { role: 'system', content: REPORT_SYSTEM(new Date(note.createdAt)) },
          { role: 'user', content: `${source}\n\nTask: ${instruction}` },
        ],
        jinja: true,
        enable_thinking: thinkingOff() ? false : undefined,
        n_predict: 1800,
        temperature: 0.4,
      },
      (data) => {
        text += data.token;
        onToken?.(text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trimStart());
      }
    );
    return (result.content || result.text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  });
}

export async function stopLocalGeneration() {
  await ctx?.stopCompletion().catch(() => {});
}
