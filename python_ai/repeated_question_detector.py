"""
ExamSeva - Repeated Question Detector
======================================
A robust Python program to detect semantically similar (repeated) exam questions 
from multiple PDF files using advanced NLP techniques.

Features:
- Extract questions from PDFs using pdfplumber
- Semantic similarity using sentence-transformers
- Smart clustering of similar questions
- JSON output with detailed results
- Production-ready with error handling and logging

Installation:
    pip install pdfplumber sentence-transformers scikit-learn numpy

Author: ExamSeva Team
Version: 2.0 (Production Ready)
"""

import os
import json
import re
import logging
import sys
from pathlib import Path
from typing import List, Dict, Tuple, Set
from dataclasses import dataclass, asdict
from collections import defaultdict
import traceback

import numpy as np
import io
from PIL import Image
import cv2
from sklearn.cluster import AgglomerativeClustering
from sentence_transformers import SentenceTransformer, util

# Optional: pdfplumber for PDF extraction
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False
    print("WARNING: pdfplumber not installed. PDF extraction will be limited.")

# Optional OCR libraries
try:
    import easyocr
    EASYOCR_AVAILABLE = True
except Exception:
    EASYOCR_AVAILABLE = False

try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except Exception:
    PYTESSERACT_AVAILABLE = False


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

def setup_logging(log_file: str = "exam_analysis.log") -> logging.Logger:
    """Configure logging with both file and console output."""
    logger = logging.getLogger("ExamSeva")
    logger.setLevel(logging.DEBUG)
    
    # File handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger


