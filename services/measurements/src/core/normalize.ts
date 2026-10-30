import { ValidationError } from './validate-submission.js';

/**
 * Normalization and the key contract in one place: every key format below is
 * what `infrastructure/measurement-storage.tf` stores, so changes here are
 * storage-contract changes.
 */

/**
 * Normalizes any parseable ISO-8601 timestamp (with or without offset) to the
 * fixed UTC format `YYYY-MM-DDTHH:mm:ss.SSSZ`. Fixed width means lexicographic
 * order equals chronological order — the property the `sk`/`typeTimeKey` range
 * queries rely on. Built from explicit getUTC* parts, no locale APIs.
 */
export function toUtcTimestamp(iso: string): string {
  const epochMs = Date.parse(iso);
  if (Number.isNaN(epochMs)) {
    throw new ValidationError(`timestamp is not parseable ISO-8601: "${iso}"`);
  }
  const date = new Date(epochMs);
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
  return (
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}` +
    `.${pad(date.getUTCMilliseconds(), 3)}Z`
  );
}

/** Base-table PK: `<model>#<serialNumber>`, trimmed — one partition per device. */
export function buildPartitionKey(model: string, serialNumber: string): string {
  return `${model.trim()}#${serialNumber.trim()}`;
}

/** Base-table SK: `<takenAtUtc>#<type>` — the natural key's time+type half. */
export function buildSortKey(takenAtUtc: string, type: string): string {
  return `${takenAtUtc}#${type}`;
}

/** GSI `by-type-and-time` SK: `<takenAtUtc>#<model>#<serialNumber>`, trimmed. */
export function buildTypeTimeKey(takenAtUtc: string, model: string, serialNumber: string): string {
  return `${takenAtUtc}#${model.trim()}#${serialNumber.trim()}`;
}
