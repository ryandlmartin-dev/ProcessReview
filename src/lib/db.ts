import * as SQLite from 'expo-sqlite';
import { bumpData } from './observable';

export type NoteStatus = 'recording' | 'transcribing' | 'processing' | 'ready' | 'error';

export type Note = {
  id: string;
  createdAt: number;
  updatedAt: number;
  kind: 'voice' | 'text';
  title: string;
  status: NoteStatus;
  durationMs: number;
  audioPath: string | null;
  transcript: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  tags: string[];
  error: string | null;
};

export type ActionItem = {
  id: string;
  noteId: string;
  text: string;
  dueText: string;
  dueAt: number | null;
  done: boolean;
  reminderId: string | null;
  reminderAt: number | null;
};

export type Report = {
  id: string;
  noteId: string;
  template: string;
  title: string;
  body: string;
  engine: 'local' | 'claude';
  createdAt: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('pocketnotes.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          kind TEXT NOT NULL DEFAULT 'voice',
          title TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          audio_path TEXT,
          transcript TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          key_points TEXT NOT NULL DEFAULT '[]',
          decisions TEXT NOT NULL DEFAULT '[]',
          tags TEXT NOT NULL DEFAULT '[]',
          error TEXT
        );
        CREATE TABLE IF NOT EXISTS action_items (
          id TEXT PRIMARY KEY NOT NULL,
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          due_text TEXT NOT NULL DEFAULT '',
          due_at INTEGER,
          done INTEGER NOT NULL DEFAULT 0,
          reminder_id TEXT,
          reminder_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY NOT NULL,
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          template TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          engine TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_actions_note ON action_items(note_id);
        CREATE INDEX IF NOT EXISTS idx_reports_note ON reports(note_id);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const parseList = (s: string | null): string[] => {
  try {
    const v = JSON.parse(s ?? '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

type NoteRow = {
  id: string;
  created_at: number;
  updated_at: number;
  kind: string;
  title: string;
  status: string;
  duration_ms: number;
  audio_path: string | null;
  transcript: string;
  summary: string;
  key_points: string;
  decisions: string;
  tags: string;
  error: string | null;
};

const toNote = (r: NoteRow): Note => ({
  id: r.id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  kind: r.kind === 'text' ? 'text' : 'voice',
  title: r.title,
  status: r.status as NoteStatus,
  durationMs: r.duration_ms,
  audioPath: r.audio_path,
  transcript: r.transcript,
  summary: r.summary,
  keyPoints: parseList(r.key_points),
  decisions: parseList(r.decisions),
  tags: parseList(r.tags),
  error: r.error,
});

export async function createNote(init: Partial<Note> & { kind: Note['kind']; status: NoteStatus }) {
  const db = await getDb();
  const now = Date.now();
  const id = init.id ?? newId();
  await db.runAsync(
    `INSERT INTO notes (id, created_at, updated_at, kind, title, status, duration_ms, audio_path, transcript)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    now,
    now,
    init.kind,
    init.title ?? '',
    init.status,
    init.durationMs ?? 0,
    init.audioPath ?? null,
    init.transcript ?? ''
  );
  bumpData();
  return id;
}

export async function updateNote(id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) {
  const db = await getDb();
  const map: Record<string, unknown> = {
    kind: patch.kind,
    title: patch.title,
    status: patch.status,
    duration_ms: patch.durationMs,
    audio_path: patch.audioPath,
    transcript: patch.transcript,
    summary: patch.summary,
    key_points: patch.keyPoints && JSON.stringify(patch.keyPoints),
    decisions: patch.decisions && JSON.stringify(patch.decisions),
    tags: patch.tags && JSON.stringify(patch.tags),
    error: patch.error,
  };
  const cols = Object.entries(map).filter(([, v]) => v !== undefined);
  if (!cols.length) return;
  const sets = cols.map(([k]) => `${k} = ?`).join(', ');
  await db.runAsync(
    `UPDATE notes SET ${sets}, updated_at = ? WHERE id = ?`,
    ...(cols.map(([, v]) => v) as SQLite.SQLiteBindValue[]),
    Date.now(),
    id
  );
  bumpData();
}

export async function appendTranscript(id: string, text: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE notes SET transcript = CASE WHEN transcript = '' THEN ? ELSE transcript || ' ' || ? END, updated_at = ? WHERE id = ?`,
    text,
    text,
    Date.now(),
    id
  );
  bumpData();
}

export async function getNote(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', id);
  return row ? toNote(row) : null;
}

export async function listNotes(query = '') {
  const db = await getDb();
  const q = query.trim();
  const rows = q
    ? await db.getAllAsync<NoteRow>(
        `SELECT * FROM notes
         WHERE title LIKE ?1 OR summary LIKE ?1 OR transcript LIKE ?1 OR tags LIKE ?1
         ORDER BY created_at DESC`,
        `%${q}%`
      )
    : await db.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY created_at DESC');
  return rows.map(toNote);
}

export async function deleteNote(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
  bumpData();
}

type ActionRow = {
  id: string;
  note_id: string;
  text: string;
  due_text: string;
  due_at: number | null;
  done: number;
  reminder_id: string | null;
  reminder_at: number | null;
};

const toAction = (r: ActionRow): ActionItem => ({
  id: r.id,
  noteId: r.note_id,
  text: r.text,
  dueText: r.due_text,
  dueAt: r.due_at,
  done: !!r.done,
  reminderId: r.reminder_id,
  reminderAt: r.reminder_at,
});

export async function replaceActionItems(
  noteId: string,
  items: { text: string; dueText: string; dueAt: number | null }[]
) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Keep items that already have reminders or are done; replace the rest.
    await db.runAsync(
      'DELETE FROM action_items WHERE note_id = ? AND reminder_id IS NULL AND done = 0',
      noteId
    );
    for (const it of items) {
      await db.runAsync(
        'INSERT INTO action_items (id, note_id, text, due_text, due_at) VALUES (?, ?, ?, ?, ?)',
        newId(),
        noteId,
        it.text,
        it.dueText,
        it.dueAt
      );
    }
  });
  bumpData();
}

export async function listActionItems(noteId?: string) {
  const db = await getDb();
  const rows = noteId
    ? await db.getAllAsync<ActionRow>('SELECT * FROM action_items WHERE note_id = ? ORDER BY rowid', noteId)
    : await db.getAllAsync<ActionRow>(
        'SELECT * FROM action_items WHERE done = 0 ORDER BY COALESCE(reminder_at, due_at, 9e15), rowid'
      );
  return rows.map(toAction);
}

export async function updateActionItem(
  id: string,
  patch: Partial<Pick<ActionItem, 'done' | 'reminderId' | 'reminderAt' | 'text'>>
) {
  const db = await getDb();
  const map: Record<string, SQLite.SQLiteBindValue | undefined> = {
    done: patch.done === undefined ? undefined : patch.done ? 1 : 0,
    reminder_id: patch.reminderId,
    reminder_at: patch.reminderAt,
    text: patch.text,
  };
  const cols = Object.entries(map).filter(([, v]) => v !== undefined) as [string, SQLite.SQLiteBindValue][];
  if (!cols.length) return;
  await db.runAsync(
    `UPDATE action_items SET ${cols.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
    ...cols.map(([, v]) => v),
    id
  );
  bumpData();
}

export async function getActionItem(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<ActionRow>('SELECT * FROM action_items WHERE id = ?', id);
  return row ? toAction(row) : null;
}

type ReportRow = {
  id: string;
  note_id: string;
  template: string;
  title: string;
  body: string;
  engine: string;
  created_at: number;
};

const toReport = (r: ReportRow): Report => ({
  id: r.id,
  noteId: r.note_id,
  template: r.template,
  title: r.title,
  body: r.body,
  engine: r.engine === 'claude' ? 'claude' : 'local',
  createdAt: r.created_at,
});

export async function saveReport(r: Omit<Report, 'id' | 'createdAt'>) {
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    'INSERT INTO reports (id, note_id, template, title, body, engine, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    r.noteId,
    r.template,
    r.title,
    r.body,
    r.engine,
    Date.now()
  );
  bumpData();
  return id;
}

export async function listReports(noteId: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<ReportRow>(
    'SELECT * FROM reports WHERE note_id = ? ORDER BY created_at DESC',
    noteId
  );
  return rows.map(toReport);
}

export async function getReport(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<ReportRow>('SELECT * FROM reports WHERE id = ?', id);
  return row ? toReport(row) : null;
}

export async function deleteReport(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM reports WHERE id = ?', id);
  bumpData();
}

export async function getSetting(key: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
