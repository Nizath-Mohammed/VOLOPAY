import React from 'react';
import { MetricsRibbon } from './MetricsRibbon';
import { ClassificationPanel } from './ClassificationPanel';
import { TimelineDistribution } from './TimelineDistribution';
import { AuditHistoryTable } from './AuditHistoryTable';
import { AuditEntry } from '../../types/contract';

interface OverviewDashboardProps {
  metrics: ReturnType<import('../../engine/replayStore').ReplayStore['getSummaryMetrics']>;
  timeline: ReturnType<import('../../engine/replayStore').ReplayStore['getHourlyTimeline']>;
  auditHistory: AuditEntry[];
  isAuditDegraded: boolean;
  onClearAudit: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  metrics,
  timeline,
  auditHistory,
  isAuditDegraded,
  onClearAudit,
}) => {
  return (
    <div>
      <MetricsRibbon metrics={metrics} />

      <div className="dashboard-columns">
        <ClassificationPanel metrics={metrics} />
        <TimelineDistribution timeline={timeline} totalRecords={metrics.totalRecords} />
      </div>

      <AuditHistoryTable
        auditHistory={auditHistory}
        isDegraded={isAuditDegraded}
        onClearAudit={onClearAudit}
      />
    </div>
  );
};
