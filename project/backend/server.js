require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-render-jwt-2024';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

const users = {};
const otpStore = {};

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 });

let transporter;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
}

app.get('/', (req, res) => res.json({ 
  message: '🚀 MyApp Backend v1.0.0 ✅', 
  status: 'OK' 
}));

app.post('/auth/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (users[email]) {
      return res.status(400).json({ message: 'User exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    users[email] = { name, email, password: hashed, verified: false };
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { code: otp, expires: Date.now() + 600000 };

    console.log(`📧 OTP ${otp} → ${email}`);

    if (transporter) {
      transporter.sendMail({
        to: email,
        subject: 'MyApp OTP',
        html: `<h1>OTP: ${otp}</h1>`
      }).catch(console.error);
    }

    res.json({ message: 'Registered! OTP sent.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const data = otpStore[email];
    
    if (!data || data.code !== otp || Date.now() > data.expires) {
      return res.status(400).json({ message: 'Invalid/expired OTP' });
    }

    users[email].verified = true;
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    delete otpStore[email];

    res.json({ 
      message: 'Verified!',
      token,
      user: { name: users[email].name, email }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users[email];
    
    if (!user?.verified) {
      return res.status(400).json({ message: 'Verify email first' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: 'Wrong credentials' });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { name: user.name, email } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!users[email]) {
      return res.status(400).json({ message: 'User not found' });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { code: otp, expires: Date.now() + 600000 };
    
    console.log(`🔄 Resend OTP ${otp} → ${email}`);
    res.json({ message: 'New OTP sent!' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/contact', (req, res) => {
  console.log('Contact:', req.body);
  res.json({ message: 'Sent!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend on port ${PORT}`);
});
