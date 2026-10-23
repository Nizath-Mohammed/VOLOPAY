import React, { useState } from 'react';
import { DeliveryBatch } from '../../types/contract';
import { validateBatchEnvelope } from '../../engine/validation';

interface CustomImportModalProps {
  isOpen: boolean;
  onImport: (batch: DeliveryBatch) => void;
  onClose: () => void;
}

export const CustomImportModal: React.FC<CustomImportModalProps> = ({
  isOpen,
  onImport,
  onClose,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handleValidateAndSubmit = () => {
    try {
      if (!jsonText.trim()) {
        setErrorMsg('Please paste or upload JSON content first.');
        return;
      }

      const parsed = JSON.parse(jsonText);
      const envelopeValidation = validateBatchEnvelope(parsed);
      if (!envelopeValidation.isValid) {
        setErrorMsg(`Envelope validation failed: ${envelopeValidation.errors.join('; ')}`);
        return;
      }

      setErrorMsg(null);
      onImport(parsed as DeliveryBatch);
      setJsonText('');
      onClose();
    } catch (err) {
      setErrorMsg(`Malformed JSON syntax: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <h3 className="modal-title">Custom Batch JSON Import</h3>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>
            Upload or paste an assessment delivery JSON batch conforming to <code>DATA_CONTRACT.md</code>.
          </p>

          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
            />
          </div>

          <textarea
            className="json-textarea"
            placeholder="Paste raw JSON here: { batch_id: '...', revision: 1, records: [...] }"
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setErrorMsg(null);
            }}
          />

          {errorMsg && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(244, 63, 94, 0.15)',
                color: 'var(--accent-rose)',
                borderRadius: '4px',
                fontSize: '0.8rem',
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleValidateAndSubmit}>
            Validate & Import
          </button>
        </div>
      </div>
    </div>
  );
};
