# Repeated Question Detector - Integration Guide

This guide explains how to integrate the new Repeated Question Detector into the ExamSeva backend and frontend.

## Quick Start (For Immediate Use)

### 1. Install Dependencies
```bash
cd python_ai
pip install pdfplumber sentence-transformers scikit-learn numpy
```

### 2. Test the Detector
```bash
python test_repeated_detector.py
```

### 3. Analyze Your Exam Papers
```bash
python repeated_question_detector.py exam1.pdf exam2.pdf --output results.json
```

---

## Architecture

The repeated question detector fits into ExamSeva's architecture as follows:

```
┌─────────────┐
│   Frontend  │  (React)
│   Port 3000 │
└──────┬──────┘
       │ /uploadpaper
       │ /results
       │
┌──────▼──────────────────────────────────────┐
│        Backend (Node.js/Express)            │
│         Port 4000                           │
│  ┌──────────────────────────────────────┐  │
│  │  /api/upload                         │  │
│  │  1. Receive PDF                      │  │
│  │  2. Call Python Analyzer             │  │
│  │  3. Store in MongoDB                 │  │
│  └──────────┬───────────────────────────┘  │
│             │                               │
│  ┌──────────▼───────────────────────────┐  │
│  │ /api/uploads                         │  │
│  │ Return cached results from DB        │  │
│  └──────────────────────────────────────┘  │
└──────┬──────────────────────────────────────┘
       │ http://localhost:5000/analyze
       │
┌──────▼──────────────────────────┐
│  Python AI Service              │
│  Port 5000 (Flask)              │
│  ┌────────────────────────────┐ │
│  │ repeated_question_detector │ │
│  │ - Extract from PDF         │ │
│  │ - Semantic analysis        │ │
│  │ - Clustering               │ │
│  │ - Return JSON results      │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
       │
┌──────▼──────────────────────┐
│  MongoDB                     │
│  Collections:                │
│  - uploads (file metadata)   │
│  - repeated_groups (results) │
└──────────────────────────────┘
```

---

## Backend Integration (Node.js)

### Option 1: Use Existing `/api/upload` Endpoint (Recommended)

The backend's `/api/upload` endpoint already calls the Python service. To use the new detector:

```javascript
// backend/server.js

const axios = require('axios');
const { UploadModel } = require('./models');

app.post('/api/upload', async (req, res) => {
    try {
        const filePath = req.file.path; // Path to uploaded PDF
        
        // Call Python analyzer (UPDATED TO USE NEW DETECTOR)
        const response = await axios.post('http://localhost:5000/analyze', {
            file_path: filePath,
            threshold: 0.80  // Can be configurable
        });
        
        // response.data contains:
        // {
        //   summary: { total_questions, repeated_groups, etc },
        //   repeated_groups: [ { group_id, similarity_score, questions } ],
        //   questions: [ { id, text, source_file } ]
        // }
        
        // Store in MongoDB
        const upload = new UploadModel({
            filename: req.file.originalname,
            uploadDate: new Date(),
            groups: response.data.repeated_groups,
            unique: response.data.summary.unique_questions,
            total: response.data.summary.total_questions,
            all_questions: response.data.questions
        });
        
        await upload.save();
        
        res.json({
            success: true,
            analysis: response.data.summary,
            groups: response.data.repeated_groups
        });
        
    } catch (error) {
        logger.error('Analysis error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});
```

### Option 2: Create New `/api/detect-repeated` Endpoint

For dedicated repeated question detection:

