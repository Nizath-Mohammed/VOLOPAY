/**
 * Export Engine Test Suite
 * 
 * Tests Slice 5 export functionality including:
 * - CSV escaping
 * - Empty data handling
 * - Manual overrides
 * - Analysis freshness states
 * - Silent records
 * - Revision updates
 * - Idempotency
 * - Path integrity
 * - Metadata accuracy
 */

import { describe, it, expect } from 'vitest';
import type { AppRecord } from '../types/contract';
import {
  escapeCSV,
  slugifyRoute,
  generateOutputPath,
  getEffectiveRoute,
  generateManifestEntry,
  generateRecordFile,
  generateExportBundle,
  manifestToCSV,
  generateAllExportFormats,
} from '../features/export/exportEngine';

describe('Export Engine - CSV Escaping', () => {
  it('should escape commas', () => {
    expect(escapeCSV('Hello, World')).toBe('"Hello, World"');
  });

  it('should escape quotes', () => {
    expect(escapeCSV('Say "Hello"')).toBe('"Say ""Hello"""');
  });

  it('should escape newlines', () => {
    expect(escapeCSV('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
  });

  it('should handle null values', () => {
    expect(escapeCSV(null)).toBe('');
  });

  it('should handle arrays', () => {
    expect(escapeCSV(['tag1', 'tag2', 'tag3'])).toBe('tag1; tag2; tag3');
  });

  it('should handle arrays with commas in elements', () => {
    expect(escapeCSV(['Sales, Pipeline', 'Deal, Next Steps'])).toBe('"Sales, Pipeline; Deal, Next Steps"');
  });

  it('should handle simple strings without escaping', () => {
    expect(escapeCSV('SimpleString')).toBe('SimpleString');
  });

  it('should handle numbers', () => {
    expect(escapeCSV(42)).toBe('42');
  });

  it('should handle booleans', () => {
    expect(escapeCSV(true)).toBe('true');
    expect(escapeCSV(false)).toBe('false');
  });
});

describe('Export Engine - Route Slugification', () => {
  it('should slugify standard route names', () => {
    expect(slugifyRoute('Sales Pipeline / Discovery')).toBe('sales-pipeline-discovery');
    expect(slugifyRoute('Deal Next Steps / Evaluation')).toBe('deal-next-steps-evaluation');
  });

  it('should handle special characters', () => {
    expect(slugifyRoute('Customer Support & Bug Escalation')).toBe('customer-support-bug-escalation');
  });

  it('should handle multiple consecutive special characters', () => {
    expect(slugifyRoute('Internal /// Vendor  Coordination')).toBe('internal-vendor-coordination');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(slugifyRoute('---Test---')).toBe('test');
  });

  it('should create distinct slugs for distinct routes', () => {
    const slug1 = slugifyRoute('Sales Pipeline / Discovery');
    const slug2 = slugifyRoute('Deal Next Steps / Evaluation');
    expect(slug1).not.toBe(slug2);
  });

  it('should be deterministic', () => {
    const route = 'Sales Pipeline / Discovery';
    expect(slugifyRoute(route)).toBe(slugifyRoute(route));
  });
});

describe('Export Engine - Output Path Generation', () => {
  it('should generate correct path for call', () => {
    const path = generateOutputPath('Sales Pipeline / Discovery', 'call', 'call_123');
    expect(path).toBe('sales-pipeline-discovery/call_call_123.json');
  });

  it('should generate correct path for meeting', () => {
    const path = generateOutputPath('Deal Next Steps / Evaluation', 'meeting', 'mtg_456');
    expect(path).toBe('deal-next-steps-evaluation/meeting_mtg_456.json');
  });

  it('should handle special characters in route names', () => {
    const path = generateOutputPath('Customer Support & Bug Escalation', 'call', 'call_789');
    expect(path).toBe('customer-support-bug-escalation/call_call_789.json');
  });
});

describe('Export Engine - Effective Route', () => {
  it('should return suggested route when no manual override', () => {
    const record: AppRecord = {
      source: { record_ref: 'ref_1', source_type: 'call', source_id: 'call_1', payload: {} as any, transcript_payload: null },
      appliedRevision: 1,
      hasUsableTranscript: true,
      suggestedRoute: 'Sales Pipeline / Discovery',
      userState: {
        manualRoute: null,
        secondaryTags: [],
        isManualOverride: false,
        reviewState: 'unreviewed',
        userNotes: '',
        lastModifiedAt: null,
      },
      analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
    };

    expect(getEffectiveRoute(record)).toBe('Sales Pipeline / Discovery');
  });

  it('should return manual route when override is active', () => {
    const record: AppRecord = {
      source: { record_ref: 'ref_1', source_type: 'call', source_id: 'call_1', payload: {} as any, transcript_payload: null },
      appliedRevision: 1,
      hasUsableTranscript: true,
      suggestedRoute: 'Sales Pipeline / Discovery',
      userState: {
        manualRoute: 'Deal Next Steps / Evaluation',
        secondaryTags: [],
        isManualOverride: true,
        reviewState: 'reviewed',
        userNotes: '',
        lastModifiedAt: '2026-08-21T10:00:00Z',
      },
      analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
    };

    expect(getEffectiveRoute(record)).toBe('Deal Next Steps / Evaluation');
  });

  it('should return suggested route when override is false even if manualRoute exists', () => {
    const record: AppRecord = {
      source: { record_ref: 'ref_1', source_type: 'call', source_id: 'call_1', payload: {} as any, transcript_payload: null },
      appliedRevision: 1,
      hasUsableTranscript: true,
      suggestedRoute: 'Sales Pipeline / Discovery',
      userState: {
        manualRoute: 'Deal Next Steps / Evaluation',
        secondaryTags: [],
        isManualOverride: false,
        reviewState: 'reviewed',
        userNotes: '',
        lastModifiedAt: '2026-08-21T10:00:00Z',
      },
      analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
    };

    expect(getEffectiveRoute(record)).toBe('Sales Pipeline / Discovery');
  });
});

describe('Export Engine - Manifest Entry Generation', () => {
  it('should generate correct manifest entry with all fields', () => {
    const record: AppRecord = {
      source: { 
        record_ref: 'call|call_123', 
        source_type: 'call', 
        source_id: 'call_123', 
        payload: {} as any, 
        transcript_payload: null 
      },
      appliedRevision: 2,
      hasUsableTranscript: true,
      suggestedRoute: 'Sales Pipeline / Discovery',
      userState: {
        manualRoute: 'Deal Next Steps / Evaluation',
        secondaryTags: ['urgent', 'follow-up'],
        isManualOverride: true,
        reviewState: 'reviewed',
        userNotes: 'High priority',
        lastModifiedAt: '2026-08-21T15:30:00Z',
      },
      analysisState: { 
        analysis: { summary: 'Test', route: 'Sales Pipeline / Discovery', nextSteps: [] } as any, 
        freshness: 'current', 
        generatedForRevision: 2 
      },
    };

    const entry = generateManifestEntry(record);

    expect(entry.record_ref).toBe('call|call_123');
    expect(entry.source_type).toBe('call');
    expect(entry.source_id).toBe('call_123');
    expect(entry.applied_revision).toBe(2);
    expect(entry.suggested_route).toBe('Sales Pipeline / Discovery');
    expect(entry.effective_route).toBe('Deal Next Steps / Evaluation');
    expect(entry.is_manual_override).toBe(true);
    expect(entry.review_state).toBe('reviewed');
    expect(entry.has_usable_transcript).toBe(true);
    expect(entry.analysis_freshness).toBe('current');
    expect(entry.generated_for_revision).toBe(2);
    expect(entry.last_modified_at).toBe('2026-08-21T15:30:00Z');
    expect(entry.output_path).toBe('deal-next-steps-evaluation/call_call_123.json');
  });

  it('should handle records without manual overrides', () => {
    const record: AppRecord = {
      source: { 
        record_ref: 'meeting|mtg_456', 
        source_type: 'meeting', 
        source_id: 'mtg_456', 
        payload: {} as any, 
        transcript_payload: null 
      },
      appliedRevision: 1,
      hasUsableTranscript: false,
      suggestedRoute: 'Unusable / Missing Audio',
      userState: {
        manualRoute: null,
        secondaryTags: [],
        isManualOverride: false,
        reviewState: 'unreviewed',
        userNotes: '',
        lastModifiedAt: null,
      },
      analysisState: { analysis: null, freshness: 'not_applicable', generatedForRevision: null },
    };

    const entry = generateManifestEntry(record);

    expect(entry.effective_route).toBe('Unusable / Missing Audio');
    expect(entry.is_manual_override).toBe(false);
    expect(entry.last_modified_at).toBeNull();
  });
});

describe('Export Engine - Record File Generation', () => {
  it('should generate complete record file with full context', () => {
    const record: AppRecord = {
      source: { 
        record_ref: 'call|call_123', 
        source_type: 'call', 
        source_id: 'call_123', 
        payload: { id: 'call_123', external_call_id: 'ext_123' } as any, 
        transcript_payload: null 
      },
      appliedRevision: 2,
      hasUsableTranscript: true,
      suggestedRoute: 'Sales Pipeline / Discovery',
      userState: {
        manualRoute: 'Deal Next Steps / Evaluation',
        secondaryTags: ['urgent'],
        isManualOverride: true,
        reviewState: 'reviewed',
        userNotes: 'Follow up next week',
        lastModifiedAt: '2026-08-21T15:30:00Z',
      },
      analysisState: { 
        analysis: { summary: 'Test summary', route: 'Sales Pipeline / Discovery', nextSteps: [] } as any, 
        freshness: 'current', 
        generatedForRevision: 2 
      },
    };

    const file = generateRecordFile(record);

    expect(file.record_ref).toBe('call|call_123');
    expect(file.source_envelope).toBeDefined();
    expect(file.source_envelope.source_id).toBe('call_123');
    expect(file.effective_route).toBe('Deal Next Steps / Evaluation');
    expect(file.user_notes).toBe('Follow up next week');
    expect(file.secondary_tags).toEqual(['urgent']);
    expect(file.analysis_state.analysis).toBeDefined();
    expect(file.analysis_state.freshness).toBe('current');
  });
});

describe('Export Engine - Bundle Generation', () => {
  it('should generate empty bundle for empty records', () => {
    const bundle = generateExportBundle([]);

    expect(bundle.manifest.total_records).toBe(0);
    expect(bundle.manifest.calls_count).toBe(0);
    expect(bundle.manifest.meetings_count).toBe(0);
    expect(bundle.manifest.usable_transcripts_count).toBe(0);
    expect(bundle.manifest.manual_overrides_count).toBe(0);
    expect(bundle.manifest.entries).toEqual([]);
    expect(Object.keys(bundle.files)).toHaveLength(0);
  });

  it('should generate bundle with correct metadata counts', () => {
    const records: AppRecord[] = [
      {
        source: { record_ref: 'call|1', source_type: 'call', source_id: '1', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
      {
        source: { record_ref: 'meeting|2', source_type: 'meeting', source_id: '2', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Deal Next Steps / Evaluation',
        userState: {
          manualRoute: 'Customer Support & Bug Escalation',
          secondaryTags: [],
          isManualOverride: true,
          reviewState: 'reviewed',
          userNotes: '',
          lastModifiedAt: '2026-08-21T10:00:00Z',
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
      {
        source: { record_ref: 'call|3', source_type: 'call', source_id: '3', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: false,
        suggestedRoute: 'Unusable / Missing Audio',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'not_applicable', generatedForRevision: null },
      },
    ];

    const bundle = generateExportBundle(records);

    expect(bundle.manifest.total_records).toBe(3);
    expect(bundle.manifest.calls_count).toBe(2);
    expect(bundle.manifest.meetings_count).toBe(1);
    expect(bundle.manifest.usable_transcripts_count).toBe(2);
    expect(bundle.manifest.manual_overrides_count).toBe(1);
    expect(bundle.manifest.entries).toHaveLength(3);
  });

  it('should ensure all manifest entries have corresponding files', () => {
    const records: AppRecord[] = [
      {
        source: { record_ref: 'call|1', source_type: 'call', source_id: '1', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
      {
        source: { record_ref: 'meeting|2', source_type: 'meeting', source_id: '2', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Deal Next Steps / Evaluation',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
    ];

    const bundle = generateExportBundle(records);

    // Check path integrity: every manifest entry must have a corresponding file
    for (const entry of bundle.manifest.entries) {
      expect(bundle.files[entry.output_path]).toBeDefined();
      expect(bundle.files[entry.output_path].record_ref).toBe(entry.record_ref);
    }
  });

  it('should be deterministic except for exported_at', () => {
    const records: AppRecord[] = [
      {
        source: { record_ref: 'call|1', source_type: 'call', source_id: '1', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
    ];

    const bundle1 = generateExportBundle(records);
    const bundle2 = generateExportBundle(records);

    // Metadata should be identical
    expect(bundle1.manifest.total_records).toBe(bundle2.manifest.total_records);
    expect(bundle1.manifest.calls_count).toBe(bundle2.manifest.calls_count);

    // Entry content should be identical except exported_at
    expect(bundle1.manifest.entries[0].record_ref).toBe(bundle2.manifest.entries[0].record_ref);
    expect(bundle1.manifest.entries[0].output_path).toBe(bundle2.manifest.entries[0].output_path);

    // Files should be identical
    const path = bundle1.manifest.entries[0].output_path;
    expect(bundle1.files[path].record_ref).toBe(bundle2.files[path].record_ref);
  });
});

describe('Export Engine - CSV Manifest Generation', () => {
  it('should generate CSV with headers', () => {
    const csv = manifestToCSV([]);
    const lines = csv.split('\n');
    
    expect(lines[0]).toContain('record_ref');
    expect(lines[0]).toContain('source_type');
    expect(lines[0]).toContain('effective_route');
    expect(lines[0]).toContain('is_manual_override');
  });

  it('should generate CSV with escaped values', () => {
    const records: AppRecord[] = [
      {
        source: { 
          record_ref: 'call|test,123', 
          source_type: 'call', 
          source_id: 'test,123', 
          payload: {} as any, 
          transcript_payload: null 
        },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
    ];

    const bundle = generateExportBundle(records);
    const csv = manifestToCSV(bundle.manifest.entries);
    
    expect(csv).toContain('"call|test,123"');
  });

  it('should handle all analysis freshness states', () => {
    const records: AppRecord[] = [
      {
        source: { record_ref: 'call|1', source_type: 'call', source_id: '1', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: false,
        suggestedRoute: 'Unusable / Missing Audio',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'not_applicable', generatedForRevision: null },
      },
      {
        source: { record_ref: 'call|2', source_type: 'call', source_id: '2', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
      {
        source: { record_ref: 'call|3', source_type: 'call', source_id: '3', payload: {} as any, transcript_payload: null },
        appliedRevision: 2,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { 
          analysis: { summary: 'Test', route: 'Sales Pipeline / Discovery', nextSteps: [] } as any, 
          freshness: 'current', 
          generatedForRevision: 2 
        },
      },
      {
        source: { record_ref: 'call|4', source_type: 'call', source_id: '4', payload: {} as any, transcript_payload: null },
        appliedRevision: 2,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'pending_review',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { 
          analysis: { summary: 'Old', route: 'Sales Pipeline / Discovery', nextSteps: [] } as any, 
          freshness: 'stale_pending_review', 
          generatedForRevision: 1 
        },
      },
    ];

    const bundle = generateExportBundle(records);
    const csv = manifestToCSV(bundle.manifest.entries);

    expect(csv).toContain('not_applicable');
    expect(csv).toContain('uncomputed');
    expect(csv).toContain('current');
    expect(csv).toContain('stale_pending_review');
  });
});

describe('Export Engine - All Formats Generation', () => {
  it('should generate all three export formats', () => {
    const records: AppRecord[] = [
      {
        source: { record_ref: 'call|1', source_type: 'call', source_id: '1', payload: {} as any, transcript_payload: null },
        appliedRevision: 1,
        hasUsableTranscript: true,
        suggestedRoute: 'Sales Pipeline / Discovery',
        userState: {
          manualRoute: null,
          secondaryTags: [],
          isManualOverride: false,
          reviewState: 'unreviewed',
          userNotes: '',
          lastModifiedAt: null,
        },
        analysisState: { analysis: null, freshness: 'uncomputed', generatedForRevision: null },
      },
    ];

    const formats = generateAllExportFormats(records);

    expect(formats.jsonManifest).toBeTruthy();
    expect(formats.csvManifest).toBeTruthy();
    expect(formats.jsonBundle).toBeTruthy();

    // Verify JSON is valid
    const parsedManifest = JSON.parse(formats.jsonManifest);
    expect(parsedManifest.total_records).toBe(1);

    const parsedBundle = JSON.parse(formats.jsonBundle);
    expect(parsedBundle.manifest).toBeDefined();
    expect(parsedBundle.files).toBeDefined();

    // Verify CSV has headers
    expect(formats.csvManifest.split('\n')[0]).toContain('record_ref');
  });
});
