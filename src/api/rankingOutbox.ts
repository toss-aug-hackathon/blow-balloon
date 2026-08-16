import { Storage } from '@apps-in-toss/web-bridge';
import { compareRankingItems } from './rankingRules';
import {
  RankingApiError,
  submitScore,
  type RankingType,
  type SubmitScoreResponse,
} from './rankingApi';

const STORAGE_KEY = 'hoo-balloon:ranking-outbox:v1';
const OUTBOX_VERSION = 1;
const OUTBOX_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const NATIVE_STORAGE_TIMEOUT_MS = 1200;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000, 30_000] as const;

export type PendingScoreSubmission = {
  version: 1;
  id: string;
  ownerHash: string;
  rankingType: RankingType;
  score: number;
  durationMs: number | null;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
};

type OutboxEnvelope = {
  version: 1;
  updatedAt: number;
  items: PendingScoreSubmission[];
};

export type RankingSyncEvent = {
  pending: PendingScoreSubmission;
  response: SubmitScoreResponse;
};

export type RankingOutboxEvent =
  | { type: 'synced'; pending: PendingScoreSubmission; response: SubmitScoreResponse }
  | { type: 'permanent-failure'; pending: PendingScoreSubmission; error: RankingApiError };

export type RankingSyncResult = {
  synced: RankingSyncEvent[];
  permanentFailures: Array<{
    pending: PendingScoreSubmission;
    error: RankingApiError;
  }>;
  nextRetryAt: number | null;
};

export type ReliableScoreSaveResult =
  | { status: 'synced'; pending: PendingScoreSubmission; response: SubmitScoreResponse }
  | { status: 'queued'; pending: PendingScoreSubmission };

const listeners = new Set<(event: RankingOutboxEvent) => void>();
const syncRequests = new Map<string, Promise<RankingSyncResult>>();
let storageOperation: Promise<void> = Promise.resolve();
let lastEnvelopeUpdatedAt = 0;

function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageOperation.then(operation, operation);
  storageOperation = result.then(() => undefined, () => undefined);
  return result;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('STORAGE_TIMEOUT')), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isPendingScoreSubmission(value: unknown): value is PendingScoreSubmission {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PendingScoreSubmission>;
  return item.version === OUTBOX_VERSION &&
    typeof item.id === 'string' &&
    typeof item.ownerHash === 'string' &&
    (item.rankingType === 'BALLOON_COUNT' || item.rankingType === 'LUNG_CAPACITY') &&
    Number.isSafeInteger(item.score) &&
    (item.durationMs === null || Number.isSafeInteger(item.durationMs)) &&
    typeof item.createdAt === 'number' &&
    typeof item.attempts === 'number' &&
    typeof item.nextAttemptAt === 'number';
}

function parseEnvelope(value: string | null): OutboxEnvelope | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Partial<OutboxEnvelope>;
    if (
      envelope.version !== OUTBOX_VERSION ||
      typeof envelope.updatedAt !== 'number' ||
      !Array.isArray(envelope.items)
    ) {
      return null;
    }
    return {
      version: OUTBOX_VERSION,
      updatedAt: envelope.updatedAt,
      items: envelope.items.filter(isPendingScoreSubmission),
    };
  } catch {
    return null;
  }
}

async function readNativeEnvelope(): Promise<OutboxEnvelope | null> {
  try {
    return parseEnvelope(await withTimeout(
      Storage.getItem(STORAGE_KEY),
      NATIVE_STORAGE_TIMEOUT_MS,
    ));
  } catch {
    return null;
  }
}

