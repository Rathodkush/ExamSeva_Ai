import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/AdminAnnouncements.css';
import '../styles/AdminShared.css';

const isDev = process.env.NODE_ENV === 'development';
const debug = (...args) => { if (isDev) console.log(...args); };

function AdminAnnouncements() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general',
    isVisible: true
  });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin-login');
      return;
    }
    fetchAnnouncements();

    // Auto-refresh announcements list every 15 seconds for real-time updates
    const interval = setInterval(() => {
      fetchAnnouncements();
    }, 15000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnnouncements(response.data.announcements || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('You must be logged in to save announcements');
        return;
      }

      // Prepare data
      const dataToSend = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type || 'general',
        isVisible: formData.isVisible !== false && formData.isVisible !== 'false'
      };

      debug('Saving announcement:', dataToSend);

      let response;
      if (editingAnnouncement) {
        response = await axios.put(
          `${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/announcements/${editingAnnouncement._id}`,
          dataToSend,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        response = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/announcements`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (response.data && response.data.success) {
        setShowModal(false);
        setEditingAnnouncement(null);
        setFormData({ title: '', content: '', type: 'general', isVisible: true });
        fetchAnnouncements();
        alert(editingAnnouncement ? 'Announcement updated successfully!' : 'Announcement created successfully!');
      } else {
        throw new Error(response.data?.error || 'Failed to save announcement');
      }
    } catch (err) {
      console.error('Announcement save error:', err);
      let errorMsg = 'Failed to save announcement';
      if (err.response) {
        errorMsg = err.response.data?.error || err.response.data?.detail || errorMsg;
        if (err.response.status === 401 || err.response.status === 403) {
          errorMsg = 'You do not have permission to save announcements. Please log in as admin.';
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      alert(errorMsg);
    }
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      isVisible: announcement.isVisible
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_API_URL || "http://localhost:  4001"}/api/admin/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAnnouncements();
    } catch (err) {
      alert('Failed to delete announcement');
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading announcements...</div>;
  }

  return (
    <div className="admin-page-container">
      <div className="admin-header-flex">
        <h1>Announcements Management</h1>
        <div className="admin-header-actions">
          <button onClick={() => { setEditingAnnouncement(null); setFormData({ title: '', content: '', type: 'general', isVisible: true }); setShowModal(true); }} className="admin-btn btn-green">
            + Add Announcement
          </button>
          <Link to="/admin-dashboard" className="admin-btn btn-grey">← Dashboard</Link>
        </div>
      </div>

      <nav className="admin-secondary-nav">
        <Link to="/admin-dashboard" className="nav-item-link">Dashboard</Link>
        <Link to="/admin-users" className="nav-item-link">Users</Link>
        <Link to="/admin-question-papers" className="nav-item-link">Question Papers</Link>
        <Link to="/admin-notes" className="nav-item-link">Study Notes</Link>
        <Link to="/admin-announcements" className="nav-item-link active">Announcements</Link>
        <Link to="/admin-settings" className="nav-item-link">Website Settings</Link>
      </nav>

      <div className="announcements-list">
        {announcements.map(announcement => (
          <div key={announcement._id} className="announcement-card">
            <div className="announcement-header">
              <div>
                <h3>{announcement.title}</h3>
                <div className="announcement-meta">
                  <span className={`type-badge ${announcement.type}`}>{announcement.type}</span>
                  <span className={`visibility-badge ${announcement.isVisible ? 'visible' : 'hidden'}`}>
                    {announcement.isVisible ? 'Visible' : 'Hidden'}
                  </span>
                </div>
              </div>
            </div>
            <div className="announcement-content">
              <p>{announcement.content}</p>
              <p className="announcement-date">
                Created: {new Date(announcement.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="announcement-actions">
              <button onClick={() => handleEdit(announcement)} className="edit-btn">Edit</button>
              <button onClick={() => handleDelete(announcement._id)} className="delete-btn">Delete</button>
            </div>
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="empty-state">No announcements yet. Click "Add Announcement" to create one.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingAnnouncement(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingAnnouncement ? 'Edit Announcement' : 'Add Announcement'}</h2>
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
                <label>Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows="6"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    <option value="general">General</option>
                    <option value="exam_update">Exam Update</option>
                    <option value="result_notice">Result Notice</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Visibility</label>
                  <select
                    value={formData.isVisible ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, isVisible: e.target.value === 'true' })}
                  >
                    <option value="true">Visible</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowModal(false); setEditingAnnouncement(null); }} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAnnouncements;
