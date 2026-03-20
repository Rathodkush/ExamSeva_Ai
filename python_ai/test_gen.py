import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from app import generate_questions_from_text

test_text = """
Java is a class-based, object-oriented programming language. 
The main features of Java include platform independence, security, and multi-threading.
Inheritance refers to the mechanism in Java by which one class is allowed to inherit the features of another class.
Polymorphism is the ability of an object to take on many forms.
Encapsulation means wrapping data and codes together as a single unit.
"""

print("--- Testing regular Quiz (includes FITB) ---")
quiz = generate_questions_from_text(test_text, num_questions=5, for_paper=False)
for q in quiz:
    print(f"Q: {q['question']}")

print("\n--- Testing Question Paper (excl. FITB, enhanced tags) ---")
paper = generate_questions_from_text(test_text, num_questions=5, for_paper=True)
for q in paper:
    print(f"Q: {q['question']}")
    if 'options' in q:
        print(f"Options: {q['options']}")
