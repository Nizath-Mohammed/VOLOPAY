import {
  DeliveryBatch,
  EnvelopeRecord,
  SchemaValidationError,
} from '../types/contract';
import { getRecordKey } from './identity';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface BatchProcessingPlan {
  validRecords: EnvelopeRecord[];
  collapsedCount: number;
  rejectedCount: number;
  diagnostics: string[];
}

/**
 * Validates ISO 8601 date timestamp string.
 */
function isValidIsoDate(dateString: unknown): boolean {
  if (typeof dateString !== 'string' || dateString.trim().length === 0) {
    return false;
  }
  const timestamp = Date.parse(dateString);
  return !isNaN(timestamp);
}

/**
 * Validates the outer delivery batch envelope according to DATA_CONTRACT.md.
 */
export function validateBatchEnvelope(batch: unknown): ValidationResult {
  const errors: string[] = [];

  if (!batch || typeof batch !== 'object') {
    return { isValid: false, errors: ['Delivery batch must be a non-null JSON object.'] };
  }

  const b = batch as Record<string, unknown>;

  if (typeof b.batch_id !== 'string' || b.batch_id.trim().length === 0) {
    errors.push('Envelope field "batch_id" must be a non-empty string.');
  }

  if (typeof b.revision !== 'number' || !Number.isInteger(b.revision) || b.revision < 1) {
    errors.push('Envelope field "revision" must be an integer greater than or equal to 1.');
  }

  if (!isValidIsoDate(b.exported_at)) {
    errors.push('Envelope field "exported_at" must be a valid ISO timestamp string.');
  }

  if (!Array.isArray(b.records)) {
    errors.push('Envelope field "records" must be an array.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a single envelope record against DATA_CONTRACT.md and DATA_DICTIONARY.md.
 */
export function validateEnvelopeRecord(record: unknown, index: number): ValidationResult {
  const errors: string[] = [];

  if (!record || typeof record !== 'object') {
    return { isValid: false, errors: [`Record at index ${index} must be an object.`] };
  }

  const r = record as Record<string, unknown>;

  if (typeof r.record_ref !== 'string' || r.record_ref.trim().length === 0) {
    errors.push(`Record [${index}]: "record_ref" must be a non-empty string.`);
  }

  if (r.source_type !== 'call' && r.source_type !== 'meeting') {
    errors.push(`Record [${index}]: "source_type" must be exactly 'call' or 'meeting'.`);
  }

  if (typeof r.source_id !== 'string' || r.source_id.trim().length === 0) {
    errors.push(`Record [${index}]: "source_id" must be a non-empty string.`);
  }

  if (!r.payload || typeof r.payload !== 'object') {
    errors.push(`Record [${index}]: "payload" must be a non-null object.`);
    return { isValid: errors.length === 0, errors };
  }

  const payload = r.payload as Record<string, unknown>;

  if (payload.id !== r.source_id) {
    errors.push(`Record [${index}]: payload.id ("${payload.id}") must match source_id ("${r.source_id}").`);
  }

  if (r.source_type === 'call') {
    // CallPayload Validation
    if (typeof payload.external_call_id !== 'string' || payload.external_call_id.trim().length === 0) {
      errors.push(`Call record [${r.source_id}]: "external_call_id" must be a non-empty string.`);
    }
    if (typeof payload.workspace_slug !== 'string' || payload.workspace_slug.trim().length === 0) {
      errors.push(`Call record [${r.source_id}]: "workspace_slug" must be a non-empty string.`);
    }
    if (typeof payload.direction !== 'string' || payload.direction.trim().length === 0) {
      errors.push(`Call record [${r.source_id}]: "direction" must be a non-empty string.`);
    }
    if (typeof payload.direction_raw !== 'string' || payload.direction_raw.trim().length === 0) {
      errors.push(`Call record [${r.source_id}]: "direction_raw" must be a non-empty string.`);
    }
    if (!isValidIsoDate(payload.started_at)) {
      errors.push(`Call record [${r.source_id}]: "started_at" must be a valid ISO timestamp.`);
    }
    if (typeof payload.duration_seconds !== 'number' || payload.duration_seconds < 0) {
      errors.push(`Call record [${r.source_id}]: "duration_seconds" must be a non-negative number.`);
    }
    if (payload.transcript !== null && typeof payload.transcript !== 'string') {
      errors.push(`Call record [${r.source_id}]: "transcript" must be null or string.`);
    }
    // Calls must have null or undefined transcript_payload
    if (r.transcript_payload !== null && r.transcript_payload !== undefined) {
      errors.push(`Call record [${r.source_id}]: "transcript_payload" must be null for calls.`);
    }
  } else if (r.source_type === 'meeting') {
    // MeetingPayload Validation
    if (typeof payload.title !== 'string') {
      errors.push(`Meeting record [${r.source_id}]: "title" must be a string.`);
    }
    if (!isValidIsoDate(payload.starts_at)) {
      errors.push(`Meeting record [${r.source_id}]: "starts_at" must be a valid ISO timestamp.`);
    }
    if (!isValidIsoDate(payload.ends_at)) {
      errors.push(`Meeting record [${r.source_id}]: "ends_at" must be a valid ISO timestamp.`);
    }
    if (typeof payload.duration_seconds !== 'number' || payload.duration_seconds < 0) {
      errors.push(`Meeting record [${r.source_id}]: "duration_seconds" must be a non-negative number.`);
    }
    if (typeof payload.provider !== 'string' || payload.provider.trim().length === 0) {
      errors.push(`Meeting record [${r.source_id}]: "provider" must be a non-empty string.`);
    }
    if (typeof payload.recording_status !== 'string' || payload.recording_status.trim().length === 0) {
      errors.push(`Meeting record [${r.source_id}]: "recording_status" must be a non-empty string.`);
    }
    if (typeof payload.has_transcript !== 'boolean') {
      errors.push(`Meeting record [${r.source_id}]: "has_transcript" must be a boolean.`);
    }
    if (typeof payload.redacted !== 'boolean') {
      errors.push(`Meeting record [${r.source_id}]: "redacted" must be a boolean.`);
    }

    // Meeting transcript_payload validation
    if (r.transcript_payload !== null && r.transcript_payload !== undefined) {
      const tp = r.transcript_payload as Record<string, unknown>;
      if (typeof tp !== 'object') {
        errors.push(`Meeting record [${r.source_id}]: "transcript_payload" must be null or object.`);
      } else {
        if (tp.meeting_id !== r.source_id) {
          errors.push(`Meeting record [${r.source_id}]: transcript_payload.meeting_id must match source_id.`);
        }
        if (!Array.isArray(tp.turns)) {
          errors.push(`Meeting record [${r.source_id}]: transcript_payload.turns must be an array.`);
        } else {
          for (let tIdx = 0; tIdx < tp.turns.length; tIdx++) {
            const turn = tp.turns[tIdx] as Record<string, unknown>;
            if (!turn || typeof turn !== 'object') {
              errors.push(`Meeting record [${r.source_id}]: turn [${tIdx}] must be an object.`);
            } else {
              if (typeof turn.speaker !== 'string') {
                errors.push(`Meeting record [${r.source_id}]: turn [${tIdx}].speaker must be a string.`);
              }
              if (typeof turn.starts_at_seconds !== 'number' || turn.starts_at_seconds < 0) {
                errors.push(`Meeting record [${r.source_id}]: turn [${tIdx}].starts_at_seconds must be a non-negative number.`);
              }
              if (typeof turn.timecode !== 'string') {
                errors.push(`Meeting record [${r.source_id}]: turn [${tIdx}].timecode must be a string.`);
              }
              if (typeof turn.text !== 'string') {
                errors.push(`Meeting record [${r.source_id}]: turn [${tIdx}].text must be a string.`);
              }
            }
          }
        }
        if (tp.unavailable_reason !== null && typeof tp.unavailable_reason !== 'string') {
          errors.push(`Meeting record [${r.source_id}]: transcript_payload.unavailable_reason must be null or string.`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates the full batch and resolves intra-batch duplicate identities:
 * 1. Validates envelope. If invalid, throws SchemaValidationError (atomic failure).
 * 2. Validates each record schema. Records with schema errors are rejected with diagnostics.
 * 3. Identical duplicates for the same (source_type, source_id) are collapsed into one.
 * 4. Conflicting duplicates for the same identity are rejected with clear diagnostics.
 * 5. Returns the clean processing plan for the ReplayStore.
 */
export function validateAndPlanBatch(batch: DeliveryBatch): BatchProcessingPlan {
  const envelopeValidation = validateBatchEnvelope(batch);
  if (!envelopeValidation.isValid) {
    throw new SchemaValidationError(
      `Delivery batch envelope validation failed: ${envelopeValidation.errors.join('; ')}`,
      envelopeValidation.errors
    );
  }

  const grouped = new Map<string, EnvelopeRecord[]>();
  const diagnostics: string[] = [];
  let rejectedCount = 0;
  let collapsedCount = 0;

  // Step 1: Validate individual record schemas and group by canonical identity
  batch.records.forEach((record, index) => {
    const recordValidation = validateEnvelopeRecord(record, index);
    if (!recordValidation.isValid) {
      rejectedCount++;
      diagnostics.push(`Rejected malformed record at index ${index}: ${recordValidation.errors.join(', ')}`);
      return;
    }

    const key = getRecordKey(record.source_type, record.source_id);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(record);
  });

  const validRecords: EnvelopeRecord[] = [];

  // Step 2: Intra-batch duplicate resolution
  for (const [key, records] of grouped.entries()) {
    if (records.length === 1) {
      validRecords.push(records[0]);
    } else {
      // Check if all instances are identical
      const firstPayloadJson = JSON.stringify(records[0].payload);
      const firstTranscriptJson = JSON.stringify(records[0].transcript_payload);
      let isIdentical = true;

      for (let i = 1; i < records.length; i++) {
        if (
          JSON.stringify(records[i].payload) !== firstPayloadJson ||
          JSON.stringify(records[i].transcript_payload) !== firstTranscriptJson
        ) {
          isIdentical = false;
          break;
        }
      }

      if (isIdentical) {
        // Collapse duplicates: keep 1, count remaining as collapsed
        validRecords.push(records[0]);
        collapsedCount += records.length - 1;
        diagnostics.push(`Collapsed ${records.length} identical duplicates for record ${records[0].record_ref} [${key}].`);
      } else {
        // Conflicting duplicates: reject all instances for this identity
        rejectedCount += records.length;
        diagnostics.push(
          `Rejected ${records.length} conflicting duplicate records for identity [${key}]. Differing payloads detected within batch.`
        );
      }
    }
  }

  return {
    validRecords,
    collapsedCount,
    rejectedCount,
    diagnostics,
  };
}
