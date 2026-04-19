// COMPLETE SERVER CODE (copy this entire file)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Your frontend URL
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Environment variables (create .env file later)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-2024';
const EMAIL_USER = process.env.EMAIL_USER || 'your-email@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your-app-password';

// In-memory storage (use MongoDB/PostgreSQL in production)
const users = {};
const otpStore = {};

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
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

// Test email connection on startup
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
    endpoints: ['/auth/register', '/auth/login', '/auth/verify-otp']
  });
});

app.post('/auth/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, phone, city, position } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (users[email]) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Save user (unverified)
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

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = {
      code: otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    };

    // Send email
    await transporter.sendMail({
      from: `"MyApp" <${EMAIL_USER}>`,
      to: email,
      subject: 'MyApp - Verify Your Email Address',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #e94560;">Welcome to MyApp! 🎉</h2>
          <p>Your verification code is:</p>
          <div style="background: #e94560; color: white; font-size: 24px; font-weight: bold; letter-spacing: 8px; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p>If you didn't create this account, ignore this email.</p>
        </div>
      `
    });

    console.log(`📧 OTP sent to ${email}`);
    res.json({ 
      message: 'Registration successful! Check your email for the 6-digit verification code.',
      emailSent: true 
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const otpData = otpStore[email];
    if (!otpData) {
      return res.status(400).json({ message: 'No OTP found. Please register again.' });
    }

    if (Date.now() > otpData.expires) {
      delete otpStore[email];
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    if (otpData.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Mark user as verified
    users[email].verified = true;
    
    // Generate JWT
    const token = jwt.sign(
      { email: email, verified: true }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Clean up
    delete otpStore[email];

    res.json({ 
      message: 'Email verified successfully! 🎉',
      token,
      user: {
        name: users[email].name,
        email: users[email].email,
        verified: true
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
});

app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users[email];
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.verified) {
      return res.status(400).json({ message: 'Please verify your email first' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { email: email, verified: true }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'Login successful!',
      token,
      user: {
        name: user.name,
        email: user.email,
        verified: true
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!users[email]) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = {
      code: otp,
      expires: Date.now() + 10 * 60 * 1000
    };

    await transporter.sendMail({
      from: `"MyApp" <${EMAIL_USER}>`,
      to: email,
      subject: 'MyApp - New Verification Code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #e94560;">New Verification Code</h2>
          <p>Your new verification code is:</p>
          <div style="background: #e94560; color: white; font-size: 24px; font-weight: bold; letter-spacing: 8px; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
        </div>
      `
    });

    res.json({ message: 'New OTP sent to your email!' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

app.post('/contact', (req, res) => {
  console.log('Contact form:', req.body);
  res.json({ message: 'Your message has been sent successfully! We\'ll get back to you within 24 hours.' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 MyApp Backend running on http://localhost:${PORT}`);
  console.log(`📧 Email: ${EMAIL_USER}`);
  console.log(`🔑 Using JWT_SECRET: ${JWT_SECRET.slice(0, 10)}...`);
});
