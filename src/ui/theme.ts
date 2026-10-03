import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F5F2',
  card: '#FFFFFF',
  text: '#16161A',
  muted: '#6B6B76',
  border: '#E4E2DC',
  accent: '#E5484D',
  accentText: '#FFFFFF',
  primary: '#2F5BEA',
  primaryText: '#FFFFFF',
  chip: '#ECEAE4',
  success: '#2E8B57',
  warn: '#B7791F',
};

const dark: typeof light = {
  bg: '#0F0F12',
  card: '#1A1A1F',
  text: '#F2F2F5',
  muted: '#9A9AA6',
  border: '#2A2A31',
  accent: '#FF5A5F',
  accentText: '#FFFFFF',
  primary: '#6B8CFF',
  primaryText: '#0F0F12',
  chip: '#26262D',
  success: '#4CC38A',
  warn: '#F0B44C',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const formatDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
};

export const formatDate = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
};
