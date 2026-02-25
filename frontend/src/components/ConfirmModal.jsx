import React, { useState, useEffect } from 'react';
import '../styles/ConfirmModal.css';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm',
  message = 'Are you sure?',
  requireText = null, // if set, user must type this text (case-insensitive) to enable confirm
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm = () => {},
  onCancel = () => {}
}) {
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!isOpen) setInput('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isAllowed = requireText ? (input.trim().toLowerCase() === requireText.trim().toLowerCase()) : true;

  return (
    <div className="confirm-modal-backdrop" onMouseDown={onCancel}>
      <div className="confirm-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={`confirm-modal-header ${danger ? 'danger' : ''}`}>
          <h3>{title}</h3>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
          {requireText && (
            <div className="confirm-input-row">
              <label>Type <strong>{requireText}</strong> to confirm</label>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Type ${requireText}`} />
            </div>
          )}
        </div>
        <div className="confirm-modal-actions">
          <button className="confirm-cancel" onClick={onCancel}>{cancelText}</button>
          <button className={`confirm-ok ${danger ? 'danger' : ''}`} disabled={!isAllowed} onClick={() => onConfirm()}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
