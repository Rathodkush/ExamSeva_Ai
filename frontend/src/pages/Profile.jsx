import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/Profile.css';

// User Statistics Component
function UserStatistics() {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    papersUploaded: 0,
    quizzesTaken: 0,
    forumPosts: 0,
    averageScore: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStatistics = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !isAuthenticated) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/user/statistics`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data && response.data.success && response.data.statistics) {
        const statsData = response.data.statistics;
        setStats({
          papersUploaded: Number(statsData.papersUploaded) || 0,
          quizzesTaken: Number(statsData.quizzesTaken) || 0,
          forumPosts: Number(statsData.forumPosts) || 0,
          averageScore: Number(statsData.averageScore) || 0
        });
        console.log('Statistics loaded:', response.data.statistics);
      } else {
        console.warn('Statistics response format issue:', response.data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
      // Set default values on error
      setStats({
        papersUploaded: 0,
        quizzesTaken: 0,
        forumPosts: 0,
        averageScore: 0
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatistics();
      // Refresh statistics every 30 seconds
      const interval = setInterval(fetchStatistics, 30000);
      // Listen for global activity events (upload, quiz submit, etc.)
      const handler = () => fetchStatistics();
      window.addEventListener('examseva-activity-updated', handler);
      return () => {
        clearInterval(interval);
        window.removeEventListener('examseva-activity-updated', handler);
      };
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchStatistics]);

  if (loading) {
    return (
      <div className="profile-stats-loading">
        Loading statistics...
      </div>
    );
  }

  return (
    <div className="profile-stats-grid">
      <div className="profile-stat-card">
        <div className="profile-stat-top">
          <span className="profile-stat-icon" aria-hidden="true"></span>
          <h4>Papers Uploaded</h4>
        </div>
        <div className="profile-stat-number">{stats.papersUploaded || 0}</div>
      </div>
      <div className="profile-stat-card">
        <div className="profile-stat-top">
          <span className="profile-stat-icon" aria-hidden="true"></span>
          <h4>Quizzes Taken</h4>
        </div>
        <div className="profile-stat-number">{stats.quizzesTaken || 0}</div>
      </div>
      <div className="profile-stat-card">
        <div className="profile-stat-top">
          <span className="profile-stat-icon" aria-hidden="true"></span>
          <h4>Average Score</h4>
        </div>
        <div className="profile-stat-number">{stats.averageScore || 0}%</div>
      </div>
      <div className="profile-stat-card">
        <div className="profile-stat-top">
          <span className="profile-stat-icon" aria-hidden="true"></span>
          <h4>Forum Posts</h4>
        </div>
        <div className="profile-stat-number">{stats.forumPosts || 0}</div>
      </div>
    </div>
  );
}

function Profile() {
  const { user: authUser, isAuthenticated, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    classStandard: '',
    courseType: '',
    year: '',
    institutionName: '',
    boardName: '',
    state: '',
    semester: '',
    profilePicture: ''
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'stats'

  useEffect(() => {
    if (isAuthenticated && authUser) {
      // Use data from auth context
      setProfileData({
        fullName: authUser.fullName || '',
        email: authUser.email || '',
        phone: authUser.phone || '',
        classStandard: authUser.classStandard || '',
        courseType: authUser.courseType || '',
        year: authUser.year || '',
        institutionName: authUser.institutionName || authUser.university || '',
        boardName: authUser.boardName || '',
        state: authUser.state || '',
        semester: authUser.semester || '',
        profilePicture: authUser.profilePicture || ''
      });
      setLoading(false);
    } else {
      // Fetch user data from API
      const fetchUserData = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            setLoading(false);
            return;
          }

          const response = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          if (response.data.user) {
            const user = response.data.user;
            setProfileData({
              fullName: user.fullName || '',
              email: user.email || '',
              phone: user.phone || '',
              classStandard: user.classStandard || '',
              courseType: user.courseType || '',
              year: user.year || '',
              institutionName: user.institutionName || user.university || '',
              boardName: user.boardName || '',
              state: user.state || '',
              semester: user.semester || '',
              profilePicture: user.profilePicture || ''
            });
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load profile data');
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
    }
  }, [isAuthenticated, authUser]);

  const handleChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to update your profile');
        return;
      }

      const response = await axios.put(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/profile`, profileData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setMessage('Profile updated successfully');
        setIsEditing(false);
        // Update auth context with new user data
        updateUser(response.data.user);
      } else {
        setError(response.data.error || 'Failed to update profile');
      }
    } catch (err) {
      // Handle auth issues
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        // Remove stored token and redirect to login
        localStorage.removeItem('token');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
        return;
      }

      const serverMsg = err.response?.data?.error || err.response?.data?.detail || err.message;
      setError(serverMsg || 'Failed to update profile');
    }
  };

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profilePicture', file);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/profile-picture`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.success) {
        setProfileData(prev => ({ ...prev, profilePicture: res.data.profilePicture }));
        setMessage('Profile picture updated successfully');
        
        // Update auth context and local storage
        if (authUser) {
          const updatedUser = { ...authUser, profilePicture: res.data.profilePicture };
          updateUser(updatedUser);
        }
      }
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setError('Failed to upload profile picture');
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Account</h1>
        <button 
          className="edit-button"
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
        >
          {isEditing ? 'Save Changes' : 'Edit Account'}
        </button>
      </div>

      {error && <div className="error-message" style={{ margin: '20px', padding: '10px', background: '#fee', color: '#c33', borderRadius: '4px' }}>{error}</div>}
      {message && <div className="success-message" style={{ margin: '20px', padding: '10px', background: '#efe', color: '#3c3', borderRadius: '4px' }}>{message}</div>}

      <div className="profile-tabs">
        <button
          type="button"
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        {authUser?.role !== 'admin' && (
          <button
            type="button"
            className={`profile-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Your Statistics
          </button>
        )}
      </div>

      <div className="profile-content">
        {activeTab === 'profile' && (
        <div className="profile-card">
          <div className="profile-avatar">
            <div className="avatar-container">
              {profileData.profilePicture ? (
                <img 
                  src={profileData.profilePicture.startsWith('http') 
                        ? profileData.profilePicture 
                        : `${process.env.REACT_APP_API_URL || "http://localhost:4000"}/${profileData.profilePicture.startsWith('/') ? profileData.profilePicture.substring(1) : profileData.profilePicture}`
                      } 
                  alt="Profile" 
                  className="profile-img" 
                  onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = "https://ui-avatars.com/api/?name=" + (profileData.fullName || 'User') + "&background=6366f1&color=fff";
                  }}
                />
              ) : (
                <div className="avatar-circle">
                  {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              {isEditing && (
                <div className="avatar-edit-overlay">
                  <label htmlFor="profile-pic-input">
                    <span className="camera-icon">📷</span>
                    <input 
                      type="file" 
                      id="profile-pic-input" 
                      onChange={handleProfilePictureUpload} 
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
            <h2>{profileData.fullName || 'User'}</h2>
          </div>

          <div className="profile-details">
            <div className="detail-group">
              <label>Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="fullName"
                  value={profileData.fullName}
                  onChange={handleChange}
                  className="profile-input"
                />
              ) : (
                <p>{profileData.fullName || 'Not set'}</p>
              )}
            </div>

            <div className="detail-group">
              <label>Email</label>
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleChange}
                  className="profile-input"
                  disabled
                />
              ) : (
                <p>{profileData.email || 'Not set'}</p>
              )}
            </div>

            {/* Extra academic fields: hide completely for admin users (not required) */}
            {authUser?.role !== 'admin' && (
              <>
                <div className="detail-group">
                  <label>Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.phone || 'Not set'}</p>
                  )}
                </div>

                <div className="detail-group">
                  <label>Class/Standard</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="classStandard"
                      value={profileData.classStandard}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.classStandard || 'Not set'}</p>
                  )}
                </div>

                <div className="detail-group">
                  <label>Course Type</label>
                  {isEditing ? (
                    <select
                      name="courseType"
                      value={profileData.courseType}
                      onChange={handleChange}
                      className="profile-input"
                    >
                      <option value="">Select Course Type</option>
                      <option value="School">School</option>
                      <option value="High School">High School</option>
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Postgraduate">Postgraduate</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <p>{profileData.courseType || 'Not set'}</p>
                  )}
                </div>

                <div className="detail-group">
                  <label>University / Board</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="institutionName"
                      value={profileData.institutionName}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.institutionName || 'Not set'}</p>
                  )}
                </div>

                <div className="detail-group">
                  <label>State Board</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="boardName"
                      value={profileData.boardName}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.boardName || 'Not set'}</p>
                  )}
                </div>

                <div className="detail-group">
                  <label>State</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="state"
                      value={profileData.state}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.state || 'Not set'}</p>
                  )}
                </div>

                <div className="detail-group">
                  <label>Semester</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="semester"
                      value={profileData.semester}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.semester || 'Not set'}</p>
                  )}
                </div>

                <div className="detail-group">
                  <label>Year</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="year"
                      value={profileData.year}
                      onChange={handleChange}
                      className="profile-input"
                    />
                  ) : (
                    <p>{profileData.year || 'Not set'}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {/* Hide student statistics block for admin users; show in its own tab */}
        {activeTab === 'stats' && authUser?.role !== 'admin' && (
          <div className="stats-section stats-card">
            <h3>Your Statistics</h3>
            <UserStatistics />
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;


