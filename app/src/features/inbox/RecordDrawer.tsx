import React, { useState, useEffect } from 'react';
import type {
  AppRecord,
  CallPayload,
  MeetingPayload,
  ReviewState,
  SourceType,
} from '../../types/contract';
import type { EvidenceRef } from '../../types/analysis';
import { TAXONOMY_ROUTES } from '../../types/contract';
import { TranscriptViewer } from './TranscriptViewer';
import { AnalysisViewer } from '../analysis/AnalysisViewer';

export type DrawerTab = 'transcript' | 'analysis' | 'review';

interface RecordDrawerProps {
  record: AppRecord | null;
  onClose: () => void;
  onSaveReview: (
    sourceType: SourceType,
    sourceId: string,
    updates: {
      manualRoute?: string | null;
      reviewState?: ReviewState;
      userNotes?: string;
    }
  ) => void;
  onClearOverride: (sourceType: SourceType, sourceId: string) => void;
  onGenerateAnalysis?: (sourceType: SourceType, sourceId: string) => void;
}

export const RecordDrawer: React.FC<RecordDrawerProps> = ({
  record,
  onClose,
  onSaveReview,
  onClearOverride,
  onGenerateAnalysis,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('transcript');
  const [highlightTurn, setHighlightTurn] = useState<number | null>(null);
  const [route, setRoute] = useState<string>('');
  const [reviewState, setReviewState] = useState<ReviewState>('unreviewed');
  const [notes, setNotes] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Synchronize local form state with active record
  useEffect(() => {
    if (record) {
      const activeRoute =
        record.userState.isManualOverride && record.userState.manualRoute
          ? record.userState.manualRoute
          : record.suggestedRoute;
      setRoute(activeRoute);
      setReviewState(record.userState.reviewState);
      setNotes(record.userState.userNotes || '');
      setSaveSuccessMsg(null);
      setHighlightTurn(null);
    }
  }, [record]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  const isCall = record.source.source_type === 'call';
  const callPayload = isCall ? (record.source.payload as CallPayload) : null;
  const meetingPayload = !isCall ? (record.source.payload as MeetingPayload) : null;

  // Format activity timestamp in Asia/Kolkata (IST)
  const rawIso = isCall ? callPayload?.started_at : meetingPayload?.starts_at;
  let formattedIst = '21 Aug 2026 IST';
  if (rawIso) {
    try {
      const dateUtc = new Date(rawIso);
      const istMillis = dateUtc.getTime() + 5.5 * 60 * 60 * 1000;
      const istDate = new Date(istMillis);
      const hours = String(istDate.getUTCHours()).padStart(2, '0');
      const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
      formattedIst = `21 Aug 2026, ${hours}:${minutes} IST`;
    } catch {
      formattedIst = '21 Aug 2026 IST';
    }
  }

  // Format duration in mm:ss
  const totalSeconds = isCall
    ? callPayload?.duration_seconds ?? 0
    : meetingPayload?.duration_seconds ?? 0;
  const durMin = Math.floor(totalSeconds / 60);
  const durSec = String(totalSeconds % 60).padStart(2, '0');
  const formattedDuration = `${durMin}:${durSec}`;

  const isOverridden = record.userState.isManualOverride;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveReview(record.source.source_type, record.source.source_id, {
      manualRoute: route,
      reviewState,
      userNotes: notes,
    });
    setSaveSuccessMsg('Review updated successfully.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleResetToSuggested = () => {
    onClearOverride(record.source.source_type, record.source.source_id);
    setRoute(record.suggestedRoute);
    setSaveSuccessMsg('Routing reset to suggested default.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleCitationClick = (evidence: EvidenceRef) => {
    if (evidence.type === 'meeting_turn') {
      if (record.hasUsableTranscript) {
        setActiveTab('transcript');
        setHighlightTurn(evidence.turnNumber);
      }
    } else if (evidence.type === 'call_excerpt') {
      if (record.hasUsableTranscript) {
        setActiveTab('transcript');
      }
    }
  };

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      data-testid="drawer-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        data-testid="record-drawer-panel"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className={`drawer-source-pill ${record.source.source_type}`}>
              {record.source.source_type.toUpperCase()}
            </span>
            <span className="drawer-ref-badge">{record.source.record_ref}</span>
            <span className="drawer-revision-badge">Rev {record.appliedRevision}</span>
            <h2 className="drawer-title">
              {isCall ? `Call: ${callPayload?.rep_name || 'Unassigned Rep'}` : meetingPayload?.title}
            </h2>
          </div>
          <button
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close record drawer"
            data-testid="drawer-close-btn"
          >
            &times;
          </button>
        </div>

        {/* Drawer Body Scrollable Content */}
        <div className="drawer-body">
          {/* Metadata Grid */}
          <div className="drawer-metadata-grid" data-testid="drawer-metadata-grid">
            <div className="meta-cell">
              <span className="meta-label">Source ID</span>
              <span className="meta-value code-font" title={record.source.source_id}>
                {record.source.source_id.slice(0, 18)}...
              </span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Time (IST Anchor)</span>
              <span className="meta-value">{formattedIst}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Duration</span>
              <span className="meta-value">{formattedDuration} ({totalSeconds}s)</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Usability</span>
              <span className="meta-value">
                {record.hasUsableTranscript ? (
                  <span className="status-pill status-usable">Usable Audio</span>
                ) : (
                  <span className="status-pill status-silent">Silent / No Audio</span>
                )}
              </span>
            </div>

            {isCall ? (
              <>
                <div className="meta-cell">
                  <span className="meta-label">Rep Name</span>
                  <span className="meta-value">{callPayload?.rep_name || 'Unassigned'}</span>
                </div>
                <div className="meta-cell">
                  <span className="meta-label">Direction</span>
                  <span className="meta-value capitalize">{callPayload?.direction || 'N/A'}</span>
                </div>
                <div className="meta-cell">
                  <span className="meta-label">From / To</span>
                  <span className="meta-value code-font">
                    {callPayload?.from_number || 'N/A'} &rarr; {callPayload?.to_number || 'N/A'}
                  </span>
                </div>
                <div className="meta-cell">
                  <span className="meta-label">Reported Outcome</span>
                  <span className="meta-value">{callPayload?.observed_outcome || 'N/A'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="meta-cell">
                  <span className="meta-label">Organizer</span>
                  <span className="meta-value">{meetingPayload?.organizer_email || 'N/A'}</span>
                </div>
                <div className="meta-cell">
                  <span className="meta-label">Attendees</span>
                  <span className="meta-value">{meetingPayload?.attendee_count ?? 'N/A'}</span>
                </div>
                <div className="meta-cell">
                  <span className="meta-label">Provider</span>
                  <span className="meta-value">{meetingPayload?.provider || 'N/A'}</span>
                </div>
                <div className="meta-cell">
                  <span className="meta-label">Status</span>
                  <span className="meta-value capitalize">{meetingPayload?.recording_status || 'N/A'}</span>
                </div>
              </>
            )}
          </div>

          {/* Segmented Navigation Tabs */}
          <div className="drawer-tabs-bar" data-testid="drawer-tabs-bar">
            <button
              type="button"
              className={`drawer-tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('transcript');
                setHighlightTurn(null);
              }}
              data-testid="tab-transcript"
            >
              1. Evidence &amp; Transcript
            </button>
            <button
              type="button"
              className={`drawer-tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
              data-testid="tab-analysis"
            >
              2. Derived Analysis
              {record.analysisState.freshness === 'stale_pending_review' && (
                <span className="tab-pill tab-pill--stale">Stale</span>
              )}
              {record.analysisState.freshness === 'current' && (
                <span className="tab-pill tab-pill--fresh">Fresh</span>
              )}
            </button>
            <button
              type="button"
              className={`drawer-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
              data-testid="tab-review"
            >
              3. Manager Review
              {record.userState.isManualOverride && (
                <span className="tab-pill tab-pill--override">Override</span>
              )}
            </button>
          </div>

          {/* Tab 1: Verbatim Transcript Section */}
          {activeTab === 'transcript' && (
            <div className="drawer-tab-pane" data-testid="pane-transcript">
              <TranscriptViewer record={record} highlightTurn={highlightTurn} />
            </div>
          )}

          {/* Tab 2: Derived Analysis Section */}
          {activeTab === 'analysis' && (
            <div className="drawer-tab-pane" data-testid="pane-analysis">
              <AnalysisViewer
                record={record}
                onGenerateAnalysis={() =>
                  onGenerateAnalysis?.(record.source.source_type, record.source.source_id)
                }
                onSelectCitation={handleCitationClick}
              />
            </div>
          )}

          {/* Tab 3: Manager Review Workflow Section */}
          {activeTab === 'review' && (
            <div className="drawer-tab-pane review-section" data-testid="drawer-review-section">
              <div className="review-section-header">
                <h3 className="drawer-section-title">Manager Routing &amp; Workflow Review</h3>
                <div className="override-indicator">
                  {isOverridden ? (
                    <span className="override-badge-active" data-testid="badge-manual-override">
                      &bull; Manual Override Active
                    </span>
                  ) : (
                    <span className="override-badge-default" data-testid="badge-suggested-default">
                      &bull; Suggested Default
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSave} className="review-form">
                {/* Routing Taxonomy Selector */}
                <div className="form-group">
                  <label htmlFor="route-select" className="form-label">
                    Assigned Revenue Taxonomy Route
                  </label>
                  <div className="route-select-row">
                    <select
                      id="route-select"
                      className="form-select"
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                      data-testid="route-select"
                    >
                      {TAXONOMY_ROUTES.map((taxRoute) => (
                        <option key={taxRoute} value={taxRoute}>
                          {taxRoute} {taxRoute === record.suggestedRoute ? '(Suggested)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary btn-reset-route"
                      onClick={handleResetToSuggested}
                      disabled={!isOverridden}
                      data-testid="btn-reset-suggested"
                      title={isOverridden ? 'Revert to suggested route' : 'Already on suggested route'}
                    >
                      Reset to Suggested
                    </button>
                  </div>
                  <div className="form-help-text">
                    Suggested baseline: <strong>{record.suggestedRoute}</strong>
                  </div>
                </div>

                {/* Review State Selector */}
                <div className="form-group">
                  <label className="form-label">Human Review Status</label>
                  <div className="review-state-options" data-testid="review-state-options">
                    {(['unreviewed', 'pending_review', 'reviewed'] as ReviewState[]).map((state) => (
                      <label
                        key={state}
                        className={`radio-pill-label ${reviewState === state ? 'active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="reviewState"
                          value={state}
                          checked={reviewState === state}
                          onChange={() => setReviewState(state)}
                          className="sr-only"
                          data-testid={`radio-review-${state}`}
                        />
                        {state === 'unreviewed' && 'Unreviewed'}
                        {state === 'pending_review' && 'Pending Review'}
                        {state === 'reviewed' && 'Reviewed'}
                      </label>
                    ))}
                  </div>
                </div>

                {/* User Notes Editor */}
                <div className="form-group">
                  <label htmlFor="user-notes" className="form-label">
                    Reviewer Notes &amp; Action Items
                  </label>
                  <textarea
                    id="user-notes"
                    className="form-textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Record coaching feedback, deal escalation context, or validation notes..."
                    data-testid="user-notes-input"
                  />
                </div>

                {/* Action Buttons & Feedback */}
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn-primary btn-save-review"
                    data-testid="btn-save-review"
                  >
                    Save Review Decision
                  </button>
                  {saveSuccessMsg && (
                    <span className="save-success-feedback" data-testid="save-feedback">
                      &check; {saveSuccessMsg}
                    </span>
                  )}
                  {record.userState.lastModifiedAt && (
                    <span className="last-modified-label">
                      Last saved: {new Date(record.userState.lastModifiedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
