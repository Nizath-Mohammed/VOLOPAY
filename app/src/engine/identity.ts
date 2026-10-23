import { SourceType } from '../types/contract';

export type RecordIdentity = readonly [SourceType, string];

/**
 * Creates a collision-safe canonical key for a source record.
 * Uses JSON array serialization of the typed tuple [source_type, source_id].
 * This guarantees zero delimiter collision or character ambiguity.
 */
export function getRecordKey(sourceType: SourceType, sourceId: string): string {
  return JSON.stringify([sourceType, sourceId]);
}

/**
 * Parses a canonical record key back into its typed [source_type, source_id] tuple.
 * Performs strict runtime validation:
 * 1. Must be valid JSON array of length 2.
 * 2. Element 0 must be exactly 'call' or 'meeting'.
 * 3. Element 1 must be a non-empty string (zero silent coercion).
 *
 * @throws Error if key violates contract
 */
export function parseRecordKey(canonicalKey: string): RecordIdentity {
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalKey);
  } catch {
    throw new Error(`Invalid canonical record key (malformed JSON): ${canonicalKey}`);
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new Error(`Invalid canonical record key (expected 2-element tuple): ${canonicalKey}`);
  }

  const [rawType, rawId] = parsed;

  if (rawType !== 'call' && rawType !== 'meeting') {
    throw new Error(
      `Invalid canonical record key (source_type must be 'call' | 'meeting', received "${String(rawType)}"): ${canonicalKey}`
    );
  }

  if (typeof rawId !== 'string' || rawId.trim().length === 0) {
    throw new Error(
      `Invalid canonical record key (source_id must be a non-empty string, received ${typeof rawId}): ${canonicalKey}`
    );
  }

  return [rawType, rawId] as const;
}

/**
 * Defensive parser for URL hash parameters.
 * Extracts, decodes, and validates canonical identity without throwing uncaught errors.
 * Returns null if malformed, un-decodable, or invalid.
 */
export function parseUrlRecordHash(rawHashParam: string): RecordIdentity | null {
  if (!rawHashParam || typeof rawHashParam !== 'string') {
    return null;
  }
  try {
    const decoded = decodeURIComponent(rawHashParam);
    return parseRecordKey(decoded);
  } catch {
    return null;
  }
}

