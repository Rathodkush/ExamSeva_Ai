import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/Home.css';

function Home() {
  const { isAuthenticated } = useAuth();
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    fetchAnnouncements();

    const sections = document.querySelectorAll('.content-section');
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/announcements`);
      setAnnouncements(response.data.announcements || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-content">
          <h1 className="main-title">ExamSeva — Repeated Question Detector</h1>
          <p className="subtitle">Your ultimate exam preparation platform</p>
          
          {!isAuthenticated && (
            <div className="auth-buttons">
              <Link to="/register" className="btn btn-primary">Sign Up</Link>
              <Link to="/login" className="btn btn-secondary">Login</Link>
            </div>
          )}
        </div>
      </header>

      {announcements.length > 0 && (
        <div className="announcements-banner">
          <h2> Announcements</h2>
          <div className="announcements-marquee">
            <div className="announcements-track">
              {[...announcements, ...announcements].map((announcement, index) => (
                <div
                  key={`${announcement._id || index}-${index}`}
                  className="announcement-item"
                >
                  <h3>{announcement.title}</h3>
                  <p>{announcement.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="important-content">
        <section className="content-section">
          <div className="section-icon"></div>
          <h2>Welcome to ExamSeva</h2>
          <p>
            ExamSeva is an AI-powered question paper assistant that helps you understand how universities
            repeat and shuffle questions across years. Upload past papers or study material and we will
            find repeated patterns, unique questions, and generate ready-to-use quizzes and question papers.
          </p>
          <p>
            Whether you are a school student, college student or faculty, ExamSeva saves hours of manual
            analysis so you can focus on real learning and smart revision.
          </p>
        </section>

        <section className="content-section">
          <div className="section-icon"></div>
          <h2>What ExamSeva can do for you</h2>
          <p>Behind the scenes we use OCR + NLP + similarity detection on every page you upload.</p>
          <ul className="features-list">
            <li><strong>Repeated Question Detector</strong> – find groups of similar questions across years.</li>
            <li><strong>Unique Question Finder</strong> – highlight one‑time questions from your notes.</li>
            <li><strong>Quiz Generator</strong> – create practice MCQs directly from PDF, images or Word files.</li>
            <li><strong>Question Paper Builder</strong> – generate school / university style papers with answer key.</li>
          </ul>
        </section>

        <section className="content-section">
          <div className="section-icon"></div>
          <h2>Why teachers and students choose ExamSeva</h2>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon"></div>
              <h4>One place for all exam files</h4>
              <p>Upload PDFs, DOCX, images and ebooks and keep everything organised.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon"></div>
              <h4>Auto-generated quizzes & papers</h4>
              <p>Turn raw notes into MCQs, short / long questions and printable exam PDFs.</p>
            </div>
      
            <div className="benefit-item">
              <div className="benefit-icon"></div>
              <h4>Student discussion forum</h4>
              <p>Ask doubts, share questions and discuss previous year papers.</p>
            </div>
          </div>
        </section>

        <section className="content-section">
          <div className="section-icon"></div>
          <h2>Get Started Today</h2>
          <p>
            {isAuthenticated ? (
              <>
                <strong>Welcome back!</strong> You can now upload papers, generate quizzes/question papers
                and participate in the community forum. Start your next upload or quiz from the header.
              </>
            ) : (
              <>
                Create a free account to unlock Study Hub, saved history, quiz scores and admin features.
                Guests can still try upload + analysis, but registered users get the full ExamSeva experience.
              </>
            )}
          </p>
          {!isAuthenticated && (
            <div className="cta-buttons">
              <Link to="/register" className="btn btn-primary">Start Free Trial</Link>
              <Link to="/uploadpaper" className="btn btn-secondary">Try Upload Paper</Link>
            </div>
          )}
        </section>
      </div>

      <div className="features-section">
        <div className="feature-card">
          <h3> Upload Paper</h3>
          <p>Upload your exam papers and analyze repeated questions</p>
          <Link to="/uploadpaper" className="feature-link">Try Now →</Link>
        </div>
        {isAuthenticated && (
          <>
            <div className="feature-card">
              <h3> Study Hub</h3>
              <p>Access comprehensive study materials and resources</p>
              <Link to="/studyhub" className="feature-link">Explore →</Link>
            </div>
            <div className="feature-card">
              <h3> Quize</h3>
              <p>Practice with interactive quizzes and assessments</p>
              <Link to="/quize" className="feature-link">Start Quiz →</Link>
            </div>
            <div className="feature-card">
              <h3> Forum</h3>
              <p>Discuss and collaborate with other students</p>
              <Link to="/forum" className="feature-link">Join Discussion →</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
