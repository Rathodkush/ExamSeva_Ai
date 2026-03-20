import React, { useState, useRef } from "react";
import axios from "axios";
import "../styles/FileUpload.css";
import ConfirmModal from './ConfirmModal';

export default function FileUpload({ setResults }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [processingTime, setProcessingTime] = useState(null);

  // New metadata structure
  const [levelType, setLevelType] = useState("Board"); // 'Board' | 'University'
  const [institutionName, setInstitutionName] = useState("");
  const [state, setState] = useState("");
  const [classLevel, setClassLevel] = useState("10th"); // '10th' | '12th' | 'undergraduate'
  const [degreeName, setDegreeName] = useState(""); // shown when undergraduate
  const [semester, setSemester] = useState("");
  const [year, setYear] = useState("");
  const [extractedMeta, setExtractedMeta] = useState(null); // metadata from OCR (subject, university, course)
  const fileInputRef = useRef(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastFailedReason, setLastFailedReason] = useState(null);
  const [showEnhanceOption, setShowEnhanceOption] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false); // hide metadata by default

  // On mount try to populate metadata from logged-in user's profile
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    (async () => {
      try {
        const resp = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.data && resp.data.user) {
          const u = resp.data.user;
          if (u.institutionName) setInstitutionName(u.institutionName);
          if (u.state) setState(u.state);
          if (u.semester) setSemester(u.semester);
          if (u.year) setYear(u.year);
          if (u.classStandard && !classLevel) setClassLevel(u.classStandard);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const handleFiles = async (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    setLastFailedReason(null);
    setShowEnhanceOption(false);

    // Auto-run metadata preview for selected files
    if (selected.length > 0) {
      try {
        setPreviewLoading(true);
        const form = new FormData();
        selected.forEach(f => form.append('files', f));
        form.append('metadata', JSON.stringify({}));

        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const resp = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/upload/preview`, form, { headers, timeout: 30000 });
        if (resp.data && resp.data.metadata) {
          setExtractedMeta(resp.data.metadata);
          // Autofill fields if empty
          if (resp.data.metadata.university && !institutionName) setInstitutionName(resp.data.metadata.university);
          // Do NOT overwrite classLevel with subject (classLevel is 10th/12th/undergraduate).
          const y = (resp.data.metadata.paper_details && resp.data.metadata.paper_details.match(/\b(20\d{2}|19\d{2})\b/) || [])[0];
          if (y && !year) setYear(y);
        }
      } catch (err) {
        console.warn('Preview failed', err);
        // If preview specifically indicated no readable text, show enhance option
        if (err.response && err.response.status === 400) {
          const errorMsg = err.response.data?.error || err.response.data?.detail || 'Preview failed - no readable text';
          setLastFailedReason(errorMsg);
          setShowEnhanceOption(true);
        } else if (err.response && err.response.status === 503) {
          // Service unavailable - might be Python service not running or model not loaded
          const errorMsg = err.response.data?.detail || err.response.data?.error || 'Python AI service is not available. Please ensure the Python service is running on port 5000.';
          setLastFailedReason(errorMsg);
          console.error('Python service unavailable:', errorMsg);
        } else {
          // Other errors - log but don't block user
          console.error('Preview error:', err.message || err);
        }
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const upload = async () => {
    if (files.length === 0) return alert("Select files first.");

    // Metadata fields are now optional and are auto-detected from the uploaded file and the user's profile.
    // You can still edit them before upload if needed.

    setLoading(true);
    setProgress('Uploading files...');
    setProcessingTime(null);
    setResults({ groups: [], unique: [] }); // Clear previous results
    const startTime = Date.now();
    
    try {
      const form = new FormData();
      files.forEach(f => form.append("files", f));
      // Build metadata; prefer explicitly set fields, fall back to profile-populated values
      const metadata = {
        levelType,
        institutionName: institutionName || undefined,
        state: state || undefined,
        classLevel: classLevel || undefined,
        degreeName: classLevel === 'undergraduate' ? degreeName : undefined,
        semester: semester || undefined,
        year: year || undefined,
        // Include simple subject hint for generated quizzes/reports: prefer detected subject, otherwise classLevel
        subject: (extractedMeta && extractedMeta.subject) ? extractedMeta.subject : (classLevel || undefined),
        // Always enable fast analysis mode (no toggle in UI)
        fastMode: true
      };
      form.append("metadata", JSON.stringify(metadata));

      setProgress('Processing OCR and analyzing questions...');
      console.log(` Uploading ${files.length} file(s) for analysis...`);

      // Get auth token if available. Do NOT set Content-Type manually when sending FormData
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/upload`, form, {
        headers: headers,
        timeout: 180000 // 3 minutes timeout to allow OCR processing
      });
      
      console.log(' Response received:', {
        hasGroups: !!res.data.groups,
        hasUnique: !!res.data.unique,
        groupsCount: res.data.groups?.length || 0,
        uniqueCount: res.data.unique?.length || 0,
        hasError: !!res.data.error,
        errorMessage: res.data.error || 'None',
        allData: res.data
      });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setProcessingTime(elapsed);
      
      // Ensure we have valid data structure
      const groups = Array.isArray(res.data.groups) ? res.data.groups : [];
      let unique = Array.isArray(res.data.unique) ? res.data.unique : [];
      
      // Normalize unique questions structure - ensure each has text property
      unique = unique.map((q, idx) => {
        if (!q) return null;
        // If q is a string, convert to object
        if (typeof q === 'string') {
          return { id: idx, text: q, keywords: [] };
        }
        // If q has question property but no text, use question
        if (q.question && !q.text) {
          return { ...q, text: q.question };
        }
        // Ensure text property exists
        if (!q.text || (typeof q.text !== 'string' && typeof q.text !== 'number')) {
          return null; // Skip invalid entries
        }
        return q;
      }).filter(q => q !== null && q.text && q.text.toString().trim().length > 0);
      
      console.log('Analysis results received:', { 
        groups: groups.length, 
        unique: unique.length,
        validUnique: unique.filter(q => q && q.text).length,
        totalTime: res.data.totalTime,
        rawData: {
          hasGroups: !!res.data.groups,
          hasUnique: !!res.data.unique,
          groupsType: typeof res.data.groups,
          uniqueType: typeof res.data.unique,
          firstUnique: unique[0]
        }
      });
      
      // Always set results, even if empty - ensure proper state update
      const resultsToSet = {
        groups: groups,
        unique: unique,
        metadata: res.data.metadata || {},
        filesProcessed: files.length
      };
      
      console.log('🔴 SETTING RESULTS:');
      console.log('   groups:', groups);
      console.log('   unique:', unique);
      console.log('   metadata:', res.data.metadata);
      console.log('   Full resultsToSet:', resultsToSet);
      
      setResults(resultsToSet);
      
      console.log('✅ Results set to parent component');
      
      // Apply extracted metadata if available
      if (res.data && res.data.metadata) {
        setExtractedMeta(res.data.metadata);
        // Autofill some fields if they look reasonable
        if (res.data.metadata.university && !institutionName) setInstitutionName(res.data.metadata.university);
        if (res.data.metadata.course && !classLevel) setClassLevel(res.data.metadata.course);
        if (res.data.metadata.paper_details && !year) {
          // try to extract a 4-digit year from paper details
          const y = (res.data.metadata.paper_details.match(/\b(20\d{2}|19\d{2})\b/) || [])[0];
          if (y) setYear(y);
        }
      }

      if (groups.length === 0 && unique.length === 0) {
        setProgress('Analysis completed but no questions were detected. Please check your files.');
      } else {
        setProgress(`Analysis complete! Found ${groups.length} repeated groups and ${unique.length} unique questions.`);
      }

      // Provide a small persisted marker in the UI
      try {
        localStorage.setItem('lastAnalysisTimestamp', Date.now().toString());
      } catch (e) {}
      
      // Persist analysis locally so navigating away doesn't clear results
      try {
        localStorage.setItem('lastAnalysis', JSON.stringify({
          groups: groups,
          unique: unique,
          metadata: res.data.metadata || null,
          filesProcessed: files.length
        }));
      } catch (e) {
        console.warn('Failed to persist analysis locally', e);
      }

      // Keep files in the form by default so user can re-run enhancement or adjust options.
      // Clear progress after 5 seconds
      setTimeout(() => setProgress(''), 5000);

      if (res.data && res.data.cached) {
        setProgress('A cached analysis was returned (file previously processed).');
        // Keep the extracted metadata visible if available
        if (res.data.metadata) setExtractedMeta(res.data.metadata);
      }

      // Fire a global event so statistics widget can refresh "Papers Uploaded"
      try {
        window.dispatchEvent(new Event('examseva-activity-updated'));
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Upload error:', err);
      console.log('Error details:', {
        code: err.code,
        status: err.response?.status,
        statusText: err.response?.statusText,
        errorData: err.response?.data,
        message: err.message
      });
      setProgress('');
      setLoading(false);
      
      // Always set empty results on error so UI shows "no results" message
      setResults({
        groups: [],
        unique: []
      });
      
      let errorMessage = "Error uploading files. ";
      
      if (err.code === 'ECONNABORTED' || err.response?.status === 504) {
        errorMessage = "Processing took too long. Please try with smaller files or fewer pages.";
      } else if (err.response?.status === 400) {
        errorMessage = "Bad request: " + (err.response.data?.error || "Invalid file format or no files selected");
      } else if (err.response?.status === 503) {
        errorMessage = err.response.data?.detail || "Analysis service is not available. Please ensure the Python AI service is running on port 5000.";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error: " + (err.response.data?.detail || err.message);
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
        errorMessage = `Cannot connect to server. Please make sure the backend server is running on ${process.env.REACT_APP_API_URL || "http://localhost:4000"}`;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error + (err.response.data.detail ? ': ' + err.response.data.detail : '');
        // If server said no text extracted, offer enhancement
        if (err.response.status === 400 && err.response.data.error && /no text/i.test(err.response.data.error)) {
          setShowEnhanceOption(true);
          setLastFailedReason(err.response.data.error);
        }
      } else {
        errorMessage += err.message || "Unknown error occurred.";
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Allow user to clear persisted analysis
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, requireText: null, danger: false });

  const clearPersisted = () => {
    // Open confirmation modal for strong action
    setConfirmState({
      open: true,
      title: 'Clear saved analysis',
      message: 'This will permanently remove the locally-saved analysis and cannot be undone. Do you want to continue?',
      requireText: null,
      danger: true,
      onConfirm: () => {
        try {
          localStorage.removeItem('lastAnalysis');
          localStorage.removeItem('lastAnalysisTimestamp');
          setResults({ groups: [], unique: [] });
          setExtractedMeta(null);
          setProgress('Cleared saved analysis.');
          setTimeout(() => setProgress(''), 3000);
        } catch (e) {
          console.warn('Failed to clear persisted analysis', e);
        } finally {
          setConfirmState(s => ({ ...s, open: false }));
        }
      }
    });
  };

  return (
    <div className="file-upload-container">
      <div className="file-input-wrapper">
        <input 
          type="file" 
          multiple 
          accept=".pdf,image/*" 
          ref={fileInputRef}
          onChange={handleFiles}
        />
      </div>

      {/* Fast mode is always enabled server-side; no toggle required in UI */}
      {localStorage.getItem('lastAnalysis') && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <small style={{ color: '#6b7280' }}>Previous analysis is saved locally — it will persist across navigation.</small>
          <button style={{ marginLeft: '12px' }} className="enhance-button danger" onClick={clearPersisted}>Clear saved analysis</button>
        </div>
      )}

      {/* Confirm modal for strong actions */}
      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        requireText={confirmState.requireText}
        danger={confirmState.danger}
        confirmText={confirmState.danger ? 'Yes, clear' : 'Confirm'}
        onConfirm={() => confirmState.onConfirm && confirmState.onConfirm()}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />

      <div style={{ marginTop: '10px' }}>
        <button type="button" className="toggle-advanced" onClick={() => setShowAdvanced(s => !s)}>
          {showAdvanced ? 'Hide additional fields' : 'Show additional fields (optional)'}
        </button>
      </div>

      {showAdvanced && (
        <div className="form-grid">
          <div className="form-group">
            <label>Level Type</label>
            <select value={levelType} onChange={(e)=>setLevelType(e.target.value)}>
              <option>Board</option>
              <option>University</option>
            </select>
          </div>

          <div className="form-group">
            <label>State</label>
            <input 
              value={state} 
              onChange={(e)=>setState(e.target.value)} 
              placeholder="e.g., Gujarat"
            />
          </div>

          <div className="form-group full-width">
            <label>{levelType === 'University' ? 'University Name' : 'Board Name'}</label>
            <input 
              value={institutionName} 
              onChange={(e)=>setInstitutionName(e.target.value)} 
              placeholder={levelType === 'University' ? 'Enter university name ,eg. Mumbai university' : 'Enter board name eg, HSC,SSC'}
            />
          </div>

          <div className="form-group">
            <label>Class</label>
            <select value={classLevel} onChange={(e)=>setClassLevel(e.target.value)}>
              <option value="10th">10th</option>
              <option value="12th">12th</option>
              <option value="undergraduate">Undergraduate</option>
            </select>
          </div>

          {classLevel === 'undergraduate' && (
            <div className="form-group">
              <label>Degree Name</label>
              <input 
                value={degreeName} 
                onChange={(e)=>setDegreeName(e.target.value)} 
                placeholder="e.g., B.Sc, B.Com"
              />
            </div>
          )}

          <div className="form-group">
            <label>Semester</label>
            <input 
              value={semester} 
              onChange={(e)=>setSemester(e.target.value)} 
              placeholder="e.g., 1, 2, 5 "
            />
          </div>
          
          <div className="form-group">
            <label>Year</label>
            <input 
              value={year} 
              onChange={(e)=>setYear(e.target.value)} 
              placeholder="e.g., 2024"
            />
          </div>

          {extractedMeta && (
            <div className="detected-meta">
              <h4>Detected from file (auto)</h4>
              <p><strong>University:</strong> {extractedMeta.university || '—'}</p>
              <p><strong>Subject / Course:</strong> {extractedMeta.subject || extractedMeta.course || '—'}</p>
              <p><strong>Paper info:</strong> {extractedMeta.paper_details || '—'}</p>
              <button type="button" className="apply-meta-btn" onClick={() => {
                if (extractedMeta.university) setInstitutionName(extractedMeta.university);
                if (extractedMeta.course) setClassLevel(extractedMeta.course);
                const y = (extractedMeta.paper_details && extractedMeta.paper_details.match(/\b(20\d{2}|19\d{2})\b/) || [])[0];
                if (y) setYear(y);
              }}>Apply detected values</button>
            </div>
          )}
        </div>
      )}

      <button 
        onClick={upload} 
        disabled={loading} 
        className="upload-button"
      >
        {loading ? (progress || "Analyzing...") : "Upload & Analyze"}
      </button>

      {showEnhanceOption && (
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <div style={{ marginBottom: '8px', color: '#7f1d1d' }}>
            ⚠️ {lastFailedReason || 'Previous analysis found no readable text in these files.'}
          </div>
          <button
            onClick={async () => {
              if (files.length === 0) return alert('Select files first');
              setLoading(true);
              setProgress('Attempting to enhance images and retry...');
              try {
                const form = new FormData();
                files.forEach(f => form.append('files', f));
                const token = localStorage.getItem('token');
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const resp = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/upload/enhance`, form, { headers, timeout: 120000 });
                if (resp.data) {
                  const groups = Array.isArray(resp.data.groups) ? resp.data.groups : [];
                  const unique = Array.isArray(resp.data.unique) ? resp.data.unique : [];
                  setResults({ groups, unique });
                  if (resp.data.metadata) setExtractedMeta(resp.data.metadata);
                  setProgress(groups.length || unique.length ? 'Enhancement succeeded and analysis produced results.' : 'Enhancement completed but no questions found.');
                  setShowEnhanceOption(false);
                }
              } catch (err) {
                console.error('Enhance retry failed', err);
                alert((err.response && err.response.data && (err.response.data.error || err.response.data.detail)) || err.message || 'Enhancement failed');
              } finally {
                setLoading(false);
              }
            }}
            className="enhance-button"
          >
            Enhance & Retry
          </button>
        </div>
      )}
      
      {processingTime && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '6px',
          textAlign: 'center',
          color: '#2e7d32',
          fontWeight: '500'
        }}>
          ✓ Analysis completed in {processingTime} seconds
        </div>
      )}
      
      {progress && !loading && (
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          backgroundColor: '#fff3cd', 
          borderRadius: '6px',
          textAlign: 'center',
          color: '#856404',
          fontSize: '14px'
        }}>
          {progress}
        </div>
      )}
    </div>
  );
}
