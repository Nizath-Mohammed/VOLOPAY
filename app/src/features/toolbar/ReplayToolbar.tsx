import { useState } from 'react';
import type { FC } from 'react';
import { DeliveryBatch } from '../../types/contract';
import { ResetConfirmModal } from './ResetConfirmModal';
import { CustomImportModal } from './CustomImportModal';

interface ReplayToolbarProps {
  onLoadInitial: () => void;
  onReimportShuffled: () => void;
  onApplyUpdate: () => void;
  onCustomImport: (batch: DeliveryBatch) => void;
  onResetStore: () => void;
  recordCount: number;
  usableCount: number;
}

export const ReplayToolbar: FC<ReplayToolbarProps> = ({
  onLoadInitial,
  onReimportShuffled,
  onApplyUpdate,
  onCustomImport,
  onResetStore,
  recordCount,
  usableCount,
}) => {
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  return (
    <div className="toolbar-section">
      <div className="toolbar-header">
        <span className="toolbar-eyebrow">Assessment Replay Pipeline</span>
        <div className="toolbar-status-pill tabular-num">
          <span>Active State:</span>
          <strong>{recordCount} Records</strong> &bull; 
          <span style={{ color: 'var(--accent-emerald)' }}>{usableCount} Usable Texts</span>
        </div>
      </div>

      <div className="toolbar-controls-grid">
        {/* Step-by-step Sequential Pipeline */}
        <div className="stepper-group">
          <button
            className="btn btn-primary"
            onClick={onLoadInitial}
            title="Import initial assessment batch (Revision 1)"
          >
            <span className="btn-step-num">1</span>
            <span>Load Initial Batch</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onReimportShuffled}
            title="Re-import initial batch in reversed order to verify idempotence"
          >
            <span className="btn-step-num">2</span>
            <span>Re-import Shuffled</span>
          </button>

          <button
            className="btn btn-emerald"
            onClick={onApplyUpdate}
            title="Apply update batch: supplies 27 turns for meeting M07 (Revision 2)"
          >
            <span className="btn-step-num">3</span>
            <span>Apply Update (M07 Rev 2)</span>
          </button>
        </div>

        {/* Auxiliary & Destructive Actions */}
        <div className="actions-aux-group">
          <button
            className="btn btn-secondary"
            onClick={() => setIsCustomOpen(true)}
            title="Upload or paste custom assessment delivery JSON"
          >
            <span>&uarr; Custom JSON Import</span>
          </button>

          <button
            className="btn btn-danger-ghost"
            onClick={() => setIsResetOpen(true)}
            title="Safely reset in-memory and persistent store to clean slate"
          >
            <span>Reset Store</span>
          </button>
        </div>
      </div>

      <ResetConfirmModal
        isOpen={isResetOpen}
        recordCount={recordCount}
        onClose={() => setIsResetOpen(false)}
        onConfirm={() => {
          setIsResetOpen(false);
          onResetStore();
        }}
      />

      <CustomImportModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
        onImport={(batch) => {
          onCustomImport(batch);
        }}
      />
    </div>
  );
};
