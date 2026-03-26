import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ResultComponent from '../components/Result';
import '../styles/Results.css';

function Results() {
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [papers, setPapers] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' | 'quizzes'
  
  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [uploadsRes, quizzesRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/uploads`, { headers }),
        axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/quiz/my-scores`, { headers }).catch(() => ({ data: { success: false } }))
      ]);
      
      if (uploadsRes.data && uploadsRes.data.uploads) {
        const analyzedPapers = uploadsRes.data.uploads.filter(upload => 
          (upload.groups && upload.groups.length > 0) || 
          (upload.unique && upload.unique.length > 0)
        );
        
        const formattedPapers = analyzedPapers.map(upload => ({
          id: upload._id,
          name: upload.files && upload.files.length > 0 ? upload.files[0] : (upload.metadata?.course || 'Analyzed Paper'),
          date: upload.createdAt ? new Date(upload.createdAt).toLocaleDateString() : 'Unknown Date',
          questions: (upload.groups ? upload.groups.reduce((sum, g) => sum + (g.members ? g.members.length : 0), 0) : 0) + 
                    (upload.unique ? upload.unique.length : 0),
          uploadData: upload
        }));
        setPapers(formattedPapers);
      }

      if (quizzesRes.data && quizzesRes.data.success) {
        setQuizzes(quizzesRes.data.scores || []);
      }
    } catch (err) {
      console.error('Failed to load results:', err);
      setError('Failed to load your results. Please try again.');
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

      <div className="results-tabs">
        <button 
          className={`results-tab ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Paper Analysis
        </button>
        <button 
          className={`results-tab ${activeTab === 'quizzes' ? 'active' : ''}`}
          onClick={() => setActiveTab('quizzes')}
        >
          Quiz Results
        </button>
      </div>
      
      <div className="results-content">
        {activeTab === 'analysis' ? (
          <>
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
          </>
        ) : (
          <div className="scores-list full-width">
            <h2>Your Quiz Scores</h2>
            {quizzes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                No quiz scores found. Take some quizzes on the Quiz Generator page to see your results here.
              </div>
            ) : (
              <div className="scores-grid">
                {quizzes.map((quiz, idx) => (
                  <div key={quiz._id || idx} className="score-card">
                    <div className="score-header">
                      <h3>{quiz.quizId?.subject || 'General Quiz'}</h3>
                      <span className="score-date">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="score-body">
                      <div className="score-main">
                        <span className="score-number">{quiz.score}</span>
                        <span className="score-total">/ {quiz.totalQuestions}</span>
                      </div>
                      <div className="score-percentage-bar">
                        <div className="score-fill" style={{ width: `${quiz.percentage}%` }}></div>
                      </div>
                      <div className="score-footer">
                        <span>{quiz.percentage}% Accuracy</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Results;


