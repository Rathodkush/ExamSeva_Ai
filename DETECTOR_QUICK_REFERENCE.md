# Repeated Question Detector - Quick Reference Card

## Installation (One-time)
```bash
cd python_ai
pip install pdfplumber sentence-transformers scikit-learn numpy
```

## Basic Usage

### Analyze Single PDF
```bash
python repeated_question_detector.py exam.pdf
```

### Analyze Multiple PDFs
```bash
python repeated_question_detector.py exam1.pdf exam2.pdf exam3.pdf
```

### Custom Output File
```bash
python repeated_question_detector.py exam.pdf -o results.json
```

### Custom Threshold (Strict → Lenient)
```bash
python repeated_question_detector.py exam.pdf --threshold 0.90  # Strict
python repeated_question_detector.py exam.pdf --threshold 0.80  # Default (Balanced)
python repeated_question_detector.py exam.pdf --threshold 0.70  # Lenient
```

### Custom Model
```bash
python repeated_question_detector.py exam.pdf --model all-mpnet-base-v2
```

## Python API

### Minimal Code
```python
from repeated_question_detector import RepeatedQuestionAnalyzer

analyzer = RepeatedQuestionAnalyzer()
results = analyzer.analyze_pdfs(['exam.pdf'])
analyzer.print_summary()
analyzer.save_results('results.json')
```

### With Custom Settings
```python
analyzer = RepeatedQuestionAnalyzer(
    model_name="all-MiniLM-L6-v2",
    similarity_threshold=0.80
)
results = analyzer.analyze_pdfs(['exam1.pdf', 'exam2.pdf'])
```

### Access Results
```python
# Summary
total = results['summary']['total_questions']
groups = results['summary']['repeated_question_groups']

# Detailed groups
for group in results['repeated_groups']:
    print(f"Group {group['group_id']}: {group['total_variants']} variants")
    print(f"  Similarity: {group['similarity_score']:.1%}")
    print(f"  Questions: {group['questions']}")
```

## Similarity Thresholds

| Threshold | Use When |
|-----------|----------|
| 0.90+ | Maximum precision, only obvious duplicates |
| 0.85 | Clear duplicates with slight variation |
| **0.80** | **DEFAULT - Good balance** |
| 0.75 | Include paraphrases and variations |
| 0.70 | Include loosely related questions |
| 0.60 | Broad topic clustering |

## Common Commands

### Test Installation
```bash
python test_repeated_detector.py
```

### Run Setup Wizard
```bash
python setup_detector.py
```

### Process by Subject (Python)
```python
for subject in ['Math', 'Physics', 'Biology']:
    pdfs = load_pdfs(subject)
    analyzer = RepeatedQuestionAnalyzer(threshold=0.80)
    results = analyzer.analyze_pdfs(pdfs)
    analyzer.save_results(f'{subject}_analysis.json')
```

### Process Batch (Shell)
```bash
for file in *.pdf; do
    python repeated_question_detector.py "$file" -o "${file%.pdf}_analysis.json"
done
```

## Output Files

- `repeated_questions_analysis.json` - Full results with all details
- `exam_analysis.log` - Debug log with processing details

## JSON Output Structure

```json
{
  "summary": {
    "total_questions": 25,
    "unique_questions": 18,
    "repeated_question_groups": 7,
    "total_repeated_questions": 7,
    "similarity_threshold": 0.80
  },
  "repeated_groups": [
    {
      "group_id": 1,
      "similarity_score": 0.88,
      "representative_question": "...",
      "total_variants": 3,
      "questions": [
        {
          "id": 0,
          "text": "...",
          "source_file": "exam.pdf",
          "page_number": 1,
          "similarity_to_representative": 0.98
        }
      ]
    }
  ],
  "questions": [...]
}
```

## What Each Score Means

- **0.95+** = Duplicate (same thing exactly)
- **0.85-0.94** = Very similar (clear duplicate)
- **0.75-0.84** = Similar (same concept)
- **0.65-0.74** = Related (connected topic)
- **<0.65** = Different (unrelated)