logger = setup_logging()


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class Question:
    """Represents a single question."""
    id: int
    text: str
    source_file: str
    page_number: int = 0
    embedding: np.ndarray = None
    canonical_text: str = None
    canonical_embedding: np.ndarray = None
    answer: str = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary, converting numpy array to list."""
        data = asdict(self)
        if self.embedding is not None:
            data['embedding'] = self.embedding.tolist()
        if self.canonical_embedding is not None:
            data['canonical_embedding'] = self.canonical_embedding.tolist()
        return data


@dataclass
class RepeatedQuestionGroup:
    """Represents a group of repeated questions."""
    group_id: int
    similarity_score: float
    representative_question: str
    questions: List[Dict]
    total_variants: int
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return asdict(self)


# ============================================================================
# TEXT PREPROCESSING
# ============================================================================

class TextPreprocessor:
    """Handles text preprocessing and normalization."""
    
    # Common stop words
    STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'am', 'be', 'been', 'being',
        'have', 'has', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
        'may', 'might', 'can', 'that', 'this', 'these', 'those', 'i', 'you',
        'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
        'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
        'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
        'so', 'than', 'too', 'very', 'as', 'if', 'just', 'because'
    }
    
    @staticmethod
    def normalize(text: str) -> str:
        """
        Normalize text by:
        - Converting to lowercase
        - Removing punctuation and special characters
        - Removing extra whitespace
        - Removing URLs and email addresses
        """
        if not text or not isinstance(text, str):
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'https?://\S+', '', text)
        
        # Remove email addresses
        text = re.sub(r'\S+@\S+', '', text)
        
        # Remove special characters but keep spaces and alphanumerics
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text
    
    @staticmethod
    def clean(text: str) -> str:
        """
        Clean text by:
        - Normalizing whitespace
        - Removing duplicate content
        - Handling special formats
        """
        text = TextPreprocessor.normalize(text)
        
        # Remove duplicate words (keep first occurrence)
        words = text.split()
        seen = set()
        cleaned = []
        for word in words:
            if word not in seen or word not in TextPreprocessor.STOP_WORDS:
                cleaned.append(word)
                seen.add(word)
        
        return ' '.join(cleaned)
    
    @staticmethod
    def extract_keywords(text: str, top_n: int = 5) -> List[str]:
        """Extract important keywords from text."""
        words = text.lower().split()
        # Filter out stop words and short words
        keywords = [w for w in words 
                   if len(w) > 3 and w not in TextPreprocessor.STOP_WORDS]
        # Return most frequent (unique)
        return list(dict.fromkeys(keywords))[:top_n]

    @staticmethod
    def extract_answer(text: str) -> str:
        """Extract explicit answer if present in formats like [Answer: ...]"""
        if not text or not isinstance(text, str):
            return ""
        m = re.search(r'\[\s*answer\s*[:\-]?\s*(.+?)\s*\]', text, re.IGNORECASE)
        if m:
            return TextPreprocessor.normalize(m.group(1))
        return ""

    @staticmethod
    def canonicalize(text: str) -> str:
        """Create a canonical form of the question that's invariant to option ordering.

        - Removes numbering/labels
        - Extracts option lines (A., (a), a) etc.), normalizes them and sorts
        - Appends sorted options to the question body
        """
        if not text or not isinstance(text, str):
            return ""

        # Work on a cleaned version first
        cleaned = TextPreprocessor.normalize(text)

        # Remove bracketed answers for canonical form
        cleaned = re.sub(r'\[\s*answer\s*[:\-]?\s*.+?\s*\]', '', cleaned, flags=re.IGNORECASE)

        # Split into lines and detect option-like lines
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        option_pattern = re.compile(r'^(?:[A-Ha-h]|\(|\d+)[\)\.|\s]\s*(.+)$')
        options = []
        body_lines = []
        for l in lines:
            m = re.match(r'^[\(\[]?\s*([A-Ha-h0-9]+)[\)\].:\-]?\s*(.+)$', l)
            if m and len(m.group(1)) <= 3:
                # Looks like an option label
                opt = TextPreprocessor.normalize(m.group(2))
                if opt:
                    options.append(opt)
            else:
                # Might still be a long single-line question containing options separated by newlines
                body_lines.append(l)

        body = TextPreprocessor.normalize(' '.join(body_lines))

        if options:
            # Sort options to make ordering invariant
            options_sorted = sorted(list(set(options)))
            return f"{body} options: {' | '.join(options_sorted)}"

        # If no explicit options found, fallback to token-sort canonicalization
        tokens = [t for t in re.split(r'\s+', cleaned) if t]
        tokens_sorted = ' '.join(sorted(tokens))
        return tokens_sorted


# ============================================================================
# PDF EXTRACTION
# ============================================================================

class PDFExtractor:
    """Handles PDF file extraction and question parsing."""
    
    @staticmethod
    def extract_from_pdf(pdf_path: str) -> List[Tuple[str, int]]:
        """
        Extract text from PDF file.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of tuples (text, page_number)
        """
        if not PDFPLUMBER_AVAILABLE:
            logger.warning(f"pdfplumber not available. Using fallback extraction.")
            return PDFExtractor._fallback_extract(pdf_path)
        
        try:
            text_blocks = []
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    text = page.extract_text()
                    if text and text.strip():
                        text_blocks.append((text, page_num))
            
            # Detect and remove repeated header/footer lines occurring across pages
            try:
                page_lines = [set((t.splitlines())) for t, _ in text_blocks]
                # Count line occurrences
                line_counts = defaultdict(int)
                for s in page_lines:
                    for line in s:
                        line_counts[line.strip()] += 1

                repeated_lines = {ln for ln, c in line_counts.items() if c >= 2 and ln and len(ln) > 3}
                if repeated_lines:
                    cleaned_blocks = []
                    for text, pnum in text_blocks:
                        lines = [ln for ln in text.splitlines() if ln.strip() and ln.strip() not in repeated_lines]
                        cleaned_blocks.append(("\n".join(lines), pnum))
                    text_blocks = cleaned_blocks
            except Exception:
                pass

            logger.info(f"Extracted text from {len(text_blocks)} pages in {pdf_path}")
            return text_blocks
            
        except Exception as e:
            logger.error(f"Error extracting PDF {pdf_path}: {str(e)}")
            return []
    
    @staticmethod
    def _fallback_extract(pdf_path: str) -> List[Tuple[str, int]]:
        """Fallback extraction method if pdfplumber not available."""
        try:
            # Try using PyPDF2 as fallback
            from PyPDF2 import PdfReader
            text_blocks = []
            with open(pdf_path, 'rb') as f:
                reader = PdfReader(f)
                for page_num, page in enumerate(reader.pages, 1):
                    text = page.extract_text()
                    if text:
                        text_blocks.append((text, page_num))
            return text_blocks
        except ImportError:
            logger.error("Neither pdfplumber nor PyPDF2 available for PDF extraction")
            return []
    
    @staticmethod
    def split_into_questions(text: str) -> List[str]:
        """
        Split extracted text into individual questions.
        
        Handles common question formats:
        - Q1. Question text?
        - Question 1: text?
        - (a) question?
        - 1) question?
        """
        text = text.strip()
        questions = []
        
        # Pattern 1: Q1, Q2, Q3 format
        pattern1 = r'(?:^|\n)\s*Q[:\s]+(\d+)\s*[:\.]?\s*(.+?)(?=\n\s*Q|\n\nQ|$)'
        matches1 = re.findall(pattern1, text, re.IGNORECASE | re.DOTALL)
        for _, question in matches1:
            q = question.strip()
            if len(q) > 10:  # Minimum question length
                questions.append(q)
        
        # Pattern 2: Question 1, Question 2 format
        pattern2 = r'(?:^|\n)\s*(?:Question|Que)[:\s]+(\d+)\s*[:\.]?\s*(.+?)(?=\n\s*(?:Question|Que)|\n\n(?:Question|Que)|$)'
        matches2 = re.findall(pattern2, text, re.IGNORECASE | re.DOTALL)
        for _, question in matches2:
            q = question.strip()
            if len(q) > 10:
                questions.append(q)
        
        # Pattern 3: Numbered format (1, 2, 3)
        pattern3 = r'(?:^|\n)\s*(\d+)\s*[)\.]\s*(.+?)(?=\n\s*\d+\s*[)\.]\s*|\n\n\d+|$)'
        matches3 = re.findall(pattern3, text, re.DOTALL)
        for _, question in matches3:
            q = question.strip()
            if len(q) > 10:
                questions.append(q)
        
        # If no structured format found, split by sentence
        if not questions:
            sentences = re.split(r'[?!]\s+', text)
            for sentence in sentences:
                s = sentence.strip()
                if len(s) > 20:
                    questions.append(s + ('?' if '?' not in s else ''))
        
        return [q for q in questions if len(q) > 10]

    # ------------------ Image OCR helpers ------------------
    @staticmethod
    def _is_blurred_image(cv_img) -> bool:
        """Estimate blur using variance of Laplacian."""
        try:
            gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
            fm = cv2.Laplacian(gray, cv2.CV_64F).var()
            return fm < 100.0  # threshold: lower means more blurred
        except Exception:
            return False

    @staticmethod
    def _preprocess_image_bytes(img_bytes: bytes) -> bytes:
        """Preprocess image bytes: denoise, unsharp mask, adaptive threshold."""
        try:
            arr = np.asarray(bytearray(img_bytes), dtype=np.uint8)
            cv_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if cv_img is None:
                return img_bytes

            gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
            # Denoise
            denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
            # Unsharp mask
            gaussian = cv2.GaussianBlur(denoised, (0, 0), 3)
            unsharp = cv2.addWeighted(denoised, 1.5, gaussian, -0.5, 0)
            # Adaptive threshold to increase contrast
            th = cv2.adaptiveThreshold(unsharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 15, 6)

            # Encode back to PNG bytes
            success, buf = cv2.imencode('.png', th)
            if success:
                return buf.tobytes()
            return img_bytes
        except Exception:
            return img_bytes

    @staticmethod
    def _ocr_image_bytes(img_bytes: bytes, enhance: bool = True) -> str:
        """Run OCR on image bytes. Try easyocr then pytesseract as fallback."""
        try:
            if enhance:
                img_bytes = PDFExtractor._preprocess_image_bytes(img_bytes)

            # Try easyocr
            if EASYOCR_AVAILABLE:
                try:
                    reader = easyocr.Reader(['en'], gpu=False)
                    results = reader.readtext(img_bytes)
                    text = ' '.join([r[1] for r in results])
                    return text
                except Exception:
                    pass

            # Fallback to pytesseract
            if PYTESSERACT_AVAILABLE:
                pil = Image.open(io.BytesIO(img_bytes)).convert('L')
                text = pytesseract.image_to_string(pil)
                return text

            return ''
        except Exception:
            return ''


# ============================================================================
# SEMANTIC SIMILARITY & CLUSTERING
# ============================================================================

class SemanticAnalyzer:
    """Handles semantic analysis and similarity detection."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the semantic analyzer.
        
        Args:
            model_name: Name of sentence-transformers model
        """
        logger.info(f"Loading embedding model: {model_name}")
        try:
            self.model = SentenceTransformer(model_name)
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            raise
    
    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of text strings
            
        Returns:
            numpy array of embeddings
        """
        try:
            logger.info(f"Generating embeddings for {len(texts)} texts...")
            embeddings = self.model.encode(
                texts,
                convert_to_numpy=True,
                show_progress_bar=True,
                batch_size=32
            )
            logger.info(f"Generated {len(embeddings)} embeddings")
            return embeddings
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            raise
    
    def compute_similarity_matrix(self, embeddings: np.ndarray) -> np.ndarray:
        """
        Compute cosine similarity matrix between all embeddings.
        
        Args:
            embeddings: Array of embeddings
            
        Returns:
            Similarity matrix
        """
        try:
            logger.info("Computing similarity matrix...")
            # Convert to tensor for efficient computation
            embeddings_tensor = util.pytorch_cos_sim(embeddings, embeddings)
            similarity_matrix = embeddings_tensor.cpu().numpy()
            logger.info(f"Computed {len(similarity_matrix)}x{len(similarity_matrix)} similarity matrix")
            return similarity_matrix
        except Exception as e:
            logger.error(f"Error computing similarity: {str(e)}")
            # Fallback to numpy computation
            from sklearn.metrics.pairwise import cosine_similarity
            return cosine_similarity(embeddings)
    
    @staticmethod
    def cluster_similar_questions(
        similarity_matrix: np.ndarray,
        threshold: float = 0.80,
        method: str = 'complete'
    ) -> Tuple[List[List[int]], List[float]]:
        """
        Cluster questions based on similarity.
        
        Args:
            similarity_matrix: Cosine similarity matrix
            threshold: Similarity threshold for clustering
            method: Clustering linkage method
            
        Returns:
            List of clusters (each cluster is list of indices)
        """
        logger.info(f"Clustering with threshold={threshold}, method={method}")
        
        # Convert similarity to distance
        distance_matrix = 1 - similarity_matrix
        
        # Use hierarchical clustering
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=1 - threshold,
            linkage=method,
            metric='precomputed'
        )
        
        labels = clustering.fit_predict(distance_matrix)
        
        # Group indices by cluster
        clusters = defaultdict(list)
        cluster_scores = defaultdict(list)
        
        for idx, label in enumerate(labels):
            clusters[label].append(idx)
            # Get similarity scores for this cluster
            similar_indices = np.where((similarity_matrix[idx] >= threshold) & (np.arange(len(similarity_matrix)) != idx))[0]
            if len(similar_indices) > 0:
                cluster_scores[label].append(similarity_matrix[idx][similar_indices].mean())
        
        # Filter clusters with at least 2 members
        valid_clusters = [indices for indices in clusters.values() if len(indices) >= 2]
        valid_scores = [np.mean(scores) if scores else 0.0 for indices, scores in zip(clusters.values(), cluster_scores.values()) if len(indices) >= 2]
        
        logger.info(f"Found {len(valid_clusters)} clusters with {sum(len(c) for c in valid_clusters)} total questions")
        
        return valid_clusters, valid_scores


