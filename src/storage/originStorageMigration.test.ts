import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OriginStorageDump } from '@apps-in-toss/web-framework';
import {
  mergeOriginLocalStorage,
  mergeOutboxValues,
  migrateOriginStorage,
  shouldAttemptOriginStorageMigration,
} from './originStorageMigration';

function createDump(
  origin: string,
  localStorage: Record<string, string | null>,
): OriginStorageDump {
  return {
    origin,
    localStorage,
    indexedDB: [],
    opfs: { directories: [], files: [] },
    errors: [],
  };
}

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('origin storage migration', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout, clearTimeout });
  });

  it('copies missing app data while preserving current values', () => {
    const storage = createStorage({ 'hoo-balloon:current': 'live' });
    const count = mergeOriginLocalStorage({
      previous: createDump('https://previous.example', {
        'hoo-balloon:missing': 'legacy',
        'hoo-balloon:current': 'stale',
        'other-app:key': 'ignore',
      }),
      current: createDump('https://current.example', {
        'hoo-balloon:current': 'current-dump',
      }),
    }, storage);

    expect(count).toBe(1);
    expect(storage.values.get('hoo-balloon:missing')).toBe('legacy');
    expect(storage.values.get('hoo-balloon:current')).toBe('live');
    expect(storage.values.has('other-app:key')).toBe(false);
  });

  it('keeps pending outbox items from both origins', () => {
    const previous = JSON.stringify({
      version: 1,
      updatedAt: 10,
      items: [{ id: 'previous', score: 2 }],
    });
    const current = JSON.stringify({
      version: 1,
      updatedAt: 20,
      items: [{ id: 'current', score: 3 }],
    });

    const merged = JSON.parse(mergeOutboxValues(previous, current)!) as {
      updatedAt: number;
      items: Array<{ id: string }>;
    };
    expect(merged.updatedAt).toBe(21);
    expect(merged.items.map(({ id }) => id)).toEqual(['previous', 'current']);
  });

  it('runs only on the two SDK 3.1.1 service hosts', () => {
    expect(shouldAttemptOriginStorageMigration('hoo-balloon.apps.tossmini.com')).toBe(true);
    expect(shouldAttemptOriginStorageMigration('hoo-balloon.private-apps.tossmini.com')).toBe(true);
    expect(shouldAttemptOriginStorageMigration('localhost')).toBe(false);
    expect(shouldAttemptOriginStorageMigration('hoo-balloon.web.tossmini.com')).toBe(false);
  });

  it('marks a successful migration and does not repeat it', async () => {
    const storage = createStorage();
    const getOriginStorage = vi.fn().mockResolvedValue({
      previous: createDump('https://previous.example', {
        'hoo-balloon:nongame:registered-user:user': 'legacy-user',
      }),
      current: createDump('https://current.example', {}),
    });

    await expect(migrateOriginStorage(
      getOriginStorage,
      storage,
      'hoo-balloon.apps.tossmini.com',
    )).resolves.toBe(true);
    await expect(migrateOriginStorage(
      getOriginStorage,
      storage,
      'hoo-balloon.apps.tossmini.com',
    )).resolves.toBe(false);

    expect(getOriginStorage).toHaveBeenCalledTimes(1);
    expect(storage.values.get('hoo-balloon:migration:sdk3-origin-storage:v1')).toBe('complete');
  });
});
