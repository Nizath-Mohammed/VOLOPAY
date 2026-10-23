import type { FC } from 'react';

interface ClassificationPanelProps {
  metrics: {
    callsCount: number;
    callTranscriptsCount: number;
    sourceReportedConnectedCount: number;
    sourceReportedNonConnectedCount: number;
    sourceReportedUnknownCount: number;
    sourceKnownConnectedTotal: number;
    sourceReportedConnectionRate: number;
  };
}

export const ClassificationPanel: FC<ClassificationPanelProps> = ({ metrics }) => {
  const callTextPercent = metrics.callsCount > 0 
    ? ((metrics.callTranscriptsCount / metrics.callsCount) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="panel-card">
      <div className="panel-header-row">
        <div>
          <h4 className="panel-title">Source Metadata vs Verified Evidence</h4>
          <span className="panel-subtitle">Contractual Classification Boundaries &bull; DATA_DICTIONARY.md</span>
        </div>
        <span className="badge-pill" style={{ color: 'var(--accent-cyan)' }}>
          Audit Rules
        </span>
      </div>

      <div className="comparison-list">
        <div className="comparison-row">
          <span className="comparison-label">Source-Reported Connection Rate</span>
          <span className="comparison-value tabular-num" style={{ color: 'var(--accent-cyan)' }}>
            {metrics.sourceReportedConnectionRate.toFixed(1)}%
          </span>
        </div>

        <div className="comparison-row">
          <span className="comparison-label">Connected / Non-Connected Call Ratio</span>
          <span className="comparison-value tabular-num">
            {metrics.sourceReportedConnectedCount} connected &bull; {metrics.sourceReportedNonConnectedCount} non-connected
          </span>
        </div>

        <div className="comparison-row">
          <span className="comparison-label">Calls with Unknown/Null Connection Flag</span>
          <span className="comparison-value tabular-num" style={{ color: 'var(--text-muted)' }}>
            {metrics.sourceReportedUnknownCount} calls
          </span>
        </div>

        <div className="comparison-row">
          <span className="comparison-label">Calls with Usable Adapted Transcript</span>
          <span className="comparison-value tabular-num" style={{ color: 'var(--accent-emerald)' }}>
            {metrics.callTranscriptsCount} of {metrics.callsCount} calls ({callTextPercent}%)
          </span>
        </div>
      </div>

      <div className="notice-box">
        <strong>Data Boundary Reminder:</strong> Stored upstream connection (<code>is_connected</code>) and conversation flags are machine-reported classifications, not ground truth. A transcript-based assessment is evaluated only over text-covered interactions. Never silently combine or substitute them.
      </div>
    </div>
  );
};
