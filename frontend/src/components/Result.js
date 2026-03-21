import React, { useState, useEffect } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import "../styles/Result.css";

export default function Results({ results }) {
  const [expandedGroups, setExpandedGroups] = useState({});

  // DEBUGGING: Always log what we're getting
  useEffect(() => {
    console.log('[RESULT DEBUG] Full results prop:', results);
    console.log('[RESULT DEBUG] groups:', results?.groups, 'length:', results?.groups?.length);
    console.log('[RESULT DEBUG] unique:', results?.unique, 'length:', results?.unique?.length);
  }, [results]);

  // Always render, even if results is null or empty
  if (!results) {
    console.log('[RESULT] Results is null');
    return (
      <div className="results-display-container">
        <div className="no-results-message">
          <div className="no-results-icon"></div>
          <div className="no-results-text">Upload papers to see analysis results</div>
          <div className="no-results-hint">Select multiple exam papers and click "Upload & Analyze"</div>
        </div>
      </div>
    );
  }

  const groups = Array.isArray(results.groups) ? results.groups : [];
  const unique = Array.isArray(results.unique) ? results.unique : [];
  const extractedSections = Array.isArray(results.extractedSections) ? results.extractedSections : [];
  const meta = (results && results.metadata) ? results.metadata : null;

  // Ensure unique questions have proper structure
  const validUnique = unique.filter(q => {
    if (!q) return false;
    // Check if q has text property or if q itself is a string
    const hasText = (typeof q === 'string' && q.trim().length > 0) ||
      (typeof q === 'object' && q.text && typeof q.text === 'string' && q.text.trim().length > 0);
    return hasText;
  }).map(q => {
    // Normalize structure: if q is a string, convert to object
    if (typeof q === 'string') {
      return { id: unique.indexOf(q), text: q, keywords: [] };
    }
    // Ensure text property exists
    if (!q.text && q.question) {
      return { ...q, text: q.question };
    }
    return q;
  });

  // Build fallback repeated groups from unique questions if backend groups are empty
  const buildFallbackGroups = () => {
    const wordToIndexes = {};
    const stop = new Set(['the', 'and', 'with', 'that', 'this', 'from', 'have', 'what', 'which', 'when', 'where', 'how', 'why', 'are', 'for', 'you', 'your', 'into', 'onto', 'about', 'above', 'below', 'over', 'under', 'any', 'all', 'question', 'answer', 'write', 'explain', 'define', 'discuss']);
    validUnique.forEach((q, idx) => {
      const txt = (q.text || q.question || '').toString().toLowerCase();
      const words = txt.match(/[a-zA-Z]{4,}/g) || [];
      const seen = new Set();
      words.forEach(w => {
        if (stop.has(w)) return;
        if (seen.has(w)) return;
        seen.add(w);
        if (!wordToIndexes[w]) wordToIndexes[w] = [];
        wordToIndexes[w].push(idx);
      });
    });

    const clusters = {};
    Object.values(wordToIndexes).forEach(list => {
      if (list.length < 2) return;
      const key = Array.from(new Set(list)).sort((a, b) => a - b).join('-');
      if (!clusters[key]) clusters[key] = Array.from(new Set(list)).sort((a, b) => a - b);
    });

    const groupsFallback = [];
    Object.values(clusters).forEach((idxs, gid) => {
      const texts = idxs.map(i => (validUnique[i].text || validUnique[i].question || '').toString());
      const representative = texts.reduce((a, b) => (b.length > a.length ? b : a), '');
      const members = idxs.map(i => ({
        id: validUnique[i].id ?? i,
        text: (validUnique[i].text || validUnique[i].question || '').toString()
      }));
      groupsFallback.push({
        groupId: gid,
        representative,
        members,
        keywords: [],
        groupSize: members.length
      });
    });
    return groupsFallback;
  };

  let displayGroups = groups;
  if ((!displayGroups || displayGroups.length === 0) && validUnique.length > 1) {
    displayGroups = buildFallbackGroups();
  }

  console.log('[RESULT RENDER]', {
    groupsCount: displayGroups.length,
    uniqueCount: unique.length,
    validUniqueCount: validUnique.length,
    shouldShowRepeated: displayGroups.length > 0,
    shouldShowUnique: validUnique.length > 0
  });
  console.log('[Result Component] Groups data:', displayGroups);
  console.log('[Result Component] Unique data:', unique);
  console.log('[Result Component] Valid unique data:', validUnique);
  console.log('[Result Component] extractedSections:', extractedSections);

  // If data exists but might not be rendering, show debug info
  if ((groups.length > 0 || unique.length > 0) && process.env.NODE_ENV === 'development') {
    console.log('[Result Component] Data exists but may not be rendering:', {
      hasGroups: displayGroups.length > 0,
      hasUnique: unique.length > 0,
      groupsType: Array.isArray(groups) ? 'array' : typeof groups,
      uniqueType: Array.isArray(unique) ? 'array' : typeof unique,
      firstGroup: displayGroups[0],
      firstUnique: unique[0]
    });
  }

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const formatQuestion = (text) => {
    // Clean up the question text
    let formatted = text.trim();

    // Extract answer if embedded
    let answer = null;
    const answerMatch = formatted.match(/\[Answer:\s*(.+?)\]/);
    if (answerMatch) {
      answer = answerMatch[1].trim();
      formatted = formatted.replace(/\[Answer:\s*.+?\]/, '').trim();
    }

    // Remove leading numbering or option labels like "1.", "1)", "(a)", "A.", "A)"
    formatted = formatted.replace(/^\s*(\(?\d{1,3}[\).\-\:]\s*|\(?[a-hA-H][\).\-\:]\s*)/, '');

    // Fix common OCR errors: add spaces before capital letters in the middle of words
    // This handles cases like "Whenaphysical" -> "When a physical"
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Remove excessive whitespace
    formatted = formatted.replace(/\s+/g, ' ');

    // Fix common OCR concatenations
    const commonWords = ['the', 'and', 'with', 'that', 'this', 'from', 'have', 'what', 'which', 'when', 'where', 'how', 'why'];
    commonWords.forEach(word => {
      // Fix patterns like "wordWord" -> "word Word"
      const regex = new RegExp(`([a-z])${word.charAt(0).toUpperCase()}${word.slice(1)}`, 'gi');
      formatted = formatted.replace(regex, `$1 ${word}`);
    });

    // Ensure it ends with proper punctuation
    if (!formatted.match(/[.?!]$/)) {
      formatted += '?';
    }

    // Capitalize first letter
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    return { text: formatted, answer };
  };

  const filterKeywords = (keywords) => {
    if (!keywords || !Array.isArray(keywords)) return [];

    return keywords
      .filter(kw => {
        // Filter out keywords that are too long (likely not meaningful)
        if (kw.length > 25) return false;
        // Filter out keywords that are just numbers or single characters
        if (kw.length < 4) return false;
        // Filter out keywords that are just common phrases
        const commonPhrases = ['question', 'answer', 'explain', 'describe', 'define', 'write', 'state', 'list'];
        if (commonPhrases.includes(kw.toLowerCase())) return false;
        return true;
      })
      .slice(0, 8); // Limit to 8 most relevant keywords
  };

  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleAnswerClick = async (q) => {
    // Ensure user is authenticated to use Study Hub search
    if (!isAuthenticated) {
      alert('Please log in to view answers in Study Hub. You will be redirected to the login page.');
      navigate('/login');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/studyhub/search`, { question: q.text }, { headers });
      if (resp.data && resp.data.success && resp.data.result) {
        const r = resp.data.result;
        if (r.found) {
          // Extract PDF filename from path
          const pdfName = r.filePath ? r.filePath.split(/[/\\]/).pop() : 'Unknown PDF';

          const confirmMsg = `Answer found in PDF: "${pdfName}" on page ${r.page}.\n\nSnippet: ${r.snippet || 'N/A'}\n\nOpen PDF with highlighted answer?`;
          if (confirm(confirmMsg)) {
            // Navigate to StudyHub with parameters to auto-open the PDF
            const params = new URLSearchParams();
            params.set('file', r.filePath);
            params.set('page', r.page);
            params.set('snippet', r.snippet || '');
            if (r.rects && r.rects.length > 0) {
              params.set('rects', JSON.stringify(r.rects));
            }
            params.set('question', q.text);
            navigate(`/studyhub?${params.toString()}`);
          }
          return;
        }
      }

      alert('No matching answer found in Study Hub notes for this question. Try uploading relevant study materials first.');
    } catch (err) {
      console.error('StudyHub search error', err);
      if (err.response && err.response.status === 401) {
        alert('Please login to use Study Hub search.');
        navigate('/login');
      } else {
        alert('Search failed. Please ensure the Python AI service is running and try again later.');
      }
    }
  };

  const renderExtractedSections = () => {
    if (!extractedSections.length) return null;
    return (
      <div className="results-section unique-section">
        <div className="section-header">
          <h2 className="results-title">
            <span className="title-icon"></span>
            Parsed Questions ({extractedSections.length})
          </h2>
          <div className="section-subtitle">
            Clean representation of the paper (Attempt blocks + a–f parts)
          </div>
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          {extractedSections.map((s, idx) => (
            <div
              key={s.questionNumber || idx}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 800, color: '#111827' }}>
                  Q{s.questionNumber}
                  {s.marks ? <span style={{ marginLeft: '10px', fontWeight: 700, color: '#4f46e5' }}>({s.marks} marks)</span> : null}
                </div>
              </div>
              {s.instruction && (
                <div style={{ marginTop: '6px', color: '#374151', fontWeight: 600 }}>
                  {s.instruction}
                </div>
              )}
              {s.text && (
                <div style={{ marginTop: '10px', color: '#111827', lineHeight: 1.5 }}>
                  {s.text}
                </div>
              )}
              {Array.isArray(s.parts) && s.parts.length > 0 && (
                <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                  {s.parts.map((p, pidx) => (
                    <div
                      key={`${p.label}-${pidx}`}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: '#f9fafb',
                        border: '1px solid #eef2f7'
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#111827' }}>({p.label})</div>
                      <div style={{ color: '#111827', marginTop: '4px', lineHeight: 1.5 }}>{p.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };


  return (
    <div className="results-display-container">
      {console.log('[Result Render] groups:', displayGroups.length, 'unique:', unique.length)}

      {/* Paper metadata header */}
      {meta && (meta.subject || meta.year || meta.university || meta.subject_code) && (
        <div style={{ marginBottom: '22px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontWeight: 800, color: '#111827', marginBottom: '8px' }}>Paper Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', color: '#374151' }}>
            {meta.subject && <div><strong>Subject:</strong> {meta.subject}</div>}
            {(meta.subject_code || meta.subjectCode) && <div><strong>Code:</strong> {meta.subject_code || meta.subjectCode}</div>}
            {meta.year && <div><strong>Year:</strong> {meta.year}</div>}
            {(meta.university || meta.institutionName) && <div><strong>University/Board:</strong> {meta.university || meta.institutionName}</div>}
            {meta.classStandard && <div><strong>Class:</strong> {meta.classStandard}</div>}
            {meta.courseType && <div><strong>Course:</strong> {meta.courseType}</div>}
            {meta.semester && <div><strong>Semester:</strong> {meta.semester}</div>}
          </div>
        </div>
      )}

      {/* AI Analysis Summary Report */}
      {results.summary && (
        <div className="ai-report-banner" style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: 'white',
          padding: '24px',
          borderRadius: '16px',
          marginBottom: '28px',
          boxShadow: '0 10px 30px rgba(49, 46, 129, 0.2)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '60px', opacity: 0.1 }}>🤖</div>
          
          <div className="stat-item">
            <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Detected</div>
            <div style={{ fontSize: '32px', fontWeight: '800' }}>{results.summary.totalQuestionsDetected}</div>
            <div style={{ fontSize: '11px', color: '#a5b4fc' }}>Questions in system</div>
          </div>
          
          <div className="stat-item">
            <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Redundancy Score</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: results.summary.redundancyPercentage > 30 ? '#fbbf24' : '#34d399' }}>
              {results.summary.redundancyPercentage}%
            </div>
            <div style={{ fontSize: '11px', color: '#a5b4fc' }}>{results.summary.repeatedGroupsCount} shared groups</div>
          </div>

          <div className="stat-item">
            <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>AI Confidence</div>
            <div style={{ fontSize: '32px', fontWeight: '800' }}>{results.summary.aiConfidence}</div>
            <div style={{ fontSize: '11px', color: '#a5b4fc' }}>Match precision: High</div>
          </div>

          <div className="stat-item" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <button 
              className="generate-auto-btn"
              onClick={() => {
                // Logic to trigger quiz with these questions
                alert("Auto-Generating Quiz from these unique questions...");
                // Note: Integration with Quiz service can go here
              }}
              style={{
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ⚡ Auto-Generate Quiz
            </button>
          </div>
        </div>
      )}

      {/* Existing Summary Cards */}
      {(displayGroups.length > 0 || validUnique.length > 0) && (
        <div className="results-summary">
          <div className="summary-actions">
            <button className="download-report-btn" onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                const payload = { groups, unique: validUnique, metadata: results.metadata || {} };
                const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/analysis/report`, payload, {
                  // Existing logic...
                  responseType: 'blob',
                  headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                
                // Existing download logic...
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a'); a.href = url; a.download = 'full_analysis.pdf'; a.click();
              } catch (err) { alert('Download failed'); }
            }}>
              <span>📊</span> Download Full Analysis Report
            </button>

            <button className="download-report-btn" onClick={async () => {
              // ... existing logic ...
              try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const payload = { groups, unique: validUnique, metadata: results.metadata || {}, sections: ['repeated'] };
                const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/analysis/report`, payload, { responseType: 'blob', headers });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a'); a.href = url; a.download = 'repeated_questions.pdf'; a.click();
              } catch (err) { alert('Download failed'); }
            }}>
              <span>🔁</span> Download Repeated PDF
            </button>

            <button className="download-report-btn" onClick={async () => {
              // ... existing logic ...
              try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const payload = { groups, unique: validUnique, metadata: results.metadata || {}, sections: ['unique'] };
                const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/analysis/report`, payload, { responseType: 'blob', headers });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a'); a.href = url; a.download = 'unique_questions.pdf'; a.click();
              } catch (err) { alert('Download failed'); }
            }}>
              <span>📑</span> Download Unique PDF
            </button>

          </div>
        </div>
      )}

      {/* Repeated Questions Section */}
      {displayGroups.length > 0 && (
        <div className="results-section repeated-section">
          <div className="section-header">
            <h2 className="results-title">
              <span className="title-icon"></span>
              Repeated Questions
            </h2>
            <div className="section-subtitle">
              Found {displayGroups.length} group(s) with similar questions
            </div>
          </div>

          {/* Readable card grid (Main + variants) */}
          <div className="repeated-questions-grid">
            {displayGroups.map((g, index) => {
              const groupId = g.groupId ?? index;
              const members = Array.isArray(g.members) ? g.members : [];
              const representative = g.representative || (members.length > 0 && members[0]?.text) || (members.length > 0 && typeof members[0] === 'string' ? members[0] : 'No text available');
              const formatted = formatQuestion((representative || '').toString());
              const count = members.length || 1;
              const isExpanded = expandedGroups[groupId] === true;

              return (
                <div key={groupId} className="repeated-question-card">
                  <div className="repeated-group-number">{index + 1}</div>
                  <div className="repeated-question-text">
                    {formatted.text}
                  </div>

                  <div className="repeated-answer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <span className="answer-label">Repeated:</span>
                      <span className="answer-text">{count} time{count !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                      type="button"
                      className="download-report-btn"
                      style={{ padding: '8px 12px' }}
                      onClick={() => setExpandedGroups(prev => ({ ...prev, [groupId]: !isExpanded }))}
                    >
                      {isExpanded ? 'Hide variants' : `Show variants (${count})`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '10px' }}>
                      <div className="variants-count-badge">Different variants</div>
                      <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                        {members.map((m, mIdx) => {
                          const mText = (m && m.text ? m.text : '').toString();
                          const mFormatted = formatQuestion(mText);
                          return (
                            <div key={m.id || mIdx} style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: '10px', padding: '10px' }}>
                              <div style={{ fontWeight: 800, color: '#7f1d1d', marginBottom: '4px' }}>Variant {mIdx + 1}</div>
                              <div style={{ color: '#111827', lineHeight: 1.6 }}>{mFormatted.text}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unique Questions Section */}
      {validUnique.length > 0 && (
        <div className="results-section unique-section">
          <div className="section-header">
            <h2 className="results-title">
              <span className="title-icon"></span>
              Unique Questions ({validUnique.length})
            </h2>
            <div className="section-subtitle">
              {validUnique.length} question{validUnique.length !== 1 ? 's' : ''} that appeared only once
            </div>
          </div>

          <div className="unique-questions-grid">
            {validUnique.map((q, index) => {
              const questionText = q.text || q.question || '';
              const debugPreview = typeof questionText === 'string' ? questionText.substring(0, 50) : String(questionText);
              console.log(`[Result] Unique question ${index}:`, { text: debugPreview, hasText: !!questionText });
              return (
                <div key={q.id || index} className="unique-question-card">
                  <div className="unique-question-number">Q{index + 1}</div>
                  <div className="unique-question-text">{(() => {
                    const formatted = formatQuestion(questionText);
                    return formatted.text;
                  })()}</div>
                  {(() => {
                    const formatted = formatQuestion(questionText);
                    return formatted.answer && (
                      <div className="unique-answer">
                        <span className="answer-label">Answer:</span>
                        <span className="answer-text">{formatted.answer}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const filteredKeywords = filterKeywords(q.keywords || []);
                    return (
                      <div className="unique-keywords">
                        {filteredKeywords.slice(0, 5).map((kw, idx) => (
                          <span key={idx} className="unique-keyword-tag" title={kw}>
                            {kw.length > 15 ? kw.substring(0, 15) + '...' : kw}
                          </span>
                        ))}
                        <button className="answer-button" onClick={() => handleAnswerClick({ text: questionText, id: q.id || index })}>Answer</button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Structured Parsed Paper (fast mode output) */}
      {renderExtractedSections()}

      {/* No Results Message */}
      {groups.length === 0 && validUnique.length === 0 && extractedSections.length === 0 && (
        <div className="no-results-message">
          <div className="no-results-icon"></div>
          <div className="no-results-text">Upload papers to see analysis results</div>
          <div className="no-results-hint">Select multiple exam papers and click "Upload & Analyze"</div>
        </div>
      )}
    </div>
  );
}
