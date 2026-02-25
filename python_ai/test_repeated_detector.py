"""
Test script for the Repeated Question Detector
Demonstrates basic usage and testing
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from repeated_question_detector import RepeatedQuestionAnalyzer, TextPreprocessor


def test_text_preprocessing():
    """Test text preprocessing functionality."""
    print("\n" + "="*80)
    print("TEST 1: Text Preprocessing".center(80))
    print("="*80)
    
    test_cases = [
        "What is the Internet of Things?",
        "Define Internet of Things (IoT)",
        "Explain what IoT means",
        "What does IoT stand for?",
    ]
    
    print("\nOriginal texts:")
    for i, text in enumerate(test_cases, 1):
        print(f"  {i}. {text}")
    
    print("\nNormalized texts:")
    preprocessor = TextPreprocessor()
    for i, text in enumerate(test_cases, 1):
        normalized = preprocessor.clean(text)
        keywords = preprocessor.extract_keywords(text)
        print(f"  {i}. {normalized}")
        print(f"     Keywords: {keywords}")
    
    print("\n✅ Preprocessing test completed\n")


def test_with_sample_questions():
    """Test with sample text questions (no PDFs)."""
    print("\n" + "="*80)
    print("TEST 2: Semantic Similarity with Sample Questions".center(80))
    print("="*80)
    
    # Create analyzer
    analyzer = RepeatedQuestionAnalyzer(similarity_threshold=0.75)
    
    # Sample questions that should be grouped
    sample_questions = [
        "What is the Internet of Things?",
        "Explain Internet of Things",
        "Define IoT",
        "What do you understand by Internet of Things?",
        
        "What is photosynthesis?",
        "Explain the process of photosynthesis",
        "Define photosynthesis",
        
        "What is velocity?",
        "Define velocity in physics",
        "What do you mean by velocity?",
        
        "What is osmosis?",
        "Explain osmosis",
        "Define osmosis in biology",
    ]

    # Add swapped-options example (should be detected as duplicate)
    sample_questions += [
        "Which of the following is a prime number?\nA. 4\nB. 9\nC. 7\nD. 15\n[Answer: C]",
        "Which of the following is a prime number?\nA. 15\nB. 7\nC. 9\nD. 4\n[Answer: B]",
    ]
    
    print(f"\nInput: {len(sample_questions)} sample questions")
    for i, q in enumerate(sample_questions, 1):
        print(f"  {i:2d}. {q}")
    
    # Manually create Question objects and process
    from repeated_question_detector import Question
    import numpy as np
    
    print("\n📊 Processing questions...")
    
    analyzer.questions = [
        Question(id=i, text=q, source_file="sample.txt", page_number=1)
        for i, q in enumerate(sample_questions)
    ]
    
    # Preprocess
    print("  • Preprocessing...", end="", flush=True)
    analyzer._preprocess_questions()
    print(" ✓")
    
    # Generate embeddings
    print("  • Generating embeddings...", end="", flush=True)
    analyzer._generate_embeddings()
    print(" ✓")
    
    # Compute similarity
    print("  • Computing similarity matrix...", end="", flush=True)
    analyzer._compute_similarity()
    print(" ✓")
    
    # Cluster
    print("  • Clustering...", end="", flush=True)
    analyzer._cluster_questions()
    print(" ✓")
    
    # Generate results
    print("  • Generating results...", end="", flush=True)
    analyzer.results = analyzer._generate_results()
    print(" ✓")
    
    # Display results
    analyzer.print_summary()
    
    # Save results
    output_file = os.path.join(os.path.dirname(__file__), "test_results.json")
    analyzer.save_results(output_file)
    print(f"\n💾 Results saved to: {output_file}")
    
    return analyzer


def validate_pdf_extraction():
    """Check if PDF extraction is available."""
    print("\n" + "="*80)
    print("TEST 3: PDF Extraction Capability".center(80))
    print("="*80)
    
    print("\n🔍 Checking dependencies:")
    
    try:
        import pdfplumber
        print("  ✅ pdfplumber: Available")
    except ImportError:
        print("  ❌ pdfplumber: Not installed")
        print("     Install with: pip install pdfplumber")
    
    try:
        from PyPDF2 import PdfReader
        print("  ✅ PyPDF2: Available (fallback)")
    except ImportError:
        print("  ⚠️  PyPDF2: Not installed (fallback)")
    
    try:
        from sentence_transformers import SentenceTransformer
        print("  ✅ sentence-transformers: Available")
    except ImportError:
        print("  ❌ sentence-transformers: Not installed")
        print("     Install with: pip install sentence-transformers")
    
    try:
        from sklearn.cluster import AgglomerativeClustering
        print("  ✅ scikit-learn: Available")
    except ImportError:
        print("  ❌ scikit-learn: Not installed")
        print("     Install with: pip install scikit-learn")
    
    print()


def demonstrate_similarity_scores():
    """Demonstrate similarity score interpretation."""
    print("\n" + "="*80)
    print("TEST 4: Understanding Similarity Scores".center(80))
    print("="*80)
    
    print("""
Similarity Score Interpretation:
  • 1.00 (100%): Identical or semantically equivalent questions
  • 0.90-0.99 (90-99%): Extremely similar, definitely duplicates
  • 0.80-0.89 (80-89%): Very similar, likely duplicates [DEFAULT THRESHOLD]
  • 0.70-0.79 (70-79%): Similar, possibly related questions
  • 0.60-0.69 (60-69%): Somewhat related questions
  • 0.00-0.59 (0-59%): Different questions
    
Recommended Thresholds:
  • Strict: 0.90 (only very obvious duplicates)
  • Moderate: 0.80 (good balance, default)
  • Lenient: 0.70 (captures variations and paraphrases)
  • Very Lenient: 0.60 (includes topic-related questions)
""")


if __name__ == "__main__":
    print("\n" + "🎓 "*40)
    print("REPEATED QUESTION DETECTOR - TEST SUITE".center(80))
    print("🎓 "*40)
    
    # Run tests
    test_text_preprocessing()
    validate_pdf_extraction()
    demonstrate_similarity_scores()
    analyzer = test_with_sample_questions()
    
    print("\n" + "="*80)
    print("✅ All tests completed successfully!".center(80))
    print("="*80)
    print("""
Next Steps:
  1. Install required packages:
     pip install pdfplumber sentence-transformers scikit-learn numpy

  2. Use with PDF files:
     python repeated_question_detector.py file1.pdf file2.pdf --output results.json

  3. Adjust similarity threshold if needed:
     python repeated_question_detector.py file1.pdf --threshold 0.75

For more information, see REPEATED_QUESTIONS_DETECTOR_GUIDE.md
""")
