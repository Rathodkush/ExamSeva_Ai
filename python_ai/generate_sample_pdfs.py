"""
Generate small synthetic PDF exam papers for testing.
"""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend', 'uploads')
os.makedirs(OUT_DIR, exist_ok=True)

papers = {
    'sample_paper_1.pdf': [
        "1. What is the Internet of Things?",
        "2. Which of the following is a prime number?",
        "A. 4",
        "B. 9",
        "C. 7",
        "D. 15",
        "[Answer: C]",
        "3. Define photosynthesis",
    ],
    'sample_paper_2.pdf': [
        "1. Explain Internet of Things",
        "2. Which of the following is a prime number?",
        "A. 15",
        "B. 7",
        "C. 9",
        "D. 4",
        "[Answer: B]",
        "3. Explain the process of photosynthesis",
    ]
}

for fname, lines in papers.items():
    path = os.path.join(OUT_DIR, fname)
    c = canvas.Canvas(path, pagesize=letter)
    width, height = letter
    y = height - 72
    for line in lines:
        c.drawString(72, y, line)
        y -= 18
        if y < 72:
            c.showPage()
            y = height - 72
    c.save()
    print(f"Created: {path}")
