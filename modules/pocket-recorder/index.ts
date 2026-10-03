import { NativeModule, requireNativeModule } from 'expo';

export type SegmentEvent = {
  /** file:// URI of a finished 16 kHz mono WAV segment, or null if the last segment was empty. */
  path: string | null;
  index: number;
  startMs: number;
  durationMs?: number;
  isLast: boolean;
};

export type LevelEvent = { level: number; elapsedMs: number };
export type StoppedEvent = { path: string; durationMs: number };
export type ErrorEvent = { message: string };

type RecorderEvents = {
  onSegment(event: SegmentEvent): void;
  onLevel(event: LevelEvent): void;
  onStopped(event: StoppedEvent): void;
  onError(event: ErrorEvent): void;
};

declare class PocketRecorderModule extends NativeModule<RecorderEvents> {
  start(fullPath: string, segmentDir: string, segmentSeconds: number): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  getStatus(): { isRecording: boolean; isPaused: boolean; elapsedMs: number };
}

export default requireNativeModule<PocketRecorderModule>('PocketRecorder');
