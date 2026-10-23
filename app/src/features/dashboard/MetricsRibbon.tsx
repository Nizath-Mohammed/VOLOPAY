import type { FC } from 'react';

interface MetricsRibbonProps {
  metrics: {
    totalRecords: number;
    callsCount: number;
    meetingsCount: number;
    usableTranscriptsCount: number;
    callTranscriptsCount: number;
    meetingTranscriptsCount: number;
    coverageRate: number;
    callCoverageRate: number;
    meetingCoverageRate: number;
    manualOverridesCount: number;
    pendingReviewCount: number;
    unreviewedCount: number;
    reviewedCount: number;
  };
}

export const MetricsRibbon: FC<MetricsRibbonProps> = ({ metrics }) => {
  // Purely dynamic percentage bounded strictly between 0% and 100%
  const dynamicPercentage = metrics.totalRecords > 0
    ? Math.min(100, Math.max(0, (metrics.usableTranscriptsCount / metrics.totalRecords) * 100))
    : 0;

  return (
    <div className="metrics-grid">
      {/* 1. Total Selected Records */}
      <div className="metric-card">
        <div className="metric-header-row">
          <span className="metric-eyebrow">Selected Records</span>
          <span className="badge-pill">Dataset Sample</span>
        </div>
        <div className="metric-value tabular-num">{metrics.totalRecords}</div>
        <div className="metric-subtext">
          <span className="tabular-num">{metrics.callsCount}</span> Calls &bull;{' '}
          <span className="tabular-num">{metrics.meetingsCount}</span> Meetings
        </div>
      </div>

      {/* 2. Usable Text Coverage with Dynamic Progress Bar */}
      <div className="metric-card">
        <div className="metric-header-row">
          <span className="metric-eyebrow">Usable Text Coverage</span>
          <span className="metric-badge tabular-num">{dynamicPercentage.toFixed(1)}%</span>
        </div>
        <div className="metric-value">
          <span className="tabular-num">{metrics.usableTranscriptsCount}</span>
          <span className="metric-denominator tabular-num"> / {metrics.totalRecords}</span>
        </div>

        {/* Dynamic Progress Bar */}
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={dynamicPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="progress-fill"
            style={{ width: `${dynamicPercentage}%` }}
          />
        </div>

        <div className="metric-subtext">
          Calls: <span className="tabular-num">{metrics.callTranscriptsCount}/{metrics.callsCount}</span> &bull;{' '}
          Meetings: <span className="tabular-num">{metrics.meetingTranscriptsCount}/{metrics.meetingsCount}</span>
        </div>
      </div>

      {/* 3. Inbox Workflow Review Status */}
      <div className="metric-card">
        <div className="metric-header-row">
          <span className="metric-eyebrow">Inbox Review Status</span>
          <span className="badge-pill" style={{ color: 'var(--accent-amber)' }}>
            Workflow
          </span>
        </div>
        <div className="metric-value tabular-num" style={{ color: 'var(--accent-amber)' }}>
          {metrics.pendingReviewCount}
          <span className="metric-denominator"> pending</span>
        </div>
        <div className="metric-subtext">
          <span className="tabular-num">{metrics.unreviewedCount}</span> unreviewed &bull;{' '}
          <span className="tabular-num">{metrics.reviewedCount}</span> reviewed
        </div>
      </div>

      {/* 4. Human Manual Overrides */}
      <div className="metric-card">
        <div className="metric-header-row">
          <span className="metric-eyebrow">Manual Overrides</span>
          <span className="badge-pill" style={{ color: 'var(--accent-purple)' }}>
            Persistent
          </span>
        </div>
        <div className="metric-value tabular-num" style={{ color: 'var(--accent-purple)' }}>
          {metrics.manualOverridesCount}
        </div>
        <div className="metric-subtext">
          Preserved across higher revision updates
        </div>
      </div>
    </div>
  );
};
