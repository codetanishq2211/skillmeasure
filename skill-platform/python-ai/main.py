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
from fastapi import UploadFile, File

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        temp_path = f"/tmp/{file.filename}"

        with open(temp_path, "wb") as f:
            f.write(contents)

        full_text = extract_text(temp_path)

        skills_found = extract_skills(full_text)
        quiz_data = generate_quiz(skills_found)
        coding_data = generate_coding_challenges(skills_found)

        return {
            "status": "success",
            "skills_found": skills_found,
            "quiz": quiz_data,
            "coding_challenges": coding_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# SERVER STARTUP
# -----------------------------
if __name__ == "__main__":
    print("Starting Python AI Server...")
    # Using 0.0.0.0 to listen on all interfaces for online access
    uvicorn.run(app, host="0.0.0.0", port=8000)