function readLocalEnvelope(): OutboxEnvelope | null {
  try {
    return parseEnvelope(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

async function readEnvelope(): Promise<OutboxEnvelope> {
  const [nativeEnvelope, localEnvelope] = await Promise.all([
    readNativeEnvelope(),
    Promise.resolve(readLocalEnvelope()),
  ]);
  const envelope = !nativeEnvelope
    ? localEnvelope
    : !localEnvelope || nativeEnvelope.updatedAt >= localEnvelope.updatedAt
      ? nativeEnvelope
      : localEnvelope;
  return envelope ?? { version: OUTBOX_VERSION, updatedAt: 0, items: [] };
}

async function writeEnvelope(items: PendingScoreSubmission[], previousUpdatedAt: number): Promise<void> {
  const updatedAt = Math.max(Date.now(), previousUpdatedAt + 1, lastEnvelopeUpdatedAt + 1);
  lastEnvelopeUpdatedAt = updatedAt;
  const value = JSON.stringify({ version: OUTBOX_VERSION, updatedAt, items });

  const nativeWrite = withTimeout(
    Storage.setItem(STORAGE_KEY, value),
    NATIVE_STORAGE_TIMEOUT_MS,
  ).then(() => true, () => false);
  const localWrite = Promise.resolve().then(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
      return true;
    } catch {
      return false;
    }
  });
  const [nativeSaved, localSaved] = await Promise.all([nativeWrite, localWrite]);
  if (!nativeSaved && !localSaved) {
    throw new Error('기록을 기기에 보관하지 못했어요. 저장 공간을 확인해 주세요.');
  }
}

export async function fingerprintAnonymousKey(anonymousKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(anonymousKey);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createSubmissionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isCandidateBetter(
  candidate: PendingScoreSubmission,
  current: PendingScoreSubmission,
): boolean {
  return compareRankingItems(
    candidate.rankingType,
    { rank: 0, displayName: '', score: candidate.score, durationMs: candidate.durationMs },
    { rank: 0, displayName: '', score: current.score, durationMs: current.durationMs },
  ) < 0;
}

function removeExpired(items: PendingScoreSubmission[], now: number): PendingScoreSubmission[] {
  return items.filter((item) => now - item.createdAt <= OUTBOX_EXPIRY_MS);
}

export async function enqueueScoreSubmission(params: {
  anonymousKey: string;
  rankingType: RankingType;
  score: number;
  durationMs: number | null;
  submissionId?: string;
}): Promise<PendingScoreSubmission> {
  const ownerHash = await fingerprintAnonymousKey(params.anonymousKey);
  return withStorageLock(async () => {
    const now = Date.now();
    const envelope = await readEnvelope();
    const normalizedDurationMs = params.durationMs == null
      ? null
      : Math.max(0, Math.round(params.durationMs));
    const candidate: PendingScoreSubmission = {
      version: OUTBOX_VERSION,
      id: params.submissionId ?? createSubmissionId(),
      ownerHash,
      rankingType: params.rankingType,
      score: params.score,
      durationMs: normalizedDurationMs,
      createdAt: now,
      attempts: 0,
      nextAttemptAt: 0,
    };
    const activeItems = removeExpired(envelope.items, now);
    const existing = activeItems.find(
      (item) => item.ownerHash === ownerHash && item.rankingType === params.rankingType,
    );
    const selected = existing && !isCandidateBetter(candidate, existing) ? existing : candidate;
    const nextItems = activeItems
      .filter((item) => item.ownerHash !== ownerHash || item.rankingType !== params.rankingType)
      .concat(selected);
    await writeEnvelope(nextItems, envelope.updatedAt);
    return selected;
  });
}

export function calculateRetryDelayMs(
  attempts: number,
  retryAfterSeconds: number | null,
  random = Math.random(),
): number {
  const serverDelay = retryAfterSeconds === null ? 0 : retryAfterSeconds * 1000;
  const retryIndex = Math.max(0, attempts - 1);
  const baseDelay = Math.max(
    serverDelay,
    RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)] ?? MAX_RETRY_DELAY_MS,
  );
  const cappedDelay = retryIndex < RETRY_DELAYS_MS.length
    ? baseDelay
    : Math.max(serverDelay, MAX_RETRY_DELAY_MS);
  return Math.round(cappedDelay * (0.8 + Math.min(1, Math.max(0, random)) * 0.4));
}

function isRetryableError(error: RankingApiError): boolean {
  return error.status === 0 ||
    error.status === 429 ||
    error.status >= 500 ||
    error.code === 'NETWORK_ERROR' ||
    error.code === 'REQUEST_TIMEOUT' ||
    error.code === 'INVALID_RESPONSE' ||
    error.code === 'USER_NOT_REGISTERED';
}

