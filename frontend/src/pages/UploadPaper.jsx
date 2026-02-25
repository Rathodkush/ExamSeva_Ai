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
      const res = await axios.get('`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/uploads');
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
          console.log('[UploadPaper] Loading persisted analysis:', { groups: parsed.groups?.length || 0, unique: parsed.unique?.length || 0 });
          setResults({ groups: parsed.groups || [], unique: parsed.unique || [], metadata: parsed.metadata || {} });
        }
      }
    } catch (e) {
      console.warn('Failed to load persisted analysis', e);
    }
  }, []);

  // Debug: Log results changes
  useEffect(() => {
    console.log('[UPLOADPAPER] 📍 Results state changed:');
    console.log('   groups:', results.groups);
    console.log('   unique:', results.unique);
    console.log('   Count - groups:', results.groups?.length || 0, 'unique:', results.unique?.length || 0);
    console.log('   Full results:', results);
    
    // Validate data structure
    if (results.unique && Array.isArray(results.unique)) {
      const validUnique = results.unique.filter(q => {
        if (!q) return false;
        const hasText = (typeof q === 'string' && q.trim().length > 0) || 
                        (typeof q === 'object' && q.text && typeof q.text === 'string' && q.text.trim().length > 0);
        return hasText;
      });
      console.log('   Valid unique questions:', validUnique.length, 'out of', results.unique.length);
      if (validUnique.length !== results.unique.length) {
        console.warn('   ⚠️ Some unique questions are invalid or missing text property');
      }
    }
  }, [results]);

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
