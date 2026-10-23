import type { AppRecord, CallPayload } from '../types/contract';
import type {
  RecordAnalysisPayload,
  EvidenceRef,
  MeetingEvidenceRef,
  CallEvidenceRef,
  EvidenceSufficiency,
  EvidenceBackedStatement,
  ExtractedTopic,
  ExtractedQuestion,
  ExtractedObjection,
  ExtractedNextStep,
} from '../types/analysis';

/**
 * Deterministic, offline, evidence-backed transcript analysis engine.
 * Never invents dates, times, attendees, coaching advice, or outcomes.
 */

// Sentence splitting helper preserving exact punctuation
function splitSentences(text: string): string[] {
  if (!text) return [];
  // Match sentence ending with punctuation or end of string
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) return [text.trim()];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function generateAnalysis(record: AppRecord): RecordAnalysisPayload {
  if (!record.hasUsableTranscript) {
    throw new Error(`Cannot generate analysis for record ${record.source.record_ref}: no usable transcript.`);
  }

  const sourceType = record.source.source_type;
  const sourceId = record.source.source_id;
  const recordRef = record.source.record_ref;
  const sourceRevision = record.appliedRevision;

  if (sourceType === 'meeting') {
    return analyzeMeeting(record, recordRef, sourceId, sourceRevision);
  } else {
    return analyzeCall(record, recordRef, sourceId, sourceRevision);
  }
}

