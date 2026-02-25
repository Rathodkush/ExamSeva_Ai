import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>ExamSeva</h3>
            <p>Your intelligent exam preparation companion. Identify patterns, focus on high-probability questions, and maximize your exam success.</p>
            <div className="social-links">
              <a href="#" aria-label="Facebook">Facebook</a>
              <a href="#" aria-label="Twitter">Twitter</a>
              <a href="#" aria-label="LinkedIn">LinkedIn</a>
              <a href="#" aria-label="Instagram">Instagram</a>
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
              <li><a href="mailto:support@examseva.com">support@examseva.com</a></li>
              <li><a href="tel:+022-05200">022-05200</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} ExamSeva. All rights reserved.</p>
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


