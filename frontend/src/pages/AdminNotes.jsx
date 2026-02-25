import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/AdminNotes.css';

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
    description: ''
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
      const response = await axios.get('`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/notes');
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
      if (editingNote) {
        await axios.put(
          ``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/admin/notes/${editingNote._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setShowModal(false);
      setEditingNote(null);
      setFormData({ name: '', subject: '', description: '' });
      fetchNotes();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update note');
    }
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setFormData({
      name: note.name || '',
      subject: note.subject || '',
      description: note.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/admin/notes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotes();
    } catch (err) {
      alert('Failed to delete note');
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading notes...</div>;
  }

  return (
    <div className="admin-notes">
      <div className="admin-header">
        <h1>Study Notes Management</h1>
        <Link to="/admin-dashboard" className="back-btn">← Dashboard</Link>
      </div>

      <div className="admin-nav">
        <Link to="/admin-dashboard" className="nav-item">Dashboard</Link>
        <Link to="/admin-users" className="nav-item">Users</Link>
        <Link to="/admin-question-papers" className="nav-item">Question Papers</Link>
        <Link to="/admin-notes" className="nav-item active">Study Notes</Link>
        <Link to="/admin-announcements" className="nav-item">Announcements</Link>
        <Link to="/admin-settings" className="nav-item">Website Settings</Link>
      </div>

      <div className="notes-grid">
        {notes.map(note => (
          <div key={note._id} className="note-card">
            <div className="note-header">
              <h3>{note.name}</h3>
            </div>
            <div className="note-details">
              <p><strong>Subject:</strong> {note.subject || 'General'}</p>
              <p><strong>Author:</strong> {note.author || 'Unknown'}</p>
              <p><strong>File:</strong> {note.fileName}</p>
              <p><strong>Uploaded:</strong> {new Date(note.createdAt).toLocaleDateString()}</p>
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
            <h2>Edit Study Note</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="4"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowModal(false); setEditingNote(null); }} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminNotes;
