import React from 'react';
import type { AppRecord, CallPayload } from '../../types/contract';

interface TranscriptViewerProps {
  record: AppRecord;
  highlightTurn?: number | null;
  highlightQuote?: string | null;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  record,
  highlightTurn,
}) => {
  const isCall = record.source.source_type === 'call';

  React.useEffect(() => {
    if (highlightTurn) {
      const el = document.getElementById(`turn-anchor-${highlightTurn}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightTurn]);

  if (isCall) {
    const callPayload = record.source.payload as CallPayload;
    const rawTranscript = callPayload.transcript?.trim();

    if (!rawTranscript) {
      return (
        <div className="transcript-empty-card" data-testid="silent-transcript-state">
          <div className="empty-icon-wrap">
            <span className="empty-status-pill">Silent / No Usable Audio</span>
          </div>
          <h4 className="empty-card-title">No Audio / Empty Transcript</h4>
          <p className="empty-card-desc">
            This call record contains no transcribed dialogue or spoken audio.
            Source status: <code>{callPayload.observed_outcome || 'unconnected'}</code> &bull; Duration: {callPayload.duration_seconds}s.
          </p>
        </div>
      );
    }

    return (
      <div className="transcript-container" data-testid="call-transcript-viewer">
        <div className="transcript-section-header">
          <span className="section-label">Verbatim Call Audio Transcript</span>
          <span className="section-badge">{callPayload.duration_seconds}s &bull; {callPayload.direction}</span>
        </div>
        <div className="transcript-prose-text" data-testid="call-prose-text">
          {callPayload.transcript}
        </div>
      </div>
    );
  }

  // Meeting record
  const turns = record.source.transcript_payload?.turns;
  if (!turns || turns.length === 0) {
    return (
      <div className="transcript-empty-card" data-testid="silent-transcript-state">
        <div className="empty-icon-wrap">
          <span className="empty-status-pill">Empty / No Turns Available</span>
        </div>
        <h4 className="empty-card-title">No Audio / Empty Transcript</h4>
        <p className="empty-card-desc">
          This meeting contains no recorded transcript turns.
          {record.source.transcript_payload?.unavailable_reason && (
            <span> Reason: {record.source.transcript_payload.unavailable_reason}</span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="transcript-container" data-testid="meeting-transcript-viewer">
      <div className="transcript-section-header">
        <span className="section-label">Verbatim Meeting Dialogue</span>
        <span className="section-badge">{turns.length} turns in sequence</span>
      </div>
      <div className="meeting-turns-list">
        {turns.map((turn, idx) => {
          const turnNum = idx + 1;
          const isHighlighted = highlightTurn === turnNum;
          return (
            <div
              key={idx}
              id={`turn-anchor-${turnNum}`}
              className={`meeting-turn-card ${isHighlighted ? 'meeting-turn-card--highlighted' : ''}`}
              data-testid={`meeting-turn-${idx}`}
            >
              <div className="turn-card-header">
                <span className="turn-index-pill">Turn #{turnNum}</span>
                <strong className="turn-speaker-name">{turn.speaker}</strong>
                <span className="turn-timecode-badge">{turn.timecode}</span>
                {isHighlighted && <span className="cited-badge">Cited Evidence</span>}
              </div>
              <div className="turn-verbatim-content">{turn.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
