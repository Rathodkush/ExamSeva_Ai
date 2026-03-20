import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/AdminSettings.css';
import '../styles/AdminShared.css';

function AdminSettings() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    websiteName: 'ExamSeva',
    logoUrl: '',
    contactEmail: '',
    contactPhone: '',
    contactAddress: '',
    aboutUs: '',
    footerLinks: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin-login');
      return;
    }
    fetchSettings();
  }, [isAuthenticated, user]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.settings) {
        setSettings({
          websiteName: response.data.settings.websiteName || 'ExamSeva',
          logoUrl: response.data.settings.logoUrl || '',
          contactEmail: response.data.settings.contactEmail || '',
          contactPhone: response.data.settings.contactPhone || '',
          contactAddress: response.data.settings.contactAddress || '',
          aboutUs: response.data.settings.aboutUs || '',
          footerLinks: response.data.settings.footerLinks || []
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/admin/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Settings saved successfully!');
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/admin/change-password`, passwordData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Password changed successfully!');
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to change password');
    }
  };

  const addFooterLink = () => {
    setSettings({
      ...settings,
      footerLinks: [...settings.footerLinks, { title: '', url: '' }]
    });
  };

  const updateFooterLink = (index, field, value) => {
    const newLinks = [...settings.footerLinks];
    newLinks[index][field] = value;
    setSettings({ ...settings, footerLinks: newLinks });
  };

  const removeFooterLink = (index) => {
    const newLinks = settings.footerLinks.filter((_, i) => i !== index);
    setSettings({ ...settings, footerLinks: newLinks });
  };

  if (loading) {
    return <div className="admin-loading">Loading settings...</div>;
  }

  return (
    <div className="admin-page-container">
      <div className="admin-header-flex">
        <h1>Website Settings</h1>
        <div className="admin-header-actions">
          <button onClick={() => setShowPasswordModal(true)} className="admin-btn btn-yellow">Change Password</button>
          <Link to="/admin-dashboard" className="admin-btn btn-grey">← Dashboard</Link>
        </div>
      </div>

      <nav className="admin-secondary-nav">
        <Link to="/admin-dashboard" className="nav-item-link">Dashboard</Link>
        <Link to="/admin-users" className="nav-item-link">Users</Link>
        <Link to="/admin-question-papers" className="nav-item-link">Question Papers</Link>
        <Link to="/admin-notes" className="nav-item-link">Study Notes</Link>
        <Link to="/admin-announcements" className="nav-item-link">Announcements</Link>
        <Link to="/admin-settings" className="nav-item-link active">Website Settings</Link>
      </nav>

      <div className="settings-content">
        <div className="settings-section">
          <h2>Basic Information</h2>
          <div className="form-group">
            <label>Website Name</label>
            <input
              type="text"
              value={settings.websiteName}
              onChange={(e) => setSettings({ ...settings, websiteName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Logo URL</label>
            <input
              type="text"
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        <div className="settings-section">
          <h2>Contact Information</h2>
          <div className="form-group">
            <label>Contact Email</label>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Contact Phone</label>
            <input
              type="text"
              value={settings.contactPhone}
              onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Contact Address</label>
            <textarea
              value={settings.contactAddress}
              onChange={(e) => setSettings({ ...settings, contactAddress: e.target.value })}
              rows="3"
            />
          </div>
        </div>

        <div className="settings-section">
          <h2>About Us</h2>
          <div className="form-group">
            <label>About Us Content</label>
            <textarea
              value={settings.aboutUs}
              onChange={(e) => setSettings({ ...settings, aboutUs: e.target.value })}
              rows="8"
              placeholder="Enter the About Us content that will be displayed on the website..."
            />
          </div>
        </div>

        <div className="settings-section">
          <h2>Footer Links</h2>
          {settings.footerLinks.map((link, index) => (
            <div key={index} className="footer-link-item">
              <input
                type="text"
                placeholder="Link Title"
                value={link.title}
                onChange={(e) => updateFooterLink(index, 'title', e.target.value)}
              />
              <input
                type="text"
                placeholder="Link URL"
                value={link.url}
                onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
              />
              <button onClick={() => removeFooterLink(index)} className="remove-btn">Remove</button>
            </div>
          ))}
          <button onClick={addFooterLink} className="add-link-btn">+ Add Footer Link</button>
        </div>

        <div className="settings-actions">
          <button onClick={handleSave} className="save-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Change Password</h2>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength="6"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  minLength="6"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Change Password</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSettings;
