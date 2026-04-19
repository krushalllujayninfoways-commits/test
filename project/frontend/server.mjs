import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Debug: Check if dist exists
const distPath = path.join(__dirname, 'dist');
console.log('Dist path:', distPath);
console.log('Dist exists:', fs.existsSync(distPath));

if (!fs.existsSync(distPath)) {
  console.error('❌ DIST FOLDER MISSING!');
  process.exit(1);
}

// Serve static files
app.use(express.static(distPath, { 
  index: false,
  fallthrough: true 
}));

// Catch-all for React Router
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log(`Serving ${req.path} → ${indexPath}`);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('❌ index.html missing:', indexPath);
    res.status(404).send('Frontend build missing');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Frontend: http://localhost:${port}`);
  console.log(`📁 Dist: ${distPath}`);
});
