# Skill Measure AI Platform

A full-stack application that analyzes resumes and generates skill-based quizzes.

## Architecture

- **Frontend**: HTML/CSS/JavaScript (in `skill-platform/frontend/`)
- **Node.js Backend**: Express server for file uploads (port 3000)
- **Python AI Backend**: FastAPI server for resume analysis and quiz generation (port 8000)

## Setup Instructions

### 1. Python AI Server Setup

```bash
cd skill-platform/python-ai
pip install -r requirements.txt
python main.py
```

The Python server will run on `http://127.0.0.1:8000`

### 2. Node.js Backend Setup

```bash
cd skill-platform/node-server
npm install
node server.js
```

The Node server will run on `http://localhost:3000`

### 3. Frontend

Open `skill-platform/frontend/upload.html` in your browser.

## Dependencies

### Python
- fastapi
- uvicorn
- PyMuPDF (fitz)
- pytesseract
- pdf2image
- Pillow

**Note**: For OCR to work, you need to install Tesseract OCR:
- Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
- Mac: `brew install tesseract`
- Linux: `sudo apt-get install tesseract-ocr`

### Node.js
- express
- cors
- axios
- multer

## Usage

1. Start both servers (Python on port 8000, Node on port 3000)
2. Open `upload.html` in your browser
3. Upload a PDF resume
4. View detected skills and take the generated quiz

## Troubleshooting

- **Python server not responding**: Make sure it's running on port 8000
- **No quiz generated**: The resume might not contain skills that match the question bank
- **OCR not working**: Install Tesseract OCR on your system
- **File upload fails**: Check that the file is a PDF and under 20MB
