/**
 * Analysis Data Contracts
 * Defines types for evidence-grounded claims, citations, freshness, and analysis payloads.
 */

export type EvidenceSourceType = 'meeting_turn' | 'call_excerpt';

export interface MeetingEvidenceRef {
  type: 'meeting_turn';
  sourceId: string;
  recordRef: string;
  sourceRevision: number; // Delivery revision that supplied this turn at generation time
  turnNumber: number;     // Exact 1-based index in source transcript_payload.turns
  speaker: string;        // Verbatim speaker string from turn (e.g., "Team member A")
  timecode: string;       // Display timecode from turn (e.g., "00:11:16")
  quoteText: string;      // Verbatim turn sentence or phrase
}

export interface CallEvidenceRef {
  type: 'call_excerpt';
  sourceId: string;
  recordRef: string;
  sourceRevision: number; // Delivery revision that supplied this transcript at generation time
  quoteText: string;      // Exact verbatim substring match from CallPayload.transcript
}

export type EvidenceRef = MeetingEvidenceRef | CallEvidenceRef;

// Evidence sufficiency for generated analyses:
// 'sufficient': substantive factual assertions grounded in transcript
// 'insufficient': usable transcript lacks substantive assertions to ground claims
export type EvidenceSufficiency = 'sufficient' | 'insufficient';

export interface EvidenceBackedStatement {
  statement: string;      // Factual occurrence grounded in transcript
  evidence: EvidenceRef;  // Direct citation supporting the statement
}

export interface ExtractedTopic {
  topic: string;          // Business taxonomy category (e.g., 'Vendor Payments & Invoicing')
  evidence: EvidenceRef;  // Grounding citation demonstrating topic discussion
}

export interface ExtractedQuestion {
  askingSpeaker: string;  // Verbatim speaker name from source
  questionText: string;   // Verbatim question sentence
  evidence: EvidenceRef;  // Grounding citation
}

export interface ExtractedObjection {
  category: 'existing_system' | 'pricing_budget' | 'compliance_process' | 'missing_feature' | 'contact_timing';
  statement: string;      // Verbatim excerpt containing the objection/constraint
  evidence: EvidenceRef;  // Grounding citation
}

export interface ExtractedNextStep {
  actionType: 'reschedule_call' | 'email_proposal' | 'internal_consultation' | 'explicit_no_follow_up';
  description: string;    // Verbatim excerpt or factual description strictly limited to agreed action
  evidence: EvidenceRef[]; // Proposal turn citation + Confirming acceptance turn citation
}

export interface RecordAnalysisPayload {
  recordRef: string;
  sourceType: 'call' | 'meeting';
  sourceId: string;
  generatedForRevision: number; // Revision for which this analysis and its citations were generated
  generatedAt: string;          // ISO timestamp

  summaryPoints: EvidenceBackedStatement[]; // Empty array if no factual assertions can be grounded
  topics: ExtractedTopic[];
  keyQuestions: ExtractedQuestion[];
  statedObjections: ExtractedObjection[];
  statedNextSteps: ExtractedNextStep[];     // Confirmed next steps only; empty array if none agreed

  evidenceSufficiency: EvidenceSufficiency;
  unusableReason: string | null;            // Preserved context or null for computed analyses
}
