import Anthropic from '@anthropic-ai/sdk';
import type { ActionItem, Note } from './db';
import { REPORT_SYSTEM, noteDigest } from './prompts';
import { getClaudeKey, settings } from './settings';

/**
 * Optional cloud step: sends ONE note's transcript to Claude for a deeper report.
 * Only runs when the user explicitly taps a Claude action and has added an API key.
 */
export async function claudeReport(note: Note, actions: ActionItem[], instruction: string) {
  const apiKey = await getClaudeKey();
  if (!apiKey) throw new Error('Add your Claude API key in Settings first.');

  const client = new Anthropic({ apiKey });
  const response = await client.beta.messages.create({
    model: settings.get().cloudModel,
    max_tokens: 16000,
    // If a request is declined by a safety classifier, let the API retry on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: REPORT_SYSTEM(new Date(note.createdAt)),
    messages: [
      {
        role: 'user',
        content: `<notes>\n${noteDigest(note, actions)}\n</notes>\n\n<transcript>\n${
          note.transcript
        }\n</transcript>\n\nThe transcript comes from on-device speech recognition and may contain recognition errors; interpret sensibly.\n\nTask: ${instruction}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to process this recording.');
  }
  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  if (!text) throw new Error('Claude returned an empty response.');
  return text;
}
