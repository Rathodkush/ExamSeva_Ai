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

      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/quiz/generate`, formData, {
        headers: headers,
        timeout: 300000 // 5 minutes (300k ms)
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
      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/quiz/generate_pdf`, form, { 
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }, 
        responseType: 'arraybuffer', 
        timeout: 300000 // 5 minutes
      });
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
        await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/quiz/score`, {
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
        <h1 className="page-title">Quiz Generator</h1>
        <p className="page-subtitle">Upload e-books, PDFs, Word docs, or images to generate interactive quizzes</p>
        
        <div className="quiz-upload-section">
          <h2 className="section-title">Generate Quiz from Material</h2>

          <div className="quiz-upload-form">
            <div className="form-group">
              <label>Upload Material *</label>
              <div className="file-upload-area">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.epub,.mobi,.jpg,.jpeg,.png,.doc,.docx"
                  id="quiz-file-input"
                />
                <label htmlFor="quiz-file-input" className="file-upload-label">
                  {uploadData.file ? uploadData.file.name : 'Choose e-book, PDF, image, or Word file'}
                </label>
              </div>
              <p className="file-hint">Supported: PDF, e-books (EPUB, MOBI), Images (JPG, PNG), Word documents (DOC, DOCX)</p>
            </div>

            <button 
              className="generate-btn-purple" 
              onClick={handleGenerateQuiz} 
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating Quiz...' : 'Generate Quiz'}
            </button>  
          </div>
        </div>

        {generatedQuiz && (
          <div className="generated-quiz-section">
            <div className="quiz-header-row">
              <h2>Generated Quiz: {generatedQuiz.subject}</h2>
              <div className="quiz-actions-small">
                <button className="download-small-btn" onClick={downloadQuizPdf}>Download PDF</button>
                <button className="reset-small-btn" onClick={() => {
                   setGeneratedQuiz(null);
                   setAnswers({});
                   setSubmitted(false);
                   setResults(null);
                }}>New Quiz</button>
              </div>
            </div>

            {!submitted ? (
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
                <button className="submit-quiz-btn" onClick={handleSubmitQuiz}>Submit Quiz</button>
              </div>
            ) : (
              <div className="quiz-results">
                <div className="results-summary">
                  <h3>Quiz Results: {results.percentage}%</h3>
                  <div className="results-stats-row">
                    <span>Correct: {results.correct}</span>
                    <span>Wrong: {results.wrong}</span>
                    <span>Total: {results.total}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="quiz-footer-grid">
          <div className="footer-info-box">
            <h4>Fast & Accurate</h4>
            <p>Wait just a few seconds and get a customized quiz based strictly on your documents.</p>
          </div>
          <div className="footer-info-box">
            <h4>Practice Anywhere</h4>
            <p>Take quizzes online or download them as PDF for offline study sessions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Quize;
