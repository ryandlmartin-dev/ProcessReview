import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { EventSubscription } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';
import Recorder from '../../modules/pocket-recorder';
import {
  appendTranscript,
  createNote,
  getNote,
  listNotes,
  replaceActionItems,
  updateNote,
} from './db';
import { extractNote, llmReady } from './llm';
import { errorMessage, findModel, isDownloaded } from './models';
import { Observable } from './observable';
import { parseDue } from './reminders';
import { settings } from './settings';
import { getWhisper, releaseWhisper, transcribeFile } from './transcriber';

const SEGMENT_SECONDS = 30;
const LEVEL_HISTORY = 32;

export type RecordingState = {
  noteId: string;
  elapsedMs: number;
  /** Recent loudness samples (0..1), oldest first, for the level meter. */
  levels: number[];
  paused: boolean;
  stopping: boolean;
  liveTranscript: string;
  pendingSegments: number;
};

export const recording = new Observable<RecordingState | null>(null);
/** noteId -> human-readable progress message while a note is being processed. */
export const progress = new Observable<Record<string, string>>({});

const setProgress = (id: string, msg: string | null) =>
  progress.set((p) => {
    const { [id]: _, ...rest } = p;
    return msg ? { ...rest, [id]: msg } : rest;
  });

const recordingsDir = () => {
  const d = new Directory(Paths.document, 'recordings');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};

export const audioFileFor = (noteId: string) => new File(recordingsDir(), `${noteId}.wav`);

async function requestPermissions() {
  if (Platform.OS !== 'android') return;
  const mic = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone',
    message: 'Pocket Notes needs the microphone to record. Audio is processed on this phone.',
    buttonPositive: 'Allow',
  });
  if (mic !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Microphone permission is required to record.');
  if (Platform.Version >= 33) {
    // Lets the "Recording" notification show; recording works without it.
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
  }
}

export function whisperReady() {
  const m = findModel(settings.get().whisperModelId);
  return !!m && isDownloaded(m);
}

export async function startRecording(): Promise<string> {
  if (recording.get()) return recording.get()!.noteId;
  if (!whisperReady()) throw new Error('Download a speech model first (Settings → Models).');
  await requestPermissions();

  const noteId = await createNote({ kind: 'voice', status: 'recording', title: 'Recording…' });
  const audio = audioFileFor(noteId);
  const segDir = new Directory(Paths.cache, 'segments', noteId);
  if (!segDir.exists) segDir.create({ intermediates: true, idempotent: true });

  recording.set({
    noteId,
    elapsedMs: 0,
    levels: Array(LEVEL_HISTORY).fill(0),
    paused: false,
    stopping: false,
    liveTranscript: '',
    pendingSegments: 0,
  });

  // Transcribe segments strictly in order while recording continues.
  let chain: Promise<void> = Promise.resolve();
  const subs: EventSubscription[] = [];
  const cleanup = () => subs.forEach((s) => s.remove());

  subs.push(
    Recorder.addListener('onLevel', ({ level, elapsedMs }) => {
      recording.set((r) =>
        r ? { ...r, elapsedMs, levels: r.paused ? r.levels : [...r.levels.slice(1), level] } : r
      );
    }),
    Recorder.addListener('onSegment', (seg) => {
      if (seg.path) recording.set((r) => (r ? { ...r, pendingSegments: r.pendingSegments + 1 } : r));
      chain = chain.then(async () => {
        if (seg.path) {
          try {
            const text = await transcribeFile(seg.path);
            if (text) {
              await appendTranscript(noteId, text);
              recording.set((r) =>
                r ? { ...r, liveTranscript: r.liveTranscript ? `${r.liveTranscript} ${text}` : text } : r
              );
            }
          } catch (e) {
            console.warn('Segment transcription failed', e);
          } finally {
            const f = new File(seg.path);
            if (f.exists) f.delete();
            recording.set((r) => (r ? { ...r, pendingSegments: Math.max(0, r.pendingSegments - 1) } : r));
          }
        }
        if (seg.isLast) {
          cleanup();
          if (segDir.exists) segDir.delete();
          await releaseWhisper();
          recording.set(null);
          if (!settings.get().keepAudio) {
            const f = audioFileFor(noteId);
            if (f.exists) f.delete();
            await updateNote(noteId, { audioPath: null });
          }
          await processNote(noteId);
        }
      });
    }),
    Recorder.addListener('onStopped', ({ durationMs }) => {
      recording.set((r) => (r ? { ...r, stopping: true } : r));
      updateNote(noteId, { status: 'transcribing', durationMs, audioPath: audio.uri, title: 'Transcribing…' });
      setProgress(noteId, 'Finishing transcription…');
    }),
    Recorder.addListener('onError', ({ message }) => {
      console.warn('Recorder error', message);
      updateNote(noteId, { error: message });
    })
  );

  getWhisper().catch(() => {}); // warm up the model while the first segment records

  try {
    await Recorder.start(audio.uri, segDir.uri, SEGMENT_SECONDS);
  } catch (e) {
    cleanup();
    recording.set(null);
    await updateNote(noteId, { status: 'error', error: errorMessage(e), title: 'Recording failed' });
    throw e;
  }
  return noteId;
}

