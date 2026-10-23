/**
 * Export Engine: Pure functions for generating export manifests and bundles.
 * 
 * This module implements the Slice 5 export functionality per DATA_CONTRACT.md requirements.
 * It reads current store state and produces:
 * - JSON manifest (detailed record metadata)
 * - CSV manifest (tabular summary)
 * - Complete JSON bundle (manifest + all output files)
 * 
 * All functions are pure and independently testable.
 */

import type { AppRecord } from '../../types/contract';

/**
 * Manifest entry for a single exported record.
 */
export interface ExportManifestEntry {
  record_ref: string;
  source_type: 'call' | 'meeting';
  source_id: string;
  applied_revision: number;
  suggested_route: string;
  effective_route: string;
  is_manual_override: boolean;
  review_state: string;
  has_usable_transcript: boolean;
  analysis_freshness: string;
  generated_for_revision: number | null;
  last_modified_at: string | null;
  output_path: string;
}

/**
 * Complete export manifest with metadata.
 */
export interface ExportManifest {
  exported_at: string;
  total_records: number;
  calls_count: number;
  meetings_count: number;
  usable_transcripts_count: number;
  manual_overrides_count: number;
  entries: ExportManifestEntry[];
}

/**
 * Complete export bundle containing manifest and all output files.
 */
export interface ExportBundle {
  manifest: ExportManifest;
  files: Record<string, ExportedRecordFile>;
}

/**
 * Exported record file containing full context.
 */
export interface ExportedRecordFile {
  record_ref: string;
  source_type: 'call' | 'meeting';
  source_id: string;
  applied_revision: number;
  source_envelope: any; // Full EnvelopeRecord
  suggested_route: string;
  effective_route: string;
  is_manual_override: boolean;
  review_state: string;
  user_notes: string;
  secondary_tags: string[];
  has_usable_transcript: boolean;
  analysis_state: {
    freshness: string;
    generated_for_revision: number | null;
    analysis: any | null; // Full RecordAnalysisPayload
  };
  last_modified_at: string | null;
}

/**
 * Escapes a value for CSV output.
 * Handles commas, quotes, newlines, and array fields.
 */
export function escapeCSV(value: string | number | boolean | null | string[]): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle arrays by joining with semicolons
  if (Array.isArray(value)) {
    return escapeCSV(value.join('; '));
  }

  const str = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Creates a deterministic, collision-safe route slug.
 * Converts route name to lowercase, replaces non-alphanumeric with hyphens,
 * removes consecutive hyphens, and trims.
 */
