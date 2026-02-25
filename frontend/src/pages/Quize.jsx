import React, { useState } from 'react';
import axios from 'axios';
import '../styles/Quize.css';

function Quize() {
  const [uploadData, setUploadData] = useState({
    file: null,
    subject: '',
    numberOfQuestions: 10,
    difficultyOrder: 'low-to-high',
    autoGenerateOnUpload: true,
    // Advanced question paper options
    includeMarks: true,
    marksPerQuestion: 1,
    timeLimit: '', // minutes
    sectionsByDifficulty: true,
    shuffleQuestions: false,
    // Show options (A,B,C) in question paper. Default false to produce questions-only paper.
    includeOptions: false
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);

  // Preview extracted questions before generating paper
  const [previewQuestions, setPreviewQuestions] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const generateQuizWithFile = async (file) => {
    if (!file) {
      alert('Please select a file to generate quiz');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject', uploadData.subject || 'General');
      formData.append('numberOfQuestions', uploadData.numberOfQuestions);
      formData.append('difficultyOrder', uploadData.difficultyOrder || 'low-to-high');

      // Include user profile hints when available (will be used in PDF header)
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        if (stored.institutionName) formData.append('institutionName', stored.institutionName);
        if (stored.state) formData.append('state', stored.state);
        if (stored.semester) formData.append('semester', stored.semester);
        if (stored.year) formData.append('year', stored.year);
      } catch (e) {
        // ignore
      }

      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'multipart/form-data' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await axios.post('http://localhost:4000/api/quiz/generate', formData, {
        headers: headers,
        timeout: 180000 // 3 minutes
      });

      if (res.data.success && res.data.quiz) {
        if (!res.data.quiz.questions || res.data.quiz.questions.length === 0) {
          alert('Quiz generation succeeded but produced no questions. Try using a clearer/scanned file.');
          setGeneratedQuiz(null);
          setAnswers({});
          setSubmitted(false);
          setResults(null);
        } else {
          setGeneratedQuiz(res.data.quiz);
          setAnswers({});
          setSubmitted(false);
          setResults(null);
          alert('Quiz generated successfully!');
        }
      } else {
        throw new Error(res.data.error || 'Quiz generation failed');
      }
    } catch (err) {
      console.error('Error generating quiz:', err);
      let errorMsg = 'Failed to generate quiz. ';
      if (err.code === 'ECONNREFUSED' || err.response?.status === 404) {
        errorMsg += 'Backend server is not running. Please start the backend server on port 4000.';
      } else {
        errorMsg += err.response?.data?.detail || err.response?.data?.error || err.message;
      }
      alert(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    setUploadData(prev => ({ ...prev, file: f }));
    if (f && uploadData.autoGenerateOnUpload) {
      // Auto-generate immediately after upload (as requested)
      generateQuizWithFile(f);
    }
  };

  const handleGenerateQuiz = async (e) => {
    e.preventDefault();
    await generateQuizWithFile(uploadData.file);
  };

  const handleAnswerChange = (questionId, answerIndex) => {
    setAnswers({ ...answers, [questionId]: answerIndex });
  };

  const downloadBlob = (data, filename, mime='application/pdf') => {
    const blob = new Blob([data], { type: mime });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadQuizPdf = async () => {
    if (!uploadData.file) return alert('Please select the source file first (same file used to generate quiz).');
    const form = new FormData();
    form.append('file', uploadData.file);
    form.append('numberOfQuestions', uploadData.numberOfQuestions);
    form.append('difficultyOrder', uploadData.difficultyOrder || 'low-to-high');

    if (uploadData.subject) form.append('subject', uploadData.subject);
    // add profile hints
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      if (stored.institutionName) form.append('institutionName', stored.institutionName);
      if (stored.state) form.append('state', stored.state);
      if (stored.semester) form.append('semester', stored.semester);
      if (stored.year) form.append('year', stored.year);
    } catch (e) {}

    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'multipart/form-data' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await axios.post('http://localhost:4000/api/quiz/generate_pdf', form, { headers, responseType: 'arraybuffer', timeout: 180000 });
      // If server returns an empty/small PDF, show a clear message instead of downloading a blank file
      const dataLen = (res.data && (res.data.byteLength || res.data.length)) || 0;
      if (dataLen < 1000) {
        alert('No questions were generated from this file. Try using a clearer/scanned file.');
        return;
      }
      const disposition = res.headers['content-disposition'];
      let filename = 'quiz.pdf';
      if (disposition) {
        const match = /filename="?([^";]+)"?/.exec(disposition);
        if (match) filename = match[1];
      } else if (uploadData.subject) {
        filename = `${uploadData.subject.replace(/[\\/:*?"<>|]/g,'')}_quiz.pdf`;
      }
      downloadBlob(res.data, filename, res.headers['content-type'] || 'application/pdf');
    } catch (err) {
      console.error('Download quiz PDF error:', err);
      if (err.response && err.response.data && err.response.data.error) {
        alert(err.response.data.error);
      } else {
        alert('Failed to download quiz PDF: ' + (err.message || err));
      }
    }
  };

 

  const handleSubmitQuiz = async () => {
    if (!generatedQuiz || !generatedQuiz.questions) return;
    
    let correct = 0;
    let wrong = 0;
    const questionResults = generatedQuiz.questions.map((q, idx) => {
      const userAnswer = answers[q._id || idx];
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) correct++;
      else wrong++;
      return {
        question: q.question,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        options: q.options
      };
    });

    const total = generatedQuiz.questions.length;
    const score = correct;
    const percentage = Math.round((correct / total) * 100);

    setResults({
      correct,
      wrong,
      total,
      percentage,
      questionResults
    });
    setSubmitted(true);

    // Save quiz score if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await axios.post('http://localhost:4000/api/quiz/score', {
          quizId: generatedQuiz._id || null,
          score: correct,
          totalQuestions: total
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        // Notify other parts of the app (e.g. statistics widget) that activity changed
        try {
          window.dispatchEvent(new Event('examseva-activity-updated'));
        } catch (e) {
          // ignore
        }
      } catch (err) {
        console.error('Error saving quiz score:', err);
        // Don't show error to user, just log it
      }
    }
  };

  return (
    <div className="quize-container">
      <div className="page-container">
        <h1>Quiz Generator</h1>
        <p className="page-subtitle">Upload e-books, PDFs, Word docs, or images to generate interactive quizzes</p>
        
        <div className="quiz-upload-section">
          <h2>Generate Quiz from Material</h2>

          <form onSubmit={(e) => { e.preventDefault(); handleGenerateQuiz(e); }} className="quiz-upload-form">
            <div className="form-row">
              <div className="form-group">
                <label>Subject/Topic</label>
                <input
                  type="text"
                  value={uploadData.subject}
                  onChange={(e) => setUploadData({ ...uploadData, subject: e.target.value })}
                  placeholder="e.g., Mathematics, Science"
                />
              </div>
              <div className="form-group">
                <label>Number of Questions</label>
                <select
                  value={uploadData.numberOfQuestions}
                  onChange={(e) => setUploadData({ ...uploadData, numberOfQuestions: parseInt(e.target.value) })}
                >
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions</option>
                  <option value={20}>20 Questions</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Order by difficulty</label>
                <select
                  value={uploadData.difficultyOrder}
                  onChange={(e) => setUploadData({ ...uploadData, difficultyOrder: e.target.value })}
                >
                  <option value="low-to-high">Low → High (Easy to Hard)</option>
                  <option value="high-to-low">High → Low (Hard to Easy)</option>
                  <option value="mixed">Mixed / Balanced</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Tip: Use Preview to check extracted questions before generating the quiz.
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Upload Material *</label>
              <div className="file-upload-area">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.epub,.mobi,.jpg,.jpeg,.png,.doc,.docx"
                  required
                  id="quiz-file-input"
                />
                <label htmlFor="quiz-file-input" className="file-upload-label">
                  {uploadData.file ? uploadData.file.name : 'Choose e-book, PDF, image, or Word file'}
                </label>
              </div>
              <p className="file-hint">Supported: PDF, e-books (EPUB, MOBI), Images (JPG, PNG), Word documents (DOC, DOCX)</p>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={uploadData.autoGenerateOnUpload}
                    onChange={(e) => setUploadData({ ...uploadData, autoGenerateOnUpload: e.target.checked })}
                  />
                  Auto-generate quiz immediately after upload
                </label>
              </div>
            </div>
            <div className="advanced-options">
              <div style={{ marginTop: 10 }}>
                <label><input type="checkbox" checked={uploadData.includeOptions} onChange={(e) => setUploadData({ ...uploadData, includeOptions: e.target.checked })} /> Include options (A, B, C) in generated content</label>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  Include options in quiz questions when available.
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <button type="button" className="mode-btn" onClick={async () => {
                  // Preview questions
                  setIsPreviewing(true);
                  setPreviewError(null);
                  setPreviewQuestions(null);
                  try {
                    const form = new FormData();
                    form.append('file', uploadData.file);
                    form.append('numberOfQuestions', uploadData.numberOfQuestions);
                    form.append('includeOptions', uploadData.includeOptions ? 'true' : 'false');
                    form.append('difficultyOrder', uploadData.difficultyOrder);
                    if (uploadData.subject) form.append('subject', uploadData.subject);

                    const token = localStorage.getItem('token');
                    const headers = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const resp = await axios.post('http://localhost:4000/api/quiz/extract-questions', form, { headers, timeout: 180000 });
                    if (resp.data && resp.data.questions) {
                      setPreviewQuestions(resp.data.questions.slice(0, 50));
                    } else {
                      setPreviewError('No questions returned');
                    }
                  } catch (err) {
                    console.error('Preview error', err);
                    if (err.response && err.response.data && err.response.data.error) setPreviewError(err.response.data.error)
                    else setPreviewError(err.message || 'Failed to get preview');
                  } finally {
                    setIsPreviewing(false);
                  }
                }}>Preview Questions</button>
              </div>

              {isPreviewing && <div style={{ marginTop: 10 }}>Generating preview...</div>}
              {previewError && <div style={{ marginTop: 10, color: 'red' }}>{previewError}</div>}
              {previewQuestions && (
                <div style={{ marginTop: 12, maxHeight: 300, overflow: 'auto', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e6e9ff' }}>
                  <h4>Preview (first {previewQuestions.length} extracted questions)</h4>
                  <ol>
                    {previewQuestions.map((q, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600 }}>{q.text}</div>
                        {uploadData.includeOptions && q.options && q.options.length > 0 && (
                          <ul style={{ marginTop: 6 }}>
                            {q.options.map((opt, idx) => <li key={idx}>{opt}</li>)}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

            </div>

            <button type="submit" className="generate-btn" disabled={isGenerating}>
              {isGenerating ? 'Generating Quiz...' : 'Generate Quiz'}
            </button>  
          </form>
        </div>

        {generatedQuiz && (
          <div className="generated-quiz-section">
            <h2>Generated Quiz: {generatedQuiz.subject}</h2>
            {generatedQuiz.metadata && (
              <div className="quiz-metadata">
                {generatedQuiz.metadata.institutionName && <div><strong>Institution:</strong> {generatedQuiz.metadata.institutionName}</div>}
                {generatedQuiz.metadata.state && <div><strong>State:</strong> {generatedQuiz.metadata.state}</div>}
                {generatedQuiz.metadata.semester && <div><strong>Semester:</strong> {generatedQuiz.metadata.semester}</div>}
                {generatedQuiz.metadata.year && <div><strong>Year:</strong> {generatedQuiz.metadata.year}</div>}
                {generatedQuiz.metadata.difficultyOrder && <div><strong>Difficulty:</strong> {generatedQuiz.metadata.difficultyOrder}</div>}

              </div>
            )}

            {!submitted ? (
              <>
                <div className="quiz-questions">
                  {generatedQuiz.questions.map((q, idx) => (
                    <div key={q._id || idx} className="quiz-question-card">
                      <div className="question-number">Question {idx + 1}</div>
                      <div className="question-text">{q.question}</div>
                      <div className="question-options">
                        {q.options.map((opt, optIdx) => (
                          <label 
                            key={optIdx} 
                            className={`option-label ${answers[q._id || idx] === optIdx ? 'selected' : ''}`}
                          >
                            <input 
                              type="radio" 
                              name={`question-${q._id || idx}`} 
                              value={optIdx}
                              checked={answers[q._id || idx] === optIdx}
                              onChange={() => handleAnswerChange(q._id || idx, optIdx)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="quiz-actions">
                  <button 
                    className="submit-quiz-btn" 
                    onClick={handleSubmitQuiz}
                    disabled={generatedQuiz.questions.length === 0 || Object.keys(answers).length === 0}
                  >
                    Submit Quiz
                  </button>

                  <button className="download-pdf-btn" onClick={async () => {
                    try {
                      await downloadQuizPdf();
                    } catch (e) {
                      alert('Failed to download PDF: ' + (e.message || e));
                    }
                  }}>
                    Download Quiz (PDF)
                  </button>



                  <button className="reset-quiz-btn" onClick={() => {
                    setGeneratedQuiz(null);
                    setAnswers({});
                    setSubmitted(false);
                    setResults(null);
                  }}>
                    Generate New Quiz
                  </button>
                </div>
              </>
            ) : (
              <div className="quiz-results">
                <div className="results-summary">
                  <h3>Quiz Results</h3>
                  <div className="results-stats">
                    <div className="stat-card correct">
                      <div className="stat-number">{results.correct}</div>
                      <div className="stat-label">Correct</div>
                    </div>
                    <div className="stat-card wrong">
                      <div className="stat-number">{results.wrong}</div>
                      <div className="stat-label">Wrong</div>
                    </div>
                    <div className="stat-card total">
                      <div className="stat-number">{results.total}</div>
                      <div className="stat-label">Total</div>
                    </div>
                    <div className="stat-card percentage">
                      <div className="stat-number">{results.percentage || Math.round((results.correct / results.total) * 100)}%</div>
                      <div className="stat-label">Score</div>
                    </div>
                  </div>
                </div>
                
                <div className="detailed-results">
                  <h3>Detailed Results</h3>
                  {results.questionResults.map((result, idx) => (
                    <div key={idx} className={`result-item ${result.isCorrect ? 'correct' : 'wrong'}`}>
                      <div className="result-question">
                        <strong>Question {idx + 1}:</strong> {result.question}
                      </div>
                      <div className="result-answer">
                        <span className={result.isCorrect ? 'correct-answer' : 'wrong-answer'}>
                          Your Answer: {result.options[result.userAnswer] || 'Not answered'}
                        </span>
                        {!result.isCorrect && (
                          <span className="correct-answer">
                            Correct Answer: {result.options[result.correctAnswer]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="quiz-actions">
                  <button className="reset-quiz-btn" onClick={() => {
                    setGeneratedQuiz(null);
                    setAnswers({});
                    setSubmitted(false);
                    setResults(null);
                  }}>
                    Generate New Quiz
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!generatedQuiz && (
          <div className="quiz-info-section">
            <div className="info-card">
              <h3>How It Works</h3>
              <p>Upload your study material and our AI will automatically generate quiz questions based on the content.</p>
            </div>
            <div className="info-card">
              <h3>Track Progress</h3>
              <p>Monitor your performance and improve over time with detailed analytics.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Quize;