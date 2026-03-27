import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Header from '../components/Header';
import FilePreviewModal from '../components/FilePreviewModal';
import '../styles/AdminNotes.css';
import '../styles/AdminShared.css';

function AdminNotes() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    description: '',
    files: []
  });
  const [preview, setPreview] = useState({
    isOpen: false,
    fileUrl: '',
    fileName: '',
    noteId: '',
    fileIndex: null
  });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin-login');
      return;
    }
    fetchNotes();

    // Auto-refresh notes list every 15 seconds for real-time updates
    const interval = setInterval(() => {
      fetchNotes();
    }, 15000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/notes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotes(response.data.notes || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const uploadFormData = new FormData();
      if (editingNote) {
        await axios.put(
          `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/notes/${editingNote._id}`,
          {
            name: formData.name,
            subject: formData.subject,
            description: formData.description
          },
          { headers }
        );
      } else {
        uploadFormData.append('name', formData.name);
        uploadFormData.append('subject', formData.subject);
        uploadFormData.append('description', formData.description);
        if (formData.files && formData.files.length > 0) {
          formData.files.forEach(f => uploadFormData.append('files', f));
        } else {
          alert('Please select at least one file to upload');
          return;
        }

        await axios.post(
          `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/notes`,
          uploadFormData,
          { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
        );
      }
      setShowModal(false);
      setEditingNote(null);
      setFormData({ name: '', subject: '', description: '', files: [] });
      fetchNotes();
      alert(editingNote ? 'Note updated successfully' : 'Notes uploaded successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setFormData({
      name: note.name || '',
      subject: note.subject || '',
      description: note.description || '',
      files: []
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingNote(null);
    setFormData({
      name: '',
      subject: '',
      description: '',
      files: []
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/notes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotes();
    } catch (err) {
      alert('Failed to delete note');
    }
  };

  const handleDownload = async (noteId, fileIndex = null, forceDownload = false) => {
    try {
      const note = notes.find(n => n._id === noteId);
      if (!note) return;
      const fileName = fileIndex !== null ? note.files[fileIndex]?.name : note.fileName;
      const isPreviewable = /\.(pdf|jpg|jpeg|png)$/i.test(fileName);

      if (isPreviewable && !forceDownload) {
        const viewUrl = fileIndex !== null
          ? `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/notes/${noteId}/files/${fileIndex}/view`
          : `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/notes/${noteId}/view`;

        setPreview({
          isOpen: true,
          fileUrl: viewUrl,
          fileName,
          noteId,
          fileIndex
        });
        return;
      }

      const urlPath = fileIndex !== null
        ? `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/notes/${noteId}/files/${fileIndex}/download`
        : `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/notes/${noteId}/download`;

      const response = await axios.get(urlPath, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

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
      console.error('Download error:', err);
      alert('Failed to download file');
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading notes...</div>;
  }

  return (
    <div className="admin-page-container">
      <FilePreviewModal
        isOpen={preview.isOpen}
        onClose={() => setPreview({ ...preview, isOpen: false })}
        fileUrl={preview.fileUrl}
        fileName={preview.fileName}
        onDownload={() => handleDownload(preview.noteId, preview.fileIndex, true)}
      />
      <div className="admin-header-flex">
        <h1>Study Notes Management</h1>
        <div className="admin-header-actions">
          <button onClick={handleAddNew} className="admin-btn btn-primary">+ Upload New Note</button>
          <Link to="/admin-dashboard" className="admin-btn btn-grey">← Dashboard</Link>
        </div>
      </div>

      <nav className="admin-secondary-nav">
        <Link to="/admin-dashboard" className="nav-item-link">Dashboard</Link>
        <Link to="/admin-users" className="nav-item-link">Users</Link>
        <Link to="/admin-question-papers" className="nav-item-link">Question Papers</Link>
        <Link to="/admin-notes" className="nav-item-link active">Study Notes</Link>
        <Link to="/admin-announcements" className="nav-item-link">Announcements</Link>
        <Link to="/admin-settings" className="nav-item-link">Website Settings</Link>
      </nav>

      <div className="notes-grid">
        {notes.map(note => (
          <div key={note._id} className="note-card">
            <div className="note-header">
              <h3>{note.name}</h3>
            </div>
            <div className="note-details">
              <p><strong>Subject:</strong> {note.subject || 'General'}</p>
              <p><strong>Author:</strong> {note.author || 'Unknown'}</p>
              <p><strong>Uploaded:</strong> {new Date(note.createdAt).toLocaleDateString()}</p>

              {note.files && note.files.length > 0 && (
                <div className="admin-files-list">
                  <p className="admin-files-label">Uploaded Files ({note.files.length}):</p>
                  <ul className="admin-files-ul">
                    {note.files.map((file, idx) => (
                      <li key={idx} className="admin-file-li" onClick={() => handleDownload(note._id, idx)}>
                        {file.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'} {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!note.files && <p><strong>File:</strong> {note.fileName}</p>}

              {note.description && (
                <p className="note-description">{note.description}</p>
              )}
            </div>
            <div className="note-actions">
              <button onClick={() => handleEdit(note)} className="edit-btn">Edit</button>
              <button onClick={() => handleDelete(note._id)} className="delete-btn">Delete</button>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="empty-state">No study notes yet.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingNote(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingNote ? 'Edit Study Note' : 'Upload New Note'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name (Short Title) *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mathematics Unit 1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Physics"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief context about this note..."
                  rows="3"
                />
              </div>
              {!editingNote && (
                <div className="form-group">
                  <label>Select Files (Multiple allowed) *</label>
                  <input
                    type="file"
                    onChange={(e) => setFormData({ ...formData, files: Array.from(e.target.files) })}
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    multiple
                    required
                  />
                  {formData.files.length > 0 && (
                    <div className="admin-selected-files-preview">
                      {formData.files.map((f, i) => <div key={i}>✓ {f.name}</div>)}
                    </div>
                  )}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowModal(false); setEditingNote(null); }} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">{editingNote ? 'Save Changes' : 'Upload Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminNotes;
