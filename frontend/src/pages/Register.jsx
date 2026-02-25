import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css';
import GoogleAuthButton from '../components/GoogleAuthButton';

function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState('student'); // fixed to student for public registration
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    // Student fields
    classStandard: '',
    courseType: '',
    year: '',
    // Additional profile fields
    institutionName: '',
    boardName: '',
    state: '',
    semester: '',
    // (no mentor fields)
    // Common
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const validateForm = () => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Phone validation
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Phone number must be exactly 10 digits');
      return false;
    }

    // Role-specific validation
    if (role === 'student') {
      if (!formData.classStandard || !formData.courseType || !formData.year) {
        setError('Class/Standard, Course Type, and Year are required for students');
        return false;
      }
    }

    return true;
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

      const response = await axios.post('`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`/api/auth/register', registrationData);

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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <h1 className="auth-title" style={{ marginBottom: 0, textAlign: 'left' }}>Create Account</h1>
          <p className="auth-subtitle" style={{ marginBottom: 0, textAlign: 'right' }}>Join ExamSeva and start your journey.</p>
        </div>

        <GoogleAuthButton text="signup_with" />
        <div style={{ marginTop: '10px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
          or create an account with email
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Role and Phone in one row */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="role">I am a</label>
              <input
                id="role"
                name="role"
                value="Student"
                readOnly
                className="role-select"
                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone Number (10 digits)</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                maxLength="10"
                pattern="[0-9]{10}"
                placeholder="Enter 10 digit phone number"
              />
              {formData.phone && formData.phone.replace(/\D/g, '').length !== 10 && (
                <span style={{ color: '#c33', fontSize: '12px' }}>
                  Phone number must be exactly 10 digits
                </span>
              )}
            </div>
          </div>

          {/* Common Fields */}
          <div className="form-row">
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

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                placeholder="Enter your email (e.g., user@example.com)"
              />
            </div>
          </div>

          {/* Student Fields */}
          {role === 'student' && (
            <>
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
                    placeholder="e.g., 10th, 12th, B.Tech 1st Year"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="courseType">Course Type</label>
                  <select
                    id="courseType"
                    name="courseType"
                    value={formData.courseType}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Course Type</option>
                    <option value="School">School</option>
                    <option value="High School">High School</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Postgraduate">Postgraduate</option>
                    <option value="Diploma">Diploma</option>
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
                    placeholder="e.g., Mumbai University or HSC"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="boardName">State Board (optional)</label>
                  <input
                    type="text"
                    id="boardName"
                    name="boardName"
                    value={formData.boardName}
                    onChange={handleChange}
                    placeholder="e.g., Gujarat Board"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="semester">Semester</label>
                  <input
                    type="text"
                    id="semester"
                    name="semester"
                    value={formData.semester}
                    onChange={handleChange}
                    placeholder="e.g., 1, 2, 5"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="year">Year</label>
                  <input
                    type="text"
                    id="year"
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 2024, 1st Year, 2nd Year"
                  />
                </div>
              </div>
            </>
          )}

          {/* No mentor-specific fields; registration only supports Student/Admin */}

          {/* Password Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="6"
                placeholder="Create a password (min 6 characters)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm your password"
              />
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input type="checkbox" required />
              I agree to the Terms and Conditions
            </label>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Register;
