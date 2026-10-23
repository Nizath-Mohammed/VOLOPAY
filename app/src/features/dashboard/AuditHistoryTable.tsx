import type { FC } from 'react';
import { AuditEntry } from '../../types/contract';

interface AuditHistoryTableProps {
  auditHistory: AuditEntry[];
  isDegraded: boolean;
  onClearAudit: () => void;
}

export const AuditHistoryTable: FC<AuditHistoryTableProps> = ({
  auditHistory,
  isDegraded,
  onClearAudit,
}) => {
  const getBadgeClass = (action: string) => {
    switch (action) {
      case 'INITIAL_LOAD':
        return 'badge-initial';
      case 'SHUFFLED_RELOAD':
        return 'badge-shuffled';
      case 'UPDATE_BATCH':
        return 'badge-update';
      case 'CUSTOM_IMPORT':
        return 'badge-custom';
      case 'STORE_RESET':
      case 'STORE_RESET_FAILED':
        return 'badge-reset';
      case 'AUDIT_LOG_COMPACTED':
        return 'badge-compaction';
      default:
        return 'badge-initial';
    }
  };

  return (
    <div className="audit-table-card">
      <div className="panel-header-row">
        <div>
          <h4 className="panel-title">Replay Audit Ledger & State Telemetry</h4>
          <span className="panel-subtitle">
            Append-only chronological record of assessment deliveries and mutations
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isDegraded && (
            <span className="badge-pill" style={{ color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              Storage quota exceeded &bull; Logging in-memory
            </span>
          )}
          {auditHistory.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={onClearAudit}
            >
              Clear Log
            </button>
          )}
        </div>
      </div>

      {auditHistory.length === 0 ? (
        <div style={{ padding: '2.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No replay actions logged yet. Use the controls in the Replay Pipeline above to ingest delivery batches.
        </div>
      ) : (
        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Timestamp (IST)</th>
                <th>Records (Before &rarr; After)</th>
                <th>Applied / Ignored / Rejected</th>
                <th>Operation Details</th>
              </tr>
            </thead>
            <tbody>
              {auditHistory.slice().reverse().map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span className={`audit-badge ${getBadgeClass(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="audit-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })} IST
                  </td>
                  <td className="delta-chip">
                    {entry.previousRecordCount} &rarr; <strong>{entry.newRecordCount}</strong>
                  </td>
                  <td className="delta-chip">
                    <span style={{ color: 'var(--accent-emerald)' }}>+{entry.appliedCount}</span> /{' '}
                    <span style={{ color: 'var(--text-muted)' }}>{entry.ignoredCount}</span> /{' '}
                    <span style={{ color: entry.rejectedCount > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                      {entry.rejectedCount}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {entry.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
