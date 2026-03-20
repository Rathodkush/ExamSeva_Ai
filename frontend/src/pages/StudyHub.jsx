import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/StudyHub.css';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

function StudyHub() {
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: '',
    file: null,
    subject: '',
    description: ''
  });
  const [notes, setNotes] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'papers'

  useEffect(() => {
    checkBackendConnection();
    loadNotes();
    if (user && user.fullName) {
      setUploadData(prev => ({ ...prev, name: user.fullName }));
    }
  }, [user]);

  // If StudyHub opened with file/page params, auto-open PDF
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    const page = params.get('page');
    const snippet = params.get('snippet');
    const rects = params.get('rects');
    const question = params.get('question');
    
    if (file) {
      // Navigate to viewer with highlighting parameters
      const viewerParams = new URLSearchParams();
      viewerParams.set('file', file);
      if (page) viewerParams.set('page', page);
      if (rects) viewerParams.set('rects', rects);
      if (question) viewerParams.set('question', question);
      if (snippet) viewerParams.set('snippet', snippet);
      
      // Use replace to avoid adding to history
      window.location.replace(`/viewer?${viewerParams.toString()}`);
    }
  }, []);

  const checkBackendConnection = async () => {
    try {
      await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/health`, { timeout: 3000 });
    } catch (err) {
      console.error('Backend not reachable:', err);
      alert('⚠️ Backend server is not running! Please start the backend server on port 4000.');
    }
  };

  const loadNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Load public notes and official papers
      const [notesRes, papersRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes`, { headers }),
        axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/question-papers`, { headers }).catch(e => ({ data: { papers: [] } }))
      ]);
      
      setNotes(notesRes.data.notes || []);
      setPapers(papersRes.data.papers || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setUploadData({ ...uploadData, file: e.target.files[0] });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.name || !uploadData.file) {
      alert('Please fill in name and select a file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', uploadData.name);
      formData.append('author', user?.fullName || uploadData.name);
      formData.append('authorId', user?._id || user?.id);
      formData.append('role', user?.role || 'student');
      formData.append('subject', uploadData.subject);
      formData.append('description', uploadData.description);
      formData.append('file', uploadData.file);

      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      if (res.data.success) {
        await loadNotes(); // Reload notes from server
        setUploadData({ name: '', file: null, subject: '', description: '' });
        setShowUpload(false);
        alert('Note uploaded successfully!');
      } else {
        throw new Error(res.data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Error uploading note:', err);
      let errorMsg = 'Failed to upload note. ';
      if (err.code === 'ECONNREFUSED' || err.response?.status === 404) {
        errorMsg += 'Backend server is not running. Please start the backend server on port 4000.';
      } else {
        errorMsg += err.response?.data?.detail || err.response?.data?.error || err.message;
      }
      alert(errorMsg);
    }
  };

  const handleDownload = async (noteId) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes/${noteId}/download`, {
        responseType: 'blob'
      });
      
      // Create a blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'note.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) filename = filenameMatch[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading note:', err);
      alert('Failed to download note. File may not exist.');
    }
  };

  const [askLoading, setAskLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState({ open: false, noteId: null });

  const handleDelete = async (noteId, authorId) => {
    const currentUserId = user?._id || user?.id;
    if (authorId !== currentUserId && user?.role !== 'admin') {
      alert('You can only delete your own notes');
      return;
    }

    // Open confirmation dialog with type-to-confirm for strong action
    setConfirmDelete({ open: true, noteId });
  };

  const performDelete = async () => {
    const noteId = confirmDelete.noteId;
    const currentUserId = user?._id || user?.id;
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes/${noteId}?authorId=${currentUserId}`);
      setNotes(notes.filter(note => note._id !== noteId));
      setConfirmDelete({ open: false, noteId: null });
      alert('Note deleted successfully!');
    } catch (err) {
      console.error('Error deleting note:', err);
      setConfirmDelete({ open: false, noteId: null });
      alert('Failed to delete note');
    }
  };


  // Ask AI for answer to a question using this specific note as context
  const handleAsk = async (note) => {
    try {
      const question = window.prompt('Enter your question to search this note (e.g., "Define osmosis")');
      if (!question || question.trim().length === 0) return;
      setAskLoading(true);

      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const payload = { question: question.trim(), subject: note.subject || undefined, noteId: note._id };
      const resp = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/studyhub/search`, payload, { headers, timeout: 30000 });

      const data = resp.data;
      if (!data || !data.success) {
        throw new Error(data?.error || 'Search failed');
      }

      const result = data.result || {};
      if (result.found) {
        const snippet = result.snippet ? decodeURIComponent(encodeURIComponent(result.snippet)) : '';
        // Open PDF viewer in a new tab and pass rects to highlight
        const rects = result.rects || [];
        const viewerUrl = `/viewer?file=${encodeURIComponent(result.filePath)}&page=${result.page || 1}&rects=${encodeURIComponent(JSON.stringify(rects))}`;
        window.open(viewerUrl, '_blank');

        if (snippet) {
          alert(`Answer found on page ${result.page}:\n\n${snippet}`);
        } else {
          alert(`Answer found on page ${result.page}. Opening viewer...`);
        }
      } else {
        // Show friendly message if not found
        const message = result.message || "This question's answer is not available in your Study Hub.";
        alert(message);
      }

    } catch (err) {
      console.error('Error searching note:', err);
      alert(err.response?.data?.detail || err.message || 'Search failed');
    } finally {
      setAskLoading(false);
    }
  };


  return (
    <div className="studyhub-container">
      <div className="page-container">
        <ConfirmModal
          isOpen={confirmDelete.open}
          title={'Delete Note'}
          message={'This will permanently delete the note and its uploaded file. Type DELETE to confirm.'}
          requireText={'DELETE'}
          danger={true}
          confirmText={'Delete Note'}
          onConfirm={performDelete}
          onCancel={() => setConfirmDelete({ open: false, noteId: null })}
        />
        <div className="studyhub-header">
          <div>
            <h1>Study Hub</h1>
            <p className="page-subtitle">Access comprehensive study materials and resources</p>
          </div>
          <div className="upload-controls">
            {(user?.role === 'student' || user?.role === 'admin') && (
              <button onClick={() => setShowUpload(!showUpload)} className="upload-btn">
                {showUpload ? 'Cancel' : '+ Upload Notes'}
              </button>
            )}
          </div>
        </div>

        {showUpload && (
          <div className="upload-section">
            <h2>Upload Study Notes</h2>
            <form onSubmit={handleUpload} className="upload-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Your Name *</label>
                  <input
                    type="text"
                    value={uploadData.name}
                    onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                    placeholder="Enter your name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    value={uploadData.subject}
                    onChange={(e) => setUploadData({ ...uploadData, subject: e.target.value })}
                    placeholder="e.g., Mathematics, Physics"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  placeholder="Brief description of the notes..."
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Upload File *</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.png"
                  required
                />
              </div>
              <button type="submit" className="submit-btn">Upload Notes</button>
            </form>
          </div>
        )}

        <div className="studyhub-tabs">
          <button 
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Study Notes
          </button>
          <button 
            className={`tab-btn ${activeTab === 'papers' ? 'active' : ''}`}
            onClick={() => setActiveTab('papers')}
          >
            Question Papers
          </button>
        </div>

        <div className="studyhub-content">
          {activeTab === 'notes' ? (
            <div className="notes-list">
              <h2>Available Study Notes</h2>
              {loading ? (
                <div className="loading-state">Loading notes...</div>
              ) : (
                <div className="notes-grid">
                  {notes.map(note => (
                    <div key={note._id} className="note-card">
                      <div className="note-header">
                        <span className={`note-badge ${note.role || 'student'}`}>{(note.role || 'student').toUpperCase()}</span>
                        <span className="note-subject-tag">{note.subject || 'General'}</span>
                      </div>
                      <div className="note-body">
                        <h3>{note.name}</h3>
                        <p className="note-author">By: {note.author}</p>
                        <div className="note-description-box">
                          {note.description || 'No description provided'}
                        </div>
                      </div>
                      <div className="note-footer">
                        <span className="note-date">{new Date(note.createdAt).toLocaleDateString()}</span>
                        <div className="note-actions">
                          <button className="download-btn-pill" onClick={() => handleDownload(note._id)}>Download</button>
                          <button className="answer-btn-pill" onClick={() => handleAsk(note)}>ANSWER</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="empty-msg">No notes available yet.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="papers-list">
              <h2 className="section-title">Official Question Papers</h2>
              {loading ? (
                <div className="loading-state">Loading papers...</div>
              ) : (
                <div className="notes-grid">
                  {papers.map(paper => (
                    <div key={paper._id} className="note-card">
                      <div className="note-header">
                        <span className="note-badge free">FREE</span>
                        <span className="note-subject-tag">{paper.subject || 'General'}</span>
                      </div>
                      <div className="note-body">
                        <h3>{paper.title}</h3>
                        <p className="note-author">Official Resource</p>
                      </div>
                      <div className="note-footer">
                        <span className="note-date">{new Date(paper.createdAt).toLocaleDateString()}</span>
                        <div className="note-actions">
                          <button className="download-paper-btn" onClick={() => window.open(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/uploads/${paper.fileName}`, '_blank')}>Download Paper</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {papers.length === 0 && (
                    <p className="empty-msg">No official question papers available yet.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudyHub;
