import React, { useState } from 'react';
import type { AppRecord } from '../../types/contract';
import type {
  EvidenceRef,
  RecordAnalysisPayload,
} from '../../types/analysis';

interface AnalysisViewerProps {
  record: AppRecord;
  onGenerateAnalysis: () => void;
  onSelectCitation?: (evidence: EvidenceRef) => void;
}

export const AnalysisViewer: React.FC<AnalysisViewerProps> = ({
  record,
  onGenerateAnalysis,
  onSelectCitation,
}) => {
  const { analysisState, appliedRevision, hasUsableTranscript } = record;
  const { analysis, freshness, generatedForRevision } = analysisState;
  const [showHistorical, setShowHistorical] = useState(false);
  const [expandedCitation, setExpandedCitation] = useState<EvidenceRef | null>(null);

  const handleCitationClick = (evidence: EvidenceRef) => {
    setExpandedCitation(expandedCitation === evidence ? null : evidence);
    if (onSelectCitation) {
      onSelectCitation(evidence);
    }
  };

  const renderCitationPill = (evidence: EvidenceRef, isHistorical: boolean) => {
    let label = '';
    if (evidence.type === 'meeting_turn') {
      label = `Rev ${evidence.sourceRevision} • Turn #${evidence.turnNumber} • ${evidence.speaker} (${evidence.timecode})`;
    } else {
      label = `Rev ${evidence.sourceRevision} • Call Excerpt`;
    }

    const isExpanded = expandedCitation === evidence;

    return (
      <div key={`${evidence.sourceId}-${evidence.sourceRevision}-${evidence.type === 'meeting_turn' ? evidence.turnNumber : evidence.quoteText}`} className="citation-container">
        <button
          type="button"
          className={`citation-pill ${isHistorical ? 'citation-pill--historical' : ''}`}
          onClick={() => handleCitationClick(evidence)}
          title={`Click to inspect evidence quote (Generated for Rev ${evidence.sourceRevision})`}
        >
          <span className="citation-icon">🔗</span>
          <span className="citation-label">{label}</span>
        </button>

        {isExpanded && (
          <div className="citation-quote-callout">
            <div className="citation-quote-header">
              <span className="citation-quote-origin">
                Source Evidence (Revision {evidence.sourceRevision})
              </span>
              {!hasUsableTranscript && (
                <span className="citation-quote-unavailable-note">
                  Current Revision {appliedRevision} has no usable transcript
                </span>
              )}
            </div>
            <div className="citation-quote-text">
              &ldquo;{evidence.quoteText}&rdquo;
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPayloadCards = (payload: RecordAnalysisPayload, isHistorical = false) => {
    return (
      <div className={`analysis-cards-grid ${isHistorical ? 'analysis-cards-grid--historical' : ''}`}>
        {/* Summary Points */}
        <div className="analysis-card">
          <div className="analysis-card-header">
            <h4>Summary Points</h4>
            <span className={`sufficiency-tag sufficiency-tag--${payload.evidenceSufficiency}`}>
              {payload.evidenceSufficiency === 'sufficient' ? 'Sufficient Evidence' : 'Insufficient Evidence'}
            </span>
          </div>
          {payload.evidenceSufficiency === 'insufficient' ? (
            <p className="analysis-empty-text">
              Transcript contains insufficient factual assertions to synthesize summary points.
            </p>
          ) : payload.summaryPoints.length === 0 ? (
            <p className="analysis-empty-text">No summary points generated.</p>
          ) : (
            <ul className="analysis-list">
              {payload.summaryPoints.map((sp, idx) => (
                <li key={idx} className="analysis-list-item">
                  <div className="analysis-item-content">{sp.statement}</div>
                  <div className="analysis-item-citations">
                    {renderCitationPill(sp.evidence, isHistorical)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Business Topics */}
        <div className="analysis-card">
          <div className="analysis-card-header">
            <h4>Topics Discussed</h4>
            <span className="analysis-count-badge">{payload.topics.length}</span>
          </div>
          {payload.topics.length === 0 ? (
            <p className="analysis-empty-text">No taxonomy topics detected in transcript.</p>
          ) : (
            <ul className="analysis-list">
              {payload.topics.map((t, idx) => (
                <li key={idx} className="analysis-list-item">
                  <div className="analysis-topic-title">
                    <span className="topic-bullet">🏷️</span>
                    <strong>{t.topic}</strong>
                  </div>
                  <div className="analysis-item-citations">
                    {renderCitationPill(t.evidence, isHistorical)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Key Questions */}
        <div className="analysis-card">
          <div className="analysis-card-header">
            <h4>Key Questions</h4>
            <span className="analysis-count-badge">{payload.keyQuestions.length}</span>
          </div>
          {payload.keyQuestions.length === 0 ? (
            <p className="analysis-empty-text">No questions detected in transcript.</p>
          ) : (
            <ul className="analysis-list">
              {payload.keyQuestions.map((q, idx) => (
                <li key={idx} className="analysis-list-item">
                  <div className="analysis-question-body">
                    <span className="question-speaker">{q.askingSpeaker}:</span>
                    <span className="question-text">&ldquo;{q.questionText}&rdquo;</span>
                  </div>
                  <div className="analysis-item-citations">
                    {renderCitationPill(q.evidence, isHistorical)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stated Objections */}
        <div className="analysis-card">
          <div className="analysis-card-header">
            <h4>Stated Objections & Constraints</h4>
            <span className="analysis-count-badge">{payload.statedObjections.length}</span>
          </div>
          {payload.statedObjections.length === 0 ? (
            <p className="analysis-empty-text">No objections or operational constraints expressed.</p>
          ) : (
            <ul className="analysis-list">
              {payload.statedObjections.map((obj, idx) => (
                <li key={idx} className="analysis-list-item">
                  <div className="objection-header">
                    <span className={`objection-category-tag category-${obj.category}`}>
                      {obj.category.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="objection-body">&ldquo;{obj.statement}&rdquo;</div>
                  <div className="analysis-item-citations">
                    {renderCitationPill(obj.evidence, isHistorical)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stated Next Steps */}
        <div className="analysis-card analysis-card--full-width">
          <div className="analysis-card-header">
            <h4>Agreed Next Steps</h4>
            <span className="analysis-count-badge">{payload.statedNextSteps.length}</span>
          </div>
          {payload.statedNextSteps.length === 0 ? (
            <p className="analysis-empty-text">No explicit next step detected in the transcript.</p>
          ) : (
            <ul className="analysis-list">
              {payload.statedNextSteps.map((ns, idx) => (
                <li key={idx} className="analysis-list-item analysis-next-step-item">
                  <div className="next-step-badge-row">
                    <span className={`next-step-action-tag action-${ns.actionType}`}>
                      {ns.actionType.replace('_', ' ')}
                    </span>
                    <span className="next-step-desc">{ns.description}</span>
                  </div>
                  <div className="analysis-item-citations">
                    {ns.evidence.map((ev, evIdx) => (
                      <React.Fragment key={evIdx}>
                        {renderCitationPill(ev, isHistorical)}
                      </React.Fragment>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="analysis-viewer">
      {/* 1. FRESHNESS BANNER & CONTROLS */}
      {freshness === 'current' && analysis && (
        <div className="freshness-banner freshness-banner--current">
          <div className="freshness-status">
            <span className="freshness-badge freshness-badge--current">
              ● Fresh • Revision {generatedForRevision}
            </span>
            <span className="freshness-timestamp">
              Generated: {new Date(analysis.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onGenerateAnalysis}
            title="Regenerate analysis for current revision"
          >
            Regenerate
          </button>
        </div>
      )}

      {freshness === 'stale_pending_review' && (
        <div className="freshness-banner freshness-banner--stale">
          <div className="freshness-status">
            <span className="freshness-badge freshness-badge--stale">
              ⚠️ Stale Analysis
            </span>
            <span className="freshness-meta">
              Generated for Revision {generatedForRevision ?? 'older'} • Current Record is Revision {appliedRevision}
            </span>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onGenerateAnalysis}
          >
            Regenerate Analysis for Revision {appliedRevision}
          </button>
        </div>
      )}

      {freshness === 'uncomputed' && (
        <div className="analysis-empty-container">
          <div className="analysis-empty-hero">
            <span className="analysis-hero-icon">⚡</span>
            <h3>Analysis Ready for Revision {appliedRevision}</h3>
            <p>
              This record has a usable transcript with active dialogue. Generate offline, evidence-backed
              analysis covering key topics, questions, objections, and confirmed next steps.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onGenerateAnalysis}
            >
              Generate Analysis for Revision {appliedRevision}
            </button>
          </div>
        </div>
      )}

      {freshness === 'not_applicable' && (
        <div className="analysis-unavailable-container">
          <div className="freshness-banner freshness-banner--unavailable">
            <span className="freshness-badge freshness-badge--not-applicable">
              Transcript Unavailable
            </span>
            <p className="unavailable-text">
              Analysis unavailable because usable evidence is missing in Revision {appliedRevision}.
            </p>
          </div>

          {/* Historical Analysis View if prior analysis is preserved */}
          {analysis && generatedForRevision !== null && (
            <div className="historical-analysis-section">
              <button
                type="button"
                className="historical-toggle-btn"
                onClick={() => setShowHistorical(!showHistorical)}
              >
                {showHistorical ? '▼ Hide' : '▶ View'} Historical Analysis from Revision {generatedForRevision}
              </button>

              {showHistorical && (
                <div className="historical-content-wrapper">
                  <div className="historical-alert-banner">
                    <span className="alert-icon">ℹ️</span>
                    <div className="alert-message">
                      <strong>Historical Reference Only — Generated for Revision {generatedForRevision}</strong>
                      <p>
                        This analysis reflects superseded evidence from Revision {generatedForRevision}.
                        It does NOT describe current Revision {appliedRevision}, which has no usable transcript evidence.
                      </p>
                    </div>
                  </div>
                  {renderPayloadCards(analysis, true)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. RENDER ACTIVE PAYLOAD WHEN PRESENT (Current or Stale) */}
      {(freshness === 'current' || freshness === 'stale_pending_review') && analysis && (
        <div className="analysis-active-payload">
          {freshness === 'stale_pending_review' && (
            <div className="stale-disclaimer-note">
              Note: Displaying analysis from Revision {generatedForRevision}. Evidence and turn citations reflect the older revision. Click Regenerate above to update for Revision {appliedRevision}.
            </div>
          )}
          {renderPayloadCards(analysis, freshness === 'stale_pending_review')}
        </div>
      )}
    </div>
  );
};
