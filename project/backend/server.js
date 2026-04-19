require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = process.env.JWT_SECRET || 'myapp-secret-2024';
const users = new Map();
const otps = new Map();

app.get('/api/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MyApp Backend Live ✅',
    users: users.size 
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    
    if (users.has(email)) {
      return res.status(400).json({ error: 'User exists' });
    }
    
    const hash = await bcrypt.hash(password, 12);
    const otp = (Math.random() * 900000 + 100000).toFixed(0);
    
    users.set(email, { name, hash, verified: false });
    otps.set(email, { code: otp, expires: Date.now() + 600000 });
    
    console.log(`📧 OTP ${otp} → ${email}`);
    
    res.json({ 
      message: 'Registered! Test OTP: ' + otp,
      otp: otp 
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const otpData = otps.get(email);
    if (!otpData || otpData.code != otp || Date.now() > otpData.expires) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    const user = users.get(email);
    user.verified = true;
    users.set(email, user);
    
    const token = jwt.sign({ email }, SECRET, { expiresIn: '7d' });
    otps.delete(email);
    
    res.json({
      message: 'Verified!',
      token,
      user: { name: user.name, email }
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.get(email);
    
    if (!user || !user.verified) {
      return res.status(400).json({ error: 'Verify email first' });
    }
    
    const valid = await bcrypt.compare(password, user.hash);
    if (!valid) {
      return res.status(400).json({ error: 'Wrong password' });
    }
    
    const token = jwt.sign({ email }, SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { name: user.name, email } 
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!users.has(email)) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    const otp = (Math.random() * 900000 + 100000).toFixed(0);
    otps.set(email, { code: otp, expires: Date.now() + 600000 });
    
    console.log(`🔄 New OTP ${otp} → ${email}`);
    res.json({ message: 'New OTP: ' + otp });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/contact', (req, res) => {
  console.log('Contact:', req.body);
  res.json({ message: 'Sent!' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('🚀 Backend on port', PORT);
});
