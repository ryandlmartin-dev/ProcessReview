import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useObservable } from '../lib/observable';
import { recording, setPaused, stopRecording } from '../lib/pipeline';
import { Button } from '../ui/components';
import { formatDuration, useTheme } from '../ui/theme';

export default function RecordScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const rec = useObservable(recording);
  const [noteId] = useState(() => recording.get()?.noteId ?? null);
  const scrollRef = useRef<ScrollView>(null);

  // When the session ends (Stop here or from the notification), show the note.
  const active = !!rec;
  useEffect(() => {
    if (active) return;
    if (noteId) router.replace(`/note/${noteId}`);
    else router.back();
  }, [active, noteId]);

  // Back button leaves the screen but keeps recording (it's shown on the home screen).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  if (!rec) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingBottom: insets.bottom + 16 }}>
      <View style={s.top}>
        <Text style={[s.timer, { color: t.text }]}>{formatDuration(rec.elapsedMs)}</Text>
        <Text style={{ color: rec.paused ? t.warn : t.muted, fontWeight: '600' }}>
          {rec.stopping
            ? rec.pendingSegments
              ? 'Finishing transcription…'
              : 'Saving…'
            : rec.paused
              ? 'Paused'
              : 'Listening · on-device'}
        </Text>
        <View style={s.meter}>
          {rec.levels.map((l, i) => (
            <View
              key={i}
              style={{
                width: 5,
                borderRadius: 3,
                height: 6 + Math.min(1, l * 1.6) * 64,
                backgroundColor: rec.paused ? t.border : t.accent,
                opacity: 0.35 + (i / rec.levels.length) * 0.65,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={[s.transcript, { backgroundColor: t.card, borderColor: t.border }]}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <Text style={{ color: rec.liveTranscript ? t.text : t.muted, fontSize: 16, lineHeight: 24 }}>
          {rec.liveTranscript ||
            'Live transcript appears here about every 30 seconds. You can lock your phone; recording continues in the background.'}
        </Text>
        {rec.pendingSegments > 0 && (
          <Text style={{ color: t.muted, marginTop: 8, fontStyle: 'italic' }}>Transcribing…</Text>
        )}
      </ScrollView>

      <View style={s.controls}>
        <Button
          label={rec.paused ? 'Resume' : 'Pause'}
          onPress={() => setPaused(!rec.paused)}
          disabled={rec.stopping}
          style={{ flex: 1 }}
        />
        <Button
          label="Stop"
          variant="danger"
          onPress={() => stopRecording()}
          loading={rec.stopping}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { alignItems: 'center', paddingTop: 24, gap: 8 },
  timer: { fontSize: 56, fontWeight: '200', fontVariant: ['tabular-nums'] },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 80, marginTop: 8 },
  transcript: { flex: 1, margin: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  controls: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
});
