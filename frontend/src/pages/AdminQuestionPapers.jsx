import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/AdminQuestionPapers.css';

function AdminQuestionPapers() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPaper, setEditingPaper] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    classLevel: '',
    examType: '',
    visibility: 'free',
    file: null
  });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin-login');
      return;
    }
    fetchPapers();
    
    // Auto-refresh papers list every 15 seconds for real-time updates
    const interval = setInterval(() => {
      fetchPapers();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const fetchPapers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:4000/api/admin/question-papers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPapers(response.data.papers || []);
    } catch (err) {
      console.error('Error fetching papers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('classLevel', formData.classLevel);
      formDataToSend.append('examType', formData.examType);
      formDataToSend.append('visibility', formData.visibility);
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }

      if (editingPaper) {
        await axios.put(
          `http://localhost:4000/api/admin/question-papers/${editingPaper._id}`,
          {
            title: formData.title,
            subject: formData.subject,
            classLevel: formData.classLevel,
            examType: formData.examType,
            visibility: formData.visibility
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post('http://localhost:4000/api/admin/question-papers', formDataToSend, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
      }
      
      setShowModal(false);
      setEditingPaper(null);
      setFormData({ title: '', subject: '', classLevel: '', examType: '', visibility: 'free', file: null });
      fetchPapers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save paper');
    }
  };

  const handleEdit = (paper) => {
    setEditingPaper(paper);
    setFormData({
      title: paper.title,
      subject: paper.subject,
      classLevel: paper.classLevel || '',
      examType: paper.examType || '',
      visibility: paper.visibility,
      file: null
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question paper?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:4000/api/admin/question-papers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPapers();
    } catch (err) {
      alert('Failed to delete paper');
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading papers...</div>;
  }

  return (
    <div className="admin-question-papers">
      <div className="admin-header">
        <h1>Question Paper Management</h1>
        <div className="header-actions">
          <button onClick={() => { setEditingPaper(null); setFormData({ title: '', subject: '', classLevel: '', examType: '', visibility: 'free', file: null }); setShowModal(true); }} className="add-btn">
            + Add Paper
          </button>
          <Link to="/admin-dashboard" className="back-btn">← Dashboard</Link>
        </div>
      </div>

      <div className="admin-nav">
        <Link to="/admin-dashboard" className="nav-item">Dashboard</Link>
        <Link to="/admin-users" className="nav-item">Users</Link>
        <Link to="/admin-question-papers" className="nav-item active">Question Papers</Link>
        <Link to="/admin-notes" className="nav-item">Study Notes</Link>
        <Link to="/admin-announcements" className="nav-item">Announcements</Link>
        <Link to="/admin-settings" className="nav-item">Website Settings</Link>
      </div>

      <div className="papers-grid">
        {papers.map(paper => (
          <div key={paper._id} className="paper-card">
            <div className="paper-header">
              <h3>{paper.title}</h3>
              <span className={`visibility-badge ${paper.visibility}`}>{paper.visibility}</span>
            </div>
            <div className="paper-details">
              <p><strong>Subject:</strong> {paper.subject}</p>
              {paper.classLevel && <p><strong>Class:</strong> {paper.classLevel}</p>}
              {paper.examType && <p><strong>Exam Type:</strong> {paper.examType}</p>}
              <p><strong>File:</strong> {paper.fileName}</p>
              <p><strong>Uploaded:</strong> {new Date(paper.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="paper-actions">
              <button onClick={() => handleEdit(paper)} className="edit-btn">Edit</button>
              <button onClick={() => handleDelete(paper._id)} className="delete-btn">Delete</button>
            </div>
          </div>
        ))}
        {papers.length === 0 && (
          <div className="empty-state">No question papers yet. Click "Add Paper" to upload one.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingPaper(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPaper ? 'Edit Question Paper' : 'Add Question Paper'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
              <div className="form-row">
                <div className="form-group">
                  <label>Class Level</label>
                  <input
                    type="text"
                    value={formData.classLevel}
                    onChange={(e) => setFormData({ ...formData, classLevel: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Exam Type</label>
                  <input
                    type="text"
                    value={formData.examType}
                    onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Visibility *</label>
                <select
                  value={formData.visibility}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                  required
                >
                  <option value="free">Free Access</option>
                  <option value="login">Login Required</option>
                </select>
              </div>
              {!editingPaper && (
                <div className="form-group">
                  <label>File (PDF/Image) *</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                    required={!editingPaper}
                  />
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowModal(false); setEditingPaper(null); }} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminQuestionPapers;
