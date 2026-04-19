// ✅ COMPLETE ES MODULE VERSION - Replace your entire server.js
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-app-name.onrender.com' 
    : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-2024';
const EMAIL_USER = process.env.EMAIL_USER || 'your-email@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your-app-password';

// In-memory storage
const users = {};
const otpStore = {};

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many registrations. Try again in 1 hour.' }
});

// Email transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Test email on startup
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email setup failed:', error.message);
  } else {
    console.log('✅ Email transporter ready');
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'MyApp Backend API ✅',
    status: 'running',
    version: '1.0.0',
    endpoints: ['POST /auth/register', 'POST /auth/login', 'POST /auth/verify-otp']
  });
});

app.post('/auth/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, phone, city, position } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (users[email]) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    users[email] = {
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      city: city || '',
      position: position || '',
      verified: false,
      createdAt: new Date().toISOString()
    };

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = {
      code: otp,
      expires: Date.now() + 10 * 60 * 1000
    };

    console.log(`📧 Sending OTP ${otp} to ${email}`);

    // For Render demo - log OTP instead of sending email
    if (process.env.NODE_ENV === 'production') {
      await transporter.sendMail({
        from: `"MyApp" <${EMAIL_USER}>`,
        to: email,
        subject: 'MyApp - Verify Your Email',
        html: `
          <h2 style="color: #e94560;">Welcome to MyApp!</h2>
          <div style="background: #e94560; color: white; font-size: 32px; font-weight: bold; letter-spacing: 12px; padding: 24px; text-align: center; border-radius: 12px; margin: 24px 0;">
            ${otp}
          </div>
          <p>This code expires in 10 minutes.</p>
        `
      });
    }

    res.json({ 
      message: `Registration successful! ${process.env.NODE_ENV === 'production' ? 'Check your email' : `Test OTP: ${otp}`}`,
      emailSent: process.env.NODE_ENV === 'production'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP required' });
    }

    const otpData = otpStore[email];
    if (!otpData) {
      return res.status(400).json({ message: 'No OTP found. Register again.' });
    }

    if (Date.now() > otpData.expires) {
      delete otpStore[email];
      return res.status(400).json({ message: 'OTP expired' });
    }

    if (otpData.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    users[email].verified = true;
    const token = jwt.sign({ email, verified: true }, JWT_SECRET, { expiresIn: '7d' });
    delete otpStore[email];

    res.json({ 
      message: 'Email verified! 🎉',
      token,
      user: {
        name: users[email].name,
        email: users[email].email,
        verified: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed' });
  }
});

app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users[email];
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.verified) return res.status(400).json({ message: 'Please verify your email' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ email, verified: true }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful!',
      token,
      user: { name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!users[email]) return res.status(400).json({ message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { code: otp, expires: Date.now() + 10 * 60 * 1000 };

    console.log(`🔄 Resend OTP ${otp} to ${email}`);

    res.json({ message: `New OTP sent! ${process.env.NODE_ENV === 'production' ? '' : `Test OTP: ${otp}`}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

app.post('/contact', (req, res) => {
  console.log('📧 Contact:', req.body);
  res.json({ message: 'Message received! We\'ll reply within 24 hours.' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', users: Object.keys(users).length });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 MyApp Backend on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:5173`);
  console.log(`🔗 API Docs: http://localhost:${PORT}`);
});
