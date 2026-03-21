import React, { useState } from 'react';
import axios from 'axios';
import '../styles/Contact.css';
import { useSettings } from '../context/SettingsContext';

function Contact() {
  const { settings } = useSettings();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/contact`, formData);
      if (response.data.success) {
        alert('Thank you for your message! We will get back to you soon.');
        setFormData({ name: '', email: '', subject: '', message: '' });
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contact-container">
      <div className="contact-hero">
        <h1>Contact Us</h1>
        <p className="hero-subtitle">We'd love to hear from you. Get in touch with us!</p>
      </div>

      <div className="contact-content">
        <div className="contact-info">
          <div className="info-card">
            <h3>Email</h3>
            <p>{settings.contactEmail}</p>
          </div>

          <div className="info-card">
            <h3>Phone</h3>
            <p>{settings.contactPhone}</p>
            <p>Mon-Fri: 9AM – 6PM</p>
          </div>

          <div className="info-card">
            <h3>Address</h3>
            <p>{settings.contactAddress}</p>
          </div>

          <div className="info-card">
            <h3>Social Media</h3>
            <div className="social-links-list">
              <a href="#">Facebook</a>
              <a href="#">Twitter</a>
              <a href="#">LinkedIn</a>
              <a href="#">Instagram</a>
            </div>
          </div>

          <div className="info-card form-promo">
            <h3>Send a Message</h3>
            <p>Fill our Google Form — we reply within 24-48 hrs.</p>
            <button 
              className="open-form-btn" 
              onClick={() => window.open(settings.contactFormUrl, '_blank')}
            >
              Open Form
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Contact;


