import { Link, Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listActionItems, listNotes, updateActionItem, type ActionItem, type Note } from '../lib/db';
import { llmReady } from '../lib/llm';
import { modelFilesVersion } from '../lib/models';
import { dataVersion, useObservable } from '../lib/observable';
import { progress, recording, startRecording, whisperReady } from '../lib/pipeline';
import { formatWhen } from '../lib/reminders';
import { settings } from '../lib/settings';
import { Button, Card, Chip } from '../ui/components';
import { formatDate, formatDuration, useTheme } from '../ui/theme';

type Tab = 'notes' | 'todos';

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const version = useObservable(dataVersion);
  const rec = useObservable(recording);
  const prog = useObservable(progress);
  useObservable(modelFilesVersion);
  useObservable(settings);
  const [tab, setTab] = useState<Tab>('notes');
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<(ActionItem & { noteTitle?: string })[]>([]);

  useEffect(() => {
    listNotes(query).then(setNotes);
  }, [version, query]);

  useEffect(() => {
    if (tab !== 'todos') return;
    (async () => {
      const items = await listActionItems();
      const all = await listNotes();
      const titles = new Map(all.map((n) => [n.id, n.title]));
      setTodos(items.map((i) => ({ ...i, noteTitle: titles.get(i.noteId) })));
    })();
  }, [version, tab]);

  const speechReady = whisperReady();
  const aiReady = llmReady();

  const onRecord = async () => {
    if (rec) {
      router.push('/record');
      return;
    }
    try {
      await startRecording();
      router.push('/record');
    } catch (e) {
      Alert.alert('Cannot record', e instanceof Error ? e.message : String(e), [
        { text: 'OK' },
        { text: 'Open Settings', onPress: () => router.push('/settings') },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={12}>
                <Text style={{ color: t.primary, fontSize: 16, fontWeight: '600' }}>Settings</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {(!speechReady || !aiReady) && (
        <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: 16 }}>
          <Card style={{ borderColor: t.warn }}>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Finish setup: download the on-device models</Text>
            <Text style={{ color: t.muted, fontSize: 14 }}>
              {!speechReady ? 'Speech model needed to record. ' : ''}
              {!aiReady ? 'AI model needed for summaries, action items and reports. ' : ''}
              One-time download over Wi-Fi; after that everything works offline.
            </Text>
          </Card>
        </Pressable>
      )}

      <View style={[s.tabs, { backgroundColor: t.chip }]}>
        {(['notes', 'todos'] as Tab[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={[s.tab, tab === k && { backgroundColor: t.card }]}
          >
            <Text style={{ color: tab === k ? t.text : t.muted, fontWeight: '600' }}>
              {k === 'notes' ? 'Notes' : 'To-dos'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'notes' ? (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 + insets.bottom, gap: 12 }}
          ListHeaderComponent={
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes"
              placeholderTextColor={t.muted}
              style={[s.search, { backgroundColor: t.card, color: t.text, borderColor: t.border }]}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
              <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>
                {query ? 'No matches' : 'No notes yet'}
              </Text>
              <Text style={{ color: t.muted, textAlign: 'center', paddingHorizontal: 24 }}>
                {query
                  ? 'Try another word.'
                  : 'Tap Record and just talk: meetings, ideas, to-dos. Pocket Notes turns it into an organised note, entirely on your phone.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/note/${item.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', flex: 1 }} numberOfLines={2}>
                    {item.title || 'Untitled'}
                  </Text>
                  <StatusBadge note={item} message={prog[item.id]} />
                </View>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  {formatDate(item.createdAt)}
                  {item.kind === 'voice' && item.durationMs ? ` · ${formatDuration(item.durationMs)}` : ''}
                  {item.kind === 'text' ? ' · typed' : ''}
                </Text>
                {!!item.summary && (
                  <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
                    {item.summary}
                  </Text>
                )}
                {!!item.tags.length && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {item.tags.map((tag) => (
                      <Chip key={tag} label={tag} />
                    ))}
                  </View>
                )}
              </Card>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 + insets.bottom, gap: 10 }}
          ListEmptyComponent={
            <Text style={{ color: t.muted, textAlign: 'center', paddingTop: 48 }}>
              No open to-dos. Action items from your notes show up here.
            </Text>
          }
          renderItem={({ item }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Pressable hitSlop={10} onPress={() => updateActionItem(item.id, { done: true })}>
                <View style={[s.checkbox, { borderColor: t.muted }]} />
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => router.push(`/note/${item.noteId}`)}>
                <Text style={{ color: t.text, fontSize: 15 }}>{item.text}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                  {item.reminderAt
                    ? `🔔 ${formatWhen(item.reminderAt)} · `
                    : item.dueAt
                      ? `Due ${formatWhen(item.dueAt)} · `
                      : ''}
                  {item.noteTitle}
                </Text>
              </Pressable>
            </Card>
          )}
        />
      )}

      <View style={[s.footer, { paddingBottom: 16 + insets.bottom, backgroundColor: t.bg }]}>
        <Button label="Type" onPress={() => router.push('/new-text')} style={{ flex: 1 }} />
        <Pressable
          onPress={onRecord}
          style={({ pressed }) => [s.recordButton, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={s.recordDot} />
          <Text style={{ color: t.accentText, fontSize: 17, fontWeight: '700' }}>
            {rec ? `Recording ${formatDuration(rec.elapsedMs)}` : 'Record'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatusBadge({ note, message }: { note: Note; message?: string }) {
  const t = useTheme();
  if (note.status === 'ready' && !note.error) return null;
  const label =
    message ??
    (note.status === 'recording'
      ? 'Recording'
      : note.status === 'transcribing'
        ? 'Transcribing'
        : note.status === 'processing'
          ? 'Organising'
          : note.status === 'error'
            ? 'Needs attention'
            : 'Transcript only');
  const color = note.status === 'error' ? t.accent : t.warn;
  return (
    <Text style={{ color, fontSize: 12, fontWeight: '700', maxWidth: 140 }} numberOfLines={1}>
      {label}
    </Text>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  recordButton: { flex: 2.2, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  recordDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2 },
});
