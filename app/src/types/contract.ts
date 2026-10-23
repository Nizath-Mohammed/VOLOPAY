/**
 * Source JSON Contract Types
 * Directly representing the data deliveries specified in DATA_CONTRACT.md and DATA_DICTIONARY.md.
 */

export type SourceType = 'call' | 'meeting';

export interface MeetingTurn {
  speaker: string;
  starts_at_seconds: number;
  timecode: string;
  text: string;
}

export interface MeetingTranscriptPayload {
  meeting_id: string;
  turns: MeetingTurn[];
  unavailable_reason: string | null;
}

export interface CallPayload {
  id: string;
  external_call_id: string;
  workspace_slug: string;
  rep_email: string | null;
  rep_name: string | null;
  rep_user_id: string | null;
  direction: string;
  direction_raw: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string;
  duration_seconds: number;
  talk_time_seconds: number | null;
  speaker_count: number | null;
  segment_count: number | null;
  is_connected: boolean | null;
  is_conversation: boolean | null;
  observed_outcome: string | null;
  classification_reason: null;
  classification_status: string | null;
  is_campaign_call: boolean | null;
  first_dial_ever: boolean | null;
  first_connect_ever: boolean | null;
  prior_dials_ever: number | null;
  prior_connects_ever: number | null;
  summary: null;
  summary_status: string | null;
  transcript: string | null;
}

export interface MeetingPayload {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  provider: string;
  join_url: string;
  organizer_email: string | null;
  attendee_count: number | null;
  recording_status: string;
  recording_detail: string | null;
  recording_id: string | null;
  has_transcript: boolean;
  has_video: boolean;
  summary: null;
  summary_status: string | null;
  redacted: boolean;
}

export interface EnvelopeRecord {
  record_ref: string;
  source_type: SourceType;
  source_id: string;
  payload: CallPayload | MeetingPayload;
  transcript_payload: MeetingTranscriptPayload | null;
}

export interface DeliveryBatch {
  batch_id: string;
  revision: number;
  exported_at: string;
  records: EnvelopeRecord[];
}

/**
 * Application & User Workflow Types
 * Kept strictly isolated from raw source data.
 */

import type { RecordAnalysisPayload } from './analysis';

export type ReviewState = 'unreviewed' | 'pending_review' | 'reviewed';

export type AnalysisFreshness =
  | 'not_applicable'
  | 'uncomputed'
  | 'current'
  | 'stale_pending_review';

export type AuditActionType =
  | 'INITIAL_LOAD'
  | 'SHUFFLED_RELOAD'
  | 'UPDATE_BATCH'
  | 'CUSTOM_IMPORT'
  | 'STORE_RESET'
  | 'STORE_RESET_FAILED'
  | 'AUDIT_LOG_COMPACTED'
  | 'MANUAL_REVIEW_UPDATE'
  | 'ANALYSIS_GENERATED'
  | 'ANALYSIS_REGENERATED';

export const TAXONOMY_ROUTES = [
  'Sales Pipeline / Discovery',
  'Deal Next Steps / Evaluation',
  'Customer Support & Bug Escalation',
  'Partnership & Referral',
  'Internal / Vendor Coordination',
  'Unusable / Missing Audio',
  'Needs Triage',
] as const;

export type TaxonomyRoute = (typeof TAXONOMY_ROUTES)[number];

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditActionType;
  batchId?: string;
  revision?: number;
  previousRecordCount: number;
  newRecordCount: number;
  appliedCount: number;
  ignoredCount: number;
  rejectedCount: number;
  details: string;
}

export interface UserRecordState {
  manualRoute: string | null;
  secondaryTags: string[];
  isManualOverride: boolean;
  reviewState: ReviewState;
  userNotes: string;
  lastModifiedAt: string | null;
}

export interface AnalysisRecordState {
  analysis: RecordAnalysisPayload | null;
  freshness: AnalysisFreshness;
  generatedForRevision: number | null;
}

export interface AppRecord {
  /** Verbatim source envelope record as imported from JSON delivery */
  source: EnvelopeRecord;
  /** Delivery revision at which this record was applied */
  appliedRevision: number;
  /** Whether the record currently provides usable transcript text */
  hasUsableTranscript: boolean;
  /** Automated default suggestion (never overrides user state) */
  suggestedRoute: string;
  /** User-driven workflow state (persisted across updates and restarts) */
  userState: UserRecordState;
  /** Analysis lifecycle state */
  analysisState: AnalysisRecordState;
}

export interface ImportSummary {
  batchId: string;
  batchRevision: number;
  recordsInBatch: number;
  appliedCount: number;
  ignoredCount: number;
  updatedCount: number;
  insertedCount: number;
  collapsedCount: number;
  rejectedCount: number;
  totalRecordsNow: number;
  usableTranscriptsNow: number;
  diagnostics?: string[];
}

export class StorageCommitError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageCommitError';
  }
}

export class StorageResetError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageResetError';
  }
}

export class SchemaValidationError extends Error {
  public details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'SchemaValidationError';
    this.details = details;
  }
}
