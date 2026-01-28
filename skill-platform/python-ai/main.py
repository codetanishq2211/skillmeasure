import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Importing your custom logic modules
from resume_parser import extract_text, extract_skills
from quiz_engine import generate_quiz
from coding import generate_coding_challenges

app = FastAPI(title="Skill Measure AI Backend")

# -----------------------------
# CORS CONFIGURATION
# Required so your Node.js backend (Port 3000) can talk to this server
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    # Node backend sends { "path": "C:\\...\\file.pdf" }
    path: Optional[str] = None
    # Allow also sending raw extracted text if desired
    text: Optional[str] = None

# -----------------------------
# TEST ROUTE
# -----------------------------
@app.get("/")
def home():
    return {"msg": "Python AI Server Running 🤖", "status": "online"}

# -----------------------------
# MAIN ANALYZE API
# -----------------------------
@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    """
    Receives a resume PDF path (or raw text), extracts skills,
    and generates relevant assessments.
    """
    try:
        if request.path:
            full_text = extract_text(request.path)
        elif request.text:
            full_text = request.text
        else:
            raise HTTPException(status_code=400, detail="Request must include either 'path' or 'text'")

        if not full_text or len(full_text.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="Could not extract meaningful text from the resume PDF (image-based, encrypted, or unreadable).",
            )

        # 1. Extract skills using your NLP/OCR logic
        # This replaces the hardcoded ["Python", "JavaScript"]
        skills_found = extract_skills(full_text)
        
        # 2. Generate Quiz based on detected skills
        quiz_data = generate_quiz(skills_found)
        
        # 3. Generate Coding Challenges
        coding_data = generate_coding_challenges(skills_found)

        print(f"Successfully processed resume. Skills detected: {skills_found}")

        return {
            "status": "success",
            "skills_found": skills_found,
            "quiz": quiz_data,
            "coding_challenges": coding_data,
            "text_length": len(full_text),
            "text_preview": full_text[:500] + "..." if len(full_text) > 500 else full_text
        }

    except Exception as e:
        print(f"Error during analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

# -----------------------------
# SERVER STARTUP
# -----------------------------
if __name__ == "__main__":
    print("Starting Python AI Server...")
    # Using 0.0.0.0 to listen on all interfaces for online access
    uvicorn.run(app, host="0.0.0.0", port=8000)