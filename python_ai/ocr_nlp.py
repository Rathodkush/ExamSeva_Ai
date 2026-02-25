import re
from collections import Counter
from typing import List, Dict, Optional
import time
import os
try:
    from rapidfuzz import fuzz
except Exception:
    fuzz = None

# Lazy import of sentence-transformers to avoid heavy startup if not needed
_model = None
def _get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer, util
            # Use a more accurate model for educational content
            _model = {
                "model": SentenceTransformer('paraphrase-MiniLM-L6-v2'),
                "util": util
            }
        except Exception as e:
            # If model cannot be loaded, raise to notify caller
            raise RuntimeError(f"Failed to load sentence-transformers model: {e}")
    return _model

# basic English stopwords for keyword matching
STOPWORDS = set(
    """
    a an and are as at be by for from has have i in is it its of on or that the to was were will with this these those but not into your you we our they them their more most such can could should would may might then than over under again once same other about above below up down off out very just 
    """.split()
)

# Prefilter and embedding tuning constants
MAX_CANDIDATES_FOR_EMBED = int(os.environ.get("MAX_CANDIDATES_FOR_EMBED", "500"))  # Increased for better coverage
EMBED_BATCH_SIZE = int(os.environ.get("EMBED_BATCH_SIZE", "64"))
SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.35"))  # VERY LOW for maximum detection
MIN_GROUP_SIZE = int(os.environ.get("MIN_GROUP_SIZE", "1"))  # Allow single-item groups to merge
FUZZY_THRESHOLD = int(os.environ.get("FUZZY_THRESHOLD", "60"))  # VERY LOW for near-duplicate detection
KEYWORD_MATCH_THRESHOLD = float(os.environ.get("KEYWORD_MATCH_THRESHOLD", "0.4"))  # For keyword-based grouping
VERBOSE = bool(os.environ.get("OCR_NLP_VERBOSE", "") == "1")

# Common synonyms dictionary for better matching - expanded for educational content
SYNONYMS = {
    # Question format synonyms (any of these means "asking for definition/explanation")
    'what': ['which', 'how', 'why', 'define', 'explain'],
    'is': ['are', 'be'],
    'define': ['explain', 'describe', 'state', 'specify', 'mean', 'say'],
    'explain': ['describe', 'elaborate', 'clarify', 'detail', 'illustrate', 'define', 'state'],
    'describe': ['explain', 'elaborate', 'detail', 'illustrate', 'depict', 'portray'],
    'calculate': ['compute', 'find', 'determine', 'evaluate', 'solve', 'work', 'get'],
    'compute': ['calculate', 'evaluate', 'determine', 'find'],
    'find': ['calculate', 'compute', 'determine', 'get', 'obtain'],
    'prove': ['show', 'demonstrate', 'establish', 'verify', 'derive', 'deduce'],
    'show': ['prove', 'demonstrate', 'explain', 'verify', 'establish'],
    'differentiate': ['distinguish', 'compare', 'contrast', 'difference between'],
    'difference': ['differentiate', 'distinguish', 'contrast'],
    'discuss': ['explain', 'describe', 'analyze', 'examine', 'elaborate'],
    'state': ['mention', 'list', 'write', 'give', 'express', 'declare'],
    'write': ['state', 'mention', 'list', 'describe', 'express'],
    'list': ['enumerate', 'mention', 'state', 'write', 'name', 'identify'],
    'draw': ['sketch', 'illustrate', 'show', 'represent', 'depict'],
    'derive': ['prove', 'show', 'demonstrate', 'obtain', 'deduce'],
    'analyze': ['examine', 'discuss', 'study', 'investigate'],
    'examine': ['analyze', 'study', 'inspect', 'investigate'],
    'identify': ['recognize', 'name', 'list', 'determine'],
    'classify': ['categorize', 'group', 'organize', 'arrange'],
    'compare': ['differentiate', 'distinguish', 'contrast', 'difference'],
    'contrast': ['compare', 'differentiate', 'distinguish'],
    'relationship': ['connection', 'link', 'association'],
    'difference': ['differentiate', 'distinguish', 'contrast', 'vary'],
}

