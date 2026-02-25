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
    } catch (e) {}
  }, []);

  const handleFileChange = (e) => {
    setFormData({ ...formData, file: e.target.files[0] });
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
      } catch (e) {}

      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'multipart/form-data' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await axios.post('http://localhost:4000/api/quiz/generate_paper', fd, { headers, responseType: 'arraybuffer', timeout: 180000 });

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
        filename = `${formData.subject.replace(/[\\/:*?"<>|]/g,'')}_question_paper.pdf`;
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
        <h1>Question Paper Generator</h1>
        <p className="page-subtitle">Upload your notes and generate a professionally formatted question paper PDF.</p>

        <div className="quiz-upload-section">
          <h2>Generate Question Paper from Notes</h2>
          <div className="quiz-upload-form">
            <div className="form-row">
              <div className="form-group">
                <label>Subject/Topic</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Mathematics, Biology"
                />
              </div>
              <div className="form-group">
                <label>Number of Questions</label>
                <select
                  value={formData.numberOfQuestions}
                  onChange={(e) => setFormData({ ...formData, numberOfQuestions: parseInt(e.target.value) })}
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
                  value={formData.difficultyOrder}
                  onChange={(e) => setFormData({ ...formData, difficultyOrder: e.target.value })}
                >
                  <option value="low-to-high">Low → High (Easy to Hard)</option>
                  <option value="high-to-low">High → Low (Hard to Easy)</option>
                  <option value="mixed">Mixed / Balanced</option>
                </select>
              </div>

              <div className="form-group">
                <label>Mode</label>
                <select value={formData.mode} onChange={(e) => setFormData({ ...formData, mode: e.target.value })}>
                  <option value="school">School (Class 1-12)</option>
                  <option value="university">University</option>
                </select>
              </div>

              <div className="form-group">
                <label>Class Level (if School)</label>
                <select value={formData.classLevel} onChange={(e) => setFormData({ ...formData, classLevel: e.target.value })}>
                  {Array.from({ length: 12 }, (_, i) => (i + 1)).map(n => (
                    <option key={n} value={String(n)}>{`Class ${n}`}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Template</label>
                <select
                  value={formData.paperTemplate}
                  onChange={(e) => {
                    const tpl = e.target.value;
                    if (tpl === 'school_class8_science_50') {
                      setFormData(f => ({
                        ...f,
                        paperTemplate: tpl,
                        mode: 'school',
                        classLevel: '8',
                        totalMarks: '50',
                        examDuration: '2 Hours',
                        includeAnswerKey: true,
                        includeMarkingScheme: true
                      }));
                      return;
                    }
                    if (tpl === 'university_dbms_70') {
                      setFormData(f => ({
                        ...f,
                        paperTemplate: tpl,
                        mode: 'university',
                        totalMarks: '70',
                        examDuration: '3 Hours',
                        includeAnswerKey: true,
                        includeMarkingScheme: true
                      }));
                      return;
                    }
                    if (tpl === 'university_os_70') {
                      setFormData(f => ({
                        ...f,
                        paperTemplate: tpl,
                        mode: 'university',
                        totalMarks: '70',
                        examDuration: '3 Hours',
                        includeAnswerKey: true,
                        includeMarkingScheme: true
                      }));
                      return;
                    }
                    setFormData(f => ({ ...f, paperTemplate: 'auto' }));
                  }}
                >
                  <option value="auto">Auto (current format)</option>
                  <option value="school_class8_science_50">School: Class 8 Science (50 marks)</option>
                  <option value="university_dbms_70">University: DBMS (70 marks)</option>
                  <option value="university_os_70">University: Operating System (70 marks)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Total Marks (optional)</label>
                <input
                  type="number"
                  value={formData.totalMarks}
                  onChange={(e) => setFormData({ ...formData, totalMarks: e.target.value })}
                  placeholder="e.g., 50"
                />
              </div>

              <div className="form-group">
                <label>Exam Duration (optional)</label>
                <input
                  type="text"
                  value={formData.examDuration}
                  onChange={(e) => setFormData({ ...formData, examDuration: e.target.value })}
                  placeholder="e.g., 3 Hours"
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={formData.includeAnswerKey}
                    onChange={(e) => setFormData({ ...formData, includeAnswerKey: e.target.checked })}
                  />
                  Include Answer Key
                </label>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={formData.includeMarkingScheme}
                    onChange={(e) => setFormData({ ...formData, includeMarkingScheme: e.target.checked })}
                  />
                  Include Marking Scheme
                </label>
              </div>
            </div>

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

              <div style={{ marginTop: 8 }}>
                <button
                  className="detect-btn"
                  onClick={async () => {
                    if (!formData.file) return alert('Please upload a file first');
                    try {
                      const f = new FormData();
                      f.append('file', formData.file);
                      const token = localStorage.getItem('token');
                      const headers = {};
                      if (token) headers['Authorization'] = `Bearer ${token}`;
                      const resp = await axios.post('http://localhost:4000/api/exam/detect', f, { headers, timeout: 120000 });
                      if (resp.data && resp.data.detected) {
                        const d = resp.data.detected;
                        if (d.mode) setFormData(f => ({ ...f, mode: d.mode }));
                        if (d.classLevel) setFormData(f => ({ ...f, classLevel: String(d.classLevel) }));
                        alert('Auto-detection completed');
                      } else {
                        alert('Auto-detection did not return results');
                      }
                    } catch (err) {
                      console.error('Auto-detect failed:', err);
                      let msg = 'Auto-detection failed.';
                      if (err.code === 'ECONNREFUSED' || err.response?.status === 404) {
                        msg += ' The backend/Python service may not be running (127.0.0.1:5000).';
                      }
                      const detail = err.response?.data?.error || err.message;
                      if (detail) msg += ' Detail: ' + detail;
                      alert(msg);
                    }
                  }}
                  disabled={!formData.file}
                >
                  Auto-detect Class/Mode from Notes
                </button>
              </div>
            </div>

            <button className="generate-btn" onClick={generateAndDownload} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate & Download Question Paper (PDF)'}
            </button>
          </div>
        </div>

        <div className="quiz-info-section">
          <div className="info-card">
            <h3>What this does</h3>
            <p>Parses your notes, identifies key concepts and important questions, and arranges them into a printable question paper PDF with metadata header.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuestionPaper;
