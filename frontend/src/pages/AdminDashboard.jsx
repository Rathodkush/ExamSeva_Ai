import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/AdminDashboard.css';
import '../styles/AdminShared.css';

function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/admin-login');
      return;
    }
    fetchDashboardData();

    // Auto-refresh dashboard data every 10 seconds to show real-time updates
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const baseApi = process.env.REACT_APP_API_URL || ""; // Default to relative
      
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Fetch both generic and analytics data
      const [genericResp, statsResp] = await Promise.all([
        axios.get(`${baseApi}/api/admin/dashboard`, config),
        axios.get(`${baseApi}/api/admin/stats-overview`, config)
      ]);
      
      setStats({
        ...genericResp.data,
        analytics: statsResp.data?.stats || {}
      });
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      // If error occurs, still try to use whatever data we might have had
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading dashboard...</div>;
  }

  return (
    <div className="admin-page-container">
      <div className="admin-header-flex">
        <h1>Admin Dashboard</h1>
        <div className="admin-header-actions">
          <Link to="/profile" className="admin-btn btn-grey">Profile</Link>
          <Link to="/admin-settings" className="admin-btn btn-yellow">Settings</Link>
        </div>
      </div>

      <nav className="admin-secondary-nav">
        <Link to="/admin-dashboard" className="nav-item-link active">Dashboard</Link>
        <Link to="/admin-users" className="nav-item-link">Users</Link>
        <Link to="/admin-question-papers" className="nav-item-link">Question Papers</Link>
        <Link to="/admin-notes" className="nav-item-link">Study Notes</Link>
        <Link to="/admin-announcements" className="nav-item-link">Announcements</Link>
        <Link to="/admin-settings" className="nav-item-link">Website Settings</Link>
      </nav>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-content">
            <h3>{stats?.statistics?.totalUsers || 0}</h3>
            <p>Total Users</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-content">
            <h3>{stats?.statistics?.totalPapers || 0}</h3>
            <p>Question Papers</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-content">
            <h3>{stats?.statistics?.totalNotes || 0}</h3>
            <p>Study Notes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-content">
            <h3>{stats?.statistics?.totalAnnouncements || 0}</h3>
            <p>Announcements</p>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
          <div className="stat-icon"></div>
          <div className="stat-content">
            <h3>{stats?.analytics?.totalLifetimeLogins || 0}</h3>
            <p>Total Logins</p>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div className="stat-icon"></div>
          <div className="stat-content">
            <h3>{stats?.analytics?.todayUniqueVisitors || 0}</h3>
            <p>Today's Traffic</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h2>Recent Users</h2>
          <div className="recent-list">
            {stats?.recentUsers?.length > 0 ? (
              stats.recentUsers.map(user => (
                <div key={user._id} className="recent-item">
                  <div>
                    <strong>{user.fullName}</strong>
                    <span className="user-email">{user.email}</span>
                    <div style={{fontSize: '11px', color: '#666', marginTop: '2px'}}>
                      {user.lastLogin ? `Last Login: ${new Date(user.lastLogin).toLocaleString()}` : 'Never logged in'}
                    </div>
                  </div>
                  <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-state">No users yet</p>
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Recent Question Papers</h2>
          <div className="recent-list">
            {stats?.recentPapers?.length > 0 ? (
              stats.recentPapers.map(paper => (
                <div key={paper._id} className="recent-item">
                  <div>
                    <strong>{paper.title}</strong>
                    <span className="paper-subject">{paper.subject}</span>
                  </div>
                  <span className={`visibility-badge ${paper.visibility}`}>
                    {paper.visibility}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-state">No papers yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
