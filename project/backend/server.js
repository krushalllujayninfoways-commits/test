const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const users = new Map();
const sessions = new Map();

app.get('/api/', (req, res) => {
  res.json({ 
    status: 'OK ✅', 
    message: 'MyApp Backend Live!',
    users: users.size 
  });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  if (users.has(email)) {
    return res.status(400).json({ error: 'User exists' });
  }
  
  const otp = Math.floor(Math.random() * 900000 + 100000);
  users.set(email, { name, password, verified: false });
  sessions.set(email, { otp, expires: Date.now() + 600000 });
  
  console.log(`📧 OTP ${otp} for ${email}`);
  res.json({ 
    message: 'Registered! Test OTP: ' + otp,
    otp 
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  
  const session = sessions.get(email);
  if (!session || session.otp != otp || Date.now() > session.expires) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  
  const user = users.get(email);
  user.verified = true;
  users.set(email, user);
  
  const token = 'Bearer-' + Math.random().toString(36).substr(2, 50);
  sessions.delete(email);
  
  res.json({
    message: 'Verified! 🎉',
    token,
    user: { name: user.name, email }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  
  if (!user || !user.verified || user.password !== password) {
    return res.status(400).json({ error: 'Invalid login' });
  }
  
  const token = 'Bearer-' + Math.random().toString(36).substr(2, 50);
  res.json({ 
    token, 
    user: { name: user.name, email } 
  });
});

app.post('/api/auth/resend-otp', (req, res) => {
  const { email } = req.body;
  if (!users.has(email)) {
    return res.status(400).json({ error: 'User not found' });
  }
  
  const otp = Math.floor(Math.random() * 900000 + 100000);
  sessions.set(email, { otp, expires: Date.now() + 600000 });
  
  console.log(`🔄 New OTP ${otp} for ${email}`);
  res.json({ message: 'New OTP: ' + otp });
});

app.post('/api/contact', (req, res) => {
  console.log('📧 Contact:', req.body);
  res.json({ message: 'Sent successfully!' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('🚀 Backend running on port ' + PORT);
});
