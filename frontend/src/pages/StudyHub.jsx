import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FilePreviewModal from '../components/FilePreviewModal';
import '../styles/StudyHub.css';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

function StudyHub() {
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: '',
    files: [],
    subject: '',
    description: ''
  });
  const [preview, setPreview] = useState({
    isOpen: false,
    fileUrl: '',
    fileName: '',
    noteId: '',
    fileIndex: null,
    isPaper: false
  });
  const [notes, setNotes] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'papers'
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, noteId: null });
  const [askLoading, setAskLoading] = useState(false);

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
    const rects = params.get('rects');
    const question = params.get('question');
    const snippet = params.get('snippet');
    
    if (file) {
      const viewerParams = new URLSearchParams();
      viewerParams.set('file', file);
      if (page) viewerParams.set('page', page);
      if (rects) viewerParams.set('rects', rects);
      if (question) viewerParams.set('question', question);
      if (snippet) viewerParams.set('snippet', snippet);
      window.location.replace(`/viewer?${viewerParams.toString()}`);
    }
  }, []);

  const checkBackendConnection = async () => {
    try {
      await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/health`, { timeout: 3000 });
    } catch (err) {
      console.error('Backend not reachable:', err);
    }
  };

  const loadNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [notesRes, papersRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes`, { headers }),
        axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/question-papers`, { headers }).catch(() => ({ data: { papers: [] } }))
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
    setUploadData({ ...uploadData, files: Array.from(e.target.files) });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.name || uploadData.files.length === 0) {
      alert('Please fill in name and select at least one file');
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
      uploadData.files.forEach(file => formData.append('files', file));

      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      if (res.data.success) {
        await loadNotes();
        setUploadData({ ...uploadData, files: [], subject: '', description: '' });
        setShowUpload(false);
        alert('Notes uploaded successfully!');
      } else {
        throw new Error(res.data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Error uploading note:', err);
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDownload = async (noteId, fileIndex = 0) => {
    try {
      const note = notes.find(n => n._id === noteId);
      if (!note) return;
      
      // Force backend download via proxy to avoid browser-to-cloud connection issues
      const downloadPath = note.files && note.files.length > 0 
        ? `${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes/${noteId}/files/${fileIndex}/download`
        : `${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes/${noteId}/download`;

      window.open(downloadPath, '_blank');
    } catch (err) {
      alert('Failed to download note.');
    }
  };

  const handlePaperDownload = (paperId) => {
    try {
      const paper = papers.find(p => p._id === paperId);
      if (!paper) return;
      
      // Use backend path (our server will proxy Cloudinary URLs automatically)
      const finalUrl = `${process.env.REACT_APP_API_URL || "http://localhost:4000"}/uploads/${paper.fileName}`;
      
      window.open(finalUrl, '_blank');
    } catch (err) {
      alert('Failed to open paper.');
    }
  };

  const handleDelete = (noteId, authorId) => {
    const currentUserId = user?._id || user?.id;
    if (authorId !== currentUserId && user?.role !== 'admin') {
      alert('Only owners or admins can delete notes.');
      return;
    }
    setConfirmDelete({ open: true, noteId });
  };

  const performDelete = async () => {
    const id = confirmDelete.noteId;
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes/${id}?authorId=${user?._id || user?.id}`);
      setNotes(notes.filter(n => n._id !== id));
      setConfirmDelete({ open: false, noteId: null });
      alert('Note deleted.');
    } catch (err) {
      alert('Delete failed.');
    }
  };

  const handleAsk = async (note) => {
    const question = window.prompt("Enter your question about this note:");
    if (!question) return;
    try {
      setAskLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/studyhub/search`, 
        { question, subject: note.subject, noteId: note._id }, { headers });
      
      const r = res.data.result;
      if (r && r.found) {
        const viewerUrl = `/viewer?file=${encodeURIComponent(r.filePath)}&page=${r.page || 1}&rects=${encodeURIComponent(JSON.stringify(r.rects || []))}`;
        window.open(viewerUrl, '_blank');
        if (r.snippet) alert(`Found on page ${r.page}:\n\n${r.snippet}`);
      } else {
        alert(r?.message || "Not found in this note.");
      }
    } catch (err) {
      alert("AI Search failed.");
    } finally {
      setAskLoading(false);
    }
  };

  const filteredNotes = notes.filter(n => (n.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) || (n.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPapers = papers.filter(p => (p.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      <div className="studyhub-container">
        {/* File Preview Modal Removed as per user request */}
        <div className="page-container">
          <ConfirmModal
            isOpen={confirmDelete.open}
            title="Delete Note"
            message="This action cannot be undone. Type DELETE to confirm."
            requireText="DELETE"
            onConfirm={performDelete}
            onCancel={() => setConfirmDelete({ open: false, noteId: null })}
            danger={true}
          />

          <div className="studyhub-header">
            <div>
              <h1>Study Hub</h1>
              <p className="page-subtitle">Access comprehensive study materials</p>
            </div>
            <div className="header-actions">
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="search-input" 
              />
              {(user?.role === 'student' || user?.role === 'admin') && (
                <button className="upload-btn" onClick={() => setShowUpload(!showUpload)}>
                  {showUpload ? 'Cancel' : '+ Share Notes'}
                </button>
              )}
            </div>
          </div>

          {showUpload && (
            <div className="upload-modal-backdrop" onClick={() => setShowUpload(false)}>
              <div className="upload-modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={() => setShowUpload(false)}>&times;</button>
                <h2>Upload Study Notes</h2>
                <form onSubmit={handleUpload} className="upload-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Your Name *</label>
                      <input type="text" value={uploadData.name} onChange={e => setUploadData({ ...uploadData, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Subject</label>
                      <input type="text" value={uploadData.subject} onChange={e => setUploadData({ ...uploadData, subject: e.target.value })} placeholder="e.g. Physics" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={uploadData.description} onChange={e => setUploadData({ ...uploadData, description: e.target.value })} rows="3" />
                  </div>
                  <div className="form-group">
                    <label>Select Files *</label>
                    <input type="file" onChange={handleFileChange} multiple required accept=".pdf,.jpg,.jpeg,.png" />
                    <div className="selected-files-list">
                      {uploadData.files.map((f, i) => <div key={i} className="selected-file-item">✓ {f.name}</div>)}
                    </div>
                  </div>
                  <button type="submit" className="submit-btn" disabled={askLoading}>Upload Now</button>
                </form>
              </div>
            </div>
          )}

          <div className="studyhub-tabs">
            <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Study Notes</button>
            <button className={`tab-btn ${activeTab === 'papers' ? 'active' : ''}`} onClick={() => setActiveTab('papers')}>Official Papers</button>
          </div>

          <div className="studyhub-content">
            {activeTab === 'notes' ? (
              <div className="notes-grid">
                {filteredNotes.length === 0 && !loading && <div className="empty-msg">No notes found.</div>}
                {filteredNotes.map(note => (
                  <div key={note._id} className="note-card">
                    <div className="note-header">
                      <span className={`note-badge ${note.role || 'student'}`}>{(note.role || 'student').toUpperCase()}</span>
                      <span className="note-subject-tag">{note.subject || 'General'}</span>
                      {(note.authorId === user?._id || user?.role === 'admin') && (
                        <button className="delete-note-btn" onClick={() => handleDelete(note._id, note.authorId)}>×</button>
                      )}
                    </div>
                    <div className="note-body">
                      <h3>{note.name}</h3>
                      <p className="note-author">By: {note.author}</p>
                      {note.description && (
                        <div className="note-description-box">
                          {note.description}
                        </div>
                      )}
                      
                      {note.files && note.files.length > 0 && (
                        <div className="note-files-list">
                          <p className="files-count-label">{note.files.length} file(s) attached:</p>
                          {note.files.map((f, i) => (
                            <div key={i} className="note-file-link" onClick={() => handleDownload(note._id, i)}>
                              <div className="file-info">
                                <span className="file-icon">{f.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                <span className="file-name">{f.name}</span>
                              </div>
                              <span className="view-badge">View</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="note-footer">
                      <span className="note-date">{new Date(note.createdAt).toLocaleDateString()}</span>
                      <div className="note-actions">
                        {(!note.files || note.files.length <= 1) && (
                          <button className="download-btn-pill" onClick={() => handleDownload(note._id, 0)}>
                            View / Download
                          </button>
                        )}
                        <button className="answer-btn-pill" onClick={() => handleAsk(note)}>ANSWER</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notes-grid">
                {filteredPapers.length === 0 && !loading && <div className="empty-msg">No papers found.</div>}
                {filteredPapers.map(paper => (
                  <div key={paper._id} className="note-card paper-card">
                    <div className="note-header">
                      <span className="note-badge official">OFFICIAL</span>
                      <span className="note-subject-tag">{paper.subject || 'Exams'}</span>
                    </div>
                    <div className="note-body">
                      <h3>{paper.title}</h3>
                      <p className="note-author">Authorized Resource</p>
                    </div>
                    <div className="note-footer">
                      <span className="note-date">{new Date(paper.createdAt).toLocaleDateString()}</span>
                      <div className="note-actions">
                        <button className="download-btn-pill" onClick={() => handlePaperDownload(paper._id)}>View / Download</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default StudyHub;
