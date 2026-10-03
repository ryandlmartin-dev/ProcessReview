import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { createTextNote } from '../lib/pipeline';
import { Button } from '../ui/components';
import { useTheme } from '../ui/theme';

/** Type or paste text (e.g. a transcript from elsewhere) and organise it the same way as a recording. */
export default function NewTextNote() {
  const t = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const id = await createTextNote(text);
    router.replace(`/note/${id}`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.bg, padding: 16, gap: 12 }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        placeholder="Brain-dump, paste meeting notes or a transcript…"
        placeholderTextColor={t.muted}
        textAlignVertical="top"
        style={{
          flex: 1,
          backgroundColor: t.card,
          color: t.text,
          borderRadius: 16,
          padding: 16,
          fontSize: 16,
          lineHeight: 23,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button
          label="Organise"
          variant="primary"
          onPress={save}
          loading={busy}
          disabled={!text.trim()}
          style={{ flex: 2 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
