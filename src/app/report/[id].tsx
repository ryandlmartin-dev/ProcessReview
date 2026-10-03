import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { deleteReport, getReport, type Report } from '../../lib/db';
import { Button, Markdown } from '../../ui/components';
import { formatDate, useTheme } from '../../ui/theme';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getReport(id).then(setReport);
  }, [id]);

  if (!report) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: report.title.split(' · ')[0] }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}>
        <Text style={{ color: t.muted, fontSize: 13 }}>
          {formatDate(report.createdAt)} · {report.engine === 'claude' ? 'Written by Claude' : 'Written on-device'}
        </Text>
        <Markdown text={report.body} />
      </ScrollView>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, flexDirection: 'row', gap: 10 }}>
        <Button
          label={copied ? 'Copied' : 'Copy'}
          onPress={async () => {
            await Clipboard.setStringAsync(report.body);
            setCopied(true);
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="Share"
          variant="primary"
          onPress={() => Share.share({ title: report.title, message: report.body })}
          style={{ flex: 1 }}
        />
        <Button
          label="Delete"
          variant="ghost"
          onPress={() =>
            Alert.alert('Delete report?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteReport(report.id);
                  router.back();
                },
              },
            ])
          }
        />
      </View>
    </View>
  );
}
