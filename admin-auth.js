// admin-auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const mongoose = require('mongoose');

// Admin model
const Admin = mongoose.model('Admin', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

// Middleware to verify admin token
// Enhanced verifyAdmin middleware
const verifyAdmin = (req, res, next) => {
  // Check for token in both cookies and Authorization header
  const token = req.cookies?.adminToken || 
                req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({
      success: false,
      error: 'Authentication token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.adminId = decoded.id;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      action: 'reauthenticate'
    });
  }
};

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });

    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });

    res.json({ success: true, message: 'Logged in successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Admin logout
router.post('/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check admin auth status
router.get('/check-auth', verifyAdmin, (req, res) => {
  res.json({ success: true, isAuthenticated: true });
});

module.exports = { router, verifyAdmin };