# Topic keywords that are important for grouping similar questions
TOPIC_KEYWORDS = {
    'structure', 'process', 'system', 'mechanism', 'method',
    'concept', 'theory', 'principle', 'law', 'formula',
    'definition', 'meaning', 'purpose', 'function', 'role',
    'advantage', 'benefit', 'disadvantage', 'problem', 'solution',
    'type', 'kind', 'category', 'class', 'group'
}

def normalize_spaces(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()

def extract_subpart_label(line: str) -> Optional[str]:
    m = re.match(r'^\s*\(?([a-hA-H])\)?[\.).-]\s+', line)
    return m.group(1).lower() if m else None

def extract_question_stem(text: str) -> set:
    """Extract the core topic/subject keywords from a question, ignoring question type markers."""
    # Remove question type words that don't convey meaning
    question_markers = {
        'what', 'which', 'how', 'why', 'is', 'are', 'the', 'a', 'an',
        'define', 'explain', 'describe', 'state', 'write', 'list', 'name',
        'find', 'calculate', 'compute', 'solve', 'prove', 'show', 'derive',
        'question', 'answer'
    }
    
    words = re.findall(r'[A-Za-z]+', text.lower())
    stem_words = [w for w in words if w not in question_markers and len(w) > 3]
    return set(stem_words)

def semantic_keyword_match(keywords1: set, keywords2: set) -> float:
    """Calculate semantic similarity between keyword sets using embeddings."""
    if not keywords1 or not keywords2:
        return 0.0
    
    try:
        # Try to use embeddings for semantic similarity
        model_bundle = _get_model()
        model = model_bundle['model']
        util = model_bundle['util']
        
        # Convert sets to lists for embedding
        kw1_list = list(keywords1)
        kw2_list = list(keywords2)
        
        if not kw1_list or not kw2_list:
            return 0.0
        
        # Get embeddings
        emb1 = model.encode(kw1_list, convert_to_tensor=True)
        emb2 = model.encode(kw2_list, convert_to_tensor=True)
        
        # Calculate pairwise similarities
        sim_matrix = util.cos_sim(emb1, emb2).cpu().numpy()
        
        # Find best matches for each keyword
        total_sim = 0.0
        for i in range(len(kw1_list)):
            best_sim = float(max(sim_matrix[i]))
            total_sim += best_sim
        
        # Average similarity, but boost if many keywords match well
        avg_sim = total_sim / len(kw1_list)
        
        # Bonus for having multiple similar keywords
        overlap_count = sum(1 for sim in sim_matrix.flatten() if sim > 0.7)
        overlap_bonus = min(overlap_count * 0.1, 0.5)  # Max 0.5 bonus
        
        return min(avg_sim + overlap_bonus, 1.0)
        
    except Exception as e:
        # Fallback to simple keyword matching if embeddings fail
        print(f"Warning: Embedding-based keyword matching failed: {e}, using fallback")
        
        # Direct match
        direct_match = len(keywords1 & keywords2)
        
        # Synonym match
        synonym_match = 0
        for kw1 in keywords1:
            for kw2 in keywords2:
                if kw1 in SYNONYMS and kw2 in SYNONYMS[kw1]:
                    synonym_match += 0.5
                elif kw2 in SYNONYMS and kw1 in SYNONYMS[kw2]:
                    synonym_match += 0.5
        
        total = len(keywords1 | keywords2)
        if total == 0:
            return 0.0
        
        return (direct_match + synonym_match) / total

def get_keywords(text: str, max_keywords: int = 12) -> List[str]:
    """Extract keywords with enhanced educational content recognition."""
    words = re.findall(r"[A-Za-z]+", text.lower())
    
    # Enhanced stopwords for educational content
    edu_stopwords = STOPWORDS | {
        'question', 'answer', 'explain', 'define', 'describe', 'discuss', 'state', 
        'write', 'draw', 'list', 'enumerate', 'mention', 'give', 'find', 'calculate',
        'prove', 'show', 'derive', 'differentiate', 'compare', 'contrast', 'analyze',
        'evaluate', 'solve', 'determine', 'compute', 'obtain', 'following', 'given',
        'marks', 'total', 'attempt', 'compulsory', 'optional', 'choose', 'select'
    }
    
    words = [w for w in words if len(w) > 3 and w not in edu_stopwords]
    
    # Expand with synonyms
    expanded_words = set(words)
    for word in words:
        if word in SYNONYMS:
            expanded_words.update(SYNONYMS[word])
    
    counts = Counter(words)
    
    # Technical/academic term boosting
    technical_terms = {
        'algorithm', 'function', 'variable', 'method', 'class', 'object', 'data',
        'structure', 'array', 'list', 'tree', 'graph', 'network', 'system',
        'process', 'memory', 'storage', 'database', 'query', 'table', 'field',
        'voltage', 'current', 'resistance', 'circuit', 'force', 'energy', 'power',
        'velocity', 'acceleration', 'mass', 'density', 'pressure', 'temperature',
        'reaction', 'compound', 'element', 'molecule', 'atom', 'bond', 'cell',
        'tissue', 'organ', 'system', 'evolution', 'species', 'ecosystem', 'gene'
    }
    
    # Prioritize words that appear multiple times or are important
    scored = []
    for w, count in counts.most_common(max_keywords * 2):
        score = count
        # Boost score for question words and action verbs
        if w in ['what', 'how', 'why', 'when', 'where', 'which', 'who']:
            score += 2
        if w in ['explain', 'define', 'calculate', 'prove', 'show', 'derive']:
            score += 1.5
        if w in technical_terms:
            score *= 1.5  # Boost technical terms
        if len(w) > 6:
            score *= 1.2  # Boost longer words (likely more specific)
        scored.append((score, w))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    return [w for _, w in scored[:max_keywords]]

def extract_question_with_answer(text: str) -> Dict[str, str]:
    """Extract question and potential answer from text."""
    # Look for patterns like "Q: ... A: ..." or "Question: ... Answer: ..."
    qa_patterns = [
        (r'(?:Q|Question)[:\s]+(.+?)(?:A|Answer)[:\s]+(.+)', re.IGNORECASE),
        (r'(.+\?)\s+(?:Ans|Answer|Solution)[:\s]+(.+)', re.IGNORECASE),
        (r'(.+\?)\s+([A-Z][^?]+)', re.IGNORECASE),
    ]
    
    for pattern, flags in qa_patterns:
        match = re.search(pattern, text, flags=flags)
        if match:
            return {
                'question': match.group(1).strip(),
                'answer': match.group(2).strip()[:200]  # Limit answer length
            }
    
    # If no explicit answer found, return just question
    return {
        'question': text,
        'answer': None
    }

def split_to_questions(text: str) -> List[str]:
    """Enhanced question extraction that captures questions with their answers when available."""
    out: List[str] = []
    
    # First, try to extract explicit Q&A pairs
    qa_patterns = [
        r'(?:Q|Question)[:\s]*(\d+)?[:.\s]*(.+?)(?:A|Answer)[:\s]*(.+?)(?=\n(?:Q|Question|\d+\.|\Z))',
        r'(\d+[\).]\s*.+?)\s*\n\s*(?:Ans|Answer)[:\s]*(.+?)(?=\n\d+[\).]|\Z)',
        r'(.+?\?)\s*\n\s*(?:Ans|Answer)[:\s]*(.+?)(?=\n.+?\?|\Z)',
    ]
    
    for pattern in qa_patterns:
        qa_pairs = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)
        for match in qa_pairs:
            if len(match) == 3:  # Q number, question, answer
                q_num, question, answer = match
                combined = f"Q{q_num}: {question.strip()} [Answer: {answer.strip()[:200]}...]"
                if len(combined) > 50 and len(question.strip()) > 20:
                    out.append(combined)
            elif len(match) == 2:  # question, answer
                question, answer = match
                combined = f"{question.strip()} [Answer: {answer.strip()[:200]}...]"
                if len(combined) > 50 and len(question.strip()) > 20:
                    out.append(combined)
    
    # Remove matched Q&A sections from text to avoid double-processing
    for pattern in qa_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)
    
    # Continue with original logic for questions without explicit answers
    parts = re.split(r'\n(?=\d{1,3}[).])|\n(?=Q\d+[:).])', text, flags=re.IGNORECASE)
    def should_skip(line: str) -> bool:
        l = line.strip()
        if not l:
            return True
        patterns = [
            r"^attempt\s+(any|all)\b",
            r"^answer\s+(any|all)\b",
            r"^write\s+short\s+note",
            r"^instructions?\b",
            r"^note\s*:",
            r"^section\s+[a-z]\b",
            r"^question\s+bank\b",
            r"total\s+marks",
            r"subject\s+code",
            r"paper\b",
            r"time\s*:\s*\d+\s*(hours|hrs|min)\b",
            r"all\s+questions\s+are\s+compulsory",
            r"make\s+suitable\s+assumptions",
            r"answers?\s+to\s+the\s+same\s+question",
            r"numbers\s+to\s+the\s+right\s+indicate\s+marks",
            r"draw\s+neat\s+labeled?\s+diagrams",
            r"non[- ]?programmable\s+calculators\s+is\s+allowed",
        ]
        l_lower = l.lower()
        for p in patterns:
            if re.match(p, l_lower):
                return True
        if l.endswith(":") and "?" not in l:
            return True
        if len(l) <= 20 and l.isupper() and "?" not in l:
            return True
        letters = sum(ch.isalpha() for ch in l)
        digits = sum(ch.isdigit() for ch in l)
        spaces = l.count(' ')
        symbols = max(len(l) - (letters + digits + spaces), 0)
        if len(l) >= 30 and (symbols / max(len(l), 1)) > 0.25 and "?" not in l:
            return True
        return False

    for p in parts:
        p = p.strip()
        if not p:
            continue
        subparts = re.split(r'\n(?=\(?[a-hA-H][\.).-]\s+)', p)
        if len(subparts) > 1:
            for sp in subparts:
                sp = sp.strip()
                if len(sp) > 20 and not should_skip(sp):
                    out.append(sp)
            continue

        def segment_paragraph(paragraph: str) -> List[str]:
            paragraph = normalize_spaces(paragraph)
            letters = sum(ch.isalpha() for ch in paragraph)
            digits = sum(ch.isdigit() for ch in paragraph)
            if len(paragraph) >= 60 and digits > letters * 2 and '?' not in paragraph:
                return []

            triggers = r"(?=(What\s+is|Explain|Define|Write|Draw|List|Describe|State|Differentiate|Discuss|Calculate|Prove|Show|Derive)\b)"
            chunks: List[str] = []
            qparts = [s.strip() for s in re.split(r'\?+', paragraph) if s.strip()]
            for qp in qparts:
                if len(qp) > 200:
                    sub = [s.strip() for s in re.split(triggers, qp, flags=re.I) if s and s.strip()]
                    merged = []
                    i = 0
                    while i < len(sub):
                        if re.match(r'^(What\s+is|Explain|Define|Write|Draw|List|Describe|State|Differentiate|Discuss|Calculate|Prove|Show|Derive)$', sub[i], flags=re.I):
                            if i + 1 < len(sub):
                                merged.append((sub[i] + ' ' + sub[i+1]).strip())
                                i += 2
                            else:
                                merged.append(sub[i])
                                i += 1
                        else:
                            merged.append(sub[i])
                            i += 1
                    chunks.extend(merged)
                else:
                    chunks.append(qp)

            cleaned: List[str] = []
            for c in chunks:
                c = normalize_spaces(re.sub(r'^\s*(\(?\d+[\)).-]|\(?[a-hA-H][\).-])\s+', '', c))
                if len(c) > 30 and not should_skip(c):
                    if re.match(r'^(what|explain|define|write|draw|list|describe|state|differentiate|discuss|calculate|prove|show|derive)\b', c, flags=re.I) and not c.endswith('?'):
                        c = c + '?'
                    cleaned.append(c)
            return cleaned

        if len(p) > 180:
            out.extend(segment_paragraph(p))
        else:
            if len(p) > 30 and not should_skip(p):
                out.append(p)
    return out

