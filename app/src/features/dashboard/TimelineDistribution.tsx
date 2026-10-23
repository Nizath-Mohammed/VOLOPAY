import type { FC } from 'react';

interface TimelineBucket {
  hour: number;
  hourLabel: string;
  callCount: number;
  meetingCount: number;
  total: number;
}

interface TimelineDistributionProps {
  timeline: TimelineBucket[];
  totalRecords: number;
}

export const TimelineDistribution: FC<TimelineDistributionProps> = ({
  timeline = [],
  totalRecords,
}) => {
  // Safe max calculation: Guards against empty arrays (avoids -Infinity)
  const totals = (timeline || []).map((b) => b.total);
  const maxTotal = totals.length > 0 ? Math.max(...totals, 1) : 1;

  // Safe fallback if timeline is empty
  const hasData = timeline && timeline.length > 0;

  return (
    <div className="panel-card">
      <div className="panel-header-row">
        <div>
          <h4 className="panel-title">Activity Timeline</h4>
          <span className="panel-subtitle">
            21 August 2026 &bull; Asia/Kolkata (IST: UTC+05:30)
          </span>
        </div>
        <span className="badge-pill tabular-num">
          {totalRecords} Total Interactions
        </span>
      </div>

      {!hasData ? (
        <div className="timeline-empty-state">
          No activity recorded for this period.
        </div>
      ) : (
        <>
          {/* Explicit height chain: timeline-chart-track (160px) -> timeline-bar-column (100%) -> timeline-bar-stack (100%) */}
          <div className="timeline-chart-track">
            {timeline.map((bucket) => {
              // Using a consistent scaling denominator (maxTotal) ensures stacked total never exceeds 100%
              const callPercent = bucket.callCount > 0 
                ? (bucket.callCount / maxTotal) * 100 
                : 0;
              const meetingPercent = bucket.meetingCount > 0 
                ? (bucket.meetingCount / maxTotal) * 100 
                : 0;

              return (
                <div
                  key={bucket.hour}
                  className="timeline-bar-column"
                  title={`${bucket.hourLabel} IST: ${bucket.total} interactions (${bucket.callCount} calls, ${bucket.meetingCount} meetings)`}
                >
                  <div className="timeline-bar-stack">
                    {/* flex column-reverse stacks call-segment at bottom, meeting-segment above */}
                    {callPercent > 0 && (
                      <div
                        className="bar-segment call-segment"
                        style={{ height: `${callPercent}%` }}
                      />
                    )}
                    {meetingPercent > 0 && (
                      <div
                        className="bar-segment meeting-segment"
                        style={{ height: `${meetingPercent}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3-Hour Axis Ticks */}
          <div className="timeline-axis-ticks">
            <span>00:00</span>
            <span>03:00</span>
            <span>06:00</span>
            <span>09:00</span>
            <span>12:00</span>
            <span>15:00</span>
            <span>18:00</span>
            <span>21:00</span>
          </div>

          <div className="timeline-legend">
            <span className="legend-item">
              <span className="legend-indicator call-indicator" /> Calls (started_at)
            </span>
            <span className="legend-item">
              <span className="legend-indicator meeting-indicator" /> Meetings (starts_at)
            </span>
          </div>
        </>
      )}
    </div>
  );
};
