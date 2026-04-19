require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'render-secret-2024';
const users = {};
const otpStore = {};

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

app.get('/', (req, res) => {
  res.json({ message: '🚀 MyApp Backend OK!', status: 'live' });
});

app.post('/auth/register', limiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Missing fields' });
    }
    if (users[email]) {
      return res.status(400).json({ message: 'User exists' });
    }

    const hash = await bcrypt.hash(password, 12);
    users[email] = { name, email, password: hash, verified: false };
    
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = { code: otp.toString(), expires: Date.now() + 600000 };
    
    console.log(`OTP ${otp} for ${email}`);
    res.json({ message: `Registered! Test OTP: ${otp}` });
  } catch (e) {
    res.status(500).json({ message: 'Error' });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const data = otpStore[email];
    
    if (!data || data.code !== otp || Date.now() > data.expires) {
      return res.status(400).json({ message: 'Invalid OTP' });
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
    res.status(500).json({ message: 'Error' });
  }
});

app.post('/auth/login', limiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users[email];
    
    if (!user?.verified) {
      return res.status(400).json({ message: 'Verify email first' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: 'Wrong password' });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { name: user.name, email } });
  } catch (e) {
    res.status(500).json({ message: 'Error' });
  }
});

app.post('/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!users[email]) {
      return res.status(400).json({ message: 'User not found' });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = { code: otp.toString(), expires: Date.now() + 600000 };
    
    console.log(`Resend OTP ${otp} for ${email}`);
    res.json({ message: `New OTP: ${otp}` });
  } catch (e) {
    res.status(500).json({ message: 'Error' });
  }
});

app.post('/contact', (req, res) => {
  res.json({ message: 'Contact sent!' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
