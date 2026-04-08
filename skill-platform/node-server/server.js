const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const FormData = require("form-data");
const sqlite3 = require("sqlite3").verbose();

const app = express();

// Get Python backend URL from environment or use localhost
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8003";

// ===============================
// Database Setup (SQLite)
// ===============================
const DB_FILE = path.join(__dirname, "resumes.db");
console.log("📁 Database file path:", DB_FILE);

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error("❌ Database connection error:", err);
    process.exit(1); // Exit if DB connection fails
  } else {
    console.log("✅ Connected to SQLite database at:", DB_FILE);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentName TEXT NOT NULL,
      registerNumber TEXT NOT NULL,
      resumeFile TEXT NOT NULL,
      skillsFound TEXT,
      quizScore INTEGER DEFAULT 0,
      codingScore INTEGER DEFAULT 0,
      totalQuizQuestions INTEGER DEFAULT 0,
      totalCodingQuestions INTEGER DEFAULT 0,
      uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      completedAt DATETIME
    )
  `, (err) => {
    if (err) {
      console.error("❌ Error creating resumes table:", err);
      process.exit(1);
    } else {
      console.log("✅ Resumes table ready");
    }
  });
}

// ===============================
// CORS (Temporary Open for Debug)
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// Serve Frontend Files
// ===============================
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// ===============================
// Multer Storage (PDF Upload)
// ===============================
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure uploads directory exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log("✅ Created uploads directory:", UPLOADS_DIR);
  }
} catch (error) {
  console.error("❌ Failed to create uploads directory:", error);
  process.exit(1);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = Date.now() + "-" + Math.round(Math.random() * 1E9) + ext;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".pdf")) {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  }
});

// ===============================
// Health Check (Critical for Render)
// ===============================
app.get("/health", (req, res) => {
  // Check database connectivity
  db.get("SELECT 1", (err) => {
    if (err) {
      console.error("❌ Health check failed - DB error:", err);
      return res.status(503).json({
        status: "unhealthy",
        message: "Database connection failed",
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: "healthy",
      message: "Server is running",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });
});

app.get("/api", (req, res) => {
  res.send("Node Backend Running 🚀");
});

// Default Route
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

// ===============================
// Resume Upload API
// ===============================
app.post("/upload-resume", upload.single("resume"), async (req, res) => {
  try {
    console.log("📥 Upload request received");

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Get student info from request
    const studentName = req.body.studentName || "Unknown";
    const registerNumber = req.body.registerNumber || localStorage?.getItem?.("registerNumber") || "Unknown";

    const absolutePath = path.resolve(req.file.path);
    console.log("✅ File saved at:", absolutePath);

    const stat = fs.statSync(absolutePath);
    console.log("📦 File size:", stat.size);

    // Send file to Python AI server
    const form = new FormData();
    form.append("file", fs.createReadStream(absolutePath));

    console.log("🚀 Sending file to Python AI server...");
    console.log("Python backend URL:", PYTHON_BACKEND_URL);

    const response = await axios.post(
      `${PYTHON_BACKEND_URL}/analyze`,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000 // 30 second timeout instead of infinite
      }
    );

    console.log("✅ Python server response received");

    // Save resume to database
    const skillsFound = response.data.skills_found || [];
    const totalQuizQuestions = response.data.quiz ? response.data.quiz.length : 0;
    const totalCodingQuestions = response.data.coding_challenges ? response.data.coding_challenges.length : 0;

    db.run(
      `INSERT INTO resumes (studentName, registerNumber, resumeFile, skillsFound, totalQuizQuestions, totalCodingQuestions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        studentName,
        registerNumber,
        absolutePath,
        JSON.stringify(skillsFound),
        totalQuizQuestions,
        totalCodingQuestions
      ],
      (err) => {
        if (err) {
          console.error("❌ Error saving resume to database:", err);
        } else {
          console.log("✅ Resume saved to database");
        }
      }
    );

    // Add uploadId to response for tracking
    response.data.uploadId = Date.now().toString();
    response.data.registerNumber = registerNumber;

    res.json(response.data);

  } catch (error) {
    console.error("❌ FULL ERROR:", error);

    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("🗑️ Cleaned up failed upload:", req.file.path);
      } catch (cleanupError) {
        console.error("⚠️ Failed to cleanup file:", cleanupError);
      }
    }

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data
      });
    }

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "Python server is not running."
      });
    }

    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        error: "Python server took too long to respond."
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// ===============================
// Teacher API - Get All Resumes
// ===============================
app.get("/api/teacher/resumes", (req, res) => {
  const sortBy = req.query.sortBy || "quizScore"; // or 'codingScore', 'uploadedAt'
  const orderBy = req.query.order || "DESC"; // or 'ASC'

  db.all(
    `SELECT * FROM resumes ORDER BY ${sortBy} ${orderBy}`,
    (err, rows) => {
      if (err) {
        console.error("❌ Error fetching resumes:", err);
        return res.status(500).json({ error: "Failed to fetch resumes" });
      }
      
      // Parse skillsFound JSON back to array
      const resumes = rows.map(row => ({
        ...row,
        skillsFound: Array.isArray(row.skillsFound) ? row.skillsFound : JSON.parse(row.skillsFound || "[]")
      }));

      console.log("✅ Fetched", resumes.length, "resumes");
      res.json(resumes);
    }
  );
});

