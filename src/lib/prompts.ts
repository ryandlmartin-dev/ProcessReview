import type { ActionItem, Note } from './db';

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  instruction: string;
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'minutes',
    name: 'Meeting minutes',
    description: 'Attendees, discussion, decisions, actions',
    instruction:
      'Write formal meeting minutes in Markdown with these sections: ## Purpose, ## Discussion (grouped by topic), ## Decisions, ## Action items (owner and due date when mentioned), ## Open questions. Leave a section out if the recording has nothing for it.',
  },
  {
    id: 'process-review',
    name: 'Process review',
    description: 'Map a process, find bottlenecks, recommend fixes',
    instruction:
      'Treat the recording as a walkthrough of a business process. Write a process review in Markdown with: ## Process overview (one paragraph), ## Current steps (numbered, with who does each step), ## Pain points and bottlenecks (each with its likely root cause), ## Risks and controls gaps, ## Recommendations (prioritised: quick wins first, then larger changes, each with expected impact), ## Open questions to validate. Only use facts from the recording; mark assumptions explicitly.',
  },
  {
    id: 'email',
    name: 'Follow-up email',
    description: 'Ready-to-send recap email',
    instruction:
      'Write a concise, friendly follow-up email recapping the conversation: a subject line (prefix "Subject: "), a two-sentence recap, the key decisions as bullets, next steps with owners and dates, and a short sign-off. Plain text, no Markdown headings.',
  },
  {
    id: 'action-plan',
    name: 'Action plan',
    description: 'Prioritised to-do list with next steps',
    instruction:
      'Turn the content into a prioritised action plan in Markdown: ## Do now, ## This week, ## Later, ## Waiting on others. Each item is a checkbox line "- [ ] task — owner — due" (omit owner or due when unknown). Finish with ## First step: the single most useful next action.',
  },
  {
    id: 'brief',
    name: 'Executive brief',
    description: 'One-paragraph bottom line plus bullets',
    instruction:
      'Write an executive brief in Markdown: start with **Bottom line:** and one short paragraph, then ## Key points (max 5 bullets), ## Risks, ## Asks / decisions needed. Be crisp; no filler.',
  },
  {
    id: 'journal',
    name: 'Thought organiser',
    description: 'Untangle a brain-dump into themes and ideas',
    instruction:
      'The recording is a personal brain-dump. Organise it in Markdown: ## Main themes (each with the related thoughts grouped beneath), ## Ideas worth pursuing, ## Worries or open loops, ## Suggested next steps. Keep the speaker\'s own wording where it is vivid.',
  },
];

export const CUSTOM_TEMPLATE_ID = 'custom';

export function describeNow(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export const EXTRACT_SYSTEM = (recordedAt: Date) => `You turn raw voice-note transcripts into clear, organised notes.
The recording was made on ${describeNow(recordedAt)} (local time). Use that to resolve relative dates like "tomorrow" or "next Friday".

Rules:
- Use only what is in the transcript. Never invent facts, names, or dates.
- title: 3-8 words that say what this note is about.
- summary: 2-4 sentences.
- key_points: the most important points, each one short sentence.
- action_items: concrete things someone committed to or should do. "due" is "YYYY-MM-DD HH:MM" when a time or date was stated or clearly implied, otherwise "".
- decisions: things that were decided.
- tags: 1-4 lowercase topic words.
- The transcript comes from speech recognition and may contain mistakes; interpret sensibly.`;

export const NOTE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    key_points: { type: 'array', items: { type: 'string' } },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          due: { type: 'string' },
        },
        required: ['task', 'due'],
      },
    },
    decisions: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'key_points', 'action_items', 'decisions', 'tags'],
};

export type ExtractedNote = {
  title: string;
  summary: string;
  key_points: string[];
  action_items: { task: string; due: string }[];
  decisions: string[];
  tags: string[];
};

export const MERGE_SYSTEM = `You combine partial notes from consecutive parts of one long recording into a single note.
Write one coherent title, a 3-5 sentence summary of the whole recording, the most important key points overall (merge duplicates, max 10), and 1-4 lowercase tags. Use only the information given.`;

export const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    key_points: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'key_points', 'tags'],
};

/** Compact, structured version of a note, used when the transcript is too long for a small model. */
export function noteDigest(note: Note, actions: ActionItem[]) {
  const lines = [`Title: ${note.title}`, `Summary: ${note.summary}`];
  if (note.keyPoints.length) lines.push('Key points:', ...note.keyPoints.map((p) => `- ${p}`));
  if (note.decisions.length) lines.push('Decisions:', ...note.decisions.map((d) => `- ${d}`));
  if (actions.length)
    lines.push('Action items:', ...actions.map((a) => `- ${a.text}${a.dueText ? ` (due ${a.dueText})` : ''}`));
  return lines.join('\n');
}

export const REPORT_SYSTEM = (recordedAt: Date) =>
  `You write polished documents from voice recordings and notes. The recording was made on ${describeNow(
    recordedAt
  )}. Use only the information provided; if something is unknown, leave it out or mark it as "TBD" rather than inventing it.`;
