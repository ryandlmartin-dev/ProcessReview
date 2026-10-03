import * as Sharing from 'expo-sharing';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  deleteNote,
  getNote,
  listActionItems,
  listReports,
  updateActionItem,
  updateNote,
  type ActionItem,
  type Note,
  type Report,
} from '../../lib/db';
import { llmReady, stopLocalGeneration } from '../../lib/llm';
import { dataVersion, useObservable } from '../../lib/observable';
import { audioFileFor, processNote, progress, retranscribe } from '../../lib/pipeline';
import { CUSTOM_TEMPLATE_ID, REPORT_TEMPLATES, noteDigest } from '../../lib/prompts';
import { cancelReminder, formatWhen, reminderPresets, scheduleReminder } from '../../lib/reminders';
import { generateReport, generations } from '../../lib/reports';
import { hasClaudeKey } from '../../lib/settings';
import { ActionSheet, Bullets, Button, Card, Chip, Markdown, SectionTitle, type SheetSpec } from '../../ui/components';
import { formatDate, formatDuration, useTheme } from '../../ui/theme';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const version = useObservable(dataVersion);
  const prog = useObservable(progress)[id];
  const gen = useObservable(generations)[id];
  const claudeAvailable = useObservable(hasClaudeKey);
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [sheet, setSheet] = useState<SheetSpec>(null);

  useEffect(() => {
    (async () => {
      setNote(await getNote(id));
      setActions(await listActionItems(id));
      setReports(await listReports(id));
    })();
  }, [id, version]);

  if (note === undefined) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (note === null) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.muted }}>This note was deleted.</Text>
      </View>
    );
  }

  const busy = note.status === 'transcribing' || note.status === 'processing' || note.status === 'recording';
  const hasAudio = !!note.audioPath && audioFileFor(note.id).exists;

  const shareNote = () => {
    const md = `# ${note.title}\n_${formatDate(note.createdAt)}_\n\n${noteDigest(note, actions)}${
      note.transcript ? `\n\nTranscript:\n${note.transcript}` : ''
    }`;
    Share.share({ title: note.title, message: md });
  };

  const reminderError = (e: unknown) => Alert.alert('Reminder', e instanceof Error ? e.message : String(e));

  const moreMenu = () =>
    setSheet({
      title: note.title,
      options: [
        { label: 'Share note', onPress: shareNote },
        ...(hasAudio
          ? [
              {
                label: 'Share audio',
                onPress: () => Sharing.shareAsync(audioFileFor(note.id).uri, { mimeType: 'audio/wav' }),
              },
            ]
          : []),
        {
          label: 'Delete note',
          destructive: true,
          onPress: () =>
            Alert.alert('Delete this note?', 'The transcript, audio and reports will be removed.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  for (const a of actions) if (a.reminderId) await cancelReminder(a.id);
                  const f = audioFileFor(note.id);
                  if (f.exists) f.delete();
                  await deleteNote(note.id);
                  router.back();
                },
              },
            ]),
        },
      ],
    });

  const remind = (item: ActionItem) =>
    setSheet({
      title: 'Remind me',
      message: item.text,
      options: [
        ...reminderPresets(item).map((p) => ({
          label: p.label,
          onPress: () => scheduleReminder(item, p.at).catch(reminderError),
        })),
        ...(item.reminderId
          ? [{ label: 'Remove reminder', destructive: true, onPress: () => cancelReminder(item.id) }]
          : []),
      ],
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={moreMenu} hitSlop={12}>
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: '600' }}>More</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
        <View style={{ gap: 4 }}>
          {editingTitle ? (
            <TextInput
              value={titleDraft}
              onChangeText={setTitleDraft}
              autoFocus
              onBlur={() => {
                setEditingTitle(false);
                if (titleDraft.trim()) updateNote(note.id, { title: titleDraft.trim() });
              }}
              style={[s.title, { color: t.text, borderBottomWidth: 1, borderColor: t.border }]}
            />
          ) : (
            <Pressable
              onLongPress={() => {
                setTitleDraft(note.title);
                setEditingTitle(true);
              }}
            >
              <Text style={[s.title, { color: t.text }]}>{note.title || 'Untitled'}</Text>
            </Pressable>
          )}
          <Text style={{ color: t.muted }}>
            {formatDate(note.createdAt)}
            {note.durationMs ? ` · ${formatDuration(note.durationMs)}` : ''}
          </Text>
          {!!note.tags.length && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {note.tags.map((tag) => (
                <Chip key={tag} label={tag} />
              ))}
            </View>
          )}
        </View>

        {busy && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={t.primary} />
            <Text style={{ color: t.text, flex: 1 }}>
              {prog ?? (note.status === 'processing' ? 'Organising your note…' : 'Transcribing…')}
            </Text>
          </Card>
        )}

        {!!note.error && !busy && (
          <Card style={{ borderColor: note.status === 'error' ? t.accent : t.warn, gap: 12 }}>
            <Text style={{ color: t.text }}>{note.error}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {hasAudio && (
                <Button
                  small
                  label="Re-transcribe"
                  onPress={() => retranscribe(note.id).catch((e) => Alert.alert('Error', String(e.message ?? e)))}
                />
              )}
              {!!note.transcript && (
                <Button small variant="primary" label="Organise" onPress={() => processNote(note.id)} disabled={!llmReady()} />
              )}
            </View>
          </Card>
        )}

        {!!note.summary && (
          <View style={{ gap: 8 }}>
            <SectionTitle>Summary</SectionTitle>
            <Text selectable style={{ color: t.text, fontSize: 16, lineHeight: 24 }}>
              {note.summary}
            </Text>
          </View>
        )}

        {!!actions.length && (
          <View style={{ gap: 8 }}>
            <SectionTitle>Action items</SectionTitle>
            <Card style={{ padding: 4, gap: 0 }}>
              {actions.map((a, i) => (
                <View
                  key={a.id}
                  style={[s.actionRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}
                >
                  <Pressable hitSlop={10} onPress={() => updateActionItem(a.id, { done: !a.done })}>
                    <View
                      style={[
                        s.checkbox,
                        { borderColor: a.done ? t.success : t.muted, backgroundColor: a.done ? t.success : 'transparent' },
                      ]}
                    >
                      {a.done && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
                    </View>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: a.done ? t.muted : t.text,
                        fontSize: 15,
                        textDecorationLine: a.done ? 'line-through' : 'none',
                      }}
                    >
                      {a.text}
                    </Text>
                    {(a.reminderAt || a.dueAt) && (
                      <Text style={{ color: a.reminderAt ? t.primary : t.muted, fontSize: 12, marginTop: 2 }}>
                        {a.reminderAt ? `🔔 ${formatWhen(a.reminderAt)}` : `Due ${formatWhen(a.dueAt!)}`}
                      </Text>
                    )}
                  </View>
                  {!a.done && (
                    <Pressable onPress={() => remind(a)} hitSlop={10}>
                      <Text style={{ fontSize: 20, opacity: a.reminderId ? 1 : 0.5 }}>🔔</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          </View>
        )}

        {!!note.keyPoints.length && (
          <View style={{ gap: 8 }}>
            <SectionTitle>Key points</SectionTitle>
            <Bullets items={note.keyPoints} />
          </View>
        )}

        {!!note.decisions.length && (
          <View style={{ gap: 8 }}>
            <SectionTitle>Decisions</SectionTitle>
            <Bullets items={note.decisions} />
          </View>
        )}

        {!!note.transcript && !busy && (
          <View style={{ gap: 8 }}>
            <SectionTitle
              right={
                <Button
                  small
                  variant="primary"
                  label="Create report"
                  onPress={() => setPickerOpen(true)}
                  disabled={!!gen}
                />
              }
            >
              Reports
            </SectionTitle>
            {gen && (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={t.primary} />
                  <Text style={{ color: t.text, flex: 1, fontWeight: '600' }}>
                    Writing {gen.template.toLowerCase()} {gen.engine === 'claude' ? 'with Claude' : 'on-device'}…
                  </Text>
                  {gen.engine === 'local' && <Button small label="Stop" onPress={() => stopLocalGeneration()} />}
                </View>
                {!!gen.text && <Markdown text={gen.text} selectable={false} />}
              </Card>
            )}
            {reports.map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/report/${r.id}`)}>
                <Card style={{ paddingVertical: 12 }}>
                  <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 12 }}>
                    {formatDate(r.createdAt)} · {r.engine === 'claude' ? 'Claude' : 'On-device'}
                  </Text>
                </Card>
              </Pressable>
            ))}
            {!reports.length && !gen && (
              <Text style={{ color: t.muted }}>
                Turn this note into meeting minutes, a process review, a follow-up email, an action plan and more.
              </Text>
            )}
          </View>
        )}

        {!!note.transcript && (
          <View style={{ gap: 8 }}>
            <SectionTitle
              right={
                <Pressable onPress={() => setShowTranscript((v) => !v)} hitSlop={10}>
                  <Text style={{ color: t.primary, fontWeight: '600' }}>{showTranscript ? 'Hide' : 'Show'}</Text>
                </Pressable>
              }
            >
              Transcript
            </SectionTitle>
            {showTranscript && (
              <Text selectable style={{ color: t.text, fontSize: 15, lineHeight: 23 }}>
                {note.transcript}
              </Text>
            )}
          </View>
        )}

        {note.status === 'ready' && !!note.transcript && (
          <Button label="Re-organise with AI" variant="ghost" onPress={() => processNote(note.id)} disabled={!llmReady()} />
        )}
      </ScrollView>

      <ActionSheet spec={sheet} onClose={() => setSheet(null)} />
      <ReportPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        claudeAvailable={claudeAvailable}
        localAvailable={llmReady()}
        onPick={(templateId, engine, custom) => {
          setPickerOpen(false);
          generateReport(note.id, templateId, engine, custom)
            .then((reportId) => router.push(`/report/${reportId}`))
            .catch((e) => Alert.alert('Report failed', String(e?.message ?? e)));
        }}
      />
    </View>
  );
}

function ReportPicker({
  visible,
  onClose,
  onPick,
  claudeAvailable,
  localAvailable,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (templateId: string, engine: 'local' | 'claude', custom: string) => void;
  claudeAvailable: boolean;
  localAvailable: boolean;
}) {
  const t = useTheme();
  const [useClaude, setUseClaude] = useState(false);
  const [custom, setCustom] = useState('');
  const engine = useClaude && claudeAvailable ? 'claude' : 'local';
  const canRun = engine === 'claude' || localAvailable;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: t.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>Create a report</Text>

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>Deep report with Claude (cloud)</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {claudeAvailable
                  ? 'Sends this one transcript to Claude for a higher-quality result.'
                  : 'Add a Claude API key in Settings to enable.'}
              </Text>
            </View>
            <Switch value={useClaude && claudeAvailable} onValueChange={setUseClaude} disabled={!claudeAvailable} />
          </Card>

          {!canRun && (
            <Text style={{ color: t.accent }}>Download an AI model in Settings to create reports on-device.</Text>
          )}

          {REPORT_TEMPLATES.map((tpl) => (
            <Pressable key={tpl.id} disabled={!canRun} onPress={() => onPick(tpl.id, engine, '')}>
              <Card style={{ paddingVertical: 12, opacity: canRun ? 1 : 0.5 }}>
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 16 }}>{tpl.name}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{tpl.description}</Text>
              </Card>
            </Pressable>
          ))}

          <Card>
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 16 }}>Custom</Text>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="e.g. A one-page proposal for my manager"
              placeholderTextColor={t.muted}
              multiline
              style={{ color: t.text, fontSize: 15, minHeight: 44 }}
            />
            <Button
              small
              variant="primary"
              label="Generate"
              disabled={!custom.trim() || !canRun}
              onPress={() => onPick(CUSTOM_TEMPLATE_ID, engine, custom)}
            />
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
});
