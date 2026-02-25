import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Header.css';
import axios from 'axios';
import { io } from 'socket.io-client';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showServicesDropdown, setShowServicesDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    window.location.reload();
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!isAuthenticated || !user || !token) return;

    let socket;

    const fetchNotifications = async () => {
      try {
        const res = await axios.get('http://localhost:4000/api/notifications', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data.notifications || []);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchNotifications();

    try {
      socket = io('http://localhost:4000', { auth: { token } });
      socket.emit('join', user._id);

      const upsertNotification = (payload) => {
        // payload should contain fields like { _id, title, body, read }
        setNotifications(prev => [payload, ...prev]);
      };

      socket.on('forum_post', upsertNotification);
      socket.on('forum_reply', upsertNotification);
      socket.on('new_message', upsertNotification);
    } catch (err) {
      console.error('Socket connection error', err);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [isAuthenticated, user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleDropdown = () => setShowDropdown(s => !s);

  const markAsRead = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.patch(`http://localhost:4000/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>ExamSeva</h1>
          </Link>
        </div>
        <nav className="nav-menu">
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/uploadpaper" className="nav-link">Upload Paper</Link>
          {isAuthenticated && user?.role === 'student' && (
            <>
              <div className="dropdown">
                <button
                  className="nav-link dropdown-btn"
                  onClick={() => setShowServicesDropdown(!showServicesDropdown)}
                >
                  Services ▼
                </button>
                {showServicesDropdown && (
                  <div className="dropdown-menu">
                    <Link to="/studyhub" className="dropdown-item" onClick={() => setShowServicesDropdown(false)}>Study Hub</Link>
                    <Link to="/quize" className="dropdown-item" onClick={() => setShowServicesDropdown(false)}>Quiz</Link>
                    <Link to="/question-paper" className="dropdown-item" onClick={() => setShowServicesDropdown(false)}>Question Paper</Link>
                    <Link to="/forum" className="dropdown-item" onClick={() => setShowServicesDropdown(false)}>Forum</Link>
                  </div>
                )}
              </div>
              <Link to="/profile" className="nav-link">Profile</Link>
            </>
          )}
          {isAuthenticated && user?.role === 'admin' && (
            <>
              <Link to="/admin-dashboard" className="nav-link admin-link">Admin Panel</Link>
              <Link to="/profile" className="nav-link">Profile</Link>
            </>
          )}
          <Link to="/contact" className="nav-link">Contact</Link>
          {isAuthenticated ? (
            <>
              <div className="notification-bell">
                <button onClick={toggleDropdown} className="bell-btn">🔔{unreadCount > 0 && (
                  <span className="badge">{unreadCount}</span>
                )}</button>
                {showDropdown && (
                  <div className="notif-dropdown">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n._id} className={`notif-item ${n.read ? 'read' : ''}`}>
                          <div className="notif-title">{n.title || n.body}</div>
                          <div className="notif-actions">
                            {!n.read && <button onClick={() => markAsRead(n._id)}>Mark read</button>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <span className="nav-link user-name">Hello, {user?.fullName || 'User'}</span>
              <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link register-btn">Sign Up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;