async function runSync(anonymousKey: string, ownerHash: string): Promise<RankingSyncResult> {
  return withStorageLock(async () => {
    const envelope = await readEnvelope();
    const now = Date.now();
    let items = removeExpired(envelope.items, now);
    let changed = items.length !== envelope.items.length;
    const synced: RankingSyncEvent[] = [];
    const permanentFailures: RankingSyncResult['permanentFailures'] = [];

    for (const pending of items.filter(
      (item) => item.ownerHash === ownerHash && item.nextAttemptAt <= now,
    )) {
      try {
        const response = await submitScore(
          pending.rankingType,
          pending.score,
          pending.durationMs,
          anonymousKey,
          pending.id,
        );
        items = items.filter((item) => item.id !== pending.id);
        synced.push({ pending, response });
        changed = true;
      } catch (requestError) {
        const error = requestError instanceof RankingApiError
          ? requestError
          : new RankingApiError('UNKNOWN_ERROR', '기록을 저장하지 못했어요.', 0, null);
        if (!isRetryableError(error)) {
          items = items.filter((item) => item.id !== pending.id);
          permanentFailures.push({ pending, error });
          changed = true;
          continue;
        }
        const attempts = pending.attempts + 1;
        const nextAttemptAt = now + calculateRetryDelayMs(attempts, error.retryAfterSeconds);
        items = items.map((item) => item.id === pending.id
          ? { ...item, attempts, nextAttemptAt }
          : item);
        changed = true;
      }
    }

    if (changed) await writeEnvelope(items, envelope.updatedAt);
    const nextRetryAt = items
      .filter((item) => item.ownerHash === ownerHash)
      .reduce<number | null>(
        (earliest, item) => earliest === null ? item.nextAttemptAt : Math.min(earliest, item.nextAttemptAt),
        null,
      );
    for (const event of synced) {
      for (const listener of listeners) listener({ type: 'synced', ...event });
    }
    for (const failure of permanentFailures) {
      for (const listener of listeners) {
        listener({ type: 'permanent-failure', ...failure });
      }
    }
    return { synced, permanentFailures, nextRetryAt };
  });
}

export async function syncRankingOutbox(anonymousKey: string): Promise<RankingSyncResult> {
  const ownerHash = await fingerprintAnonymousKey(anonymousKey);
  const pendingRequest = syncRequests.get(ownerHash);
  if (pendingRequest) return pendingRequest;
  const request = runSync(anonymousKey, ownerHash).finally(() => {
    if (syncRequests.get(ownerHash) === request) syncRequests.delete(ownerHash);
  });
  syncRequests.set(ownerHash, request);
  return request;
}

export async function saveRankingScoreReliably(params: {
  anonymousKey: string;
  rankingType: RankingType;
  score: number;
  durationMs: number | null;
}): Promise<ReliableScoreSaveResult> {
  const submissionId = createSubmissionId();
  const normalizedDurationMs = params.durationMs == null
    ? null
    : Math.max(0, Math.round(params.durationMs));
  const normalizedParams = { ...params, durationMs: normalizedDurationMs };
  let pending: PendingScoreSubmission;
  try {
    pending = await enqueueScoreSubmission({ ...normalizedParams, submissionId });
  } catch (storageError) {
    try {
      const response = await submitScore(
        normalizedParams.rankingType,
        normalizedParams.score,
        normalizedParams.durationMs,
        normalizedParams.anonymousKey,
        submissionId,
      );
      return {
        status: 'synced',
        pending: {
          version: OUTBOX_VERSION,
          id: submissionId,
          ownerHash: '',
          rankingType: normalizedParams.rankingType,
          score: normalizedParams.score,
          durationMs: normalizedParams.durationMs,
          createdAt: Date.now(),
          attempts: 0,
          nextAttemptAt: 0,
        },
        response,
      };
    } catch {
      throw storageError;
    }
  }

  try {
    const result = await syncRankingOutbox(normalizedParams.anonymousKey);
    const synced = result.synced.find((event) => event.pending.id === pending.id);
    if (synced) {
      return {
        status: 'synced',
        pending: synced.pending,
        response: synced.response,
      };
    }

    const permanentFailure = result.permanentFailures.find(
      (failure) => failure.pending.id === pending.id,
    );
    if (permanentFailure) throw permanentFailure.error;
  } catch (syncError) {
    if (syncError instanceof RankingApiError) throw syncError;
    // The score is already durable in the outbox. A later lifecycle/online sync can retry it.
  }

  return { status: 'queued', pending };
}

export function subscribeRankingSync(listener: (event: RankingOutboxEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
