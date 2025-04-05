require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { router: adminRouter, verifyAdmin } = require('./admin-auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CORS Configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://webdevgurus.online',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,  // This is crucial
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());  // Enable preflight for all routes
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Portfolio Schema and Model
const portfolioSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'] },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  subject: { type: String, required: [true, 'Subject is required'] },
  message: { type: String, required: [true, 'Message is required'] },
  date: { type: Date, default: Date.now },
  ip: { type: String }
}, { collection: 'portfolio' });

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// Public Portfolio Submission Endpoint (No JWT)
app.post('/api/contacts', async (req, res) => {
  try {
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0].trim() || 
               req.socket?.remoteAddress;

    const portfolioItem = await Portfolio.create({
      ...req.body,
      ip: ip
    });

    console.log('✅ Portfolio item created:', portfolioItem);
    res.status(201).json({ 
      success: true, 
      data: portfolioItem,
      message: 'Message received successfully' 
    });

  } catch (error) {
    console.error('❌ Submission error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process your message'
    });
  }
});

// Protected Admin Routes (Keep JWT for these)
// Protected Admin Routes
app.use('/api/admin', adminRouter);

// Get all contacts (protected)
// Protected route with better error handling
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Portfolio.find().sort({ date: -1 });
    res.json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts'
    });
  }
});

// Get single contact (protected)
app.get('/api/contacts/:id', verifyAdmin, async (req, res) => {
  try {
    const contact = await Portfolio.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      data: contact
    });

  } catch (error) {
    console.error('Failed to fetch contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact',
      message: error.message
    });
  }
});

// Delete contact (protected)
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const deletedContact = await Portfolio.findByIdAndDelete(req.params.id);
    
    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully',
      data: deletedContact
    });

  } catch (error) {
    console.error('Failed to delete contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
      message: error.message
    });
  }
});

// Update contact (protected)
app.put('/api/contacts/:id', verifyAdmin, async (req, res) => {
  try {
    const updatedContact = await Portfolio.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedContact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact updated successfully',
      data: updatedContact
    });

  } catch (error) {
    console.error('Failed to update contact:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update contact',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running', 
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Error handlers
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});