#!/usr/bin/env python3
"""
Quick Start Guide - Running the Detector with Your Exam Papers
"""

import os
import sys
import subprocess
from pathlib import Path

def check_dependencies():
    """Check if all required packages are installed."""
    required_packages = {
        'pdfplumber': 'PDF extraction',
        'sentence_transformers': 'Semantic similarity',
        'scikit-learn': 'Clustering algorithm',
        'numpy': 'Numerical operations'
    }
    
    missing = []
    for package, purpose in required_packages.items():
        try:
            __import__(package)
            print(f"  ✅ {package:<25} - {purpose}")
        except ImportError:
            print(f"  ❌ {package:<25} - {purpose}")
            missing.append(package)
    
    return missing


def install_dependencies(packages):
    """Install missing packages."""
    print("\n🔧 Installing missing packages...")
    for package in packages:
        # Map common package names
        pip_name = package
        if package == 'sklearn':
            pip_name = 'scikit-learn'
        
        print(f"  Installing {pip_name}...", end="", flush=True)
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', pip_name],
            capture_output=True
        )
        if result.returncode == 0:
            print(" ✓")
        else:
            print(" ✗")
            print(f"    Error: {result.stderr.decode()}")
    
    return len(packages) == 0


def main():
    """Main setup function."""
    print("\n" + "="*80)
    print("EXAM QUESTION DETECTOR - SETUP & QUICK START".center(80))
    print("="*80)
    
    # Check Python version
    print(f"\n📌 Python Version: {sys.version}")
    
    # Check dependencies
    print("\n📦 Checking dependencies:")
    missing = check_dependencies()
    
    if missing:
        print(f"\n⚠️  Missing {len(missing)} package(s)")
        response = input("Install missing packages now? (y/n): ").lower().strip()
        if response == 'y':
            install_dependencies(missing)
        else:
            print("Skipping installation. You can install manually with:")
            print(f"  pip install {' '.join(missing)}")
    else:
        print("\n✅ All dependencies installed!")
    
    # Show usage examples
    print("\n" + "-"*80)
    print("USAGE EXAMPLES".center(80))
    print("-"*80)
    
    print("""
1. Analyze Single PDF:
   python repeated_question_detector.py exam1.pdf -o results.json

2. Analyze Multiple PDFs:
   python repeated_question_detector.py exam1.pdf exam2.pdf exam3.pdf

3. Use Different Similarity Threshold:
   python repeated_question_detector.py *.pdf --threshold 0.75

4. Use Different Embedding Model:
   python repeated_question_detector.py exam.pdf --model all-mpnet-base-v2

5. View Results from Script:
   from repeated_question_detector import RepeatedQuestionAnalyzer
   analyzer = RepeatedQuestionAnalyzer()
   results = analyzer.analyze_pdfs(['exam1.pdf', 'exam2.pdf'])
   analyzer.print_summary()
""")
    
    # Show threshold guidance
    print("\n" + "-"*80)
    print("SIMILARITY THRESHOLD GUIDE".center(80))
    print("-"*80)
    
    print("""
Threshold  Meaning                          When to Use
─────────────────────────────────────────────────────────────
0.90       Only very obvious duplicates     When accuracy is critical
0.85       Clear duplicates                 Most common case (balanced)
0.80       Including paraphrases            DEFAULT - good balance
0.75       Including variations             Detect related questions
0.70       Broader topic match              Find all related content
0.60       Topic clustering                 When you have many variations
""")
    
    # Show embedding models
    print("\n" + "-"*80)
    print("AVAILABLE EMBEDDING MODELS".center(80))
    print("-"*80)
    
    print("""
Model Name                  Speed   Quality  Best For
─────────────────────────────────────────────────────────
all-MiniLM-L6-v2           Fast    Excellent  Exams (default)
all-mpnet-base-v2          Medium  Superior   Complex content
paraphrase-MiniLM-L6-v2    Fast    Good       Quick analysis
paraphrase-mpnet-base-v2   Slow    Excellent  Maximum accuracy
""")
    
    print("\n" + "="*80)
    print("✅ Setup complete! Ready to analyze exam questions.".center(80))
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
