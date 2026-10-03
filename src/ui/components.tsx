import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: t.muted }]}>{children}</Text>
      {right}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ label, onPress, variant = 'secondary', disabled, loading, style, small }: ButtonProps) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.primary : variant === 'danger' ? t.accent : variant === 'ghost' ? 'transparent' : t.chip;
  const fg =
    variant === 'primary' ? t.primaryText : variant === 'danger' ? t.accentText : variant === 'ghost' ? t.primary : t.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: t.chip }]}>
      <Text style={[styles.chipText, { color: t.muted }]}>#{label}</Text>
    </View>
  );
}

export function Bullets({ items }: { items: string[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {items.map((it, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.body, { color: t.muted }]}>•</Text>
          <Text style={[styles.body, { color: t.text, flex: 1 }]}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

/** Lightweight Markdown: headings, bullets, checkboxes, numbered lists, **bold**. */
export function Markdown({ text, selectable = true }: { text: string; selectable?: boolean }) {
  const t = useTheme();
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
          const size = h[1].length <= 1 ? 20 : h[1].length === 2 ? 17 : 15;
          return (
            <Text key={i} selectable={selectable} style={[styles.heading, { color: t.text, fontSize: size }]}>
              {inline(h[2], t.text)}
            </Text>
          );
        }
        const check = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
        if (check) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.body, { color: t.muted }]}>{check[1].trim() ? '☑' : '☐'}</Text>
              <Text selectable={selectable} style={[styles.body, { color: t.text, flex: 1 }]}>
                {inline(check[2], t.text)}
              </Text>
            </View>
          );
        }
        const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <View key={i} style={[styles.bulletRow, { paddingLeft: Math.min(bullet[1].length, 6) * 6 }]}>
              <Text style={[styles.body, { color: t.muted }]}>•</Text>
              <Text selectable={selectable} style={[styles.body, { color: t.text, flex: 1 }]}>
                {inline(bullet[2], t.text)}
              </Text>
            </View>
          );
        }
        const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (num) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.body, { color: t.muted }]}>{num[1]}.</Text>
              <Text selectable={selectable} style={[styles.body, { color: t.text, flex: 1 }]}>
                {inline(num[2], t.text)}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} selectable={selectable} style={[styles.body, { color: t.text }]}>
            {inline(line, t.text)}
          </Text>
        );
      })}
    </View>
  );
}

function inline(s: string, color: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <Text key={i} style={{ fontWeight: '700', color } as TextStyle}>
        {p.slice(2, -2)}
      </Text>
    ) : (
      p
    )
  );
}

export const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 34, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextSmall: { fontSize: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  body: { fontSize: 15, lineHeight: 22 },
  heading: { fontWeight: '700', marginTop: 8 },
});

export type SheetOption = { label: string; onPress: () => void; destructive?: boolean };
export type SheetSpec = { title: string; message?: string; options: SheetOption[] } | null;

/** Bottom-sheet menu (Android alerts are limited to three buttons). */
export function ActionSheet({ spec, onClose }: { spec: SheetSpec; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal visible={!!spec} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      {spec && (
        <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 8 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={2}>
            {spec.title}
          </Text>
          {!!spec.message && <Text style={{ color: t.muted }}>{spec.message}</Text>}
          {spec.options.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                onClose();
                o.onPress();
              }}
              style={({ pressed }) => ({
                backgroundColor: t.card,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: o.destructive ? t.accent : t.text, fontSize: 16, fontWeight: '600' }}>{o.label}</Text>
            </Pressable>
          ))}
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
      )}
    </Modal>
  );
}
