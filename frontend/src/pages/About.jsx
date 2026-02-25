import React, { useState } from 'react';
import '../styles/About.css';

function About() {
  const [openFAQ, setOpenFAQ] = useState(null);

  const faqs = [
    {
      id: 1,
      question: 'Why ExamSeva is used?',
      answer: 'ExamSeva helps students identify repeated questions across multiple exam papers, saving time and focusing study efforts on high-probability topics. It uses AI to analyze patterns and provides insights that traditional study methods cannot offer.'
    },
    {
      id: 2,
      question: 'The function of repeated question - can ChatGPT help?',
      answer: 'While ChatGPT can answer questions, ExamSeva specializes in detecting repeated questions across multiple papers using advanced NLP and similarity analysis. ChatGPT cannot analyze patterns across documents or identify which questions appear frequently in exam papers. ExamSeva provides specific, actionable insights for exam preparation that generic AI chatbots cannot.'
    },
    {
      id: 3,
      question: 'What is the uniqueness of ExamSeva?',
      answer: 'ExamSeva is uniquely designed for exam preparation with specialized features: (1) AI-powered repeated question detection across multiple papers, (2) Keyword-based analysis focusing on key concepts, (3) Fast processing (30-35 seconds), (4) Study Hub for collaborative learning, (5) Quiz generation from uploaded materials, and (6) Mentor support system. Unlike generic platforms, ExamSeva is purpose-built for exam success.'
    },
    {
      id: 4,
      question: 'What is better than other Education/Academic platforms?',
      answer: 'ExamSeva offers several advantages: (1) Specialized repeated question detection - no other platform focuses on this, (2) Faster processing with optimized AI, (3) Keyword-focused analysis for better accuracy, (4) Integrated study tools (notes, quizzes, forum) in one platform, (5) Mentor support system, (6) Free and accessible to all students. Most platforms are generic - ExamSeva is specifically designed for exam preparation success.'
    },
    {
      id: 5,
      question: 'What you provide and why is it so complicated?',
      answer: 'ExamSeva provides: (1) Repeated question analysis to identify patterns, (2) Study materials upload and sharing, (3) AI-generated quizzes from your materials, (4) Mentor directory for guidance, (5) Student forum for collaboration. While the technology behind it is complex (AI, NLP, OCR), we\'ve made the interface simple and user-friendly. Just upload your papers and get instant insights - no technical knowledge required!'
    }
  ];

  const toggleFAQ = (id) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <div className="about-container">
      <div className="about-hero">
        <h1>About ExamSeva</h1>
        <p className="hero-subtitle">Your intelligent exam preparation companion</p>
      </div>

      <div className="about-content">
        <section className="about-section intro-section">
          <h2>Welcome to ExamSeva</h2>
          <p className="intro-text">
            ExamSeva is a revolutionary platform designed to transform how students prepare for exams. 
            We combine advanced AI technology with practical study tools to help you identify patterns, 
            focus on high-probability questions, and maximize your exam success.
          </p>
        </section>

        <section className="about-section">
          <h2>What We Offer</h2>
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon"></div>
              <h3>Paper Analysis</h3>
              <p>Upload exam papers and get instant analysis of repeated questions across multiple papers.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"></div>
              <h3>Study Hub</h3>
              <p>Access comprehensive study materials, notes, and resources curated for your exams.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"></div>
              <h3>Quiz Generator</h3>
              <p>Upload materials and automatically generate interactive quizzes for practice.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"></div>
              <h3>Community Forum</h3>
              <p>Engage with fellow students, share knowledge, and plan study sessions together.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"></div>
              <h3>AI-Powered Insights</h3>
              <p>Get personalized recommendations and insights based on your performance data.</p>
            </div>
          </div>
        </section>

        <section className="about-section faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map(faq => (
              <div key={faq.id} className={`faq-item ${openFAQ === faq.id ? 'open' : ''}`}>
                <div className="faq-question" onClick={() => toggleFAQ(faq.id)}>
                  <span className="faq-number">{faq.id}.</span>
                  <span className="faq-text">{faq.question}</span>
                  <span className="faq-icon">{openFAQ === faq.id ? '−' : '+'}</span>
                </div>
                {openFAQ === faq.id && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2>How It Works</h2>
          <div className="steps-list">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Upload Papers</h3>
                <p>Upload your exam papers in PDF or image format.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>AI Analysis</h3>
                <p>Our AI system extracts and analyzes questions using OCR and NLP in just 30-35 seconds.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Get Insights</h3>
                <p>Receive detailed analysis showing repeated and unique questions with key terms.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Study Smart</h3>
                <p>Focus on high-probability questions and optimize your preparation strategy.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default About;

