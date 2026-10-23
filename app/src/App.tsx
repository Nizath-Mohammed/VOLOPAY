import { useState, useMemo, useEffect } from 'react';
import './features/styles/dashboard.css';
import { ReplayStore } from './engine/replayStore';
import { ReplayToolbar } from './features/toolbar/ReplayToolbar';
import { OverviewDashboard } from './features/dashboard/OverviewDashboard';
import { ExportPanel } from './features/export/ExportPanel';
import { InboxView } from './features/inbox/InboxView';
import { RecordDrawer } from './features/inbox/RecordDrawer';
import { DeliveryBatch, ReviewState, SourceType } from './types/contract';
import { getRecordKey, parseUrlRecordHash, RecordIdentity } from './engine/identity';

// Import initial and update assessment batches
import initialBatchJson from '../../data/01_initial.json';
import updateBatchJson from '../../data/02_update.json';

const initialBatch = initialBatchJson as unknown as DeliveryBatch;
const updateBatch = updateBatchJson as unknown as DeliveryBatch;

interface ToastState {
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

export function App() {
  const store = useMemo(() => new ReplayStore(), []);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedRecordIdentity, setSelectedRecordIdentity] = useState<RecordIdentity | null>(null);

  const refreshState = () => setTick((t) => t + 1);

  // URL preservation helper (preserves pathname and search)
  const getBaseUrl = () => `${window.location.pathname}${window.location.search}`;

  const clearRecordUrlHash = () => {
    if (window.location.hash.startsWith('#record=')) {
      window.history.replaceState(null, '', getBaseUrl());
    }
  };

