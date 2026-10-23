/**
 * Export Panel Component
 * 
 * Provides UI for exporting records in multiple formats:
 * - JSON manifest
 * - CSV manifest
 * - Complete JSON bundle
 */

import React from 'react';
import type { AppRecord } from '../../types/contract';
import { generateAllExportFormats } from './exportEngine';

interface ExportPanelProps {
  records: AppRecord[];
}

/**
 * Triggers browser download of a file.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportPanel({ records }: ExportPanelProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = (format: 'json-manifest' | 'csv-manifest' | 'json-bundle') => {
    setIsExporting(true);

    try {
      const formats = generateAllExportFormats(records);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      switch (format) {
        case 'json-manifest':
          downloadFile(
            formats.jsonManifest,
            `export-manifest-${timestamp}.json`,
            'application/json'
          );
          break;

        case 'csv-manifest':
          downloadFile(
            formats.csvManifest,
            `export-manifest-${timestamp}.csv`,
            'text/csv'
          );
          break;

        case 'json-bundle':
          downloadFile(
            formats.jsonBundle,
            `export-bundle-${timestamp}.json`,
            'application/json'
          );
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <div className="export-panel-header">
        <h2>Export Records</h2>
        <p className="export-panel-description">
          Export all {records.length} records with current routing and analysis state
        </p>
      </div>

      <div className="export-panel-actions">
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => handleExport('json-manifest')}
          disabled={isExporting || records.length === 0}
          title="Download JSON manifest with record metadata"
        >
          📄 JSON Manifest
        </button>

        <button
          className="btn btn--secondary btn--sm"
          onClick={() => handleExport('csv-manifest')}
          disabled={isExporting || records.length === 0}
          title="Download CSV manifest for spreadsheet analysis"
        >
          📊 CSV Manifest
        </button>

        <button
          className="btn btn--primary btn--sm"
          onClick={() => handleExport('json-bundle')}
          disabled={isExporting || records.length === 0}
          title="Download complete export bundle with manifest and all record files"
        >
          📦 Complete Bundle
        </button>
      </div>

      {records.length === 0 && (
        <p className="export-panel-empty">
          No records available for export. Import data first.
        </p>
      )}
    </div>
  );
}
