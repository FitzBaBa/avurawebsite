const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const WebSocket = require('ws');
const app = express();
app.use(express.json());

// Neon connection
const pool = new Pool({
  connectionString: 'postgresql://username:password@ep-project-name.us-east-2.aws.neon.tech/neondb?sslmode=require',
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8081 });

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  if (!req.headers.authorization || req.headers.authorization !== 'Bearer your-secret-token') {
    ws.close();
    return;
  }
  // Stream analytics changes
  pool.connect((err, client, release) => {
    if (err) return console.error(err);
    client.query('LISTEN analytics_changes');
    client.on('notification', msg => {
      ws.send(msg.payload);
    });
  });
});

// Admin login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT password_hash FROM admins WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: 'your-secret-token' }); // In production, use JWT
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Track analytics event
app.post('/api/track', async (req, res) => {
  const { event_type, event_data, url } = req.body;
  try {
    await pool.query(
      'INSERT INTO analytics (event_type, event_data, url) VALUES ($1, $2, $3)',
      [event_type, event_data, url]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get analytics for dashboard
app.get('/api/analytics', async (req, res) => {
  if (req.headers.authorization !== 'Bearer your-secret-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));