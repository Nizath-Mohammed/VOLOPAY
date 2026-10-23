import { EnvelopeRecord, CallPayload } from '../types/contract';

/**
 * Checks if a record has usable supplied transcript text according to DATA_DICTIONARY.md:
 * "Usable supplied text means a nonblank call transcript or at least one nonblank meeting turn."
 */
export function hasUsableTranscript(record: EnvelopeRecord): boolean {
  if (record.source_type === 'call') {
    const callPayload = record.payload as CallPayload;
    return typeof callPayload.transcript === 'string' && callPayload.transcript.trim().length > 0;
  }
  if (record.source_type === 'meeting') {
    const tp = record.transcript_payload;
    return Array.isArray(tp?.turns) && tp.turns.length > 0;
  }
  return false;
}

/**
 * Returns character count or turn count summary for inspection.
 */
export function getTranscriptLength(record: EnvelopeRecord): number {
  if (record.source_type === 'call') {
    const callPayload = record.payload as CallPayload;
    return (callPayload.transcript || '').length;
  }
  if (record.source_type === 'meeting') {
    return record.transcript_payload?.turns?.length || 0;
  }
  return 0;
}
