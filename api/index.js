const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { db } = require('../config/firebase');

// Import routes
const teachersRoutes = require('../routes/teachers');
const subjectsRoutes = require('../routes/subjects');
const departmentsRoutes = require('../routes/departments');
const roomsRoutes = require('../routes/rooms');
const schedulesRoutes = require('../routes/schedules');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration - allow all origins for Vercel deployment
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/teachers', teachersRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/schedules', schedulesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
