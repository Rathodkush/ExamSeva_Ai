import React, { useState, useEffect } from 'react';

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setTimeout(() => setIsVisible(true), 2000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      right: '20px',
      background: '#ffffff',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      padding: '15px 25px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 9999,
      border: '1px solid #e2e8f0',
      maxWidth: '800px',
      margin: '0 auto',
      animation: 'slideUp 0.5s ease-out'
    }}>
      <div style={{ flex: 1, marginRight: '20px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#1e3a5f', fontSize: '16px' }}>Cookie Settings 🍪</h4>
        <p style={{ margin: 0, color: '#64748b', fontSize: '13px', lineHeight: '1.4' }}>
          We use cookies to enhance your experience, analyze site traffic, and for personalization. By clicking "Accept", you agree to our use of cookies.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setIsVisible(false)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#94a3b8', 
            fontSize: '13px', 
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          Decline
        </button>
        <button 
          onClick={handleAccept}
          style={{ 
            background: '#1e3a5f', 
            color: 'white', 
            border: 'none', 
            padding: '8px 25px', 
            borderRadius: '8px', 
            fontWeight: '600', 
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Accept All
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 600px) {
          div { flex-direction: column; text-align: center; }
          div > div { margin-bottom: 15px; margin-right: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default CookieConsent;