## Embedding Models

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| all-MiniLM-L6-v2 | ⚡⚡⚡ | ⭐⭐⭐⭐ | **DEFAULT - Exams** |
| all-mpnet-base-v2 | ⚡⚡ | ⭐⭐⭐⭐⭐ | Maximum accuracy |
| paraphrase-MiniLM-L6-v2 | ⚡⚡⚡ | ⭐⭐⭐⭐ | Paraphrases |
| paraphrase-mpnet-base-v2 | ⚡ | ⭐⭐⭐⭐⭐ | Max accuracy (slow) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No questions extracted | Check PDF has selectable text (not image) |
| Too many false positives | Increase threshold to 0.85-0.90 |
| Missing obvious duplicates | Decrease threshold to 0.70-0.75 |
| Slow processing | Use all-MiniLM-L6-v2 model |
| Memory error | Process fewer PDFs at once |

## Performance (Rough Estimates)

| # Questions | Time | Memory |
|------------|------|--------|
| 10 | <1s | 50MB |
| 50 | 2s | 100MB |
| 100 | 5s | 200MB |
| 500 | 30s | 500MB |
| 1000 | 2 min | 1GB |

## Integration with ExamSeva

### Backend Call
```javascript
const response = await axios.post('http://localhost:5000/analyze', {
    file_path: '/path/to/exam.pdf',
    threshold: 0.80
});
```

### Frontend Display
```jsx
<RepeatedGroupsDisplay groups={analysisData.repeated_groups} />
```

## Documentation

- **REPEATED_QUESTIONS_DETECTOR_GUIDE.md** - Complete reference (1000+ lines)
- **INTEGRATION_GUIDE.md** - Backend/frontend setup (900+ lines)
- **test_repeated_detector.py** - Working examples
- **setup_detector.py** - Interactive setup
- **repeated_question_detector.py** - Full source code (704 lines, well documented)

## First Run Checklist

- [ ] Install: `pip install pdfplumber sentence-transformers scikit-learn`
- [ ] Test: `python test_repeated_detector.py`
- [ ] Analyze: `python repeated_question_detector.py exam.pdf`
- [ ] Review: Open `repeated_questions_analysis.json`
- [ ] Adjust threshold if needed
- [ ] Integrate into backend (see INTEGRATION_GUIDE.md)

## One-Liners

```bash
# Analyze all PDFs in folder
for f in *.pdf; do python repeated_question_detector.py "$f"; done

# Quick test with defaults
python repeated_question_detector.py sample.pdf && cat repeated_questions_analysis.json

# Parse results with jq
cat repeated_questions_analysis.json | jq '.repeated_groups | length'

# Strict analysis
python repeated_question_detector.py exam.pdf --threshold 0.90

# Export to CSV (requires Python)
python -c "import json; data=json.load(open('results.json')); print('\\n'.join(str(g) for g in data['repeated_groups']))"
```

## Key Classes & Methods

```python
# Main class
RepeatedQuestionAnalyzer(model_name, similarity_threshold)

# Methods
.analyze_pdfs(pdf_paths)        # Run full analysis
.save_results(output_file)      # Save JSON
.print_summary()                # Display results
._generate_embeddings()         # Create vectors
._cluster_questions()           # Group similar ones

# Utilities
TextPreprocessor.normalize(text)
TextPreprocessor.clean(text)
TextPreprocessor.extract_keywords(text)

# Data classes
Question(id, text, source_file, page_number)
RepeatedQuestionGroup(group_id, similarity_score, questions)
```

## Environment Variables (Optional)

```bash
export PYTHON_SERVICE_URL=http://localhost:5000
export SIMILARITY_THRESHOLD=0.80
export EMBEDDING_MODEL=all-MiniLM-L6-v2
export MAX_QUESTIONS=1000
```

## Notes

- First run downloads ~400MB of ML models (cached for subsequent runs)
- Supports PDF with selectable text (not scanned images without OCR)
- Default threshold 0.80 is recommended for exam questions
- Results include source file and page numbers for verification
- JSON output preserves all similarity scores for analysis

---

**Quick Start**: `python test_repeated_detector.py` then `python repeated_question_detector.py yourfile.pdf`

**Full Docs**: See README_DETECTOR.md or REPEATED_QUESTIONS_DETECTOR_GUIDE.md
