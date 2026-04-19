const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-super-secret-jwt-key-12345';
const users = {}; // Simple in-memory storage

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts'
});

// Email transporter (use Gmail or SMTP)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com', // Replace with your email
    pass: 'your-app-password'     // Gmail App Password
  }
});

// Mock OTP storage
const otpStore = {};

// Routes
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (users[email]) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    users[email] = { name, email, password: hashedPassword, verified: false };

    // Send OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;

    await transporter.sendMail({
      to: email,
      subject: 'MyApp - Verify Your Email',
      html: `
        <h2>Welcome to MyApp!</h2>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code expires in 10 minutes.</p>
      `
    });

    res.json({ message: 'Registration successful. Check your email for OTP.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  
  if (otpStore[email] === otp) {
    users[email].verified = true;
    delete otpStore[email];
    
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      message: 'Email verified successfully!',
      token,
      user: users[email]
    });
  } else {
    res.status(400).json({ message: 'Invalid OTP' });
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

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/contact', (req, res) => {
  // Mock contact form
  res.json({ message: 'Message sent successfully!' });
});

app.listen(5000, () => {
  console.log('🚀 Backend running on http://localhost:5000');
});