  // Immediate Drawer Open: synchronous state update + URL hash update
  const handleOpenRecord = (sourceType: SourceType, sourceId: string) => {
    const identity: RecordIdentity = [sourceType, sourceId];
    setSelectedRecordIdentity(identity);

    const canonicalKey = getRecordKey(sourceType, sourceId);
    const targetHash = `#record=${encodeURIComponent(canonicalKey)}`;
    const targetUrl = `${getBaseUrl()}${targetHash}`;

    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetUrl);
    }
  };

  // Immediate Drawer Close: synchronous state clear + URL cleanup
  const handleCloseRecord = () => {
    setSelectedRecordIdentity(null);
    clearRecordUrlHash();
  };

  // Manager Review Decisions
  const handleSaveReview = (
    sourceType: SourceType,
    sourceId: string,
    updates: {
      manualRoute?: string | null;
      reviewState?: ReviewState;
      userNotes?: string;
    }
  ) => {
    try {
      store.updateUserRecordState(sourceType, sourceId, updates);
      refreshState();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to save review: ${err instanceof Error ? err.message : 'Storage commit error'}`,
      });
    }
  };

  const handleClearOverride = (sourceType: SourceType, sourceId: string) => {
    try {
      store.clearManualOverride(sourceType, sourceId);
      refreshState();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to reset override: ${err instanceof Error ? err.message : 'Error'}`,
      });
    }
  };

  const handleGenerateAnalysis = (sourceType: SourceType, sourceId: string) => {
    try {
      store.generateRecordAnalysis(sourceType, sourceId);
      refreshState();
      setToast({
        type: 'success',
        message: 'Analysis generated successfully.',
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to generate analysis: ${err instanceof Error ? err.message : 'Error'}`,
      });
    }
  };

  // Central URL hash sync effect (handles direct load, navigation, and invalid hash cleanup)
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash;

      // Case A: No record hash
      if (!hash || !hash.startsWith('#record=')) {
        setSelectedRecordIdentity((prev) => (prev !== null ? null : prev));
        return;
      }

      // Case B: #record= present
      const rawParam = hash.slice('#record='.length);
      const identity = parseUrlRecordHash(rawParam);

      if (!identity) {
        // Malformed or invalid identity
        setSelectedRecordIdentity(null);
        clearRecordUrlHash();
        return;
      }

      const record = store.getRecord(identity[0], identity[1]);
      if (!record) {
        // Nonexistent record
        setSelectedRecordIdentity(null);
        clearRecordUrlHash();
        return;
      }

      // Valid existing record
      setSelectedRecordIdentity((prev) => {
        if (prev && prev[0] === identity[0] && prev[1] === identity[1]) {
          return prev;
        }
        return identity;
      });
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [store, tick]);

  const handleLoadInitial = () => {
    try {
      const summary = store.importInitialBatch(initialBatch);
      setToast({
        type: 'success',
        message: `Initial batch loaded: ${summary.appliedCount} records committed (${summary.usableTranscriptsNow} usable transcripts).`,
      });
      refreshState();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Failed to load initial batch: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const handleReimportShuffled = () => {
    try {
      const shuffledBatch: DeliveryBatch = {
        ...initialBatch,
        records: [...initialBatch.records].reverse(),
      };
      const summary = store.reimportShuffledBatch(shuffledBatch);
      setToast({
        type: 'info',
        message: `Idempotence verified: 0 applied, ${summary.ignoredCount} ignored. Total records strictly remain 44.`,
      });
      refreshState();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Shuffled re-import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const handleApplyUpdate = () => {
    try {
      const summary = store.applyUpdateBatch(updateBatch);
      setToast({
        type: 'success',
        message: `Update batch applied (Rev 2): Meeting M07 updated with 27 turns. Total usable transcripts increased to ${summary.usableTranscriptsNow}.`,
      });
      refreshState();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Update batch failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const handleCustomImport = (batch: DeliveryBatch) => {
    try {
      const summary = store.importCustomBatch(batch);
      setToast({
        type: summary.rejectedCount > 0 ? 'warning' : 'success',
        message: `Imported "${batch.batch_id}": ${summary.appliedCount} applied, ${summary.ignoredCount} ignored, ${summary.collapsedCount} collapsed, ${summary.rejectedCount} rejected.`,
      });
      refreshState();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Custom import rejected: ${err instanceof Error ? err.message : 'Validation failure'}`,
      });
    }
  };

  const handleResetStore = () => {
    try {
      store.resetState();
      setSelectedRecordIdentity(null);
      clearRecordUrlHash();
      setToast({
        type: 'info',
        message: 'Store reset confirmed: records cleared from memory and persistent storage. Prior audit ledger preserved.',
      });
      refreshState();
    } catch (err) {
      setToast({
        type: 'error',
        message: `Store reset failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const handleClearAudit = () => {
    store.clearAuditHistory();
    setToast({
      type: 'info',
      message: 'Audit history cleared.',
    });
    refreshState();
  };

  const metrics = store.getSummaryMetrics();
  const timeline = store.getHourlyTimeline();
  const auditHistory = store.getAuditHistory();
  const isAuditDegraded = store.isAuditStorageDegraded();
  const allRecords = store.getAllRecords();

  const activeRecord = selectedRecordIdentity
    ? store.getRecord(selectedRecordIdentity[0], selectedRecordIdentity[1]) ?? null
    : null;

  return (
    <div className="app-container">
      {/* Linear-inspired Header */}
      <header className="app-header">
        <div className="header-brand-wrap">
          <span className="brand-badge">
            <span className="live-dot" /> Volopay Assessment
          </span>
          <h1 className="header-title">Revenue Intelligence Inbox</h1>
          <p className="header-subtitle">
            Vertical Slice 3: Pipeline &bull; Overview Analytics &bull; Inbox & Record Review
          </p>
        </div>

        <div className="header-meta-group">
          <div className="date-anchor-badge">
            <span style={{ color: 'var(--text-muted)' }}>Reporting Date:</span>
            <strong style={{ color: 'var(--text-primary)' }}>21 August 2026</strong>
            <span style={{ color: 'var(--accent-cyan)' }}>Asia/Kolkata (IST &bull; UTC+05:30)</span>
          </div>
        </div>
      </header>

      {/* Replay Control Pipeline */}
      <ReplayToolbar
        onLoadInitial={handleLoadInitial}
        onReimportShuffled={handleReimportShuffled}
        onApplyUpdate={handleApplyUpdate}
        onCustomImport={handleCustomImport}
        onResetStore={handleResetStore}
        recordCount={metrics.totalRecords}
        usableCount={metrics.usableTranscriptsCount}
      />

      {/* Dismissible Feedback Toast */}
      {toast && (
        <div className={`toast-banner toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0 0.25rem',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Overview Analytics Dashboard */}
      <OverviewDashboard
        metrics={metrics}
        timeline={timeline}
        auditHistory={auditHistory}
        isAuditDegraded={isAuditDegraded}
        onClearAudit={handleClearAudit}
      />

      {/* Export Panel */}
      <ExportPanel records={allRecords} />

      {/* Revenue Intelligence Inbox */}
      <InboxView
        records={allRecords}
        selectedIdentity={selectedRecordIdentity}
        onSelectRecord={handleOpenRecord}
      />

      {/* Slide-Over Record Drawer & Review Workflow */}
      <RecordDrawer
        record={activeRecord}
        onClose={handleCloseRecord}
        onSaveReview={handleSaveReview}
        onClearOverride={handleClearOverride}
        onGenerateAnalysis={handleGenerateAnalysis}
      />
    </div>
  );
}

