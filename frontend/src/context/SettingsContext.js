import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    websiteName: 'ExamSeva',
    logoUrl: '/favicon.png',
    contactEmail: 'support@examseva.com',
    contactPhone: '022-05200',
    contactAddress: '123 Education Street, Mumbai City,   400105',
    contactFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfirVmJnhCpoHbjo7_FJ2DlZ11AJVSRMHbZi9p3Q0EPUkFgTw/viewform',
    aboutUs: '',
    footerLinks: []
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/api/settings');
      if (response.data.success && response.data.settings) {
        setSettings(prev => ({ ...prev, ...response.data.settings }));
      }
    } catch (err) {
      console.error('Error fetching global settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