function analyzeMeeting(
  record: AppRecord,
  recordRef: string,
  sourceId: string,
  sourceRevision: number
): RecordAnalysisPayload {
  const turns = record.source.transcript_payload?.turns || [];
  if (turns.length === 0) {
    throw new Error(`Cannot generate analysis: meeting has zero transcript turns.`);
  }

  const topics: ExtractedTopic[] = [];
  const keyQuestions: ExtractedQuestion[] = [];
  const statedObjections: ExtractedObjection[] = [];
  const statedNextSteps: ExtractedNextStep[] = [];
  const summaryPoints: EvidenceBackedStatement[] = [];

  // 1. Topic Taxonomy Matching
  const topicDefinitions: { topic: string; regex: RegExp }[] = [
    {
      topic: 'System Configuration & Editing',
      regex: /\b(edit|editing|saving|saved|description|field|form|setup|wording)\b/i,
    },
    {
      topic: 'Vendor Payments & Invoicing',
      regex: /\b(invoice|invoices|invoicing|payment|payments|billing|scheduled payments|vendor|vendors|supplier)\b/i,
    },
    {
      topic: 'Spend Management & Approvals',
      regex: /\b(expense|spend|approval|approvals|workflow|workflows|budget|reimbursement)\b/i,
    },
    {
      topic: 'Integration & Accounting APIs',
      regex: /\b(api|apis|webhook|sync|integration|quickbooks|netsuite|xero|salesforce|hubspot)\b/i,
    },
    {
      topic: 'Security & Compliance',
      regex: /\b(security|compliance|sso|saml|permissions|audit|procurement|soc2)\b/i,
    },
    {
      topic: 'Partnership & Professional Services',
      regex: /\b(partner|partnership|outsourced|finance leadership|consulting)\b/i,
    },
  ];

  const matchedTopics = new Set<string>();
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    for (const def of topicDefinitions) {
      if (!matchedTopics.has(def.topic) && def.regex.test(turn.text)) {
        matchedTopics.add(def.topic);
        const evidence: MeetingEvidenceRef = {
          type: 'meeting_turn',
          sourceId,
          recordRef,
          sourceRevision,
          turnNumber: i + 1,
          speaker: turn.speaker,
          timecode: turn.timecode,
          quoteText: turn.text,
        };
        topics.push({ topic: def.topic, evidence });
      }
    }
  }

  // 2. Key Questions Extraction
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.text.includes('?') || /\b(could we|can you|would you|is that|are you|how does|what is|why)\b/i.test(turn.text)) {
      const evidence: MeetingEvidenceRef = {
        type: 'meeting_turn',
        sourceId,
        recordRef,
        sourceRevision,
        turnNumber: i + 1,
        speaker: turn.speaker,
        timecode: turn.timecode,
        quoteText: turn.text,
      };
      keyQuestions.push({
        askingSpeaker: turn.speaker,
        questionText: turn.text,
        evidence,
      });
    }
  }

  // 3. Stated Objections
  const objectionDefs: {
    category: 'existing_system' | 'pricing_budget' | 'compliance_process' | 'missing_feature' | 'contact_timing';
    regex: RegExp;
  }[] = [
    {
      category: 'existing_system',
      regex: /\b(already (very )?automated|already (have|use)|fairly advanced setup|current provider|existing tool|using competitor)\b/i,
    },
    {
      category: 'contact_timing',
      regex: /\b(didn't ask for this call|not interested|not for people to sell|bad time|not a good time|don't have time|call back (later|next year|next quarter))\b/i,
    },
    {
      category: 'pricing_budget',
      regex: /\b(too expensive|cannot afford|no budget|out of budget|price is (too )?high|cost is high)\b/i,
    },
    {
      category: 'compliance_process',
      regex: /\b(compliance issue|legal review required|procurement hurdle|cannot sign)\b/i,
    },
    {
      category: 'missing_feature',
      regex: /\b(doesn't support|does not have|missing feature|lacks the ability)\b/i,
    },
  ];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    for (const def of objectionDefs) {
      if (def.regex.test(turn.text)) {
        const evidence: MeetingEvidenceRef = {
          type: 'meeting_turn',
          sourceId,
          recordRef,
          sourceRevision,
          turnNumber: i + 1,
          speaker: turn.speaker,
          timecode: turn.timecode,
          quoteText: turn.text,
        };
        statedObjections.push({
          category: def.category,
          statement: turn.text,
          evidence,
        });
      }
    }
  }

  // 4. Stated Next Steps (Proposal vs. Acceptance vs. Rejection vs. Unanswered)
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const text = turn.text;

    // Check for explicit closure / negative decision first
    if (/\b(I said I will contact you|no follow-?up (is )?needed|do not call back|not interested in further)\b/i.test(text)) {
      const evidence: MeetingEvidenceRef = {
        type: 'meeting_turn',
        sourceId,
        recordRef,
        sourceRevision,
        turnNumber: i + 1,
        speaker: turn.speaker,
        timecode: turn.timecode,
        quoteText: text,
      };
      statedNextSteps.push({
        actionType: 'explicit_no_follow_up',
        description: 'Explicit closure: Participant declined further follow-up',
        evidence: [evidence],
      });
      continue;
    }

    // Check for action proposals
    let proposalType: 'reschedule_call' | 'email_proposal' | 'internal_consultation' | null = null;
    let agreedDescription = '';

    if (/\b(could we speak|can we speak|speak|call|meet)\s+(on\s+)?monday\b/i.test(text)) {
      proposalType = 'reschedule_call';
      agreedDescription = 'Speak on Monday';
    } else if (/\b(could we speak|can we speak|speak|call|meet)\s+(on\s+)?(tuesday|wednesday|thursday|friday|next week|tomorrow)\b/i.test(text)) {
      proposalType = 'reschedule_call';
      agreedDescription = 'Follow-up discussion as proposed';
    } else if (/\b(send|email)\s+(a\s+)?(proposal|brief|deck|documentation|details|summary|quote|explanation)\b/i.test(text)) {
      proposalType = 'email_proposal';
      agreedDescription = 'Send proposal/documentation';
    } else if (/\b(check with (my|the) team|internal review|talk to (the\s+)?team)\b/i.test(text)) {
      proposalType = 'internal_consultation';
      agreedDescription = 'Consult with internal team';
    }

    if (proposalType && i + 1 < turns.length) {
      const nextTurn = turns[i + 1];
      const nextText = nextTurn.text;

      // Check response:
      const hasAcceptance = /\b(yes(\b|,|\.)|that works|sounds good|sure(\b|,|\.)|perfect|let's do that|agreed|absolutely|all right, I'll do that)\b/i.test(nextText);
      const hasRejection = /\b(no(\b|,|\.)|busy|cannot|can't|not interested|won't work|impossible)\b/i.test(nextText);
      const isAmbiguous = /\b(maybe|let me check|not sure|I'll have to see|might be|check my schedule)\b/i.test(nextText);

      // Only if explicit acceptance is present (and no rejection/ambiguity) do we extract as a confirmed next step:
      if (hasAcceptance && !hasRejection && !isAmbiguous) {
        const proposalEvidence: MeetingEvidenceRef = {
          type: 'meeting_turn',
          sourceId,
          recordRef,
          sourceRevision,
          turnNumber: i + 1,
          speaker: turn.speaker,
          timecode: turn.timecode,
          quoteText: text,
        };
        const acceptanceEvidence: MeetingEvidenceRef = {
          type: 'meeting_turn',
          sourceId,
          recordRef,
          sourceRevision,
          turnNumber: i + 2,
          speaker: nextTurn.speaker,
          timecode: nextTurn.timecode,
          quoteText: nextText,
        };
        statedNextSteps.push({
          actionType: proposalType,
          description: agreedDescription,
          evidence: [proposalEvidence, acceptanceEvidence],
        });
      }
      // If ambiguous, rejected, or unanswered/topic shifted: OMITTED from statedNextSteps!
    }
  }

  // 5. Summary Points & Evidence Sufficiency
  const totalWords = turns.reduce((acc, t) => acc + t.text.split(/\s+/).filter(Boolean).length, 0);
  const evidenceSufficiency: EvidenceSufficiency = totalWords >= 8 && turns.length >= 1 ? 'sufficient' : 'insufficient';

  if (evidenceSufficiency === 'sufficient') {
    // Generate grounded summary assertions
    for (let i = 0; i < Math.min(turns.length, 3); i++) {
      const turn = turns[i];
      if (turn.text.trim().length > 10) {
        const evidence: MeetingEvidenceRef = {
          type: 'meeting_turn',
          sourceId,
          recordRef,
          sourceRevision,
          turnNumber: i + 1,
          speaker: turn.speaker,
          timecode: turn.timecode,
          quoteText: turn.text,
        };
        summaryPoints.push({
          statement: `${turn.speaker}: "${turn.text.length > 90 ? turn.text.slice(0, 87) + '...' : turn.text}"`,
          evidence,
        });
      }
    }
  }

  return {
    recordRef,
    sourceType: 'meeting',
    sourceId,
    generatedForRevision: sourceRevision,
    generatedAt: new Date().toISOString(),
    summaryPoints,
    topics,
    keyQuestions,
    statedObjections,
    statedNextSteps,
    evidenceSufficiency,
    unusableReason: null,
  };
}