// ===============================
// Teacher API - Delete All Resumes
// ===============================
app.delete("/api/teacher/resumes", (req, res) => {
  db.run("DELETE FROM resumes", function(err) {
    if (err) {
      console.error("❌ Error deleting resumes:", err);
      return res.status(500).json({ error: "Failed to delete resumes" });
    }
    console.log("🗑️ All resumes deleted");
    res.json({ success: true, message: "All resumes cleared" });
  });
});

// ===============================
// Teacher API - Get Resume Details
// ===============================
app.get("/api/teacher/resumes/:id", (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT * FROM resumes WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error("❌ Error fetching resume:", err);
        return res.status(500).json({ error: "Failed to fetch resume" });
      }
      
      if (!row) {
        return res.status(404).json({ error: "Resume not found" });
      }

      // Parse skillsFound JSON back to array
      row.skillsFound = Array.isArray(row.skillsFound) ? row.skillsFound : JSON.parse(row.skillsFound || "[]");
      
      res.json(row);
    }
  );
});

// ===============================
// Update Quiz & Coding Scores
// ===============================
app.post("/api/update-scores", express.json(), (req, res) => {
  const { registerNumber, quizScore, codingScore, totalQuizQuestions, totalCodingQuestions } = req.body;

  if (!registerNumber) {
    return res.status(400).json({ error: "Register number is required" });
  }

  db.run(
    `UPDATE resumes 
     SET quizScore = ?, codingScore = ?, totalQuizQuestions = ?, totalCodingQuestions = ?, completedAt = CURRENT_TIMESTAMP
     WHERE registerNumber = ?`,
    [quizScore, codingScore, totalQuizQuestions, totalCodingQuestions, registerNumber],
    function(err) {
      if (err) {
        console.error("❌ Error updating scores:", err);
        return res.status(500).json({ error: "Failed to update scores" });
      }

      console.log("✅ Scores updated for:", registerNumber);
      res.json({ success: true, message: "Scores updated" });
    }
  );
});

// ===============================
// Periodic Cleanup (Prevent Disk Space Issues)
// ===============================
setInterval(() => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const now = Date.now();
    let cleanedCount = 0;

    files.forEach(file => {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = fs.statSync(filePath);

      // Delete files older than 24 hours
      if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`🗑️ Cleaned up ${cleanedCount} old files from uploads directory`);
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  }
}, 60 * 60 * 1000); // Every hour

// ===============================
// Start Server
// ===============================
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
});

// ===============================
// Graceful Shutdown
// ===============================
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
        process.exit(1);
      }
      console.log('✅ Database closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
        process.exit(1);
      }
      console.log('✅ Database closed');
      process.exit(0);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});