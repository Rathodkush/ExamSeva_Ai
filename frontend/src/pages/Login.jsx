import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css';
import GoogleAuthButton from '../components/GoogleAuthButton';

function Login() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({ websiteName: 'ExamSeva' });
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/settings`);
        if (response.data.settings) {
          setSettings(response.data.settings);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check for logout success
    const query = new URLSearchParams(window.location.search);
    if (query.get('logout') === 'success') {
      setSuccess('Logged out successfully. See you again!');
      // Clear URL
      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/login`, formData);
      
      if (response.data.success) {
        // Store token in localStorage
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Redirect to profile or home
        navigate('/profile');
        window.location.reload(); // Refresh to update auth state
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Login to {settings.websiteName}</h1>
          <p className="auth-subtitle">Welcome back! Please login to your account.</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message" style={{ background: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center', border: '1px solid #a7f3d0' }}>{success}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
              />
              <button 
                type="button" 
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input type="checkbox" />
              Remember me
            </label>
            <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="google-auth-wrapper">
          <div className="auth-divider">or continue with</div>
          <GoogleAuthButton text="continue_with" />
        </div>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Register here</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Login;


