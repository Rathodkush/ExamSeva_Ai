import React from 'react';
import './FilePreviewModal.css';

const FilePreviewModal = ({ isOpen, onClose, fileUrl, fileName, onDownload }) => {
  if (!isOpen) return null;

  const isImage = /\.(jpg|jpeg|png|gif)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="preview-modal-header">
          <h3>Preview: {fileName}</h3>
          <div className="preview-header-actions">
            <button className="preview-download-btn" onClick={onDownload}>Download</button>
            <button className="preview-close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>
        <div className="preview-modal-body">
          {isImage ? (
            <div className="preview-image-container">
              <img src={fileUrl} alt={fileName} />
            </div>
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              title={fileName}
              className="preview-pdf-viewer"
            />
          ) : (
            <div className="preview-unsupported">
              <p>Preview not available for this file type.</p>
              <button onClick={onDownload}>Download to view</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
