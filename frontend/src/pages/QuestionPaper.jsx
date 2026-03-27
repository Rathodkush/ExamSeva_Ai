import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Quize.css';

function QuestionPaper() {
  const [formData, setFormData] = useState({
    file: null,
    subject: '',
    numberOfQuestions: 10,
    difficultyOrder: 'low-to-high', // options: low-to-high, high-to-low, mixed
    // Manual mode selection (school or university) and class level for school mode
    mode: 'school', // 'school' or 'university'
    classLevel: '10', // default class (1-12) as string
    // Templates / formatting
    paperTemplate: 'auto', // auto | school_class8_science_50 | university_dbms_70 | university_os_70
    totalMarks: '',
    examDuration: '',
    includeAnswerKey: true,
    includeMarkingScheme: true
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Prefill subject from profile if available
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      if (stored.subject && !formData.subject) {
        setFormData(f => ({ ...f, subject: stored.subject }));
      }
    } catch (e) { }
  }, []);

  const handleFileChange = (e) => {
    setFormData({ ...formData, file: e.target.files[0] });
  };

  const downloadBlob = (data, filename, mime = 'application/pdf') => {
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

  const generateAndDownload = async () => {
    if (!formData.file) return alert('Please select a file (notes or study material) to generate the question paper.');

    setIsGenerating(true);
    try {
      const fd = new FormData();
      fd.append('file', formData.file);
      fd.append('numberOfQuestions', formData.numberOfQuestions);
      fd.append('difficultyOrder', formData.difficultyOrder);
      // Manual selection: mode and class
      fd.append('mode', formData.mode);
      if (formData.mode === 'school') fd.append('classLevel', formData.classLevel);
      if (formData.subject) fd.append('subject', formData.subject);
      if (formData.paperTemplate && formData.paperTemplate !== 'auto') fd.append('paperTemplate', formData.paperTemplate);
      if (formData.totalMarks) fd.append('totalMarks', String(formData.totalMarks));
      if (formData.examDuration) fd.append('examDuration', String(formData.examDuration));
      fd.append('includeAnswerKey', formData.includeAnswerKey ? 'true' : 'false');
      fd.append('includeMarkingScheme', formData.includeMarkingScheme ? 'true' : 'false');

      // Add profile hints if present
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        if (stored.institutionName) fd.append('institutionName', stored.institutionName);
        if (stored.state) fd.append('state', stored.state);
        if (stored.semester) fd.append('semester', stored.semester);
        if (stored.year) fd.append('year', stored.year);
      } catch (e) { }

      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'multipart/form-data' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/quiz/generate_paper`, fd, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'arraybuffer',
        timeout: 300000 // 5 minutes 
      });

      // Treat very small responses as empty / no-results (likely OCR failed or no questions produced)
      const dataLen = (res.data && (res.data.byteLength || res.data.length)) || 0;
      if (dataLen < 1000) {
        alert('No questions were generated from this file. Try using a clearer/scanned file or check that the Python service is running.');
        return;
      }

      const disposition = res.headers['content-disposition'];
      let filename = 'question_paper.pdf';
      if (disposition) {
        const match = /filename="?([^";]+)"?/.exec(disposition);
        if (match) filename = match[1];
      } else if (formData.subject) {
        filename = `${formData.subject.replace(/[\\/:*?"<>|]/g, '')}_question_paper.pdf`;
      }

      downloadBlob(res.data, filename, res.headers['content-type'] || 'application/pdf');
    } catch (err) {
      console.error('Failed to generate question paper:', err);
      let message = 'Failed to generate question paper.';
      const detail = err.response?.data?.error || err.message;
      if (detail) message += ' ' + detail;
      if (err.code === 'ECONNREFUSED' || err.response?.status === 404) {
        message += ' The backend/Python service may not be running (127.0.0.1:5000).';
      }
      message += ' Try again after starting the backend and Python services, or try a clearer/scanned file.';
      alert(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="quize-container">
      <div className="page-container">
        <h1 className="page-title">Question Paper Generator</h1>
        <p className="page-subtitle">Upload your notes and generate a professionally formatted question paper PDF automatically.</p>

        <div className="quiz-upload-section">
          <h2 className="section-title">Generate Question Paper from Notes</h2>
          <div className="quiz-upload-form">
            <div className="form-group">
              <label>Upload Notes / Study Material *</label>
              <div className="file-upload-area">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.epub,.jpg,.jpeg,.png"
                  id="question-paper-file-input"
                />
                <label htmlFor="question-paper-file-input" className="file-upload-label">
                  {formData.file ? formData.file.name : 'Choose notes or study material'}
                </label>
              </div>
              <p className="file-hint">Supported: PDF, DOCX, EPUB, Images (JPG/PNG)</p>
            </div>

            <button className="generate-btn-primary" onClick={generateAndDownload} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Question Paper (PDF)'}
            </button>
          </div>
        </div>

        <div className="how-it-works">
          <h3>How it works</h3>
          <ol>
            <li>
              <strong>Upload your study material</strong>
              <p>(PDF, Images, etc.)</p>
            </li>
            <li>
              <strong>We automatically detect the Subject, Class, and Mode.</strong>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default QuestionPaper;
