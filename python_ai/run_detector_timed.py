"""
Timed detector runner - measures repeated question detection performance
"""

import os
import sys
import time
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from repeated_question_detector import RepeatedQuestionAnalyzer


def run_detector_timed(pdf_paths: list, output_file: str = "detection_results.json", threshold: float = 0.80):
    """
    Run detector and measure time taken.
    
    Args:
        pdf_paths: List of PDF file paths
        output_file: Output JSON file path
        threshold: Similarity threshold (default 0.80)
    
    Returns:
        Dict with results and timing info
    """
    print(f"\n{'='*80}")
    print(f"REPEATED QUESTION DETECTOR - PERFORMANCE TEST".center(80))
    print(f"{'='*80}\n")
    
    print(f"📁 Input PDFs: {len(pdf_paths)}")
    for pdf in pdf_paths:
        if os.path.exists(pdf):
            size_mb = os.path.getsize(pdf) / (1024 * 1024)
            print(f"   • {os.path.basename(pdf)} ({size_mb:.2f} MB)")
        else:
            print(f"   • {os.path.basename(pdf)} (NOT FOUND)")
    
    print(f"\n⚙️  Configuration:")
    print(f"   Similarity Threshold: {threshold}")
    print(f"   Output File: {output_file}\n")
    
    # Initialize analyzer
    start_time = time.time()
    print("🔧 Initializing semantic analyzer...", end="", flush=True)
    analyzer = RepeatedQuestionAnalyzer(similarity_threshold=threshold)
    init_time = time.time() - start_time
    print(f" ✓ ({init_time:.2f}s)")
    
    # Run analysis
    print("\n🔍 Running analysis...")
    analysis_start = time.time()
    
    try:
        results = analyzer.analyze_pdfs(pdf_paths)
        analysis_time = time.time() - analysis_start
        
        # Save results
        output_dir = os.path.dirname(os.path.abspath(output_file))
        os.makedirs(output_dir, exist_ok=True)
        analyzer.save_results(output_file)
        
        # Print summary
        analyzer.print_summary()
        
        # Print timing info
        total_time = time.time() - start_time
        print(f"\n{'='*80}")
        print(f"⏱️  PERFORMANCE METRICS".center(80))
        print(f"{'='*80}")
        print(f"  Model Initialization:    {init_time:7.2f}s")
        print(f"  Analysis Time:           {analysis_time:7.2f}s")
        print(f"  Total Time:              {total_time:7.2f}s")
        print(f"\n  Status: {'✅ PASSED' if total_time <= 20 else '⚠️  EXCEEDED'} (target: ≤20s)")
        print(f"{'='*80}\n")
        
        return {
            "status": "success" if total_time <= 20 else "slow",
            "total_time": total_time,
            "init_time": init_time,
            "analysis_time": analysis_time,
            "results": results
        }
        
    except Exception as e:
        error_time = time.time() - analysis_start
        print(f"\n❌ ERROR: {str(e)}")
        print(f"  Time elapsed: {error_time:.2f}s")
        return {
            "status": "error",
            "total_time": error_time,
            "error": str(e)
        }


if __name__ == "__main__":
    # Find sample PDFs in backend/uploads
    uploads_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "uploads")
    
    # Get first PDF file found
    pdf_paths = []
    if os.path.exists(uploads_dir):
        for root, dirs, files in os.walk(uploads_dir):
            # Skip 'notes' and 'quizzes' subdirs  
            dirs[:] = [d for d in dirs if d not in ['notes', 'quizzes', '__pycache__']]
            for file in files:
                if file.lower().endswith('.pdf'):
                    pdf_paths.append(os.path.join(root, file))
                    if len(pdf_paths) >= 3:  # Test with first 3 PDFs
                        break
            if len(pdf_paths) >= 3:
                break
    
    if not pdf_paths:
        print("\n❌ No PDF files found in backend/uploads")
        print("   Please add some sample PDF exam papers to test.\n")
        sys.exit(1)
    
    output_file = os.path.join(os.path.dirname(__file__), "detection_results.json")
    timing_info = run_detector_timed(pdf_paths, output_file, threshold=0.80)
    
    # Save timing info separately
    timing_file = os.path.join(os.path.dirname(__file__), "timing_report.json")
    with open(timing_file, 'w') as f:
        json.dump(timing_info, f, indent=2, default=str)
    
    print(f"📊 Timing report saved to: {timing_file}")
