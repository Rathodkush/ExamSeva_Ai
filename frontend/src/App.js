import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CookieConsent from './components/CookieConsent';
import './App.css';

// Import page components
import UploadPaper from './pages/UploadPaper';
import StudyHub from './pages/StudyHub';
import Quize from './pages/Quize';
import QuestionPaper from './pages/QuestionPaper';
import Forum from './pages/Forum';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import Results from './pages/Results';
import About from './pages/About';
import Contact from './pages/Contact';
import PdfViewer from './pages/PdfViewer';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminUsers from './pages/AdminUsers';
import AdminNotes from './pages/AdminNotes';
import AdminQuestionPapers from './pages/AdminQuestionPapers';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminSettings from './pages/AdminSettings';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Admin Protected Route Component
const AdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

// Public Route Component (redirects to profile if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/profile" replace />;
  }

  return children;
};

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    const trackVisit = async () => {
      try {
        await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/stats/track-visit`);
      } catch (err) { }
    };
    trackVisit();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading application...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/uploadpaper" element={<UploadPaper />} />
      <Route 
        path="/studyhub" 
        element={
          isAuthenticated ? <StudyHub /> : <Navigate to="/login" replace />
        } 
      />
      <Route 
        path="/viewer"
        element={
          isAuthenticated ? <PdfViewer /> : <Navigate to="/login" replace />
        }
      />
      <Route 
        path="/quize" 
        element={
          isAuthenticated ? <Quize /> : <Navigate to="/login" replace />
        } 
      />
      <Route 
        path="/question-paper" 
        element={
          isAuthenticated ? <QuestionPaper /> : <Navigate to="/login" replace />
        } 
      />
      
      <Route 
        path="/forum" 
        element={
          isAuthenticated ? <Forum /> : <Navigate to="/login" replace />
        } 
      />
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } 
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/results" 
        element={
          isAuthenticated ? <Results /> : <Navigate to="/login" replace />
        } 
      />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route 
        path="/admin-dashboard" 
        element={
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin-users" 
        element={
          <AdminProtectedRoute>
            <AdminUsers />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin-notes" 
        element={
          <AdminProtectedRoute>
            <AdminNotes />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin-question-papers" 
        element={
          <AdminProtectedRoute>
            <AdminQuestionPapers />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin-announcements" 
        element={
          <AdminProtectedRoute>
            <AdminAnnouncements />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin-settings" 
        element={
          <AdminProtectedRoute>
            <AdminSettings />
          </AdminProtectedRoute>
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <div className="App">
            <Header />
            <main className="main-content">
              <AppRoutes />
            </main>
            <Footer />
          </div>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
