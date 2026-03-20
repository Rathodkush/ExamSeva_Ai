import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';
import { useSettings } from '../context/SettingsContext';

function Footer() {
  const { settings } = useSettings();
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>ExamSeva</h3>
            <p>Your intelligent exam preparation companion. Identify patterns, focus on high-probability questions, and maximize your exam success.</p>
            <div className="social-links">
              <a href="#" className="social-link" aria-label="Facebook">f</a>
              <a href="#" className="social-link" aria-label="Twitter">t</a>
              <a href="#" className="social-link" aria-label="LinkedIn">in</a>
              <a href="#" className="social-link" aria-label="Instagram">ig</a>
            </div>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/uploadpaper">Upload Paper</Link></li>
              <li><Link to="/studyhub">Study Hub</Link></li>
              <li><Link to="/quize">Quiz Generator</Link></li>
              <li><Link to="/results">Results</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Resources</h4>
            <ul>
              
              <li><Link to="/forum">Forum</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><Link to="/about">FAQ</Link></li>
              <li><Link to="/contact">Help Center</Link></li>
              <li><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></li>
              <li><a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a></li>
              <li>{settings.contactAddress}</li>
            </ul>
            <div className="secure-badge">
                <button className="secure-btn">Secure & Private</button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} {settings.websiteName}. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/about">Privacy Policy</Link>
            <span>|</span>
            <Link to="/about">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;


