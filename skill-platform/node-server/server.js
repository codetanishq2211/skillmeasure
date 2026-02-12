const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors({
  origin: "https://codetanishq2211.github.io",
  methods: ["GET","POST"],
  allowedHeaders: ["Content-Type"],
}));


// --------------------
// Serve Frontend Files
// --------------------
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// --------------------
// Multer Storage (SAFE PDF SAVE)
// --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = Date.now() + ext;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".pdf")) {
      return cb(new Error("Only PDF allowed"));
    }
    cb(null, true);
  }
});

// --------------------
// Health check
// --------------------
app.get("/api", (req, res) => {
  res.send("Node Backend Running 🚀");
});

// Serve upload.html as default
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "upload.html"));
});

// --------------------
// Resume Upload API
// --------------------
app.post("/upload-resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const absolutePath = path.resolve(req.file.path);
    console.log("✅ File saved:", absolutePath);

    // Check file size
    const stat = fs.statSync(absolutePath);
    console.log("📦 File size:", stat.size);

    const response = await axios.post(
  "https://skillmeasure-python.onrender.com/analyze",
  {
    path: absolutePath
  },
  {
    timeout: 30000
  }
);

    res.json(response.data);

  } catch (error) {
    console.error("❌ UPLOAD ERROR:", error.message);
    
    // Check if Python server is not running
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        error: "Python AI server is not running. Please start it on port 8000." 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

