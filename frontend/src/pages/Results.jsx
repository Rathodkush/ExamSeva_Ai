import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ResultComponent from '../components/Result';
import '../styles/Results.css';

function Results() {
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadPapers();
  }, []);

  const loadPapers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get('`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/uploads', { headers });
      
      if (response.data && response.data.uploads) {
        // Filter uploads that have analysis data
        const analyzedPapers = response.data.uploads.filter(upload => 
          (upload.groups && upload.groups.length > 0) || 
          (upload.unique && upload.unique.length > 0)
        );
        
        // Transform to the expected format
        const formattedPapers = analyzedPapers.map(upload => ({
          id: upload._id,
          name: upload.files && upload.files.length > 0 ? upload.files[0] : 'Unknown File',
          date: upload.createdAt ? new Date(upload.createdAt).toLocaleDateString() : 'Unknown Date',
          questions: (upload.groups ? upload.groups.reduce((sum, g) => sum + (g.members ? g.members.length : 0), 0) : 0) + 
                    (upload.unique ? upload.unique.length : 0),
          uploadData: upload
        }));
        
        setPapers(formattedPapers);
      }
    } catch (err) {
      console.error('Failed to load papers:', err);
      setError('Failed to load your uploaded papers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getResultsForPaper = (paper) => {
    if (!paper || !paper.uploadData) return { groups: [], unique: [] };
    
    return {
      groups: paper.uploadData.groups || [],
      unique: paper.uploadData.unique || [],
      metadata: paper.uploadData.metadata || {}
    };
  };

  if (loading) {
    return (
      <div className="results-container">
        <h1>Exam Results & Analysis</h1>
        <div style={{ textAlign: 'center', padding: '20px' }}>Loading your uploaded papers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-container">
        <h1>Exam Results & Analysis</h1>
        <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="results-container">
      <h1>Exam Results & Analysis</h1>
      
      <div className="results-content">
        <div className="papers-list">
          <h2>Your Analyzed Papers</h2>
          {papers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No analyzed papers found. Upload some papers on the Upload Paper page to see results here.
            </div>
          ) : (
            papers.map(paper => (
              <div 
                key={paper.id} 
                className={`paper-card ${selectedPaper?.id === paper.id ? 'active' : ''}`}
                onClick={() => setSelectedPaper(paper)}
              >
                <h3>{paper.name}</h3>
                <p>Date: {paper.date}</p>
                <p>Questions: {paper.questions}</p>
              </div>
            ))
          )}
        </div>

        <div className="results-display">
          {selectedPaper ? (
            <div>
              <h2>Analysis for {selectedPaper.name}</h2>
              
              {/* Use the same Result component that's used on UploadPaper page */}
              <div style={{ marginTop: '20px' }}>
                <ResultComponent results={getResultsForPaper(selectedPaper)} />
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a paper from the list to view its analysis results.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Results;


