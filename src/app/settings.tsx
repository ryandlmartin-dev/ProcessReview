import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { releaseLlm } from '../lib/llm';
import {
  CUSTOM_LLM_ID,
  MODELS,
  cancelDownload,
  customLlmModel,
  deleteModel,
  downloadModel,
  downloads,
  isDownloaded,
  modelFilesVersion,
  type ModelInfo,
} from '../lib/models';
import { useObservable } from '../lib/observable';
import { hasClaudeKey, setClaudeKey, settings, updateSettings, type CloudModel } from '../lib/settings';
import { releaseWhisper } from '../lib/transcriber';
import { Button, Card, SectionTitle } from '../ui/components';
import { useTheme } from '../ui/theme';

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
];

const CLOUD_MODELS: { id: CloudModel; label: string; note: string }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Best quality · roughly 10¢ per hour-long recording' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Faster, about half the cost' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const cfg = useObservable(settings);
  const keySet = useObservable(hasClaudeKey);
  const dl = useObservable(downloads);
  useObservable(modelFilesVersion);
  const [keyDraft, setKeyDraft] = useState('');
  const [customUrl, setCustomUrl] = useState(cfg.customLlmUrl);

  const whisperModels = MODELS.filter((m) => m.kind === 'whisper');
  const llmModels: ModelInfo[] = [
    ...MODELS.filter((m) => m.kind === 'llm'),
    ...(cfg.customLlmUrl ? [customLlmModel(cfg.customLlmUrl)] : []),
  ];
  const selectedWhisper = whisperModels.find((m) => m.id === cfg.whisperModelId);

  const select = async (m: ModelInfo) => {
    if (m.kind === 'whisper') {
      await releaseWhisper();
      await updateSettings({ whisperModelId: m.id });
    } else {
      await releaseLlm();
      await updateSettings({ llmModelId: m.id });
    }
  };

  const renderModel = (m: ModelInfo) => {
    const selected = m.kind === 'whisper' ? cfg.whisperModelId === m.id : cfg.llmModelId === m.id;
    const downloaded = isDownloaded(m);
    const state = dl[m.id];
    const downloading = !!state && !state.error;
    return (
      <Card key={m.id} style={selected ? { borderColor: t.primary, borderWidth: 2 } : undefined}>
        <Pressable onPress={() => downloaded && select(m)} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{m.name}</Text>
            {selected && <Text style={{ color: t.primary, fontWeight: '700' }}>In use</Text>}
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {m.description}
            {m.sizeMb ? ` · ${m.sizeMb >= 1000 ? `${(m.sizeMb / 1000).toFixed(1)} GB` : `${m.sizeMb} MB`}` : ''}
          </Text>
        </Pressable>
        {downloading && (
          <View style={{ gap: 6 }}>
            <View style={[s.bar, { backgroundColor: t.chip }]}>
              <View style={[s.barFill, { backgroundColor: t.primary, width: `${Math.round(state.progress * 100)}%` }]} />
            </View>
            <Text style={{ color: t.muted, fontSize: 12 }}>Downloading… {Math.round(state.progress * 100)}%</Text>
          </View>
        )}
        {state?.error && <Text style={{ color: t.accent, fontSize: 13 }}>Download failed: {state.error}</Text>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {downloading ? (
            <Button small label="Cancel" onPress={() => cancelDownload(m.id)} />
          ) : downloaded ? (
            <>
              {!selected && <Button small variant="primary" label="Use this" onPress={() => select(m)} />}
              <Button
                small
                label="Delete"
                onPress={() =>
                  Alert.alert(`Delete ${m.name}?`, 'You can download it again later.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        if (selected) await (m.kind === 'whisper' ? releaseWhisper() : releaseLlm());
                        deleteModel(m);
                      },
                    },
                  ])
                }
              />
            </>
          ) : (
            <Button
              small
              variant="primary"
              label="Download"
              onPress={() => {
                downloadModel(m);
                if (!llmModels.concat(whisperModels).some((x) => x.kind === m.kind && isDownloaded(x))) select(m);
              }}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
      <Card style={{ backgroundColor: t.chip }}>
        <Text style={{ color: t.text, fontWeight: '700' }}>Private by default</Text>
        <Text style={{ color: t.muted, fontSize: 14 }}>
          Recording, transcription, summaries, action items and reports all run on this phone. Nothing is uploaded unless
          you choose &ldquo;Deep report with Claude&rdquo; on a note.
        </Text>
      </Card>

      <SectionTitle>Speech-to-text model</SectionTitle>
      {whisperModels.map(renderModel)}

      {selectedWhisper && !selectedWhisper.englishOnly && (
        <>
          <SectionTitle>Spoken language</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LANGUAGES.map((l) => (
              <Button
                key={l.code}
                small
                label={l.label}
                variant={cfg.language === l.code ? 'primary' : 'secondary'}
                onPress={() => updateSettings({ language: l.code })}
              />
            ))}
          </View>
        </>
      )}

      <SectionTitle>On-device AI model</SectionTitle>
      {llmModels.map(renderModel)}

      <Card>
        <Text style={{ color: t.text, fontWeight: '600' }}>Custom model (advanced)</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>
          Paste a direct download link to any GGUF chat model (for example from Hugging Face).
        </Text>
        <TextInput
          value={customUrl}
          onChangeText={setCustomUrl}
          placeholder="https://huggingface.co/…/model-Q4_K_M.gguf"
          placeholderTextColor={t.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, { color: t.text, borderColor: t.border }]}
        />
        <Button
          small
          label="Save link"
          disabled={customUrl.trim() === cfg.customLlmUrl}
          onPress={async () => {
            const url = customUrl.trim();
            if (url && !/^https:\/\/.+/.test(url)) {
              Alert.alert('Invalid link', 'Use a direct https:// link to a .gguf file.');
              return;
            }
            if (cfg.llmModelId === CUSTOM_LLM_ID) await releaseLlm();
            await updateSettings({
              customLlmUrl: url,
              ...(url ? {} : cfg.llmModelId === CUSTOM_LLM_ID ? { llmModelId: 'qwen3-1.7b' } : {}),
            });
          }}
        />
      </Card>

      <SectionTitle>Audio</SectionTitle>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '600' }}>Keep audio recordings</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            About 115 MB per hour. Lets you re-transcribe or share the audio later.
          </Text>
        </View>
        <Switch value={cfg.keepAudio} onValueChange={(v) => updateSettings({ keepAudio: v })} />
      </Card>

      <SectionTitle>Cloud (optional)</SectionTitle>
      <Card>
        <Text style={{ color: t.text, fontWeight: '600' }}>Claude API key</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>
          Only used when you tap &ldquo;Deep report with Claude&rdquo;. Billed per use by Anthropic (separate from a Claude.ai
          subscription). Stored encrypted on this phone.
        </Text>
        {keySet ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: t.success, fontWeight: '600', flex: 1 }}>Key saved ✓</Text>
            <Button small label="Remove" onPress={() => setClaudeKey('')} />
          </View>
        ) : (
          <>
            <TextInput
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="sk-ant-…"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={[s.input, { color: t.text, borderColor: t.border }]}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                small
                variant="primary"
                label="Save key"
                disabled={!keyDraft.trim()}
                onPress={async () => {
                  await setClaudeKey(keyDraft);
                  setKeyDraft('');
                }}
              />
              <Button small variant="ghost" label="Get a key" onPress={() => Linking.openURL('https://console.anthropic.com/')} />
            </View>
          </>
        )}
        <View style={{ gap: 8, marginTop: 4 }}>
          {CLOUD_MODELS.map((m) => (
            <Pressable key={m.id} onPress={() => updateSettings({ cloudModel: m.id })} style={s.radioRow}>
              <View style={[s.radio, { borderColor: cfg.cloudModel === m.id ? t.primary : t.muted }]}>
                {cfg.cloudModel === m.id && <View style={[s.radioDot, { backgroundColor: t.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text }}>{m.label}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>{m.note}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
