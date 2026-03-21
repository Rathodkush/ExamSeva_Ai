import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import '../styles/Header.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import { showPersistentToast } from '../utils/toast';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showServicesDropdown, setShowServicesDropdown] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (e) { }
    showPersistentToast('Logout Successful! See you again.');
    localStorage.removeItem('lastAnalysis');
    logout();
    navigate('/login');
    window.location.reload();
  };

  // Auto-remove toasts after 3 seconds
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  // Listen for global toast events
  useEffect(() => {
    const handleToastEvent = (e) => {
      const msg = e.detail;
      if (msg) {
        setToasts(prev => [...prev, { id: Date.now(), message: msg }]);
      }
    };
    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, []);

  // Check for persistent toasts on mount
  useEffect(() => {
    const pending = localStorage.getItem('pending_toast');
    if (pending) {
      setTimeout(() => {
        setToasts(prev => [...prev, { id: Date.now(), message: pending }]);
        localStorage.removeItem('pending_toast');
      }, 500); // Small delay to ensure header is fully visible
    }
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!isAuthenticated || !user || !token) return;

    let socket;

    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data.notifications || []);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchNotifications();

    try {
      socket = io(process.env.REACT_APP_API_URL || "http://localhost:4000", { 
        auth: { token },
        transports: ['websocket']
      });
      socket.emit('join', (user?._id || user?.id)?.toString());

      const upsertNotification = (payload) => {
        setNotifications(prev => [payload, ...prev]);
        // Add to floating toasts
        setToasts(prev => [...prev, { id: Date.now(), message: payload.message }]);
      };

      socket.on('forum_post', upsertNotification);
      socket.on('forum_reply', upsertNotification);
      socket.on('new_message', upsertNotification);
      socket.on('new_notification', upsertNotification);
    } catch (err) {
      console.error('Socket connection error', err);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [isAuthenticated, user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const toggleDropdown = () => setShowDropdown(s => !s);

  const markAsRead = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.patch(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo" style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img 
              src={settings.logoUrl || "/favicon.png"} 
              alt="ExamSeva Logo" 
              style={{ 
                height: '38px', 
                width: 'auto', 
                borderRadius: '4px',
                display: 'block'
              }} 
            />
            <h1 style={{ 
              margin: 0, 
              fontSize: '24px', 
              color: 'white', 
              fontWeight: '700',
              lineHeight: '1'
            }}>{settings.websiteName}</h1>
          </Link>
        </div>

        <div className="hamburger" onClick={toggleMenu}>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <nav className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          <Link to="/about" className="nav-link" onClick={() => setIsMenuOpen(false)}>About</Link>
          <Link to="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>Home</Link>
          {isAuthenticated && user?.role === 'admin' && (
            <Link to="/admin-dashboard" className="nav-link admin-panel-btn" onClick={() => setIsMenuOpen(false)}>Admin Panel</Link>
          )}
          {user?.role !== 'admin' && (
            <Link to="/uploadpaper" className="nav-link" onClick={() => setIsMenuOpen(false)}>Upload Paper</Link>
          )}
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
                    <Link to="/studyhub" className="dropdown-item" onClick={() => {setShowServicesDropdown(false); setIsMenuOpen(false);}}>Study Hub</Link>
                    <Link to="/quize" className="dropdown-item" onClick={() => {setShowServicesDropdown(false); setIsMenuOpen(false);}}>Quiz</Link>
                    <Link to="/question-paper" className="dropdown-item" onClick={() => {setShowServicesDropdown(false); setIsMenuOpen(false);}}>Question Paper</Link>
                    <Link to="/forum" className="dropdown-item" onClick={() => {setShowServicesDropdown(false); setIsMenuOpen(false);}}>Forum</Link>
                  </div>
                )}
              </div>
            </>
          )}
          {isAuthenticated && (
            <Link to="/profile" className="nav-link" onClick={() => setIsMenuOpen(false)}>Profile</Link>
          )}
          <Link to="/contact" className="nav-link" onClick={() => setIsMenuOpen(false)}>Contact</Link>
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <div className="notification-bell">
                <button onClick={toggleDropdown} className="bell-btn-wrap">
                  <span className="bell-icon">🔔</span>
                  {unreadCount > 0 && (
                    <span className="bell-badge">{unreadCount}</span>
                  )}
                </button>
                {showDropdown && (
                  <div className="notif-dropdown">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n._id} className={`notif-item ${n.isRead ? 'read' : ''}`}>
                          <div className="notif-title">{n.message}</div>
                          <div className="notif-actions">
                            {!n.isRead && <button onClick={() => markAsRead(n._id)}>Mark read</button>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <span className="hello-user mobile-hide">Hello, {user?.fullName?.toUpperCase()}</span>
              <button 
                onClick={() => { logout(); setIsMenuOpen(false); }} 
                className="logout-btn-header"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="login-link">Login</Link>
              <Link to="/register" className="register-btn">Sign Up</Link>
            </>
          )}
        </div>
      </div>

      {/* Floating Toasts Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast-item">
            <span className="toast-msg">{toast.message}</span>
          </div>
        ))}
      </div>
    </header>
  );
}

export default Header;