# ============================================================================
# MAIN ANALYZER
# ============================================================================

class RepeatedQuestionAnalyzer:
    """Main analyzer that orchestrates the entire process."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", similarity_threshold: float = 0.80):
        """
        Initialize the analyzer.
        
        Args:
            model_name: Sentence-transformer model name
            similarity_threshold: Minimum similarity for grouping (0-1)
        """
        self.similarity_threshold = similarity_threshold
        self.semantic_analyzer = SemanticAnalyzer(model_name)
        self.text_preprocessor = TextPreprocessor()
        self.pdf_extractor = PDFExtractor()
        
        self.questions: List[Question] = []
        self.similarity_matrix: np.ndarray = None
        self.clusters: List[List[int]] = []
        self.results: Dict = {}
    
    def analyze_pdfs(self, pdf_paths: List[str]) -> Dict:
        """
        Analyze multiple PDF files for repeated questions.
        
        Args:
            pdf_paths: List of paths to PDF files
            
        Returns:
            Analysis results dictionary
        """
        logger.info(f"Starting analysis of {len(pdf_paths)} PDF files...")
        
        try:
            # Step 1: Extract questions from PDFs
            logger.info("STEP 1: Extracting questions from PDFs...")
            self._extract_questions_from_pdfs(pdf_paths)
            
            if not self.questions:
                logger.warning("No questions extracted from PDFs!")
                return self._create_empty_results()
            
            logger.info(f"Extracted {len(self.questions)} total questions")
            
            # Step 2: Preprocess questions
            logger.info("STEP 2: Preprocessing questions...")
            self._preprocess_questions()
            
            # Step 3: Generate embeddings
            logger.info("STEP 3: Generating semantic embeddings...")
            self._generate_embeddings()
            
            # Step 4: Compute similarity
            logger.info("STEP 4: Computing similarity matrix...")
            self._compute_similarity()
            
            # Step 5: Cluster similar questions
            logger.info("STEP 5: Clustering similar questions...")
            self._cluster_questions()
            
            # Step 6: Generate results
            logger.info("STEP 6: Generating results...")
            self.results = self._generate_results()
            
            logger.info("✅ Analysis completed successfully!")
            return self.results
            
        except Exception as e:
            logger.error(f"Error during analysis: {str(e)}")
            logger.error(traceback.format_exc())
            return self._create_empty_results()
    
    def _extract_questions_from_pdfs(self, pdf_paths: List[str]) -> None:
        """Extract questions from PDF files."""
        question_id = 0
        
        for pdf_path in pdf_paths:
            if not os.path.exists(pdf_path):
                logger.warning(f"PDF file not found: {pdf_path}")
                continue
            
            logger.info(f"Processing: {pdf_path}")
            
            # Extract text from PDF
            text_blocks = self.pdf_extractor.extract_from_pdf(pdf_path)
            
            # Split into questions
            for text, page_num in text_blocks:
                questions = self.pdf_extractor.split_into_questions(text)
                
                for question_text in questions:
                    question = Question(
                        id=question_id,
                        text=question_text,
                        source_file=os.path.basename(pdf_path),
                        page_number=page_num
                    )
                    self.questions.append(question)
                    question_id += 1
    
    def _preprocess_questions(self) -> None:
        """Preprocess all questions."""
        for question in self.questions:
            # Clean original text
            question.text = self.text_preprocessor.clean(question.text)
            # Extract explicit answer if present
            question.answer = self.text_preprocessor.extract_answer(question.text)
            # Create canonical text (ordering-invariant for options)
            question.canonical_text = self.text_preprocessor.canonicalize(question.text)
    
    def _generate_embeddings(self) -> None:
        """Generate embeddings for all questions."""
        question_texts = [q.text for q in self.questions]
        canonical_texts = [q.canonical_text or q.text for q in self.questions]

        # Generate embeddings for both original and canonical texts (avoid duplicate encoding)
        orig_embeddings = self.semantic_analyzer.generate_embeddings(question_texts)
        # If canonical equals original for many, avoid extra encoding by checking equality
        need_canonical = [canonical_texts[i] != question_texts[i] for i in range(len(question_texts))]

        # Initialize
        canon_embeddings = np.array([None] * len(question_texts), dtype=object)

        # For those where canonical != original, generate embeddings
        if any(need_canonical):
            unique_canon_texts = []
            index_map = {}
            for i, need in enumerate(need_canonical):
                if need:
                    t = canonical_texts[i]
                    if t not in index_map:
                        index_map[t] = []
                        unique_canon_texts.append(t)
                    index_map[t].append(i)

            unique_embeddings = self.semantic_analyzer.generate_embeddings(unique_canon_texts)
            # Map back
            for t, emb in zip(index_map.keys(), unique_embeddings):
                for i in index_map[t]:
                    canon_embeddings[i] = emb

        # For entries where canonical equals original, reuse orig embedding
        for i in range(len(question_texts)):
            if canon_embeddings[i] is None:
                canon_embeddings[i] = orig_embeddings[i]

        # Assign to questions
        for question, emb, cemb in zip(self.questions, orig_embeddings, canon_embeddings):
            question.embedding = emb
            question.canonical_embedding = cemb
    
    def _compute_similarity(self) -> None:
        """Compute similarity matrix."""
        # Compute similarity matrices for original and canonical embeddings
        orig_embeddings = np.array([q.embedding for q in self.questions])
        canon_embeddings = np.array([q.canonical_embedding for q in self.questions])

        orig_sim = self.semantic_analyzer.compute_similarity_matrix(orig_embeddings)
        canon_sim = self.semantic_analyzer.compute_similarity_matrix(canon_embeddings)

        # Token-set Jaccard as a lightweight permutation-invariant measure
        n = len(self.questions)
        jaccard = np.zeros((n, n), dtype=float)
        texts = [TextPreprocessor.normalize(q.text) for q in self.questions]
        token_sets = [set(re.split(r'\s+', t)) for t in texts]
        for i in range(n):
            for j in range(i, n):
                if i == j:
                    jaccard[i, j] = 1.0
                else:
                    a = token_sets[i]
                    b = token_sets[j]
                    if not a or not b:
                        score = 0.0
                    else:
                        inter = len(a & b)
                        union = len(a | b)
                        score = inter / union if union > 0 else 0.0
                    jaccard[i, j] = score
                    jaccard[j, i] = score

        # Final similarity is the max of orig_sim, canon_sim, and jaccard
        combined = np.maximum(np.maximum(orig_sim, canon_sim), jaccard)

        # Boost when explicit answers match (small boost)
        for i in range(n):
            for j in range(i+1, n):
                a1 = (self.questions[i].answer or '').strip()
                a2 = (self.questions[j].answer or '').strip()
                if a1 and a2 and a1 == a2:
                    combined[i, j] = min(1.0, combined[i, j] + 0.05)
                    combined[j, i] = combined[i, j]

        self.similarity_matrix = combined
    
    def _cluster_questions(self) -> None:
        """Cluster similar questions."""
        self.clusters, _ = SemanticAnalyzer.cluster_similar_questions(
            self.similarity_matrix,
            threshold=self.similarity_threshold,
            method='complete'
        )
    
    def _generate_results(self) -> Dict:
        """Generate final results."""
        total_questions = len(self.questions)
        unique_questions = total_questions - sum(len(cluster) - 1 for cluster in self.clusters)
        
        repeated_groups = []
        
        for group_id, cluster_indices in enumerate(self.clusters, 1):
            # Calculate average similarity in cluster
            cluster_similarities = []
            for i in cluster_indices:
                for j in cluster_indices:
                    if i < j:
                        cluster_similarities.append(float(self.similarity_matrix[i][j]))
            
            avg_similarity = np.mean(cluster_similarities) if cluster_similarities else 0.0
            
            # Get representative (most central) question
            intra_cluster_sims = []
            for i, idx in enumerate(cluster_indices):
                avg_sim = np.mean([self.similarity_matrix[idx][jdx] for jdx in cluster_indices if idx != jdx])
                intra_cluster_sims.append(avg_sim)
            
            rep_idx = cluster_indices[np.argmax(intra_cluster_sims)]
            representative = self.questions[rep_idx].text
            
            # Collect all questions in this group
            group_questions = []
            for idx in cluster_indices:
                q = self.questions[idx]
                group_questions.append({
                    'id': q.id,
                    'text': q.text,
                    'source_file': q.source_file,
                    'page_number': q.page_number,
                    'similarity_to_representative': float(self.similarity_matrix[rep_idx][idx])
                })
            
            group = RepeatedQuestionGroup(
                group_id=group_id,
                similarity_score=avg_similarity,
                representative_question=representative,
                questions=group_questions,
                total_variants=len(group_questions)
            )
            repeated_groups.append(group)
        
        return {
            'summary': {
                'total_questions': total_questions,
                'unique_questions': unique_questions,
                'repeated_question_groups': len(repeated_groups),
                'total_repeated_questions': sum(len(cluster) for cluster in self.clusters),
                'similarity_threshold': self.similarity_threshold
            },
            'repeated_groups': [g.to_dict() for g in repeated_groups],
            'questions': [q.to_dict() for q in self.questions]
        }
    
    def _create_empty_results(self) -> Dict:
        """Create empty results structure."""
        return {
            'summary': {
                'total_questions': 0,
                'unique_questions': 0,
                'repeated_question_groups': 0,
                'total_repeated_questions': 0,
                'similarity_threshold': self.similarity_threshold,
                'error': 'No questions extracted or analysis failed'
            },
            'repeated_groups': [],
            'questions': []
        }
    
    def save_results(self, output_file: str) -> None:
        """
        Save analysis results to JSON file.
        
        Args:
            output_file: Path to output JSON file
        """
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False)
            logger.info(f"Results saved to {output_file}")
        except Exception as e:
            logger.error(f"Error saving results: {str(e)}")
    
    def print_summary(self) -> None:
        """Print analysis summary to console."""
        summary = self.results.get('summary', {})
        groups = self.results.get('repeated_groups', [])
        
        print("\n" + "="*80)
        print("EXAM QUESTION ANALYSIS SUMMARY".center(80))
        print("="*80)
        
        print(f"\n📊 Statistics:")
        print(f"   Total Questions: {summary.get('total_questions', 0)}")
        print(f"   Unique Questions: {summary.get('unique_questions', 0)}")
        print(f"   Repeated Groups: {summary.get('repeated_question_groups', 0)}")
        print(f"   Total Variants: {summary.get('total_repeated_questions', 0)}")
        print(f"   Similarity Threshold: {summary.get('similarity_threshold', 0)}")
        
        if groups:
            print(f"\n🔍 Repeated Question Groups:\n")
            for group in groups:
                print(f"   Group {group['group_id']}: {group['total_variants']} variants (Avg Similarity: {group['similarity_score']:.2%})")
                print(f"   📝 Representative: {group['representative_question'][:80]}...")
                for q in group['questions'][:3]:
                    print(f"      • {q['text'][:70]}... ({q['similarity_to_representative']:.2%})")
                if len(group['questions']) > 3:
                    print(f"      ... and {len(group['questions']) - 3} more variants")
                print()
        else:
            print("\n✅ No repeated questions found!")
        
        print("="*80 + "\n")


# ============================================================================
# COMMAND-LINE INTERFACE
# ============================================================================

def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Detect repeated exam questions from PDF files using semantic similarity"
    )
    
    parser.add_argument(
        'pdf_files',
        nargs='+',
        help='Path(s) to PDF files to analyze'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='repeated_questions_analysis.json',
        help='Output JSON file path (default: repeated_questions_analysis.json)'
    )
    
    parser.add_argument(
        '--threshold', '-t',
        type=float,
        default=0.80,
        help='Similarity threshold (0-1, default: 0.80)'
    )
    
    parser.add_argument(
        '--model', '-m',
        default='all-MiniLM-L6-v2',
        help='Sentence-transformer model name (default: all-MiniLM-L6-v2)'
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    pdf_files = []
    for pdf_path in args.pdf_files:
        if os.path.exists(pdf_path):
            pdf_files.append(pdf_path)
        else:
            logger.warning(f"File not found: {pdf_path}")
    
    if not pdf_files:
        logger.error("No valid PDF files provided!")
        sys.exit(1)
    
    # Run analysis
    analyzer = RepeatedQuestionAnalyzer(
        model_name=args.model,
        similarity_threshold=args.threshold
    )
    
    results = analyzer.analyze_pdfs(pdf_files)
    analyzer.save_results(args.output)
    analyzer.print_summary()


if __name__ == "__main__":
    main()
