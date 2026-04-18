require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const publicRoutes = require("./routes/public");
const userRoutes = require("./routes/user");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: "Too many requests, please try again later." },
}));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api", publicRoutes);
app.use("/api/user", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Email: ${process.env.SMTP_USER || "Not configured (demo mode)"}`);
  console.log(`🌐 CORS origin: ${process.env.FRONTEND_URL || "http://localhost:5173"}\n`);
});
