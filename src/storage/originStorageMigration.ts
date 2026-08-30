import {
  Migration,
  type OriginStorageDump,
} from '@apps-in-toss/web-framework';

const APP_STORAGE_PREFIX = 'hoo-balloon:';
const OUTBOX_STORAGE_KEY = 'hoo-balloon:ranking-outbox:v1';
const MIGRATION_MARKER_KEY = 'hoo-balloon:migration:sdk3-origin-storage:v1';
const MIGRATION_TIMEOUT_MS = 1_500;
const APP_ORIGINS = new Set([
  'hoo-balloon.apps.tossmini.com',
  'hoo-balloon.private-apps.tossmini.com',
]);

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;
type OriginStorageResult = {
  previous: OriginStorageDump;
  current: OriginStorageDump;
};

type OutboxEnvelope = {
  version: 1;
  updatedAt: number;
  items: Array<Record<string, unknown>>;
};

function parseOutboxEnvelope(value: string | null): OutboxEnvelope | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Partial<OutboxEnvelope>;
    if (
      envelope.version !== 1 ||
      typeof envelope.updatedAt !== 'number' ||
      !Array.isArray(envelope.items)
    ) {
      return null;
    }
    return {
      version: 1,
      updatedAt: envelope.updatedAt,
      items: envelope.items.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      ),
    };
  } catch {
    return null;
  }
}

export function mergeOutboxValues(
  previousValue: string | null,
  currentValue: string | null,
): string | null {
  const previous = parseOutboxEnvelope(previousValue);
  const current = parseOutboxEnvelope(currentValue);
  if (!previous) return currentValue;
  if (!current) return previousValue;

  const itemsById = new Map<string, Record<string, unknown>>();
  for (const item of [...previous.items, ...current.items]) {
    const id = typeof item.id === 'string' ? item.id : null;
    if (id) itemsById.set(id, item);
  }

  return JSON.stringify({
    version: 1,
    updatedAt: Math.max(previous.updatedAt, current.updatedAt) + 1,
    items: Array.from(itemsById.values()),
  });
}

export function mergeOriginLocalStorage(
  result: OriginStorageResult,
  destination: KeyValueStorage,
): number {
  const keys = new Set([
    ...Object.keys(result.previous.localStorage),
    ...Object.keys(result.current.localStorage),
  ]);
  let migratedCount = 0;

  for (const key of keys) {
    if (!key.startsWith(APP_STORAGE_PREFIX) || key === MIGRATION_MARKER_KEY) continue;

    const existingValue = destination.getItem(key);
    const currentValue = existingValue ?? result.current.localStorage[key] ?? null;
    const previousValue = result.previous.localStorage[key] ?? null;
    const mergedValue = key === OUTBOX_STORAGE_KEY
      ? mergeOutboxValues(previousValue, currentValue)
      : currentValue ?? previousValue;

    if (mergedValue !== null && mergedValue !== existingValue) {
      destination.setItem(key, mergedValue);
      migratedCount += 1;
    }
  }

  return migratedCount;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error('ORIGIN_STORAGE_MIGRATION_TIMEOUT')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function shouldAttemptOriginStorageMigration(hostname: string): boolean {
  return APP_ORIGINS.has(hostname);
}

export async function migrateOriginStorage(
  getOriginStorage: () => Promise<OriginStorageResult> = Migration.getOriginStorage,
  storage?: KeyValueStorage,
  hostname = window.location.hostname,
): Promise<boolean> {
  try {
    const destination = storage ?? window.localStorage;
    if (
      !shouldAttemptOriginStorageMigration(hostname) ||
      destination.getItem(MIGRATION_MARKER_KEY) === 'complete'
    ) {
      return false;
    }

    const result = await withTimeout(getOriginStorage(), MIGRATION_TIMEOUT_MS);
    mergeOriginLocalStorage(result, destination);
    destination.setItem(MIGRATION_MARKER_KEY, 'complete');
    return true;
  } catch {
    // 구형 토스 앱이나 일시적인 브리지 오류에서는 다음 실행 때 다시 시도한다.
    return false;
  }
}
