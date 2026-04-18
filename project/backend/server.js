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
const frontendDistPath = path.join(__dirname, "../frontend/dist");
const hasFrontendBuild = fs.existsSync(frontendDistPath);

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many requests, please try again later." },
}));

// Serve static frontend files FIRST (before API routes)
if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));
}

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api", publicRoutes);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running", timestamp: new Date().toISOString() });
});

// API 404 handler
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Let React Router handle all non-API routes
if (hasFrontendBuild) {
  app.get("*", (req, res) => {
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

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\nServer running on http://localhost:${PORT}`);
  console.log(`Email: ${process.env.SMTP_USER || "Not configured (demo mode)"}`);
  console.log(`CORS origins: ${hasExplicitOrigins ? allowedOrigins.join(", ") : "All origins allowed"}`);
  console.log(`Frontend build: ${hasFrontendBuild ? frontendDistPath : "Not found"}\n`);
});
