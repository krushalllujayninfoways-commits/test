const express = require('express');
const path = require('path');
app = express();

app.use(express.static('dist'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server ready'));