export async function stopRecording() {
  recording.set((r) => (r ? { ...r, stopping: true } : r));
  await Recorder.stop();
}

export function setPaused(paused: boolean) {
  if (paused) Recorder.pause();
  else Recorder.resume();
  recording.set((r) => (r ? { ...r, paused } : r));
}

export async function createTextNote(text: string) {
  const id = await createNote({ kind: 'text', status: 'processing', title: 'New note', transcript: text.trim() });
  processNote(id);
  return id;
}

/** Transcript -> title, summary, key points, action items, tags (all on-device). */
export async function processNote(id: string) {
  const note = await getNote(id);
  if (!note) return;
  if (!note.transcript.trim()) {
    await updateNote(id, {
      status: 'ready',
      title: note.kind === 'voice' ? 'Empty recording' : 'Empty note',
      summary: 'No speech was detected.',
    });
    setProgress(id, null);
    return;
  }
  if (!llmReady()) {
    await updateNote(id, {
      status: 'ready',
      title: note.title && !note.title.endsWith('…') ? note.title : fallbackTitle(note.createdAt),
      error: 'Transcript saved. Download an AI model in Settings, then tap "Organise" for a summary and action items.',
    });
    setProgress(id, null);
    return;
  }

  await updateNote(id, { status: 'processing', error: null });
  try {
    const extracted = await extractNote(note.transcript, new Date(note.createdAt), (msg) => setProgress(id, msg));
    await updateNote(id, {
      status: 'ready',
      title: extracted.title,
      summary: extracted.summary,
      keyPoints: extracted.key_points,
      decisions: extracted.decisions,
      tags: extracted.tags,
      error: null,
    });
    await replaceActionItems(
      id,
      extracted.action_items.map((a) => ({ text: a.task.trim(), dueText: a.due?.trim() ?? '', dueAt: parseDue(a.due) }))
    );
  } catch (e) {
    await updateNote(id, { status: 'error', error: `Could not organise this note: ${errorMessage(e)}` });
  } finally {
    setProgress(id, null);
  }
}

/** Re-run transcription over the saved full recording (e.g. after a crash or a better speech model). */
export async function retranscribe(id: string) {
  const audio = audioFileFor(id);
  if (!audio.exists) throw new Error('The audio for this note was not kept.');
  repairWavHeader(audio);
  await updateNote(id, { status: 'transcribing', error: null });
  try {
    setProgress(id, 'Transcribing… 0%');
    const text = await transcribeFile(audio.uri, (p) => setProgress(id, `Transcribing… ${Math.round(p)}%`));
    await releaseWhisper();
    await updateNote(id, { transcript: text, durationMs: Math.round(((audio.size - 44) / 32000) * 1000) });
  } catch (e) {
    await updateNote(id, { status: 'error', error: `Transcription failed: ${errorMessage(e)}` });
    setProgress(id, null);
    return;
  }
  await processNote(id);
}

/** A recording interrupted by a crash has a WAV header with zero sizes; patch it from the file length. */
function repairWavHeader(file: File) {
  const size = file.size;
  if (size <= 44) return;
  const u32 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);
  const handle = file.open(FileMode.ReadWrite);
  try {
    handle.offset = 4;
    handle.writeBytes(u32(size - 8));
    handle.offset = 40;
    handle.writeBytes(u32(size - 44));
  } finally {
    handle.close();
  }
}

/** On launch, mark notes left mid-flight by a killed app so the user can recover them. */
export async function recoverInterrupted() {
  if (Recorder.getStatus().isRecording) return;
  const notes = await listNotes();
  for (const n of notes) {
    if (n.status === 'recording' || n.status === 'transcribing') {
      await updateNote(n.id, {
        status: 'error',
        title: n.title.endsWith('…') ? fallbackTitle(n.createdAt) : n.title,
        audioPath: audioFileFor(n.id).exists ? audioFileFor(n.id).uri : null,
        error: 'The app closed during this recording. Tap "Re-transcribe" to recover it from the saved audio.',
      });
    } else if (n.status === 'processing') {
      processNote(n.id);
    }
  }
}

const fallbackTitle = (ts: number) =>
  `Voice note · ${new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date(
    ts
  ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
