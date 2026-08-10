import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { apiClient } from '@/api/apiClient';

import { drainQueue } from './queue';

const SAFETY_INTERVAL_MS = 25_000;

let started = false;

async function pingHealth(): Promise<void> {
  try {
    await apiClient.get('/api/health');
  } catch {
    // best-effort latency optimization for Render cold starts — the queue tolerates failures regardless
  }
}

/** Wires the mutation queue to fire on every signal that the backend might now be reachable. Call once, near app start. */
export function startOfflineQueueEngine(): void {
  if (started) return;
  started = true;

  void pingHealth();
  void drainQueue();

  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void drainQueue();
    }
  });

  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      void pingHealth();
      void drainQueue();
    }
  });

  setInterval(() => {
    void drainQueue();
  }, SAFETY_INTERVAL_MS);
}