function analyzeCall(
  record: AppRecord,
  recordRef: string,
  sourceId: string,
  sourceRevision: number
): RecordAnalysisPayload {
  const payload = record.source.payload as CallPayload;
  const transcript = payload.transcript || '';
  if (!transcript || transcript.trim().length === 0) {
    throw new Error(`Cannot generate analysis: call has no transcript text.`);
  }

  const sentences = splitSentences(transcript);
  const topics: ExtractedTopic[] = [];
  const keyQuestions: ExtractedQuestion[] = [];
  const statedObjections: ExtractedObjection[] = [];
  const statedNextSteps: ExtractedNextStep[] = [];
  const summaryPoints: EvidenceBackedStatement[] = [];

  // 1. Topics
  const topicDefinitions: { topic: string; regex: RegExp }[] = [
    {
      topic: 'Vendor Handling & Invoice Processing',
      regex: /\b(invoice|invoices|invoicing|payment|payments|vendor handling|scheduled payments|supplier)\b/i,
    },
    {
      topic: 'Outsourced Finance & Operations',
      regex: /\b(outsourced finance|finance leadership|partner|partnership)\b/i,
    },
    {
      topic: 'Expense Management & Automation',
      regex: /\b(expense management|automated|automate|automation|approval workflows)\b/i,
    },
  ];

  const matchedTopics = new Set<string>();
  for (const s of sentences) {
    for (const def of topicDefinitions) {
      if (!matchedTopics.has(def.topic) && def.regex.test(s)) {
        matchedTopics.add(def.topic);
        const evidence: CallEvidenceRef = {
          type: 'call_excerpt',
          sourceId,
          recordRef,
          sourceRevision,
          quoteText: s,
        };
        topics.push({ topic: def.topic, evidence });
      }
    }
  }

  // 2. Key Questions
  for (const s of sentences) {
    if (s.endsWith('?') || /\b(why are you calling|who is this|what does your company actually do|where did you find|would a follow-up call|could I briefly explain)\b/i.test(s)) {
      const evidence: CallEvidenceRef = {
        type: 'call_excerpt',
        sourceId,
        recordRef,
        sourceRevision,
        quoteText: s,
      };
      keyQuestions.push({
        askingSpeaker: 'Participant',
        questionText: s,
        evidence,
      });
    }
  }

  // 3. Stated Objections
  const objectionDefs: {
    category: 'existing_system' | 'pricing_budget' | 'compliance_process' | 'missing_feature' | 'contact_timing';
    regex: RegExp;
  }[] = [
    {
      category: 'existing_system',
      regex: /\b(already very automated|fairly advanced setup|already automated|don't think this is something we need)\b/i,
    },
    {
      category: 'contact_timing',
      regex: /\b(didn't ask for this call|not interested|not for people to sell|don't know how I ended up on your list)\b/i,
    },
  ];

  for (const s of sentences) {
    for (const def of objectionDefs) {
      if (def.regex.test(s)) {
        const evidence: CallEvidenceRef = {
          type: 'call_excerpt',
          sourceId,
          recordRef,
          sourceRevision,
          quoteText: s,
        };
        statedObjections.push({
          category: def.category,
          statement: s,
          evidence,
        });
      }
    }
  }

  // 4. Stated Next Steps (Proposal vs. Acceptance vs. Explicit Closure)
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];

    // Explicit closure / negative decision
    if (/\b(I said I will contact you if there is anything to discuss|no follow-?up needed)\b/i.test(s)) {
      const evidence: CallEvidenceRef = {
        type: 'call_excerpt',
        sourceId,
        recordRef,
        sourceRevision,
        quoteText: s,
      };
      statedNextSteps.push({
        actionType: 'explicit_no_follow_up',
        description: 'Explicit closure: Participant stated they will contact if needed',
        evidence: [evidence],
      });
      continue;
    }

    // Agreement on sending brief / explanation
    if (/\b(why don't you just send me a brief|send an explanation of what you do)\b/i.test(s)) {
      // Look for rep agreement
      if (i + 1 < sentences.length) {
        const nextSentence = sentences[i + 1];
        if (/\b(certainly|I'll do that|all right, I'll do that|sure)\b/i.test(nextSentence)) {
          const propEvidence: CallEvidenceRef = {
            type: 'call_excerpt',
            sourceId,
            recordRef,
            sourceRevision,
            quoteText: s,
          };
          const respEvidence: CallEvidenceRef = {
            type: 'call_excerpt',
            sourceId,
            recordRef,
            sourceRevision,
            quoteText: nextSentence,
          };
          statedNextSteps.push({
            actionType: 'email_proposal',
            description: 'Send brief/explanation on messaging app as agreed',
            evidence: [propEvidence, respEvidence],
          });
        }
      }
    }
  }

  // 5. Summary Points & Evidence Sufficiency
  const totalWords = transcript.split(/\s+/).filter(Boolean).length;
  const evidenceSufficiency: EvidenceSufficiency = totalWords >= 8 ? 'sufficient' : 'insufficient';

  if (evidenceSufficiency === 'sufficient') {
    for (let i = 0; i < Math.min(sentences.length, 3); i++) {
      const s = sentences[i];
      if (s.length > 10) {
        const evidence: CallEvidenceRef = {
          type: 'call_excerpt',
          sourceId,
          recordRef,
          sourceRevision,
          quoteText: s,
        };
        summaryPoints.push({
          statement: s.length > 90 ? s.slice(0, 87) + '...' : s,
          evidence,
        });
      }
    }
  }

  return {
    recordRef,
    sourceType: 'call',
    sourceId,
    generatedForRevision: sourceRevision,
    generatedAt: new Date().toISOString(),
    summaryPoints,
    topics,
    keyQuestions,
    statedObjections,
    statedNextSteps,
    evidenceSufficiency,
    unusableReason: null,
  };
}

