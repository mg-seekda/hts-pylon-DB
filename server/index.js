const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const pylonService = require('./services/pylonService');
const database = require('./services/database');
const dailyIngestion = require('./services/dailyIngestion');
const authMiddleware = require('./middleware/auth');
const cacheMiddleware = require('./middleware/cache');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// Compression
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Webhook routes need raw body access before JSON parsing
app.use('/webhooks', express.raw({ type: 'application/json' }), require('./routes/webhooks'));

// Body parsing for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware
app.use(authMiddleware);

// Cache middleware (if Redis is enabled)
if (process.env.REDIS_ENABLED === 'true') {
  app.use(cacheMiddleware);
}

// API Routes
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/users', require('./routes/users'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/history', require('./routes/history'));
app.use('/api/ticket-lifecycle', require('./routes/ticketLifecycle'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    user: req.user?.email || 'anonymous'
  });
});

// Serve static files (both production and development)
const staticPath = path.join(__dirname, '../client/build');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // Fallback for development when build doesn't exist
  app.get('*', (req, res) => {
    res.json({ 
      error: 'Static files not found', 
      message: 'Please build the client first or run in production mode',
      path: staticPath
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Start daily ingestion scheduler
  if (process.env.NODE_ENV === 'production') {
    dailyIngestion.scheduleDailyIngestion();
  } else {
    console.log('📝 Daily ingestion disabled in development mode');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await database.close();
  process.exit(0);
});