```javascript
app.post('/api/detect-repeated', async (req, res) => {
    try {
        const { pdf_ids, threshold = 0.80 } = req.body;
        
        // Get PDFs from storage
        const files = await UploadModel.find({ _id: { $in: pdf_ids } });
        const filePaths = files.map(f => f.filePath);
        
        // Analyze for repeated questions
        const response = await axios.post('http://localhost:5000/analyze-batch', {
            file_paths: filePaths,
            threshold: threshold,
            mode: 'cross-file'  // Compare across all files
        });
        
        res.json(response.data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Option 3: Batch Analysis Endpoint

```javascript
app.post('/api/analyze-all-papers', async (req, res) => {
    try {
        const { subject, year } = req.query;
        
        // Find all papers for subject/year
        const papers = await UploadModel.find({ subject, year });
        const filePaths = papers.map(p => p.filePath);
        
        // Run integrated analysis
        const response = await axios.post('http://localhost:5000/analyze-batch', {
            file_paths: filePaths,
            threshold: 0.80,
            group_across_files: true
        });
        
        // Save batch results
        const batchResult = new BatchAnalysisModel({
            subject,
            year,
            total_papers: filePaths.length,
            analysis_result: response.data,
            created_at: new Date()
        });
        
        await batchResult.save();
        
        res.json(response.data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## Python Backend Integration

### Update `python_ai/app.py` 

Add a new "/analyze-batch" endpoint to support multiple PDFs:

```python
# python_ai/app.py (add to existing Flask app)

from repeated_question_detector import RepeatedQuestionAnalyzer

@app.route('/analyze-batch', methods=['POST'])
def analyze_batch():
    """Analyze multiple PDFs for repeated questions."""
    try:
        data = request.json
        file_paths = data.get('file_paths', [])
        threshold = data.get('threshold', 0.80)
        
        # Validate files
        valid_paths = [p for p in file_paths if os.path.exists(p)]
        if not valid_paths:
            return {
                'error': 'No valid PDF files provided',
                'received': len(file_paths),
                'valid': len(valid_paths)
            }, 400
        
        # Run analyzer
        analyzer = RepeatedQuestionAnalyzer(
            model_name="all-MiniLM-L6-v2",
            similarity_threshold=threshold
        )
        
        results = analyzer.analyze_pdfs(valid_paths)
        
        return {
            'status': 'success',
            'analysis': results,
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Batch analysis error: {str(e)}")
        return {'error': str(e)}, 500


@app.route('/analyze', methods=['POST'])
def analyze_single():
    """Analyze single PDF (existing endpoint, can be updated)."""
    try:
        data = request.json
        file_path = data.get('file_path')
        threshold = data.get('threshold', 0.80)
        
        # Use new detector
        analyzer = RepeatedQuestionAnalyzer(
            similarity_threshold=threshold
        )
        
        results = analyzer.analyze_pdfs([file_path])
        
        return {
            'status': 'success',
            'analysis': results,
            'summary': results['summary']
        }
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return {'error': str(e)}, 500
```

---

## Frontend Integration (React)

### 1. Update Results Page

```javascript
// frontend/src/pages/Results.jsx (UPDATED)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RepeatedGroupsDisplay from '../components/RepeatedGroupsDisplay';

export default function Results() {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchAnalysis();
    }, []);
    
    const fetchAnalysis = async () => {
        try {
            // Get uploaded papers and their analysis
            const response = await axios.get('/api/uploads');
            
            // Group by subject/semester
            const grouped = groupBySubject(response.data);
            
            setAnalysis(grouped);
            setLoading(false);
            
        } catch (error) {
            console.error('Error fetching analysis:', error);
            setLoading(false);
        }
    };
    
    if (loading) return <div>Loading analysis...</div>;
    
    return (
        <div className="results-container">
            <h1>Repeated Question Analysis</h1>
            
            {analysis && Object.entries(analysis).map(([subject, data]) => (
                <div key={subject} className="subject-section">
                    <h2>{subject}</h2>
                    
                    {/* Summary Stats */}
                    <div className="stats">
                        <div className="stat">
                            <h4>{data.total_questions}</h4>
                            <p>Total Questions</p>
                        </div>
                        <div className="stat">
                            <h4>{data.unique_questions}</h4>
                            <p>Unique Questions</p>
                        </div>
                        <div className="stat">
                            <h4>{data.repeated_question_groups}</h4>
                            <p>Repeated Groups</p>
                        </div>
                    </div>
                    
                    {/* Repeated Groups */}
                    <RepeatedGroupsDisplay groups={data.repeated_groups} />
                </div>
            ))}
        </div>
    );
}
```

### 2. Create Repeated Groups Display Component

```javascript
// frontend/src/components/RepeatedGroupsDisplay.jsx (NEW)

import React from 'react';
import './RepeatedGroupsDisplay.css';

export default function RepeatedGroupsDisplay({ groups }) {
    const [expandedGroup, setExpandedGroup] = React.useState(null);
    
    if (!groups || groups.length === 0) {
        return <div className="no-groups">✅ No repeated questions found!</div>;
    }
    
    return (
        <div className="groups-container">
            {groups.map(group => (
                <div key={group.group_id} className="group-card">
                    <div 
                        className="group-header"
                        onClick={() => setExpandedGroup(
                            expandedGroup === group.group_id ? null : group.group_id
                        )}
                    >
                        <div className="group-info">
                            <h3>Group {group.group_id}</h3>
                            <p className="variants">
                                {group.total_variants} variants
                            </p>
                            <p className="similarity">
                                Similarity: {(group.similarity_score * 100).toFixed(1)}%
                            </p>
                        </div>
                        <button className="expand-btn">
                            {expandedGroup === group.group_id ? '−' : '+'}
                        </button>
                    </div>
                    
                    {expandedGroup === group.group_id && (
                        <div className="group-content">
                            <div className="representative">
                                <h4>📋 Representative Question</h4>
                                <p>{group.representative_question}</p>
                            </div>
                            
                            <div className="all-variants">
                                <h4>🔄 All Variants ({group.questions.length})</h4>
                                {group.questions.map((question, idx) => (
                                    <div key={idx} className="variant">
                                        <p>{question.text}</p>
                                        <div className="meta">
                                            <span className="file">
                                                📄 {question.source_file}
                                            </span>
                                            <span className="page">
                                                Page {question.page_number}
                                            </span>
                                            <span className="sim">
                                                {(question.similarity_to_representative * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
```

### 3. CSS Styling

```css
/* frontend/src/components/RepeatedGroupsDisplay.css (NEW) */

.groups-container {
    display: grid;
    gap: 16px;
    margin-top: 20px;
}

.group-card {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    cursor: pointer;
    background: #f9f9f9;
    border-bottom: 1px solid #e0e0e0;
    transition: background 0.2s;
}

.group-header:hover {
    background: #f0f0f0;
}

.group-info h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: #333;
}

.variants, .similarity {
    margin: 4px 0;
    font-size: 14px;
    color: #666;
}

.similarity {
    font-weight: 600;
    color: #1976d2;
}

.expand-btn {
    border: none;
    background: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    padding: 0 8px;
}

.group-content {
    padding: 16px;
}

.representative {
    margin-bottom: 20px;
    padding: 12px;
    background: #f0f7ff;
    border-left: 4px solid #1976d2;
    border-radius: 4px;
}

.representative h4 {
    margin: 0 0 8px 0;
    color: #1976d2;
}

.representative p {
    margin: 0;
    color: #333;
    line-height: 1.5;
}

.all-variants h4 {
    margin: 0 0 12px 0;
    color: #333;
}

.variant {
    padding: 12px;
    margin-bottom: 8px;
    background: #fafafa;
    border-radius: 4px;
    border-left: 3px solid #ff9800;
}

.variant p {
    margin: 0 0 8px 0;
    line-height: 1.5;
    color: #333;
}

.meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #999;
}

.meta span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.no-groups {
    padding: 32px;
    text-align: center;
    color: #4caf50;
    font-size: 18px;
    background: #f1f8f4;
    border-radius: 8px;
}
```

---

## Configuration

### Threshold Settings (in Backend)

```javascript
// backend/config.js (or environment variables)

module.exports = {
    // Repeated question detection
    SIMILARITY_THRESHOLD: process.env.SIMILARITY_THRESHOLD || 0.80,
    
    // Models to use
    EMBEDDING_MODEL: 'all-MiniLM-L6-v2',
    
    // Processing
    BATCH_SIZE: 32,
    MAX_QUESTIONS_PER_PDF: 1000,
    
    // Cache settings
    CACHE_RESULTS: true,
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000  // 7 days
};
```

### Environment Variables

```bash
# .env

# Python service
PYTHON_SERVICE_URL=http://localhost:5000

# Analysis parameters
SIMILARITY_THRESHOLD=0.80
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Performance
MAX_CONCURRENT_ANALYSES=3
ANALYSIS_TIMEOUT=300000
```

---

## Testing Integration

### Backend Test

```javascript
// backend/test_detector_integration.js

const axios = require('axios');
const fs = require('fs');

async function testDetectorIntegration() {
    try {
        console.log('Testing Repeated Question Detector Integration...\n');
        
        // Test 1: Single PDF analysis
        console.log('Test 1: Single PDF analysis');
        const response = await axios.post('http://localhost:4000/api/upload', {
            file: fs.readFileSync('test_exam.pdf'),
            filename: 'test_exam.pdf'
        });
        
        console.log(`✓ Total questions: ${response.data.analysis.total_questions}`);
        console.log(`✓ Repeated groups: ${response.data.analysis.repeated_question_groups}`);
        
        // Test 2: Check database results
        console.log('\nTest 2: Check database storage');
        const dbResponse = await axios.get('http://localhost:4000/api/uploads');
        console.log(`✓ Stored analyses: ${dbResponse.data.length}`);
        
        console.log('\n✅ Integration test passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testDetectorIntegration();
```

### Frontend Test

```javascript
// frontend/src/__tests__/RepeatedGroupsDisplay.test.js

import React from 'react';
import { render, screen } from '@testing-library/react';
import RepeatedGroupsDisplay from '../components/RepeatedGroupsDisplay';

describe('RepeatedGroupsDisplay', () => {
    const mockGroups = [
        {
            group_id: 1,
            total_variants: 3,
            similarity_score: 0.88,
            representative_question: 'What is photosynthesis?',
            questions: [
                {
                    text: 'What is photosynthesis?',
                    source_file: 'exam1.pdf',
                    page_number: 1,
                    similarity_to_representative: 0.98
                }
            ]
        }
    ];
    
    test('renders repeated groups', () => {
        render(<RepeatedGroupsDisplay groups={mockGroups} />);
        expect(screen.getByText('Group 1')).toBeInTheDocument();
        expect(screen.getByText('3 variants')).toBeInTheDocument();
    });
});
```

---

## Performance Optimization

### Caching Strategy

```python
# python_ai/cache.py (NEW)

import hashlib
import json
from pathlib import Path

class AnalysisCache:
    """Cache analysis results to avoid re-processing."""
    
    def __init__(self, cache_dir='cache'):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
    
    def get_hash(self, file_path):
        """Get SHA256 hash of file."""
        sha = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                sha.update(chunk)
        return sha.hexdigest()
    
    def get(self, file_path):
        """Retrieve cached analysis."""
        file_hash = self.get_hash(file_path)
        cache_file = self.cache_dir / f"{file_hash}.json"
        
        if cache_file.exists():
            with open(cache_file) as f:
                return json.load(f)
        return None
    
    def set(self, file_path, results):
        """Cache analysis results."""
        file_hash = self.get_hash(file_path)
        cache_file = self.cache_dir / f"{file_hash}.json"
        
        with open(cache_file, 'w') as f:
            json.dump(results, f)
```

### Batch Processing

```python
from repeated_question_detector import RepeatedQuestionAnalyzer
from concurrent.futures import ThreadPoolExecutor

def analyze_papers_in_batch(pdf_paths, threshold=0.80, max_workers=2):
    """Analyze multiple PDFs efficiently."""
    
    # Group by subject to avoid cross-contamination
    from collections import defaultdict
    by_subject = defaultdict(list)
    
    for pdf_path in pdf_paths:
        subject = extract_subject(pdf_path)
        by_subject[subject].append(pdf_path)
    
    results = {}
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        
        for subject, paths in by_subject.items():
            future = executor.submit(
                lambda p: RepeatedQuestionAnalyzer(threshold).analyze_pdfs(p),
                paths
            )
            futures[subject] = future
        
        for subject, future in futures.items():
            results[subject] = future.result()
    
    return results
```

---

## Monitoring & Logging

### Analysis Metrics

```python
# Log analysis metrics for monitoring

import logging
from datetime import datetime

logger = logging.getLogger('RepeatedQuestionAnalyzer')

class AnalysisMetrics:
    """Track analysis performance metrics."""
    
    def __init__(self):
        self.analyses = []
    
    def log_analysis(self, file_count, question_count, group_count, duration):
        """Log completed analysis."""
        self.analyses.append({
            'timestamp': datetime.now(),
            'files': file_count,
            'questions': question_count,
            'groups': group_count,
            'duration_seconds': duration
        })
        
        logger.info(
            f"Analysis: {file_count} files, {question_count} questions, "
            f"{group_count} groups, {duration:.2f}s"
        )
```

---

## Deployment Checklist

- [ ] Install all dependencies (`pip install -r requirements.txt`)
- [ ] Update backend to call new detector
- [ ] Create frontend components for display
- [ ] Add database schema for repeated groups
- [ ] Configure similarity threshold (default 0.80)
- [ ] Test with sample PDFs
- [ ] Set up logging and monitoring
- [ ] Deploy to production server
- [ ] Update documentation
- [ ] Train users on feature

---

## Troubleshooting Integration

### Issue: Connection to Python Service Fails

```javascript
// backend/utils/pythonService.js

const axios = require('axios');

const client = axios.create({
    baseURL: process.env.PYTHON_SERVICE_URL || 'http://localhost:5000',
    timeout: 300000,  // 5 minutes
    retries: 3
});

// Retry logic
client.interceptors.response.use(null, async (error) => {
    const config = error.config;
    
    if (!config || !config.retries) {
        return Promise.reject(error);
    }
    
    config.retries -= 1;
    await new Promise(r => setTimeout(r, 1000));
    return client(config);
});

module.exports = client;
```

### Issue: Slow Analysis

```javascript
// Implement request queuing

const Queue = require('bull');
const analysisQueue = new Queue('analysis', {
    redis: { host: 'localhost', port: 6379 }
});

analysisQueue.process(5, async (job) => {
    // Process max 5 analyses concurrently
    return await analyzeFile(job.data.filePath);
});

// Add to queue instead of direct processing
app.post('/api/upload', async (req, res) => {
    const job = await analysisQueue.add({
        filePath: req.file.path
    });
    
    res.json({ jobId: job.id, status: 'queued' });
});
```

---

## Support & Documentation

- Main Guide: `REPEATED_QUESTIONS_DETECTOR_GUIDE.md`
- API Documentation: See docstrings in `repeated_question_detector.py`
- Examples: Check `test_repeated_detector.py`

For questions or issues, refer to the troubleshooting sections in the main guide.