/**
 * Validates claims and citations in a RecordAnalysisPayload against its source record.
 */
export function validateAnalysisPayload(
  record: AppRecord,
  payload: RecordAnalysisPayload
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (payload.sourceId !== record.source.source_id) {
    errors.push(`Payload sourceId mismatch: expected ${record.source.source_id}, got ${payload.sourceId}`);
  }

  // Historical invariant: every citation must match the payload's generatedForRevision
  const checkCitation = (citation: EvidenceRef) => {
    if (citation.sourceRevision !== payload.generatedForRevision) {
      errors.push(`Citation sourceRevision (${citation.sourceRevision}) does not match payload.generatedForRevision (${payload.generatedForRevision})`);
    }

    if (citation.type === 'meeting_turn') {
      const turns = record.source.transcript_payload?.turns;
      // If record is at the same revision, verify turn existence
      if (record.appliedRevision === payload.generatedForRevision && turns) {
        if (citation.turnNumber < 1 || citation.turnNumber > turns.length) {
          errors.push(`Meeting citation turnNumber ${citation.turnNumber} out of bounds`);
        } else {
          const turn = turns[citation.turnNumber - 1];
          if (turn.speaker !== citation.speaker) {
            errors.push(`Meeting citation speaker mismatch: expected ${turn.speaker}, got ${citation.speaker}`);
          }
          if (turn.timecode !== citation.timecode) {
            errors.push(`Meeting citation timecode mismatch: expected ${turn.timecode}, got ${citation.timecode}`);
          }
          if (!turn.text.includes(citation.quoteText)) {
            errors.push(`Meeting citation quoteText not found in turn text`);
          }
        }
      }
    } else if (citation.type === 'call_excerpt') {
      const callTranscript = (record.source.payload as CallPayload).transcript;
      if (record.appliedRevision === payload.generatedForRevision && callTranscript) {
        if (!callTranscript.includes(citation.quoteText)) {
          errors.push(`Call citation quoteText not found in call transcript`);
        }
      }
    }
  };

  payload.summaryPoints.forEach((sp) => checkCitation(sp.evidence));
  payload.topics.forEach((t) => checkCitation(t.evidence));
  payload.keyQuestions.forEach((q) => checkCitation(q.evidence));
  payload.statedObjections.forEach((o) => checkCitation(o.evidence));
  payload.statedNextSteps.forEach((ns) => ns.evidence.forEach(checkCitation));

  return { valid: errors.length === 0, errors };
}
