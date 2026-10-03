import { useSyncExternalStore } from 'react';

/** Minimal observable value: enough state management for a single-user app. */
export class Observable<T> {
  private listeners = new Set<() => void>();

  constructor(private value: T) {}

  get = () => this.value;

  set = (next: T | ((prev: T) => T)) => {
    this.value = typeof next === 'function' ? (next as (prev: T) => T)(this.value) : next;
    this.listeners.forEach((l) => l());
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export function useObservable<T>(obs: Observable<T>): T {
  return useSyncExternalStore(obs.subscribe, obs.get, obs.get);
}

/** Bumped whenever notes change, so screens know to reload from SQLite. */
export const dataVersion = new Observable(0);
export const bumpData = () => dataVersion.set((v) => v + 1);
