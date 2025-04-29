require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const votesRoutes = require('./routes/votes');
const app = express();

// Set default JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/evoting';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', (error) => console.error('MongoDB connection error:', error));
db.once('open', () => {
  console.log('Connected to MongoDB');
  
  // Start server only after DB connection is open
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Essential middleware 
app.use(cors());
app.use(express.json());
app.use('/api/votes', votesRoutes);

// Add diagnostic middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Import and use routes
const authRoutes = require('./routes/auth');
const electionRoutes = require('./routes/elections');
app.use('/api/auth', authRoutes);
app.use('/api/elections', electionRoutes);

// Serve static files (moved after API routes)
app.use(express.static(path.join(__dirname, '../src')));

// Diagnostic test routes
app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: 'pong' });
});

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working!' });
});

app.get('/api/debug', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState ? 'connected' : 'disconnected',
    serverTime: new Date().toISOString()
  });
});

// Debug route to check admin user (Only available in development)
app.get('/api/debug/admin', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not available in production' });
  }
  
  try {
    // Check if admin exists but don't return sensitive info
    const Voter = require('./models/Voter');
    const admin = await Voter.findOne({ role: 'admin' }).select('-password');
    
    if (admin) {
      res.json({
        success: true,
        message: 'Admin user found',
        adminExists: true,
        email: admin.email,
        verified: admin.isVerified
      });
    } else {
      res.json({
        success: false,
        message: 'No admin user found',
        adminExists: false
      });
    }
  } catch (error) {
    console.error('Admin debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking admin user',
      error: error.message
    });
  }
});

// Custom error handler for API routes
app.use('/api', (err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.toString() : undefined
  });
});

// Default route - send HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../src/index.html'));
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
