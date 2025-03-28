const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'contactSubmissions.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Contact form endpoint
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, subject, message, date } = req.body;

    // Validate input
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Read existing data
    const existingData = JSON.parse(fs.readFileSync(DATA_FILE));
    
    // Add new submission
    const newSubmission = {
      id: Date.now(), // Unique ID based on timestamp
      name,
      email,
      subject,
      message,
      date: date || new Date().toISOString(),
      ip: req.ip // Optional: track IP address
    };

    // Save to JSON file
    const updatedData = [...existingData, newSubmission];
    fs.writeFileSync(DATA_FILE, JSON.stringify(updatedData, null, 2));

    res.status(201).json({ 
      message: 'Form submitted successfully',
      submission: newSubmission
    });

  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optional: Add GET endpoint to view submissions
app.get('/api/contact', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error reading submissions' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Submissions stored in: ${DATA_FILE}`);
});