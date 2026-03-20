import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/**
 * Google Sign-In button using Google Identity Services.
 * Requires REACT_APP_GOOGLE_CLIENT_ID env var.
 */
export default function GoogleAuthButton({ text = 'continue_with' }) {
  const btnRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Fallback Client ID from your .env in case Render deployment missed it
    const FALLBACK_ID = '196060547910-ebktcqsbq88vj13bua60qdec733lq9f5.apps.googleusercontent.com';
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || FALLBACK_ID;
    
    if (!clientId) {
      setEnabled(false);
      return;
    }

    setEnabled(true);

    const initializeGoogle = () => {
      try {
        const g = window.google;
        if (g?.accounts?.id && btnRef.current) {
          g.accounts.id.initialize({
            client_id: clientId,
            callback: async (resp) => {
              try {
                setError('');
                const r = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/google`, { credential: resp.credential });
                if (r.data?.success) {
                  localStorage.setItem('token', r.data.token);
                  localStorage.setItem('user', JSON.stringify(r.data.user));
                  navigate('/profile');
                  window.location.reload();
                } else {
                  setError(r.data?.error || 'Google sign-in failed');
                }
              } catch (e) {
                setError(e.response?.data?.error || e.message || 'Google sign-in failed');
              }
            }
          });
          
          g.accounts.id.renderButton(btnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 300, // Balanced width
            text
          });
          return true; // Success
        }
      } catch (e) {
        console.error('Google Auth Init Error:', e);
      }
      return false;
    };

    // Try immediately
    if (initializeGoogle()) return;

    // If not ready, poll every 500ms (up to 10 times)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (initializeGoogle() || attempts > 10) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [navigate, text]);

  if (!enabled) return null;

  return (
    <div style={{ marginTop: '14px' }}>
      <div ref={btnRef} />
      {/* Hide internal setup errors from end users; keep console logs if needed */}
      {!!error && false && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#b91c1c' }}>
          {error}
        </div>
      )}
    </div>
  );
}

