import React from 'react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
  recordCount: number;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onClose,
  recordCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <h3 className="modal-title" style={{ color: 'var(--accent-rose)' }}>
          Confirm Store Reset
        </h3>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0.5rem 0' }}>
            Are you sure you want to reset the store? This action will:
          </p>
          <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '1.25rem' }}>
            <li>Remove <strong>{recordCount} records</strong> from active memory.</li>
            <li>Clear the persistent <code>revenue_intelligence_inbox_state_v1</code> storage key.</li>
            <li>Discard all manual route assignments and user overrides.</li>
            <li><strong>Preserve prior audit history</strong> in <code>revenue_intelligence_inbox_audit_v1</code> and log an explicit <code>STORE_RESET</code> event.</li>
          </ul>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Yes, Reset Store
          </button>
        </div>
      </div>
    </div>
  );
};
