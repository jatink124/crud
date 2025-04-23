const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Admin Schema and Model
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  lastLogin: { type: Date }
}, { collection: 'admin_users' });

const Admin = mongoose.model('Admin', adminSchema);

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(403).json({ success: false, error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Failed to authenticate token' });
    }
    
    req.adminId = decoded.id;
    next();
  });
};

// Admin Login Route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find admin by username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();
    
    // Create token
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    res.json({ 
      success: true, 
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        lastLogin: admin.lastLogin
      }
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Admin Profile Route (protected)
router.get('/profile', verifyAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.adminId).select('-password');
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// Admin Contacts Route (get all contacts)
router.get('/contacts', verifyAdmin, async (req, res) => {
  try {
    const contacts = await mongoose.model('Portfolio').find().sort({ date: -1 });
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});

// Admin Chat Statistics
router.get('/chat/stats', verifyAdmin, async (req, res) => {
  try {
    const totalMessages = await mongoose.model('ChatMessage').countDocuments();
    const unreadMessages = await mongoose.model('ChatMessage').countDocuments({ read: false, isAdmin: false });
    const recentMessages = await mongoose.model('ChatMessage').find()
      .sort({ timestamp: -1 })
      .limit(5);
    
    res.json({
      success: true,
      stats: {
        totalMessages,
        unreadMessages,
        recentMessages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch chat stats' });
  }
});

// Initial admin setup route (remove after first use)
router.post('/setup', async (req, res) => {
  try {
    // Check if any admin exists
    const adminExists = await Admin.exists({});
    if (adminExists) {
      return res.status(400).json({ success: false, error: 'Admin already exists' });
    }

    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = new Admin({
      username,
      password: hashedPassword,
      lastLogin: new Date()
    });

    await admin.save();
    res.json({ success: true, message: 'Admin created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Setup failed' });
  }
});

module.exports = {
  router,
  verifyAdmin
};