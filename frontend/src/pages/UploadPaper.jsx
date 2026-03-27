import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUpload from '../components/FileUpload';
import Results from '../components/Result';
import '../styles/UploadPaper.css';

function UploadPaper() {
  const [results, setResults] = useState({ groups: [], unique: [] });
  const [previousUploads, setPreviousUploads] = useState([]);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  // Load previously uploaded papers from database
  useEffect(() => {
    loadPreviousUploads();
  }, []);

  const loadPreviousUploads = async () => {
    try {
      setLoadingPrevious(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/uploads`);
      if (res.data && res.data.uploads) {
        setPreviousUploads(res.data.uploads.slice(0, 10)); // Show last 10
      }
    } catch (err) {
      console.warn('Failed to load previous uploads:', err.message);
    } finally {
      setLoadingPrevious(false);
    }
  };

  const reusePreviousAnalysis = (upload) => {
    const analysisData = {
      groups: upload.groups || [],
      unique: upload.unique || [],
      metadata: upload.metadata || {},
      cached: true,
      uploadId: upload._id
    };
    setResults(analysisData);
    localStorage.setItem('lastAnalysis', JSON.stringify(analysisData));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load persisted analysis from localStorage (so navigation doesn't clear results)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lastAnalysis');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.groups || parsed.unique)) {
          setResults({ groups: parsed.groups || [], unique: parsed.unique || [], metadata: parsed.metadata || {} });
        }
      }
    } catch (e) {
      console.warn('Failed to load persisted analysis', e);
    }
  }, []);


  return (
    <div className="upload-paper-container">
      <div className="upload-paper-content">
        <h1 className="upload-title">Upload your File</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Upload multiple exam papers file to analyze and detect repeated questions
        </p>

        {/* Recently Analyzed Papers section removed for deployment simplicity */}

        <FileUpload setResults={setResults} />
        <Results results={results} />
      </div>
    </div>
  );
}

export default UploadPaper;
