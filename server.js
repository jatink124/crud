require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const timeout = require('connect-timeout');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://webdevgurus.online',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(compression());
app.use(timeout('15s'));
app.use((req, res, next) => {
  if (!req.timedout) next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Response time logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  next();
});

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://webdevgurus.online',
    'https://mygrowthplanner.netlify.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json({ limit: '10kb' }));

// Database connection with pooling
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
  socketTimeoutMS: 45000
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Admin credentials
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Schemas and Models
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

const chatSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  email: { type: String },
  message: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
}, { collection: 'chat_messages' });

const Portfolio = mongoose.model('Portfolio', portfolioSchema);
const ChatMessage = mongoose.model('ChatMessage', chatSchema);

// Socket.io
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('new_message', async (data) => {
    try {
      const message = await ChatMessage.create({
        sender: data.sender,
        email: data.email,
        message: data.message,
        isAdmin: data.isAdmin || false
      });

      io.emit('message_received', message);

      if (!data.isAdmin) {
        const mailOptions = {
          from: `"Chat Notification" <${process.env.EMAIL_USERNAME}>`,
          to: process.env.NOTIFICATION_EMAIL || 'kaushaljatin48@gmail.com',
          subject: `New Chat Message from ${data.sender}`,
          html: `...` // Your email template
        };

        transporter.sendMail(mailOptions)
          .then(info => console.log('Email sent:', info.messageId))
          .catch(err => console.error('Email error:', err));
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('mark_as_read', async (messageIds) => {
    try {
      await ChatMessage.updateMany(
        { _id: { $in: messageIds } },
        { $set: { read: true } }
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Routes
app.post('/api/admin/login', limiter, async (req, res) => {
  req.on('timeout', () => {
    res.status(503).json({ 
      success: false, 
      error: 'Service timeout' 
    });
  });

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }

    const usernameMatch = username === ADMIN_CREDENTIALS.username;
    const passwordMatch = password === ADMIN_CREDENTIALS.password;
    
    if (!usernameMatch || !passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    res.json({ 
      success: true,
      message: 'Login successful',
      admin: {
        username: ADMIN_CREDENTIALS.username
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

app.get('/api/contacts', async (req, res) => {
  try {
    // Fetch all contacts sorted by date (newest first)
    const contacts = await Portfolio.find().sort({ date: -1 });
    
    res.json({ 
      success: true, 
      data: contacts,
      count: contacts.length
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch contacts' 
    });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress;
    const portfolioItem = await Portfolio.create({ ...req.body, ip });

    const mailOptions = {
      from: `"Portfolio Contact" <${process.env.EMAIL_USERNAME}>`,
      to: process.env.NOTIFICATION_EMAIL || 'kaushaljatin48@gmail.com',
      subject: `New Contact: ${req.body.subject}`,
      html: `...` // Your email template
    };

    transporter.sendMail(mailOptions)
      .then(info => console.log('Email sent:', info.messageId))
      .catch(emailErr => console.error('Email error:', emailErr));

    res.status(201).json({ 
      success: true, 
      data: portfolioItem,
      message: 'Message received successfully' 
    });

  } catch (error) {
    console.error('Submission error:', error);
    
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

app.get('/api/chat/messages', async (req, res) => {
  try {
    const messages = await ChatMessage.find().sort({ timestamp: -1 }).limit(50);
    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

app.put('/api/chat/messages/mark-read', async (req, res) => {
  try {
    await ChatMessage.updateMany({ read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});