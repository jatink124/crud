require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { router: adminRouter, verifyAdmin } = require('./admin-auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ======================
// 1. Middleware Configuration
// ======================

// Enhanced CORS configuration
const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:3000',
  process.env.FRONTEND_URL // Add production frontend URL
].filter(Boolean); // Remove any undefined values

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// 2. Database Connection
// ======================

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`Connected to DB: ${mongoose.connection.db.databaseName}`);
    
    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to DB');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected');
    });
    
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

connectDB();

// ======================
// 3. Data Models
// ======================

const contactSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  subject: { 
    type: String, 
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: { 
    type: String, 
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  date: { 
    type: Date, 
    default: Date.now,
    immutable: true
  },
  ip: {
    type: String,
    immutable: true
  }
}, { 
  collection: 'portfolio',
  timestamps: true // Adds createdAt and updatedAt fields
});

// Add indexes for better query performance
contactSchema.index({ email: 1 });
contactSchema.index({ date: -1 });

const Contact = mongoose.model('Contact', contactSchema);

// ======================
// 4. API Routes
// ======================

// Admin routes
app.use('/api/admin', adminRouter);

/**
 * @route   POST /api/contact
 * @desc    Create a new contact message (public)
 * @access  Public
 */
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    const newContact = await Contact.create({
      name,
      email,
      subject,
      message,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });

    return res.status(201).json({
      success: true,
      data: newContact,
      message: 'Contact message submitted successfully'
    });

  } catch (error) {
    console.error('Error creating contact:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/contact
 * @desc    Get all contact messages (protected)
 * @access  Private (Admin only)
 */
app.get('/api/contact', verifyAdmin, async (req, res) => {
  try {
    // Add pagination and filtering in a real application
    const contacts = await Contact.find()
      .sort({ date: -1 })
      .lean(); // Convert to plain JS objects
    
    return res.json({
      success: true,
      count: contacts.length,
      data: contacts
    });
    
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving contact messages'
    });
  }
});

/**
 * @route   PUT /api/contact/:id
 * @desc    Update a contact message (protected)
 * @access  Private (Admin only)
 */
app.put('/api/contact/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, subject, message } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const updatedContact = await Contact.findByIdAndUpdate(
      id,
      { name, email, subject, message },
      { new: true, runValidators: true }
    );

    if (!updatedContact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    return res.json({
      success: true,
      data: updatedContact,
      message: 'Contact updated successfully'
    });

  } catch (error) {
    console.error('Error updating contact:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error updating contact'
    });
  }
});

/**
 * @route   DELETE /api/contact/:id
 * @desc    Delete a contact message (protected)
 * @access  Private (Admin only)
 */
app.delete('/api/contact/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const deletedContact = await Contact.findByIdAndDelete(id);

    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    return res.json({
      success: true,
      data: deletedContact,
      message: 'Contact deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting contact:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting contact'
    });
  }
});

// ======================
// 5. Error Handling Middleware
// ======================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Cross-origin request denied'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ======================
// 6. Server Initialization
// ======================

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});