import React, { useState, useMemo } from 'react';
import type {
  AppRecord,
  CallPayload,
  MeetingPayload,
  ReviewState,
  SourceType,
} from '../../types/contract';
import type { RecordIdentity } from '../../engine/identity';
import { getEffectiveRoute } from '../../engine/replayStore';

interface InboxViewProps {
  records: AppRecord[];
  selectedIdentity: RecordIdentity | null;
  onSelectRecord: (sourceType: SourceType, sourceId: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  records,
  selectedIdentity,
  onSelectRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'call' | 'meeting'>('all');
  const [usabilityFilter, setUsabilityFilter] = useState<'all' | 'usable' | 'silent'>('all');
  const [reviewStateFilter, setReviewStateFilter] = useState<'all' | ReviewState>('all');
  const [overrideFilter, setOverrideFilter] = useState<'all' | 'overridden'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'duration' | 'ref'>('time');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter and search logic
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      // 1. Source type filter
      if (sourceTypeFilter !== 'all' && record.source.source_type !== sourceTypeFilter) {
        return false;
      }

      // 2. Usability filter
      if (usabilityFilter === 'usable' && !record.hasUsableTranscript) {
        return false;
      }
      if (usabilityFilter === 'silent' && record.hasUsableTranscript) {
        return false;
      }

      // 3. Review state filter
      if (reviewStateFilter !== 'all' && record.userState.reviewState !== reviewStateFilter) {
        return false;
      }

      // 4. Override filter
      if (overrideFilter === 'overridden' && !record.userState.isManualOverride) {
        return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const refMatch = record.source.record_ref.toLowerCase().includes(q);
        const idMatch = record.source.source_id.toLowerCase().includes(q);

        let subjectMatch = false;
        if (record.source.source_type === 'call') {
          const call = record.source.payload as CallPayload;
          subjectMatch =
            Boolean(call.rep_name?.toLowerCase().includes(q)) ||
            Boolean(call.from_number?.toLowerCase().includes(q)) ||
            Boolean(call.to_number?.toLowerCase().includes(q));
        } else {
          const meeting = record.source.payload as MeetingPayload;
          subjectMatch =
            Boolean(meeting.title?.toLowerCase().includes(q)) ||
            Boolean(meeting.organizer_email?.toLowerCase().includes(q));
        }

        if (!refMatch && !idMatch && !subjectMatch) {
          return false;
        }
      }

      return true;
    });
  }, [records, sourceTypeFilter, usabilityFilter, reviewStateFilter, overrideFilter, searchQuery]);

  // Sort logic
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'time') {
        const timeA =
          a.source.source_type === 'call'
            ? (a.source.payload as CallPayload).started_at
            : (a.source.payload as MeetingPayload).starts_at;
        const timeB =
          b.source.source_type === 'call'
            ? (b.source.payload as CallPayload).started_at
            : (b.source.payload as MeetingPayload).starts_at;
        comparison = new Date(timeA).getTime() - new Date(timeB).getTime();
      } else if (sortBy === 'duration') {
        const durA =
          a.source.source_type === 'call'
            ? (a.source.payload as CallPayload).duration_seconds
            : (a.source.payload as MeetingPayload).duration_seconds;
        const durB =
          b.source.source_type === 'call'
            ? (b.source.payload as CallPayload).duration_seconds
            : (b.source.payload as MeetingPayload).duration_seconds;
        comparison = durA - durB;
      } else if (sortBy === 'ref') {
        comparison = a.source.record_ref.localeCompare(b.source.record_ref);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredRecords, sortBy, sortOrder]);

  const isSelected = (record: AppRecord) => {
    return (
      selectedIdentity !== null &&
      selectedIdentity[0] === record.source.source_type &&
      selectedIdentity[1] === record.source.source_id
    );
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatIstTime = (isoString?: string) => {
    if (!isoString) return '21 Aug 2026';
    try {
      const utc = new Date(isoString);
      const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
      const hh = String(ist.getUTCHours()).padStart(2, '0');
      const mm = String(ist.getUTCMinutes()).padStart(2, '0');
      return `${hh}:${mm} IST`;
    } catch {
      return '21 Aug 2026';
    }
  };

  return (
    <section className="inbox-section" data-testid="inbox-view-section">
      <div className="inbox-header">
        <div className="inbox-title-wrap">
          <h2 className="inbox-title">Revenue Intelligence Inbox</h2>
          <span className="inbox-count-badge">
            {sortedRecords.length} / {records.length} records
          </span>
        </div>

        {/* Global Instant Search */}
        <div className="inbox-search-wrap">
          <input
            type="text"
            className="inbox-search-input"
            placeholder="Search ref, ID, title, rep name, phone, organizer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="inbox-search-input"
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="inbox-filters-bar">
        {/* Source Type Filter */}
        <div className="filter-group">
          <span className="filter-label">Source:</span>
          <div className="filter-pills">
            {(['all', 'call', 'meeting'] as const).map((type) => (
              <button
                key={type}
                className={`filter-pill ${sourceTypeFilter === type ? 'active' : ''}`}
                onClick={() => setSourceTypeFilter(type)}
                data-testid={`filter-source-${type}`}
              >
                {type === 'all' ? 'All' : type === 'call' ? 'Calls' : 'Meetings'}
              </button>
            ))}
          </div>
        </div>

        {/* Usability Filter */}
        <div className="filter-group">
          <span className="filter-label">Audio Usability:</span>
          <div className="filter-pills">
            {(['all', 'usable', 'silent'] as const).map((u) => (
              <button
                key={u}
                className={`filter-pill ${usabilityFilter === u ? 'active' : ''}`}
                onClick={() => setUsabilityFilter(u)}
                data-testid={`filter-usability-${u}`}
              >
                {u === 'all' ? 'All' : u === 'usable' ? 'Usable Audio' : 'Silent / Empty'}
              </button>
            ))}
          </div>
        </div>

        {/* Review State Filter */}
        <div className="filter-group">
          <span className="filter-label">Review Status:</span>
          <div className="filter-pills">
            {(['all', 'unreviewed', 'pending_review', 'reviewed'] as const).map((st) => (
              <button
                key={st}
                className={`filter-pill ${reviewStateFilter === st ? 'active' : ''}`}
                onClick={() => setReviewStateFilter(st)}
                data-testid={`filter-review-${st}`}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'unreviewed'
                  ? 'Unreviewed'
                  : st === 'pending_review'
                  ? 'Pending Review'
                  : 'Reviewed'}
              </button>
            ))}
          </div>
        </div>

        {/* Overrides Filter */}
        <div className="filter-group">
          <span className="filter-label">Routing:</span>
          <div className="filter-pills">
            {(['all', 'overridden'] as const).map((ov) => (
              <button
                key={ov}
                className={`filter-pill ${overrideFilter === ov ? 'active' : ''}`}
                onClick={() => setOverrideFilter(ov)}
                data-testid={`filter-override-${ov}`}
              >
                {ov === 'all' ? 'All Routes' : 'Manual Overrides Only'}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Controls */}
        <div className="sort-controls-wrap">
          <span className="filter-label">Sort:</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'time' | 'duration' | 'ref')}
            data-testid="inbox-sort-select"
          >
            <option value="time">Activity Time</option>
            <option value="duration">Duration</option>
            <option value="ref">Record Ref</option>
          </select>
          <button
            className="sort-order-btn"
            onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            title={sortOrder === 'desc' ? 'Sort Descending' : 'Sort Ascending'}
            data-testid="inbox-sort-order-btn"
          >
            {sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Record Table */}
      <div className="inbox-table-container">
        {sortedRecords.length === 0 ? (
          <div className="inbox-empty-state" data-testid="inbox-empty-state">
            <p>No records match the current filter criteria.</p>
            <button
              className="btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setSourceTypeFilter('all');
                setUsabilityFilter('all');
                setReviewStateFilter('all');
                setOverrideFilter('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <table className="inbox-table" data-testid="inbox-records-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Ref</th>
                <th style={{ width: '90px' }}>Type</th>
                <th>Subject / Rep & Contacts</th>
                <th style={{ width: '100px' }}>Time (IST)</th>
                <th style={{ width: '80px' }}>Duration</th>
                <th style={{ width: '110px' }}>Usability</th>
                <th style={{ minWidth: '180px' }}>Assigned Route</th>
                <th style={{ width: '130px' }}>Review Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((record) => {
                const isCall = record.source.source_type === 'call';
                const callPayload = isCall ? (record.source.payload as CallPayload) : null;
                const meetingPayload = !isCall ? (record.source.payload as MeetingPayload) : null;
                const effectiveRoute = getEffectiveRoute(record);
                const selected = isSelected(record);

                const totalSec = isCall
                  ? callPayload?.duration_seconds ?? 0
                  : meetingPayload?.duration_seconds ?? 0;
                const timeIso = isCall ? callPayload?.started_at : meetingPayload?.starts_at;

                return (
                  <tr
                    key={`${record.source.source_type}-${record.source.source_id}`}
                    className={`inbox-row ${selected ? 'selected-row' : ''}`}
                    onClick={() =>
                      onSelectRecord(record.source.source_type, record.source.source_id)
                    }
                    data-testid={`inbox-row-${record.source.record_ref}`}
                  >
                    <td>
                      <span className="row-ref-badge">{record.source.record_ref}</span>
                    </td>
                    <td>
                      <span className={`source-tag-pill ${record.source.source_type}`}>
                        {record.source.source_type}
                      </span>
                    </td>
                    <td>
                      <div className="row-subject-wrap">
                        <strong className="row-subject-title">
                          {isCall
                            ? `Call: ${callPayload?.rep_name || 'Unassigned Rep'}`
                            : meetingPayload?.title}
                        </strong>
                        <span className="row-subject-subtitle">
                          {isCall
                            ? `${callPayload?.from_number || 'N/A'} → ${callPayload?.to_number || 'N/A'} (${callPayload?.direction || 'N/A'})`
                            : `${meetingPayload?.organizer_email || 'No organizer'} • ${meetingPayload?.attendee_count ?? 1} attendees`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="row-time-text">{formatIstTime(timeIso)}</span>
                    </td>
                    <td>
                      <span className="row-duration-text">{formatDuration(totalSec)}</span>
                    </td>
                    <td>
                      {record.hasUsableTranscript ? (
                        <span className="status-pill status-usable">Usable</span>
                      ) : (
                        <span className="status-pill status-silent">Silent</span>
                      )}
                    </td>
                    <td>
                      <div className="row-route-wrap">
                        <span className="route-name-text">{effectiveRoute}</span>
                        {record.userState.isManualOverride && (
                          <span className="manual-override-tag" title="Manually overridden">
                            Manual
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`review-status-pill review-${record.userState.reviewState}`}
                      >
                        {record.userState.reviewState === 'unreviewed' && 'Unreviewed'}
                        {record.userState.reviewState === 'pending_review' && 'Pending'}
                        {record.userState.reviewState === 'reviewed' && 'Reviewed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
