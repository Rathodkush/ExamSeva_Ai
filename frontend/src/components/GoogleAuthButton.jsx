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
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      // Not configured: don't show warning to end users; just don't render the button.
      setEnabled(false);
      setError('');
      return;
    }

    setEnabled(true);

    const g = window.google;
    if (!g || !g.accounts || !g.accounts.id) {
      // script not yet loaded; retry once shortly
      const t = setTimeout(() => {
        try {
          const gg = window.google;
          if (gg?.accounts?.id && btnRef.current) {
            gg.accounts.id.initialize({
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
            gg.accounts.id.renderButton(btnRef.current, {
              theme: 'outline',
              size: 'large',
              width: 360,
              text
            });
          }
        } catch (e) {
          setError('Google sign-in failed to initialize.');
        }
      }, 600);
      return () => clearTimeout(t);
    }

    try {
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
      if (btnRef.current) {
        g.accounts.id.renderButton(btnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 360,
          text
        });
      }
    } catch (e) {
      setError('Google sign-in failed to initialize.');
    }
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