def _prefilter_candidates(questions: List[str], max_candidates: int = MAX_CANDIDATES_FOR_EMBED) -> List[str]:
    """
    Score and keep top-N candidate questions before embedding.
    Scoring favors presence of keywords and moderate length (not too short or extremely long).
    """
    scored = []
    for q in questions:
        k = len(get_keywords(q, max_keywords=8))
        length = len(q)
        len_score = max(0.0, min(1.0, (min(length, 300) - 40) / (300 - 40)))
        score = (k * 1.5) + len_score
        scored.append((score, q))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [q for _, q in scored[:max_candidates]]
    return top

def _union_find_make(n):
    parent = list(range(n))
    rank = [0]*n
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(a,b):
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if rank[ra] < rank[rb]:
            parent[ra] = rb
        elif rank[ra] > rank[rb]:
            parent[rb] = ra
        else:
            parent[rb] = ra
            rank[ra] += 1
    return parent, find, union

def extract_and_compare(texts: List[str]) -> Dict[str, List]:
    t0 = time.time()
    # combine and split into candidate questions
    questions: List[str] = []
    for t in texts:
        qs = split_to_questions(t)
        questions.extend(qs)

    # fallback: if no questions found, split by sentence
    if not questions:
        for t in texts:
            sents = re.split(r'\.\s+|\?\s+|!\s+', t)
            for s in sents:
                s = s.strip()
                if len(s) > 30:
                    questions.append(s)

    if not questions:
        return {"groups": [], "unique": [], "candidates": []}

    # Prefilter candidates to limit embedding workload
    if len(questions) > MAX_CANDIDATES_FOR_EMBED:
        questions_for_embed = _prefilter_candidates(questions, MAX_CANDIDATES_FOR_EMBED)
    else:
        questions_for_embed = questions

    # compute embeddings (batched)
    mdl = _get_model()
    model = mdl["model"]
    util = mdl["util"]
    embeddings = model.encode(questions_for_embed, batch_size=EMBED_BATCH_SIZE, convert_to_tensor=True)

    # PRIMARY: Word/keyword overlap grouping (more permissive than exact keyword tuple)
    print(f"[ocr_nlp] Starting WORD-MATCH grouping of {len(questions_for_embed)} questions...")
    n = len(questions_for_embed)
    parent, find, union = _union_find_make(n)
    kw_sets = []
    stems = []
    for q in questions_for_embed:
        kw_sets.append(set(get_keywords(q, max_keywords=10)))
        try:
            stems.append(set(extract_question_stem(q)))
        except Exception:
            stems.append(set())

    for i in range(n):
        for j in range(i + 1, n):
            # Exact duplicate / near-duplicate fast check
            if re.sub(r'\s+', ' ', questions_for_embed[i].strip().lower()) == re.sub(r'\s+', ' ', questions_for_embed[j].strip().lower()):
                union(i, j)
                continue

            k1, k2 = kw_sets[i], kw_sets[j]
            if not k1 or not k2:
                continue
            inter = len(k1 & k2)
            uni = len(k1 | k2) or 1
            jacc = inter / uni

            # Stem overlap is a strong signal for "same topic"
            s1, s2 = stems[i], stems[j]
            stem_inter = len(s1 & s2) if s1 and s2 else 0

            # Tune for exam papers: require at least 2 shared keywords OR 1 strong stem match
            if (inter >= 2 and jacc >= 0.45) or (stem_inter >= 2):
                union(i, j)

    comp_map = {}
    for i in range(n):
        root = find(i)
        comp_map.setdefault(root, []).append(i)
    clusters = [c for c in comp_map.values() if len(c) >= 2]

    print(f"[ocr_nlp] Word-match clustering found {len(clusters)} groups")

    # FALLBACK: If keyword grouping is weak, supplement with semantic+fuzzy matching
    if len(clusters) < max(2, len(questions_for_embed) // 50):  # If less than 2% grouped
        print(f"[ocr_nlp] Keyword grouping weak ({len(clusters)} groups), adding semantic fallback...")
        
        # Semantic clustering with very low threshold
        semantic_clusters = util.community_detection(embeddings, threshold=SIMILARITY_THRESHOLD, min_community_size=1)
        
        # Also use fuzzy string matching to catch OCR variants
        if fuzz is not None:
            n = len(questions_for_embed)
            parent, find, union = _union_find_make(n)
            
            for i in range(n):
                for j in range(i+1, n):
                    try:
                        ratio = fuzz.token_set_ratio(questions_for_embed[i], questions_for_embed[j])
                        if ratio >= FUZZY_THRESHOLD:
                            union(i, j)
                    except:
                        pass
            
            # Convert union-find to clusters
            comp_map = {}
            for i in range(n):
                root = find(i)
                comp_map.setdefault(root, []).append(i)
            fuzzy_clusters = [c for c in comp_map.values() if len(c) >= 2]
            
            # Merge fuzzy and semantic clusters
            all_clusters = semantic_clusters + fuzzy_clusters
            semantic_clusters = all_clusters
        
        print(f"[ocr_nlp] Semantic fallback found {len(semantic_clusters)} groups")
        
        # Merge semantic clusters with keyword clusters
        for cluster in semantic_clusters:
            if cluster not in clusters:
                clusters.append(cluster)
    
    if VERBOSE:
        print(f"[ocr_nlp] Total clusters after fallback: {len(clusters)}")
    
    clustered_indices = set([i for cluster in clusters for i in cluster])

    # Map cluster indices back to original questions indices: build mapping
    index_map = {}
    if len(questions_for_embed) != len(questions):
        norm_to_indices = {}
        for i, q in enumerate(questions):
            k = re.sub(r'\s+', ' ', q.strip().lower())
            norm_to_indices.setdefault(k, []).append(i)
        for i, q in enumerate(questions_for_embed):
            key = re.sub(r'\s+', ' ', q.strip().lower())
            index_map[i] = norm_to_indices.get(key, [i])
    else:
        index_map = {i: [i] for i in range(len(questions))}

    groups = []
    for gid, cluster in enumerate(clusters):
        rep_idx_local = max(cluster, key=lambda i: len(questions_for_embed[i]))
        rep_global_list = index_map.get(rep_idx_local, [rep_idx_local])
        rep_idx_global = rep_global_list[0] if isinstance(rep_global_list, list) and rep_global_list else rep_idx_local
        representative = questions[rep_idx_global]
        rep_label = extract_subpart_label(questions[rep_idx_global])
        rep_keywords = set(get_keywords(representative, max_keywords=12))
        rep_stem = extract_question_stem(representative)  # Extract core topic keywords
        
        sims = util.cos_sim(embeddings[rep_idx_local], embeddings[cluster]).tolist()[0]
        members = []
        
        for i, q_local_idx in enumerate(cluster):
            global_idxs = index_map.get(q_local_idx, [q_local_idx])
            if not isinstance(global_idxs, list):
                global_idxs = [global_idxs]
            # Use the first as the representative text for scoring, but include all duplicates as members
            q_global_idx0 = global_idxs[0] if global_idxs else q_local_idx
            q_text0 = questions[q_global_idx0]
            q_keywords = set(get_keywords(q_text0, max_keywords=12))
            q_stem = extract_question_stem(q_text0)  # Extract core topic keywords
            # Enhanced keyword matching with synonyms
            semantic_keyword_score = semantic_keyword_match(rep_keywords, q_keywords)
            
            # Question stem matching: compare core topics (ignoring question type words)
            stem_overlap = len(rep_stem & q_stem) / max(1, len(rep_stem | q_stem))
            
            # Boost score if question stems match significantly (same core topic)
            stem_match_score = 1.0 if stem_overlap > 0.6 else (0.5 if stem_overlap > 0.3 else 0.0)
            
            # Traditional Jaccard for direct keyword overlap
            jaccard = float(len(rep_keywords & q_keywords)) / float(len(rep_keywords | q_keywords) or 1)
            
            # Check for same answer pattern (if answer is embedded in text)
            answer_match = 0.0
            if '[Answer:' in representative and '[Answer:' in q_text0:
                rep_answer = re.search(r'\[Answer:\s*(.+?)\]', representative)
                q_answer = re.search(r'\[Answer:\s*(.+?)\]', q_text0)
                if rep_answer and q_answer:
                    # Compare answer similarity
                    answer_sim = util.cos_sim(
                        model.encode([rep_answer.group(1)], convert_to_tensor=True),
                        model.encode([q_answer.group(1)], convert_to_tensor=True)
                    ).item()
                    if answer_sim > 0.75:  # High similarity in answers
                        answer_match = 0.3  # Boost score if answers are similar
            
            label = extract_subpart_label(q_text0)
            label_match = 1.0 if (label and rep_label and label == rep_label) else 0.0
            
            # Enhanced combined score with question stem matching as primary signal
            combined_score = (
                0.30 * float(sims[i]) +  # Semantic similarity (reduced)
                0.30 * stem_match_score +  # Question stem match - CORE TOPIC matching (equal weight with keywords)
                0.25 * semantic_keyword_score +  # Semantic keyword match with synonyms
                0.10 * jaccard +  # Direct keyword overlap
                0.03 * label_match +  # Subpart label match
                0.02 * answer_match  # Answer similarity bonus
            )
            
            for q_global_idx in global_idxs:
                q_text = questions[q_global_idx]
                members.append({
                    "id": int(q_global_idx),
                    "text": q_text,
                    "similarity": float(sims[i]),
                    "keywordOverlap": semantic_keyword_score,  # Use semantic keyword score
                    "directKeywordOverlap": jaccard,  # Keep direct overlap for reference
                    "answerSimilarity": answer_match,
                    "label": label,
                    "score": combined_score
                })
        
        members.sort(key=lambda m: m["score"], reverse=True)
        
        # Enhanced keyword extraction for group
        all_question_texts = []
        for i_local in cluster:
            gl = index_map.get(i_local, [i_local])
            if not isinstance(gl, list):
                gl = [gl]
            if gl:
                all_question_texts.append(questions[gl[0]])
        top_keywords = get_keywords(" ".join(all_question_texts), max_keywords=12)
        
        groups.append({
            "groupId": int(gid),
            "representative": representative,
            "members": members,
            "keywords": top_keywords,
            "groupSize": len(members)
        })

    # Unique questions: not in any cluster
    unique = []
    clustered_global_indices = set()
    for i_local in clustered_indices:
        gl = index_map.get(i_local, [i_local])
        if not isinstance(gl, list):
            gl = [gl]
        for gi in gl:
            clustered_global_indices.add(gi)
    for idx, q in enumerate(questions):
        if idx not in clustered_global_indices:
            unique.append({
                "id": int(idx),
                "text": q,
                "keywords": get_keywords(q)
            })

    elapsed = time.time() - t0
    if VERBOSE:
        print(f"[ocr_nlp] processed {len(texts)} source blocks -> {len(questions)} candidate qs -> "
              f"{len(questions_for_embed)} embedded; clusters={len(groups)}; time={elapsed:.2f}s")

    # Return groups, unique and also candidate list for UI fallback/inspection
    return {"groups": groups, "unique": unique, "candidates": questions}
