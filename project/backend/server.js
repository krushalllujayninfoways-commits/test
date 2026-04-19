require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use('/api', (req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Config
const JWT_SECRET = process.env.JWT_SECRET || 'render-jwt-secret-2024';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

const users = {};
const otpStore = {};

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5
});

// Email transporter
let transporter;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
  transporter.verify().then(() => console.log('✅ Email ready')).catch(console.error);
}

// API Routes - ALL under /api
app.get('/api/', (req, res) => {
  res.json({
    message: '🚀 MyApp Backend v1.0.0 ✅',
    status: 'live',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/verify-otp',
      'POST /api/auth/resend-otp',
      'POST /api/contact'
    ]
  });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, phone, city, position } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, password required' });
    }

    if (users[email]) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    users[email] = {
      name,
      email,
      phone: phone || '',
      city: city || '',
      position: position || '',
      password: hashedPassword,
      verified: false,
      createdAt: new Date().toISOString()
    };

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = {
      code: otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    };

    console.log(`📧 REGISTER: OTP ${otp} sent to ${email}`);

    // Send email if configured
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"MyApp" <${EMAIL_USER}>`,
          to: email,
          subject: 'MyApp - Verify Email',
          html: `
            <div style="max-width: 500px; margin: 0 auto; font-family: Arial, sans-serif;">
              <h2 style="color: #e94560;">Welcome to MyApp! 🎉</h2>
              <p>Your verification code:</p>
              <div style="background: linear-gradient(135deg, #e94560, #f56565); color: white; font-size: 32px; font-weight: bold; letter-spacing: 12px; padding: 24px; text-align: center; border-radius: 12px; margin: 24px 0;">
                ${otp}
              </div>
              <p><strong>Expires in 10 minutes</strong></p>
            </div>
          `
        });
        console.log(`✅ Email sent to ${email}`);
      } catch (emailError) {
        console.error(`❌ Email failed for ${email}:`, emailError.message);
      }
    }

    res.json({
      message: transporter 
        ? 'Registration successful! Check your email for OTP.' 
        : `Registration successful! Test OTP: ${otp}`,
      emailSent: !!transporter
    });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
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
      return res.status(400).json({ message: 'OTP expired. Request new one.' });
    }

    if (otpData.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Verify success
    users[email].verified = true;
    const token = jwt.sign(
      { email: email, verified: true }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Cleanup
    delete otpStore[email];

    console.log(`✅ ${email} verified successfully`);

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
    console.error('VERIFY OTP ERROR:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
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
      { email, verified: true }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    console.log(`✅ ${email} logged in`);

    res.json({
      message: 'Login successful! 🎉',
      token,
      user: {
        name: user.name,
        email: user.email,
        verified: true
      }
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!users[email]) {
      return res.status(400).json({ message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = {
      code: otp,
      expires: Date.now() + 10 * 60 * 1000
    };

    console.log(`🔄 RESEND: New OTP ${otp} for ${email}`);

    res.json({ 
      message: transporter 
        ? 'New OTP sent to your email!' 
        : `New test OTP: ${otp}`
    });
  } catch (error) {
    console.error('RESEND ERROR:', error);
    res.status(500).json({ message: 'Resend failed' });
  }
});

app.post('/api/contact', (req, res) => {
  console.log('📧 CONTACT FORM:', req.body);
  res.json({ message: 'Your message has been received! We\'ll reply within 24 hours.' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    users: Object.keys(users).length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📱 Test: http://localhost:${PORT}/api/`);
});