export function slugifyRoute(route: string): string {
  return route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates the output path for a record.
 * Format: {route_slug}/{source_type}_{source_id}.json
 */
export function generateOutputPath(
  effectiveRoute: string,
  sourceType: 'call' | 'meeting',
  sourceId: string
): string {
  const routeSlug = slugifyRoute(effectiveRoute);
  return `${routeSlug}/${sourceType}_${sourceId}.json`;
}

/**
 * Computes the effective route for a record.
 * Returns manual route if override is active, otherwise suggested route.
 */
export function getEffectiveRoute(record: AppRecord): string {
  if (record.userState.isManualOverride && record.userState.manualRoute) {
    return record.userState.manualRoute;
  }
  return record.suggestedRoute;
}

/**
 * Generates a manifest entry for a single record.
 */
export function generateManifestEntry(record: AppRecord): ExportManifestEntry {
  const effectiveRoute = getEffectiveRoute(record);
  const outputPath = generateOutputPath(
    effectiveRoute,
    record.source.source_type,
    record.source.source_id
  );

  return {
    record_ref: record.source.record_ref,
    source_type: record.source.source_type,
    source_id: record.source.source_id,
    applied_revision: record.appliedRevision,
    suggested_route: record.suggestedRoute,
    effective_route: effectiveRoute,
    is_manual_override: record.userState.isManualOverride,
    review_state: record.userState.reviewState,
    has_usable_transcript: record.hasUsableTranscript,
    analysis_freshness: record.analysisState.freshness,
    generated_for_revision: record.analysisState.generatedForRevision,
    last_modified_at: record.userState.lastModifiedAt,
    output_path: outputPath,
  };
}

/**
 * Generates an exported record file with full context.
 */
export function generateRecordFile(record: AppRecord): ExportedRecordFile {
  const effectiveRoute = getEffectiveRoute(record);

  return {
    record_ref: record.source.record_ref,
    source_type: record.source.source_type,
    source_id: record.source.source_id,
    applied_revision: record.appliedRevision,
    source_envelope: record.source,
    suggested_route: record.suggestedRoute,
    effective_route: effectiveRoute,
    is_manual_override: record.userState.isManualOverride,
    review_state: record.userState.reviewState,
    user_notes: record.userState.userNotes,
    secondary_tags: record.userState.secondaryTags,
    has_usable_transcript: record.hasUsableTranscript,
    analysis_state: {
      freshness: record.analysisState.freshness,
      generated_for_revision: record.analysisState.generatedForRevision,
      analysis: record.analysisState.analysis,
    },
    last_modified_at: record.userState.lastModifiedAt,
  };
}

/**
 * Generates the complete export bundle from all records.
 * This is the primary export function.
 */
export function generateExportBundle(records: AppRecord[]): ExportBundle {
  const exportedAt = new Date().toISOString();
  
  // Generate manifest entries
  const entries: ExportManifestEntry[] = records.map(generateManifestEntry);
  
  // Generate files map
  const files: Record<string, ExportedRecordFile> = {};
  entries.forEach((entry, index) => {
    files[entry.output_path] = generateRecordFile(records[index]);
  });

  // Calculate metadata from actual data
  let callsCount = 0;
  let meetingsCount = 0;
  let usableTranscriptsCount = 0;
  let manualOverridesCount = 0;

  for (const record of records) {
    if (record.source.source_type === 'call') {
      callsCount++;
    } else if (record.source.source_type === 'meeting') {
      meetingsCount++;
    }

    if (record.hasUsableTranscript) {
      usableTranscriptsCount++;
    }

    if (record.userState.isManualOverride) {
      manualOverridesCount++;
    }
  }

  const manifest: ExportManifest = {
    exported_at: exportedAt,
    total_records: records.length,
    calls_count: callsCount,
    meetings_count: meetingsCount,
    usable_transcripts_count: usableTranscriptsCount,
    manual_overrides_count: manualOverridesCount,
    entries,
  };

  return {
    manifest,
    files,
  };
}

/**
 * Converts manifest entries to CSV format.
 * Returns CSV string with headers.
 */
export function manifestToCSV(entries: ExportManifestEntry[]): string {
  const headers = [
    'record_ref',
    'source_type',
    'source_id',
    'applied_revision',
    'suggested_route',
    'effective_route',
    'is_manual_override',
    'review_state',
    'has_usable_transcript',
    'analysis_freshness',
    'generated_for_revision',
    'last_modified_at',
    'output_path',
  ];

  const rows = entries.map((entry) => [
    escapeCSV(entry.record_ref),
    escapeCSV(entry.source_type),
    escapeCSV(entry.source_id),
    escapeCSV(entry.applied_revision),
    escapeCSV(entry.suggested_route),
    escapeCSV(entry.effective_route),
    escapeCSV(entry.is_manual_override),
    escapeCSV(entry.review_state),
    escapeCSV(entry.has_usable_transcript),
    escapeCSV(entry.analysis_freshness),
    escapeCSV(entry.generated_for_revision),
    escapeCSV(entry.last_modified_at),
    escapeCSV(entry.output_path),
  ]);

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ];

  return csvLines.join('\n');
}

/**
 * Generates all three export formats:
 * - JSON manifest
 * - CSV manifest
 * - Complete bundle
 */
export interface ExportFormats {
  jsonManifest: string;
  csvManifest: string;
  jsonBundle: string;
}

export function generateAllExportFormats(records: AppRecord[]): ExportFormats {
  const bundle = generateExportBundle(records);

  return {
    jsonManifest: JSON.stringify(bundle.manifest, null, 2),
    csvManifest: manifestToCSV(bundle.manifest.entries),
    jsonBundle: JSON.stringify(bundle, null, 2),
  };
}
