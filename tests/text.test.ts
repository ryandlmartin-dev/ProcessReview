import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkText, parseDue, parseJson, uniq } from '../src/lib/text';

test('chunkText keeps short text whole', () => {
  assert.deepEqual(chunkText('Hello there. How are you?', 100), ['Hello there. How are you?']);
});

test('chunkText splits on sentence boundaries and loses nothing', () => {
  const text = Array.from({ length: 50 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
  const chunks = chunkText(text, 200);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 200));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text);
  assert.ok(chunks.every((c) => c.endsWith('.')));
});

test('chunkText hard-splits long unpunctuated speech', () => {
  const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
  const chunks = chunkText(text, 300);
  assert.ok(chunks.length > 5);
  assert.ok(chunks.every((c) => c.length <= 300));
  assert.equal(chunks.join(' '), text);
});

test('parseJson tolerates fences, think blocks and chatter', () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('<think>hmm {no}</think>{"a":2}'), { a: 2 });
  assert.deepEqual(parseJson('Sure! Here it is: {"a":{"b":3}} hope that helps'), { a: { b: 3 } });
  assert.throws(() => parseJson('not json'));
});

test('uniq drops blanks and case-insensitive duplicates', () => {
  assert.deepEqual(uniq(['Call Bob', 'call bob ', '', 'Email Sue']), ['Call Bob', 'Email Sue']);
});

test('parseDue handles date-times, dates and junk', () => {
  const dt = new Date(parseDue('2026-10-05 14:30')!);
  assert.deepEqual([dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes()], [2026, 9, 5, 14, 30]);
  const d = new Date(parseDue('2026-10-05')!);
  assert.equal(d.getHours(), 9); // date-only defaults to 9am
  assert.equal(parseDue(''), null);
  assert.equal(parseDue('next week'), null);
});
