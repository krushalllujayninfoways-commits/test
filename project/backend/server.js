require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const publicRoutes = require("./routes/public");
const userRoutes = require("./routes/user");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Correct frontend build path
const frontendDistPath = path.join(__dirname, "../frontend/dist");
const hasFrontendBuild = fs.existsSync(frontendDistPath);

// ✅ CORS setup
const hasExplicitOrigins = Boolean(process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim());
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || !hasExplicitOrigins || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS not allowed for this origin"));
  },
  credentials: true,
}));

// ✅ Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many requests, please try again later." },
}));

// =========================
// ✅ SERVE FRONTEND FILES
// =========================
if (hasFrontendBuild) {
  console.log("Serving frontend from:", frontendDistPath);

  // 🔥 IMPORTANT: serve static files FIRST
  app.use(express.static(frontendDistPath));
}

// =========================
// ✅ API ROUTES
// =========================
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api", publicRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API 404
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// =========================
// ✅ REACT ROUTER SUPPORT (FIXED)
// =========================
if (hasFrontendBuild) {
  app.get("*", (req, res, next) => {
    // ❌ Skip API routes
    if (req.path.startsWith("/api")) {
      return next();
    }

    // ❌ Skip static assets (VERY IMPORTANT FIX)
    if (req.path.startsWith("/assets")) {
      return next();
    }

    // ✅ Serve React app
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "API is running. Frontend build not found yet.",
    });
  });
}

// =========================
// ✅ GLOBAL ERROR HANDLER
// =========================
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// =========================
// ✅ START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`\nServer running on http://localhost:${PORT}`);
  console.log(`CORS origins: ${hasExplicitOrigins ? allowedOrigins.join(", ") : "All origins allowed"}`);
  console.log(`Frontend build: ${hasFrontendBuild ? frontendDistPath : "Not found"}\n`);
});
