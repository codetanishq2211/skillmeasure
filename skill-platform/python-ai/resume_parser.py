import fitz  # PyMuPDF for PDF text extraction
import re
import os
import pytesseract  # OCR for scanned PDFs
from PIL import Image  # Used with PyMuPDF rendering for OCR

# pdf2image is optional (requires Poppler installed). We'll try it only if available.
try:
    from pdf2image import convert_from_path  # type: ignore
except Exception:  # pragma: no cover
    convert_from_path = None

# Add Tesseract to PATH for Windows
os.environ['PATH'] += r';C:\Program Files\Tesseract-OCR'


# -----------------------------
# PDF TEXT EXTRACTION ENGINE
# -----------------------------
def extract_text(pdf_path: str) -> str:
    print(f"📂 Processing PDF: {pdf_path}")
    
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    try:
        # Open PDF with PyMuPDF
        doc = fitz.open(pdf_path)
        text = ""
        
        # Extract text from each page
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            page_text = page.get_text()
            text += page_text + "\n"
        
        doc.close()
        
        # Check if we got meaningful text
        if len(text.strip()) < 50:
            print("Little text extracted, trying OCR...")
            ocr_text = extract_text_with_ocr(pdf_path)
            if ocr_text and len(ocr_text.strip()) > len(text.strip()):
                text = ocr_text
            # If OCR doesn't give better results, keep the original text
        
        print(f"Extracted {len(text)} characters from PDF")
        print(f"\n========== TEXT EXTRACTION SUMMARY ==========")
        print(f"Total characters: {len(text)}")
        print(f"First 500 chars: {text[:500]}")
        print("==============================================\n")
        
        return text
    
    except Exception as e:
        print(f"Error extracting text: {e}")
        # Fallback to OCR
        return extract_text_with_ocr(pdf_path)


def extract_text_with_ocr(pdf_path: str) -> str:
    """Extract text from PDF using OCR for scanned documents"""
    # Prefer PyMuPDF page rendering (no Poppler dependency).
    try:
        print("Using OCR for text extraction...")

        doc = fitz.open(pdf_path)
        text_parts: list[str] = []

        for page_num in range(len(doc)):
            page = doc.load_page(page_num)

            # Render page to an image (2x scale for better OCR)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

            page_text = pytesseract.image_to_string(img)
            text_parts.append(page_text)

        doc.close()

        text = "\n".join(text_parts).strip()
        print(f"OCR (PyMuPDF render) extracted {len(text)} characters")
        return text
    
    except Exception as e:
        print(f"OCR (PyMuPDF render) failed: {e}")

    # Fallback: pdf2image if installed + Poppler available
    if convert_from_path is not None:
        try:
            print("Falling back to pdf2image OCR...")
            images = convert_from_path(pdf_path)
            text = ""
            for image in images:
                text += pytesseract.image_to_string(image) + "\n"
            text = text.strip()
            print(f"OCR (pdf2image) extracted {len(text)} characters")
            return text
        except Exception as e:
            print(f"OCR (pdf2image) failed: {e}")

    return ""


# -----------------------------
# SMART SKILL EXTRACTOR
# -----------------------------
SKILLS_DB = [
    # Programming Languages
    "python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "rust", "kotlin", "swift",
    "php", "ruby", "scala", "r", "matlab", "perl", "shell", "bash",
    # Web Technologies
    "html", "css", "sass", "less", "bootstrap", "tailwind",
    "react", "vue", "angular", "next.js", "nuxt", "svelte",
    "node", "node.js", "express", "nestjs", "fastapi", "django", "flask", "spring", "laravel",
    "rest api", "graphql", "websocket",
    # Databases
    "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "cassandra", "elasticsearch",
    "oracle", "sqlite", "firebase", "dynamodb", "neo4j",
    # Cloud & DevOps
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s", "jenkins", "gitlab ci",
    "github actions", "terraform", "ansible", "git", "github", "gitlab",
    # Mobile
    "android", "ios", "react native", "flutter", "xamarin", "ionic",
    # Data Science & AI
    "machine learning", "ml", "deep learning", "artificial intelligence", "ai", "data science",
    "data analysis", "pandas", "numpy", "tensorflow", "pytorch", "keras", "scikit-learn",
    "opencv", "nlp", "natural language processing", "computer vision",
    # Other Technologies
    "linux", "unix", "windows", "networking", "cybersecurity", "blockchain",
    "microservices", "agile", "scrum", "devops", "ci/cd", "api", "json", "xml"
]

# Mapping for skill name normalization (to match question bank)
SKILL_MAPPING = {
    "python": "Python",
    "java": "Java",
    "c": "C",
    "machine learning": "Machine Learning",
    "ml": "Machine Learning",
    "deep learning": "Machine Learning",
    "artificial intelligence": "Machine Learning",
    "ai": "Machine Learning",
    "data science": "Machine Learning",
    "javascript": "JavaScript",
    "react": "React",
    "node": "Node.js",
    "node.js": "Node.js",
    "express": "Express",
    "django": "Django",
    "flask": "Flask",
    "sql": "SQL",
    "mongodb": "MongoDB",
    "aws": "AWS",
    "docker": "Docker",
    "git": "Git",
    "android": "Android",
    "flutter": "Flutter",
    "linux": "Linux",
    "networking": "Networking"
}

def extract_skills(text: str):
    """Very simple, robust skill extractor: scan whole text for known skills."""
    if not text or len(text.strip()) < 10:
        print("Text too short for skill extraction")
        return []

    text_lower = text.lower()
    # Normalized version without punctuation for easier substring checks
    text_normalized = re.sub(r"[^\w\s]", " ", text_lower)
    text_normalized = re.sub(r"\s+", " ", text_normalized)

    print(f"Searching for skills in {len(text)} character text...")

    found = set()

    # 1) Direct scan for all skills in SKILLS_DB
    for skill in SKILLS_DB:
        raw = skill.lower()
        norm = re.sub(r"[^\w\s]", " ", raw)
        norm = re.sub(r"\s+", " ", norm).strip()
        if not norm:
            continue

        # Simple substring on normalized text
        if norm in text_normalized:
            normalized_name = SKILL_MAPPING.get(raw, skill.title())
            found.add(normalized_name)

    # 2) Common variations and abbreviations
    variations = {
        "js": "JavaScript",
        "reactjs": "React",
        "react.js": "React",
        "nodejs": "Node.js",
        "node.js": "Node.js",
        "postgres": "PostgreSQL",
        "postgresql": "PostgreSQL",
        "ml": "Machine Learning",
        "ai": "Machine Learning",
        "aws cloud": "AWS",
        "amazon web services": "AWS",
        "gcp": "GCP",
        "google cloud platform": "GCP",
        "rest": "REST API",
        "restful": "REST API",
        "nosql": "NoSQL",
        "no sql": "NoSQL",
        "html5": "HTML",
        "css3": "CSS",
    }

    for key, value in variations.items():
        var_norm = re.sub(r"[^\w\s]", " ", key.lower())
        var_norm = re.sub(r"\s+", " ", var_norm).strip()
        if var_norm and var_norm in text_normalized:
            found.add(value)

    result = sorted(found)
    print(f"Total skills found: {len(result)}")
    print(f"   Skills: {result}")

    if not result:
        print("No skills detected!")
        print(f"   Text sample (first 300 chars): {text_lower[:300]}")

    return result
