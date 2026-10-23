import { AppRecord, AuditEntry } from '../types/contract';

export const RECORDS_STORAGE_KEY = 'revenue_intelligence_inbox_state_v1';
export const AUDIT_STORAGE_KEY = 'revenue_intelligence_inbox_audit_v1';
export const STORAGE_KEY = RECORDS_STORAGE_KEY; // Backward-compatibility alias

export const MAX_PERSISTED_AUDIT_ENTRIES = 50;

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageAdapter {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

export function getEffectiveStorage(customStorage?: StorageAdapter): StorageAdapter {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return new MemoryStorage();
}

/**
 * Serializes records map to JSON string.
 */
export function serializeRecords(records: Map<string, AppRecord>): string {
  const entries = Array.from(records.entries());
  return JSON.stringify(entries);
}

/**
 * Deserializes records map from JSON string with safe backward-compatibility migration.
 * Legacy records with reviewState === 'unusable_silent' are migrated to 'unreviewed'.
 * Manual routes and override flags are strictly preserved and do NOT force 'reviewed'.
 */
export function deserializeRecords(jsonString: string): Map<string, AppRecord> {
  const entries = JSON.parse(jsonString) as [string, AppRecord][];
  for (const [, record] of entries) {
    if ((record.userState.reviewState as string) === 'unusable_silent') {
      record.userState.reviewState = 'unreviewed';
    }
  }
  return new Map(entries);
}

/**
 * Serializes audit history to JSON string.
 * When compact is true, binds persisted history to MAX_PERSISTED_AUDIT_ENTRIES (50)
 * with a prepended AUDIT_LOG_COMPACTED marker.
 */
export function serializeAuditHistory(history: AuditEntry[], compact = false): string {
  if (!compact || history.length <= MAX_PERSISTED_AUDIT_ENTRIES) {
    return JSON.stringify(history);
  }

  const compactedEntries = history.slice(-MAX_PERSISTED_AUDIT_ENTRIES);
  const compactionMarker: AuditEntry = {
    id: `compaction-marker-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'AUDIT_LOG_COMPACTED',
    previousRecordCount: history.length,
    newRecordCount: compactedEntries.length,
    appliedCount: 0,
    ignoredCount: 0,
    rejectedCount: 0,
    details: `Persisted audit log compacted: ${history.length - MAX_PERSISTED_AUDIT_ENTRIES} older entries trimmed due to storage quota. Complete history retained in active session.`,
  };

  return JSON.stringify([compactionMarker, ...compactedEntries]);
}

/**
 * Deserializes audit history from JSON string.
 */
export function deserializeAuditHistory(jsonString: string): AuditEntry[] {
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}
