import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css';
import GoogleAuthButton from '../components/GoogleAuthButton';

function Register() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({ websiteName: 'ExamSeva' });
  const [role, setRole] = useState('student'); // fixed to student for public registration
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
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
    password: '',
    confirmPassword: ''
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
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRoleChange = () => {
    // In deployment, only student role is allowed from public registration.
    // This handler is kept for compatibility but does not change role.
    setRole('student');
    setError('');
  };

  const handleChange = (e) => {
    let value = e.target.value;

    // Phone number validation - only digits, max 10
    if (e.target.name === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }

    setFormData({
      ...formData,
      [e.target.name]: value
    });
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.fullName || !formData.email || !formData.phone) {
      setError('Please fill all basic details');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.phone.replace(/\D/g, '').length !== 10) {
      setError('Phone number must be 10 digits');
      return false;
    }
    return true;
  };

  const validateForm = () => {
    if (!formData.password || !formData.confirmPassword) {
      setError('Please set a password');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (role === 'student') {
      if (!formData.classStandard || !formData.courseType || !formData.year) {
        setError('Educational details are required');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep1()) {
      setStep(2);
      setError('');
    }
  };

  const prevStep = () => {
    setStep(1);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Client-side validation
    if (!validateForm()) {
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      setLoading(false);
      return;
    }

    try {
      const registrationData = {
        ...formData,
        role
      };

      const response = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/register`, registrationData);

      if (response.data.success) {
        // Store token in localStorage
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Redirect to home page after registration
        navigate('/');
        window.location.reload(); // Refresh to update auth state
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '600px' }}>
        <div className="auth-header">
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join {settings.websiteName} and start your journey.</p>
        </div>

        <div className="registration-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2</div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {step === 1 && (
            <div className="step-animation">
        <div className="google-auth-wrapper">
          <GoogleAuthButton text="signup_with" />
          <div className="auth-divider">or fill your details below</div>
        </div>

              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="Enter your Name"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="user@example.com"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="10 digit number"
                  />
                </div>
              </div>

              <button type="button" onClick={nextStep} className="auth-button">
                Next Step →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="step-animation">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Set Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength="6"
                      placeholder="Min 6 char"
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Repeat password"
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>
              </div>


              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="classStandard">Class/Standard</label>
                  <input
                    type="text"
                    id="classStandard"
                    name="classStandard"
                    value={formData.classStandard}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 10th, 12th"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="courseType">Course Type</label>
                  <select id="courseType" name="courseType" value={formData.courseType} onChange={handleChange} required>
                    <option value="">Select</option>
                    <option value="School">School</option>
                    <option value="High School">High School</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Postgraduate">Postgraduate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="institutionName">University / Board</label>
                  <input
                    type="text"
                    id="institutionName"
                    name="institutionName"
                    value={formData.institutionName}
                    onChange={handleChange}
                    placeholder="e.g., Mumbai University"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="year">Current Year</label>
                  <input
                    type="text"
                    id="year"
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 2024 or 2nd Year"
                  />
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" required />
                  I agree to the Terms & Conditions
                </label>
              </div>

              <div className="form-row" style={{ gap: '10px' }}>
                <button type="button" onClick={prevStep} className="auth-button secondary" style={{ background: '#f1f5f9', color: '#475569' }}>
                  ← Back
                </button>
                <button type="submit" className="auth-button" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Finish & Register'}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Register;
