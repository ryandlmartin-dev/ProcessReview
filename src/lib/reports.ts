import { claudeReport } from './cloud';
import { getNote, listActionItems, saveReport } from './db';
import { localReport } from './llm';
import { Observable } from './observable';
import { CUSTOM_TEMPLATE_ID, REPORT_TEMPLATES } from './prompts';

export type Generation = { template: string; engine: 'local' | 'claude'; text: string };

/** In-flight report generations, keyed by note id (survives navigating away). */
export const generations = new Observable<Record<string, Generation>>({});

const setGen = (noteId: string, g: Generation | null) =>
  generations.set((all) => {
    const { [noteId]: _, ...rest } = all;
    return g ? { ...rest, [noteId]: g } : rest;
  });

export async function generateReport(
  noteId: string,
  templateId: string,
  engine: 'local' | 'claude',
  customInstruction = ''
) {
  const note = await getNote(noteId);
  if (!note) throw new Error('Note not found');
  const actions = await listActionItems(noteId);
  const template = REPORT_TEMPLATES.find((t) => t.id === templateId);
  const instruction = templateId === CUSTOM_TEMPLATE_ID ? customInstruction : template?.instruction;
  if (!instruction?.trim()) throw new Error('Describe what you want the report to be.');
  const name = template?.name ?? 'Custom report';

  setGen(noteId, { template: name, engine, text: '' });
  try {
    const body =
      engine === 'claude'
        ? await claudeReport(note, actions, instruction)
        : await localReport(note, actions, instruction, (text) => setGen(noteId, { template: name, engine, text }));
    return await saveReport({
      noteId,
      template: templateId,
      title: `${name} · ${note.title}`,
      body,
      engine,
    });
  } finally {
    setGen(noteId, null);
  }
}
